# Product spec: the rescope (2026-11-15)

**Status: accepted by Nicolas, 2026-11-15. Tickets in §7 are created and assigned.** This replaces the build order in `docs/BUILD.md` for the time that is left. Evidence: three audits run on 2026-11-15 (planned vs built, app code, map rendering research), summarised in §2.

## 0. The clock

**Submission closes Sunday 1:30 PM** (confirmed by Nicolas). Freeze at 8:00 AM for the first release; fixes and additions continue to noon. The exact submission checklist is ticket F1.

## 1. What wins

NASA asks for a layered map of one place on Mars, from several missions, that helps astronauts **plan and carry out one walk safely while doing new science** (`docs/PRODUCT.md` §1, R1–R5). Global judges read only the **project page**; local judges try the **demo link** and see the pitch.

So the product must do three things a judge can see in two minutes:

1. **The map looks real and is true to scale.** Real HiRISE imagery on real relief, with a person on it for scale.
2. **The map shows what stops a person,** clearly: steep ground, ledges, rocks.
3. **The scout makes the walk safer in a way you can explain:** few flights, each with a reason, and the route changes because of what it found.

Everything else is secondary to those three and to **submitting on time**.

## 2. Where we are (audit findings)

**Strong and working:** route planning on walk-scale crossings (20° limit, 0.3 m steps), measured walking energy, suit-based budget, walk-back ring and point-of-no-return buzz, five Curiosity stops with real photos, "why this route", stop checklists, step mode, Azure deploy, R5 pitch numbers, 23 human-reviewed rocks, 1 m + 25 cm detail tiles hosted on Azure.

**The four complaints, confirmed in the code:**

| Complaint | What the code does today |
|---|---|
| The map is not detailed | One mesh, one point per 8 m, 4 flat colours. The HiRISE image is never drawn. The hosted 1 m / 25 cm tiles are never loaded |
| Layers don't map anything | 17 layers share one dark-to-pale ramp with no legend or units. Slope has no "too steep" colour. Jules's 23 reviewed rocks and Luca's blocked crossings are **never drawn** |
| Not true to human scale | Heights are real and 1:1 (526 m of relief; matches Curiosity's positions within 0.33 m). But the astronaut is drawn about 55 m tall, the helicopter rotor 82 m, flying 82 m up. It reads like a tabletop model |
| The scout does its own thing | 7 flights, not the decided 3. Two follow the route; five come from an old pre-computed file and wander up to 291 m from any stop. Those five change nothing in the final route. It re-plans once at the end and still leaves 2 unscouted rock cells on the route. The value-of-information algorithm and the belief map are not used by the scout |

**Planned but never built:** project page and 30-second video (nothing drafted), real-phone test, packing list, helmet HUD, export, goal picker, storm / dose for the walk, drawing weather / ChemCam / DAN points, buddy rover, CAPCOM on Azure, sun and timeline, the 3D scouting scene.

**Docs out of step with the build:** the demo script and deck promise unbuilt features (packing list, HUD flip, export, buddy, storm, CAPCOM); team credits are wrong (Luca did D1–D4 and D6; `CODEOWNERS` omits him); name is "Martian Map" in docs and "Mission VESTA / Vesta Scout" on the site; flights are "3 per walk" in decisions but 14 legs in the pitch.

## 3. The product, rescoped

**Mission VESTA has two products, built on one map:**
- **Vesta Scout** (the one we submit): the planning map. A real, true-scale map of one walk on Mars that shows what would stop you, sends three helicopter flights where they matter, and gets you home.
- **Vesta Vision** (v0 if time allows): the same Mars, walked at eye height, with no HUD. The helmet HUD is a later addition on top of Vision, not part of this submission.

**Order: foundations first** (make it work, make it not fail), **then additions** (models, animations, Vision, the designed scouting algorithm).

### Pillar A: the map (rebuild)

| Requirement | Done when |
|---|---|
| **A1 Real imagery by default.** The 3D ground shows HiRISE colour, not class colours | Opening `/scout/` shows the HiRISE image on the terrain; source credit on screen |
| **A2 Real detail near you.** 1 m heights and 25 cm imagery load near the camera and along the route; 8 m elsewhere | Boxwork ridges are visible at the stops; at most about 9 detail tiles live; no crash on a phone |
| **A3 True human scale.** Astronaut 1.8 m, habitat (spaceship) and helicopter as real 3D models at real size, vertical 1:1 | A scale bar and a "1:1" note. Far-away markers are fixed-size icons, not giant models. Eye-height walking is Vesta Vision v0 |
| **A4 One hazard view instead of 17 layers.** Slope in green / amber / red against the 20° limit; blocked crossings as red edges; reviewed rocks as pins; estimated rocks hatched "orbit estimate" | A legend with units. Other layers reduced to about 5 named views (Imagery, Hazards, Energy home, Science, Radiation); the rest under "Advanced" |
| **A5 Map furniture** | Scale bar, north arrow, contour lines (5 m, bold every 25 m) |

**Decisions inside A (recommended):**
- **Stay on Gale and stay in three.js.** The heights are verified against Curiosity; the tiles exist; moving site or engine costs the whole remaining time.
- **Keep 2 × 2 km as the map; polish a hero zone of about 500 m around the five stops** (always full detail).
- **Never exaggerate height in walking view.**
- **Honesty:** HiRISE resolves features of about 3–4 m; rocks under about 1 m are not in the data. Any added small-rock scatter is labelled "illustrative" and never used in route maths.

### Pillar B: the scout (rebuild to match the decided algorithm)

| Requirement | Done when |
|---|---|
| **B1 Three flights, on purpose.** Remove the five pre-computed flights. Each flight covers the next unseen stretch of the current route; **re-plan after every flight** | Status reads "Flight 1 of 3". Final route crosses 0 unseen hazards on Gale (already shown by `app/scripts/flight-budget-check.mjs`) |
| **B2 Each flight says why** | A line per flight: what it checked, what it found, how the route changed (kJ, hazards avoided) |
| **B3 Reveal looks like discovery** | Unflown ground muted; flown ground turns to full imagery and detail (uses A1/A2) |
| **B4 Value of information (the designed algorithm)** | Flights chosen from the belief map and candidate routes, with the stop rule. **Tier 2:** only after A and B1–B3 work |

### Pillar C: the walk (keep, small fixes)

Keep everything that works. Fix: the default view (imagery + hazards), the phone layout (Scout button above the fold, compact layer picker), the page title ("Vesta Scout").

### Pillar D: submission (not optional)

| Requirement | Done when |
|---|---|
| **D1 Project page** | Written from `app/HOW-IT-WORKS.md`, `docs/PITCH.md`, R5 numbers; only claims what is built |
| **D2 30-second video** | Screen recording of: real map → hazards → 3 flights → route changes → walk-back ring |
| **D3 Release and phone test** | `dev` → `main` release; the demo link opened on a real phone over HTTPS |
| **D4 Deck and demo script match the build** | Unbuilt features removed; team credits fixed; "3 flights" everywhere |

## 4. Cut (say so, don't half-build)

Buddy rover and RL (E7, R6), CAPCOM on Foundry (R7; ask organizers if Azure hosting alone counts for the Technology award), export (E8), helmet HUD (X1; a later addition on Vesta Vision), radar curtain / near-IR tint / dose gauge (SCOUT-3D step 6), sun clock and two-sol timeline strip (keep `docs/OPERATIONS.md` as the story), exploration modes, generated-world benchmark, route options (#78), interactive route shaping (#79), 4 m vs 10 m helicopter test, `best_areas` layer (leftover of the removed survey).

**Cheap extras only if Tier 1 is done:** packing list from the route (R4 "loads"), the walk's radiation dose in the why-panel (R4 "space weather"), drawing the ChemCam / DAN / weather points (R1/R3), a science-goal picker (R2).

## 5. Order of work

1. **Foundations (F tickets), now:** real imagery, 3 honest flights, true scale, the hazard view, detail tiles, phone layout, project page, deck, release and phone test, video.
2. **First release `dev` → `main` at about 8:00 AM**, with whatever foundations are merged and working.
3. **Additions (A tickets), after your foundations are merged:** 3D models, "why this flight", the discover animation, Vesta Vision v0, the opening animation, value-of-information flights, contours, small challenge extras.
4. **Final release about noon. Submit before 1:30 PM.**

## 6. Who does what (five or six tickets each)

| Person | Area | Tickets |
|---|---|---|
| **Nicolas** | The terrain: imagery, detail, scale, reveal, Vision | F2 #122, F5 #125, F7 #127, A3 #135, A4 #136 |
| **Luca** | What the map shows: overview image, hazards, models, contours, opening | F3 #123, F6 #126, A1 #133, A5 #137, A7 #139 |
| **Jules** | The scout and its proof: flights, reasons, algorithm, deck numbers | F4 #124, F10 #130, A2 #134, A6 #138 |
| **Galsan** | Shipping: submission rules, phone layout, project page, releases, video, extras | F1 #121, F8 #128, F9 #129, F11 #131, F12 #132, A8 #140 |

Everyone works in `app/` now where their ticket says so; each ticket names a **new file** to keep people out of each other's way. `app/src/main.js` is shared: say so in the group chat before editing it.

## 7. Tickets

**Foundations (do first):**

| Key | Issue | Title | Owner |
|---|---|---|---|
| F1 | [#121](https://github.com/nicolasrufino/nasaspaceapps/issues/121) | Confirm submission rules and the Azure award question | Galsan |
| F2 | [#122](https://github.com/nicolasrufino/nasaspaceapps/issues/122) | Map: HiRISE imagery on the terrain by default | Nicolas |
| F3 | [#123](https://github.com/nicolasrufino/nasaspaceapps/issues/123) | Pipeline: one overview image of the whole slice at 1 m per pixel | Luca |
| F4 | [#124](https://github.com/nicolasrufino/nasaspaceapps/issues/124) | Scout: 3 flights, re-plan after each, remove the wandering flights | Jules |
| F5 | [#125](https://github.com/nicolasrufino/nasaspaceapps/issues/125) | Map: true human scale | Nicolas |
| F6 | [#126](https://github.com/nicolasrufino/nasaspaceapps/issues/126) | Map: one hazard view with a legend (slope, blocked steps, rocks) | Luca |
| F7 | [#127](https://github.com/nicolasrufino/nasaspaceapps/issues/127) | Map: load the 1 m terrain and 25 cm imagery near the camera | Nicolas |
| F8 | [#128](https://github.com/nicolasrufino/nasaspaceapps/issues/128) | Phone layout: Scout button on top, compact view picker, name "Vesta Scout" | Galsan |
| F9 | [#129](https://github.com/nicolasrufino/nasaspaceapps/issues/129) | Project page, written only from what is built | Galsan |
| F10 | [#130](https://github.com/nicolasrufino/nasaspaceapps/issues/130) | Deck and demo script match the build | Jules |
| F11 | [#131](https://github.com/nicolasrufino/nasaspaceapps/issues/131) | Release dev to main and test on real phones | Galsan |
| F12 | [#132](https://github.com/nicolasrufino/nasaspaceapps/issues/132) | 30-second video | Galsan |

**Additions (after the foundations work):**

| Key | Issue | Title | Owner |
|---|---|---|---|
| A1 | [#133](https://github.com/nicolasrufino/nasaspaceapps/issues/133) | 3D models at true scale: habitat (spaceship), astronaut, helicopter | Luca |
| A2 | [#134](https://github.com/nicolasrufino/nasaspaceapps/issues/134) | Scout: say why each flight flew, and what it found | Jules |
| A3 | [#135](https://github.com/nicolasrufino/nasaspaceapps/issues/135) | Discover animation: unexplored ground is muted, flights reveal it | Nicolas |
| A4 | [#136](https://github.com/nicolasrufino/nasaspaceapps/issues/136) | Vesta Vision v0: walk on Mars at eye height | Nicolas |
| A5 | [#137](https://github.com/nicolasrufino/nasaspaceapps/issues/137) | Opening animation: from orbit down to the site | Luca |
| A6 | [#138](https://github.com/nicolasrufino/nasaspaceapps/issues/138) | Scout: choose flights by value of information (the designed algorithm) | Jules |
| A7 | [#139](https://github.com/nicolasrufino/nasaspaceapps/issues/139) | Map: contour lines | Luca |
| A8 | [#140](https://github.com/nicolasrufino/nasaspaceapps/issues/140) | Small additions that answer the challenge: packing list, walk dose, science points | Galsan |

**Closed as done:** #33, #22, #11, #27, #14. **Closed as cut:** #4, #7, #12, #34, #42, #78, #79. **Replaced:** #17 → F9, #26 → A8, #80 → F5 and A4. **Later:** #41 helmet HUD.

## 8. How we push code (from now to submission)

1. **One ticket, one branch, one PR into `dev`.** Small PRs; merge your own once CI is green and you ran it in a browser (rule 13).
2. **Demo must always work.** Anything unfinished stays behind a flag that is off. The bare `/scout/` link is the judged path: check it after every merge.
3. **`app/src/main.js` is one file everyone touches.** Announce in the group chat before a PR that edits it; rebase before merging.
4. **Pitch numbers are pinned to app files.** If a PR changes `plan.js`, `walk.js`, `scout.js`, `why.js`, `main.js` or `world.js`, run `node ml/pitch_metrics/run.mjs` and commit the result in the same PR.
5. **Release `dev` → `main` at two points:** once Tier 1 items 2–3 are in, and at the freeze. Only by release PR.
6. **After the freeze:** fixes only; no new features.
7. **Decisions go in `docs/DECISIONS.md`** in the same PR (rule 15).
