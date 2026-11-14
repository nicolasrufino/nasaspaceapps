// Runs after `npm run build` (npm "postbuild"), so CI's existing build step runs it with no workflow change.
// 1. dist/ has every world folder and every file its world.json lists (Azure serves dist/ as is).
// 2. JS bundle budget (phone over mobile data).
// 3. Headless boot: every world loads in Chrome with no flags set (= every feature flag off) and no page error.
// Zero deps: Node's http server + the Chrome already on GitHub's ubuntu runners.
import { readdirSync, readFileSync, existsSync, statSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:http'
import { execFile } from 'node:child_process'
import { gzipSync } from 'node:zlib'
import { extname, join } from 'node:path'

const JS_GZIP_BUDGET_KB = 250 // three.js alone is ~137 kB gzipped; raise on purpose, in a PR, if a feature needs it
const dist = fileURLToPath(new URL('../dist/', import.meta.url))
const worldsDir = fileURLToPath(new URL('../../data/worlds/', import.meta.url))
const worlds = readdirSync(worldsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
const fails = []

// 1. Worlds copied into dist/
for (const w of worlds) {
  const meta = join(dist, w, 'world.json')
  if (!existsSync(meta)) { fails.push(`dist/${w}/world.json missing`); continue }
  for (const f of Object.values(JSON.parse(readFileSync(meta)).files ?? {}))
    if (!existsSync(join(dist, w, f))) fails.push(`dist/${w}/${f} missing`)
}

// 2. Bundle budget
const assets = join(dist, 'assets')
const js = existsSync(assets) ? readdirSync(assets).filter((f) => f.endsWith('.js')) : []
const kb = js.reduce((s, f) => s + gzipSync(readFileSync(join(assets, f))).length, 0) / 1024
if (!js.length) fails.push('no JS in dist/assets')
if (kb > JS_GZIP_BUDGET_KB) fails.push(`JS is ${kb.toFixed(0)} kB gzipped, budget ${JS_GZIP_BUDGET_KB} kB`)
console.log(`check-dist: ${worlds.length} world(s) in dist, JS ${kb.toFixed(0)}/${JS_GZIP_BUDGET_KB} kB gzipped`)

// 3. Headless boot
const chrome = [process.env.CHROME, '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => p && existsSync(p))
if (!chrome) {
  if (process.env.CI) fails.push('no Chrome found for the boot test (set CHROME=/path/to/chrome)')
  else console.warn('check-dist: no Chrome, boot test skipped (set CHROME=/path/to/chrome)')
} else {
  // Page errors land on <html data-smoke-error>, injected here so the app itself is untouched.
  const probe = `<script>for (const t of ['error', 'unhandledrejection']) addEventListener(t, (e) =>
    document.documentElement.dataset.smokeError = String(e.message ?? e.reason?.message ?? e.reason))</script>`
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' }
  const server = createServer((req, res) => {
    let p = join(dist, decodeURIComponent(new URL(req.url, 'http://x').pathname))
    if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html')
    if (!p.startsWith(dist) || !existsSync(p)) return res.writeHead(404).end()
    let body = readFileSync(p)
    if (p.endsWith('index.html')) body = body.toString().replace('<head>', `<head>${probe}`)
    res.writeHead(200, { 'content-type': types[extname(p)] ?? 'application/octet-stream' }).end(body)
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const profile = mkdtempSync(join(tmpdir(), 'smoke-chrome-'))
  const base = `http://127.0.0.1:${server.address().port}/`
  for (const w of worlds) {
    const dom = await new Promise((resolve) => execFile(chrome, ['--headless=new', '--no-sandbox', '--no-first-run',
      '--use-angle=swiftshader', '--enable-unsafe-swiftshader', `--user-data-dir=${profile}`,
      '--virtual-time-budget=5000', '--dump-dom', `${base}?world=${w}`], { timeout: 30000, maxBuffer: 1 << 26 },
    (err, out) => resolve(err ? `CHROME FAILED: ${err.message}` : out)))
    const error = dom.match(/data-smoke-error="([^"]*)"/)?.[1] ?? (dom.startsWith('CHROME FAILED') ? dom : null)
    const booted = /<select[^>]*id="layer"[^>]*>\s*<option/.test(dom) // the minimap is filled at the end of boot
    if (error || !booted) fails.push(`boot ?world=${w}: ${error ?? 'minimap never filled (app did not finish loading)'}`)
    else console.log(`check-dist: boot ?world=${w} ok`)
  }
  server.close()
  rmSync(profile, { recursive: true, force: true })
}

if (fails.length) { console.error(`check-dist FAILED:\n  ${fails.join('\n  ')}`); process.exit(1) }
