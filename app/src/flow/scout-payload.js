// S4: summarize stored NASA/USGS layers in the SAME footprint as the scout.
// This is a simulated observation, not a sensor model or a new safety decision.
import { scanFlight } from '../scout.js'

export const SKYFALL_SOURCE = 'https://science.nasa.gov/wp-content/uploads/2026/09/skyfall-mission-information-package-final.pdf'
// Section IV: 106-degree horizontal colour-camera FOV. 10 m is OUR assumed
// height, not a NASA flight specification; the footprint would be about 26.5 m.
export const CAMERA_FOOTPRINT_M = 2 * 10 * Math.tan(53 * Math.PI / 180)

// A stage-local switch: ?flags= selects the legacy Vision UI in main.js.
export const scoutPayloadEnabled = (search) => new URLSearchParams(search).get('scout_payload') === '1'

export function summarizePayloadFlight(world, flight) {
  const { meta, layers } = world
  const mask = new Uint8Array(meta.width * meta.height)
  // Fresh mask per flight: overlap counts once within a strip and is included
  // again on a later flight. Never change the route's shared scanned mask.
  const cells = scanFlight(meta, mask, { ...flight, next_sample_m: 0 })
  let ridges = 0, hollows = 0, landforms = 0, rocks = 0, rockSamples = 0, dose = 0, doses = 0
  for (const i of cells) {
    const form = layers.landform?.[i], rate = layers.dose_rate?.[i], rock = layers.rocks_fine?.[i]
    if (Number.isInteger(form) && form >= 0 && form <= 3) {
      landforms++
      if (form === 2) ridges++
      if (form === 3) hollows++
    }
    if (Number.isFinite(rate) && rate >= 0) { dose += rate; doses++ }
    if (rock === 0 || rock === 1) { rocks += rock; rockSamples++ }
  }
  return {
    metres: flight.metres, cells: cells.length, area_m2: cells.length * meta.cell_size_m ** 2,
    ridge_share: landforms ? ridges / landforms : null,
    hollow_share: landforms ? hollows / landforms : null,
    mean_dose_rate_ugy_h: doses ? dose / doses : null,
    rock_cells: rockSamples ? rocks : null,
    landform_samples: landforms, dose_samples: doses, rock_samples: rockSamples,
  }
}

// No mission sol is selected in the scout stage. Show the historical sol
// explicitly instead of presenting REMS ground weather as flight telemetry.
export function latestWeather(weather) {
  return (weather?.sols ?? []).filter((s) => Number.isFinite(s.sol)
    && Number.isFinite(s.min_temp_c) && Number.isFinite(s.max_temp_c))
    .reduce((latest, s) => !latest || s.sol > latest.sol ? s : latest, null)
}
