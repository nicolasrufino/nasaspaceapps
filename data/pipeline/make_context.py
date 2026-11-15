"""Horizon context for the 3D view: lower-resolution terrain around the 2 km box, so the crater rim and Mount Sharp
show on the horizon instead of the world ending at the box edge.

    python3 data/pipeline/make_context.py        # after make_tiles.py; adds context/ to data/raw/gale/tiles and
                                                 # a "context" list to tiles.json (re-upload with upload_tiles.sh)

Rings (each a square centred on the box; the app draws them under the detail tiles, coarsest first):
  near   30 km at 32 m   USGS MSL Gale merged DEM 1 m v3 (HiRISE/CTX/HRSC tied to MOLA), every 32nd sample
  far   240 km at 463 m  MGS MOLA global DEM 463 m (USGS mosaic): Gale's rim (~4.8 km relief) and Mount Sharp's peak
Images are shaded relief tinted with Mars colours (sun from the north-west), labelled 'shaded relief' in tiles.json:
not photographs. Where the HiRISE LRGB colour mosaic covers the near ring, its overview replaces the shading.

Format: context/{name}.u16 = px x px heights, uint16 little-endian, decimetres above height_base_m, same datum as
height.f32 (absolute - world.json height_offset_m); context/{name}.jpg = image; box_m = [x0, y0, x1, y1] of the square
in box metres (from the box's north-west corner, y to the south; negative = outside the box).
"""
import json
import os

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, '..', 'raw', 'gale')
WORLD = os.path.join(HERE, '..', 'worlds', 'gale')
TILES = os.path.join(RAW, 'tiles')
# USGS MSL Gale merged DEM 1 m v3 (planetarymaps.usgs.gov redirects here; the direct URL avoids a redirect per row)
GALE_DEM = 'https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/Mars/MSL/MSL_Gale_DEM_Mosaic_1m_v3.tif'
MOLA = 'https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/Mars_MGS_MOLA_DEM_mosaic_global_463m.tif'
LRGB = 'https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/Mars/MSL/MSL_Gale_HiRISE-LRGB_78quads_sharp_cog.tif'
RINGS = [('near', 30000, 32, GALE_DEM, 'USGS MSL Gale merged DEM 1 m v3, every 32nd sample'),
         ('far', 240000, 463.0935415503709, MOLA, 'MGS MOLA global DEM 463 m (USGS)')]
os.environ.setdefault('GDAL_DISABLE_READDIR_ON_OPEN', 'EMPTY_DIR')
os.environ.setdefault('CPL_VSIL_CURL_ALLOWED_EXTENSIONS', '.tif')  # Gale DEM is striped: ~1 request per row, ~5 min


def shaded(h, res, az=315, alt=35):
    """Hillshade tinted with a dusty Mars palette (estimate of colour, not a photograph)."""
    gy, gx = np.gradient(h, res)
    a, e = np.radians(az), np.radians(alt)
    nx, ny, nz = -gx, gy, np.ones_like(h)
    norm = np.sqrt(nx * nx + ny * ny + 1)
    lx, ly, lz = np.cos(e) * np.sin(a), np.cos(e) * np.cos(a), np.sin(e)
    s = np.clip((nx * lx + ny * ly + nz * lz) / norm, 0, 1)
    dark, light = np.array([70, 42, 28.0]), np.array([214, 160, 112.0])
    return (dark + (light - dark) * s[..., None]).astype('u1')


def read_square(url, cx, cy, size, res):
    """Square of side size (m) centred on projected (cx, cy), sampled at res m (nearest); NaN outside the data.
    Reads only the part inside the file (no boundless read: that path fetches every row of a striped file)."""
    import rasterio
    from rasterio.windows import Window, from_bounds
    px = round(size / res)
    out = np.full((px, px), np.nan)
    with rasterio.open('/vsicurl/' + url) as d:
        win = from_bounds(cx - size / 2, cy - size / 2, cx + size / 2, cy + size / 2, d.transform)
        r0, c0 = max(0, int(win.row_off)), max(0, int(win.col_off))
        r1, c1 = min(d.height, int(win.row_off + win.height)), min(d.width, int(win.col_off + win.width))
        step = win.height / px  # source pixels per output pixel
        oy0, ox0 = max(0, round((r0 - win.row_off) / step)), max(0, round((c0 - win.col_off) / step))
        oh, ow = round((r1 - r0) / step), round((c1 - c0) / step)
        oh, ow = min(oh, px - oy0), min(ow, px - ox0)
        a = d.read(1, window=Window(c0, r0, c1 - c0, r1 - r0), out_shape=(oh, ow)).astype('f8')
        if d.nodata is not None:
            a[a == d.nodata] = np.nan
        a[a < -10000] = np.nan  # Gale DEM fill value -32767 (no nodata tag)
        out[oy0:oy0 + oh, ox0:ox0 + ow] = a
    return out, None


def lrgb_over(cx, cy, size, px):
    """HiRISE LRGB colour (from its overviews) for the square, and a mask of where it covers."""
    import rasterio
    from rasterio.enums import Resampling
    from rasterio.windows import Window, from_bounds
    rgb = np.zeros((3, px, px), 'u1')
    with rasterio.open('/vsicurl/' + LRGB) as d:
        win = from_bounds(cx - size / 2, cy - size / 2, cx + size / 2, cy + size / 2, d.transform)
        r0, c0 = max(0, int(win.row_off)), max(0, int(win.col_off))
        r1, c1 = min(d.height, int(win.row_off + win.height)), min(d.width, int(win.col_off + win.width))
        if r1 > r0 and c1 > c0:
            step = win.height / px
            oy0, ox0 = max(0, round((r0 - win.row_off) / step)), max(0, round((c0 - win.col_off) / step))
            oh, ow = min(round((r1 - r0) / step), px - oy0), min(round((c1 - c0) / step), px - ox0)
            rgb[:, oy0:oy0 + oh, ox0:ox0 + ow] = d.read([1, 2, 3], window=Window(c0, r0, c1 - c0, r1 - r0),
                                                        out_shape=(3, oh, ow), resampling=Resampling.average)
    rgb = np.moveaxis(rgb, 0, 2)
    return rgb, rgb.astype('u2').sum(axis=2) > 30


def main(tiles=TILES):
    with open(os.path.join(WORLD, 'world.json')) as f:
        meta = json.load(f)
    with open(os.path.join(tiles, 'tiles.json')) as f:
        manifest = json.load(f)
    import rasterio
    with rasterio.open(os.path.join(RAW, 'dem_1m.tif')) as d:  # the box in projected metres
        b = d.bounds
    side = meta['width'] * meta['cell_size_m']
    cx, cy = (b.left + b.right) / 2, (b.top + b.bottom) / 2
    base = float(meta['height_offset_m'])
    os.makedirs(os.path.join(tiles, 'context'), exist_ok=True)
    ctx, coarser = [], None
    for name, size, res, url, src in sorted(RINGS, key=lambda r: -r[1]):  # coarsest first: it fills the next one's gaps
        h, _ = read_square(url, cx, cy, size, res)
        hole = np.isnan(h)
        if hole.all():
            raise SystemExit(f'{name}: no data')
        if hole.any():
            from scipy import ndimage as ndi
            if coarser is not None:  # outside the Gale DEM: the coarser ring's terrain, bilinear
                ch, csize, cres = coarser
                pos = (np.arange(h.shape[0]) + 0.5) * res - size / 2  # metres from the centre
                ci = (pos + csize / 2) / cres - 0.5
                yy, xx = np.meshgrid(ci, ci, indexing='ij')
                h = np.where(hole, ndi.map_coordinates(ch, [yy, xx], order=1, mode='nearest'), h)
            else:  # nearest valid value
                idx = ndi.distance_transform_edt(hole, return_distances=False, return_indices=True)
                h = h[tuple(idx)]
        coarser = (h, size, res)
        rel = h - base
        lo = float(np.floor(rel.min()))
        dm = np.round((rel - lo) * 10)
        if dm.max() > 65535:
            raise SystemExit(f'{name}: relief over 6.5 km does not fit uint16 decimetres')
        px = h.shape[0]
        img = shaded(h, res)
        kind = 'shaded relief (Mars-tinted hillshade, not a photograph)'
        if name == 'near':
            rgb, ok = lrgb_over(cx, cy, size, px)
            img[ok] = rgb[ok]
            kind += f'; HiRISE LRGB colour where covered ({ok.mean() * 100:.0f}% of the ring)'
        dm.astype('<u2').tofile(os.path.join(tiles, 'context', f'{name}.u16'))
        Image.fromarray(img).save(os.path.join(tiles, 'context', f'{name}.jpg'), quality=85)
        half = size / 2
        ctx.append({'name': name, 'size_m': size, 'px': px, 'height_res_m': round(res, 4),
                    'box_m': [side / 2 - half, side / 2 - half, side / 2 + half, side / 2 + half],
                    'height_base_m': lo, 'height_units': 'dm, uint16 little-endian',
                    'heights': f'context/{name}.u16', 'image': f'context/{name}.jpg', 'image_kind': kind,
                    'source': src, 'sample_position': 'height sample at pixel centre',
                    'relief_m': round(float(rel.max() - rel.min()), 1)})
        print(f"{name}: {size / 1000:.0f} km at {res:.0f} m ({px} px), relief {ctx[-1]['relief_m']} m; {kind}")
    manifest['context'] = sorted(ctx, key=lambda r: r['size_m'])
    with open(os.path.join(tiles, 'tiles.json'), 'w') as f:
        json.dump(manifest, f, indent=2)


if __name__ == '__main__':
    main()
