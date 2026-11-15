"""Predeclared validation and promotion policy for the expanded-data experiment."""
import numpy as np

from ml.terrain_classifier.dataset import clock_group
from ml.terrain_classifier.gale_protocol import promotion

PROTOCOL = {
    "id": "curiosity-expanded-v3", "seed": 2026,
    "source": "AI4Mars 0.6 Curiosity NAV ground photos; crowd-consensus labels",
    "sampling": "640 train frames including old usable frames and up to 80 new big-rock frames; 96 validation frames including up to 32 big-rock frames; 128 random eligible test frames; up to 64 separate rock-challenge frames",
    "split": "100000-second acquisition bins: every official expert bin excluded; every original fitting bin assigned to fit; other bins hash modulo10: 0=test, 1/2=validation, 3..9=fit. Test/challenge may share bins, neither may overlap fitting/validation.",
    "head": {"initialization": "published v1 head on frozen ImageNet features", "lr": 0.003,
             "weight_decay": 0.001, "max_epochs": 200, "patience": 25},
    "tail": {"initialization": "best expanded head", "unfrozen_feature_indices": [9, 10, 11, 12],
             "head_lr": 0.0003, "tail_lr": 0.0001, "weight_decay": 0.001, "max_epochs": 25,
             "patience": 5, "batch_size": 32, "batchnorm": "frozen running statistics", "augmentation": "none"},
    "selection": "Highest supported-class balanced validation accuracy, then overall accuracy. Keep earliest tied epoch; prefer head on candidate tie. Do not refit on validation.",
    "promotion": "Fresh random-test gain >=1 percentage point with positive paired-bin bootstrap 95% lower bound, balanced accuracy no worse, no supported-class recall loss >5 points; each historical expert accuracy loses <=1 point; challenge big-rock recall no worse with >=20 big-rock crops from >=5 bins; fresh random test covers all four classes.",
    "test_use": "Only selected candidate and published baseline are evaluated after selection is saved. No test-driven retries.",
    "limitations": "Ground-view majority crop classification; crowd labels and bin separation are not expert validation, exact-site registration, aerial validation, physical independence or navigation safety.",
}


def audit_splits(manifest, old_manifest, expert_manifests):
    groups = {s: {clock_group(r["image"]["archive_path"]) for r in manifest["records"] if r["split"] == s}
              for s in ("train", "validation", "test", "rock_challenge")}
    old_fit = {clock_group(r["image"]["archive_path"]) for r in old_manifest["records"] if r["split"] == "train"}
    historical = {clock_group(r["image"]["archive_path"]) for m in expert_manifests for r in m["records"] if r["split"] == "test"}
    for split, split_groups in groups.items():
        if split_groups & historical:
            raise ValueError("Historical expert acquisition leaks into expanded data")
        if split != "train" and split_groups & old_fit:
            raise ValueError("Published model has already trained on a held-out acquisition")
    if groups["train"] & (groups["validation"] | groups["test"] | groups["rock_challenge"]):
        raise ValueError("Fitting acquisition overlaps a held-out split")
    if groups["validation"] & (groups["test"] | groups["rock_challenge"]):
        raise ValueError("Validation acquisition overlaps final test")
    ids = [r["image"]["archive_path"] for r in manifest["records"]]
    if len(ids) != len(set(ids)):
        raise ValueError("Duplicate source frame across selected splits")
    hashes = {}
    for row in manifest["records"]:
        digest = row["image"].get("sha256")
        split = row["split"]
        if digest and digest in hashes and hashes[digest] != split:
            raise ValueError("Identical source image bytes cross selected splits")
        if digest:
            hashes[digest] = split
    return {s: sorted(g) for s, g in groups.items()}


def decision(evaluations, predictions):
    p = predictions["test"]
    result = promotion(p["truth"], p["baseline"], p["candidate"], p["groups"],
                       evaluations["expert_v1"]["baseline"]["metrics"]["accuracy"],
                       evaluations["expert_v1"]["candidate"]["metrics"]["accuracy"])
    gates = result["gates"]
    gates["expert_v2_regression_within_one_point"] = (evaluations["expert_v2"]["candidate"]["metrics"]["accuracy"] >=
                                                     evaluations["expert_v2"]["baseline"]["metrics"]["accuracy"] - 0.01)
    gates["random_test_covers_all_four_classes"] = set(p["truth"]) == {1, 2, 3, 4}
    challenge = predictions["rock_challenge"]
    truth = np.asarray(challenge["truth"])
    rocks = truth == 4
    n = int(rocks.sum())
    groups = set(np.asarray(challenge["groups"])[rocks])
    recall = {name: float(np.mean(np.asarray(challenge[name])[rocks] == 4)) if n else None for name in ("baseline", "candidate")}
    gates["challenge_big_rock_support"] = n >= 20 and len(groups) >= 5
    gates["challenge_big_rock_recall_no_worse"] = bool(n and recall["candidate"] >= recall["baseline"])
    result.update({"promote": all(gates.values()), "challenge_big_rock_support": n,
                   "challenge_big_rock_groups": len(groups), "challenge_big_rock_recall": recall})
    return result
