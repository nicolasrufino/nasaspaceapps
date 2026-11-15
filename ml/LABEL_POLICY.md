# P1 label policy — 2026-11-15

Decision for the next P1 experiments: start the orbital rock work with the
registered, human-reviewed HiRISE positives. Keep ground-photo classification
and orbital occupancy as separate tasks. No shared contract or published model
changes in this decision.

| Task | Use now | Keep out of training / do not infer |
|---|---|---|
| Gale orbital rocks | ESP_019698_1750 H proposals: 23 accepted points in 22 cells, with frozen review and registration provenance | H02/H13 uncertain; unreviewed candidates; padded neighbours as independent rocks; zero detections as negative labels |
| Negative examples / missed-rock validation | Separately sampled image areas reviewed by a human at native resolution, with footprint and visibility recorded | “ROSCO ran here and found nothing” is coverage, not proof of empty or safe ground |
| Rover terrain classifier | Existing AI4Mars train split and its four supervised classes | Held-out Curiosity/Perseverance images; published test scores must not become training-selection targets |
| Ingenuity domain-transfer test | The frozen 200-patch review pack as an independent test only | All selected flights are excluded from training, self-distillation and tuning; reserve other flights for adaptation |
| Future Gale ground-to-orbit labels | Curiosity labels only after camera pose, terrain intersection, image/map registration and site overlap are verified | A rover location or image filename alone does not locate every labeled image pixel in an 8 m cell |

The 31 accepted / 3 rejected / 16 uncertain G points belong to another mosaic
review. They are not the 25 ROSCO H proposals and their labels are not transferred
between acquisitions. Keep both provenance chains intact.

The existing DTM-derived `rocks_fine` mask is a rule on orbital inputs, not
independent ground truth for a model trained on those inputs. The union mask
remains useful for the current demo, with that limitation stated. ROSCO dimensions
are shadow-model estimates without local slope correction; its score is not a
calibrated probability. Detection density or a rock-size law needs independent
validation before becoming a probability that an astronaut can cross a cell.

The expanded full-slice run is recorded in `rock_review/full_slice_metrics.json`.
The next missing evidence is reviewed negatives and missed-rock sampling, not
another claim that running the detector alone validates the belief map.

The R4 baseline stays published. No new trained model is promoted by this audit.
See [ingenuity_review/README.md](ingenuity_review/README.md) for the height-test
protocol and the human/geometry gates still open.
