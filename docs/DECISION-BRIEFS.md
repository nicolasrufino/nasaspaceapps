# Decision briefs

Recommendations for the open decisions in `docs/DECISIONS.md` that we (Nicolas and the app side) can settle without waiting on another teammate. Each brief: the recommendation, the evidence, why not the alternative, the holes we checked, and what is still an estimate. **Nicolas decides; once a brief is accepted, it moves to the Decided table in `docs/DECISIONS.md`.**

Written 2026-11-15.

---

## 1. Approve PR #94 (routes on crossings + measured walking energy)

**Status: accepted by Nicolas, 2026-11-15.**

**Recommendation: approve, on two conditions.** (a) Jules re-exports R3 first. (b) Rebuild the world files at 20° **in the same PR**, so Jules re-exports once instead of twice (both changes alter `cost_to_go_scouted.f32`, which R3 pins by hash).

**Evidence.**
- **Gravity factor 0.68:** walking at simulated 0.38 g used about 68% of Earth's oxygen (2018 lower-body positive pressure study, cited in `docs/SCOUTING.md`). An independent classic agrees: Farley & McMahon (1992) found that cutting gravity by 75% cut walking's metabolic cost by only about 33% ([summary](https://pmc.ncbi.nlm.nih.gov/articles/PMC6465764)). Walking cost does not fall in proportion to gravity, so our 0.38 scaling was too low.
- **Sand 2.4×:** measured 2.1–2.7× on sand (Lejeune et al. 1998). 2.4 is the middle of the measured range.
- **Crossings:** 8 m cells hide what stops a person: 35% of "walkable" cells hide a stretch over the limit at 2 m scale (Luca's measurement on the 1 m HiRISE DTM). JETT3 crews with 1 m maps still hit impassable drop-offs.

**Why not keep the old model:** it under-counts energy by about 1.8× and lets routes cross ledges; every number in the pitch would be optimistic.

**Holes checked.**
- *Is 0.68 still too low?* Probably yes: suits add cost on top (Norcross et al. 2009). #94 moves us toward the truth, not past it. The docs keep saying the energy is a floor.
- *Does it break the app?* Per #94, `walk.js` falls back to the old constants on old worlds. I still test the app commit in a browser before approving. Contract change is additive (new knobs).
- *Does the tour still fit?* Only if the budget changes too: see brief 2.

---

## 2. Energy budget: real suit figure, not auto-sized

**Status: accepted by Nicolas, 2026-11-15.**

**Recommendation: use the suit-based budget Luca put in #94** (NASA planetary suit sizing rate of 1,200 BTU/h, 8 h suit, 1.5 h reserve, stops subtracted; ICES-2026-127). **Drop auto-sizing.**

**Why not auto-sizing:** it sizes the budget so the tour uses about 80% of it, which is circular. It hides exactly what #94 revealed (the walk is harder), and it is an invented number (rule 5).

**Holes checked.**
- *The walk-back ring gets much bigger and looks less dramatic in the demo.* True, and honest: on a real suit, energy is not the tightest limit on this tour. For the demo, the ring still shrinks as you walk, and the time limit (sunset, brief 7) becomes the visible limit.
- *Units:* 1,200 BTU/h is a metabolic heat rate (about 352 W), the same kind of quantity Pandolf predicts (metabolic watts). Consistent.

---

## 3. Which scouting mode first: **reach the targets**

**Status: accepted by Nicolas, 2026-11-15.**

**Recommendation: build "reach the targets" first; "build a network" after.**

**Why:**
1. **It is the demo:** five Curiosity stops, planned the night before.
2. **It is the building block:** a network's value is the sum of reach-the-targets values over the walks expected to use it. Network mode cannot exist without it.
3. **It can be measured honestly:** for a fixed set of targets we can compare against "knowing everything". Network mode needs a model of *future* walks (which targets, how often), and we have no data for that. It would be an invented number.
4. **Network mode is a harder problem:** connecting many places with one cheapest network is a Steiner-tree problem (NP-hard), on top of value of information.

**Holes checked.**
- *Do we lose the long-term story?* No. Confirmed cells already persist across walks (Galsan's D7 "map grows" merge). The demo can show a **second walk needing fewer flights** because the first walk's flights are reused. That is long-term value, measured, without network mode.

---

## 4. How high the helicopter flies, and does it matter for the model?

**Status: open.** Nicolas's question: the terrain model learns from **rover** images; the helicopter **flies**. Does that change anything for the machine learning?

**Short answer: rover-to-helicopter transfer needs measurement. Height alone does not determine image scale, viewing angle or flight safety.** Our own Curiosity-to-Perseverance gap already shows that camera and terrain differences matter even without a large height change.

The [Ingenuity instrument documentation](https://an.rsl.wustl.edu/help/Content/About%20the%20mission/M20/Instruments/M20%20HELI.htm) specifies a color camera tilted 45° downward and 0.26 mrad/pixel angular resolution. The earlier calculation using average field of view divided by image width did not establish local ground sampling, and the claim that 4 m recreates the rover's angle and scale was unsupported. The fixed 2.6× resize prescription is therefore withdrawn until per-image camera geometry is validated.

**Test now prepared:** `ml/ingenuity_review/` freezes 200 native RGB patches from 50 PDS frames across ten flights, selected before inference. The independent annotation page hides predictions and altitude. All labels are still pending; baseline inference has run, but accuracy remains null.

Next: human labels, per-image height above local terrain and camera footprints, then comparison of the frozen baseline and any adapted model on held-out flights. HELI_M_FRAME pose offsets are preserved as telemetry, not relabeled as terrain-relative altitude. Approximately 5 m observations must not be presented as a measured 4 m test. Unlabeled adaptation images must come from different flights.

**4 m and 10 m remain hypotheses.** Report classifier quality and missing altitude bands; do not convert a low score at 10 m into an instruction to fly at 4 m. Clearance, dust, navigation, energy and actual camera footprints require separate engineering checks. Height stays a scenario knob. Label policy and full protocol: `ml/LABEL_POLICY.md` and `ml/ingenuity_review/README.md`.

---

## 5. What "blocked" means for a suited walker

**Status: accepted by Nicolas, 2026-11-15.**

**Recommendation: a rock taller than 0.3 m is an obstacle. A cell is blocked when the average gap between obstacle rocks is under 1.0 m. Otherwise rocks only make the cell costlier** (the "big rock" walking cost, η = 1.5, Soule & Goldman).

**Evidence.**
- **0.3 m:** NASA's xEMU step test at lunar gravity: subjects stepped up 43–76 cm, and modelled for the **smallest (1st percentile) crew member, 12.5 in = 0.32 m** ([ICES-2025-294](https://ntrs.nasa.gov/api/citations/20250004496/downloads/ICES2025-294-stepheight-final.pdf)). Luca already uses 0.3 m for ledges in #93, so rocks and ledges follow one rule.
- **Rock height to width:** rocks are about half as tall as they are wide (lunar boulders 0.54; Mars similar or smaller, per Golombek et al. 2012 as cited by [Hood et al. 2018](https://sfsholes.github.io/papers/abstracts/Hood2018_LPSC_BoulderDetection.pdf)). So 0.3 m tall means about 0.6 m wide, below HiRISE's roughly 1.5 m detection limit. These rocks must be **predicted** with the rock-size law, which is what the belief map does.
- **1.0 m gap:** the hatch width NASA's same paper uses so the largest (99th percentile) suited crew member fits through: 40 in = 1.02 m.
- **The arithmetic:** for randomly scattered rocks of 0.6 m, the average nearest-neighbour gap drops under 1.0 m at about **6 obstacle rocks per 8 m cell** (0.095 per m²).

**Holes checked.**
- *Mars gravity is higher than the Moon's,* so stepping up is harder than in that test. 0.3 m is an **upper bound**. The benchmark should also run at 0.25 m to show how much the answer depends on it.
- *Mars rocks may be flatter* (smaller height-to-width). Then a 0.6 m wide rock may be under 0.3 m tall, so we count a few too many obstacles. That errs toward safety.
- *Walkers pick the widest gap, not the average.* So the average-gap rule declares "blocked" early. Again, it errs toward safety.
- *The cut-off of about 6 per cell is geometry, not a measurement.* It gets calibrated against Curiosity's "big rock" labels when Jules's labels arrive.

---

## 6. Stop rule: when do we stop flying?

**Status: accepted by Nicolas, 2026-11-15** (rewritten after his question: follow what the challenge asks).

**First, the words:**
- A **strip** is the piece of ground one flight photographs: a path of up to 1,000 m in the selected SkyFall scenario, about 30 m wide (estimated footprint).
- Each sol, the planner looks at every strip it could fly along the candidate routes. The **best strip** is the one whose photos would change the walking plan the most.

**What "change the plan" means has to follow the challenge.** NASA asks for a walk that is **safe first**, **does new science**, and works at the scale of one walk. So a flight's value is measured on those three, in that order:
1. **Safer:** it lowers the chance that the planned route turns out blocked, or raises the thinnest margin to get home.
2. **More science:** it makes a stop reachable that was dropped or uncertain.
3. **Easier:** it saves walking energy and time.

**The rule:** keep flying while some strip could still change the plan on one of those three. Stop when no strip would change it, or when the flight budget is used.

**Why a rule is needed at all:** a flight's electricity is trivial; what it really costs is a scarce flight and some risk to the helicopter. Ingenuity was lost on its 72nd flight: one loss in 72 flights, about 1.4% per flight, a crude single-event figure. A flight that would not change anything is pure risk.

**One technical guard:** values come from sampled worlds, so tiny values may be noise. A strip only counts if its value is clearly above the sampling noise.

**Holes checked.**
- *Does focusing on one walk miss long-term value?* Confirmed ground is kept for later walks (brief 3). The rule just does not spend flights on ground this walk will never use.
- *Is the order safety, science, effort right?* It is the challenge's order (R4 "safety first"). The weights between them are a team choice; the default is strict priority.
---

## 7. Flight budget: the evidence first

**Status: accepted by Nicolas, 2026-11-15, after testing: 3 flights per walk, 1 km each. Test and arithmetic in `docs/OPERATIONS.md`.** Updated 2026-11-15 with NASA's SkyFall mission package ([SkyFall Mission Information Package, NASA, Sept 2026](https://science.nasa.gov/wp-content/uploads/2026/09/skyfall-mission-information-package-final.pdf)), which **does** publish SkyFall's flight cadence. Earlier docs said it did not. Second correction: an earlier version said flights were "capped at about 10 Wh / 90 s". That came from a secondary source and is **wrong**. NASA says the cap was motor temperature, at 130–170 s (below).

| Question | What is known | Source | Confidence |
|---|---|---|---|
| How long is one flight? | Longest 169.5 s (flight 12). In summer only **130 s instead of 170 s**, because "maximum flight time was often capped by the maximum temperature of its actuators". Flying earlier and with slower rotors gave 150–160 s | [NASA, Flight 24](https://science.nasa.gov/missions/mars-2020-perseverance/ingenuity-helicopter/balancing-risks-in-the-seitah-region-flight-24/); [Digital Trends citing NASA's log](https://digitaltrends.com/space/nasa-ingenuity-mars-helicopter-flight-milestone) | Measured on Mars |
| How far? | Longest 704 m; 72 flights, 17.0 km, 128.8 min in the air in total | `docs/RESEARCH.md` §14 (NASA) | Measured on Mars |
| Battery | Six cells; about **38.8 Wh at 0 °C**, 44.4 Wh new at 25 °C; rated for 187 s of hard flying | [NASA/JPL battery paper](https://www.nasa.gov/wp-content/uploads/2024/01/battery-system-design-testing-and-operation-for-the-mars-perseverance-rover-and-ingenuity-helicopter.pdf) | NASA paper |
| Power in flight | "Many hundreds of watts" | [NASA, "When should Ingenuity fly?"](https://science.nasa.gov/blog/when-should-ingenuity-fly/) | NASA, no exact figure |
| Time of day | Never at night (it navigates by camera). Not too early: it "comes out of the cold Martian night without much energy in its battery". Not too late: a long late flight could drain the battery before the Sun recharges it. Flown at about **12:30 PM** in spring, **10:00 AM** in summer, 9:30 AM considered | Same NASA blog; Flight 24 | NASA |
| Wind | "The biggest risk is at takeoff and landing"; flights are timed with a wind forecast. 3.5–6 m/s measured during the first flights | NASA blog; [Ingenuity wind profiling](https://arxiv.org/pdf/2410.19132) | NASA / paper |
| Recharge | Ingenuity charged from its own solar panel, so it flew at most once per sol in practice | NASA blog | NASA |
| Recharge from a habitat | Ingenuity's exact cell model is not confirmed. A typical high-power 18650 cell charges fully in **2.5 h at 23 °C** (Sony VTC4 datasheet). Li-ion cells must be warm to charge, so the dock must be heated | [Sony VTC4 datasheet](https://files.batteryjunction.com/frontend/files/Sony_VTC4.pdf) | **Estimate** |
| Sending images home | Ingenuity's radio: 250 kbit/s on air, about **80 kbit/s actual** after a flight. One 13 MP colour image of a few MB would take several minutes; a strip of dozens of images would take hours | [JPL telecom paper (EME 2024)](https://ok2kkw.com/eme/Trenton/papers/N5BF-Mars_Helicopter_Telecom_EME2024.pdf) | Measured; image size is an estimate |
| **SkyFall's own cadence** | Each helicopter flies **about 1–2 km per flight sol, about 2.5 min in the air, then one non-flight sol to recharge the battery and downlink 100–400 Mbit**. At least 50 km, up to 300 km per helicopter over a 6-month mission (goal: one Earth year). Battery capacity is not given | [SkyFall Mission Information Package, NASA, Sept 2026](https://science.nasa.gov/wp-content/uploads/2026/09/skyfall-mission-information-package-final.pdf) §II–III | **NASA, primary** |
| Bigger concept | Mars Science Helicopter: about 30 kg, roughly 10–12 km per flight; solar recharge over one sol (single source) | [JPL poster](https://www.jpl.nasa.gov/site/research/media/posters/2021/R21015p.pdf); [IEEE Spectrum](https://spectrum.ieee.org/the-next-mars-helicopter) | Concept |

**What follows from the evidence (not decided):**
- **SkyFall as published (solar only):** each helicopter flies every other sol. With all three resting the sol before, the scouting sol gives **3 flights of 1–2 km each**. That is 3–6 km of ground, and the Gale tour route is about 1.3 km. This baseline needs no assumption from us.
- **This lines up with NASA's crew rule.** Crews keep a non-walk sol between walks; helicopters keep a non-flight sol between flights. Helicopters fly on the crew's rest sol and recharge on the walk sol.
- **With habitat charging (our assumption):** a second wave around 12:15 PM becomes possible (recharge about 2.5 h, estimate), so **up to 6 flights**. It needs a warm dock that charges and pulls the images off by cable.
- **Per-flight distance:** SkyFall says 1–2 km per flight sol; the app now uses 1,000 m, with regenerated pitch evidence merged in #117. This is a SkyFall scenario assumption, not an Ingenuity flight record.
- **Recommendation for Nicolas:** plan on **3 flights per walk** (published), show 6 as the "habitat charging" upgrade, and report the benchmark at 3 and 6.
---

## 8. A scouting sol and a walk sol, hour by hour

**Status: accepted by Nicolas, 2026-11-15; the full version lives in `docs/OPERATIONS.md`.** Times are **Mars local solar time at Gale**, in AM/PM. A Mars hour is 1 h 1.6 min of Earth time; a sol is 24 h 40 min. NASA plans crews on a 24 h 40 min "workday" ([NASA HEOMD-415](https://ntrs.nasa.gov/api/citations/20220000589/downloads/MarsSAC21SurfaceOps_2022-Jan_Version%201%20FINAL_update.pdf) §4.1).

**Sun at Gale (4.8° S), computed from the latitude and the Sun's seasonal swing (±25°):**
- **Sunrise:** 5:51–6:09 AM. **Sunset:** 5:51–6:09 PM.
- **Sun at least 15° up (the walking window, brief §8):** from about **7:00–7:15 AM** to about **4:45–5:05 PM**.
- To be checked against the Mars24 algorithm when the sun model is built.

**Why the helicopter cannot go at 5 AM:** it is dark until about 6 AM, and Ingenuity cannot fly without light because it navigates with its camera. Right after sunrise the Sun is low, so shadows are long and hide the rocks we are looking for. The earliest sensible launch is after the Sun is well up: Ingenuity's earliest documented slot was 9:30 AM.

**NASA's crew day** (HEOMD-415 §4.1): at least 8.5 h sleep; 1.5 h morning routine; 1 h midday meal; 2 h evening; exercise 2.5 h on non-walk sols and 1 h on walk sols; **8.5 h of work**. And: **"at least one non-EVA sol between EVAs wherever possible."** The scouting sol is that non-EVA sol.

### Sol 1: scouting sol (no walk)

| Time | What happens | Who |
|---|---|---|
| 5:30 AM | Wake; morning routine until 7:00 | Crew |
| ~6:00 AM | Sunrise. Helicopters wait, charged and warm in the habitat dock | — |
| 7:00–9:30 AM | Crew picks tomorrow's science stops on the 2D map. The planner proposes flights, each with its reason. Crew approves. Wind check | Crew + app |
| **9:30 AM** | **Wave 1:** 3 helicopters, one strip each; about 2.5 min and 1–2 km per flight (SkyFall's published figures) | Helicopters |
| ~9:45 AM | All docked. Images download over cable; recharge starts (about 2.5 h) | Dock |
| 9:45–11:30 AM | Processing: 3D terrain from the images, rock and ground detection, belief map updated, routes re-planned. Planner decides whether wave 2 is worth flying (stop rule) | App |
| 11:30 AM–12:30 PM | Midday meal | Crew |
| **~12:15–12:30 PM** | **Wave 2,** only if worth it **and** only with habitat charging (our assumption; SkyFall on solar flies once per two sols) | Helicopters |
| 12:45–2:30 PM | Processing wave 2; final route plus alternatives | App |
| 2:30–4:00 PM | **Crew review:** route, why each flight flew, the walk-back ring, times at each stop, what was not scouted | Crew |
| 4:00–7:00 PM | Packing list, suit checkout, exercise | Crew |
| 7:00–9:00 PM | Evening meal, personal time; sleep at 9:00 PM | Crew |

### Sol 2: walk sol

| Time | What happens |
|---|---|
| 5:30 AM | Wake; morning routine |
| 7:00 AM | Into the suits through the suitport (NASA's goal: pre-walk prep under 30 minutes, [NTRS](https://ntrs.nasa.gov/citations/20120011640)) |
| **~7:15 AM** | **Walk starts** once the Sun is 15° up |
| Walk | Up to about 6.5–8 h outside. NASA's example sol splits it, for example 2.5 h, a midday meal back inside, then 4 h (HEOMD-415 §5.2). The suit is sized for 8 h |
| **By ~3:15 PM** | Back at the habitat, at the latest 8 h after leaving. Hard limit: before the Sun drops under 15° (about 4:45 PM) |
| Afternoon | Debrief; the walk log is merged into the map ("map grows"); exercise 1 h |

### Could the walk happen the same sol as the flights?

- **With both waves:** the plan is ready about 2:30 PM. Suit-up takes it to about 3:00 PM, and the walker must be back by about 4:45 PM. That leaves under 2 hours: **not realistic**.
- **With one wave only:** the plan could be ready about 11:30 AM, leaving about 5 h of walking. Possible for a short walk, but it skips the second look and squeezes the crew review.
- **Recommendation:** scout on the non-walk sol, walk the next morning. This matches NASA's rest-sol rule, and `docs/PRODUCT.md` already says the habitat display is used "the sol before".

**How the app shows it:** a two-sol timeline strip in plan mode (Sol 1 flights and processing, Sol 2 walk window). The current time and the sun's height are drawn on it. The walk's last safe turn-back time is marked, from the walk-back ring and the 15° limit.

---

## 9. Demo look

**Status: accepted by Nicolas, 2026-11-15, with his design.**
- **Unexplored ground:** flat, muted grey, like darkness around the base. Only the habitat (a well-designed spaceship model) stands out.
- **The helicopter reveals as it flies:** a scanning sweep, like sonar. `docs/RESEARCH.md` §13 already describes it honestly as a laser-like fan of rays, "a bat, but with light", over real NASA terrain.
- **Where it has flown:** full colour, with the rocks found and the steps that can't be crossed. Later, real 1 m HiRISE heights along each strip (about 84 KB per flight).
- **Why:** it shows what we **know**, and grows only where we learned something.
- **Honesty:** the 8 m map is real NASA orbit data; the "detail" is the 1 m HiRISE DTM standing in for helicopter stereo. The screen says so.


---

## 10. What the helicopter senses besides pictures

**Status: accepted by Nicolas, 2026-11-15. How it looks in 3D: `docs/SCOUT-3D.md`.**

**What our app does today (checked in the code):** the simulated flight only reveals the hidden rock layer (`rocks_fine`) inside a 15 m swath (`app/src/scout.js`, `reveal()` in `app/src/main.js`). Radiation (`dose_rate`), chemistry (ChemCam/APXS points), hydrogen (DAN) and minerals (CRISM) come from orbit and from Curiosity, **not** from the helicopter.

**What SkyFall actually carries** ([SkyFall Mission Information Package, Sept 2026](https://science.nasa.gov/wp-content/uploads/2026/09/skyfall-mission-information-package-final.pdf) §IV), and what each would give us:

| Sensor (on SkyFall) | What it measures | How accurate | Needs a trained model? | Has a drone done it? |
|---|---|---|---|---|
| **2 colour cameras**, 13 MP, one straight down, one at the horizon; over 200 images per flight | 3D terrain and rocks: "cm-scale orthophotos and digital elevation maps" from stereo | Ingenuity images gave 3–6 cm height error from 10 m up (`docs/RESEARCH.md` §13). Navcam-only maps: several cm to tens of cm | **No** for 3D (structure from motion). **Yes** for "sand or rock" labels (brief §4) | Yes, on Mars (Ingenuity) |
| **2 near-IR cameras**, filters "TBD, targeting mineral-relevant wavelengths" | "Some information on mineralogy or chemistry", e.g. water-bearing minerals | A few broad bands, not a spectrometer. Earth drone hyperspectral reaches 73–87% for mineral maps, with lab-checked samples ([Frontiers 2022](https://doi.org/10.3389/feart.2022.871529); [DOAJ](https://doaj.org/article/4bf1f06de187448fab335cf07d1c48f4)) | Band ratios need only calibration; a mineral classifier needs labelled ground truth | Yes on Earth; planned on Mars |
| **Ground-penetrating radar**, 500–2500 MHz | Layers and buried ice, **3–5 m deep**; also how deep loose sand is (the trap that stopped Spirit) | 10 cm range resolution in air. Earth drone GPR needed calibration against hand-measured depths, error up to 10% ([Vergnano 2022](https://doi.org/10.3390/rs14071763)). Drone GPR sees less deep than ground GPR ([review](https://doi.org/10.3390/rs14143245)) | **No:** classical processing plus calibration; ML optional | Yes on Earth; planned on Mars |
| **Dosimeter** (single chip, 14 µrad per count) | Radiation dose, "while airborne and on the ground", "over minutes to hours", for "a three-dimensional map" | Our arithmetic: Mars surface dose about 0.21 mGy/day ([RAD](https://www.swri.org/press-release/swri-scientists-publish-first-radiation-measurements-surface-mars)) is about **1 count per minute**. A 2.5 min flight gives 2–3 counts, too few to mean anything. Measuring a site to ±5% takes about 400 counts, **about 6.5 hours sitting still** | **No:** calibration only | Yes on Earth (Fukushima drones, 1–5 m up; [Martin 2016](https://research-information.bris.ac.uk/ws/files/48818707/Martin_et_al_2015.pdf)) |
| **Air temperature** (thermocouples) + **wind** (from how the helicopter drifts) | Weather in the lowest air | Wind to about ±5 m/s (TBC). Ingenuity-derived winds matched MEDA's direction ([Jackson 2024](https://arxiv.org/abs/2410.19132)) | No: physics model | Yes, on Mars (Ingenuity) |

**What SkyFall does not carry, and why it matters for us:**
- **No chemistry by laser or contact** (like ChemCam, APXS). LIBS works at 1.3–7 m on ChemCam, which is about 10 kg. A version small enough for a Mars helicopter is being built (MicroLIBS, at most 1.5 kg, CNES with IRAP and LANL, first laser firing September 2025; [CNES](https://cnes.fr/en/news/microlibs-small-french-instrument-big-ambitions-exploring-mars)). Its working distance is not confirmed in what we found, so we do not claim one.
- **No gamma or neutron spectrometer** (like Odyssey GRS or DAN): too heavy and too slow to count. Dragonfly measures this only after landing ([DraGNS](https://civspace.jhuapl.edu/destinations/instruments/dragns)).
- **No magnetometer**, though concepts propose one at about 20 g ([arXiv 2010.06630](https://arxiv.org/pdf/2010.06630); [JPL MSH payload poster](https://www.jpl.nasa.gov/site/research/media/posters/2021/R19011p.pdf)).

**What this means for Martian Map (proposal):**
1. **Keep the helicopter's main job: 3D terrain and hazards from its cameras.** That is proven on Mars, and only the hazard labels need training.
2. **Radiation comes from the helicopters while they rest, not while they fly.** SkyFall sits on the ground every other sol. A helicopter resting near a ridge or butte for hours can check our `dose_rate` estimate (RAD mean × sky-view factor). On Mars a butte blocking 19% of the sky cut the dose measured by Curiosity's RAD by 4% ([Ehresmann et al. 2021, JGR Planets](https://doi.org/10.1029/2021JE006851)).
3. **Sand depth from radar is the biggest safety add**, because orbit cannot tell firm ground from soft sand. We have no radar data for Gale, so in the demo it is a labelled "SkyFall would add this" layer, never invented numbers.
4. **Near-IR gives a hint of hydrated minerals** for science stops (R2 science goal), not a measurement. Chemistry stays with Curiosity's real ChemCam and APXS data.
5. **The sonar-like reveal** (brief §9) shows the cameras' 3D scan; radar could show as a second, slower "ping" underneath.


---

## Sources (beyond those linked above)

[Farley & McMahon 1992 context](https://pmc.ncbi.nlm.nih.gov/articles/PMC6465764) · [NASA xEVA overview, slopes up to 20°](https://ntrs.nasa.gov/api/citations/20210000827/downloads/Exporation%20EVA%20Testing%20and%20Analogs%2020210000827.pdf) · [xEVA concept of operations](https://ntrs.nasa.gov/api/citations/20200001071/downloads/20200001071.pdf) · [Golombek, rocks from HiRISE match lander counts](https://experts.arizona.edu/en/publications/size-frequency-distributions-of-rocks-on-the-northern-plains-of-m-2/)
