# Team page

**Live:** https://claude.ai/artifact/FxZ2AS4JSxE6d1RMbfXq6N (anyone with the link can view).

The team page is **generated from the docs in this repo**. Never edit the page or `plan.html` by hand: edit the docs, then rebuild.

| File | What it is |
|---|---|
| `build.py` | Renders `docs/*.md`, the role briefs and `docs/BUILD.md` into one page (needs `pandoc`) |
| `shell.html` | Page layout, styles and section order |
| `buildgraph.html` | The four-lane build graph (drawn from the table in `docs/BUILD.md`) |
| `screens.html`, `world64.json` | The suggested app screens, drawn from a small copy of the synthetic world |
| `plan.html` | The built page. Generated; large. **Agents: do not read it**, read the docs instead |
| `sync_issues.py` | Writes each block's "In the build graph" section and assignees into its GitHub issue |

## Rebuild and publish

```bash
python3 docs/team-page/build.py .        # writes docs/team-page/plan.html
python3 docs/team-page/sync_issues.py .  # after editing docs/BUILD.md: updates every block issue
```

Publishing to the live link is done from a Claude session that has access to the artifact (Nicolas's). Commit the rebuilt `plan.html` with the doc change.
