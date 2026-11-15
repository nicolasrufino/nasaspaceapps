import * as ort from 'onnxruntime-web/wasm'
import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url'
import wasmModuleUrl from 'onnxruntime-web/ort-wasm-simd-threaded.mjs?url'
import modelUrl from '../../ml/exports/terrain_cls.onnx?url'
import metadata from '../../ml/exports/terrain_cls.json'

// A dedicated worker keeps map interaction responsive. One thread needs no COOP/COEP.
ort.env.wasm.numThreads = 1
ort.env.wasm.wasmPaths = { wasm: wasmUrl, mjs: wasmModuleUrl }
let session
async function loadSession() {
  const response = await fetch(modelUrl)
  if (!response.ok) throw new Error(`Model download failed (${response.status}).`)
  const bytes = await response.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const sha = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
  if (sha !== metadata.onnx_sha256) throw new Error('Model integrity check failed. Reload the page.')
  return ort.InferenceSession.create(bytes, { executionProviders: ['wasm'] })
}
self.onmessage = async ({ data }) => {
  let input, output
  try {
    if (!(data instanceof Float32Array) || data.length !== 3 * 128 * 128 || !data.every((v) => Number.isFinite(v) && v >= 0 && v <= 1)) {
      throw new Error('Invalid model input.')
    }
    session ??= loadSession().catch((error) => { session = null; throw error })
    const ready = await session
    input = new ort.Tensor('float32', data, [1, 3, 128, 128])
    output = await ready.run({ image: input })
    if (output.logits?.dims.join(',') !== '1,5') throw new Error('Unexpected model output shape.')
    self.postMessage({ logits: Array.from(output.logits.data) })
  } catch (error) {
    self.postMessage({ error: error.message || 'Inference failed.' })
  } finally {
    input?.dispose()
    if (output) for (const tensor of Object.values(output)) tensor.dispose()
  }
}
