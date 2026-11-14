# Gale rock-review handoff — preliminary test patch

## Purpose and current status

Jules has completed the visual review and **accepted all 50 numbered circles in the first delivered image as corresponding to rocks**. Use `candidates_reviewed.json` for that recorded review. These remain bright-object proposals from classical image processing, not detections from a trained network. A circle can include multiple rocks; its radius is a display marker, not a measured rock radius.

This is a 256 × 256 m test patch. **Please verify whether it lies inside the team's chosen final region before integrating it into that region.** Do not place its annotations on an unrelated image or DEM.

## Source and footprint

- Product: `MSL_Gale_Orthophoto_Mosaic_25cm_v3.tif`.
- Official metadata: https://astrogeology.usgs.gov/search/map/mars_msl_gale_merged_orthophoto_mosaic_25cm
- Raster URL: https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/MSL_Gale_Orthophoto_Mosaic_25cm_v3.tif
- Credit: Calef III and Parker / NASA / JPL-Caltech / USGS / University of Arizona.
- Source window, zero-based: x = 65942, y = 153938, width = 1024, height = 1024.
- Source crop: `Gale_HiRISE_starter_25cm.png`; no resizing, contrast enhancement or sharpening.
- Raster sampling: 0.25 m/pixel. North up, east right.
- Approximate center: latitude −4.720°, longitude 137.375° East.
- Northwest edge: lat −4.7178393427°, lon 137.3728393434° E.
- Southeast edge: lat −4.7221582175°, lon 137.3771582183° E.
- Mars sphere radius: 3,396,190 m; equirectangular projection, standard parallel 0°, central longitude 0°.
- Crop geotransform: `[8142733.5, 0.25, 0, -279648.5, 0, -0.25]`.

The mosaic is assembled from multiple observations. Do not assume one solar azimuth/elevation for the whole product or derive rock heights from shadows without identifying the contributing observation and its geometry.

## Pixel coordinates and map integration

`candidates_unreviewed.json` is the frozen initial review artifact with the exact image provenance and SHA-256, plus 50 numbered candidate centers. The renderer writes fresh proposals to `rock_candidates_review.json` in its chosen output directory. Coordinate convention: zero-based pixel center indices, x to the right and y downward. The display image adds a footer; the source crop and all stored coordinates exclude that footer.

For candidate center `(u, v)`:

```text
projected X = 8142733.5 + (u + 0.5) * 0.25
projected Y = -279648.5 - (v + 0.5) * 0.25
longitude east [degrees] = projected X / 3396190 * 180 / pi
latitude [degrees] = projected Y / 3396190 * 180 / pi
```

Projected coordinates and derived latitudes/longitudes are already stored per candidate. Decimal precision does not establish positional accuracy. Use a compatible Mars CRS when transforming to the target world grid; do not use Earth WGS84 for the raster coordinates.

## Next steps for Luca

1. Confirm the final region and whether this test patch belongs to it. If not, keep this patch as a separate prototype or provide the final georeferenced source crop.
2. Prepare the matching orthophoto and DEM footprint for the map. Elevation and slopes come from the DEM; a single PNG does not supply terrain heights.
3. Confirm the existing world-grid contract: extent, projection, dimensions, grid resolution, row origin and file conventions. Keep 0.25 m imagery sampling separate from the planner grid resolution.
4. Jules's initial visual review is complete. Use the accepted stored coordinates to overlay the reviewed locations on the same image/map. Once detection covers the final region, aggregate rock density or measured footprints into the agreed `rocks_fine.u8` grid. Do not directly rasterize the display circles as measured rock footprints.
5. Preserve provenance and review status. Do not treat the JSON as a ready-made hazard raster, an exhaustive rock inventory, or a navigation safety result.

The JSON is an intermediate review format and does not change the repository's world-data contract. Do not rename it `rocks.json` and assume compatibility with the model export contract.

## Validation after review

The 50 user-accepted locations provide a visual reference for the detector. This acceptance does not by itself measure recall: missed rocks need a separately annotated area. A model evaluation will also need independent images or held-out areas, rather than using this same selected set as both training data and test data. Jules need not repeat the initial visual review.

## Reproduce the proposal images

Dependencies: Python, Pillow, NumPy, OpenCV. The script uses Arial when present and falls back to Pillow's default font.

```text
python ml/rock_review/prepare_review.py ml/data/Gale_HiRISE_starter_25cm.png ml/runs/regenerated_review
```

Use a new output directory so rerunning the script does not overwrite reviewed annotations. The script resets all generated candidate statuses to `unreviewed`.
