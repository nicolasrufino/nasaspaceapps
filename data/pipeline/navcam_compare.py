"""Accuracy check, part 2: render our terrain from Curiosity's own Navcam cameras and compare with the real photos.

    python3 data/pipeline/navcam_compare.py      # needs data/raw/gale (cut_slice.py); downloads the Navcam frames
    -> docs/validation/navcam_sol4611.jpg (photo above, our render below, per frame) + "navcam" in validation.json

Sources: Curiosity Navcam raw images, sol 4611 (NASA/JPL-Caltech, mars.nasa.gov raw image API), with each frame's
CAHVOR camera model and rover attitude; Curiosity's position from the NASA/JPL MSL MMGIS traverse (site/drive of the
frames); USGS MSL Gale merged DEM 1 m v3 and the HiRISE 25 cm colour orthoimage for the render.

Method: one ray per pixel from the frame's CAHV model (rover frame), rotated to local north-east-down by the rover
attitude quaternion, marched over the 1 m terrain until it hits the ground; the hit is coloured from the HiRISE
image. The match score is the correlation of edge strength (photo vs render) over pixels whose ray hit the box.
The same score with the render turned by -4..+4 deg shows whether the terrain and the camera line up (peak at 0).
"""
import json
import math
import os
import subprocess

import numpy as np
from scipy import ndimage as ndi

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, '..', 'raw', 'gale')
WORLD = os.path.join(HERE, '..', 'worlds', 'gale')
OUT = os.path.join(HERE, '..', '..', 'docs', 'validation')
SOL, SEQ = 4611, 'NCAM00594'  # noon horizon panorama, 8 frames, 45 deg apart
API = ('https://mars.nasa.gov/api/v1/raw_image_items/?order=sol%20desc&per_page=100&page=0'
       '&condition_1=msl:mission&condition_2={sol}:sol:in&condition_3=NAV_LEFT_B,NAV_RIGHT_B:instrument:in')
SCALE = 4  # render every 4th pixel (256 x 128 per frame)


def load_json(path):
    with open(path) as fh:
        return json.load(fh)


def quat_matrix(w, x, y, z):
    """Rotation matrix of a unit quaternion (rover frame -> local level north-east-down)."""
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y)],
                     [2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)],
                     [2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)]])


def cahv_rays(c, a, h, v, cols, rows):
    """Unit ray directions for pixel (col, row) from a CAHV(OR) model (distortion ignored), in the model's frame."""
    a, h, v = map(np.asarray, (a, h, v))
    x, y = np.meshgrid(cols, rows)
    hx = h[None, None] - x[..., None] * a[None, None]
    vy = v[None, None] - y[..., None] * a[None, None]
    d = np.cross(vy, hx)
    d *= np.sign(d @ a)[..., None]
    return d / np.linalg.norm(d, axis=-1, keepdims=True)


def march(h1, origin, dirs, far=2500.0):
    """First ground hit of each ray over the 1 m terrain. origin/dirs: (east, south, up) in box metres.
    Returns hit east, south and a mask; rays that leave the box or reach the sky are False."""
    n = h1.shape[0]
    shp = dirs.shape[:-1]
    d = dirs.reshape(-1, 3)
    t = np.full(len(d), 0.5)
    hit = np.zeros(len(d), bool)
    alive = np.ones(len(d), bool)
    he, hs = np.zeros(len(d)), np.zeros(len(d))
    while alive.any():
        idx = np.nonzero(alive)[0]
        p = origin + d[idx] * t[idx, None]
        inside = (p[:, 0] >= 0) & (p[:, 0] < n - 1) & (p[:, 1] >= 0) & (p[:, 1] < n - 1)
        g = ndi.map_coordinates(h1, [np.clip(p[:, 1] - 0.5, 0, n - 1), np.clip(p[:, 0] - 0.5, 0, n - 1)],
                                order=1, mode='nearest')
        under = inside & (p[:, 2] <= g)
        hit[idx[under]] = True
        he[idx[under]], hs[idx[under]] = p[under, 0], p[under, 1]
        stop = under | ~inside | (t[idx] > far)
        alive[idx[stop]] = False
        t[idx] += np.maximum(0.25, t[idx] * 0.004)
    return he.reshape(shp), hs.reshape(shp), hit.reshape(shp)


def edge(img):
    return np.hypot(ndi.sobel(img, 0), ndi.sobel(img, 1))


def score(photo, render, mask):
    if mask.sum() < 100:
        return None
    a, b = edge(photo)[mask], edge(render)[mask]
    return float(np.corrcoef(a, b)[0, 1])


def fetch_frames(folder):
    os.makedirs(folder, exist_ok=True)
    api = os.path.join(folder, 'api.json')
    if not os.path.exists(api):
        subprocess.run(['curl', '-sf', '-o', api, API.format(sol=SOL)], check=True)
    seen, frames = set(), []
    for it in sorted(load_json(api)['items'], key=lambda i: i['imageid']):
        if SEQ not in it['imageid'] or 'EDR_S' not in it['imageid']:
            continue
        az = round(float(it['extended']['mast_az']))
        if az in seen:
            continue
        seen.add(az)
        fn = os.path.join(folder, it['imageid'] + '.jpg')
        if not os.path.exists(fn):
            subprocess.run(['curl', '-sf', '-o', fn, it['https_url']], check=True)
        frames.append((it, fn))
    return frames


def main():
    import rasterio
    from PIL import Image
    from rasterio.crs import CRS
    from rasterio.warp import transform

    dem = rasterio.open(os.path.join(RAW, 'dem_1m.tif'))
    h1 = dem.read(1).astype('f8')
    ortho = rasterio.open(os.path.join(RAW, 'ortho_25cm.tif')).read().sum(axis=0, dtype='u2').astype('f4') / 3
    os_ = ortho.shape[0] / h1.shape[0]  # ortho pixels per metre
    frames = fetch_frames(os.path.join(RAW, f'navcam_{SOL}'))
    it0 = frames[0][0]
    wp = [f for f in load_json(os.path.join(RAW, 'msl_waypoints.json'))['features']
          if f['properties'].get('site') == it0['site'] and f['properties'].get('drive') == it0['drive']]
    if not wp:
        raise SystemExit(f"no traverse waypoint for site {it0['site']} drive {it0['drive']}")
    lon, lat = wp[0]['geometry']['coordinates'][:2]
    mars = CRS.from_proj4('+proj=longlat +a=3396190 +b=3396190 +no_defs')
    x, y = transform(mars, dem.crs, [lon], [lat])
    col, row = ~dem.transform * (x[0], y[0])  # box metres east, south
    ground = float(ndi.map_coordinates(h1, [[row - 0.5], [col - 0.5]], order=1)[0])

    results, strips = [], []
    for it, fn in frames:
        cm = [tuple(float(v) for v in part.strip('()').split(',')) for part in it['camera_model_component_list'].split(';')]
        c, a, h, v = cm[:4]
        r = quat_matrix(*[float(q) for q in it['attitude'].strip('()').split(',')])
        sub = [int(s) for s in it['subframe_rect'].strip('()').split(',')]  # col, row (1-based), width, height
        photo = np.asarray(Image.open(fn).convert('L'), 'f4')
        cols = sub[0] - 1 + np.arange(0, photo.shape[1], SCALE) + SCALE / 2
        rows = sub[1] - 1 + np.arange(0, photo.shape[0], SCALE) + SCALE / 2
        dirs_r = cahv_rays(c, a, h, v, cols, rows)
        cam_ned = r @ np.asarray(c)
        origin = np.array([col + cam_ned[1], row - cam_ned[0], ground - cam_ned[2]])
        small = photo[::SCALE, ::SCALE][:len(rows), :len(cols)]
        best = {}
        for turn in (-4, -2, 0, 2, 4):
            yaw = np.radians(turn)
            rz = np.array([[math.cos(yaw), -math.sin(yaw), 0], [math.sin(yaw), math.cos(yaw), 0], [0, 0, 1]])
            ned = dirs_r @ (rz @ r).T
            dirs = np.stack([ned[..., 1], -ned[..., 0], -ned[..., 2]], -1)  # east, south, up
            he, hs, hit = march(h1, origin, dirs)
            img = np.where(hit, ndi.map_coordinates(ortho, [hs * os_, he * os_], order=1, mode='nearest'), 0.0)
            best[turn] = (score(small, img, ndi.binary_erosion(hit, iterations=2)), img, hit)
        s0 = best[0][0]
        results.append({'frame': it['imageid'], 'mast_az_deg': float(it['extended']['mast_az']),
                        'mast_el_deg': float(it['extended']['mast_el']),
                        'terrain_pixels': int(best[0][2].sum()),
                        'edge_correlation': None if s0 is None else round(s0, 3),
                        'edge_correlation_by_turn_deg': {str(k): None if b[0] is None else round(b[0], 3)
                                                         for k, b in best.items()}})
        ren = best[0][1]
        ren = ren / max(ren.max(), 1) * 255
        strips.append(np.vstack([small / max(small.max(), 1) * 255, ren]))
        print(f"az {float(it['extended']['mast_az']):6.1f}: terrain px {int(best[0][2].sum()):5d}, "
              f"edge corr {results[-1]['edge_correlation']}, by turn {results[-1]['edge_correlation_by_turn_deg']}")

    os.makedirs(OUT, exist_ok=True)
    sheet = np.hstack([np.pad(s, ((0, 0), (0, 4)), constant_values=255) for s in strips])
    Image.fromarray(sheet.clip(0, 255).astype('u1')).save(os.path.join(OUT, f'navcam_sol{SOL}.jpg'), quality=85)
    scored = [r['edge_correlation'] for r in results if r['edge_correlation'] is not None]
    peak = {t: float(np.mean([r['edge_correlation_by_turn_deg'][str(t)] for r in results
                              if r['edge_correlation_by_turn_deg'][str(t)] is not None])) for t in (-4, -2, 0, 2, 4)}
    v = load_json(os.path.join(WORLD, 'validation.json'))
    v['navcam'] = {'what': 'Our 1 m terrain rendered from Curiosity Navcam camera models vs the photos',
                   'made_by': 'data/pipeline/navcam_compare.py', 'sol': SOL, 'sequence': SEQ,
                   'rover_box_m': [round(col, 1), round(row, 1)], 'site_drive': [it0['site'], it0['drive']],
                   'image': f'docs/validation/navcam_sol{SOL}.jpg',
                   'mean_edge_correlation': round(float(np.mean(scored)), 3) if scored else None,
                   'mean_edge_correlation_by_turn_deg': {str(k): round(p, 3) for k, p in peak.items()},
                   'note': 'Edge correlation is a rough agreement score (1 = identical edges, 0 = unrelated). '
                           'Shadows differ (HiRISE time vs Navcam noon); far terrain outside the 2 km box is not rendered.',
                   'frames': results}
    with open(os.path.join(WORLD, 'validation.json'), 'w') as fh:
        json.dump(v, fh, separators=(',', ':'))
    print('mean edge correlation by turn:', v['navcam']['mean_edge_correlation_by_turn_deg'])


if __name__ == '__main__':
    main()
