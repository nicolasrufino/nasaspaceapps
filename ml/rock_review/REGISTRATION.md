# R1/R3: image-relative placement of the ROSCO candidates

The single HiRISE orthophoto and Luca's USGS color mosaic do not agree at their
nominal map coordinates. At the measured texture patches, the median apparent
offset is about 34 m east and 35 m south, varying across the site. Using the
nominal coordinates would put rock candidates in the wrong 8 m world cells.

`register_observation.py` measures this offset from image texture. Both images
are checked against their frozen pixel hashes, then compared on a temporary
1 m diagnostic grid. Native detector/review pixels are never resampled or
modified. The method uses 49 disjoint 256 m patches. A checkerboard assigns 25
patches to fitting one affine transform and reserves 24 for validation. G/H rock
judgments are not inputs to the fit.

The exact controls, transform, source hashes, settings and measurements are in
`registration_metrics.json`. The high-pass texture model gives these residuals
on the 24 validation patches:

| Displacement residual | Metres |
|---|---:|
| Median | 0.475 |
| 95th percentile | 1.817 |
| Maximum | 2.028 |

A gradient-magnitude signal provides a cross-check on the same images, not a
second independent scene. The resulting transforms differ by at most 0.151 m
at the four corners of the control region. Both pass the development checks
(validation p95 ≤ 2 m, maximum ≤ 4 m, signal-transform difference ≤ 1 m).
These checks are chosen for this 8 m grid. They are not calibrated individual
rock-position uncertainty bounds or proof of absolute Mars coordinates.

## Corrected candidate placement

`registered_candidates.json` contains the 25 candidate points transformed into
the mosaic's image-relative frame. Its original nominal coordinates are retained
alongside the corrected values. All remain inside the site. Two lie outside
the control-patch center region and therefore use affine extrapolation; 16 lie
within the maximum validation residual of a cell edge. These cases are flagged.
An off-site point is never clamped into the nearest cell.

Jules's visual decisions still refer to the exact same native image patches:

| Review ID | Corrected candidate cell (x, y) | Decision | Placement flag |
|---|---|---|---|
| H01 | 58, 159 | Accepted | None |
| H02 | 87, 213 | Uncertain; leans toward a ridge | Near cell boundary |
| H03 | 54, 157 | Accepted | Near cell boundary |
| H04 | 246, 14 | Accepted | Affine extrapolation |
| H05 | 64, 158 | Accepted | None |
| H06 | 54, 149 | Accepted | Near cell boundary |

The previous ROSCO artifacts and frozen review proposal contain **nominal,
unregistered world cells**. Preserve them as evidence of what was reviewed;
use this new placement artifact for the corrected coordinates. Native pixel
positions and all human decisions are unchanged.

The 25 high-score candidates still have no centroid correspondence within 2 m
of the resolved G references after registration. This corrects the hypothesis
that the map offset alone explained the missing matches: it did not. The G
points came from bright-object proposals on another acquisition, while these
25 candidates are a restricted shadow-model sample. Correspondence is still
not detector precision or recall, and G labels are not transferred.

## Reproduce

Use the source and native run from [ROSCO.md](ROSCO.md), and the mosaic source
from [FINAL_SITE.md](FINAL_SITE.md):

```sh
python -m ml.rock_review.register_observation ml/data/gale-single ml/data/gale-final-v1/gale_final_rgb.png ml/runs/gale-rosco ml/runs/gale-registration
```

Use a fresh output directory. Besides the JSON report and candidate positions,
the command produces `candidate_counts.u16`: 256 × 256 little-endian uint16,
north-first, row-major, counting the proposed point in each 8 m cell. The
measured grid sums to 25. This is a diagnostic count grid: it includes 19
unreviewed candidates and one uncertain candidate alongside the five accepted
ones. Zero means no candidate was counted, **not safe or rock-free ground**.

No `rocks_fine.u8` is generated and nothing is written into `data/worlds/`.
Physical footprints, missed-rock completeness and a useful hazard-density
threshold still require evaluation before replacing Luca's current layer.
This finishes the image-registration step, not R3 or the R5 proof numbers.

Tests cover the actual phase-correlation sign/scale on translated texture,
affine inversion with shear, exclusion of validation controls from fitting,
failure on poor/degenerate controls and cell-edge/extrapolation handling.
The 1 m grid's phase-correlation peak centroid can have subpixel bias; the
synthetic sign/scale test allows half a diagnostic pixel. The native run was
registered twice with identical reports and corrected candidate coordinates.
