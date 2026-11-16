# Sunday Plan: the science half (2026-11-15)

**Page with every source link: https://claude.ai/artifact/1jFq6jHfVcZE16zQcsnJHj** (needs a sign-in; this file holds the same plan for agents that cannot open it).

We built the safe half of the mission: can the crew get there and back? We did not build the science half: where should they go, and what do they learn there? This plan adds it before submission.

## Clock (CST)

| When | What |
|---|---|
| 10:00–12:15 | Build: issues #166–#171, Nicolas and Jules |
| 12:15–12:45 | Stop. Release `dev` → `main`, check the live link |
| by 1:00 PM | Submit |
| 1:30 PM | Hard close |

- Global judges read only the project page; local judges try the demo link and see the pitch. The page and deck are refreshed together at 12:15 (#172).
- Every new feature starts behind a flag that is off. Bare `/scout/` must work after every merge.
- At 12:15, what is not merged and checked ships off and becomes one "next" sentence in the pitch.

## The gap, against the challenge page

| The page asks | Today | Status |
|---|---|---|
| Start by "identifying some scientific goals for your mission" | No goal in the product; the five stops are Curiosity's, fixed in `targets.json` | Missing |
| A place where the feature is abundant | Our slice is on the boxwork | Done |
| "at least three kinds of data" (it lists eight) | All eight are in `world.json` `data_types`. `chem_points.json` (421), `neutron_points.json` (323) and `weather.json` (412 sols) are never read by `app/src` | Partly |
| Astronaut safety, space weather | Return budget and ring work; radiation is one RAD mean × sky view; no dose for the walk | Partly |
| Suits and carried equipment | 60 kg load in the energy model | Done |
| A route "avoiding significant obstacles" | Three flights, re-plan after each | Done |
| "rovers or other robotic systems to help transport the crew and their tools" | Helicopter only | Missing |
| Imagery so the astronaut "knows what to expect" | Stop photos; Vesta Vision | Done |

The page never mentions helicopters. Tie the scout to its wording about robots that help the crew, and to the science it finds.

## What the scout and ML really do (from the code)

- **No sensor is simulated.** A flight uncovers `rocks_fine.u8` in a 30 m strip and switches those cells to `cost_to_go_scouted` (`app/src/scout.js`, `main.js` `reveal`). The 10 m height only places the 3D model.
- **Rocks:** a rule on the 1 m terrain (`data/pipeline/make_gale.py`) plus 23 human-accepted ROSCO detections. Not a model we trained.
- **ML:** one trained model, `terrain_cls.onnx` v2 (AI4Mars Curiosity and Perseverance ground photos, grey input): 91.8% / 94.0% on 159 / 302 Curiosity patches, 73.1% on 219 fresh Perseverance patches (v1: 93.1% on 159 Curiosity, 48.2% on 197 Perseverance; 41.1% on the fresh set). Off in the demo; it changes nothing on the map. `buddy_policy` is a placeholder. The belief model (0.729, development check) is off.
- **No check exists for science targets**, because the app never chooses any.
- **Not from our site:** the classifier's photos (all of Curiosity's path), Perseverance and Ingenuity sets (Jezero), an earlier rock patch about 5 km north.

## What "not from our site" means

Our map is one 2 × 2 km box. Some of our evidence was made somewhere else, so it cannot prove anything about that box:

- **The ground-photo classifier** learned from photos taken along Curiosity's whole route, not in our box. Its 92–94% means "it names ground types in Curiosity photos", not "it is right about our map".
- **The Perseverance and Ingenuity pictures** are from Jezero, another crater about 3,700 km away (our arithmetic from the two sites' coordinates). v1's 48% there showed the classifier did not carry over to a new place; v2 trains on some Perseverance photos and scores 73% on fresh ones, which says nothing about Gale or a helicopter.
- **An early rock check** used an image patch about 5 km north of our box. Those rocks are not in our map. The 23 reviewed rocks now in the map are inside it.

**Effect on us:** nothing breaks in the demo, because none of these drive the route. It only limits what we may say: never quote them as proof about our site.

## The design: coarse to fine, for science too

Aim (pick a goal) → Find (orbit, 2D: score the ridge-and-hollow pattern) → Check (helicopter, 3D) → **Visit (the crew measures what cannot be measured from the air)** → Keep (walk log into the map).

### The scout's payload is NASA SkyFall's (corrected 10:20)

NASA has published what a small Mars helicopter will carry ([SkyFall Mission Information Package, Sept 2026](https://science.nasa.gov/wp-content/uploads/2026/09/skyfall-mission-information-package-final.pdf), section IV). We adopt it instead of inventing a payload. Three identical helicopters; 1–2 km per flight sol (about 2.5 min), then a sol to recharge and downlink 100–400 Mbit to an orbiter; launch Nov–Dec 2028, arrival about Sept 2030.

| Instrument | Data kind | NASA's words |
|---|---|---|
| Two 13 MP colour cameras | optical, topographic | "cm-scale orthophotos and digital elevation maps" |
| Two near-infrared cameras | spectral | "some information on mineralogy or chemistry" (bands to be decided) |
| Ground-penetrating radar | geophysical | "approximately 3–5 m of subsurface penetration" |
| Air temperature sensors; wind from flight data | atmospheric | wind "to within ~5 m/s" |
| Dosimeter | radiation | "a three-dimensional map of incident radiation" |
| Two navigation cameras | hazards | textured ground "indicative of rocks" |

- **Six of the eight data kinds fly.** Not on a helicopter: contact chemistry and ground thermal imaging. So the crew's job at the stop is chemistry, close-ups and samples.
- **No bigger helicopter is needed.** If we wanted a heavier instrument, the reference is JPL's Mars Chopper concept: up to 5 kg of science, about 20 times Ingenuity's mass. We found no published cost for SkyFall or Chopper; Ingenuity was about $85 million.
- **The team's comparison PDF (Ingenuity vs SkyFall) agrees with NASA's document** on three helicopters, 1–2 km, 2.5 min and the two-sol rhythm. Its 2.7 kg mass and 1.4 m rotor come from a presentation we have not opened: keep them out of the pitch until someone does. Its point about range is right and applies to us: a 1 km flight that must come back reaches under 500 m. Our simulation does not model the return; SkyFall lands at the far end.
- **This replaces the earlier table** that said weather and radiation cannot fly, and the "six helicopters" figure (a 2025 AeroVironment concept; NASA's 2026 plan is three).

### How the pieces fit, and what each can get wrong

| Piece | Kind | Feeds | Known limit |
|---|---|---|---|
| Walking energy (Pandolf) | formula | every cost below | the 0.68 Mars gravity factor and suit effort are estimates; at +30% cost the plan still keeps 446.5 kJ spare |
| Way home (`cost_to_go`) | shortest-path search, done ahead | the ring, the buzz | only as good as the hazard layer |
| Stop order (Held-Karp) | exact search | the route | exact up to 12 stops |
| Hazards | terrain rule + 23 reviewed rocks | walls after a flight | positive rocks only; not complete; rocks under about 1 m are invisible from orbit |
| Flight choice | rule: next unseen stretch | which strip is revealed | value-of-information version failed its test and stays off |
| Boxwork finder | rule on ridge/hollow shares | candidate sites (S5) | 0.851 on 90 rover cells; untested away from the rover's path |
| Rock-chance model | logistic regression, off | nothing yet | 0.729 on a development check, not independent |
| Ground-photo classifier | trained model, off | nothing yet | v2: 91.8% / 94.0% Curiosity, 73.1% fresh Perseverance |

No probability shown in the app is calibrated. Say "score", not "chance".

## The work: issues (two people, no one waits)

Nicolas edits `stage-plan.js`, `stage-debrief.js` and new files in `app/src/flow/`. Jules edits `stage-scout.js`, `data/pipeline/`, `ml/`. Nobody edits `main.js`. The one shared input, `stop_science.json`, is already merged.

| Issue | What | Owner | Order |
|---|---|---|---|
| [#166](https://github.com/nicolasrufino/nasaspaceapps/issues/166) S1 | Start from a science goal (stage 1) | Nicolas | 1st, short |
| [#167](https://github.com/nicolasrufino/nasaspaceapps/issues/167) S2 | At the stop: measure, compare, decide | Nicolas | 2nd, the main piece |
| [#168](https://github.com/nicolasrufino/nasaspaceapps/issues/168) S3 | Science log and what one stay can do | Nicolas | 3rd, after S2 step 1 |
| [#169](https://github.com/nicolasrufino/nasaspaceapps/issues/169) S4 | The scout carries SkyFall's payload; what each flight recorded | Jules | 1st |
| [#170](https://github.com/nicolasrufino/nasaspaceapps/issues/170) S5 | Find boxwork from orbit: `candidates.json` and its check | Jules | 2nd |
| [#171](https://github.com/nicolasrufino/nasaspaceapps/issues/171) S6 | Science-yield numbers; fix neutron positions (200 m off) | Jules | 3rd |
| [#172](https://github.com/nicolasrufino/nasaspaceapps/issues/172) S7 | Pitch and project page refresh | both | 12:15 |

### The Visit step (S2), in one view

At each stop the walk pauses. The stop has 30 minutes (2.5 h of stop time ÷ 5 stops; a planning assumption).

| Task | Who | Min | Shows |
|---|---|---|---|
| Look around | crew | 3 | rover photo; ridge or hollow |
| Close-up of the feature | crew | 4 | which check of the goal it serves |
| Read the rock's chemistry | crew, contact instrument | 8 | Curiosity's real ChemCam reading at that spot |
| Water in the ground | rover, neutron detector | 5 | Curiosity's DAN reading for that sol |
| Weather and radiation | suit, automatic | 0 | REMS range; dose for the stop |
| Take a sample | crew | 8 | samples carried +1 |

After the ridge stop (Nevado Sajama) and the hollow stop (Valle de la Luna), a card compares the two readings (MgO 10.2 against 7.3 in our file). Readings are Curiosity's real measurements standing in for the crew's.

## First numbers (`python data/pipeline/science_probe.py` → `ml/exports/science_probe.json`)

Boxwork limits are NASA's: entered sol 4534, left about sol 4845.

| Check | Result | Reading |
|---|---|---|
| Our ChemCam/APXS points against the published trend (boxwork: more Si, less Mg and S) | SiO₂ 43.6 vs 41.8; MgO 8.1 vs 10.9; SO₃ 10.7 vs 14.1; Al₂O₃ 8.3 vs 8.5 | 3 of 4 match; aluminium does not show the published rise |
| Percentile of Curiosity's stops on the ridge-and-hollow score | Overlook 86, Valle de la Luna 83, Nevado Sajama 76, Ridge top 70, Altadena 0 | Fair. Altadena is at the edge of the unit |
| Score inside against outside the boxwork along the rover's path | **0.851** (67 vs 23 cells) | Good on this small test. **Corrected:** the first run gave 0.589 because it took positions from `neutron_points.json`, which is about 200 m off (#171) |

**Rule:** a number comes from a script in the repo and the file it writes, or from a page someone opened today with the link beside it. Search-result-only numbers stay out.

## Mission numbers for the pitch

| Claim | Number | Source |
|---|---|---|
| One walk takes a scouting sol and a walk sol | 2 sols | `docs/OPERATIONS.md` |
| First crewed stay | 30 sols | [National Academies 2025](https://www.nationalacademies.org/news/search-for-life-should-be-top-science-priority-for-first-human-landing-on-mars-says-new-report), [NASA](https://ntrs.nasa.gov/citations/20220001816) |
| Scouted walks in that stay | at most 15, so at most 75 stops | our arithmetic (#171 writes it to a file) |
| Flights per walk | 3 flights, 2.22 km | `ml/exports/pitch_metrics.json`; Ingenuity: 72 flights, 17.0 km ([NASA](https://science.nasa.gov/mission/mars-2020-perseverance/ingenuity-mars-helicopter/)) |
| Curiosity between our first and last stop | 154 sols (4564 to 4718) | `targets.json`; the rover drilled for weeks at each stop, so say it fairly |
| Helicopter against rover programme | about $85 M vs $2.53 B | [JPL](https://www.jpl.nasa.gov/news/press_kits/ingenuity/landing/quick_facts/), [Planetary Society](https://www.planetary.org/space-policy/cost-of-msl-curiosity) |
| NASA software already picks targets | 93% vs 24% blind | [JPL AEGIS](https://superintelligence.jpl.nasa.gov/public/projects/aegis) |
| Radiation at Gale | 0.67 mSv/day | [SwRI](https://www.swri.org/newsroom/press-releases/swri-scientists-publish-first-radiation-measurements-the-surface-of-mars) |

- We give no dollar saving: we found no NASA price for an hour outside on Mars.
- "Sustainable" means repeatable: the same two-sol loop at the next site, and each walk log improves the map.
- **Fix:** docs and the home page say a message takes "4 to 22 minutes"; the NASA page says "between 3 and 22 minutes" ([NASA](https://science.nasa.gov/blog/speaking-percys-language-how-to-talk-so-perseverance-will-listen/)).

## Key sources (all opened 2026-11-15; full list on the page)

- Challenge: https://www.spaceappschallenge.org/2026/challenges/interplanetary-survival-guide-martian-map/
- Boxwork: [JPL Jun 2025](https://www.jpl.nasa.gov/news/nasas-curiosity-mars-rover-starts-unpacking-boxwork-formations/), [NASA Feb 2026](https://www.nasa.gov/missions/mars-science-laboratory/curiosity-rover/nasas-curiosity-rover-sees-martian-spiderwebs-up-close/), [GSA 2025 abstract](https://gsameetings.secure-platform.com/connects25/solicitations/103002/sessiongallery/schedule/items/95386/application/10634), [leaving the boxwork](https://science.nasa.gov/blog/curiosity-blog-sols-4845-4851-bye-bye-boxwork-bye-bye/)
- Orbit limits: [MRO instruments](https://science.nasa.gov/mission/mars-reconnaissance-orbiter/science-instruments/), [Fraeman 2020](https://pmc.ncbi.nlm.nih.gov/articles/PMC7818385), [Hood 2022](https://sfsholes.github.io/papers/Hood2022_MBARS.pdf)
- Helicopters: [Ingenuity](https://science.nasa.gov/mission/mars-2020-perseverance/ingenuity-mars-helicopter/), [flight 12](https://science.nasa.gov/blog/better-by-the-dozen-ingenuity-takes-on-flight-12/), [SkyFall](https://www.avinc.com/resources/press-releases/view/av-reveals-skyfall-future-concept-next-gen-mars-helicopters-for-exploration-and-human-landing-preparation), [Mars Chopper](https://www.jpl.nasa.gov/images/pia26375-nasas-mars-chopper-concept-rendering/), [Mars Science Helicopter](https://www.jpl.nasa.gov/images/pia25661-model-of-proposed-mars-science-helicopter/), [Dragonfly](https://science.nasa.gov/mission/dragonfly/spacecraft-and-instruments/)
- Instruments: [Perseverance](https://science.nasa.gov/mission/mars-2020-perseverance/science-instruments/), [Curiosity](https://science.nasa.gov/mission/msl-curiosity/science-instruments/)
- AI on Mars: [AEGIS](https://superintelligence.jpl.nasa.gov/public/projects/aegis), [PIXL](https://www.jpl.nasa.gov/news/heres-how-ai-is-changing-nasas-mars-rover-science/), [AI-planned drive](https://www.jpl.nasa.gov/news/nasas-perseverance-rover-completes-first-ai-planned-drive-on-mars/), [AI4Mars](https://ntrs.nasa.gov/citations/20220008371)
- Humans and robots: [Moon to Mars Objectives](https://www.nasa.gov/wp-content/uploads/2022/09/m2m-objectives-exec-summary.pdf), [Moon rovers](https://www.nasa.gov/missions/moon-base/nasa-provides-progress-update-on-moon-base-rovers/), [Artemis EVA](https://www.nasa.gov/wp-content/uploads/2020/01/topic_1-_eva_lunar_surface_concept_of_operations.pdf)

**Do not use yet (search results only):** $130,000 per Space Station crew-hour; Mars Sample Return at $8–11 billion; Ingenuity's 13 MP camera; Tianwen-3 helicopter; any ML map of boxwork or CRISM minerals; a reviewed paper on the 2025 boxwork results.
