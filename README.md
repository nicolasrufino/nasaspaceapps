# Martian Map

**Your phone tells you, step by step, how far you can still walk on Mars and make it home.**

NASA Space Apps 2026 (Chicago), challenge: *Interplanetary Survival Guide: Martian Map*.

A phone stands in for a spacesuit display. Real steps move an astronaut across real Mars terrain; every step costs energy from a published walking model; a walk-back ring shows how far you can still go and get home; a trained buddy rover scouts ahead; mission control answers 20 seconds late.

## Start here
1. `docs/PLAN.md`: the problem, the stack, the build order, the timeline.
   `docs/RESEARCH.md`: how NASA plans surface EVAs, robots, hazards, funding.
   `docs/PITCH.md`: the 5-minute pitch draft and likely judge questions.
   `docs/CRITIQUE.md`: every idea graded before we build it.
2. `docs/CONTRACTS.md`: the file and model formats everyone shares.
3. Your role brief in `docs/roles/`.
4. `AGENTS.md`: rules for coding agents (each folder has its own too).
5. `docs/CODEX.md`: Codex setup prompt, one environment per task, the orchestrator prompt.

## Quick start
```bash
python3 data/pipeline/make_world.py   # builds data/worlds/synthetic/ (standard library only)
```

## Layout
| Folder | Owner | What lives there |
|---|---|---|
| `data/` | Person 3 | Terrain pipeline and world files |
| `ml/` | Person 1 | Terrain classifier and buddy rover training; ONNX exports |
| `app/` | Person 2 | The phone game (stack chosen Sat 12:30) |
| `agent/` | Person 3, then Person X | CAPCOM agent (Microsoft Foundry) |
| `docs/` | Everyone | Plan, contracts, role briefs, pitch notes |

## How we work
- Branch per task, named `yourname/what-it-does` (see How we ship below). PRs into `main`; CI must be green; `main` always runs.
- Foundation first. Every feature is behind a flag and can be turned off.
- Contract changes need every owner's approval.

---

# How we ship


`main` is protected: **nothing lands without a PR and green CI.** No direct pushes, not even admins.

```bash
git switch main && git pull
git switch -c nico/map-layer          # name/what-it-does
# ...code, commit...
git push -u origin HEAD
gh pr create --fill
gh pr merge --auto --squash           # merges itself the moment CI goes green
```

Then go back to `main`, pull, and start the next thing. Don't babysit PRs.

### Rules that keep 5 people fast

- **Small PRs, merged within ~1 hour.** Long branches = merge conflicts at 3am.
- **Pull `main` often** (`git pull --rebase origin main` on your branch).
- **CI red? Fix it before anything else.** If `main` breaks, whoever's PR broke it fixes or reverts (`gh pr revert <n>` / revert button).
- **Squash merge only**, so the PR title becomes the commit. Make the title readable.
- Branches are auto-deleted after merge.

### Stacking PRs (only when you need to)

Use when B depends on A and A isn't merged yet. Keep stacks to 2, 3 max.

```bash
git switch -c nico/api-client         # A, based on main
gh pr create --fill
git switch -c nico/api-ui             # B, based on A
gh pr create --fill --base nico/api-client
```

When A squash-merges, GitHub retargets B to `main` automatically. Drop A's old commits from B:

```bash
git fetch origin
git switch nico/api-ui
git rebase --onto origin/main nico/api-client
git push --force-with-lease
```

### CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) auto-detects the stack:

- `package-lock.json` at root → `npm ci`, then `lint`, `typecheck`, `test`, `build` (whichever scripts exist)
- `requirements.txt` at root → `ruff check` + `pytest`

Add a script to `package.json` and CI runs it, no workflow edits needed.

### CD

Connect the repo to Vercel (or Netlify/Render). Every PR gets a preview URL, `main` deploys to prod. To make the preview deploy a merge requirement too:

```bash
./scripts/protect-main.sh ci Vercel
```

## One-time setup (repo owner)

```bash
gh repo create <name> --public --source . --push
./scripts/protect-main.sh
```

Then add teammates: Settings → Collaborators (Write access).
