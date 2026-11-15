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


def make(raw, world, out, tile_m=256, jpeg_q=82, base_url=None):
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
    n_t = round(side_m / tile_m)
    ph, pi = round(tile_m / res_h), round(tile_m / res_i)
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
    manifest = {
        'site': meta['name'], 'tiles': n_t, 'tile_m': tile_m, 'height_res_m': res_h, 'image_res_m': res_i,
        'height_px': ph + 1, 'image_px': pi, 'height_base_m': lo, 'height_units': 'cm, uint16 little-endian',
        'height_datum': 'same as height.f32 (absolute minus world.json height_offset_m)',
        'heights': 'h/{ty}_{tx}.u16', 'images': 'img/{ty}_{tx}.jpg', 'row_order': 'north_to_south',
        'sources': {'height': 'USGS MSL Gale merged DEM 1 m v3 (MRO HiRISE stereo)',
                    'image': 'USGS MSL Gale HiRISE LRGB 25 cm mosaic (MRO HiRISE)'},
        'app_offset_m': -meta['cell_size_m'] / 2, 'sample_position': 'height sample at pixel centre',
        'base_url': base_url,
    }
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
                                'note': 'Optional 1 m terrain + 25 cm HiRISE tiles for the 3D view (make_tiles.py)'}
        with open(wj, 'w') as f:
            json.dump(meta, f, indent=2)
        print(f'world.json detail_tiles -> {meta["detail_tiles"]["url"]}')


if __name__ == '__main__':
    main()
