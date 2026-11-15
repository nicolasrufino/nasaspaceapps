"""Build a world: the files every part of Martian Map reads (see docs/CONTRACTS.md).

    python3 data/pipeline/make_world.py                 # synthetic 128x128 world -> data/worlds/synthetic
    python3 data/pipeline/make_world.py --size 256 --out data/worlds/synthetic256

Real Mars terrain: replace synthetic_height() / synthetic_classes() with a loader for a
HiRISE DTM tile and a terrain-class raster; everything after that stays the same.
Standard library only, so it runs anywhere.
"""
import argparse
import array
import heapq
import json
import math
import os
import random

G_EARTH, G_MARS = 9.81, 3.71
# max_slope_deg 20: NASA xEVA walking limit, slopes up to 20 deg (NTRS 20210000827; team decision 2026-11-15, was 25).
KNOBS = {'body_kg': 75.0, 'load_kg': 60.0, 'speed_mps': 1.0, 'max_slope_deg': 20.0,
         # Energy model fixes (docs/SCOUTING.md section 2, #83). Estimates until the hypogravity model is adopted:
         # walking at 0.38 g measured ~68% of Earth's oxygen use (2018 LBPP study; to verify), not 38%;
         # sand costs 2.1-2.7x hard ground (Lejeune et al. 1998); 2.4 = middle of that range.
         'gravity_energy_factor': 0.68, 'sand_cost_ratio': 2.4}


def _sand_eta(k):
    """Terrain factor that makes flat sand cost sand_cost_ratio x flat bedrock in the Pandolf equation."""
    W, L, V = k['body_kg'], k['load_kg'], k['speed_mps']
    fixed = 1.5 * W + 2.0 * (W + L) * (L / W) ** 2
    per_eta = (W + L) * 1.5 * V * V
    return (k['sand_cost_ratio'] * (fixed + per_eta) - fixed) / per_eta


# Pandolf (1977) terrain factor eta, mapped to AI4Mars classes. Soil, bedrock, big rock: measured Earth terrains
# (dirt road 1.1, blacktop 1.0, heavy brush 1.5; Soule & Goldman 1972) mapped to Mars ground types: our assumption.
CLASSES = {0: ('unknown', 1.2), 1: ('soil', 1.1), 2: ('bedrock', 1.0), 3: ('sand', round(_sand_eta(KNOBS), 3)),
           4: ('big_rock', 1.5)}


def pandolf_watts(grade_pct, eta, k=KNOBS):
    """Metabolic rate (W) walking at speed V on grade G with load L (Pandolf et al. 1977)."""
    W, L, V = k['body_kg'], k['load_kg'], k['speed_mps']
    m = 1.5 * W + 2.0 * (W + L) * (L / W) ** 2 + eta * (W + L) * (1.5 * V * V + 0.35 * V * max(grade_pct, 0.0))
    # ponytail: one measured gravity factor and no downhill (Santee) term. Upgrade path: the hypogravity
    # model (Pandolf + Santee, 2025) or NASA JSC's field-modified model (Kim et al. 2024).
    return m * k['gravity_energy_factor']


def synthetic_height(n, cell, seed=7):
    rnd = random.Random(seed)
    hills = [(rnd.uniform(0, n), rnd.uniform(0, n), rnd.uniform(-30, 60), rnd.uniform(8, 30)) for _ in range(12)]
    cx, cy, r = n * 0.7, n * 0.35, n * 0.12  # one crater: rim up, floor down
    h = []
    for y in range(n):
        for x in range(n):
            z = sum(a * math.exp(-((x - hx) ** 2 + (y - hy) ** 2) / (2 * s * s)) for hx, hy, a, s in hills)
            d = math.hypot(x - cx, y - cy) / r
            z += 25 * math.exp(-((d - 1) ** 2) / 0.02) - 40 * math.exp(-(d ** 2) / 0.4)
            h.append(z)
    return h


def synthetic_classes(n, height, seed=7):
    rnd = random.Random(seed + 1)
    blobs = [(rnd.uniform(0, n), rnd.uniform(0, n), rnd.uniform(5, 18), rnd.choice([1, 2, 3, 4])) for _ in range(40)]
    out = array.array('B', [1]) * (n * n)  # default soil
    for y in range(n):
        for x in range(n):
            for bx, by, br, c in blobs:
                if (x - bx) ** 2 + (y - by) ** 2 < br * br:
                    out[y * n + x] = c
    return out


NB = [(-1, -1), (0, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (0, 1), (1, 1)]  # passable.u8 bit order


def can_step(passable, n, i, j):
    """True if the crossing from cell i to neighbour j is open (passable.u8, contract section 1)."""
    d = NB.index((j % n - i % n, j // n - i // n))
    return (passable[i] >> d) & 1 == 1


def build(n, cell, base, energy_budget_j, blocked=None, h=None, cls=None, passable=None):
    """Slope, walking cost and cost home. h / cls: real height and classes (row-major, n*n); default synthetic.
    passable: walk-scale crossings (passable.u8 from terrain_1m.py). With it, a step is allowed only across an
    open crossing and the 8 m slope rule is not used (the crossings already apply the slope limit at 1 m)."""
    h = synthetic_height(n, cell) if h is None else h
    cls = synthetic_classes(n, h) if cls is None else cls
    slope = array.array('f', [0.0]) * (n * n)
    for y in range(n):
        for x in range(n):
            gx = (h[y * n + min(x + 1, n - 1)] - h[y * n + max(x - 1, 0)]) / (2 * cell)
            gy = (h[min(y + 1, n - 1) * n + x] - h[max(y - 1, 0) * n + x]) / (2 * cell)
            slope[y * n + x] = math.degrees(math.atan(math.hypot(gx, gy)))

    def step_cost(i, j, dist):
        """Joules to walk from cell i to neighbour j (distance dist m). inf if too steep."""
        if blocked is not None and blocked[j]:
            return math.inf
        if passable is not None:
            if not can_step(passable, n, i, j):
                return math.inf
        elif slope[j] > KNOBS['max_slope_deg']:
            return math.inf
        grade = 100.0 * (h[j] - h[i]) / dist
        return pandolf_watts(grade, CLASSES[cls[j]][1]) * dist / KNOBS['speed_mps']

    # cost per metre on flat-ish ground, for display
    cost_per_m = array.array('f', [pandolf_watts(0, CLASSES[c][1]) / KNOBS['speed_mps'] for c in cls])

    # cost_to_go: energy to walk from each cell back to base (Dijkstra on the reversed edges).
    nbrs = [(dx, dy, cell * math.hypot(dx, dy)) for dx in (-1, 0, 1) for dy in (-1, 0, 1) if dx or dy]
    ctg = [math.inf] * (n * n)
    b = base[1] * n + base[0]
    ctg[b] = 0.0
    pq = [(0.0, b)]
    while pq:
        d, j = heapq.heappop(pq)
        if d > ctg[j]:
            continue
        jx, jy = j % n, j // n
        for dx, dy, dist in nbrs:
            ix, iy = jx + dx, jy + dy
            if 0 <= ix < n and 0 <= iy < n:
                i = iy * n + ix
                nd = d + step_cost(i, j, dist)  # walking i -> j, towards base
                if nd < ctg[i]:
                    ctg[i] = nd
                    heapq.heappush(pq, (nd, i))
    return h, slope, cls, cost_per_m, ctg


def synthetic_rocks(n, base, seed=7):
    """Fine-scale rock fields orbit misses and a scout helicopter would reveal (1 = rock field)."""
    rnd = random.Random(seed + 2)
    rocks = array.array('B', [0]) * (n * n)
    for _ in range(14):
        cx, cy, r = rnd.uniform(0, n), rnd.uniform(0, n), rnd.uniform(2, 5)
        for y in range(max(0, int(cy - r)), min(n, int(cy + r) + 1)):
            for x in range(max(0, int(cx - r)), min(n, int(cx + r) + 1)):
                if (x - cx) ** 2 + (y - cy) ** 2 <= r * r and abs(x - base[0]) + abs(y - base[1]) > 4:
                    rocks[y * n + x] = 1
    return rocks


def path_home(ctg, n, start, passable=None):
    """Cells from start to base, always stepping to the cheapest neighbour (the way home on the phone).
    With passable.u8, only neighbours across an open crossing count."""
    path, cur = [start], start
    while ctg[cur[1] * n + cur[0]] > 0:
        x, y = cur
        nxt = min(((x + dx, y + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1)
                   if (dx or dy) and 0 <= x + dx < n and 0 <= y + dy < n
                   and (passable is None or can_step(passable, n, y * n + x, (y + dy) * n + x + dx))),
                  key=lambda c: ctg[c[1] * n + c[0]])
        if ctg[nxt[1] * n + nxt[0]] >= ctg[cur[1] * n + cur[0]]:
            break  # unreachable from here
        path.append(list(nxt))
        cur = nxt
    return path


def synthetic_targets(n, ctg, base):
    """Three reachable demo targets at different distances, plus an out-and-back route through them."""
    reach = sorted((v, i) for i, v in enumerate(ctg) if v < math.inf)
    picks = [reach[int(len(reach) * f)][1] for f in (0.35, 0.6, 0.85)]
    targets = [{'id': f'T{k + 1}', 'name': f'Target {k + 1} (synthetic)', 'cell': [i % n, i // n],
                'goal': 'demo', 'why': 'Synthetic placeholder until the real site exists', 'sources': []}
               for k, i in enumerate(picks)]
    cells = []
    for tg in targets:  # ponytail: out-and-back per target; the real pipeline plans stop-to-stop
        home = path_home(ctg, n, tg['cell'])
        cells += home[::-1][1:] if cells else home[::-1]
        cells += home[1:]
    energy = sum(2 * ctg[tg['cell'][1] * n + tg['cell'][0]] for tg in targets)
    route = {'cells': cells, 'stops': [tg['id'] for tg in targets], 'energy_j': round(energy),
             'minutes': None, 'dose_ugy': None, 'note': 'synthetic out-and-back route'}
    return targets, route


def write(out, n, cell, base, budget, h, slope, cls, cost_per_m, ctg, site=None):
    """Write a world. site (real sites): dict with meta, targets, stops, route, rocks, extra_files."""
    os.makedirs(out, exist_ok=True)
    big = 3.0e38  # unreachable cells: float32-safe "infinity"
    layers = [('height.f32', h, 'f'), ('slope.f32', slope, 'f'), ('terrain_class.u8', cls, 'B'),
              ('cost_per_m.f32', cost_per_m, 'f'), ('cost_to_go.f32', [min(v, big) for v in ctg], 'f')]
    for name, data, code in layers:
        with open(os.path.join(out, name), 'wb') as f:
            array.array(code, data).tofile(f)  # little-endian on every machine we use
    meta = {
        'contract_version': 1, 'name': os.path.basename(out.rstrip('/')), 'source': 'synthetic',
        'width': n, 'height': n, 'cell_size_m': cell, 'row_order': 'north_to_south',
        'base_cell': base, 'gravity_mps2': G_MARS, 'energy_budget_j': budget, 'reserve_fraction': 0.2,
        'kj_per_l_o2': 20.1,
        'classes': {str(k): v[0] for k, v in CLASSES.items()},
        'knobs': {**KNOBS, 'eta': [CLASSES[c][1] for c in range(5)]},
        'layers': ['height', 'slope', 'terrain_class', 'cost_to_go'],
        'sources': {'all': 'synthetic terrain for development; real sites list NASA mission, instrument and date per layer'},
        'files': {'height': 'height.f32', 'slope': 'slope.f32', 'terrain_class': 'terrain_class.u8',
                  'cost_per_m': 'cost_per_m.f32', 'cost_to_go': 'cost_to_go.f32'},
    }
    if site:
        meta.update(site['meta'])
        targets, route, rocks, stops = site['targets'], site['route'], site['rocks'], site['stops']
    else:
        targets, route = synthetic_targets(n, ctg, base)
        rocks, stops = synthetic_rocks(n, base), []  # what the scout helicopter reveals: hidden rock fields
    # the way home once the helicopter has revealed the rocks
    ctg_scouted = build(n, cell, base, budget, blocked=rocks, h=h, cls=cls, passable=(site or {}).get('passable'))[-1]
    with open(os.path.join(out, 'rocks_fine.u8'), 'wb') as f:
        rocks.tofile(f)
    with open(os.path.join(out, 'cost_to_go_scouted.f32'), 'wb') as f:
        # rock cells are impassable, including as a start cell (CONTRACTS.md; same rule as ml/rock_review/r3_hazards.py)
        array.array('f', [big if rocks[i] else min(v, big) for i, v in enumerate(ctg_scouted)]).tofile(f)
    meta['files'].update({'rocks_fine': 'rocks_fine.u8', 'cost_to_go_scouted': 'cost_to_go_scouted.f32'})
    meta['layers'] += ['rocks_fine']
    for name, data, code in (site or {}).get('extra_files', []):  # optional layers (THEMIS, science, ...)
        with open(os.path.join(out, name), 'wb') as f:
            array.array(code, data).tofile(f)
    for name, obj in [('targets.json', targets), ('stops.json', stops), ('route.json', route)]:
        with open(os.path.join(out, name), 'w') as f:
            json.dump(obj, f, indent=1)
    with open(os.path.join(out, 'world.json'), 'w') as f:
        json.dump(meta, f, indent=2)


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--size', type=int, default=128)
    p.add_argument('--cell', type=float, default=5.0, help='metres per cell')
    p.add_argument('--budget', type=float, default=4.5e5, help='EVA energy budget in joules (knob; sized so the walk-back ring sits inside a 640 m map; 2.5e5 before the #83 energy fix)')
    p.add_argument('--out', default=os.path.join(os.path.dirname(__file__), '..', 'worlds', 'synthetic'))
    a = p.parse_args()
    base = [a.size // 4, a.size // 2]
    layers = build(a.size, a.cell, base, a.budget)
    write(a.out, a.size, a.cell, base, a.budget, *layers)
    ctg = layers[-1]
    # self-check: base costs 0, cost grows away from base, some cells reachable
    assert ctg[base[1] * a.size + base[0]] == 0.0
    reach = sum(1 for v in ctg if v < math.inf)
    assert reach > a.size * a.size // 2, 'most of the map should be reachable'
    print(f"wrote {a.out}: {a.size}x{a.size}, {reach} reachable cells, "
          f"max return cost {max(v for v in ctg if v < math.inf) / 1000:.0f} kJ")
