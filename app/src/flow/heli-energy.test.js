import test from 'node:test'
import assert from 'node:assert/strict'
import { flightSeconds, flightWh, batteryLeft, FLIGHT_POWER_W, BATTERY_WH } from './heli-energy.js'

test('a 1 km flight takes 2.5 minutes and 350 W for that long', () => {
  assert.equal(flightSeconds(1000), 150)
  assert.ok(Math.abs(flightWh(1000) - (FLIGHT_POWER_W * 150) / 3600) < 1e-9) // 14.6 Wh
})

test('battery starts full, falls with distance, never goes below empty', () => {
  assert.equal(batteryLeft(0), 1)
  assert.ok(Math.abs(batteryLeft(1000) - (1 - flightWh(1000) / BATTERY_WH)) < 1e-9)
  assert.ok(batteryLeft(1000) > 0.6 && batteryLeft(1000) < 0.65) // about 62%
  assert.ok(batteryLeft(500) > batteryLeft(1000))
  assert.equal(batteryLeft(1e6), 0)
})
