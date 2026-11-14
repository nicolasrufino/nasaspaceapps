# NASA Space Apps

## How we ship (read this once, takes 2 min)

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
