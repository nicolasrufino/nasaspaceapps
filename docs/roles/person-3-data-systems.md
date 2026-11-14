# Person 3: Data, systems and integration (lead)

**Mission:** the foundation everyone builds on, and keeping the pieces fitting together: real Mars terrain into world files, the energy model, deployment, the CAPCOM agent, and the team's merge discipline.

**Owns:** `data/`, `agent/`, `docs/`, the repo settings and deployment.
**Writes:** world files (contract §1), the CAPCOM API (contract §4).

## Foundation (do first)
1. **11:30–12:00** Push this repo; add teammates; protect `main` (PRs only). Everyone runs `python3 data/pipeline/make_world.py`.
2. **12:00–15:00** Real Mars world with at least three NASA layers (optical, topography, thermal; then spectral or geology, and radiation). Site: Mount Sharp boxwork in Gale (suggested; NASA's statement names it and Curiosity measured radiation and weather there). one HiRISE elevation model (DTM) tile from the Mars area we pick (Gale, to match NASA's Curiosity route map, or Jezero, to match the Perseverance images). Downsample to 2–5 m per cell, about 256×256 cells. Write `data/pipeline/load_dtm.py` that feeds it into the same `build()` and writes `data/worlds/gale/` (or `jezero/`). Terrain classes: start from the USGS geologic map units; later from Person 1's classifier.
3. **By 16:00** Export the real world and tell Person 2 the folder name (M1).

## Features (in this order)
3b. `targets.json` for the boxwork goal, `stops.json` with Curiosity raw images near each target, and `route.json` from the pipeline (cheapest safe path through the stops, slope and sand limits applied).
4. Energy model upgrade: replace the simple gravity scaling with NASA JSC's field-modified walking model (Kim et al. 2024) if the paper gives enough detail; otherwise keep Pandolf and say so. Same function, so nothing else changes.
5. Deployment: Azure Static Web Apps (web stack) or a build pipeline (Unity). One link or one APK the team can open.
6. CAPCOM agent (`agent/`): Microsoft Foundry agent with tools `get_state`, `explain_ring`, `nearest_safe_point`; replies delayed 20 s; Azure Speech for voice. Contract §4.
7. Validation numbers for the pitch: for example, the percent of a traverse with at least 20% margin, and how the ring changes under ±30% energy-model error.
8. Until Person X arrives: keep a running list of pitch facts and screenshots in `docs/pitch-notes.md`.

## Done when
- `data/worlds/<real>/` exists and loads in the app.
- The demo link works on a phone that is not ours.
- The agent replies with a delay and its tool calls are visible.

## Integration rules you enforce
- PRs into `main` only; each PR says which milestone and which flag it touches.
- Contract changes need every owner's approval.
- At each milestone time, `main` must run. If a feature is late, it ships with its flag off.

## Agent brief (paste into your coding agent)
> You are helping Person 3 (data, systems and integration) on Martian Map, a NASA Space Apps project. Read `AGENTS.md`, `docs/PLAN.md` and `docs/CONTRACTS.md` first. Work in `data/`, `agent/` and `docs/`. First: `data/pipeline/load_dtm.py` that reads a HiRISE DTM tile, downsamples it to about 256×256 cells at 2–5 m, and passes it through `build()` and `write()` in `make_world.py` so the output matches CONTRACTS §1 exactly; keep `make_world.py`'s self-check passing. Then: a CAPCOM service in `agent/` per CONTRACTS §4 (Microsoft Foundry agent, tools get_state, explain_ring, nearest_safe_point, replies delayed by delay_s, every tool call logged). Never change a contract without updating CONTRACTS.md in the same PR. Commit small, working steps.
