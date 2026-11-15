import hashlib
import io
import json
import zipfile

import numpy as np
import pytest
from PIL import Image

from ml.terrain_classifier.dataset import iter_patches
from ml.terrain_classifier.expanded_data import (
    choose,
    decode_member,
    group_split,
    member_end,
    windows,
)
from ml.terrain_classifier.expanded_protocol import audit_splits


def record(split, group, suffix=""):
    return {"split": split, "image": {"archive_path": f"NLA_{group*100000:09d}EDR{suffix}"}}


def test_all_old_fit_groups_stay_in_fit_and_expert_groups_are_excluded():
    assert all(group_split(g, {g}, set()) == "train" for g in range(4000, 4100))
    assert group_split(4000, set(), {4000}) == "excluded"
    assert {group_split(g, set(), set()) for g in range(4000, 4100)} == {"train", "validation", "test"}


def test_audit_rejects_stereo_acquisition_and_published_training_leakage():
    old = {"records": [record("train", 4000), record("test", 5000)]}
    clean = {"records": [record("train", 4000), record("validation", 4001), record("test", 4002)]}
    assert audit_splits(clean, old, [old])["test"] == [4002]
    for split, group in (("validation", 4000), ("test", 4001), ("train", 5000)):
        bad = {"records": clean["records"] + [record(split, group, "stereo")]}
        with pytest.raises(ValueError):
            audit_splits(bad, old, [old])


def test_zip_range_decoder_checks_crc_and_coalesces_nearby_members():
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_STORED) as archive:
        archive.writestr("one.png", b"abc")
        archive.writestr("two.png", b"def")
    with zipfile.ZipFile(io.BytesIO(buffer.getvalue())) as archive:
        infos = archive.infolist()
    data = buffer.getvalue()
    assert decode_member(data, infos[1], 0) == b"def"
    damaged = data.replace(b"def", b"deg")
    with pytest.raises(ValueError, match="CRC"):
        decode_member(damaged, infos[1], 0)
    batches = windows(infos)
    assert len(batches) == 1 and len(batches[0][2]) == 2
    assert batches[0][1] >= max(member_end(i) for i in infos)


def test_audit_rejects_identical_source_bytes_even_under_different_names():
    rows = [record("train", 4000), record("test", 4002)]
    for row in rows:
        row["image"]["sha256"] = "identical-source-digest"
    with pytest.raises(ValueError, match="Identical source image bytes"):
        audit_splits({"records": rows}, {"records": []}, [])


def test_frame_selection_spreads_groups_and_does_not_repeat_existing_frames():
    rows = [{"stem": str(i), "group": i//3} for i in range(15)]
    result = choose(rows, 5, selected={"0", "1"})
    assert len({r["group"] for r in result}) == 5
    assert {r["stem"] for r in result}.isdisjoint({"0", "1"})
    assert result == choose(list(reversed(rows)), 5, selected={"0", "1"})


def test_streaming_never_opens_unrequested_test_files(tmp_path):
    Image.new("RGB", (256, 256), color="gray").save(tmp_path / "image.png")
    Image.fromarray(np.zeros((256, 256), dtype=np.uint8)).save(tmp_path / "mask.png")
    item = {"split": "train"}
    for role, name in (("image", "image.png"), ("label", "mask.png")):
        item[role] = {"local_path": name, "archive_path": name,
                      "sha256": hashlib.sha256((tmp_path / name).read_bytes()).hexdigest()}
    (tmp_path / "manifest.json").write_text(json.dumps({"records": [item, {"split": "test"}]}))
    rows = list(iter_patches(tmp_path, {"train"}))
    assert len(rows) == 1 and rows[0][1][0].shape == (3, 128, 128)
    assert rows[0][1][1] == 0
