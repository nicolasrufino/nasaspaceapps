# Pitch deck

**Live:** https://claude.ai/artifact/XiHnUGPaJkCCpBeHoWck41 (a claude.ai Slides artifact in the Mapier design system).

This folder is the deck's **source**, so agents and people can read and review it:

- `deck.json`: slide order, sections and fonts. Hidden slides (`hidden` on the `<section>`) are backups.
- `deck.css`: the shared slide styles.
- `slides/*.html`: one file per slide. Each `<aside>` holds the speaker notes and timing.

The script, timing, slide order and judge Q&A are in `docs/PITCH.md`; that file is the source of truth for what we say. The slides render only inside the Slides artifact (fonts and images live there), so edit them in a Claude session with access to the artifact, then copy the changed `slides/*.html` back here.

Rules for anyone editing slides: no number we have not measured (`AGENTS.md` rule 5); label anything simulated; keep it to five minutes.

F1 source update (2026-11-14): `proof`, `data`, `demo` and `next` now use the
measured R5 scenario and R4 follow-up, with actual ground-image provenance and
R7/Foundry marked deferred. This commit updates the repository source only;
the external Claude Slides artifact still needs synchronization by a session
with access. Local HTML previews can check text and spacing with fallback fonts,
but cannot validate that artifact's private fonts and embedded demo screenshots.

Evidence: `ml/exports/pitch_metrics.json`,
`ml/terrain_classifier/gale_experiment_v2.json`, and
`ml/terrain_classifier/PROVENANCE.md`. Keep the initial 93.1% and additional
91.1% Curiosity measurements distinct; neither is an aerial or big-rock score.

PR #94 refresh: proof numbers and demo notes now use the `worst` EVA
scenario, the updated energy model and walk-scale crossings. Two scout
passes, 630.5 kJ final walking energy, 446.5 kJ minimum spare margin at 1.3x
cost. This supersedes the earlier 600 kJ scenario. The external Claude
Slides artifact still needs the same source changes synchronized.
