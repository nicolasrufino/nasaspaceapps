"""Freeze and render the remaining ROSCO proposals before a reviewed-cell export.

H01-H06 retain their previously reviewed native coordinates. H07-H25 continue
the same hash order and require new human decisions; no automatic approvals.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from ml.rock_review.register_observation import verified_image
from ml.rock_review.single_observation import HERE


def prepare(native_source, native_run, destination):
    native_source, native_run, destination = Path(native_source), Path(native_run), Path(destination)
    if destination.exists():
        raise FileExistsError("Use a fresh review directory")
    meta = json.loads((HERE/"single_observation_source.json").read_text(encoding="utf-8"))
    native = verified_image(native_source/"site.png", meta, "L", "pixel_sha256")
    raw_bytes = (native_run/"detections.json").read_bytes()
    registration_bytes = (HERE/"registration_metrics.json").read_bytes()
    registration = json.loads(registration_bytes)
    if hashlib.sha256(raw_bytes).hexdigest() != registration["native_detection_file_sha256"]:
        raise ValueError("Native candidates differ from the registered run")
    records = sorted(json.loads(raw_bytes), key=lambda r: hashlib.sha256(
        f"{r['rockX']:.1f},{r['rockY']:.1f}".encode()).hexdigest())
    old_bytes = (HERE/"rosco_confidence_review.json").read_bytes()
    previous = json.loads(old_bytes)
    corrected_bytes = (HERE/"registered_candidates.json").read_bytes()
    corrected = {r["candidate_id"]: r for r in json.loads(corrected_bytes)}
    if len(records) != registration["candidates"] or len(corrected) != len(records):
        raise ValueError("Incomplete registration coverage")
    for old, rock in zip(previous["annotations"], records):
        if old["detection_id"] != rock["candidate_id"] or old["rock_point_px"] != [rock["rockX"], rock["rockY"]]:
            raise ValueError("Existing H identities would change")
    destination.mkdir(parents=True)
    font = ImageFont.load_default(size=20)
    annotations = []
    for i, rock in enumerate(records, 1):
        left = max(0, min(native.width-64, round(rock["rockX"])-32))
        top = max(0, min(native.height-64, round(rock["rockY"])-32))
        annotations.append({"id": f"H{i:02}", "detection_id": rock["candidate_id"], "status": "unreviewed",
                            "source_crop": [left, top, 64, 64],
                            "rock_point_px": [rock["rockX"], rock["rockY"]],
                            "shadow_centroid_px": [rock["shaX"], rock["shaY"]],
                            "model_width_m": rock["model_width_m"], "model_height_m": rock["model_height_m"],
                            "registered": corrected[rock["candidate_id"]]})
    remaining = annotations[len(previous["annotations"]):]
    sheets = {}
    for page in range(math.ceil(len(remaining)/3)):
        group = remaining[page*3:page*3+3]
        board = Image.new("RGB", (940, 70+480*len(group)+36), (20, 23, 28))
        draw = ImageDraw.Draw(board)
        draw.text((16, 10), "R3 | meme site de Luca | pixels originaux / reperes | 16,2 m", font=font)
        for row, candidate in enumerate(group):
            left, top, width, height = candidate["source_crop"]
            raw = native.crop((left, top, left+width, top+height)).resize((448, 448), Image.Resampling.NEAREST).convert("RGB")
            marked = raw.copy()
            md = ImageDraw.Draw(marked)
            for key, color in (("rock_point_px", "yellow"), ("shadow_centroid_px", "cyan")):
                x, y = candidate[key]
                px, py = (x-left+.5)*7, (y-top+.5)*7
                md.line((px-12, py, px+12, py), fill=color, width=2)
                md.line((px, py-12, px, py+12), fill=color, width=2)
            y = 70+row*480
            draw.text((16, y-27), f"{candidate['id']} : rocher isole avec ombre ? oui / non / incertain", font=font)
            board.paste(raw, (16, y))
            board.paste(marked, (476, y))
        filename = f"{group[0]['id']}_{group[-1]['id']}.png"
        draw.text((16, board.height-30), "Jaune : point propose du rocher | cyan : centre de l'ombre supposee", font=font)
        board.save(destination/filename)
        sheets[filename] = hashlib.sha256((destination/filename).read_bytes()).hexdigest()
    artifact = {"source_pixel_sha256": meta["pixel_sha256"],
                "native_detection_file_sha256": registration["native_detection_file_sha256"],
                "registration_file_sha256": hashlib.sha256(registration_bytes).hexdigest(),
                "registered_candidates_sha256": hashlib.sha256(corrected_bytes).hexdigest(),
                "previous_review_candidates_sha256": hashlib.sha256(old_bytes).hexdigest(),
                "selection": "All 25 frozen confidence-only candidates, same native-coordinate hash order as H01-H06",
                "annotations": annotations, "new_sheet_sha256": sheets}
    (destination/"candidates.json").write_text(json.dumps(artifact, indent=2)+"\n", encoding="utf-8", newline="\n")
    print(json.dumps({"total_candidates": len(annotations), "previously_reviewed": len(previous["annotations"]),
                      "new_review_candidates": len(remaining), "sheets": list(sheets)}), flush=True)
    return artifact


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("native_source", type=Path)
    parser.add_argument("native_run", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    prepare(args.native_source, args.native_run, args.destination)
