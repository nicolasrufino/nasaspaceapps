// Only constructed behind voi. Send orbital inputs and observed facts, never the
// hidden hazard layer or the fully scouted return-cost layer, to the selector.
export function createVoiSelector({ meta, layers }) {
  let worker, nextId = 0, timer
  const observedWorld = { meta, layers: Object.fromEntries(
    ['height', 'slope', 'terrain_class', 'passable', 'unsure', 'thermal_inertia'].filter((k) => layers[k]).map((k) => [k, layers[k]])) }
  return (scout) => new Promise((resolve, reject) => {
    const initialize = !worker
    worker ??= new Worker(new URL('./scout-voi-worker.js', import.meta.url), { type: 'module' })
    const id = ++nextId
    const fail = (message) => { clearTimeout(timer); worker.terminate(); worker = null; reject(new Error(message)) }
    worker.onerror = () => fail('Experimental flight selection failed.')
    worker.onmessage = ({ data }) => {
      if (data.id !== id) return
      clearTimeout(timer)
      if (data.error) fail(data.error)
      else resolve(data.result)
    }
    timer = setTimeout(() => fail('Experimental flight selection exceeded 60 seconds.'), 60000)
    worker.postMessage({ id, ...(initialize ? { world: observedWorld } : {}), scout: {
      scanned: scout.scanned, blocked: scout.blocked, route: scout.route, targets: scout.targets,
      flights: scout.flights.map(() => ({})), maxFlights: scout.maxFlights, flightLimit: scout.flightLimit,
    } })
  })
}
