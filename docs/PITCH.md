# Mission VESTA: Vesta Scout — five-minute pitch

Current script for F10, 2026-11-15. The accepted [rescope](SPEC.md) governs the submission. Slides are in [deck/](deck/README.md). Every numerical product claim below comes from [R5](../ml/pitch_metrics/PITCH_NUMBERS.md) and its [JSON](../ml/exports/pitch_metrics.json); these are fixed-world simulations, not field safety validation.

## Scope and evidence

The judged path is bare `/scout/`, Gale, five default stops and the `worst` suit scenario. Budget: 3,165.2 kJ, with 1,899.1 kJ reserved. A scout campaign has at most three flights, each at most 1 km, and re-plans after every flight. A flight animates in ten seconds; this is presentation time, not aircraft performance. Repositioning, return-to-base flight, recharge, daylight and helicopter energy are not modelled.

The map uses HiRISE imagery and USGS terrain, with slope, crossing, rock, energy and science views. The route and return margin use the repository energy model, including assumptions about suit effort; they are not a certified safety guarantee. The imagery reveals existing NASA data, not newly acquired helicopter photographs. The ground-photo classifier and reviewed rock proposals are separate evidence, not the source of an aerial accuracy claim.

## Script and slide order

**1–3. One science walk and a way home (0:00–0:45)**

> A science walk is more than a line on a map. We need to know which stops we can reach, what might block the route, and whether we can still get home. Mission VESTA brings those questions together on one real patch of Gale crater. Vesta Scout is the planning map we can show today.

**4–6. Plan, scout, re-plan, walk (0:45–1:30)**

> We start with NASA imagery and terrain. We select five science stops and plan a walking route with a return reserve. Three simulated helicopter flights inspect the route. Each landing adds observations and triggers a new plan. On the walk, the remaining return margin updates with movement. The map, flight and route are visible, so the crew can inspect what changed.

**7. Live demo (1:30–3:00)**

1. Open bare `/scout/` and leave the five default stops selected. Confirm Gale, the initial route near **621 kJ**, HiRISE credit and terrain imagery. Use the Hazards view to explain the legend: slope in degrees, blocked crossings and rock evidence; return to Imagery for the flight.
2. Select **Fly the route** once. Point out **Flight 1 of 3** and the reveal. After landing, the route updates to about **629 kJ**. Flight 2 re-plans again; flight 3 checks the remaining unseen part of the new route. Do not click a second campaign or promise wandering bonus flights.
3. At completion show **3 of 3**, **44 hazard cells found**, **fully scouted** and about **630 kJ**. The same five stops remain selected. The fourth flight is disabled.
4. Switch to **Walk**, use **Step**, and point to the changing energy and return margin. Physical phone step sensing must be rehearsed on the actual phone before using it on stage; manual Step is the tested fallback. Keep the demo on the features visible in this build.
5. If the live demo is unavailable, use slide 7's real screenshot and explicitly call it a recorded result.

**8–9. NASA sources and measured proof (3:00–3:45)**

> HiRISE and the USGS terrain model provide the map. THEMIS and CRISM add orbital context; Curiosity supplies the science stops and photographs. In this fixed simulation, the initial route crosses eight distinct cells from the stored hazard layer. After three flights, the final route crosses zero, with the same five stops. Walking energy increases from 621.4 to 630.5 kJ, or 1.46 percent. Even if walking costs are 30 percent higher, the model retains 446.5 kJ beyond the return cost and reserve.

Speaker detail: flights are **1,000 m + 1,000 m + 215.4 m**, or **2.22 km** of scanned corridor. The route changes from **1,274.7 m to 1,311.4 m**. Nominal minimum spare margin: **635.6 kJ**. The 44 found cells are across all scanned strips; six of the original route's eight hazard cells were actually observed, while the other two were bypassed without observation. The initial route crosses zero reviewed-rock-clearance cells: do not call the eight cells eight hand-checked rocks. Fully scanned means covered by this simulation's sensor footprint, not verified safe on Mars.

**10–11. Why the comparison matters (3:45–4:25)**

> We compare the same world and the same five science stops. The result is a slightly longer, more demanding walk that avoids the hazards in the stored layer. We can reproduce the numbers, inspect the observations and see the cost of the detour. That is the useful result today: a decision the crew can examine, with the assumptions visible.

**12. Team and next step (4:25–5:00)**

> Jules owns the scout, its measurements and the machine-learning evidence. Nicolas builds the 3D app and terrain. Luca built the NASA data pipeline and world integration, including D1 through D4 and D6, and the hazard views. Galsan owns submission, project-page, video and release coordination. Next we need independent terrain labels, field calibration and aircraft constraints before treating this as an operational tool. Today, Vesta Scout makes the relationship between science, hazards and the way home visible.

**13–14 are backup slides:** simulation limits and evidence provenance. They are not part of the five-minute run.

## Judge questions

| Question | Answer supported by this build |
|---|---|
| Are the flights real? | No. A three-flight corridor simulation reveals a pre-existing hazard layer. Each flight is capped at 1 km. Aircraft transit, recharge, daylight and energy remain unmodelled. |
| Does zero hazards mean safe? | Zero crossings of the stored grid hazard layer on this route. Unmapped hazards, perception mistakes and energy-model error can remain. |
| Where did the hazard layer come from? | Fine-terrain rules plus registered, reviewed ROSCO rock proposals. Proposal acceptance is not detector precision or recall. The measured route benefit here comes from terrain-derived hazards. |
| Does the classifier work from a helicopter? | We have separate Curiosity ground-image tests. They do not establish aerial transfer. The assisted Ingenuity annotations are not an independent blind accuracy test. |
| Are the probabilities calibrated? | The optional belief-map prototype is not independently calibrated. Do not present its estimates as validated odds of a real obstacle. |
| What runs on Azure? | Static Web Apps hosts the browser application. There is no deployed CAPCOM/Foundry agent in this submission. |
| Can I use the phone? | The app has a Walk view and Step control. Physical device sensing and HTTPS rehearsal belong to the release/phone checklist, not to desktop browser verification. |
| What is next rather than shipped? | Packing list, helmet HUD, export, buddy rover, weather simulation and live CAPCOM are outside this demo. Optional additions are demonstrated only if present and checked in the actual release. |

Award eligibility, submission wording and the Azure award question are tracked in **F1 #121**, owned by Galsan. This script makes no unverified eligibility claim. The official `main` release requires the release checklist and a real-phone check; merging these sources into `dev` is not that release.
