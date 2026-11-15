// The helicopter's battery during one scouting flight. Pure functions, no DOM. Everything this file returns is an
// ESTIMATE: it puts NASA's Ingenuity power and battery figures on the SkyFall flight profile. SkyFall's own
// helicopters have no published power or battery numbers that we found, so the screen says "estimate" next to them.
//
// Sources (checked 2026-11-15):
// - Flight power, about 350 W: NASA/JPL Ingenuity landing press kit, "Power expended by the helicopter during an
//   up-to-90-second flight is about 350 watts."
//   https://www.jpl.nasa.gov/news/press_kits/ingenuity/landing/mission/spacecraft/
// - Battery: six Sony SE US18650 VTC4 lithium-ion cells in series, 2.00 Ah each; estimated beginning-of-life energy
//   44.4 Wh at 25 °C and 38.8 Wh at 0 °C. NASA/JPL, "Battery system design, testing and operation for the Mars
//   Perseverance rover and Ingenuity helicopter", slide "Mars Helicopter: Ingenuity".
//   https://www.nasa.gov/wp-content/uploads/2024/01/battery-system-design-testing-and-operation-for-the-mars-perseverance-rover-and-ingenuity-helicopter.pdf
//   We take the colder, smaller figure. It is the whole battery when new, not a "usable" figure: NASA's slide gives
//   no usable fraction, and survival heating and reserve are not taken off. So the percentage shown is optimistic.
// - Flight profile, about 1 km in about 2.5 minutes: NASA SkyFall Mission Information Package (Sept 2026) §II, as
//   recorded in docs/OPERATIONS.md §2 and docs/DECISIONS.md (1 km per flight, FLIGHT_M = 1000).
//   https://science.nasa.gov/wp-content/uploads/2026/09/skyfall-mission-information-package-final.pdf

export const FLIGHT_POWER_W = 350 // NASA/JPL Ingenuity press kit: average power in flight
export const BATTERY_WH = 38.8 // NASA/JPL battery slide: six cells, beginning of life, at 0 °C
export const BATTERY_CELLS = 6 // same slide
export const PROFILE_M = 1000 // SkyFall: about 1 km ...
export const PROFILE_S = 150 // ... in about 2.5 minutes
export const CRUISE_MPS = PROFILE_M / PROFILE_S // derived estimate: 6.7 m/s, a whole-flight average (take-off and landing included)

// Real seconds in the air to cover `metres` (estimate: constant whole-flight average speed).
export const flightSeconds = (metres) => Math.max(0, metres) / CRUISE_MPS
// Watt-hours spent covering `metres` (estimate: constant 350 W for the whole flight).
export const flightWh = (metres) => (FLIGHT_POWER_W * flightSeconds(metres)) / 3600
// Fraction (0..1) of the battery left after flying `metres`, starting full (estimate).
export const batteryLeft = (metres) => Math.max(0, Math.min(1, 1 - flightWh(metres) / BATTERY_WH))
