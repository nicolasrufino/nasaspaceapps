"""Accuracy check: our terrain vs Curiosity's own elevations along its traverse (step 7a of the topography plan).

    python3 data/pipeline/check_accuracy.py          # needs data/raw/gale (cut_slice.py) and the Gale world
    -> data/worlds/gale/validation.json

Sources: Curiosity drive waypoints with elevation (NASA/JPL MSL MMGIS traverse, msl_waypoints.json, elev_geoid)
vs the USGS MSL Gale merged DEM 1 m (our 1 m terrain) and the 8 m world grid built from it (height.f32).

Both are compared after removing their mean difference (bias): the rover's elevations and the DEM use slightly
different vertical references, so only the shape of the terrain is tested, which is what slope and crossings use.
Also reported: Curiosity's drive steps measured on our crossings (passable.u8). A rover is not a person, so this is
a sanity check (where the rover drove, we should mostly not call the ground a wall), not a validation of the limits.
"""
import itertools
import json
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, '..', 'raw', 'gale')
WORLD = os.path.join(HERE, '..', 'worlds', 'gale')
NB = [(-1, -1), (0, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (0, 1), (1, 1)]


def load_json(path):
    with open(path) as fh:
        return json.load(fh)


def stats(err):
    """Bias, spread after removing the bias, worst point after removing the bias."""
    e = np.asarray(err, float)
    r = e - e.mean()
    return {'bias_m': round(float(e.mean()), 3), 'rmse_after_bias_m': round(float(np.sqrt((r ** 2).mean())), 3),
            'max_abs_after_bias_m': round(float(np.abs(r).max()), 3),
            'p95_abs_after_bias_m': round(float(np.percentile(np.abs(r), 95)), 3)}


def sample(grid, r, c):
    """Bilinear height at fractional pixel (row, col), pixel centres at integers."""
    from scipy import ndimage as ndi
    return ndi.map_coordinates(grid, [np.atleast_1d(r), np.atleast_1d(c)], order=1, mode='nearest')


def rover_steps(cells, passable, n):
    """For consecutive rover cells that are 8-neighbours: how many crossings are open vs blocked in passable.u8."""
    open_, blocked, where = 0, 0, []
    for (x0, y0), (x1, y1) in itertools.pairwise(cells):
        d = (x1 - x0, y1 - y0)
        if d not in NB:
            continue
        if (passable[y0 * n + x0] >> NB.index(d)) & 1:
            open_ += 1
        else:
            blocked += 1
            where.append([x0, y0, x1, y1])
    return open_, blocked, where


def cells_along(points, cell):
    """World cells visited by a polyline in box metres, sampled every metre, consecutive duplicates removed."""
    out = []
    for (xa, ya), (xb, yb) in itertools.pairwise(points):
        m = max(1, int(np.ceil(np.hypot(xb - xa, yb - ya))))
        for t in np.linspace(0, 1, m + 1):
            c = [int((xa + t * (xb - xa)) // cell), int((ya + t * (yb - ya)) // cell)]
            if not out or out[-1] != c:
                out.append(c)
    return out


def main():
    import rasterio
    from rasterio.crs import CRS
    from rasterio.warp import transform

    mars = CRS.from_proj4('+proj=longlat +a=3396190 +b=3396190 +no_defs')
    meta = load_json(os.path.join(WORLD, 'world.json'))
    n, cell, off = meta['width'], meta['cell_size_m'], meta['height_offset_m']
    h8 = np.fromfile(os.path.join(WORLD, 'height.f32'), '<f4').reshape(n, n).astype('f8') + off
    passable = np.fromfile(os.path.join(WORLD, 'passable.u8'), 'u1')
    dem = rasterio.open(os.path.join(RAW, 'dem_1m.tif'))
    h1 = dem.read(1).astype('f8')
    k = round(cell / abs(dem.transform.a))

    rows = []
    for f in load_json(os.path.join(RAW, 'msl_waypoints.json'))['features']:
        p = f['properties']
        lon, lat = f['geometry']['coordinates'][:2]
        x, y = transform(mars, dem.crs, [lon], [lat])
        c, r = ~dem.transform * (x[0], y[0])  # fractional pixel, edges at integers
        if not (0 <= c < h1.shape[1] - 1 and 0 <= r < h1.shape[0] - 1) or p.get('elev_geoid') is None:
            continue
        z1 = float(sample(h1, r - 0.5, c - 0.5)[0])
        z8 = float(sample(h8, (r - k / 2) / k, (c - k / 2) / k)[0])
        rows.append({'sol': p['sol'], 'box_m': [round(c, 1), round(r, 1)], 'rover_m': round(float(p['elev_geoid']), 2),
                     'dem_1m': round(z1, 2), 'grid_8m': round(z8, 2)})
    if len(rows) < 10:
        sys.exit('fewer than 10 Curiosity waypoints inside the box')
    rows.sort(key=lambda r: r['sol'])
    rover = np.array([r['rover_m'] for r in rows])
    s1, s8 = stats([r['dem_1m'] for r in rows] - rover), stats([r['grid_8m'] for r in rows] - rover)
    path = cells_along([r['box_m'] for r in rows], cell)
    o, b, where = rover_steps(path, passable, n)

    out = {'what': 'Our terrain vs Curiosity elevations at its drive waypoints inside the box',
           'sources': ['NASA/JPL MSL MMGIS traverse waypoints (elev_geoid)', 'USGS MSL Gale merged DEM 1 m v3'],
           'made_by': 'data/pipeline/check_accuracy.py',
           'waypoints': len(rows), 'sols': [rows[0]['sol'], rows[-1]['sol']],
           'relief_along_traverse_m': round(float(rover.max() - rover.min()), 1),
           'terrain_1m': s1, 'grid_8m': s8,
           'rover_steps_on_crossings': {'open': o, 'blocked': b, 'blocked_at': where,
               'note': 'Curiosity drive between waypoints (straight lines) on our walk-scale crossings. '
                       'A rover is not a person: a sanity check, not a validation of the 20 deg / 0.3 m limits.'},
           'profile': rows}
    with open(os.path.join(WORLD, 'validation.json'), 'w') as fh:
        json.dump(out, fh, separators=(',', ':'))
    print(f"{len(rows)} waypoints, sols {rows[0]['sol']}-{rows[-1]['sol']}, relief {out['relief_along_traverse_m']} m")
    print(f"1 m terrain: rmse {s1['rmse_after_bias_m']} m (bias {s1['bias_m']}, worst {s1['max_abs_after_bias_m']})")
    print(f"8 m grid:    rmse {s8['rmse_after_bias_m']} m (bias {s8['bias_m']}, worst {s8['max_abs_after_bias_m']})")
    print(f"rover steps on our crossings: {o} open, {b} blocked")


if __name__ == '__main__':
    main()
