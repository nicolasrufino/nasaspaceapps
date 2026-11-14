import numpy as np
import pytest

from ml.rock_review.shadow_baseline import detect, match_reference, run


def test_pair_requires_bright_and_dark_components_and_no_reuse():
    flat = np.full((80, 80), 128, np.uint8)
    assert detect(flat) == []
    flat[30:34, 30:34] = 220
    assert detect(flat) == []
    flat[30:34, 38:42] = 30
    pairs = detect(flat)
    assert len(pairs) == 1
    assert pairs[0]["bright"]["center"] == [31.5, 31.5]
    assert pairs[0]["dark"]["center"] == [39.5, 31.5]


def test_matching_finds_one_to_one_correspondence_without_double_counting():
    refs = [{"id": 1, "x": 0, "y": 0}, {"id": 2, "x": 2, "y": 0}]
    detections = [{"id": "A", "bright": {"center": [1, 0]}},
                  {"id": "B", "bright": {"center": [-2, 0]}}]
    matches = match_reference(refs, detections, 2)
    assert len(matches) == 2  # greedy matching would use A for 1 and miss 2.
    assert len(match_reference(refs, detections[:1], 2)) == 1
    assert match_reference(refs, detections, 0) == []


def test_existing_evidence_is_preserved(tmp_path):
    with pytest.raises(FileExistsError):
        run(tmp_path / "missing.png", tmp_path)
