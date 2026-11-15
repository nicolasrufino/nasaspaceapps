# The four roles at a glance

Everyone touches the core: the world files, the walk and the demo. But each person leans toward one area. Assigned: **Jules** is Person 1, **Nicolas** is Person 2, **Galsan** is Person 3 (lead). Person X is open. Each person's full brief is in `docs/roles/` (and below on the team page); the blocks are in `docs/BUILD.md`.

## Who leans where

**Lead** = owns it and makes the calls. **Strong** = builds a lot of it. **Some** = needs to understand it and touch it. **Light** = needs to know it exists.

| Area | Person 1 · Jules · ML | Person 2 · Nicolas · App | Person 3 · Galsan · Data and systems | Person X · Story |
|---|---|---|---|---|
| **System design and integration** | Some: model inputs and outputs | Strong: how the app is built (state, flags, views) | **Lead:** shared file formats, pipeline, repo, merges | Light |
| **App, 3D and screens** | Light | **Lead** | Light: deploys it | Some: HUD look and before/after screen |
| **Machine learning and vision** | **Lead** | Light: loads the models | Some: feeds data to the models | — |
| **NASA data and maps** | Some: images | Some: reads the world files | **Lead** | Light |
| **Mars science** (targets, layers) | Some | Light | **Lead** | Some: tells the story |
| **Safety maths** (energy, the ring, the way home) | Strong: checks the numbers | Strong: shows them live | **Lead:** computes them | Light |
| **Pitch, story and design** | Some: the proof numbers | Some: drives the live demo | Some: backup presenter | **Lead** |

## How each person uses AI

| | Person 1 · Jules · ML | Person 2 · Nicolas · App | Person 3 · Galsan · Data and systems | Person X · Story |
|---|---|---|---|---|
| **How much** | Medium volume, high effort | **Most volume** | Medium volume, high effort as orchestrator | Writing and design, little code |
| **Codex profile** | `ml` (high) | `build` (medium), `fast` for CSS and small fixes | `orchestrator` (high), `build` for the pipeline | `fast` |
| **Why** | Training and vision bugs look like working code, so each answer needs thinking and checking | The most blocks (8), mostly independent screens and features: ideal for parallel agents, one per worktree | One bad call on a shared file format blocks everyone | Drafts of the pitch, page and HUD look; the numbers come only from the repo |
| **Watch out for** | Never accept a metric you didn't run yourself | Keep one feature per session so contexts stay small | Run "status" about once an hour, not after every commit | Never let AI invent a number or a NASA claim |

**Most needed overall:** Person 2. The demo lives in the app, and the helicopter scout block waits on two other blocks, so it is the tightest lane. Person 3 comes next: real data unlocks targets, the scout plan and the pitch numbers.

## Person 1 · Jules · Machine learning

- **Primary focus:** turning NASA images into hazard data: rocks from their shadows, ground type from photos, and the numbers that prove it works.
- **Leans toward:** Python, NumPy, PyTorch, image processing, experiments with a held-out test.
- **Needs to know a little about:** the world file formats (`CONTRACTS.md` §1), how the app loads ONNX models, how the energy model makes the ring.
- **Good fit if you:** have trained a model before, like measuring things, and are patient with data.
- **Owns:** `ml/` and `agent/` (the CAPCOM agent on Azure, needed for Best Use of Technology). **First block:** R1, rock detector on one image tile. **Works most with:** Person 3 (images in, rocks out).

## Person 2 · Nicolas · App and 3D

- **Primary focus:** the thing people see and hold: the 3D view, minimap, plan mode, walk, helicopter scout and stops.
- **Leans toward:** JavaScript, three.js, UI, phones and touch, fast iteration.
- **Needs to know a little about:** what each world file means, what the ring is computing, and the flags system.
- **Good fit if you:** are the strongest web or game developer, and like shipping something visible every hour.
- **Owns:** `app/`. **First block:** E1, app with the 3D view and minimap. **Works most with:** Person 3 (files in) and Person X (HUD look).

## Person 3 · Galsan · Data, systems and integration (lead)

- **Primary focus:** the foundation everyone builds on: the real Gale slice, all eight data types, the cost and way-home maths, the helicopter's flight plan, deployment, and keeping the pieces fitting together.
- **Leans toward:** system design, Python scripts, GIS data (elevation models, images, coordinates), reading NASA papers, Git discipline.
- **Needs to know a little about:** how the app and models read the files, and what the pitch claims, so every claim has data behind it.
- **Good fit if you:** think in systems, are careful, and can say no to scope creep. This person runs the orchestrator and merges.
- **Owns:** `data/`, `docs/`, the repo and deployment. **First block:** D1, pick and cut the slice. **Works most with:** everyone.

## Person X · Story, design and pitch (joins later)

- **Primary focus:** making it understood in five minutes: the helmet HUD look, the packing list screen, the before/after screen, the pitch, the video and the project page.
- **Leans toward:** presenting, writing, visual design, light front-end work.
- **Needs to know a little about:** the coarse-to-fine idea (`PRODUCT.md`), what is real and what is simulated, and which numbers the repo has measured.
- **Good fit if you:** are the best speaker on the team and care how things look.
- **Owns:** the slides, the project page, HUD styling. **First block:** X1, the helmet HUD view. **Works most with:** Person 2 (screens) and Person 1 (numbers). Nobody is assigned yet; see the fallbacks in `docs/BUILD.md`.
