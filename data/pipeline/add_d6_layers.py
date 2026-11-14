"""D6: the other NASA data types for a real world (gale): thermal, spectral, radiation, weather, chemical, geophysical.

    python3 data/pipeline/make_gale.py            # D2/D3 first (rewrites world.json)
    python3 data/pipeline/add_d6_layers.py        # this script (downloads into data/raw/d6/, cached)
    python3 data/pipeline/scout_plan.py data/worlds/gale

Grid layers (contract section 1; the app shows them with flag layers_extra):
  thermal_inertia.f32  Mars Odyssey THEMIS night-time IR brightness (Mars Trek 100 m mosaic), 0-255, relative:
                       warm at night = high thermal inertia (rock), cool = loose sand/dust. Not calibrated SI units.
  science.u8           MRO CRISM hydration browse (MTRDR "HYD": polyhydrated sulfate, monohydrated sulfate, bound
                       water), each observation ranked (each is stretched on its own), mean of ranks over the box, in tertiles 1..3 (0 = no CRISM coverage).
  dose_rate.f32        Curiosity RAD mean GCR dose at Gale, 0.210 mGy/day (Hassler et al. 2014, Science), as
                       micrograys per hour, times the sky-view factor from the HiRISE terrain (estimate of shielding).
Points and series (new optional files, see CONTRACTS.md section 1):
  chem_points.json     ChemCam LIBS (PDS MOC tables, mean per target) and APXS (PDS RWP oxides) along Curiosity's path.
  neutron_points.json  DAN passive mode (PDS RDR): thermal and epithermal neutron count rates per sol. More thermal
                       neutrons relative to epithermal suggests more hydrogen; relative, not water-equivalent hydrogen.
  weather.json         Curiosity REMS daily min/max air temperature, pressure, opacity, UV (NASA MSL weather service).
"""
import csv
import json
import math
import os
import struct
import subprocess
import sys

import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.enums import Resampling
from rasterio.warp import reproject
from rasterio.warp import transform as warp_xy

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, '..', 'raw')
CACHE = os.path.join(RAW, 'd6')
WORLD = os.path.join(HERE, '..', 'worlds', 'gale')
MARS_LONLAT = CRS.from_proj4('+proj=longlat +a=3396190 +b=3396190 +no_defs')
SOL0, SOL1 = 4480, 4900  # Curiosity's boxwork campaign around our box

PDS = 'https://pds-geosciences.wustl.edu/msl'
CCAM = f'{PDS}/msl-m-chemcam-libs-4_5-rdr-v1/mslccm_1xxx'
APXS = f'{PDS}/msl-m-apxs-4_5-rdr-v1/mslapx_1xxx'
DAN = f'{PDS}/msl-m-dan-3_4-rdr-v1/msldan_1xxx'
TREK_TILE = 'https://trek.nasa.gov/tiles/Mars/EQ/{layer}/1.0.0/default/default028mm/{z}/{row}/{col}.png'
THEMIS = 'THEMIS_NightIR_ControlledMosaics_100m_v2_oct2018'
ODE = ('https://oderest.rsl.wustl.edu/live2/?query=product&results=fp&output=JSON&target=mars&ihid=MRO&iid=CRISM'
       '&pt=MTRDR&westlon={w}&eastlon={e}&minlat={s}&maxlat={n}&limit=50')
REMS = 'https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json'
RAD_UGY_PER_DAY = 210.0  # Hassler et al. 2014: 0.210 +/- 0.040 mGy/day, Gale, first 300 sols (solar maximum)


def fetch(url, name):
    """Download once into the cache with curl (Python's bundled certificates miss some PDS hosts)."""
    path = os.path.join(CACHE, name)
    if not os.path.exists(path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        subprocess.run(['curl', '-sfL', '--max-time', '180', '-o', path, url], check=True)
    return path


def pds_index(base, name):
    rows = []
    with open(fetch(f'{base}/index/{name}', f'{base.split("/")[-2]}_{name}')) as f:
        for r in csv.reader(f):
            rows.append([c.strip() for c in r])
    return rows


# ---------- grid helpers ----------
def load_world():
    with open(os.path.join(WORLD, 'world.json')) as f:
        meta = json.load(f)
    with open(os.path.join(RAW, 'gale', 'slice.json')) as f:
        sl = json.load(f)
    with rasterio.open(os.path.join(RAW, 'gale', 'dem_8m.tif')) as d:
        grid = {'crs': d.crs, 'transform': d.transform, 'n': d.width}
    return meta, sl, grid


def lonlat_to_cell(grid, lon, lat):
    x, y = warp_xy(MARS_LONLAT, grid['crs'], [lon], [lat])
    c, r = ~grid['transform'] * (x[0], y[0])
    c, r = math.floor(c), math.floor(r)
    return [c, r] if 0 <= c < grid['n'] and 0 <= r < grid['n'] else None


def onto_grid(src, src_transform, src_crs, grid, resampling, nodata=0):
    out = np.zeros((grid['n'], grid['n']), 'f4')
    reproject(src.astype('f4'), out, src_transform=src_transform, src_crs=src_crs, dst_transform=grid['transform'],
              dst_crs=grid['crs'], resampling=resampling, src_nodata=nodata, dst_nodata=np.nan)
    return out


# ---------- thermal: THEMIS night IR from Mars Trek tiles ----------
def themis(grid, bbox, z=9):
    from io import BytesIO

    from PIL import Image
    dpp = 360.0 / (2 ** (z + 1) * 256)
    c0, c1 = int((bbox['west'] + 180) / dpp // 256), int((bbox['east'] + 180) / dpp // 256)
    r0, r1 = int((90 - bbox['north']) / dpp // 256), int((90 - bbox['south']) / dpp // 256)
    big = np.zeros(((r1 - r0 + 1) * 256, (c1 - c0 + 1) * 256), 'f4')
    for r in range(r0, r1 + 1):
        for c in range(c0, c1 + 1):
            p = fetch(TREK_TILE.format(layer=THEMIS, z=z, row=r, col=c), f'themis/{z}_{r}_{c}.png')
            with open(p, 'rb') as f:
                im = Image.open(BytesIO(f.read())).convert('L')
            big[(r - r0) * 256:(r - r0 + 1) * 256, (c - c0) * 256:(c - c0 + 1) * 256] = np.asarray(im)
    t = rasterio.transform.from_origin(-180 + c0 * 256 * dpp, 90 - r0 * 256 * dpp, dpp, dpp)
    return onto_grid(big, t, MARS_LONLAT, grid, Resampling.bilinear, nodata=-1)


# ---------- spectral: CRISM MTRDR hydration browse via PDS ODE ----------
def crism(grid, bbox):
    q = ODE.format(w=bbox['west'], e=bbox['east'], s=bbox['south'], n=bbox['north'])
    with open(fetch(q, 'crism/ode.json')) as f:
        prods = json.load(f)['ODEResults']['Products']['Product']
    prods = prods if isinstance(prods, list) else [prods]
    stack, used = [], []
    for p in prods:
        files = {f['FileName'].lower(): f['URL'] for f in p['Product_files']['Product_file']
                 if 'BRHYDJ' in f['FileName'].upper()}
        lbl = next((k for k in files if k.endswith('.lbl')), None)
        img = next((k for k in files if k.endswith('.img')), None)
        if not (lbl and img):
            continue
        fetch(files[img], f'crism/{img}')
        with rasterio.open(fetch(files[lbl], f'crism/{lbl}')) as s:
            a = s.read().astype('f4')
            hyd = a.max(axis=0)  # R: polyhydrated sulfate, G: monohydrated sulfate, B: bound water
            hyd[(a == 0).all(axis=0)] = np.nan
            ok = np.isfinite(hyd)  # each browse image is stretched on its own: compare ranks, not raw values
            hyd[ok] = (np.argsort(np.argsort(hyd[ok])) + 1) / ok.sum() * 255
            stack.append(onto_grid(np.nan_to_num(hyd, nan=-1), s.transform, s.crs, grid, Resampling.average, -1))
            used.append(img.split('_')[0].upper())
    m = np.nanmean(np.stack(stack), axis=0) if stack else np.full((grid['n'], grid['n']), np.nan)
    sci = np.zeros(m.shape, 'u1')
    ok = np.isfinite(m) & (m > 0)
    if ok.any():
        t1, t2 = np.percentile(m[ok], [33.3, 66.7])
        sci[ok] = 1 + (m[ok] > t1) + (m[ok] > t2)
    return sci, used


# ---------- radiation: RAD mean dose x sky-view factor ----------
def sky_view(h, cell, n_az=16, max_m=800):
    n = h.shape[0]
    svf = np.zeros_like(h)
    steps = int(max_m / cell)
    for k in range(n_az):
        a = 2 * math.pi * k / n_az
        dx, dy = math.cos(a), math.sin(a)
        best = np.zeros_like(h)
        for s in range(1, steps + 1):
            ox, oy = round(dx * s), round(dy * s)
            shifted = np.full_like(h, -1e9)
            ys = slice(max(0, -oy), min(n, n - oy))
            xs = slice(max(0, -ox), min(n, n - ox))
            yt = slice(max(0, oy), min(n, n + oy))
            xt = slice(max(0, ox), min(n, n + ox))
            shifted[ys, xs] = h[yt, xt]
            best = np.maximum(best, (shifted - h) / (cell * math.hypot(ox, oy)))
        svf += np.cos(np.arctan(np.maximum(best, 0))) ** 2
    return svf / n_az


# ---------- rover positions ----------
def waypoints():
    with open(os.path.join(RAW, 'gale', 'msl_waypoints.json')) as f:
        feats = json.load(f)['features']
    by_sd = {(f['properties']['site'], f['properties']['drive']): f['geometry']['coordinates'][:2] for f in feats}
    by_sol = sorted((f['properties']['sol'], f['geometry']['coordinates'][:2]) for f in feats)
    return by_sd, by_sol


def pos_before_sol(by_sol, sol):
    """Where the rover sat at the start of a sol (before that sol's drive): last waypoint of an earlier sol."""
    prev = [c for s, c in by_sol if s < sol]
    return prev[-1] if prev else by_sol[0][1]


# ---------- chemical: ChemCam + APXS ----------
def chemcam(grid, by_sol):
    idx = pds_index(CCAM, 'libsindex.tab')
    sol_of = {r[3].upper(): int(r[12]) for r in idx if r[5] == 'CHEMCAM-CCS'}
    tables = sorted({r[3] for r in idx if r[5] == 'CHEMCAM-MOC'})
    oxides = ['SiO2', 'TiO2', 'Al2O3', 'FeOT', 'MgO', 'CaO', 'Na2O', 'K2O', 'MnO']
    per = {}
    for name in tables:
        a, b = (int(x) for x in name.split('.')[0].split('_')[1:3])
        if b < SOL0 or a > SOL1:
            continue
        with open(fetch(f'{CCAM}/data/moc/{name.lower()}', f'ccam/{name.lower()}'), encoding='latin-1') as f:
            rows = list(csv.reader(f))
        head = next(i for i, r in enumerate(rows) if r and r[0] == 'File')
        cols = rows[head]
        for r in rows[head + 1:]:
            if len(r) < len(cols) or not r[0]:
                continue
            sol = sol_of.get(r[0].replace('.CSV', '').upper())
            if sol is None or not SOL0 <= sol <= SOL1:
                continue
            key = (sol, r[1])
            vals = {o: float(r[cols.index(o)]) for o in oxides if r[cols.index(o)].strip()}
            per.setdefault(key, []).append(vals)
    out = []
    for (sol, target), shots in sorted(per.items()):
        cell = lonlat_to_cell(grid, *pos_before_sol(by_sol, sol))
        if cell is None:
            continue
        mean = {o: round(sum(s[o] for s in shots if o in s) / max(1, sum(1 for s in shots if o in s)), 2)
                for o in oxides}
        out.append({'id': f'ccam_{sol}_{target}', 'instrument': 'ChemCam', 'target': target, 'sol': sol, 'cell': cell,
                    'shots': len(shots), 'oxides_wt_pct': mean,
                    'source': 'MSL ChemCam LIBS, PDS MOC table (Geosciences Node)'})
    return out


def apxs(grid, by_sd):
    idx = pds_index(APXS, 'index.tab')
    out = []
    for r in idx:
        if r[5] != 'APXS_RWP' or not SOL0 <= int(r[12]) <= SOL1:
            continue
        sol, base = int(r[12]), r[2].lower().replace('.lbl', '')
        lbl = fetch(f'{APXS}/{r[1].lower().rstrip("/")}/{base}.lbl', f'apxs/{base}.lbl')
        with open(lbl) as f:
            text = f.read()
        rmc = text.split('ROVER_MOTION_COUNTER ')[1].split('(')[1].split(')')[0].split(',')
        site, drive = int(rmc[0]), int(rmc[1])
        ll = by_sd.get((site, drive))
        cell = lonlat_to_cell(grid, *ll) if ll else None
        if cell is None:
            continue
        with open(fetch(f'{APXS}/{r[1].lower().rstrip("/")}/{base}.csv', f'apxs/{base}.csv')) as f:
            rows = [row for row in csv.reader(f)][1:]
        ox = {row[0].strip(): float(row[1]) for row in rows if len(row) >= 2 and row[1].strip()}
        out.append({'id': f'apxs_{base[4:13]}', 'instrument': 'APXS', 'target': None, 'sol': sol, 'cell': cell,
                    'site_drive': [site, drive], 'oxides_wt_pct': ox,
                    'source': 'MSL APXS oxide abundances, PDS RWP product (Geosciences Node)'})
    return out


# ---------- geophysical: DAN passive ----------
def dan(grid, by_sol):
    idx = pds_index(DAN, 'index.tab')
    per = {}
    for r in idx:
        if r[5] != 'DAN_RDR_PA' or not SOL0 <= int(r[11]) <= SOL1:
            continue
        sol, path = int(r[11]), r[1].lower().rstrip('/') + '/' + r[3]
        p = fetch(f'{DAN}/{path}', f'dan/{r[3]}')
        with open(p, 'rb') as f:
            b = f.read()
        for i in range(len(b) // 71):
            rec = b[i * 71:(i + 1) * 71]
            lat, lon, _, _, dur, ctn_bg, ctn, cetn_bg, cetn = struct.unpack('>9f', rec[27:63])
            if dur <= 0:
                continue
            d = per.setdefault(sol, {'t': 0.0, 'th': 0.0, 'ep': 0.0, 'll': []})
            d['t'] += dur
            d['th'] += (ctn - ctn_bg) - (cetn - cetn_bg)  # CTN sees thermal + epithermal; CETN only epithermal
            d['ep'] += cetn - cetn_bg
            d['ll'].append((lon, lat))
    out = []
    for sol, d in sorted(per.items()):
        lon = float(np.median([q[0] for q in d['ll']]))
        lat = float(np.median([q[1] for q in d['ll']]))
        cell = lonlat_to_cell(grid, lon, lat) or lonlat_to_cell(grid, *pos_before_sol(by_sol, sol))
        if cell is None or d['ep'] <= 0:
            continue
        out.append({'sol': sol, 'cell': cell, 'hours': round(d['t'] / 3600, 1),
                    'thermal_cps': round(d['th'] / d['t'], 3), 'epithermal_cps': round(d['ep'] / d['t'], 3),
                    'thermal_epithermal_ratio': round(d['th'] / d['ep'], 3),
                    'source': 'MSL DAN passive mode, PDS RDR (Geosciences Node)'})
    return out


def weather():
    with open(fetch(REMS, 'rems_weather.json')) as f:
        soles = json.load(f)['soles']
    keep = []
    for s in soles:
        if not SOL0 <= int(s['sol']) <= SOL1:
            continue

        def num(k, s=s):
            try:
                return float(s[k])
            except (KeyError, ValueError):
                return None
        keep.append({'sol': int(s['sol']), 'earth_date': s['terrestrial_date'], 'ls': num('ls'),
                     'min_temp_c': num('min_temp'), 'max_temp_c': num('max_temp'), 'pressure_pa': num('pressure'),
                     'ground_min_c': num('min_gts_temp'), 'ground_max_c': num('max_gts_temp'),
                     'opacity': s.get('atmo_opacity'), 'uv': s.get('local_uv_irradiance_index')})
    return {'source': 'MSL Curiosity REMS daily summary (NASA/JPL-Caltech/CAB)', 'sols': sorted(keep, key=lambda d: d['sol'])}


def main():
    meta, sl, grid = load_world()
    n, cell = meta['width'], meta['cell_size_m']
    bbox = sl['bbox_deg']
    h = np.fromfile(os.path.join(WORLD, 'height.f32'), '<f4').reshape(n, n)
    by_sd, by_sol = waypoints()

    ti = themis(grid, bbox)
    ti = np.nan_to_num(ti, nan=float(np.nanmean(ti))).astype('<f4')
    sci, crism_obs = crism(grid, bbox)
    svf = sky_view(h.astype('f8'), cell)
    dose = (RAD_UGY_PER_DAY / 24.0 * svf).astype('<f4')
    ti.tofile(os.path.join(WORLD, 'thermal_inertia.f32'))
    sci.astype('u1').tofile(os.path.join(WORLD, 'science.u8'))
    dose.tofile(os.path.join(WORLD, 'dose_rate.f32'))

    chem = chemcam(grid, by_sol) + apxs(grid, by_sd)
    neut = dan(grid, by_sol)
    wx = weather()
    for name, obj in [('chem_points.json', chem), ('neutron_points.json', neut), ('weather.json', wx)]:
        with open(os.path.join(WORLD, name), 'w') as f:
            json.dump(obj, f, indent=1)

    # route dose: time on each cell of the pipeline route at walking speed
    with open(os.path.join(WORLD, 'route.json')) as f:
        route = json.load(f)
    sec_per_cell = cell / meta['knobs']['speed_mps']
    route['dose_ugy'] = round(float(sum(dose[y, x] for x, y in route['cells']) * sec_per_cell / 3600), 2)
    with open(os.path.join(WORLD, 'route.json'), 'w') as f:
        json.dump(route, f, indent=1)

    for k in ('thermal_inertia', 'science', 'dose_rate'):
        if k not in meta['layers']:
            meta['layers'].append(k)
    meta['files'].update({'thermal_inertia': 'thermal_inertia.f32', 'science': 'science.u8', 'dose_rate': 'dose_rate.f32',
                          'chem_points': 'chem_points.json', 'neutron_points': 'neutron_points.json',
                          'weather': 'weather.json'})
    meta['sources'].update({
        'thermal_inertia': {'mission': 'Mars Odyssey', 'instrument': 'THEMIS night IR (Mars Trek 100 m mosaic; relative 0-255, higher = rockier)', 'date': '2002-2018 mosaic'},
        'science': {'mission': 'MRO', 'instrument': f'CRISM hydration browse, {len(crism_obs)} obs ({", ".join(crism_obs)}); tertiles 1-3', 'date': 'MTRDR'},
        'dose_rate': {'mission': 'MSL Curiosity', 'instrument': 'RAD mean 0.210 mGy/day (Hassler 2014) x HiRISE sky-view factor (estimate)', 'date': '2012-13 (solar max)'},
        'chem_points': {'mission': 'MSL Curiosity', 'instrument': f'ChemCam + APXS, {len(chem)} points', 'date': f'sols {SOL0}-{SOL1}'},
        'neutron_points': {'mission': 'MSL Curiosity', 'instrument': f'DAN passive, {len(neut)} sols (relative hydrogen)', 'date': f'sols {SOL0}-{SOL1}'},
        'weather': {'mission': 'MSL Curiosity', 'instrument': f'REMS, {len(wx["sols"])} sols', 'date': f'sols {SOL0}-{SOL1}'},
    })
    meta['data_types'] = {'optical': 'optical', 'topographic': 'height', 'thermal': 'thermal_inertia',
                          'spectral': 'science', 'radiation': 'dose_rate', 'atmospheric': 'weather',
                          'chemical': 'chem_points', 'geophysical': 'neutron_points'}
    with open(os.path.join(WORLD, 'world.json'), 'w') as f:
        json.dump(meta, f, indent=2)
    print(f'thermal: THEMIS night IR {np.nanmin(ti):.0f}..{np.nanmax(ti):.0f}; '
          f'science: CRISM {len(crism_obs)} obs, coverage {(sci > 0).mean() * 100:.0f}%; '
          f'dose {dose.min():.2f}..{dose.max():.2f} uGy/h (route {route["dose_ugy"]} uGy)')
    print(f'chem points: {sum(p["instrument"] == "ChemCam" for p in chem)} ChemCam targets, '
          f'{sum(p["instrument"] == "APXS" for p in chem)} APXS; DAN sols: {len(neut)}; REMS sols: {len(wx["sols"])}')


if __name__ == '__main__':
    sys.exit(main())
