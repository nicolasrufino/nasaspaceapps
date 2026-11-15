"""Find boxwork from orbit: a ranked list of candidate sites and its check (Sunday Plan S5, issue #170).

Score (from science_probe.py): sqrt(ridge share x hollow share) within 56 m, from landform.u8
(MRO HiRISE 1 m terrain). It is already 0-1. A guide; the crew decides.

Candidates: the best-scoring cells with reach == 1 whose round trip (base -> cell -> base) fits the usable
energy of the default scenario (budget minus reserve), at least 80 m apart. base -> cell uses the same
Pandolf step cost and walk-scale crossings as make_world.build(), run forward from the base; cell -> base is
cost_to_go.f32. The forward search is checked by running it in reverse and comparing with cost_to_go.f32.

Check (written to ml/exports/science_probe.json, key "candidates_check"): the score's AUC for rover cells
inside vs outside the boxwork (positions from chem_points.json, MSL ChemCam/APXS), with and without
MRO CRISM (science.u8). CRISM is kept only if it raises the AUC.

Run: python3 data/pipeline/science_candidates.py  ->  data/worlds/gale/candidates.json
"""

import heapq
import json
import math
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from make_world import CLASSES, KNOBS, NB, pandolf_watts
from science_probe import WINDOW_CELLS, boxwork_score, inside, window_mean

ROOT = HERE.parents[1]
WORLD = ROOT / "data" / "worlds" / "gale"
PROBE = ROOT / "ml" / "exports" / "science_probe.json"
MIN_APART_M = 80
MAX_SITES = 8
VISITED_M = 24  # a cell this close to a Curiosity measurement point or stop counts as visited
SOL_BLOCK = 20  # held-out split: sols 4480-4499 in fold 0, 4500-4519 in fold 1, ...


def costs(base, n, cell, h, cls, passable, forward):
    """Dijkstra over the walk-scale crossings with make_world's step cost.
    forward=True: energy from base to every cell. forward=False: every cell to base (= cost_to_go)."""
    nbrs = [(dx, dy, cell * math.hypot(dx, dy)) for dx, dy in NB]
    eta = [CLASSES[c][1] for c in range(5)]

    def step(i, j, dist):  # walk i -> j
        d = NB.index((j % n - i % n, j // n - i // n))
        if not (passable[i] >> d) & 1:
            return math.inf
        return pandolf_watts(100.0 * (h[j] - h[i]) / dist, eta[cls[j]]) * dist / KNOBS["speed_mps"]

    out = [math.inf] * (n * n)
    b = base[1] * n + base[0]
    out[b] = 0.0
    pq = [(0.0, b)]
    while pq:
        d, a = heapq.heappop(pq)
        if d > out[a]:
            continue
        ax, ay = a % n, a // n
        for dx, dy, dist in nbrs:
            bx, by = ax + dx, ay + dy
            if 0 <= bx < n and 0 <= by < n:
                o = by * n + bx
                nd = d + (step(a, o, dist) if forward else step(o, a, dist))
                if nd < out[o]:
                    out[o] = nd
                    heapq.heappush(pq, (nd, o))
    return np.array(out).reshape(n, n)


def auc(a, b):
    a, b = np.asarray(a, float), np.asarray(b, float)
    return float(np.mean((a[:, None] > b[None, :]) + 0.5 * (a[:, None] == b[None, :])))


def score_at(grid, cells, mask):
    return [grid[y, x] for (x, y), m in zip(cells, mask, strict=True) if m]


def logistic_fit_predict(X, y, Xt, l2=1.0, steps=3000, lr=0.1):
    """Plain L2 logistic regression by gradient descent; standardised with the training rows only."""
    mu, sd = X.mean(0), X.std(0) + 1e-9
    X, Xt = (X - mu) / sd, (Xt - mu) / sd
    w, b = np.zeros(X.shape[1]), 0.0
    for _ in range(steps):
        p = 1 / (1 + np.exp(-(X @ w + b)))
        w -= lr * (X.T @ (p - y) / len(y) + l2 * w / len(y))
        b -= lr * float(np.mean(p - y))
    return 1 / (1 + np.exp(-(Xt @ w + b)))


def compass(dx, dy):
    return ["E", "NE", "N", "NW", "W", "SW", "S", "SE"][round(math.degrees(math.atan2(-dy, dx)) / 45) % 8]


def main():
    meta = json.loads((WORLD / "world.json").read_text())
    n, cell = meta["width"], meta["cell_size_m"]
    base = meta["base_cell"]
    sc = meta["scenarios"][meta["default_scenario"]]
    usable = sc["energy_budget_j"] * (1 - sc["reserve_fraction"])

    def load(name, dt):
        return np.fromfile(WORLD / name, dt).reshape(n, n)

    landform, reach, crism = load("landform.u8", np.uint8), load("reach.u8", np.uint8), load("science.u8", np.uint8)
    ctg = load("cost_to_go.f32", "<f4").astype(float)
    h = load("height.f32", "<f4").astype(float).ravel().tolist()
    cls = load("terrain_class.u8", np.uint8).ravel().tolist()
    passable = load("passable.u8", np.uint8).ravel().tolist()

    score = boxwork_score(landform)
    ridge, hollow = window_mean(landform == 2, WINDOW_CELLS), window_mean(landform == 3, WINDOW_CELLS)
    out_cost = costs(base, n, cell, h, cls, passable, forward=True)
    back = costs(base, n, cell, h, cls, passable, forward=False)
    ok = np.isfinite(ctg) & np.isfinite(back)
    ctg_check = float(np.max(np.abs(back[ok] - ctg[ok]) / np.maximum(ctg[ok], 1.0)))
    assert ctg_check < 1e-3, f"forward search does not match cost_to_go.f32 (max rel diff {ctg_check})"

    # Where Curiosity was: ChemCam/APXS points and the five stops.
    chem = json.loads((WORLD / "chem_points.json").read_text())
    targets = json.loads((WORLD / "targets.json").read_text())
    rover = np.array([p["cell"] for p in chem] + [t["cell"] for t in targets])

    # --- the check: AUC inside vs outside the boxwork on rover cells, rule alone and with CRISM ---
    sols = {}
    for p in chem:
        sols.setdefault(tuple(p["cell"]), []).append(p["sol"])
    ins = [c for c, s in sols.items() if all(inside(v) for v in s)]
    outs = [c for c, s in sols.items() if not any(inside(v) for v in s)]

    def at(grid, cells):
        return [grid[y, x] for x, y in cells]

    covered = lambda cs: [c for c in cs if crism[c[1], c[0]] > 0]
    ins_c, outs_c = covered(ins), covered(outs)
    rule_auc = auc(at(score, ins), at(score, outs))
    combo = score * crism / 3.0  # one pre-set combination, not tuned: CRISM tertile 1-3 scales the rule
    check = {
        "rule_auc": round(rule_auc, 3),
        "cells_inside": len(ins),
        "cells_outside": len(outs),
        "crism_cells_with_coverage": {"inside": len(ins_c), "outside": len(outs_c)},
        "rule_auc_on_crism_cells": round(auc(at(score, ins_c), at(score, outs_c)), 3),
        "crism_alone_auc": round(auc(at(crism, ins_c), at(crism, outs_c)), 3),
        "rule_x_crism_auc": round(auc(at(combo, ins_c), at(combo, outs_c)), 3),
    }
    keep_crism = check["rule_x_crism_auc"] > check["rule_auc_on_crism_cells"]
    check["crism_kept"] = keep_crism
    check["limits"] = (
        f"Only {len(ins) + len(outs)} cells, all on Curiosity's own path; 'outside' is only the sulfate rock next door. "
        "Untested away from the rover's path. Rule fixed before the check (no tuning). Score, not a probability."
    )
    rank = combo if keep_crism else score

    # --- optional trained model, held out by sol: never scored on cells it was fitted on ---
    feats = {"ridge_share": ridge, "hollow_share": hollow, "slope": load("slope.f32", "<f4"),
             "crevice": load("crevice.f32", "<f4"), "thermal_inertia": load("thermal_inertia.f32", "<f4")}
    cells = ins + outs
    X = np.array([[f[y, x] for f in feats.values()] for x, y in cells], float)
    yl = np.array([1] * len(ins) + [0] * len(outs))
    fold = np.array([(min(sols[c]) // SOL_BLOCK) % 2 for c in cells])  # alternate blocks of 20 sols
    oof = np.zeros(len(cells))
    folds = []
    for k in (0, 1):
        tr, te = fold != k, fold == k
        oof[te] = logistic_fit_predict(X[tr], yl[tr], X[te])
        folds.append({"test_cells": int(te.sum()), "test_inside": int(yl[te].sum()),
                      "model_auc": round(auc(oof[te & (yl == 1)], oof[te & (yl == 0)]), 3),
                      "rule_auc_same_cells": round(auc(score_at(score, cells, te & (yl == 1)),
                                                       score_at(score, cells, te & (yl == 0))), 3)})
    check["logistic_regression"] = {
        "features": list(feats),
        "split": f"2 folds by sol: alternate blocks of {SOL_BLOCK} sols; standardised on the training fold only",
        "folds": folds,
        "model_auc_out_of_fold": round(auc(oof[yl == 1], oof[yl == 0]), 3),
        "shipped": False,
        "note": "Neighbouring sols are neighbouring places, so blocks still leak space; the rule stays the baseline "
        "and the model ranks nothing on the map.",
    }

    # --- candidates ---
    trip = out_cost + ctg
    edge = np.zeros((n, n), bool)
    edge[WINDOW_CELLS:-WINDOW_CELLS, WINDOW_CELLS:-WINDOW_CELLS] = True
    good = (reach == 1) & (trip <= usable) & edge
    order = np.argsort(-np.where(good, rank, -1), axis=None)
    picked = []
    for k in order:
        y, x = divmod(int(k), n)
        if not good[y, x] or len(picked) == MAX_SITES:
            break
        if all(math.dist((x, y), p) * cell >= MIN_APART_M for p in picked):
            picked.append((x, y))

    pct = lambda v: round(float((score < v).mean() * 100), 1)
    sites = []
    for i, (x, y) in enumerate(picked):
        dmin = float(np.min(np.hypot(rover[:, 0] - x, rover[:, 1] - y))) * cell
        dx, dy = x - base[0], y - base[1]
        sites.append({
            "id": f"cand_{chr(97 + i)}",
            "name": f"Site {chr(65 + i)}: {round(math.hypot(dx, dy) * cell / 10) * 10} m {compass(dx, dy)} of base",
            "cell": [x, y],
            "score": round(float(rank[y, x]), 3),
            "why": f"ridges {round(ridge[y, x] * 100)}%, hollows {round(hollow[y, x] * 100)}% within 56 m",
            "curiosity_visited": dmin <= VISITED_M,
            "score_percentile": pct(score[y, x]),
            "round_trip_kj": round(float(trip[y, x]) / 1000, 1),
            "nearest_curiosity_point_m": round(dmin),
        })
    unvisited = sum(not s["curiosity_visited"] for s in sites)
    assert len(sites) >= 5 and unvisited >= 3, (len(sites), unvisited)

    (WORLD / "candidates.json").write_text(json.dumps(sites, indent=2) + "\n")
    probe = json.loads(PROBE.read_text())
    probe["candidates_check"] = {
        "what": "S5 candidate sites (data/worlds/gale/candidates.json): a guide; the crew decides.",
        **check,
        "usable_energy_kj": round(usable / 1000, 1),
        "rule": f"top cells by score, reach == 1, round trip <= usable energy, >= {MIN_APART_M} m apart; "
        f"visited = within {VISITED_M} m of a ChemCam/APXS point or a stop",
        "forward_search_vs_cost_to_go_max_rel_diff": ctg_check,
        "sites": len(sites),
        "sites_curiosity_never_visited": unvisited,
    }
    PROBE.write_text(json.dumps(probe, indent=2) + "\n")
    print(json.dumps(probe["candidates_check"], indent=2))
    print(json.dumps(sites, indent=2))


if __name__ == "__main__":
    main()
