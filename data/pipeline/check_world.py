"""Check a world folder against docs/CONTRACTS.md section 1. Every other lane reads these files.

    python3 data/pipeline/check_world.py data/worlds/gale     # run before committing a world
    python3 data/pipeline/check_world.py                      # every folder in data/worlds/

Standard library only. Reads binary layers into arrays and checks sizes and value ranges;
prints only problems and counts, never the data.
"""
import array
import json
import math
import os
import sys

WORLDS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'worlds')
# Size guard: the orbit view is ~2 km at 8 m (~256 x 256). Raise these in a PR if the site needs it.
MAX_SIDE = 320
MAX_WORLD_BYTES = 5 * 1024 * 1024

REQUIRED_KEYS = ['contract_version', 'width', 'height', 'cell_size_m', 'row_order', 'base_cell', 'gravity_mps2',
                 'energy_budget_j', 'reserve_fraction', 'kj_per_l_o2', 'classes', 'knobs', 'layers', 'sources']
REQUIRED_FILES = ['height.f32', 'slope.f32', 'terrain_class.u8', 'cost_per_m.f32', 'cost_to_go.f32']
UNREACHABLE = 3.0e38  # contract sentinel for "cannot get back"
BYTES = {'.f32': 4, '.u8': 1}


def read_layer(path):
    a = array.array('f' if path.endswith('.f32') else 'B')
    with open(path, 'rb') as f:
        a.frombytes(f.read())
    if a.typecode == 'f' and sys.byteorder == 'big':
        a.byteswap()  # files are little-endian
    return a


def _bad(a, ok):
    """Count of values failing ok(v), plus the first bad index."""
    bad = [i for i, v in enumerate(a) if not ok(v)]
    return len(bad), (bad[0] if bad else None)


def _check_cost_to_go(name, ctg, w, h, base, out):
    n_bad, first = _bad(ctg, lambda v: not math.isnan(v) and 0.0 <= v <= UNREACHABLE * 1.0001)
    if n_bad:
        out.append(f'{name}: {n_bad} values NaN, negative or above the 3e38 sentinel (first at index {first})')
        return
    b = base[1] * w + base[0]
    if ctg[b] != 0.0:
        out.append(f'{name}: base cell {base} costs {ctg[b]}, must be 0')
    reach = sum(1 for v in ctg if v < 1e38)
    if reach < max(9, w * h // 100):
        out.append(f'{name}: only {reach} of {w * h} cells can get home')
    # The way home: from every reachable cell, some neighbour is strictly cheaper (CONTRACTS section 1).
    stuck = 0
    for y in range(h):
        for x in range(w):
            v = ctg[y * w + x]
            if v == 0.0 or v >= 1e38:
                continue
            if not any(ctg[(y + dy) * w + x + dx] < v for dx in (-1, 0, 1) for dy in (-1, 0, 1)
                       if (dx or dy) and 0 <= x + dx < w and 0 <= y + dy < h):
                stuck += 1
    if stuck:
        out.append(f'{name}: {stuck} reachable cells have no cheaper neighbour, so the way home dead-ends')


def _in_bounds(c, w, h):
    return isinstance(c, list) and len(c) == 2 and all(isinstance(v, int) for v in c) and 0 <= c[0] < w and 0 <= c[1] < h


def check(folder):
    """List of problems with the world in folder; empty means it meets the contract."""
    out = []
    try:
        with open(os.path.join(folder, 'world.json')) as f:
            meta = json.load(f)
    except (OSError, ValueError) as e:
        return [f'world.json: {e}']
    missing = [k for k in REQUIRED_KEYS if k not in meta]
    if missing:
        return [f'world.json: missing {missing}']
    w, h, base = meta['width'], meta['height'], meta['base_cell']
    if not (isinstance(w, int) and isinstance(h, int) and 0 < w <= MAX_SIDE and 0 < h <= MAX_SIDE):
        return [f'world.json: width/height {w}x{h} must be ints in 1..{MAX_SIDE}']
    if not _in_bounds(base, w, h):
        return [f'world.json: base_cell {base} is outside the {w}x{h} grid']
    if meta['row_order'] != 'north_to_south':
        out.append(f"world.json: row_order {meta['row_order']!r}, contract says 'north_to_south'")
    if not 0 <= meta['reserve_fraction'] < 1:
        out.append('world.json: reserve_fraction must be in [0, 1)')
    for k in ('cell_size_m', 'gravity_mps2', 'energy_budget_j', 'kj_per_l_o2'):
        if not (isinstance(meta[k], (int, float)) and meta[k] > 0):
            out.append(f'world.json: {k} must be a positive number')
    class_ids = {int(k) for k in meta['classes']}
    if not {0, 1, 2, 3, 4} <= class_ids:
        out.append('world.json: classes must name ids 0..4 (AI4Mars classes)')

    names = os.listdir(folder)
    for f in REQUIRED_FILES:
        if f not in names:
            out.append(f'{f}: missing')
    for f in meta.get('files', {}).values():
        if f not in names:
            out.append(f'world.json lists {f}, which is missing')
    for layer in meta['layers']:
        f = meta.get('files', {}).get(layer)
        if not (f in names or f'{layer}.f32' in names or f'{layer}.u8' in names):
            out.append(f'world.json lists layer {layer!r} but no file holds it')
    total = sum(os.path.getsize(os.path.join(folder, f)) for f in names)
    if total > MAX_WORLD_BYTES:
        out.append(f'folder is {total / 2**20:.1f} MB, budget is {MAX_WORLD_BYTES / 2**20:.0f} MB')

    layers = {}
    for f in sorted(names):
        ext = os.path.splitext(f)[1]
        if ext not in BYTES:
            continue
        size, want = os.path.getsize(os.path.join(folder, f)), w * h * BYTES[ext]
        if size != want:
            out.append(f'{f}: {size} bytes, expected {want} ({w}x{h} x {BYTES[ext]})')
        else:
            layers[f] = read_layer(os.path.join(folder, f))

    ranges = {
        'height.f32': ('finite, |h| < 30 km', lambda v: math.isfinite(v) and abs(v) < 3e4),
        'slope.f32': ('0..90 degrees', lambda v: 0.0 <= v <= 90.0),
        'terrain_class.u8': (f'a class id in world.json {sorted(class_ids)}', lambda v: v in class_ids),
        'cost_per_m.f32': ('finite and > 0', lambda v: math.isfinite(v) and v > 0),
        'rocks_fine.u8': ('0 or 1', lambda v: v in (0, 1)),
        'science.u8': ('0..3', lambda v: v <= 3),
        'thermal_inertia.f32': ('finite and >= 0', lambda v: math.isfinite(v) and v >= 0),
        'dose_rate.f32': ('finite and >= 0', lambda v: math.isfinite(v) and v >= 0),
    }
    for f, (rule, ok) in ranges.items():
        if f in layers:
            n_bad, first = _bad(layers[f], ok)
            if n_bad:
                out.append(f'{f}: {n_bad} values not {rule} (first at index {first})')
    for f in ('cost_to_go.f32', 'cost_to_go_scouted.f32'):
        if f in layers:
            _check_cost_to_go(f, layers[f], w, h, base, out)
    if 'cost_to_go.f32' in layers and 'cost_to_go_scouted.f32' in layers:
        cheaper = sum(1 for s, c in zip(layers['cost_to_go_scouted.f32'], layers['cost_to_go.f32']) if s < c * (1 - 1e-6))
        if cheaper:
            out.append(f'cost_to_go_scouted.f32: {cheaper} cells cheaper than cost_to_go (scouting only adds obstacles)')

    out += _check_json(folder, names, w, h)
    return out


def _check_json(folder, names, w, h):
    out, docs = [], {}
    for f in ('targets.json', 'stops.json', 'route.json', 'scout_plan.json'):
        if f in names:
            try:
                with open(os.path.join(folder, f)) as fh:
                    docs[f] = json.load(fh)
            except ValueError as e:
                out.append(f'{f}: not valid JSON ({e})')
    ids = set()
    targets = docs.get('targets.json', [])
    if not isinstance(targets, list):
        return out + ['targets.json: must be a list']
    for t in targets:
        if not (isinstance(t, dict) and {'id', 'name', 'cell'} <= t.keys() and _in_bounds(t['cell'], w, h)):
            out.append(f'targets.json: bad target {t!r:.80}')
        elif t['id'] in ids:
            out.append(f"targets.json: duplicate id {t['id']!r}")
        else:
            ids.add(t['id'])
    stops = docs.get('stops.json', [])
    if not isinstance(stops, list):
        out.append('stops.json: must be a list')
    else:
        for s in stops:
            ok = isinstance(s, dict) and (s.get('target_id') in ids or _in_bounds(s.get('cell'), w, h))
            if not ok:
                out.append(f'stops.json: stop needs a known target_id or an in-bounds cell: {s!r:.80}')
    route = docs.get('route.json')
    if route is not None:
        if not (isinstance(route, dict) and isinstance(route.get('cells'), list)):
            out.append('route.json: must be an object with a "cells" list')
        else:
            bad = [c for c in route['cells'] if not _in_bounds(c, w, h)]
            if bad:
                out.append(f'route.json: {len(bad)} cells outside the grid, first {bad[0]}')
            unknown = [s for s in route.get('stops', []) if s not in ids]
            if unknown:
                out.append(f'route.json: stops not in targets.json: {unknown}')
    plan = docs.get('scout_plan.json')
    if plan is not None:
        if not isinstance(plan, list):
            out.append('scout_plan.json: must be a list of flights')
        else:
            for fl in plan:
                wps = fl.get('waypoints') if isinstance(fl, dict) else None
                if not (isinstance(wps, list) and all(_in_bounds(c, w, h) for c in wps)):
                    out.append(f"scout_plan.json: flight {fl.get('flight') if isinstance(fl, dict) else fl!r} has bad waypoints")
    return out


def world_folders(root=WORLDS):
    return sorted(os.path.join(root, d) for d in os.listdir(root) if os.path.isdir(os.path.join(root, d)))


if __name__ == '__main__':
    folders = sys.argv[1:] or world_folders()
    failed = 0
    for folder in folders:
        problems = check(folder)
        failed += bool(problems)
        print(f"{'FAIL' if problems else 'ok  '} {folder}")
        for p in problems:
            print(f'     - {p}')
    sys.exit(1 if failed else 0)
