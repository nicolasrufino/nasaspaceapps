# UX plan: Vesta Scout as a guided mission, Vesta Vision as the map

Proposed 2026-11-15, 8:30 AM. Submission closes 1:30 PM. Status: **accepted by Nicolas 15 Nov; being built in `app/src/flow/`.** Vision lives at `/scout/?vision` for now (not `/vision/`).
Source: Nicolas's direction of 15 Nov. Site in both products: the Gale crater slice (2 × 2 km of lower Mount Sharp), the one the app already uses.

## 0. Version 2 (Nicolas's review of the first build, 15 Nov, about 9 AM): proposed, not built

This section replaces §2 and §4 below where they differ.

### What changes everywhere
- **You are inside the habitat.** Stages 1, 2 and 4 are a full-screen console: the 2D orbit map and solid panels. No 3D scene behind them. The 3D scene appears only when the helicopter flies (stage 3) and in the walk preview.
- **Type:** Rethink Sans only, the font of the landing page's body and of "Vesta Scout" there. The Michroma title font is dropped.
- **Panels:** solid, no outline, no transparency.
- **Getting around:** a "Mission VESTA" link (top left) back to the landing page; a Back button on every stage; finished steps in the stepper can be tapped.
- **Nothing advances by itself.** Every stage ends with a button the user presses.

### Stage 1. Choose where to go
- **What it is:** the crew at the console, looking at the only thing they have: the orbit picture.
- **Starts empty.** No stops are chosen for you.
- **Two ways to add a stop:** tap anywhere on the map, or pick from "Suggested by the science team" (our five targets, each with its one-line reason and rover photo).
- **At least 3 stops** before you can go on (the planner takes up to 12).
- **How to walk it:** Easiest or Shortest, as a preference only. **No metres, energy or minutes yet**, and no route line: nothing has been worked out. The stops are just pins.
- **Button:** "Plan the route".

### Stage 2. How the route is found (was "Read the orbit map")
A step-by-step explainer of the algorithm on your own stops. The user moves with Next and Back; each step is one picture on the map and at most two sentences. It is the part that matters most.

| Step | What the map shows | What it says (numbers computed live) |
|---|---|---|
| 1. The straight line | Straight lines joining your stops, with the parts that cross steep ground in red | "The simplest plan joins the stops with straight lines. Here that crosses N m of ground steeper than 20°, the suit's limit." |
| 2. From a picture to terrain | The slope colours fade in over the picture | "Orbit also gives height (HiRISE stereo). From height we get slope, and from slope and ground type the energy of every step." |
| 3. The best route orbit can give | The Easiest or Shortest route draws; the numbers appear for the first time | "The least-energy route: N m, N kJ, N minutes. As far as orbit can tell." |
| 4. What orbit cannot see | The hidden-rock estimate near the route; unseen stretches pulse | "Orbit sees rocks down to about 1.5 m. N m of this route has never been seen up close." |
| 5. Where to send the helicopter | The flight corridors | "3 flights of 1 km. After each landing the route is planned again with what was found. (Planning with unknown blockages is the Canadian Traveller Problem.)" |

- **Button on the last step:** "Send the scout". It is never automatic.
- **Not said:** that NASA used straight-line planning. We have no source for it, so step 1 calls it "the simplest plan".

### Stage 3. Scout
Kept as built (third person behind the helicopter), plus what was missing: **what is being detected.**
- **A detections list** (right): one row per find: what ("Rock field, 6 cells, about 380 m²"), where ("210 m into flight 1, near stop 2"), and what it means ("On the route: route moved, +8 kJ" or "Off the route: noted").
- **A legend for the scan:** cyan = the 30 m strip the camera sees; red = rocks too big to step over (over 0.3 m).
- **Totals:** ground scanned (m²), rock cells found, how many were on the route.
- Still labelled a simulated scan.

### Stage 4. Choose the walk
- Back inside the habitat: the console layout of stage 1, with the comparison Nicolas liked (with and without the scout, both at once).
- **Walk preview fixed:** it walks by itself, with Play/Pause, Step, speed and Restart, and a Back to the comparison.
- Buttons: Preview the walk, Scout again, Change the stops, Explore in Vesta Vision.

### Layout (from the reference research, 15 Nov)
Four agents looked at games, drone and mission software, map apps and step-by-step explainers. They agree on three rules, which replace the centred square map with cards on both sides:

1. **The map is the page.** It fills the screen, is never framed, and does not move or resize between steps.
2. **One rail, same side, every stage.** A left rail about 360 px wide (a bottom sheet on a phone) holds everything else; only its content changes. Nothing floats over the middle of the map.
3. **Fixed homes.** Top bar: back to Mission VESTA on the left, the four stages in the middle. Primary action: pinned to the bottom of the rail, always the same place. Numbers: a strip on the map, top right, that appears only once the numbers exist. Map tools and the mini map: bottom corners.

| Stage | Rail (left) | On the map | Borrowed from |
|---|---|---|---|
| 1 Choose stops | Easiest/Shortest toggle; your stops as a numbered list with "2 of 3 needed"; "Suggested by the science team" below; **Plan the route** pinned at the bottom, off until 3 stops | Pins only. A row in the list and its pin highlight together | Komoot and Google Maps planners; Surviving Mars site select |
| 2 How the route is found | "2 of 5" with a five-part progress bar you can tap; a short title; two sentences whose coloured words match the map's colours; the model-card line when a model is used; Back, and a Next button that names the next step. On step 5 Next becomes **Send the scout**, same place | One thing changes per step. The number strip (distance, energy, time) appears at step 3 | Mapbox storytelling; Red Blob Games; Ciechanowski; Nicky Case |
| 3 Scout | Narrower rail: flight n of 3 with distance bar and battery; the detections list, newest first, each row "what, where, what it means"; totals; 2× and Skip at the bottom | The 3D chase view with the centre kept clear; mini map bottom right; scan legend beside it | DJI and Ghost Recon drone views |
| 4 Choose the walk | Two route cards, "With the scout" and "Without", three numbers each and the difference; **Preview the walk** pinned at the bottom; Scout again, Change the stops, Vesta Vision | Both routes on one map. An energy-and-height strip along the bottom; in the preview its scrubber is the playback head, with Play/Pause, Step and speed at its left end | Google Maps alternatives; Komoot and Strava profile strip; Death Stranding results |

The references themselves (links) are in the agents' reports, summarised in the PR that builds this.

### Machine learning, said where it is used
Each model gets one small "model card" line at the moment it matters: what it is, what it learned from, how good it measured, and its limit. Figures are from `ml/exports/` and `app/scripts/belief-fit.json`; nothing is rounded up.

| Where | Model | The line on screen |
|---|---|---|
| Stage 2, step 4 (what orbit cannot see) | **Chance of hidden rocks**: logistic regression on two terrain features (slope ratio, 8 m relief) | "Rock-chance model: scores 0.73 (AUC) on a development check with reviewed rocks. Not calibrated: it ranks ground, it does not give true odds." |
| Stage 2, step 4 and stage 3 (what the scout finds) | **Rock detections from orbit images**: ROSCO detector on HiRISE, each proposal checked by a person | "23 of 25 detector proposals confirmed by a person. Coverage is not complete, so no hit rate is claimed." |
| Stage 3 (scan) | none live | "Simulated scan: rocks come from the stored rock layer (terrain roughness estimate plus the 23 reviewed rocks), not from a live classifier." |
| Stage 4 and Vision (at a stop, from a ground photo) | **Ground-type classifier**: MobileNetV3-small features with a trained linear head, on NASA/JPL AI4Mars labels, running in the browser | "Ground classifier: 93% on 159 held-out Curiosity patches; 48% on 197 Perseverance patches, so it does not transfer to a new rover yet." |

The fourth export, `buddy_policy`, is a placeholder and is not mentioned in the product.

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
