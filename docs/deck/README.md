# Mission VESTA: Vesta Scout pitch deck

The F10 source refresh (2026-11-15) follows the accepted rescope and the three-flight build. The five-minute script, demo steps, caveats and Q&A are in [PITCH.md](../PITCH.md).

- `deck.json`: the existing 14-slide order and design-system metadata; the last two slides are backups.
- `deck.css`, `slides/*.html`: the slide layout and speaker notes (`aside`). `deck.css` is the same file as the Claude deck's and matches the landing page: black and warm paper, Rethink Sans, Michroma for the one cover title.
- `assets/scout-three-flights.png`: an actual browser screenshot after the Gale campaign, not an illustration. The HUD shows three flights, 44 found cells and the final route.
- `build.py`: makes a self-contained HTML presentation; it links Rethink Sans and Michroma from Google Fonts and falls back to Arial offline and the embedded screenshot. It needs only Python's standard library.

From the repository root:

```sh
python docs/deck/build.py --out /tmp/vesta-pitch.html
```

Open the output in a browser. Arrow keys or Space advance; **N** shows speaker notes. The final two slides are marked Backup. Add `?contact` to a served URL to inspect all slides. The HTML does not require private fonts, remote images or a sign-in.

The original [Claude Slides artifact](https://claude.ai/artifact/XiHnUGPaJkCCpBeHoWck41) requires an owner session to synchronize these sources. This PR updates repository sources and provides the portable presentation; it does **not** claim to have published that private artifact.

Numerical evidence: [pitch_metrics.json](../../ml/exports/pitch_metrics.json) and [PITCH_NUMBERS.md](../../ml/pitch_metrics/PITCH_NUMBERS.md). Three flights cover 2.22 km of corridor; the same five-stop route changes from 621.4 to 630.5 kJ (+1.46%). The stored hazard-layer crossings change from 6 distinct cells to 0. Grid cells are not individual rocks; transit, recharge, daylight and helicopter energy are excluded. No aerial classifier accuracy or physical-phone validation is claimed.

Keep slide claims in sync with the live `/scout/` build and R5. Rebuild the HTML after edits. Review every rendered slide for overflow and image loading before using it on stage. Official release and physical-phone checks remain F11 #131.
