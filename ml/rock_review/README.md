# Gale starter rock review — R1 / issue #31

This handoff makes the same starter review available to Jules, Luca and Nicolas. **Jules has visually accepted all 50 numbered circles in the first delivered image as corresponding to rocks.** Their positions lie on a real 256 × 256 m Gale crop. The proposals use bright-object morphology; this is **preparation for R1**, not the completed shadow-based detector, a trained model, a final hazard map or a measured accuracy result. Issue #31 remains open.

## Start here

The review ZIP (source PNG, numbered overview, two enlarged sheets and coordinates) was sent directly to Galsan on 2026-11-14. Keep source imagery in ignored `ml/data/` and generated previews in ignored `ml/runs/`; raw imagery, datasets and rendered review images are not committed here.

- `candidates_unreviewed.json`: frozen initial review artifact, IDs 1–50 with pixel/map coordinates and provenance. All statuses are `unreviewed`; it is not a training dataset or `ml/exports/rocks.json`.
- `candidates_reviewed.json`: current review result. All original IDs 1–50 are `accepted` by Jules. Positions and marker sizes are unchanged; acceptance covers visible correspondence to rocks, not precise contours or missed rocks.
- `source.json`: public source URL, exact crop window, projection, footprint, original PNG SHA-256 and grayscale-pixel SHA-256.
- `prepare_review.py`: reproducible candidate proposal and image renderer for this specific crop. It refuses to overwrite an existing review JSON.
- [HANDOFF.md](HANDOFF.md): complete technical instructions for Luca.
- [CI_STATUS.md](CI_STATUS.md): validation history and current reproduction instructions.

## Who does what next

| Owner | Next action | Where to report |
|---|---|---|
| Jules (`julesrumeautennis-cmd`) | Visual review of the first 50 circles is complete; continue shadow-based detection and validation, then produce the agreed rock-density/mask output | #31 and this handoff PR |
| Luca (GitHub handle pending) | Confirm the final 2 × 2 km region, whether this small test patch belongs to it, and supply aligned imagery/DEM plus world-grid metadata | #13; link the resulting world folder |
| Nicolas (`nicolasrufino`) | Continue the app/3D/minimap against the world contract; consume validated world files when available | App issues and the handoff PR |

**Nothing needs to be manually copied to another map.** Candidate coordinates are already recorded. Integration must use the same footprint and a compatible Mars coordinate system. The 3D terrain comes from a DEM, not from this PNG. Display circles are approximate markers and must not be rasterized as measured rock footprints.

Nicolas can keep building against `data/worlds/synthetic/`. This review artifact does not replace `rocks_fine.u8`, change the world contract or enable an app feature.

## Location and scale

| Item | Value |
|---|---|
| Source | USGS MSL Gale Merged Orthophoto Mosaic, 25 cm, v3 |
| Approximate center | latitude −4.720°, longitude 137.375° East |
| Crop | 1024 × 1024 pixels; 256 × 256 m; north up, east right |
| Raster sampling | 0.25 m/pixel; not a guarantee of 25 cm object recognition |
| Source window | x=65942, y=153938, width=1024, height=1024, zero-based |
| Geotransform | `[8142733.5, 0.25, 0, -279648.5, 0, -0.25]` |
| Projection | Mars sphere radius 3396190 m, equirectangular, central longitude 0°, standard parallel 0° |
| Site choice | Test patch; final team region is not confirmed by this handoff |

[Official source and credits](https://astrogeology.usgs.gov/search/map/mars_msl_gale_merged_orthophoto_mosaic_25cm): Calef III and Parker / NASA / JPL-Caltech / USGS / University of Arizona.

## Reproduce the review

From the repository root, use the ML environment in `ml/AGENTS.md`, or install just the review dependencies:

```sh
python -m pip install numpy Pillow opencv-python-headless
python ml/rock_review/prepare_review.py ml/data/Gale_HiRISE_starter_25cm.png ml/runs/gale_review_001
```

The source PNG in Luca's ZIP contains the crop metadata. To independently retrieve the same window from the public NASA/USGS raster, a GDAL installation can use:

```sh
gdal_translate -srcwin 65942 153938 1024 1024 -of PNG /vsicurl/https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/MSL_Gale_Orthophoto_Mosaic_25cm_v3.tif ml/data/Gale_HiRISE_starter_25cm.png
python ml/rock_review/prepare_review.py ml/data/Gale_HiRISE_starter_25cm.png ml/runs/gale_review_002 --metadata ml/rock_review/source.json
```

Create `ml/data/` first. The GDAL retrieval is an alternative recipe; the handoff was generated from a range-read extraction of the stated source window. PNG encoders may produce different file hashes for identical pixels. With `--metadata`, the script checks the grayscale-pixel hash before assigning the crop's coordinates.

Outputs: `Gale_50_rock_candidates.png`, `review_details_1.png`, `review_details_2.png`, `rock_candidates_review.json`. The overview has a 60-pixel footer below the 1024 image rows; all coordinates refer to the source image without the footer. Each review tile is a 64 × 64 source-pixel window (16 × 16 m), displayed at 2× without smoothing.

Use a fresh output directory for each run. Preserve reviewed decisions separately from the frozen initial candidate file. The renderer produces fresh unreviewed proposals; it does not overwrite or transfer the accepted decisions in `candidates_reviewed.json`. Jules does not need to repeat the first 50-circle review.

## What still blocks completion of R1/R3

1. Detection and evaluation using the accepted reference locations, with a separate assessment of missed rocks where recall is needed.
2. Shadow-based detection with the contributing observation's illumination geometry; the mosaic does not provide one valid Sun angle for every pixel.
3. Luca's confirmed final region and world-grid transform for R3.
4. An actual rock-density/footprint-to-grid export and documented validation. Checking the 50 selected proposals alone does not measure recall; missed rocks need an independently annotated area.

No quality or navigation-safety claim is made from this preliminary review.
