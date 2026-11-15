"""Build a larger, acquisition-separated Curiosity NAV subset with rock coverage.

Uses verified ZIP ranges, including one contiguous 77 MB label region instead
of thousands of individual label requests. Images remain selectively fetched.
"""
import argparse
import hashlib
import io
import json
import shutil
import struct
import urllib.request
import zipfile
import zlib
from collections import Counter
from pathlib import Path

import numpy as np
from PIL import Image

from ml.terrain_classifier.dataset import (
    ARCHIVE,
    RECORD,
    clock_group,
    patch_label,
    request_range,
)

SEED = "MartianMap-expanded-v3:"


def ranked(value):
    return hashlib.sha256((SEED + str(value)).encode()).hexdigest()


def group_split(group, old_fit, expert):
    if group in expert:
        return "excluded"
    if group in old_fit:
        return "train"
    bucket = int(ranked(group), 16) % 10
    return "test" if bucket == 0 else "validation" if bucket in (1, 2) else "train"


def decode_member(packet, info, start):
    offset = info.header_offset - start
    fields = struct.unpack_from("<4s5H3L2H", packet, offset)
    if fields[0] != b"PK\x03\x04" or fields[2] & 1 or info.file_size > 20*1024*1024:
        raise ValueError("Invalid, encrypted or oversized member")
    offset += 30 + fields[-2] + fields[-1]
    raw = packet[offset:offset+info.compress_size]
    if info.compress_type == zipfile.ZIP_DEFLATED:
        raw = zlib.decompress(raw, -15)
    elif info.compress_type != zipfile.ZIP_STORED:
        raise ValueError("Unsupported compression")
    if len(raw) != info.file_size or zlib.crc32(raw) != info.CRC:
        raise ValueError("Source CRC/size mismatch")
    return raw


def member_end(info):
    return info.header_offset + 30 + len(info.filename.encode()) + 512 + info.compress_size


def windows(infos, gap=128*1024, maximum=1024*1024):
    result = []
    for info in sorted(infos, key=lambda i: i.header_offset):
        if result and info.header_offset - result[-1][1] <= gap and member_end(info)-result[-1][0] <= maximum:
            result[-1][1] = max(result[-1][1], member_end(info))
            result[-1][2].append(info)
        else:
            result.append([info.header_offset, member_end(info), [info]])
    return result


def cached_range(url, start, size, cache):
    path = cache / f"{start}-{size}.bin"
    if path.exists() and path.stat().st_size == size:
        return path.read_bytes()
    raw = request_range(url, start, size)
    path.write_bytes(raw)
    return raw


def choose(candidates, count, selected=()):
    """Round-robin acquisition bins before repeating one; deterministic rank."""
    selected = set(selected)
    buckets = {}
    for item in sorted(candidates, key=lambda x: ranked(x["stem"])):
        if item["stem"] not in selected:
            buckets.setdefault(item["group"], []).append(item)
    result = []
    keys = sorted(buckets, key=ranked)
    while keys and len(result) < count:
        for key in keys:
            if len(result) < count and buckets[key]:
                result.append(buckets[key].pop(0))
        keys = [k for k in keys if buckets[k]]
    return result


def build(source, destination):
    source, destination = Path(source), Path(destination)
    destination.mkdir(parents=True, exist_ok=True)
    if (destination / "manifest.json").exists():
        raise FileExistsError("Preserve existing manifests")
    cache = destination / "range-cache"
    cache.mkdir(exist_ok=True)
    old = json.loads((source / "manifest.json").read_text())
    index = json.loads((source / "archive-index.json").read_text())
    with urllib.request.urlopen(RECORD, timeout=30) as response:
        entry = next(f for f in json.load(response)["files"] if f["key"] == ARCHIVE)
    if (entry["checksum"], entry["size"]) != (index["checksum"], index["size"]):
        raise ValueError("Archive differs from cached index")
    infos = []
    for item in index["entries"]:
        info = zipfile.ZipInfo(item["filename"])
        for key in ("file_size", "compress_size", "header_offset", "compress_type", "CRC"):
            setattr(info, key, item[key])
        infos.append(info)
    labels = [i for i in infos if "/msl/ncam/labels/train/" in i.filename and i.filename.endswith(".png")]
    expert = {clock_group(i.filename) for i in infos if "/msl/ncam/labels/test/" in i.filename and i.filename.endswith(".png")}
    old_records = [r for r in old["records"] if r["split"] == "train"]
    old_fit = {clock_group(r["image"]["archive_path"]) for r in old_records}
    images = {}
    for info in infos:
        if "/msl/ncam/images/" in info.filename and info.filename.lower().endswith((".jpg", ".jpeg")):
            stem = Path(info.filename).stem
            if stem not in images or info.filename.lower().endswith(".jpeg"):
                images[stem] = info
    lo, hi = min(i.header_offset for i in labels), max(member_end(i) for i in labels)
    if hi-lo > 100*1024*1024:
        raise ValueError("Refusing unexpectedly large label region")
    chunks = []
    for at in range(lo, hi, 1024*1024):
        chunks.append(cached_range(entry["links"]["self"], at, min(1024*1024, hi-at), cache))
        if len(chunks) % 10 == 0:
            print("label archive MB downloaded", len(chunks), flush=True)
    packet = b"".join(chunks)
    candidates, raw_labels = [], {}
    for n, info in enumerate(labels):
        stem = Path(info.filename).stem
        group = clock_group(stem)
        split = group_split(group, old_fit, expert)
        if split == "excluded" or stem not in images:
            continue
        raw = decode_member(packet, info, lo)
        mask = np.array(Image.open(io.BytesIO(raw)))
        if mask.ndim == 3:
            if not np.array_equal(mask[..., 0], mask[..., 1]) or not np.array_equal(mask[..., 0], mask[..., 2]):
                raise ValueError("Unexpected color labels")
            mask = mask[..., 0]
        if not set(np.unique(mask)) <= {0, 1, 2, 3, 255}:
            raise ValueError("Non-NAV labels")
        counts = [0]*4
        for y in range(0, mask.shape[0]-255, 256):
            for x in range(0, mask.shape[1]-255, 256):
                label = patch_label(mask[y:y+256, x:x+256])
                if label is not None:
                    counts[label] += 1
        if sum(counts):
            candidates.append({"stem": stem, "group": group, "split": split, "counts": counts})
            raw_labels[stem] = (info, raw)
        if n % 2000 == 0:
            print("label screening", n, "of", len(labels), flush=True)
    by_split = {s: [r for r in candidates if r["split"] == s] for s in ("train", "validation", "test")}
    old_stems = {Path(r["image"]["archive_path"]).stem for r in old_records}
    training = [r for r in by_split["train"] if r["stem"] in old_stems]
    # Fixed sampling before training: enlarge coverage and enrich rare big-rock frames.
    training += choose([r for r in by_split["train"] if r["counts"][3]], 80, old_stems)
    training += choose(by_split["train"], 640-len(training), [r["stem"] for r in training])
    validation = choose([r for r in by_split["validation"] if r["counts"][3]], 32)
    validation += choose(by_split["validation"], 96-len(validation), [r["stem"] for r in validation])
    testing = choose(by_split["test"], 128)
    challenge = choose([r for r in by_split["test"] if r["counts"][3]], 64, [r["stem"] for r in testing])
    selections = {"train": training, "validation": validation, "test": testing, "rock_challenge": challenge}
    if len(training) != 640 or len(validation) != 96 or len(testing) != 128:
        raise ValueError("Insufficient source frames for the predeclared selection")
    selection = {"version": 3, "source": "AI4Mars 0.6 Curiosity NAV ground photos, crowd consensus labels",
                 "policy": "All expert bins excluded; all old fitting bins forced into train; new hash bins 0 test, 1/2 validation, others train. Train/validation rock enriched; random test and separate rock challenge.",
                 "old_training_manifest_sha256": hashlib.sha256((source / "manifest.json").read_bytes()).hexdigest(),
                 "splits": selections}
    (destination / "selection.json").write_text(json.dumps(selection, indent=2)+"\n", encoding="utf-8")
    for split, rows in selections.items():
        print("selected", split, "frames", len(rows), "patch classes", np.sum([r["counts"] for r in rows], axis=0).tolist(),
              "groups", len({r["group"] for r in rows}), flush=True)
    local_images = destination / "images"
    local_images.mkdir(exist_ok=True)
    chosen_stems = {r["stem"] for rows in selections.values() for r in rows}
    for record in old_records:
        stem = Path(record["image"]["archive_path"]).stem
        if stem in chosen_stems:
            path = source / record["image"]["local_path"]
            if hashlib.sha256(path.read_bytes()).hexdigest() != record["image"]["sha256"]:
                raise ValueError("Old source checksum mismatch")
            if record["image"]["archive_path"] == images[stem].filename:
                shutil.copyfile(path, local_images / Path(images[stem].filename).name)
    needed = []
    for stem in chosen_stems:
        info = images[stem]
        path = local_images / Path(info.filename).name
        if not path.exists() or len(path.read_bytes()) != info.file_size or zlib.crc32(path.read_bytes()) != info.CRC:
            needed.append(info)
    batches = windows(needed)
    print("fetching new images", len(needed), "in range requests", len(batches), flush=True)
    for n, (start, end, members) in enumerate(batches):
        raw = cached_range(entry["links"]["self"], start, end-start, cache)
        for info in members:
            (local_images / Path(info.filename).name).write_bytes(decode_member(raw, info, start))
        if (n+1) % 20 == 0:
            print("image batches", n+1, "of", len(batches), flush=True)
    records = []
    for split, rows in selections.items():
        for row in rows:
            stem = row["stem"]
            info, raw = raw_labels[stem]
            local = f"labels/{Path(info.filename).name}"
            (destination / "labels").mkdir(exist_ok=True)
            (destination / local).write_bytes(raw)
            image_path = f"images/{Path(images[stem].filename).name}"
            records.append({"split": split, "image": {"archive_path": images[stem].filename, "local_path": image_path,
                            "sha256": hashlib.sha256((destination / image_path).read_bytes()).hexdigest()},
                            "label": {"archive_path": info.filename, "local_path": local, "sha256": hashlib.sha256(raw).hexdigest()}})
    manifest = {"record": RECORD, "archive": ARCHIVE, "archive_checksum": entry["checksum"],
                "selection": selection["policy"], "label_quality": "crowd consensus, not expert gold",
                "records": records}
    (destination / "manifest.json").write_text(json.dumps(manifest, indent=2)+"\n", encoding="utf-8", newline="\n")
    print("Saved manifest", Counter(r["split"] for r in records), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    build(args.source, args.destination)
