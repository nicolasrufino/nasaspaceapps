import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseLayer } from '../../app/src/world.js'
import { calculate } from './metrics.mjs'
import { FLIGHT_M, MAX_FLIGHTS, SCAN_STEP_M } from '../../app/src/scout.js'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const sha = (value) => createHash('sha256').update(value).digest('hex')
const readJSON = (path) => JSON.parse(readFileSync(path, 'utf8'))
const canonical = (value) => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map((k) => [k, canonical(value[k])])) : value

export function fileHash(path) {
  const bytes = readFileSync(path)
  // JSON semantics and LF-normalized source hashes survive Windows checkouts.
  if (path.endsWith('.json')) return sha(JSON.stringify(canonical(JSON.parse(bytes))))
  if (/\.(js|mjs)$/.test(path)) return sha(bytes.toString('utf8').replaceAll('\r\n', '\n'))
  return sha(bytes)
}

export function loadInputs(root = ROOT) {
  const folder = resolve(root, 'data/worlds/gale')
  const meta = readJSON(resolve(folder, 'world.json'))
  const layers = Object.fromEntries(Object.entries(meta.files).filter(([, f]) => /\.(f32|u8)$/.test(f)).map(([name, file]) =>
    [name, parseLayer(file, new Uint8Array(readFileSync(resolve(folder, file))).buffer, meta.width * meta.height)]))
  const rocks = readJSON(resolve(root, 'ml/exports/rocks.json'))
  assert.equal(sha(readFileSync(resolve(folder, 'rocks_fine.u8'))), rocks.files['rocks_fine.u8'].sha256,
    'Gale hazards differ from the R3 evidence: regenerate or review R3 provenance')
  assert.deepEqual(meta.site, rocks.site)
  const reviewed = new Uint8Array(meta.width * meta.height)
  for (const point of rocks.accepted_points) for (const [x, y] of point.clearance_cells) {
    assert.ok(Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < meta.width && y >= 0 && y < meta.height)
    reviewed[y * meta.width + x] = 1
  }
  assert.equal(sha(reviewed), rocks.files['rocks_verified.u8'].sha256)
  assert.ok(reviewed.every((v, i) => !v || layers.rocks_fine[i]))
  const targets = readJSON(resolve(folder, 'targets.json'))
  return { world: { meta, layers }, targets, reviewed, rocks }
}

function checkedAccuracy(metrics, matrix) {
  const support = matrix.map((row) => row.reduce((a, b) => a + b, 0))
  const total = support.reduce((a, b) => a + b, 0)
  assert.equal(total, metrics.samples)
  const correct = matrix.reduce((n, row, i) => n + row[i], 0)
  assert.ok(Math.abs(metrics.accuracy - correct / total) < 1e-12)
  return { ...metrics, correct, support_by_class: support }
}

export function buildReport(root = ROOT) {
  const { world, targets, reviewed, rocks } = loadInputs(root)
  const terrain = readJSON(resolve(root, 'ml/exports/terrain_cls.json'))
  const buddy = readJSON(resolve(root, 'ml/exports/buddy_policy.json'))
  const files = ['data/worlds/gale/world.json', 'data/worlds/gale/targets.json',
    ...['height.f32', 'slope.f32', 'terrain_class.u8', 'rocks_fine.u8', 'cost_to_go.f32', 'cost_to_go_scouted.f32']
      .map((p) => `data/worlds/gale/${p}`),
    'ml/exports/rocks.json', 'ml/exports/terrain_cls.json', 'ml/exports/buddy_policy.json',
    'app/src/plan.js', 'app/src/walk.js', 'app/src/scout.js', 'app/src/why.js', 'app/src/main.js', 'app/src/world.js',
    'ml/pitch_metrics/metrics.mjs', 'ml/pitch_metrics/run.mjs']
  if (world.meta.files.passable) files.push(`data/worlds/gale/${world.meta.files.passable}`)
  const report = { schema_version: 1, block: 'R5', site: world.meta.site,
    scenario: { name: 'Gale default five science stops, three-flight campaign, no custom stops',
      energy_scenario: world.meta.default_scenario ?? null,
      energy_scenario_details: world.meta.scenarios?.[world.meta.default_scenario] ?? null,
      target_ids: targets.map((t) => t.id), energy_budget_j: world.meta.energy_budget_j,
      reserve_j: world.meta.energy_budget_j * world.meta.reserve_fraction,
      cell_size_m: world.meta.cell_size_m, scout_replay_fps: 60,
      route_flight_limit_m: FLIGHT_M,
      max_flights: MAX_FLIGHTS, scan_step_m: SCAN_STEP_M,
      extra_flights: 'None. Each flight selects the next unseen stretch of the replanned route.' },
    definitions: {
      hazard: 'Binary 8 m hazard cells, not a count of individual rocks. Unique cells and repeated visits are separate.',
      margin: 'energy left - cheapest known-hazard return cost - fixed reserve. Extra 20% means >=20% of INITIAL budget after that reserve.',
      traverse_share: 'Distance weighted, linearly interpolated between grid vertices; no stop dwell time.',
      energy_error: 'Uniform 0.7/1.0/1.3 multiplier on BOTH spent walking energy and remaining return cost; initial budget/reserve and the nominal scouted route stay fixed.',
      ring: 'Cells whose return fits remaining energy minus reserve, as displayed by the app. Area is grid cells x cell area, not a circular radius or a complete outbound-and-return reachability claim.',
      margin_audit: 'Directed reverse shortest paths recomputed using only discovered hazards; app hybrid return lookup reported separately.',
      scout: 'Shipped three-flight campaign with a re-plan after every flight. Spatial scans every 2 m plus endpoints; 30/60/120 fps must agree.' },
    source_hash_convention: 'SHA256: raw binary; canonical sorted-key JSON; LF-normalized JS/MJS source',
    source_sha256: Object.fromEntries(files.map((p) => [p, fileHash(resolve(root, p))])),
    results: calculate(world, targets, reviewed),
    vision_evidence: {
      rocks: { method: 'NASA/JPL ROSCO + human positive review; no new network trained for R3',
        review_counts: rocks.review_counts, review_complete: rocks.review_complete,
        accepted_points: rocks.accepted_points.length, occupied_point_cells: rocks.reviewed_point_density.occupied_cells.length,
        clearance_cells: rocks.positive_cells, total_world_hazard_cells: rocks.combined_cells,
        selected_proposal_agreement: rocks.selected_proposal_agreement,
        mosaic_review_counts: rocks.g_mosaic_review_counts,
        mosaic_reference_matches: rocks.g_mosaic_reference_matches.length, precision: null, recall: null },
      terrain: { architecture: terrain.architecture, train_patches: terrain.training.train_patches,
        curiosity: checkedAccuracy(terrain.held_out, terrain.confusion_matrix),
        perseverance: checkedAccuracy(terrain.perseverance_transfer.metrics, terrain.perseverance_transfer.confusion_matrix),
        used_for_this_route: false,
        limitation: 'Rover-photo classifier; not applied to orbital terrain. Curiosity test has zero big-rock examples. Perseverance transfer is poor.' },
      buddy: { placeholder: buddy.placeholder, accuracy: null, limitation: buddy.limitations } },
    limitations: [
      'Simulated walk and scout on real NASA-derived terrain, not an astronaut or drone field trial.',
      'The energy model is an estimate; +/-30% is a chosen stress test, not a measured confidence interval.',
      'A hazard cell can be a DTM estimate or padded reviewed point. Neither cell count nor route crossings are individual-rock detection accuracy.',
      'Only one fixed site, budget and stop set; this is not evidence of universal navigation safety.',
      'Unknown hazards may remain. New route crossings of the full stored layer are audited separately from discovered hazards.',
      'The app switches to globally scouted return costs only on scanned cells; the report exposes differences from an independently recomputed known-hazard return field.',
      'Classifier accuracy is reported with its sample sizes and transfer result; the placeholder buddy has no accuracy result.' ] }
  return JSON.parse(JSON.stringify(report, (_key, value) => typeof value === 'number' && Number.isFinite(value)
    ? Math.round(value * 1e6) / 1e6 : value))
}

export function renderPitch(report) {
  const r = report.results, c = r.repeated_scout
  const kj = (v) => (v / 1000).toFixed(1)
  return `# R5: measured pitch numbers

Generated by \`node ml/pitch_metrics/run.mjs\`; full evidence and source hashes: [pitch_metrics.json](../exports/pitch_metrics.json).

## Three flights, re-planning after each

Fixed Gale simulation, default **${report.scenario.energy_scenario}** energy scenario, ${c.final_route.stops.length} science stops. Budget ${kj(report.scenario.energy_budget_j)} kJ, reserve ${kj(report.scenario.reserve_j)} kJ. The budget already deducts estimated science-stop time.

- **${c.total_flights} flights**, each at most ${report.scenario.route_flight_limit_m} m; total ${(c.total_flight_metres / 1000).toFixed(3)} km of simulated corridor flight.
- **${r.orbit_only.all_layer_hazards.unique_cells} → ${c.final_route.all_layer_hazards.unique_cells} distinct stored hazard cells** crossed; final route fully scanned: ${c.converged ? 'yes' : 'no'}.
- Walking energy **${kj(r.orbit_only.energy_j)} → ${kj(c.final_route.energy_j)} kJ** (${r.delta.energy_percent.toFixed(2)}% change); distance ${r.orbit_only.metres.toFixed(1)} → ${c.final_route.metres.toFixed(1)} m.
- Re-plan after each landing; select the next unseen stretch of the changed route. No pre-computed extra flights.

| Flight | Corridor (m) | New hazard cells found | Stored hazards still on route | Route energy (kJ) | Whole new route scanned? |
|---|---:|---:|---:|---:|---|
${c.passes.map((p) => `| ${p.pass} | ${p.flight_metres.toFixed(1)} | ${p.newly_discovered_hazard_cells} | ${p.new_route_all_layer_hazard_cells} | ${kj(p.route_energy_j)} | ${p.new_route_fully_scanned ? 'yes' : 'no'} |`).join('\n')}

## Return margin and energy sensitivity

Scale both spent walking energy and the way home; keep the initial budget, reserve and route fixed. This is a chosen stress test, not a measured confidence interval.

| Walking-cost multiplier | Minimum spare margin after home + reserve (kJ) | Distance retaining extra 20% of initial budget | Distance retaining home + reserve |
|---|---:|---:|---:|
${c.energy_sensitivity.map((v) => `| ${v.energy_cost_multiplier.toFixed(1)}x | ${kj(v.margin.minimum_margin_after_reserve_j)} | ${(100 * v.margin.fraction_distance_with_extra_20pct_margin).toFixed(1)}% | ${(100 * v.margin.fraction_distance_return_and_reserve_feasible).toFixed(1)}% |`).join('\n')}

The app's per-cell return lookup is audited independently using directed homebound crossings; maximum understatement ${r.app_return_lookup_audit.maximum_underestimate_j_on_route.toFixed(2)} J, overstatement ${r.app_return_lookup_audit.maximum_overestimate_j_on_route.toFixed(2)} J on this route. Full ring-area snapshots remain in the JSON.

## Frame-rate check

The browser and replay scan every ${report.scenario.scan_step_m} m plus both endpoints, regardless of animation timing.

| Replay | Hazard cells discovered | Stored hazards on final route | Walking energy (kJ) |
|---|---:|---:|---:|
${r.sampling_sensitivity.map((v) => `| ${v.mode} | ${v.discovered_hazard_cells} | ${v.after_all_layer_crossings.unique_cells} | ${kj(v.after_energy_j)} |`).join('\n')}

## Limits and provenance

These are simulated flights on NASA-derived terrain. Repositioning from the habitat, flight energy, recharge and daylight operations are not modelled. Zero stored hazard cells is not proof of a hazard-free Mars surface. Cells are not individual rocks; the route's ${r.orbit_only.reviewed_rock_clearance.unique_cells} reviewed-rock-clearance cells are reported separately from DTM estimates.

R3: ${report.vision_evidence.rocks.accepted_points} human-accepted ROSCO proposals, ${report.vision_evidence.rocks.review_counts.uncertain} uncertain and excluded; no detector precision/recall claim. The rover-photo classifier did not produce this route's terrain: Curiosity ${report.vision_evidence.terrain.curiosity.correct}/${report.vision_evidence.terrain.curiosity.samples}; Perseverance transfer ${report.vision_evidence.terrain.perseverance.correct}/${report.vision_evidence.terrain.perseverance.samples}, with no big-rock support in the Curiosity test. Buddy remains an untrained placeholder and is cut from the submission.

## Suggested proof line

“On our fixed Gale simulation, ${c.total_flights} flights with a re-plan after each produce a fully scanned route through ${c.final_route.stops.length} science stops, crossing ${c.final_route.all_layer_hazards.unique_cells} stored hazard cells instead of ${r.orbit_only.all_layer_hazards.unique_cells}. Walking energy changes from ${kj(r.orbit_only.energy_j)} to ${kj(c.final_route.energy_j)} kJ. Even at 30% higher walking cost, the route retains the return budget and reserve.”
`
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = buildReport()
  const out = resolve(ROOT, 'ml/exports/pitch_metrics.json')
  const pitch = resolve(ROOT, 'ml/pitch_metrics/PITCH_NUMBERS.md')
  if (process.argv.includes('--check')) {
    assert.deepEqual(readJSON(out), report, 'Pitch metrics are stale; run node ml/pitch_metrics/run.mjs')
    assert.equal(readFileSync(pitch, 'utf8').replaceAll('\r\n', '\n'), renderPitch(report), 'Pitch prose is stale')
    console.log('R5 evidence and pitch numbers reproduce exactly')
  } else {
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, JSON.stringify(report, null, 2) + '\n')
    writeFileSync(pitch, renderPitch(report))
    console.log(JSON.stringify({ output: relative(ROOT, out), hazards: [report.results.orbit_only.discovered_hazards.unique_cells,
      report.results.after_scout.discovered_hazards.unique_cells], delta: report.results.delta,
      sensitivity: report.results.energy_sensitivity.map((s) => ({ scale: s.energy_cost_multiplier,
        minimum_extra_margin_j: s.margin.minimum_margin_after_reserve_j,
        departure_ring_area_change_percent: s.ring_snapshots[0].app_ring.change_percent_vs_nominal })),
      repeated_scout: report.results.repeated_scout.passes,
      lookup_audit: report.results.app_return_lookup_audit }, null, 2))
  }
}
