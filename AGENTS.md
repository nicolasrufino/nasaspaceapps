# Rules for coding agents (all roles)

Read `docs/PLAN.md`, `docs/CONTRACTS.md` and your person's brief in `docs/roles/` before writing code. Each folder (`ml/`, `app/`, `data/`, `agent/`) has its own `AGENTS.md` with its environment and check commands. Codex workflow: `docs/CODEX.md` (one task per git worktree).

1. **Stay in your folder.** Person 1: `ml/`. Person 2: `app/`. Person 3: `data/`, `agent/`, `docs/`. Person X: `docs/` and agreed parts of `app/`.
2. **Contracts are fixed.** Formats in `docs/CONTRACTS.md` change only in a PR that edits that file, approved by every owner. Add fields; never rename or remove.
3. **Foundation before features.** The base demo (terrain, movement, energy, walk-back ring, buzz) must keep working. New features go behind a flag and default to off until they are stable.
4. **Small, working commits.** Each commit leaves the project runnable. Say which milestone (M0–M3) and which flag a PR touches.
5. **No invented numbers.** Accuracy, energy and validation numbers come from code in this repo, written to a file. Mark anything else as an estimate.
6. **No secrets in the repo.** Keys go in environment variables or `.env` (ignored by git).
7. **Phone first.** Test on a phone over HTTPS. No pathfinding on the phone; the walk-back ring is a lookup in `cost_to_go`.
8. **Cite NASA data by name** in code comments and in the project page (Mars Trek, USGS geologic map, Perseverance raw images, HiRISE DTM, AI4Mars).
