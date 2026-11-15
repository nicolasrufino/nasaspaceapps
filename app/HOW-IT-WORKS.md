# How Martian Map works

Plain-language notes on every rule and formula the app uses, for the project page and the pitch. Every number here comes from the code in this repo (`app/src/`, `data/pipeline/make_world.py`) or from a test or run on our worlds. **Estimates are marked as estimates.** Update this file whenever a rule changes.

The map is a grid. The real Gale slice is 256 × 256 squares ("cells") of 8 m each, so 2 × 2 km of lower Mount Sharp. Each cell knows its height, slope and ground type from NASA data (HiRISE stereo terrain, HiRISE colour images; see `world.json` `sources`).

---

## 1. How much energy a step costs

**Rule:** walking energy uses the **Pandolf equation** (Pandolf et al., 1977), a US Army formula for walking with a load, scaled to Mars gravity.

```
watts = 1.5·W + 2·(W + L)·(L / W)² + η·(W + L)·(1.5·V² + 0.35·V·G)
watts on Mars = watts × (3.71 / 9.81)
joules for a step = watts on Mars × distance / V
```

| Symbol | Meaning | Value now |
|---|---|---|
| W | body mass | 75 kg |
| L | load carried | 60 kg (suit and kit) |
| V | walking speed | 1.0 m/s |
| G | uphill grade, in % (downhill counts as flat) | from the height of the two cells |
| η | terrain factor: how hard the ground is to walk on | bedrock 1.0, soil 1.1, unknown 1.2, big rock 1.5, sand 2.1 |

**What it means, per metre walked on Mars (from the code):**

| Ground | Energy per metre |
|---|---|
| Flat bedrock | 184 J |
| Flat soil | 192 J |
| Flat big-rock ground | 223 J |
| Flat sand | 269 J |
| Bedrock, 10% uphill | 363 J |
| Flat bedrock **on Earth**, for comparison | 488 J |

In our formula sand costs about 1.5× bedrock, a 10% climb about 2×, and Mars gravity cuts the cost to about 38% of Earth's. The first and last of these are too optimistic; see below.

**Where these numbers are known to be too low (research, see `docs/SCOUTING.md` §2):**
- **Sand:** people measured on sand use **2.1 to 2.7 times** the energy of hard ground ([Lejeune et al. 1998](https://pubmed.ncbi.nlm.nih.gov/9622579/)). Our formula gives only 1.46×, because η = 2.1 multiplies only part of the equation.
- **Gravity:** we scale energy by 0.38 (straight in proportion to gravity). A 2018 study in simulated 0.38 g measured walking oxygen use at about **68%** of Earth's, so our walking energy may be **about 1.8× too low**. Suits add more ([NASA TP-2009-214796](https://www.lpi.usra.edu/lunar/artemis/NorcrossEtAl_NASA-TP-2009-214796_EVA%20Walkback%20Test.pdf)).
- **Our assumption:** matching Mars ground types to the Earth terrains the factors were measured on (bedrock = blacktop, soil = dirt road, big rock = heavy brush). The factors themselves (1.0, 1.1, 1.2, 1.5) are measured (Soule & Goldman 1972).

A fix for the pipeline and the app together is proposed in `docs/SCOUTING.md` §6. Downhill gets no discount or penalty, and speed is fixed. Planned upgrade: a hypogravity model that adds the Santee downhill term to Pandolf ([2025 paper](https://www.researchgate.net/publication/394929719_A_Novel_Metabolic_Model_for_Ambulation_in_Hypogravity_and_Applications_to_Planetary_Extravehicular_Activity)).

Code: `stepCostIdx` in `app/src/walk.js`, `pandolf_watts` in `data/pipeline/make_world.py`. A test checks the app and the pipeline agree to within 0.1%.

## 2. Walls: where you can't walk

- **Slope over 25°** (`max_slope_deg`): a suited astronaut can't climb it, so the cell is a wall.
- **Rocks the helicopter has seen** (`rocks_fine`): walls once known. Before scouting nobody knows they are there, which is the point of the scout.

## 3. The way home from everywhere (cost to go)

For every cell, the pipeline works out **the least energy needed to walk from that cell back to base**, following the cheapest path (Dijkstra's shortest-path algorithm on the grid, with the step cost above). This map is `cost_to_go`. The phone never searches for a path during the walk; it only looks this number up.

## 4. Energy budget, reserve and oxygen

- **Budget:** 600 kJ for a walk on the Gale world (`energy_budget_j`, a knob sized so the five-stop Curiosity tour uses about 80% of the usable energy).
- **Reserve:** 20% of the budget is never planned for (`reserve_fraction`). It stands for NASA's rule of keeping a 1-hour emergency return, plus about 30 minutes for dust removal and getting back inside. Usable energy = 600 × 0.8 = **480 kJ**.
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

**Result on Gale (from the code):** all 5 Curiosity stops in one walk, **330 kJ, about 21 minutes of walking**; the pipeline's own route is 332 kJ. Planning takes about 0.1 s.

**Not yet in the plan:** fastest or safest route options, daylight and temperature, radiation dose (issue #78); shaping the route by hand (#79); time spent at each stop.

Code: `app/src/plan.js`.

## 7. The helicopter scout

Orbit images can't see rocks smaller than about a metre. A small helicopter (Ingenuity-class, like NASA JPL's on Mars) flies first. **The flight is simulated; the data it reveals is the world's own rock layer.**

- **Flight limit:** at most **700 m per flight** (about Ingenuity's longest flight, about 3 minutes).
- **What it sees:** everything within **15 m** of its path, a 30 m wide strip (`SWATH_M`, a knob to tune with a real camera footprint).
- **Order of flights before a walk:** first along the **planned route**, then the team's extra flights (`scout_plan.json`): **anomalies** (places where the data disagrees), then the **least certain** areas.
- **What changes when it lands:** rocks it saw become walls, the way home switches to the scouted version for every cell it saw, and the route re-plans. The old route stays on screen as red dashes.

**Result on Gale (from the code):** 7 flights, 85 rock cells found; the planned route crossed 12 of them; the new route avoids them for 330 → 334 kJ.

## 8. The "best areas" map

A score from 0 (don't go) to 1 (go) for every cell, from what is known right now:

```
score = 0                    if slope > 25°, or a rock was seen there,
                             or the round trip doesn't fit the usable energy
score = (1 − round trip ÷ usable energy) × (1 if scouted, ½ if not) × science weight
round trip = energy from base to the cell + cost to go back
science weight = 0.4 + 0.2 × science value (0–3), when the world has a science layer; otherwise 1
```

Brighter green = more energy to spare after going there and back. The map brightens as helicopters scout, because scouted ground is trusted twice as much.

## 9. "Why this route" (the explanation panel)

The panel decides nothing; it measures the route the planner chose and the ones it beat (flag `why_route`).

- **Each stretch** (base → stop → … → base): distance, energy (the Pandolf cost of every step), walking time, steepest slope and share of sand.
- **Steepest ground** on the whole route, against the 25° limit.
- **Tightest moment:** the least energy to spare at any point, after the cost of getting home and the reserve: `energy left − reserve − cost to go`.
- **The rejected alternative:** the **shortest-distance** route through the same stops in the same order (what a person would draw), drawn as grey dashes. The panel says what it would cost and why: more sand, more climbing, steeper ground.
- **After a scout:** how many rock cells the old route crossed and what avoiding them costs.

**Result on Gale (from the code):**
- Our route: 1,239 m, 330 kJ, 21 min, 10% sand, 43 m of climbing, steepest 17°.
- The shortest route through the same stops: about 24 m shorter but **412 kJ, 25% more energy**, because 41% of it is sand and it climbs 52 m.
- Tightest moment: 150 kJ to spare on the last stretch home.
- After the helicopter: the old route crossed 12 rock cells; avoiding them costs 4 kJ.

Code: `app/src/why.js`.

## 10. What is real and what is simulated

- **Real:** terrain, slope and images (NASA MRO HiRISE via USGS), the Curiosity stops and their photos, the walking-energy formula, all the route and safety maths.
- **Estimates, marked:** ground type on Gale (from image brightness and roughness until the classifier lands), rock layer on Gale (until shadow-based rock detection lands), the energy budget size, and the walking-energy factors above.
- **Simulated:** the helicopter flights, the astronaut (a phone stands in for the suit display).
