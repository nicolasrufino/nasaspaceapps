# Person 2: App and 3D (Nicolas)

**Who:** Nicolas (GitHub `nicolasrufino`). Lane P2 in `docs/BUILD.md`. The tightest lane: the demo lives here.

**Mission:** the thing people see and hold. One three.js web app with three views of the same map: the habitat display (plan), the tablet minimap the crew carries, and the helmet HUD.

**Owns:** `app/`.
**Reads:** world files (contract §1), ONNX models (contract §2), `scout_plan.json`.
**Writes:** app state and walk logs (contract §3).
**Stack:** web, three.js (decided in `docs/CRITIQUE.md`). Hosted on Azure Static Web Apps by Galsan.

## Your blocks, in order

| Block | When | What | Needs | Issue |
|---|---|---|---|---|
| E1 App, 3D view and minimap | M0 | Load `world.json` and the binary layers; 3D terrain as one mesh raised by `height.f32`; flat minimap coloured by layer | nothing | #8, #9 |
| E2 Walking core | M1 | Move along the route; energy and oxygen drain (`kj_per_l_o2`); walk-back ring = cells where `cost_to_go <= energy_left - reserve`; point-of-no-return buzz; works on a phone over HTTPS | E1 | #10 |
| E3 Plan mode | M1 | Layer toggles from `world.json` (each with mission and date), targets, the route, stop previews with rover photos | E1 | #21 |
| E4 Drone scout | M2 | Fly the scout plan; scan sweep (three.js Raycaster onto a hidden full-detail mesh, dots build up); fade in full detail and rocks; switch to `cost_to_go_scouted`; re-plan | E3, D4 | #25 |
| E5 Why this route | M2 | Panel: cost per stretch, the rejected alternative, slope, rocks, sand, margin home | E4 | #33 |
| E6 Stops and step mode | M2 | Checklist at each stop (look, get close, decide, sample) and a context card; real steps (motion sensor, about 0.7 m each) and compass heading; write the walk log | E2 | #22, #11 |
| E7 Buddy rover and override | Overnight | Scripted lead, heel, return along the breadcrumb path; E-STOP, hold, come to me, return to base | E2 | #12 |
| E8 Export the map | Overnight | Map package and GeoJSON for mission control, "arriving" after the delay | E4 | #34 |
| F2 Fixes only | Freeze | Switch off anything unstable; rehearse the demo walk | E4, E6 | #46 |

If Person X hasn't joined by M2, you also take **X1, the helmet HUD view** (#41): a second layout of the walk showing the ring, heading, next stop and alerts.

## Done when
- The foundation runs on a phone with the synthetic world and the real Gale world, with every flag off.
- Turning any one feature off breaks nothing.

## Don't
- Don't pathfind on the phone: the ring is a lookup in `cost_to_go`.
- Don't hard-code world or cell size: read `world.json`.
- Don't do route maths in 3D: the 3D view is only for showing the ground.

## Agent brief (paste into your coding agent)
> You are helping Nicolas (Person 2, app and 3D) on Martian Map, a NASA Space Apps project. Read `AGENTS.md`, `docs/PRODUCT.md`, `docs/BUILD.md` (lane P2) and `docs/CONTRACTS.md` first. Work only inside `app/`, a three.js web app. Load `data/worlds/<name>/world.json` and the binary layers (float32 and uint8, little-endian, row-major, row 0 north). Build the P2 blocks in order: 3D terrain from the height grid plus a flat minimap; the walk with energy and oxygen drain, the walk-back ring (`cost_to_go <= energy_left - reserve`) and the point-of-no-return buzz; plan mode with layer toggles, targets, route and stop photos; the drone scout with a scan sweep that reveals `rocks_fine.u8` and switches to `cost_to_go_scouted`; the why-this-route panel; stops and step mode with walk logs (contract §3). Every feature behind a flag; the app works with every flag off. Never pathfind on the phone. One issue per session; small, working commits.
