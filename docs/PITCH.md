# The pitch (draft 1, Sat Nov 14)

Five minutes, seven parts, the organizers' format. Test this draft on mentors and judges **today**, then change it. Numbers marked *(to measure)* come from our own runs before Sunday.

## The script

**1. Hook (0:00–0:30)**
> February 6, 1971. Two Apollo 14 astronauts climb toward the rim of Cone Crater, dragging a cart, 15 minutes behind schedule, hearts racing. Every ridge looks like the rim. They turn back. Decades later, orbital photos show they were about 40 metres away.

**2. Problem (0:30–1:00)**
> NASA plans every moonwalk around one question: if something breaks, can you still get home? It works it out on Earth, on paper map books, before the walk. On Mars that stops working. A message takes 4 to 22 minutes each way, so nobody on Earth can make the turn-back call. In NASA's own field tests, plans broke on the first walk, when slopes the maps couldn't show blocked the route.

**3. Solution in one sentence (1:00–1:15)**
> **Martian Map tells you, step by step, how far you can still walk on Mars and make it home.**

**4. Demo (1:15–3:00)**
- A judge holds the phone and walks the hallway. Their real steps move the astronaut across real Mars terrain.
- The cyan area is the walk-back ring: everywhere they can still reach and get home with the reserve. It shrinks with every step; sand costs more than rock.
- The buddy rover drives ahead, scouting, the way NASA's 2022 desert tests found crews prefer.
- At the point of no return the phone buzzes and turns red. "Turn back now."
- Twenty seconds later, mission control answers. Too late to help, which is the point.

**5. Space data inside (3:00–3:40)**
> Real Mars terrain from NASA's Mars Trek and HiRISE, terrain units from the USGS-NASA geologic map, a terrain classifier trained on NASA's AI4Mars labels and run on Perseverance images *(accuracy to measure)*, and a published walking-energy model, the same family NASA's Johnson Space Center calibrates on field traverses. Every step's cost turns into oxygen used.

**6. Impact: who wins, how much (3:40–4:20)**
> NASA ranks moving crews across planetary surfaces #2 of 32 technology gaps, and asks by name for "in-situ decision support tools" for Mars spacewalks. It is spending up to $4.6 billion on rovers that drive with or without crew and up to $3.1 billion on new suits. Nobody is funding the layer between the two: the one that tells the person in the suit what they can still do. That layer protects every surface walk, and every hour of crew time is worth over $130,000.

**7. Team + next (4:20–5:00)**
> One line per person *(names and roles)*. Next: calibrate with real walking data from an analog field test, run the same engine for the Moon in 2028, and bring it to people on Earth who walk far from help: firefighters, search and rescue. Apollo 14 turned back 40 metres short. With this, they would have known.

## Slides (one idea each)

1. Black slide, the date: *February 6, 1971*. Photo of Cone Crater from orbit.
2. "Can you still get home?" NASA's walkback and rideback limits, on paper.
3. Mars: 4–22 minutes each way. The turn-back call has to be made on the spot.
4. The one sentence.
5. Live demo (phone mirrored on the screen).
6. Data pipeline: NASA datasets → our model → what the astronaut sees.
7. Why a robot: lead, carry, relay, rescue (field-test evidence).
8. Impact and money: #2 of 32, need 8.06, $4.6B rovers, $3.1B suits, the gap.
9. Team + next. Back to Apollo 14.

## Questions judges are likely to ask

| Question | Answer |
|---|---|
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
