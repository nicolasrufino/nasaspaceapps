# Gale starter rock review — R1 / issue #31

**Current site:** Luca delivered a different Gale footprint in #63 on `dev`.
The original accepted records below remain historical test references, about
5 km north of the final site. Use [FINAL_SITE.md](FINAL_SITE.md) for the new
source-verified, grid-aligned proposals on the real demo area.
All 50 new-site proposals have been reviewed: 31 accepted, 3 rejected and 16
uncertain. Decisions and the exact user responses are in
`final_site_review.json`; the frozen proposal coordinates are unchanged.
The fixed shadow-pair baseline has now been measured on that real site:
8,973 possible pairs, matching 7/31 accepted and 1/3 rejected reference points
within 2 m; uncertain points are excluded. These are correspondence counts,
not detector accuracy. See `final_site_baseline_metrics.json` and `FINAL_SITE.md`.

**Next detector experiment:** [ROSCO.md](ROSCO.md) documents the official NASA/JPL
native detector on a single HiRISE acquisition covering this site, with verified
observation-level solar geometry. The development run produces 25 candidates;
Jules reviewed six: five accepted and one uncertain. It does not replace the world hazards
or transfer the existing visual labels to a different image.

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
3. Final-site proposals and independent annotation; Luca's site/grid have now landed in #63 on dev.
4. An actual rock-density/footprint-to-grid export and documented validation. Checking the 50 selected proposals alone does not measure recall; missed rocks need an independently annotated area.

No quality or navigation-safety claim is made from this preliminary review.

## Image-only shadow-pair baseline (R1 continuation)

`shadow_baseline.py` pairs nearby bright top-hat and dark black-hat components.
The dark component is only a possible shadow. No contributing acquisition or
illumination angle has been verified for this mosaic crop (the official USGS
metadata page returned HTTP 403 during this run). No heights or physical rock
boundaries are calculated. A component box is an image-processing diagnostic.

```sh
python -m ml.rock_review.shadow_baseline ml/data/Gale_HiRISE_starter_25cm.png ml/runs/shadow-v1
```

Use a fresh run directory. It writes all detections, metrics and a fixed hash
sample of 12 new proposals for review. The accepted 50-location record is never
modified. `baseline_metrics.json` is the measured result from this run:
812 pairs, only 2 of 50 reference locations matched within 8 pixels (2 m).
This baseline is **not suitable for world hazard integration**. The negative
result is retained; thresholds were not retuned to inflate agreement.

Matching maximizes the number of one-to-one centroid correspondences within the
fixed distance limit; review-circle radii are not used. This is selected-reference
correspondence, not precision or recall. Unmatched proposals cannot be labeled
false alarms without review, and missed-rock completeness is unknown. The new
12-tile visual review is provisionally accepted with low confidence: Jules said
he could not see the image well and thought the proposals looked correct. The
exact statement is in `shadow_review.json`; it does not validate shadow geometry
or measure precision. It is separate from the original 50 accepted locations.

Next: obtain the contributing observation/illumination metadata, improve the
method based on reviewed errors, then evaluate on a separately annotated area.
Luca has since delivered the real site via #63 on `dev`: 2048 m square centred
at -4.800, 137.383 E, 256 x 256 cells at 8 m. This starter crop is outside it,
about 5 km north. The real site's current `rocks_fine` is explicitly a DTM
roughness estimate. R3 needs a suitable detector and independent final-site
annotations; no `rocks_fine.u8`, fabricated heights or final-site metrics are
emitted by this experiment. Luca's source/grid recipe is in `cut_slice.py` and
`docs/DATA.md` on `dev`.
