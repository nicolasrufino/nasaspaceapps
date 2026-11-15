"""D2 + D3: build data/worlds/gale/ from the slice cut by cut_slice.py (contract: docs/CONTRACTS.md section 1).

    python3 data/pipeline/cut_slice.py --lat -4.800 --lon 137.383 --ortho color   # D1, writes data/raw/gale/
    python3 data/pipeline/make_gale.py                                             # this script
    python3 data/pipeline/check_world.py data/worlds/gale

NASA data used (rule 8):
  - Height, slope: USGS MSL Gale merged DEM 1 m v3 (MRO HiRISE stereo), block-averaged to 8 m.
  - optical.png: USGS MSL Gale HiRISE LRGB orthomosaic, 25 cm, averaged to 8 m.
  - Targets: Curiosity's 2025 boxwork campaign stops, placed at the rover's own logged positions
    (NASA MMGIS MSL waypoints) and named as in the Curiosity mission blog.
  - Stops: Curiosity raw images (Navcam / Mastcam) from the sol of each target (NASA raw image API).
Estimates, marked as such in world.json until the real layers land:
  - terrain_class: HiRISE albedo + DTM roughness heuristic (placeholder for terrain_cls.onnx, Person 1, and THEMIS).
  - rocks_fine: cells rough at 1 m but gentle at 8 m (placeholder for shadow-based rock detection, R3 #31).
"""
import argparse
import array
import json
import math
import os
import sys
import urllib.request

import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.warp import transform as warp_xy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import itertools

import terrain_1m
from make_world import CLASSES, KNOBS, build, path_home, write

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, '..', 'raw', 'gale')
OUT = os.path.join(HERE, '..', 'worlds', 'gale')
MARS_LONLAT = CRS.from_proj4('+proj=longlat +a=3396190 +b=3396190 +no_defs')
WAYPOINTS = 'https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints.json'
RAW_API = ('https://mars.nasa.gov/api/v1/raw_image_items/?order=sol%20desc&per_page=50&page=0'
           '&condition_1=msl:mission&condition_2={sol}:sol:in&condition_3={cams}:instrument:in')
BLOG = 'https://science.nasa.gov/blog/'

# Curiosity's 2025 boxwork campaign, from the mission blog. Cell = the rover's logged position on that sol.
TARGETS = [
    {'id': 'altadena', 'name': 'Altadena drill site', 'sol': 4564, 'goal': 'Boxwork edge: first drill of the campaign',
         'why': 'Curiosity drilled here (its 43rd hole) at the edge of the boxwork unit, June 2025.',
         'sources': [BLOG + 'curiosity-blog-sols-4566-4567-drilling-success/']},
    {'id': 'ridge_top', 'name': 'Top of the ramp: main boxwork', 'sol': 4600, 'goal': 'Reach the boxwork ridges',
         'why': 'After an 11 m sand-covered ramp the rover reached the top of the ridge and the start of the main boxwork region.',
         'sources': [BLOG + 'curiosity-blog-sols-4602-4603-on-top-of-the-ridge/',
                  BLOG + 'curiosity-blog-sols-4600-4601-up-and-over-the-sand-covered-ramp/']},
    {'id': 'overlook', 'name': 'Scenic overlook (360 panorama)', 'sol': 4611, 'goal': 'See the ridge-and-hollow pattern',
         'why': 'A look-about stop picked from HiRISE images to photograph the right-angle ridge pattern.',
         'sources': [BLOG + 'curiosity-blog-sols-4611-4613-scenic-overlook']},
    {'id': 'valle_de_la_luna', 'name': 'Valle de la Luna (hollow drill)', 'sol': 4693, 'goal': 'Sample a boxwork hollow',
         'why': 'Bedrock drilled in the Monte Grande hollow (44th hole), Oct 2025: the "low" of the ridge/hollow pair.',
         'sources': [BLOG + 'curiosity-blog-sols-4689-4694-drill-in-the-boxwork-unit-is-go/',
                  BLOG + 'curiosity-blog-sols-4709-4715-drilling-high-and-low-in-the-boxwork-unit']},
    {'id': 'nevado_sajama', 'name': 'Nevado Sajama (ridge drill)', 'sol': 4718, 'goal': 'Sample a boxwork ridge',
         'why': 'Ridge-top bedrock drilled Nov 2025 (45th hole), the "high" of the pair, to compare with Valle de la Luna.',
         'sources': ['https://science.nasa.gov/solar-system/curiosity-blog-sols-4716-4722-drilling-success-at-nevado-sajama']},
]
CAMS = ['NAV_LEFT_B', 'NAV_RIGHT_B', 'MAST_LEFT', 'MAST_RIGHT', 'FHAZ_LEFT_B']


def get_json(url, cache):
    if cache and os.path.exists(cache):
        with open(cache) as f:
            return json.load(f)
    with urllib.request.urlopen(url, timeout=60) as r:
        d = json.load(r)
    if cache:
        with open(cache, 'w') as f:
            json.dump(d, f)
    return d


def blocks(a, k):
    n = a.shape[0] // k
    return a[:n * k, :n * k].reshape(n, k, n, k)


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--raw', default=RAW)
    p.add_argument('--out', default=OUT)
    p.add_argument('--offline', action='store_true', help='skip the raw-image lookup (stops.json empty)')
    a = p.parse_args()
    with open(os.path.join(a.raw, 'slice.json')) as f:
        meta_slice = json.load(f)
    cell = meta_slice['grids']['dem_8m.tif']['res_m']

    with rasterio.open(os.path.join(a.raw, 'dem_8m.tif')) as d:
        h8 = d.read(1).astype('f8')
        crs, t8 = d.crs, d.transform
    n = h8.shape[0]
    with rasterio.open(os.path.join(a.raw, 'dem_1m.tif')) as d:
        h1 = d.read(1).astype('f8')
    with rasterio.open(os.path.join(a.raw, 'ortho_25cm.tif')) as d:
        img = d.read().astype('f4').mean(axis=0)
    k1, k4 = h1.shape[0] // n, img.shape[0] // n

    # --- per-cell statistics from the full-resolution data ---
    gy, gx = np.gradient(h1, 1.0)
    s1 = np.degrees(np.arctan(np.hypot(gx, gy)))
    steep1 = (blocks(s1, k1) > 35).mean(axis=(1, 3))       # share of 1 m pixels steeper than 35 deg
    rough1 = blocks(s1, k1).std(axis=(1, 3))               # spread of 1 m slopes inside the cell
    albedo = blocks(img, k4).mean(axis=(1, 3))
    gy8, gx8 = np.gradient(h8, cell)
    s8 = np.degrees(np.arctan(np.hypot(gx8, gy8)))

    # --- terrain classes (estimate; AI4Mars ids) ---
    dark, bright = np.percentile(albedo, 20), np.percentile(albedo, 60)
    cls = np.full((n, n), 1, 'u1')                                      # soil
    cls[(s8 > 18) | (rough1 > 9) | ((albedo > bright) & (rough1 > 6))] = 2  # bedrock: steep, rough or bright-rough
    cls[(albedo < dark) & (s8 < 12) & (rough1 < 6)] = 3                 # sand: dark, gentle and smooth
    cls[(steep1 > 0.25) & (s8 < 25)] = 4                                # big rock / blocks, visible from orbit

    # --- base: flat soil cell nearest Curiosity's position on sol 4600 (top of the ramp) ---
    wp = get_json(WAYPOINTS, os.path.join(a.raw, 'msl_waypoints.json'))['features']
    sols = sorted((f['properties']['sol'], f['geometry']['coordinates'][:2]) for f in wp)

    def to_cell(lon, lat):
        x, y = warp_xy(MARS_LONLAT, crs, [lon], [lat])
        c, r = ~t8 * (x[0], y[0])
        return [int(c), int(r)]

    def at_sol(s):
        return [c for q, c in sols if q <= s][-1]

    def nearest(c, ok):
        yy, xx = np.nonzero(ok)
        i = np.argmin((xx - c[0]) ** 2 + (yy - c[1]) ** 2)
        return [int(xx[i]), int(yy[i])]

    base = nearest(to_cell(*at_sol(4600)), (s8 < 6) & (cls == 1))

    # --- hidden rocks: rough at 1 m, gentle at 8 m (what orbit misses and the drone reveals) ---
    rocks = ((steep1 > 0.04) & (s8 < 15) & (cls != 4)).astype('u1')
    by, bx = np.ogrid[:n, :n]
    rocks[(bx - base[0]) ** 2 + (by - base[1]) ** 2 <= 9] = 0
    # keep positives already in the world (e.g. human-reviewed rocks from ml/rock_review, R3): add, never remove
    rocks_src = None
    old = os.path.join(a.out, 'rocks_fine.u8')
    if os.path.exists(old) and os.path.getsize(old) == n * n:
        rocks |= np.fromfile(old, 'u1').reshape(n, n)
        with open(os.path.join(a.out, 'world.json')) as f:
            rocks_src = json.load(f).get('sources', {}).get('rocks_fine')

    # --- walk-scale crossings and terrain views from the 1 m terrain (terrain_1m.py) ---
    views = terrain_1m.compute(h1, n, k1, KNOBS['max_slope_deg'], base)
    P = array.array('B', views['passable'].ravel().tolist())

    hmin = float(h8.min())
    H = (h8 - hmin).astype('f4').ravel().tolist()
    C = array.array('B', cls.ravel().tolist())
    R = array.array('B', rocks.ravel().tolist())
    budget0 = 1.0e6
    h, slope, cls_a, cost_per_m, ctg = build(n, cell, base, budget0, h=H, cls=C, passable=P)

    # --- targets at Curiosity's logged positions, nudged to the nearest cell with a way home ---
    ctg_np = np.array(ctg).reshape(n, n)
    targets = []
    for t in TARGETS:
        lon, lat = at_sol(t['sol'])
        c = to_cell(lon, lat)
        if not (0 <= c[0] < n and 0 <= c[1] < n):
            print(f"skip {t['id']}: sol {t['sol']} position is outside the box")
            continue
        if ctg_np[c[1], c[0]] == math.inf:
            c = nearest(c, np.isfinite(ctg_np))
        targets.append({'id': t['id'], 'name': t['name'], 'cell': c, 'goal': t['goal'], 'why': t['why'],
                        'sources': t['sources'] + [f'Curiosity position on sol {t["sol"]}: NASA MMGIS MSL waypoints'],
                        'sol': t['sol'], 'lonlat': [round(lon, 6), round(lat, 6)]})

    # --- route: base -> targets (nearest first) -> base, stop to stop on least energy ---
    order, cur, left = [], base, list(targets)
    while left:
        nxt = min(left, key=lambda t: (t['cell'][0] - cur[0]) ** 2 + (t['cell'][1] - cur[1]) ** 2)
        order.append(nxt), left.remove(nxt)
        cur = nxt['cell']
    cells, energy, legs = [base], 0.0, [t['cell'] for t in order] + [base]
    prev = base
    for goal in legs:
        ctg_goal = build(n, cell, goal, budget0, h=H, cls=C, passable=P)[-1]
        leg = path_home(ctg_goal, n, prev, passable=P)
        energy += ctg_goal[prev[1] * n + prev[0]]
        cells += leg[1:]
        prev = goal
    metres = sum(cell * math.hypot(b[0] - a_[0], b[1] - a_[1]) for a_, b in itertools.pairwise(cells))
    minutes = metres / KNOBS['speed_mps'] / 60
    reserve = 0.2
    # Knob, not a measurement: the budget is sized so the full Curiosity tour uses about 80% of the usable energy.
    budget = float(math.ceil(energy / (1 - reserve) / 0.8 / 1e5) * 1e5)
    route = {'cells': [list(map(int, c)) for c in cells], 'stops': [t['id'] for t in order],
             'energy_j': round(energy), 'minutes': round(minutes, 1), 'dose_ugy': None,
             'note': 'least-energy legs between Curiosity campaign stops (pipeline, D3)'}

    # --- stops: one Curiosity raw image per target, from that sol ---
    stops = []
    for t in ([] if a.offline else targets):
        try:
            items = get_json(RAW_API.format(sol=t['sol'], cams=','.join(CAMS)), None)['items']
        except (OSError, ValueError, KeyError) as e:  # network down: keep the world usable
            print(f"stops: {t['id']}: {e}")
            continue
        full = [i for i in items if not i.get('is_thumbnail') and i.get('instrument') in CAMS and 'E01' not in i['imageid']]
        full.sort(key=lambda i: CAMS.index(i['instrument']))
        if full:
            i = full[0]
            stops.append({'target_id': t['id'], 'image_url': i.get('https_url') or i['url'],
                          'caption': f"{t['name']}: Curiosity {i['instrument'].replace('_', ' ').title()}, sol {t['sol']}",
                          'credit': i.get('image_credit') or 'NASA/JPL-Caltech',
                          'sol': t['sol']})

    from PIL import Image
    lo, hi = np.percentile(albedo, [1, 99])  # optical.png stretch

    date = 'v3 mosaic, accessed 2026-11'
    site_meta = {
        'source': 'real',
        'site': {'name': 'Gale crater, lower Mount Sharp boxwork', 'centre_lonlat': [meta_slice['centre']['lon_east'],
                                                                                  meta_slice['centre']['lat']],
                 'bbox_deg': meta_slice['bbox_deg'], 'projection': meta_slice['projection']['proj4']},
        'height_offset_m': round(hmin, 2),
        'energy_budget_note': 'knob: sized so the five-stop Curiosity tour uses ~80% of usable energy',
        'sources': {
            'height': {'mission': 'MRO', 'instrument': 'HiRISE stereo (USGS MSL Gale merged DEM 1 m)', 'date': date},
            'slope': {'mission': 'MRO', 'instrument': 'HiRISE stereo (from the 8 m height)', 'date': date},
            'terrain_class': 'Estimate: HiRISE albedo + DTM roughness, until terrain_cls.onnx and THEMIS',
            'rocks_fine': rocks_src or 'Estimate: rough at 1 m (HiRISE DTM) but gentle at 8 m; shadow rock detection to follow (#31)',
            'cost_to_go': 'Pandolf walking model (gravity factor and sand from #83) over walk-scale crossings (passable.u8)',
            'optical': {'mission': 'MRO', 'instrument': 'HiRISE colour (USGS MSL Gale LRGB 25 cm)', 'date': date},
            'targets': {'mission': 'MSL Curiosity', 'instrument': 'rover positions (MMGIS waypoints)', 'date': '2025'},
        },
    }
    site_meta['knobs'] = {**KNOBS, 'eta': [CLASSES[c][1] for c in range(5)], **terrain_1m.KNOBS}
    ext = {'u1': ('.u8', 'B'), 'f4': ('.f32', 'f')}
    extra = []
    for name, arr in views.items():
        suffix, code = ext[arr.dtype.str[1:]]
        extra.append((name + suffix, arr.ravel().tolist(), code))
        site_meta['sources'][name] = terrain_1m.SOURCES[name]
    site = {'meta': site_meta, 'targets': targets, 'stops': stops, 'route': route, 'rocks': R, 'passable': P,
            'extra_files': extra}
    write(a.out, n, cell, base, budget, h, slope, cls_a, cost_per_m, ctg, site=site)
    Image.fromarray((np.clip((albedo - lo) / (hi - lo), 0, 1) * 255).astype('u1')).save(os.path.join(a.out, 'optical.png'))
    wj = os.path.join(a.out, 'world.json')
    with open(wj) as f:
        m = json.load(f)
    m['name'] = 'gale'
    m['files']['optical'] = 'optical.png'
    m['layers'].insert(0, 'optical')
    for name, arr in views.items():
        m['files'][name] = name + ext[arr.dtype.str[1:]][0]
        if name in terrain_1m.VIEWS and name not in m['layers']:
            m['layers'].append(name)
    with open(wj, 'w') as f:
        json.dump(m, f, indent=2)

    reach = int(np.isfinite(np.array(ctg)).sum())
    counts = {name: int((cls == i).sum()) for i, name in enumerate(['unknown', 'soil', 'bedrock', 'sand', 'big_rock'])}
    print(f'wrote {os.path.abspath(a.out)}: {n}x{n} at {cell:g} m, base {base}, {reach} cells can get home')
    print(f'classes {counts}; hidden rock cells {int(rocks.sum())}')
    print(f'route: {len(order)} stops {route["stops"]}, {metres:.0f} m, {minutes:.0f} min, {energy / 1e3:.0f} kJ; '
          f'budget knob {budget / 1e3:.0f} kJ; stops with photos {len(stops)}')


if __name__ == '__main__':
    main()
