// R4 contract: RGB float32 [1,3,128,128], 0..1. Normalization is inside ONNX.
export const CROP_SIZE = 256
export const INPUT_SIZE = 128
export const CLASS_NAMES = ['Unknown (not learned)', 'Soil', 'Bedrock', 'Sand', 'Big rock']

export function cropAt(width, height, x = width / 2, y = height / 2) {
  if (![width, height, x, y].every(Number.isFinite) || width < CROP_SIZE || height < CROP_SIZE) {
    throw new Error('Choose an image at least 256 × 256 pixels.')
  }
  return {
    x: Math.max(0, Math.min(width - CROP_SIZE, Math.round(x - CROP_SIZE / 2))),
    y: Math.max(0, Math.min(height - CROP_SIZE, Math.round(y - CROP_SIZE / 2))),
  }
}

// Pillow's antialiased bilinear filter for a 256 -> 128 reduction. Two passes,
// rounding to uint8 between passes, as in the training pipeline's RGB resize.
const coefficients = Array.from({ length: INPUT_SIZE }, (_, i) => {
  const center = (i + 0.5) * 2
  const taps = []
  for (let p = Math.max(0, 2 * i - 1); p <= Math.min(255, 2 * i + 2); p++) {
    taps.push([p, 1 - Math.abs((p + 0.5 - center) / 2)])
  }
  const sum = taps.reduce((s, [, w]) => s + w, 0)
  return taps.map(([p, w]) => [p, Math.round(w / sum * 4194304)])
})

export function cropToTensor(rgba) {
  if (rgba.length !== CROP_SIZE * CROP_SIZE * 4) throw new Error('Expected a 256 × 256 RGBA crop.')
  for (let i = 3; i < rgba.length; i += 4) {
    if (rgba[i] !== 255) throw new Error('Choose an opaque photo without transparent pixels.')
  }
  const horizontal = new Uint8Array(CROP_SIZE * INPUT_SIZE * 3)
  for (let y = 0; y < CROP_SIZE; y++) for (let x = 0; x < INPUT_SIZE; x++) for (let c = 0; c < 3; c++) {
    const sum = coefficients[x].reduce((s, [p, w]) => s + rgba[(y * CROP_SIZE + p) * 4 + c] * w, 2097152)
    horizontal[(y * INPUT_SIZE + x) * 3 + c] = Math.floor(sum / 4194304)
  }
  const tensor = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE)
  for (let y = 0; y < INPUT_SIZE; y++) for (let x = 0; x < INPUT_SIZE; x++) for (let c = 0; c < 3; c++) {
    const sum = coefficients[y].reduce((s, [p, w]) => s + horizontal[(p * INPUT_SIZE + x) * 3 + c] * w, 2097152)
    tensor[c * INPUT_SIZE * INPUT_SIZE + y * INPUT_SIZE + x] = Math.floor(sum / 4194304) / 255
  }
  return tensor
}

export function rankedClasses(logits) {
  if (logits.length !== 5 || !Array.from(logits).every(Number.isFinite)) throw new Error('Invalid model output.')
  // Unknown is a fixed -100 logit, not an abstention mechanism. Never display it as learned.
  const max = Math.max(...logits.slice(1))
  const scores = Array.from(logits.slice(1), (v) => Math.exp(v - max))
  const total = scores.reduce((a, b) => a + b, 0)
  return scores.map((s, i) => ({ id: i + 1, name: CLASS_NAMES[i + 1], score: s / total }))
    .sort((a, b) => b.score - a.score)
}
