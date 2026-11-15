// Walk log (block E6, contract §3): one JSON object per line, kept in localStorage on the phone.
// Lines are the app state each tick, plus entries {cell, kind, value, time} that D7 (the map grows)
// merges back into the site files for the next walk.
export const KEY = 'martian-map-walk-log'
export const KINDS = ['photo', 'ground', 'effort', 'marker', 'sample']

// One map entry. time = seconds of walk time (same clock as app state `t`).
export function entry(cell, kind, value, time) {
  if (!KINDS.includes(kind)) throw new Error(`walk log: unknown kind "${kind}"`)
  return { cell: [cell[0], cell[1]], kind, value, time }
}

// ponytail: rewrites the whole string each line (localStorage has no append); fine for one walk (~1 MB),
// switch to IndexedDB if walks get long.
export function append(storage, obj) {
  try {
    storage.setItem(KEY, (storage.getItem(KEY) ?? '') + JSON.stringify(obj) + '\n')
  } catch (e) {
    console.warn('walk log not saved:', e.message) // full or blocked storage must not stop the walk
  }
}

export const read = (storage) => (storage.getItem(KEY) ?? '').split('\n').filter(Boolean).map((l) => JSON.parse(l))
export const clear = (storage) => storage.removeItem(KEY)

export function download(storage, name) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([storage.getItem(KEY) ?? ''], { type: 'application/x-ndjson' }))
  a.download = `${name}-walk-${new Date().toISOString().slice(0, 19).replaceAll(':', '')}.jsonl`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
