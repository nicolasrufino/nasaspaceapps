"""D1: cut our 2 x 2 km slice of Gale from the USGS mosaics without downloading them whole.

Sources (USGS Astrogeology, built from MRO HiRISE stereo and images):
  - MSL Gale merged DEM, 1 m/px, v3 (3.6 GB)
    https://astrogeology.usgs.gov/search/map/mars_msl_gale_merged_dem_1m
  - MSL Gale merged orthophoto mosaic, 25 cm/px, v3 (23 GB greyscale, or ~1 GB colour COG)
    https://astrogeology.usgs.gov/search/map/mars_msl_gale_merged_orthophoto_mosaic_25cm

GDAL reads only the bytes inside the box over HTTP (/vsicurl), so the full files never land on disk.

    pip install -r data/pipeline/requirements-gdal.txt
    python3 data/pipeline/cut_slice.py --lat -4.720 --lon 137.375 --info      # sizes only, no download
    python3 data/pipeline/cut_slice.py --lat -4.720 --lon 137.375             # cut into data/raw/gale/

Outputs (data/raw/gale/, git-ignored):
  dem_1m.tif         2048 x 2048, float32 metres, same grid as the box
  ortho_25cm.tif     8192 x 8192, uint8 (or RGB with --ortho color), aligned to the same box
  dem_8m.tif         256 x 256 "orbit view" (mean of 8 x 8 blocks of the 1 m DEM)
  optical_8m.png     256 x 256 image for world files (contract optical.png)
  preview.png        hillshade | image, 1024 px, to eyeball boxwork / sand / rocks
  slice.json         georeferencing + source links + quick stats (share this with Jules and Nico)

Every output shares one north-up grid: row 0 = north edge, as in docs/CONTRACTS.md section 1.
"""
import argparse
import json
import math
import os

import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.enums import Resampling
from rasterio.transform import from_origin
from rasterio.warp import reproject
from rasterio.warp import transform as warp_xy

DEM_URL = 'https://planetarymaps.usgs.gov/mosaic/Mars/MSL/MSL_Gale_DEM_Mosaic_1m_v3.tif'
ORTHO_URLS = {
    'gray': 'https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/MSL_Gale_Orthophoto_Mosaic_25cm_v3.tif',
    'color': 'https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/Mars/MSL/MSL_Gale_HiRISE-LRGB_78quads_sharp_cog.tif',
}
PAGES = {
    'dem': 'https://astrogeology.usgs.gov/search/map/mars_msl_gale_merged_dem_1m',
    'ortho': 'https://astrogeology.usgs.gov/search/map/mars_msl_gale_merged_orthophoto_mosaic_25cm',
}
MARS_LONLAT = CRS.from_proj4('+proj=longlat +a=3396190 +b=3396190 +no_defs')
GDAL_ENV = {'GDAL_DISABLE_READDIR_ON_OPEN': 'EMPTY_DIR', 'CPL_VSIL_CURL_ALLOWED_EXTENSIONS': '.tif',
                'GDAL_HTTP_MULTIRANGE': 'YES', 'GDAL_HTTP_MERGE_CONSECUTIVE_RANGES': 'YES', 'VSI_CACHE': 'TRUE'}


def vsi(url):
    return url if url.startswith('/') or '://' not in url else '/vsicurl/' + url


def box_grid(src_crs, lat, lon, size_m):
    """North-up grid of size_m centred on (lat, lon), in the DEM's own projected metres."""
    xs, ys = warp_xy(MARS_LONLAT, src_crs, [lon], [lat])
    half = size_m / 2.0
    # snap to whole metres so the 1 m DEM is copied, not resampled
    left, top = math.floor(xs[0] - half), math.floor(ys[0] + half)
    return left, top


def read_onto(src, left, top, res, n, resampling, bands=None):
    """Read src onto our n x n grid (res m/px, origin left/top in src.crs). Reads only the window."""
    dst_t = from_origin(left, top, res, res)
    bands = bands or list(range(1, src.count + 1))
    out = np.zeros((len(bands), n, n), dtype=src.dtypes[0])
    for k, b in enumerate(bands):
        reproject(rasterio.band(src, b), out[k], src_transform=src.transform, src_crs=src.crs,
                  dst_transform=dst_t, dst_crs=src.crs, resampling=resampling,
                  src_nodata=src.nodata, dst_nodata=src.nodata if src.nodata is not None else 0)
    return out, dst_t


def window_bytes(src, left, top, size_m):
    """Rough bytes GDAL must fetch: whole blocks touched by the window."""
    win = src.window(left, top - size_m, left + size_m, top)
    bh, bw = src.block_shapes[0]
    rows = math.ceil((win.height + bh) / bh)
    cols = math.ceil((win.width + bw) / bw) if bw < src.width else 1
    per = bh * (min(src.width, bw)) * np.dtype(src.dtypes[0]).itemsize * src.count
    return rows * cols * per, (bh, bw), src.profile.get('compress')


def slope_deg(h, res):
    gy, gx = np.gradient(h.astype('f8'), res)
    return np.degrees(np.arctan(np.hypot(gx, gy)))


def hillshade(h, res, az=315, alt=45):
    gy, gx = np.gradient(h.astype('f8'), res)
    slope = np.arctan(np.hypot(gx, gy))
    aspect = np.arctan2(-gx, gy)
    a, z = np.radians(az), np.radians(90 - alt)
    s = np.cos(z) * np.cos(slope) + np.sin(z) * np.sin(slope) * np.cos(a - aspect)
    return (np.clip(s, 0, 1) * 255).astype('u1')


def stretch(img):
    lo, hi = np.percentile(img[img > 0], [1, 99]) if (img > 0).any() else (0, 255)
    return (np.clip((img.astype('f4') - lo) / max(hi - lo, 1), 0, 1) * 255).astype('u1')


def save_png(path, arr):
    from PIL import Image
    Image.fromarray(arr).save(path)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--lat', type=float, required=True, help='box centre, planetocentric degrees')
    p.add_argument('--lon', type=float, required=True, help='box centre, degrees east')
    p.add_argument('--size', type=float, default=2048.0, help='box side in metres (2048 -> 256 cells at 8 m)')
    p.add_argument('--orbit-cell', type=float, default=8.0)
    p.add_argument('--ortho', choices=['gray', 'color'], default='gray')
    p.add_argument('--dem-url', default=DEM_URL)
    p.add_argument('--ortho-url', default=None)
    p.add_argument('--check', nargs=2, type=float, metavar=('LAT', 'LON'), action='append', default=[],
                   help='report whether a point (e.g. Jules\'s rock patch) lies in the box; repeatable')
    p.add_argument('--info', action='store_true', help='print grid and download size, then stop')
    p.add_argument('--out', default=os.path.join(os.path.dirname(__file__), '..', 'raw', 'gale'))
    a = p.parse_args()
    ortho_url = a.ortho_url or ORTHO_URLS[a.ortho]
    n1 = round(a.size)
    no = round(a.size / a.orbit_cell)

    with rasterio.Env(**GDAL_ENV):
        dem = rasterio.open(vsi(a.dem_url))
        ort = rasterio.open(vsi(ortho_url))
        if ort.crs != dem.crs:
            print('note: orthophoto CRS differs from DEM; reprojecting image onto the DEM grid')
        left, top = box_grid(dem.crs, a.lat, a.lon, a.size)
        right, bottom = left + a.size, top - a.size
        lons, lats = warp_xy(dem.crs, MARS_LONLAT, [left, right, right, left], [top, top, bottom, bottom])
        bbox = {'west': min(lons), 'east': max(lons), 'south': min(lats), 'north': max(lats)}
        db, dblk, dcomp = window_bytes(dem, left, top, a.size)
        ores = abs(ort.transform.a)
        print(f'DEM   {dem.width}x{dem.height} {dem.dtypes[0]} res {abs(dem.transform.a):g} m, blocks {dblk}, '
              f'compress {dcomp}, ~{db / 1e6:.0f} MB to fetch')
        if ort.crs == dem.crs:
            ob, oblk, ocomp = window_bytes(ort, left, top, a.size)
            print(f'ORTHO {ort.width}x{ort.height} x{ort.count} {ort.dtypes[0]} res {ores:g} m, blocks {oblk}, '
                  f'compress {ocomp}, ~{ob / 1e6:.0f} MB to fetch')
        print(f'box  {a.size:g} m, centre {a.lat:.5f}, {a.lon:.5f}E -> lat {bbox["south"]:.5f}..{bbox["north"]:.5f}, '
              f'lon {bbox["west"]:.5f}..{bbox["east"]:.5f}')
        inside = []
        for la, lo in a.check:
            x, y = warp_xy(MARS_LONLAT, dem.crs, [lo], [la])
            ok = left <= x[0] <= right and bottom <= y[0] <= top
            inside.append({'lat': la, 'lon': lo, 'inside': ok,
                               'cell_8m': [int((x[0] - left) // a.orbit_cell), int((top - y[0]) // a.orbit_cell)] if ok else None})
            print(f'check {la}, {lo}E: {"INSIDE" if ok else "OUTSIDE"} the box')
        if a.info:
            return

        os.makedirs(a.out, exist_ok=True)
        h, t1 = read_onto(dem, left, top, 1.0, n1, Resampling.nearest)
        h = h[0].astype('f4')
        nod = dem.nodata
        valid = np.isfinite(h) & ((h != nod) if nod is not None else True)
        print(f'DEM read: {valid.mean() * 100:.1f}% valid')
        ortho_res = 0.25
        n4 = round(a.size / ortho_res)
        img, t4 = read_onto(ort, left, top, ortho_res, n4, Resampling.bilinear, bands=list(range(1, min(ort.count, 3) + 1)))

        def write_tif(path, arr, transform, nodata=None):
            arr = arr if arr.ndim == 3 else arr[None]
            with rasterio.open(path, 'w', driver='GTiff', width=arr.shape[2], height=arr.shape[1], count=arr.shape[0],
                               dtype=arr.dtype, crs=dem.crs, transform=transform, nodata=nodata,
                               tiled=True, compress='deflate') as d:
                d.write(arr)

        write_tif(os.path.join(a.out, 'dem_1m.tif'), h, t1, nod)
        write_tif(os.path.join(a.out, 'ortho_25cm.tif'), img, t4, 0)

        # 8 m orbit view: block mean of the 1 m DEM (exact, since 2048 = 256 * 8)
        k = n1 // no
        hm = np.where(valid, h, np.nan)[:no * k, :no * k].reshape(no, k, no, k)
        h8 = np.nanmean(hm, axis=(1, 3)).astype('f4')
        t8 = from_origin(left, top, a.orbit_cell, a.orbit_cell)
        write_tif(os.path.join(a.out, 'dem_8m.tif'), np.nan_to_num(h8, nan=-1e9).astype('f4'), t8, -1e9)
        gray = img.mean(axis=0) if img.shape[0] > 1 else img[0]
        k4 = n4 // no
        o8 = gray[:no * k4, :no * k4].reshape(no, k4, no, k4).mean(axis=(1, 3))
        save_png(os.path.join(a.out, 'optical_8m.png'), stretch(o8))

        hv = np.where(valid, h, np.nanmean(np.where(valid, h, np.nan)))
        s1, s8 = slope_deg(hv, 1.0), slope_deg(np.nan_to_num(h8, nan=np.nanmean(h8)), a.orbit_cell)
        side = 1024
        hs = hillshade(hv, 1.0)[::n1 // side, ::n1 // side][:side, :side]
        im = stretch(gray[::n4 // side, ::n4 // side][:side, :side])
        save_png(os.path.join(a.out, 'preview.png'), np.hstack([hs, np.full((side, 8), 255, 'u1'), im]))

        stats = {
            'elevation_m': [float(np.nanmin(h8)), float(np.nanmax(h8))],
            'relief_m': float(np.nanmax(h8) - np.nanmin(h8)),
            'pct_slope_over_15deg_1m': round(float((s1[valid] > 15).mean() * 100), 2),
            'pct_slope_over_15deg_8m': round(float((s8 > 15).mean() * 100), 2),
            'pct_slope_over_25deg_1m': round(float((s1[valid] > 25).mean() * 100), 2),
            'dem_valid_pct': round(float(valid.mean() * 100), 2),
        }
        meta = {
            'name': 'gale', 'centre': {'lat': a.lat, 'lon_east': a.lon}, 'size_m': a.size, 'bbox_deg': bbox,
            'projection': {'wkt': dem.crs.to_wkt(), 'proj4': dem.crs.to_proj4(), 'body': 'Mars sphere r=3396190 m',
                            'latitude': 'planetocentric', 'longitude': 'positive east'},
            'box_projected_m': {'left': left, 'top': top, 'right': right, 'bottom': bottom},
            'row_order': 'north_to_south',
            'grids': {
                'dem_1m.tif': {'width': n1, 'height': n1, 'res_m': 1.0, 'geotransform': list(t1.to_gdal())},
                'ortho_25cm.tif': {'width': n4, 'height': n4, 'res_m': ortho_res, 'bands': int(img.shape[0]),
                                       'geotransform': list(t4.to_gdal())},
                'dem_8m.tif': {'width': no, 'height': no, 'res_m': a.orbit_cell, 'geotransform': list(t8.to_gdal())},
            },
            'pixel_to_map': 'x_m = left + (col + 0.5) * res; y_m = top - (row + 0.5) * res (pixel centre)',
            'sources': {
                'dem': {'url': a.dem_url, 'page': PAGES['dem'], 'product': 'USGS MSL Gale merged DEM 1 m v3 (HiRISE stereo)'},
                'ortho': {'url': ortho_url, 'page': PAGES['ortho'],
                           'product': 'USGS MSL Gale merged orthophoto mosaic 25 cm v3 (HiRISE)'}},
            'checks': inside, 'stats': stats,
        }
        with open(os.path.join(a.out, 'slice.json'), 'w') as f:
            json.dump(meta, f, indent=2)
        print(json.dumps(stats, indent=2))
        print(f'wrote {os.path.abspath(a.out)}: dem_1m.tif ortho_25cm.tif dem_8m.tif optical_8m.png preview.png slice.json')


if __name__ == '__main__':
    main()
