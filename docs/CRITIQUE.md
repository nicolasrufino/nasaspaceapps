# Critique: every idea, graded

Every idea gets graded here before it is built, including ideas from the team lead. A good idea that fails one test gets simplified, not defended.

## The rubric

Each idea is scored 0–3 on five tests (15 points):

| Test | 3 | 0 |
|---|---|---|
| **Fit**: does it answer the challenge (R1–R5, C1–C6 in `PLAN.md` §1)? | Answers a stated requirement directly | Unrelated to the statement |
| **Judges**: does it move a judging score (Impact, Creativity, Validity, Relevance, Presentation)? | Moves two or more | Moves none |
| **Feasible**: can our team finish it by Sun 08:00 alongside the foundation? | A few hours, known methods | Needs research we can't do in time |
| **Honest**: are the data and claims real, and labelled when simulated? | Real NASA data or clearly labelled simulation | Would mislead a judge |
| **Safe**: can it fail without breaking the base demo? | Behind a flag, isolated | Base depends on it |

**Verdicts:** 12–15 **Keep** · 9–11 **Simplify** (keep the core, cut the rest) · 0–8 **Cut** (or keep only as a pitch line)

## Fact check of the latest ideas

| Claim | Check |
|---|---|
| A helicopter can map Mars terrain with sound, like a bat | **Not on Mars.** Air about 1% of Earth's; high pitches lost within about 8 m; two speeds of sound ([Nature 2022](https://doi.org/10.1038/s41586-022-04679-0), [DLR](https://www.dlr.de/en/latest/news/2022/02/20220401_the-sound-of-mars)). Light (lidar) and cameras work instead; Ingenuity's images already produced a 5 cm terrain model ([JPL](https://www.jpl.nasa.gov/site/research/media/posters/2023/SP23018p.pdf)) |
| Ingenuity flew on Mars 2021–2024, first flight April 19, 2021, first powered controlled flight on another planet | **Correct.** 72 flights; longest about 705 m; longest 169.5 s; up to 24 m high ([Space.com](https://www.space.com/mars-helicopter-ingenuity-longest-flight-december-2023), [Planetary Society](https://www.planetary.org/space-missions/ingenuity)) |
| A helicopter can find hazards orbit misses | **Correct in practice.** Ingenuity's images helped plan Perseverance's routes ([Universe Today](https://www.universetoday.com/152365/thanks-to-ingenuitys-pictures-perseverance-knows-where-to-drive-to-next)) |
| Rocks can be detected automatically from overhead images | **Correct, and NASA relies on it.** Shadow-based rock counts on HiRISE images were used to choose or check the Phoenix, Gale, Jezero and InSight landing sites ([JPL](https://robotics.jpl.nasa.gov/what-we-do/flight-projects/phoenix-mars-lander/landing-site-characterization), [Golombek et al. 2021](https://authors.library.caltech.edu/records/d1t32-akr32/files/Earth_and_Space_Science_-_2021_-_Golombek_-_Rock_Size_u2010Frequency_Distributions_at_the_InSight_Landing_Site_Mars.pdf?download=1)) |
| We can drop the player anywhere on Mars | **Not with real data.** HiRISE images and terrain models cover only a small fraction of Mars, so a random spot usually has no hyperlocal data |
| We can rebuild 3D from the helicopter's simulated camera | **Circular.** Rebuilding 3D from images our own engine rendered proves nothing about Mars |

## Grades

| Idea | Fit | Judges | Feasible | Honest | Safe | Total | Verdict and what to do |
|---|---|---|---|---|---|---|---|
| Helicopter scout demo in the game: deploy, explore, reveal, re-plan | 3 | 3 | 2 | 2 | 3 | **13** | **Keep.** It is the solution in action. Label the flight as simulated |
| Whole-area helicopter survey (SkyFall-style fleet) before choosing stops: strips over the slice, reachable area first; shows flights and sols per fleet size; a "best areas" layer (round trip fits the budget, not too steep, no rocks seen, scouted, science value) | 3 | 3 | 2 | 2 | 3 | **13** | **Keep**, behind `drone_scout`. Turns "explore the area" into a hardware answer (how many helicopters, how many sols). Label the flight simulated and the flights-per-sol rate an estimate |
| Drop the player anywhere on Mars at random | 1 | 1 | 0 | 1 | 1 | **4** | **Cut.** No hyperlocal data at most places, and it loses the science goal |
| Random start inside our prepared site (Gale; maybe Jezero) | 3 | 2 | 3 | 3 | 3 | **14** | **Keep.** Same idea, real data everywhere |
| Start inside the spaceship and walk to the helicopter | 2 | 2 | 1 | 3 | 2 | **10** | **Simplify** to a 10-second deploy animation from the habitat screen. No walkable interior |
| How the helicopter picks where to fly: cover the route corridor first, then anomalies, then the most uncertain cells, within Ingenuity-class limits (about 700 m and 3 minutes per flight) | 3 | 3 | 3 | 3 | 3 | **15** | **Keep.** Explainable autonomy, about 100 lines of code, testable |
| 3D reconstruction from simulated helicopter images | 2 | 2 | 0 | 1 | 2 | **7** | **Cut.** Instead the helicopter reveals *real* higher-resolution NASA data: full HiRISE terrain and images stand in for what a helicopter would see, labelled as such |
| Map the terrain with sound, the way bats echolocate | 1 | 1 | 2 | 0 | 3 | **7** | **Cut as a sensor.** Mars' thin air loses high-pitched sound within about 8 m, and the rotors drown the echo. **Keep the idea:** same principle with light (lidar) or plain cameras. See `RESEARCH.md` §13 |
| Lidar-style scan sweep as the helicopter flies: rays hit the real terrain, dots build up, full detail fades in | 2 | 3 | 3 | 3 | 3 | **14** | **Keep.** Explains how the helicopter sees in one glance. Label it "simulated scan, real NASA terrain" |
| Our own photogrammetry from real Ingenuity images | 1 | 2 | 1 | 3 | 3 | **10** | **Simplify** to a citation. Ingenuity flew at Jezero, not in our Gale slice; JPL already built 5 cm terrain from its images, which is our proof the method works |
| A ground-penetrating radar layer | 1 | 1 | 1 | 2 | 3 | **8** | **Cut for now.** No walk-scale radar data for our slice. Mention it as next step (NASA's SkyFall helicopters will carry it, 2028) |
| The helicopter also flies to anomalies: hazard anomalies (layers disagree: image looks firm but thermal says sand; slope near the limit) and science anomalies (unusual mineral signal near a target) | 3 | 3 | 3 | 3 | 3 | **15** | **Keep.** One extra term in the helicopter's priority score, computed from layers we already have. It makes the scout find both danger and science |
| 3D used as a visual aid; all route maths on the 2D grid with a height per cell | 3 | 3 | 3 | 3 | 3 | **15** | **Keep.** People walk on the surface, so a separate 3D graph adds work and nothing else |
| Aim the pitch at Best Use of Science first | 3 | 3 | 3 | 3 | 3 | **15** | **Keep.** Our strongest fit: real data from eight instrument types, and every claim tested |
| Make Azure real for Best Use of Technology: host on Azure Static Web Apps and run CAPCOM on Microsoft Foundry | 2 | 3 | 2 | 3 | 3 | **13** | **Keep.** Without Azure we are not eligible. CAPCOM moves to Jules so it doesn't wait on Person X |
| Art & Technology through the 3D view, scan sweep and HUD | 2 | 2 | 3 | 3 | 3 | **13** | **Keep**, as polish only |
| Build features for Global Connection | 1 | 1 | 2 | 2 | 3 | **9** | **Simplify** to one line about the GeoJSON export and the public link |
| Rock detection on real HiRISE images using the shadow method NASA used for landing sites | 3 | 3 | 2 | 3 | 3 | **14** | **Keep.** Real computer vision on real NASA data. Person 1's first job |
| A classifier on images rendered by our game engine | 1 | 1 | 1 | 0 | 2 | **5** | **Cut.** It would only learn our own textures |
| AI4Mars ground classifier on real rover photos at stops | 2 | 2 | 2 | 3 | 3 | **12** | **Keep**, after rock detection |
| "Why this route" panel: cost per stretch, the alternative it rejected, slope, rocks, sand, margin home | 3 | 3 | 3 | 3 | 3 | **15** | **Keep.** This is the answer to "why is this route feasible" |
| One web app in three.js that anyone can open, play, and view | 3 | 3 | 3 | 3 | 3 | **15** | **Keep. This settles the stack: web.** Unity would need a second codebase for the viewer |
| Share the map with mission control, other crew and scientists (export a map package and a GeoJSON file; it "arrives" after the delay) | 2 | 2 | 3 | 3 | 3 | **13** | **Keep** as an export. Cut live syncing |
| Live multiplayer sync with mission control | 1 | 1 | 1 | 2 | 2 | **7** | **Cut.** Show the delay instead |
| Packing list from the route | 3 | 2 | 3 | 3 | 3 | **14** | **Keep** |
| Simulate one 2 × 2 km slice of Gale, not the whole planet | 3 | 2 | 3 | 3 | 3 | **14** | **Keep.** Hyperlocal is what the challenge asks for, and USGS already publishes 1 m terrain and 25 cm images there |
| Use NASA Worldview (Earth imagery) in the Mars map | 0 | 0 | 3 | 1 | 3 | **7** | **Cut.** It has no Mars data; we say so instead of forcing it in |
| Use Perseverance raw images at a Gale site | 1 | 2 | 3 | 3 | 3 | **12** | **Keep, as a classifier test.** Stop photos come from Curiosity, the rover that was actually there |
| Walk-back ring and walking with real steps | 3 | 3 | 3 | 3 | 3 | **15** | **Keep.** Foundation |
| The map grows from walk logs | 2 | 2 | 2 | 3 | 3 | **12** | **Keep**, overnight |
| Buddy rover trained with reinforcement learning | 2 | 2 | 1 | 3 | 3 | **11** | **Simplify.** Scripted rover first; RL only if Person 1 finishes rock detection early |
| CAPCOM LLM agent | 1 | 2 | 2 | 3 | 3 | **11** | **Simplify.** Build only if the Azure track requires it; otherwise a recorded delayed message |

## What changes because of these grades

1. **The stack is web (three.js).** The same app is the game, the habitat display, the suit display and the public viewer.
2. **Person 1's first job is rock detection on real HiRISE images.** The terrain classifier comes second; the RL rover is a stretch goal.
3. **The helicopter reveals real data, not a fake reconstruction.** Before the scout flies, the map shows coarse orbital data. After, it shows full-resolution HiRISE terrain and detected rocks, and the route re-plans.
4. **The demo starts at a random spot inside the prepared site**, with a 10-second deploy, not a spaceship level.
5. **Every route comes with its reasons**, and the map can be exported for others.

## Rules for future ideas

- Grade it here before building it. If it scores 8 or less, it is a pitch line, not a feature.
- Anything simulated is labelled "simulated" on screen and in the pitch.
- No new feature after Sun 08:00.
