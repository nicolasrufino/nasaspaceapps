# Person 3: Data, systems and integration (Galsan, lead)

**Who:** Galsan (GitHub `Galsan2005`). Lane P3 in `docs/BUILD.md`. Runs the Codex orchestrator and the merges.

**Mission:** the foundation everyone builds on, and keeping the pieces fitting together: the real Gale slice in world files, all eight data types, the walking-cost and way-home maths, the helicopter's flight plan, the Azure deployment, and the team's merge discipline.

**Owns:** `data/`, `docs/`, the repo settings and deployment.
**Writes:** world files (contract §1), `scout_plan.json`.

## Your blocks, in order

| Block | When | What | Needs | Issue |
|---|---|---|---|---|
| D1 Pick and cut the slice | M0 | 2 × 2 km box in Mars Trek with boxwork, sand, a slope over 15° and a rock field hard to see at 8 m; cut the USGS 1 m terrain and 25 cm images; make the 8 m orbit view (`docs/DATA.md`) | nothing | #13 |
| D2 Real world files | M1 | `data/pipeline/cut_slice.py` cuts the slice and `make_gale.py` builds the world from it: slope, walking cost, cost home from every square; add sand (THEMIS) and science (CRISM, Fraeman et al. local map). Tell Nicolas the folder name | D1 | #13 |
| D3 Targets, stops, first route | M2 | `targets.json` (boxwork, regions from Curiosity's route map), `stops.json` with Curiosity raw photos, `route.json` on the orbit view | D2 | #20 |
| D4 Scout plan | M2 | `scout_plan.json`: route strip first, then anomalies (layers disagree; unusual minerals near a target), then the least certain squares; Ingenuity-class legs (about 700 m, 3 min) | D3 | #32 |
| D5 Deploy on Azure | M2 | Azure Static Web Apps link a stranger's phone can open. Azure makes us eligible for Best Use of Technology | E2 | #14 |
| D6 All eight data types | Overnight | Radiation (RAD), weather (REMS); chemical (ChemCam, APXS) and geophysical (DAN) as points along Curiosity's path. Verify each exists for our slice first | D2 | #40 |
| D7 The map grows | Overnight | Merge walk logs back into the site files | E6 | #27 |
| F3 Final deploy | Freeze | Last deploy; check the link on three phones | D5 | #47 |

If Person X hasn't joined by M2, you also take **X2, the packing list** (#26), keep the pitch notes in `docs/pitch-notes.md`, and write the project page with Nicolas at the freeze.

**Energy model upgrade (if time):** replace the simple gravity scaling with NASA JSC's field-modified walking model (Kim et al. 2024) if the paper gives enough detail; otherwise keep Pandolf and say so. Same function, nothing else changes.

## Done when
- `data/worlds/gale/` exists, loads in the app, and lists every layer with its source.
- The Azure link works on a phone that is not ours.

## Integration rules you enforce
- PRs into `dev`; each PR names its block, milestone and flag. `main` moves only by a release PR `dev` -> `main` at a milestone.
- Contract changes need every owner's approval.
- `dev` must always run; at each milestone, `main` must run. A late feature ships with its flag off.
- Run the orchestrator's "status" about once an hour (`docs/CODEX.md` §3).

## Agent brief (paste into your coding agent)
> You are helping Galsan (Person 3, data, systems and integration) on Martian Map, a NASA Space Apps project. Read `AGENTS.md`, `docs/PRODUCT.md`, `docs/BUILD.md` (lane P3), `docs/DATA.md` and `docs/CONTRACTS.md` first. Work in `data/` and `docs/`. First: `data/pipeline/cut_slice.py` that reads the USGS Gale 1 m terrain model for our 2 × 2 km box, makes the 8 m orbit view, and passes it through `build()` and `write()` in `make_world.py` so the output matches CONTRACTS §1 exactly; keep `make_world.py`'s tests passing. Then targets, stops and route; then `scout_plan.json` (route strip, then anomalies, then least-certain cells). Never change a contract without updating CONTRACTS.md in the same PR. Never read binary data files; use `world.json` and printed summaries. One issue per session; small, working commits.
