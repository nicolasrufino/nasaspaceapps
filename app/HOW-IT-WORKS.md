# How Martian Map works

Plain-language notes on every rule and formula the app uses, for the project page and the pitch. Every number here comes from the code in this repo (`app/src/`, `data/pipeline/make_world.py`) or from a test or run on our worlds. **Estimates are marked as estimates.** Update this file whenever a rule changes.

The map is a grid. The real Gale slice is 256 × 256 squares ("cells") of 8 m each, so 2 × 2 km of lower Mount Sharp. Each cell knows its height, slope and ground type from NASA data (HiRISE stereo terrain, HiRISE colour images; see `world.json` `sources`).

---

## 1. How much energy a step costs

**Rule:** walking energy uses the **Pandolf equation** (Pandolf et al., 1977), a US Army formula for walking with a load, scaled to Mars gravity.

```
watts = 1.5·W + 2·(W + L)·(L / W)² + η·(W + L)·(1.5·V² + 0.35·V·G)
watts on Mars = watts × gravity_energy_factor (0.68 for this world)
joules for a step = watts on Mars × distance / V
```

| Symbol | Meaning | Value now |
|---|---|---|
| W | body mass | 75 kg |
| L | load carried | 60 kg (suit and kit) |
| V | walking speed | 1.0 m/s |
| G | uphill grade, in % (downhill counts as flat) | from the height of the two cells |
| η | terrain factor: how hard the ground is to walk on | bedrock 1.0, soil 1.1, unknown 1.2, big rock 1.5, sand 4.372 |

**PR #94 assumptions:** `knobs.eta` and `gravity_energy_factor` now come from
the world. Sand's factor is chosen so the complete formula costs **2.4× flat
bedrock**; multiplying only one term by 2.4 would not produce that ratio.
The **0.68 gravity-energy factor is an estimate to verify**, not certified Mars
walking performance. Ground-class mappings and suit effort also need field
calibration. Downhill receives no discount or penalty, and speed stays fixed.
Worlds without the new knobs retain the old fallback for compatibility.
See `docs/CONTRACTS.md` §1 and `ml/pitch_metrics/PITCH_NUMBERS.md` for the
current assumptions and the ±30% sensitivity calculation.

Code: `stepCostIdx` in `app/src/walk.js`, `pandolf_watts` in `data/pipeline/make_world.py`. A test checks the app and the pipeline agree to within 0.1%.

## 2. Walls: where you can't walk

- **Slope over the limit** (`max_slope_deg`): a suited astronaut can't climb it, so the cell is a wall. The rebuilt PR #94 world uses **20°**, the team's Artemis xEVA limit. The app reads it from `world.json`; crossings and scout anomalies were rebuilt at the same limit.
- **Crossings:** when `passable.u8` exists, each step must follow an allowed direction. The pipeline and app both use these constraints.
- **Rocks the helicopter has seen** (`rocks_fine`): walls once known. Before scouting nobody knows they are there, which is the point of the scout.

## 3. The way home from everywhere (cost to go)

For every cell, the pipeline works out **the least energy needed to walk from that cell back to base**, following the cheapest path (Dijkstra's shortest-path algorithm on the grid, with the step cost above). This map is `cost_to_go`. The phone never searches for a path during the walk; it only looks this number up.

## 4. Energy budget, reserve and oxygen

- **Budget:** the default Gale `worst` scenario has **3,165.180 kJ** for walking. It assumes 5 h of suit time left after 3 h of station work, subtracts 2.5 h at science stops, and uses a 1200 BTU/hr suit sizing rate. These are estimates, not measured EVA endurance.
- **Reserve:** **1,899.108 kJ**, or **60%** of that budget, represents 1.5 h at the same sizing rate. Usable walking energy is **1,266.072 kJ**. `?scenario=ideal` selects a different scenario; the pitch uses `worst`.
- **Extra 20% margin:** the R5 audit asks for another **633.036 kJ** beyond the energy home and this reserve. It is separate from `reserve_fraction`.
- **Oxygen:** the body burns about **20.1 kJ per litre of oxygen** (`kj_per_l_o2`), so oxygen left = energy left ÷ 20.1. For example, 300 kJ left ≈ 15 L of oxygen.

## 5. The walk-back ring and the point of no return

- **Ring:** every cell where `cost to go ≤ energy left − reserve`. Inside it you can still get home with the reserve untouched. The ring shrinks with every step, because every step spends energy.
- **Point of no return:** the moment the cell you stand on leaves the ring. The screen turns red, the phone vibrates (Android) and beeps (iPhone). A test checks it fires exactly once on a walk that goes too far.

## 6. Planning the route

You choose the stops (Curiosity's drill sites from `targets.json`, or your own spot tapped on the map). The app then:

1. **Works out the cheapest path** from base and from each stop to every cell (Dijkstra, same energy and walls as above).
2. **Tries every order** of the stops and keeps the best one (an exact method called Held-Karp; fine up to 12 stops).
3. **Fits the budget:** visits **as many of the chosen stops as fit in the usable energy**, and among those, the order that uses the **least energy**. Stops that don't fit are listed in red.

"Best" means **least effort, not shortest or fastest**: it will walk around a hill rather than over it if that's easier. Because speed is fixed at 1 m/s, time = distance ÷ 1 m/s.

**Current Gale result:** all five default stops, 1274.7 m and 621.4 kJ before scouting (`ml/exports/pitch_metrics.json`). This is a simulated route, not measured human exertion.

**Not yet in the plan:** fastest or safest route options, daylight and temperature, radiation dose (issue #78); shaping the route by hand (#79); per-stop effort simulation (estimated stop time is already deducted when sizing the world budget).

Code: `app/src/plan.js`.

## 7. The helicopter scout

Orbit images can't see rocks smaller than about a metre. A small helicopter (Ingenuity-class, like NASA JPL's on Mars) flies first. **The flight is simulated; the data it reveals is the world's own rock layer.**

- **Runtime route-flight limit:** at most **1,000 m per flight**, the selected low end of SkyFall's 1–2 km design expectation (`docs/OPERATIONS.md`). This is a scenario assumption, not an Ingenuity record. The stored extra flights in `scout_plan.json` retain their legacy distances.
- **What it sees:** everything within **15 m** of its path, a 30 m wide strip (`SWATH_M`, a knob to tune with a real camera footprint).
- **Order of flights before a walk:** first along the **planned route**, then the team's extra flights (`scout_plan.json`): **anomalies** (places where the data disagrees), then the **least certain** areas.
- **What changes when it lands:** rocks it saw become walls, the way home switches to the scouted version for every cell it saw, and the route re-plans. The old route stays on screen as red dashes.

**Fixed 60 fps Gale replay:** seven flights discover 95 hazard cells; 6 distinct discovered cells lie on the original route, zero on the first replan. Walking energy changes 621.4 → 629.7 kJ. Two unobserved stored hazards remain. Two passes (14 flight legs, 9.43 km) fully scan the final 630.5 kJ route with zero stored-hazard crossings. Helicopter energy is excluded; live frame timing can change counts.

## 8. The "best areas" map

A score from 0 (don't go) to 1 (go) for every cell, from what is known right now:

```
score = 0                    if slope > the limit, or a rock was seen there,
                             or the round trip doesn't fit the usable energy
score = (1 − round trip ÷ usable energy) × (1 if scouted, ½ if not) × science weight
round trip = energy from base to the cell + cost to go back
science weight = 0.4 + 0.2 × science value (0–3), when the world has a science layer; otherwise 1
```

Brighter green = more energy to spare after going there and back. The map brightens as helicopters scout, because scouted ground is trusted twice as much.

## 9. "Why this route" (the explanation panel)

The panel decides nothing; it measures the route the planner chose and the ones it beat (flag `why_route`).

- **Each stretch** (base → stop → … → base): distance, energy (the Pandolf cost of every step), walking time, steepest slope and share of sand.
- **Steepest ground** on the whole route, against the slope limit.
- **Tightest moment:** the least energy to spare at any point, after the cost of getting home and the reserve: `energy left − reserve − cost to go`.
- **The rejected alternative:** the **shortest-distance** route through the same stops in the same order (what a person would draw), drawn as grey dashes. The panel says what it would cost and why: more sand, more climbing, steeper ground.
- **After a scout:** how many rock cells the old route crossed and what avoiding them costs.

**Current reproducible Gale audit:** the first replan adds 36.7 m and 1.33%
walking energy. After two passes, the final route is 1311.4 m and 630.5 kJ.
Minimum extra margin beyond home and reserve is 635.6 kJ nominally, or 446.5 kJ
at +30% walking cost. These values come from `ml/pitch_metrics/PITCH_NUMBERS.md`;
the panel itself reflects the current route and live scout sampling.

Code: `app/src/why.js`.

## 10. At the stops, step mode and the walk log

**At each stop** (flag `science_stop`) the walk pauses and a card shows the stop's name, goal, why it matters, sources and, with `pov_images`, Curiosity's photo of it. The crew works a short checklist, the way Perseverance works a target: **look** (photograph the site), **get close** (inspect a rock), **decide** (is it worth it?), then **take a sample** or **move on**. The walk carries on only once the checklist is finished or skipped. A sample saves a context card: the cell, what every map layer says there, the photo and the time.

**Warnings** in the walk panel, most urgent first:
- energy left below the reserve → "Oxygen below the reserve: head home now"
- `energy left − reserve − cost to go < 0` → past the point of no return
- that margin under 10% of the energy budget → "Turn back soon"

**Markers:** "Mark here" drops a waypoint at the astronaut; tapping the minimap on the Walk tab drops one there (pink pins).

**Step mode** (flag `step_mode`): the phone counts real steps and each one moves the astronaut **0.7 m along the planned route**. When the metres walked add up to the next cell's distance (8 m on Gale), the astronaut moves one cell and pays that cell's walking energy as usual. The step-counting rule:

```
a = size of the phone's acceleration, gravity included (m/s²)
average = 0.9 × average + 0.1 × a          (follows gravity and how the phone is held)
a step  = a goes more than 1.2 m/s² above the average,
          at least 0.3 s after the last step,
          and a has dipped below the average since then
```

The compass (iOS: `webkitCompassHeading`; Android: absolute orientation) says which way the route goes next: "route 30° to your right". It guides; it doesn't steer, so a straight hallway still walks the whole route. The 0.7 m stride and the 1.2 m/s² threshold are knobs in `app/src/steps.js`, to tune on a real phone. Steps taken while a stop's checklist is open don't move you. On a laptop there are no sensor readings, so the Walk and Step buttons stay.

**The walk log** (either flag on; contract §3): one JSON object per line, kept in the browser's local storage, downloaded with "Download walk log" as a `.jsonl` file. The first line names the world, the start time, the planned stops and the flags; then the app state once per tick (time, position, energy, reserve, cost to go, inside the ring, ground type, `mode` = `route` or `step`), plus map entries `{cell, kind, value, time}`:
- `photo` at a stop's "look" step (the rover photo stands in for the astronaut's own for now)
- `sample` with the context card
- `marker` for each waypoint dropped

`time` is walk time in seconds, the same clock as the app state. A new plan or Reset starts a new log. Block D7 (the map grows) merges these entries into the site files for the next walk.

Code: `app/src/stops.js`, `app/src/steps.js`, `app/src/log.js`.

## 11. Ground-photo classification (flag `classifier`, M2 R4 → E6)

In Walk mode, choose a ground photo and select a square of 256 × 256 source pixels.
The retained MobileNet v1 model predicts the dominant surface in that square: soil, bedrock,
sand or big rock. Resizing and RGB conversion match the training input; the model does its own
normalization. Computation runs on the device in a Web Worker, after downloading the model once
for that page session. The photo is not sent to a server.

The displayed percentages are softmax scores: exponentiate each of the four learned logits,
then divide by their sum. They express relative preference, not measured accuracy or safety.
Unknown is a fixed logit and is not a learned rejection class. Training used NASA/JPL AI4Mars
Curiosity ground photos, so helicopter and orbital use remain unvalidated. There is no per-pixel
segmentation, height measurement or georeferencing here; the current map and route remain unchanged.

Code and verification: `app/src/terrain-*.js`, `app/e2e/terrain.spec.js`, `app/README.md`.

## 12. Chance of hidden rocks (the belief map, flag `belief`)

The first step of the scouting algorithm (`docs/SCOUT-ALGORITHM.md` §2A): before any flight, every cell gets a **chance that it hides rocks** that block a suited walker. Where the helicopter has flown, the chance becomes 0 (clear) or 1 (rocks found).

```
chance = 1 / (1 + e^(−z))
z = bias + w1 × (slope ÷ slope limit, standardised) + w2 × (8 m relief, standardised)
```

- **8 m relief** is how much the heights vary in the 3 × 3 cells around a cell (HiRISE terrain).
- **The weights are fitted by a script** (`app/scripts/belief-fit.mjs`) on the west half of the existing DTM-plus-reviewed mask. It reports an east-half mask comparison and a development diagnostic using reviewed positive cells against unreviewed mask-zero negatives. Some reviewed positives are also in the fitted half, and this diagnostic selects the feature set. It is not an independent human test. Counts and caveats: `app/scripts/belief-fit.json`.
- **Scores today:** AUC 0.687 against the proxy rock layer and 0.729 on that reviewed-positive/development diagnostic. Average prediction is 2.2% versus a 1.8% proxy-mask rate. Neither AUC nor matching a mean rate validates probability calibration; these are not measured probabilities of an astronaut's path being blocked.
- **Actual human-positive sample after the slope filter:** only 3 of the 22 reviewed cells are evaluated; 2 are also in the training half. The 48,664 negative cells are unreviewed mask zeros. The diagnostic also selects among feature sets, so it cannot serve as a held-out accuracy claim.
- **Why only two layers:** the 1 m layers (`fine_steep`, `dropoff`, Luca's `unsure`) come from the same 1 m terrain the rock estimate was built from. They predict the estimate well (unsure alone: 0.757) but **not** the real rocks (0.441, worse than guessing). Adding them gives 0.248 on real rocks. They would only echo the estimate.
- **Refitting:** `node app/scripts/belief-fit.mjs` reproduces the current prototype. A full-slice detector run does not by itself justify replacing `rocks_fine` or calling zero detections safe. A scientific refit needs separately reviewed negatives, held-out spatial areas and calibration checks (`ml/LABEL_POLICY.md`).
- **On the map:** grey means unlikely; red means a 10% chance or more (found rocks are full red). Labelled "Estimate".

## 13. The picture on the ground (Imagery view)

The default view shows **real HiRISE colour imagery** on the terrain (NASA Mars Reconnaissance Orbiter; USGS MSL Gale 25 cm mosaic; credit NASA/JPL-Caltech/University of Arizona). The app draws it at 1 m per pixel over the whole 2 × 2 km. It is for looking only: routes, energy and the walk-back ring never read the picture. In the other views, the layer's colour is laid over the picture's light and dark, so ridges still show through. Ground outside the walk-back ring is dimmed.

### Detail near you (flag `detail`, on in the demo)

Around what you look at and around the astronaut (within about 330 m), the app swaps in **1 m terrain** (USGS MSL Gale merged HiRISE DEM) with the **25 cm HiRISE image** on it, in 256 m tiles: at most 9 at once on a large screen, 4 on a phone. Everywhere else stays at 8 m. The route line follows the 1 m surface where it is loaded. HiRISE resolves features of about 3–4 m and up; rocks under about 1 m are not in this data. Like the picture, the detail is for looking only: routes and energy still use the 8 m grid and the walk-scale crossings.

### True scale (ticket F5)

Heights are drawn 1:1, with no exaggeration: the slice really climbs about 526 m. The astronaut is 1.8 m tall, the helicopter has a 1.2 m rotor (Ingenuity's) and flies 10 m up, and the habitat is about 9 m across with a 2 m hatch. Because real-size things vanish from far away, each also has a small round icon that keeps its size on screen. The scale bar (bottom left) is computed from the camera distance, and the arrow points north. The three are NASA models from NASA 3D Resources: the Z-2 planetary suit, Ingenuity (NASA/JPL-Caltech) and the Habitat Demonstration Unit, scaled to these sizes (`app/src/models/README.md`). Three helicopters park beside the habitat, as in NASA's SkyFall concept; one flies at a time. Take-off and landing (over the first and last 20 m of a flight) and the camera easing in to 14 m are drawn only: the scan itself always assumes 10 m.

### What has been explored (the discover look, ticket A3)

Ground nobody has checked up close is drawn **muted**: the same HiRISE picture, mostly grey and a little darker. It turns to full colour where a helicopter has flown (a 15 m swath), within 60 m of the habitat, and within 24 m of where the astronaut has walked. A bright ring on the ground marks the helicopter's scan as it passes. The flight is simulated; the terrain and the picture it "reveals" are the real NASA data, standing in for the helicopter's own sharper images.

### Vesta Vision v0 (ticket A4)

The **View** button switches between Map, Follow (camera 14 m behind the astronaut) and Eye level (1.7 m, drag to look around). The Vision views hide the panels: there is no HUD. A dusty haze fades distant ground. Up close the ground looks soft, because HiRISE resolves features of about 3 m and up.

**Loading and opening.** The whole-slice picture is one image (`overview.jpg`, 2048 px, 1 m per pixel, stitched from the same HiRISE tiles and hosted beside them); if it is missing the app stitches the 64 tiles itself. The page opens about 2.4 km above the middle of the slice, holds for 1.2 s, then eases down to the habitat over 4 s. Any tap, scroll or key skips it; it is off when the device asks for reduced motion.

## 13b. The guided mission (Vesta Scout) and the helicopter battery

Vesta Scout runs in four stages (`app/src/flow/`, plan in `docs/UX-PLAN.md` §0): **Choose stops** on the 2D orbit map (it starts empty; at least 3), **How the route is found** (five steps the user moves through), **Scout** behind the helicopter, **Choose the walk**. The crew is inside the habitat, so only the flight and the walk preview show the 3D scene. The map screen with every layer is Vesta Vision (`/scout/?vision`).

- **Route priority.** *Easiest* is the planner's least-energy route. *Shortest* keeps the same stops in the same order and joins them by least distance; its energy is then measured with the same walking model. While the scout flies it re-plans by least energy, whichever was chosen.
- **The straight line** (stage 2, step 1): straight segments base → stops → base in the planned order; the metres of it on cells steeper than `max_slope_deg` (20°) are counted and drawn red.
- **Detections** (stage 3): newly seen rock cells are grouped into one find until 40 m of flight pass without any; a find's area is cells × 64 m². "On the route" means one of its cells is on the route as planned at that moment. Ground scanned = newly seen cells × 64 m².
- **Model lines** (`app/src/flow/models.js`): the rock-chance model (AUC 0.73 on a development check, not calibrated), the reviewed rock detections (23 of 25 proposals confirmed, no hit rate claimed), and the ground classifier (93% on 159 held-out Curiosity patches, 48% on 197 Perseverance patches), each copied from its export.
- **Unseen ground** (stage 2): the length of the route whose cells no helicopter has looked at, summed step by step.
- **Hidden-rock estimate** (stage 2): the belief map of §12, shown relative to its highest value near the route. Experimental, not calibrated.
- **Helicopter battery** (stage 3, `app/src/flow/heli-energy.js`), an **estimate**: Ingenuity's flight power, about 350 W (JPL Ingenuity landing press kit), and its battery, 38.8 Wh when new at 0 °C (NASA/JPL battery slide deck, six Sony VTC4 cells), on SkyFall's flight profile of 1 km in 2.5 minutes (`docs/OPERATIONS.md`).

```
flight seconds = metres / (1000 m / 150 s)
energy used    = 350 W x flight seconds          (14.6 Wh for 1 km)
battery left   = 1 - energy used / 38.8 Wh       (about 62% after 1 km)
```

  38.8 Wh is the whole battery, not the usable part (NASA gives no usable share), so the percentage is optimistic. Each flight starts full: three helicopters, one flight each.
- **The scan on screen is simulated**: found rocks come from the hidden-rock layer (`rocks_fine`), not from a live classifier.

## 14. What is real and what is simulated

- **Real:** terrain, slope and images (NASA MRO HiRISE via USGS), the Curiosity stops and their photos, the walking-energy formula, all the route and safety maths.
- **Estimates, marked:** ground type on Gale (from image brightness and roughness until the classifier lands), rock layer on Gale (until shadow-based rock detection lands), the energy budget size, and the walking-energy factors above.
- **Simulated:** the helicopter flights, the astronaut (a phone stands in for the suit display), the photo at a stop (Curiosity's photo stands in for the astronaut's).
