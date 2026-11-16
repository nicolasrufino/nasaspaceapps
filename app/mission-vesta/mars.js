import marsTexture from './assets/mars-texture.webp?url' // a file, not base64 in the script: cached, parsed off the JS

// Project the NASA Mars texture onto a lit sphere and turn it around its polar axis.
function makeGlobe(canvas, image) {
  const gl = canvas.getContext('webgl', { antialias: false });
  if (!gl) return null;

  const program = gl.createProgram();
  const shaders = [
    [gl.VERTEX_SHADER, `
      attribute vec2 point;
      varying vec2 position;
      void main() {
        position = point;
        gl_Position = vec4(point, 0.0, 1.0);
      }`],
    [gl.FRAGMENT_SHADER, `
      precision mediump float;
      varying vec2 position;
      uniform sampler2D surface;
      uniform float turn;
      const float pi = 3.14159265;

      void main() {
        float radius = length(position);
        if (radius > 1.0) discard;
        vec3 normal = vec3(position, sqrt(max(0.0, 1.0 - radius * radius)));

        // Look slightly down on the equator while keeping the sun fixed.
        float north = 0.96 * normal.y + 0.28 * normal.z;
        float front = 0.96 * normal.z - 0.28 * normal.y;
        float longitude = atan(normal.x, front) / (2.0 * pi);
        float latitude = asin(clamp(north, -1.0, 1.0)) / pi;
        vec3 terrain = texture2D(surface, vec2(fract(0.5 + turn - longitude), 0.5 - latitude)).rgb;
        // Shift the ochre terrain toward rust while keeping the polar ice neutral.
        float warmth = max(terrain.r - terrain.b, 0.0);
        terrain.r += 0.10 * warmth;
        terrain.g -= 0.23 * warmth;

        vec3 sun = normalize(vec3(-0.35, 0.8, 0.65));
        float light = 0.30 + 0.86 * max(0.0, dot(normal, sun));
        float edge = 1.0 - smoothstep(0.996, 1.0, radius);
        gl_FragColor = vec4(terrain * light * edge, edge);
      }`],
  ];

  for (const [type, source] of shaders) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return null;
    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  }

  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const point = gl.getAttribLocation(program, 'point');
  gl.enableVertexAttribArray(point);
  gl.vertexAttribPointer(point, 2, gl.FLOAT, false, 0, 0);

  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const turnUniform = gl.getUniformLocation(program, 'turn');

  return (turn) => {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(turnUniform, turn % 1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
}

async function startMars() {
  const globe = document.querySelector('.mars');
  const photo = globe.querySelector('img');
  const control = globe.querySelector('button');
  const canvas = control.querySelector('canvas');
  const image = new Image();
  image.src = marsTexture;
  await image.decode();

  const draw = makeGlobe(canvas, image);
  if (!draw) return;

  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let playing = !motion.matches;
  let visible = false;
  let rotation = -0.22;
  let drag = null;
  let frame = 0;
  let lastTime = 0;

  function render(time) {
    frame = 0;
    if (playing && visible && !drag) {
      if (lastTime) rotation += Math.min(time - lastTime, 50) / 48000;
      lastTime = time;
      frame = requestAnimationFrame(render);
    } else {
      lastTime = 0;
    }
    draw(rotation);
  }

  function refresh() {
    if (!frame && !control.hidden) frame = requestAnimationFrame(render);
  }

  function setPlaying(value) {
    playing = value;
    control.setAttribute('aria-pressed', String(playing));
    refresh();
  }

  function resize() {
    const pixels = Math.min(1200, Math.round(globe.clientWidth * devicePixelRatio));
    if (pixels && canvas.width !== pixels) {
      canvas.width = canvas.height = pixels;
    }
    refresh();
  }

  control.hidden = false;
  photo.hidden = true;
  setPlaying(playing);
  const sizeObserver = new ResizeObserver(resize);
  sizeObserver.observe(globe);
  const visibilityObserver = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    refresh();
  });
  visibilityObserver.observe(globe);
  motion.addEventListener('change', () => setPlaying(!motion.matches));

  control.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0 || drag) return;
    drag = { id: event.pointerId, x: event.clientX, rotation, moved: false };
    control.setPointerCapture(event.pointerId);
    lastTime = 0;
  });

  control.addEventListener('pointermove', (event) => {
    if (drag?.id !== event.pointerId) return;
    const distance = event.clientX - drag.x;
    if (!drag.moved && Math.abs(distance) < 5) return;
    drag.moved = true;
    rotation = drag.rotation + distance / (globe.clientWidth * Math.PI);
    refresh();
  });

  let suppressClick = false;
  function release(event) {
    if (drag?.id !== event.pointerId) return;
    suppressClick = event.type === 'pointerup' && drag.moved;
    drag = null;
    lastTime = 0;
    refresh();
  }
  control.addEventListener('pointerup', release);
  control.addEventListener('pointercancel', release);
  control.addEventListener('lostpointercapture', release);

  control.addEventListener('click', (event) => {
    if (!suppressClick || event.detail === 0) setPlaying(!playing);
    suppressClick = false;
  });
  control.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    rotation += event.key === 'ArrowRight' ? 0.025 : -0.025;
    refresh();
  });

  canvas.addEventListener('webglcontextlost', () => {
    cancelAnimationFrame(frame);
    sizeObserver.disconnect();
    visibilityObserver.disconnect();
    control.hidden = true;
    photo.hidden = false;
  }, { once: true });
}

// Keep the still image in browsers without WebGL or a usable texture.
startMars().catch(() => {});
