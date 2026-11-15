import numpy as np

from ml.terrain_classifier.dataset import clock_group, patch_label


def test_null_pixels_are_ignored_and_mixed_patches_not_mislabeled():
    empty = np.full((10, 10), 255, np.uint8)
    assert patch_label(empty) is None
    empty[:7] = 0
    assert patch_label(empty) == 0  # AI4Mars soil, not the contract's unknown class.
    empty[:4] = 1
    assert patch_label(empty) is None
    assert patch_label(np.full((10, 10), 3, np.uint8)) == 3


def test_neighboring_acquisitions_share_group():
    assert clock_group("NLA_409036068EDR_F0051606NCAM00348M1") == clock_group("NRA_409036116EDR_F0051606NCAM00348M1")
