# Person 1: Machine learning (only ML)

**Mission:** the two trained models that make the map smarter: a terrain classifier and a buddy rover. Nothing else. Other people integrate your exports.

**Owns:** `ml/` (training code, notebooks, `ml/exports/`).
**Reads:** world files in `data/worlds/` (see `docs/CONTRACTS.md` §1).
**Writes:** `ml/exports/terrain_cls.onnx`, `ml/exports/buddy_policy.onnx`, and a `.json` next to each with metrics (contract §2).

## Foundation (do first)
1. **11:30–12:30** Python env: `torch`, `gymnasium`, `stable-baselines3`, `onnx`, `onnxruntime`. Load `data/worlds/synthetic/` into a 2D grid env (`ml/buddy_rover/env.py`) that matches the observation in contract §2. A random policy runs without errors.
2. **12:30–14:00** Export a **trivial** `buddy_policy.onnx` (for example, an untrained network with the right input and output shapes) and push it. This unblocks Person 2 immediately: they can wire the model before it is good.
3. **12:30–14:00, in parallel** Check the AI4Mars dataset size before downloading (Zenodo / data.nasa.gov). Take a subset if it is large. If the download is too slow, hand-label about 200 patches from Perseverance raw images (listed by NASA) and say so on the data slide.

## Features (in this order)
4. **By 16:00** `terrain_cls.onnx` v1: MobileNetV3-small or ResNet18 fine-tuned on 128×128 patches, 5 classes. Report held-out accuracy and a confusion matrix.
5. **By 21:00** Buddy rover trained with PPO on the synthetic world, then on the real Mars world when Person 3 exports it. Reward: stay 2–6 cells from the astronaut, prefer low-cost cells, scout ahead, head home under 35% energy, penalty for steep cells. Compare against the scripted follower (same metric) so the RL is shown against a baseline.
6. **Overnight** Retrain on the real world with randomized start points; record a short clip of the policy for the pitch; write the numbers in `ml/exports/*.json`.
7. **Stretch** Classify the real Mars tile's terrain from orbital or rover images and hand Person 3 a `terrain_class.u8` layer.

## Done when
- Both ONNX files load in `onnxruntime` with the contract shapes (`python ml/check_exports.py` passes).
- Each has a metrics JSON with a held-out number and the data source.

## Don't
- Don't change contract shapes without a PR to `docs/CONTRACTS.md`.
- Don't block on the engine choice: ONNX works in both.
- Don't train on pixels for the rover; train on the grid state (fast on a laptop).

## Agent brief (paste into your coding agent)
> You are helping Person 1 (machine learning) on Martian Map, a NASA Space Apps project. Read `AGENTS.md`, `docs/PLAN.md` and `docs/CONTRACTS.md` first. Work only inside `ml/`. Goals in order: (1) a Gymnasium grid env that loads `data/worlds/<name>/` and produces the 27-value observation in CONTRACTS §2; (2) export a shape-correct `ml/exports/buddy_policy.onnx` immediately, even untrained; (3) a terrain classifier (5 AI4Mars classes, 128×128 RGB input) exported to `ml/exports/terrain_cls.onnx` with held-out accuracy in `terrain_cls.json`; (4) PPO training for the buddy rover with the reward in `docs/roles/person-1-ml.md`, compared against a scripted follower. Add `ml/check_exports.py` that loads both ONNX files with onnxruntime and asserts the contract shapes. Never change contract shapes without editing CONTRACTS.md in the same PR. Commit small, working steps.
