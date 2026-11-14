# R4: AI4Mars ground-photo classifier v1

`ml/exports/terrain_cls.onnx` now contains a trained linear head on frozen
ImageNet MobileNetV3-small features. It accepts contract RGB float32
`image [1,3,128,128]` in 0–1 and returns `logits [1,5]` in contract class order.
ImageNet normalization is embedded in the graph. No app flag is enabled.

## Measured results

All reported predictions were run through the exported ONNX in ONNX Runtime.
The adjacent export JSON contains the confusion matrices and exact settings.

| Evaluation | Patches | Accuracy | Balanced accuracy, supported classes |
|---|---:|---:|---:|
| Curiosity expert min3 test subset | 159 | 0.9308176101 | 0.9265873016 |
| Perseverance NAV transfer subset | 197 | 0.4822335025 | 0.4128369178 |

Curiosity test support is 84 soil, 40 bedrock, 35 sand and **zero big-rock
patches**. No held-out Curiosity performance is established for big rocks.
Perseverance support is 123 soil, 42 bedrock, 29 sand, 3 big rock: the latter
is far too small to claim reliable performance. The transfer result is poor;
do not present the 93% Curiosity result as general Mars-image accuracy.

Training uses 1,136 patches: 508 soil, 514 bedrock, 105 sand and 9 big rock.
The fixed 200-epoch run uses inverse-frequency class weighting. Test data is
not used for fitting, checkpoint selection or threshold tuning.

## Dataset and split

NASA's [AI4Mars catalog entry](https://catalog.data.gov/dataset/ai4mars-a-dataset-for-terrain-aware-autonomous-driving-on-mars)
points to [Zenodo release 15995036](https://zenodo.org/records/15995036).
The merged 0.6 ZIP is 16,232,481,989 bytes. The downloader reads its directory
and selected members with verified HTTP ranges, CRCs and SHA-256 hashes.
It fetched 240 source-image/label pairs rather than the complete archive:
160 Curiosity train, 40 Curiosity expert min3 test, 40 Perseverance NAV transfer.

Selection is a fixed SHA-256 ranking, recorded in `subset_manifest.json`.
All Curiosity acquisition-clock bins represented in the full expert test list
are excluded from training (100,000-second bins). All patches from one image
stay in its split. Nearby images/patches are still correlated; these are not
independent measurements of every terrain or site. Perseverance is never trained on.

Only **NAV** labels are used: source 0–3 maps to contract 1–4. Source 255 is
unlabeled and ignored, never treated as unknown-class supervision. Geology
labels use different semantics and are excluded. Nonoverlapping 256x256 crops
must have at least 70% labeled pixels and 80% agreement on the dominant class;
accepted crops are resized to 128x128 with bilinear interpolation. This is
patch classification, not pixel segmentation.

Contract class 0 (unknown) is reserved with a fixed logit of -100 and is **not
learned or calibrated**. Downstream code must not interpret the output as a
confidence measure or infer safe terrain from an argmax.

## Reproduce

```sh
python -m pip install -r ml/requirements-ci.txt torch torchvision
python -m ml.terrain_classifier.dataset ml/data/ai4mars-subset-v1
python -m ml.terrain_classifier.train ml/data/ai4mars-subset-v1 ml/runs/terrain-v1
python ml/check_exports.py
```

Use fresh output directories for complete reruns. Interrupted downloads resume
from CRC-verified source files and cached archive metadata. Requests are paced
and honor server rate-limit cooldowns. Source images, labels, pretrained weights
and prediction logs remain under ignored `ml/data/` or `ml/runs/`.
Torchvision downloads its documented ImageNet weights into `ml/data/torch-hub`.
The lightweight CI runs ONNX and data-preprocessing checks without installing torch.

To publish a retrained result, deliberately copy only `terrain_cls.onnx` and
`terrain_cls.json` into `ml/exports/` after inspecting the measured outcomes.
The placeholder generator refuses to overwrite them.

## Integration boundary

This model was trained on **rover ground photographs**. It must not replace
Luca's orbital HiRISE `terrain_class.u8` without a separate domain evaluation.
No navigation-safety claim, calibrated confidence or phone performance result
is established. The model is suitable for experimental integration and further
evaluation; Perseverance adaptation and stronger big-rock coverage remain work.
