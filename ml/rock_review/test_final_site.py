import json
import math
from pathlib import Path

import numpy as np
import pytest

from ml.rock_review.final_site import proposals


def test_new_proposals_are_distinct_unreviewed_and_distributed():
    pixels = np.full((1024, 1024), 80, np.uint8)
    for y in range(64, 1024, 128):
        for x in range(64, 1024, 128):
            pixels[y:y+4, x:x+4] = 220
    records = proposals(pixels)
    assert len(records) == 50
    assert [r["id"] for r in records] == [f"G{i:02}" for i in range(1, 51)]
    assert {r["status"] for r in records} == {"unreviewed"}
    assert len({(int(r["x"]//128), int(r["y"]//128)) for r in records}) == 50
    assert records == proposals(pixels)


def test_no_fabricated_points_when_imagery_has_no_candidates():
    with pytest.raises(ValueError, match="Only 0"):
        proposals(np.zeros((1024, 1024), np.uint8))


def test_final_site_excludes_original_accepted_crop():
    root = Path(__file__).parents[2]
    world = root / "data/worlds/gale/world.json"
    if not world.exists():
        pytest.skip("Luca's real Gale world has not reached this branch")
    box = json.loads(world.read_text())["site"]["bbox_deg"]
    old = json.loads(Path(__file__).with_name("source.json").read_text())["source_metadata"]
    assert not box["south"] <= old["centre_latitude_deg"] <= box["north"]


def test_frozen_final_candidates_align_to_lucas_world_without_transferred_acceptance():
    payload = json.loads(Path(__file__).with_name("final_site_candidates.json").read_text(encoding="utf-8"))
    meta = payload["source"]
    rows = payload["annotations"]
    assert payload["review_status"] == "unreviewed"
    assert len(rows) == 50 and {r["status"] for r in rows} == {"unreviewed"}
    assert meta["source_window"] == [9244, 53980, 8192, 8192]
    assert meta["world_width"] == meta["world_height"] == 256
    assert meta["world_cell_size_m"] == 8
    assert len({tuple(r["world_cell"]) for r in rows}) == 50
    for row in rows:
        x = 8142311 + (row["x"]+.5)*.25
        y = -283495 - (row["y"]+.5)*.25
        assert row["projected_m"] == pytest.approx([x, y])
        assert row["longitude_east_deg"] == pytest.approx(math.degrees(x/3396190))
        assert row["latitude_deg"] == pytest.approx(math.degrees(y/3396190))
        assert row["world_cell"] == [math.floor((x-8142311)/8), math.floor((-283495-y)/8)]
        assert all(0 <= c < 256 for c in row["world_cell"])
