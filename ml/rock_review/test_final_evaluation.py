import math

import numpy as np
import pytest
from PIL import Image

from ml.rock_review.evaluate_final_site import resolved_references, run
from ml.rock_review.shadow_baseline import PARAMETERS, pairing_edges


def test_spatial_buckets_preserve_exhaustive_pairing_including_radius_boundaries():
    rng = np.random.default_rng(2026)
    points = rng.uniform(-40, 40, (100, 2)).tolist()
    bright = [{"center": p} for p in [[0, 0], [13.9, 13.9], *points]]
    dark = [{"center": p} for p in [[0, 0], [0.99, 0], [1, 0], [14, 0], [14.01, 0], [14.1, 14.1], *points[::-1]]]
    radius = PARAMETERS["max_pair_distance_px"]
    expected = sorted((math.dist(b["center"], d["center"]), bi, di)
                      for bi, b in enumerate(bright) for di, d in enumerate(dark)
                      if 1 <= math.dist(b["center"], d["center"]) <= radius)
    assert sorted(pairing_edges(bright, dark)) == expected
    assert list(pairing_edges(bright, [])) == []


def test_uncertain_references_are_excluded_and_bad_review_coverage_is_rejected():
    candidates = {"annotations": [{"id": key} for key in ("G01", "G02", "G03")]}
    decisions = [{"id": key, "status": status} for key, status in
                 zip(("G01", "G02", "G03"), ("accepted", "rejected", "uncertain"))]
    review = {"reviews": [{"decisions": decisions}]}
    rows, counts = resolved_references(candidates, review)
    assert [r["id"] for r in rows] == ["G01", "G02"]
    assert counts == {"accepted": 1, "rejected": 1, "uncertain": 1}
    for invalid in (decisions[:-1], decisions+[decisions[0]],
                    decisions+[{"id": "G99", "status": "accepted"}]):
        with pytest.raises(ValueError):
            resolved_references(candidates, {"reviews": [{"decisions": invalid}]})


def test_evaluation_rejects_wrong_source_and_preserves_existing_output(tmp_path):
    source = tmp_path/"wrong-source.png"
    Image.new("RGB", (4, 4)).save(source)
    with pytest.raises(ValueError, match="Wrong source image dimensions"):
        run(source, tmp_path/"new-output")
    assert not (tmp_path/"new-output").exists()
    with pytest.raises(FileExistsError):
        run(source, tmp_path)
