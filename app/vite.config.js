import basicSsl from '@vitejs/plugin-basic-ssl'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

// Azure Static Web Apps does not compress octet-stream: write a .gz beside each world layer and model (world.js fetchBuffer).
let outDir
const gzipBinaries = { name: 'gzip-binaries', apply: 'build', configResolved(c) { outDir = c.build.outDir }, closeBundle() {
  for (const f of readdirSync(outDir, { recursive: true })) if (/\.(f32|u8|glb)$/.test(f)) writeFileSync(`${outDir}/${f}.gz`, gzipSync(readFileSync(`${outDir}/${f}`), { level: 9 }))
} }

export default ({ mode }) => ({
  // ponytail: worlds are served straight from data/worlds/, so the real Gale slice drops in with no copy step.
  // Each world folder lands at /<name>/ in dev and in dist/ for Azure.
  publicDir: '../data/worlds',
  // `npm run phone`: HTTPS on the LAN so a phone can open it (motion sensors need a secure page).
  // Plain `npm run dev` stays HTTP; localhost already counts as secure on a laptop.
  plugins: mode === 'phone' ? [basicSsl(), gzipBinaries] : [gzipBinaries],
  server: { host: mode === 'phone' },
  build: {
    chunkSizeWarningLimit: 1000,
    // Two pages: the Mission VESTA home page at / and the map app (Vesta Scout) at /scout/.
    rollupOptions: { input: { home: 'index.html', scout: 'scout/index.html' } },
  }, // three.js alone is ~550 kB (140 kB gzipped)
})
