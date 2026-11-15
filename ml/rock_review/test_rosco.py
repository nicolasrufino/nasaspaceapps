import ctypes as ct
import hashlib
import json
import math
from types import SimpleNamespace

import numpy as np
import pytest

from ml.rock_review.evaluate_final_site import resolved_references
from ml.rock_review.evaluate_rosco import cell_for_point, projected_point
from ml.rock_review.rosco_native import Parameters, detect_tiles, load_library
from ml.rock_review.single_observation import (
    HERE,
    illumination,
    metadata,
    native_window,
)

RDR = '''PRODUCT_ID = "ESP_019698_1750_RED"
INCIDENCE_ANGLE = 57.493071 <DEG>
SUB_SOLAR_AZIMUTH = 192.527174 <DEG>
NORTH_AZIMUTH = 270 <DEG>
START_TIME = 2010-10-09T09:11:38.350
'''
ORTHO = '''PRODUCT_ID = "ESP_019698_1750_RED_A_01_ORTHO"
SOURCE_PRODUCT_ID = (ESP_019698_1750, DTEEC_019698_1750_019988_1750_U01)
MAP_SCALE = 0.2529366986449 <METERS/PIXEL>
NORTH_AZIMUTH = 270 <DEG>
MAP_PROJECTION_ROTATION = 0 <DEG>
CORE_NULL = 0
'''


def test_pds_to_rosco_direction_points_away_from_sun_in_image_coordinates():
    result = illumination(RDR, ORTHO)
    assert result["rosco_sun_ccw_from_right_deg"] == pytest.approx(167.472826)
    # ROSCO uses (cos(angle), -sin(angle)) with 180 degrees added for shadows.
    angle = math.radians(result["rosco_sun_ccw_from_right_deg"] + 180)
    pds = math.radians(192.527174)
    assert (math.cos(angle), -math.sin(angle)) == pytest.approx((-math.cos(pds), -math.sin(pds)))
    # A differently oriented source RDR must first be rotated into the ortho frame.
    rotated = illumination(RDR.replace("270 <DEG>", "260 <DEG>"), ORTHO)
    assert rotated["ortho_sun_cw_from_right_deg"] == pytest.approx(202.527174)


@pytest.mark.parametrize("rdr,ortho", [
    (RDR.replace("57.493071", "0"), ORTHO),
    (RDR.replace("57.493071", "nan"), ORTHO),
    (RDR.replace("ESP_019698", "ESP_019988"), ORTHO),
    (RDR, ORTHO.replace("(ESP_019698_1750,", "(WRONG_ESP_019698_1750,")),
    (RDR, ORTHO.replace("ROTATION = 0", "ROTATION = 10")),
])
def test_geometry_rejects_wrong_observation_or_invalid_angles(rdr, ortho):
    with pytest.raises(ValueError):
        illumination(rdr, ortho)


def test_native_window_covers_fractional_extent_and_rejects_partial_coverage():
    box = SimpleNamespace(col_off=4.1, row_off=8.9, width=5.2, height=3.4)
    assert native_window(box, 20, 20) == (4, 8, 6, 5)
    with pytest.raises(ValueError, match="entire site"):
        native_window(box, 9, 20)


def test_pixel_centers_and_north_first_world_edges():
    assert projected_point(0, 0, [100, .25, 0, 200, 0, -.25]) == [100.125, 199.875]
    bounds = [100, 100, 116, 116]
    assert cell_for_point(100, 116, bounds, 2, 2) == [0, 0]
    assert cell_for_point(108, 108, bounds, 2, 2) == [1, 1]
    assert cell_for_point(116, 116, bounds, 2, 2) is None
    assert cell_for_point(100, 100, bounds, 2, 2) is None


def test_metadata_rejects_resampled_or_null_image():
    pixels = np.full((4, 4), 100, np.uint8)
    args = ("crs", [0, .25, 0, 0, 0, -.25], (0, 0, 4, 4), [0, -1, 1, 0], RDR.encode(), ORTHO.encode())
    with pytest.raises(ValueError, match="native label scale"):
        metadata(pixels, *args)
    scale = .2529366986449
    args = ("crs", [0, scale, 0, 0, 0, -scale], *args[2:])
    pixels[0, 0] = 0
    with pytest.raises(ValueError, match="null"):
        metadata(pixels, *args)


def test_one_failed_native_tile_invalidates_whole_run(tmp_path):
    calls = []

    def native(_path, _labels, _subimage, row, col, _rows, _cols, nr, nc, _params, _rocks, count):
        calls.append((row, col, nr, nc))
        ct.cast(count, ct.POINTER(ct.c_int))[0] = 0
        return 0 if col == 1 else 1

    with pytest.raises(RuntimeError, match="0,1"):
        detect_tiles(np.full((501, 1001), 100, np.uint8), tmp_path/"in.pgm", Parameters(), native)
    assert calls == [(0, 0, 2, 3), (0, 1, 2, 3)]


def test_pgm_comment_pixel_and_unpinned_library_are_rejected(tmp_path):
    with pytest.raises(ValueError, match="first pixel 35"):
        detect_tiles(np.full((4, 4), 35, np.uint8), tmp_path/"in.pgm", Parameters(), None)
    assert not (tmp_path/"in.pgm").exists()
    library = tmp_path/"wrong.dll"
    library.write_bytes(b"not the verified release")
    with pytest.raises(ValueError, match="pinned official"):
        load_library(library)


def test_model_point_off_image_is_counted_and_never_clamped(tmp_path):
    def native(_path, _labels, _subimage, _row, _col, _rows, _cols, _nr, _nc, _params, rocks, count):
        ct.cast(count, ct.POINTER(ct.c_int))[0] = 2
        rocks[0].rockX, rocks[0].rockY = -3.3, 1
        rocks[1].rockX, rocks[1].rockY = 2, 1
        return 1

    records, tiles = detect_tiles(np.full((4, 4), 100, np.uint8), tmp_path/"in.pgm", Parameters(), native)
    assert len(records) == 1
    assert records[0]["rockX"] == 2
    assert tiles == [{"row": 0, "col": 0, "native_detections": 2, "excluded_model_point_outside_image": 1}]


def test_frozen_review_links_exact_artifacts_and_keeps_uncertainty():
    artifact = (HERE/"rosco_confidence_review.json").read_bytes()
    candidates = json.loads(artifact)
    decisions = json.loads((HERE/"rosco_confidence_decisions.json").read_text(encoding="utf-8"))
    source = json.loads((HERE/"single_observation_source.json").read_text(encoding="utf-8"))
    assert hashlib.sha256(artifact).hexdigest() == decisions["candidate_file_sha256"]
    assert candidates["source_pixel_sha256"] == decisions["source_pixel_sha256"] == source["pixel_sha256"]
    assert candidates["sheet_sha256"] == decisions["sheet_sha256"]
    resolved, counts = resolved_references(candidates, decisions)
    assert counts == {"accepted": 5, "uncertain": 1}
    assert {r["id"] for r in resolved} == {"H01", "H03", "H04", "H05", "H06"}
