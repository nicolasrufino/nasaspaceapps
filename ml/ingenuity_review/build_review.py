"""Build a self-contained review page; optional model suggestions need confirmation."""
import argparse
import base64
import json
import re
from pathlib import Path

from PIL import Image

from ml.ingenuity_review.prepare import CLASSES, HERE, sha


def build(pack, output, suggestions=None):
    raw = (pack/"manifest.json").read_bytes()
    manifest_sha = sha(raw)
    records = json.loads(raw)["records"]
    ids = [r["id"] for r in records]
    if len(set(ids)) != len(ids):
        raise ValueError("Duplicate patch IDs")
    proposed, model_sha = {}, None
    if suggestions:
        metrics = json.loads((suggestions/"metrics.json").read_bytes())
        prediction_rows = json.loads((suggestions/"predictions.json").read_bytes())
        model_sha = metrics.get("model_sha256", "")
        if metrics.get("manifest_sha256") != manifest_sha or not re.fullmatch(r"[0-9a-f]{64}", model_sha):
            raise ValueError("Suggestions have different or missing provenance")
        proposed = {r["id"]: r["prediction"] for r in prediction_rows}
        if len(proposed) != len(prediction_rows) or set(proposed) != set(ids):
            raise ValueError("Incomplete, duplicate or foreign suggestions")
        if any(v not in CLASSES for v in proposed.values()):
            raise ValueError("Invalid suggested class")
    embedded = []
    for row in records:
        path = (pack/row["file"]).resolve()
        if not path.is_relative_to(pack.resolve()):
            raise ValueError("Patch outside pack")
        with Image.open(path) as image:
            if (image.format != "PNG" or image.mode != "RGB" or image.size != (128, 128)
                    or sha(image.tobytes()) != row["pixel_sha256"]):
                raise ValueError("Patch differs from frozen pixels")
        embedded.append({"id": row["id"], "image": "data:image/png;base64,"+base64.b64encode(path.read_bytes()).decode(),
                         "suggestion": proposed.get(row["id"])})
    data = {"manifest_sha256": manifest_sha, "review_mode": "assisted" if suggestions else "blind",
            "suggestion_model_sha256": model_sha, "records": embedded}
    html = (HERE/"review.html").read_text(encoding="utf-8")
    html = html.replace("__PACK_DATA__", json.dumps(data, ensure_ascii=False).replace("<", "\\u003c"))
    html = html.replace("__REVIEW_JS__", (HERE/"review.js").read_text(encoding="utf-8"))
    output.write_text(html, encoding="utf-8", newline="\n")
    print(json.dumps({"images_embedded": len(embedded), "suggestions": len(proposed), "confirmed": 0,
                      "review_mode": data["review_mode"], "bytes": output.stat().st_size}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pack", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--suggestions", type=Path)
    args = parser.parse_args()
    build(args.pack, args.output, args.suggestions)
