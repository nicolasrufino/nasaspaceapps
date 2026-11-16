import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseLayer, layerRGB, CLASS_RGB, sourceLabel } from './world.js'

const dir = new URL('../../data/worlds/synthetic/', import.meta.url)

test('synthetic world: every layer matches world.json size', () => {
  const meta = JSON.parse(readFileSync(new URL('world.json', dir)))
  for (const file of Object.values(meta.files)) {
    const buf = new Uint8Array(readFileSync(new URL(file, dir))).buffer
    parseLayer(file, buf, meta.width * meta.height) // throws on mismatch
  }
})

test('wrong size is rejected', () => {
  assert.throws(() => parseLayer('height.f32', new ArrayBuffer(8), 3))
})

test('colours: classes, ramp, unreachable', () => {
  assert.deepEqual([...layerRGB('terrain_class', new Uint8Array([3]))], CLASS_RGB[3])
  const rgb = layerRGB('cost_to_go', new Float32Array([0, 10, 3e38]))
  assert.deepEqual([...rgb.slice(0, 3)], [30, 20, 40])
  assert.deepEqual([...rgb.slice(3, 6)], [255, 220, 150])
  assert.deepEqual([...rgb.slice(6, 9)], [200, 30, 30])
})

test('source label: per-layer object or string', () => {
  const meta = { sources: { height: { mission: 'MRO', instrument: 'HiRISE DTM', date: '2014' }, slope: 'from height', all: 'synthetic' } }
  assert.equal(sourceLabel(meta, 'height'), 'MRO · HiRISE DTM · 2014')
  assert.equal(sourceLabel(meta, 'slope'), 'from height')
  assert.equal(sourceLabel(meta, 'terrain_class'), '')
})

test('fetchBuffer: one download whether the host sends the .gz unzipped, as gzip bytes, or not at all', async () => {
  const { gzipSync } = await import('node:zlib')
  const { fetchBuffer } = await import('./world.js')
  const data = new Uint8Array([1, 2, 3, 4, 250])
  const reply = (body, type, enc) => new Response(body, { headers: { 'content-type': type, ...(enc && { 'content-encoding': enc }) } })
  const hosts = {
    azure: (u) => reply(data, 'application/octet-stream', 'gzip'), // Content-Encoding: gzip, already unzipped by the browser
    azure_magic: (u) => reply(new Uint8Array([0x1f, 0x8b, 3]), 'application/octet-stream', 'gzip'), // unzipped data that starts like gzip
    raw: (u) => reply(gzipSync(data), 'application/octet-stream'),
    dev: (u) => (u.endsWith('.gz') ? reply('<!doctype html>', 'text/html') : reply(data, 'application/octet-stream')),
  }
  const real = globalThis.fetch
  try {
    for (const [name, host] of Object.entries(hosts)) {
      const urls = []
      globalThis.fetch = async (u) => (urls.push(u), host(u))
      assert.deepEqual(new Uint8Array(await fetchBuffer('/gale/x.f32')), name === 'azure_magic' ? new Uint8Array([0x1f, 0x8b, 3]) : data, name)
      assert.equal(urls.filter((u) => !u.endsWith('.gz')).length, name === 'dev' ? 1 : 0, `${name}: ${urls}`)
    }
  } finally { globalThis.fetch = real }
})
