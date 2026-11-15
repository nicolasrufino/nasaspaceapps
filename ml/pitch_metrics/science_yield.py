"""Science-yield numbers for the pitch (issue #171). Nothing here is typed by hand except the two
mission rules below, each with its source.

Reads:  ml/exports/pitch_metrics.json (final planned route), docs/SUNDAY-PLAN.md (the Visit task table),
        data/worlds/gale/targets.json (Curiosity's sols), data/worlds/gale/dose_rate.f32 (Curiosity RAD x sky view).
Writes: ml/exports/science_yield.json and a copy at data/worlds/gale/science_yield.json (the app can fetch world files).
Run:    python3 ml/pitch_metrics/science_yield.py
"""

import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
WORLD = ROOT / "data" / "worlds" / "gale"
OUTS = [ROOT / "ml" / "exports" / "science_yield.json", WORLD / "science_yield.json"]
STAY_SOLS = 30  # first crewed stay: National Academies 2025; NASA NTRS 20220001816 (docs/SUNDAY-PLAN.md)
SOLS_PER_WALK = 2  # scouting sol + walk sol (docs/OPERATIONS.md)


def visit_tasks():
    """Rows of the Visit-step table in docs/SUNDAY-PLAN.md: (task, minutes)."""
    text = (ROOT / "docs" / "SUNDAY-PLAN.md").read_text()
    section = text.split("### The Visit step", 1)[1]
    table = section[section.index("\n|") :].split("\n\n", 1)[0]
    rows = [r.strip().strip("|").split("|") for r in table.strip().splitlines()][2:]
    return [(r[0].strip(), int(r[2])) for r in rows]


def route_dose(cells, metres, speed):
    """Mean dose rate (uGy/h) over the route's cells x walk time at the knob speed."""
    meta = json.loads((WORLD / "world.json").read_text())
    n = meta["width"]
    dose = np.fromfile(WORLD / "dose_rate.f32", "<f4").reshape(n, n)
    mean = float(np.mean([dose[y, x] for x, y in cells]))
    hours = metres / speed / 3600
    return mean, hours


def main():
    meta = json.loads((WORLD / "world.json").read_text())
    speed = meta["knobs"]["speed_mps"]
    route = json.loads((ROOT / "ml" / "exports" / "pitch_metrics.json").read_text())["results"]["repeated_scout"][
        "final_route"
    ]
    tasks = visit_tasks()
    sols = sorted(t["sol"] for t in json.loads((WORLD / "targets.json").read_text()))
    stops = len(route["stops"])
    walks = STAY_SOLS // SOLS_PER_WALK
    mean_dose, hours = route_dose(route["cells"], route["metres"], speed)

    out = {
        "what": "Science-yield numbers for the pitch, from repo files. Made by ml/pitch_metrics/science_yield.py.",
        "walk": {
            "stops": stops,
            "stop_ids": route["stops"],
            "route_m": round(route["metres"], 1),
            "route_energy_kj": round(route["energy_j"] / 1000, 1),
            "visit_tasks_per_stop": len(tasks),
            "visit_tasks": [t for t, _ in tasks],
            "visit_minutes_per_stop": sum(m for _, m in tasks),
            "measurements_per_walk": stops * len(tasks),
            "source": "ml/exports/pitch_metrics.json results.repeated_scout.final_route; docs/SUNDAY-PLAN.md Visit table",
        },
        "stay": {
            "stay_sols": STAY_SOLS,
            "sols_per_walk": SOLS_PER_WALK,
            "walks_max": walks,
            "stops_max": walks * stops,
            "measurements_max": walks * stops * len(tasks),
            "note": "Our arithmetic: at most, if every second sol is a walk sol and every walk has five stops. "
            "Stay length: National Academies 2025 / NASA NTRS 20220001816; 2 sols per walk: docs/OPERATIONS.md.",
        },
        "curiosity": {
            "first_sol": sols[0],
            "last_sol": sols[-1],
            "sols_first_to_last_stop": sols[-1] - sols[0],
            "caveat": "Not a like-for-like race: Curiosity drilled and ran lab analyses (CheMin, SAM) for weeks at "
            "each drill stop, which a crew walk does not do. Say: the rover took this long to visit these five places.",
            "source": "data/worlds/gale/targets.json (sols of the five stops)",
        },
        "dose": {
            "mean_dose_rate_ugy_per_h": round(mean_dose, 2),
            "walk_hours": round(hours, 3),
            "walk_dose_ugy": round(mean_dose * hours, 2),
            "note": "Walking time only (route length / knob speed), stop time excluded. dose_rate.f32 = Curiosity RAD "
            "mean 0.210 mGy/day (Hassler 2014) x sky-view factor: an estimate, absorbed dose not dose equivalent.",
        },
    }
    for p in OUTS:
        p.write_text(json.dumps(out, indent=2) + "\n")
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
