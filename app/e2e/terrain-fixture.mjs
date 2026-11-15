// Deterministic pixels for runtime parity, not a Mars photo or an accuracy test.
export function fixturePixels() {
  const rgba = new Uint8ClampedArray(256 * 256 * 4)
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const i = (y * 256 + x) * 4
    rgba[i] = (x + 3 * y) % 256
    rgba[i + 1] = (2 * x + y) % 256
    rgba[i + 2] = (5 * x + 7 * y) % 256
    rgba[i + 3] = 255
  }
  return rgba
}
