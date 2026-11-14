"""Protect accepted annotations and reject imagery with borrowed georeferencing."""
import json
import math
from pathlib import Path

import pytest
from PIL import Image, PngImagePlugin

from ml.rock_review.prepare_review import build

HERE = Path(__file__).parent


def read(name):
    return json.loads((HERE / name).read_text(encoding="utf-8"))


def test_review_preserves_original_locations_and_provenance():
    original = read("candidates_unreviewed.json")
    accepted = read("candidates_reviewed.json")
    source = read("source.json")
    for key in ("source_file", "source_sha256", "source_metadata"):
        assert original[key] == accepted[key] == source[key]
    assert accepted["review_status"] == "accepted_by_user"
    assert original["review_status"] == "unreviewed"
    assert [a["id"] for a in accepted["annotations"]] == list(range(1, 51))
    assert len(original["annotations"]) == 50
    decision_fields = {"status", "reviewer", "note"}
    for before, after in zip(original["annotations"], accepted["annotations"]):
        assert before["status"] == "unreviewed"
        assert after["status"] == "accepted"
        assert after["reviewer"] == "Jules Rumeau"
        assert {k: v for k, v in before.items() if k not in decision_fields} == {
            k: v for k, v in after.items() if k not in decision_fields
        }
        x = 8142733.5 + (after["x"] + 0.5) * 0.25
        y = -279648.5 - (after["y"] + 0.5) * 0.25
        assert after["projected_easting_m"] == pytest.approx(x)
        assert after["projected_northing_m"] == pytest.approx(y)
        assert after["longitude_east_deg"] == pytest.approx(math.degrees(x / 3396190))
        assert after["latitude_deg"] == pytest.approx(math.degrees(y / 3396190))


@pytest.mark.parametrize("external", [False, True])
def test_borrowed_metadata_does_not_geolocate_unrelated_pixels(tmp_path, external):
    image = tmp_path / "unrelated.png"
    info = PngImagePlugin.PngInfo()
    info.add_text("MartianMapMetadata", json.dumps(read("source.json")["source_metadata"]))
    Image.new("L", (1024, 1024), 100).save(image, pnginfo=info)
    out = tmp_path / "review"
    with pytest.raises(ValueError, match="pixels"):
        build(image, out, HERE / "source.json" if external else None)
    assert not out.exists()


def test_existing_review_is_never_overwritten(tmp_path):
    review = tmp_path / "rock_candidates_review.json"
    review.write_text('{"review_status": "accepted_by_user"}', encoding="utf-8")
    before = review.read_bytes()
    with pytest.raises(FileExistsError):
        build(tmp_path / "missing-source.png", tmp_path)
    assert review.read_bytes() == before
