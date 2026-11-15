#!/usr/bin/env bash
# One-time GitHub setup. Run after the repo exists on GitHub and CI has run once.
# Protects main (official submission) and dev (team test branch) with the same rules.
#   ./scripts/protect-main.sh            -> requires "ci"
#   ./scripts/protect-main.sh ci Vercel  -> also requires the Vercel preview deploy (CD)
# Note: rulesets on PRIVATE repos need GitHub Pro/Team. Public repos are free.
set -euo pipefail
repo=$(gh repo view --json nameWithOwner -q .nameWithOwner)
checks=("${@:-ci}")

# Squash-only, auto-merge on, branches auto-deleted, "Update branch" button on.
gh api -X PATCH "repos/$repo" \
  -F allow_squash_merge=true -F allow_merge_commit=false -F allow_rebase_merge=false \
  -F allow_auto_merge=true -F delete_branch_on_merge=true -F allow_update_branch=true \
  -f squash_merge_commit_title=PR_TITLE >/dev/null

contexts=$(printf '{"context":"%s"},' "${checks[@]}"); contexts="[${contexts%,}]"

# ponytail: 0 required approvals, CI is the gate. Bump to 1 if main keeps breaking.
# ponytail: not "strict" (branch needn't be up to date), avoids rebase churn with 5 people;
#           CI also runs on push to main so a bad combo shows up within minutes.
body=$(cat <<JSON
{
  "name": "protect-main",
  "target": "branch",
  "enforcement": "active",
  "conditions": {"ref_name": {"include": ["~DEFAULT_BRANCH", "refs/heads/dev"], "exclude": []}},
  "rules": [
    {"type": "deletion"},
    {"type": "non_fast_forward"},
    {"type": "pull_request", "parameters": {
      "required_approving_review_count": 0,
      "dismiss_stale_reviews_on_push": false,
      "require_code_owner_review": false,
      "require_last_push_approval": false,
      "required_review_thread_resolution": false,
      "allowed_merge_methods": ["squash"]}},
    {"type": "required_status_checks", "parameters": {
      "strict_required_status_checks_policy": false,
      "required_status_checks": $contexts}}
  ]
}
JSON
)

id=$(gh api "repos/$repo/rulesets" -q '.[] | select(.name=="protect-main") | .id')
if [ -n "$id" ]; then
  echo "$body" | gh api -X PUT "repos/$repo/rulesets/$id" --input - >/dev/null
else
  echo "$body" | gh api -X POST "repos/$repo/rulesets" --input - >/dev/null
fi
echo "main protected on $repo, required checks: ${checks[*]}"
