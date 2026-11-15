"""Measure image registration and place ROSCO candidates in the mosaic's frame.

Alignment is measured on image texture, not tuned to the G or H rock judgments.
This produces candidate-count diagnostics, never a navigation hazard mask.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

from ml.rock_review.evaluate_final_site import resolved_references
from ml.rock_review.evaluate_rosco import cell_for_point, projected_point
from ml.rock_review.shadow_baseline import match_reference
from ml.rock_review.single_observation import HERE


def measure_controls(reference, moving, mode="highpass"):
    """49 disjoint 256 m patches on the fixed 1 m diagnostic grid."""
    if reference.shape != (2048, 2048) or moving.shape != reference.shape:
        raise ValueError("Registration expects the fixed 2048-square 1 m grid")
    if mode == "highpass":
        a, b = [image-cv2.GaussianBlur(image, (0, 0), 3) for image in (reference, moving)]
    elif mode == "gradient":
        a, b = [cv2.GaussianBlur(image, (0, 0), 1) for image in (reference, moving)]
        a, b = [cv2.magnitude(cv2.Sobel(image, cv2.CV_32F, 1, 0), cv2.Sobel(image, cv2.CV_32F, 0, 1)) for image in (a, b)]
    else:
        raise ValueError("Unsupported registration signal")
    controls = []
    for row, y in enumerate(range(128, 1792, 256)):
        for col, x in enumerate(range(128, 1792, 256)):
            shift, response = cv2.phaseCorrelate(a[y:y+256, x:x+256].copy(), b[y:y+256, x:x+256].copy(),
                                                cv2.createHanningWindow((256, 256), cv2.CV_32F))
            controls.append({"reference_center_m": [x+128, y+128], "native_minus_reference_m": list(shift),
                             "response": response, "split": "fit" if row % 2 == col % 2 else "validation"})
    return controls


def fit_registration(controls):
    """Fit one affine transform on the checkerboard fit patches only."""
    usable = [r for r in controls if math.isfinite(r["response"]) and r["response"] >= .2
              and all(math.isfinite(v) and abs(v) < 96 for v in r["native_minus_reference_m"])]
    train = [r for r in usable if r["split"] == "fit"]
    validation = [r for r in usable if r["split"] == "validation"]
    if len(train) < 12 or len(validation) < 12:
        raise ValueError("Insufficient independent texture controls")
    design = np.asarray([[*r["reference_center_m"], 1] for r in train])
    shifts = np.asarray([r["native_minus_reference_m"] for r in train])
    coefficients, _, rank, _ = np.linalg.lstsq(design, shifts, rcond=None)
    if rank != 3:
        raise ValueError("Degenerate registration controls")
    matrix = np.eye(2) + coefficients[:2].T
    if not .9 < np.linalg.det(matrix) < 1.1:
        raise ValueError("Implausible affine scale/orientation")
    errors = []
    for row in validation:
        predicted = np.asarray([*row["reference_center_m"], 1]) @ coefficients
        errors.append(float(np.linalg.norm(predicted-row["native_minus_reference_m"])))
    p50, p95, maximum = np.percentile(errors, [50, 95, 100]).tolist()
    return {"reference_to_native_matrix": matrix.tolist(), "reference_to_native_offset_m": coefficients[2].tolist(),
            "fit_controls": len(train), "validation_controls": len(validation), "excluded_controls": len(controls)-len(usable),
            "validation_residual_m": {"median": p50, "p95": p95, "max": maximum},
            "image_alignment_check_passed": p95 <= 2 and maximum <= 4,
            "control_extent_m": [256, 256, 1792, 1792],
            "meaning": "Patch displacement residuals, not absolute Mars accuracy or individual rock localization error"}


def native_to_reference(points, model):
    """Invert q = M p + b; do not subtract a spatially varying offset at q."""
    matrix = np.asarray(model["reference_to_native_matrix"])
    offset = np.asarray(model["reference_to_native_offset_m"])
    return np.linalg.solve(matrix, (np.asarray(points)-offset).T).T


def placement(point, bounds, model):
    left, _bottom, _right, top = bounds
    x, y = map(float, point)
    cell = cell_for_point(left+x, top-y, bounds, 256, 256)
    if cell is None:
        return {"world_cell": None, "extrapolated": True, "near_cell_boundary": True}
    x0, y0, x1, y1 = model["control_extent_m"]
    margin = min(x % 8, 8-x % 8, y % 8, 8-y % 8)
    return {"world_cell": cell, "extrapolated": not (x0 <= x <= x1 and y0 <= y <= y1),
            "near_cell_boundary": margin <= model["validation_residual_m"]["max"],
            "boundary_distance_m": margin}


def verified_image(path, meta, mode, hash_key):
    with Image.open(path) as source:
        image = source.convert(mode)
    if image.size != (meta["width"], meta["height"]) or hashlib.sha256(image.tobytes()).hexdigest() != meta[hash_key]:
        raise ValueError("Source image does not match frozen pixels")
    return image


def run(native_source, mosaic_source, native_run, destination):
    from rasterio.transform import Affine
    from rasterio.warp import Resampling, reproject
    from rasterio.warp import transform as transform_points

    native_source, native_run, destination = Path(native_source), Path(native_run), Path(destination)
    if destination.exists():
        raise FileExistsError("Use a fresh registration directory")
    source = json.loads((HERE/"single_observation_source.json").read_text(encoding="utf-8"))
    candidate_bytes = (HERE/"final_site_candidates.json").read_bytes()
    candidates = json.loads(candidate_bytes)
    target = candidates["source"]
    review = json.loads((HERE/"final_site_review.json").read_text(encoding="utf-8"))
    if hashlib.sha256(candidate_bytes).hexdigest() != review["candidate_file_sha256"]:
        raise ValueError("Wrong G proposal artifact")
    refs, counts = resolved_references(candidates, review)
    native = verified_image(native_source/"site.png", source, "L", "pixel_sha256")
    mosaic = verified_image(mosaic_source, target, "RGB", "source_rgb_pixel_sha256")
    left, _bottom, _right, top = target["world_projected_bounds"]
    moving = np.zeros((2048, 2048), np.float32)
    reproject(np.asarray(native), moving, src_transform=Affine.from_gdal(*source["geotransform"]), src_crs=source["crs_wkt"],
              dst_transform=Affine(1, 0, left, 0, -1, top), dst_crs=target["crs_wkt"], resampling=Resampling.average)
    reference = cv2.resize(np.asarray(mosaic.convert("L")), (2048, 2048), interpolation=cv2.INTER_AREA).astype(np.float32)
    controls = measure_controls(reference, moving)
    model = fit_registration(controls)
    crosscheck_controls = measure_controls(reference, moving, "gradient")
    crosscheck = fit_registration(crosscheck_controls)
    if not model["image_alignment_check_passed"] or not crosscheck["image_alignment_check_passed"]:
        raise ValueError("Image alignment validation failed; do not place candidates")
    # The second signal is an agreement diagnostic, not another independent scene.
    corners = np.asarray([[256, 256], [256, 1792], [1792, 256], [1792, 1792]])
    crosscheck_difference = np.linalg.norm(native_to_reference(corners, model)-native_to_reference(corners, crosscheck), axis=1)
    if crosscheck_difference.max() > 1:
        raise ValueError("Texture signals disagree on image registration")
    run_meta = json.loads((native_run/"metrics.json").read_text(encoding="utf-8"))
    expected_run = json.loads((HERE/"rosco_confidence_metrics.json").read_text(encoding="utf-8"))
    if run_meta != expected_run:
        raise ValueError("Expected the verified confidence-only run")
    raw_bytes = (native_run/"detections.json").read_bytes()
    raw = json.loads(raw_bytes)
    if len(raw) != run_meta["detections"] or len({r["candidate_id"] for r in raw}) != len(raw) or not raw:
        raise ValueError("Incomplete candidate run")
    points = [projected_point(r["rockX"], r["rockY"], source["geotransform"]) for r in raw]
    eastings, northings = transform_points(source["crs_wkt"], target["crs_wkt"], [p[0] for p in points], [p[1] for p in points])
    nominal = np.column_stack((eastings, northings))
    if not np.allclose(nominal, [r["world_projected_m"] for r in raw], atol=1e-6, rtol=0):
        raise ValueError("Native pixel and nominal world coordinates disagree")
    h_candidates_bytes = (HERE/"rosco_confidence_review.json").read_bytes()
    h_candidates = json.loads(h_candidates_bytes)
    h_review = json.loads((HERE/"rosco_confidence_decisions.json").read_text(encoding="utf-8"))
    if hashlib.sha256(h_candidates_bytes).hexdigest() != h_review["candidate_file_sha256"]:
        raise ValueError("Wrong H proposal artifact")
    h_resolved, h_counts = resolved_references(h_candidates, h_review)
    h_by_detection = {r["detection_id"]: r for r in h_candidates["annotations"]}
    h_decisions = {r["detection_id"]: r["decision"] for r in h_resolved}
    corrected = native_to_reference(np.column_stack((nominal[:, 0]-left, top-nominal[:, 1])), model)
    records, matches_input = [], []
    grid = np.zeros((256, 256), np.uint16)
    for rock, point in zip(raw, corrected):
        identity = rock["candidate_id"]
        if identity in h_by_detection:
            frozen = h_by_detection[identity]
            if [rock["rockX"], rock["rockY"]] != frozen["rock_point_px"]:
                raise ValueError("Reviewed H point differs from native detection")
        row = {"candidate_id": identity, "native_pixel": [rock["rockX"], rock["rockY"]],
               "nominal_world_projected_m": rock["world_projected_m"],
               "registered_world_projected_m": [left+point[0], top-point[1]],
               "visual_status": h_decisions.get(identity, "uncertain" if identity in h_by_detection else "unreviewed"),
               **placement(point, target["world_projected_bounds"], model)}
        records.append(row)
        if row["world_cell"] is not None:
            x, y = row["world_cell"]
            grid[y, x] += 1
        matches_input.append({"id": identity, "bright": {"center": [point[0]*4-.5, point[1]*4-.5]}})
    matches = match_reference(refs, matches_input, 8)
    decisions = {r["id"]: r["decision"] for r in refs}
    for match in matches:
        match["review_decision_on_mosaic"] = decisions[match["reference_id"]]
    grid_bytes = grid.astype("<u2").tobytes()
    report = {"method": "Affine texture registration, fit on 25 checkerboard patches, checked on 24 other patches",
              "native_pixel_sha256": source["pixel_sha256"], "mosaic_rgb_pixel_sha256": target["source_rgb_pixel_sha256"],
              "native_detection_file_sha256": hashlib.sha256(raw_bytes).hexdigest(),
              "parameters": {"diagnostic_grid_m_per_px": 1, "patch_px": 256, "phase_response_min": .2,
                             "highpass_sigma_px": 3, "validation_p95_limit_m": 2, "validation_max_limit_m": 4},
              "highpass_model": model, "gradient_crosscheck_model": crosscheck,
              "max_signal_transform_difference_m": float(crosscheck_difference.max()),
              "controls": controls, "gradient_controls": crosscheck_controls,
              "candidates": len(records), "inside_world": int(grid.sum()),
              "extrapolated_candidates": sum(r["extrapolated"] for r in records),
              "near_cell_boundary_candidates": sum(r["near_cell_boundary"] for r in records),
              "candidate_grid": {"file": "candidate_counts.u16", "width": 256, "height": 256,
                                 "dtype": "uint16 little-endian", "row_order": "north-to-south, row-major",
                                 "cell_size_m": 8, "bytes": len(grid_bytes),
                                 "sha256": hashlib.sha256(grid_bytes).hexdigest(),
                                 "meaning": "Count of candidate points; not a binary hazard or safe-ground classification"},
              "g_review_counts": counts, "h_review_counts": h_counts, "g_proximity_matches_after_registration": matches,
              "precision": None, "recall": None, "world_hazard_layer_written": False,
              "limitations": ["Image-relative alignment, not absolute geodetic accuracy.",
                              "Validation measures 256 m texture-patch displacement, not individual rock outlines or localization accuracy.",
                              "Grid counts include unreviewed and uncertain candidates; zero means no candidate, not safe ground.",
                              "Boundary/extrapolation flags are diagnostic warnings, not calibrated uncertainty bounds.",
                              "G judgments are not transferred across acquisitions, including after registration."]}
    destination.mkdir(parents=True)
    for name, obj in (("metrics.json", report), ("registered_candidates.json", records)):
        (destination/name).write_text(json.dumps(obj, indent=2)+"\n", encoding="utf-8", newline="\n")
    (destination/"candidate_counts.u16").write_bytes(grid_bytes)
    print(json.dumps({"candidates": len(records), "held_out_patch_residual_m": model["validation_residual_m"],
                      "extrapolated": report["extrapolated_candidates"], "near_cell_boundary": report["near_cell_boundary_candidates"],
                      "g_proximity_matches": matches}), flush=True)
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("native_source", type=Path)
    parser.add_argument("mosaic_source", type=Path)
    parser.add_argument("native_run", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    run(args.native_source, args.mosaic_source, args.native_run, args.destination)
