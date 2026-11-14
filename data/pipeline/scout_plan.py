"""D4: the scout helicopter's extra flights -> <world>/scout_plan.json (docs/CONTRACTS.md section 1).

    python3 data/pipeline/scout_plan.py data/worlds/gale

Order (docs/PLAN.md, Scout): 1) the route corridor, 2) anomalies, 3) the cells the map is least sure about.
The app (E4, app/src/scout.js) already flies (1) along the live route and then appends these flights,
so this file holds (2) and (3). Each flight is Ingenuity-class: at most ~700 m and ~180 s, and lands where
the next one takes off; the first takes off at base.

Only what orbit can see is used to choose cells (height, slope, terrain_class, optical.png), never rocks_fine:
the plan must not peek at what the drone is meant to discover.
  Anomalies: walkable slopes close to the 25 deg limit, and cells where brightness and terrain class disagree
             (bright "sand", dark "bedrock"). Thermal (THEMIS) and mineral (CRISM) disagreements join when those
             layers exist.
  Least sure: texture the 8 m cell can't resolve (local spread of brightness and slope).
Standard library only (Pillow optional, for optical.png).
"""
import argparse
import array
import json
import math
import os

FLIGHT_M = 700.0      # Ingenuity-class leg (docs/PLAN.md)
FLIGHT_S = 180.0
SWATH_M = 15.0        # same footprint radius as app/src/scout.js
NEAR_ROUTE_M = 300.0  # only scout what could change this walk
MAX_FLIGHTS = {'anomaly': 3, 'uncertain': 2}


def load(folder, name, code):
    a = array.array(code)
    with open(os.path.join(folder, name), 'rb') as f:
        a.frombytes(f.read())
    return a


def optical(folder, n):
    try:
        from PIL import Image
        im = Image.open(os.path.join(folder, 'optical.png')).convert('L')
        return list(im.tobytes()) if im.size == (n, n) else None
    except (ImportError, OSError):
        return None


def local_std(v, n, x, y):
    vals = [v[(y + dy) * n + x + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1) if 0 <= x + dx < n and 0 <= y + dy < n]
    m = sum(vals) / len(vals)
    return math.sqrt(sum((q - m) ** 2 for q in vals) / len(vals))


def disk(n, c, r):
    x0, y0 = c
    for y in range(max(0, int(y0 - r)), min(n, int(y0 + r) + 1)):
        for x in range(max(0, int(x0 - r)), min(n, int(x0 + r) + 1)):
            if (x - x0) ** 2 + (y - y0) ** 2 <= r * r:
                yield y * n + x


def plan(folder):
    with open(os.path.join(folder, 'world.json')) as f:
        meta = json.load(f)
    n, cs, base = meta['width'], meta['cell_size_m'], meta['base_cell']
    slope = load(folder, 'slope.f32', 'f')
    cls = load(folder, 'terrain_class.u8', 'B')
    ctg = load(folder, 'cost_to_go.f32', 'f')
    with open(os.path.join(folder, 'route.json')) as f:
        route = json.load(f)['cells']
    opt = optical(folder, n)
    limit = meta['knobs']['max_slope_deg']
    r_swath, r_near = SWATH_M / cs, NEAR_ROUTE_M / cs

    scanned = bytearray(n * n)  # the route corridor is already flown by the app
    for c in route:
        for i in disk(n, c, r_swath):
            scanned[i] = 1
    near = bytearray(n * n)
    for c in route[::3]:
        for i in disk(n, c, r_near):
            near[i] = 1

    bright = dark = None
    if opt:
        s = sorted(opt)
        dark, bright = s[len(s) * 25 // 100], s[len(s) * 75 // 100]
    anomaly, unsure = [0.0] * (n * n), [0.0] * (n * n)
    for y in range(n):
        for x in range(n):
            i = y * n + x
            if not near[i] or scanned[i] or ctg[i] >= 1e38:
                continue
            a = 0.0
            if limit - 5 <= slope[i] <= limit:
                a += 1.0  # walkable on paper, marginal in reality
            if opt and ((cls[i] == 3 and opt[i] > bright) or (cls[i] == 2 and opt[i] < dark)):
                a += 1.0  # layers disagree
            anomaly[i] = a
            u = local_std(slope, n, x, y) / 10.0
            if opt:
                u += local_std(opt, n, x, y) / 40.0
            unsure[i] = u

    flights, pos = [], list(base)
    speed = FLIGHT_M / FLIGHT_S
    for kind, score in (('anomaly', anomaly), ('uncertain', unsure)):
        for _ in range(MAX_FLIGHTS[kind]):
            cand = sorted((i for i in range(n * n) if score[i] > 0 and not scanned[i]), key=lambda i: -score[i])[:600]
            if not cand:
                break
            wps, metres, revealed = [list(pos)], 0.0, 0
            while True:
                best, best_v = None, 0.0
                for i in cand:
                    if scanned[i]:
                        continue
                    c = (i % n, i // n)
                    d = cs * math.hypot(c[0] - pos[0], c[1] - pos[1])
                    if metres + d > FLIGHT_M or d == 0:
                        continue
                    v = score[i] / (1.0 + d / 100.0)
                    if v > best_v:
                        best, best_v = c, v
                if best is None:
                    break
                d = cs * math.hypot(best[0] - pos[0], best[1] - pos[1])
                steps = max(1, int(d / (cs / 2)))  # cells along the hop are seen too
                for k in range(1, steps + 1):
                    p = (pos[0] + (best[0] - pos[0]) * k / steps, pos[1] + (best[1] - pos[1]) * k / steps)
                    for i in disk(n, p, r_swath):
                        if not scanned[i]:
                            scanned[i] = 1
                            revealed += 1
                metres += d
                pos = list(best)
                wps.append(pos)
            if len(wps) < 2:
                break
            flights.append({'flight': len(flights) + 1, 'kind': kind, 'waypoints': wps,
                            'seconds': round(metres / speed), 'metres': round(metres), 'cells_revealed': revealed})
    return meta, flights, scanned


def main():
    p = argparse.ArgumentParser()
    p.add_argument('world', nargs='?', default=os.path.join(os.path.dirname(__file__), '..', 'worlds', 'gale'))
    a = p.parse_args()
    meta, flights, scanned = plan(a.world)
    with open(os.path.join(a.world, 'scout_plan.json'), 'w') as f:
        json.dump(flights, f, indent=1)
    n = meta['width']
    # How much more of the hidden layer the extra flights reach (rocks_fine is read only to report, never to plan).
    rocks = load(a.world, 'rocks_fine.u8', 'B') if os.path.exists(os.path.join(a.world, 'rocks_fine.u8')) else None
    with open(os.path.join(a.world, 'route.json')) as f:
        route = json.load(f)['cells']
    corridor = bytearray(n * n)
    for c in route:
        for i in disk(n, c, SWATH_M / meta['cell_size_m']):
            corridor[i] = 1
    summary = {'flights': len(flights), 'metres': sum(f['metres'] for f in flights),
               'cells_revealed': sum(f['cells_revealed'] for f in flights)}
    if rocks:
        summary['rock_cells_seen_corridor_only'] = sum(1 for i in range(n * n) if corridor[i] and rocks[i])
        summary['rock_cells_seen_with_plan'] = sum(1 for i in range(n * n) if scanned[i] and rocks[i])
    meta.setdefault('files', {})['scout_plan'] = 'scout_plan.json'
    meta['scout'] = {**summary, 'note': 'extra flights after the route corridor; made by data/pipeline/scout_plan.py'}
    with open(os.path.join(a.world, 'world.json'), 'w') as f:
        json.dump(meta, f, indent=2)
    print(f'wrote {a.world}/scout_plan.json: ' + json.dumps(summary))
    for fl in flights:
        print(f"  flight {fl['flight']} {fl['kind']:9s} {fl['metres']:4d} m {fl['seconds']:3d} s "
              f"{len(fl['waypoints']) - 1} hops, {fl['cells_revealed']} cells")


if __name__ == '__main__':
    main()
