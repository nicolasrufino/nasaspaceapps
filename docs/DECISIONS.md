# Decisions

One place for what the team decided, why, and what is still open. **Add a line here in the same PR as any decision.** Newest first inside each section. Who: Nicolas (P2), Jules (P1), Galsan (P3), Luca (P4 / Person X).

## Decided

| Date | Decision | Why | Who | Where it lives |
|---|---|---|---|---|
| 2026-11-15 | **The Mission VESTA page is the home page; the map app moved to `/scout/`** (nasa.nicolasrufino.com/scout/). Old `/?world=…` and `/?flags=…` links forward there; `/mission-vesta/` redirects home | The custom domain should open on the design; the app is Vesta Scout | Nicolas | `app/index.html`, `app/scout/index.html` |
| 2026-11-15 | **Two products on the site: Vesta Scout = the map app we are building now; Vesta Vision = later**, a Google Earth for Mars built from orbit data plus what scouts and models learn | Scout simulates the discovery; Vision needs the trained models first. Scout UI redesign is planned for later | Nicolas | `app/mission-vesta/` |
| 2026-11-15 | **Mission VESTA site title font is Michroma** (tagline and product names stay Rethink Sans) | Picked from five previewed fonts; wide and technical, closest to NASA lettering | Nicolas | `app/mission-vesta/` |
| 2026-11-15 | **PR #94 approved by P2** (routes on crossings, gravity factor 0.68, sand 2.4×). Merge after Jules's R3 re-export, with the 20° rebuild in the same PR | Measured values; the old model under-counted energy by about 1.8× and let routes cross ledges. Tested on the branch: 31 app tests, build, Gale in the browser with no console errors | Nicolas | PR #94 review; `docs/DECISION-BRIEFS.md` §1 |
| 2026-11-15 | **Energy budget from a real suit figure** (1,200 BTU/h, 8 h suit, 1.5 h reserve; ICES-2026-127), not sized to fit the tour | Sizing the budget to the tour was circular and hid that the walk got harder | Nicolas | PR #94; brief §2 |
| 2026-11-15 | **Scouting mode first: reach the targets** (the specific stops chosen for this walk); network mode later | It is the demo, the building block of network mode, and measurable against "knowing everything" | Nicolas | Brief §3 |
| 2026-11-15 | **"Blocked" follows NASA's suit data:** a rock taller than 0.3 m is an obstacle (smallest crew member's step, ICES-2025-294); a cell is blocked when obstacles leave gaps under 1.0 m (the hatch width NASA sizes for the largest crew member); otherwise rocks only add walking cost | Uses NASA's measured suit limits, the same 0.3 m Luca uses for ledges | Nicolas | Brief §5 |
| 2026-11-14 | **Walking slope limit is 20°**, not 25° | Artemis xEVA suit specification (flagged by Luca in PR #94). On Gale: walls go from 15.5% to 24.2% of cells, cells reachable from base from 82.2% to 69.6%; the five-stop Curiosity tour is unchanged (334.7 kJ) because it already avoids steep ground (`app/scripts/slope-check.json`) | Nicolas, Luca | `max_slope_deg` in `world.json`. **Not applied yet:** world files must be rebuilt (pipeline, Luca/Galsan); the app follows the knob without a code change |
| 2026-11-14 | **The visualizer is a guided tour** (11 steps, Next / Play), with free play folded underneath | The free-play version was hard to follow | Nicolas | [Scouting explainer](https://claude.ai/artifact/8FDY6zGHXoewAtzxYBCJKG); source `docs/scouting/explainer.html` |
| 2026-11-14 | **Helicopters are based on SkyFall plus newer concepts**, recharged at the habitat | SkyFall (JPL, 3 helicopters, 2028) proves scouting is planned but publishes no range or recharge; Mars Science Helicopter, Ingenuity and Dragonfly fill the gaps. Habitat recharge is **our assumption**, said as such | Nicolas | `docs/SCOUT-ALGORITHM.md` §7 |
| 2026-11-14 | **No "two months to recharge" rule, no Ingenuity flight cadence** | "Two months" was rover driving time one flight saved, not a recharge time; one flight per 13.6 sols was a technology demonstrator's pace | Nicolas | `docs/SCOUT-ALGORITHM.md` §7, `docs/SCOUTING.md` |
| 2026-11-14 | **Unpublished helicopter numbers are knobs, labelled estimates**: 700 m per flight (Ingenuity's flown limit), flights per helicopter per sol | No invented numbers (AGENTS.md rule 5) | Nicolas | `docs/SCOUT-ALGORITHM.md` §7 |
| 2026-11-14 | **Sensing = predict, then confirm.** Predict each cell's chance of being blocked from orbit (the belief map); the helicopter confirms; every confirmed cell becomes a training label | The textbook problem gives blocking chances; on Mars we must predict them. The simulator shows the planner losing to plain route scouting without a prediction | Nicolas | `docs/SCOUT-ALGORITHM.md` §2A |
| 2026-11-14 | **Never train on the old `rocks_fine` rule layer** | It is computed from orbit data (circular), and Jules's 22 reviewed rocks sit on steep ground where the rule says gentle (rule model AUC 0.52 on them) | Nicolas | `docs/SCOUT-ALGORITHM.md` §2A, `app/scripts/sensing-check.json` |
| 2026-11-14 | **Moon data only for pre-training the rock part**, always tested on Mars | The Moon has no sand or dust, and its mapped boulders are 4.5 m and up | Nicolas | `docs/SCOUT-ALGORITHM.md` §2A |
| 2026-11-14 | **The algorithm decides; machine learning improves the belief map.** A learned scouting policy only later, and only if it beats the planner on the benchmark and stays explainable | Safety decisions must be explainable in numbers | Nicolas | `docs/SCOUT-ALGORITHM.md` §4 |
| 2026-11-14 | **Scouting algorithm: Canadian Traveller Problem with remote sensing, solved by value of information** (sampled worlds), K candidate routes, a stop rule, re-plan after each flight | Best route per flight spent, not the best route possible; Folsom et al. found scouting only the planned path helps little | Nicolas | `docs/SCOUT-ALGORITHM.md` |
| 2026-11-14 | **Scouting flow restructured:** points of interest on the 2D orbit map; the 3D map fills in as flown; flight order in daylight with sun and shadows; candidate corridors, not straight lines; several walking paths | The whole-area survey is not realistic | Nicolas | `docs/SCOUTING.md` |
| 2026-11-14 | **Whole-area helicopter survey removed** | Not feasible with real flight limits | Nicolas | PR #84 |
| 2026-11-14 | **"Drone" is called "helicopter"** everywhere | Matches NASA's Ingenuity and SkyFall | Nicolas | All docs and the app |
| 2026-11-14 | **Every value is research-backed or marked as an estimate**; walking energy is too low today (gravity, sand) and the docs say so | Guessed numbers (sand 1.5×) were wrong | Nicolas | `app/HOW-IT-WORKS.md`, `docs/SCOUTING.md` §2 |
| 2026-11-14 | **Every formula gets a plain-language note** in `app/HOW-IT-WORKS.md` | It feeds the project page | Nicolas | `app/HOW-IT-WORKS.md` |
| 2026-11-14 | **Phone testing at the end** of the build | Desktop browser tests are enough to merge for now | Nicolas | AGENTS.md rule 13 |
| 2026-11-14 | **Test, then merge as you go** into `dev`; `main` only by release PR | Ship faster | Nicolas, Luca | AGENTS.md rules 13–14 |

## Open: still to decide

Recommendations with evidence and the holes checked: `docs/DECISION-BRIEFS.md` (brief number in brackets).

| Question | Options | Needs | Blocks |
|---|---|---|---|
| **Rebuild world files at 20°** [1] | With #94 (one R3 re-export, recommended) or as its own PR | Luca or Galsan; Jules's R3 hashes change too | The 20° decision taking effect |
| **How high the helicopter flies** [4] | Low (about 2–4 m, matches the rover images the model learns from; dusty) / about 10 m (safe; needs the model adapted to the air view). Deciding test: run the rover-trained model on labelled Ingenuity images | Nicolas | Helicopter-view model, flight planner |
| **Labels for sensing** | Start with the reviewed ROSCO rocks / also project Curiosity's labelled images onto Gale cells | Jules, Nicolas | Belief-map training |
| **Stop rule: when to stop flying** [6] | Keep flying while a flight could still make the walk safer, reach more science, or make it easier; stop when none would change the plan, or at the budget | Nicolas | Value-of-information planner |
| **Flight budget per campaign** [7] | A number of flights / a number of sols; flights per helicopter per sol | Team | Flight planner |
| **Walking window before sunset** [8] | How long before sunset a walk must end | Team | Sun model, plan mode |
| **Demo look** [9] | 3D view starts coarse and fills in where flown | Nicolas | Re-plan loop screen |

## Missing: not built or not available yet

- **Belief map with probabilities** (today the world has a yes/no rock mask), plus ROSCO run over the whole slice with rock sizes and "looked, found nothing" cells.
- **Ground truth at a walker's scale:** Curiosity's labelled images placed on Gale cells; labelled helicopter images (Ingenuity's colour images).
- **The scouting planner in the app:** K candidate routes, value of information, flight planner with the daylight window and no-fly cells, the re-plan loop and "why this flight". It exists only in the toy simulator so far.
- **Sun and shadow model** (Mars24 algorithm) for flight windows and walking windows.
- **Generated test worlds** where hidden rocks follow orbit features (today's synthetic rocks are random), and the **benchmark** on them and on Gale.
- **Compute time** of value of information at Gale size (256 × 256), to measure.
- **Scout plan at 20°:** `scout_plan.py` marks anomalies "near the limit"; it must use the new limit after the rebuild.
- **`app/HOW-IT-WORKS.md` formulas** for #94 once it merges.
- **Real-phone test** over HTTPS.

## How slopes enter the algorithm

- **Walking cost:** Pandolf's formula charges for going uphill (grade term), so steeper routes cost more energy. Downhill gets no discount yet.
- **Walls:** a cell steeper than `max_slope_deg` (20° once rebuilt) cannot be entered; the walk-back ring and every route respect it.
- **Hidden steepness:** 8 m cells average away short steep steps. Luca's crossings (#93) check every step between cells on the 1 m terrain (0.3 m step limit, steep runs up, down or across). #94 makes routes use them.
- **Uncertainty:** slope comes from orbit, so it is mostly known. What is uncertain is ground *near* the limit: 13.1% of Gale cells are between 15° and 20°. The belief map should treat those, and crossings close to the limit (#93's `unsure` layer), as places a flight is worth more.
- **In the toy simulator:** step cost grows with climbing and height change, and the steepest 7% of cells are walls seen from orbit.
