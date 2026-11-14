# Person 2: Engine and phone experience

**Mission:** the thing people hold: the game on the phone. Terrain, astronaut, ring, buzz, buddy rover, step mode.

**Owns:** `app/`.
**Reads:** world files (contract §1), ONNX models (contract §2).
**Writes:** app state and walk logs (contract §3).
**Decides:** the stack by 12:30 (see `docs/PLAN.md` §5; suggestion: Babylon.js).

## Foundation (do first)
1. **11:30–12:30** Choose the stack with the team. Create the app project in `app/`. Load `data/worlds/synthetic/world.json` and `height.f32`; render the terrain as a mesh, colored by `terrain_class.u8`.
2. **12:30–14:00** Astronaut marker that moves cell by cell (touch, arrow keys or a joystick). Energy left drains by the cost of each move (difference of `cost_to_go` is a good proxy; or the per-step cost from Person 3's helper).
3. **14:00–16:00** Walk-back ring: highlight cells where `cost_to_go <= energy_left - reserve`. Point of no return: vibrate and show a warning when the astronaut's cell leaves the ring. Runs on one phone over HTTPS (M1).

## Features (in this order, each behind a flag)
4. `step_mode`: real steps move the astronaut (motion sensor step detection + compass heading; one step about 0.7 m). Test in the hallway.
5. `buddy_scripted`: a rover that follows on low-cost cells. Then `buddy_rl`: load `buddy_policy.onnx`, build the 27-value observation, take the argmax action. Same rover, switchable.
6. Load the real Mars world from Person 3 (just a different folder).
7. `classifier` / `camera_mode`: run `terrain_cls.onnx` on a Perseverance image or the phone camera; show the class and its walking cost.
8. HUD in the style of a suit display: energy and oxygen left (`kj_per_l_o2`), margin, distance and minutes home, terrain class, buddy status, delay to Earth. Big, high-contrast, readable while walking. The suggested screens are on the team plan page.
9. `override`: E-STOP, hold, come to me, return to base along the breadcrumb path; on lost link the rover stops, then retreats.
10. `storm` and `dust`: walking minutes to the nearest shelter during a solar storm; dust lowers rover power and visibility.
11. `capcom`: show messages from the agent with their delay.
12. Log each walk (contract §3) for the debrief replay.

## Done when
- The foundation works on a phone with the synthetic world and with the real Mars world, every feature flag off.
- Turning any one feature off does not break anything.

## Don't
- Don't run pathfinding on the phone: the ring is a lookup in `cost_to_go`.
- Don't hard-code the world size or cell size: read `world.json`.

## Agent brief (paste into your coding agent)
> You are helping Person 2 (engine and phone) on Martian Map, a NASA Space Apps project. Read `AGENTS.md`, `docs/PLAN.md` and `docs/CONTRACTS.md` first. Work only inside `app/`. Build, in order: load `data/worlds/<name>/world.json` and the binary layers (float32 and uint8, little-endian, row-major, row 0 north); render the terrain colored by class; move an astronaut cell by cell and drain energy; draw the walk-back ring as every cell where `cost_to_go <= energy_left - reserve`; vibrate and warn at the point of no return. Then add features behind flags: step_mode (motion-sensor steps plus compass), buddy_scripted, buddy_rl (onnx model, contract §2 observation), classifier, capcom, logging (contract §3). Never hard-code sizes; never pathfind on the phone. Keep the app working with every flag off. Commit small, working steps.
