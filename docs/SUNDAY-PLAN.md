# Sunday Plan: the science half (2026-11-15)

**Page with every source link: https://claude.ai/artifact/1jFq6jHfVcZE16zQcsnJHj** (needs a sign-in; this file holds the same plan for agents that cannot open it).

We built the safe half of the mission: can the crew get there and back? We did not build the science half: where should they go, and what do they learn there? This plan adds it before submission.

## Clock (CST)

| When | What |
|---|---|
| 10:00–12:15 | Build: three tracks plus the pitch |
| 12:15–12:45 | Stop. Release `dev` → `main`, check the live link |
| by 1:00 PM | Submit |
| 1:30 PM | Hard close |

- Global judges read only the project page. It is not written yet; the pitch person owns it first.
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
- **ML:** one trained model, `terrain_cls.onnx` (AI4Mars Curiosity ground photos): 93.1% on 159 Curiosity patches, 48.2% on 197 Perseverance patches. Off in the demo; it changes nothing on the map. `buddy_policy` is a placeholder. The belief model (0.729, development check) is off.
- **No check exists for science targets**, because the app never chooses any.
- **Not from our site:** the classifier's photos (all of Curiosity's path), Perseverance and Ingenuity sets (Jezero), an earlier rock patch about 5 km north.

## The design: coarse to fine, for science too

Aim (pick a goal) → Find (orbit, 2D: score the ridge-and-hollow pattern) → Check (helicopter, 3D: ridge height, reach, hazards) → Visit (crew and rover measure; Curiosity's numbers are the baseline) → Keep (walk log into the map).

Helicopter payload: camera, stereo pairs, laser altimeter (all flown on Ingenuity); radar is proposed (SkyFall). Spectral is proposed only. We found no helicopter thermal camera. Atmospheric, radiation and chemical instruments stay on a rover or at the habitat (3 to 6 kg each against a 2 to 5 kg helicopter payload). So a rover is needed as the tool carrier; we do not simulate it today.

## Tracks

Order of value: **B, then C, then A.** One branch, one flag, new files only where possible.

### Pitch (one person, all morning; suggested: Galsan)
1. Project page from `docs/PITCH.md` and this plan. 2. 30-second video on the live link. 3. Slides `objectives`, `data`, `loop`, `robot` for what is merged. 4. Submit by 1:00 PM.
**Done when:** submitted, and every number has a link from the page's source list.

### Track B, Visit: Curiosity's measurements at every stop (suggested: Luca; flag `stop_science`)
1. `data/pipeline/stop_science.py` → `data/worlds/gale/stop_science.json`: per stop, the nearest ChemCam/APXS point (oxides, sol, metres away), nearest DAN reading, REMS temperature range for that sol.
2. `app/src/flow/stop-science.js` shows it on the stage 4 stop card, with instrument and sol.
3. A static "who carries what" table: crew, rover, helicopter.
**Done when:** each stop shows a chemistry number with its distance, and `app/src` reads the chemistry, neutron and weather files. **Cut line:** chemistry only.

### Track C, Aim and check: a science goal in the flow (suggested: Nicolas; flag `science_goal`)
1. Stage 1 opens with a goal card: "Boxwork: did groundwater last here?" and three things to check (ridge against hollow; fractures on ridge tops; where the nodules sit), each with its NASA link.
2. "Suggested by the science team" becomes "Curiosity's five stops"; a second button offers `candidates.json` when it exists.
3. Scout stage: a "What the helicopter carries" card.
4. Detections: one science row per stop inside the strip (landform class, largest step from the 1 m layers).
**Done when:** the goal shows before any stop and a flight reports science, not only rocks. **Cut line:** drop step 4.

### Track A, Find: candidate sites from orbit, with a check (suggested: Jules; files only)
1. Start from `data/pipeline/science_probe.py`. 2. Improve the score on the 1 m terrain (ridges at right angles, 10–20 m apart, 1–2 m tall). 3. Write `data/worlds/gale/candidates.json`: top 5–8 reachable sites that fit the budget, at least three Curiosity never visited. 4. Write the check numbers to `ml/exports/science_probe.json`.
**Format:** `[{"id", "name", "cell": [x, y], "score": 0-1, "why", "curiosity_visited": false}]`.
**Done when:** numbers are in the JSON, whatever they are. Target: four boxwork stops in the top 10%, inside-against-outside 0.75 or more. **Cut line 11:45:** ship with the label "first guide, a person decides". Do not tune until it passes.

Not in this plan: a rover simulation, new 3D sensors, training a new model, changing route maths.

## First numbers (`python data/pipeline/science_probe.py` → `ml/exports/science_probe.json`)

Boxwork limits are NASA's: entered sol 4534, left about sol 4845.

| Check | Result | Reading |
|---|---|---|
| Our ChemCam/APXS points against the published trend (boxwork: more Si, less Mg and S) | SiO₂ 43.6 vs 41.8; MgO 8.1 vs 10.9; SO₃ 10.7 vs 14.1; Al₂O₃ 8.3 vs 8.5 | 3 of 4 match; aluminium does not show the published rise |
| Percentile of Curiosity's stops on a ridge-and-hollow score (8 m cells) | Overlook 86, Valle de la Luna 83, Nevado Sajama 76, Ridge top 70, Altadena 0 | Fair. Altadena is at the edge of the unit |
| Score inside against outside the boxwork along the rover's path | 0.589 (81 vs 30 cells) | Weak: not a detector yet |

**Rule:** a number comes from a script in the repo and the file it writes, or from a page someone opened today with the link beside it. Search-result-only numbers stay out.

## Mission numbers for the pitch

| Claim | Number | Source |
|---|---|---|
| One walk takes a scouting sol and a walk sol | 2 sols | `docs/OPERATIONS.md` |
| First crewed stay | 30 sols | [National Academies 2025](https://www.nationalacademies.org/news/search-for-life-should-be-top-science-priority-for-first-human-landing-on-mars-says-new-report), [NASA](https://ntrs.nasa.gov/citations/20220001816) |
| Scouted walks in that stay | at most 15 | our arithmetic |
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
