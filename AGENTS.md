# Rules for coding agents (all roles)

Read `docs/PRODUCT.md` (what we build), `docs/BUILD.md` (who builds what, and what each block needs first), `docs/CONTRACTS.md` and your person's brief in `docs/roles/` before writing code. Work on one block at a time; its GitHub issue says what it needs, what it unlocks and when it is done. Each folder (`ml/`, `app/`, `data/`, `agent/`) has its own `AGENTS.md` with its environment and check commands. Codex workflow: `docs/CODEX.md` (one task per git worktree).

**Where things live (read these, in this order):** `docs/PRODUCT.md`, `docs/BUILD.md`, your brief in `docs/roles/`, `docs/CONTRACTS.md`. The pitch is `docs/PITCH.md` and its slides are in `docs/deck/`. **The rescoped plan for the time left: `docs/SPEC.md` (proposed 2026-11-15).** What is decided, open and missing: `docs/DECISIONS.md`. How a scouting sol and a walk sol run: `docs/OPERATIONS.md`. The helicopter in 3D: `docs/SCOUT-3D.md`.
- **Team page:** https://claude.ai/artifact/FxZ2AS4JSxE6d1RMbfXq6N, generated from these docs by `docs/team-page/build.py`. Don't edit or read `docs/team-page/plan.html`; read the docs it is built from.
- **Pitch deck:** https://claude.ai/artifact/XiHnUGPaJkCCpBeHoWck41, source in `docs/deck/`.
- claude.ai links need a sign-in. Agents that can't open them (Codex) use the repo files; they hold the same content.

1. **Stay in your folder.** Person 1 (Jules): `ml/`, `agent/`. Person 2 (Nicolas): `app/`. Person 3 (Galsan): `data/`, `docs/`. Person X: `docs/` and agreed parts of `app/`.
2. **Contracts are fixed.** Formats in `docs/CONTRACTS.md` change only in a PR that edits that file, approved by every owner. Add fields; never rename or remove.
3. **Foundation before features.** The base demo (terrain, movement, energy, walk-back ring, buzz) must keep working. New features go behind a flag and default to off until they are stable.
4. **Small, working commits.** Each commit leaves the project runnable. Say which milestone (M0–M3) and which flag a PR touches.
5. **No invented numbers.** Accuracy, energy and validation numbers come from code in this repo, written to a file. Mark anything else as an estimate.
6. **No secrets in the repo.** Keys go in environment variables or `.env` (ignored by git).
7. **Phone first.** Build for a phone and check it on one over HTTPS when you can (not a merge gate, see rule 13). No pathfinding on the phone; the walk-back ring is a lookup in `cost_to_go`.
8. **Cite NASA data by name** in code comments and in the project page (Mars Trek, USGS Gale terrain and images, HiRISE, THEMIS, CRISM, Curiosity RAD, REMS, ChemCam, APXS, DAN, Perseverance raw images, AI4Mars). See `docs/DATA.md`.
9. **Do not read data files.** Binary world layers (`*.f32`, `*.u8`), datasets, model weights and logs waste tokens. Use `world.json` and the scripts' printed summaries.
10. **Model and effort per job:** see `docs/CODEX.md` §6.
11. **Grade new ideas first.** Before building a feature that is not in `docs/PLAN.md`, add it to `docs/CRITIQUE.md` and score it. 8 or less: do not build it.
12. **Respect the build order.** Don't start a block until the blocks under its **Needs** are done, except by building against the synthetic world. When you finish a block, say in the PR which blocks it unlocks.
13. **Test, then merge as you go.** Once CI is green and you have tested the change yourself (unit tests, build, run it in a browser, the feature works, no console errors), squash-merge your own PR without waiting for a human. Rebase any PR stacked on it onto `dev` and keep going. Say in the PR what you tested and that a real-phone check is still to do. Contract changes (rule 2) still need every owner's approval.
14. **`dev` to test, `main` to submit.** Open every PR into `dev`: it gets a preview URL, and once merged it shows on the team's dev test URL. `main` is the official build we submit; it moves only by a release PR from `dev` at a milestone, after the dev URL works on a phone.
15. **Write decisions down.** Any PR that settles a choice (a number, a direction, a removal) adds a dated row to `docs/DECISIONS.md` and updates its Open and Missing lists.
