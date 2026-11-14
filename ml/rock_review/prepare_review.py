"""Reproducible, unvalidated rock proposals for human review; no trained model."""
import argparse
import hashlib
import json
import math
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont


def build(source: Path, destination: Path, metadata: Path | None = None):
    if (destination / "rock_candidates_review.json").exists():
        raise FileExistsError("Choose a new output directory to preserve existing review decisions.")
    original = Image.open(source)
    original.load()  # PNG metadata after IDAT is populated only after decoding.
    reference = json.loads(Path(__file__).with_name("source.json").read_text(encoding="utf-8"))
    pixel_hash = hashlib.sha256(original.convert("L").tobytes()).hexdigest()
    if pixel_hash != reference["source_pixel_sha256"]:
        raise ValueError("Image pixels do not match the documented Gale starter crop.")
    if metadata is None:
        meta = json.loads(original.info["MartianMapMetadata"])
    else:
        source_info = json.loads(metadata.read_text(encoding="utf-8"))
        pixel_hash = hashlib.sha256(original.convert("L").tobytes()).hexdigest()
        if pixel_hash != source_info["source_pixel_sha256"]:
            raise ValueError("Image pixels do not match this source metadata.")
        meta = source_info["source_metadata"]
    if meta != reference["source_metadata"]:
        raise ValueError("Source metadata does not match the documented Gale starter crop.")
    if original.size != (1024, 1024):
        raise ValueError("This starter-review script expects the documented 1024 x 1024 crop.")
    if meta["geotransform"] != [8142733.5, 0.25, 0, -279648.5, 0, -0.25]:
        raise ValueError("Unexpected footprint; use the documented Gale starter crop.")
    destination.mkdir(parents=True, exist_ok=True)
    gray = original.convert("L")
    pixels = np.array(gray)
    top = cv2.morphologyEx(
        pixels, cv2.MORPH_TOPHAT,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (17, 17)),
    )
    _, labels, stats, centers = cv2.connectedComponentsWithStats(
        (top > 18).astype("uint8"), 8,
    )
    candidates = []
    for i, (x, y, w, h, area) in enumerate(stats[1:], 1):
        cx, cy = centers[i]
        if not (8 <= area <= 220 and 3 <= w <= 22 and 3 <= h <= 22
                and 20 < cx < 1004 and 20 < cy < 1004):
            continue
        region = top[y:y+h, x:x+w]
        membership = labels[y:y+h, x:x+w] == i
        score = float(region[membership].mean() * math.sqrt(area))
        candidates.append({"x": round(float(cx), 2), "y": round(float(cy), 2),
                           "radius_px": int(math.ceil(max(w, h) / 2) + 4),
                           "candidate_bbox_px": [int(x), int(y), int(w), int(h)],
                           "selection_score": score})
    chosen = []
    for c in sorted(candidates, key=lambda v: v["selection_score"], reverse=True):
        if all((c["x"]-v["x"])**2 + (c["y"]-v["y"])**2 > 30**2 for v in chosen):
            chosen.append(c)
        if len(chosen) == 50:
            break
    chosen.sort(key=lambda c: (int(c["y"] // 128), c["x"]))
    gt = meta["geotransform"]
    for index, c in enumerate(chosen, 1):
        c["id"] = index
        c["status"] = "unreviewed"
        c["reviewer"] = None
        c["note"] = ""
        c["projected_easting_m"] = gt[0] + (c["x"] + 0.5) * gt[1]
        c["projected_northing_m"] = gt[3] + (c["y"] + 0.5) * gt[5]
        c["longitude_east_deg"] = c["projected_easting_m"] / 3396190 * 180 / math.pi
        c["latitude_deg"] = c["projected_northing_m"] / 3396190 * 180 / math.pi
        # Selection score is a contrast ranking, never a probability.
        del c["selection_score"]
    payload = {
        "schema": "martian-map-rock-review-v1",
        "source_file": source.name,
        "source_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "source_metadata": meta,
        "coordinate_convention": "zero-based pixel centre indices; x right, y down",
        "method": "Bright-object top-hat proposals (17 px kernel, threshold 18), size filtering and 30 px spacing; no learned model or shadow-height estimation.",
        "review_status": "unreviewed",
        "limitations": ["Not exhaustive: exactly 50 candidates selected for review.",
                        "May include bedrock, groups of rocks or lighting artifacts.",
                        "Circles are approximate review markers, not segmentation contours.",
                        "Do not use unreviewed proposals as ground truth or a safety-certified map.",
                        "Selection on this image cannot establish held-out precision or recall."],
        "annotations": chosen,
    }
    (destination / "rock_candidates_review.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")
    font_path = Path("C:/Windows/Fonts/arial.ttf")
    font = ImageFont.truetype(str(font_path), 17) if font_path.exists() else ImageFont.load_default()
    small = ImageFont.truetype(str(font_path), 14) if font_path.exists() else ImageFont.load_default()
    annotated = gray.convert("RGB")
    draw = ImageDraw.Draw(annotated)
    for c in chosen:
        x, y, r = c["x"], c["y"], c["radius_px"]
        draw.ellipse((x-r, y-r, x+r, y+r), outline=(255, 211, 64), width=2)
        label = str(c["id"])
        lx = max(2, min(990, x+r+3))
        ly = max(2, min(999, y-r-3))
        draw.text((lx, ly), label, font=font, fill=(255, 230, 110), stroke_width=2, stroke_fill=(0, 0, 0))
    # Add a margin so scale and provenance do not cover source pixels.
    output = Image.new("RGB", (1024, 1084), (22, 25, 30))
    output.paste(annotated, (0, 0))
    d = ImageDraw.Draw(output)
    d.text((16, 1035), "50 ROCK CANDIDATES - REVIEW REQUIRED", font=font, fill="white")
    d.text((16, 1060), "25 cm/pixel | 256 x 256 m | NASA / JPL-Caltech / USGS / UArizona", font=small, fill=(210, 214, 220))
    d.line((815, 1046, 895, 1046), fill="white", width=3)
    d.text((905, 1036), "20 m", font=font, fill="white")
    output.save(destination / "Gale_50_rock_candidates.png")
    # Review sheets: exact 64 px source windows, displayed at 2x nearest-neighbour.
    for sheet in range(2):
        board = Image.new("RGB", (800, 850), (22, 25, 30))
        bd = ImageDraw.Draw(board)
        for j, c in enumerate(chosen[sheet*25:(sheet+1)*25]):
            x0 = max(0, min(gray.width - 64, round(c["x"]) - 32))
            y0 = max(0, min(gray.height - 64, round(c["y"]) - 32))
            tile = gray.crop((x0, y0, x0+64, y0+64)).resize((128, 128), Image.Resampling.NEAREST).convert("RGB")
            td = ImageDraw.Draw(tile)
            cx, cy = (c["x"]-x0)*2, (c["y"]-y0)*2
            rr = c["radius_px"] * 2
            td.ellipse((cx-rr, cy-rr, cx+rr, cy+rr), outline=(255, 211, 64), width=2)
            xx, yy = (j % 5) * 160 + 16, (j // 5) * 170 + 30
            board.paste(tile, (xx, yy))
            bd.text((xx, yy-24), f"#{c['id']} | 16 x 16 m", font=small, fill="white")
        board.save(destination / f"review_details_{sheet+1}.png")
    print(json.dumps({"proposals": len(chosen), "original_unchanged": True,
                      "output": str(destination.resolve())}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    parser.add_argument("--metadata", type=Path, help="source.json for a PNG without embedded crop metadata")
    args = parser.parse_args()
    build(args.source, args.destination, args.metadata)
