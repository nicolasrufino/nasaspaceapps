"""Fetch a sealed Curiosity expert test, excluding every previously tested clock bin."""
import argparse
import hashlib
import json
import re
import urllib.request
import zipfile
import zlib
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from ml.terrain_classifier.dataset import (
    ARCHIVE,
    RECORD,
    clock_group,
    member_bytes,
    rank,
)


def select_fresh(infos, old_records, count=80):
    excluded = {clock_group(r["image"]["archive_path"]) for r in old_records if r["split"] != "perseverance"}
    images = {}
    for info in infos:
        if "/msl/" in info.filename and "/images/" in info.filename and info.filename.lower().endswith((".jpg", ".jpeg")):
            stem = Path(info.filename).stem
            if stem not in images or info.filename.lower().endswith(".jpeg"):
                images[stem] = info
    groups = {}
    seen = set()
    for label in sorted(infos, key=lambda i: rank(i.filename)):
        if "/msl/ncam/labels/test/masked-gold-min3-100agree/" not in label.filename or not label.filename.endswith(".png"):
            continue
        group = clock_group(label.filename)
        stem = re.sub(r"_merged.*$", "", Path(label.filename).stem)
        if group not in excluded and stem in images and stem not in seen:
            groups.setdefault(group, []).append((images[stem], label))
            seen.add(stem)
    # Round-robin bins before taking more frames from the same acquisition period.
    ordered = sorted(groups, key=lambda g: rank(str(g)))
    pairs = []
    while ordered and len(pairs) < count:
        for group in ordered:
            if groups[group] and len(pairs) < count:
                pairs.append(groups[group].pop(0))
        ordered = [g for g in ordered if groups[g]]
    if len(pairs) < count:
        raise ValueError(f"Only {len(pairs)} fresh matched images; requested {count}")
    return pairs


def download(source, destination):
    source, destination = Path(source), Path(destination)
    destination.mkdir(parents=True, exist_ok=True)
    if (destination / "manifest.json").exists():
        raise FileExistsError("Preserve the sealed test; choose a fresh directory")
    old = json.loads((source / "manifest.json").read_text())
    index = json.loads((source / "archive-index.json").read_text())
    with urllib.request.urlopen(RECORD, timeout=30) as response:
        record = json.load(response)
    entry = next(f for f in record["files"] if f["key"] == ARCHIVE)
    if (entry["checksum"], entry["size"]) != (index["checksum"], index["size"]):
        raise ValueError("Cached archive index does not match the published release")
    infos = []
    for item in index["entries"]:
        info = zipfile.ZipInfo(item["filename"])
        for key in ("file_size", "compress_size", "header_offset", "compress_type", "CRC"):
            setattr(info, key, item[key])
        infos.append(info)
    pairs = select_fresh(infos, old["records"])
    selection = {"protocol": "gale-ground-head-v2", "count": len(pairs),
                 "source_manifest_sha256": hashlib.sha256((source / "manifest.json").read_bytes()).hexdigest(),
                 "image_ids": [a.filename for a, _ in pairs]}
    (destination / "selection.json").write_text(json.dumps(selection, indent=2)+"\n", encoding="utf-8")

    def fetch(pair):
        result = {"split": "test"}
        for role, info in zip(("image", "label"), pair):
            local = f"test/{role}/{Path(info.filename).name}"
            target = destination / local
            raw = target.read_bytes() if target.exists() else b""
            if len(raw) != info.file_size or zlib.crc32(raw) != info.CRC:
                raw = member_bytes(entry["links"]["self"], info)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(raw)
            result[role] = {"archive_path": info.filename, "local_path": local,
                            "sha256": hashlib.sha256(raw).hexdigest()}
        return result

    records = []
    with ThreadPoolExecutor(max_workers=2) as pool:
        for result in pool.map(fetch, pairs):
            records.append(result)
            if len(records) % 10 == 0:
                print(f"Verified fresh expert pairs {len(records)}/{len(pairs)}", flush=True)
    manifest = {"record": RECORD, "archive": ARCHIVE, "archive_checksum": entry["checksum"],
                "selection": selection,
                "split": "Expert Curiosity test; excludes all original train and test 100000-second clock bins",
                "records": records}
    (destination / "manifest.json").write_text(json.dumps(manifest, indent=2)+"\n", encoding="utf-8", newline="\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    download(args.source, args.destination)
