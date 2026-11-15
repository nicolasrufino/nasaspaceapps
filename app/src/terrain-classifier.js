import { CROP_SIZE, cropAt, cropToTensor, rankedClasses } from './terrain-input.js'

export function initTerrainClassifier(panel) {
  const box = document.createElement('details')
  box.id = 'terrainClassifier'
  box.innerHTML = `
    <summary>Classify a ground photo</summary>
    <p class="src">MobileNet v1 · trained on NASA/JPL AI4Mars Curiosity ground photos.
      Choose a ground photo with one main surface. Analysis stays on your device.</p>
    <label>Ground photo <input id="terrainPhoto" type="file" accept="image/jpeg,image/png,image/webp"></label>
    <p class="src">Tap the photo or use the arrow keys to move the square. Only that 256 × 256 pixel area is analyzed.</p>
    <canvas id="terrainPreview" hidden tabindex="0" role="img" aria-label="Ground photo. Tap to select a crop; arrow keys move the crop."></canvas>
    <p id="terrainCrop" class="src"></p>
    <button id="terrainAnalyze" type="button" disabled>Analyze selected area</button>
    <p id="terrainStatus" class="src" role="status" aria-live="polite"></p>
    <div id="terrainResult"></div>
    <p class="src">Ground-photo experiment, not validated for helicopter or orbital images.
      Predicts a dominant surface, not individual obstacles, slopes or safe passage.
      The map and route are not changed.</p>`
  panel.append(box)
  const $ = (id) => box.querySelector(`#${id}`)
  const file = $('terrainPhoto'), preview = $('terrainPreview'), analyze = $('terrainAnalyze')
  const status = $('terrainStatus'), result = $('terrainResult'), cropLabel = $('terrainCrop')
  const context = preview.getContext('2d')
  let photo, crop, version = 0, busy = false, runner
  const clearResult = () => { result.replaceChildren(); status.textContent = '' }
  function draw() {
    clearResult()
    const scale = preview.width / photo.width
    context.drawImage(photo, 0, 0, preview.width, preview.height)
    context.strokeStyle = '#000'
    context.lineWidth = 4
    context.strokeRect(crop.x * scale, crop.y * scale, CROP_SIZE * scale, CROP_SIZE * scale)
    context.strokeStyle = '#ffd23f'
    context.lineWidth = 2
    context.strokeRect(crop.x * scale, crop.y * scale, CROP_SIZE * scale, CROP_SIZE * scale)
    cropLabel.textContent = `Selected area: x ${crop.x}, y ${crop.y} · 256 × 256 pixels`
  }
  file.onchange = async () => {
    const ownVersion = ++version
    photo?.close(); photo = null
    preview.hidden = true; analyze.disabled = true
    cropLabel.textContent = ''; clearResult()
    const chosen = file.files?.[0]
    if (!chosen) return
    try {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(chosen.type)) throw new Error('Choose a JPEG, PNG or WebP photo.')
      if (chosen.size > 20 * 1024 * 1024) throw new Error('Choose a photo smaller than 20 MB.')
      const decoded = await createImageBitmap(chosen)
      if (ownVersion !== version) { decoded.close(); return }
      try {
        crop = cropAt(decoded.width, decoded.height)
        if (decoded.width * decoded.height > 32000000) throw new Error('Choose a photo with at most 32 megapixels.')
      } catch (error) { decoded.close(); throw error }
      photo = decoded
      preview.width = Math.min(600, photo.width)
      preview.height = Math.round(photo.height * preview.width / photo.width)
      preview.hidden = false; analyze.disabled = busy
      draw()
    } catch (error) { if (ownVersion === version) status.textContent = error.message }
  }
  preview.onclick = (event) => {
    if (!photo) return
    const rect = preview.getBoundingClientRect()
    crop = cropAt(photo.width, photo.height, (event.clientX - rect.left) / rect.width * photo.width,
      (event.clientY - rect.top) / rect.height * photo.height)
    version++; draw()
  }
  preview.onkeydown = (event) => {
    const delta = { ArrowLeft: [-16, 0], ArrowRight: [16, 0], ArrowUp: [0, -16], ArrowDown: [0, 16] }[event.key]
    if (!photo || !delta) return
    event.preventDefault()
    crop = cropAt(photo.width, photo.height, crop.x + 128 + delta[0], crop.y + 128 + delta[1])
    version++; draw()
  }
  analyze.onclick = async () => {
    if (!photo || busy) return
    const ownVersion = version
    busy = true; analyze.disabled = true; clearResult()
    status.textContent = 'Loading model and analyzing locally… First use downloads the model and runtime.'
    const start = performance.now()
    try {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = CROP_SIZE
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(photo, crop.x, crop.y, CROP_SIZE, CROP_SIZE, 0, 0, CROP_SIZE, CROP_SIZE)
      const tensor = cropToTensor(ctx.getImageData(0, 0, CROP_SIZE, CROP_SIZE).data)
      runner ??= (await import('./terrain-runner.js')).createTerrainRunner()
      const logits = await runner.run(tensor)
      if (ownVersion !== version) return // A changed photo/crop must never receive a stale prediction.
      const ranking = rankedClasses(logits)
      const title = document.createElement('strong')
      title.textContent = `Predicted dominant surface: ${ranking[0].name}`
      const scores = document.createElement('p')
      scores.className = 'src'
      scores.textContent = ranking.map((c) => `${c.name} ${(100 * c.score).toFixed(1)}%`).join(' · ')
      const note = document.createElement('p')
      note.className = 'src'
      note.textContent = 'Relative model scores, not measured accuracy or a probability of safety. “Unknown” is not learned; the model will still choose a class on an unfamiliar image.'
      result.append(title, scores, note)
      status.textContent = `Analysis complete in ${((performance.now() - start) / 1000).toFixed(1)} s (including any loading).`
    } catch (error) {
      if (ownVersion === version) status.textContent = `Analysis unavailable: ${error.message}`
    } finally { busy = false; analyze.disabled = !photo }
  }
}
