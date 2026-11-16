"""Fetch the v2 Perseverance split: a fresh sol-blocked test and training frames from other blocks.

    python -m ml.terrain_classifier.v2_data ml/data/ai4mars-subset-v1 ml/data/perseverance-v2 [ml/data/m2020-extra]

Reuses the cached AI4Mars 0.6 archive index from the v1 subset. Training reuses the 40 retired
transfer frames and any already-fetched frames named in optional extra manifests, dropping those
that fall in a test block; files are re-verified by ZIP CRC either way.
"""
import argparse
import hashlib
import json
import re
import urllib.request
import zipfile
import zlib
from pathlib import Path

from ml.terrain_classifier.dataset import ARCHIVE, RECORD, member_bytes
from ml.terrain_classifier import v2_protocol as P


def sol(name):
    return int(re.search(r"NLF_(\d{4})_", name)[1])


def block(name):
    return sol(name) // P.BLOCK_SOLS


def h(text):
    return hashlib.sha256(f"{P.ID}:{text}".encode()).hexdigest()


def stem(label_name):
    return re.sub(r"_merged.*$", "", Path(label_name).stem)


def split(infos, reused_stems):
    images = {Path(i.filename).stem: i for i in infos.values()
              if "/m2020/images/" in i.filename and i.filename.lower().endswith((".jpg", ".jpeg"))}
    labels = {}
    for i in infos.values():
        if "/m2020/labels/NAV/NLF_" in i.filename and i.filename.endswith(".png") and stem(i.filename) in images:
            labels.setdefault(stem(i.filename), i)  # one label per frame
    blocks = sorted({block(s) for s in labels})
    test_blocks = set(sorted(blocks, key=lambda b: h(f"block:{b}"))[:P.TEST_BLOCKS])
    pool = sorted(labels, key=lambda s: h(f"frame:{s}"))
    test = [s for s in pool if block(s) in test_blocks][:P.TEST_FRAMES]
    reused = [s for s in reused_stems if s in labels and block(s) not in test_blocks]
    new = [s for s in pool if block(s) not in test_blocks and s not in set(reused)][:P.NEW_TRAIN_FRAMES]
    assert not {block(s) for s in test} & {block(s) for s in reused + new}
    return images, labels, sorted(test_blocks), test, reused + new


def drop_mismatched(destination, records):
    """AI4Mars has M2020 frames whose label mask differs in size from the image; never resize, drop them."""
    from PIL import Image
    kept, dropped = [], []
    for r in records:
        image = Image.open(Path(destination) / r["image"]["local_path"]).size
        label = Image.open(Path(destination) / r["label"]["local_path"]).size
        (kept if image == label else dropped).append(r)
    return kept, [r["image"]["archive_path"] for r in dropped]


def main(subset, destination, extras):
    subset, destination = Path(subset), Path(destination)
    destination.mkdir(parents=True, exist_ok=True)
    if (destination / "manifest.json").exists():
        raise FileExistsError("Use a fresh directory")
    index = json.loads((subset / "archive-index.json").read_text())
    infos = {}
    for e in index["entries"]:
        info = zipfile.ZipInfo(e["filename"])
        for key in ("file_size", "compress_size", "header_offset", "compress_type", "CRC"):
            setattr(info, key, e[key])
        infos[e["filename"]] = info
    local = {}
    for root in [subset, *map(Path, extras)]:
        for r in json.loads((root / "manifest.json").read_text())["records"]:
            for role in ("image", "label"):
                local[r[role]["archive_path"]] = root / r[role]["local_path"]
    reused = [Path(p).stem for p in local if "/m2020/images/" in p]
    images, labels, test_blocks, test, train = split(infos, sorted(reused))
    with urllib.request.urlopen(RECORD, timeout=30) as response:
        url = next(f for f in json.load(response)["files"] if f["key"] == ARCHIVE)["links"]["self"]
    records = []
    for part, stems in (("test", test), ("train", train)):
        for n, s in enumerate(stems):
            record = {"split": part, "sol": sol(s), "block": block(s)}
            for role, info in (("image", images[s]), ("label", labels[s])):
                path = local.get(info.filename)
                raw = path.read_bytes() if path and path.exists() else b""
                if len(raw) != info.file_size or zlib.crc32(raw) != info.CRC:
                    raw = member_bytes(url, info)
                target = destination / part / role / Path(info.filename).name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(raw)
                record[role] = {"archive_path": info.filename, "local_path": str(target.relative_to(destination)),
                                "sha256": hashlib.sha256(raw).hexdigest()}
            records.append(record)
            if (n + 1) % 20 == 0:
                print(part, n + 1, "/", len(stems), flush=True)
    records, mismatched = drop_mismatched(destination, records)
    manifest = {"record": RECORD, "archive": ARCHIVE, "protocol": P.ID, "block_sols": P.BLOCK_SOLS,
                "test_blocks": test_blocks, "counts": {p: sum(r["split"] == p for r in records) for p in ("test", "train")},
                "dropped_size_mismatch": mismatched, "records": records}
    (destination / "manifest.json").write_text(json.dumps(manifest, indent=1) + "\n", encoding="utf-8", newline="\n")
    print("saved", manifest["counts"], "test blocks", test_blocks, flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("subset", type=Path)
    parser.add_argument("destination", type=Path)
    parser.add_argument("extras", nargs="*")
    args = parser.parse_args()
    main(args.subset, args.destination, args.extras)
