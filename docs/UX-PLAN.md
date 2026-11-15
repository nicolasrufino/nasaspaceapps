# UX plan: Vesta Scout as a guided mission, Vesta Vision as the map

Proposed 2026-11-15, 8:30 AM. Submission closes 1:30 PM. Status: **accepted by Nicolas 15 Nov; being built in `app/src/flow/`.** Vision lives at `/scout/?vision` for now (not `/vision/`).
Source: Nicolas's direction of 15 Nov. Site in both products: the Gale crater slice (2 × 2 km of lower Mount Sharp), the one the app already uses.

## 1. The split

| | Vesta Scout | Vesta Vision |
|---|---|---|
| What it is | A guided mission, seen from the crew's side: plan at the habitat, send the scout, come back, choose the walk | The explorable map: every layer, every planned route, and walking it at eye height |
| Camera | Third person only: beside the habitat, then behind the helicopter, then behind the astronaut | Free map view, plus "Street View" at eye height |
| The 2D map | The main planning surface: it is what orbit gives us | A minimap |
| Layers, legend, advanced views | None. One fact at a time | All of them, as chips |
| Opening | Starts at the habitat, on the ground | The fly-down from orbit |
| URL | `/scout/` | `/vision/` |

Nothing in Scout scrolls. Nothing in Scout is a paragraph.

## 2. Vesta Scout: four stages

A stepper across the top always shows where you are: **1 Plan · 2 Read the orbit map · 3 Scout · 4 Choose the walk**.

### Stage 1. Plan (at the habitat)
- **Scene:** third person, low, the astronaut and the habitat in front of you, Mount Sharp behind.
- **Centre:** a large 2D orbit map (the HiRISE picture, north up), labelled "What we know from orbit". The science stops are pins on it; tap to add or drop one. Tap a pin for its one-line reason and photo.
- **Left card:** "How should we walk it?" Two choices, because these are the two the planner really has: **Easiest** (least energy, the default) and **Shortest** (least distance). No third option is invented.
- **Right card:** three numbers for the current choice: distance, energy used of the usable budget, walking time.
- **Bottom centre:** one button, **Send the scout**.

### Stage 2. Read the orbit map (about 8 s, automatic, skippable)
The 2D map stays on screen and the system shows its own reasoning as it happens, one line at a time, each tied to something drawn on the map:
1. The planned route draws itself.
2. "Orbit sees rocks down to about 1.5 m. Smaller ones are a guess." The chance-of-hidden-rocks layer fades in under the route (the belief map, labelled experimental).
3. "N cells on this route have never been seen up close." They pulse.
4. "3 flights, 1 km each." The three corridors draw.
Small print under the map: "Planning with unknown blockages: the Canadian Traveller Problem." Numbers come from the planner, not from this document.

### Stage 3. Scout (third person behind the helicopter)
- **Scene:** chase camera 14 m behind the helicopter, slower than today (about 40 s per flight; a **2×** button and **Skip**).
- **Top left:** "Flight 1 of 3" and a distance bar.
- **Top right:** live counters: rock cells found, route cells avoided, energy change.
- **Bottom centre:** an event line that appears when something happens and fades: "Rock field found. Route moves around it. +8 kJ." This reuses the per-flight explanations already in the app.
- **Bottom right:** the 2D map filling in: seen ground turns to colour, found rocks turn red, the route line moves when it is re-planned.
- **On the ground:** the scan ring (already built); found rocks get a red outline that stays.
- After each landing, a 2 s card: what that flight found and what changed.

### Stage 4. Choose the walk (back at the habitat)
- **Centre:** the 2D map with two routes: **Scouted route** and **Without the scout** (red dashes, with the rocks it would have crossed marked).
- **Cards:** hazards avoided, extra energy it cost, energy left when home.
- **Buttons:** **Preview the walk** (third person behind the astronaut along the scouted route; a toggle shows the unscouted one), **Scout again** (if flights are left or after changing stops), **Explore in Vesta Vision**.

## 3. Vesta Vision

Laid out like a maps app:
- **Top:** layer chips (Imagery, Hazards, Energy home, Science, Radiation, Contours).
- **Left:** the list of planned routes and stops, already computed; tap one to fly to it.
- **Map:** the 3D terrain, free camera, opening fly-down.
- **Street View:** tap any route to drop to eye height and walk along it (the eye-level view already built).
- **Bottom right:** minimap, scale bar, north arrow.

Cheapest honest version: Vision is today's map screen, restyled, at `/vision/`. Everything in the list above except the route list already exists.

## 4. Look

Match the landing page (`app/mission-vesta/mission.css`):
- **Type:** Michroma for stage names and big numbers (upper case, spaced); Rethink Sans for everything else.
- **Colour:** paper `#f3f2ef` and ink `#191919`. Over the 3D scene, cards are ink at about 70% with a blur, paper text, a thin `#ceccc7` rule.
- **Accents, one meaning each:** cyan = the scout and what it has seen; amber = science stops; red = hazards; white = the route.
- **Rules:** at most three numbers on screen; buttons at least 44 px; one primary button per stage; no scrolling panels.
- **Phone:** stepper on top, the cards become one bottom sheet, the 2D map goes full width.

## 5. Build order (each slice ships on its own)

| Slice | What | Rough time |
|---|---|---|
| 1 | Shell: stepper, card layout, fonts and colours; start at the habitat; Stage 1 with the big 2D map, Easiest/Shortest, Send the scout | 1.5 h |
| 2 | Stage 3 HUD: slower chase flight, counters, event line, 2D map filling in; then Stage 2 | 1.5 h |
| 3 | Stage 4: with/without comparison, walk preview, scout again | 1 h |
| 4 | `/vision/`: today's map restyled with chips; route list if time | 0.5 h |

The new flow sits behind a flag (`flow`) until slice 1 works end to end, then becomes the default. The old screen stays reachable as Vision.

## 6. Risks

- **Time:** about 5 h to the deadline, and the release, video and project page need the last hour. Slices 1 to 3 fit only if nothing else goes wrong. The cut line if it gets tight: ship slices 1 and 2, keep today's result panel for stage 4.
- **Tests:** the browser tests look for today's element ids (`#title`, `#scout`). Keep those ids.
- **Pitch check:** every `main.js` change needs the pitch hashes regenerated.
- **Honesty:** "image recognition" during the flight is simulated: the rocks come from the hidden-rock layer, not from a live classifier. The screen says "simulated scan".
