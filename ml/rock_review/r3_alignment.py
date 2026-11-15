"""Check texture alignment around each frozen R3 point, including edge points.

This is a local image check, not a measurement of a rock's outline or absolute
position. It does not refit the transform or transfer labels between images.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path

import cv2
import numpy as np

from ml.rock_review.register_observation import verified_image
from ml.rock_review.single_observation import HERE


def local_checks(reference, moving, candidates, model, bounds):
    matrix = np.column_stack((model["reference_to_native_matrix"], model["reference_to_native_offset_m"]))
    aligned = cv2.warpAffine(moving, matrix, (2048, 2048),
                             flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP)
    # Warp a support mask too: border fill must never become registration evidence.
    support = cv2.warpAffine(np.ones_like(moving), matrix, (2048, 2048),
                             flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP)
    signals = []
    for mode in ("highpass", "gradient"):
        if mode == "highpass":
            pair = [v-cv2.GaussianBlur(v, (0, 0), 3) for v in (reference, aligned)]
        else:
            pair = [cv2.GaussianBlur(v, (0, 0), 1) for v in (reference, aligned)]
            pair = [cv2.magnitude(cv2.Sobel(v, cv2.CV_32F, 1, 0), cv2.Sobel(v, cv2.CV_32F, 0, 1)) for v in pair]
        signals.append((mode, pair))
    rows = []
    for candidate in candidates:
        east, north = candidate["registered"]["registered_world_projected_m"]
        x, y = east-bounds[0], bounds[3]-north
        left, top = max(0, min(1792, round(x)-128)), max(0, min(1792, round(y)-128))
        samples = {}
        # Ignore pixels without real data, with 8 m extra room for filtering.
        real = (support[top:top+256, left:left+256] > .999).astype(np.uint8)
        real = cv2.erode(real, np.ones((17, 17), np.uint8))
        window = cv2.createHanningWindow((256, 256), cv2.CV_32F)*real
        for mode, (a, b) in signals:
            shift, response = cv2.phaseCorrelate(a[top:top+256, left:left+256].copy(),
                                                b[top:top+256, left:left+256].copy(), window.copy())
            residual = math.hypot(*shift)
            samples[mode] = {"shift_m": list(shift), "response": response, "residual_m": residual}
        valid_fraction = float(real.mean())
        passed = valid_fraction >= .75 and all(
            math.isfinite(v["residual_m"]) and v["residual_m"] <= 4 and v["response"] >= .2
            for v in samples.values())
        rows.append({"id": candidate["id"], "reference_patch_m": [left, top, 256, 256],
                     "valid_fraction": valid_fraction, "signals": samples, "passed": passed})
    return rows


def run(native_source, mosaic_source, output):
    from rasterio.transform import Affine
    from rasterio.warp import Resampling, reproject

    native_meta = json.loads((HERE/"single_observation_source.json").read_bytes())
    target = json.loads((HERE/"final_site_candidates.json").read_bytes())["source"]
    candidates_bytes = (HERE/"r3_candidates.json").read_bytes()
    registration_bytes = (HERE/"registration_metrics.json").read_bytes()
    candidates, registration = json.loads(candidates_bytes), json.loads(registration_bytes)
    if candidates["registration_file_sha256"] != hashlib.sha256(registration_bytes).hexdigest():
        raise ValueError("Registration artifact changed")
    native = verified_image(Path(native_source)/"site.png", native_meta, "L", "pixel_sha256")
    mosaic = verified_image(mosaic_source, target, "RGB", "source_rgb_pixel_sha256")
    left, _, _, top = target["world_projected_bounds"]
    moving = np.zeros((2048, 2048), np.float32)
    reproject(np.asarray(native), moving, src_transform=Affine.from_gdal(*native_meta["geotransform"]),
              src_crs=native_meta["crs_wkt"], dst_transform=Affine(1, 0, left, 0, -1, top),
              dst_crs=target["crs_wkt"], resampling=Resampling.average)
    reference = cv2.resize(np.asarray(mosaic.convert("L")), (2048, 2048), interpolation=cv2.INTER_AREA).astype(np.float32)
    rows = local_checks(reference, moving, candidates["annotations"], registration["highpass_model"],
                        target["world_projected_bounds"])
    report = {"candidate_file_sha256": hashlib.sha256(candidates_bytes).hexdigest(),
              "registration_file_sha256": hashlib.sha256(registration_bytes).hexdigest(),
              "parameters": {"patch_m": 256, "max_residual_m": 4, "min_response": .2, "min_valid_fraction": .75},
              "meaning": "Local texture checks; no refit, no absolute or individual rock localization guarantee",
              "checks": rows}
    Path(output).write_text(json.dumps(report, indent=2)+"\n", encoding="utf-8", newline="\n")
    print(json.dumps({"passed": sum(r["passed"] for r in rows), "total": len(rows),
                      "failed_ids": [r["id"] for r in rows if not r["passed"]]}))


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("native_source", type=Path)
    p.add_argument("mosaic_source", type=Path)
    p.add_argument("output", type=Path)
    a = p.parse_args()
    run(a.native_source, a.mosaic_source, a.output)
