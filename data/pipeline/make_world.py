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
# Pandolf (1977) terrain factor eta, mapped to AI4Mars classes (soil, bedrock, sand, big rock).
CLASSES = {0: ('unknown', 1.2), 1: ('soil', 1.1), 2: ('bedrock', 1.0), 3: ('sand', 2.1), 4: ('big_rock', 1.5)}
KNOBS = dict(body_kg=75.0, load_kg=60.0, speed_mps=1.0, max_slope_deg=25.0)


def pandolf_watts(grade_pct, eta, k=KNOBS):
    """Metabolic rate (W) walking at speed V on grade G with load L (Pandolf et al. 1977)."""
    W, L, V = k['body_kg'], k['load_kg'], k['speed_mps']
    m = 1.5 * W + 2.0 * (W + L) * (L / W) ** 2 + eta * (W + L) * (1.5 * V * V + 0.35 * V * max(grade_pct, 0.0))
    # ponytail: linear gravity scaling and no downhill (Santee) term. Upgrade path: NASA JSC's
    # field-modified model (Kim et al. 2024) and Carr & McGee 2009 for loping below 0.5 g.
    return m * (G_MARS / G_EARTH)


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


def build(n, cell, base, energy_budget_j):
    h = synthetic_height(n, cell)
    cls = synthetic_classes(n, h)
    slope = array.array('f', [0.0]) * (n * n)
    for y in range(n):
        for x in range(n):
            gx = (h[y * n + min(x + 1, n - 1)] - h[y * n + max(x - 1, 0)]) / (2 * cell)
            gy = (h[min(y + 1, n - 1) * n + x] - h[max(y - 1, 0) * n + x]) / (2 * cell)
            slope[y * n + x] = math.degrees(math.atan(math.hypot(gx, gy)))

    def step_cost(i, j, dist):
        """Joules to walk from cell i to neighbour j (distance dist m). inf if too steep."""
        if slope[j] > KNOBS['max_slope_deg']:
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


def write(out, n, cell, base, budget, h, slope, cls, cost_per_m, ctg):
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
        'classes': {str(k): v[0] for k, v in CLASSES.items()}, 'knobs': KNOBS,
        'files': {'height': 'height.f32', 'slope': 'slope.f32', 'terrain_class': 'terrain_class.u8',
                  'cost_per_m': 'cost_per_m.f32', 'cost_to_go': 'cost_to_go.f32'},
    }
    with open(os.path.join(out, 'world.json'), 'w') as f:
        json.dump(meta, f, indent=2)


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--size', type=int, default=128)
    p.add_argument('--cell', type=float, default=5.0, help='metres per cell')
    p.add_argument('--budget', type=float, default=2.5e5, help='EVA energy budget in joules (knob; sized so the walk-back ring sits inside a 640 m map)')
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
