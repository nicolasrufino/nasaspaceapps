# Final fixes before submission (2026-11-15, 1:00 PM CST)

Three sessions in parallel, each in its own files, each merging into `dev`. Then one release `dev` → `main`. Hard stops 1:12–1:18 PM; submission 1:30 PM.

| Area | Files | What | Hard stop |
|---|---|---|---|
| Stage 1: science goals | `app/src/flow/goal.js`, `stage-plan.js`, `find.js` | Two goals, pick one: **Groundwater** (CRISM hydration from orbit, DAN hydrogen along Curiosity's path) and **Investigate boxwork** (ridge-and-hollow finder, `candidates.json`). Each card has a "+" for detail and its NASA link. **Proceed** adds that goal's sites as stops. A separate section: **Or pick Curiosity's stops**. Goals get real heading sizes so they read as the important choice. `?off=goals` restores the old stage | 1:15 |
| Scout: why rocks matter | `app/src/flow/stage-scout.js`, `app/HOW-IT-WORKS.md` | Plain reasons a walker avoids rock fields: a field is ground packed with blocks over the 0.3 m step limit (NASA ICES-2025-294), so you walk around it; finding it on foot means an unplanned detour paid from the energy home; NASA's 2022 JETT3 walks ended short on terrain the maps missed | 1:12 |
| Vesta Vision | `app/src/main.js` (Vision UI only), `app/scout/index.html` | No Walk feature in Vision; science stops show only the stops (no why-this-route); contours only in the map view; top-left panel and view buttons in the Scout look; eye-level WASD walk with a red guide line along the route (Luca's work if it exists) | 1:18 |

## Rules
- Nobody edits another area's files. Bare `/scout/` must keep working after every merge.
- Every number on screen comes from a repo file or a linked NASA page.
- If a piece isn't working by its hard stop, it isn't merged.

## Release
After the merges: record `main` in `dev` (`git merge -s ours origin/main`), release PR `dev` → `main` (squash), wait for the production deploy, then load `/`, `/scout/` and `/scout/?vision` on https://nasa.nicolasrufino.com.
