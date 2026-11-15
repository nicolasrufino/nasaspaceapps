# A day on Mars: how scouting and the walk fit together

How the helicopters, the planner and the crew share time, hour by hour. Decided by Nicolas on 2026-11-15 (`docs/DECISIONS.md`); evidence in `docs/DECISION-BRIEFS.md` §7–8.

## Words first

- **Sol:** one day on Mars, sunrise to sunrise: **24 h 39 min 35 s** of Earth time. NASA rounds it to 24 h 40 min for crew timelines ([NASA HEOMD-415](https://ntrs.nasa.gov/api/citations/20220000589/downloads/MarsSAC21SurfaceOps_2022-Jan_Version%201%20FINAL_update.pdf) §4.1). "Sol 1, Sol 2" just means "day 1, day 2".
- **Mars local time:** the crew's clock runs on the Sun at their site, in AM/PM like ours. Noon is when the Sun is highest. Each Mars "hour" is 1 h 1.6 min of Earth time.
- **Walk:** the astronauts' trip outside on foot (NASA says "EVA", extravehicular activity).
- **Strip:** the ground one helicopter flight photographs.

## Three rules everything follows

1. **Crew:** "at least one non-EVA sol between EVAs wherever possible." Each sol has at least 8.5 h of sleep, 1.5 h morning routine, 1 h midday meal, 2 h evening, and exercise (2.5 h on non-walk sols, 1 h on walk sols). That leaves 8.5 h of work ([HEOMD-415](https://ntrs.nasa.gov/api/citations/20220000589/downloads/MarsSAC21SurfaceOps_2022-Jan_Version%201%20FINAL_update.pdf) §4.1–4.2).
2. **Helicopters:** each SkyFall helicopter flies about 1–2 km and 2.5 minutes on a flight sol, then spends one sol on the ground to recharge ([SkyFall Mission Information Package, Sept 2026](https://science.nasa.gov/wp-content/uploads/2026/09/skyfall-mission-information-package-final.pdf) §II). They need daylight because they navigate with cameras ([NASA](https://science.nasa.gov/blog/when-should-ingenuity-fly/)).
3. **Walk:** only while the Sun is at least 15° up, so shadows don't hide rocks (brief §8), and at most 8 h (suit sizing).

**Rules 1 and 2 fit together:** the crew rests every other sol and the helicopters recharge every other sol. So **the helicopters fly on the crew's rest sol, and recharge on the walk sol.**

## Sun at Gale (4.8° S)

Computed from the latitude and the Sun's seasonal swing of ±25°; to be checked with the Mars24 algorithm (Allison & McEwen 2000) when the sun model is built.

| | Earliest | Latest |
|---|---|---|
| Sunrise | 5:51 AM | 6:09 AM |
| Sun reaches 15° (walk may start) | 6:57 AM | 7:16 AM |
| Sun drops below 15° (walk must be over) | 4:44 PM | 5:03 PM |
| Sunset | 5:51 PM | 6:09 PM |

## Sol 1: scouting sol (no walk)

| Time | What happens | Who |
|---|---|---|
| 5:30 AM | Wake; morning routine until 7:00 | Crew |
| ~6:00 AM | Sunrise. Helicopters are charged and warm in the habitat dock. They can't fly yet: too dark to navigate, and the low Sun's long shadows hide rocks | — |
| 7:00–9:30 AM | Crew picks tomorrow's science stops on the 2D map. The planner proposes flights, each with its reason (safer, more science, or easier). Crew approves; wind check | Crew + app |
| **9:30 AM** | **All 3 helicopters fly one strip each.** About 2.5 min in the air per flight (Ingenuity's earliest documented slot was 9:30 AM) | Helicopters |
| ~9:45 AM | All down. SkyFall sends data by UHF to an orbiter during its recharge sol (about 100–400 Mbit between flights; [NASA SkyFall package](https://science.nasa.gov/wp-content/uploads/2026/09/skyfall-mission-information-package-final.pdf) §II), not by cable at a habitat dock. The immediate processing below is our demo assumption | Helicopters + orbiter |
| 9:45–11:30 AM | Processing: 3D terrain from the photos, rocks and ground type, belief map updated, routes re-planned | App |
| 11:30 AM–12:30 PM | Midday meal | Crew |
| (12:15 PM) | (Optional second wave, **only with habitat charging**, which is our assumption, not SkyFall's design) | Helicopters |
| 12:30–2:30 PM | Final route plus alternatives; what was not scouted is marked | App |
| 2:30–4:00 PM | **Crew review:** route, why each flight flew, the walk-back ring, time at each stop | Crew |
| 4:00–7:00 PM | Packing list, suit checkout, exercise | Crew |
| 7:00–9:00 PM | Evening; sleep at 9:00 PM | Crew |

## Sol 2: walk sol (helicopters recharge)

| Time | What happens |
|---|---|
| 5:30 AM | Wake; morning routine |
| 7:00 AM | Into the suits through the suitport. NASA's goal is pre-walk prep "from hours to less than thirty minutes" ([NTRS 20120011640](https://ntrs.nasa.gov/citations/20120011640)) |
| **~7:15 AM** | **Walk starts** once the Sun is 15° up |
| During | Up to about 6.5–8 h outside. NASA's example sols split this with a midday meal back inside (e.g. 2.5 h + 4 h, HEOMD-415 §5.2) |
| **By ~3:15 PM** | Back inside. Hard limit: before the Sun drops under 15° (~4:45 PM) |
| Afternoon | Debrief; the walk log is merged into the map; exercise 1 h |

## Why not the same sol?

- With the second wave, the plan is ready about 2:30 PM. Suit-up takes it to about 3:00 PM, and the walker must be back by about 4:45 PM: **under 2 hours of walking**.
- With one wave only, about 5 hours of walking. That is possible for a short walk, but it cuts the crew review and breaks NASA's rest-sol rule.
- `docs/PRODUCT.md` already puts the habitat display on "the sol before".

## How many flights per walk: 3, tested

**Decided: 3 flights per walk** (each helicopter once, on the scouting sol). Up to 6 only with habitat charging, labelled as our assumption.

**Arithmetic** (`app/scripts/flight-budget-check.mjs`, results in `.json`):
- **Speed:** a 2.5 min flight of 700 m needs 4.7 m/s on average; 1 km needs 6.7 m/s; 2 km needs 13.3 m/s.
- Ingenuity's best whole-flight average was 4.2 m/s (704 m in 169.5 s) and its top speed 10 m/s ([NASA, Flight 62](https://science.nasa.gov/blog/flight-62-preview-by-the-numbers)). So **700 m is what has flown**. SkyFall's 1–2 km is NASA's design expectation; 2 km is faster than any Ingenuity flight.
- **Cadence:** helicopters fly every other sol and walks happen every other sol, so each helicopter flies once per walk: 3 helicopters = 3 flights.
- **Time:** 3 × 2.5 min = 7.5 min of flying, far inside the 9:30 AM–1 PM window.
- **In the app:** `FLIGHT_M` is 1,000 m, the selected SkyFall scenario limit. R5 was regenerated in the same change; the Gale result below is the same at 700 m and 1 km. The stored extra flights are unchanged.
- **Reach:** every Gale stop is within 354 m of the habitat. A flight that must return to the dock needs at least 708 m. That is just over Ingenuity's 700 m, but well inside SkyFall's 1 km.

**Test on the Gale world** (HiRISE terrain, the 20° limit, walk-scale crossings, and 1,143 hazard cells including Jules's 23 reviewed rocks). Fly the next unseen stretch of the route, re-plan around what was found, repeat:

| Flights | Route's hidden hazards left | Energy | Versus knowing every rock |
|---|---|---|---|
| None | **8 hazard cells** on the route | 621 kJ (looks cheaper only because it doesn't know the rocks are there) | — |
| **3 × 700 m** | **0** | 630.5 kJ | **identical** |
| 3 × 1,500 m | 0 (2 flights were enough) | 630.5 kJ | identical |
| 6 × 700 m | 0 (4 used) | 630.5 kJ | identical |
| Knowing every rock | 0 | 630.5 kJ | — |

**Limits of this test, said plainly:**
- It is one site, one five-stop walk, and our hazard map (DTM estimates plus reviewed rocks), not ground truth.
- The flights only follow the current route; the value-of-information planner is not built yet.
- A longer walk, farther from base, will need more flights; the benchmark across many generated worlds is still to do.
