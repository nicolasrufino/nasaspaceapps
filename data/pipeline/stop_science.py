"""What Curiosity measured at each stop (Sunday Plan: the Visit step).

For every target in the Gale world, find the nearest real measurement in the files we already have:
MSL ChemCam / APXS (chem_points.json), MSL DAN passive (neutron_points.json), MSL REMS weather for
the sol the rover was there (weather.json) and the RAD-based dose rate of the cell (dose_rate.f32).
Nothing is invented: a stop with no measurement within MAX_M metres gets null.

Run: python data/pipeline/stop_science.py  ->  data/worlds/gale/stop_science.json
"""

import json
import math
from pathlib import Path

import numpy as np

WORLD = Path(__file__).resolve().parents[2] / "data" / "worlds" / "gale"
MAX_M = 60  # farther than this is not "at the stop"


def nearest(points, cell, sol, cell_m):
    """Closest point in metres; ties go to the sol nearest the rover's visit."""
    best = min(points, key=lambda p: (math.dist(p["cell"], cell), abs(p["sol"] - sol)))
    metres = round(math.dist(best["cell"], cell) * cell_m, 1)
    return (best, metres) if metres <= MAX_M else (None, None)


def main():
    meta = json.loads((WORLD / "world.json").read_text())
    n, cell_m = meta["width"], meta["cell_size_m"]
    chem = json.loads((WORLD / "chem_points.json").read_text())
    neutron = json.loads((WORLD / "neutron_points.json").read_text())
    weather = {s["sol"]: s for s in json.loads((WORLD / "weather.json").read_text())["sols"]}
    dose = np.fromfile(WORLD / "dose_rate.f32", np.float32).reshape(n, n)

    stops = []
    for t in json.loads((WORLD / "targets.json").read_text()):
        x, y = t["cell"]
        c, c_m = nearest(chem, t["cell"], t["sol"], cell_m)
        # DAN rides on the rover, so the reading for the stop is the one from the sol the rover was there.
        # We match by sol, not position: the cells in neutron_points.json are about 200 m off (to fix).
        d = min(neutron, key=lambda p: abs(p["sol"] - t["sol"]))
        d = d if abs(d["sol"] - t["sol"]) <= 2 else None
        w = weather.get(t["sol"])
        stops.append({
            "target_id": t["id"],
            "landform": int(np.fromfile(WORLD / "landform.u8", np.uint8).reshape(n, n)[y, x]),
            "chem": c and {"instrument": c["instrument"], "target": c["target"], "sol": c["sol"],
                           "metres_away": c_m, "oxides_wt_pct": c["oxides_wt_pct"]},
            "neutron": d and {"instrument": "DAN passive", "sol": d["sol"], "matched_by": "sol",
                              "thermal_epithermal_ratio": d["thermal_epithermal_ratio"]},
            "weather": w and {"instrument": "REMS", "sol": w["sol"], "min_temp_c": w["min_temp_c"],
                              "max_temp_c": w["max_temp_c"], "pressure_pa": w["pressure_pa"]},
            "dose_ugy_per_hour": round(float(dose[y, x]), 2),
        })
    out = {
        "what": f"Nearest real Curiosity measurement to each stop; null when none within {MAX_M} m",
        "sources": "MSL ChemCam/APXS, DAN, REMS (NASA PDS); RAD mean x sky view (estimate, microgray per hour), see world.json sources",
        "landform_key": "0 flat, 1 slope, 2 ridge, 3 hollow",
        "stops": stops,
    }
    (WORLD / "stop_science.json").write_text(json.dumps(out, indent=1) + "\n")
    for s in stops:
        c, d, w = s["chem"], s["neutron"], s["weather"]
        print(s["target_id"], "| chem", c and (c["instrument"], c["sol"], c["metres_away"], c["oxides_wt_pct"].get("MgO")),
              "| DAN", d and (d["sol"], d["thermal_epithermal_ratio"]), "| REMS", w and (w["min_temp_c"], w["max_temp_c"]),
              "| dose", s["dose_ugy_per_hour"])


if __name__ == "__main__":
    main()
