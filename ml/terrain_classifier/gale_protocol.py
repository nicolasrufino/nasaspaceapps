"""Deterministic acquisition-group splits and conservative promotion rules."""
import numpy as np

from ml.terrain_classifier.dataset import clock_group, rank

PROTOCOL = {
    "id": "gale-ground-head-v2", "seed": 2026,
    "data": "Curiosity NAV ground photographs in Gale; no Ingenuity training",
    "validation": "Original training bins: SHA256 rank(bin) modulo 5 equals 0; other bins fit",
    "candidates": [
        {"name": "linear_v1", "hidden": 0, "lr": 0.01, "weight_decay": 0.001, "epochs": 200},
        {"name": "linear_regularized", "hidden": 0, "lr": 0.005, "weight_decay": 0.01, "epochs": 200},
        {"name": "mlp64", "hidden": 64, "lr": 0.001, "weight_decay": 0.01, "epochs": 200},
    ],
    "selection": "Highest validation balanced accuracy, then accuracy, then listed order; fixed epochs",
    "refit": "Refit selected head on all original 1136 training patches; frozen ImageNet features",
    "fresh_test": "80 expert image pairs; excludes all original train/test clock bins; opened after head selection",
    "promotion": "Fresh paired acquisition-bin bootstrap 95% gain lower bound >0, accuracy gain >=0.01, balanced accuracy no worse, no supported-class recall drop >0.05, old-test accuracy drop <=0.01",
    "limitations": "Acquisition bins are not proof of spatial independence or coverage of Luca's exact site. No aerial, segmentation, slope or safety validation.",
}


def split_indices(image_ids):
    validation = np.array([int(rank(str(clock_group(name))), 16) % 5 == 0 for name in image_ids])
    if not validation.any() or validation.all():
        raise ValueError("Need nonempty fitting and validation acquisition groups")
    return np.flatnonzero(~validation), np.flatnonzero(validation)


def promotion(truth, baseline, candidate, groups, regression_baseline, regression_candidate):
    truth, baseline, candidate, groups = map(np.asarray, (truth, baseline, candidate, groups))
    unique = np.unique(groups)
    if not len(truth) or len(unique) < 2:
        raise ValueError("Need at least two fresh acquisition groups")
    totals = np.array([np.sum(groups == g) for g in unique])
    gains = np.array([np.sum((candidate[groups == g] == truth[groups == g]).astype(int)
                             - (baseline[groups == g] == truth[groups == g]).astype(int)) for g in unique])
    sampled = np.random.default_rng(2026).integers(0, len(unique), size=(10000, len(unique)))
    bounds = np.quantile(gains[sampled].sum(1) / totals[sampled].sum(1), [0.025, 0.975])
    support = np.unique(truth)
    recall_delta = [float(np.mean(candidate[truth == c] == c) - np.mean(baseline[truth == c] == c)) for c in support]
    gain = float(np.mean(candidate == truth) - np.mean(baseline == truth))
    gates = {"fresh_accuracy_gain_at_least_one_point": gain >= 0.01,
             "grouped_gain_lower_bound_positive": bool(bounds[0] > 0),
             "supported_balanced_accuracy_no_worse": bool(np.mean(recall_delta) >= -1e-12),
             "no_supported_class_recall_drop_over_five_points": min(recall_delta) >= -0.05 - 1e-12,
             "old_test_regression_within_one_point": regression_candidate >= regression_baseline - 0.01}
    return {"promote": all(gates.values()), "gates": gates, "fresh_accuracy_gain": gain,
            "paired_group_bootstrap_95pct_gain_interval": bounds.tolist(), "bootstrap_resamples": 10000,
            "acquisition_groups": len(unique), "supported_class_recall_deltas": dict(zip(map(str, support), recall_delta))}
