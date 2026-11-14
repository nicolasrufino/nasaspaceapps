# Person 1: Machine learning (Jules)

**Who:** Jules (GitHub `julesrumeautennis-cmd`). Lane P1 in `docs/BUILD.md`.

**Mission:** turn NASA images into hazard data, and prove it works. First: rocks found from their shadows in full-resolution HiRISE images (the method NASA used to check landing sites). Second: a ground classifier for rover photos. Overnight: the CAPCOM agent on Azure and the proof numbers. Stretch: the RL buddy rover.

**Owns:** `ml/` and `agent/`.
**Reads:** world files in `data/worlds/` (`docs/CONTRACTS.md` §1).
**Writes:** `rocks_fine.u8` for Galsan's world folder, `ml/exports/terrain_cls.onnx`, `ml/exports/buddy_policy.onnx`, a metrics `.json` next to each (contract §2), and the CAPCOM service (contract §4).

## Your blocks, in order

| Block | When | What | Needs | Issue |
|---|---|---|---|---|
| R1 Rock detector v0 | M0 | Shadow-based rock detection on one downloaded 25 cm USGS tile of Gale; hand-check 50 rocks | nothing | #31 |
| R2 Placeholder models | M0 | Shape-correct `terrain_cls.onnx` and `buddy_policy.onnx` plus `ml/check_exports.py`, so Nicolas can load models now | nothing | #5 |
| R3 Rocks for our slice | M1 | Run the detector on Galsan's slice, write `rocks_fine.u8`, report agreement with the hand-checked rocks | R1, D1 | #31 |
| R4 Ground classifier | M2 | MobileNetV3-small or ResNet18 on 128×128 AI4Mars patches (soil, bedrock, sand, big rock); held-out accuracy and confusion matrix; tested on Perseverance photos | R2 | #6 |
| R7 CAPCOM agent on Azure | Overnight | Microsoft Foundry agent with tools `get_state`, `explain_ring`, `nearest_safe_point`; replies delayed 20 s; every tool call logged. **Required for the Best Use of Technology award** | E2 | #42 |
| R5 Numbers for the pitch | Overnight | Rocks avoided by the scouted route versus orbit only; margin home along the route; ring change if energy is off by ±30% | R3, D4 | #15 |
| R6 Buddy rover RL (stretch) | Overnight | Grid env (27-value observation, contract §2) and PPO "lead" policy, compared with the scripted rover | R2, D2 | #4, #7 |
| F1 Numbers into the slides | Freeze | Final numbers on the proof slide | R5 | #45 |

**Tips:**
- Check the AI4Mars download size first; take a subset if it is large.
- For the rover, train on the grid state, not pixels: fast on a laptop. Reward: lead the astronaut by 2–6 cells on low-cost cells, head home under 35% energy, big penalty for steep cells.
- Azure keys live in environment variables or `.env`, never in the repo.

## Done when
- `python ml/check_exports.py` passes; each ONNX file has a metrics JSON with a held-out number and its data source.
- `rocks_fine.u8` is in the real world folder, with the agreement number written to a file.
- CAPCOM answers late in the demo, and the app works if it is down.

## Don't
- Don't change contract shapes without a PR to `docs/CONTRACTS.md`.
- Don't train a classifier on images our own engine rendered; it only learns our textures.
- Don't put a number in the pitch that a script in this repo didn't write.

## Agent brief (paste into your coding agent)
> You are helping Jules (Person 1, machine learning) on Martian Map, a NASA Space Apps project. Read `AGENTS.md`, `docs/PRODUCT.md`, `docs/BUILD.md` (lane P1) and `docs/CONTRACTS.md` first. Work inside `ml/` and `agent/`. Do the P1 blocks in order: (R1) shadow-based rock detection on a 25 cm USGS HiRISE tile of Gale, with a hand-checked sample; (R2) shape-correct placeholder `ml/exports/terrain_cls.onnx` and `buddy_policy.onnx` plus `ml/check_exports.py`; (R3) `rocks_fine.u8` for the real world folder with an agreement number; (R4) an AI4Mars ground classifier exported to ONNX with held-out accuracy in `terrain_cls.json`; (R7) a CAPCOM service in `agent/` per CONTRACTS §4 on Microsoft Foundry, replies delayed by `delay_s`, every tool call logged, keys from the environment. Never change contract shapes without editing CONTRACTS.md in the same PR. One issue per session; small, working commits; numbers only from code you ran.
