# Martian Map: the whole plan

One document, read top to bottom: what NASA asked for, what we build, how every part answers the challenge, and how we build it. Evidence for every claim is in `docs/RESEARCH.md`.

## 0. On one page

- **The problem today:** NASA's Mars data lives in separate tools built for rover teams and regional views (Mars Trek, MMGIS). Nothing layers it for one crew on one walk, with the science, the hazards and the way home together. On Mars, help is 4 to 22 minutes away.
- **The challenge:** a layered, integrated map of one place on Mars, built from several NASA missions, that helps an astronaut plan and carry out a Marswalk safely while doing new science.
- **Our answer:** **Martian Map turns NASA's Mars data into a science walk you can plan, preview and come home from.**
- **Where and why:** the boxwork ridges on Mount Sharp, Gale crater. NASA's challenge names them; Curiosity studied them in 2025; and Curiosity measured the radiation, weather and ground there, so one site gives us every layer. *(Alternative: Jezero, with Perseverance's images. The team decides.)*
- **How it works:** the crew picks the science targets; Martian Map layers the data, plans the safest efficient walk, shows what each stop will look like from the ground, and keeps the walk-back limit live on the suit display while a buddy rover scouts ahead.
- **The demo:** pick "boxwork" → the layers light up the targets → a route appears with rover photos of each stop → a judge walks the hallway with the phone as the suit display → the ring shrinks with every step → at a stop the phone runs the science checklist → past the point of no return it buzzes.

## 1. The challenge, exactly

What NASA's statement asks (Space Apps 2026, *Interplanetary Survival Guide: Martian Map*):

| # | Requirement | NASA's words (short) |
|---|---|---|
| R1 | A layered, integrated view of a location or route on Mars from several NASA missions | "pulls together data from multiple NASA science missions" |
| R2 | Start from a science goal and a site | "if you chose ... boxwork formations ... the Mount Sharp region" |
| R3 | At least three kinds of data, layered for navigation context | "optical, thermal, spectral, topographic, geophysical, atmospheric, radiation, chemical" |
| R4 | Safety first: space weather and radiation, suit mobility and loads, a route that avoids obstacles | "NASA's first priority is always astronaut safety" |
| R5 | Hyperlocal, unlike Mars Trek's regional and global views | "the hyperlocalized areas astronauts will target on individual spacewalks" |

Optional considerations:

| # | Consideration | What we do with it |
|---|---|---|
| C1 | Habitat display, tablet, or helmet HUD | Plan mode on the habitat display; walk mode on the phone as the suit display |
| C2 | Static map, interactive product, or a tool that generates maps | A tool: the same pipeline builds the layered map for any site |
| C3 | Learn from maps for other destinations | NASA's Artemis EVA rules and map books (AEGIS) and rover operations maps (MMGIS) shape our plan and safety rules |
| C4 | Past, predicted or no time frame | Stable layers (terrain, minerals) plus a time layer (space weather, dust) |
| C5 | Rover point-of-view images so the astronaut knows what to expect | Curiosity's own photos pinned to each stop |
| C6 | Rovers carrying crew and tools; astronauts in pairs | A buddy rover that scouts and carries; a two-person walk |

## 2. What we build

**Who uses it:** a two-person Mars crew, the night before and during a surface walk, with Earth 4 to 22 minutes away.

**Four modes, one mission** (the same steps Perseverance follows: choose a target, travel safely, investigate, decide what to keep):

| Mode | Where | What happens |
|---|---|---|
| **1. Plan** | Habitat display | Pick a science goal. Layers highlight candidate targets. Martian Map plans a safe, efficient route, estimates time, energy, oxygen and radiation, and shows rover photos of every stop. The crew approves or edits. |
| **2. Walk** | Phone as the suit display | Real steps move you along the route. The walk-back ring shows how far you can still go and get home. The buddy rover scouts ahead and updates the local map. Hazards and space-weather alerts appear when they matter. |
| **3. At the stop** | Phone | A short science checklist: look, get close, decide, sample or move on. Each sample gets a context card: place, layers, photo, time. Examine many targets, sample few. |
| **4. Debrief** | Habitat display | Replay the walk; predicted versus measured; what the crew saw updates the map for the next walk. |

**Who decides what** (taken from how Perseverance works): people choose the destinations; the system chooses how to get there safely; at each stop the astronaut decides what science to do. On Mars nobody on Earth can make these calls in time, so the crew is the science team on site.

**Training, too.** Months before, crews rehearse the same walk on Earth: in the game on real terrain, and in an analog field site with the phone in walk mode, while instructors inject failures (a dust storm, a suit leak that cuts the budget). Every logged walk improves the walking-energy model.

**Is a phone realistic?** It stands in for the suit display (NASA's SUITS program builds helmet displays). NASA has let astronauts carry their own smartphones since February 2026 (Crew-12, Artemis II). With no GPS on Mars, position comes from counting steps and heading on the map, which is exactly what walk mode does.

**"Optimal" means safe and efficient, not shortest.** A straight line may cross loose sand or a slope a suited astronaut can't climb. A longer route that stays on firm ground and keeps the way home open is the better route, and the map shows why.

## 3. How every part answers the challenge

| Requirement | Feature | Technology | NASA data |
|---|---|---|---|
| R1, R5 | One hyperlocal layered map of the site (about 1–2 km across, 2–5 m cells) | Python data pipeline (`data/pipeline/`) writes shared layer files; the app draws them | HiRISE, CTX, THEMIS, CRISM, USGS, Curiosity RAD and REMS |
| R2 | Science goal → candidate targets | Target layer from mineral and geologic data; crew picks targets | CRISM minerals, USGS geologic units, Curiosity's 2025 boxwork observations |
| R3 | At least three data types, toggled as layers | Layer stack in the app; each layer has a source and a date | Optical (HiRISE), topographic (HiRISE DTM), thermal (THEMIS thermal inertia), spectral (CRISM), radiation and atmosphere (RAD, REMS, DONKI) |
| R4 obstacles | Route that avoids steep slopes, large rocks and loose sand | Cost map plus path search (Dijkstra/A*); hazard masks | Slope from the DTM; rocks from HiRISE; sand from thermal inertia and the terrain classifier |
| R4 mobility | Walking cost includes suit, load and Mars gravity | Published walking-energy model (Pandolf, then NASA JSC's field model) | Suit and load values from NASA studies |
| R4 safety limit | Walk-back ring and point-of-no-return alert | Energy needed to get home from every cell, precomputed; energy converted to oxygen | Same layers; NASA's walkback and 1-hour return rules |
| R4 radiation | Dose for the walk; storm alert with minutes to shelter | Dose rate from RAD; shielding from terrain; live or replayed solar events | Curiosity RAD; DONKI |
| C5 | Rover photos at each stop | Stops pinned to geotagged rover images | Curiosity Mastcam and Navcam raw images |
| C6 | Buddy rover scouts and carries | Reinforcement-learning policy on the same map, compared with a scripted follower; AutoNav-like loop | Same layers |
| C1 | Habitat display and suit display | Game engine on the phone (Babylon.js or Unity) | |
| Ground truth | What the crew sees corrects the map | Terrain classifier on photos (soil, bedrock, sand, big rock) | AI4Mars labels; rover images |
| Delay | Mission control answers late, so the crew decides | Microsoft Foundry agent with a 20-second demo delay (Azure track) | |

## 4. The data layers

| Layer | Mission and instrument | What it tells the astronaut | Used for |
|---|---|---|---|
| Optical | MRO HiRISE (about 25–50 cm per pixel); CTX mosaic (5 m) for context | What the ground looks like; large rocks | Map base, obstacle mask |
| Topography | HiRISE DTM | Height and slope | Walking cost, slope limit, line of sight, shielding |
| Thermal | Mars Odyssey THEMIS thermal inertia | Loose sand and dust (low) versus rock (high) | Walking cost, sand-trap warning |
| Spectral | MRO CRISM | Minerals that point to water and science value | Science targets |
| Geology | USGS-NASA geologic map | Rock units and contacts | Science targets, terrain type to start |
| Radiation | Curiosity RAD (Gale) and DONKI solar events | Dose per hour; storm warnings | Dose budget, shelter alert |
| Atmosphere | Curiosity REMS (Gale) | Temperature, pressure, wind, dust | Conditions panel, dust effects on the rover |
| Ground view | Curiosity Mastcam and Navcam raw images | What each stop looks like up close | Stop previews, ground truth |

This is six NASA missions or programs in one hyperlocal view, three more data types than NASA asks for, and every layer has a job in navigation or science.

## 5. A Marswalk with Martian Map

1. **The night before (Plan).** The crew picks "boxwork". Spectral and geology layers highlight three ridges. Martian Map plans a route: it avoids a sand patch (low thermal inertia) and a 25° slope, and takes a longer, firmer path. It shows Curiosity's photo of each stop, the walk time, energy, oxygen, dose, and the walk-back limit at every point. The crew moves one stop and approves.
2. **Walking out (Walk).** The phone is the suit display. Steps and heading move the astronaut along the route. The buddy rover drives ahead the way Perseverance's AutoNav does: observe, map, evaluate, choose, move, update. It flags a rock field the orbital images missed, and the route updates. The ring shrinks with each step.
3. **At the ridge (At the stop).** Look, get close, decide. The astronaut photographs the ridge; the classifier tags the ground; the astronaut samples one of three rocks examined, and the context card saves where, what layers said, and the photo.
4. **A solar storm alert.** Minutes to shelter appear: the rover is 7 minutes away, a ridge wall 12.
5. **Turning back.** The next target is past the point of no return. The phone buzzes. Mission control's reply arrives 20 seconds later (standing for 20 minutes): too late to help, which is the point.
6. **Debrief.** Predicted versus measured energy, what the crew found, and the corrected map for the next walk.

## 6. Safety, in detail

- **Walk-back limit:** if the rover fails, can the crew walk home with the reserve intact? Computed for every cell, along real routes and slopes. The reserve stands for NASA's 1-hour emergency return plus about 30 minutes to get back inside.
- **Ride-back limit:** if a suit degrades, can the rover bring the astronaut home? Shown as a second, larger ring. Failures are not stacked, the same rule NASA uses.
- **Obstacles:** slope limit, large rocks, loose sand; plans assume the map is wrong in places, so the route recomputes the moment the crew deviates.
- **Radiation:** background dose for the walk and the shelter alert during a solar event.
- **Comms:** delay to Earth and line of sight to the rover and habitat; everything works offline.
- **Wind** is shown only as dust and visibility: on Mars it barely pushes.

## 7. Robots and pairs

- **The buddy rover** leads by default (crews in NASA's 2022 desert test preferred it), scouts the route, carries tools and samples, relays comms behind ridges, and can bring an astronaut home. It is specified like NASA's new Lunar Terrain Vehicle (km/h, with or without crew), because today's Mars rovers are 20–30 times slower than a walking astronaut.
- **Two astronauts** walk together, in sight of each other, as NASA's EVA rules require. The map shows both and the ring follows the more tired one.
- **Override ladder:** E-STOP, hold, come to me, return to base along the path it came. On lost link it stops, then retreats.

## 8. Why NASA cares

- NASA's 2026 technology gaps rank surface mobility #2 of 32 and robots working with crew #10, and ask for "in-situ decision support tools" for Mars spacewalk hazards (need 8.06).
- NASA is funding the rover (Lunar Terrain Vehicle, up to $4.6B) and the suit (orders capped at $3.1B). The layer between them, which tells the person in the suit what they can still do, is not funded; the one follow-me astronaut robot project is on hold.
- Mars orbital support is shrinking, so crews will need onboard, offline tools.
- The same engine works on the Moon (first crewed landing now planned for 2028) and for people on Earth who walk far from help: firefighters on steep ground, search and rescue, backcountry guides, polar expeditions.
- For our company: a working demo of layered maps, terrain-aware routing, on-device ML and an AI agent that respects real limits.

## 9. Architecture and stack

- **Data pipeline (Python):** reads the NASA layers for the site and writes the shared files (`docs/CONTRACTS.md`), including the cost of walking home from every cell.
- **Models (Python, exported to ONNX):** terrain classifier; buddy rover policy.
- **App (game engine on the phone):** draws the layers in 3D, plans and follows the route, runs the ring and the science checklist. Babylon.js (web, opens from a QR code) is suggested unless someone has shipped Unity to a phone; the team decides. Both read the same files and models.
- **CAPCOM agent (Microsoft Foundry):** explains the layers and the plan, with a delay. Also our Azure-track piece.

| | **A. Babylon.js (web game engine), TypeScript** | **B. Unity 6, C#** |
|---|---|---|
| Runs on the phone | In the browser from a QR code; judges can open it | Native app (Android APK; iPhone through Xcode) |
| On-device ML | onnxruntime-web | Unity Inference Engine (formerly Sentis) |
| Deploy | Minutes (Azure Static Web Apps) | Build times, phone signing |
| Risk in 26 hours | Low | Medium to high without prior Unity mobile experience |

| Piece | Type | If it fails |
|---|---|---|
| Terrain classifier | Small CNN on AI4Mars labels | Use thermal inertia and geologic units |
| Buddy rover | Reinforcement learning (PPO) on the map | Scripted follower |
| Route and ring | Path search and precomputed return cost | Foundation: must work |
| CAPCOM | LLM agent with tools and delay | Pre-recorded delayed messages |

## 10. Build order: foundation first

The base must always work; every feature sits behind a flag and can be turned off.

**Foundation:** site map with three layers → route around obstacles → walk along it → walk-back ring and buzz → runs on one phone.

**Features (flags):** `layers_extra` (thermal, spectral, radiation), `pov_images`, `science_stop`, `step_mode`, `buddy_scripted`, `buddy_rl`, `override`, `rideback_ring`, `storm`, `classifier`, `capcom`, `debrief`, `before_after`.

| Milestone | Time | Done when |
|---|---|---|
| M0 Skeleton | Sat 12:30 | Stack chosen; synthetic world renders; ML env loads it |
| M1 Walking core | Sat 16:00 | Route, energy, ring and buzz on one phone; first real Gale world with three layers |
| M2 Demo-able | Sat 21:00 | Science targets, rover photos at stops, step mode, scripted buddy, classifier v1; deployed |
| Overnight | to Sun 07:00 | More layers, RL buddy, storm alert, CAPCOM, validation numbers, backup video |
| M3 Freeze | Sun 08:00 | Polish, project page, rehearse |
| Submit | Sun ~13:30 (confirm) | Project page, video, demo link |

## 11. Before and after

| | Before | With Martian Map |
|---|---|---|
| Maps | Regional and global (Mars Trek) or built for rover teams on Earth (MMGIS) | One hyperlocal view, all layers, for this crew and this walk |
| Planning | Map books and limits worked out on Earth | Planned and re-planned on site, with the same limits |
| What a stop looks like | Unknown until you arrive | Rover photos of every stop |
| How far you can go | Worked out before the walk; in NASA's 2022 field test the first walk ended early when unseen slopes blocked the route | Walk-back ring, every step, re-planned on the spot |
| Turn-back call | Mission control by voice | The crew, with the device; Earth hears 4–22 minutes later |
| Robots | Rovers work alone | A buddy rover scouts, carries and relays |
| After the walk | Notes | A corrected map for the next walk |

## 12. Sources

- Challenge statement and resources: https://www.spaceappschallenge.org/2026/challenges/interplanetary-survival-guide-martian-map/
- How Perseverance drives (AutoNav): https://science.nasa.gov/resource/how-perseverance-drives-on-mars/
- Perseverance science objectives and instruments: https://science.nasa.gov/mission/mars-2020-perseverance/science-objectives/
- Sampling at Citadelle (the investigation sequence): https://science.nasa.gov/blog/kicking-off-the-sampling-sol-path-at-citadelle/
- 5.7-terapixel CTX global mosaic: https://www.caltech.edu/about/news/scientists-unveil-a-57-terapixel-global-image-of-mars
- NASA FY26 Civil Space Shortfall Prioritization: https://www.nasa.gov/wp-content/uploads/2026/05/fy26-civil-space-shortfall-prioritization.pdf
- Everything else: `docs/RESEARCH.md`
