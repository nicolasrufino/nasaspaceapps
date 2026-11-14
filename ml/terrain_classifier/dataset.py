"""Fetch a deterministic AI4Mars 0.6 subset using verified ZIP HTTP ranges.

NASA catalog: https://catalog.data.gov/dataset/ai4mars-a-dataset-for-terrain-aware-autonomous-driving-on-mars
Only NAV labels are used: 0 soil, 1 bedrock, 2 sand, 3 big rock; 255 is ignored.
"""
import argparse
import hashlib
import io
import json
import re
import struct
import threading
import time
import urllib.error
import urllib.request
import zipfile
import zlib
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
from PIL import Image

RECORD = "https://zenodo.org/api/records/15995036"
ARCHIVE = "ai4mars-dataset-merged-0.6.zip"
_REQUEST_LOCK = threading.Lock()
_NEXT_REQUEST = 0.0


def request_range(url, start, size):
    global _NEXT_REQUEST
    if size > 1024 * 1024:
        return b"".join(request_range(url, at, min(1024 * 1024, start+size-at))
                        for at in range(start, start+size, 1024 * 1024))
    req = urllib.request.Request(url, headers={"Range": f"bytes={start}-{start + size - 1}"})
    for attempt in range(5):
        try:
            with _REQUEST_LOCK:
                time.sleep(max(0, _NEXT_REQUEST-time.monotonic()))
                _NEXT_REQUEST = time.monotonic() + 1.0
            with urllib.request.urlopen(req, timeout=45) as response:
                if response.status != 206 or not response.headers.get("Content-Range", "").startswith(f"bytes {start}-"):
                    raise ValueError("Server did not honor the byte range; refusing a full archive download")
                data = response.read(size + 1)
                if len(data) != size:
                    raise OSError(f"Incomplete archive range: wanted {size}, received {len(data)}")
            break
        except urllib.error.HTTPError as exc:
            if exc.code != 429 or attempt == 4:
                raise
            retry = max(60, int(exc.headers.get("Retry-After", "60")))
            with _REQUEST_LOCK:
                _NEXT_REQUEST = max(_NEXT_REQUEST, time.monotonic()+retry)
            print(f"Zenodo rate limit: respecting {retry}s cooldown", flush=True)
        except (OSError, TimeoutError):
            if attempt == 4:
                raise
            time.sleep(attempt + 1)
    return data


class RemoteArchive(io.RawIOBase):
    def __init__(self, url, size):
        self.url, self.size, self.position = url, size, 0

    def seekable(self):
        return True

    def seek(self, offset, whence=0):
        self.position = offset + (0 if whence == 0 else self.position if whence == 1 else self.size)
        return self.position

    def tell(self):
        return self.position

    def read(self, size=-1):
        size = min(self.size - self.position, size if size >= 0 else self.size)
        if size > 32 * 1024 * 1024:
            raise ValueError("Unexpected archive read larger than 32 MiB")
        if size <= 0:
            return b""
        data = request_range(self.url, self.position, size)
        self.position += size
        return data


def member_bytes(url, info):
    if info.file_size > 20 * 1024 * 1024:
        raise ValueError("Unexpected oversized source image")
    # One request per ordinary member, including its local header. ZIP extras can
    # be longer; fetch only the remaining bytes if that happens.
    length = 30 + len(info.filename.encode("utf-8")) + 512 + info.compress_size
    packet = request_range(url, info.header_offset, length)
    fields = struct.unpack_from("<4s5H3L2H", packet)
    if fields[0] != b"PK\x03\x04" or fields[2] & 1:
        raise ValueError("Invalid or encrypted ZIP entry")
    offset = 30 + fields[-2] + fields[-1]
    needed = offset + info.compress_size
    if needed > len(packet):
        packet += request_range(url, info.header_offset+len(packet), needed-len(packet))
    raw = packet[offset:needed]
    if info.compress_type == zipfile.ZIP_DEFLATED:
        raw = zlib.decompress(raw, -15)
    elif info.compress_type != zipfile.ZIP_STORED:
        raise ValueError("Unsupported ZIP compression")
    if len(raw) != info.file_size or zlib.crc32(raw) != info.CRC:
        raise ValueError("ZIP member failed size/CRC validation")
    return raw


def rank(name):
    return hashlib.sha256(("MartianMap-R4-v1:" + name).encode()).hexdigest()


def clock_group(name):
    # Group neighboring Curiosity acquisitions in 100,000-clock-second bins.
    match = re.search(r"N[LR][AB]_(\d{9})", name)
    if not match:
        raise ValueError(f"Unknown MSL acquisition clock: {name}")
    return int(match[1]) // 100000


def select_pairs(infos, train_count=160, test_count=40, transfer_count=40):
    images = {}
    for info in infos:
        if "/images/" in info.filename and info.filename.lower().endswith((".jpg", ".jpeg")):
            stem = Path(info.filename).stem
            # NASA notes duplicate .jpg/.jpeg images; prefer higher-quality .jpeg.
            if stem not in images or info.filename.lower().endswith(".jpeg"):
                images[stem] = info
    test = [i for i in infos if "/msl/ncam/labels/test/masked-gold-min3-100agree/" in i.filename
            and i.filename.endswith(".png")]
    held_groups = {clock_group(i.filename) for i in test}
    train = [i for i in infos if "/msl/ncam/labels/train/" in i.filename
             and i.filename.endswith(".png") and clock_group(i.filename) not in held_groups]
    transfer = [i for i in infos if "/m2020/labels/NAV/NLF_" in i.filename and i.filename.endswith(".png")]
    pairs = []
    for split, candidates, count in [("train", train, train_count), ("test", test, test_count),
                                       ("perseverance", transfer, transfer_count)]:
        chosen = []
        seen = set()
        for label in sorted(candidates, key=lambda i: rank(i.filename)):
            stem = re.sub(r"_merged.*$", "", Path(label.filename).stem)
            if stem not in images or stem in seen:
                continue
            seen.add(stem)
            chosen.append((split, images[stem], label))
            if len(chosen) == count:
                break
        if len(chosen) < count:
            raise ValueError(f"Only {len(chosen)} matched image/label pairs for {split}")
        pairs.extend(chosen)
    return pairs


def patch_label(mask):
    valid = mask < 4
    if valid.mean() < 0.7:
        return None
    counts = np.bincount(mask[valid].ravel(), minlength=4)
    winner = int(counts.argmax())
    return winner if counts[winner] / counts.sum() >= 0.8 else None


def download(destination):
    destination = Path(destination)
    destination.mkdir(parents=True, exist_ok=True)
    manifest_path = destination / "manifest.json"
    if manifest_path.exists():
        raise FileExistsError("Use a new subset directory; existing manifest is preserved")
    with urllib.request.urlopen(RECORD, timeout=30) as response:
        record = json.load(response)
    entry = next(f for f in record["files"] if f["key"] == ARCHIVE)
    url = entry["links"]["self"]
    index_path = destination / "archive-index.json"
    index = json.loads(index_path.read_text()) if index_path.exists() else None
    if index and index["checksum"] == entry["checksum"] and index["size"] == entry["size"]:
        infos = []
        for item in index["entries"]:
            info = zipfile.ZipInfo(item["filename"])
            for key in ("file_size", "compress_size", "header_offset", "compress_type", "CRC"):
                setattr(info, key, item[key])
            infos.append(info)
    else:
        with zipfile.ZipFile(RemoteArchive(url, entry["size"])) as archive:
            infos = archive.infolist()
        index = {"checksum": entry["checksum"], "size": entry["size"], "entries": [
            {key: getattr(info, key) for key in ("filename", "file_size", "compress_size", "header_offset", "compress_type", "CRC")}
            for info in infos]}
        index_path.write_text(json.dumps(index), encoding="utf-8")
    pairs = select_pairs(infos)
    print(f"Archive {entry['size']} bytes; fetching only {len(pairs)} image/label pairs", flush=True)

    def fetch(pair):
        split, image_info, label_info = pair
        result = {"split": split}
        for role, info in [("image", image_info), ("label", label_info)]:
            local = f"{split}/{role}/{Path(info.filename).name}"
            target = destination / local
            raw = target.read_bytes() if target.exists() else b""
            if len(raw) != info.file_size or zlib.crc32(raw) != info.CRC:
                raw = member_bytes(url, info)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(raw)
            result[role] = {"archive_path": info.filename, "local_path": local,
                            "sha256": hashlib.sha256(raw).hexdigest()}
        return result

    with ThreadPoolExecutor(max_workers=2) as pool:
        records = []
        for result in pool.map(fetch, pairs):
            records.append(result)
            if len(records) % 20 == 0:
                print(f"Verified {len(records)}/{len(pairs)} pairs", flush=True)
    manifest = {"record": RECORD, "archive": ARCHIVE, "archive_bytes": entry["size"],
                "archive_checksum": entry["checksum"], "selection": "SHA256 MartianMap-R4-v1 rank",
                "split": "Official MSL expert min3 test; all expert acquisition clock bins excluded from training; M2020 NAV transfer only",
                "records": records}
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"Saved {len(records)} verified source pairs to {destination}", flush=True)


def load_patches(destination):
    root = Path(destination)
    manifest = json.loads((root / "manifest.json").read_text())
    patches = {split: [] for split in ("train", "test", "perseverance")}
    for item in manifest["records"]:
        for role in ("image", "label"):
            path = root / item[role]["local_path"]
            if hashlib.sha256(path.read_bytes()).hexdigest() != item[role]["sha256"]:
                raise ValueError(f"Source integrity mismatch: {path.name}")
        image = Image.open(root / item["image"]["local_path"]).convert("RGB")
        mask = np.array(Image.open(root / item["label"]["local_path"]))
        if mask.ndim == 3:
            if not np.array_equal(mask[..., 0], mask[..., 1]) or not np.array_equal(mask[..., 0], mask[..., 2]):
                raise ValueError("Unexpected color label encoding")
            mask = mask[..., 0]
        if image.size != (mask.shape[1], mask.shape[0]):
            raise ValueError("Image and label sizes differ; no silent alignment resize")
        if not set(np.unique(mask)) <= {0, 1, 2, 3, 255}:
            raise ValueError("Only NAV labels are accepted, never geology labels")
        for y in range(0, image.height - 255, 256):
            for x in range(0, image.width - 255, 256):
                label = patch_label(mask[y:y+256, x:x+256])
                if label is None:
                    continue
                tile = image.crop((x, y, x+256, y+256)).resize((128, 128), Image.Resampling.BILINEAR)
                pixels = np.asarray(tile, dtype=np.float32).transpose(2, 0, 1) / 255
                patches[item["split"]].append((pixels, label, item["image"]["archive_path"], x, y))
    return patches, manifest


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    download(args.destination)
