# Martian Map

**Martian Map turns NASA's Mars data into a science walk you can plan, preview and come home from, and makes the map better with every walk.**

NASA Space Apps 2026 (Chicago), challenge *Interplanetary Survival Guide: Martian Map*.

## What it is, in one minute

There is no map of Mars detailed enough for one walk, and Earth is 4 to 22 minutes away. So we build the map in five stages, coarse to fine, each telling the next where to look:

1. **Orbit:** NASA's layers for one 2 × 2 km slice of Mount Sharp, Gale crater.
2. **Scout:** a drone flies the route strip, then anomalies, then uncertain spots, and reveals the rocks and sand orbit can't see.
3. **Plan and pack:** the safe, efficient route to the science stops, the margin home and the packing list.
4. **Walk and add:** a tablet minimap and a helmet HUD keep the way home known; every step adds to the map.
5. **Next walk:** starts from a better map.

One three.js web app shows it three ways: the habitat display, the tablet the crew carries, and the helmet HUD. Full story: `docs/PRODUCT.md`.

## The team

| Lane | Who | Focus | Brief |
|---|---|---|---|
| Person 1 | **Jules** | Machine learning: rock detection, ground classifier, CAPCOM agent on Azure | `docs/roles/person-1-ml.md` |
| Person 2 | **Nicolas** | App and 3D: views, walk, drone scout, stops | `docs/roles/person-2-engine.md` |
| Person 3 | **Galsan** (lead) | Data, systems and integration: real Gale slice, all data layers, Azure deploy, merges | `docs/roles/person-3-data-systems.md` |
| Person X | Open | Story, HUD design, pitch, project page | `docs/roles/person-x.md` |

Who leans where, and how each person uses AI: `docs/roles/README.md`.

## Links

- **Team page** (the whole plan, the build graph, roles, research): https://claude.ai/artifact/FxZ2AS4JSxE6d1RMbfXq6N. Built from this repo's docs: `docs/team-page/`.
- **Pitch deck:** https://claude.ai/artifact/XiHnUGPaJkCCpBeHoWck41. Source: `docs/deck/`; script: `docs/PITCH.md`.

## Start here (people and agents)

1. `docs/PRODUCT.md`: what we build and why each stage exists.
2. `docs/BUILD.md`: **who builds what, in what order.** Every block has an owner, its prerequisites and a GitHub issue.
3. `docs/CONTRACTS.md`: the file and model formats everyone shares. This is how nobody waits on anybody.
4. Your role brief in `docs/roles/`.
5. `AGENTS.md`: rules for coding agents (each folder has its own too). Codex setup: `docs/CODEX.md`.

Background: `docs/PLAN.md` (the whole plan), `docs/DATA.md` (each NASA resource and our slice), `docs/CRITIQUE.md` (every idea graded), `docs/PITCH.md` (the pitch and the local awards), `docs/RESEARCH.md` (the evidence).

## Local awards we aim for

1. **Best Use of Science** (main target): eight types of NASA data, every claim tested.
2. **Best Use of Technology** (requires Microsoft Azure): hosted on Azure Static Web Apps; CAPCOM agent on Microsoft Foundry.
3. **Art & Technology**: 3D terrain, the drone's scan sweep, the helmet HUD.

## Quick start

```bash
python3 data/pipeline/make_world.py   # builds data/worlds/synthetic/ (standard library only)
```

Everyone builds against `data/worlds/synthetic/` from the first minute; the real Gale slice drops in later through the same files.

## Layout

| Folder | Owner | What lives there |
|---|---|---|
| `data/` | Galsan | Pipeline and world files |
| `ml/` | Jules | Rock detection, ground classifier, buddy rover; ONNX exports |
| `agent/` | Jules | CAPCOM agent (Microsoft Foundry) |
| `app/` | Nicolas | The three.js web app |
| `docs/` | Everyone (Galsan merges) | Product, build plan, contracts, role briefs, pitch |

## How we work

- **One block, one issue, one branch, one PR.** Take the next block in your lane whose prerequisites are done (`docs/BUILD.md`), branch `yourname/what-it-does`, open a PR that names the block, the milestone and the flag.
- **`main` always runs.** CI must be green; every feature sits behind a flag and ships switched off if it is late.
- **Contracts change only with every owner's approval.**
- **New idea? Grade it first** in `docs/CRITIQUE.md`. 8 or less: don't build it.
- **Numbers only from code.** No invented metric reaches the pitch.

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

### Rules that keep the team fast

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

The app deploys to **Azure Static Web Apps** (block D5, issue #14): `main` deploys the public link, and each PR can get a preview URL. Azure is also what makes us eligible for the Best Use of Technology award.

## One-time setup (repo owner)

```bash
gh repo create <name> --public --source . --push
./scripts/protect-main.sh
```

Then add teammates: Settings → Collaborators (Write access).
