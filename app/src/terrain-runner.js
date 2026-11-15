// The worker and its model are fetched only after the user presses Analyze.
export function createTerrainRunner() {
  let worker, pending
  function reset(error) {
    worker?.terminate()
    worker = null
    if (pending) { clearTimeout(pending.timer); pending.reject(error); pending = null }
  }
  return {
    run(tensor) {
      if (pending) return Promise.reject(new Error('An analysis is already running.'))
      return new Promise((resolve, reject) => {
        try {
          worker ??= new Worker(new URL('./terrain-worker.js', import.meta.url), { type: 'module' })
          pending = { resolve, reject, timer: setTimeout(() => reset(new Error('Analysis timed out. Try again.')), 90000) }
          worker.onerror = (event) => { event.preventDefault(); reset(new Error('Could not start the model. Check your connection and try again.')) }
          worker.onmessage = ({ data }) => {
            if (data.error) { reset(new Error(data.error)); return }
            clearTimeout(pending.timer)
            const { resolve } = pending
            pending = null
            resolve(data.logits)
          }
          worker.postMessage(tensor, [tensor.buffer])
        } catch (error) { reset(error); reject(error) }
      })
    },
  }
}
