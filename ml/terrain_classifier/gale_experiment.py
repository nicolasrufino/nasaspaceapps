"""Compare three ground-classifier heads using grouped validation and a fresh expert test.

Writes an experiment only; never overwrites the deployed model automatically.
"""
import argparse
import copy
import hashlib
import json
from pathlib import Path

import numpy as np
import onnxruntime as ort
import torch
from torch import nn

from ml.terrain_classifier.dataset import clock_group, load_patches
from ml.terrain_classifier.gale_protocol import PROTOCOL, promotion, split_indices
from ml.terrain_classifier.train import TerrainModel, metrics


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2)+"\n", encoding="utf-8", newline="\n")


def fit(model, features, labels, config):
    torch.manual_seed(PROTOCOL["seed"])
    head = (nn.Sequential(nn.Linear(576, config["hidden"]), nn.ReLU(), nn.Dropout(0.2),
                          nn.Linear(config["hidden"], 4)) if config["hidden"] else copy.deepcopy(model.head))
    counts = torch.bincount(labels, minlength=4)
    if (counts == 0).any():
        raise ValueError("Fitting data must cover every trained class")
    loss_fn = nn.CrossEntropyLoss(weight=len(labels)/(4*counts.float()))
    optimizer = torch.optim.Adam(head.parameters(), lr=config["lr"], weight_decay=config["weight_decay"])
    head.train()
    for _ in range(config["epochs"]):
        optimizer.zero_grad()
        loss = loss_fn(head(features), labels)
        loss.backward()
        optimizer.step()
    return head.eval()


def score(rows, guesses):
    summary, matrix = metrics([r[1] for r in rows], guesses)
    return {"metrics": summary, "confusion_matrix": matrix,
            "source_images": len({r[2] for r in rows}),
            "clock_groups": len({clock_group(r[2]) for r in rows})}


def run(data, fresh, destination, baseline):
    destination.mkdir(parents=True, exist_ok=True)
    if any(destination.iterdir()):
        raise FileExistsError("Use a fresh experiment output directory")
    write_json(destination / "protocol.json", PROTOCOL)
    torch.manual_seed(PROTOCOL["seed"])
    torch.set_num_threads(4)
    torch.use_deterministic_algorithms(True)
    torch.hub.set_dir(str(data.parent / "torch-hub"))
    patches, manifest = load_patches(data)
    rows = patches["train"]
    fitting, validation = split_indices([r[2] for r in rows])
    model = TerrainModel().eval()
    labels = torch.tensor([r[1] for r in rows])
    with torch.no_grad():
        features = torch.cat([model.encode(torch.from_numpy(np.stack([r[0] for r in rows[i:i+32]])))
                              for i in range(0, len(rows), 32)])
    print("feature extraction complete", len(rows), flush=True)
    comparisons = []
    for config in PROTOCOL["candidates"]:
        head = fit(model, features[fitting], labels[fitting], config)
        with torch.no_grad():
            guesses = head(features[validation]).argmax(1).numpy()+1
        result = {"config": config, **score([rows[i] for i in validation], guesses)}
        comparisons.append(result)
        print("validation", config["name"], result["metrics"], flush=True)
    selected = max(range(len(comparisons)), key=lambda i: (
        comparisons[i]["metrics"]["balanced_accuracy_supported_classes"], comparisons[i]["metrics"]["accuracy"], -i))
    config = PROTOCOL["candidates"][selected]
    write_json(destination / "selection.json", {"config": config, "validation": comparisons})
    model.head = fit(model, features, labels, config)
    model.eval()
    candidate_path = destination / "terrain_cls.onnx"
    torch.onnx.export(model, torch.zeros(1, 3, 128, 128), str(candidate_path),
                      input_names=["image"], output_names=["logits"], opset_version=17, dynamo=False)
    sessions = {"baseline": ort.InferenceSession(str(baseline), providers=["CPUExecutionProvider"]),
                "candidate": ort.InferenceSession(str(candidate_path), providers=["CPUExecutionProvider"])}
    # First load of new test labels occurs only after validation-based selection/refit/export.
    fresh_patches, fresh_manifest = load_patches(fresh)
    fresh_rows = fresh_patches["test"]
    old_groups = {clock_group(r["image"]["archive_path"]) for r in manifest["records"] if r["split"] != "perseverance"}
    assert old_groups.isdisjoint(clock_group(r["image"]["archive_path"]) for r in fresh_manifest["records"])
    evaluations, predictions, guesses_by_split = {}, [], {}
    max_error = 0.0
    for split, test_rows in (("regression", patches["test"]), ("fresh", fresh_rows)):
        guesses_by_split[split], evaluations[split] = {}, {}
        for name, session in sessions.items():
            guesses = []
            for pixels, label, image_id, left, top in test_rows:
                output = session.run(None, {"image": pixels[None]})[0]
                guess = int(output.argmax(1)[0])
                guesses.append(guess)
                if name == "candidate":
                    with torch.no_grad():
                        expected = model(torch.from_numpy(pixels[None])).numpy()
                    np.testing.assert_allclose(output, expected, atol=1e-4, rtol=1e-4)
                    max_error = max(max_error, float(np.abs(output-expected).max()))
                predictions.append({"split": split, "model": name, "image": image_id,
                                    "crop": [left, top, 256, 256], "truth": label+1, "prediction": guess})
            guesses_by_split[split][name] = guesses
            evaluations[split][name] = score(test_rows, guesses)
        print(split, {n: s["metrics"] for n, s in evaluations[split].items()}, flush=True)
    decision = promotion([r[1]+1 for r in fresh_rows], guesses_by_split["fresh"]["baseline"],
                         guesses_by_split["fresh"]["candidate"], [clock_group(r[2]) for r in fresh_rows],
                         evaluations["regression"]["baseline"]["metrics"]["accuracy"],
                         evaluations["regression"]["candidate"]["metrics"]["accuracy"])
    report = {"protocol": PROTOCOL, "selected": config, "validation": comparisons,
              "fit_class_counts": np.bincount(labels[fitting].numpy(), minlength=4).tolist(),
              "validation_class_counts": np.bincount(labels[validation].numpy(), minlength=4).tolist(),
              "fit_clock_groups": sorted({clock_group(rows[i][2]) for i in fitting}),
              "validation_clock_groups": sorted({clock_group(rows[i][2]) for i in validation}),
              "evaluation": evaluations, "decision": decision,
              "onnx_parity_max_abs_error": max_error,
              "hashes": {"training_manifest": hashlib.sha256((data / "manifest.json").read_bytes()).hexdigest(),
                         "fresh_manifest": hashlib.sha256((fresh / "manifest.json").read_bytes()).hexdigest(),
                         "baseline_onnx": hashlib.sha256(baseline.read_bytes()).hexdigest(),
                         "candidate_onnx": hashlib.sha256(candidate_path.read_bytes()).hexdigest()},
              "runtime": {"torch": torch.__version__, "onnxruntime": ort.__version__},
              "limitations": ["Ground-view, patch-majority classification, not pixel segmentation or 3D.",
                              "No matched ground imagery proven for Luca's exact target sector.",
                              "Original 159 patches are now a regression set, not fresh evidence for selection.",
                              "Fresh results become historical after this one experiment; do not retune on them.",
                              "Perseverance excluded from model selection; its historical result is preserved."]}
    write_json(destination / "report.json", report)
    write_json(destination / "predictions.json", predictions)
    print("decision", decision, flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("data", "fresh", "destination", "baseline"):
        parser.add_argument(name, type=Path)
    args = parser.parse_args()
    run(args.data, args.fresh, args.destination, args.baseline)
