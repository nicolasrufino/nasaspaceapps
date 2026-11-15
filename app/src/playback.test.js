import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPlaybackClock } from './playback.js'

test('playback visits the same cells in the same time at fast and slow frame rates', () => {
  for (const frameMs of [10, 40, 200, 1000]) {
    const clock = createPlaybackClock(), visited = []
    clock.play()
    for (let elapsed = 0; elapsed < 6000; elapsed += frameMs) clock.tick(frameMs, () => visited.push(visited.length + 1))
    assert.deepEqual(visited, Array.from({ length: 50 }, (_, i) => i + 1))
  }
})

test('a delayed frame cannot skip a stop or spend time while paused', () => {
  const clock = createPlaybackClock()
  let k = 0
  const step = () => ++k !== 4
  clock.play()
  clock.tick(2000, step)
  assert.equal(k, 4)
  assert.equal(clock.playing, false)
  clock.tick(5000, step)
  assert.equal(k, 4)
  clock.play()
  clock.tick(119, step)
  assert.equal(k, 4)
  clock.tick(1, step)
  assert.equal(k, 5)
})

test('pause, speed, and reset preserve the intended playback timing', () => {
  const clock = createPlaybackClock()
  let k = 0
  const step = () => { k++ }
  clock.play()
  clock.tick(60, step)
  clock.pause()
  clock.tick(1000, step)
  clock.speed(60)
  clock.play()
  clock.tick(30, step)
  assert.equal(k, 1)
  clock.tick(30, step)
  clock.reset()
  clock.play()
  clock.tick(30, step)
  assert.equal(k, 1)
  clock.tick(30, step)
  assert.equal(k, 2)
})
