# The pitch (draft 2, Sat Nov 14)

Five minutes, seven parts, the organizers' format. Test this draft on mentors and judges **today**, then change it. Numbers marked *(to measure)* come from our own runs before Sunday.

## The script

**1. Hook (0:00–0:30)**
> Arizona, 2022. NASA astronauts rehearse a moonwalk with the maps Artemis will actually have. On the very first walk, a slope those maps couldn't show blocks the route, and the walk ends early. That was the Moon, with help seconds away. On Mars, help is 20 minutes away.

**2. Problem (0:30–1:00)**
> NASA has decades of Mars data from orbiters and rovers, but it lives in separate maps built for regions and whole planets, not for one walk. The first Mars crews will need it layered for the exact ground they cross, with science targets, hazards and the way home. And on Mars, a message takes 4 to 22 minutes each way, so the turn-back call has to be made on the spot.

**3. Solution in one sentence (1:00–1:15)**
> **Martian Map turns NASA's Mars data into a science walk you can plan, preview and come home from.**

**4. Demo (1:15–3:00)**
- On the habitat screen: pick "boxwork" on Mount Sharp. Toggle the layers (image, slope, thermal, minerals, radiation); the targets light up.
- The route appears: it goes around a sand patch and a steep slope, longer but safer. Tap a stop: Curiosity's own photo of it.
- A judge takes the phone (the suit display) and walks the hallway. Real steps move the astronaut along the route; the walk-back ring shrinks.
- At the first stop, the science checklist: look, get close, decide, sample. The context card saves where and why.
- The buddy rover scouts ahead and flags rocks the orbital image missed. At the point of no return the phone buzzes red. Mission control answers 20 seconds later: too late, which is the point.

**5. Space data inside (3:00–3:40)**
> Six NASA data sources in one hyperlocal view: HiRISE images and terrain, CTX context, THEMIS thermal inertia to find loose sand, CRISM minerals and the USGS geologic map to find science targets, Curiosity's radiation and weather measurements from this very crater, and Curiosity's photos of each stop. Walking cost comes from a published energy model, the same family NASA's Johnson Space Center calibrates on field traverses. A classifier trained on NASA's AI4Mars labels checks the ground *(accuracy to measure)*.

**6. Impact: who wins, how much (3:40–4:20)**
> NASA ranks moving crews across planetary surfaces #2 of 32 technology gaps, and asks by name for "in-situ decision support tools" for Mars spacewalks. It is spending up to $4.6 billion on rovers that drive with or without crew and up to $3.1 billion on new suits. Nobody is funding the layer between the two: the one that tells the person in the suit what they can still do. That layer protects every surface walk, and every hour of crew time is worth over $130,000.

**7. Team + next (4:20–5:00)**
> One line per person *(names and roles)*. Next: test it with an analog field team, run the same engine for the first crewed Moon landing in 2028, and bring it to people on Earth who walk far from help: firefighters, search and rescue. The first people on Mars will have one chance at each walk. This is the map they should carry.

## Slides (one idea each)

1. Arizona, 2022: NASA's field test, the plan breaking on the first walk.
2. Mars data exists, but not for one walk: separate regional maps versus one layered view.
3. Mars: 4–22 minutes each way; plans break on unseen ground; the crew decides.
4. The one sentence.
5. Live demo: plan (layers, targets, route, rover photos), then walk (phone as suit display).
6. Six NASA data sources, one view: each layer and its job.
7. Why a robot: lead, carry, relay, rescue (field-test evidence).
8. Impact and money: #2 of 32, need 8.06, $4.6B rovers, $3.1B suits, the gap.
9. Team + next. Close on the first Mars crew.

## Questions judges are likely to ask

| Question | Answer |
|---|---|
| Why not just use Mars Trek or MMGIS? | They are built for regional views and for rover teams on Earth. We layer the same NASA data for one crew on one walk, with the science, the hazards and the way home together, and it works with no link to Earth. |
| Astronauts don't use phones. | The phone stands in for the helmet or wrist display. NASA has let astronauts carry their own phones since February 2026, and the phone has the sensors a suit display needs. |
| How do you know where you are without GPS? | Step counting and heading on a terrain map, the same idea as rover visual odometry. In the demo, the steps are real. |
| How accurate is the energy model? | It is a published model (Pandolf) with a simple Mars gravity correction. We show how the ring moves under ±30% model error *(to measure)*. The upgrade path is NASA JSC's field-calibrated model. |
| Why reinforcement learning for the rover? | We compare it with a scripted follower on the same map *(numbers to measure)*. If it is not better, we say so. |
| Why not just use the rover and skip the EVA? | Humans do adaptive science far faster. The robot takes the slow, heavy and risky parts so crew hours go to science. |
| Does wind matter on Mars? | Barely as a force (the air is about 1% as dense as Earth's). The danger is dust, which we model as lost rover power and visibility. |
| What about the Moon? | The same engine with Moon gravity; the first crewed landing is now planned for Artemis IV in 2028. |

## Test it with judges and mentors today

Ask three people, five minutes each:
1. "After hearing this once, what does it do?" (tests the one sentence)
2. "What would make you trust the ring?" (tells us which validation number to show)
3. "Which matters more to you: the buddy rover or the energy model?" (tells us where to spend overnight hours)
4. For the Azure track: "What does Microsoft need to see?"

Write the answers in `docs/pitch-notes.md` and change this draft.
