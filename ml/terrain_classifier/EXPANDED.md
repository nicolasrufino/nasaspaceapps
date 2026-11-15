# Curiosity expanded-data experiment (v3)

This experiment continues the published MobileNetV3-Small on more **AI4Mars
Curiosity NAV ground photographs from Gale**, using the same crop definition and
the same ONNX contract. It is not Ingenuity/aerial training, pixel segmentation,
3D reconstruction or proof of coverage of Luca's exact target sector.

## Measured result: retain the published model

The selected candidate improves the two historical expert tests and big-rock
recall on the separate challenge, but **regresses on the new general test**.
It fails the predeclared promotion gates. The published ONNX and its original
metrics are unchanged; the trained candidate remains under ignored `ml/runs/`.

| Evaluation | Published v1 | Expanded, partially fine-tuned candidate |
|---|---:|---:|
| New general crowd-label test | 830/943 (88.02%) | 791/943 (83.88%) |
| Separate rock-challenge overall accuracy | 132/171 (77.19%) | 148/171 (86.55%) |
| Big-rock recall within that challenge | 15/45 (33.33%) | 37/45 (82.22%) |
| Historical expert v1 | 148/159 (93.08%) | 151/159 (94.97%) |
| Historical expert v2 | 275/302 (91.06%) | 284/302 (94.04%) |

On the new general test, bedrock recall falls from 443/498 (88.96%) to
388/498 (77.91%). Bedrock called "big rock" rises from 19 to 69 patches.
Across the whole general test, false big-rock predictions rise from 19 to 73.
The improvement in challenge recall therefore cannot be presented as a general
rock-detection accuracy or a navigation-safety improvement.

The paired acquisition-bin bootstrap 95% interval for the general accuracy
change is **−7.48 to −1.12 percentage points**, with a measured change of −4.14
points. The general test's balanced accuracy is especially sensitive to its
single big-rock example; the separate challenge supplies the stronger recall
evidence. Neither test is an independent expert validation of physical safety.

The head trained for 65 epochs and restored epoch 40. Partial fine-tuning ran
nine epochs and restored epoch four. Validation balanced accuracy increased from
69.72% for the published starting model to 78.53% for the continued head and
84.21% for the selected partial fine-tune. Its overall validation accuracy is
83.99%. Additional epochs were not better on the declared selection criterion.

The [generated report](expanded_experiment_v3.json) contains all epoch histories,
confusion matrices, support counts, split groups, hashes and gate outcomes.
The [source manifest](expanded_manifest_v3.json) contains identifiers/checksums,
not image data. Every final prediction used ONNX Runtime. Candidate parity with
PyTorch passed on all 1,575 evaluated crops at `atol=rtol=1e-4`; the largest
absolute logit difference was 0.000125885 (relative tolerance also applies).

No further settings were selected using these now-observed tests. Any follow-up
must reserve new final evaluation data. These results do **not** establish a
98% model, and rounding 151/159 to 95.0% must not hide the general-test regression.

## Data and label quality

| Split | Usable source frames | Acquisition bins | Soil | Bedrock | Sand | Big rock |
|---|---:|---:|---:|---:|---:|---:|
| Fitting | 640 | 525 | 1,640 | 2,333 | 481 | 155 |
| Validation | 96 | 78 | 187 | 316 | 93 | 66 |
| New general test | 128 | 107 | 333 | 498 | 111 | 1 |
| Separate rock challenge | 25 | 11 | 49 | 43 | 34 | 45 |

These are **crowd-consensus labels**, not new expert gold labels. The old expert
tests (159 and 302 patches) are retained only as historical regression checks.
The fitting subset retains all 145 previously usable source frames and adds
495 new ones: 4,609 training patches instead of 1,136, including 155 big-rock
patches instead of nine. It does not reinterpret previous rock-review points as
ground-image labels.
All expert acquisition bins are excluded from the expanded subset. All bins the
published model trained on are restricted to fitting. Other bins are allocated
by a fixed hash before selecting frames, with no fitting/validation/test overlap.
General test and rock challenge can share held-out bins but contain different
frames; they must not be pooled as independent random observations.

Fitting and validation deliberately include additional big-rock frames. The
general test is selected by fixed hash with acquisition-bin diversity among
eligible frames; it still has only one big-rock patch. The separate challenge
measures big-rock recall with better support, but its deliberately enriched
distribution cannot establish overall accuracy or precision in normal use.
The 45 big-rock patches are correlated, not 45 independent rock sites.

The 100,000-second bins reduce acquisition leakage; they do not prove geographic
independence. All crops retain the original requirements: nonoverlapping 256×256
source regions, at least 70% valid NAV labels, at least 80% dominant class among
valid pixels, bilinear resize to 128×128 RGB, values 0–1. Mixed/unlabelled patches
are excluded. Classification is of the dominant terrain, not every obstacle.

## Training and selection

1. Restore the published v1 classifier head and the unchanged pretrained visual
   features. Verify the reconstructed model matches published ONNX outputs.
2. Continue fitting the head on the larger subset, with inverse-frequency class
   weights. Maximum 200 epochs, stop after 25 epochs without improvement on
   validation; restore the best checkpoint, including epoch zero if it wins.
3. Start from that checkpoint and fine-tune feature blocks 9–12 and the head.
   Earlier blocks and batch-normalization running statistics remain frozen.
   Maximum 25 epochs, patience five. No augmentation is added in this experiment.
4. Choose head-only or partial fine-tuning using balanced validation accuracy,
   then overall accuracy; prefer the head on ties. Save the choice before running
   any final test. Do not refit on validation or retry based on test results.
5. Compare the selected ONNX with the published ONNX on the new general test,
   separate rock challenge and both historical expert sets. Check PyTorch/ONNX
   parity for every candidate test prediction.

The full, predeclared settings and promotion gates are in
`expanded_protocol.py`. More epochs are not themselves evidence of improvement.
The candidate is promoted only if every gate passes, including a positive paired
acquisition-bin bootstrap interval for the general-test gain, class recall checks,
adequate rock-challenge support and no material historical expert regression.
Passing these gates still does not establish safe navigation or aerial accuracy.

## Reproduce

```sh
python -m ml.terrain_classifier.expanded_data ml/data/ai4mars-subset-v1 ml/data/curiosity-expanded-v3
python -m ml.terrain_classifier.expanded_train ml/data/curiosity-expanded-v3 ml/data/ai4mars-subset-v1 ml/data/gale-fresh-v2 ml/runs/curiosity-expanded-v3 ml/exports/terrain_cls.onnx
python ml/check_exports.py
```

Use fresh completed-run directories. Downloads resume from verified ZIP-range
caches. Only selected photos are fetched; a contiguous compressed label region
avoids thousands of individual requests. Images, masks, feature caches, candidate
weights and per-crop predictions stay ignored. Streaming and disk-backed frozen
features keep training memory bounded on a CPU laptop.
