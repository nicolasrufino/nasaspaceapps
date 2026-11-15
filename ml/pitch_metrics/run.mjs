import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseLayer } from '../../app/src/world.js'
import { calculate } from './metrics.mjs'

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
  const flights = readJSON(resolve(folder, 'scout_plan.json'))
  return { world: { meta, layers }, targets, flights, reviewed, rocks }
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
  const { world, targets, flights, reviewed, rocks } = loadInputs(root)
  const terrain = readJSON(resolve(root, 'ml/exports/terrain_cls.json'))
  const buddy = readJSON(resolve(root, 'ml/exports/buddy_policy.json'))
  const files = ['data/worlds/gale/world.json', 'data/worlds/gale/targets.json', 'data/worlds/gale/scout_plan.json',
    ...['height.f32', 'slope.f32', 'terrain_class.u8', 'rocks_fine.u8', 'cost_to_go.f32', 'cost_to_go_scouted.f32']
      .map((p) => `data/worlds/gale/${p}`),
    'ml/exports/rocks.json', 'ml/exports/terrain_cls.json', 'ml/exports/buddy_policy.json',
    'app/src/plan.js', 'app/src/walk.js', 'app/src/scout.js', 'app/src/why.js', 'app/src/main.js', 'app/src/world.js',
    'ml/pitch_metrics/metrics.mjs', 'ml/pitch_metrics/run.mjs']
  const report = { schema_version: 1, block: 'R5', site: world.meta.site,
    scenario: { name: 'Gale default five science stops, first scout pass, no custom stops',
      target_ids: targets.map((t) => t.id), energy_budget_j: world.meta.energy_budget_j,
      reserve_j: world.meta.energy_budget_j * world.meta.reserve_fraction,
      cell_size_m: world.meta.cell_size_m, scout_replay_fps: 60 },
    definitions: {
      hazard: 'Binary 8 m hazard cells, not a count of individual rocks. Unique cells and repeated visits are separate.',
      margin: 'energy left - cheapest known-hazard return cost - fixed reserve. Extra 20% means >=20% of INITIAL budget after that reserve.',
      traverse_share: 'Distance weighted, linearly interpolated between grid vertices; no stop dwell time.',
      energy_error: 'Uniform 0.7/1.0/1.3 multiplier on BOTH spent walking energy and remaining return cost; initial budget/reserve and the nominal scouted route stay fixed.',
      ring: 'Cells whose return fits remaining energy minus reserve, as displayed by the app. Area is grid cells x cell area, not a circular radius or a complete outbound-and-return reachability claim.',
      margin_audit: 'Directed reverse shortest paths recomputed using only discovered hazards; app hybrid return lookup reported separately.',
      scout: '60 fps replay of shipped tickFlight sampling. 30/120 fps and 4 m spatial sampling measure frame dependence; live counts can vary.' },
    source_hash_convention: 'SHA256: raw binary; canonical sorted-key JSON; LF-normalized JS/MJS source',
    source_sha256: Object.fromEntries(files.map((p) => [p, fileHash(resolve(root, p))])),
    results: calculate(world, targets, flights, reviewed),
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

function renderFirstPassPitch(report) {
  const r = report.results, v = report.vision_evidence
  const pct = (value) => (100 * value).toFixed(1)
  const kj = (value) => (value / 1000).toFixed(1)
  const nominal = r.energy_sensitivity.find((s) => s.energy_cost_multiplier === 1)
  const rows = r.energy_sensitivity.map((s) => `| ${s.energy_cost_multiplier.toFixed(1)}x | ${s.ring_snapshots[0].app_ring.cells.toLocaleString('en-US')} | ${s.ring_snapshots[0].app_ring.change_percent_vs_nominal.toFixed(1)}% | ${kj(s.margin.minimum_margin_after_reserve_j)} | ${pct(s.margin.fraction_distance_with_extra_20pct_margin)}% |`).join('\n')
  return `# R5: measured pitch numbers\n\nGenerated by \`node ml/pitch_metrics/run.mjs\`; source hashes and full profiles are in [pitch_metrics.json](../exports/pitch_metrics.json). These are simulated results on the fixed Gale demo, not field validation.\n\n## Before and after the first scout pass\n\n- Same default ${report.scenario.target_ids.length} science stops; ${kj(report.scenario.energy_budget_j)} kJ budget, ${kj(report.scenario.reserve_j)} kJ reserved.\n- The orbit-only route crosses **${r.orbit_only.discovered_hazards.unique_cells} distinct hazard cells** discovered by the scout; the new route crosses **${r.after_scout.discovered_hazards.unique_cells}**. Repeated cell visits: ${r.orbit_only.discovered_hazards.cell_visits} to ${r.after_scout.discovered_hazards.cell_visits}. These are cells, not individual rocks.\n- Walking energy: **${kj(r.orbit_only.energy_j)} → ${kj(r.after_scout.energy_j)} kJ**, a ${r.delta.energy_percent.toFixed(2)}% change. Distance: ${r.orbit_only.metres.toFixed(1)} → ${r.after_scout.metres.toFixed(1)} m. Avoidance costs effort in this scenario.\n- The initial route crosses **${r.orbit_only.reviewed_rock_clearance.unique_cells}** cells from the human-reviewed rock additions. Keep this separate from the DTM-derived hazard benefit.\n- The new route crosses ${r.after_scout.all_layer_hazards.unique_cells} cells in the full stored hazard layer, including undiscovered cells.\n- At nominal energy cost, **${pct(nominal.margin.fraction_distance_with_extra_20pct_margin)}% of the traverse distance** retains an extra 20% of initial energy after the cost home AND the reserve. Minimum spare margin: ${kj(nominal.margin.minimum_margin_after_reserve_j)} kJ.\n\n## Energy sensitivity\n\nThe route, initial budget and reserve stay fixed. Scale both energy already spent and the remaining trip home. The ring area below is at departure; the JSON also includes 25/50/75/100% route snapshots.\n\n| Walking-energy multiplier | Departure ring cells | Area change | Minimum extra margin (kJ) | Distance with extra 20% margin |\n|---|---:|---:|---:|---:|\n${rows}\n\nThe app's hybrid return lookup differs from a recomputed known-hazard return field by at most ${r.app_return_lookup_audit.maximum_underestimate_j_on_route.toFixed(2)} J of understatement and ${r.app_return_lookup_audit.maximum_overestimate_j_on_route.toFixed(2)} J of overstatement on this route. This audit does not certify unobserved ground.\n\n## Frame sampling matters\n\n| Scout sampling | Hazard cells discovered | Initial route: distinct discovered hazards | New route: distinct discovered hazards |\n|---|---:|---:|---:|\n${r.sampling_sensitivity.map((s) => `| ${s.mode} | ${s.discovered_hazard_cells} | ${s.before_crossings.unique_cells} | ${s.after_crossings.unique_cells} |`).join('\n')}\n\nThe primary replay uses a fixed 60 fps. Live animation counts can vary with frame timing. The 4 m row is a spatial audit including flight endpoints, not an exact UI replay.\n\n## Vision evidence to quote with its limits\n\n- R3: ${v.rocks.accepted_points} human-accepted ROSCO proposals, ${v.rocks.review_counts.uncertain} uncertain and excluded, ${v.rocks.clearance_cells} padded cells. Proposal acceptance is not detector precision or recall. Separate G-mosaic correspondence: ${v.rocks.mosaic_reference_matches}/${v.rocks.mosaic_review_counts.accepted} accepted reference locations matched.\n- R4: MobileNetV3-Small with frozen pretrained features and a trained final classifier; ${v.terrain.train_patches} training patches. Curiosity held-out subset: **${pct(v.terrain.curiosity.accuracy)}% (${v.terrain.curiosity.correct}/${v.terrain.curiosity.samples})**. Perseverance transfer: **${pct(v.terrain.perseverance.accuracy)}% (${v.terrain.perseverance.correct}/${v.terrain.perseverance.samples})**. No Curiosity test support for big rocks. This classifier did not produce the orbital terrain used in these route calculations.\n- Buddy policy remains an untrained interface placeholder; no learned-navigation result is claimed.\n\n## Suggested proof line\n\n“On our fixed Gale simulation, scouting changes a route that crosses ${r.orbit_only.discovered_hazards.unique_cells} discovered hazard cells into one that crosses ${r.after_scout.discovered_hazards.unique_cells}, while visiting the same science stops. Walking costs ${kj(r.orbit_only.energy_j)} to ${kj(r.after_scout.energy_j)} kJ. We also publish the return margin under a 30% energy-cost error.”\n\nUse this only with the fixed-scenario qualification. The hazard benefit here must not be presented as ${r.orbit_only.discovered_hazards.unique_cells} individually validated rocks avoided. R5 supplies evidence for F1/X4; the actual slides are a separate block.\n`
}

export function renderPitch(report) {
  const r = report.results.repeated_scout
  const pct = (v) => (v * 100).toFixed(1)
  const kj = (v) => (v / 1000).toFixed(1)
  const rows = r.energy_sensitivity.map((s) =>
    `| ${s.energy_cost_multiplier.toFixed(1)}x | ${kj(s.margin.minimum_margin_after_reserve_j)} | ${pct(s.margin.fraction_distance_with_extra_20pct_margin)}% | ${pct(s.margin.fraction_distance_return_and_reserve_feasible)}% |`).join('\n')
  const section = `## Re-scouting the changed route

The first pass leaves ${report.results.after_scout.all_layer_hazards.unique_cells} stored hazard cells on the replanned route. Repeating the app's existing "Fly the new route" operation gives:

| Pass | Newly discovered hazard cells | Hazards still on the new route in the full layer | Whole new route scanned? |
|---|---:|---:|---|
${r.passes.map((p) => `| ${p.pass} | ${p.newly_discovered_hazard_cells} | ${p.new_route_all_layer_hazard_cells} | ${p.new_route_fully_scanned ? 'yes' : 'no'} |`).join('\n')}

Convergence: **${r.converged ? 'yes' : 'no'}**, after ${r.passes.length} passes. This is ${r.total_flights} simulated flight legs and ${(r.total_flight_metres / 1000).toFixed(2)} km of flight, including repeated extra flights; it is not one short flight. The drone flight is simulated and its energy is not charged to the astronaut's walking budget.

The final route visits ${r.final_route.stops.length} stops, costs **${kj(r.final_route.energy_j)} kJ** and is ${r.final_route.metres.toFixed(1)} m long. It crosses ${r.final_route.all_layer_hazards.unique_cells} cells of the stored hazard layer. Unmapped real-world hazards can still exist.

| Walking-energy multiplier | Final-route minimum extra margin (kJ) | Distance with extra 20% margin | Distance with return + reserve feasible |
|---|---:|---:|---:|
${rows}

Energy figures before convergence are conditional calculations on a route that still crosses unobserved stored hazards; do not call that first route fully cleared.

`
  const proof = `## Suggested proof line

“On our fixed Gale simulation, ${r.passes.length} scout/replan cycles produce a fully scanned route visiting the same ${r.final_route.stops.length} science stops and crossing ${r.final_route.all_layer_hazards.unique_cells} cells of the stored hazard layer. Simulated walking energy changes from ${kj(report.results.orbit_only.energy_j)} to ${kj(r.final_route.energy_j)} kJ. Even at 30% higher walking cost, the entire route retains the return budget and reserve.”

The cycles total ${r.total_flights} simulated flight legs and ${(r.total_flight_metres / 1000).toFixed(2)} km of flight; drone energy is excluded. These grid hazards come from a mixed terrain layer, not a count of individually validated rocks. This is a fixed-scenario simulation, not a field safety result. R5 supplies evidence for F1/X4; the actual slides are a separate block.
`
  return renderFirstPassPitch(report)
    .replace('## Energy sensitivity\n', section + '## Energy sensitivity after the first pass\n')
    .replace(/## Suggested proof line\n[\s\S]*$/, proof)
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
