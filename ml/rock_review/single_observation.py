"""Fetch one orthorectified HiRISE observation covering the reviewed Gale site.

NASA/JPL-Caltech/University of Arizona ESP_019698_1750, 2010-10-09.
Native samples are preserved. This is a different acquisition from the reviewed
USGS color mosaic: geographic correspondence does not transfer visual labels.
"""
import argparse
import hashlib
import json
import math
import re
from pathlib import Path
from urllib.request import urlopen

import numpy as np
from PIL import Image

HERE = Path(__file__).parent
OBSERVATION = "ESP_019698_1750"
PDS = "https://hirise-pds.lpl.arizona.edu/PDS"
ORTHO_BASE = f"{PDS}/DTM/ESP/ORB_019600_019699/{OBSERVATION}_ESP_019988_1750/{OBSERVATION}_RED_A_01_ORTHO"
IMAGE_URL = ORTHO_BASE + ".JP2"
JP2_SHA256 = "8fe50227c8c24ec2c0578c2d6d2dd7801da07e0f0acc4b33d80ef14189763047"
ORTHO_LABEL_URL = ORTHO_BASE + ".LBL"
RDR_LABEL_URL = f"{PDS}/RDR/ESP/ORB_019600_019699/{OBSERVATION}/{OBSERVATION}_RED.LBL"


def field(label, name):
    matches = re.findall(r"^\s*" + re.escape(name) + r"\s*=\s*(.*?)\s*$", label, re.MULTILINE)
    if len(matches) != 1:
        raise ValueError(f"Expected one {name} in label")
    return matches[0].strip('"')


def number(label, name):
    value = float(field(label, name).split()[0])
    if not math.isfinite(value):
        raise ValueError(f"Non-finite {name}")
    return value


def illumination(rdr_label, ortho_label):
    """PDS CW-from-right -> ROSCO CCW-from-right, accounting for orientation.

    Conventions: HiRISE RDR Products dictionary SUB_SOLAR_AZIMUTH/NORTH_AZIMUTH;
    ROSCO e930eb2 RockDetector/AH_Rocks.h and MeasureShadowsLengthandWidth.
    These are observation-level angles, not local slope-corrected illumination.
    """
    if field(rdr_label, "PRODUCT_ID") != OBSERVATION + "_RED":
        raise ValueError("Wrong illumination observation")
    if field(ortho_label, "PRODUCT_ID") != OBSERVATION + "_RED_A_01_ORTHO":
        raise ValueError("Wrong orthophoto product")
    source = re.search(r"SOURCE_PRODUCT_ID\s*=\s*\((.*?)\)", ortho_label, re.DOTALL)
    if source is None or source.group(1).split(',')[0].strip().strip('"') != OBSERVATION:
        raise ValueError("Orthophoto does not identify this source observation")
    incidence = number(rdr_label, "INCIDENCE_ANGLE")
    sun = number(rdr_label, "SUB_SOLAR_AZIMUTH")
    north = number(rdr_label, "NORTH_AZIMUTH")
    ortho_north = number(ortho_label, "NORTH_AZIMUTH")
    if not 0 < incidence < 90 or any(not 0 <= a <= 360 for a in (sun, north, ortho_north)):
        raise ValueError("Invalid illumination angles")
    if abs(ortho_north - 270) > 1e-4 or number(ortho_label, "MAP_PROJECTION_ROTATION") != 0:
        raise ValueError("Expected a north-up orthophoto")
    sun_cw = (sun - north + ortho_north) % 360
    return {"incidence_deg": incidence, "rdr_sun_cw_from_right_deg": sun,
            "rdr_north_cw_from_right_deg": north, "ortho_north_cw_from_right_deg": ortho_north,
            "ortho_sun_cw_from_right_deg": sun_cw,
            "rosco_sun_ccw_from_right_deg": (-sun_cw) % 360,
            "shadow_cw_from_right_deg": (sun_cw + 180) % 360,
            "acquisition_start": field(rdr_label, "START_TIME"),
            "scope": "Observation-level geometry; no local slope correction"}


def native_window(box, width, height):
    """Round outward so every part of the site is included, without resampling."""
    left, top = math.floor(box.col_off), math.floor(box.row_off)
    right, bottom = math.ceil(box.col_off + box.width), math.ceil(box.row_off + box.height)
    if not (0 <= left < right <= width and 0 <= top < bottom <= height):
        raise ValueError("Observation does not cover the entire site")
    return left, top, right-left, bottom-top


def metadata(pixels, crs_wkt, transform, window, bounds, rdr_bytes, ortho_bytes):
    geometry = illumination(rdr_bytes.decode("ascii"), ortho_bytes.decode("ascii"))
    scale = number(ortho_bytes.decode("ascii"), "MAP_SCALE")
    if number(ortho_bytes.decode("ascii"), "CORE_NULL") != 0:
        raise ValueError("Unexpected native null value")
    if pixels.dtype != np.uint8 or pixels.ndim != 2 or min(pixels.shape) < 1:
        raise ValueError("Expected nonempty 8-bit grayscale pixels")
    if len(transform) != 6 or not all(math.isfinite(v) for v in transform):
        raise ValueError("Invalid raster transform")
    if any(abs(transform[i]-v) > 1e-8 for i, v in ((1, scale), (2, 0), (4, 0), (5, -scale))):
        raise ValueError("Raster transform differs from the native label scale")
    # The PDS product uses 0 for null; never silently analyze a blank wedge.
    if np.any(pixels == 0):
        raise ValueError("Crop contains zero/null pixels; a validity mask is required")
    return {"observation": OBSERVATION, "source_url": IMAGE_URL,
            "credit": "NASA/JPL-Caltech/University of Arizona",
            "source_window": list(window), "width": pixels.shape[1], "height": pixels.shape[0],
            "crs_wkt": crs_wkt, "geotransform": list(transform),
            "site_bounds_in_source_crs": list(bounds), "sampling_m_per_px": scale,
            "pixel_sha256": hashlib.sha256(pixels.tobytes()).hexdigest(),
            "illumination": geometry,
            "rdr_label": {"url": RDR_LABEL_URL, "sha256": hashlib.sha256(rdr_bytes).hexdigest()},
            "ortho_label": {"url": ORTHO_LABEL_URL, "sha256": hashlib.sha256(ortho_bytes).hexdigest()},
            "processing": "Native grayscale window, no resampling, sharpening or contrast adjustment",
            "labels_transferred": False, "world_hazard_layer_written": False}


def fetch(destination, jp2=None):
    # Optional GDAL dependency: normal CI and native binding tests need no GDAL.
    import rasterio
    from rasterio.warp import transform_bounds
    from rasterio.windows import Window, from_bounds

    destination = Path(destination)
    if destination.exists():
        raise FileExistsError("Use a fresh source directory")
    if jp2:
        with Path(jp2).open("rb") as stream:
            if hashlib.file_digest(stream, "sha256").hexdigest() != JP2_SHA256:
                raise ValueError("Local JP2 differs from the pinned official product")
    labels = []
    for url in (RDR_LABEL_URL, ORTHO_LABEL_URL):
        with urlopen(url, timeout=60) as response:
            labels.append(response.read())
    illumination(*(value.decode("ascii") for value in labels))
    reference = json.loads((HERE/"final_site_candidates.json").read_text(encoding="utf-8"))["source"]
    with (rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".JP2",
                       GDAL_HTTP_TIMEOUT="45"),
          rasterio.open(str(jp2) if jp2 else "/vsicurl/" + IMAGE_URL) as dataset):
        if dataset.count != 1 or dataset.dtypes != ("uint8",):
            raise ValueError("Expected one 8-bit HiRISE RED band")
        bounds = transform_bounds(reference["crs_wkt"], dataset.crs, *reference["world_projected_bounds"])
        window = native_window(from_bounds(*bounds, dataset.transform), dataset.width, dataset.height)
        print(f"Reading native HiRISE window {window}", flush=True)
        pixels = dataset.read(1, window=Window(*window))
        result = metadata(pixels, dataset.crs.to_wkt(), dataset.window_transform(Window(*window)).to_gdal(),
                          window, bounds, *labels)
    pinned = HERE/"single_observation_source.json"
    if pinned.exists() and json.loads(pinned.read_text(encoding="utf-8")) != result:
        raise ValueError("Extraction differs from the frozen source artifact")
    destination.mkdir(parents=True)
    Image.fromarray(pixels).save(destination/"site.png")
    for name, data in zip(("rdr.LBL", "ortho.LBL"), labels):
        (destination/name).write_bytes(data)
    (destination/"source.json").write_text(json.dumps(result, indent=2)+"\n", encoding="utf-8", newline="\n")
    print(json.dumps({k: result[k] for k in ("observation", "width", "height", "pixel_sha256")}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("destination", type=Path)
    parser.add_argument("--jp2", type=Path, help="Local copy of the exact product if remote JP2 range decoding fails")
    args = parser.parse_args()
    fetch(args.destination, args.jp2)
