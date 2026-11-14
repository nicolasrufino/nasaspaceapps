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
- **Scouting first:** NASA Ames' "robotic recon" drives a rover over planned routes before the EVA to check hazards and rank targets; K10 rovers drove 45 km, mostly autonomously, at Haughton Crater in 2008. ([CMU/Ames](https://ewh.ieee.org/conf/icra/2008/workshops/PlanetaryRovers/03Fong/icra08-prw-fong-1.pdf))

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
- **MoonFall:** 3–4 hopping drones to scout the south pole, including slopes rovers cannot reach (Firefly, $75M delivery). [Space.com](https://www.space.com/astronomy/moon/nasa-wants-to-use-a-fleet-of-moonfall-drones-to-scout-the-lunar-south-pole-we-believe-we-can-do-it)
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
