# Registered Gale coverage audit — 2026-11-15

M1 / R1–R3, issue #31. No app flag, world-layer replacement or contract change.

The original confidence-only run did process all 289 tiles of its 8097 × 8098
native-pixel crop and found 25 proposals. A fresh native rerun reproduced the
committed report exactly. However, nominal source coverage is different from
coverage after registration: under the frozen affine transform, 2,490 of the
65,536 world cells were not fully inside that original crop.

`full_slice.py` extracts an expanded 8271 × 8280 native window from the same
pinned HiRISE JP2, including a 4 m extraction margin. It checks illumination
labels, the source checksum, unchanged pixels in the original review region,
and all four corners of every world cell after applying the frozen transform.
The resulting report covers **65,536 / 65,536 cells**, completes **289 tiles**,
and returns **25 proposals inside the site**. Small reports and candidate records
are committed; raw imagery and native runs stay in ignored `ml/runs/`.

Coverage is conditional on the image-relative affine model. The boundary uses
extrapolation beyond the fitted interior controls; the 4 m extraction margin
is not a validated geolocation-error bound. The report lists exact matches to
the frozen H proposals by native rock/shadow coordinates and dimensions, with
the original review pixels verified unchanged. It never inherits a label by
candidate order. Human decisions remain in `r3_decisions.json`: 23 accepted,
two uncertain. The current exported hazard mask is unchanged.

This completes detector execution over the registered slice under that model.
It does **not** establish exhaustive rock recall, validated heights, empty ground
where there is no detection, or a calibrated blocked-cell probability. Human
negative-area and missed-rock review remain required; see [LABEL_POLICY.md](../LABEL_POLICY.md).

Reproduce on Windows x64 after installing the pinned native dependency described
in [ROSCO.md](ROSCO.md):

```sh
python -m ml.rock_review.full_slice ml/data/ESP_019698_1750_RED_A_01_ORTHO.JP2 ml/data/gale-single ml/data/rosco-pinned/ROSCO_20260909/RockDetectorShared.dll ml/runs/gale-registered-full
```

The source-label directory contains the original `rdr.LBL` and `ortho.LBL`.
`full_slice_metrics.json` records hashes, parameters, coverage and limits;
`full_slice_candidates.json` contains the raw proposals with registered cells
and estimated dimensions. No scientific accuracy is inferred from execution.
