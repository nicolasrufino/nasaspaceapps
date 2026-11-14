# Contracts (v1)

These formats are the foundation. Every part of the project reads or writes them, so the engine, the ML work and the AI agent can be built at the same time without waiting on each other. **Changing a contract needs a PR that every owner approves.** Add fields; do not rename or remove them.

## 1. World files (owner: Person 3)

A world is a folder in `data/worlds/<name>/`, produced by `data/pipeline/make_world.py`.

| File | Type | Meaning |
|---|---|---|
| `world.json` | JSON | Size, cell size, base cell, gravity, energy budget, class names, knobs. Read this first. |
| `height.f32` | float32, little-endian, row-major, `width*height` | Elevation in metres. Row 0 is the north edge. |
| `slope.f32` | float32 | Slope in degrees. |
| `terrain_class.u8` | uint8 | 0 unknown, 1 soil, 2 bedrock, 3 sand, 4 big rock (AI4Mars classes). |
| `cost_per_m.f32` | float32 | Walking cost on flat ground for that class, J per metre (for display). |
| `cost_to_go.f32` | float32 | **Energy in joules to walk from this cell back to base**, by the cheapest route. `3e38` = cannot get back. |
| `optical.png` | image, `width`×`height` | HiRISE (or CTX) image of the site, aligned to the grid. *Real sites only.* |
| `thermal_inertia.f32` | float32 | THEMIS thermal inertia (low = loose sand or dust, high = rock). *Optional.* |
| `science.u8` | uint8 | Science value of the cell for the site's goal: 0 none, 1 low, 2 medium, 3 high (from CRISM minerals and geologic units). *Optional.* |
| `dose_rate.f32` | float32 | Radiation dose rate in µGy per hour (Curiosity RAD background, reduced where terrain shields the sky). *Optional.* |
| `rocks_fine.u8` | uint8 | Fine-scale hazards (1 = rock field or drop-off) that orbit misses and the **scout drone reveals**. Hidden in the app until the drone has flown over that cell. Synthetic now; real sites use HiRISE boulder mapping or a simulated scout. |
| `cost_to_go_scouted.f32` | float32 | `cost_to_go` recomputed with `rocks_fine` cells impassable: the way home once the drone has scouted. |
| `targets.json` | JSON list | Science targets: `{"id", "name", "cell": [x, y], "goal", "why", "sources": [...]}`. |
| `stops.json` | JSON list | Rover photos for stops: `{"target_id" or "cell", "image_url", "caption", "credit", "sol"}` (Curiosity Mastcam/Navcam raw images). |
| `route.json` | JSON | The planned route: `{"cells": [[x, y], ...], "stops": ["target id", ...], "energy_j", "minutes", "dose_ugy"}`, computed by the pipeline. |

Optional layers may be missing in a world; the app hides that layer's toggle. `world.json` lists which layers exist under `"layers"` and each layer's mission, instrument and date under `"sources"`.

**The way home is always known:** from any cell, step to the neighbour with the lowest `cost_to_go` until you reach base. No search is needed on the phone.

Index of cell (x, y): `y * width + x`. World position of a cell centre: `x * cell_size_m`, `y * cell_size_m`.

**The walk-back ring** is every cell where `cost_to_go[cell] <= energy_left - reserve`, with `reserve = reserve_fraction * energy_budget_j`. The app only looks this up. No pathfinding runs on the phone.

**Point of no return:** the moment `cost_to_go[current_cell] > energy_left - reserve`. The phone buzzes.

**Oxygen:** the app converts energy to oxygen with `kj_per_l_o2` in `world.json` (about 20 kJ per litre of oxygen), so the HUD can show oxygen left. Energy is the common driver of oxygen, CO2 and heat.

**Reserve:** `reserve_fraction` stands for NASA's 1-hour emergency return plus about 30 minutes of dust removal and getting back inside.

**Energy model:** Pandolf (1977) metabolic rate with a terrain factor per class, scaled to Mars gravity. It is a simple first version, marked in the code. The planned upgrade is NASA JSC's field-modified model (Kim et al. 2024).

## 2. Models (owner: Person 1)

All models ship as ONNX in `ml/exports/`, so they run in a web engine (onnxruntime-web) or in Unity (Inference Engine).

### `terrain_cls.onnx`
- Input `image`: float32 `[1, 3, 128, 128]`, RGB, values 0 to 1.
- Output `logits`: float32 `[1, 5]`, in class order 0–4 above.
- Include in `ml/exports/terrain_cls.json`: held-out accuracy, confusion matrix, training data source.

### `buddy_policy.onnx`
- Input `obs`: float32 `[1, 27]`:
  - `[0:2]` buddy position relative to the astronaut, in cells / 10
  - `[2:4]` base position relative to the buddy, in cells / 100
  - `[4]` astronaut energy left / budget
  - `[5:14]` 3×3 slope around the buddy / 45°
  - `[14:23]` 3×3 terrain class around the buddy / 4
  - `[23:27]` last action, one-hot (4)
- Output `action_logits`: float32 `[1, 9]`: stay, N, NE, E, SE, S, SW, W, NW.
- Behaviour goal (default mode "lead"): stay 2–6 cells **ahead** of the astronaut along low-cost cells (field tests rated rover-leads acceptable and crew-leads not), never enter cells steeper than the slope limit, and head home along the breadcrumb path when the astronaut's energy left drops below 35%.
- Other modes (heel, carry, relay, rescue) are scripted on top of the same grid for now.
- If the shape needs to change, change it here first.

## 3. App state (owner: Person 2)

What the app knows each tick. The agent and the logs use the same shape.

```json
{ "t": 123.4, "astronaut": {"x": 40, "y": 61}, "buddy": {"x": 42, "y": 60},
  "energy_left_j": 182000, "reserve_j": 50000, "cost_to_go_j": 41000,
  "inside_ring": true, "terrain_class": 3, "mode": "step" }
```

Each walk is logged as JSON lines to `logs/` (or local storage on the phone) for the debrief replay and the validation numbers. **The map grows from this log:** each entry may add `{"cell", "kind": "photo" | "ground" | "effort" | "marker" | "sample", "value", "time"}`, and the pipeline merges these into the site files for the next walk.

**Packing list** (app, from the planned route): walk time and energy give oxygen and water with the reserve; each target adds its sampling kit; terrain adds safety items (rock fields, sand); anything over the astronaut's load limit is assigned to the rover. Shown on the plan screen.

## 4. CAPCOM agent (owner: Person 3, Person X later)

- `POST /capcom` with `{ "state": <app state>, "message": "optional text" }` returns `{ "text": "...", "audio_url": "optional" }`.
- The reply is delivered with an **artificial delay** (`delay_s`, default 20 s, standing for 20 minutes) so the demo shows why onboard decisions matter.
- Tools the agent may call: `get_state`, `explain_ring`, `nearest_safe_point`. Every tool call is logged and shown.
