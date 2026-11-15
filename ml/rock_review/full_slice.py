"""Run ROSCO on native pixels covering the registered Gale site, without relabeling.

The frozen affine registration is an image-relative estimate. Coverage under that
transform is not a guarantee of rock detection, absolute accuracy or safe ground.
"""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image

from ml.rock_review.evaluate_rosco import cell_for_point, projected_point
from ml.rock_review.register_observation import native_to_reference
from ml.rock_review.rosco_native import (
    COMMIT,
    DLL_SHA256,
    VERSION,
    detect_tiles,
    load_library,
    parameters,
)
from ml.rock_review.single_observation import HERE, JP2_SHA256, metadata, native_window


def reference_to_native(points, model):
    return np.asarray(points) @ np.asarray(model["reference_to_native_matrix"]).T + model["reference_to_native_offset_m"]


def sample_coverage(width, height, cell_m, model, source_bounds):
    """Count cells with all four corners inside the native footprint (no center shortcut)."""
    x, y = np.meshgrid(np.arange(width)*cell_m, np.arange(height)*cell_m)
    full = np.ones((height, width), dtype=bool)
    left, top, right, bottom = source_bounds
    for dx, dy in ((0, 0), (cell_m, 0), (0, cell_m), (cell_m, cell_m)):
        points = reference_to_native(np.column_stack(((x+dx).ravel(), (y+dy).ravel())), model)
        inside = ((points[:, 0] >= left) & (points[:, 0] <= right)
                  & (points[:, 1] >= top) & (points[:, 1] <= bottom))
        full &= inside.reshape(height, width)
    return {"total_cells": width*height, "fully_covered_cells": int(full.sum()),
            "not_fully_covered_cells": int((~full).sum())}


def dump(path, value):
    path.write_text(json.dumps(value, indent=2)+"\n", encoding="utf-8", newline="\n")


def run(jp2, labels, dll, destination):
    import rasterio
    from rasterio.warp import transform, transform_bounds
    from rasterio.windows import Window, from_bounds

    if destination.exists():
        raise FileExistsError("Use a fresh output directory")
    with jp2.open("rb") as stream:
        if hashlib.file_digest(stream, "sha256").hexdigest() != JP2_SHA256:
            raise ValueError("Wrong source JP2")
    old = json.loads((HERE/"single_observation_source.json").read_bytes())
    target = json.loads((HERE/"final_site_candidates.json").read_bytes())["source"]
    registration_bytes = (HERE/"registration_metrics.json").read_bytes()
    model = json.loads(registration_bytes)["highpass_model"]
    if not model["image_alignment_check_passed"]:
        raise ValueError("Registration did not pass")
    label_bytes = [(labels/name).read_bytes() for name in ("rdr.LBL", "ortho.LBL")]
    for data, key in zip(label_bytes, ("rdr_label", "ortho_label")):
        if hashlib.sha256(data).hexdigest() != old[key]["sha256"]:
            raise ValueError("Wrong illumination label")
    left, bottom, right, top = target["world_projected_bounds"]
    width, height = target["world_width"], target["world_height"]
    corners = reference_to_native([[0, 0], [right-left, 0], [0, top-bottom], [right-left, top-bottom]], model)
    # Include the old crop as well, and 4 m beyond transformed site bounds. This
    # margin is an extraction choice, not a calibrated registration error bound.
    xmin, ymin = np.minimum(corners.min(axis=0)-4, [0, 0])
    xmax, ymax = np.maximum(corners.max(axis=0)+4, [right-left, top-bottom])
    with rasterio.open(jp2) as dataset:
        bounds = transform_bounds(target["crs_wkt"], dataset.crs,
                                  left+xmin, top-ymax, left+xmax, top-ymin)
        window = native_window(from_bounds(*bounds, dataset.transform), dataset.width, dataset.height)
        print(f"Reading registered-site window {window}", flush=True)
        pixels = dataset.read(1, window=Window(*window))
        source = metadata(pixels, dataset.crs.to_wkt(), dataset.window_transform(Window(*window)).to_gdal(),
                          window, bounds, *label_bytes)
    ox, oy = old["source_window"][0]-window[0], old["source_window"][1]-window[1]
    overlap = pixels[oy:oy+old["height"], ox:ox+old["width"]]
    if hashlib.sha256(overlap.tobytes()).hexdigest() != old["pixel_sha256"]:
        raise ValueError("Expanded extraction changed the original review pixels")
    gt = source["geotransform"]

    def footprint(meta):
        g = meta["geotransform"]
        b = transform_bounds(meta["crs_wkt"], target["crs_wkt"], g[0], g[3]-meta["height"]*g[1],
                             g[0]+meta["width"]*g[1], g[3])
        return [b[0]-left, top-b[3], b[2]-left, top-b[1]]

    old_coverage = sample_coverage(width, height, (right-left)/width, model, footprint(old))
    coverage = sample_coverage(width, height, (right-left)/width, model, footprint(source))
    if coverage["not_fully_covered_cells"]:
        raise ValueError("Expanded crop still misses part of registered site")
    destination.mkdir(parents=True)
    Image.fromarray(pixels).save(destination/"site.png")
    params = parameters(source, "confidence-only")
    _library, function = load_library(dll)
    native, tiles = detect_tiles(pixels, destination/"native_input.pgm", params, function)
    native_points = [projected_point(r["rockX"], r["rockY"], gt) for r in native]
    xs, ys = transform(source["crs_wkt"], target["crs_wkt"],
                       [p[0] for p in native_points], [p[1] for p in native_points]) if native else ([], [])
    corrected = native_to_reference(np.column_stack((np.asarray(xs)-left, top-np.asarray(ys))), model)
    records = []
    for i, (rock, point) in enumerate(zip(native, corrected), 1):
        world = [left+float(point[0]), top-float(point[1])]
        records.append(dict(rock, id=f"FS{i:03}", registered_world_projected_m=world,
                            world_cell=cell_for_point(*world, target["world_projected_bounds"], width, height),
                            model_width_m=rock["rockWidth"]*source["sampling_m_per_px"],
                            model_height_m=rock["rockHeight"]*source["sampling_m_per_px"],
                            status="unreviewed"))
    frozen_bytes = (HERE/"r3_candidates.json").read_bytes()
    frozen = json.loads(frozen_bytes)
    matches = []
    for row in records:
        for previous in frozen["annotations"]:
            if ([row["rockX"]-ox, row["rockY"]-oy] == previous["rock_point_px"]
                    and [row["shaX"]-ox, row["shaY"]-oy] == previous["shadow_centroid_px"]
                    and row["model_width_m"] == previous["model_width_m"]
                    and row["model_height_m"] == previous["model_height_m"]):
                matches.append({"full_slice_id": row["id"], "frozen_r3_id": previous["id"]})
    report = {"source": source, "source_jp2_sha256": JP2_SHA256,
              "original_review_pixels_unchanged": True,
              "frozen_r3_candidates_sha256": hashlib.sha256(frozen_bytes).hexdigest(),
              "exact_frozen_candidate_matches": matches,
              "target_projected_bounds": target["world_projected_bounds"],
              "registration_file_sha256": hashlib.sha256(registration_bytes).hexdigest(),
              "coverage_definition": "All four corners of each 8 m world cell inside native footprint under frozen affine model",
              "old_crop_registered_coverage": old_coverage, "expanded_crop_registered_coverage": coverage,
              "registration_extrapolated_at_edges": True, "extraction_margin_m": 4,
              "rosco_version": VERSION, "rosco_commit": COMMIT, "dll_sha256": DLL_SHA256,
              "preset": "confidence-only", "parameters": {k: getattr(params, k) for k, _ in params._fields_},
              "completed_tiles": len(tiles), "detections": len(records),
              "detections_inside_world": sum(r["world_cell"] is not None for r in records),
              "excluded_model_point_outside_image": sum(t["excluded_model_point_outside_image"] for t in tiles),
              "reviewed_candidates": 0, "labels_transferred": False, "world_hazard_layer_written": False,
              "precision": None, "recall": None,
              "limitations": ["Coverage is conditional on the fitted image-relative registration; edge extrapolation is not independently validated.",
                              "No detection is not a negative ground-truth label. All new proposals need review.",
                              "Dimensions are shadow-model estimates without local slope correction.",
                              "Exact frozen-proposal matches are listed by geometry and unchanged source pixels, never by candidate order; human decisions remain in r3_decisions.json."]}
    for name, obj in (("metrics.json", report), ("detections.json", records), ("tiles.json", tiles)):
        dump(destination/name, obj)
    print(json.dumps({k: report[k] for k in ("old_crop_registered_coverage", "expanded_crop_registered_coverage", "completed_tiles", "detections", "detections_inside_world")}), flush=True)
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("jp2", "labels", "dll", "destination"):
        parser.add_argument(name, type=Path)
    args = parser.parse_args()
    run(args.jp2, args.labels, args.dll, args.destination)
