# The scouting algorithm (proposal)

**Status:** proposal from Nicolas (P2) for team discussion. Companion to `docs/SCOUTING.md` (the flow, the sun and time, the research on energy). This file is about **the decision at the heart of the product: where to send the helicopter, and when to stop.**

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

**Plan for sensing:**
1. **Now (rules):** a belief map from orbit features, calibrated so that "10% chance" really means about 10%, with an uncertainty layer. Can be done in the hackathon.
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
- **What JPL does not publish:** flight range, flight time, battery, recharge time and flights per sol.
- **How we model the gaps:** every missing number is a **knob, marked as an estimate**. Per-flight range defaults to Ingenuity's flown limit (about 700 m), the only Mars-measured number. Flights per helicopter per sol is a knob. A news claim of 300 km per mission is unverified and not used.
- **Daylight only:** cameras need light, and Ingenuity flew around midday local time.

## 8. To decide

1. Which mode first: **reach the targets** (fits the demo) or **build a network** (the long-term story)?
2. Agree on "the algorithm decides, ML improves the belief map", with a learned policy only as a later comparison?
3. Flight budget per campaign: a number of flights, or a number of sols? (SkyFall publishes neither; whichever we pick is a knob.)
4. Labels for sensing: scope projecting Curiosity's labelled images onto Gale cells with Jules, or start from the reviewed ROSCO rocks only?
