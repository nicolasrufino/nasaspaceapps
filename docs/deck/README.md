# Pitch deck

**Live:** https://claude.ai/artifact/XiHnUGPaJkCCpBeHoWck41 (a claude.ai Slides artifact in the Mapier design system).

This folder is the deck's **source**, so agents and people can read and review it:

- `deck.json`: slide order, sections and fonts. Hidden slides (`hidden` on the `<section>`) are backups.
- `deck.css`: the shared slide styles.
- `slides/*.html`: one file per slide. Each `<aside>` holds the speaker notes and timing.

The script, timing, slide order and judge Q&A are in `docs/PITCH.md`; that file is the source of truth for what we say. The slides render only inside the Slides artifact (fonts and images live there), so edit them in a Claude session with access to the artifact, then copy the changed `slides/*.html` back here.

Rules for anyone editing slides: no number we have not measured (`AGENTS.md` rule 5); label anything simulated; keep it to five minutes.
