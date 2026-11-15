# The pitch (draft 4, measured F1 update, Sat Nov 14)

Five minutes, the organizers' seven parts. One argument runs through it: **there is no map at the scale of one walk; we combine NASA data, local planning and simulated scouting, and measure the result.** The proof numbers below come from repository runs, not field trials.

## Current evidence and scope

- R5 scenario: the fixed Gale world, five default science stops, 600 kJ budget,
  120 kJ reserve, 60 fps replay. [Measured route numbers](../ml/pitch_metrics/PITCH_NUMBERS.md)
  and [machine-readable evidence](../ml/exports/pitch_metrics.json).
- R4: AI4Mars **Curiosity ground photographs in Gale**, not Ingenuity. Original
  test 148/159 (93.1%); additional expert sample 275/302 (91.1%) for the published
  model. Neither sample contains big-rock patches. The new regularized head's
  278/302 does not pass the promotion gates; v1 stays published.
  [Experiment and limitations](../ml/terrain_classifier/README.md#gale-follow-up-keep-v1-after-a-small-head-training-experiment).
- A future scout at approximately **five metres above ground** is a scenario
  assumption, not training-image provenance or aerial validation. Exact overlap
  between the training photos and Luca's target slice is not established.
  [Provenance and scope](../ml/terrain_classifier/PROVENANCE.md).
- The map's 3D terrain and slopes come from orbital terrain products. The ground
  classifier does not reconstruct 3D and did not generate the R5 route layers.
- R7 CAPCOM/Foundry is deferred by the user. Azure Static Web Apps hosting is
  deployed; a live Foundry agent is not part of this pitch.

## The argument in one breath

> There is no map at the scale of one Mars walk. Orbit misses the rocks, mission control is 20 minutes away, rovers are too slow to scout ahead, and walking in blind breaks the plan. Martian Map makes the map: orbit gives the base, a NASA JPL-style scout helicopter flies the route first, the device plans the path and the packing list, and every walk makes the map better. Each piece is already proven at NASA. We put them in the crew's hands.

## The script

**1. Hook (0:00–0:30)**
> Arizona, 2022. NASA astronauts rehearse a moonwalk with the maps Artemis will actually have. On the first walk, a slope those maps couldn't show blocks the route, and the walk ends early. That was the Moon, with help seconds away. On Mars, help is 20 minutes away.

**2. Problem (0:30–1:00)**
> NASA has decades of Mars data, but no map at the scale of one walk. Orbit misses rocks under a metre. Mission control can't guide you through a 20-minute delay. A rover scouting ahead moves at about 110 metres an hour, far slower than you walk. And exploring by eye is how plans break.

**3. Solution in one sentence and the five stages (1:00–1:45)**
> **Martian Map turns NASA's Mars data into a science walk you can plan, preview and come home from, and makes the map better with every walk.**

> We build the map in five stages, coarse to fine; each one tells the next where to look. **Orbit** first: it's the only data covering the whole site before anyone lands, and NASA already collected it. It shows where the science is and where not to go. But it can't see a knee-high rock or soft sand, so a **scout helicopter**, the kind NASA JPL flew on Mars (Ingenuity) and is now building for crews (SkyFall), flies the route first, the way Ingenuity scouted for Perseverance. Then we **plan and pack** before leaving, because Earth is up to 22 minutes away. On the **walk**, the suit display keeps the way home known, and every step adds detail. The **next walk** starts from a better map. For each of NASA's five objectives, today's tools do one stage; we connect all five.

**4. Demo (1:45–3:00)**
- Habitat screen, the fixed Gale boxwork scenario with five default science stops. Orbit-only map and a first route.
- Deploy the scout helicopter. It flies Ingenuity-sized legs along the route, then where it is least sure. Where it flies, the map sharpens: real full-resolution HiRISE terrain and detected rocks. A hidden rock field appears.
- The first re-plan crosses zero of the 12 newly discovered hazard cells on the original route: 1238.8 to 1247.4 m, 329.6 to 334.1 kJ (+1.36% effort). Six unobserved stored hazards remain on the new route. Repeat "Fly the new route": after three passes, the final 1243.5 m route is fully scanned and crosses zero stored hazard cells. This takes 21 simulated flight legs and 14.05 km of helicopter travel; helicopter energy is excluded. Unmapped real hazards can remain.
- A judge carries the phone (the suit display). Real steps move the astronaut; the ring of "can still get home" shrinks. At a stop, the science checklist runs. Past the point of no return, it buzzes.
- Export the map for mission control. A live CAPCOM/Foundry reply is deferred, not a demo step.

**5. Space data inside, and proof (3:00–3:40)**
> Optical and terrain from HiRISE, thermal context from THEMIS, CRISM and the geologic map for science targets, Curiosity's radiation and weather in this crater, and chemistry and subsurface readings along its path. In our fixed Gale simulation, the first re-plan removes 12 discovered hazard cells from the route for 1.36% more walking energy. Three scout passes cover the final route. Even with walking costs raised 30%, it keeps 44.8 kJ beyond the cost home and the reserve. Separately, our ground-photo classifier gets 275 of 302 additional expert-labelled Curiosity crops right. These are measured prototype results, not a certification of safe terrain.

Speaker detail: the nominal final route costs 334.7 kJ and its minimum spare
margin is 145.3 kJ. R3 contains 23 visually accepted rock proposals and two
uncertain ones excluded. The 12 avoided cells are DTM-derived hazards, not 12
of these accepted rocks. Proposal acceptance is not detector precision/recall.

**6. Impact: why it wins, who wins, how much (3:40–4:20)**
> Side by side: orbit alone misses hazards; voice guidance fails with delay; rovers are too slow; walking blind breaks plans. Only the combination works, and it runs on the crew's side of the delay. NASA ranks surface mobility #2 of its 32 technology gaps and asks by name for "in-situ decision support tools" for Mars walks. It funds the rover (up to $4.6B) and the suit (up to $3.1B); nobody funds the map between them.

**7. Team + next (4:20–5:00)**
> Jules built the rock-detection work, ground classifier and measured route tests; Nicolas built the app and the 3D map; Galsan built the data pipeline from NASA's missions. *(Confirm team credits before presenting.)* Next: real drone imagery from an analog field test, then Moon walks and people on Earth who walk far from help. The first people on Mars will get one chance at each walk. This is the map they should carry.

## Slides (in order)

1. Arizona, 2022 (hook)
2. There is no map at the scale of one walk (problem)
3. On Mars, help is 4–22 minutes away (stakes)
4. The one sentence
5. Coarse to fine: the five stages and why each exists
6. NASA's objectives, one by one: today's tools versus ours
7. Live demo
8. All eight NASA data types, each with a job
9. Measured Gale proof: known hazards, scout coverage, margin home, ground classifier
10. Why this beats every option on its own (comparison table)
11. Impact and money
12. Team + next
13. *(Backup)* Why a robot: lead, carry, relay, rescue
14. *(Backup)* The five NASA resources and how we use each

## Local awards (Chicago)

The four local categories, how well we fit each, and what to show. Grades are in `docs/CRITIQUE.md`.

| Award | What the judges look for | Our fit | What we show | Verdict |
|---|---|---|---|---|
| **Best Use of Science** | The best and most valid use of science or the scientific method | **Strongest.** Eight types of NASA data, a science goal driving every walk, and claims we test | Every layer named with its mission; predictions checked against measurements (rock detector against hand-checked rocks, held-out classifier accuracy, the ring under ±30% energy error, predicted versus measured effort from walk logs); simulated parts labelled | **Main target.** Lead the pitch with it |
| **Best Use of Technology** | The most innovative use of technology. **Must use Microsoft Azure** | Azure hosting is real | App hosted on Azure Static Web Apps (#14), three.js map and simulated scout; ONNX model exports are separate evidence | **Second target.** CAPCOM/Foundry (#42) is deferred; do not claim it is deployed |
| **Art & Technology** | Technical and creative skills combined | Good | 3D terrain, the scan sweep, the helmet HUD, the before/after screen | **Third.** Comes from polish, no extra features |
| **Global Connection** | Connecting people around the world through technology | Weak | One line: the map exports as GeoJSON that any crew, scientist or mission control can open, and the viewer is a public link | **Don't chase it.** Nothing extra to build |

**One line per award, if asked:**
- *Science:* "Every claim on screen is a measurement from a NASA instrument or a number our code tested."
- *Technology:* "Azure Static Web Apps hosts the map. Planning and the simulated scout run locally in the browser."
- *Art & Technology:* "A helicopter that sees like a bat, but with light, and a helmet display you can read while walking."

## Questions judges are likely to ask

| Question | Answer |
|---|---|
| Why not just use Mars Trek or MMGIS? | They are built for regional views and for rover teams on Earth. We layer the same data for one crew on one walk, with the science, hazards and the way home together, and it works with no link to Earth. |
| Is the helicopter real? | The flight is simulated and labelled. Ingenuity proved a helicopter can scout on Mars (72 flights, up to 704 m each); NASA's SkyFall helicopters are contracted to scout exploration zones for crews (launch late 2028). In the demo, full-resolution HiRISE stands in for what its cameras would see. |
| What does a helicopter see that HiRISE doesn't? | HiRISE reliably sees rocks of about 1.5 m and up, with terrain points a metre apart. Ingenuity's images were about 4 cm per pixel and showed a half-metre crater peak HiRISE missed. A walker trips on what's in between. (`docs/RESEARCH.md` §14) |
| Can it fly at night or over sand? | No, and we plan for both: it flies in daylight on the sol before, and the scout plan avoids smooth sand, which is what ended Ingenuity. Without the helicopter the route falls back to orbit data, with less margin. |
| How do you detect rocks? | Shadow-based proposals in HiRISE: 23 visually accepted, two uncertain and excluded. Acceptance is not precision/recall. Separate reference-mosaic correspondence matched 0/31 accepted locations; do not hide that limitation. |
| How accurate is the energy model? | This is a sensitivity test, not field calibration. At ±30% walking cost, departure ring area changes +26.1% / −21.2% after the first scout pass. The final route's minimum spare margin is 245.7 / 145.3 / 44.8 kJ at 0.7× / 1× / 1.3×, after home and reserve. Helicopter energy is excluded. |
| Was the classifier trained on Ingenuity views at five metres? | No. It uses AI4Mars Curiosity ground photos in Gale. Five metres is a proposed future scouting altitude. Ground-view accuracy does not establish aerial performance or exact-site coverage. |
| Did the retraining improve it? | The selected new head gets 278/302 versus the current 275/302 on an additional expert sample. The gain's grouped 95% interval includes zero, and the older test falls by one correct crop. We keep the published model and report the experiment; no 95% reliability claim. |
| Does MobileNet produce slopes or the 3D map? | No. It predicts a majority terrain category for a crop. The current map and slopes use orbital terrain products; pixel segmentation and reconstruction are separate tasks. |
| Does the detector find real rocks or image artefacts? | Every rock in the map was checked by eye on HiRISE: 23 accepted, two uncertain and left out. That is acceptance, not precision or recall, and we don't claim recall. Rocks under about 1.5 m are below what orbit can see; that is the helicopter's job. |
| Can humans check or correct the ML? | Yes, twice. The rock layer itself is human-reviewed. And on the walk the crew logs what they find at each stop; the next world merges those observations in (block D7, `merge_walk.py`), so the next walk starts from a better map. It is the citizen-science idea, people checking machine labels, applied to one crew. |
| Which numbers are measured and which are assumed? | `app/HOW-IT-WORKS.md` lists every input to the energy and oxygen model, where it comes from, and where it is known to be too low (Mars-gravity scaling may understate walking energy by about 1.8×; suits add more). Nobody has walked on Mars, so the first walks calibrate it. |
| What failure rate does the oxygen margin tolerate? | We don't claim a probability we can't measure. We follow NASA's rule instead: an untouched reserve (120 kJ here), and we show the route still keeps 44.8 kJ spare if walking costs 30% more. |
| What are the uncertainties on your data layers? | Each layer lists its source and resolution in `world.json` (HiRISE terrain points about 1 m apart, height precise to tens of centimetres; CRISM minerals about 18 m per pixel). Where layers disagree is exactly where the helicopter flies first. |
| What runs on Azure? | Azure Static Web Apps hosts the app. Planning, the walk and the simulated scout run in the browser, so the walk works with no connection. The mission-control (CAPCOM) agent exists as an offline service with the light delay built in; connecting it to Microsoft Foundry is the next step, and we don't present it as live. |
| Astronauts don't use phones. | The phone stands in for the helmet or wrist display. NASA has let astronauts carry their own phones since February 2026. |
| What about the Moon? | The same engine with Moon gravity; the first crewed landing is planned for 2028. |

## Test it with judges and mentors today

Ask three people, five minutes each:
1. "After hearing this once, what does it do?" (tests the one sentence)
2. "Which part convinced you it works?" (tells us which proof to lead with)
3. "What would make you doubt the route?" (tells us which number to show)
4. For Best Use of Technology: "Does our deployed Azure hosting satisfy your criteria? Foundry is deferred."

Write the answers in `docs/pitch-notes.md` and change this draft.
