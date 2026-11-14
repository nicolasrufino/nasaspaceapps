"""Measure the fixed shadow-pair baseline against the reviewed final-site points.

Selected-proposal development diagnostic only: no precision, recall, heights or
world hazard layer. Uncertain judgments are excluded, never relabeled.
"""
import argparse
import hashlib
import json
from collections import Counter
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

from ml.rock_review.shadow_baseline import PARAMETERS, detect, match_reference

HERE = Path(__file__).parent


def resolved_references(candidates, review):
    """Require complete, unambiguous ID coverage before excluding uncertain IDs."""
    rows = candidates["annotations"]
    by_id = {r["id"]: r for r in rows}
    if len(by_id) != len(rows):
        raise ValueError("Duplicate candidate IDs")
    decisions = {}
    for event in review["reviews"]:
        for decision in event["decisions"]:
            identity, status = decision["id"], decision["status"]
            if identity not in by_id or identity in decisions:
                raise ValueError("Unknown or duplicate review ID")
            if status not in ("accepted", "rejected", "uncertain"):
                raise ValueError("Unsupported review decision")
            decisions[identity] = status
    if set(decisions) != set(by_id):
        raise ValueError("Review coverage is incomplete")
    resolved = [dict(row, decision=decisions[row["id"]]) for row in rows
                if decisions[row["id"]] != "uncertain"]
    return resolved, dict(Counter(decisions.values()))


def run(source, destination):
    destination = Path(destination)
    if destination.exists():
        raise FileExistsError("Use a fresh run directory")
    candidate_bytes = (HERE/"final_site_candidates.json").read_bytes()
    review_bytes = (HERE/"final_site_review.json").read_bytes()
    candidates, review = json.loads(candidate_bytes), json.loads(review_bytes)
    if hashlib.sha256(candidate_bytes).hexdigest() != review["candidate_file_sha256"]:
        raise ValueError("Candidate bytes do not match the reviewed artifact")
    meta = candidates["source"]
    if meta["source_rgb_pixel_sha256"] != review["source_rgb_pixel_sha256"]:
        raise ValueError("Review and source metadata do not match")
    references, counts = resolved_references(candidates, review)
    with Image.open(source) as original:
        rgb = original.convert("RGB")
    if rgb.size != (meta["width"], meta["height"]):
        raise ValueError("Wrong source image dimensions")
    if hashlib.sha256(rgb.tobytes()).hexdigest() != meta["source_rgb_pixel_sha256"]:
        raise ValueError("Source RGB pixels do not match the reviewed site")
    gray = np.asarray(rgb.convert("L"))
    del rgb
    print("Verified final-site pixels and review; running fixed baseline", flush=True)
    detections = detect(gray)
    matches = match_reference(references, detections, PARAMETERS["reference_match_distance_px"])
    by_id = {r["id"]: r for r in references}
    for match in matches:
        match["review_decision"] = by_id[match["reference_id"]]["decision"]
    matched_ids = {m["reference_id"] for m in matches}
    matched_counts = Counter(m["review_decision"] for m in matches)
    report = {
        "method": "Fixed image-only bright/dark pairing v1 on the full final Gale site",
        "purpose": "Selected-reference development correspondence, not independent detector accuracy",
        "source_url": meta["source_url"], "source_window": meta["source_window"],
        "source_rgb_pixel_sha256": meta["source_rgb_pixel_sha256"],
        "candidate_file_sha256": hashlib.sha256(candidate_bytes).hexdigest(),
        "review_file_sha256": hashlib.sha256(review_bytes).hexdigest(),
        "parameters": PARAMETERS, "parameters_tuned_on_this_review": False,
        "detections": len(detections), "review_counts": counts,
        "matched_accepted_references": matched_counts["accepted"],
        "matched_rejected_references": matched_counts["rejected"],
        "matching": "Maximum-cardinality one-to-one bright-centroid distance <= 8 pixels (2 m); marker radii unused",
        "matches": matches,
        "unmatched_resolved_reference_ids": [r["id"] for r in references if r["id"] not in matched_ids],
        "precision": None, "recall": None, "solar_geometry_verified": False,
        "world_hazard_layer_written": False,
        "runtime": {"opencv": cv2.__version__, "numpy": np.__version__},
        "limitations": [
            "Reference points were selected by bright-object morphology and visually judged by one reviewer.",
            "Uncertain points are excluded; unmarked detections are not automatically false positives.",
            "A centroid correspondence does not verify a shadow, rock outline, height or hazardous world cell.",
            "No exhaustive independent annotation exists to count missed rocks or measure recall.",
            "Illumination geometry is unverified; this experiment does not replace Luca's world hazards.",
        ],
    }
    destination.mkdir(parents=True)
    for name, payload in (("metrics.json", report), ("detections.json", detections)):
        (destination/name).write_text(json.dumps(payload, indent=2)+"\n", encoding="utf-8", newline="\n")
    print(json.dumps({k: report[k] for k in ("detections", "review_counts", "matched_accepted_references", "matched_rejected_references")}), flush=True)
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    run(args.source, args.destination)
