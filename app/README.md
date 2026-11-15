# app (Person 2)

The phone game: three.js + Vite. Run commands: `app/AGENTS.md`. Reads `data/worlds/<name>/` and `ml/exports/*.onnx`. See `docs/roles/person-2-engine.md`.

S4 (#169): `/scout/?scout_payload=1` enables the SkyFall payload card and a report after each landing.
Pick at least three stops, plan the route, then send the scout. Reports stay on screen after the last
landing until **Review the walk**. Bare `/scout/` and `?scout_payload=0` keep the existing flow.
This is a stage-local flag: do not add `flags=` or `world=` (those select the legacy Vision UI).
The full strip uses the existing scout sampling, with unique grid cells counted once per flight;
overlap between flights is included in each report. Missing optional layers say **Unavailable**.
Radiation is mean dose rate (µGy/h), not accumulated dose. REMS is historical ground context with
its sol labelled; neither weather nor instruments are live sensor simulations. The 30 m strip is
our estimate, not a NASA guarantee. No world contracts or routing calculations change.

The R4 model is connected to the M2 Walk view behind `classifier` (off in the default demo).
Open `/scout/?world=gale&flags=classifier,science_stop,step_mode`, select **Walk → Classify a ground photo**,
choose a JPEG/PNG/WebP at least 256 × 256, tap or arrow-key the crop, then **Analyze selected area**.
The retained `ml/exports/terrain_cls.onnx` runs locally in a dedicated Web Worker with ONNX Runtime Web;
no upload or inference API. Runtime and model load only on Analyze, from the same site, with model SHA-256 verification.
Vite packages the existing export and WASM runtime as hashed assets; no duplicate model is committed.

The 256-pixel RGB crop is resized to 128 using the training pipeline's bilinear filter,
then converted to float32 NCHW 0..1. ImageNet normalization is already in the ONNX graph.
Output is the dominant soil/bedrock/sand/big-rock class with uncalibrated relative scores.
Unknown is not learned. This is a Curiosity ground-photo experiment, not a helicopter-view detector,
segmentation, slope measurement or safe-route guarantee. Neither world layers nor walk logs are updated.
Georeferenced, human-reviewed observations and a validated mapping policy are still needed for that step.

Verification: `npm test`, `npm run build`, `npx playwright install chromium`, `npm run test:browser`.
The browser tests run the production bundle, real worker, model and WASM, compare logits to Python ORT,
check flags-off lazy loading, upload validation and retry after a model-download failure.
The deterministic pixel fixture tests runtime parity, not scientific accuracy. `APP_TEST_URL=https://...`
runs the same checks against an existing deployment. A 390 px viewport is tested; real-phone timing remains unmeasured.
See [ONNX Runtime deployment guidance](https://onnxruntime.ai/docs/tutorials/web/deploy.html).
