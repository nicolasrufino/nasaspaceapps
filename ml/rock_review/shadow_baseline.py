"""Image-only bright/dark pairing baseline on the documented Gale crop.

Dark components are possible shadows, not verified shadows. No solar geometry,
rock height, rock footprint, completeness or navigation safety is inferred.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).parent
PARAMETERS = {"kernel_px": 17, "contrast_threshold": 18, "min_area_px": 8,
              "max_area_px": 220, "max_component_extent_px": 24,
              "max_pair_distance_px": 14, "reference_match_distance_px": 8}


def components(response):
    _, _, stats, centers = cv2.connectedComponentsWithStats(
        (response > PARAMETERS["contrast_threshold"]).astype(np.uint8), 8)
    result = []
    for (x, y, w, h, area), (cx, cy) in zip(stats[1:], centers[1:]):
        if not PARAMETERS["min_area_px"] <= area <= PARAMETERS["max_area_px"]:
            continue
        if max(w, h) > PARAMETERS["max_component_extent_px"]:
            continue
        result.append({"center": [float(cx), float(cy)], "bbox": [int(x), int(y), int(w), int(h)],
                       "component_area_px": int(area)})
    return result


def detect(pixels):
    size = PARAMETERS["kernel_px"]
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (size, size))
    bright = components(cv2.morphologyEx(pixels, cv2.MORPH_TOPHAT, kernel))
    dark = components(cv2.morphologyEx(pixels, cv2.MORPH_BLACKHAT, kernel))
    pairs = []
    # One dark component per bright component. A dark component cannot serve two detections.
    edges = sorted((math.dist(b["center"], d["center"]), bi, di)
                   for bi, b in enumerate(bright) for di, d in enumerate(dark)
                   if 1 <= math.dist(b["center"], d["center"]) <= PARAMETERS["max_pair_distance_px"])
    used_bright, used_dark = set(), set()
    for distance, bi, di in edges:
        if bi in used_bright or di in used_dark:
            continue
        used_bright.add(bi)
        used_dark.add(di)
        pairs.append({"bright": bright[bi], "dark": dark[di], "pair_distance_px": distance})
    pairs.sort(key=lambda pair: (pair["bright"]["center"][1], pair["bright"]["center"][0]))
    for i, pair in enumerate(pairs, 1):
        pair["id"] = f"S{i:04}"
    return pairs


def match_reference(reference, detections, tolerance):
    """Maximum-cardinality one-to-one distance matching; no review radii are used."""
    neighbors = []
    for ref in reference:
        distances = [(math.dist((ref["x"], ref["y"]), d["bright"]["center"]), j)
                     for j, d in enumerate(detections)]
        neighbors.append([j for distance, j in sorted(distances) if distance <= tolerance])
    owner = {}

    def assign(i, seen):
        for j in neighbors[i]:
            if j in seen:
                continue
            seen.add(j)
            if j not in owner or assign(owner[j], seen):
                owner[j] = i
                return True
        return False

    for i in range(len(reference)):
        assign(i, set())
    return sorted([{"reference_id": reference[i]["id"], "detection_id": detections[j]["id"],
                    "distance_px": math.dist((reference[i]["x"], reference[i]["y"]), detections[j]["bright"]["center"])}
                   for j, i in owner.items()], key=lambda row: row["reference_id"])


def render_review(image, detections, destination):
    # Fixed hash selection, not hand-picked successes against the accepted reference.
    selected = sorted(detections, key=lambda p: hashlib.sha256(p["id"].encode()).hexdigest())[:12]
    board = Image.new("RGB", (832, 760), (22, 25, 30))
    draw = ImageDraw.Draw(board)
    font = ImageFont.load_default(size=15)
    draw.text((12, 8), "NEW bright/dark pairs - unreviewed, no heights or rock boundaries", font=font)
    for i, pair in enumerate(selected):
        cx, cy = pair["bright"]["center"]
        left = max(0, min(image.width-96, round(cx)-48))
        top = max(0, min(image.height-96, round(cy)-48))
        tile = image.crop((left, top, left+96, top+96)).resize((192, 192), Image.Resampling.NEAREST).convert("RGB")
        td = ImageDraw.Draw(tile)
        for kind, color in [("bright", "yellow"), ("dark", "cyan")]:
            x, y, w, h = pair[kind]["bbox"]
            td.rectangle(((x-left)*2, (y-top)*2, (x+w-left)*2, (y+h-top)*2), outline=color, width=2)
        x, y = 12 + (i % 4)*208, 64 + (i // 4)*230
        board.paste(tile, (x, y))
        draw.text((x, y-22), pair["id"], font=font)
    draw.text((12, 742), "Yellow: bright component | cyan: possible shadow | each tile: 24 x 24 m", font=font)
    board.save(destination / "new_pairs_review.png")
    return [p["id"] for p in selected]


def run(source, destination):
    source, destination = Path(source), Path(destination)
    if destination.exists():
        raise FileExistsError("Use a new run directory; existing evidence is preserved")
    metadata = json.loads((HERE / "source.json").read_text(encoding="utf-8"))
    image = Image.open(source).convert("L")
    if image.size != (1024, 1024) or hashlib.sha256(image.tobytes()).hexdigest() != metadata["source_pixel_sha256"]:
        raise ValueError("Source pixels do not match the documented starter crop")
    pairs = detect(np.asarray(image))
    reference = json.loads((HERE / "candidates_reviewed.json").read_text(encoding="utf-8"))["annotations"]
    matches = match_reference(reference, pairs, PARAMETERS["reference_match_distance_px"])
    matched_ids = {m["reference_id"] for m in matches}
    destination.mkdir(parents=True)
    review_ids = render_review(image, pairs, destination)
    metrics = {
        "method": "image-only bright/dark component pairing v1; unvalidated possible shadows",
        "source": metadata,
        "parameters": PARAMETERS,
        "detections": len(pairs), "accepted_reference_locations": len(reference),
        "matched_reference_locations": len(matches),
        "reference_correspondence_fraction": len(matches)/len(reference),
        "matching": "maximum-cardinality one-to-one bright-centroid distance <= 8 pixels (2 m); review circles not used",
        "matches": matches,
        "unmatched_reference_ids": [r["id"] for r in reference if r["id"] not in matched_ids],
        "new_review_ids": review_ids,
        "precision": None, "recall": None, "minimum_reliable_size_m": None,
        "solar_geometry_verified": False, "final_world_grid": None,
        "limitations": ["Same crop as the selected positive reference; not an independent benchmark.",
                        "Unmatched detections are not automatically false alarms; missed rocks were not exhaustively annotated.",
                        "Dark and bright components can be terrain, albedo or imaging artifacts.",
                        "No heights, physical rock footprints, safe route or final rocks_fine layer are inferred.",
                        "Illumination metadata and contributing acquisition at this crop remain unverified."],
    }
    for name, value in [("detections.json", pairs), ("metrics.json", metrics)]:
        (destination/name).write_text(json.dumps(value, indent=2)+"\n", encoding="utf-8", newline="\n")
    print(json.dumps({k: metrics[k] for k in ("detections", "accepted_reference_locations", "matched_reference_locations", "new_review_ids")}))
    return metrics


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    run(args.source, args.destination)
