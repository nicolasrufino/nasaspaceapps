# ml (Person 1)

Terrain classifier (`terrain_classifier/`) and buddy rover (`buddy_rover/`). Exports go to `exports/` as ONNX plus a metrics JSON. See `docs/roles/person-1-ml.md` and `docs/CONTRACTS.md` section 2.

## R2 integration fixtures

`exports/terrain_cls.onnx` and `exports/buddy_policy.onnx` are **untrained
placeholders**, marked in both the ONNX metadata and the adjacent JSON.
They return constant logits favouring unknown terrain and stay respectively;
these are wiring fixtures, not predictions or validated navigation behavior.
Nico can load them using the existing contract names, float32 types and shapes.
Keep classifier/RL behavior off until a trained replacement is evaluated.

Install `ml/requirements-ci.txt`, then run `python ml/check_exports.py` for real
ONNX Runtime inference. Reproduce with
`python -m ml.export_placeholders --out ml/runs/placeholders` (fresh directory).
The generator refuses to overwrite existing models, including future trained
exports. ONNX opset 17 / IR 8; no PyTorch is needed for these fixtures.
