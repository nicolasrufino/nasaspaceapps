# Martian Map: the plan

**Challenge:** Interplanetary Survival Guide: Martian Map (NASA Space Apps 2026).
**One sentence:** Your phone tells you, step by step, how far you can still walk on Mars and make it home.
**The demo:** a judge walks the venue hallway holding the phone. Their real steps move an astronaut across real Mars terrain, energy drains with every step, the walk-back ring shrinks, a trained buddy rover follows and scouts, and the phone buzzes at the point of no return. Mission control answers 20 seconds late.

## 1. What NASA problem this solves

| NASA need | Where it is written | What we build for it |
|---|---|---|
| "Provide in-situ decision support tools to address identified EVA hazards and risks on the Martian surface" | Civil Space Shortfall need 8.06 (FY26 ranking: SF08 Mars EVA) | The walk-back ring and point-of-no-return alert, computed on the device |
| Surface mobility for crew and assets | SF16, ranked #2 of 32 in FY26 | Energy-aware routes over real terrain |
| Robots and crew working together on the surface | SF15, ranked #10 | The buddy rover that scouts ahead and stays near the astronaut |
| Operating without Earth's instructions in safety-critical moments | SF21 need 21.09 | Decisions made on the device; CAPCOM informed after, 20 min late |
| EVA operations and Earth-independent operations | Human Research Roadmap risks 84 and 175; Moon to Mars objectives OP-5LM, OP-2LM, TH-8LM, OP-10LM | Crew-side display, logs for debrief |

**Why now.** Mars crews face up to 20 minutes of one-way radio delay, so nobody on Earth can make the turn-back call. NASA's orbital support at Mars is shrinking: MAVEN likely failed in 2025, and the FY2027 request proposes ending Mars Odyssey and halving Perseverance operations. Future crews will rely on onboard, offline tools.

**Where the money goes.** Axiom's AxEMU suits: first task order about $228M, orders capped at $3.1B; NASA's inspector general warns suit readiness could slip to 2031. Lunar Terrain Vehicle awards: Astrolab $219M and Lunar Outpost $220M. Moon Base plans a landing every six months. Crew time is priced at $130,000 per hour on the ISS. Suits and rovers get the money; the decision layer between the human and the terrain is the gap we fill.

**The research gap.** Rover tools (ENav, AI4Mars) ignore human energy. EVA planners (SEXTANT) use a simple energy model. Suit-display teams (NASA SUITS) mostly use scenario data, not real terrain. No open tool combines terrain, a walking energy model, consumables and a walk-back limit. NASA JSC's field-modified walking model improved predicted-versus-measured fit from a slope of 0.50 to 0.95 (Kim et al. 2024).

## 2. Is a phone realistic? How it works on Mars

- **The phone stands in for the suit display.** Real suits will use a helmet display or a wrist or chest display. NASA's SUITS program builds head-mounted AR displays for spacewalks.
- **Phones are already flying.** Since February 2026, NASA lets astronauts carry their own smartphones; the Crew-12 and Artemis II crews flew with them, after a certification process.
- **The phone's sensors are the same kind a suit needs:** motion sensors, compass, camera, vibration. On Mars there is no GPS, so position comes from counting steps and heading (dead reckoning) plus map matching. That is exactly what our step mode does, so the demo is not a shortcut.
- **The buddy rover is simulated.** We train it on the real terrain grid and show it in the game. We do not build hardware. Real buddy rovers are what SF15 asks for.

## 3. Across the mission: plan, train, explore, debrief

| Stage | Who uses it | What they do with Martian Map |
|---|---|---|
| **Plan** (habitat, the night before) | Crew and planners | Pick science stops; see which are reachable with margin; the buddy rover scouts the route in simulation |
| **Train** (on Earth, months before) | Astronauts, instructors | Rehearse the exact traverse in the game on real HiRISE terrain; walk it in an analog field site with step mode; instructors inject failures (dust storm, a suit leak that cuts the energy budget). Builds the feel for the point of no return |
| **Explore** (during the EVA) | Crew | Live walk-back ring, point-of-no-return buzz, rover beacon, delayed CAPCOM |
| **Debrief** (after) | Crew, scientists, engineers | Replay the walk; compare predicted versus measured energy; the logs improve the energy model and retrain the buddy rover |

The training stage is also where the models get better: every logged walk is data to calibrate the energy model (the way NASA JSC calibrated theirs on field traverses) and new terrain to retrain the buddy rover.

## 4. Beyond the hackathon

The core is reusable: **energy-aware routing with a "you can still get home" envelope, on-device terrain vision, and an assistant that works with delay or no signal.**

- **Space:** analog missions, NASA SUITS teams, suit and rover makers, lunar EVAs (same engine with Moon gravity, 1.62 m/s²).
- **Earth:** wildland firefighters on steep ground, search and rescue, backcountry guides and hikers, polar and desert expeditions, lone workers in mines and remote sites. Everywhere people walk far from help with limited energy, water or air.
- **For our company:** a working demo of three things a maps product can use: terrain-aware routing, on-device ML on a phone, and an AI agent that respects real constraints. It is also a credential: a NASA challenge entry built on NASA data.

## 5. Stack decision (owner: Person 2, by 12:30 Saturday)

Both options run on a phone and both load the same world files and the same ONNX models, so this choice does not block anyone else.

| | **A. Babylon.js (web game engine), TypeScript** | **B. Unity 6, C#** |
|---|---|---|
| Runs on the phone | In the browser, from a URL or QR code. Judges can open it on their own phones | Native app: Android APK by USB; iPhone through Xcode |
| On-device ML | onnxruntime-web (WebAssembly or WebGPU) | Unity Inference Engine (formerly Sentis) |
| Phone sensors | Motion sensors and vibration (vibration works on Android, not iPhone Safari); needs HTTPS | Full access |
| Deploy | Minutes (Azure Static Web Apps, which also counts for the Azure track) | Build times; iPhone signing |
| Risk in 26 hours | Low | Medium to high unless someone has shipped a Unity mobile build before |
| Best if | Nobody has recent Unity mobile experience | Someone has shipped Unity to a phone |

**Suggestion:** A (Babylon.js), unless a teammate has shipped Unity to a phone before. The team decides by 12:30. Training is in Python either way (Gymnasium + Stable-Baselines3) and exports ONNX, so the ML work is the same.

## 6. Where ML and AI go

| Piece | Type | Where it shows up | If it fails |
|---|---|---|---|
| Terrain classifier | Small CNN fine-tuned on AI4Mars labels (soil, bedrock, sand, big rock) | Builds the terrain layer that sets walking cost; live camera mode on Perseverance images | Use the USGS geologic units for the terrain layer |
| Buddy rover | Reinforcement learning (PPO) on the world grid | Follows and scouts in the game | Scripted follower using the same grid |
| Energy model | Published physics (Pandolf, then Kim et al. 2024) | Every step's cost | Not optional: this is the foundation |
| CAPCOM | LLM agent (Azure / Microsoft Foundry) with tools and a 20 s delay | Talks to the astronaut; explains the ring | Pre-recorded delayed messages |

## 7. Build order: foundation first

Rule: **the base never depends on a feature.** Every feature sits behind a flag and can be switched off without breaking the demo.

**Foundation (must work):** world files → terrain on screen → astronaut moves → energy drains → walk-back ring → buzz at the point of no return → runs on one phone.

**Features (each behind a flag):** `step_mode` (real steps), `buddy_scripted`, `buddy_rl`, `classifier`, `camera_mode`, `capcom`, `before_after`, `radiation` (stretch).

| Milestone | Time | Done when |
|---|---|---|
| M0 Skeleton | Sat 12:30 | Stack chosen; repo cloned by all; synthetic world renders; ML env loads the same world |
| M1 Walking core | Sat 16:00 | Move, energy, ring, buzz work on one phone with the synthetic world; first real Mars world exported |
| M2 Demo-able | Sat 21:00 | Real Mars world in the app; step mode; scripted buddy; classifier v1 with an accuracy number; deployed |
| Overnight | Sat 21:00 to Sun 07:00 | RL buddy trained and swapped in; CAPCOM with delay; before/after page; validation numbers; backup video |
| M3 Freeze | Sun 08:00 | No new features. Polish, project page, rehearse the 5-minute pitch |
| Submit | Sun ~13:30 (confirm) | Project page, 30-second video, demo link |

## 8. Before and after

| | Before (Apollo to today) | After (with Martian Map) |
|---|---|---|
| Route | Planned on Earth days ahead | Planned and re-planned on the device |
| Knowing how far you can go | Estimated; Apollo 14 turned back 20–40 m from Cone Crater's rim | Walk-back ring updated with every step |
| Who decides to turn back | Mission control, by voice | The crew, with the device; Earth is informed 20 min later |
| Position | "Our positions are all in doubt now" (Apollo 14) | Step counting and heading on a real terrain map |
| Robots | Rovers work alone | A buddy rover scouts and stays close |
| After the walk | Notes and memory | Replay, predicted versus measured energy, better models |

## 9. Sources

- NASA FY26 Civil Space Shortfall Prioritization: https://www.nasa.gov/wp-content/uploads/2026/05/fy26-civil-space-shortfall-prioritization.pdf
- Smartphones on Crew-12 and Artemis II: https://appleinsider.com/articles/26/02/05/iphone-in-space-nasa-gives-approval-for-personal-iphones-to-artemis-astronauts
- NASA SUITS: https://www.nasa.gov/learning-resources/spacesuit-user-interface-technologies-for-students/
- Kim et al. 2024 (NASA JSC walking model): https://ntrs.nasa.gov/api/citations/20240001423/downloads/IEEE%20EMBC%202024.pdf
- Pandolf et al. 1977: https://doi.org/10.1152/jappl.1977.43.4.577
- Carr & McGee 2009 (loping in low gravity): https://doi.org/10.1371/journal.pone.0006614
- AI4Mars (Swan et al. 2021): https://doi.org/10.1109/CVPRW53098.2021.00226
- Apollo 14 at Cone Crater (NASA SVS 4883): https://svs.gsfc.nasa.gov/4883
- Axiom suit task order: https://axiomspace.com/release/xemu-task-award
- NASA OIG on suit delays: https://oig.nasa.gov/news/spacesuit-development-delays-could-impact-artemis-timeline-and-iss-operations/
- Unity Inference Engine in ML-Agents 4.0: https://docs.unity3d.com/Packages/com.unity.ml-agents@4.0/manual/Inference-Engine.html
- NASA resources for this challenge: https://www.spaceappschallenge.org/2026/challenges/interplanetary-survival-guide-martian-map/?tab=resources
