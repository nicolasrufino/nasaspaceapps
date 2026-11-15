import numpy as np

from ml.rock_review.full_slice import reference_to_native, sample_coverage
from ml.rock_review.register_observation import native_to_reference


def test_registered_coverage_checks_corners_and_detects_unseen_edge():
    model = {"reference_to_native_matrix": [[1, 0], [0, 1]], "reference_to_native_offset_m": [1, 0]}
    assert sample_coverage(2, 2, 8, model, [0, 0, 16, 16])["fully_covered_cells"] == 2
    assert sample_coverage(2, 2, 8, model, [0, 0, 17, 16])["fully_covered_cells"] == 4


def test_registration_direction_round_trip_with_rotation_and_translation():
    model = {"reference_to_native_matrix": [[1, -.005], [.005, 1.002]], "reference_to_native_offset_m": [39, 28]}
    points = [[0, 0], [2048, 2048], [100, 500]]
    assert np.allclose(native_to_reference(reference_to_native(points, model), model), points)
