"""Checked ctypes adapter for NASA/JPL ROSCO Version_20260909 (Windows x64).

Interface: nasa-jpl/ROSCO e930eb2c8e62569bd23350070a2ab676b5ef604d,
RockDetector/AH_Rocks.h and AH_RockUtils.h (upstream Apache-2.0).
The upstream implementation is downloaded separately, never vendored here.
Use the per-tile API: the batch API can report success after a tile failure.
"""
import argparse
import ctypes as ct
import hashlib
import math
import os
import zipfile
from pathlib import Path
from urllib.request import urlopen

import numpy as np
from PIL import Image

VERSION = "Version_20260909"
COMMIT = "e930eb2c8e62569bd23350070a2ab676b5ef604d"
ARCHIVE_URL = f"https://github.com/nasa-jpl/ROSCO/releases/download/{VERSION}/ROSCO_20260909.zip"
ARCHIVE_SHA256 = "86db95f362434c103a3224b53bf1bebf9a772b477a13352112a8e7053616db79"
DLL_SHA256 = "150ee77acb5e77d6a6c4a7e890017775843b7306c752ead239e81cddfe07dea0"
TILE, OVERLAP, MAX_ROCKS = 500, 50, 20000


class Parameters(ct.Structure):
    _fields_ = [(name, ct.c_float) for name in (
        "gamma", "sun_incidence_angle", "sun_azimuth_angle", "min_shadow_size", "ground_resolution",
        "confidence_threshold", "min_shadow_size_split", "spliting_ratio", "rock_elongate_ratio",
        "mean_gradient_threshold", "max_shadow_size")] + [("gamma_threshold_override", ct.c_int)]


class Rock(ct.Structure):
    _fields_ = ([(name, ct.c_int) for name in ("id", "tileR", "tileC")]
                + [(name, ct.c_float) for name in ("shaX", "shaY", "rockX", "rockY", "tileShaX", "tileShaY")]
                + [("shaArea", ct.c_int)]
                + [(name, ct.c_float) for name in ("shaLen", "rockWidth", "rockHeight", "score", "gradMean", "Compact", "Exent")]
                + [("Class", ct.c_int)]
                + [(name, ct.c_float) for name in ("gamma", "shaEllipseMajor", "shaEllipseMinor", "shaEllipseTheta")])


def parameters(meta, preset="upstream-example"):
    """Upstream test preset as a starting point, with this observation's geometry."""
    geo = meta["illumination"]
    scale, incidence, azimuth = (meta["sampling_m_per_px"], geo["incidence_deg"], geo["rosco_sun_ccw_from_right_deg"])
    if not (math.isfinite(scale) and 0 < scale < 10 and 0 < incidence < 90 and 0 <= azimuth < 360):
        raise ValueError("Invalid native scale or illumination")
    if preset not in ("upstream-example", "confidence-only", "shadow-shapes"):
        raise ValueError("Unknown ROSCO preset")
    confidence = 0 if preset == "shadow-shapes" else .7
    gradient = 20 if preset == "upstream-example" else 0
    return Parameters(1.2, incidence, azimuth, 3, scale, confidence, 100, .5, 4, gradient, 800, 0)


def install(destination):
    destination = Path(destination).resolve()
    if destination.exists():
        raise FileExistsError("Use a fresh ROSCO directory")
    destination.mkdir(parents=True)
    archive = destination/"ROSCO.zip"
    digest = hashlib.sha256()
    with urlopen(ARCHIVE_URL, timeout=60) as response, archive.open("wb") as output:
        while chunk := response.read(1024*1024):
            output.write(chunk)
            digest.update(chunk)
    if digest.hexdigest() != ARCHIVE_SHA256:
        raise ValueError("ROSCO release checksum mismatch; not extracting")
    with zipfile.ZipFile(archive) as bundle:
        for info in bundle.infolist():
            if not (destination/info.filename).resolve().is_relative_to(destination):
                raise ValueError("Unsafe archive member")
        bundle.extractall(destination)
    print(destination/"ROSCO_20260909"/"RockDetectorShared.dll")


def load_library(path):
    path = Path(path).resolve()
    if hashlib.sha256(path.read_bytes()).hexdigest() != DLL_SHA256:
        raise ValueError("Expected the pinned official ROSCO Windows DLL")
    if os.name != "nt" or ct.sizeof(ct.c_void_p) != 8:
        raise RuntimeError("This pinned native runner requires Windows x64")
    with os.add_dll_directory(str(path.parent)):
        library = ct.CDLL(str(path))
    fn = library.detect_tile_rocks
    fn.argtypes = [ct.c_char_p, ct.POINTER(ct.c_ushort), ct.POINTER(ct.c_ubyte),
                   *([ct.c_int]*6), ct.POINTER(Parameters), ct.POINTER(Rock), ct.POINTER(ct.c_int)]
    fn.restype = ct.c_int
    return library, fn


def detect_tiles(pixels, pgm, params, function):
    """Fail on any unsuccessful tile. Coordinates remain native pixel indices."""
    if pixels.dtype != np.uint8 or pixels.ndim != 2 or min(pixels.shape) < 2:
        raise ValueError("Expected a nonempty 8-bit image")
    # PGM.c reads a first data byte of '#' as a comment. Never alter a real pixel.
    if pixels.flat[0] == 35:
        raise ValueError("Upstream PGM reader cannot handle first pixel 35; use another native crop origin")
    Image.fromarray(pixels).save(pgm)
    path = str(Path(pgm).resolve())
    # The C API uses narrow file paths on Windows; reject rather than misread.
    encoded = path.encode("ascii")
    labels = np.zeros((TILE+OVERLAP)**2, dtype=np.uint16)
    subimage = np.zeros((TILE+OVERLAP)**2, dtype=np.uint8)
    rocks = (Rock*MAX_ROCKS)()
    rows, cols = pixels.shape
    nr, nc = math.ceil(rows/TILE), math.ceil(cols/TILE)
    result, completed = [], []
    for row in range(nr):
        for col in range(nc):
            count = ct.c_int()
            ok = function(encoded, labels.ctypes.data_as(ct.POINTER(ct.c_ushort)),
                          subimage.ctypes.data_as(ct.POINTER(ct.c_ubyte)),
                          row, col, rows, cols, nr, nc, ct.byref(params), rocks, ct.byref(count))
            if ok != 1 or not 0 <= count.value <= MAX_ROCKS:
                raise RuntimeError(f"ROSCO failed at tile {row},{col}; no complete result")
            outside = 0
            for rock in rocks[:count.value]:
                # The last three ABI fields are not initialized by this release.
                record = {name: getattr(rock, name) for name, _ in Rock._fields_[:-3]}
                if any(not math.isfinite(value) for value in record.values()):
                    raise ValueError("Non-finite native detection")
                if not (0 <= record["rockX"] < cols and 0 <= record["rockY"] < rows):
                    # A border shadow's modeled sunward edge can lie off-image.
                    # Count and exclude it; never clamp it into a world cell.
                    outside += 1
                    continue
                result.append(record)
            completed.append({"row": row, "col": col, "native_detections": count.value,
                              "excluded_model_point_outside_image": outside})
        print(f"ROSCO tile row {row+1}/{nr}, candidates {len(result)}", flush=True)
    result.sort(key=lambda rock: (rock["rockY"], rock["rockX"], rock["tileR"], rock["tileC"], rock["id"]))
    return result, completed


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Download and verify the pinned official ROSCO release")
    parser.add_argument("destination", type=Path)
    install(parser.parse_args().destination)
