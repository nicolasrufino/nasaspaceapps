import zipfile

import numpy as np
import pytest

from ml.terrain_classifier.dataset import clock_group
from ml.terrain_classifier.fresh_gale import select_fresh
from ml.terrain_classifier.gale_protocol import promotion, split_indices


def test_group_split_keeps_stereo_and_repeated_crops_together():
    names = [f"NLA_{400000000 + i*100000:09d}EDR" for i in range(30)]
    names += [n.replace("NLA", "NRA") for n in names]
    fitting, validation = split_indices(names)
    assert set(fitting) | set(validation) == set(range(len(names)))
    assert {clock_group(names[i]) for i in fitting}.isdisjoint(clock_group(names[i]) for i in validation)


def test_fresh_test_excludes_whole_previously_seen_bins_and_prefers_jpeg():
    infos = []
    for clock in (400000001, 400000050, 400100000, 400200000):
        stem = f"NLB_{clock:09d}EDR"
        infos += [zipfile.ZipInfo(f"release/msl/ncam/images/edr/{stem}.{ext}") for ext in ("JPG", "JPEG")]
        infos.append(zipfile.ZipInfo(f"release/msl/ncam/labels/test/masked-gold-min3-100agree/{stem}_merged.png"))
    old = [{"split": "test", "image": {"archive_path": "NLA_400000099EDR"}}]
    pairs = select_fresh(infos, old, count=2)
    assert len({clock_group(a.filename) for a, _ in pairs}) == 2
    assert all(clock_group(a.filename) != 4000 and a.filename.endswith(".JPEG") for a, _ in pairs)
    with pytest.raises(ValueError, match="Only 2"):
        select_fresh(infos, old, count=3)


def test_promotion_rejects_a_high_accuracy_model_that_loses_a_class():
    truth = np.array([1]*90 + [2]*10)
    baseline = truth.copy()
    baseline[:20] = 2
    candidate = np.ones(100, dtype=int)
    result = promotion(truth, baseline, candidate, np.arange(100)//10, 0.93, 0.94)
    assert result["fresh_accuracy_gain"] > 0
    assert not result["promote"]
    assert not result["gates"]["no_supported_class_recall_drop_over_five_points"]


def test_promotion_accepts_consistent_paired_gains_but_rejects_regression():
    truth = np.tile([1, 2], 20)
    baseline = 3 - truth
    groups = np.arange(40)//4
    assert promotion(truth, baseline, truth, groups, 0.93, 0.94)["promote"]
    assert not promotion(truth, baseline, truth, groups, 0.93, 0.90)["promote"]
    assert not promotion(truth, truth, truth, groups, 0.93, 0.93)["promote"]
