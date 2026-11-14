# Person X: Story, design and pitch (joins later)

**Status:** not here yet. Nothing on the critical path waits for Person X. Until they arrive, Person 3 keeps pitch notes in `docs/pitch-notes.md`.

**Mission when they join:** make it understood and remembered: the before/after page, the HUD look, the 5-minute pitch, the 30-second video and the project page.

**Owns:** `docs/pitch-notes.md`, `app/` styles and the before/after page (with Person 2), the slides.

## First hour after arriving
1. Read `docs/PLAN.md` (especially §1, §3 and §8) and run the demo on a phone.
2. Take over `docs/pitch-notes.md` from Person 3.

## Then
3. **Before/after page** (flag `before_after`): the table in PLAN §8 as a screen in the app, with Apollo 14 on the left and our walk-back ring on the right.
4. **HUD design pass** with Person 2: high contrast, large type, readable while walking.
5. **The 5-minute pitch** in the organizers' seven parts: hook (Apollo 14, Feb 6, 1971), problem (20-minute delay), one sentence, demo (the hallway walk), space data (Mars Trek terrain, USGS geologic map, Perseverance images, NASA's walking model), impact (every Mars EVA; suits capped at $3.1B in task orders), team + next.
6. **30-second video** and the **project page** (the global judges read only this): exact NASA data used, validation numbers, limits, the AI-use disclosure.

## Agent brief (paste into your coding agent)
> You are helping Person X (story, design and pitch) on Martian Map, a NASA Space Apps project. Read `AGENTS.md`, `docs/PLAN.md` and `docs/CONTRACTS.md` first. Work in `docs/` and in `app/` styles only with Person 2's agreement. Build the before/after screen from PLAN §8 behind the `before_after` flag; draft the 5-minute pitch in seven parts from PLAN §1, §3 and §8; draft the project page listing every NASA dataset used, the validation numbers from `ml/exports/*.json` and the data pipeline, the limits, and the AI-use disclosure. Do not invent numbers: use only what the repo reports.
