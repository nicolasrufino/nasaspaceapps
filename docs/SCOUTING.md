# Scouting, restructured

**Status:** direction accepted by Nicolas (P2) on 2026-11-14; not built yet. Decisions and open questions: `docs/DECISIONS.md`. It replaces the whole-area survey (too slow to be realistic: 86 sols with three helicopters on our slice) and reshapes stage 2 of `docs/PRODUCT.md`.

## 1. The goal, in one line

**Turn "places we want to reach" on a 2D orbital map into walking routes we have actually checked, using the fewest helicopter flights and daylight hours, and leave a map the next walks can reuse.**

How we will know it works (all measured in code, none claimed yet):

| Measure | What it tells us |
|---|---|
| Flights and sols used | Cost of the scouting |
| Km of walking corridor confirmed | What the scouting bought |
| Share of the walking route that is confirmed | How safe the walk is |
| Crew energy and tightest margin home | How hard the walk is |
| Corridors reused by later walks | Long-term value |

## 2. What the research says (and where our numbers were wrong)

| Topic | What we found | Source | What it means for us |
|---|---|---|---|
| Terrain factors (η) in the walking formula | Blacktop 1.0, dirt road 1.1, light brush 1.2, heavy brush 1.5 are measured | Soule & Goldman 1972, via [Pandolf equation](https://en.wikipedia.org/wiki/Pandolf_equation); [terrain factor review](https://jhp-ojs-tamucc.tdl.org/jhp/article/view/67) | Fine. **Our mapping** of Mars ground types onto these (bedrock = blacktop, soil = dirt road, big rock = heavy brush) **is our assumption** and must say so |
| Sand | Walking on sand costs **2.1 to 2.7 times** the energy of hard ground | [Lejeune et al. 1998](https://pubmed.ncbi.nlm.nih.gov/9622579/) | Our formula gives sand only **1.46×** bedrock (η = 2.1 only multiplies part of the equation). **We underestimate sand.** |
| Mars gravity | In simulated 0.38 g, walking oxygen use fell from about 1.00 to 0.68 L/min: about **68% of Earth**, not 38% | 2018 lower-body positive pressure study, 12 subjects ([PDF](https://apu.edu/files/cris_reduced_gravities.pdf)); to verify against the paper | We scale energy by 0.38. **We underestimate walking energy by about 1.8×.** |
| Suits | Suited walking costs more than unsuited at the same gravity | [NASA TP-2009-214796](https://www.lpi.usra.edu/lunar/artemis/NorcrossEtAl_NASA-TP-2009-214796_EVA%20Walkback%20Test.pdf) | Another reason our energy is too low |
| Better model | A hypogravity walking model adds the Santee downhill term to Pandolf, built for planetary EVA | [Novel metabolic model for hypogravity (2025)](https://www.researchgate.net/publication/394929719_A_Novel_Metabolic_Model_for_Ambulation_in_Hypogravity_and_Applications_to_Planetary_Extravehicular_Activity); [NASA traverse model, ICES 2025](https://ntrs.nasa.gov/api/citations/20250001829/downloads/ICES%202025%20TraverseModel.pdf?attachment=true) | The upgrade path |
| Helicopter range | Longest flight 704 m; longest 169.5 s; highest 24 m (a hover); 72 flights, about 17 km in total | [List of Ingenuity flights](https://Wikipedia.com/wiki/List_of_Ingenuity_flights); [The Register](https://www.theregister.com/2024/12/13/ingenuity_mars_helicopters_flying_days/) | 700 m per flight is right |
| How often it flew | First flight 19 Apr 2021, last 18 Jan 2024: 977 sols for 72 flights, **one flight per 13.6 sols on average** (computed from the dates) | as above | Not used: a technology demonstrator's pace. Flight cadence comes from SkyFall (below) |
| When it flies | Around **12:30 local solar time**: best battery charge and calmest winds; solar panel recharges between flights; nights reach −130 °F | [JPL first flight](https://www.jpl.nasa.gov/news/nasas-ingenuity-mars-helicopter-succeeds-in-historic-first-flight/); [ScienceDaily](https://www.sciencedaily.com/releases/2021/04/210419100103.htm) | **Flights happen in a midday window, never at night** |
| How it navigates | A downward camera tracks ground features; a laser altimeter gives height only. Flight 72 crashed when **featureless sand** gave the camera nothing to track | [Robot Report](https://www.therobotreport.com/ingenuity-helicopter-state-estimation-localization/); [The Register](https://www.theregister.com/2024/12/13/ingenuity_mars_helicopters_flying_days/) | **No-fly over smooth sand.** Low sun and deep shadow probably hurt tracking too (our assumption; no published limit found) |
| SkyFall | Three helicopters, launch 2028, mid-air deployment; 13 MP colour and near-IR cameras, ground-penetrating radar. **No range, battery, recharge or flights per sol published** | [JPL SkyFall](https://www.jpl.nasa.gov/missions/skyfall/) | **Our helicopter model.** Fleet of 3 and sensors from SkyFall; unpublished numbers are labelled knobs (`docs/SCOUT-ALGORITHM.md` §7) |
| Sun position on Mars | Standard algorithm: Allison & McEwen 2000 (used by NASA's Mars24) | [Mars24 notes](https://oregonl5.nss.org/mist/docs/Mars24J/help/notes.html); [NTRS paper](https://ntrs.nasa.gov/api/citations/20000097895/downloads/20000097895.pdf) | Sun height and direction for any hour at Gale |
| Helicopter + ground team planning | Published methods: a scout flies the uncertain parts of the follower's likely path; information-based planning | [Where to Map? (2020)](https://arxiv.org/pdf/2008.07157); [Folsom et al. 2021](https://journals.sagepub.com/doi/full/10.1177/1729881421999587); [Traversing Mars (2024)](https://arxiv.org/html/2406.05313) | Our approach (below) follows this line of work; Folsom et al. found scouting **only** the planned path gave little gain, which is why we scout **candidate corridors and their uncertain parts** |

**Does this affect exploration? Yes.** If walking really costs about 1.8× our model, today's "all five Curiosity stops in one walk" may not fit. Every energy number has to be re-run after the model is fixed, in the pipeline (`make_world.py`) and the app together.

## 3. The helicopter's technologies, and what each becomes in our code

| Technology | What it does on Mars | What it becomes in the app |
|---|---|---|
| Downward navigation camera, visual odometry | Knows its position by tracking ground texture; needs light and texture | A **flyable mask**: no-fly over smooth sand (low texture in the HiRISE image) and where the sun is too low or the ground is in shadow |
| Laser altimeter | Height above the ground | Nothing new: we already have height |
| Overlapping photos → 3D (stereo / structure from motion) | Centimetre-scale terrain where it flies | **The 3D map is built as it flies:** only scouted strips get full-detail terrain and rocks |
| Colour and near-IR cameras | Ground type, loose vs firm | Corrects the ground type (and so the walking cost) along scouted strips |
| Ground-penetrating radar (SkyFall) | What is underneath: ice, sand depth | A later layer |
| Solar panel and battery | One flight per charge, daylight only | **Flight windows** from the sun model; flights per sol as a knob |

## 4. The new flow

**Step 1. Mark the places.** The crew marks points of interest on the **2D orbital map** (science layers, Curiosity sites, or a tap). At the start the 3D view is coarse: orbit only. **Detail appears only where the helicopter has flown**, so the demo shows the map being built.

**Step 2. Guess the corridors from orbit.** For every pair of points (and base), find **several candidate walking corridors** on the orbital data, not one: the cheapest path, then the next-cheapest that doesn't reuse it (penalise cells already used and search again). Each corridor gets an **uncertainty score**: how much orbit can't tell along it (slopes near the 20° limit, possible sand, rough ground, cells nobody has seen up close).

**Step 3. Plan the flights (the first algorithm).** Choose **which corridors to fly and in what order**, so the helicopter removes the most uncertainty per flight:
- **Order of the points** (A→B→C or A→C→B…): solved exactly for a handful of points, as the walking planner already does, but with flight costs (distance, no-fly cells, low-sun hours).
- **Fly along the likely corridors, not straight lines.** A straight A→B flight only tells us about the straight line; walkers can't follow it. Flying the candidate corridors checks the ground people would actually walk.
- **Out on the best corridor, back on the second-best**, so every pair of points gets an alternative checked.
- **Limits:** at most 700 m per flight, midday window only, no-fly cells avoided. This is an **orienteering problem**: collect the most "uncertainty removed" within a flight budget.

**Step 4. Learn and re-plan.** What the helicopter sees replaces orbit data along its strip: rocks, fine slope, ground type. Each corridor becomes **confirmed** (green), **blocked** (red) or **still unknown**. The next sol's flights are planned from the new map. Stop when each pair of points has a confirmed corridor, or the flight budget runs out.

**Step 5. Plan the walk.** The walking route uses confirmed corridors (unconfirmed stretches are marked as risk) and shows **two or three alternative routes** with their energy, time and margin. The walk must **finish in daylight**, with a margin before sunset. The safety ring stays.

**Long term:** confirmed corridors stay in the site map (block D7, "the map grows"), so later walks start from them and the helicopter spends its flights on new ground.

## 5. Time and the sun

- **One clock for everything:** sol and local solar time, advancing during scouting and walking.
- **Sun position** for Gale (about 4.8° S, 137.4° E) at any hour and season: Allison & McEwen 2000.
- **Shadows:** march from each cell towards the sun over the height map; if terrain blocks it, the cell is in shadow. A 256 × 256 map is cheap to recompute per hour.
- **Helicopter:** flies only in a midday window (Ingenuity flew around 12:30 local time). No flights at night or when the sun is low (our assumption, to be marked).
- **Walk:** starts after sunrise, ends before sunset with a margin. Shadowed ground is colder (a later layer).

## 6. What changes in the app

1. **Remove the whole-area survey** (fleet sweep and table). Keep the "best areas" idea only as an input to choosing points.
2. **Energy model fix**, together with the pipeline: measured gravity factor instead of 0.38, a sand factor that matches 2.1–2.7×, a suit factor; all marked as estimates until we adopt the hypogravity model. This changes `cost_to_go` (contract §1), so it needs every owner's approval.
3. New pieces, each its own PR:
   1. Sun and clock, shadow mask, helicopter flight windows.
   2. Candidate corridors with uncertainty, from orbital data.
   3. Flight planner (order, corridors, out-and-back alternatives) and "3D built as it flies".
   4. Walking route on confirmed corridors, with alternatives and the daylight window.
   5. The comparison that proves it: corridor-guided scouting vs straight-line flights vs no scouting, in flights used and route confirmed.

## 7. Decisions needed

1. **Energy model:** adopt the measured gravity factor (about 0.68) and a sand factor of 2.1–2.7× now, in both the pipeline and the app? (Galsan or Luca for the pipeline, Nicolas for the app.)
2. **Walking window:** how long before sunset must a walk end?
3. **Demo look:** OK for the 3D view to start coarse and fill in as the helicopter flies?
4. **Flights per sol:** SkyFall publishes none, so it is a labelled knob (default 1 per helicopter per sol, 3 helicopters). Decided: no recharge rule, no Ingenuity average.
