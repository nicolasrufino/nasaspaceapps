# ml/ (Jules, Person 1: machine learning)

Your blocks and their order: `docs/BUILD.md`, lane P1.

Applies to everything under `ml/`. The root `AGENTS.md` still applies.

- Brief: `docs/roles/person-1-ml.md`. Shapes: `docs/CONTRACTS.md` §2. Why the rover leads: `docs/RESEARCH.md` §6 and §9.
- Environment: `python3 -m venv .venv && . .venv/bin/activate && pip install -r ml/requirements.txt`. Never add these packages to the root `requirements.txt` (CI installs that one).
- Read worlds from `data/worlds/<name>/` with the contract formats; never write there.
- Every model ships as ONNX in `ml/exports/` with a metrics JSON next to it (held-out number, data source).
- Check before every PR: `python ml/check_exports.py` and `pytest` (CI installs `ml/requirements-ci.txt`: onnx + onnxruntime, no torch). The metrics JSON keys it wants are in its docstring; untrained placeholders set `"placeholder": true`.
- Large data, checkpoints and runs go in `ml/data/` and `ml/runs/` (git-ignored). Never commit datasets.
