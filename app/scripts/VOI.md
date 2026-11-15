# A6: experimental value-of-information flights

**Status: implemented behind `voi`, off by default. The promotion comparison fails.**
The judged bare `/scout/` keeps F4's three-flight route-following baseline. On Gale
the default VOI settings select no flight, leaving six distinct stored hazard
cells on the route; F4 leaves zero and fully scans the final route. Do not call
this an improvement or use the experiment in the pitch as a shipped benefit.

Run `node app/scripts/voi-benchmark.mjs` from the repo root. It writes
[the comparison table](VOI_RESULTS.md) and [machine-readable results](voi-benchmark.json).
Each of the eleven cases compares the same world, budget, selected stops and
three-flight / 1 km cap. The ten generated worlds use seeds 1–10 and a specified
coarse-feature hazard generator, with correlated patches. They are synthetic
validation scenarios, not new Mars labels or a fit of the belief model.

## Selection and counterfactuals

`scout-voi.js` ports `scan`, `choose` and `execWalk` from
`docs/scouting/explainer.html` to the app's world format:

1. `beliefMap()` supplies estimates from orbital features; observed cells are
   clamped to their observations. The selector does not read `rocks_fine` or
   `cost_to_go_scouted`. Its worker receives neither hidden layer.
2. Draw **12** seeded possible worlds. Unknown cells in a 2×2 patch share a
   uniform draw; this correlation length is an assumption. Known cells stay fixed.
3. Search up to **3 candidate paths per leg** in the current stop order. Reused
   cells cost 1.9× more in the next candidate search. A* uses the same directed
   crossings and `stepCostIdx()` as the app; its heuristic is a lower bound on
   edge energy. Unknown-cell risk adds a heuristic `4p/(1-p)` cost multiplier.
4. Split candidates into unseen corridor strips of at most **500 m**, always
   within the flight's 1 km cap. Use the same 15 m-radius footprint and 2 m
   sampling as F4. Corridors are simulated; habitat transit is excluded in both.
5. Replay the walk in each sampled world before and after revealing a strip.
   The walker observes neighbours before entering them and re-plans when a
   discovered hazard intersects its remaining path. Count actual step energy.
   Keep failed runs: they receive an explicit penalty of **4× the initial energy
   budget**. Therefore the objective is a *penalized expected walking cost*, not
   a pure physical-energy prediction or a safety probability. Stop order stays
   fixed within these counterfactuals; the real landing uses F4's full re-plan.
6. Choose the greatest mean paired cost reduction per metre, only above both
   **1 kJ** and **twice its sample standard error**, with no increase in failed
   samples. This is a spread heuristic, not a statistical confidence guarantee.
   Negative gains are not silently discarded. Recompute after each actual
   landing; stop if nothing clears the threshold or three flights are used.

The existing belief model is **not independently calibrated**. Low predicted
benefit and noisy 12-world estimates currently stop every benchmark campaign
before its first flight. The unit test exercises positive strip selection with
an explicitly lower test-only threshold; benchmark/default settings are unchanged.
Do not lower a threshold just to make this table look better.

## Activation and failure behaviour

For development only, open `/scout/?flags=drone_scout,why_flight,voi`.
Selection runs in a Web Worker so the map stays responsive. The panel labels the
experiment and its uncalibrated probabilities. A successful stop leaves any
unscouted ground explicitly labelled; it does not claim the route is clear.
Worker failure or a 60 s timeout falls back to the F4 route selector and says so.
Actual flight discoveries and energy changes remain separate from estimated value.

Promotion requires **every case** to keep the same stops, avoid any increase in
stored hazard crossings or walking energy, retain full coverage wherever F4 has
it, and use no more flight distance. No promotion here: `voi` is absent from the
demo flags. Transit, recharge, daylight, aircraft energy, field clearance and
independent belief calibration remain open. Local compute timings in the JSON
are measurements of this machine; route/value results are seeded and reproducible.
