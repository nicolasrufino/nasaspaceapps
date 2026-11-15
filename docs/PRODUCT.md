# What Martian Map is, and why it works

Read this first. It explains the product in order: the challenge, our answer, each stage and why it exists, and why our answer beats the alternatives on every objective NASA set.

## 1. The challenge

NASA asks for **a layered map of one place on Mars, built from several NASA missions, that helps astronauts plan and carry out a surface walk safely while doing new science.** The map must:

- combine data from several missions into one view (R1);
- start from a science goal and a site, such as the boxwork ridges on Mount Sharp (R2);
- layer at least three kinds of data (R3);
- put safety first: space weather, what a suited person can carry and climb, a route around obstacles (R4);
- work at the scale of **one walk**, not a region (R5).

## 2. The problem underneath

Two facts make this hard.

1. **No map is detailed enough for one walk.** The map that covers almost all of Mars (the CTX mosaic) is 5 m per pixel. The sharpest images (HiRISE, 25 cm) cover only about 3 to 5% of the planet. Even HiRISE misses rocks smaller than about 1 m and cannot tell firm ground from soft sand. In NASA's 2022 field test in Arizona, crews had 1 m maps, and the first walk still hit slopes and drop-offs it could not cross and ended short.
2. **Earth cannot help in time.** A message takes 4 to 22 minutes each way. Mission control cannot guide a walk step by step the way it does on the Space Station. The crew has to carry the plan with them and make the calls on site.

## 3. Our answer

**Martian Map turns NASA's Mars data into a science walk you can plan, preview and come home from, and makes the map better with every walk.**

What it is, concretely: **one app, three views of the same map.**

- **The habitat display** (the sol before): pick a science goal, see the layers, send the scout helicopter (it flies in daylight), approve the route and the packing list.
- **The tablet the crew carries** (during the walk): a minimap like in a video game: where you are, where to go, the path, and the layers that matter (ground, minerals, chemistry, radiation). A science checklist at each stop.
- **The helmet HUD** (during the walk): only what matters right now: how far you can still go and get home, heading, the next stop, alerts.

In the demo a phone plays the tablet and switches to the HUD view.

Who uses it: a two-person crew on Mars, before, during and after a walk. Where we build it: one 2 km × 2 km slice of lower Mount Sharp in Gale crater (see `docs/DATA.md`).

## 4. The idea in one line: coarse to fine

**Each stage sees more detail than the one before, covers less ground, and costs more. So each stage tells the next one where to look.**

Orbit sees everything, coarsely, for free. The helicopter sees fine detail, but only along a few hundred metres per flight. The crew sees everything up close, but their walk time is the most precious thing on the mission. Martian Map spends each one where it matters most.

| Stage | Sees | Covers | Costs |
|---|---|---|---|
| 1. Orbit | 5 m to 25 cm | The whole site | Nothing: NASA already collected it |
| 2. Scout helicopter | Centimetres | One route corridor | A few 3-minute flights |
| 3. Plan and pack | (uses 1 and 2) | The chosen route | Minutes of crew time |
| 4. Walk and add | Everything up close | Where the crew goes | The walk itself: oxygen, energy, risk |
| 5. Next walk | All of the above, combined | The site, growing | Nothing extra |

## 5. Each stage, and why it is there

### Stage 1: Orbit. Start from what NASA already knows

- **What happens:** the app loads NASA's orbital layers for the slice: images, elevation and slope, sand (from thermal data), minerals, the geologic map, radiation and weather measured by Curiosity.
- **Why start here:** it is the only data that exists for the whole site before anyone lands, and it is already paid for. Nobody should plan a walk blind when orbiters have been mapping Mars for 20 years.
- **What it makes easier:**
  - **Where to go:** minerals and geology point to the science (the boxwork ridges, places where water once flowed).
  - **Where not to go:** slopes too steep for a suit, sand fields, high-radiation exposure.
  - **Where to look closer:** it narrows 4 km² down to a few corridors, so the helicopter flies only where it matters.
- **Its limit, and why we don't stop here:** orbit cannot see the small things that stop a person on foot (rocks under about 1 m, soft sand, short steep steps). The JETT3 test showed that plans built on orbit-scale maps break on contact.
- **Objectives it meets:** R1 (several missions in one view), R2 (science goal to targets), R3 (several data types), R5 (one site, not a region).
- **In our demo:** the "orbit view" is a coarse version of the slice, about the detail most of Mars has.

### Stage 2: Scout. A helicopter looks before people walk

- **What happens:** in daylight on the sol before the walk, a small scout helicopter flies the planned route first: the kind NASA JPL flew on Mars (Ingenuity) and is now having AeroVironment build for crew scouting (SkyFall, launch late 2028). It covers the route corridor first, then anomalies (places where the layers disagree, such as firm-looking ground that the thermal data says is loose sand, a slope near the 20° limit, or an unusual mineral signal near a target), then the cells it is least sure about. It avoids smooth sand, where camera navigation fails (what ended Ingenuity). Where it flies, the map gains centimetre detail: the terrain and the hazards below orbit's limit (rocks under about 1.5 m, half-metre drops). The route re-plans around what it found.
- **Why a scout at all:** walk time is the scarcest resource. Finding a blocked path halfway through a walk costs oxygen, energy and maybe the walk. Finding it from the habitat costs a 3-minute flight.
- **Why a helicopter and not a rover:** an Ingenuity-class helicopter covers about 700 m in 3 minutes. A rover on autonomous driving averages about 110 m an hour.
- **Why we believe it works:** Ingenuity flew 72 times on Mars as "an aerial scout" for Perseverance's drivers; its Flight 12 images confirmed the rover's route into South Séítah was drivable. NASA's SkyFall (three helicopters, contracted, launch late 2028) will scout exploration zones for crews, and MoonFall's four hopping drones will survey Artemis sites before astronauts arrive. Every link, every limit and our answers: `docs/RESEARCH.md` §14.
- **What it makes easier:** surprises move from the walk to the planning table.
- **Objectives it meets:** R4 (route around obstacles), C6 (robots supporting the crew).
- **How it sees in 3D:** the same idea as a bat's echolocation, but with light instead of sound, because Mars' thin air loses high-pitched sound within metres. The main sensor is cameras: overlapping photos turned into 3D, already done with Ingenuity's images at 5 cm detail. A laser adds exact height; radar could later show what is underneath. Details in `docs/RESEARCH.md` §13.
- **In our demo:** the flight is simulated; what it reveals is real NASA data, the full-resolution images and elevation of the same slice, labelled "simulated helicopter view, real HiRISE data". As it flies, a scan sweep shows rays hitting the terrain and dots building up before the full detail fades in.

### Stage 3: Plan and pack. Decide before you leave

- **What happens:** Martian Map plans the best route (safe and efficient, not shortest) to the science stops. For every stretch it estimates effort, time, oxygen and radiation dose, and where the point of no return is. It shows rover photos of each stop and builds the packing list: what to bring, how heavy it is, what the buddy rover carries.
- **Why plan before leaving:** with Earth up to 22 minutes away, the plan has to be made ahead and carried by the crew. NASA plans every walk today the same way, with limits like "always able to get home in one hour".
- **Why the packing list matters:** weight changes how much energy each step costs. In NASA's 2022 test, pulling a loaded cart caused unacceptable fatigue. So the route decides the load, and the load changes the route.
- **What it makes easier:** the crew approves a plan in minutes, knowing its limits before the hatch opens, instead of building it by hand.
- **Objectives it meets:** R4 (suit mobility and loads, radiation, safe route), C5 (rover photos of each stop), C1 (habitat display).

### Stage 4: Walk and add. Guide the walk, and learn from it

- **What happens:** on the suit display, real steps move the astronaut along the route. A ring on the map shows how far they can still go and get home, and it shrinks with every step. Past the point of no return, it alerts. At each stop, a short checklist: look, get close, decide, sample or move on. Along the way the map grows: photos, ground type (read by our classifier), how hard each stretch really was, markers and sample sites.
- **Why guide on the device:** Earth can't do it in time, so the safety check has to run with the crew.
- **Why add to the map:** the plan is a prediction; the walk is a measurement. The crew is the most detailed sensor on Mars, and every step they take confirms or corrects the map.
- **What it makes easier:** the crew focuses on science while the app watches the margin home.
- **Objectives it meets:** R4 (safety during the walk), R2 (the science at each stop), C2 (a tool that makes maps, not a static one).

### Stage 5: Next walk. Start from a better map

- **What happens:** everything from the walk (corrected terrain, real effort, new hazards, samples taken) goes back into the site's map. The next plan starts from it.
- **Why:** each walk makes the next one safer and lets it go further, because less margin is spent on what nobody knew.
- **What it makes easier:** walks get longer and more productive over the mission, and the same tool trains crews on Earth before they go.
- **Objectives it meets:** C2 (a map-making tool), C3 (learning from maps and field tests).

## 6. Why this is better, objective by objective

| NASA's objective | What exists today | What Martian Map does | Why ours is better |
|---|---|---|---|
| **R1** Several missions in one view | Mars Trek and JPL's MMGIS layer the data, for rover teams and regional views | Layers from orbiters and Curiosity, combined into one walk plan | The layers don't just sit side by side; together they decide the route, the load and the margin home |
| **R2** From a science goal to a site | Scientists pick targets by hand from separate maps | Pick "boxwork"; targets light up from the minerals and geology; a checklist at each stop | The goal drives everything after it: the route, the stops, the packing list |
| **R3** At least three data types | Each tool shows its own data | All eight types NASA lists: optical, topographic, thermal, spectral, radiation, atmospheric, and chemical and geophysical as points along Curiosity's path; plus rover photos | Each layer has a job in the plan (slope limits, sand avoidance, dose), not just a picture |
| **R4** Safety: obstacles, loads, space weather | Orbit-only maps miss small hazards; plans broke in the 2022 test; voice guidance fails with delay | Scout helicopter before the walk; energy and oxygen per step; point-of-no-return alert; storm warnings | Hazards are found before the walk, and the margin home is known at every step, on the crew's side of the delay |
| **R5** Hyperlocal, one walk | Mars Trek is regional and global | One 2 × 2 km slice at walk detail, which gets finer with every walk | Detail improves exactly where people walk |
| **C5, C6** Rover views; robots and pairs | Rover photos sit in a separate gallery | Rover photos at each stop; a helicopter that scouts; a buddy rover that carries | The robots do the jobs that save crew time and strength |

The short version: **every tool that exists today does one stage. Martian Map connects all five, so each stage makes the next one better, and it runs with the crew, not on Earth.** (The option-by-option comparison is in `docs/PLAN.md`, section 0.)

## 7. What is real and what is simulated

- **Real:** every data layer (NASA orbiters and Curiosity), the full-detail view the helicopter reveals, the walking-energy model, the route and safety maths, the classifier's training labels.
- **Simulated:** the helicopter's flight, the astronaut (a judge walking with a phone), and the delay to mission control.
- **Not claimed:** that a phone is the suit display (it stands in for one), or numbers we haven't measured. Every number in the pitch comes from our code.

## Sources

- [Murray Lab, Caltech: Global CTX mosaic, 5 m per pixel, 99.5% of Mars](https://murray-lab.caltech.edu/CTX/)
- [EPSC-DPS 2025: HiRISE unique coverage about 5% of Mars](https://meetingorganizer.copernicus.org/EPSC-DPS2025/EPSC-DPS2025-860.html)
- [NASA JETT3 test report (2022)](https://ntrs.nasa.gov/api/citations/20230010686/downloads/EHP-20021_JETT3_Test_Report_Baseline_20230010686.pdf)
- [NASA: Tenets of lunar EVA for Artemis](https://ntrs.nasa.gov/api/citations/20230008183/downloads/Tenets%20of%20Lunar%20EVA%20for%20Artemis%20III_Public%20Release.pdf)
- [JPL: Perseverance mobility and AutoNav speed](https://robotics.jpl.nasa.gov/what-we-do/flight-projects/mars-2020-rover/m2020mobility/)
- Ingenuity, Skyfall, and the rest: `docs/RESEARCH.md`
