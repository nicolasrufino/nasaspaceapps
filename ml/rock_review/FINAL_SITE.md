# R1/R3 adaptation to Luca's real Gale site

Luca's #63 chose a 2048 x 2048 m box centred on -4.800 degrees,
137.383 degrees E. `data/worlds/gale/world.json` defines a 256 x 256 grid
at 8 m, row zero north. The previously accepted 50 locations near -4.720
are outside this box. Their approval is preserved and is never transferred.

## Delivered

- `final_site.py`: downloads the exact native window from the USGS HiRISE LRGB
  source used by Luca, validates the world extent against the source CRS/pixel
  grid, checks nodata, and hashes the source RGB pixels. No silent resampling.
- `final_site_candidates.json`: 50 **new, unreviewed** bright-object proposals,
  IDs G01–G50, distributed across the actual box. Each has original pixel
  coordinates, Mars projected coordinates, lat/lon and the actual world cell.
- A source overview and five enlarged contact sheets are generated locally.
  Every 16 x 16 m detail shows the original pixels at left and the review marker
  at right, enlarged 4x by nearest-neighbour. Source imagery stays ignored.

Native source window: `[9244, 53980, 8192, 8192]` in
`MSL_Gale_HiRISE-LRGB_78quads_sharp_cog.tif`.
Crop affine: `[8142311, 0.25, 0, -283495, 0, -0.25]`.
Projected extent: eastings 8142311–8144359, northings -285543–-283495 m.
The projection is the Mars 2000 sphere, radius 3396190 m, not Earth WGS84.
Source URLs, WKT and hashes are embedded in the proposal record.

## Reproduce

```sh
python -m pip install -r ml/rock_review/requirements-site.txt
python -m ml.rock_review.final_site fetch data/worlds/gale/world.json ml/data/gale-final-v1
python -m ml.rock_review.final_site review ml/data/gale-final-v1 ml/runs/gale-final-review-v1
```

Choose fresh output directories. The generator refuses to overwrite a run.
The 8192 x 8192 image is about 201 MB uncompressed RGB; working arrays need
additional memory. Do not commit the source PNG or rendered sheets.

## Quality and integration status

All 50 points are inside Luca's grid; this verifies alignment, not rock identity.
The proposals use bright-object morphology and may select bedrock, ridges or
lighting texture. Some details in this box are visibly ambiguous. The source
is a sharpened color mosaic; 0.25 m pixel spacing does not guarantee recognition
of 0.25 m objects. One same-window comparison with the original grayscale mosaic
did not remove the visual ambiguity. No extra sharpening is applied here.

The new G01–G50 review is **pending**. The user's tentative acceptance of the 12
S-prefixed bright/dark pairs concerned the old crop only. Neither review is a
held-out precision/recall measurement or a measured minimum detectable size.

No `rocks_fine.u8` is generated or written into Luca's world. His existing layer
is labeled as a DTM roughness estimate. Reliable final-site rock identification,
independent annotations and observation/illumination metadata still gate a
scientific rock-hazard replacement. This PR leaves #31 open.

The AI4Mars terrain classifier is for rover ground photos, not orbital HiRISE
pixels. Its export must not replace the orbital terrain grid without a separate
domain evaluation and agreement with Luca.
