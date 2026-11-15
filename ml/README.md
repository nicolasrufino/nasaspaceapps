# ml (Person 1)

Terrain classifier (`terrain_classifier/`) and buddy rover (`buddy_rover/`). Exports go to `exports/` as ONNX plus a metrics JSON. See `docs/roles/person-1-ml.md` and `docs/CONTRACTS.md` section 2.

## R2 integration fixtures

`exports/buddy_policy.onnx` is an **untrained placeholder**, marked in the
ONNX metadata and adjacent JSON. It returns constant logits favouring stay;
this is a wiring fixture, not a validated navigation policy.
`exports/terrain_cls.onnx` is now the measured R4 baseline described in
[terrain_classifier/README.md](terrain_classifier/README.md). It classifies rover
ground photos, not orbital pixels, and transfers poorly to Perseverance in the
initial evaluation. Keep classifier/RL app features off pending integration QA.
Both use the existing contract names, float32 types and shapes.

Install `ml/requirements-ci.txt`, then run `python ml/check_exports.py` for real
ONNX Runtime inference. Reproduce with
`python -m ml.export_placeholders --out ml/runs/placeholders` (fresh directory).
The generator refuses to overwrite existing models, including future trained
exports. ONNX opset 17 / IR 8; no PyTorch is needed for these fixtures.

The [Gale starter rock review](rock_review/README.md) contains the R1 review handoff for #31: 50 locations visually accepted by Jules, the preserved initial proposals, source provenance and a reproducible proposal script. It is not yet the shadow-based detector or final hazard mask.

## P1 evidence audit (2026-11-15)

The [registered full-slice ROSCO run](rock_review/FULL_SLICE.md) is complete.
The [200-patch Ingenuity pack](ingenuity_review/README.md) is ready for human
annotation; no height decision or new accuracy is claimed.
[Label policy](LABEL_POLICY.md) separates orbital positives, reviewed negatives,
rover training data and held-out helicopter flights.
