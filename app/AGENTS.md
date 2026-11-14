# app/ (Nicolas, Person 2: three.js web app)

```bash
cd app && npm install
npm run dev        # http://localhost:5173, synthetic world; ?world=<name> loads data/worlds/<name>/
npm run phone      # HTTPS on the LAN for a phone (accept the self-signed certificate once)
npm test           # world files match world.json; layer colours
npm run build      # dist/ for Azure Static Web Apps, world folders included
```

Applies to everything under `app/`. The root `AGENTS.md` still applies.

- Brief: `docs/roles/person-2-engine.md`. Formats: `docs/CONTRACTS.md` §1–3. Suggested screens: the team plan page.
- Foundation first: terrain, movement, energy and oxygen, walk-back ring, point-of-no-return buzz. It must work with every feature flag off.
- Your blocks and their order: `docs/BUILD.md`, lane P2.
- Every feature sits behind a flag named in `docs/PLAN.md` §10 and defaults to off until stable.
- Read sizes from `world.json`; never hard-code them. The ring is a lookup in `cost_to_go`; no pathfinding on the phone.
- Test on a real phone over HTTPS before marking a PR ready.
- Stack: three.js + Vite (decided). Worlds are served straight from `data/worlds/` (Vite `publicDir`).
