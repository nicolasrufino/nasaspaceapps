"""Evaluate a frozen ONNX model only against independently reviewed Ingenuity labels."""
import argparse
import json
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image

from ml.ingenuity_review.prepare import CLASSES, dump, sha

# CONTRACTS section 2: unknown, soil, bedrock, sand, big rock.
OUTPUT_CLASSES = ("unknown", "soil", "bedrock", "sand", "big_rock")


def validate_review(manifest_bytes, review):
    records = json.loads(manifest_bytes)["records"]
    if (review.get("review_mode", "blind") != "blind" or review.get("independent_human_test") is False
            or review.get("suggestion_model_sha256")
            or any(r.get("suggestion") is not None for r in review.get("annotations", []))):
        raise ValueError("Assisted annotations are not an independent test; obtain a separate blind review")
    if review.get("manifest_sha256") != sha(manifest_bytes):
        raise ValueError("Review belongs to another manifest")
    if not isinstance(review.get("reviewer"), str) or not review["reviewer"].strip():
        raise ValueError("Independent reviewer must be identified")
    rows = review["annotations"]
    ids = [r["id"] for r in rows]
    expected = [r["id"] for r in records]
    if len(ids) != len(set(ids)) or set(ids) != set(expected):
        raise ValueError("Missing, duplicate or foreign patch IDs")
    if any(r.get("label") not in (*CLASSES, None) for r in rows):
        raise ValueError("Invalid label")
    return {r["id"]: r.get("label") for r in rows}


def score(rows):
    usable = [r for r in rows if r["label"] in CLASSES[:4]]
    confusion = np.zeros((4, 5), dtype=int)
    for row in usable:
        confusion[CLASSES.index(row["label"]), OUTPUT_CLASSES.index(row["prediction"])] += 1
    supported = confusion.sum(axis=1) > 0
    recalls = [float(confusion[i, i+1]/confusion[i].sum()) if supported[i] else None for i in range(4)]
    return {"patches": len(rows), "reviewed": sum(r["label"] is not None for r in rows),
            "unknown_excluded": sum(r["label"] == "unknown" for r in rows),
            "scored": len(usable), "confusion_matrix": confusion.tolist(),
            "accuracy": sum(r["label"] == r["prediction"] for r in usable)/len(usable) if usable else None,
            "recall": dict(zip(CLASSES[:4], recalls)),
            "balanced_accuracy_supported_classes": float(np.mean([r for r in recalls if r is not None])) if usable else None}


def run(pack, model, destination, review_path=None):
    if destination.exists():
        raise FileExistsError("Use a fresh evaluation directory")
    raw = (pack/"manifest.json").read_bytes()
    manifest = json.loads(raw)
    labels = validate_review(raw, json.loads(review_path.read_bytes())) if review_path else {}
    session = ort.InferenceSession(str(model), providers=["CPUExecutionProvider"])
    rows = []
    for row in manifest["records"]:
        path = (pack/row["file"]).resolve()
        if not path.is_relative_to(pack.resolve()):
            raise ValueError("Patch path outside pack")
        with Image.open(path) as image:
            if image.mode != "RGB" or image.size != (128, 128) or sha(image.tobytes()) != row["pixel_sha256"]:
                raise ValueError("Patch differs from frozen native pixels")
            value = np.asarray(image, dtype=np.float32).transpose(2, 0, 1)[None]/255
        output = session.run(None, {session.get_inputs()[0].name: value})[0]
        if output.shape != (1, 5) or not np.isfinite(output).all():
            raise ValueError("Invalid classifier output")
        rows.append({"id": row["id"], "flight": row["pose"]["flight"],
                     "label": labels.get(row["id"]), "prediction": OUTPUT_CLASSES[int(output.argmax())]})
    result = {"manifest_sha256": sha(raw), "model_sha256": sha(model.read_bytes()),
              "review_sha256": sha(review_path.read_bytes()) if review_path else None,
              "row_classes": list(CLASSES[:4]), "column_classes": list(OUTPUT_CLASSES),
              "overall": score(rows),
              "by_flight": {str(f): score([r for r in rows if r["flight"] == f]) for f in sorted({r["flight"] for r in rows})},
              "height_stratified": False, "flight_height_decision": None,
              "limitations": ["Patches from one frame/flight are correlated; patch count is not an independent sample count.",
                              "Unknown/mixed patches excluded from accuracy and counted separately.",
                              "This measures terrain classification, not obstacle height, flight safety or occupancy.",
                              "Per-image terrain-relative altitude is unvalidated; no 4 m versus 10 m comparison."]}
    destination.mkdir(parents=True)
    dump(destination/"predictions.json", rows)
    dump(destination/"metrics.json", result)
    print(json.dumps({"reviewed": result["overall"]["reviewed"], "scored": result["overall"]["scored"],
                      "accuracy": result["overall"]["accuracy"], "model_sha256": result["model_sha256"]}))
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("pack", "model", "destination"):
        parser.add_argument(name, type=Path)
    parser.add_argument("--review", type=Path)
    args = parser.parse_args()
    run(args.pack, args.model, args.destination, args.review)
