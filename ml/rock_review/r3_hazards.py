"""Export reviewed positive rock hazards for Luca's fixed Gale slice.

The point cell and its eight neighbours are a conservative demo clearance
policy, not a measured rock footprint. Zero never means surveyed safe ground.
Existing DTM roughness hazards are retained. A complete review is required by
default. --reviewed-only permits accepted positive additions with partial
review coverage stated explicitly; --preview never stages a world.
"""
import argparse
import array
import hashlib
import json
import math
import shutil
import sys
from collections import Counter
from pathlib import Path

from data.pipeline import make_world
from ml.rock_review.single_observation import HERE

BIG = 3e38


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def semantic_sha(value):
    return sha(json.dumps(value, sort_keys=True, separators=(",", ":")).encode())


def read_array(path, code, size):
    value = array.array(code)
    value.frombytes(Path(path).read_bytes())
    if sys.byteorder != "little":
        value.byteswap()
    if len(value) != size:
        raise ValueError(f"Wrong layer size: {Path(path).name}")
    return value


def float_bytes(values):
    value = array.array("f", values)
    if sys.byteorder != "little":
        value.byteswap()
    return value.tobytes()


def resolve(candidates, decisions, complete=True):
    rows = candidates["annotations"]
    identities = {r["id"] for r in rows}
    if len(identities) != len(rows) or len({r["detection_id"] for r in rows}) != len(rows):
        raise ValueError("Duplicate candidate identity")
    statuses = {}
    for event in decisions["reviews"]:
        if not event.get("user_response_verbatim"):
            raise ValueError("Missing human review evidence")
        for decision in event["decisions"]:
            identity, status = decision["id"], decision["status"]
            if identity not in identities or identity in statuses:
                raise ValueError("Unknown or duplicate review identity")
            if status not in ("accepted", "rejected", "uncertain"):
                raise ValueError("Unsupported human decision")
            statuses[identity] = status
    if complete and set(statuses) != identities:
        raise ValueError("Review coverage is incomplete; use --preview for an unpublished draft")
    return [dict(r, decision=statuses.get(r["id"], "unreviewed")) for r in rows]


def positive_mask(rows, checks, width, height, clearance_cells=1):
    if type(clearance_cells) is not int or clearance_cells < 0:
        raise ValueError("Invalid clearance policy")
    if len(checks) != len(rows) or {r["id"] for r in checks} != {r["id"] for r in rows}:
        raise ValueError("Incomplete or duplicate local alignment checks")
    aligned = {r["id"]: r["passed"] for r in checks}
    mask = bytearray(width*height)
    accepted = []
    for row in rows:
        if row["decision"] != "accepted":
            continue
        if aligned[row["id"]] is not True:
            raise ValueError(f"Accepted point {row['id']} failed local alignment")
        cell = row["registered"]["world_cell"]
        if cell is None or len(cell) != 2 or not all(type(c) is int for c in cell):
            raise ValueError("Invalid accepted point cell")
        x, y = cell
        if not (0 <= x < width and 0 <= y < height):
            raise ValueError("Accepted point outside target world")
        covered = []
        for yy in range(max(0, y-clearance_cells), min(height, y+clearance_cells+1)):
            for xx in range(max(0, x-clearance_cells), min(width, x+clearance_cells+1)):
                mask[yy*width+xx] = 1
                covered.append([xx, yy])
        accepted.append({"id": row["id"], "detection_id": row["detection_id"], "cell": cell,
                         "registered_world_projected_m": row["registered"]["registered_world_projected_m"],
                         "clearance_cells": covered})
    return bytes(mask), accepted


def union_masks(existing, positive):
    if len(existing) != len(positive) or not set(existing+positive) <= {0, 1}:
        raise ValueError("Masks must have matching dimensions and binary values")
    return bytes(a | b for a, b in zip(existing, positive))


def scouted_cost(meta, heights, classes, blocked, previous, passable=None):
    n = meta["width"]
    # world.json knobs = pipeline KNOBS + per-world extras (eta, terrain_1m crossing knobs); every pipeline knob must match.
    knobs_match = all(meta["knobs"].get(k) == v for k, v in make_world.KNOBS.items())
    if meta["height"] != n or not knobs_match or meta["gravity_mps2"] != make_world.G_MARS:
        raise ValueError("World energy model differs from the supported pipeline")
    if blocked[meta["base_cell"][1]*n+meta["base_cell"][0]]:
        raise ValueError("Hazard clearance intersects the habitat; do not erase the hazard")
    values = make_world.build(n, meta["cell_size_m"], meta["base_cell"], meta["energy_budget_j"],
                              h=heights, cls=classes, blocked=blocked, passable=passable)[-1]
    # The shared builder prevents entering hazards but allows exiting a blocked
    # starting cell. The exported contract says impassable, including that cell.
    values = [BIG if blocked[i] else min(value, BIG) for i, value in enumerate(values)]
    raw = float_bytes(values)
    rounded = array.array("f")
    rounded.frombytes(raw)
    if sys.byteorder != "little":
        rounded.byteswap()
    if any(not math.isfinite(v) or v < 0 or v+max(1, abs(old)*1e-6) < old for v, old in zip(rounded, previous)):
        raise ValueError("Adding hazards unexpectedly reduced return cost or made invalid costs")
    return raw


def export(world, destination, preview=False, artifacts=HERE, reviewed_only=False):
    world, destination, artifacts = Path(world), Path(destination), Path(artifacts)
    if destination.exists():
        raise FileExistsError("Use a fresh export directory")
    names = ["r3_candidates.json", "r3_decisions.json", "r3_alignment.json", "r3_world_reference.json",
             "registration_metrics.json", "registered_candidates.json", "single_observation_source.json"]
    raw = {name: (artifacts/name).read_bytes() for name in names}
    data = {name: json.loads(value) for name, value in raw.items()}
    candidates, decisions = data["r3_candidates.json"], data["r3_decisions.json"]
    local, reference = data["r3_alignment.json"], data["r3_world_reference.json"]
    candidate_hash = sha(raw["r3_candidates.json"])
    if decisions["candidate_file_sha256"] != candidate_hash or local["candidate_file_sha256"] != candidate_hash:
        raise ValueError("Review/alignment candidate hash mismatch")
    for field, name in (("registration_file_sha256", "registration_metrics.json"),
                        ("registered_candidates_sha256", "registered_candidates.json")):
        if candidates[field] != sha(raw[name]):
            raise ValueError("Registration provenance mismatch")
    if local["registration_file_sha256"] != candidates["registration_file_sha256"]:
        raise ValueError("Local checks used another registration")
    source = data["single_observation_source.json"]
    if not (candidates["source_pixel_sha256"] == decisions["source_pixel_sha256"] == source["pixel_sha256"]):
        raise ValueError("Source pixel hash mismatch")
    registration = data["registration_metrics.json"]
    if not registration["highpass_model"]["image_alignment_check_passed"]:
        raise ValueError("Image registration failed")
    registered = {r["candidate_id"]: r for r in data["registered_candidates.json"]}
    if len(registered) != len(candidates["annotations"]):
        raise ValueError("Registration coverage mismatch")
    for row in candidates["annotations"]:
        if row["registered"] != registered.get(row["detection_id"]) or row["rock_point_px"] != row["registered"]["native_pixel"]:
            raise ValueError("Candidate coordinates differ from registered source")
    meta = json.loads((world/"world.json").read_bytes())
    if semantic_sha(meta) != reference["world_semantic_sha256"]:
        raise ValueError("Target world metadata changed; recheck the site and energy model")
    for name, expected in reference["layer_sha256"].items():
        if sha((world/name).read_bytes()) != expected:
            raise ValueError(f"Target world layer changed: {name}")
    rows = resolve(candidates, decisions, complete=not (preview or reviewed_only))
    positive, points = positive_mask(rows, local["checks"], meta["width"], meta["height"])
    if not points:
        raise ValueError("No human-accepted points to export")
    base = (world/"rocks_fine.u8").read_bytes()
    merged = union_masks(base, positive)
    if merged[meta["base_cell"][1]*meta["width"]+meta["base_cell"][0]]:
        raise ValueError("Hazard clearance intersects the habitat")
    counts = dict(Counter(r["decision"] for r in rows))
    resolved = counts.get("accepted", 0)+counts.get("rejected", 0)
    cell_counts = Counter(tuple(point["cell"]) for point in points)
    report = {"status": "incomplete_preview" if preview else "reviewed_positive_hazard_additions",
              "observation": source["observation"], "source_url": source["source_url"],
              "source_pixel_sha256": source["pixel_sha256"], "site": meta["site"],
              "grid": {k: meta[k] for k in ("width", "height", "cell_size_m", "row_order")},
              "artifact_sha256": {name: sha(value) for name, value in raw.items()},
              "review_counts": counts, "candidate_count": len(rows),
              "review_complete": not counts.get("unreviewed", 0),
              "delivery_scope": "Accepted positive additions only; unresolved proposals excluded, coverage not exhaustive",
              "selected_proposal_agreement": {"accepted": counts.get("accepted", 0), "resolved": resolved,
                  "fraction": counts.get("accepted", 0)/resolved if resolved else None,
                  "meaning": "Human acceptance among resolved frozen proposals; excludes uncertainty; not recall or held-out accuracy"},
              "g_mosaic_reference_matches": registration["g_proximity_matches_after_registration"],
              "g_mosaic_review_counts": registration["g_review_counts"],
              "precision": None, "recall": None,
              "clearance_policy": {"cells": 1, "meaning": "Point cell plus eight neighbours; 8 m padding is a demo design choice, not measured rock size"},
              "accepted_points": points, "positive_cells": sum(positive), "existing_dtm_cells": sum(base),
              "reviewed_point_density": {
                  "cell_area_m2": meta["cell_size_m"]**2,
                  "meaning": "Counts of accepted native detections before clearance padding; incomplete sampling, not total rock abundance",
                  "occupied_cells": [{"cell": list(cell), "count": count,
                      "rocks_per_m2": count/meta["cell_size_m"]**2}
                      for cell, count in sorted(cell_counts.items(), key=lambda item: (item[0][1], item[0][0]))]},
              "added_cells": sum(a and not b for a, b in zip(positive, base)), "combined_cells": sum(merged),
              "files": {"rocks_verified.u8": {"bytes": len(positive), "sha256": sha(positive)},
                        "rocks_fine.u8": {"bytes": len(merged), "sha256": sha(merged)}},
              "limitations": ["Only accepted H points are added; uncertain, rejected and unreviewed points are excluded.",
                  "Existing DTM roughness estimates remain estimates; this review does not validate them.",
                  "A zero cell is not certified safe. Unmarked rocks and other dangers can be missed.",
                  "Rock dimensions/heights are not validated and do not determine the mask.",
                  "Image-relative placement is checked locally; absolute Mars geodetic accuracy is not measured.",
                  "The earlier G mosaic labels and northern starter labels are preserved, not transferred across images."]}
    destination.mkdir(parents=True)
    (destination/"rocks_verified.u8").write_bytes(positive)
    (destination/"rocks_fine.u8").write_bytes(merged)
    if not preview:
        size = meta["width"]*meta["height"]
        ctg = scouted_cost(meta, read_array(world/"height.f32", "f", size),
                          read_array(world/"terrain_class.u8", "B", size), merged,
                          read_array(world/"cost_to_go_scouted.f32", "f", size),
                          read_array(world/"passable.u8", "B", size) if (world/"passable.u8").exists() else None)
        staged = destination/"world"
        shutil.copytree(world, staged)
        (staged/"rocks_fine.u8").write_bytes(merged)
        (staged/"cost_to_go_scouted.f32").write_bytes(ctg)
        meta["sources"]["rocks_fine"] = (
            "HiRISE DTM roughness estimate retained + human-reviewed NASA/JPL ROSCO positive rocks from "
            "ESP_019698_1750 (2010-10-09), registered to the USGS Gale mosaic; 8 m clearance padding. "
            "Positive additions only, not complete hazard coverage.")
        # The scout plan itself is unchanged; recompute only its hazard counts.
        from data.pipeline.scout_plan import SWATH_M, disk, plan
        _, flights, scanned = plan(world)
        if flights != json.loads((world/"scout_plan.json").read_bytes()):
            raise ValueError("Scout plan differs from the current planner; do not replace or misreport it")
        corridor = bytearray(size)
        for cell in json.loads((world/"route.json").read_bytes())["cells"]:
            for i in disk(meta["width"], cell, SWATH_M/meta["cell_size_m"]):
                corridor[i] = 1
        meta["scout"]["rock_cells_seen_corridor_only"] = sum(bool(c and r) for c, r in zip(corridor, merged))
        meta["scout"]["rock_cells_seen_with_plan"] = sum(bool(c and r) for c, r in zip(scanned, merged))
        (staged/"world.json").write_text(json.dumps(meta, indent=2)+"\n", encoding="utf-8")
        report["staged_world"] = {"cost_to_go_scouted_sha256": sha(ctg), "world_semantic_sha256": semantic_sha(meta),
                                  "changed_files": ["rocks_fine.u8", "cost_to_go_scouted.f32", "world.json"]}
    (destination/"rocks.json").write_text(json.dumps(report, indent=2)+"\n", encoding="utf-8", newline="\n")
    print(json.dumps({k: report[k] for k in ("status", "review_counts", "positive_cells", "added_cells", "combined_cells")}))
    return report


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("world", type=Path)
    p.add_argument("destination", type=Path)
    p.add_argument("--preview", action="store_true")
    p.add_argument("--reviewed-only", action="store_true", help="Deliver accepted positives with partial review coverage stated explicitly")
    args = p.parse_args()
    export(args.world, args.destination, args.preview, reviewed_only=args.reviewed_only)
