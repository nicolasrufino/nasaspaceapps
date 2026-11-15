#!/usr/bin/env bash
# Release dev -> main: record main in dev, open (or reuse) the release PR, turn on squash auto-merge.
# Usage: scripts/release.sh ["short summary for the title"]
# Safe to run twice: the record-merge is skipped when dev already has main, and an open release PR is reused.
# Your own checkout is never touched: the record-merge happens in a throwaway worktree.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

# 1. Record main in dev (no file changes), so the squash release PR doesn't conflict.
tmp=$(mktemp -d)
trap 'git worktree remove --force "$tmp" 2>/dev/null || true; rm -rf "$tmp"' EXIT
for try in 1 2 3; do
  git fetch -q origin main dev
  if git merge-base --is-ancestor origin/main origin/dev; then echo "dev already records main"; break; fi
  git worktree remove --force "$tmp" 2>/dev/null || true
  git worktree add -q --detach "$tmp" origin/dev
  git -C "$tmp" merge -q -s ours origin/main -m "Record main in dev (merge -s ours, no file changes)"
  if git -C "$tmp" push -q origin HEAD:dev; then echo "recorded main in dev"; break; fi
  [ "$try" = 3 ] && { echo "push to dev failed 3 times" >&2; exit 1; }
  echo "push failed (try $try), retrying" >&2; sleep $((try * 5))
done

# 2. Body: PRs merged into dev since the last release into main.
since=$(gh pr list --base main --state merged --limit 1 --json mergedAt --jq '.[0].mergedAt // "1970-01-01T00:00:00Z"')
prs=$(gh pr list --base dev --state merged --search "merged:>$since" --limit 100 --json number,title \
  --jq 'sort_by(.number) | .[] | "- #\(.number) \(.title)"')
body="Release \`dev\` → \`main\`. Merged into \`dev\` since the last release ($since):

${prs:-- (no PRs found; direct pushes only)}

Opened by \`scripts/release.sh\`; squash auto-merge waits for the \`ci\` check."
title="Release: dev into main${1:+ ($1)}"

# 3. Reuse an open release PR, else open one.
num=$(gh pr list --base main --head dev --state open --json number --jq '.[0].number // empty')
if [ -n "$num" ]; then
  gh pr edit "$num" --body "$body" ${1:+--title "$title"} >/dev/null
  echo "reusing release PR #$num"
else
  gh pr create --base main --head dev --title "$title" --body "$body" >/dev/null
  num=$(gh pr list --base main --head dev --state open --json number --jq '.[0].number')
  echo "opened release PR #$num"
fi

# 4. Squash-merge as soon as required checks pass.
gh pr merge "$num" --squash --auto
gh pr view "$num" --json url --jq .url
