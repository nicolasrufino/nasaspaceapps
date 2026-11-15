# SkyFall in three.js: what the scene shows and why

How the real helicopter mission translates into our 3D view. Each row starts from what SkyFall actually does, cited, and says how we draw it and whether the data behind it is real or simulated. Design decided by Nicolas on 2026-11-15 (brief §9 and §10); building it is P2 work in `app/`.

## What the app has today (for reference)

- **Terrain:** one `PlaneGeometry` with one vertex per 8 m cell and vertex colours per layer (`app/src/main.js`).
- **Helicopter:** a sphere, a spinning rotor and a 15 m cone "beam". It flies the planned route (`routeFlights`, 700 m per flight) and then the D4 flights, revealing `rocks_fine` cells as it passes (`reveal()`), and the route re-plans.
- **Detail tiles:** Luca's 1 m heights and 25 cm HiRISE images are hosted on Azure (#103), but the app does not read them yet (the `world.json` pointer is still to be committed).

## The scene, object by object

| Real SkyFall behaviour (source) | In the 3D scene (three.js) | Data: real or simulated |
|---|---|---|
| **Three helicopters, landing independently** (Mission Package §II) | Three helicopter `Group`s (body, two rotors, landing legs) parked at the habitat dock. A small glTF model later; primitives for now | Simulated flight, real mission design |
| **Daylight only; it navigates with cameras** (NASA "When should Ingenuity fly?") | A scene clock drives a `DirectionalLight` from the sun model. Flights only launch inside the flight window, 9:30 AM–1 PM (`docs/OPERATIONS.md`) | Sun position computed; schedule from NASA |
| **1–2 km, about 2.5 min per flight sol, then a recharge sol** (§II) | A flight is a `CatmullRomCurve3` over the strip, at cruise height. The animation is time-scaled (2.5 min plays in about 10 s) with an on-screen "×15" badge. A "recharging" state shows on the walk sol | Distances real (knob), path simulated |
| **Colour cameras: one straight down, one at the horizon, 143° × 106° field of view, over 200 images per flight** (§IV.b) | Two camera **frustums** drawn as translucent wedges under and ahead of each helicopter. Their footprints on the ground decide which cells get revealed (replaces the 15 m cone) | Geometry from NASA's specs |
| **"cm-scale orthophotos and digital elevation maps" from stereo** (§IV.b) | **The reveal.** Under the frustum, flat grey ground lifts into real relief: Luca's 1 m height tile for that area swaps in, draped with the 25 cm HiRISE image. A **sonar-like sweep**, a bright ring expanding from the footprint, marks where the scan just passed. Outside flown ground the terrain stays flat muted grey | **Real NASA data** (HiRISE 1 m DTM and 25 cm images) standing in for helicopter stereo, which would be finer. On screen: "simulated flight, real NASA terrain" |
| **Navcams find rocky, textured patches for hazard avoidance** (§IV.f) | Rocks found inside the footprint pop up as small dark rock meshes (`InstancedMesh`), and blocked crossings show as red edges | Rocks: `rocks_fine` (DTM estimate + Jules's 23 reviewed rocks). Crossings: Luca's `passable.u8` |
| **Ground-penetrating radar, 3–5 m deep, 10 cm resolution** (§IV.a) | A slower, deeper "ping": a vertical translucent curtain under the flight line, showing layers. **Only as a labelled "SkyFall would add this" layer.** We have no radar data for Gale, so it shows no invented values | Not available: shown as a capability, no fake data |
| **Near-IR cameras for "some information on mineralogy"** (§IV.c) | A toggle that tints flown ground with the CRISM hydration layer we already have, labelled "orbit data; SkyFall's near-IR would sharpen this" | Real CRISM (orbit) |
| **Dosimeter, readings "over minutes to hours", airborne and landed** (§IV.e) | On the recharge sol, a resting helicopter shows a slowly filling dose gauge. The value is our `dose_rate` estimate (RAD mean × sky view), labelled as an estimate. No dose map is drawn from flights, because 2.5 min gives only 2–3 counts (brief §10) | RAD-based estimate |
| **Air temperature and wind from how the helicopter drifts** (§IV.d) | A small wind arrow and temperature readout at the dock; flights are greyed out above a wind limit | REMS daily data for Gale (real); wind limit is a knob |

## Look and feel (brief §9)

- **Unexplored ground:** flat, muted grey. The 8 m heights are still there for the walk-back ring, but drawn desaturated and with lighting reduced. It reads as "not known yet".
- **The habitat:** a detailed spaceship-like model at `base_cell`, the one bright object at the start. glTF, about 1–2 MB at most so the phone stays fast.
- **Explored ground:** full colour HiRISE drape, real 1 m relief, rocks and red blocked edges. It grows strip by strip.
- **The route:** drawn on the 1 m surface where detail exists, and on the 8 m grid elsewhere.

## How it is built (three.js pieces)

- **Two terrain levels:**
  - The 8 m `PlaneGeometry` stays for the whole 2 × 2 km.
  - Each 256 m detail tile is a separate 257 × 257 mesh, created only when a flight footprint first touches it. A tile is about 66k vertices; one revealed strip touches 2–6 tiles. Shared tile edges are identical (#103), so there are no seams.
- **Reveal mask:** a 256 × 256 `DataTexture`, 1 where scouted. The terrain shader mixes grey and colour by the mask. The sweep is a time uniform that animates a ring at the newest mask edge. One texture update per scan step, no geometry rebuild.
- **Footprints:** each frame, project the two frustums onto the 8 m grid, the same way `scanAt` does now. This replaces the circular swath with the real camera shape.
- **Timeline:** one clock object drives the sun, the flight window, the flights and the walk sol (`docs/OPERATIONS.md`). Plan mode shows it as a two-sol strip.
- **Phone budget:** at most 8 detail tiles live at once (oldest dropped back to 8 m when out of view); `InstancedMesh` for rocks; no shadows from the helicopter. Targets 30+ fps on a mid-range phone, to be measured.

## Honesty labels (always on screen when the scout layer is shown)

- "Simulated helicopter flight; terrain and images are real NASA HiRISE data."
- "Rocks: HiRISE estimate plus 23 human-reviewed detections."
- "Radar: SkyFall capability, no data for this site."
- "Dose: estimate from Curiosity RAD and the sky view."

## Build order (each a PR, behind the `drone_scout` flag)

1. Muted-grey terrain plus the reveal mask, with the existing flights. Habitat model placeholder.
2. Read `detail_tiles` from `world.json`; swap in 1 m tiles plus HiRISE where revealed.
3. Three helicopters, real camera frustums, the sweep, a time-scaled flight with badge.
4. Scene clock plus sun plus the two-sol timeline strip.
5. Rocks as instanced meshes, blocked crossings as red edges, the route on the 1 m surface.
6. Radar curtain (labelled), near-IR tint toggle, dose gauge on resting helicopters.
