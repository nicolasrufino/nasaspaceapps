"""First check of a boxwork score against what Curiosity found (Sunday Plan, track A).

Reads the Gale world files and prints / writes three checks:
1. where Curiosity's five stops rank on a simple ridge-and-hollow score;
2. whether the score separates rover positions inside the boxwork unit from
   those outside it (NASA: entered sol 4534, left about sol 4845);
3. whether our ChemCam/APXS points repeat the published chemistry trend
   (boxwork: more Si, less Mg and S than the sulfate unit; Siebach et al., GSA 2025).

Sources: MRO HiRISE 1 m terrain (landform layer), MSL ChemCam, APXS and DAN points.
Run: python data/pipeline/science_probe.py  ->  ml/exports/science_probe.json
"""

import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
WORLD = ROOT / "data" / "worlds" / "gale"
OUT = ROOT / "ml" / "exports" / "science_probe.json"
BOXWORK_SOLS = (4534, 4845)  # GSA Connects 2025 abstract; Curiosity blog sols 4845-4851
WINDOW_CELLS = 3  # 7 x 7 cells = 56 m: a few ridge-and-hollow pairs (hollows are 10-20 m)


def window_mean(a, r):
    p = np.pad(a.astype(float), r, mode="edge").cumsum(0).cumsum(1)
    p = np.pad(p, ((1, 0), (1, 0)))
    k = 2 * r + 1
    return (p[k:, k:] - p[:-k, k:] - p[k:, :-k] + p[:-k, :-k]) / k**2


def boxwork_score(landform):
    """High where ridges (2) and hollows (3) are both common nearby."""
    return np.sqrt(window_mean(landform == 2, WINDOW_CELLS) * window_mean(landform == 3, WINDOW_CELLS))


def inside(sol):
    return BOXWORK_SOLS[0] <= sol <= BOXWORK_SOLS[1]


def main():
    meta = json.loads((WORLD / "world.json").read_text())
    n = meta["width"]
    score = boxwork_score(np.fromfile(WORLD / "landform.u8", np.uint8).reshape(n, n))

    stops = {
        t["id"]: round(float((score < score[t["cell"][1], t["cell"][0]]).mean() * 100), 1)
        for t in json.loads((WORLD / "targets.json").read_text())
    }

    cells = {}
    neutron = json.loads((WORLD / "neutron_points.json").read_text())
    for p in neutron:
        cells.setdefault(tuple(p["cell"]), []).append(p["sol"])
    a = np.array([score[y, x] for (x, y), s in cells.items() if all(inside(v) for v in s)])
    b = np.array([score[y, x] for (x, y), s in cells.items() if not any(inside(v) for v in s)])
    auc = float(np.mean((a[:, None] > b[None, :]) + 0.5 * (a[:, None] == b[None, :])))

    chem = json.loads((WORLD / "chem_points.json").read_text())
    oxides = {}
    for ox in ("SiO2", "MgO", "SO3", "Al2O3"):
        vals = [(c["oxides_wt_pct"][ox], inside(c["sol"])) for c in chem if ox in c["oxides_wt_pct"]]
        oxides[ox] = {
            "inside_median": round(float(np.median([v for v, i in vals if i])), 1),
            "inside_n": sum(i for _, i in vals),
            "outside_median": round(float(np.median([v for v, i in vals if not i])), 1),
            "outside_n": sum(not i for _, i in vals),
        }

    result = {
        "what": "First probe, not a validated detector. Score = ridges and hollows both nearby, 8 m cells.",
        "boxwork_sols": BOXWORK_SOLS,
        "stop_percentile_on_score": stops,
        "rover_cells": {"inside": len(a), "outside": len(b), "auc_inside_vs_outside": round(auc, 3)},
        "chemistry_wt_pct": oxides,
    }
    OUT.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
