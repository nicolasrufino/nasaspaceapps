# The pitch (draft 3, Sat Nov 14)

Five minutes, the organizers' seven parts. One argument runs through it: **there is no map at the scale of one walk; every option today fails on its own; ours combines pieces NASA has already proven, and we show it working.** Numbers marked *(to measure)* come from our own runs before Sunday.

## The argument in one breath

> There is no map at the scale of one Mars walk. Orbit misses the rocks, mission control is 20 minutes away, rovers are too slow to scout ahead, and walking in blind breaks the plan. Martian Map makes the map: orbit gives the base, a scout drone flies the route first, the device plans the path and the packing list, and every walk makes the map better. Each piece is already proven at NASA. We put them in the crew's hands.

## The script

**1. Hook (0:00–0:30)**
> Arizona, 2022. NASA astronauts rehearse a moonwalk with the maps Artemis will actually have. On the first walk, a slope those maps couldn't show blocks the route, and the walk ends early. That was the Moon, with help seconds away. On Mars, help is 20 minutes away.

**2. Problem (0:30–1:00)**
> NASA has decades of Mars data, but no map at the scale of one walk. Orbit misses rocks under a metre. Mission control can't guide you through a 20-minute delay. A rover scouting ahead moves at about 110 metres an hour, far slower than you walk. And exploring by eye is how plans break.

**3. Solution in one sentence and the five stages (1:00–1:45)**
> **Martian Map turns NASA's Mars data into a science walk you can plan, preview and come home from, and makes the map better with every walk.**

> We build the map in five stages, coarse to fine; each one tells the next where to look. **Orbit** first: it's the only data covering the whole site before anyone lands, and NASA already collected it. It shows where the science is and where not to go. But it can't see a knee-high rock or soft sand, so a **scout drone** flies the route first, the way Ingenuity scouted for Perseverance. Then we **plan and pack** before leaving, because Earth is up to 22 minutes away. On the **walk**, the suit display keeps the way home known, and every step adds detail. The **next walk** starts from a better map. For each of NASA's five objectives, today's tools do one stage; we connect all five.

**4. Demo (1:45–3:00)**
- Habitat screen, a random spot inside Gale crater, goal "boxwork". Orbit-only map and a first route.
- Deploy the scout drone. It flies Ingenuity-sized legs along the route, then where it is least sure. Where it flies, the map sharpens: real full-resolution HiRISE terrain and detected rocks. A hidden rock field appears.
- The route re-plans. "Why this route": +120 m, less effort, avoids the rock field, never steeper than the limit, home reachable everywhere *(numbers to measure)*. The packing list moves the drill to the rover.
- A judge carries the phone (the suit display). Real steps move the astronaut; the ring of "can still get home" shrinks. At a stop, the science checklist runs. Past the point of no return, it buzzes.
- Export the map: mission control gets it 11 minutes later.

**5. Space data inside, and proof (3:00–3:40)**
> Six NASA data sources in one view: HiRISE images and terrain, THEMIS for loose sand, CRISM and the USGS map for science targets, and Curiosity's radiation and weather measured in this crater. And every piece is already proven at NASA. Shadow-based rock detection on HiRISE chose or checked the Phoenix, Gale, Jezero and InSight landing sites. Ingenuity scouted Perseverance's routes. Perseverance plans its own safe path. Walkback limits keep crews safe today. What's new is putting them together for the person on foot.

**6. Impact: why it wins, who wins, how much (3:40–4:20)**
> Side by side: orbit alone misses hazards; voice guidance fails with delay; rovers are too slow; walking blind breaks plans. Only the combination works, and it runs on the crew's side of the delay. NASA ranks surface mobility #2 of its 32 technology gaps and asks by name for "in-situ decision support tools" for Mars walks. It funds the rover (up to $4.6B) and the suit (up to $3.1B); nobody funds the map between them.

**7. Team + next (4:20–5:00)**
> Jules built the vision models and the Azure mission-control agent; Nicolas built the app and the 3D map; Galsan built the data pipeline from NASA's missions. *(Adjust to what each person actually shipped.)* Next: real drone imagery from an analog field test, the same engine for the first crewed Moon landing in 2028, and people on Earth who walk far from help. The first people on Mars will get one chance at each walk. This is the map they should carry.

## Slides (in order)

1. Arizona, 2022 (hook)
2. There is no map at the scale of one walk (problem)
3. On Mars, help is 4–22 minutes away (stakes)
4. The one sentence
5. Coarse to fine: the five stages and why each exists
6. NASA's objectives, one by one: today's tools versus ours
7. Live demo
8. Six NASA data sources, one view
9. Proof: every piece is already proven at NASA
10. Why this beats every option on its own (comparison table)
11. Impact and money
12. Team + next
13. *(Backup)* Why a robot: lead, carry, relay, rescue
14. *(Backup)* The five NASA resources and how we use each

## Local awards (Chicago)

The four local categories, how well we fit each, and what to show. Grades are in `docs/CRITIQUE.md`.

| Award | What the judges look for | Our fit | What we show | Verdict |
|---|---|---|---|---|
| **Best Use of Science** | The best and most valid use of science or the scientific method | **Strongest.** Eight types of NASA data, a science goal driving every walk, and claims we test | Every layer named with its mission; predictions checked against measurements (rock detector against hand-checked rocks, held-out classifier accuracy, the ring under ±30% energy error, predicted versus measured effort from walk logs); simulated parts labelled | **Main target.** Lead the pitch with it |
| **Best Use of Technology** | The most innovative use of technology. **Must use Microsoft Azure** | Good, **only if Azure is real** | App hosted on Azure Static Web Apps (#14); CAPCOM agent on Microsoft Foundry answering through the delay (#42); vision models running in the browser; the drone's scan sweep | **Second target.** #14 and #42 are now required, not optional |
| **Art & Technology** | Technical and creative skills combined | Good | 3D terrain, the scan sweep, the helmet HUD, the before/after screen | **Third.** Comes from polish, no extra features |
| **Global Connection** | Connecting people around the world through technology | Weak | One line: the map exports as GeoJSON that any crew, scientist or mission control can open, and the viewer is a public link | **Don't chase it.** Nothing extra to build |

**One line per award, if asked:**
- *Science:* "Every claim on screen is a measurement from a NASA instrument or a number our code tested."
- *Technology:* "The map runs on Azure, and mission control is an AI agent on Microsoft Foundry that answers 20 minutes late, so the crew's device has to decide."
- *Art & Technology:* "A drone that sees like a bat, but with light, and a helmet display you can read while walking."

## Questions judges are likely to ask

| Question | Answer |
|---|---|
| Why not just use Mars Trek or MMGIS? | They are built for regional views and for rover teams on Earth. We layer the same data for one crew on one walk, with the science, hazards and the way home together, and it works with no link to Earth. |
| Is the drone real? | The flight is simulated; the data it reveals is real full-resolution HiRISE. Ingenuity proved the scouting job on Mars; JPL's Skyfall concept proposes scout helicopters for human landing sites. |
| How do you detect rocks? | From their shadows in HiRISE images, the method NASA used to check landing sites. We report agreement with hand-checked rocks *(to measure)*. |
| How accurate is the energy model? | A published walking model with a simple Mars-gravity correction; we show how the ring moves if it is off by ±30% *(to measure)*. The upgrade path is NASA's field-calibrated model. |
| Astronauts don't use phones. | The phone stands in for the helmet or wrist display. NASA has let astronauts carry their own phones since February 2026. |
| What about the Moon? | The same engine with Moon gravity; the first crewed landing is planned for 2028. |

## Test it with judges and mentors today

Ask three people, five minutes each:
1. "After hearing this once, what does it do?" (tests the one sentence)
2. "Which part convinced you it works?" (tells us which proof to lead with)
3. "What would make you doubt the route?" (tells us which number to show)
4. For Best Use of Technology: "Is hosting plus a Foundry agent enough Azure, or do you expect more?"

Write the answers in `docs/pitch-notes.md` and change this draft.
