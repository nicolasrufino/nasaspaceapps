import { createVoiContext, chooseVoi } from './scout-voi.js'

let world, context
self.onmessage = ({ data }) => {
  try {
    if (data.world) { world = data.world; context = createVoiContext(world) }
    self.postMessage({ id: data.id, result: chooseVoi(world, data.scout, context) })
  } catch (error) {
    self.postMessage({ id: data.id, error: error.message })
  }
}
