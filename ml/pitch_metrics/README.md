# R5: reproducible pitch evidence

Run `node ml/pitch_metrics/run.mjs` to regenerate `ml/exports/pitch_metrics.json` and `PITCH_NUMBERS.md`; `--check` verifies them. `pytest` runs the semantics tests and exact regeneration check.

The fixed Gale worst-budget scenario uses the shipped app planner, energy model and F4 scout state machine: at most three 1 km corridor flights, selecting the next unseen stretch of the current route and re-planning after every landing. No `scout_plan.json` extras are loaded. Every 2 m and both endpoints are scanned; 30/60/120 fps and direct spatial replays agree.

The `repeated_scout` report key remains for readers, but each `passes` entry now means one flight and one re-plan in a single capped campaign. `after_scout` is its final route. Hazard counts distinguish unique 8 m cells from repeated visits and individually reviewed rocks. Full-layer intersections are an offline audit, not information available to the flight selector.

Margin is energy left minus the directed cost home with discovered hazards minus the fixed reserve. The independent return-cost audit reverses the crossing directions and uphill/downhill energy. The app's hybrid return lookup is measured separately. Extra 20% means 20% of the initial budget beyond return and reserve; traverse shares are distance weighted. The +/-30% stress test scales both spent walking cost and the remaining return cost. It is a chosen scenario, not a confidence interval.

Flight energy, repositioning, recharge, communication and daylight scheduling are excluded. A fully scanned route with zero stored hazards is not field-safety certification. R3 proposals are positive review, not detector precision/recall; rover-photo classification is separate and did not create the route layers. No model is retrained by R5.
