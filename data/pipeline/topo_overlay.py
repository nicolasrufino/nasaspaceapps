"""3D overlay data for the 1 m terrain (step 4 of the topography plan): the route as a line on the ground and
every blocked crossing with its reason, so the 3D view can show why the route goes the way it does.

    python3 data/pipeline/topo_overlay.py      # needs data/raw/gale/dem_1m.tif (cut_slice.py) and the Gale world
    -> data/worlds/gale/route_3d.json, data/worlds/gale/crossings_blocked.json

Source: USGS MSL Gale merged DEM 1 m v3 (HiRISE stereo). Positions use the detail tiles' frame
(make_tiles.py / CONTRACTS.md): app x, y = box metres + app_offset_m (-cell_size_m/2), y to the south;
z = height in the height.f32 datum (absolute - world.json height_offset_m).

crossings_blocked.json lists the crossings that the 8 m map would allow (both cells under max_slope_deg) but the
1 m check in terrain_1m.py blocks, with at least one end reachable from base: the hazards orbit-scale slope hides.
Reason from the easiest of the three lanes (terrain_1m.crossings): 'ledge' (a step over step_max_m plus what the
slope limit allows), 'steep' (a run steeper than max_slope_deg for steep_run_m or more), or 'both'.
"""
import itertools
import json
import math
import os

import numpy as np
import terrain_1m
from scipy import ndimage as ndi

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, '..', 'raw', 'gale')
WORLD = os.path.join(HERE, '..', 'worlds', 'gale')
NB = terrain_1m.NB


def load_json(path):
    with open(path) as fh:
        return json.load(fh)


def lane_reason(h1, steep_map, k, x, y, dx, dy, limit_deg, knobs):
    """Worst-lane diagnosis of one crossing: (ledge_ratio, steep_run_m, max_step_m) for the easiest lane."""
    tan_lim = math.tan(math.radians(limit_deg))
    ledge, ledge2 = knobs['step_max_m'] + tan_lim, knobs['step_max_m'] + 2 * tan_lim
    length = k * math.hypot(dx, dy)
    m = math.ceil(length)
    ux, uy = dx * k / m, dy * k / m
    step_m = math.hypot(ux, uy)
    px, py = -dy / math.hypot(dx, dy), dx / math.hypot(dx, dy)
    cx, cy = x * k + (k - 1) / 2.0, y * k + (k - 1) / 2.0
    best = None
    for off in (0.0, -knobs['lane_offset_m'], knobs['lane_offset_m']):
        t = np.arange(m + 1)
        sx, sy = cx + off * px + t * ux, cy + off * py + t * uy
        prof = ndi.map_coordinates(h1, [sy, sx], order=1, mode='nearest')
        steep = ndi.map_coordinates(steep_map, [sy, sx], order=0, mode='nearest') > 0.5
        run = cur = 0.0
        for s in steep:
            cur = cur + step_m if s else 0.0
            run = max(run, cur)
        dh = np.abs(np.diff(prof)) / step_m
        dh2 = np.abs(prof[2:] - prof[:-2])
        over = max(dh.max() / ledge, dh2.max() / ledge2)
        lane = (max(over, run / knobs['steep_run_m']), over, run, float(np.abs(np.diff(prof)).max()))
        best = lane if best is None or lane[0] < best[0] else best
    return best[1], best[2], best[3]


def main():
    import rasterio
    meta = load_json(os.path.join(WORLD, 'world.json'))
    n, cell, off = meta['width'], meta['cell_size_m'], meta['height_offset_m']
    knobs, limit = meta['knobs'], meta['knobs']['max_slope_deg']
    app = -cell / 2
    h1 = rasterio.open(os.path.join(RAW, 'dem_1m.tif')).read(1).astype('f8') - off  # height.f32 datum
    k = round(cell)
    slope = np.fromfile(os.path.join(WORLD, 'slope.f32'), '<f4').reshape(n, n)
    passable = np.fromfile(os.path.join(WORLD, 'passable.u8'), 'u1').reshape(n, n)
    reach = np.fromfile(os.path.join(WORLD, 'reach.u8'), 'u1').reshape(n, n)
    route = load_json(os.path.join(WORLD, 'route.json'))

    def z_at(bx, by):  # box metres -> height; 1 m pixel centres at +0.5
        return float(ndi.map_coordinates(h1, [[by - 0.5], [bx - 0.5]], order=1, mode='nearest')[0])

    # route on the ground, one point per metre
    pts, dist = [], 0.0
    cells = route['cells']
    for (xa, ya), (xb, yb) in itertools.pairwise(cells):
        ax, ay, bx, by = (xa + .5) * cell, (ya + .5) * cell, (xb + .5) * cell, (yb + .5) * cell
        m = max(1, math.ceil(math.hypot(bx - ax, by - ay)))
        for t in range(m):
            x, y = ax + (bx - ax) * t / m, ay + (by - ay) * t / m
            if pts:
                dist += math.hypot(x - pts[-1][0] + app, y - pts[-1][1] + app)
            pts.append([round(x + app, 2), round(y + app, 2), round(z_at(x, y), 2)])
    x, y = (cells[-1][0] + .5) * cell, (cells[-1][1] + .5) * cell
    dist += math.hypot(x - pts[-1][0] + app, y - pts[-1][1] + app)
    pts.append([round(x + app, 2), round(y + app, 2), round(z_at(x, y), 2)])
    zs = np.array([p[2] for p in pts])
    xy = np.array([p[:2] for p in pts])
    run_m = np.maximum(np.hypot(*np.diff(xy, axis=0).T), 1e-6)
    grade = np.degrees(np.arctan(np.abs(np.diff(zs)) / run_m))
    route3d = {'what': 'Route on the 1 m terrain, one point per metre, [x, y, z] in the detail-tile frame',
               'made_by': 'data/pipeline/topo_overlay.py', 'source': 'USGS MSL Gale merged DEM 1 m v3',
               'frame': {'app_offset_m': app, 'z': 'height.f32 datum'},
               'length_m': round(dist, 1), 'climb_m': round(float(np.clip(np.diff(zs), 0, None).sum()), 1),
               'descent_m': round(float(np.clip(-np.diff(zs), 0, None).sum()), 1),
               'steepest_deg_per_m': round(float(grade.max()), 1), 'points': pts}

    # blocked crossings the 8 m map would allow
    tan_lim = math.tan(math.radians(limit))
    g2y = (np.roll(h1, -1, 0) - np.roll(h1, 1, 0)) / 2
    g2x = (np.roll(h1, -1, 1) - np.roll(h1, 1, 1)) / 2
    steep_map = (np.hypot(g2x, g2y) > tan_lim).astype('f4')
    on_route = {(a[0], a[1], b[0], b[1]) for a, b in itertools.pairwise(cells)}
    on_route |= {(c, d_, a, b) for a, b, c, d_ in on_route}
    near_route = np.zeros((n, n), bool)
    for cx_, cy_ in cells:
        near_route[max(0, cy_ - 3):cy_ + 4, max(0, cx_ - 3):cx_ + 4] = True
    out, counts = [], {'ledge': 0, 'steep': 0, 'both': 0}
    for d in range(4):  # each undirected crossing once
        dx, dy = NB[d]
        for y in range(n):
            for x in range(n):
                x2, y2 = x + dx, y + dy
                if not (0 <= x2 < n and 0 <= y2 < n) or (passable[y, x] >> d) & 1:
                    continue
                if slope[y, x] > limit or slope[y2, x2] > limit or not (reach[y, x] or reach[y2, x2]):
                    continue
                over, run, step = lane_reason(h1, steep_map, k, x, y, dx, dy, limit, knobs)
                reason = 'both' if over > 1 and run >= knobs['steep_run_m'] else 'ledge' if over > 1 else 'steep'
                counts[reason] += 1
                mx, my = (x + dx / 2 + .5) * cell, (y + dy / 2 + .5) * cell
                out.append([x, y, d, reason, round(step, 2), round(run, 1),
                            round(mx + app, 1), round(my + app, 1), round(z_at(mx, my), 2),
                            int(near_route[y, x] or near_route[y2, x2])])
    assert not any((c[0], c[1], c[0] + NB[c[2]][0], c[1] + NB[c[2]][1]) in on_route for c in out), 'route crosses a block'
    blocked = {'what': 'Crossings walkable on the 8 m map but blocked at walk scale (1 m), with a reachable end',
               'made_by': 'data/pipeline/topo_overlay.py', 'source': 'USGS MSL Gale merged DEM 1 m v3',
               'limits': {'max_slope_deg': limit, 'step_max_m': knobs['step_max_m'],
                          'steep_run_m': knobs['steep_run_m']},
               'columns': ['x', 'y', 'dir (NB index, to x+dx, y+dy)', 'reason', 'max_1m_step_m', 'steep_run_m',
                           'mid_x', 'mid_y', 'mid_z', 'within_24m_of_route'],
               'counts': counts, 'within_24m_of_route': sum(c[-1] for c in out), 'crossings': out}
    for name, obj in (('route_3d.json', route3d), ('crossings_blocked.json', blocked)):
        with open(os.path.join(WORLD, name), 'w') as fh:
            json.dump(obj, fh, separators=(',', ':'))
    print(f"route: {len(pts)} points, {route3d['length_m']} m, climb {route3d['climb_m']} m, "
          f"descent {route3d['descent_m']} m, steepest {route3d['steepest_deg_per_m']} deg over ~1 m")
    print(f"blocked crossings hidden at 8 m: {len(out)} {counts}; {blocked['within_24m_of_route']} near the route")


if __name__ == '__main__':
    main()
