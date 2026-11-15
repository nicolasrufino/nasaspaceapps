"""Prepare 200 blind native RGB patches from PDS Ingenuity supplemental JPEGs."""
import argparse
import hashlib
import json
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from pathlib import Path
from urllib.request import urlopen

from PIL import Image

HERE = Path(__file__).parent
ROOT = "https://planetarydata.jpl.nasa.gov/img/data/mars2020/mars2020_helicam/data/sol/"
CLASSES = ("soil", "bedrock", "sand", "big_rock", "unknown")
CENTERS = ((.25, .55), (.75, .55), (.25, .85), (.75, .85))


def sha(data):
    return hashlib.sha256(data).hexdigest()


def dump(path, value):
    path.write_text(json.dumps(value, indent=2)+"\n", encoding="utf-8", newline="\n")


def select_frames(index, count=50):
    """Round-robin sols; within each sol rank label names by hash, before inference."""
    groups = [sorted(({"sol": r["sol"], "url": r["url"]+name} for name in r["labels"]),
                     key=lambda r: sha(r["url"].encode())) for r in sorted(index, key=lambda r: r["sol"])]
    selected = []
    while len(selected) < count and any(groups):
        for group in groups:
            if group and len(selected) < count:
                selected.append(group.pop(0))
    if len(selected) != count or len({r["url"] for r in selected}) != count:
        raise ValueError("Not enough distinct source frames")
    return selected


def download(url):
    if not url.startswith(ROOT) or "/../" in url:
        raise ValueError("Only official PDS Ingenuity source products are accepted")
    with urlopen(url, timeout=60) as response:
        if not response.url.startswith(ROOT):
            raise ValueError("Unexpected source redirect")
        return response.read()


def parse_label(data):
    root = ET.fromstring(data)
    for node in root.iter():
        node.tag = node.tag.rsplit("}", 1)[-1]
    jpeg = root.findtext("File_Area_Observational_Supplemental/File/file_name")
    if not jpeg or not jpeg.startswith("HSF_") or not jpeg.endswith(".JPG") or "/" in jpeg or "\\" in jpeg:
        raise ValueError("No original color JPEG in this label")
    pose = None
    for node in root.iter("Coordinate_Space_Definition"):
        frame = node.find("Coordinate_Space_Present/Coordinate_Space_Indexed")
        if frame is None or frame.findtext("coordinate_space_frame_type") != "HELI_M_FRAME":
            continue
        flight = next((i.findtext("index_value_number") for i in frame.findall("Coordinate_Space_Index")
                       if i.findtext("index_id") == "FLIGHT"), None)
        reference = node.findtext("Coordinate_Space_Reference/Coordinate_Space_Indexed/coordinate_space_frame_type")
        reference_id = node.findtext("Coordinate_Space_Reference/Local_Internal_Reference/local_identifier_reference")
        if reference is None and reference_id:
            for definition in root.iter("Coordinate_Space_Definition"):
                if reference_id in [item.text for item in definition.findall("local_identifier")]:
                    reference = definition.findtext("Coordinate_Space_Present/Coordinate_Space_Indexed/coordinate_space_frame_type")
                    break
        offset = node.find("Vector_Origin_Offset")
        if flight and offset is not None and reference == "HELI_G_FRAME":
            components = [offset.find(f"{axis}_position") for axis in "xyz"]
            if any(c is None or c.get("unit") != "m" for c in components):
                raise ValueError("Unexpected pose units")
            pose = {"flight": int(flight), "frame": "HELI_M_FRAME", "reference_frame": reference,
                    "reference_id": reference_id,
                    "solution_id": frame.findtext("solution_id"),
                    "origin_offset_m": [float(c.text) for c in components]}
            break
    if pose is None:
        raise ValueError("Missing per-image flight/pose provenance")
    return {"jpeg_name": jpeg, "product_lid": root.findtext("Identification_Area/logical_identifier"),
            "start_time": root.findtext("Observation_Area/Time_Coordinates/start_date_time"), "pose": pose,
            "height_agl_m": None, "height_status": "unvalidated; raw frame offset is not terrain-relative altitude"}


def prepare_frame(item, output):
    xml_bytes = download(item["url"])
    meta = parse_label(xml_bytes)
    jpeg_url = item["url"].rsplit("/", 1)[0]+"/"+meta["jpeg_name"]
    jpeg_bytes = download(jpeg_url)
    with Image.open(BytesIO(jpeg_bytes)) as raw:
        if raw.mode != "RGB" or raw.width < 1024 or raw.height < 1024:
            raise ValueError("Expected full-resolution RGB camera image")
        image = raw.copy()
    (output/"sources"/Path(item["url"]).name).write_bytes(xml_bytes)
    (output/"sources"/meta["jpeg_name"]).write_bytes(jpeg_bytes)
    records = []
    for position, (cx, cy) in enumerate(CENTERS, 1):
        identity = f"I{item['index']:02}-{position}"
        left, top = round(cx*image.width)-64, round(cy*image.height)-64
        patch = image.crop((left, top, left+128, top+128))
        filename = f"patches/{identity}.png"
        patch.save(output/filename)
        records.append({"id": identity, "file": filename, "pixel_sha256": sha(patch.tobytes()),
                        "source_product": meta["product_lid"], "source_jpeg_url": jpeg_url,
                        "source_jpeg_sha256": sha(jpeg_bytes), "source_xml_url": item["url"],
                        "source_xml_sha256": sha(xml_bytes), "source_size": list(image.size),
                        "crop_xywh": [left, top, 128, 128], "sol": item["sol"],
                        "start_time": meta["start_time"], "pose": meta["pose"],
                        "height_agl_m": None, "height_status": meta["height_status"],
                        "label": None, "reviewer": None, "split": "held_out_transfer_test"})
    print(f"Prepared frame {item['index']:02}: sol {item['sol']}, flight {meta['pose']['flight']}", flush=True)
    return records


def run(destination):
    if destination.exists():
        raise FileExistsError("Use a fresh destination; never overwrite human reviews")
    index_bytes = (HERE/"source_index.json").read_text(encoding="utf-8").encode("utf-8")
    selected = select_frames(json.loads(index_bytes))
    for name in ("sources", "patches"):
        (destination/name).mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=4) as executor:
        batches = list(executor.map(lambda row: prepare_frame(row, destination),
                                    [dict(r, index=i) for i, r in enumerate(selected, 1)]))
    records = [r for batch in batches for r in batch]
    manifest = {"credit": "NASA/JPL-Caltech, Mars 2020 Helicopter Camera PDS bundle, doi:10.17189/1522845",
                "source_index_sha256": sha(index_bytes),
                "selection": "50 frames: round-robin ascending sols, SHA-256 URL order within sol; four fixed 128x128 native crops per frame",
                "processing": "Decode original PDS supplemental JPEG to RGB; crop only; no resize, enhancement or inferred labels",
                "records": records}
    dump(destination/"manifest.json", manifest)
    manifest_sha = sha((destination/"manifest.json").read_bytes())
    summary = {"manifest_sha256": manifest_sha, "source_index_sha256": sha(index_bytes),
               "frames": len(selected), "patches": len(records),
               "flights": sorted({r["pose"]["flight"] for r in records}),
               "reviewed": 0, "validated_height_agl": 0, "accuracy": None, "flight_height_decision": None,
               "status": "Ready for blind human annotation; not an evaluated or altitude-stratified benchmark"}
    dump(destination/"summary.json", summary)
    from ml.ingenuity_review.build_review import build

    build(destination, destination/"review.html")
    print(json.dumps(summary), flush=True)
    return summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("destination", type=Path)
    run(parser.parse_args().destination)
