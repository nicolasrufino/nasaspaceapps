# Ingenuity transfer test: prepared, awaiting human labels

M2 / R4, no app flag or contract change. On 2026-11-15 the preparation run
downloaded 50 distinct color frames from ten Ingenuity flights and produced
200 native 128 × 128 RGB patches. `summary.json` and `manifest.json` freeze
the counts, crop coordinates, source URLs, product IDs, per-image pose and
SHA-256 hashes. **Zero patches have human labels. Accuracy and the choice of
flight height remain unknown.** The baseline inference pipeline has run on
all 200 patches; its predictions are kept outside the blind review pack.

## Sources and preparation

NASA/JPL-Caltech [Mars 2020 Helicopter Camera PDS bundle](https://planetarydata.jpl.nasa.gov/img/data/mars2020/mars2020_helicam/),
DOI 10.17189/1522845. The selection uses the original supplemental color JPEG
named by each ECM data product's XML label, not the separate browse collection.
These are compressed camera images, not radiometrically calibrated products.
The [bundle documentation](https://an.rsl.wustl.edu/help/Content/About%20the%20data/Data%20sets/M20/HELI%20bundle.htm)
distinguishes data products from browse quicklooks.

`source_index.json` lists the examined sols and ECM products. Selection was
fixed before inference: round-robin ascending sols, SHA-256 URL order within
each sol, 50 frames total; four non-overlapping crops at normalized centers
(0.25, 0.55), (0.75, 0.55), (0.25, 0.85), (0.75, 0.85). No resampling, contrast
enhancement or model-based selection. This is a small convenience sample of
available flights, not a representative Mars terrain survey.

The [instrument specification](https://an.rsl.wustl.edu/help/Content/About%20the%20mission/M20/Instruments/M20%20HELI.htm)
places the color camera 45 degrees downward and lists 0.26 mrad/pixel angular
resolution. Averaging field of view over image width does not establish local
ground sampling across this oblique view. Flying at 4 m does not reproduce a
rover camera's pose, scale or terrain distribution.

## Review and evaluation

`review.html` now embeds all verified patch images, so opening just that file
works without extracting a sibling `patches/` directory. Each annotation needs
an explicit confirmation; choosing or suggesting a category does not create a
human label. The browser keeps a local progress copy when storage is available;
JSON export/import remains the portable backup.

```sh
python -m ml.ingenuity_review.prepare ml/runs/ingenuity-review
# Open ml/runs/ingenuity-review/review.html; export the human annotations.
python -m ml.ingenuity_review.evaluate ml/runs/ingenuity-review ml/exports/terrain_cls.onnx ml/runs/ingenuity-eval --review /path/to/ingenuity-review.json
```

The default page shows no model predictions or altitude. Label the dominant material
only when it covers at least 80% of the patch: soil, bedrock, sand or big rock;
otherwise use unknown/mixed. This matches the baseline patch-purity rule but
is still an image-level human judgment, not a segmentation mask or rock size
measurement. Record the reviewer and export regularly; an export can be
imported to resume. Unexamined patches stay null. Do not replace human review
with the model's own predictions. A second reviewer should adjudicate ambiguous
cases before using this small set for model comparison.

### Optional assisted review requested by Jules

To prefill categories for human confirmation from an existing inference run:

```sh
python -m ml.ingenuity_review.build_review ml/runs/ingenuity-review ml/runs/ingenuity-assisted.html --suggestions ml/runs/ingenuity-baseline
```

The inference directory must contain matching `metrics.json` and
`predictions.json`. The builder checks the manifest/model provenance and every
image's pixels. Suggestions are clearly labeled, and labels stay null until
the reviewer confirms each image. Skipping a suggestion does not accept it.

Assisted exports record the mode and suggestion model hash. They are **not an
independent blind test**, including when a reviewer confirms every proposal.
The independent evaluator rejects them instead of reporting biased accuracy.
Use a different reviewer who has not seen these suggestions, or an untouched
flight set, for a subsequent blind benchmark. The blind page refuses assisted
imports. Legacy blind exports remain readable. This does not promote a model
or settle the flight-height question.

Evaluation verifies the manifest and every patch's pixels. It reports confusion,
class recalls, supported-class balanced accuracy and coverage overall and by
flight. Unknown/mixed patches are excluded and counted; an unlabeled pack yields
null accuracy. Patches from one frame/flight are correlated, so 200 patches are
not 200 independent samples. Do not tune thresholds or augmentations on this test.

## Gates before comparing 4 m with 10 m

- Finish independent labels and report class balance/unknown rate.
- Validate per-image height above the local terrain, camera calibration and
  footprint. The XML's HELI_M_FRAME origin offset relative to HELI_G_FRAME is
  retained verbatim; its z coordinate is **not** silently called altitude AGL.
- Establish enough independent flights in each actual height band. Do not call
  approximately 5 m data a measured 4 m test. Report unsupported bands as missing.
- Hold out entire flights, including frames used without labels for adaptation.
  Compare baseline and adapted models on the same untouched labels and bands;
  estimate uncertainty across flights, not individual correlated patches.
- Flight clearance, dust, navigation, power and camera footprint need separate
  engineering validation. A terrain classifier score does not certify a flight.

Training-label choices are in [LABEL_POLICY.md](../LABEL_POLICY.md).
