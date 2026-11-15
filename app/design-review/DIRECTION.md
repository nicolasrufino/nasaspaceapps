# Mission VESTA — design proposal

Status: research and visual proposal, 15 November 2026. No application changes in this revision. Recommended composition: A, Orbit to surface. The generated study board (not committed) tested composition only. The built page uses real captures from `app/scripts/capture-home.mjs`.

## Purpose and diagnosis

A visitor or hackathon judge should understand what Scout and Vision do, see an output, and enter either tool without reading the technical documentation first. The earlier revision rearranged tool furniture rather than establishing a presentation hierarchy. A persistent evidence rail competed with the terrain, and the mobile view spent too much space on controls.

Keep the existing opening: black, Mission VESTA in Michroma, the NASA Viking globe, the short description, and one exploration link. Keep Rethink Sans for readable supporting text. Extend that identity into image-led product presentations. This proposal concerns the project presentation; redesigning the working Scout and Vision interfaces is a separate pass.

## Research and decisions

- [Mars, Chris](https://dribbble.com/shots/3711222-Mars): visually inspected. A dominant planetary image and sparse title establish scale before detail. Borrow that hierarchy; avoid decorative telemetry.
- [Spacesis, Voyager](https://dribbble.com/shots/24147478-Spacesis-Interactive-Web-Design): the published description emphasizes fullscreen imagery and narrative presentation. Useful as a narrative reference, not evidence that a specific interaction works.
- [NASA Eyes: Mars 2020](https://eyes.nasa.gov/apps/mars2020/): simulation reference and explicit simulation labelling. Do not imply VESTA reproduces NASA's simulator.
- [W3C interaction animation guidance](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html): respect reduced motion; avoid scroll-driven camera travel.
- [W3C target sizing guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html): use 44px product controls as a deliberate touch target, above the AA minimum.

Repo reviewed: PRODUCT, BUILD, P2 brief, CONTRACTS, CODEX, SPEC, existing landing HTML/CSS, flow styles and model descriptions. Current model descriptions distinguish uncalibrated rock ranking, human-reviewed proposals, classifier transfer limitations, and simulated scanning. Preserve those distinctions.

## Proposed page, in reading order

### Opening

MISSION: VESTA. “Tools for science walks on Mars.” Explore the mission links directly to Scout, so the first interaction reaches the work. Preserve the existing globe silhouette and rust color; no yellow wash, extra stat row or decorative control panel. Small Scout / Vision anchor links may sit in the header if needed for repeat visitors.

### Vesta Scout: Look before you walk.

One short sentence: “Plan a route, scout the ground ahead, and see what changes.” A large real app view carries the section. On desktop the image takes roughly three quarters of the section width; concise explanation occupies the remaining space. On mobile the explanation follows the image in document flow.

Use the same camera framing and science stops for Before scouting / After scouting. Two explicit buttons are preferable to a drag-only comparison: the whole route remains visible and touch users can compare without fighting page scroll. Change route, hazard annotations and caption together. Never manufacture a route improvement: if the selected run has no change, say so. A separate Open Scout link enters the existing guided experience.

Beside the comparison, show one causal explanation tied to the displayed result. Example: “The scouted map exposes a hazard on the original route.” Follow with the specific method and its limit. For generated study images these are placeholders; shipping content must come from the captured run.

### Vesta Vision: Read the ground.

“Explore the terrain behind every decision.” A broad oblique terrain view, with Imagery / Slope / Ground controls immediately above it. Use registered views of the same site: changing layers does not jump the camera. A short caption changes with the layer and says what the visitor can infer. Open Vision enters the actual map.

Do not present the ground classifier as the source of the orbital terrain map. Explain it beside a genuine rover-image classification example, with its measured validation and transfer limitations. Until that example is prepared, link to the existing model documentation rather than inventing an output.

### Technical reading, on demand

Keep the main page short. Each relevant explanation offers Read the method, opening an inline full-width explanation immediately below that demonstration. No permanent evidence sidebar and no generic catalogue of ML cards. Present: input → method → observable output → limitation → source. Keep a source/credit footer for the NASA products actually shown.

## Evidence placement

| Work | Where it belongs | What must remain explicit |
| --- | --- | --- |
| HiRISE / USGS terrain | Vision imagery and slope captions | Resolution and source from world metadata; keep original scientific colors |
| ROSCO and reviewed detections | Scout hazard comparison | Review of proposals is not a detection hit rate |
| Logistic rock ranking | Scout method explanation if used in the shown run | Ranking is uncalibrated; do not label as true probability |
| Pandolf-derived cost | Explanation of the selected route | A model estimate with assumptions, not measured astronaut expenditure |
| Precomputed cost_to_go | Return-margin illustration | Lookup with reserve; no new phone pathfinding |
| Ground classifier | Actual rover-patch example | Held-out results and weak transfer shown together |
| VOI experiments | Technical reading only | Experimental status; do not describe as the default scout algorithm |

## Interaction and state specification

- Globe: preserve horizontal drag and keyboard rotation; provide explicit pause/play. Vertical touch gestures continue page scrolling. Stop offscreen; reduced-motion starts still.
- Page: ordinary scroll, no mandatory cinematic intro, scroll snapping, pinned scroll chapters or automatic camera zoom.
- Comparison: selected state visible through text and underline, not color alone; keyboard and touch equivalent. Crossfade approximately 180ms, instant when reduced motion is requested. Caption announced politely, not the whole section.
- Layer controls: preserve camera and section height; show selected layer and its legend. Render only one preview at a time; do not load two live 3D applications into the landing page.
- Methods: inline expansion, button exposes expanded state, focus stays on trigger. Sources remain regular links.
- Loading: show a real static poster before enhancement; keep product links usable. No blank brown terrain, spinners over essential text or invented progress percentages.
- Missing imagery: keep caption, source and launch link; explain preview unavailable. Missing model output means no score or placeholder accuracy.
- Mobile: single column, full-width image, controls beneath or directly above, body at readable size, no hover-dependent content and no floating UI covering terrain. Check 390px and 320px; desktop at 1440px, plus browser zoom.

## Configuration plan

Once the visual direction is accepted, keep presentation content separate from app state. A small mission presentation config contains product title, summary, launch href, preview asset paths and their source credits, comparison/layer labels, method links and availability. Model scores remain owned by their existing exports/model descriptions; route outcomes remain owned by the captured run. Do not copy measurements into a second editable config. Do not reuse the rejected layout's classifier-on default for a marketing preview.

## Implementation sequence after design review

1. Compose a faithful desktop and phone layout using actual assets, retaining the original opening. No working-tool furniture changes.
2. Select and capture one reproducible Scout run and one matching Vision site. Establish source provenance and exact limitations before writing explanatory copy.
3. Add comparison, layer selection and inline methods progressively; preserve static content and ordinary product links.
4. Evaluate hierarchy visually before adding motion. Check touch, keyboard, reduced motion, image failure, both product links and no console errors. Run app checks if application code changes.

Any new preview capability beyond the current PLAN requires the repository's critique/score step before implementation. This document specifies design, not authorization to bypass that rule. No numerical performance claim is created by this proposal.

## Visual-study critique

A is preferred because it preserves the original identity and moves from planet to site to ground. B starts at ground level and loses that progression. Neither generated study is a finished specification: the display font is approximate, the route is invented, the controls need proper touch sizing, and scientific map colors must remain authentic. Production uses the existing local fonts and actual project imagery.

## Decision to review

Confirm the A composition and the comparison/layer interaction model before implementation. This is the design-first checkpoint requested after the rejected revision.
