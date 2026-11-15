# R1: single-observation ROSCO experiment

This continues #31 on Luca's actual 2048 m Gale site. It does **not** complete
R3 or replace the DTM roughness layer. The new source is a single acquisition,
so its illumination can be identified. G01–G50 and the original northern crop
remain unchanged; their visual labels are not transferred to this new image.

**Placement update:** [REGISTRATION.md](REGISTRATION.md) measures and corrects
the source-to-mosaic offset. The world coordinates/cells in the native run and
frozen review proposal below are historical nominal values, not aligned cells.
Use `registered_candidates.json` for corrected candidate placement and flags.

## Source and geometry

NASA/JPL-Caltech/University of Arizona
[`ESP_019698_1750_RED_A_01_ORTHO`](https://hirise.lpl.arizona.edu/dtm/ESP_019698_1750),
acquired 2010-10-09. `single_observation_source.json` freezes the exact native
8097 × 8098 window, CRS, scale (0.2529366986449 m/pixel), pixel hash and PDS label
hashes. No sharpening, contrast adjustment or resampling is added. Zero/null
pixels and partial site coverage are rejected.

The [RDR label](https://hirise-pds.lpl.arizona.edu/PDS/RDR/ESP/ORB_019600_019699/ESP_019698_1750/ESP_019698_1750_RED.LBL)
gives incidence 57.493071° and subsolar azimuth 192.527174° clockwise from
image right. The [PDS definition](https://hirise.lpl.arizona.edu/HiCat/Data_Dictionary/HiRISE/RDR_Products.shtml)
and the orthophoto's north azimuth (270°, north up) determine the orientation.
ROSCO's `AH_Rocks.h` specifies counterclockwise from image right, and its
measurement code uses `(cos(angle), -sin(angle))` in image coordinates.
The adapter therefore passes 167.472826°, not the PDS angle unchanged.
The resulting shadow direction is 12.527174° clockwise from image right.
Unit tests verify this sign and the source-to-ortho orientation conversion.

These are observation-level angles. Heights and widths remain model estimates,
without local slope correction. ROSCO's returned dimensions are in pixels;
the runner multiplies by native sampling once to produce metre estimates.
They are not measured rock boundaries or validated navigation hazards.

## Native implementation and results

The adapter calls the official [NASA/JPL ROSCO](https://github.com/nasa-jpl/ROSCO)
Windows x64 release `Version_20260909`, corresponding to source commit
`e930eb2c8e62569bd23350070a2ab676b5ef604d`. Upstream is Apache-2.0; its implementation
and binaries are downloaded separately into ignored `ml/data/`. This repository
contains our adapter, provenance, tests, small measured reports and a copy of
the upstream license in `ROSCO_LICENSE.txt` for the adapted interface declarations.

The installer verifies the release archive SHA-256; loading verifies the DLL
SHA-256. Each of the 289 tiles is checked individually. The batch C API is avoided
because it can report success after individual tile failures. The adapter also
guards an upstream PGM parser issue: a first pixel equal to 35 (`#`) can be
mistaken for a comment. It refuses that input instead of changing source pixels.
Off-image modeled points are counted and excluded, never clamped into the grid.

Three explicit presets separate the diagnosis from the proposed review run:

| Preset | Gradient threshold | Model score threshold | Candidates inside site |
|---|---:|---:|---:|
| `upstream-example` | 20 | 0.7 | 0 |
| `shadow-shapes` (diagnostic) | 0 | 0 | 25,473 |
| `confidence-only` (review) | 0 | 0.7 | 25 |

The starting preset comes from upstream's `ESP_046282_params.txt`; only scale
and illumination are replaced. The second run disables the two rejection
thresholds to inspect the failure, without tuning against the G labels. Its
strongest retained gradient is below 20, explaining why the original preset
keeps nothing. The review run removes only that gradient rejection and retains
the upstream score threshold. A score of 0.7 is **not a 70% probability**.

`rosco_upstream_metrics.json`, `rosco_shapes_metrics.json` and
`rosco_confidence_metrics.json` contain the measured counts and exact parameters.
All 289 tiles completed in each run. The shape diagnostic excludes 11 off-image
modeled points; the confidence run excludes none. No geographic correspondence
within 2 m was found with the resolved G references, even in the shape diagnostic.
The relative registration of the two images has not been verified. This is not
an accuracy result, nor evidence that the prior human judgments were wrong.

Six interior candidates are selected by a fixed hash of native coordinates,
without using the G labels. `rosco_confidence_review.json` freezes H01–H06,
their source positions and sheet hashes; that proposal file stays frozen with
its initial unreviewed statuses. Jules has now reviewed all six:
**H01, H03, H04, H05 and H06 accepted; H02 uncertain, leaning toward a ridge.**
`rosco_confidence_decisions.json` records his exact response, with source,
proposal and sheet hashes. H02 is not silently turned into a negative label.
The five approvals concern visible correspondence, not measured boundaries,
height/width accuracy or overall detector precision/recall. The two sheets show original grayscale pixels beside
the same pixels with point markers, enlarged 7× with nearest-neighbour sampling.
Each detail spans about 16.2 m. Markers are not outlines.

## Reproduce on Windows x64

Use the ML environment and `pip install -r ml/rock_review/requirements-site.txt`.
Normal CI tests the adapter's failure behavior and coordinate/geometry logic
without downloading the native engine or imagery. Native execution was tested
locally on the full crop; it is not part of the Linux CI lane.

```sh
python -m ml.rock_review.rosco_native ml/data/rosco-pinned
python -m ml.rock_review.single_observation ml/data/gale-single
python -m ml.rock_review.evaluate_rosco ml/data/gale-single ml/data/rosco-pinned/ROSCO_20260909/RockDetectorShared.dll ml/runs/gale-rosco --preset confidence-only
```

Always use fresh destination directories. Remote JPEG2000 range decoding failed
in this session; using the complete local product succeeded. If needed, download
the exact `source_url` in `single_observation_source.json` to `ml/data/` and pass
`--jp2 ml/data/ESP_019698_1750_RED_A_01_ORTHO.JP2` to the extraction command.
It is 461,937,284 bytes and the extractor checks its pinned SHA-256
`8fe50227c8c24ec2c0578c2d6d2dd7801da07e0f0acc4b33d80ef14189763047`.
Extraction can take several minutes. The native run takes roughly tens of
seconds on this workstation; that is not a performance guarantee.

The runner writes all native candidates, per-tile counts, source-bound metrics,
PGM input and review sheets into ignored `ml/runs/`. It never writes world files.
`--preset upstream-example` and `--preset shadow-shapes` reproduce the diagnostic
runs. A native rerun of `confidence-only` reproduced the same 25 candidates.

## Remaining gate

The six-proposal review is complete with one uncertain judgment. Image-relative
registration is now measured separately in [REGISTRATION.md](REGISTRATION.md).
Assess false detections and missed rocks in separate
areas before selecting a density threshold. Until then R1/R3 remains open;
this experiment does not unlock R5 proof claims or a scientific rock-hazard
replacement. There is no new app flag, contract change or deployed web behavior.
