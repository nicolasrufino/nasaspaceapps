# R5: reproducible numbers for the pitch

Issue #15; needs R3 (#31) and D4 (#32), both delivered. Supplies F1 (#45)
and X4 (#17). No app feature, world layer, trained model or contract is changed.

Run with Node.js 24, without additional npm packages:

```sh
node ml/pitch_metrics/run.mjs
node --test ml/pitch_metrics/metrics.test.mjs
node ml/pitch_metrics/run.mjs --check
python -m pytest -q
```

The first command regenerates `ml/exports/pitch_metrics.json` and
[PITCH_NUMBERS.md](PITCH_NUMBERS.md). The check fails if either is stale.
The Python suite runs both Node checks; CI explicitly installs Node 24.
The source manifest hashes the world, relevant app code and vision evidence.
JSON hashes use sorted-key semantics; source hashes normalize Windows CRLF.
Binary hashes use the exact bytes, including the R3 layer and positive mask.

## Measured scenario and definitions

The PR #94 Gale world rebuilt at 20°, all five default science stops, and its default `worst`
energy scenario: 3,165.180 kJ initial walking energy and a 60% reserve
(1,899.108 kJ). This assumes 5 h of suit time left after 3 h of station work,
deducts 2.5 h for science stops, and reserves 1.5 h at the scenario sizing rate.
These are scenario assumptions, not measured Mars EVA endurance. The separate
`ideal` scenario is not the basis of these pitch results. The current app's `planTour`, `stepCost`,
`routeFlights`, `pointAlong` and `scanAt` are reused directly. The old static
`route.json` is not substituted for the route actually selected by the app.

The primary replay follows `main.js`'s first scout pass at fixed 60 fps.
Checks at 30 fps, 120 fps and fixed spatial intervals expose frame sampling
effects. The spatial variant includes endpoints and is labelled separately.
The repeated-scout audit preserves accumulated observations, uses the new route
for each pass, and stops when all route vertices have been scanned and the
route has zero intersections with the stored hazard layer (maximum 10 passes).
This is a simulated layer audit, not completeness of actual Martian hazards.

Hazard counts distinguish unique grid cells from repeated route visits.
The reviewed-rock padding is reconstructed from R3's accepted points and hash
checked; crossings and discoveries of that subset are reported separately.
The default traverse's obstacle benefit must not be attributed to the trained
terrain classifier or to individually hand-validated rocks.

Margin = energy left − cheapest return with discovered hazards − fixed reserve.
“Extra 20% margin” means at least 20% of the **initial budget**, in addition to
the reserve. The fraction of the traverse is weighted by distance, with linear
interpolation between grid vertices; stopped science work is not counted.
Return costs are independently recomputed with directed reverse shortest paths,
including reversed `passable.u8` crossings. That layer is pinned in the source manifest.
The current app's hybrid cost lookup is also measured, not silently replaced.

The ±30% stress test multiplies both energy already spent and the remaining
walking cost by 0.7 or 1.3. Budget, reserve, stop set and route stay fixed.
This is a chosen model-error scenario, not a measured uncertainty interval.
Ring area is the number of return-feasible grid cells times 64 m²; it is not a
radius and does not prove that a new outward trip to every such cell is feasible.

## Interpretation and remaining engineering work

The first pass avoids the discovered obstacles but can route around them into
unobserved cells. Its residual full-layer crossings are explicitly reported;
do not describe that first replan as completely cleared. Repeated scouting
quantifies the extra work with the app as it currently exists. Flight energy,
battery recharge, communication delay, and actual human exertion are outside
this walking-energy simulation. The budget already deducts estimated time at
science stops; the route profile does not simulate effort during those stops.
The 14 simulated flight legs are not a feasible single-campaign claim: the
proposed flight-count and daylight limits in `docs/DECISION-BRIEFS.md` §7–8
are not enforced by this replay.

The report also records the difference between the displayed per-cell hybrid
return lookup and an exact return field for discovered hazards. A globally
consistent live return map and frame-independent scout sampling are possible
engine follow-ups, not changes hidden inside this measurement block.

Existing vision numbers are copied with provenance and checked against their
confusion matrices: the small Curiosity test, the weaker Perseverance transfer
test, and the untrained buddy placeholder are all shown. R3 proposal acceptance
is not recast as precision/recall. No network is retrained by R5.
