// A2: measured consequences of one completed flight, using only its observations.
import { describe, stretches } from './why.js'

export function explainFlight(world, flight, targets) {
  const { before, after, found } = flight
  const at = ([x, y]) => y * world.meta.width + x
  const oldCells = new Set(before.cells.map(at)), newCells = new Set(after.cells.map(at))
  const discoveries = new Set(found)
  const avoided = [...discoveries].filter((i) => oldCells.has(i) && !newCells.has(i)).length
  const ordered = before.stops.map((id) => targets.find((s) => s.id === id))
  const legs = stretches(before, ordered.map((s) => s.cell))
  let along = 0, destination = 'Base'
  for (let k = 0; k < legs.length; k++) {
    along += describe(world, legs[k]).metres
    if ((flight.route_start_m ?? 0) < along) { destination = ordered[k]?.name ?? ordered[k]?.id ?? 'Base'; break }
  }
  const unchangedStops = before.stops.length === after.stops.length && before.stops.every((id) => after.stops.includes(id))
  return { metres: flight.metres, destination: flight.destination ?? destination,
    found_cells: discoveries.size, avoided_cells: avoided,
    energy_delta_j: describe(world, after.cells).energy_j - describe(world, before.cells).energy_j,
    stops_before: before.stops.length, stops_after: after.stops.length, unchanged_stops: unchangedStops }
}

export function flightText(summary, number) {
  const s = summary, delta = s.energy_delta_j / 1000
  const change = Math.abs(delta) < .05 ? '0.0 kJ' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)} kJ`
  const stops = s.unchanged_stops ? `${s.stops_after} stops kept` : `${s.stops_before} → ${s.stops_after} stops (selection changed)`
  return `Flight ${number}: checked ${Math.round(s.metres)} m of corridor toward ${s.destination}. ` +
    `Found hazards in ${s.found_cells} new cells. Route: ${change}; ${s.avoided_cells} newly found route cells avoided; ${stops}.`
}

export function mountFlightLog(panel, world) {
  const section = document.createElement('section')
  section.hidden = true
  const title = document.createElement('h2')
  title.textContent = 'Why these flights'
  const list = document.createElement('ol')
  list.id = 'flightLog'
  list.setAttribute('aria-label', 'Completed flight explanations')
  list.style.cssText = 'font-size:14px;line-height:1.45;padding-left:1.3em;margin:6px 0'
  section.append(title, list)
  panel.append(section)
  return (flight, targets, number) => {
    const item = document.createElement('li')
    item.style.marginBottom = '10px'
    item.textContent = flightText(explainFlight(world, flight, targets), number)
    list.append(item)
    section.hidden = false
  }
}
