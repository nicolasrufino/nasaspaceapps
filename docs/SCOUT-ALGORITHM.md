# The scouting algorithm

**Status:** direction accepted by Nicolas (P2) on 2026-11-14; not built in the app yet (a toy version runs in the [scouting explainer](https://claude.ai/artifact/8FDY6zGHXoewAtzxYBCJKG), source `docs/scouting/explainer.html`). Decisions and open questions: `docs/DECISIONS.md`. Companion to `docs/SCOUTING.md` (the flow, the sun and time, the research on energy). This file is about **the decision at the heart of the product: where to send the helicopter, and when to stop.**

## 1. The problem

We know the slice only at orbit detail. Some of the ground that matters to a walker (rock fields, soft sand, short steep steps) is invisible from orbit. A helicopter flight can reveal a strip of ground, but flights are scarce. Our helicopters are modelled on **JPL's SkyFall** (see §7): a fleet of three, flying in daylight only, each flight limited by its battery.

**Question:** which strips should the helicopter fly, in what order, so that the walking routes we finally choose are **nearly as good as if we knew everything**, using **as few flights as possible**? And when is it no longer worth flying?

The best route of all would need every cell scouted. That is not the goal. **The goal is the best route per flight spent.**

### It has a name

Computer science calls this the **Canadian Traveller Problem with Remote Sensing**: a map is known, but some links may be blocked with a known probability; you can pay to check a link before travelling; minimise travel cost plus sensing cost ([Bnaya, Felner & Shimony, IJCAI 2009](https://ijcai.org/Abstract/09/080); [overview](https://en.wikipedia.org/wiki/Canadian_traveller_problem); [complexity of variants](https://arxiv.org/pdf/1207.4710)). Finding the perfect policy is proven intractable, so practical solutions use heuristics based on **expected cost**: sense where the answer is most likely to change your decision.

Our version adds things the textbook version doesn't have:
- **Many places to reach**, not one start and one goal.
- **One flight reveals a whole strip**, not one link.
- **Hard limits:** battery per flight, a midday window, no-fly ground (smooth sand, deep shadow).
- **The map is reused:** what we learn now pays off on every later walk.

So this is an application of known theory to a new combination of constraints. We should say exactly that, not that the theory is new.

Closest robotics work: a helicopter scouting for a rover on Mars ([Where to Map?, 2020](https://arxiv.org/pdf/2008.07157); [Folsom et al. 2021](https://journals.sagepub.com/doi/full/10.1177/1729881421999587); [Traversing Mars, 2024](https://arxiv.org/html/2406.05313)). Folsom et al. found that a helicopter scouting **only the rover's planned path** gave little improvement. That is why we scout **where the decision is uncertain**, not just along one path.

## 2. The algorithm, in five parts

### A. Sensing: predicting what might be blocked

**The gap in the textbook version.** In the Canadian Traveller examples, each link's chance of being blocked is *given*. On Mars nobody gives us that number. We have to **predict it from what orbit shows**, and the whole planner is only as good as that prediction. So sensing has two halves:

1. **Predict** (before flying): for every cell, the **chance it is blocked** and its **expected walking cost**, from the 2D orbit map. This is the *belief map*.
2. **Confirm** (by flying): the helicopter's camera turns predictions into facts along the strips it flies. Cells it has seen become certain, and every one of them is a new labelled example for the predictor.

A route is blocked if any cell on it is. Rock fields come in patches, so neighbouring cells are not independent. That is why we **sample whole possible worlds** (patches, not single cells) instead of multiplying cell chances.

**What the predictor can use (all orbit, all already in our world or the repo):**

| Input | Detail | Source |
|---|---|---|
| Slope and relief | 8 m grid | HiRISE stereo DTM (USGS Gale) |
| Fine roughness | 1 m | HiRISE stereo DTM |
| Image texture and rock shadows | 25 cm: rocks bigger than about 1 m cast visible shadows | HiRISE colour; NASA/JPL ROSCO rock detector (`ml/rock_review/ROSCO.md`) |
| Loose ground vs rock | 100 m | THEMIS thermal inertia |
| Rock-size model | Counts of big rocks predict how many small ones there are (Mars rocks follow an exponential size law) | Golombek and colleagues, used for every Mars landing site ([example](https://pmc.ncbi.nlm.nih.gov/articles/PMC7039939/figure/Fig10)) |

**What can serve as labels (what was "really there"):**

| Label source | What it is | Status |
|---|---|---|
| `rocks_fine` in our Gale world | Cells rough at 1 m but gentle at 8 m | A **rule on orbit data**, not ground truth (see the caveat below) |
| ROSCO rocks reviewed by Jules | 31 accepted, 3 rejected, 16 uncertain of 50 | Real but few (`ml/rock_review/FINAL_SITE.md`) |
| Curiosity's own drive through this slice | Rover images with terrain labels (AI4Mars has a "big rock" class) at known rover positions | **The best ground truth for our site.** Needs the images projected onto map cells: real work, to scope with Jules |
| Ingenuity flights over Jezero | Helicopter images and HiRISE of the same ground | Exactly "orbit vs helicopter" pairs, but no labels yet |

**First measurement (`app/scripts/sensing-check.mjs`, numbers in `sensing-check.json`).** On Gale, can coarse orbit features (8 m slope, 8 m relief, THEMIS) predict `rocks_fine`? Trained on the west half, scored on the east half:

- Rock cells are rare: about **1.6–1.9%** of walkable cells.
- Best single feature, 8 m relief: **AUC 0.62** (0.5 = guessing, 1.0 = perfect).
- All three combined: **AUC 0.58**. A simple model trained on one half does not carry over well to the other.
- Flying the **20% of cells it rates riskiest catches 34% of the rocks**, against 20% for flying at random.

**What this means:**
- **Coarse features alone are weak.** There is a real signal, but not enough. The signal must come from the fine data: the 25 cm image and the 1 m DTM.
- **Our label is circular on Gale.** `rocks_fine` is itself computed from the 1 m orbit DTM. A model using that DTM would score near-perfectly and prove nothing. **Real labels must come from the ground:** Curiosity's images or reviewed rocks.
- **A weak predictor is still useful.** Value of information needs *probabilities*, not certainties. Even a weak but honest prediction tells the planner where uncertainty is, and every flight adds labels.

**Second measurement: Jules's reviewed rocks (R3, PR #88).** The Gale world now holds 23 human-accepted ROSCO rocks from one HiRISE image (22 cells, padded to 180), on top of the 963 DTM-estimate cells. Scored against cells with no hazard (same script):

- These real rocks sit on **steeper, bumpier 8 m ground**: AUC **0.83** for 8 m slope and **0.82** for 8 m relief. THEMIS adds little (0.55).
- The model trained on the old DTM rule scores them at **0.52**, no better than guessing. The rule assumes rocks hide on *gentle* ground; the reviewed rocks are on *steep* ground. **So the rule label is not just circular, it points the wrong way for real rocks. Do not train on it.**
- **Caveat:** 22 rocks from one image, chosen from a detector's proposals rather than at random. The uncertainty is wide (roughly ±0.15) and the steep-ground link may partly be where shadows are easiest to see. This is a lead, not a result.

**What R3 gives us and what the belief map still needs:**

| R3 gives | Still needed |
|---|---|
| Real, human-checked rocks, kept apart from the DTM estimates | **Wall-to-wall coverage:** ROSCO run over the whole slice, keeping every detection, not 25 proposals |
| Exact placement on our grid (registered to the mosaic) | **Rock sizes per cell**, to get rock cover and apply the rock-size law |
| A demo the helicopter can reveal | **Negatives:** "looked here in good light, found nothing", which are as useful as rocks |
| | **Probabilities, not a yes/no mask**, so value of information can weigh flights |

**Luca's PR #93 is the other half of the blocker.** It computes from the 1 m DTM which **crossings between cells** a suited walker can make (0.3 m step limit, NASA ICES-2025-294). Its `unsure` layer, "share of crossings near a limit", is a ready-made uncertainty input for choosing flights. Rocks (R3) plus crossings (#93) plus probabilities is the belief map.

#### How the helicopter looks: low and slanted, like a rover

**The idea:** fly at about 2 m and look across the ground at a slant, like a rover's camera. Then models trained on rover images (AI4Mars) apply. And unlike a walker or rover, a helicopter never pays to back out of a dead end: it lifts over and moves on.

**What checks out:**
- **The height matches.** Curiosity's Navcams sit 1.94–1.99 m above the wheel base ([WUSTL instrument page](https://an.rsl.wustl.edu/help/Content/About%20the%20mission/MSL/Instruments/MSL%20Navcam.htm)). AI4Mars labels come from those cameras.
- **No cost to back out.** This is the asymmetry the algorithm uses: sensing is cheap next to walking into a dead end. The helicopter still has to get back to the habitat to recharge, so its battery range still limits each flight.

**What argues against 2 m:**
- **Dust.** Ingenuity's rotor lifted dust on take-off until it was above 3 m, on landing from 2.3–3.6 m, and in places even cruising at 5.1–5.7 m ([Lemmon et al., JGR Planets 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC10078181)). At 2 m the camera would look through its own dust cloud, and the downwash would disturb the ground it is trying to see.
- **Clearance at our site.** Luca measured (#93) boxwork ridge relief inside a cell: median 0.8 m, 90th percentile 1.7 m. A 2 m hover leaves about 0.3 m over the high ridges.
- **Same height does not mean the model transfers.** Jules's classifier scored 93% on Curiosity but **48% on Perseverance**, both at about 2 m on a mast. Rover-to-rover already fails, so rover-to-helicopter needs its own labelled helicopter images to fine-tune and test.

**Proposal: match the viewing angle, not the height.** What makes the ground look like a rover's view is the **slant**, not the altitude. Fly above the dust (above about 6 m, a knob) with a camera tilted toward the horizon, like Ingenuity's colour camera. Sources differ on its tilt: 22° below the horizon ([JPL](https://photojournal.jpl.nasa.gov/catalog/PIA24593)) or 45° ([Maki et al., LPSC 2025](https://epizodyspace.ru/bibl/inostr-yazyki/Lunar_and_Planetary_Science/2025/Maki_et_al_Ingenuity_Mars_Helicopter_Cameras_56th_LPSC_no_2685_(2025).pdf)). The 13 MP camera keeps rocks sharp from further away.

**Test set that exists today:** Ingenuity's colour images are public. Labelling a few hundred patches would tell us whether the rover-trained model works from the air, before anyone builds on it.

#### Training sensing: what is missing, whether Moon data helps, and what we start now

**What training needs:** pairs of (orbit picture of a place, what is really on the ground there, at the scale that stops a walker). Here is what exists for each part:

| Need | Exists? |
|---|---|
| Orbit pictures | Yes, plenty: HiRISE 25 cm and its DTMs |
| Big rocks seen from orbit (about 1.5 m and up) | Yes. Shadows at a known sun angle. NASA's automated rock detector measured about 10 million rocks this way, and above about 1.5 m HiRISE sees the same rocks landers see on the ground ([Golombek et al.](https://experts.arizona.edu/en/publications/size-frequency-distributions-of-rocks-on-the-northern-plains-of-m-2/)). ROSCO is that detector, already running on our site |
| Rocks smaller than orbit can see (what actually trips a walker) | Not detectable from orbit. They are **predicted** from the big-rock count by the rock-size law used for every landing site |
| Ground type (sand, soil, bedrock) from orbit | NASA already does this. **SPOC-HiRISE** (JPL) labels every 25 cm HiRISE pixel with one of 17 terrain classes, more than 90% agreement with people, used in Curiosity's ground operations ([SPOC](https://nasa-jpl.github.io/SPOC)). Only its small onboard version is open source; the HiRISE model is not released |
| Ground truth at a walker's scale | **This is what is missing.** On Mars it exists only where rovers drove (AI4Mars labels on Curiosity's images; very few "big rock" examples: 9 in Jules's training set) and under Ingenuity's flights (images, no labels) |
| What counts as "blocked" for a suited walker | No published threshold found. It will be a knob, marked as an estimate |

**Does Moon data help? Partly, for one part, and we should say exactly which.**

| Moon data | What it gives |
|---|---|
| [Global lunar boulder map (Aussel et al., 2025)](https://eos.org/editor-highlights/nearly-94-million-boulders-mapped-on-the-moon-using-deep-learning) | About 94 million boulders found by a neural network on LRO NAC images, 60° S to 60° N. [Maps on Zenodo](https://zenodo.org/records/15520275) |
| [RMaM-2020 (Bickel et al., 2021)](https://www.frontiersin.org/articles/10.3389/frsen.2021.640034/pdf) | 2,822 labelled rockfalls on **both** Moon (NAC) and Mars (HiRISE) images, built for training detectors |

- **Helps:** finding rocks by their shadows in orbit images. The physics is the same: a rock at a known sun angle casts a shadow of a predictable length. The Moon has far more labels than Mars, so it is good **pre-training** for a rock detector, which we then fine-tune on Mars.
- **Does not help:**
  - sand and soft ground (the Moon has no wind-blown sand or dunes);
  - Mars dust and weathering, which change how rocks look;
  - small rocks: the lunar map lists boulders of about 4.5 m and up, much bigger than what stops a walker.
- **Bonus for the pitch:** the same tool works on the Moon for Artemis, where this data is native.

**So: Moon data is a pre-training option for the rock part, never the whole answer, and never the test.** The test must be on Mars ground truth.

**What we can start now (each step graded on held-out data, like `sensing-check.mjs`):**
1. **Big rocks, no training:** run ROSCO across the whole Gale slice. Rock count per cell, then rock-size law, then chance of a walker-sized rock, then chance the cell is blocked. Check against Jules's 31 accepted and 3 rejected rocks. This replaces today's circular `rocks_fine`.
2. **Ground type, training with labels we already have:** a small model on HiRISE 25 cm patches for sand, soil and bedrock. Labels come from Curiosity's own drive in our slice (AI4Mars ground labels placed on the map at the rover's logged positions). Held out: a stretch of the drive the model never saw.
3. **Rock detector, pre-trained on the Moon:** pre-train on lunar boulders and RMaM-2020, fine-tune on Mars HiRISE rocks (ROSCO plus Jules's review). Keep it only if it beats step 1 on the held-out Mars rocks.
4. **Every flight adds labels:** in the app, cells the helicopter confirms become new examples, so the map improves as it is used.

Steps 2 and 3 are ML work in `ml/` (Jules); step 1 is a pipeline layer. None of them is built yet.

**Plan for sensing:**
1. **Now (rules):** a belief map from orbit features, calibrated so that "10% chance" really means about 10%. **Built 2026-11-15** (`app/src/belief.js`, flag `belief`; see `app/HOW-IT-WORKS.md` §12).
2. **With Jules (ML):** a small image model on 25 cm HiRISE patches, trained on reviewed ROSCO rocks and, if feasible, Curiosity's labelled ground. Graded by the same held-out check.
3. **Benchmark honestly:** generated worlds where hidden rocks *depend on* the orbit features in a known way. Today's synthetic rocks are random, so there nothing can be predicted, and only the "flying confirms" half can be tested.

### B. Candidate routes: several ways between each pair of places

For each pair of places (and base), find the **K cheapest different routes** on expected cost: the cheapest, then search again with the cells already used made costlier. Each route gets an expected cost and a **risk** (the chance something on it is blocked).

### C. Value of information: the heart

For a strip the helicopter could fly:

```
value of a strip = expected cost of the best walking plan now
                 − expected cost of the best walking plan after seeing that strip
score = value ÷ flight cost (battery, time in the daylight window)
```

The expectation is estimated by **sampling**: draw many possible "true" worlds from the belief map; in each, see whether the strip would change which route we choose and by how much. A strip only has value if what it might reveal **could change the decision**. Flying over ground we are already sure about, or over a route we would never take, is worth nothing.

- **Choose:** fly the best-scoring strips first.
- **Stop rule:** stop when the best remaining strip is worth less than a flight. This is the balance you asked for: not the best possible path, but the point where more scouting no longer changes the plan enough to pay for itself.
- **Guarantee, where it applies:** when the reward behaves like coverage or information (each extra strip adds less than the one before), choosing greedily gets at least about **63%** (1 − 1/e) of the best possible result. Path-constrained versions keep a guarantee too ([Singh, Krause et al., JAIR 2009](https://arxiv.org/pdf/1401.3462v1.pdf); [IJCAI 2007](https://ijcai.org/proceedings/2007/355)). Value of information does not always behave that way, so for us this is a guide, not a promise.

### D. The flight planner: turn chosen strips into flights

Order the strips into flights: the shortest order between take-off and landing spots, solved exactly for a handful (as the walking planner already does). Each flight is at most 700 m, in the midday window, and avoids no-fly cells. Spread the flights over sols.

### E. Learn, then re-plan

After each flight, update the belief map, recompute the candidate routes and the values, and plan the next flight. The same idea robots use to re-plan when they discover an obstacle (D* Lite): plan with what you know, repair when you learn more.

## 3. Exploration modes: same machinery, different goal

| Mode | What it is for | What a strip is worth |
|---|---|---|
| **Reach the targets** | This walk to these places | How much it lowers the expected cost and risk of the walk |
| **Build a network** | Long-term use, many walks | How much it lowers the cost of a reusable network of confirmed corridors linking many places (a Steiner-tree-like "road map"), counted over the walks expected to use it |
| **Explore new ground** | Find what is out there | How much newly confirmed walkable ground it adds next to what we know (frontier exploration, Yamauchi 1997) |
| **Go far** | One long expedition | Like "reach the targets", with risk weighted more far from base, where the margin home is thinnest |

The crew picks a mode; only the scoring changes.

## 4. An algorithm or a trained model?

**Recommendation: the algorithm decides; machine learning improves what it knows.**

- **Decisions must be explainable.** An astronaut's safety depends on them, and the crew must be able to ask "why did it fly there?". The value-of-information planner answers in numbers: "this strip could save 40 kJ or rule out a blocked route; nothing else is worth more."
- **Machine learning is best at the belief map:** learning what orbit features really mean for the ground ("this texture and this thermal reading usually hide a rock field"). Every scouted cell is a new labelled example, so **the prior improves with every flight**, and later campaigns need fewer flights. Jules's rock detector and ground classifier are the start of this.
- **A learned scouting policy** (reinforcement learning, where the model learns to choose flights itself) is possible later. We can train it in simulation, because we generate worlds where we know the hidden truth. Use it only if it beats the planner on the benchmark below and its choices can still be explained.

**Where it runs:** on the habitat or ship computer, which receives the helicopter's images through a relay, as Ingenuity used Perseverance. The helicopter only needs waypoints. For scale, our walking planner runs in about 0.1 s on the 256 × 256 Gale grid in a browser; value of information with, say, 50 sampled worlds should take seconds (to be measured).

## 5. How we prove it is the killer feature

A benchmark in code, on many generated worlds with hidden rocks plus Gale. Compare:

1. no scouting;
2. straight-line flights between the places;
3. scouting only the planned route (the published baseline);
4. **value-of-information scouting (ours)**;
5. **knowing everything**, the best possible.

Measure:
- how much more energy the final route costs than the best possible;
- how often the route turns out blocked during the walk;
- flights used.

The result is a curve of **route quality against flights**. Ours should get close to "knowing everything" with far fewer flights than the others. **These numbers come only from running this benchmark**; nothing is claimed before then.

## 6. Build steps (each a PR)

1. Belief map from orbit (rules first, calibrated) and an uncertainty layer (§2A). Generated worlds whose hidden rocks follow orbit features, so prediction can be tested.
2. K candidate routes on expected cost.
3. Value-of-information scoring by sampling; greedy flight choice with the stop rule.
4. Flight planner: order, 700 m, daylight window, no-fly cells (reuses the walking planner's code).
5. Re-plan loop and the screen: 3D detail appears where flown, and each flight shows **why it was chosen** (its value in kJ and risk).
6. The benchmark, and its numbers for the pitch.
7. The exploration modes.

Later: a learned belief map (with Jules); a learned scouting policy, compared on the benchmark.

## 7. Facts to keep straight

- **The helicopters are modelled on SkyFall, not on a recharge rule.** We drop the "two months to recharge" idea. That figure was rover driving time one Ingenuity flight saved, not a recharge time. We also drop Ingenuity's average of one flight per 13.6 sols, which came from a technology demonstration.
- **What JPL publishes for SkyFall** ([JPL SkyFall](https://www.jpl.nasa.gov/missions/skyfall/)):
  - three helicopters, launch 2028;
  - delivered by a mid-air deployment from the spacecraft, with no landing platform;
  - 13 MP colour and near-infrared cameras, ground-penetrating radar, air temperature sensors and a micro dosimeter;
  - purpose: map hidden ice and the terrain above and below ground, to find safe and resource-rich places and scout landing sites.
- **What NASA's mission package adds (Sept 2026):** about 1–2 km and 2.5 min per flight sol, then one non-flight sol to recharge; at least 50 km per helicopter over 6 months ([SkyFall Mission Information Package, NASA, Sept 2026](https://science.nasa.gov/wp-content/uploads/2026/09/skyfall-mission-information-package-final.pdf)). Battery capacity is still not given. (Corrected 2026-11-15; earlier this said none of it was published.)
- **Other helicopters that fill SkyFall's gaps:**

| Craft | Status | What it shows |
|---|---|---|
| [Ingenuity](https://www.avinc.com/solution/ingenuity-mars-helicopter/) | Flew 72 times, 2021–2024 | Range 625–704 m and up to about 170 s per flight; solar recharge |
| [Mars Science Helicopter](https://spectrum.ieee.org/the-next-mars-helicopter) | NASA concept (JPL, Ames, AeroVironment) | About 30 kg hexacopter, about 5 kg payload, roughly 10–12 km per flight ([JPL poster](https://www.jpl.nasa.gov/site/research/media/posters/2021/R21015p.pdf), [arXiv](https://arxiv.org/pdf/2203.03704.pdf)). IEEE Spectrum reports its solar cell recharges the battery **over one Martian day** (single source) |
| [Mars Sample Recovery Helicopters](https://aiaa.org/2022/07/29/nasa-pair-of-ingenuity-inspired-helicopters-will-be-part-of-mars-sample-return-mission/) | Planned 2022; Mars Sample Return since restructured | Ingenuity-class, about 700 m from the lander |
| [Dragonfly](https://rps.jpl.nasa.gov/internal_resources/854/Dragonfly%20line%20art.pdf) (Titan) | Launch 2028 | **Recharges its battery between flights from a nuclear generator** of about 100 W, not the Sun: flying from a charged battery, refilled by a small steady source |
| [Fission Surface Power](https://www.universetoday.com/articles/nasa-is-building-a-nuclear-reactor-to-power-lunar-and-martian-exploration) | NASA project, 40 kW, aimed at the early 2030s, designed to carry over to Mars | The power a crewed base could have |

- **Our helicopter, adapted from SkyFall:** SkyFall's fleet of three and its sensors (the proof that the scouting job is planned). **Recharged at the habitat's power**, the way Dragonfly recharges from its generator, instead of from its own small solar panel. With a crew on the surface, flights per sol are then limited by daylight and the battery, not by sunlight on the helicopter. This is **our design assumption**, not a NASA plan, and the docs and app must say so.
- **How we model the gaps:** every missing number is a **knob, marked as an estimate**. Per-flight range defaults to Ingenuity's flown limit (about 700 m), the only Mars-measured number. Flights per helicopter per sol is a knob. A news claim of 300 km per mission is unverified and not used.
- **Daylight only:** cameras need light, and Ingenuity flew around midday local time.

## 8. To decide

1. Which mode first: **reach the targets** (fits the demo) or **build a network** (the long-term story)?
2. Agree on "the algorithm decides, ML improves the belief map", with a learned policy only as a later comparison?
3. Flight budget per campaign: a number of flights, or a number of sols? (SkyFall publishes neither; whichever we pick is a knob.)
4. Labels for sensing: scope projecting Curiosity's labelled images onto Gale cells with Jules, or start from the reviewed ROSCO rocks only?
