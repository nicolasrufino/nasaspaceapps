// Vesta Vision's left card, the way Google Maps and Google Earth do it: one short floating card, never a long column.
// The route on one line, the stops as one list in walk order (tick a row to include it), and the map layers in a
// popover behind a Layers button. On a phone the card is a bottom sheet with the stops folded (tap the route line).
// It only moves the existing controls; main.js still fills and wires them. Styles: body.vision in scout/index.html.
export function initVisionRail($) {
  const title = $('title'), layers = $('layers'), route = $('route'), targets = $('targets')
  const hint = targets.nextElementSibling // "Tick the stops for this walk. Tap the minimap to add your own stop."

  // Layers: a button by the title opens the views (Imagery, Hazards, ...) with their sources, like Maps' Layers.
  const pop = Object.assign(document.createElement('div'), { id: 'layerPop' })
  pop.popover = 'auto' // native popover: light dismiss and Esc for free
  pop.append(layers.previousElementSibling, layers, $('sources')) // the "Map layer" heading, the views, the sources line
  const btn = Object.assign(document.createElement('button'), { type: 'button', id: 'layerBtn', textContent: 'Layers' })
  btn.setAttribute('popovertarget', 'layerPop')
  const head = Object.assign(document.createElement('div'), { id: 'railHead' })
  title.replaceWith(head)
  head.append(title, btn)
  document.body.append(pop)

  // Stops: the summary line is the route's numbers; open, it is the walk's order as one list of toggles.
  const box = Object.assign(document.createElement('details'), { id: 'stopsBox', open: innerWidth > 760 })
  const sum = document.createElement('summary')
  const h2 = route.previousElementSibling // "Science stops"
  h2.replaceWith(box)
  sum.append(h2, route)
  box.append(sum, $('dropped'), targets, hint)
}
