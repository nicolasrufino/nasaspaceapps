# Mission VESTA: current demo and historical plan

One document, read top to bottom: what NASA asked for, what we build, how every part answers the challenge, and how we build it. Evidence for every claim is in `docs/RESEARCH.md`. **New to the project? Read `docs/PRODUCT.md` first:** what the product is, each stage and why it exists, and why it beats the alternatives on every objective.

> **Accepted rescope, 2026-11-15:** [SPEC.md](SPEC.md) replaces the earlier scope and build order below. The product submitted is **Vesta Scout**. This document preserves the original vision for context; sections 1–12 are not a list of shipped capabilities. The current demo below and [PITCH.md](PITCH.md) describe what to show. Packing list, helmet HUD, export, buddy rover, storm and CAPCOM are not demo promises.

## 0. On one page

- **The problem today:** NASA's Mars data lives in separate tools built for rover teams and regional views (Mars Trek, MMGIS). Nothing layers it for one crew on one walk, with the science, the hazards and the way home together. On Mars, help is 4 to 22 minutes away.
- **The challenge:** a layered, integrated map of one place on Mars, built from several NASA missions, that helps an astronaut plan and carry out a Marswalk safely while doing new science.
- **Our answer:** **Martian Map turns NASA's Mars data into a science walk you can plan, preview and come home from, and makes the map better with every walk.**
- **Where and why:** the boxwork ridges on Mount Sharp, Gale crater. NASA's challenge names them; Curiosity studied them in 2025; and Curiosity measured the radiation, weather and ground there, so one site gives us every layer. *(Alternative: Jezero, with Perseverance's images. The team decides.)*
- **The real problem:** there is no map at the scale of one walk. Orbit sees the region; it misses the rock field, the soft sand and the slope that decide whether a suited astronaut can get through.
- **Our solution: a map that builds itself, walk by walk.** (1) Start from NASA's orbital layers. (2) A NASA JPL-style scout helicopter flies the route first and maps what orbit can't see. (3) Martian Map plans the best path and the packing list: what to bring, what is heavy, what the rover carries. (4) The crew walks for a science purpose (signs of past water and life), and the map grows as they go: photos, ground type, how hard each stretch was, markers they drop. (5) The next crew starts with a better map.
- **The demo:** open `/scout/` on Gale with five default stops → inspect imagery and the hazard legend → fly one campaign of at most three 1 km flights → re-plan after every landing → show the fully scanned final route and its return margin → use Walk / Step.

**Local awards:** eligibility and the Azure award question are tracked by Galsan in F1 #121. Azure Static Web Apps hosting is live; CAPCOM is cut from the submission.

### Why this is the best solution

What a crew could do today, and why each option falls short on its own:

| Option | Sees small hazards | Works with a 4–22 min delay | Keeps the way home known | Gets more science per walk | Uses proven NASA methods |
|---|---|---|---|---|---|
| Orbital maps only (HiRISE, Mars Trek) | No: misses rocks under about 1 m | Yes | No | Partly | Yes |
| Mission control plans and guides by voice | Only what orbit sees | **No** | Only before the walk | Partly | Yes |
| A rover scouts first | Yes | Yes | No | Yes | Yes, but rovers average about 110 m/h, 20–30 times slower than a walking astronaut |
| The crew explores by eye | Only once there | Yes | No | Partly; plans broke on the first walk in NASA's 2022 test | No |
| **Martian Map: orbit + scout helicopter + plan on the device + a map that grows** | **Yes** | **Yes** | **Yes, every step** | **Yes** | **Yes, each piece** |

Each option on its own fails at least one need. Ours combines the parts that work, and runs on the crew's side of the delay.

### How we know it can work

- **Every piece is already proven at NASA, separately.**
  - Rocks detected automatically from their shadows in HiRISE images chose or checked the Phoenix, Gale, Jezero and InSight landing sites.
  - Ingenuity flew 72 times and scouted routes for Perseverance.
  - Perseverance's AutoNav plans its own safe path between stops.
  - Walkback limits and the 1-hour return rule are how NASA keeps crews safe today.
- **What is new is putting them together for the person on foot, on the device, with no link to Earth.**
- **What we will measure in our demo** (numbers come from our code, not guesses):
  - how many rock-field cells the scouted route avoids that the orbit-only route crosses;
  - how much margin home the route keeps at every point;
  - how the ring changes if our energy model is off by ±30%;
  - the rock detector's agreement with hand-checked rocks.

### The current demo, step by step (about 1:30)

1. Open **bare `/scout/`**, Gale, with the five default science stops. Initial walking energy is about **621 kJ**. Inspect HiRISE imagery, true-scale terrain and the Hazards legend.
2. Click **Fly the route** once. Each flight animates for ten seconds and covers at most 1 km; landing triggers a re-plan before the next flight starts.
3. After the three flights, show **44 found hazard cells**, **fully scouted**, and about **630 kJ**. The stored layer's route crossings fall from **6 to 0**; the five stops stay the same. Flight distances are 1,000 m, 1,000 m and 215.4 m. A fourth flight is disabled.
4. Switch to **Walk**, press **Step**, and explain the margin home. Use real phone sensing only after the actual device has passed the release rehearsal.
5. Explain the bounds: stored grid hazards, a simulated sensor footprint, and an assumed walking-energy model. Transit, helicopter return-to-base, recharge, daylight and flight energy are not modelled. These results do not certify safety on Mars.

Numbers and definitions: [R5](../ml/pitch_metrics/PITCH_NUMBERS.md). Full five-minute script: [PITCH.md](PITCH.md). F4 supersedes the earlier seven-flight/14-leg demo. A2 adds three measured landing explanations behind `why_flight`. A6 is implemented behind `voi` and stays off: its [eleven-case comparison](../app/scripts/VOI_RESULTS.md) fails promotion.

---

The following sections record the **pre-rescope vision**. Consult SPEC.md for what is in the submission.

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

### The map-making loop (the core of the solution)

| Step | What happens | Who or what does it | Evidence it is real |
|---|---|---|---|
| **1. Orbit** | Start from NASA's layers: images, slope, sand, minerals, radiation | Data pipeline | HiRISE, THEMIS, CRISM, Curiosity RAD (section 4) |
| **2. Scout** | A helicopter flies the planned route first. It covers the route corridor first, then anomalies (places where the layers disagree, such as firm-looking ground that the thermal data says is loose sand, a slope near the 20° limit, or an unusual mineral signal near a target), then the cells it is least sure about, within Ingenuity-class limits (about 700 m and 3 minutes per flight). Where it flies, the map gains full-resolution terrain and detected rocks; the route re-plans | Scout helicopter (simulated flight in our app; the data it reveals is real full-resolution HiRISE) | Ingenuity scouted routes for Perseverance in 72 flights (2021–2024); one flight ruled out a target and saved about two months of driving. JPL and AeroVironment's Skyfall concept (2025) proposes six helicopters to scout human landing sites |
| **3. Plan and pack** | Best path (safe and efficient), effort per stretch, and a packing list from the route: oxygen and water margin, sampling tools for the targets, what the rover carries because it is heavy | Martian Map | NASA's statement asks about astronauts "carrying scientific equipment and other supplies"; NASA's 2022 field test found a loaded cart caused unacceptable fatigue |
| **4. Walk and add** | The crew walks for the science goal. The map grows: photos, ground type from the classifier, how hard each stretch really was, markers and sample sites they drop | Crew, phone, buddy rover | Perseverance's AutoNav updates its local map as it drives; our classifier is trained on NASA's AI4Mars labels |
| **5. Next walk** | The corrected map, real effort numbers and new hazards feed the next plan | Data pipeline | NASA calibrates its walking model on field traverses |

This is why it is a tool and not a static map: the challenge allows "a tool or system that generates maps", and every walk makes the map better.

**Why the walks happen at all.** Each walk has a science purpose. At Mount Sharp the boxwork ridges likely formed where groundwater flowed and left minerals behind (NASA's working idea, still being tested), the kind of place where signs of past habitability, and possibly life, are preserved. The map helps the crew get the most science per walk: which ridges to examine, which to sample, and what to leave for the next walk.

**Who uses it:** a two-person Mars crew, the night before and during a surface walk, with Earth 4 to 22 minutes away.

**Four modes, one mission** (the same steps Perseverance follows: choose a target, travel safely, investigate, decide what to keep):

| Mode | Where | What happens |
|---|---|---|
| **1. Plan** | Habitat display | Pick a science goal. Layers highlight candidate targets. The scout helicopter flies the route and the map updates. Martian Map plans a safe, efficient route, estimates time, energy, oxygen and radiation, shows rover photos of every stop, and builds the packing list. The crew approves or edits. |
| **2. Walk** | Phone as the suit display | Real steps move you along the route. The walk-back ring shows how far you can still go and get home. The buddy rover carries the heavy kit and updates the local map. Hazards and space-weather alerts appear when they matter. Every stretch walked is added to the map. |
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
| C6, R4 | Scout helicopter maps the route before the walk; the route re-plans | Simulated flight over the site; a fine-scale hazard layer only the helicopter can see; path search re-runs | Ingenuity precedent; HiRISE as the starting map |
| R4 mobility | Packing list and load plan from the route | Rules from route length, time, targets and terrain; heavy items assigned to the rover | Suit and load values from NASA studies |
| C2 | The map grows with every walk | Walk log (photos, ground type, measured effort, markers) merged into the site files | Classifier on AI4Mars labels |
| C6 | Buddy rover leads and carries | Reinforcement-learning policy on the same map, compared with a scripted follower; AutoNav-like loop | Same layers |
| C1 | Habitat display, tablet minimap and helmet HUD | One three.js web app with three views | |
| Ground truth | What the crew sees corrects the map | Terrain classifier on photos (soil, bedrock, sand, big rock) | AI4Mars labels; rover images |
| Delay | Mission control answers late, so the crew decides | Microsoft Foundry agent with a 20-second demo delay (Azure track) | |

## 4. The data layers

The plain-words guide to every NASA resource (the five NASA listed and the ones we add), and the exact slice of Mars we build, is in `docs/DATA.md`.

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

1. **The night before (Plan).** The crew picks "boxwork". Spectral and geology layers highlight three ridges. Martian Map plans a route: it avoids a sand patch (low thermal inertia) and a slope over the 20° limit, and takes a longer, firmer path. It shows Curiosity's photo of each stop, the walk time, energy, oxygen, dose, and the walk-back limit at every point. The crew moves one stop and approves.
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

- **The scout helicopter** flies before the crew does, the job Ingenuity proved for Perseverance. It maps the route at centimetre scale and finds what orbit can't (rock fields, drop-offs, soft sand). In our app the flight is simulated over the real site, revealing a hidden fine-scale hazard layer; the route re-plans when it lands.
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
- **App (game engine on the phone):** draws the layers in 3D, plans and follows the route, runs the ring and the science checklist. **Decision from the critique (`docs/CRITIQUE.md`): web, with three.js.** One app is the game, the habitat display, the suit display and the public viewer that anyone can open from a QR code. Unity would need a second codebase for the viewer.
- **CAPCOM agent (Microsoft Foundry):** explains the layers and the plan, with a delay. With Azure hosting, it makes us eligible for Best Use of Technology. Built by Jules.

| Piece | Stack |
|---|---|
| App | three.js web app, served from Azure Static Web Apps; opens on any phone from a link or QR code |
| On-device ML | onnxruntime-web, in the browser |
| CAPCOM | Microsoft Foundry agent (Azure) |
| Pipeline and models | Python; models exported to ONNX |

| Piece | Type | If it fails |
|---|---|---|
| Terrain classifier | Small CNN on AI4Mars labels | Use thermal inertia and geologic units |
| Buddy rover | Reinforcement learning (PPO) on the map | Scripted follower |
| Route and ring | Path search and precomputed return cost | Foundation: must work |
| CAPCOM | LLM agent with tools and delay | Pre-recorded delayed messages |

## 10. Build order: foundation first

**Who builds what, block by block, with prerequisites: `docs/BUILD.md`** (drawn as a four-lane graph on the team page).

The base must always work; every feature sits behind a flag and can be turned off.

**Foundation:** site map with three layers → route around obstacles → walk along it → walk-back ring and buzz → runs on one phone.

**Features (flags):** `drone_scout` (the helicopter scout), `why_route`, `export`, `packing_list`, `map_grows`, `layers_extra` (thermal, spectral, radiation), `pov_images`, `science_stop`, `step_mode`, `buddy_scripted`, `buddy_rl`, `override`, `rideback_ring`, `storm`, `classifier`, `capcom`, `debrief`, `before_after`.

`scout_payload` (S4, #169): on by default since 2026-11-15; `/scout/?scout_payload=0` hides it; reads the switch in the guided scout stage because `?flags=` selects Vision. SkyFall payload reference, historical REMS context, and per-flight strip reports; off on the bare URL. See `app/README.md`.

`classifier`: M2 R4 → E6 integration, opt-in in the Walk view. Choose a ground photo and a 256-pixel crop;
the retained ONNX model predicts its dominant surface locally. Not validated on helicopter images;
does not yet write georeferenced labels into the map or change route costs. See `app/README.md`.

| Milestone | Time | Done when |
|---|---|---|
| M0 Skeleton | Sat 12:30 | Stack chosen; synthetic world renders; ML env loads it |
| M1 Walking core | Sat 16:00 | Route, energy, ring and buzz on one phone; first real Gale world with three layers |
| M2 Demo-able | Sat 21:00 | Science targets, rover photos at stops, helicopter scout re-plan, packing list, step mode, scripted buddy, classifier v1; deployed |
| Overnight | to Sun 07:00 | More layers, RL buddy, storm alert, CAPCOM, validation numbers, backup video |
| M3 Freeze | Sun 08:00 | Polish, project page, rehearse |
| Submit | Sun ~13:30 (confirm) | Project page, video, demo link |

## 11. Before and after

| | Before | With Martian Map |
|---|---|---|
| Maps | Regional and global (Mars Trek) or built for rover teams on Earth (MMGIS) | One hyperlocal view, all layers, for this crew and this walk |
| Planning | Map books and limits worked out on Earth | Planned and re-planned on site, with the same limits |
| What a stop looks like | Unknown until you arrive | Rover photos of every stop |
| Small hazards | Invisible from orbit until you reach them | A scout helicopter finds them first; the route re-plans |
| What to bring | Planned by hand | A packing list from the route; heavy items ride on the rover |
| How far you can go | Worked out before the walk; in NASA's 2022 field test the first walk ended early when unseen slopes blocked the route | Walk-back ring, every step, re-planned on the spot |
| Turn-back call | Mission control by voice | The crew, with the device; Earth hears 4–22 minutes later |
| Robots | Rovers work alone | A buddy rover scouts, carries and relays |
| After the walk | Notes | A corrected map for the next walk |

## 12. Sources

- Challenge statement and resources: https://www.spaceappschallenge.org/2026/challenges/interplanetary-survival-guide-martian-map/
- How Perseverance drives (AutoNav): https://science.nasa.gov/resource/how-perseverance-drives-on-mars/
- Ingenuity's 72 flights and scouting for Perseverance: https://www.planetary.org/space-missions/ingenuity and https://www.universetoday.com/152365/thanks-to-ingenuitys-pictures-perseverance-knows-where-to-drive-to-next
- Skyfall helicopter concept (2025): https://www.space.com/astronomy/mars/wild-new-skyfall-mars-mission-would-drop-6-scout-helicopters-onto-the-red-planet-from-the-air
- Perseverance science objectives and instruments: https://science.nasa.gov/mission/mars-2020-perseverance/science-objectives/
- Sampling at Citadelle (the investigation sequence): https://science.nasa.gov/blog/kicking-off-the-sampling-sol-path-at-citadelle/
- 5.7-terapixel CTX global mosaic: https://www.caltech.edu/about/news/scientists-unveil-a-57-terapixel-global-image-of-mars
- NASA FY26 Civil Space Shortfall Prioritization: https://www.nasa.gov/wp-content/uploads/2026/05/fy26-civil-space-shortfall-prioritization.pdf
- Everything else: `docs/RESEARCH.md`
