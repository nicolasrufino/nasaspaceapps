# Research: how surface exploration actually works

Where NASA is today, what recent field tests found, and what that means for Martian Map. Every fact links to its source. Researched Nov 14, 2026.

**Context:** in February 2026 NASA turned Artemis III into a crewed test flight in Earth orbit (mid-2027) and moved the first crewed Moon landing to **Artemis IV, early 2028** ([Live Science](https://www.livescience.com/space/space-exploration/nasa-announces-sweeping-overhaul-of-artemis-return-to-moon-targeting-a-2028-landing-and-a-2027-in-orbit-docking-flight)). Mars surface EVAs are planned in NASA's Design Reference Architecture 5.0.

## 1. Where things stand today (2024–2026)

What exists now, in the areas the challenge covers, and what is missing.

| Area | Today | What is missing for a human Marswalk |
|---|---|---|
| **Mars maps** | NASA's Mars Trek and the USGS-NASA geologic maps layer data over regional and global views; a 5.7-terapixel CTX mosaic covers almost all of Mars at about 5 m per pixel ([Caltech](https://www.caltech.edu/about/news/scientists-unveil-a-57-terapixel-global-image-of-mars)) | The challenge itself says these are "built for regional and global views rather than the hyperlocalized areas astronauts will target" |
| **Rover operations** | JPL's MMGIS layers orbital and rover maps for Curiosity and Perseverance operations ([JPL](https://www.jpl.nasa.gov/news/mapping-the-red-planet-with-the-power-of-open-science/)); drivers mark waypoints and hazards in MobSketch; Perseverance's AutoNav chooses its own path between assigned stops ([NASA](https://science.nasa.gov/resource/how-perseverance-drives-on-mars/)) | Built for rover teams on Earth with delay, not for a person in a suit on site |
| **Current science at our site** | Curiosity spent June–November 2025 among boxwork ridges on Mount Sharp: ridges 1–2 m tall with sandy hollows, in a sulfate-rich layer that formed as water dried out; how they formed is still open ([JPL](https://www.jpl.nasa.gov/news/nasas-curiosity-mars-rover-starts-unpacking-boxwork-formations/)) | A question a human could answer faster on foot, which is why the challenge names it |
| **Human surface walks** | Artemis rules: at most 2 km from the lander, sized to a 1-hour return on contingency oxygen; EVAs planned with map books in the AEGIS tool; JETT field tests in Arizona (2022, 2024) | The first crewed landing is now planned for Artemis IV, early 2028 |
| **Mars human architecture** | NASA's Mars plans: pressurized and unpressurized rovers, about 20 km of walking per backpack charge, crews of 2–4; BASALT tested Mars-like EVAs with 5–15 minutes of delay | No crew-side tool combines the map, the science and the safety limits |
| **Robots beside crew** | Lunar Terrain Vehicles that drive with or without crew (awards May 2026); CADRE, MoonFall, ARCHES and Surface Avatar test robot teams | The one follow-me astronaut assistant (BioBot) is on hold |
| **Displays and phones** | NASA SUITS builds helmet displays; astronauts have flown personal smartphones since Feb 2026 (Crew-12, Artemis II) | Displays show scenario data, not real layered terrain |
| **NASA priorities** | FY26 technology gaps: surface mobility #2 of 32; robots + crew #10; need 8.06 "in-situ decision support tools" for Mars EVA hazards | Our exact target |

## 2. How NASA plans a surface walk today

- **Artemis rules (2023 "Tenets"):** at most **2 km from the lander**, sized so the crew can get back in **1 hour on contingency oxygen**; communications may cut the range to 500 m–2 km and live video to about 300 m; every EVA keeps a reserve, so planned EVAs may be shorter than 8 hours. ([NTRS](https://ntrs.nasa.gov/api/citations/20230008183/downloads/Tenets%20of%20Lunar%20EVA%20for%20Artemis%20III_Public%20Release.pdf))
- **How Artemis EVAs are planned:** ground teams group science targets into EVAs within limits set by flight operations (maximum distance, maximum slope, maximum time without line of sight, consumables redlines). The crew gets a **map book** (slope, lighting, comm coverage), a **cuff checklist**, procedures and flight rules. The mapping tool is AEGIS, the Artemis EVA Geographic Information System. ([NTRS 2025](https://ntrs.nasa.gov/api/citations/20250006988/downloads/ASCEND%20presentation%20-%20Planning%20Lunar%20EVAs.pdf))
- **Mars (DRA 5.0):** one habitat, two small pressurized rovers, two unpressurized rovers; about **20 km of walking per backpack charge**; EVA teams of 2–4. With one rover the crew must stay within walkback or rescue range; with two, each rover can rescue the other. Regions of interest lie within about 100 km of the landing site. ([NASA SP-2009-566](https://www.nasa.gov/pdf/373665main_NASA-SP-2009-566.pdf), [NTRS 2018](https://ntrs.nasa.gov/api/citations/20180006483/downloads/20180006483.pdf))
- **Mars with delay (BASALT analog):** 5- or 15-minute one-way delay, EVAs of about 4 hours, timelines with flexible buffers, the ground ranked samples on "leaderboards", and **the crew had final authority; the ground only advised.** BASALT used the Playbook tool, which re-projects the timeline from how long phases actually took. ([PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC6442237), [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC6442304))

**Where these rules came from (Apollo, 1969–72).** The walkback limit (if the rover fails, walk home on what is left) and the rideback limit (if the backpack fails, ride home on the emergency system) were first set for Apollo, with emergency routes "planned with the same care as the nominal traverses" ([NTRS 1970](https://ntrs.nasa.gov/api/citations/19700009560/downloads/19700009560.pdf)). Apollo 14–17 also carried a buddy hose to share cooling water. Artemis keeps the same idea with modern numbers.

## 3. The terrain nobody has seen up close

- **Orbit cannot see everything:** the Moon's best camera (LROC, about 0.5 m per pixel) reliably shows boulders of about 1 m and larger; Mars' HiRISE resolves 25–32 cm per pixel. ([NTRS](https://ntrs.nasa.gov/api/citations/20170001954/downloads/20170001954.pdf))
- **Plans break on contact:** in NASA's JETT3 field test (2022), maps matched what Artemis will have (1 m images, 1.5 m elevation). EVA 1 hit slopes over 16° and impassable drop-offs and ended short; EVAs 3 and 4 were replanned and shortened. Crews were told the planned path was a guide, not mandatory. ([NTRS JETT3](https://ntrs.nasa.gov/api/citations/20230010686/downloads/EHP-20021_JETT3_Test_Report_Baseline_20230010686.pdf))
- **Scouting first:** NASA Ames' "robotic recon" drives a rover over planned routes before the EVA to check hazards and rank targets; K10 rovers drove 45 km, mostly autonomously, at Haughton Crater in 2008. ([CMU/Ames](https://ewh.ieee.org/conf/icra/2008/workshops/PlanetaryRovers/03Fong/icra08-prw-fong-1.pdf)) At Black Point Lava Flow, a remotely driven rover scouted routes, the routes were revised, then two-person crews drove them ([Fong, Bualat et al.](https://ri.cmu.edu/publications/assessment-of-robotic-recon-for-human-exploration-of-the-moon)).

## 4. It is slow

| Measure | Value | Source |
|---|---|---|
| Apollo 14 walking | 2.4 km/h average over 2.9 km | [NTRS 1975](https://ntrs.nasa.gov/api/citations/19750006325/downloads/19750006325.pdf) |
| Apollo average metabolic rate, all EVAs | about 272 W (riding 143 W, geology stops 284 W) | same |
| JETT3 planning speed | 1.6 km/h; EVAs ended at 3:27, 3:06, 4:45 against plans of 4, 4, 6 h | [NTRS JETT3](https://ntrs.nasa.gov/api/citations/20230010686/downloads/EHP-20021_JETT3_Test_Report_Baseline_20230010686.pdf) |
| Fixed overhead per EVA | 1.5–2 h, plus up to 30 min of dust removal | [NTRS Tenets](https://ntrs.nasa.gov/api/citations/20230008183/downloads/Tenets%20of%20Lunar%20EVA%20for%20Artemis%20III_Public%20Release.pdf) |
| Apollo 14 at Cone Crater | stopped about 40 m short of the rim, about 15 min behind the timeline | [NASA SVS](https://svs.gsfc.nasa.gov/4883) |

Crews keep a comfortable effort and their speed changes with the terrain; NASA concluded speed predictions "will likely require adjustment after the first few EVAs."

## 5. What runs out first

- **EVA time is limited by** oxygen, CO2 removal, cooling water, battery power and crew fatigue. NASA's own range table assumes about 2 km/h on level ground and **ignores slope**. ([NASA 2020](https://www.nasa.gov/wp-content/uploads/2020/01/topic_1-_eva_lunar_surface_concept_of_operations.pdf))
- **All of them follow effort.** Oxygen used, CO2 made and heat to reject all scale with metabolic rate (about 20 kJ of work per litre of oxygen). That is why our ring is computed from walking energy: it is the common driver of every consumable.
- **Mars changes cooling:** Apollo's sublimator needs a vacuum and is "infeasible on the Mars surface" (about 4.6 Torr); a water-membrane evaporator still worked up to 10 Torr. A Mars backpack sized for an 8-hour EVA: about 88 kg of hardware, 8.6 kg of oxygen, 2.9 kg of water. ([NTRS ICES 2026](https://ntrs.nasa.gov/api/citations/20260003024/downloads/Final_ICES2026_Mars_PLSS_Plan.pdf), [NTRS 2025](https://ntrs.nasa.gov/api/citations/20250006266/downloads/ICES_Mars_Presentation.pdf))

## 6. Who carries what

- **Apollo:** the handcart carried about 160 kg of tools and samples (Apollo 14 crews sometimes lifted it because that was faster); the rover carried 490 kg. ([NASM](https://airandspace.si.edu/collection-objects/mobile-equipment-transporter/nasm_A19730123000), [NSSDC](https://nssdc.gsfc.nasa.gov/planetary/lunar/apollo_lrv.html))
- **JETT3:** pushing a loaded cart caused unacceptable fatigue, so tools came off it; and **when comms got poor, one crew member became a stationary relay and did no science.**
- **DRA 5.0:** move navigation, long-range comms, tools and spare consumables from the suit to the rover; rovers reduce fatigue and save consumables.

## 7. Robots that work next to astronauts

**What is being built now**
- **Lunar Terrain Vehicle (May 26, 2026):** NASA picked Astrolab (about $219M) and Lunar Outpost (about $220M, Pegasus, with GM, Goodyear and Leidos) from a contract worth up to $4.6B. Both drive **with or without crew**, up to 10 km/h, 20° slopes, 200 km range; on the Moon by 2028. Blue Origin delivers them ($188M). [spacepolicyonline](https://spacepolicyonline.com/news/nasa-awards-initial-moon-base-rover-and-lander-contracts/)
- **JPL CADRE:** three small rovers that share maps and positions; flying on IM-3 (no earlier than Q1 2027). [NASA](https://www.nasa.gov/cooperative-autonomous-distributed-robotic-exploration-cadre)
- **MoonFall:** four JPL drones that hop on rocket thrust (no rotors) to survey Artemis landing sites at the south pole before astronauts arrive, including slopes rovers cannot reach; Firefly's $75M subcontract delivers them, no earlier than 2028. [Space.com](https://www.space.com/astronomy/moon/nasa-wants-to-use-a-fleet-of-moonfall-drones-to-scout-the-lunar-south-pole-we-believe-we-can-do-it)
- **ARCHES (Mount Etna, 2022, DLR/ESA):** robots in roles: a "scientist" rover, an "assistant" rover that also relays WiFi, and a "scout" drone; an astronaut drove a rover 23 km away with haptic feedback. Surface Avatar (2023–2025) had ISS astronauts command mixed teams including a humanoid and Spot. [DLR](https://www.dlr.de/en/rm/latest/news/2022/robotics-team-practises-lunar-exploration-on-mount-etna), [DLR 2025](https://www.dlr.de/en/rm/latest/news/2025/surface-avatar-successful-completed)
- **Legged robots:** ETH's three ANYmal robots won the ESA-ESRIC Space Resources Challenge; JPL's NeBula-Spot is being developed to map caves on the Moon and Mars, without GPS. [ScienceDaily](https://www.sciencedaily.com/releases/2023/07/230712165135.htm), [JPL](https://www.jpl.nasa.gov/robotics-at-jpl/nebula-spot)
- **Follow-me astronaut assistants:** Maryland's BioBot (NIAC) followed an astronaut and handled a suit umbilical, now on hold; a 2025 NASA report studies a rover that trails an astronaut closely. [phys.org](https://phys.org/news/2024-07-robotic-rover-astronauts-moonwalks.html), [NTRS](https://ntrs.nasa.gov/citations/20250006905)

**Can a robot keep up?**

| Who | Speed |
|---|---|
| Suited astronaut walking (Apollo walkback planning) | 3.3 km/h ([NASA ALSJ](https://www.nasa.gov/wp-content/uploads/static/history/alsj/19790073512_1979073512.pdf)) |
| Perseverance on AutoNav | about 110 m/h average, 152 m/h top ([JPL](https://robotics.jpl.nasa.gov/what-we-do/flight-projects/mars-2020-rover/m2020mobility/)) |
| Curiosity | 144 m/h top |
| Apollo LRV | 10 km/h used in planning |
| Lunar Terrain Vehicle | up to 10 km/h |

**Today's Mars rovers are 20–30 times slower than a walking astronaut.** A buddy that keeps up must be LTV-class. Our buddy rover is specified that way.

**How "follow me" works on real robots:** an ultra-wideband (UWB) tag on the person and anchors on the robot (used on Antarctic robots because it works where cameras fail); UWB plus lidar cut tracking error by 55%; **visual teach-and-repeat** lets a rover replay a path it drove before, without GPS (1.1 km, more than 10 repeats, 99.7% autonomous). [Furgale & Barfoot](https://furgalep.github.io/sbib/furgale_jfr10.pdf)

**What earlier human-robot field tests learned:** in Surface Telerobotics (2013), ISS crew drove NASA's K10 rover for 11 hours; safeguarded driving kept workload low, a 3D view of the robot's state kept crew aware, and "send a sequence, then monitor" worked best. [NTRS](https://ntrs.nasa.gov/citations/20150007985)

## 8. Hazards on the Martian surface

| Hazard | What the evidence says | What we do |
|---|---|---|
| **Wind** | Mars air is about 1% of Earth's density. A 30 m/s storm wind pushes like a 12 km/h breeze on Earth (our estimate: about 9 N on a person). NASA: wind will not topple people or vehicles; the danger is the dust. [NASA](https://science.nasa.gov/solar-system/planets/mars/10-things-massive-dust-storm-on-mars/) | No wind force. Model dust and visibility |
| **Dust** | Opportunity's 2018 storm reached opacity 10.8 (normal about 0.5) and ended the mission. Apollo dust wore suits and seals. Static discharges occur in dust devils. [JPL](https://www.jpl.nasa.gov/news/six-things-about-opportunitys-recovery-efforts/) | Dust level lowers rover solar power and camera quality |
| **Radiation** | Background 0.67 mSv per day on the surface; the May 2024 solar storm would have given 8,100 µGy (about 30 chest X-rays) to someone next to Curiosity. [JPL](https://www.jpl.nasa.gov/news/nasa-watches-mars-light-up-during-epic-solar-storm) | Solar-storm alert with minutes to the nearest shelter |
| **Terrain traps** | Spirit got stuck in sand in 2009 and never moved again; rocks punctured Curiosity's wheels. [JPL](https://www.jpl.nasa.gov/news/an-algorithm-helps-protect-mars-curiositys-wheels/) | Sand costs more and is flagged; slope limits |
| **Temperature** | Air from +16 °C to −100 °C; daily swings over 55 °C. | Shown, not modeled |
| **Communications** | One-way delay about 3–22 minutes; almost all data goes through orbiters; solar conjunction stops commands for about two weeks every two years. [NASA](https://www.nasa.gov/wp-content/uploads/2024/01/mars-communications-disruption-and-delay.pdf) | Delay to Earth shown; everything works offline |
| **Navigation** | No GPS. Rovers use visual odometry, which struggles on featureless sand. [JPL](https://robotics.jpl.nasa.gov/what-we-do/flight-projects/mars-exploration-rovers/surface-navigation/) | Step counting plus heading, matched to the map |

## 9. Who controls the robot, and what happens when things go wrong

- **The Moon allows remote driving; Mars does not.** Moon round trip is about 2.6 s (in LTV tests, 4–8 s of delay already slowed drivers and raised workload). Mars round trip is 6–44 minutes, so control has to be by the crew nearby or by the robot itself. [NTRS](https://ntrs.nasa.gov/citations/20240001217)
- **Crew-local control works:** shown at ARCHES, Surface Avatar and Surface Telerobotics.
- **Autonomy in layers:** fast safety reactions (stop before an obstacle) are automatic; slow decisions (where to go) stay with people.
- **On lost signal, rovers go to a safe mode** and wait for scheduled contact windows (Curiosity 2013).
- **A physical emergency stop** was used in Canada's 2014 analog mission.

**The override ladder in our app:** **E-STOP** → **Hold here** → **Come to me** → **Return to base** (replay the breadcrumb path) → manual joystick. On a lost link, the rover stops, then retreats along the breadcrumb path.

## 10. Why a robot at all, and what it does

Robots are not there because astronauts cannot walk. They are there because **crew time and crew energy are the scarcest things on the surface**, and the research shows four places where a robot gives both back:

| Robot job | Problem it solves | Evidence |
|---|---|---|
| **Scout / lead** | Orbital maps miss small hazards; plans break on the first slope | JETT3; Ames robotic recon; D-RATS 2022: "rover leads, crew follows" rated acceptable, "crew leads" not ([NTRS](https://ntrs.nasa.gov/api/citations/20230017073/downloads/D-RATS%202022%20Test%20Report%20Final.pdf)) |
| **Mule** | Carrying tools and samples tires the crew and burns consumables | JETT3 cart fatigue; Apollo handcart; DRA 5.0 |
| **Relay** | Comms drop behind ridges; a crew member had to stand still as a relay | JETT3; ARCHES relay rover |
| **Rescue / ride-back** | If a suit degrades far from base, walking home is not possible | Apollo rideback limit; DRA 5.0 rovers rescue each other; BioBot and DFKI crew-support concepts |
| **Breadcrumb home** | No GPS on Mars; the way back must be known | Visual teach-and-repeat |

**Why not send only robots?** Humans do adaptive, serendipitous science much faster; Steve Squyres wrote that what the Mars rovers did in a perfect day "a human explorer could do in less than a minute" (*Roving Mars*, 2005). The goal is teaming: robots take the cold, slow, heavy and risky work so the crew spends its limited hours on science.

## 11. Who is funding this, and where the gap is

| Program | Money | What it means for us |
|---|---|---|
| Lunar Terrain Vehicle (Astrolab, Lunar Outpost) | Contract ceiling up to $4.6B; awards about $219M and $220M; Blue Origin $188M to deliver | Rovers that drive **with or without crew** are funded; a decision layer for the person next to them is not |
| Axiom AxEMU suits | First task order about $228M; orders capped at $3.1B; readiness may slip to 2031 (NASA OIG) | The suit display needs exactly this kind of information |
| MoonFall hopping drones | $75M delivery (Firefly) | Scouting before people arrive is funded |
| VIPER (revived on Blue Moon) | about $190M initial | Robotic prospecting continues |
| JPL CADRE | Flight on IM-3 (2027) | Multi-robot teamwork is being tested |
| Lunar Outpost | $30M Series B (May 2026) | Private money follows rover contracts |
| BioBot follow-me astronaut assistant (NIAC) | **On hold, no further NASA funding** | **The gap: robots built to work beside a walking astronaut** |
| NASA FY26 shortfalls | Surface mobility ranked #2 of 32; robots + crew cooperation #10; need 8.06 "in-situ decision support tools" for Mars EVA hazards | Our exact target |

## 12. What this changes in our design

1. **The ring is the walkback limit, live.** Computed along real routes on real slopes, not a circle; the reserve covers a 1-hour emergency return plus about 30 minutes of dust removal and getting back inside.
2. **Show the limiting consumable.** Energy drives oxygen, CO2 and heat; the HUD converts energy to oxygen left.
3. **Two rings:** walk-back (if the rover fails) and ride-back (if the suit degrades and the rover is healthy). Do not stack failures, the same rule NASA uses.
4. **The buddy rover leads by default** and is LTV-class (km/h, not Perseverance's 110 m/h). Modes: lead/scout, heel, carry, relay, rescue, return along the breadcrumb path.
5. **Override ladder:** E-STOP, hold, come to me, return to base, manual. On lost link: stop, then retreat along the breadcrumb path.
6. **Hazards first:** slope and sand traps, solar-storm shelter time, dust (power and visibility), line of sight to the rover and habitat. Not wind force.
7. **Expect replans:** routes are guides; the ring recomputes the instant the crew deviates; optional "get-ahead" stops when margin allows.
8. **Learn the real pace:** update speed and energy from measured steps; first-EVA predictions will be wrong, so the debrief closes the loop.

## 13. How a scout drone sees in 3D

### Echolocation: how bats do it

A bat makes a short, very high-pitched call (roughly 20 to 120 kHz, above human hearing) and listens for the echo.

- **Distance:** the time until the echo comes back. Distance = speed of sound × time ÷ 2 (the sound goes there and back).
- **Direction:** two ears. The echo reaches one ear slightly earlier and louder than the other.
- **Shape and motion:** many calls per second, and changes in the echo's pitch, build a moving 3D picture.

Dolphins, submarine sonar, car parking sensors and some indoor drones use the same idea.

### Why sound does not work on Mars

- **The air is too thin.** Mars' air is about 1% as dense as Earth's, so sounds are about 20 dB quieter. ([Nature 2022](https://doi.org/10.1038/s41586-022-04679-0))
- **High pitches die within metres.** Carbon dioxide absorbs high frequencies. A sound that carries about 65 m on Earth is lost after about 8 m on Mars, and high pitches are gone at that distance. ([DLR](https://www.dlr.de/en/latest/news/2022/02/20220401_the-sound-of-mars)) Bat-style ultrasound is the worst case.
- **There are two speeds of sound.** Sound travels about 240 m/s, and about 10 m/s faster above roughly 400 Hz, which blurs the timing that echolocation depends on. ([Nature 2022](https://doi.org/10.1038/s41586-022-04679-0))
- **The drone drowns its own echo.** Ingenuity's rotors spin about 2,400 rpm, right next to any microphone.

**Verdict:** echolocation by sound cannot map terrain from a Mars drone. The *idea* is exactly right, though. We only change what the drone sends out.

### The same idea with light: lidar

Send laser pulses instead of sound and time the echo. Light needs no air, so this works on Mars, and it works in shadow because the drone brings its own light.

- **Caves on Earth are mapped this way.** In DARPA's Subterranean Challenge (2018–2021), robots mapped caves, tunnels and buildings with no GPS, and almost every team built its maps around lidar. NASA JPL's team CoSTAR won the Urban round in 2020. ([arXiv survey](https://arxiv.org/pdf/2103.11470v3), [NASA](https://www.nasa.gov/?p=71706)) The method is called SLAM: build the map and track your own position in it at the same time.
- **Ingenuity already flew one beam of it.** A Garmin LIDAR-Lite v3 laser rangefinder pointed down and measured height 50 times a second. It was chosen because it was very light. ([Garmin](https://www.garmin.com/en-US/blog/general/garmin-on-mars/))
- **Its limit:** a full scanning lidar is heavier and uses more power, and weight is the hardest limit on a Mars helicopter.

### The same idea with radio: radar

Radio echoes pass through the ground. Ground-penetrating radar shows what is underneath: buried ice, hollows, and how deep loose sand goes. NASA's SkyFall mission (three helicopters, announced March 2026, launch late 2028) will carry cameras and ground-penetrating radar to scout exploration zones for crews and map ice. ([Space.com](https://www.space.com/astronomy/mars/nasas-skyfall-helicopters-will-show-us-parts-of-mars-weve-never-seen-before-scientists-say)) It answers "is it solid underneath?", not "where are the rocks?"

### No echo at all: cameras (photogrammetry)

Take overlapping photos from different positions. Software matches the same points across photos and works out their 3D positions. This is called structure from motion, and it is how most drone maps on Earth are made.

- **It has already been done on Mars.** A JPL study turned about 200 navigation-camera images from Ingenuity's Flight 12 into a terrain model with 5 cm spacing. ([JPL poster](https://www.jpl.nasa.gov/site/research/media/posters/2023/SP23018p.pdf))
- **At scale:** a 2025 study processed 14,553 Ingenuity images into one map, with about 3 to 6 cm of height error from 10 m up, tied to HiRISE for position. ([LPSC 2025](https://epizodyspace.ru/bibl/inostr-yazyki/Lunar_and_Planetary_Science/2025/Zubarev_et_al_The_Complete_Orthophotomosaic_of_Ingenuity_Navcam_Images_56th_LPSC_no_1302_(2025).pdf))
- **Its limits:** it needs daylight and texture, and it needs an orbital map (HiRISE) to place itself, because Mars has no GPS.

### Side by side

| Method | Sends out | Works on Mars? | What it sees | Proven on Mars? |
|---|---|---|---|---|
| Sound (sonar, like bats) | Sound | **No:** thin air, high pitches lost within metres | Nearby surfaces, on Earth | No |
| Cameras (photogrammetry) | Nothing; uses sunlight | **Yes** | Surface shape and colour, centimetre detail | **Yes:** Ingenuity's images, 5 cm terrain |
| Lidar | Laser light | **Yes** | Exact distances, also in shadow | Yes, as a single-beam altimeter |
| Radar | Radio | **Yes** | Under the surface: ice, hollows, sand depth | On rovers (Perseverance's RIMFAX); planned on NASA's SkyFall helicopters (2028) |

**What a real scout would carry:** cameras as the main 3D sensor (lightest, already proven), a laser for exact height and shadowed spots, and radar later for what lies underneath.

### How our demo shows it

We do not build a sensor. We show what the sensor does, honestly:

1. As the drone flies, it casts a fan of rays down onto the terrain, like a lidar sweep: "a bat, but with light".
2. Where a ray hits the real 1 m terrain of our slice, a dot appears. The dots build up into a point cloud.
3. Once a stretch is covered, the full-detail terrain and image fade in, the rocks appear, and the route re-plans.

**Labelled:** "simulated scan, real NASA terrain". The flight and the sweep are simulated; the terrain they reveal is the real USGS/HiRISE data. In three.js this is a raycaster against a hidden full-detail mesh, about 50 lines behind the `drone_scout` flag.

## 14. Can the scout drone actually work?

Checked Nov 14, 2026, because the whole pitch leans on it.

**Verdict: yes, as long as we claim the right job.** The drone's job is the hazards *smaller than orbit can see*: rocks under about 1.5 m, half-metre drops, the inside of a small crater. It flies in daylight on the sol before the walk. It is **not** "orbit is blurry". HiRISE already gives NASA slopes and big boulders, and a NASA judge will know that.

### The gap a drone fills

| | HiRISE (orbit, best on Mars) | Ingenuity-class drone | What a walker needs |
|---|---|---|---|
| **Rocks** | Automated shadow counts find rocks of **1.5 m and up** (about 1.2 m at best). Smaller ones are extrapolated from a model curve, not seen ([Golombek, MSL workshop](https://marsoweb.nas.nasa.gov/landingsites/msl/workshops/4th_workshop/talks/Golombek_Rocks_4th_Wkshp.pdf)) | Navcam **3.6 cm per pixel** at 10 m up; colour camera 0.5 cm per pixel ([Maki et al., LPSC 2025](https://www.hou.usra.edu/meetings/lpsc2025/pdf/2685.pdf)) | Knee-high rocks and loose blocks. NASA publishes no step-height limit for suited walkers, so don't quote one |
| **Height** | Terrain points every 1–2 m, precise to tens of centimetres ([HiRISE](https://www.uahirise.org/dtm/about.php)). Features under 3–5 pixels are averaged away ([Kirk, USGS](https://marsoweb.nas.nasa.gov/landingsites/msl/workshops/4th_workshop/talks/3_Kirk_Slopes.pdf)) | Flight 12: 5 cm terrain from about 200 images, matching HiRISE ([JPL](https://www.jpl.nasa.gov/site/research/media/posters/2023/SP23018p.pdf)). Full mission: 3.8 cm per pixel, internal height precision 3–6 cm (absolute position about 0.5 m). It shows a **0.5 m crater peak that HiRISE misses** ([Zubarev et al., LPSC 2025](https://www.hou.usra.edu/meetings/lpsc2025/pdf/1302.pdf)) | Half-metre steps and drops; suits are rated for slopes up to 20°. Walking-pace planning "does not account for slope or obstacles (e.g., boulders)" ([NASA xEVA ConOps](https://www.nasa.gov/wp-content/uploads/2017/02/eva-exp-0042_xeva_system_con_ops_rev_b_final_dtd_10192020_ref_doc.pdf)) |
| **Field tests** | JETT3 planned on orbit-resolution maps (1 m images, 1.5 m elevation); controllers found it hard to match them to what crews saw (Conclusion 1.34) ([NTRS](https://ntrs.nasa.gov/citations/20230010686)) | BASALT's aerial images at 15 cm per pixel were "not always of sufficient resolution" and the crews asked for high-resolution precursor imagery ([PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC6442241/)) | |

**Say on stage:** "HiRISE is the right tool for picking a route by slope. But it only reliably sees rocks bigger than about 1.5 m, and its terrain points are a metre apart. A walking astronaut trips on what's smaller than that. Ingenuity's images, at about 4 cm per pixel, showed a half-metre crater peak HiRISE missed. Our scout fills that last metre, right before the walk."

### Every link in the chain, and how proven it is

| Link | Status | Evidence |
|---|---|---|
| Fly on Mars | **Done on Mars** | Ingenuity: 72 flights, 17.0 km, 128.8 minutes in the air, Apr 2021 to Jan 2024, against 5 planned test flights ([NASA](https://science.nasa.gov/mission/mars-2020-perseverance/ingenuity-mars-helicopter/)). Longest flight 704 m in 161 s (Flight 25) ([JPL](https://www.jpl.nasa.gov/news/nasas-ingenuity-mars-helicopter-captures-video-of-record-flight)) |
| Scout for a ground team | **Done on Mars** | NASA called it "an aerial scout" for Perseverance's drivers. Flight 12's colour images confirmed the planned route into South Séítah was drivable. JPL's robotic ops chief engineer: "not all rover hazards can be identified" from orbit ([NASA](https://science.nasa.gov/blogs/driving-farther-and-faster-with-autonomous-navigation-and-helicopter-scouting)) |
| Photos into centimetre 3D | **Done on Mars data** | Flight 12 and full-mission terrain models (table above) |
| Re-plan around hazards | **Done daily on Mars** | Perseverance's AutoNav; our way home is a standard cheapest-path calculation |
| Scout for crews | **Contracted, not flown** | **SkyFall:** NASA announced it on Mar 24, 2026: three helicopters with cameras and ground-penetrating radar, launching late 2028 on SR-1 Freedom, to scout human exploration zones and map ice ([JPL](https://www.jpl.nasa.gov/missions/skyfall/)). AeroVironment won the build contract on Aug 27, 2026. FY27 funding is not settled, so say "contracted", not "funded". **MoonFall:** four JPL drones that hop on rocket thrust to survey Artemis landing sites before astronauts arrive; Firefly has a $75M subcontract to deliver them, no earlier than 2028 ([JPL](https://www.jpl.nasa.gov/missions/moonfall/), [SatNews](https://satnews.com/2026/05/27/firefly-aerospace-wins-75-million-nasa-jpl-moonfall-subcontract-to-deliver-drones-to-the-moons-south-pole/)) |
| A tool that computes the walk back | **Asked for by NASA** | JETT3 Conclusion 1.33: planning aids "were useful in assisting the EVA Task team in calculating walk back times", and the report recommends real-time tools ([NTRS](https://ntrs.nasa.gov/citations/20230010686)) |
| Bigger scouts | **Design studies** | Mars Science Helicopter: 31 kg, 5 kg payload, 10 minutes of hover or 5 km of range ([NTRS](https://ntrs.nasa.gov/citations/20205008552)). AeroVironment's LPSC 2025 poster: a 6 kg craft that could hover over an EVA crew and stream video ([Universe Today](https://www.universetoday.com/articles/exploring-mars-with-next-generation-helicopters)) |

### The real limits, and what we do about each

| Limit | What happened to Ingenuity | Our answer |
|---|---|---|
| **No night flying** | It navigated by camera. In winter the battery browned out and reset it every night ([NASA](https://science.nasa.gov/missions/mars-2020-perseverance/ingenuity-helicopter/ingenuity-adapts-for-mars-winter-operations/)) | Fly in daylight on the sol before; the crew plans that evening |
| **Featureless ground** | Flight 72 ended the mission: over bland sand ripples the navigation "had too little information", it landed hard and broke its blades ([JPL](https://www.jpl.nasa.gov/news/nasa-performs-first-aircraft-accident-investigation-on-another-world/)) | The scout plan does not fly over smooth sand; it routes over textured ground |
| **Lost link** | After Flight 52 a hill blocked the relay for 63 days ([New Atlas](https://newatlas.com/space/nasa-contacts-ingenuity-mars-helicopter-after-two-month-silence)) | Base station on high ground; the drone stores images until the link returns |
| **Short flights** | Battery rated for 187 s of hard flying; longest real flight about 169 s ([NASA battery paper](https://www.nasa.gov/wp-content/uploads/2024/01/battery-system-design-testing-and-operation-for-the-mars-perseverance-rover-and-ingenuity-helicopter.pdf)) | Our cap is 180 s and 700 m per flight, inside what flew. The plan flies the most important ground first |
| **Dust and winter** | Dust cut its solar charging | No-scout fallback: the route and ring fall back to orbit-only data, with less margin |
| **Can't see under a crust** | Spirit sank at Troy through a thin crust into soft sand ([USGS](https://www.usgs.gov/publications/spirit-mars-rover-mission-overview-and-selected-results-northern-home-plate-winter)) | No camera sees this. Thermal inertia flags loose ground; never claim the drone detects it |
| **Crew workload** | Remote driving with delay raised workload in LTV tests (NTRS 20240011392) | The flight is pre-planned and autonomous; the crew only reviews the re-plan |

### What this means for our build (proposal: needs P1 and P3 to agree, because it changes a contract)

Our current design has one weak spot. The "before" map is an 8 m version of the slice, and the "after" is HiRISE. HiRISE is also from orbit, so a judge can say "you already had that". Proposed fix:

1. **Before = everything HiRISE knows.** Slopes from the 1 m terrain and rocks of 1.5 m and up go into `cost_to_go` before the drone flies. The 8 m grid stays, because it keeps the app fast on a phone, not because orbit is blurry.
2. **`rocks_fine` = hazards below HiRISE's limit.**
   - Along the corridor: rocks of 0.5–1.5 m modelled from the HiRISE rock abundance with the size-frequency model NASA used for landing sites (Golombek), labelled "modelled".
   - At Curiosity's real boxwork stops: the actual ground. The rover's positions through sol 4865 come from the [localized positions CSV](https://planetarydata.jpl.nasa.gov/img/data/msl/msl_places/data_localizations/localized_pos.csv) (341 KB). Its top-down Navcam mosaics (vertical "VRT" projection) for sols 4534–4843 are in the [MSL mosaic archive](https://planetarydata.jpl.nasa.gov/img/data/msl/MSLMOS_1XXX/DATA/). They are PDS `.IMG` files; GDAL converts them. Test sol 4600 first to check alignment.
3. **The scout plan skips smooth sand.**
4. **Labels:** "simulated flight · HiRISE (orbit) and Curiosity Navcam (ground) are real · small rocks modelled from HiRISE rock abundance".
5. **R5 measures the gap:** hazards below orbit's limit that the scouted route avoids. No published study has measured what a pre-EVA scout saves, so this is a first estimate. Label it as simulated.

**Not worth it:** moving to Jezero for real Ingenuity data. No Ingenuity terrain model is downloadable, only raw images, and we would lose the boxwork and Curiosity's instruments.

### Industry check

- **SpaceX:** we found no public work on scouting or drones. Starship did not go to Mars in 2026; in February 2026 Musk said the focus is now the Moon. One useful fact: SpaceX's Paul Wooster said four candidate landing sites that looked fine in medium-resolution orbit images were "too rough" in HiRISE. Resolution decides where you can go ([Space.com](https://www.space.com/36142-spacex-studying-mars-landing-sites.html)).
- **Startups:** we found no YC or other startup doing Mars scouting or walk-scale maps. Cosmic Robotics (YC S26) builds construction robots for the Moon and Mars ([YC](https://www.ycombinator.com/companies/cosmic-robotics)).
- **NASA's Moon to Mars architecture (2024, 2025)** does not call for aerial scouting before EVAs. Pitch this as taking MoonFall and SkyFall down to the scale of one walk, not as current NASA plan.

### Don't say

- "Ingenuity changed Perseverance's route" or "saved two months of driving". Say "confirmed the route was drivable."
- "Orbit can't see rocks" or "HiRISE can't see slopes". Say "small hazards at walking scale."
- "3–6 cm accuracy" without "internal precision".
- "The drone detects soft sand."
- "SkyFall is funded", "SkyFall flies on Starship", or "six helicopters" (that was the 2025 company concept).
- "NASA plans scout drones for Artemis." MoonFall hops on rockets; nothing flies with rotors on the Moon.
- Any firm SpaceX Mars date.
