"""Detail tiles for the 3D view: the 1 m HiRISE terrain and the 25 cm HiRISE image, cut into 256 m tiles.

    python3 data/pipeline/make_tiles.py                     # -> data/raw/gale/tiles/ (git-ignored; hosted on Azure Blob)
    python3 data/pipeline/make_tiles.py --base-url https://<account>.blob.core.windows.net/tiles/gale

Why: the world grid is 8 m, which smooths away boxwork ridges (~5 m wide, 1-2 m high), ledges and crevices,
exactly what the route planner now avoids (passable.u8). The app keeps the 8 m mesh for the overview and swaps in
these tiles near the camera and the route. Too big for git (the world folder is capped at 5 MB), so they are
served from Azure Blob Storage and world.json only points to them ("detail_tiles").

Layout (tiles.json describes it; same north-up grid as the world, row 0 = north edge):
  h/{ty}_{tx}.u16   (tile+1) x (tile+1) heights, uint16 little-endian, centimetres above height_base_m.
                    One extra row and column shared with the next tile, so meshes join without gaps.
                    World height (the same datum as height.f32) = height_base_m + value / 100.
  img/{ty}_{tx}.jpg HiRISE colour at 25 cm (tile_m / 0.25 px square), JPEG.
  L{k}/h, L{k}/img  zoom levels k = 1..3 (tiles.json "levels"): the same layout 2^k times coarser (2, 4, 8 m heights;
                    0.5, 1, 2 m images; tiles 512, 1024, 2048 m), so the app loads coarse tiles first and sharpens
                    as you zoom in (like Google Earth). Heights are block means of the 1 m terrain.
  overview.jpg      the whole box in HiRISE colour at the height resolution (2048 px, 1 m/px), north up, same extent
                    as height.f32: one texture to drape on the terrain (world.json detail_tiles.overview).
  context/          horizon rings around the box (tiles.json "context"), made by make_context.py.
Tile (ty, tx) covers box metres x in [tx*tile_m, (tx+1)*tile_m], y in [ty*tile_m, ...] from the box's north-west
corner; height sample (r, c) of a tile sits at box metres (tx*tile_m + (c + 0.5)*height_res_m, ty*tile_m + (r + 0.5)*height_res_m).
The app puts world cell (x, y)'s centre at (x*cell_size_m, y*cell_size_m), so app position = box metres + app_offset_m
(app_offset_m = -cell_size_m/2 = -4 m on Gale).

Sources: USGS MSL Gale merged DEM 1 m v3 (MRO HiRISE stereo) and USGS MSL Gale HiRISE LRGB 25 cm mosaic,
cut by cut_slice.py.
"""
import argparse
import json
import os

import numpy as np
import rasterio
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, '..', 'raw', 'gale')
WORLD = os.path.join(HERE, '..', 'worlds', 'gale')


def _write_level(cm, img, n_t, ph, pi, out, jpeg_q):
    """Cut one level into n_t x n_t tiles: (ph+1)^2 uint16 heights (shared edges) and pi^2 JPEGs."""
    os.makedirs(os.path.join(out, 'h'), exist_ok=True)
    os.makedirs(os.path.join(out, 'img'), exist_ok=True)
    total = 0
    for ty in range(n_t):
        for tx in range(n_t):
            y0, x0 = ty * ph, tx * ph
            t = cm[y0:y0 + ph + 1, x0:x0 + ph + 1]
            if t.shape != (ph + 1, ph + 1):  # last row/column: repeat the edge
                t = np.pad(t, ((0, ph + 1 - t.shape[0]), (0, ph + 1 - t.shape[1])), mode='edge')
            p = os.path.join(out, 'h', f'{ty}_{tx}.u16')
            t.astype('<u2').tofile(p)
            total += os.path.getsize(p)
            q = os.path.join(out, 'img', f'{ty}_{tx}.jpg')
            Image.fromarray(img[ty * pi:(ty + 1) * pi, tx * pi:(tx + 1) * pi]).save(q, quality=jpeg_q)
            total += os.path.getsize(q)
    return total


def make(raw, world, out, tile_m=256, jpeg_q=82, base_url=None, max_level=3):
    with open(os.path.join(world, 'world.json')) as f:
        meta = json.load(f)
    with rasterio.open(os.path.join(raw, 'dem_1m.tif')) as d:
        h1 = d.read(1).astype('f8')
        res_h = abs(d.transform.a)
    with rasterio.open(os.path.join(raw, 'ortho_25cm.tif')) as d:
        img = np.moveaxis(d.read([1, 2, 3]), 0, 2)
        res_i = abs(d.transform.a)
    base = float(meta['height_offset_m'])  # world height.f32 = absolute - height_offset_m
    rel = h1 - base
    lo = float(np.floor(rel.min()))
    cm = np.round((rel - lo) * 100)
    if cm.max() > 65535:
        raise ValueError('relief over 655 m does not fit uint16 centimetres')
    side_m = meta['width'] * meta['cell_size_m']
    os.makedirs(out, exist_ok=True)
    total, levels = 0, []
    for k in range(max_level + 1):  # level k: 2^k coarser; level 0 keeps the original h/ and img/ paths
        f = 2 ** k
        lt = tile_m * f
        if side_m / lt < 1:
            break
        if k == 0:
            cm_k, img_k = cm, img
        else:
            hk = rel[:rel.shape[0] // f * f, :rel.shape[1] // f * f]
            hk = hk.reshape(hk.shape[0] // f, f, hk.shape[1] // f, f).mean(axis=(1, 3))
            cm_k = np.round((hk - lo) * 100)
            im = Image.fromarray(img)
            img_k = np.asarray(im.resize((im.width // f, im.height // f), Image.BOX))
        sub = '' if k == 0 else f'L{k}/'
        n_t = round(side_m / lt)
        total += _write_level(cm_k, img_k, n_t, round(lt / (res_h * f)), round(lt / (res_i * f)),
                              os.path.join(out, sub), jpeg_q)
        levels.append({'level': k, 'tile_m': lt, 'tiles': n_t, 'height_res_m': res_h * f, 'image_res_m': res_i * f,
                       'heights': sub + 'h/{ty}_{tx}.u16', 'images': sub + 'img/{ty}_{tx}.jpg'})
    n_t, ph, pi = levels[0]['tiles'], round(tile_m / res_h), round(tile_m / res_i)
    # one image of the whole box at the height resolution (1 m/px on Gale), north up, same box as height.f32
    ov = round(side_m / res_h)
    Image.fromarray(img).resize((ov, ov), Image.BOX).save(os.path.join(out, 'overview.jpg'), quality=88)
    total += os.path.getsize(os.path.join(out, 'overview.jpg'))
    manifest = {
        'site': meta['name'], 'tiles': n_t, 'tile_m': tile_m, 'height_res_m': res_h, 'image_res_m': res_i,
        'height_px': ph + 1, 'image_px': pi, 'height_base_m': lo, 'height_units': 'cm, uint16 little-endian',
        'height_datum': 'same as height.f32 (absolute minus world.json height_offset_m)',
        'heights': 'h/{ty}_{tx}.u16', 'images': 'img/{ty}_{tx}.jpg', 'row_order': 'north_to_south',
        'sources': {'height': 'USGS MSL Gale merged DEM 1 m v3 (MRO HiRISE stereo)',
                    'image': 'USGS MSL Gale HiRISE LRGB 25 cm mosaic (MRO HiRISE)'},
        'app_offset_m': -meta['cell_size_m'] / 2, 'sample_position': 'height sample at pixel centre',
        'base_url': base_url,
        'levels': levels,
        'overview': {'image': 'overview.jpg', 'px': ov, 'res_m': side_m / ov,
                     'covers': 'the whole box, north up, same extent as height.f32'},
    }
    old = os.path.join(out, 'tiles.json')
    if os.path.exists(old):  # keep the horizon rings make_context.py added
        with open(old) as f:
            prev = json.load(f)
        if 'context' in prev:
            manifest['context'] = prev['context']
    with open(os.path.join(out, 'tiles.json'), 'w') as f:
        json.dump(manifest, f, indent=2)
    return manifest, total


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--raw', default=RAW)
    p.add_argument('--world', default=WORLD)
    p.add_argument('--out', default=os.path.join(RAW, 'tiles'))
    p.add_argument('--base-url', default=None, help='where the tiles are hosted; written to world.json detail_tiles')
    a = p.parse_args()
    m, total = make(a.raw, a.world, a.out, base_url=a.base_url)
    print(f"wrote {m['tiles']}x{m['tiles']} tiles of {m['tile_m']} m to {os.path.abspath(a.out)}: "
          f"{total / 1e6:.1f} MB (heights {m['height_px']} px at {m['height_res_m']} m, images {m['image_px']} px "
          f"at {m['image_res_m']} m)")
    if a.base_url:
        wj = os.path.join(a.world, 'world.json')
        with open(wj) as f:
            meta = json.load(f)
        meta['detail_tiles'] = {'url': a.base_url.rstrip('/') + '/tiles.json',
                                'overview': a.base_url.rstrip('/') + '/overview.jpg',
                                'note': 'Optional 1 m terrain + 25 cm HiRISE tiles for the 3D view (make_tiles.py); '
                                        'overview: the whole box in HiRISE colour at 1 m/px, north up'}
        with open(wj, 'w') as f:
            json.dump(meta, f, indent=2)
        print(f'world.json detail_tiles -> {meta["detail_tiles"]["url"]}')


if __name__ == '__main__':
    main()
