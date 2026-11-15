# Product spec: the rescope (2026-11-15)

**Status: proposed by Nicolas (P2) for the team. Tickets in §7 are drafts; none are created until the spec is accepted.** This replaces the build order in `docs/BUILD.md` for the time that is left. Evidence: three audits run on 2026-11-15 (planned vs built, app code, map rendering research), summarised in §2.

## 0. The clock

`docs/PLAN.md` puts the freeze at **Sunday 08:00** and submission at **Sunday about 13:30 (to confirm)**. This spec was written Sunday 02:10. **Someone must confirm the real deadline now**; every priority below assumes about 11 hours. If the deadline is later, Tier 2 moves up.

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

**One sentence:** *Vesta Scout shows a real, true-scale map of one walk on Mars, shows what would stop you, sends three helicopter flights where they matter, and gets you home.*

### Pillar A: the map (rebuild)

| Requirement | Done when |
|---|---|
| **A1 Real imagery by default.** The 3D ground shows HiRISE colour, not class colours | Opening `/scout/` shows the HiRISE image on the terrain; source credit on screen |
| **A2 Real detail near you.** 1 m heights and 25 cm imagery load near the camera and along the route; 8 m elsewhere | Boxwork ridges are visible at the stops; at most about 9 detail tiles live; no crash on a phone |
| **A3 True human scale.** Astronaut 1.8 m, habitat and helicopter at real size, vertical 1:1 | A scale bar, a "1:1" note, and a **walker's-eye view** button (camera at 1.7 m). Far-away markers are fixed-size icons, not giant models |
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

Buddy rover and RL (E7, R6), CAPCOM on Foundry (R7; ask organizers if Azure hosting alone counts for the Technology award), export (E8), helmet HUD (X1), radar curtain / near-IR tint / dose gauge (SCOUT-3D step 6), sun clock and two-sol timeline strip (keep `docs/OPERATIONS.md` as the story), exploration modes, generated-world benchmark, route options (#78), interactive route shaping (#79), 4 m vs 10 m helicopter test, `best_areas` layer (leftover of the removed survey).

**Cheap extras only if Tier 1 is done:** packing list from the route (R4 "loads"), the walk's radiation dose in the why-panel (R4 "space weather"), drawing the ChemCam / DAN / weather points (R1/R3), a science-goal picker (R2).

## 5. Order of work

**Tier 1, before the freeze (must):**
1. D-clock: confirm the deadline and submission rules (Galsan, 10 min).
2. A1 imagery drape + colour fix; B1 three flights with re-plan (both small, immediate visible wins).
3. A3 human scale + walker's-eye view; A4 hazard view with legend.
4. D1 project page draft and D4 deck clean-up, in parallel, by whoever is not in `app/`.
5. A2 detail tiles near the camera (largest item; start as soon as 2 is merged).
6. B2 "why this flight"; B3 reveal look; C fixes.
7. D3 release to `main` and a phone test; D2 video.

**Tier 2, only if time remains:** B4 value of information, A5 contours, the cheap extras in §4.

## 6. Who does what

| Person | Folder | Now |
|---|---|---|
| **Nicolas** | `app/` | A1–A5, B1–B3, C |
| **Luca** | `data/`, pipeline | Overview image at 1 m/px stitched from the tiles (for A1); KTX2 tiles if the phone runs out of memory; `scout_plan.json` retired; `CODEOWNERS` |
| **Jules** | `ml/` | Rock pins data check (A4); pitch numbers regenerated for "3 flights, re-plan each" (D4); proof slide |
| **Galsan** | `docs/`, deploy | D1 project page, D2 video, D3 release + phones, deadline and Azure-award question |

## 7. Draft tickets (to create once accepted)

| # | Title | Owner | Size | Tier |
|---|---|---|---|---|
| T1 | Confirm deadline, submission rules, Azure award eligibility | Galsan | S | 1 |
| T2 | Map: HiRISE imagery on the terrain by default (+ colour-space fix) | Nicolas | M | 1 |
| T3 | Pipeline: one overview image of the slice at 1 m/px | Luca | S | 1 |
| T4 | Scout: 3 flights, re-plan after each, drop pre-computed flights | Nicolas | S | 1 |
| T5 | Map: true human scale (1.8 m astronaut, real helicopter, icons, scale bar, walker's-eye view) | Nicolas | S | 1 |
| T6 | Map: hazard view (slope ramp vs 20°, blocked crossings, reviewed-rock pins, hatched estimates) + legend; 5 named views | Nicolas | M | 1 |
| T7 | Map: load 1 m / 25 cm detail tiles near camera and route | Nicolas | L | 1 |
| T8 | Scout: "why this flight" line + muted-to-revealed look | Nicolas | M | 1 |
| T9 | Phone layout: Scout button on top, compact layer picker, title "Vesta Scout" | Nicolas | S | 1 |
| T10 | Project page from built features only | Galsan | M | 1 |
| T11 | Deck + demo script match the build; fix credits; name | Galsan + Jules | S | 1 |
| T12 | Pitch numbers for "3 flights, re-plan each" | Jules | S | 1 |
| T13 | Release dev → main; test on 3 real phones | Galsan | S | 1 |
| T14 | 30-second video | Galsan + Nicolas | S | 1 |
| T15 | Scout: value-of-information flight choice (belief map, candidate routes, stop rule) | Nicolas | L | 2 |
| T16 | Contours, north arrow | Nicolas | S | 2 |
| T17 | Packing list; walk dose; ChemCam/DAN/weather points; goal picker | Nicolas / Galsan | S each | 2 |

**Close as done:** #33, #22, #11, #27, #14. **Close as cut:** #4, #7, #12, #34, #41, #42, #78, #79. **Keep:** #45–#48, #16, #17, #26, #80 (covered by T5).

## 8. How we push code (from now to submission)

1. **One ticket, one branch, one PR into `dev`.** Small PRs; merge your own once CI is green and you ran it in a browser (rule 13).
2. **Demo must always work.** Anything unfinished stays behind a flag that is off. The bare `/scout/` link is the judged path: check it after every merge.
3. **`app/src/main.js` is one file everyone touches.** Announce in the group chat before a PR that edits it; rebase before merging.
4. **Pitch numbers are pinned to app files.** If a PR changes `plan.js`, `walk.js`, `scout.js`, `why.js`, `main.js` or `world.js`, run `node ml/pitch_metrics/run.mjs` and commit the result in the same PR.
5. **Release `dev` → `main` at two points:** once Tier 1 items 2–3 are in, and at the freeze. Only by release PR.
6. **After the freeze:** fixes only; no new features.
7. **Decisions go in `docs/DECISIONS.md`** in the same PR (rule 15).
