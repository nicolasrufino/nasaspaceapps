"""Train, export and judge the predeclared v2 classifier (see v2_protocol.py).

    python -m ml.terrain_classifier.v2_train ml/data/ai4mars-subset-v1 ml/data/perseverance-v2 \
        ml/data/gale-fresh-v2 ml/exports/terrain_cls.onnx ml/runs/terrain-v2

Writes terrain_cls.onnx, terrain_cls.json and v2_report.json to a fresh directory. Every reported
prediction runs through ONNX Runtime. The candidate is published only by copying the two files
into ml/exports/ by hand, and only if every gate in the report passes.
"""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
import onnxruntime as ort
import torch
from torch import nn

from ml.check_exports import check
from ml.terrain_classifier import v2_protocol as P
from ml.terrain_classifier.dataset import load_patches
from ml.terrain_classifier.train import TerrainModel, metrics


class GreyTerrainModel(TerrainModel):
    """v1 architecture with ITU-R 601 grey conversion first; contract input stays RGB 0..1."""

    def __init__(self):
        super().__init__()
        self.register_buffer("grey", torch.tensor(P.GREY).view(1, 3, 1, 1))

    def encode(self, image):
        return super().encode((image * self.grey).sum(dim=1, keepdim=True).expand(-1, 3, -1, -1))


def rows_xy(rows):
    return np.stack([r[0] for r in rows]), np.array([r[1] for r in rows])


def onnx_predict(path, x):
    session = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
    return np.concatenate([session.run(None, {"image": b[None]})[0] for b in x])


def paired_bootstrap(truth, a, b, groups, seed=P.SEED):
    gain = (b.argmax(1) == truth + 1).astype(float) - (a.argmax(1) == truth + 1)
    ids = sorted(set(groups))
    where = {g: np.flatnonzero(np.array(groups) == g) for g in ids}
    rng = np.random.default_rng(seed)
    draws = [gain[np.concatenate([where[ids[i]] for i in rng.integers(0, len(ids), len(ids))])].mean()
             for _ in range(P.BOOTSTRAP)]
    return {"gain_points": 100 * gain.mean(), "ci95_points": [100 * np.percentile(draws, 2.5), 100 * np.percentile(draws, 97.5)],
            "groups": len(ids)}


def recall(matrix):
    return {name: (matrix[i][i] / sum(matrix[i]) if sum(matrix[i]) else None)
            for i, name in enumerate(["unknown", "soil", "bedrock", "sand", "big_rock"]) if i}


def run(subset, perseverance, fresh, baseline, destination):
    destination = Path(destination)
    destination.mkdir(parents=True, exist_ok=True)
    if any((destination / f).exists() for f in ("terrain_cls.onnx", "terrain_cls.json", "v2_report.json")):
        raise FileExistsError("Use a fresh output directory")
    torch.manual_seed(P.SEED)
    torch.set_num_threads(4)
    torch.use_deterministic_algorithms(True)
    torch.hub.set_dir(str(Path(subset).parent / "torch-hub"))
    curiosity, _ = load_patches(subset)
    mars2020, m2020_manifest = load_patches(perseverance)
    fresh_rows = load_patches(fresh)[0]["test"] if fresh else []
    train_rows = curiosity["train"] + mars2020["train"]
    train_frames = {r[2] for r in train_rows}
    for name, rows in (("curiosity_test", curiosity["test"]), ("perseverance_fresh_test", mars2020["test"]),
                       ("curiosity_expert_v2", fresh_rows)):
        assert train_frames.isdisjoint(r[2] for r in rows), name
    model = GreyTerrainModel().eval()
    x, y = rows_xy(train_rows)
    with torch.no_grad():
        features = torch.cat([model.encode(b) for b in torch.from_numpy(x).split(64)])
    y = torch.from_numpy(y)
    counts = torch.bincount(y, minlength=4)
    optimizer = torch.optim.Adam(model.head.parameters(), lr=0.01, weight_decay=0.001)
    loss_fn = nn.CrossEntropyLoss(weight=len(y) / (4 * counts.float()))
    for _ in range(200):  # v1 recipe, fixed before any test was run
        optimizer.zero_grad()
        loss = loss_fn(model.head(features), y)
        loss.backward()
        optimizer.step()
    path = destination / "terrain_cls.onnx"
    torch.onnx.export(model, torch.zeros(1, 3, 128, 128), str(path), input_names=["image"],
                      output_names=["logits"], opset_version=17, dynamo=False)
    evaluations = {}
    sets = {"curiosity_expert_v1": curiosity["test"], "perseverance_fresh": mars2020["test"]}
    if fresh_rows:
        sets["curiosity_expert_v2"] = fresh_rows
    for name, rows in sets.items():
        xs, ys = rows_xy(rows)
        old, new = onnx_predict(baseline, xs), onnx_predict(path, xs)
        with torch.no_grad():
            np.testing.assert_allclose(new[:16], model(torch.from_numpy(xs[:16])).numpy(), rtol=1e-4, atol=1e-4)
        entry = {}
        for label, logits in (("v1", old), ("v2", new)):
            summary, matrix = metrics(ys, logits.argmax(1))  # metrics() takes contract indices 0-4
            entry[label] = {"metrics": summary, "correct": int((logits.argmax(1) - 1 == ys).sum()),
                            "confusion_matrix": matrix, "recall": recall(matrix)}
        entry["paired_bootstrap_v2_minus_v1"] = paired_bootstrap(ys, old, new, [r[2] for r in rows])
        evaluations[name] = entry
    pf, c1 = evaluations["perseverance_fresh"], evaluations["curiosity_expert_v1"]
    drop = lambda e: 100 * (e["v1"]["metrics"]["accuracy"] - e["v2"]["metrics"]["accuracy"])
    gates = {
        "fresh_perseverance_gain": pf["paired_bootstrap_v2_minus_v1"]["ci95_points"][0] > 0,
        "fresh_perseverance_balanced": pf["v2"]["metrics"]["balanced_accuracy_supported_classes"]
                                       > pf["v1"]["metrics"]["balanced_accuracy_supported_classes"],
        "curiosity_expert_v1_drop": drop(c1) <= P.GATES["curiosity_expert_v1_drop_points_max"],
        "curiosity_expert_v2_drop": (drop(evaluations["curiosity_expert_v2"]) <= P.GATES["curiosity_expert_v2_drop_points_max"]
                                     if "curiosity_expert_v2" in evaluations else None),
    }
    promote = all(v is True for v in gates.values())
    report = {"protocol": P.ID, "gates": gates, "promote": promote, "evaluations": evaluations,
              "train_patches": {"curiosity": len(curiosity["train"]), "perseverance": len(mars2020["train"])},
              "class_counts": counts.tolist(), "final_train_loss": float(loss.detach()),
              "perseverance_test_blocks": m2020_manifest["test_blocks"], "block_sols": m2020_manifest["block_sols"],
              "manifest_sha256": hashlib.sha256((Path(perseverance) / "manifest.json").read_bytes()).hexdigest(),
              "onnx_sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
              "runtime": {"torch": torch.__version__, "onnxruntime": ort.__version__}}
    (destination / "v2_report.json").write_text(json.dumps(report, indent=1, default=float) + "\n", encoding="utf-8", newline="\n")
    held = c1["v2"]
    metadata = {
        "placeholder": False,
        "version": "v2",
        "data_source": ["NASA/JPL AI4Mars merged 0.6 NAV labels (Curiosity and Perseverance)",
                        "https://zenodo.org/api/records/15995036", "torchvision MobileNet_V3_Small_Weights.IMAGENET1K_V1"],
        "held_out": {**held["metrics"]},
        "confusion_matrix": held["confusion_matrix"],
        "perseverance_fresh_test": {"metrics": pf["v2"]["metrics"], "confusion_matrix": pf["v2"]["confusion_matrix"],
                                    "frames": len({r[2] for r in mars2020["test"]}), "sol_blocks": m2020_manifest["test_blocks"],
                                    "v1_on_same_patches": pf["v1"]["metrics"],
                                    "paired_bootstrap_v2_minus_v1": pf["paired_bootstrap_v2_minus_v1"]},
        "architecture": "ITU-R 601 grey conversion in graph, frozen ImageNet MobileNetV3-small features, trained 576x4 linear head; fixed unknown logit -100",
        "training": {"seed": P.SEED, "epochs": 200, "optimizer": "Adam", "lr": 0.01, "weight_decay": 0.001,
                     "class_weighting": "inverse training frequency", "train_patches": int(len(y)),
                     "train_patches_by_rover": report["train_patches"], "class_counts": counts.tolist(),
                     "final_train_loss": float(loss.detach())},
        "preprocessing": "Nonoverlapping 256x256 source crops, >=70% valid NAV labels, >=80% dominant class among valid pixels; bilinear RGB resize to 128; input 0..1; grey conversion and ImageNet normalization inside graph",
        "class_mapping": {"0": "unknown (not learned)", "1": "soil", "2": "bedrock", "3": "sand", "4": "big rock"},
        "split": "Curiosity: official MSL expert min3 test, expert clock bins excluded from training. Perseverance: 10-sol blocks; 7 blocks held out as a fresh test, chosen by hash before download (v2_protocol.py)",
        "manifest_sha256": report["manifest_sha256"],
        "onnx_sha256": report["onnx_sha256"],
        "runtime": report["runtime"],
        "report": "ml/terrain_classifier/v2_report.json",
        "limitations": ["Patch-level majority labels; not segmentation or a rock detector.",
                        "Perseverance labels are crowd NAV labels; neighbouring sol blocks are nearby places, so some location correlation remains.",
                        "Big-rock support is tiny in every test; no big-rock accuracy is claimed.",
                        "Unknown is not trained. Softmax scores are not calibrated probabilities, especially outside Curiosity.",
                        "Not validated on helicopter, orbital or phone photos."],
    }
    if "curiosity_expert_v2" in evaluations:
        metadata["curiosity_expert_v2"] = {"metrics": evaluations["curiosity_expert_v2"]["v2"]["metrics"],
                                           "v1_on_same_patches": evaluations["curiosity_expert_v2"]["v1"]["metrics"]}
    path.with_suffix(".json").write_text(json.dumps(metadata, indent=2, default=float) + "\n", encoding="utf-8", newline="\n")
    names, errors = check(destination)
    if errors:
        raise RuntimeError("; ".join(errors))
    print(json.dumps({"gates": gates, "promote": promote, **{k: {m: v[m]["metrics"] for m in ("v1", "v2")} for k, v in evaluations.items()}},
                     indent=1, default=float), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("subset", "perseverance", "fresh", "baseline", "destination"):
        parser.add_argument(name, type=Path)
    a = parser.parse_args()
    run(a.subset, a.perseverance, a.fresh, a.baseline, a.destination)
