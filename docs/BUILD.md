# Who builds what, and in what order

The build graph for four people. Each block is one thing someone builds. **Needs** lists the blocks that must be done first; everything else can start right away. The team page draws this table as a graph with one lane per person.

## The team

| Lane | Who | GitHub | Role brief |
|---|---|---|---|
| P1 | **Jules** | `julesrumeautennis-cmd` | `docs/roles/person-1-ml.md` |
| P2 | **Nicolas** | `nicolasrufino` | `docs/roles/person-2-engine.md` |
| P3 | **Galsan** (lead) | `Galsan2005` | `docs/roles/person-3-data-systems.md` |
| PX | Open: joins later, or the fallbacks below | — | `docs/roles/person-x.md` |

Every block's GitHub issue is assigned to its lane's owner and repeats what it needs, what it unlocks and when it is due.

## Why nobody waits

1. **A fake world already exists.** `data/worlds/synthetic/` has every world file: height, slope, ground type, walking cost, cost home from every square, rocks, targets, stops and a route. Everyone builds against it from 9:00 on Saturday.
2. **Real data swaps in later through the same files.** When Person 3 finishes the real Gale slice, the app and the models load it without code changes. Those files are the contract (`docs/CONTRACTS.md`).
3. **Placeholder models exist from hour one.** Person 1 exports shape-correct ONNX files first, so the app can load "a model" before any model is trained.
4. **Every feature sits behind a flag.** If something isn't ready by the freeze, it is switched off and the demo still runs.

## Two worries, answered

- **"Turning the map into 3D will take a while."** It won't. The 3D view is one flat mesh pushed up by the height of each square: about an hour in three.js, and it works on the fake world right away. It is only for people to picture the ground. All route maths runs on the flat grid.
- **"Analysing the map comes after the 3D."** It doesn't wait for it. The analysis (walking cost, cost home from every square, the route) already runs in `data/pipeline/make_world.py`, on the fake world today and on the real slice as soon as it is cut.

**The real long jobs** are cutting and layering the real slice (Person 3), rock detection on real images (Person 1), and the walk itself on a phone (Person 2). They all start at 9:00, in parallel.

## Phases

| Phase | Time | Done when |
|---|---|---|
| M0 Foundation | Sat 9:00–12:30 | Everyone runs on the fake world; placeholder models load; slice chosen |
| M1 Walking core | 12:30–16:00 | Walk, ring and buzz on a phone; real slice with three layers |
| M2 Demo-able | 16:00–21:00 | Plan mode, drone scout, stops, packing list, HUD; deployed link |
| Overnight | to Sun 7:00 | Extra layers, map grows, buddy rover, numbers, project page |
| Freeze | Sun 8:00 to submit | Fixes only, rehearse, video, submit |

## The blocks

| ID | Block | Who | When | What you build | Needs | Issue |
|---|---|---|---|---|---|---|
| R1 | Rock detector v0 | P1 | M0 | Find rocks from their shadows on one downloaded 25 cm USGS tile of Gale; hand-check 50 rocks | — | #31 |
| R2 | Placeholder models | P1 | M0 | Shape-correct `terrain_cls.onnx` and `buddy_policy.onnx` and the check script, so the app can load models now | — | #5 |
| R3 | Rocks for our slice | P1 | M1 | Run the detector on the real slice and write `rocks_fine.u8`; report agreement with the hand-checked rocks | R1, D1 | #31 |
| R4 | Ground classifier | P1 | M2 | Soil, bedrock, sand, big rock from AI4Mars labels; tested on Perseverance photos; exported to ONNX | R2 | #6 |
| R5 | Numbers for the pitch | P1 | Overnight | Rocks avoided by the scouted route versus orbit only; margin home along the route; ring change if energy is off by ±30% | R3, D4 | #15 |
| R7 | CAPCOM agent on Azure | P1 | Overnight | Microsoft Foundry agent playing mission control, answering through a 20-second delay; tools read the app state. Needed for Best Use of Technology | E2 | #42 |
| R6 | Buddy rover RL (stretch) | P1 | Overnight | Grid environment and a PPO "lead" policy, compared with the scripted rover | R2, D2 | #4, #7 |
| E1 | App, 3D view and minimap | P2 | M0 | three.js app that loads the world files; 3D terrain from the height grid; flat minimap coloured by layer | — | #8, #9 |
| E2 | Walking core | P2 | M1 | Move along the route; energy and oxygen drain; walk-back ring from the cost home; point-of-no-return buzz; works on a phone | E1 | #10 |
| E3 | Plan mode | P2 | M1 | Layer toggles, targets, the route and stop previews on the habitat screen | E1 | #21 |
| E4 | Drone scout | P2 | M2 | Flight along the scout plan; scan sweep (rays hit the terrain, dots build up); reveal full detail and rocks; re-plan | E3, D4 | #25 |
| E5 | Why this route | P2 | M2 | Panel: cost per stretch, the rejected alternative, slope, rocks, sand, margin home | E4 | #33 |
| E6 | Stops and step mode | P2 | M2 | Science checklist and sample card at each stop; real steps and heading move the astronaut; writes the walk log | E2 | #22, #11 |
| E7 | Buddy rover and override | P2 | Overnight | Scripted lead, heel and return along the breadcrumb path; override ladder | E2 | #12 |
| E8 | Export the map | P2 | Overnight | Map package and GeoJSON for mission control, "arriving" after the delay | E4 | #34 |
| D1 | Pick and cut the slice | P3 | M0 | Choose the 2 × 2 km box in Mars Trek (boxwork, sand, a slope over 15°, a hidden rock field); cut the USGS 1 m terrain and 25 cm images; make the 8 m orbit view | — | #13 |
| D2 | Real world files | P3 | M1 | Run the pipeline on the slice: slope, walking cost, cost home from every square; add sand (THEMIS) and science (CRISM, local geologic map) | D1 | #13 |
| D3 | Targets, stops, first route | P3 | M2 | Boxwork targets; Curiosity photos at each stop; the rough route on the orbit view | D2 | #20 |
| D4 | Scout plan | P3 | M2 | `scout_plan.json`: route strip first, then anomalies, then the least certain squares | D3 | #32 |
| D5 | Deploy on Azure | P3 | M2 | A public link on Azure Static Web Apps that a stranger's phone can open; Azure makes us eligible for Best Use of Technology | E2 | #14 |
| D6 | All eight data types | P3 | Overnight | Radiation (RAD) and weather (REMS) for the slice; chemical (ChemCam, APXS) and geophysical (DAN) as points along Curiosity's path | D2 | #40 |
| D7 | The map grows | P3 | Overnight | Merge walk logs (photos, ground type, real effort, markers) back into the site files | E6 | #27 |
| X1 | Helmet HUD view | PX | M2 | The walk as a heads-up display: ring, heading, next stop, alerts only; same state as the tablet minimap | E2 | #41 |
| X2 | Packing list | PX | M2 | What to bring and its weight from the route; heavy items go to the rover | D3 | #26 |
| X3 | Test the pitch | PX | M2 | Three mentors or judges, three questions each; log the answers | — | #16 |
| X4 | Before/after and project page | PX | Overnight | Today's tools versus Martian Map as a screen; the project page with every dataset, the numbers and the limits | R5 | #17 |
| F1 | Numbers into the slides | P1 | Freeze | Final numbers on the proof slide | R5 | #45 |
| F2 | Fixes only | P2 | Freeze | Switch off anything unstable; rehearse the demo walk | E4, E6 | #46 |
| F3 | Final deploy | P3 | Freeze | Last deploy; check the link on three phones | D5 | #47 |
| F4 | Video and submit | PX | Freeze | 30-second video; submit the project page | X4 | #48 |

## Person X arrives later

Nothing waits on Person X. Their blocks (HUD, packing list, pitch tests, project page) all build on work that already exists. Until they arrive, Galsan holds the pitch notes, and Nicolas can show the walk on the tablet view alone.

**If nobody has joined by M2 (Sat 21:00), these fallbacks apply:**

| Block | Falls to | Why |
|---|---|---|
| X1 Helmet HUD view | Nicolas | It is a second layout of the walk he builds |
| X2 Packing list | Galsan | It is rules on the route data he owns |
| X3 Test the pitch | Whoever is free at dinner | Ten minutes per mentor |
| X4 Project page, F4 video and submit | Galsan and Nicolas at the freeze | Galsan writes, Nicolas records the demo |

This makes Galsan's lane the heaviest overnight. If he falls behind, cut D6 to radiation and weather only.

## How to use this

1. Find your lane, take the first block whose **Needs** are done, and open its issue.
2. Work against the fake world until the real files land.
3. When you finish a block, close its issue and tell the people whose blocks list it under **Needs**.
4. A new idea gets graded in `docs/CRITIQUE.md` first, then becomes a block here.
