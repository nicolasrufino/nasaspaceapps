"""Terrain views and crossings at walk scale, from the 1 m HiRISE terrain (USGS MSL Gale merged DEM 1 m).

    python3 data/pipeline/terrain_1m.py                       # adds the views to data/worlds/gale
    python3 data/pipeline/check_world.py data/worlds/gale

Why: an 8 m cell's slope averages away what stops a person on foot: boxwork ridges and hollows (~1-2 m),
fractures, ledges and short steep steps. NASA's JETT3 test had 1 m maps and still hit impassable drop-offs.
On our slice, 35% of the cells that look walkable at 8 m hide a stretch steeper than 25 deg at 2 m scale.

What it adds (all on the same 256 x 256 grid; row 0 north):
  Views (grid layers the app can show)
    terrain.u8      hillshade of the 1 m terrain, averaged to 8 m (context)
    fine_steep.u8   % of the cell steeper than max_slope_deg at 2 m scale (0-100)
    dropoff.f32     largest height change between neighbouring 1 m points in the cell, metres
    crevice.f32     deepest narrow trough or fracture in the cell (narrower than ~5 m), metres
    landform.u8     0 flat, 1 slope, 2 ridge, 3 hollow (height vs a 21 m neighbourhood, +-0.5 m)
    open_dirs.u8    how many of the 8 neighbours you can actually step to (0-8), from passable.u8
    reach.u8        1 if you can get there from base through passable crossings, else 0
    chokepoint.f32  how many reachable cells' shortest way from base passes here, log scale 0-1
                    (1 = all of them): the gaps the map funnels through
    unsure.f32      share of the cell's crossings that are marginal (close to a limit): where the 1 m map
                    can't settle it and the scout helicopter should look (0-1)
  Crossings (for route planning, not a view)
    passable.u8     bit k set = you can step from this cell to neighbour k, in the order
                    (-1,-1) (0,-1) (1,-1) (-1,0) (1,0) (-1,1) (0,1) (1,1)  [same as app/src/plan.js NB]

A crossing is checked along the 1 m profile between the two cell centres, in three parallel lanes
(centre and +-lane_offset_m, because a walker can sidestep a short obstacle inside the cell). A lane is
blocked by a ledge (height change over 1 m or 2 m > step_max_m + what the slope limit allows over that length) or by a steep run
(2 m-scale slope in any direction, so across-slope counts too, over max_slope_deg for at least steep_run_m). The crossing is passable if any lane is.

Knobs (world.json "knobs"; estimates unless a source is given):
  step_max_m 0.3     NASA ICES-2025-294: recommended maximum step height for a suited crew member (xEMU)
  steep_run_m 3.0    estimate: steeper-than-limit ground shorter than this is a scramble, not a wall
  lane_offset_m 2.0  estimate: how far a walker sidesteps inside a cell
"""
import itertools
import json
import math
import os

import numpy as np
import rasterio
from scipy import ndimage as ndi

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, '..', 'raw', 'gale')
WORLD = os.path.join(HERE, '..', 'worlds', 'gale')
NB = [(-1, -1), (0, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (0, 1), (1, 1)]  # bit order, = app/src/plan.js
KNOBS = {'step_max_m': 0.3, 'steep_run_m': 3.0, 'lane_offset_m': 2.0}


def blocks(a, n, k):
    return a[:n * k, :n * k].reshape(n, k, n, k)


def hillshade(h, az=315, alt=45):
    gy, gx = np.gradient(h, 1.0)
    slope = np.arctan(np.hypot(gx, gy))
    aspect = np.arctan2(-gx, gy)
    a, z = np.radians(az), np.radians(90 - alt)
    return np.clip(np.cos(z) * np.cos(slope) + np.sin(z) * np.sin(slope) * np.cos(a - aspect), 0, 1)


def crossings(h1, n, k, limit_deg, knobs):
    """passable[y, x] bitmask and marginal[y, x] count, checking each crossing along the 1 m profile."""
    tan_lim = math.tan(math.radians(limit_deg))
    ledge = knobs['step_max_m'] + tan_lim * 1.0  # more than the slope limit allows over 1 m, plus one step
    ledge2 = knobs['step_max_m'] + tan_lim * 2.0  # same over 2 m
    run = knobs['steep_run_m']
    # full slope at 2 m scale, any direction: the limit applies up, down and across (NASA xEVA: "up/down/across")
    g2y = (np.roll(h1, -1, 0) - np.roll(h1, 1, 0)) / 2
    g2x = (np.roll(h1, -1, 1) - np.roll(h1, 1, 1)) / 2
    steep_map = (np.hypot(g2x, g2y) > tan_lim).astype('f4')
    ys, xs = np.mgrid[0:n, 0:n]
    cy, cx = ys * k + (k - 1) / 2.0, xs * k + (k - 1) / 2.0
    ok = np.zeros((8, n, n), bool)
    marginal = np.zeros((8, n, n), bool)
    for d, (dx, dy) in enumerate(NB):
        if d > 3:  # symmetric: reuse the reverse direction already computed
            rd = NB.index((-dx, -dy))
            valid = (ys + dy >= 0) & (ys + dy < n) & (xs + dx >= 0) & (xs + dx < n)  # no wrap-around
            ok[d] = np.roll(np.roll(ok[rd], -dy, axis=0), -dx, axis=1) & valid
            marginal[d] = np.roll(np.roll(marginal[rd], -dy, axis=0), -dx, axis=1) & valid
            continue
        length = k * math.hypot(dx, dy)
        m = math.ceil(length)
        ux, uy = dx * k / m, dy * k / m  # 1 step along the profile, in 1 m pixels (~1 m)
        step_m = math.hypot(ux, uy)
        px, py = -dy / math.hypot(dx, dy), dx / math.hypot(dx, dy)  # perpendicular unit
        lane_ok = np.zeros((n, n), bool)
        lane_marg = np.ones((n, n), bool)
        for off in (0.0, -knobs['lane_offset_m'], knobs['lane_offset_m']):
            t = np.arange(m + 1)
            sx = cx[None] + off * px + t[:, None, None] * ux
            sy = cy[None] + off * py + t[:, None, None] * uy
            prof = ndi.map_coordinates(h1, [sy.ravel(), sx.ravel()], order=1, mode='nearest').reshape(m + 1, n, n)
            dh = np.abs(np.diff(prof, axis=0)) / step_m  # rise per metre
            steep2 = ndi.map_coordinates(steep_map, [sy.ravel(), sx.ravel()], order=0,
                                         mode='nearest').reshape(m + 1, n, n) > 0.5
            # longest run of steep 2 m segments, in metres
            longest = np.zeros((n, n))
            cur = np.zeros((n, n))
            for s in steep2:
                cur = np.where(s, cur + step_m, 0.0)
                longest = np.maximum(longest, cur)
            # a ledge shows up smeared over ~2 m in a 1 m terrain model: check 1 m and 2 m baselines
            dh2 = np.abs(prof[2:] - prof[:-2]) if m >= 2 else np.zeros((1, n, n))
            over = np.maximum(dh.max(axis=0) / ledge, dh2.max(axis=0) / ledge2)
            blocked = (over > 1) | (longest >= run)
            near = (over > 0.7) | (longest >= 0.5 * run)
            lane_ok |= ~blocked
            lane_marg &= blocked | near  # marginal unless some lane passes cleanly
        valid = (ys + dy >= 0) & (ys + dy < n) & (xs + dx >= 0) & (xs + dx < n)
        ok[d] = lane_ok & valid
        marginal[d] = lane_marg & lane_ok & valid
    passable = np.zeros((n, n), 'u1')
    for d in range(8):
        passable |= (ok[d].astype('u1') << d)
    return passable, ok, marginal


def reach_and_chokepoints(ok, base, cell, runs=6, seed=0):
    """Dijkstra on distance over passable crossings; subtree sizes of the shortest-path tree.
    A grid has many equally short paths, which draws straight rays; averaging a few runs with a 5% random
    cost jitter keeps only the real funnels."""
    rng = np.random.default_rng(seed)
    acc, reach = None, None
    for _ in range(runs):
        jitter = 1 + 0.05 * rng.random(ok.shape[1:])
        r, c = _tree(ok, base, cell, jitter)
        acc = c if acc is None else acc + c
        reach = r
    return reach, acc / runs


def _tree(ok, base, cell, jitter):
    import heapq
    n = ok.shape[1]
    dist = np.full((n, n), np.inf)
    parent = np.full((n, n), -1, int)
    bx, by = base
    dist[by, bx] = 0.0
    pq = [(0.0, by * n + bx)]
    while pq:
        dcur, i = heapq.heappop(pq)
        y, x = divmod(i, n)
        if dcur > dist[y, x]:
            continue
        for d, (dx, dy) in enumerate(NB):
            if not ok[d, y, x]:
                continue
            ny, nx = y + dy, x + dx
            nd = dcur + cell * math.hypot(dx, dy) * jitter[ny, nx]
            if nd < dist[ny, nx]:
                dist[ny, nx] = nd
                parent[ny, nx] = i
                heapq.heappush(pq, (nd, ny * n + nx))
    reach = np.isfinite(dist)
    order = np.argsort(dist, axis=None)[::-1]  # farthest first
    sub = np.zeros(n * n)
    sub[reach.ravel()] = 1.0
    par = parent.ravel()
    for i in order:
        if not reach.flat[i] or par[i] < 0:
            continue
        sub[par[i]] += sub[i]
    total = max(int(reach.sum()), 2)
    # log scale 0-1: 0 = only itself depends on it, 1 = every reachable cell's way from base passes here
    choke = (np.log10(np.maximum(sub, 1)) / math.log10(total)).reshape(n, n)
    choke[by, bx] = 0.0  # every path starts at base; not informative
    return reach, choke


def compute(h1, n, k, limit_deg, base, knobs=KNOBS):
    h1 = h1.astype('f8')
    cell = float(k)
    hs = blocks(hillshade(h1), n, k).mean(axis=(1, 3))
    g2y = np.abs(h1[2:, 1:-1] - h1[:-2, 1:-1]) / 2
    g2x = np.abs(h1[1:-1, 2:] - h1[1:-1, :-2]) / 2
    s2 = np.pad(np.degrees(np.arctan(np.hypot(g2x, g2y))), 1, mode='edge')
    fine = (blocks(s2, n, k) > limit_deg).mean(axis=(1, 3)) * 100
    step = np.maximum(np.pad(np.abs(np.diff(h1, axis=0)), ((0, 1), (0, 0))),
                      np.pad(np.abs(np.diff(h1, axis=1)), ((0, 0), (0, 1))))
    drop = blocks(step, n, k).max(axis=(1, 3))
    crev = blocks(ndi.grey_closing(h1, size=(5, 5)) - h1, n, k).max(axis=(1, 3))
    tpi = blocks(h1 - ndi.uniform_filter(h1, 21), n, k).mean(axis=(1, 3))
    s8 = blocks(s2, n, k).mean(axis=(1, 3))
    land = np.where(tpi > 0.5, 2, np.where(tpi < -0.5, 3, np.where(s8 > 5, 1, 0))).astype('u1')
    passable, ok, marginal = crossings(h1, n, k, limit_deg, knobs)
    open_dirs = ok.sum(axis=0).astype('u1')
    reach, choke = reach_and_chokepoints(ok, base, cell)
    unsure = (marginal.sum(axis=0) / np.maximum(ok.sum(axis=0), 1)).astype('f4')
    return {
        'terrain': (hs * 255).astype('u1'), 'fine_steep': np.round(fine).astype('u1'),
        'dropoff': drop.astype('f4'), 'crevice': crev.astype('f4'), 'landform': land,
        'open_dirs': open_dirs, 'reach': reach.astype('u1'), 'chokepoint': choke.astype('f4'),
        'unsure': unsure, 'passable': passable,
    }


VIEWS = ['terrain', 'fine_steep', 'dropoff', 'crevice', 'landform', 'open_dirs', 'reach', 'chokepoint', 'unsure']
SRC_DEM = 'HiRISE stereo (USGS MSL Gale merged DEM 1 m)'
SOURCES = {
    'terrain': 'Hillshade of the 1 m HiRISE terrain, averaged to 8 m',
    'fine_steep': '% of the cell steeper than the slope limit at 2 m scale (1 m HiRISE terrain)',
    'dropoff': 'Largest height change between neighbouring 1 m points, m (1 m HiRISE terrain)',
    'crevice': 'Deepest trough or fracture narrower than ~5 m, m (1 m HiRISE terrain)',
    'landform': '0 flat, 1 slope, 2 ridge, 3 hollow (height vs 21 m neighbourhood, 1 m HiRISE terrain)',
    'open_dirs': 'Neighbours you can step to (0-8), checked along the 1 m profile; step limit 0.3 m (NASA ICES-2025-294)',
    'reach': '1 = reachable from base through passable crossings',
    'chokepoint': "How many reachable cells' shortest way from base passes here, log scale 0-1 (1 = all)",
    'unsure': 'Share of crossings close to a limit: where the helicopter should look (0-1)',
    'passable': 'Bit k: can step to neighbour k (order as app/src/plan.js NB); see data/pipeline/terrain_1m.py',
}


def main():
    with open(os.path.join(WORLD, 'world.json')) as f:
        meta = json.load(f)
    n, cell = meta['width'], meta['cell_size_m']
    with rasterio.open(os.path.join(RAW, 'dem_1m.tif')) as d:
        h1 = d.read(1)
    k = round(cell)
    out = compute(h1, n, k, meta['knobs']['max_slope_deg'], meta['base_cell'])
    ext = {'u1': '.u8', 'f4': '.f32'}
    for name, arr in out.items():
        fname = name + ext[arr.dtype.str[1:]]
        arr.astype(arr.dtype.newbyteorder('<')).tofile(os.path.join(WORLD, fname))
        meta['files'][name] = fname
        meta['sources'][name] = SOURCES[name]
    for v in VIEWS:
        if v not in meta['layers']:
            meta['layers'].append(v)
    meta['knobs'].update(KNOBS)
    with open(os.path.join(WORLD, 'world.json'), 'w') as f:
        json.dump(meta, f, indent=2)

    walk8 = np.fromfile(os.path.join(WORLD, 'slope.f32'), '<f4').reshape(n, n) <= meta['knobs']['max_slope_deg']
    ok_any = out['open_dirs'] > 0
    print(f"crossings passable: {out['open_dirs'].sum() / (8 * n * n) * 100:.0f}% of all; cells with no way out: "
          f"{(~ok_any).mean() * 100:.0f}%; reachable from base: {out['reach'].mean() * 100:.0f}% "
          f"(8 m slope rule alone: {walk8.mean() * 100:.0f}% walkable)")
    print(f"landform: flat {np.mean(out['landform'] == 0) * 100:.0f}%, slope {np.mean(out['landform'] == 1) * 100:.0f}%, "
          f"ridge {np.mean(out['landform'] == 2) * 100:.0f}%, hollow {np.mean(out['landform'] == 3) * 100:.0f}%; "
          f"crevices > 1 m: {np.mean(out['crevice'] > 1) * 100:.0f}% of cells; "
          f"cells that funnel over 10% of the map: {int((out['chokepoint'] > 1 + math.log10(0.1) / math.log10(max(int(out['reach'].sum()), 2))).sum())}")
    with open(os.path.join(WORLD, 'route.json')) as f:
        route = json.load(f)['cells']
    bad = sum(1 for a, b in itertools.pairwise(route)
              if not (out['passable'][a[1], a[0]] >> NB.index((b[0] - a[0], b[1] - a[1]))) & 1)
    print(f'current pipeline route: {bad} of {len(route) - 1} steps cross a blocked crossing')


if __name__ == '__main__':
    main()
