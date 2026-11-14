# R1 recovery validation — 2026-11-14

Recovered onto real upstream history at `250d27fc2ef0623057467dd72cdd8878de06784f`
(route planner, PR #59). This supersedes the old handoff deployment and
publication notes. No app or deployment configuration is changed here.

## Local checks

- `python -m pytest -q --basetemp=ml/runs/pytest-review-1`: 23 passed,
  1 skipped (CAPCOM has no implementation on this base).
- Ruff, `git diff --check`, and the Git Bash hygiene script pass.
- `python ml/check_exports.py`: zero models, zero problems. This PR does
  not deliver an ONNX model.
- Both embedded-metadata and explicit `--metadata` reproduction runs produce
  exactly the frozen proposal JSON: all 50 IDs, coordinates and provenance.
- Both detail sheets reproduce pixel-for-pixel. The overview has 33 differing
  rendered pixels out of 1,110,016; it is not byte-identical to the supplied
  preview. Candidate records and source pixels are unchanged. Both current
  reproduction routes produce identical preview files.
- The accepted and unreviewed JSON files are preserved from the supplied code
  archive. Tests assert unchanged positions, marker sizes, source and Mars
  coordinates, reject unrelated pixels even with copied embedded metadata, and
  protect existing review decisions from overwrite.
- The default Windows temporary directory was inaccessible. An ignored local
  `--basetemp` resolves this without modifying tests or world fixtures. Unlike
  the historical archive run, the current synthetic-world freshness test passes.

## Reproduce

Install `ml/requirements-ci.txt` plus pytest and ruff. Keep the supplied source
PNG under ignored `ml/data/`, then run the commands in `README.md` into fresh
directories. The PNG SHA-256 is recorded in `source.json`; the renderer checks
the grayscale pixels and complete source metadata before geolocating proposals.

## Scope and pending evidence

Jules accepted the 50 selected locations. This is not held-out detector
precision/recall, exhaustive annotation, rock contours or a reliable size limit.
Issue #31 stays open. R3 needs Luca's selected extent, aligned image/DEM and
world-grid metadata. Nico's request for independent evaluation in #31 requires
a separate annotated region and reviewed misses/false alarms.

The PR's own GitHub Actions result is authoritative for Linux CI. Historical
green runs on upstream do not validate these changes.
