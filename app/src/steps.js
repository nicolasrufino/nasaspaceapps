// Step mode (block E6, flag step_mode): the phone's motion sensor counts real steps and each step moves
// the astronaut STEP_M metres along the planned route; the compass says which way the route goes next.
// The Walk/Step buttons stay as the desktop fallback until the first sensor reading arrives.

// Calibration knobs: tune on the phone (a real accelerometer reads off; strides differ).
export const STEP_M = 0.7 // metres per step, a typical walking stride
export const KNOBS = { threshold: 1.2, minGapMs: 300, smooth: 0.9 }

// Feed it |acceleration including gravity| (m/s²) and a time in ms; returns true on a step.
// A step = the reading jumps more than `threshold` above its own running average (which tracks gravity
// and how the phone is held), at least `minGapMs` after the last step; it must dip below the average
// again before the next one counts.
export function stepDetector({ threshold, minGapMs, smooth } = KNOBS) {
  let base = null
  let armed = true
  let last = -Infinity
  return (mag, t) => {
    base = base === null ? mag : smooth * base + (1 - smooth) * mag
    const d = mag - base
    if (armed && d > threshold && t - last >= minGapMs) {
      armed = false
      last = t
      return true
    }
    if (d < 0) armed = true
    return false
  }
}

// Compass heading in degrees clockwise from north, or null when the event has none.
// iOS gives webkitCompassHeading; Android gives an absolute alpha (counter-clockwise).
// ponytail: assumes the phone is held upright in portrait; add screen.orientation.angle if landscape matters.
export function headingOf(e) {
  if (e.webkitCompassHeading != null) return e.webkitCompassHeading
  if (e.absolute && e.alpha != null) return (360 - e.alpha) % 360
  return null
}

// Grid bearing from cell a to cell b, degrees clockwise from north (row 0 is north, so north is -y).
export const bearing = (a, b) => ((Math.atan2(b[0] - a[0], a[1] - b[1]) * 180) / Math.PI + 360) % 360
// Signed turn from heading to target, -180..180; positive = turn right.
export const turn = (heading, target) => ((target - heading + 540) % 360) - 180

// DOM side. segment() = [current cell, next cell] on the route, or null at the end;
// blocked() = true while a stop's checklist is open; step() = main.js's one-cell move.
export function initSteps({ panel, cs, segment, blocked, step }) {
  const el = (tag, props = {}) => Object.assign(document.createElement(tag), props)
  const btn = el('button', { textContent: 'Use my steps' })
  const status = el('p', { className: 'src', textContent: 'Step mode: walk for real with the phone held upright.' })
  status.setAttribute('aria-live', 'polite')
  panel.append(el('h2', { textContent: 'Step mode' }), btn, status)

  const api = { live: false }
  let steps = 0
  let owed = 0 // metres walked, not yet turned into a cell move
  let heading = null

  function show() {
    const seg = segment()
    let s = `Steps ${steps} · ${(steps * STEP_M).toFixed(1)} m`
    if (heading !== null) s += ` · heading ${Math.round(heading)}°`
    if (heading !== null && seg) {
      const t = turn(heading, bearing(...seg))
      s += Math.abs(t) < 20 ? ' · route straight ahead' : ` · route ${Math.round(Math.abs(t))}° to your ${t > 0 ? 'right' : 'left'}`
    }
    status.textContent = s
  }

  function onStep() {
    steps++
    if (blocked()) owed = 0 // standing at a stop: steps there don't move you along
    else owed += STEP_M
    for (let seg; (seg = segment()) && !blocked();) {
      const d = cs * Math.hypot(seg[1][0] - seg[0][0], seg[1][1] - seg[0][1])
      if (owed < d) break
      owed -= d
      step()
    }
    show()
  }

  btn.onclick = async () => {
    if (typeof DeviceMotionEvent === 'undefined') return (status.textContent = 'No motion sensor here: use the Walk and Step buttons.')
    try {
      // iOS asks for permission, and only from a tap.
      for (const E of [DeviceMotionEvent, globalThis.DeviceOrientationEvent]) {
        if (E?.requestPermission && (await E.requestPermission()) !== 'granted') return (status.textContent = 'Motion sensor permission refused.')
      }
    } catch (e) {
      return (status.textContent = `Motion sensor unavailable: ${e.message}`)
    }
    btn.disabled = true
    status.textContent = 'Listening for steps… (on a laptop nothing comes: use Walk and Step)'
    const detect = stepDetector()
    addEventListener('devicemotion', (e) => {
      const a = e.accelerationIncludingGravity
      if (a?.x == null) return
      if (!api.live) {
        api.live = true // sensors work: steps replace the buttons
        document.getElementById('play')?.setAttribute('hidden', '')
        document.getElementById('step')?.setAttribute('hidden', '')
        show()
      }
      if (detect(Math.hypot(a.x, a.y, a.z), e.timeStamp)) onStep()
    })
    const orient = (e) => {
      const h = headingOf(e)
      if (h !== null) (heading = h), show()
    }
    addEventListener('deviceorientationabsolute', orient) // Android
    addEventListener('deviceorientation', orient) // iOS (webkitCompassHeading)
  }
  return api
}
