# Decision briefs

Recommendations for the open decisions in `docs/DECISIONS.md` that we (Nicolas and the app side) can settle without waiting on another teammate. Each brief: the recommendation, the evidence, why not the alternative, the holes we checked, and what is still an estimate. **Nicolas decides; once a brief is accepted, it moves to the Decided table in `docs/DECISIONS.md`.**

Written 2026-11-15.

---

## 1. Approve PR #94 (routes on crossings + measured walking energy)

**Recommendation: approve, on two conditions.** (a) Jules re-exports R3 first. (b) Rebuild the world files at 20° **in the same PR**, so Jules re-exports once instead of twice (both changes alter `cost_to_go_scouted.f32`, which R3 pins by hash).

**Evidence.**
- **Gravity factor 0.68:** walking at simulated 0.38 g used about 68% of Earth's oxygen (2018 lower-body positive pressure study, cited in `docs/SCOUTING.md`). An independent classic agrees: Farley & McMahon (1992) found that cutting gravity by 75% cut walking's metabolic cost by only about 33% ([summary](https://pmc.ncbi.nlm.nih.gov/articles/PMC6465764)). Walking cost does not fall in proportion to gravity, so our 0.38 scaling was too low.
- **Sand 2.4×:** measured 2.1–2.7× on sand (Lejeune et al. 1998). 2.4 is the middle of the measured range.
- **Crossings:** 8 m cells hide what stops a person: 35% of "walkable" cells hide a stretch over the limit at 2 m scale (Luca's measurement on the 1 m HiRISE DTM). JETT3 crews with 1 m maps still hit impassable drop-offs.

**Why not keep the old model:** it under-counts energy by about 1.8× and lets routes cross ledges; every number in the pitch would be optimistic.

**Holes checked.**
- *Is 0.68 still too low?* Probably yes: suits add cost on top (Norcross et al. 2009). #94 moves us toward the truth, not past it. The docs keep saying the energy is a floor.
- *Does it break the app?* Per #94, `walk.js` falls back to the old constants on old worlds. I still test the app commit in a browser before approving. Contract change is additive (new knobs).
- *Does the tour still fit?* Only if the budget changes too: see brief 2.

---

## 2. Energy budget: real suit figure, not auto-sized

**Recommendation: use the suit-based budget Luca put in #94** (NASA planetary suit sizing rate of 1,200 BTU/h, 8 h suit, 1.5 h reserve, stops subtracted; ICES-2026-127). **Drop auto-sizing.**

**Why not auto-sizing:** it sizes the budget so the tour uses about 80% of it, which is circular. It hides exactly what #94 revealed (the walk is harder), and it is an invented number (rule 5).

**Holes checked.**
- *The walk-back ring gets much bigger and looks less dramatic in the demo.* True, and honest: on a real suit, energy is not the tightest limit on this tour. For the demo, the ring still shrinks as you walk, and the time limit (sunset, brief 7) becomes the visible limit.
- *Units:* 1,200 BTU/h is a metabolic heat rate (about 352 W), the same kind of quantity Pandolf predicts (metabolic watts). Consistent.

---

## 3. Which scouting mode first: **reach the targets**

**Recommendation: build "reach the targets" first; "build a network" after.**

**Why:**
1. **It is the demo:** five Curiosity stops, planned the night before.
2. **It is the building block:** a network's value is the sum of reach-the-targets values over the walks expected to use it. Network mode cannot exist without it.
3. **It can be measured honestly:** for a fixed set of targets we can compare against "knowing everything". Network mode needs a model of *future* walks (which targets, how often), and we have no data for that. It would be an invented number.
4. **Network mode is a harder problem:** connecting many places with one cheapest network is a Steiner-tree problem (NP-hard), on top of value of information.

**Holes checked.**
- *Do we lose the long-term story?* No. Confirmed cells already persist across walks (Galsan's D7 "map grows" merge). The demo can show a **second walk needing fewer flights** because the first walk's flights are reused. That is long-term value, measured, without network mode.

---

## 4. How high the helicopter flies: **cruise at about 10 m, camera tilted 45° below the horizon**

**Recommendation:** about 10 m (a knob), camera looking forward and down at 45°, like Ingenuity's colour camera. The earlier "above 6 m" proposal was not high enough (see dust below).

**Evidence.**
- **Dust:** Ingenuity's rotor lifted dust below 3 m on take-off, from 2.3–3.6 m on landing, and **extensively even when traversing at 5.1–5.7 m** ([Lemmon et al. 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC10078181)). 2 m puts the camera inside its own dust cloud; 6 m is still marginal.
- **Clearance:** Gale boxwork ridges reach 1.7 m inside a cell (90th percentile, Luca #93). 2 m leaves about 0.3 m.
- **Resolution is not a reason to fly low:** Ingenuity's colour camera is 4208 × 3120 pixels with a 102° × 82° field of view, boresight 45° below horizontal ([Maki et al., LPSC 2025](https://epizodyspace.ru/bibl/inostr-yazyki/Lunar_and_Planetary_Science/2025/Maki_et_al_Ingenuity_Mars_Helicopter_Cameras_56th_LPSC_no_2685_(2025).pdf)). That is about 0.42 mrad per pixel: from 10 m up, at a 14 m slant range, one pixel covers about 6 mm, so a 0.3 m rock is about 50 pixels across. Even at 50 m range it is 14 pixels.
- **Swath:** at 10 m and 45°, the view at about 14 m range is roughly 34 m wide, which matches the 15 m swath radius the app already uses.

**Why not 2 m for the rover-like view:** the classifier must be fine-tuned on helicopter images anyway (93% on Curiosity fell to 48% on Perseverance at the *same* height). Similar height does not buy transfer; dust and ridges make it unsafe.

**Holes checked.**
- *JPL's photojournal says the camera points 22° below the horizon; Maki et al. (2025, the camera team) say 45°.* We take the camera team's paper; it is a knob either way.
- *Navigation:* Ingenuity navigates by tracking ground features with a downward camera; flying higher keeps more features in view and slower across it. No published minimum, so no number claimed.

---

## 5. What "blocked" means for a suited walker

**Recommendation: a rock taller than 0.3 m is an obstacle. A cell is blocked when the average gap between obstacle rocks is under 1.0 m. Otherwise rocks only make the cell costlier** (the "big rock" walking cost, η = 1.5, Soule & Goldman).

**Evidence.**
- **0.3 m:** NASA's xEMU step test at lunar gravity: subjects stepped up 43–76 cm, and modelled for the **smallest (1st percentile) crew member, 12.5 in = 0.32 m** ([ICES-2025-294](https://ntrs.nasa.gov/api/citations/20250004496/downloads/ICES2025-294-stepheight-final.pdf)). Luca already uses 0.3 m for ledges in #93, so rocks and ledges follow one rule.
- **Rock height to width:** rocks are about half as tall as they are wide (lunar boulders 0.54; Mars similar or smaller, per Golombek et al. 2012 as cited by [Hood et al. 2018](https://sfsholes.github.io/papers/abstracts/Hood2018_LPSC_BoulderDetection.pdf)). So 0.3 m tall means about 0.6 m wide, below HiRISE's roughly 1.5 m detection limit. These rocks must be **predicted** with the rock-size law, which is what the belief map does.
- **1.0 m gap:** the hatch width NASA's same paper uses so the largest (99th percentile) suited crew member fits through: 40 in = 1.02 m.
- **The arithmetic:** for randomly scattered rocks of 0.6 m, the average nearest-neighbour gap drops under 1.0 m at about **6 obstacle rocks per 8 m cell** (0.095 per m²).

**Holes checked.**
- *Mars gravity is higher than the Moon's,* so stepping up is harder than in that test. 0.3 m is an **upper bound**. The benchmark should also run at 0.25 m to show how much the answer depends on it.
- *Mars rocks may be flatter* (smaller height-to-width). Then a 0.6 m wide rock may be under 0.3 m tall, so we count a few too many obstacles. That errs toward safety.
- *Walkers pick the widest gap, not the average.* So the average-gap rule declares "blocked" early. Again, it errs toward safety.
- *The cut-off of about 6 per cell is geometry, not a measurement.* It gets calibrated against Curiosity's "big rock" labels when Jules's labels arrive.

---

## 6. Stop rule: when is a flight worth flying?

**Recommendation: fly the best strip only if both are true: (a) its value is clearly above sampling noise (lower 90% bound above zero), and (b) it saves at least 1% of the walk's expected energy. Stop at the flight budget (brief 7) regardless.**

**Why this shape:**
- **Energy is not what a flight costs.** One flight uses about 10 Wh, which a 40 kW habitat reactor makes in about one second. What a flight really costs is **a scarce flight**, and a risk to the helicopter. Ingenuity was lost on its 72nd flight: one loss in 72 flights, about 1.4% per flight (a crude single-event estimate). So the rule must avoid wasting flights, not save electricity.
- **(a) Noise:** value is estimated from sampled worlds. Without a noise test, the planner would fly toward random noise when every true value is near zero.
- **(b) 1% of the walk:** on the Gale tour under #94 (617 kJ), 1% is 6 kJ, about 0.3 L of oxygen. Savings below that do not change any decision the crew would make.

**Holes checked.**
- *Does an expected-value rule ignore a rare dead end?* The walk-back ring and the 20% reserve (or the 1.5 h suit reserve) already cover the worst case on every step. The stop rule only decides when more information stops paying.
- **Still a judgment:** 1% is a judgment call, and it is a knob. Part (a) is not a judgment.

---

## 7. Flight budget: **6 flights per walk** (3 helicopters × 2 flights, in the sol before the walk)

**Recommendation:** count the budget in flights (that is what the planner spends), derived from sols (that is how operations work). Fly in the sol before the walk, so the plan is made that evening.

**Evidence.**
- **Battery:** Ingenuity's six cells hold about 38.8 Wh at 0 °C, 44.4 Wh new at 25 °C ([NASA/JPL battery paper](https://www.nasa.gov/wp-content/uploads/2024/01/battery-system-design-testing-and-operation-for-the-mars-perseverance-rover-and-ingenuity-helicopter.pdf)). Flights were capped at about 10 Wh / 90 s, to protect the motors from overheating (secondary source). So battery capacity is not the limit; motor heat and the time window are.
- **Window:** Ingenuity flew between about 09:30 and 12:30 local time depending on season. Not too early (cold), not late afternoon (risk of draining the battery before the Sun could recharge it); never at night (it needs its camera) ([NASA, "When should Ingenuity fly?"](https://science.nasa.gov/blog/when-should-ingenuity-fly/); [Seitah flight 24](https://science.nasa.gov/missions/mars-2020-perseverance/ingenuity-helicopter/balancing-risks-in-the-seitah-region-flight-24/)).
- **Habitat charging** removes the late-afternoon battery worry and the overnight heating drain (about 60% of Ingenuity's energy went to keeping warm, secondary source). Two flights per helicopter in a midday window, with charging and motor cool-down between them, is conservative.

**Holes checked.**
- *SkyFall's battery and motors are unpublished.* Flights per sol stays a labelled knob; the benchmark reports quality at 3, 6 and 9 flights so the conclusion does not hang on one number.
- *Winds:* MEDA measured 3.5–6 m/s during Ingenuity's first flights; wind limits can cancel a sol. The budget is a maximum, not a promise.

---

## 8. Walking window: **the whole walk, including the walk back, while the Sun is at least 15° up; at most 8 h**

**Evidence.**
- **Shadows hide hazards.** A 0.3 m rock casts a 1.1 m shadow at 15° Sun, and 3.4 m at 5°. NASA's Artemis lighting work reports glare and deep shadows at sun angles of about 2–9° that complicate obstacle avoidance and make slopes look steeper ([NASA lighting brief](https://www.nasa.gov/wp-content/uploads/2023/03/artemis-lighting-considerations-overview-technical-brief-ochmo.pdf); [IEEE lighting study](https://ntrs.nasa.gov/api/citations/20240011393/downloads/Lighiting%20Study%20IEEE%20Paper%20FINAL-1.pdf)).
- **At Gale (4.8° S) the Sun climbs about 14–15° per hour near the horizon**, so 15° is roughly 1 hour after sunrise and before sunset. To be computed exactly with the Mars24 algorithm (Allison & McEwen 2000).
- **Cold:** REMS at our site: air from about −77 °C at night to −24 °C by day; ground from −88 °C to −5 °C (`data/worlds/gale/weather.json`, daily summaries). After sunset the margin goes fast.
- **8 h:** NASA suit studies model EVAs of 2, 4, 6 and 8 hours ([ICES Mars PLSS 2026](https://ntrs.nasa.gov/api/citations/20260005204/downloads/ICES_Mars_PLSS_Presentation_2026_1.pdf)), and the xEMU is sized for 8 h. Daylight at Gale is about 12 h, so the window (about 10 h of Sun above 15°) is longer than the suit allows. The suit is the tighter limit; the Sun matters for late starts.

**Holes checked.**
- *Dust storms dim the light:* REMS reports opacity; a "no walk" flag when opacity is not "Sunny" is an easy rule to add.
- *Why not just "1 hour before sunset"?* Sun elevation is what makes shadows. The hour changes with season; the angle does not.

---

## 9. Demo look: **coarse everywhere, real detail where the helicopter flew**

**Recommendation:**
- **v1 (now):** the orbit map is shown muted as "not confirmed". Flown strips switch to full colour with the rocks found and the blocked crossings (Luca's `passable.u8`).
- **v2:** real 1 m HiRISE heights appear along flown strips, exported by Luca's `terrain_1m.py` per strip. One strip of 700 m × 30 m is about 21,000 heights, about 84 KB.

**Why:**
- It shows what we **know**, and grows only where we learned something. That is the product's thesis made visible.
- It matches Galsan's "map grows" work.
- It is cheap on a phone: a colour update in v1, a small mesh patch in v2.

**Holes checked.**
- *Is the "detail" real?* Our world has 8 m heights. The 1 m DTM is real NASA orbit data, standing in for what helicopter stereo would give (finer still), and we say so on screen. We do not invent detail.

---

## Sources (beyond those linked above)

[Farley & McMahon 1992 context](https://pmc.ncbi.nlm.nih.gov/articles/PMC6465764) · [NASA xEVA overview, slopes up to 20°](https://ntrs.nasa.gov/api/citations/20210000827/downloads/Exporation%20EVA%20Testing%20and%20Analogs%2020210000827.pdf) · [xEVA concept of operations](https://ntrs.nasa.gov/api/citations/20200001071/downloads/20200001071.pdf) · [Golombek, rocks from HiRISE match lander counts](https://experts.arizona.edu/en/publications/size-frequency-distributions-of-rocks-on-the-northern-plains-of-m-2/)
