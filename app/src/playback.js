// Presentation time only. Each completed step still uses walk.js for energy and mission time.
// A slow frame must visit every crossed cell, but the caller redraws the world only once.
export function createPlaybackClock(stepMs = 120) {
  let playing = false, carry = 0
  return {
    get playing() { return playing },
    play() { playing = true },
    pause() { playing = false },
    reset() { playing = false; carry = 0 },
    speed(ms) {
      if (!Number.isFinite(ms) || ms <= 0) return
      carry *= ms / stepMs
      stepMs = ms
    },
    tick(elapsedMs, advance) {
      if (!playing || !Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0
      carry += elapsedMs
      let count = 0
      while (playing && carry >= stepMs) {
        carry -= stepMs
        count++
        if (advance() === false || !playing) {
          playing = false
          carry = 0 // do not carry a delayed frame through an intentional science stop
        }
      }
      return count
    },
  }
}
