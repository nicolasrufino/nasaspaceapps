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
- `final_site_review.json`: user decisions for those frozen proposals, linked
  to the candidate file, source pixels and reviewed sheet by SHA-256 hashes.
  IDs without a decision remain unreviewed; uncertain decisions stay uncertain.
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

The new-site review is **partial**. Jules reviewed G01–G40 on 2026-11-14:

| Decision | IDs |
|---|---|
| Accepted (25) | G02, G04, G05, G06, G10–G17, G19, G21, G28–G30, G32–G34, G36–G40 |
| Rejected (3) | G09, G23, G31 |
| Uncertain (12) | G01, G03, G07, G08, G18, G20, G22, G24–G27, G35 |
| Unreviewed (10) | G41–G50 |

G01 is a tentative yes with explicit uncertainty; it is not accepted. G02 is
explicitly certain. G09 is a tentative no. The second sheet has 8 accepted and
2 uncertain decisions. Its ambiguous spoken "Image C" reference was explicitly
clarified by Jules as G16 accepted. The third sheet has 4 accepted, 1 rejected
and 5 uncertain decisions. Its spoken "Image 3 non" is interpreted as G23,
the third candidate on that sheet, between explicit G22 and G24 judgments;
this interpretation was stated to Jules. The fourth sheet has 8 accepted,
1 rejected (G31) and 1 uncertain (G35) decision. G33 and G34 were spoken out
of order but both explicitly accepted. The exact responses are retained in
`final_site_review.json`. The generator and `final_site_candidates.json` remain
the frozen, unreviewed proposal source; use the separate decisions to interpret
review status. These counts summarize judgments, not detector accuracy.

The user's earlier tentative acceptance of the 12 S-prefixed bright/dark pairs
concerned the old crop only. None of these selected-proposal reviews is a
held-out precision/recall measurement or a measured minimum detectable size.

No `rocks_fine.u8` is generated or written into Luca's world. His existing layer
is labeled as a DTM roughness estimate. Reliable final-site rock identification,
independent annotations and observation/illumination metadata still gate a
scientific rock-hazard replacement. This PR leaves #31 open.

The AI4Mars terrain classifier is for rover ground photos, not orbital HiRISE
pixels. Its export must not replace the orbital terrain grid without a separate
domain evaluation and agreement with Luca.
