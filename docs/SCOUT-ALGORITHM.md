# The scouting algorithm (proposal)

**Status:** proposal from Nicolas (P2) for team discussion. Companion to `docs/SCOUTING.md` (the flow, the sun and time, the research on energy). This file is about **the decision at the heart of the product: where to send the helicopter, and when to stop.**

## 1. The problem

We know the slice only at orbit detail. Some of the ground that matters to a walker (rock fields, soft sand, short steep steps) is invisible from orbit. A helicopter flight can reveal a strip of ground, but flights are scarce: limited battery per flight (about 700 m), daylight only, and over Ingenuity's mission one flight per 13.6 sols on average.

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

### A. The belief map: what we think each cell is

For every cell: the **chance it is blocked** and its **expected walking cost**, from orbit data:
- slope near the 25° limit;
- roughness;
- loose ground from THEMIS thermal inertia;
- how sure the ground-type estimate is.

Cells the helicopter has seen become certain. This is where **machine learning belongs** (see §4).

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

1. Belief map from orbit (rules first) and an uncertainty layer.
2. K candidate routes on expected cost.
3. Value-of-information scoring by sampling; greedy flight choice with the stop rule.
4. Flight planner: order, 700 m, daylight window, no-fly cells (reuses the walking planner's code).
5. Re-plan loop and the screen: 3D detail appears where flown, and each flight shows **why it was chosen** (its value in kJ and risk).
6. The benchmark, and its numbers for the pitch.
7. The exploration modes.

Later: a learned belief map (with Jules); a learned scouting policy, compared on the benchmark.

## 7. Facts to keep straight

- **"Two months to recharge" is not supported.** Ingenuity recharged from its own solar panel; how long that took varied with dust and season, and in winter it could not keep its charge overnight ([NASA](https://www.nasa.gov/centers-and-facilities/jpl/nasas-ingenuity-mars-helicopter-recharges-its-batteries-in-flight/); [Universe Today](https://www.universetoday.com/articles/martian-dust-is-starting-to-darken-ingenuitys-solar-panel)). The "two months" in our docs is rover driving time that one Ingenuity flight saved. The average gap between flights over the mission was 13.6 sols (computed from the first and last flight dates), set by operations, season and dust, not by one recharge.

## 8. To decide

1. Which mode first: **reach the targets** (fits the demo) or **build a network** (the long-term story)?
2. Agree on "the algorithm decides, ML improves the belief map", with a learned policy only as a later comparison?
3. Flight budget per campaign: a number of flights, or a number of sols?
