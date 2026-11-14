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
| Ingenuity flew on Mars 2021–2024, first flight April 19, 2021, first powered controlled flight on another planet | **Correct.** 72 flights; longest about 705 m; longest 169.5 s; up to 24 m high ([Space.com](https://www.space.com/mars-helicopter-ingenuity-longest-flight-december-2023), [Planetary Society](https://www.planetary.org/space-missions/ingenuity)) |
| A drone can find hazards orbit misses | **Correct in practice.** Ingenuity's images helped plan Perseverance's routes ([Universe Today](https://www.universetoday.com/152365/thanks-to-ingenuitys-pictures-perseverance-knows-where-to-drive-to-next)) |
| Rocks can be detected automatically from overhead images | **Correct, and NASA relies on it.** Shadow-based rock counts on HiRISE images were used to choose or check the Phoenix, Gale, Jezero and InSight landing sites ([JPL](https://robotics.jpl.nasa.gov/what-we-do/flight-projects/phoenix-mars-lander/landing-site-characterization), [Golombek et al. 2021](https://authors.library.caltech.edu/records/d1t32-akr32/files/Earth_and_Space_Science_-_2021_-_Golombek_-_Rock_Size_u2010Frequency_Distributions_at_the_InSight_Landing_Site_Mars.pdf?download=1)) |
| We can drop the player anywhere on Mars | **Not with real data.** HiRISE images and terrain models cover only a small fraction of Mars, so a random spot usually has no hyperlocal data |
| We can rebuild 3D from the drone's simulated camera | **Circular.** Rebuilding 3D from images our own engine rendered proves nothing about Mars |

## Grades

| Idea | Fit | Judges | Feasible | Honest | Safe | Total | Verdict and what to do |
|---|---|---|---|---|---|---|---|
| Drone scout demo in the game: deploy, explore, reveal, re-plan | 3 | 3 | 2 | 2 | 3 | **13** | **Keep.** It is the solution in action. Label the flight as simulated |
| Drop the player anywhere on Mars at random | 1 | 1 | 0 | 1 | 1 | **4** | **Cut.** No hyperlocal data at most places, and it loses the science goal |
| Random start inside our prepared site (Gale; maybe Jezero) | 3 | 2 | 3 | 3 | 3 | **14** | **Keep.** Same idea, real data everywhere |
| Start inside the spaceship and walk to the drone | 2 | 2 | 1 | 3 | 2 | **10** | **Simplify** to a 10-second deploy animation from the habitat screen. No walkable interior |
| How the drone picks where to fly: cover the route corridor first, then the most uncertain cells, within Ingenuity-class limits (about 700 m and 3 minutes per flight) | 3 | 3 | 3 | 3 | 3 | **15** | **Keep.** Explainable autonomy, about 100 lines of code, testable |
| 3D reconstruction from simulated drone images | 2 | 2 | 0 | 1 | 2 | **7** | **Cut.** Instead the drone reveals *real* higher-resolution NASA data: full HiRISE terrain and images stand in for what a drone would see, labelled as such |
| Rock detection on real HiRISE images using the shadow method NASA used for landing sites | 3 | 3 | 2 | 3 | 3 | **14** | **Keep.** Real computer vision on real NASA data. Person 1's first job |
| A classifier on images rendered by our game engine | 1 | 1 | 1 | 0 | 2 | **5** | **Cut.** It would only learn our own textures |
| AI4Mars ground classifier on real rover photos at stops | 2 | 2 | 2 | 3 | 3 | **12** | **Keep**, after rock detection |
| "Why this route" panel: cost per stretch, the alternative it rejected, slope, rocks, sand, margin home | 3 | 3 | 3 | 3 | 3 | **15** | **Keep.** This is the answer to "why is this route feasible" |
| One web app in three.js that anyone can open, play, and view | 3 | 3 | 3 | 3 | 3 | **15** | **Keep. This settles the stack: web.** Unity would need a second codebase for the viewer |
| Share the map with mission control, other crew and scientists (export a map package and a GeoJSON file; it "arrives" after the delay) | 2 | 2 | 3 | 3 | 3 | **13** | **Keep** as an export. Cut live syncing |
| Live multiplayer sync with mission control | 1 | 1 | 1 | 2 | 2 | **7** | **Cut.** Show the delay instead |
| Packing list from the route | 3 | 2 | 3 | 3 | 3 | **14** | **Keep** |
| Walk-back ring and walking with real steps | 3 | 3 | 3 | 3 | 3 | **15** | **Keep.** Foundation |
| The map grows from walk logs | 2 | 2 | 2 | 3 | 3 | **12** | **Keep**, overnight |
| Buddy rover trained with reinforcement learning | 2 | 2 | 1 | 3 | 3 | **11** | **Simplify.** Scripted rover first; RL only if Person 1 finishes rock detection early |
| CAPCOM LLM agent | 1 | 2 | 2 | 3 | 3 | **11** | **Simplify.** Build only if the Azure track requires it; otherwise a recorded delayed message |

## What changes because of these grades

1. **The stack is web (three.js).** The same app is the game, the habitat display, the suit display and the public viewer.
2. **Person 1's first job is rock detection on real HiRISE images.** The terrain classifier comes second; the RL rover is a stretch goal.
3. **The drone reveals real data, not a fake reconstruction.** Before the scout flies, the map shows coarse orbital data. After, it shows full-resolution HiRISE terrain and detected rocks, and the route re-plans.
4. **The demo starts at a random spot inside the prepared site**, with a 10-second deploy, not a spaceship level.
5. **Every route comes with its reasons**, and the map can be exported for others.

## Rules for future ideas

- Grade it here before building it. If it scores 8 or less, it is a pitch line, not a feature.
- Anything simulated is labelled "simulated" on screen and in the pitch.
- No new feature after Sun 08:00.
