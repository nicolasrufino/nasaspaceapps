import cv2
import numpy as np
import pytest

from ml.rock_review.register_observation import (
    fit_registration,
    measure_controls,
    native_to_reference,
    placement,
)


def controls():
    matrix = np.array([[.002, -.004], [.005, .001]])
    offset = np.array([34, 35])
    rows = []
    for row in range(7):
        for col in range(7):
            point = np.array([256+col*256, 256+row*256])
            split = "fit" if row % 2 == col % 2 else "validation"
            delta = matrix@point+offset
            # Held-out points deliberately contain errors not fitted by the model.
            if split == "validation":
                delta += [1, 0]
            rows.append({"reference_center_m": point.tolist(), "native_minus_reference_m": delta.tolist(),
                         "response": .8, "split": split})
    return rows, matrix+np.eye(2), offset


def test_fit_does_not_use_validation_points_and_inverse_handles_shear():
    rows, expected_matrix, expected_offset = controls()
    model = fit_registration(rows)
    np.testing.assert_allclose(model["reference_to_native_matrix"], expected_matrix, atol=1e-12)
    np.testing.assert_allclose(model["reference_to_native_offset_m"], expected_offset, atol=1e-10)
    assert model["fit_controls"] == 25
    assert model["validation_controls"] == 24
    assert model["validation_residual_m"]["p95"] == pytest.approx(1)
    reference = np.array([[0., 0.], [1000., 2000.]])
    native = reference@expected_matrix.T+expected_offset
    np.testing.assert_allclose(native_to_reference(native, model), reference, atol=1e-10)


def test_poor_or_degenerate_controls_cannot_approve_registration():
    rows, _, _ = controls()
    for row in rows:
        if row["split"] == "validation":
            row["native_minus_reference_m"][1] += 5
    assert not fit_registration(rows)["image_alignment_check_passed"]
    for row in rows:
        row["response"] = .01
    with pytest.raises(ValueError, match="Insufficient"):
        fit_registration(rows)
    rows, _, _ = controls()
    for row in rows:
        row["reference_center_m"] = [1, 1]
    with pytest.raises(ValueError, match="Degenerate"):
        fit_registration(rows)


def test_phase_measurement_sign_and_scale_on_translated_texture():
    texture = np.random.default_rng(2026).normal(100, 20, (2048, 2048)).astype(np.float32)
    shifted = cv2.warpAffine(texture, np.array([[1, 0, 12.25], [0, 1, -9.5]], np.float32), (2048, 2048))
    measured = measure_controls(texture, shifted)
    median = np.median([row["native_minus_reference_m"] for row in measured], axis=0)
    # OpenCV's peak centroid is not an unbiased subpixel estimator. Allow half
    # a 1 m diagnostic pixel; this checks direction/scale, not rock localization.
    np.testing.assert_allclose(median, [12.25, -9.5], atol=.5)
    assert fit_registration(measured)["image_alignment_check_passed"]


def test_placement_preserves_outside_and_flags_boundary_and_extrapolation():
    model = {"control_extent_m": [256, 256, 1792, 1792], "validation_residual_m": {"max": 2.1}}
    bounds = [1000, 1000, 3048, 3048]
    stable = placement(np.array([260., 260.]), bounds, model)
    assert stable["world_cell"] == [32, 32]
    assert not stable["near_cell_boundary"] and not stable["extrapolated"]
    assert placement(np.array([257., 260.]), bounds, model)["near_cell_boundary"]
    assert placement([20, 20], bounds, model)["extrapolated"]
    assert placement([-1, 260], bounds, model)["world_cell"] is None
    # The report must serialize real native ndarray points without NumPy booleans.
    import json
    json.dumps(stable)
