"""Run pinned ROSCO on a verified single-acquisition Gale crop; prepare review.

Development experiment only. No world mask, labels, precision or recall are
inferred from a native model score or from geographic proximity to old markers.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from ml.rock_review.evaluate_final_site import resolved_references
from ml.rock_review.rosco_native import (
    COMMIT,
    DLL_SHA256,
    VERSION,
    detect_tiles,
    load_library,
    parameters,
)
from ml.rock_review.shadow_baseline import match_reference
from ml.rock_review.single_observation import HERE, illumination


def projected_point(x, y, affine):
    """Zero-based pixel-center coordinates -> projected metres (GDAL convention)."""
    return [affine[0] + (x+.5)*affine[1] + (y+.5)*affine[2],
            affine[3] + (x+.5)*affine[4] + (y+.5)*affine[5]]


def cell_for_point(x, y, bounds, width, height):
    left, bottom, right, top = bounds
    if not (left <= x < right and bottom < y <= top):
        return None
    return [math.floor((x-left)/(right-left)*width), math.floor((top-y)/(top-bottom)*height)]


def render_review(gray, records, destination):
    """Fixed hash sample from the site interior, independent of reviewed G points."""
    eligible = [r for r in records if r["world_cell"] is not None
                and 32 <= r["rockX"] < gray.width-32 and 32 <= r["rockY"] < gray.height-32]
    selected = sorted(eligible, key=lambda r: hashlib.sha256(
        f"{r['rockX']:.1f},{r['rockY']:.1f}".encode()).hexdigest())[:6]
    font = ImageFont.load_default(size=20)
    reviews = []
    for page in range(math.ceil(len(selected)/3)):
        board = Image.new("RGB", (940, 1518), (20, 23, 28))
        draw = ImageDraw.Draw(board)
        draw.text((16, 10), "HiRISE single observation | raw pixels / markers | 16.2 m per crop", font=font)
        for offset, rock in enumerate(selected[page*3:page*3+3]):
            identity = f"H{page*3+offset+1:02}"
            left, top = round(rock["rockX"])-32, round(rock["rockY"])-32
            raw = gray.crop((left, top, left+64, top+64)).resize((448, 448), Image.Resampling.NEAREST).convert("RGB")
            marked = raw.copy()
            md = ImageDraw.Draw(marked)
            for x, y, color in ((rock["rockX"], rock["rockY"], "yellow"), (rock["shaX"], rock["shaY"], "cyan")):
                px, py = (x-left+.5)*7, (y-top+.5)*7
                md.line((px-12, py, px+12, py), fill=color, width=2)
                md.line((px, py-12, px, py+12), fill=color, width=2)
            y = 65+offset*480
            draw.text((16, y-26), f"{identity} | candidate, not a confirmed rock", font=font)
            board.paste(raw, (16, y))
            board.paste(marked, (476, y))
            reviews.append({"id": identity, "detection_id": rock["candidate_id"], "status": "unreviewed",
                            "source_crop": [left, top, 64, 64], "page": page+1,
                            "rock_point_px": [rock["rockX"], rock["rockY"]],
                            "shadow_centroid_px": [rock["shaX"], rock["shaY"]],
                            "world_cell": rock["world_cell"], "model_score": rock["score"]})
        draw.text((16, 1500-16), "Yellow: model rock point | cyan: shadow centroid | no outline is asserted", font=font)
        board.save(destination/f"review_{page+1}.png")
    return reviews


def run(source_directory, dll, destination, preset="upstream-example"):
    import rasterio.warp

    source_directory, destination = Path(source_directory), Path(destination)
    if destination.exists():
        raise FileExistsError("Use a fresh run directory")
    meta = json.loads((source_directory/"source.json").read_text(encoding="utf-8"))
    if meta != json.loads((HERE/"single_observation_source.json").read_text(encoding="utf-8")):
        raise ValueError("Source metadata differs from the frozen observation")
    rdr, ortho = (source_directory/"rdr.LBL").read_bytes(), (source_directory/"ortho.LBL").read_bytes()
    if any(hashlib.sha256(data).hexdigest() != meta[name]["sha256"]
           for data, name in ((rdr, "rdr_label"), (ortho, "ortho_label"))):
        raise ValueError("Label checksum mismatch")
    if illumination(rdr.decode("ascii"), ortho.decode("ascii")) != meta["illumination"]:
        raise ValueError("Illumination differs from source labels")
    with Image.open(source_directory/"site.png") as original:
        if original.mode != "L" or original.size != (meta["width"], meta["height"]):
            raise ValueError("Wrong native image mode or dimensions")
        image = original.copy()
    pixels = np.asarray(image)
    if hashlib.sha256(pixels.tobytes()).hexdigest() != meta["pixel_sha256"] or np.any(pixels == 0):
        raise ValueError("Wrong or null source pixels")
    candidate_bytes = (HERE/"final_site_candidates.json").read_bytes()
    candidates = json.loads(candidate_bytes)
    review_bytes = (HERE/"final_site_review.json").read_bytes()
    review = json.loads(review_bytes)
    if hashlib.sha256(candidate_bytes).hexdigest() != review["candidate_file_sha256"]:
        raise ValueError("Wrong reviewed candidate artifact")
    references, counts = resolved_references(candidates, review)
    params = parameters(meta, preset)
    _library, function = load_library(dll)  # Hold the library for the entire run.
    destination.mkdir(parents=True)
    native, tiles = detect_tiles(pixels, destination/"native_input.pgm", params, function)
    source_points = [projected_point(r["rockX"], r["rockY"], meta["geotransform"]) for r in native]
    target = candidates["source"]
    if native:
        xs, ys = rasterio.warp.transform(meta["crs_wkt"], target["crs_wkt"],
                                         [p[0] for p in source_points], [p[1] for p in source_points])
    else:
        xs, ys = [], []
    detections, proximity = [], []
    for index, (rock, x, y) in enumerate(zip(native, xs, ys), 1):
        scale = meta["sampling_m_per_px"]
        record = dict(rock, candidate_id=f"HRC{index:05}", world_projected_m=[x, y],
                      world_cell=cell_for_point(x, y, target["world_projected_bounds"], target["world_width"], target["world_height"]),
                      model_width_m=rock["rockWidth"]*scale, model_height_m=rock["rockHeight"]*scale,
                      status="unreviewed")
        detections.append(record)
        gt = target["geotransform"]
        proximity.append({"id": record["candidate_id"], "bright": {"center": [(x-gt[0])/gt[1]-.5, (y-gt[3])/gt[5]-.5]}})
    matches = match_reference(references, proximity, 8)
    decisions = {r["id"]: r["decision"] for r in references}
    for match in matches:
        match["review_decision"] = decisions[match["reference_id"]]
    review_rows = render_review(image, detections, destination)
    report = {
        "method": "NASA/JPL ROSCO native rock detector; single-observation development run",
        "source": meta, "rosco_version": VERSION, "rosco_commit": COMMIT, "dll_sha256": DLL_SHA256,
        "parameters": {name: getattr(params, name) for name, _ in params._fields_},
        "preset": preset,
        "parameter_origin": "Upstream ESP_046282 test preset with this observation's scale/illumination. confidence-only disables gradient rejection; shadow-shapes disables gradient and confidence rejection for error analysis.",
        "parameters_tuned_on_gale_review": False, "completed_tiles": len(tiles), "detections": len(detections),
        "excluded_model_point_outside_image": sum(t["excluded_model_point_outside_image"] for t in tiles),
        "detections_inside_world": sum(r["world_cell"] is not None for r in detections),
        "review_counts_on_other_image": counts, "geographic_proximity_matches": matches,
        "candidate_file_sha256": hashlib.sha256(candidate_bytes).hexdigest(),
        "review_file_sha256": hashlib.sha256(review_bytes).hexdigest(),
        "visual_labels_transferred": False, "relative_image_registration_verified": False,
        "precision": None, "recall": None, "world_hazard_layer_written": False,
        "limitations": [
            "The G labels refer to a different mosaic. Proximity within 2 m is not a validated rock match or accuracy.",
            "ROSCO scores describe model fit, not calibrated probabilities of rock identity.",
            "Native widths and heights are in pixels; metre estimates multiply by native sampling once.",
            "Physical estimates assume the observation-level illumination and no local slope correction.",
            "The starting preset is not validated on Gale. Ridges, scarps and albedo can produce false positives.",
            "Any hash-selected proposals require review; no decisions are inherited from G01-G50.",
        ]}
    review_payload = {"source_pixel_sha256": meta["pixel_sha256"], "selection": "SHA-256 of native rock coordinates, first six interior candidates",
                      "annotations": review_rows,
                      "sheet_sha256": {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(destination.glob("review_*.png"))}}
    for name, value in (("metrics.json", report), ("detections.json", detections), ("tiles.json", tiles), ("review.json", review_payload)):
        (destination/name).write_text(json.dumps(value, indent=2)+"\n", encoding="utf-8", newline="\n")
    print(json.dumps({k: report[k] for k in ("completed_tiles", "detections", "detections_inside_world")}), flush=True)
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source_directory", type=Path)
    parser.add_argument("dll", type=Path)
    parser.add_argument("destination", type=Path)
    parser.add_argument("--preset", choices=("upstream-example", "confidence-only", "shadow-shapes"), default="upstream-example")
    args = parser.parse_args()
    run(args.source_directory, args.dll, args.destination, args.preset)
