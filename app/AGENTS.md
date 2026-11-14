# app/ (Person 2: engine and phone)

Applies to everything under `app/`. The root `AGENTS.md` still applies.

- Brief: `docs/roles/person-2-engine.md`. Formats: `docs/CONTRACTS.md` §1–3. Suggested screens: the team plan page.
- Foundation first: terrain, movement, energy and oxygen, walk-back ring, point-of-no-return buzz. It must work with every feature flag off.
- Every feature sits behind a flag named in `docs/PLAN.md` §7 and defaults to off until stable.
- Read sizes from `world.json`; never hard-code them. The ring is a lookup in `cost_to_go`; no pathfinding on the phone.
- Test on a real phone over HTTPS before marking a PR ready.
- Once the stack is chosen, put the app's own install, run and test commands at the top of this file.
