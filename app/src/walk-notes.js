import { KINDS } from './log.js'

export function parseWalkNotes(text, width, height) {
  return text.split('\n').flatMap((line) => {
    if (!line.trim()) return []
    try {
      const note = JSON.parse(line)
      if (!KINDS.includes(note?.kind) || !Array.isArray(note.cell) || note.cell.length !== 2) return []
      const [x, y] = note.cell
      return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < width && y < height
        ? [note] : []
    } catch {
      return []
    }
  })
}

export function effortComparison({ kind, value }) {
  if (kind !== 'effort' || !value) return null
  const { predicted_j: predicted, measured_j: measured } = value
  if (!Number.isFinite(predicted) || !Number.isFinite(measured) || predicted <= 0 || measured <= 0) return null
  const difference = Math.round((measured - predicted) / predicted * 100)
  if (!Number.isFinite(difference)) return null
  return `Effort: ${measured} J measured · ${predicted} J predicted (${difference >= 0 ? '+' : ''}${difference}%)`
}

export function showWalkNotes(panel, notes, url) {
  if (!notes.length) return
  const details = document.createElement('details')
  const summary = document.createElement('summary')
  summary.textContent = `Walk observations (${notes.length})`
  const counts = document.createElement('p')
  counts.textContent = KINDS.map((kind) => [kind, notes.filter((note) => note.kind === kind).length])
    .filter(([, count]) => count > 0).map(([kind, count]) => `${kind} ${count}`).join(' · ')
  details.append(summary, counts)
  const comparison = notes.map(effortComparison).find(Boolean)
  if (comparison) {
    const effort = document.createElement('p')
    effort.textContent = comparison
    details.append(effort)
  }
  const download = document.createElement('a')
  download.textContent = 'Download merged walk observations'
  download.href = url
  download.download = 'walk.jsonl'
  details.append(download)
  panel.after(details)
}
