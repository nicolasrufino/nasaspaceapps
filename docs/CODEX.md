# Working with Codex

How each teammate sets up Codex so several agents can work at once without stepping on each other.

**How Codex finds the rules:** Codex reads `AGENTS.md` files automatically. The root `AGENTS.md` applies everywhere, and each folder has its own (`ml/`, `app/`, `data/`, `agent/`) with that folder's rules and check commands. The file closest to the code being changed wins.

**One task = one folder = one branch.** Every task runs in its own git worktree, a separate folder on its own branch. Two agents never edit the same checkout, and a broken task never breaks the others.

## 1. Setup prompt (paste into Codex once, in an empty folder)

> Set up my workspace for the Martian Map hackathon project.
> 1. Clone https://github.com/nicolasrufino/nasaspaceapps into `./nasaspaceapps` (use `gh repo clone` if `gh` is logged in).
> 2. In the clone, run `python3 data/pipeline/make_world.py` and `python3 -m pytest -q` (install pytest in a local `.venv` if needed). Both must pass.
> 3. Read `AGENTS.md`, `docs/PLAN.md`, `docs/CONTRACTS.md`, `docs/RESEARCH.md` and my role brief in `docs/roles/` (I am Person [1 / 2 / 3 / X]).
> 4. List the open issues for my role: `gh issue list --label person-[N] --state open`.
> 5. For the first issue I pick, create a worktree next to the clone: `git worktree add ../mm-[N]-[issue-number] -b [myname]/[short-task-name] origin/main`, then set up that worktree's environment from the table in `docs/CODEX.md` §2.
> 6. Report back: tests passing, the issues for my role, and the worktree folder ready to work in. Do not write feature code yet.

## 2. Environments (one per kind of task)

| Environment | Who | Setup (run in the worktree) | Check before a PR |
|---|---|---|---|
| **ml** | Person 1 | `python3 -m venv .venv && . .venv/bin/activate && pip install -r ml/requirements.txt pytest` | `python ml/check_exports.py` (once it exists) and `pytest -q` |
| **app** | Person 2 | Depends on the stack. Babylon.js: `cd app && npm install`. Unity: open `app/` in Unity Hub (Codex edits C# only) | The app's own test command (put it at the top of `app/AGENTS.md`), plus a phone test over HTTPS |
| **data** | Person 3 | `python3 -m venv .venv && . .venv/bin/activate && pip install pytest ruff` (add `rasterio` only for the DTM loader) | `python3 data/pipeline/make_world.py && ruff check . && pytest -q` |
| **agent** | Person 3, then X | `python3 -m venv .venv && . .venv/bin/activate && pip install pytest` plus the Azure / Foundry SDK; keys in `.env` | `pytest -q`; the app still works with the agent off |
| **docs** | Person X | none | Links and numbers match the repo |
| **orchestrator** | Person 3 (lead) | none; read-only clone on `main` | none (it does not write feature code) |

**Codex cloud:** if you use Codex in the cloud instead of on your laptop, create one environment per row above for this repo, paste the row's setup command into the environment's setup script, and add secrets (Azure keys) as environment secrets, never in the repo.

## 3. The orchestrator ("the orchestra")

One Codex session, run by Person 3 on a clean read-only clone of `main`. It does not write feature code. It keeps everyone unblocked. Paste this:

> You are the orchestrator for the Martian Map hackathon project (repo nicolasrufino/nasaspaceapps). You do not write feature code. Every time I say "status", do this:
> 1. Read `docs/PLAN.md` §7 (milestones and times) and compare with the current time (Central). Say which milestone we are in and how much time is left.
> 2. List open issues by label (`person-1`, `person-2`, `person-3`, `person-x`) and open PRs with their CI state (`gh issue list`, `gh pr list`, `gh pr checks`).
> 3. Flag blockers: an issue on the critical path (label `foundation`) not started or late; a PR open for over an hour; red CI on `main`; any PR that changes `docs/CONTRACTS.md` (every owner must approve).
> 4. Review each open PR against `AGENTS.md` and the folder `AGENTS.md`: stays in its folder, says its milestone and flag, keeps the foundation working with flags off, includes tests or a check, no secrets, no invented numbers. Leave a short review comment with what to fix.
> 5. Propose the next issue for each person, foundation first, and say why in one line.
> 6. At each milestone time, list what ships with its flag off.
> Keep your answer under 25 lines. Never merge a PR with red CI. Never change contracts yourself.

## 4. Task prompt (one per issue, in its worktree)

> Work on issue #[N] in this worktree (branch [name]/[task]). Read the issue, the root `AGENTS.md`, this folder's `AGENTS.md`, `docs/CONTRACTS.md` and my role brief first. Stay inside my folder. Make the smallest change that meets the issue's "Done when". Keep the foundation working with every feature flag off; put new features behind their flag. Run the check from `docs/CODEX.md` §2 for my environment. Then commit, push, and open a PR with `gh pr create --fill`, filling in the template (milestone, flag, contract change, phone test). If the issue needs a contract change, stop and tell me instead of changing it.

## 5. When the task is done

```bash
cd ../nasaspaceapps
git worktree remove ../mm-[N]-[issue-number]   # after the PR merges
git pull
```

Then pick the next issue (ask the orchestrator) and make a new worktree.

## 6. Models and effort: quality first, no waste

Spend reasoning where a mistake costs hours; save it where a mistake is cheap and visible. Profiles are in `.codex/config.toml` (start Codex with `codex --profile <name>`). Model names change often: check `/model` in Codex and edit the file.

| Job | Profile | Effort | Why |
|---|---|---|---|
| Orchestrator: status, PR reviews, contract questions, merge conflicts | `orchestrator` | high | One bad call blocks several people |
| ML: reward design, training bugs, ONNX export | `ml` | high | Subtle errors look like working code |
| Energy model and walk-back ring logic | `ml` | high | The demo's core number must be right |
| Features in `app/`, `data/`, `agent/` | `build` | medium | The everyday default |
| Docs, CSS, renames, boilerplate, small fixes | `fast` | low | Errors show up at once and cost little |

**How we keep tokens useful**
1. **One issue per session.** Start a fresh session (in its own worktree) for each issue. Long sessions drag old context into every reply.
2. **Plan with high effort once, build with medium.** Ask for a short plan first on hard issues, approve it, then implement.
3. **Point at files.** Name the files and the section of a doc (for example "CONTRACTS.md §2"). Folder `AGENTS.md` files keep each agent's context small.
4. **Never read data.** Binary world files (`*.f32`, `*.u8`), datasets, model weights and logs are not for reading. Use `world.json` and the scripts' printed summaries.
5. **Short outputs.** Run `pytest -q` and `ruff check .`, and paste only failures back into the session.
6. **Hand off in the PR, not the chat.** End every task with a PR description that says what changed and what is left. The next agent starts from that.
7. **Orchestrator on a schedule.** Ask for "status" at each milestone or about once an hour, not after every commit. Its answer is capped at 25 lines.
