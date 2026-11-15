"""Continue v1 on more Curiosity data, then fine-tune its final feature blocks.

Training uses streamed images and disk-backed frozen features to fit a laptop.
The final test is evaluated once, after validation-based checkpoint selection.
"""
import argparse
import copy
import hashlib
import json
from pathlib import Path

import numpy as np
import onnx
import onnxruntime as ort
import torch
from onnx import numpy_helper
from torch import nn

from ml.check_exports import check
from ml.terrain_classifier.dataset import clock_group, iter_patches
from ml.terrain_classifier.expanded_protocol import PROTOCOL, audit_splits, decision
from ml.terrain_classifier.train import TerrainModel, metrics


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2)+"\n", encoding="utf-8", newline="\n")


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def summary(truth, guesses):
    result, matrix = metrics(truth, guesses)
    return {"metrics": result, "confusion_matrix": matrix}


def quality(report):
    return (report["metrics"]["balanced_accuracy_supported_classes"], report["metrics"]["accuracy"])


def cache_split(data, split, model, output, count):
    prefix = np.lib.format.open_memmap(output / f"{split}-prefix.npy", mode="w+", dtype=np.float32, shape=(count, 48, 8, 8))
    features = np.lib.format.open_memmap(output / f"{split}-features.npy", mode="w+", dtype=np.float32, shape=(count, 576))
    labels, frames, batch = [], [], []
    at = 0

    def flush():
        nonlocal at
        x = torch.from_numpy(np.stack([r[0] for r in batch]))
        with torch.no_grad():
            first = model.features[:9]((x-model.mean)/model.std)
            last = model.features[9:](first).mean((2, 3))
        end = at+len(batch)
        prefix[at:end], features[at:end] = first.numpy(), last.numpy()
        at = end
        labels.extend(r[1] for r in batch)
        frames.extend(r[2] for r in batch)
        batch.clear()

    for _, row in iter_patches(data, {split}):
        batch.append(row)
        if len(batch) == 16:
            flush()
            if at % 512 == 0:
                print("features", split, at, "/", count, flush=True)
    if batch:
        flush()
    if at != count:
        raise ValueError("Screened label count differs from verified image crop count")
    prefix.flush()
    features.flush()
    print("cached", split, "patches", count, "class_counts", np.bincount(labels, minlength=4).tolist(), flush=True)
    return {"prefix": prefix, "features": features, "labels": torch.tensor(labels), "frames": frames}


def train_heads(model, fitting, validation):
    config = PROTOCOL["head"]
    x = torch.from_numpy(np.array(fitting["features"]))
    vx = torch.from_numpy(np.array(validation["features"]))
    y, vy = fitting["labels"], validation["labels"]
    counts = torch.bincount(y, minlength=4)
    if (counts == 0).any() or (torch.bincount(vy, minlength=4) == 0).any():
        raise ValueError("Fit and validation must cover all four learned classes")
    weights = len(y)/(4*counts.float())
    loss_fn = nn.CrossEntropyLoss(weight=weights)
    optimizer = torch.optim.Adam(model.head.parameters(), lr=config["lr"], weight_decay=config["weight_decay"])
    with torch.no_grad():
        best_report = summary(vy.numpy(), model.head(vx).argmax(1).numpy()+1)
    best_state, best_epoch, stale = copy.deepcopy(model.state_dict()), 0, 0
    history = [{"epoch": 0, **best_report}]
    for epoch in range(1, config["max_epochs"]+1):
        optimizer.zero_grad()
        loss = loss_fn(model.head(x), y)
        loss.backward()
        optimizer.step()
        with torch.no_grad():
            report = summary(vy.numpy(), model.head(vx).argmax(1).numpy()+1)
        history.append({"epoch": epoch, "train_loss": float(loss.detach()), **report})
        if quality(report) > quality(best_report):
            best_report, best_epoch, best_state, stale = report, epoch, copy.deepcopy(model.state_dict()), 0
        else:
            stale += 1
        if epoch % 10 == 0:
            print("head epoch", epoch, "best", best_epoch, "validation", best_report["metrics"], flush=True)
        if stale >= config["patience"]:
            break
    model.load_state_dict(best_state)
    return {"selected_epoch": best_epoch, "epochs_run": epoch, "validation": best_report, "history": history}, weights


def train_tail(model, fitting, validation, weights):
    config = PROTOCOL["tail"]
    tail = model.features[9:]
    for parameter in tail.parameters():
        parameter.requires_grad_(True)
    # All batchnorm stays in eval mode: only explicit parameter gradients update.
    model.eval()
    optimizer = torch.optim.Adam([{"params": tail.parameters(), "lr": config["tail_lr"]},
                                  {"params": model.head.parameters(), "lr": config["head_lr"]}], weight_decay=config["weight_decay"])
    loss_fn = nn.CrossEntropyLoss(weight=weights)

    def validate():
        guesses = []
        with torch.no_grad():
            for at in range(0, len(validation["labels"]), 32):
                x = torch.from_numpy(np.array(validation["prefix"][at:at+32]))
                guesses.extend((model.head(tail(x).mean((2, 3))).argmax(1)+1).tolist())
        return summary(validation["labels"].numpy(), guesses)

    best_report = validate()
    best_state, best_epoch, stale = copy.deepcopy(model.state_dict()), 0, 0
    history = [{"epoch": 0, **best_report}]
    generator = torch.Generator().manual_seed(PROTOCOL["seed"])
    for epoch in range(1, config["max_epochs"]+1):
        order = torch.randperm(len(fitting["labels"]), generator=generator)
        losses = []
        for ids in order.split(config["batch_size"]):
            x = torch.from_numpy(np.array(fitting["prefix"][ids.numpy()]))
            optimizer.zero_grad()
            loss = loss_fn(model.head(tail(x).mean((2, 3))), fitting["labels"][ids])
            loss.backward()
            optimizer.step()
            losses.append(float(loss.detach()))
        report = validate()
        history.append({"epoch": epoch, "train_loss": float(np.mean(losses)), **report})
        if quality(report) > quality(best_report):
            best_report, best_epoch, best_state, stale = report, epoch, copy.deepcopy(model.state_dict()), 0
        else:
            stale += 1
        print("tail epoch", epoch, "best", best_epoch, "validation", report["metrics"], flush=True)
        if stale >= config["patience"]:
            break
    model.load_state_dict(best_state)
    return {"selected_epoch": best_epoch, "epochs_run": epoch, "validation": best_report, "history": history}


def evaluate(model, candidate, baseline, sources):
    options = ort.SessionOptions()
    options.intra_op_num_threads, options.inter_op_num_threads = 2, 1
    sessions = {name: ort.InferenceSession(str(path), sess_options=options, providers=["CPUExecutionProvider"])
                for name, path in (("baseline", baseline), ("candidate", candidate))}
    reports, predictions, max_error = {}, {}, 0.0
    for split, (root, source_split) in sources.items():
        predictions[split] = {"truth": [], "groups": [], "images": [], "crops": [], "baseline": [], "candidate": []}
        p = predictions[split]
        for _, (pixels, label, frame, left, top) in iter_patches(root, {source_split}):
            p["truth"].append(label+1)
            p["groups"].append(clock_group(frame))
            p["images"].append(frame)
            p["crops"].append([left, top, 256, 256])
            for name, session in sessions.items():
                output = session.run(None, {"image": pixels[None]})[0]
                p[name].append(int(output.argmax(1)[0]))
                if name == "candidate":
                    with torch.no_grad():
                        expected = model(torch.from_numpy(pixels[None])).numpy()
                    np.testing.assert_allclose(output, expected, atol=1e-4, rtol=1e-4)
                    max_error = max(max_error, float(np.abs(output-expected).max()))
        reports[split] = {name: summary(np.asarray(p["truth"])-1, p[name]) for name in sessions}
        print("test", split, {n: r["metrics"] for n, r in reports[split].items()}, flush=True)
    return reports, predictions, max_error


def run(data, original, expert_v2, output, baseline):
    output.mkdir(parents=True, exist_ok=True)
    if any(output.iterdir()):
        raise FileExistsError("Use a fresh experiment directory")
    write_json(output / "protocol.json", PROTOCOL)
    manifests = [json.loads((p / "manifest.json").read_text()) for p in (data, original, expert_v2)]
    groups = audit_splits(manifests[0], manifests[1], manifests[1:])
    torch.manual_seed(PROTOCOL["seed"])
    torch.set_num_threads(2)
    torch.use_deterministic_algorithms(True)
    torch.hub.set_dir(str(original.parent / "torch-hub"))
    model = TerrainModel().eval()
    initializers = {t.name: numpy_helper.to_array(t) for t in onnx.load(str(baseline)).graph.initializer}
    with torch.no_grad():
        model.head.weight.copy_(torch.from_numpy(initializers["head.weight"].copy()))
        model.head.bias.copy_(torch.from_numpy(initializers["head.bias"].copy()))
    del initializers
    selection = json.loads((data / "selection.json").read_text())
    caches = {s: cache_split(data, s, model, output, sum(sum(r["counts"]) for r in selection["splits"][s]))
              for s in ("train", "validation")}
    head, weights = train_heads(model, caches["train"], caches["validation"])
    head_state = copy.deepcopy(model.state_dict())
    tail = train_tail(model, caches["train"], caches["validation"], weights)
    selected = "tail" if quality(tail["validation"]) > quality(head["validation"]) else "head"
    if selected == "head":
        model.load_state_dict(head_state)
    model.eval()
    write_json(output / "selection.json", {"selected": selected, "head": head, "tail": tail})
    torch.save(model.state_dict(), output / "selected-state.pt")
    path = output / "terrain_cls.onnx"
    torch.onnx.export(model, torch.zeros(1, 3, 128, 128), str(path), input_names=["image"], output_names=["logits"],
                      opset_version=17, dynamo=False)
    del caches, head_state
    evaluations, predictions, parity = evaluate(model, path, baseline, {
        "test": (data, "test"), "rock_challenge": (data, "rock_challenge"),
        "expert_v1": (original, "test"), "expert_v2": (expert_v2, "test")})
    outcome = decision(evaluations, predictions)
    report = {"protocol": PROTOCOL, "selected": selected, "head": head, "tail": tail,
              "split_groups": groups, "class_counts": {s: np.sum([r["counts"] for r in rows], axis=0).tolist() for s, rows in selection["splits"].items()},
              "source_frames": {s: len(rows) for s, rows in selection["splits"].items()},
              "evaluations": evaluations, "decision": outcome, "onnx_parity_max_abs_error": parity,
              "hashes": {"expanded_manifest": sha(data / "manifest.json"), "original_manifest": sha(original / "manifest.json"),
                         "expert_v2_manifest": sha(expert_v2 / "manifest.json"), "baseline_onnx": sha(baseline), "candidate_onnx": sha(path)},
              "runtime": {"torch": torch.__version__, "onnxruntime": ort.__version__}}
    write_json(output / "report.json", report)
    write_json(output / "predictions.json", predictions)
    baseline_metadata = json.loads(baseline.with_suffix(".json").read_text())
    metadata = {"placeholder": False, "data_source": [PROTOCOL["source"], manifests[0]["record"]],
                "held_out": evaluations["test"]["candidate"]["metrics"], "confusion_matrix": evaluations["test"]["candidate"]["confusion_matrix"],
                "architecture": "MobileNetV3-Small: published head continued on expanded data; " + selected + " selected by validation",
                "training": {"protocol": PROTOCOL, "source_frames": report["source_frames"], "class_counts": report["class_counts"],
                             "train_patches": sum(report["class_counts"]["train"]),
                             "selected_head_epoch": head["selected_epoch"], "selected_tail_epoch": tail["selected_epoch"]},
                "preprocessing": baseline_metadata["preprocessing"], "class_mapping": baseline_metadata["class_mapping"],
                "manifest_sha256": report["hashes"]["expanded_manifest"],
                "evaluation": evaluations, "promotion_decision": outcome, "onnx_sha256": sha(path),
                "limitations": [PROTOCOL["limitations"], "Unknown output is fixed -100, not learned or calibrated.",
                                "Fresh crowd-label test and challenge must not be reused for further model selection."]}
    write_json(path.with_suffix(".json"), metadata)
    _, errors = check(output)
    if errors:
        raise RuntimeError(str(errors))
    print("promotion decision", json.dumps(outcome), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("data", "original", "expert_v2", "output", "baseline"):
        parser.add_argument(name, type=Path)
    args = parser.parse_args()
    run(args.data, args.original, args.expert_v2, args.output, args.baseline)
