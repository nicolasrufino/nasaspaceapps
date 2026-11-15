// "Best areas" layer: where it is worth going, from what is known now (see app/HOW-IT-WORKS.md §8).
import { costFrom } from './plan.js'

// "Best areas" score, 0 (don't) to 1 (go), from what is known now:
// - 0 if too steep, a rock the helicopter saw, or the round trip from base doesn't fit the usable energy;
// - otherwise the share of usable energy left after the round trip, halved where nobody has scouted yet,
//   and weighted by science value (science.u8, CRISM / geologic map) when the world has it.
export function bestAreas({ meta, layers }, ctg, scanned, blocked) {
  const usable = meta.energy_budget_j * (1 - meta.reserve_fraction)
  const out = costFrom({ meta, layers }, meta.base_cell, blocked).dist // base -> cell; ctg is cell -> base
  const score = new Float32Array(meta.width * meta.height)
  for (let i = 0; i < score.length; i++) {
    if ((!layers.passable && layers.slope[i] > meta.knobs.max_slope_deg) || blocked?.[i]) continue // crossings already in costFrom
    const left = 1 - (out[i] + ctg[i]) / usable
    if (!(left > 0)) continue
    const sci = layers.science ? 0.4 + 0.2 * layers.science[i] : 1
    score[i] = left * (scanned[i] ? 1 : 0.5) * sci
  }
  return score
}
