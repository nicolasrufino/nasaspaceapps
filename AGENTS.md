# Rules for coding agents (all roles)

Read `docs/PRODUCT.md` (what we build), `docs/BUILD.md` (who builds what, and what each block needs first), `docs/CONTRACTS.md` and your person's brief in `docs/roles/` before writing code. Work on one block at a time; its GitHub issue says what it needs, what it unlocks and when it is done. Each folder (`ml/`, `app/`, `data/`, `agent/`) has its own `AGENTS.md` with its environment and check commands. Codex workflow: `docs/CODEX.md` (one task per git worktree).

1. **Stay in your folder.** Person 1 (Jules): `ml/`, `agent/`. Person 2 (Nicolas): `app/`. Person 3 (Galsan): `data/`, `docs/`. Person X: `docs/` and agreed parts of `app/`.
2. **Contracts are fixed.** Formats in `docs/CONTRACTS.md` change only in a PR that edits that file, approved by every owner. Add fields; never rename or remove.
3. **Foundation before features.** The base demo (terrain, movement, energy, walk-back ring, buzz) must keep working. New features go behind a flag and default to off until they are stable.
4. **Small, working commits.** Each commit leaves the project runnable. Say which milestone (M0–M3) and which flag a PR touches.
5. **No invented numbers.** Accuracy, energy and validation numbers come from code in this repo, written to a file. Mark anything else as an estimate.
6. **No secrets in the repo.** Keys go in environment variables or `.env` (ignored by git).
7. **Phone first.** Test on a phone over HTTPS. No pathfinding on the phone; the walk-back ring is a lookup in `cost_to_go`.
8. **Cite NASA data by name** in code comments and in the project page (Mars Trek, USGS Gale terrain and images, HiRISE, THEMIS, CRISM, Curiosity RAD, REMS, ChemCam, APXS, DAN, Perseverance raw images, AI4Mars). See `docs/DATA.md`.
9. **Do not read data files.** Binary world layers (`*.f32`, `*.u8`), datasets, model weights and logs waste tokens. Use `world.json` and the scripts' printed summaries.
10. **Model and effort per job:** see `docs/CODEX.md` §6.
11. **Grade new ideas first.** Before building a feature that is not in `docs/PLAN.md`, add it to `docs/CRITIQUE.md` and score it. 8 or less: do not build it.
12. **Respect the build order.** Don't start a block until the blocks under its **Needs** are done, except by building against the synthetic world. When you finish a block, say in the PR which blocks it unlocks.
