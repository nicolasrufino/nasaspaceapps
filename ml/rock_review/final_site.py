"""Prepare new, unreviewed locations on Luca's final Gale world, never the old crop.

Read-only world input; source imagery and rendered outputs stay under ml/data or
ml/runs. Source is the HiRISE LRGB sharpened mosaic used by D1, not raw grayscale.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

URL = "https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/Mars/MSL/MSL_Gale_HiRISE-LRGB_78quads_sharp_cog.tif"
MARS = "+proj=longlat +a=3396190 +b=3396190 +no_defs"


def fetch(world_path, destination):
    import rasterio
    from rasterio.crs import CRS
    from rasterio.warp import transform
    from rasterio.windows import Window, from_bounds

    destination = Path(destination)
    if destination.exists():
        raise FileExistsError("Use a new image directory")
    world = json.loads(Path(world_path).read_text())
    if world["name"] != "gale" or world.get("source") != "real":
        raise ValueError("Expected Luca's real Gale world")
    site = world["site"]
    box = site["bbox_deg"]
    crs = CRS.from_string(site["projection"])
    xs, ys = transform(CRS.from_string(MARS), crs,
                       [box["west"], box["east"]], [box["north"], box["south"]])
    left, right, top, bottom = xs[0], xs[1], ys[0], ys[1]
    if not (math.isclose(right-left, world["width"]*world["cell_size_m"], abs_tol=1e-5)
            and math.isclose(top-bottom, world["height"]*world["cell_size_m"], abs_tol=1e-5)):
        raise ValueError("World dimensions do not match its projected bounding box")
    with (rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif",
                       GDAL_HTTP_TIMEOUT="60", GDAL_HTTP_MAX_RETRY="3", VSI_CACHE="TRUE"),
          rasterio.open("/vsicurl/"+URL) as source):
            # Transform actual world corners into the image CRS, even if the two
            # WKT spellings differ. Reject a rotated/nonuniform mapping.
            sx, sy = transform(crs, source.crs, [left, right, right, left], [top, top, bottom, bottom])
            if not (math.isclose(sy[0], sy[1], abs_tol=1e-5) and math.isclose(sx[0], sx[3], abs_tol=1e-5)):
                raise ValueError("World is not aligned with the native source raster")
            window = from_bounds(min(sx), min(sy), max(sx), max(sy), source.transform)
            values = [window.col_off, window.row_off, window.width, window.height]
            if not all(math.isclose(v, round(v), abs_tol=1e-4) for v in values):
                raise ValueError("World edges do not fall on native image pixels; no silent resampling")
            window = Window(*(round(v) for v in values))
            if window.col_off < 0 or window.row_off < 0 or window.col_off+window.width > source.width or window.row_off+window.height > source.height:
                raise ValueError("World lies outside source imagery")
            if not math.isclose(source.transform.a, 0.25) or not math.isclose(source.transform.e, -0.25):
                raise ValueError("Expected native north-up 25 cm imagery")
            pixels = source.read([1, 2, 3], window=window)
            valid = source.dataset_mask(window=window) > 0
            if not valid.all():
                raise ValueError("Source window contains nodata; do not generate review points silently")
            affine = source.window_transform(window)
            destination.mkdir(parents=True)
            image_path = destination / "gale_final_rgb.png"
            Image.fromarray(pixels.transpose(1, 2, 0)).save(image_path)
            meta = {
                "source_url": URL, "product": "USGS MSL Gale HiRISE LRGB 78 quads sharpened COG",
                "credit": "NASA/JPL-Caltech/USGS/University of Arizona",
                "processing": "Exact native RGB pixel window; no added resizing, sharpening or contrast change. Source mosaic itself is sharpened.",
                "source_window": [int(v) for v in (window.col_off, window.row_off, window.width, window.height)],
                "width": int(window.width), "height": int(window.height),
                "geotransform": list(affine.to_gdal()), "crs_wkt": source.crs.to_wkt(),
                "world_projection": site["projection"],
                "world_projected_bounds": [left, bottom, right, top],
                "world_name": world["name"], "world_width": world["width"], "world_height": world["height"],
                "world_cell_size_m": world["cell_size_m"], "row_order": "north_to_south",
                "world_sha256": hashlib.sha256(Path(world_path).read_bytes()).hexdigest(),
                "source_png_sha256": hashlib.sha256(image_path.read_bytes()).hexdigest(),
                "source_rgb_pixel_sha256": hashlib.sha256(pixels.transpose(1, 2, 0).tobytes()).hexdigest(),
                "solar_geometry_verified": False,
            }
            (destination/"source.json").write_text(json.dumps(meta, indent=2)+"\n", encoding="utf-8", newline="\n")
    print(json.dumps({"native_window": meta["source_window"], "source": str(image_path), "world": world["name"]}), flush=True)
    return image_path


def proposals(gray, count=50):
    """Bright components, distributed across the full site; not shadow detections."""
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (17, 17))
    response = cv2.morphologyEx(gray, cv2.MORPH_TOPHAT, kernel)
    _, labels, stats, centers = cv2.connectedComponentsWithStats((response > 18).astype(np.uint8), 8)
    regions = {}
    for i, ((x, y, w, h, area), (cx, cy)) in enumerate(zip(stats[1:], centers[1:]), 1):
        if not (8 <= area <= 220 and 3 <= w <= 22 and 3 <= h <= 22 and 32 <= cx < gray.shape[1]-32 and 32 <= cy < gray.shape[0]-32):
            continue
        signal = response[y:y+h, x:x+w][labels[y:y+h, x:x+w] == i]
        score = float(signal.mean()*math.sqrt(area))
        # 8 x 8 strata spread the sample; contrast only ranks within each stratum.
        key = (int(cy*8/gray.shape[0]), int(cx*8/gray.shape[1]))
        candidate = {"x": round(float(cx), 2), "y": round(float(cy), 2),
                     "bbox_px": [int(x), int(y), int(w), int(h)], "score": score}
        if key not in regions or score > regions[key]["score"]:
            regions[key] = candidate
    ordered = sorted(regions, key=lambda key: hashlib.sha256(str(key).encode()).hexdigest())[:count]
    selected = sorted((regions[key] for key in ordered), key=lambda c: (c["y"], c["x"]))
    if len(selected) != count:
        raise ValueError(f"Only {len(selected)} occupied strata; cannot produce {count} proposals")
    for i, candidate in enumerate(selected, 1):
        del candidate["score"]
        candidate.update(id=f"G{i:02}", status="unreviewed")
    return selected


def review(source_dir, destination):
    from rasterio.crs import CRS
    from rasterio.warp import transform

    source_dir, destination = Path(source_dir), Path(destination)
    if destination.exists():
        raise FileExistsError("Use a new review directory")
    meta = json.loads((source_dir/"source.json").read_text())
    rgb = Image.open(source_dir/"gale_final_rgb.png").convert("RGB")
    if rgb.size != (meta["width"], meta["height"]) or hashlib.sha256(rgb.tobytes()).hexdigest() != meta["source_rgb_pixel_sha256"]:
        raise ValueError("Source pixels no longer match metadata")
    rows = proposals(np.array(rgb.convert("L")))
    gt = meta["geotransform"]
    xx = [gt[0]+(r["x"]+.5)*gt[1] for r in rows]
    yy = [gt[3]+(r["y"]+.5)*gt[5] for r in rows]
    wx, wy = transform(CRS.from_wkt(meta["crs_wkt"]), CRS.from_string(meta["world_projection"]), xx, yy)
    lon, lat = transform(CRS.from_wkt(meta["crs_wkt"]), CRS.from_string(MARS), xx, yy)
    left, _, _, top = meta["world_projected_bounds"]
    for i, row in enumerate(rows):
        cell = [math.floor((wx[i]-left)/meta["world_cell_size_m"]), math.floor((top-wy[i])/meta["world_cell_size_m"])]
        if not (0 <= cell[0] < meta["world_width"] and 0 <= cell[1] < meta["world_height"]):
            raise ValueError("Review point falls outside the real world")
        row.update(world_cell=cell, longitude_east_deg=lon[i], latitude_deg=lat[i],
                   projected_m=[wx[i], wy[i]])
    destination.mkdir(parents=True)
    font = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 22) if Path("C:/Windows/Fonts/arial.ttf").exists() else ImageFont.load_default(size=22)
    overview = rgb.resize((1536, 1536), Image.Resampling.BILINEAR)
    draw = ImageDraw.Draw(overview)
    scale = 1536/rgb.width
    for row in rows:
        x, y = row["x"]*scale, row["y"]*scale
        draw.ellipse((x-8, y-8, x+8, y+8), outline="yellow", width=2)
        draw.text((x+10, y-16), row["id"], font=font, fill="yellow", stroke_width=2, stroke_fill="black")
    overview.save(destination/"final_site_overview.png")
    for page in range(5):
        board = Image.new("RGB", (1104, 1540), (22, 25, 30))
        d = ImageDraw.Draw(board)
        d.text((12, 8), "Final Gale site - NEW unreviewed proposals | raw left, marker right", font=font)
        for j, row in enumerate(rows[page*10:page*10+10]):
            x0, y0 = round(row["x"])-32, round(row["y"])-32
            tile = rgb.crop((x0, y0, x0+64, y0+64)).resize((256, 256), Image.Resampling.NEAREST)
            marked = tile.copy()
            md = ImageDraw.Draw(marked)
            cx, cy = (row["x"]-x0)*4, (row["y"]-y0)*4
            radius = (max(row["bbox_px"][2:])/2+4)*4
            md.ellipse((cx-radius, cy-radius, cx+radius, cy+radius), outline="yellow", width=3)
            x, y = 12+(j%2)*552, 80+(j//2)*300
            board.paste(tile, (x, y))
            board.paste(marked, (x+264, y))
            d.text((x, y-28), f"{row['id']} | 16 x 16 m | cell {row['world_cell']}", font=font)
        board.save(destination/f"final_site_details_{page+1}.png")
    payload = {"schema": "martian-map-final-site-review-v1", "source": meta, "review_status": "unreviewed",
               "method": "Bright-object top-hat proposals; top contrast per 8x8 stratum, hash-select 50 strata. RGB converted to grayscale for proposal generation only.",
               "limitations": ["New site: old accepted locations and their approval do not transfer.",
                               "Display circles are not measured rock boundaries; selected positives cannot establish recall.",
                               "Not a shadow detector, complete hazard inventory or rocks_fine grid."], "annotations": rows}
    (destination/"candidates.json").write_text(json.dumps(payload, indent=2)+"\n", encoding="utf-8", newline="\n")
    print(json.dumps({"proposals": len(rows), "inside_world": len(rows), "review_status": "unreviewed", "output": str(destination)}), flush=True)
    return payload


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("fetch", "review"):
        command = sub.add_parser(name)
        command.add_argument("source", type=Path)
        command.add_argument("destination", type=Path)
    args = parser.parse_args()
    (fetch if args.command == "fetch" else review)(args.source, args.destination)
