// Every world in data/worlds/ follows docs/CONTRACTS.md §1, so a broken world from the pipeline fails CI
// here instead of on stage. Sizes come from file stats; layer bytes are never read.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'

const root = new URL('../../data/worlds/', import.meta.url)
const worlds = readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
const FOUNDATION = ['height', 'terrain_class', 'cost_to_go'] // terrain, minimap, walk-back ring

test('at least the synthetic world exists', () => assert.ok(worlds.includes('synthetic')))

for (const name of worlds) {
  test(`world "${name}" matches the contract`, () => {
    const dir = new URL(`${name}/`, root)
    const meta = JSON.parse(readFileSync(new URL('world.json', dir)))
    for (const k of ['width', 'height', 'cell_size_m', 'energy_budget_j', 'reserve_fraction', 'kj_per_l_o2'])
      assert.ok(Number.isFinite(meta[k]) && meta[k] > 0, `world.json "${k}" must be a positive number`)
    const [bx, by] = meta.base_cell ?? []
    assert.ok(bx >= 0 && bx < meta.width && by >= 0 && by < meta.height, 'base_cell must be inside the grid')
    for (const layer of FOUNDATION) assert.ok(meta.files?.[layer], `world.json "files" needs "${layer}"`)
    const n = meta.width * meta.height
    for (const [layer, file] of Object.entries(meta.files)) {
      const want = file.endsWith('.u8') ? n : file.endsWith('.f32') ? n * 4 : null
      assert.ok(want, `${layer}: ${file} must be .f32 or .u8`)
      const url = new URL(file, dir)
      assert.ok(existsSync(url), `${file} is listed in world.json but missing`)
      assert.equal(statSync(url).size, want, `${file}: wrong byte size for ${meta.width}x${meta.height}`)
    }
  })
}
