"""Train a small, frozen-MobileNet AI4Mars baseline and measure untouched tests.

Contract input is RGB [0,1] at 128x128; ImageNet normalization is inside ONNX.
No test images are used for fitting, checkpoint selection or threshold tuning.
"""
import argparse
import hashlib
import json
import random
from pathlib import Path

import numpy as np
import onnxruntime as ort
import torch
from torch import nn
from torchvision.models import MobileNet_V3_Small_Weights, mobilenet_v3_small

from ml.check_exports import check
from ml.terrain_classifier.dataset import load_patches


class TerrainModel(nn.Module):
    def __init__(self):
        super().__init__()
        self.features = mobilenet_v3_small(weights=MobileNet_V3_Small_Weights.IMAGENET1K_V1).features
        for parameter in self.features.parameters():
            parameter.requires_grad_(False)
        self.head = nn.Linear(576, 4)
        self.register_buffer("mean", torch.tensor([0.485, 0.456, 0.406]).view(1, 3, 1, 1))
        self.register_buffer("std", torch.tensor([0.229, 0.224, 0.225]).view(1, 3, 1, 1))

    def encode(self, image):
        return self.features((image-self.mean)/self.std).mean(dim=(2, 3))

    def forward(self, image):
        logits = self.head(self.encode(image))
        # Unknown is reserved by the contract, not supervised by unlabeled (255) pixels.
        unknown = torch.full_like(logits[:, :1], -100.0)
        return torch.cat((unknown, logits), dim=1)


def metrics(truth, predicted):
    matrix = np.zeros((5, 5), dtype=int)
    for actual, guess in zip(truth, predicted):
        matrix[int(actual)+1, int(guess)] += 1
    supported = [i for i in range(1, 5) if matrix[i].sum()]
    return {"accuracy": float(np.trace(matrix)/matrix.sum()),
            "balanced_accuracy_supported_classes": float(np.mean([matrix[i, i]/matrix[i].sum() for i in supported])),
            "samples": int(matrix.sum())}, matrix.tolist()


def train(data, destination):
    destination = Path(destination)
    destination.mkdir(parents=True, exist_ok=True)
    if any((destination / f"terrain_cls.{ext}").exists() for ext in ("onnx", "json")):
        raise FileExistsError("Use a fresh output directory")
    random.seed(2026)
    np.random.seed(2026)
    torch.manual_seed(2026)
    torch.set_num_threads(4)
    torch.use_deterministic_algorithms(True)
    torch.hub.set_dir(str(Path(data).parent / "torch-hub"))
    patches, manifest = load_patches(data)
    for split, rows in patches.items():
        print(split, "patches", len(rows), "class_counts", np.bincount([r[1] for r in rows], minlength=4).tolist(), flush=True)
        if not rows:
            raise ValueError(f"No usable patches in {split}")
    train_images = {r[2] for r in patches["train"]}
    assert train_images.isdisjoint(r[2] for r in patches["test"])
    assert train_images.isdisjoint(r[2] for r in patches["perseverance"])
    model = TerrainModel().eval()
    x = torch.from_numpy(np.stack([r[0] for r in patches["train"]]))
    y = torch.tensor([r[1] for r in patches["train"]])
    with torch.no_grad():
        features = torch.cat([model.encode(batch) for batch in x.split(32)])
    counts = torch.bincount(y, minlength=4)
    if (counts == 0).any():
        raise ValueError("Training subset does not cover all four terrain classes")
    weights = len(y)/(4 * counts.float())
    optimizer = torch.optim.Adam(model.head.parameters(), lr=0.01, weight_decay=0.001)
    loss_fn = nn.CrossEntropyLoss(weight=weights)
    # Fixed epoch budget chosen before examining held-out outcomes.
    for epoch in range(200):
        optimizer.zero_grad()
        loss = loss_fn(model.head(features), y)
        loss.backward()
        optimizer.step()
        if epoch % 50 == 0 or epoch == 199:
            print("epoch", epoch+1, "train_loss", float(loss.detach()), flush=True)
    model.eval()
    path = destination / "terrain_cls.onnx"
    torch.onnx.export(model, torch.zeros(1, 3, 128, 128), str(path),
                      input_names=["image"], output_names=["logits"], opset_version=17,
                      dynamo=False)
    session = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
    reports, predictions = {}, []
    for split in ("test", "perseverance"):
        guesses = []
        for pixels, label, image_id, left, top in patches[split]:
            output = session.run(None, {"image": pixels[None]})[0]
            guess = int(output.argmax(axis=1)[0])
            guesses.append(guess)
            predictions.append({"split": split, "image": image_id, "crop": [left, top, 256, 256],
                                "truth": label+1, "prediction": guess})
        summary, matrix = metrics([r[1] for r in patches[split]], guesses)
        reports[split] = {"metrics": summary, "confusion_matrix": matrix}
        print(split, json.dumps(summary), flush=True)
    sample = patches["test"][0][0][None]
    with torch.no_grad():
        expected = model(torch.from_numpy(sample)).numpy()
    actual = session.run(None, {"image": sample})[0]
    np.testing.assert_allclose(actual, expected, rtol=1e-4, atol=1e-4)
    metadata = {
        "placeholder": False,
        "data_source": ["NASA/JPL AI4Mars merged 0.6 NAV labels", manifest["record"],
                        "torchvision MobileNet_V3_Small_Weights.IMAGENET1K_V1"],
        "held_out": reports["test"]["metrics"], "confusion_matrix": reports["test"]["confusion_matrix"],
        "perseverance_transfer": reports["perseverance"],
        "architecture": "Frozen ImageNet MobileNetV3-small features + trained 576x4 linear head; fixed unknown logit -100",
        "training": {"seed": 2026, "epochs": 200, "optimizer": "Adam", "lr": 0.01, "weight_decay": 0.001,
                     "class_weighting": "inverse training frequency", "train_patches": len(y),
                     "class_counts": counts.tolist(), "final_train_loss": float(loss.detach())},
        "preprocessing": "Nonoverlapping 256x256 source crops, >=70% valid NAV labels, >=80% dominant class among valid pixels; bilinear RGB resize to128; input0..1; ImageNet normalization inside graph",
        "class_mapping": {"0": "unknown (not learned)", "1": "soil", "2": "bedrock", "3": "sand", "4": "big rock"},
        "split": manifest["split"],
        "manifest_sha256": hashlib.sha256((Path(data)/"manifest.json").read_bytes()).hexdigest(),
        "onnx_sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "runtime": {"torch": torch.__version__, "onnxruntime": ort.__version__},
        "limitations": ["Small deterministic subset, patch-level majority labels; not segmentation or a rock detector.",
                        "Nearby patches within a frame are correlated; acquisition bins reduce but cannot eliminate terrain correlation.",
                        "Unknown is not trained; unlabeled pixels are excluded, not converted into negative examples.",
                        "Perseverance NAV labels are transfer evaluation, not expert gold labels.",
                        "No calibrated confidence, safe-navigation claim or phone performance measurement."],
    }
    path.with_suffix(".json").write_text(json.dumps(metadata, indent=2)+"\n", encoding="utf-8", newline="\n")
    (destination/"predictions.json").write_text(json.dumps(predictions, indent=2)+"\n", encoding="utf-8", newline="\n")
    names, errors = check(destination)
    if errors:
        raise RuntimeError("; ".join(errors))
    print("Verified ONNX export:", names, flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("data", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    train(args.data, args.destination)
