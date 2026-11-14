# data/ (Galsan, Person 3: pipeline and world files)

Your blocks and their order: `docs/BUILD.md`, lane P3.

Applies to everything under `data/`. The root `AGENTS.md` still applies.

- Brief: `docs/roles/person-3-data-systems.md`. Output format: `docs/CONTRACTS.md` §1 (add fields, never rename or remove).
- `make_world.py` is standard library only; keep it that way. Heavy readers (rasterio, GDAL) go in a separate script with its own requirements file.
- Raw downloads go in `data/raw/` (git-ignored). Commit only small world folders (about 256x256 cells).
- Check before every PR: `python3 data/pipeline/make_world.py && python3 data/pipeline/check_world.py && pytest`. CI fails if a committed world breaks CONTRACTS §1, if `data/worlds/synthetic/` is stale versus `make_world.py`, if a world is over 320x320 or 5 MB, or if anything under `data/raw/` or over 2 MB is committed in `data/`.
