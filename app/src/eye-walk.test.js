import { test } from 'node:test'
import assert from 'node:assert/strict'
import { moveStep, nextTarget, ribbon, REACH_M } from './eye-walk.js'

const K = (o) => ({ f: 0, b: 0, l: 0, r: 0, ...o })
const near = (a, b) => Math.abs(a - b) < 1e-9

test('W walks the way you look, at the given speed; D strafes right', () => {
  let [x, z] = moveStep([100, 100], 0, K({ f: 1 }), 2, 1, [500, 500]) // yaw 0 looks north (-z)
  assert.ok(near(x, 100) && near(z, 98))
  ;[x, z] = moveStep([100, 100], 0, K({ r: 1 }), 1, 1, [500, 500])
  assert.ok(near(x, 101) && near(z, 100))
  ;[x, z] = moveStep([100, 100], Math.PI / 2, K({ f: 1 }), 1, 1, [500, 500]) // turned left: looks west (-x)
  assert.ok(near(x, 99) && near(z, 100))
})

test('diagonals are not faster, and you cannot leave the map', () => {
  const [x, z] = moveStep([100, 100], 0, K({ f: 1, r: 1 }), 1, 1, [500, 500])
  assert.ok(near(Math.hypot(x - 100, z - 100), 1))
  assert.deepEqual(moveStep([1, 1], 0, K({ f: 1, l: 1 }), 10, 1, [500, 500]), [0, 0])
})

test('next stop follows the route order and a stop is reached within 8 m', () => {
  const stops = [{ id: 'a', name: 'A', x: 0, z: 0 }, { id: 'b', name: 'B', x: 100, z: 0 }], reached = new Set()
  let t = nextTarget([50, 0], stops, reached)
  assert.equal(t.next.id, 'a'); assert.equal(t.metres, 50)
  t = nextTarget([REACH_M - 1, 0], stops, reached)
  assert.equal(t.justReached.id, 'a'); assert.equal(t.next.id, 'b')
  t = nextTarget([99, 0], stops, reached)
  assert.equal(t.next, null); assert.equal(reached.size, 2)
})

test('ribbon has two vertices per point and two triangles per segment', () => {
  const { pos, idx } = ribbon([[0, 1, 0], [10, 1, 0], [20, 1, 0]], 0.5)
  assert.equal(pos.length, 18); assert.equal(idx.length, 12)
  assert.ok(near(Math.abs(pos[2] - pos[5]), 0.5)) // 0.5 m wide, across the line
})
