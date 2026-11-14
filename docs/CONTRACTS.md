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

Index of cell (x, y): `y * width + x`. World position of a cell centre: `x * cell_size_m`, `y * cell_size_m`.

**The walk-back ring** is every cell where `cost_to_go[cell] <= energy_left - reserve`, with `reserve = reserve_fraction * energy_budget_j`. The app only looks this up. No pathfinding runs on the phone.

**Point of no return:** the moment `cost_to_go[current_cell] > energy_left - reserve`. The phone buzzes.

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
- Behaviour goal: stay within 2–6 cells of the astronaut, scout ahead along low-cost cells, and head home when energy left drops below 35%.
- If the shape needs to change, change it here first.

## 3. App state (owner: Person 2)

What the app knows each tick. The agent and the logs use the same shape.

```json
{ "t": 123.4, "astronaut": {"x": 40, "y": 61}, "buddy": {"x": 42, "y": 60},
  "energy_left_j": 182000, "reserve_j": 50000, "cost_to_go_j": 41000,
  "inside_ring": true, "terrain_class": 3, "mode": "step" }
```

Each walk is logged as JSON lines to `logs/` (or local storage on the phone) for the debrief replay and the validation numbers.

## 4. CAPCOM agent (owner: Person 3, Person X later)

- `POST /capcom` with `{ "state": <app state>, "message": "optional text" }` returns `{ "text": "...", "audio_url": "optional" }`.
- The reply is delivered with an **artificial delay** (`delay_s`, default 20 s, standing for 20 minutes) so the demo shows why onboard decisions matter.
- Tools the agent may call: `get_state`, `explain_ring`, `nearest_safe_point`. Every tool call is logged and shown.
