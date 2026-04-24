/**
 * app.js — Main application controller.
 *
 * Wires the UI (filter list, sliders, drag-and-drop, download button) to the
 * WebGL module and the filters config.  This file should not need to change
 * when adding new filters — only filters.js needs editing.
 */

import { FILTERS } from './filters.js';
import {
  initGL,
  compileShader,
  linkProgram,
  createQuad,
  bindQuadAttributes,
  uploadTexture,
  updateTexture,
  setUniforms,
  drawQuad,
} from './webgl.js';

const BASE_URL = import.meta.env.BASE_URL;
const THEME_STORAGE_KEY = 'shader-theme';

// ---------------------------------------------------------------------------
// App state
// ---------------------------------------------------------------------------

/** The WebGL context, set once on startup. */
let gl;

/** The vertex buffer for the fullscreen quad. */
let quadBuffer;

/** The currently compiled and linked WebGL program. */
let activeProgram = null;

/** The currently uploaded image texture (WebGLTexture). */
let imageTexture = null;

/** The HTMLImageElement most recently loaded by the user. */
let loadedImage = null;

/** The active source element drawn into uTexture: image/canvas/video. */
let sourceElement = null;

/** Live camera state. */
let cameraStream = null;
let cameraVideo = null;
let cameraFrameRequest = null;

/** Raw GLSL source of the vertex shader (loaded once). */
let vertexSource = null;

/** Currently active filter config object from FILTERS. */
let activeFilter = null;

/** Current uniform values { uniformName: number }, updated by sliders. */
let uniformValues = {};

/** Whether compare (split-slider) mode is active. */
let compareActive = false;

/** Divider position as a fraction of the canvas width (0–1). */
let compareFraction = 0.5;

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

// Preloaded sample images (served from public/test-images/)
const PRESETS = [
  { label: 'peppers',        path: 'test-images/peppers_color.tif' },
  { label: 'mandril',        path: 'test-images/mandril_color.tif' },
  { label: 'cameraman',      path: 'test-images/cameraman.tif' },
  { label: 'house',          path: 'test-images/house.tif' },
  { label: 'jetplane',       path: 'test-images/jetplane.tif' },
  { label: 'lake',           path: 'test-images/lake.tif' },
  { label: 'livingroom',     path: 'test-images/livingroom.tif' },
  { label: 'pirate',         path: 'test-images/pirate.tif' },
  { label: 'walkbridge',     path: 'test-images/walkbridge.tif' },
  { label: 'woman (blonde)', path: 'test-images/woman_blonde.tif' },
  { label: 'woman (dark)',   path: 'test-images/woman_darkhair.tif' },
];

window.addEventListener('DOMContentLoaded', async () => {
  const canvas = document.getElementById('glCanvas');
  gl = initGL(canvas);
  quadBuffer = createQuad(gl);

  // Load the vertex shader source once — it never changes between filters.
  vertexSource = await fetchShader('shaders/vertex.glsl');

  buildFilterList();
  buildPresetGrid();
  setupThemeToggle();
  setupDropZone();
  setupCameraButton();
  setupDownloadButton();
  setupResetButton();
  setupCompareButton();
  setupCanvasResizeSync();

  // Activate the first filter by default.
  await activateFilter(FILTERS[0]);
});

// ---------------------------------------------------------------------------
// Filter list (sidebar)
// ---------------------------------------------------------------------------

/**
 * buildFilterList()
 *
 * Reads the FILTERS array and creates one <button> per filter in the
 * #filterList element.  Clicking a button calls activateFilter().
 */
function buildFilterList() {
  const list = document.getElementById('filterList');

  FILTERS.forEach((filter) => {
    const btn = document.createElement('button');
    btn.textContent = filter.name;
    btn.dataset.filterId = filter.id;
    btn.className = 'filter-btn';
    btn.addEventListener('click', () => activateFilter(filter));
    list.appendChild(btn);
  });
}

/**
 * activateFilter(filter)
 *
 * Fetches the filter's GLSL source, compiles + links a new WebGL program,
 * then rebuilds the parameter panel and re-renders the canvas.
 *
 * @param {Object} filter — one entry from the FILTERS array
 */
async function activateFilter(filter) {
  // Update sidebar active state.
  document.querySelectorAll('.filter-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.filterId === filter.id);
  });

  // Show a loading indicator in the params panel while we fetch.
  const paramsPanel = document.getElementById('paramsPanel');
  paramsPanel.innerHTML = '<p class="params-loading">loading shader…</p>';

  let fragmentSource;
  try {
    fragmentSource = await fetchShader(filter.shader);
  } catch (err) {
    paramsPanel.innerHTML = `<p class="error">Failed to load shader: ${err.message}</p>`;
    return;
  }

  // Compile the new program.
  let program;
  try {
    const vert = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
    const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    program = linkProgram(gl, vert, frag);
  } catch (err) {
    paramsPanel.innerHTML = `<p class="error">${err.message}</p>`;
    return;
  }

  // Release the old program.
  if (activeProgram) {
    gl.deleteProgram(activeProgram);
  }
  activeProgram = program;
  activeFilter  = filter;

  // Seed uniform values from the filter's defaults (only for new uniforms).
  uniformValues = {};
  filter.uniforms.forEach((u) => {
    uniformValues[u.name] = u.default;
  });

  // Rebuild the parameters panel.
  buildParamsPanel(filter);

  // Render with the new shader.
  render();
}

// ---------------------------------------------------------------------------
// Parameter panel (sliders)
// ---------------------------------------------------------------------------

/**
 * buildParamsPanel(filter)
 *
 * Dynamically generates one labelled slider per uniform descriptor in the
 * filter's `uniforms` array.  Each slider is wired to update uniformValues
 * and re-render in real time.
 */
function buildParamsPanel(filter) {
  const panel = document.getElementById('paramsPanel');
  panel.innerHTML = '';

  if (filter.uniforms.length === 0) {
    panel.innerHTML = '<p class="params-empty">no parameters</p>';
    return;
  }

  filter.uniforms.forEach((u, index) => {
    // Container row.
    const row = document.createElement('div');
    row.className = 'param-row';

    // Label showing name and current value.
    const label = document.createElement('label');
    label.className = 'param-label';
    label.htmlFor = `param-${filter.id}-${index}`;

    const nameSpan = document.createElement('span');
    nameSpan.textContent = u.label;

    const valueSpan = document.createElement('span');
    valueSpan.className = 'param-value';
    valueSpan.textContent = formatValue(u, uniformValues[u.name]);

    label.appendChild(nameSpan);
    label.appendChild(valueSpan);

    // Range slider.
    const sliderRow = document.createElement('div');
    sliderRow.className = 'param-slider-row';

    const decreaseBtn = document.createElement('button');
    decreaseBtn.type = 'button';
    decreaseBtn.className = 'param-stepper';
    decreaseBtn.setAttribute('aria-label', `decrease ${u.label}`);
    decreaseBtn.textContent = '-';

    const slider = document.createElement('input');
    slider.id    = `param-${filter.id}-${index}`;
    slider.type  = 'range';
    slider.min   = u.min;
    slider.max   = u.max;
    slider.step  = u.step;
    slider.value = uniformValues[u.name];
    slider.className = 'param-slider';

    const increaseBtn = document.createElement('button');
    increaseBtn.type = 'button';
    increaseBtn.className = 'param-stepper';
    increaseBtn.setAttribute('aria-label', `increase ${u.label}`);
    increaseBtn.textContent = '+';

    const syncSlider = (shouldRender = true) => {
      const raw = parseFloat(slider.value);
      uniformValues[u.name] = u.type === 'int' ? Math.round(raw) : raw;
      slider.value = uniformValues[u.name];
      valueSpan.textContent = formatValue(u, uniformValues[u.name]);
      updateSliderFill(slider);
      updateStepperState(slider, decreaseBtn, increaseBtn);
      if (shouldRender) render();
    };

    slider.addEventListener('input', () => {
      syncSlider();
    });

    decreaseBtn.addEventListener('click', () => {
      slider.stepDown();
      syncSlider();
    });

    increaseBtn.addEventListener('click', () => {
      slider.stepUp();
      syncSlider();
    });

    row.appendChild(label);
    sliderRow.appendChild(decreaseBtn);
    sliderRow.appendChild(slider);
    sliderRow.appendChild(increaseBtn);
    row.appendChild(sliderRow);
    panel.appendChild(row);

    syncSlider(false);
  });
}

function updateSliderFill(slider) {
  const min = parseFloat(slider.min);
  const max = parseFloat(slider.max);
  const value = parseFloat(slider.value);

  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min || !Number.isFinite(value)) {
    slider.style.setProperty('--slider-progress', '0%');
    return;
  }

  const progress = ((value - min) / (max - min)) * 100;
  slider.style.setProperty('--slider-progress', `${Math.min(100, Math.max(0, progress))}%`);
}

function updateStepperState(slider, decreaseBtn, increaseBtn) {
  const min = parseFloat(slider.min);
  const max = parseFloat(slider.max);
  const value = parseFloat(slider.value);
  const step = parseFloat(slider.step);
  const tolerance = Number.isFinite(step) ? step / 2 : 1e-6;

  decreaseBtn.disabled = !Number.isFinite(value) || value <= min + tolerance;
  increaseBtn.disabled = !Number.isFinite(value) || value >= max - tolerance;
}

/** Format a slider value for display, respecting int vs float. */
function formatValue(uniformDesc, value) {
  if (uniformDesc.type === 'int') return String(Math.round(value));
  // Show enough decimal places to match the step resolution.
  const decimals = (uniformDesc.step.toString().split('.')[1] || '').length;
  return value.toFixed(Math.max(decimals, 1));
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/**
 * render()
 *
 * Executes a full WebGL draw: activates the program, binds the texture,
 * sets all uniforms, and draws the fullscreen quad.
 *
 * Called after any state change (new filter, slider move, new image).
 */
function render() {
  if (!activeProgram) return;

  const canvas = document.getElementById('glCanvas');

  // Activate the compiled shader program.
  gl.useProgram(activeProgram);

  // Connect the quad vertex buffer to the shader's attribute variables.
  bindQuadAttributes(gl, activeProgram, quadBuffer);

  // Build the uniform map to pass to setUniforms.
  const uniforms = {};

  // Always provide the image texture on unit 0.
  uniforms['uTexture'] = { type: 'sampler2D', value: 0 };

  // Always provide the canvas resolution so shaders can compute pixel offsets.
  uniforms['uResolution'] = { type: 'vec2', value: [canvas.width, canvas.height] };

  // Merge in the current slider values, tagged with their declared type.
  if (activeFilter) {
    activeFilter.uniforms.forEach((u) => {
      uniforms[u.name] = { type: u.type, value: uniformValues[u.name] };
    });
  }

  setUniforms(gl, activeProgram, uniforms);

  // Bind the image texture to unit 0.
  if (imageTexture) {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, imageTexture);
  }

  drawQuad(gl);
}

function setCanvasSize(w, h) {
  const canvas = document.getElementById('glCanvas');
  canvas.width  = w;
  canvas.height = h;
  gl.viewport(0, 0, w, h);
}

function showImageActions() {
  document.getElementById('dropOverlay').style.display = 'none';
  const resetBtn = document.getElementById('resetBtn');
  if (resetBtn) resetBtn.style.display = 'flex';
  const compareBtn = document.getElementById('compareBtn');
  if (compareBtn) compareBtn.style.display = 'flex';
  const imageActions = document.getElementById('imageActions');
  if (imageActions) imageActions.classList.add('visible');
}

function setCameraUi(active) {
  const startButtons = document.querySelectorAll('.camera-start-btn');
  const stopBtn = document.getElementById('cameraStopBtn');
  const cameraStatus = document.getElementById('cameraStatus');

  startButtons.forEach((btn) => {
    btn.disabled = active;
  });
  if (stopBtn) stopBtn.style.display = active ? 'flex' : 'none';
  if (cameraStatus) cameraStatus.textContent = active ? 'camera on' : '';
}

// ---------------------------------------------------------------------------
// Image loading
// ---------------------------------------------------------------------------

/**
 * loadImageFromElement(img, w, h)
 *
 * Shared final step: uploads an HTMLImageElement (or ImageBitmap-backed
 * canvas) as a WebGL texture and resizes the canvas.
 */
function loadImageFromElement(img, w, h) {
  stopCamera();

  const MAX_DIM = 1200;
  if (w > MAX_DIM || h > MAX_DIM) {
    const scale = Math.min(MAX_DIM / w, MAX_DIM / h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

  setCanvasSize(w, h);

  if (imageTexture) gl.deleteTexture(imageTexture);
  imageTexture = uploadTexture(gl, img);
  loadedImage  = img;
  sourceElement = img;

  showImageActions();
  exitCompare();
  render();
}

/**
 * loadImageFile(file)
 *
 * Handles a File object from drop or file picker.
 * Routes TIFF files through UTIF; everything else through a standard <img>.
 */
function loadImageFile(file) {
  if (!file) return;

  if (file.name.match(/\.tiff?$/i)) {
    file.arrayBuffer().then(loadTiffBuffer);
    return;
  }

  if (!file.type.startsWith('image/')) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => loadImageFromElement(img, img.naturalWidth, img.naturalHeight);
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

/**
 * loadTiffBuffer(buffer)
 *
 * Decodes an ArrayBuffer containing TIFF data using UTIF, then paints it
 * onto an offscreen canvas to produce an HTMLCanvasElement for WebGL upload.
 */
function loadTiffBuffer(buffer) {
  const ifds = UTIF.decode(buffer);
  UTIF.decodeImage(buffer, ifds[0]);
  const ifd  = ifds[0];
  const rgba = UTIF.toRGBA8(ifd);
  const w    = ifd.width;
  const h    = ifd.height;

  const offscreen = document.createElement('canvas');
  offscreen.width  = w;
  offscreen.height = h;
  const ctx  = offscreen.getContext('2d');
  const data = new ImageData(new Uint8ClampedArray(rgba.buffer), w, h);
  ctx.putImageData(data, 0, 0);

  loadImageFromElement(offscreen, w, h);
}

/**
 * loadTiffUrl(url)
 *
 * Fetches a TIFF from a URL and passes the buffer to loadTiffBuffer.
 */
async function loadTiffUrl(url) {
  const resp = await fetch(resolveAssetUrl(url));
  const buf  = await resp.arrayBuffer();
  loadTiffBuffer(buf);
}

// ---------------------------------------------------------------------------
// Preset image grid
// ---------------------------------------------------------------------------

function buildPresetGrid() {
  const grid = document.getElementById('presetGrid');
  PRESETS.forEach(({ label, path }) => {
    const btn = document.createElement('button');
    btn.className   = 'preset-btn';
    btn.textContent = label;
    btn.addEventListener('click', () => loadTiffUrl(path));
    grid.appendChild(btn);
  });
}

// ---------------------------------------------------------------------------
// Drag-and-drop + click-to-upload
// ---------------------------------------------------------------------------

function setupDropZone() {
  const main    = document.getElementById('mainArea');
  const dropZone = document.getElementById('dropZone');

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((evt) => {
    main.addEventListener(evt, (e) => e.preventDefault());
    document.body.addEventListener(evt, (e) => e.preventDefault());
  });

  main.addEventListener('dragenter', () => main.classList.add('drag-over'));
  main.addEventListener('dragleave', (e) => {
    if (!main.contains(e.relatedTarget)) main.classList.remove('drag-over');
  });
  main.addEventListener('drop', (e) => {
    main.classList.remove('drag-over');
    loadImageFile(e.dataTransfer.files[0]);
  });

  dropZone.addEventListener('click', () => {
    const input    = document.createElement('input');
    input.type     = 'file';
    input.accept   = 'image/*,.tif,.tiff';
    input.onchange = () => loadImageFile(input.files[0]);
    input.click();
  });
}

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------

function setupCameraButton() {
  const startButtons = document.querySelectorAll('.camera-start-btn');
  const stopBtn = document.getElementById('cameraStopBtn');
  if (!startButtons.length || !stopBtn) return;

  if (!navigator.mediaDevices?.getUserMedia) {
    startButtons.forEach((btn) => {
      btn.disabled = true;
    });
    const cameraStatus = document.getElementById('cameraStatus');
    if (cameraStatus) cameraStatus.textContent = 'camera unavailable';
    return;
  }

  startButtons.forEach((btn) => {
    btn.addEventListener('click', startCamera);
  });
  stopBtn.addEventListener('click', stopCameraAndReset);
}

async function startCamera() {
  const cameraStatus = document.getElementById('cameraStatus');
  try {
    if (cameraStatus) cameraStatus.textContent = 'requesting camera...';

    stopCamera();
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });

    cameraVideo = document.createElement('video');
    cameraVideo.autoplay = true;
    cameraVideo.muted = true;
    cameraVideo.playsInline = true;
    cameraVideo.srcObject = cameraStream;
    await cameraVideo.play();

    const w = cameraVideo.videoWidth || 1280;
    const h = cameraVideo.videoHeight || 720;
    setCanvasSize(w, h);

    if (imageTexture) gl.deleteTexture(imageTexture);
    imageTexture = uploadTexture(gl, cameraVideo);
    loadedImage = null;
    sourceElement = cameraVideo;

    showImageActions();
    exitCompare();
    setCameraUi(true);
    renderCameraFrame();
  } catch (err) {
    stopCamera();
    if (cameraStatus) cameraStatus.textContent = `camera blocked: ${err.message}`;
  }
}

function renderCameraFrame() {
  if (!cameraVideo || !imageTexture) return;

  if (cameraVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    const w = cameraVideo.videoWidth;
    const h = cameraVideo.videoHeight;
    const canvas = document.getElementById('glCanvas');
    if (w && h && (canvas.width !== w || canvas.height !== h)) {
      setCanvasSize(w, h);
    }

    updateTexture(gl, imageTexture, cameraVideo);
    render();
    updateCompare();
  }

  cameraFrameRequest = window.requestAnimationFrame(renderCameraFrame);
}

function stopCamera() {
  if (cameraFrameRequest !== null) {
    window.cancelAnimationFrame(cameraFrameRequest);
    cameraFrameRequest = null;
  }

  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }

  if (cameraVideo) {
    cameraVideo.srcObject = null;
    cameraVideo = null;
  }

  setCameraUi(false);
}

function stopCameraAndReset() {
  stopCamera();
  resetSource();
}

// ---------------------------------------------------------------------------
// Download
// ---------------------------------------------------------------------------

/**
 * setupDownloadButton()
 *
 * Wires the Download button so that clicking it calls canvas.toDataURL() and
 * triggers a browser download of the current (filtered) frame as a PNG.
 *
 * Note: this only works correctly because we initialised WebGL with
 * preserveDrawingBuffer: true — see webgl.js for the explanation.
 */
function setupDownloadButton() {
  document.getElementById('downloadBtn').addEventListener('click', () => {
    if (!imageTexture) {
      alert('load an image first.');
      return;
    }

    // Re-render to ensure the drawing buffer is current.
    render();

    const canvas  = document.getElementById('glCanvas');
    const dataURL = canvas.toDataURL('image/png');
    const a       = document.createElement('a');
    a.href        = dataURL;
    a.download    = 'filtered-image.png';
    a.click();
  });
}

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

function setupResetButton() {
  const btn = document.getElementById('resetBtn');
  if (!btn) return;
  btn.addEventListener('click', resetSource);
}

function resetSource() {
  stopCamera();

  if (imageTexture) {
    gl.deleteTexture(imageTexture);
    imageTexture = null;
  }
  loadedImage = null;
  sourceElement = null;

  // Reset canvas to 1×1 so it takes no space behind the overlay.
  setCanvasSize(1, 1);

  exitCompare();
  document.getElementById('dropOverlay').style.display = '';
  const rb = document.getElementById('resetBtn');
  if (rb) rb.style.display = 'none';
  const cb = document.getElementById('compareBtn');
  if (cb) cb.style.display = 'none';
  const imageActions = document.getElementById('imageActions');
  if (imageActions) imageActions.classList.remove('visible');
}

// ---------------------------------------------------------------------------
// Compare (split-slider)
// ---------------------------------------------------------------------------

function setupCompareButton() {
  const btn      = document.getElementById('compareBtn');
  const overlay  = document.getElementById('compareOverlay');
  const labels = document.getElementById('compareLabels');

  btn.addEventListener('click', () => {
    if (!imageTexture) return;
    compareActive = !compareActive;
    btn.classList.toggle('active', compareActive);
    overlay.classList.toggle('active', compareActive);
    labels.classList.toggle('active', compareActive);
    if (compareActive) {
      compareFraction = 0.5;
      updateCompare();
    }
  });

  // Use pointer events so compare mode works with mouse, touch, and pen.
  overlay.addEventListener('pointerdown', (event) => {
    if (!compareActive || !sourceElement) return;

    event.preventDefault();
    const pointerId = event.pointerId;

    const onMove = (moveEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      setCompareFractionFromClientX(moveEvent.clientX);
    };

    const onUp = (endEvent) => {
      if (endEvent.pointerId !== pointerId) return;

      overlay.removeEventListener('pointermove', onMove);
      overlay.removeEventListener('pointerup', onUp);
      overlay.removeEventListener('pointercancel', onUp);

      if (overlay.hasPointerCapture?.(pointerId)) {
        overlay.releasePointerCapture(pointerId);
      }
    };

    overlay.setPointerCapture?.(pointerId);
    setCompareFractionFromClientX(event.clientX);
    overlay.addEventListener('pointermove', onMove);
    overlay.addEventListener('pointerup', onUp);
    overlay.addEventListener('pointercancel', onUp);
  });
}

function setCompareFractionFromClientX(clientX) {
  const glCanvas = document.getElementById('glCanvas');
  const rect = glCanvas.getBoundingClientRect();
  if (!rect.width) return;

  compareFraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  updateCompare();
}

/**
 * updateCompare()
 *
 * Sizes the originalCanvas to match glCanvas, redraws the source image onto
 * it, then clips it to the left portion using clip-path so only the region
 * left of the divider is visible.  Also positions the divider line.
 */
function updateCompare() {
  if (!compareActive || !sourceElement) return;

  const glCanvas  = document.getElementById('glCanvas');
  const origCanvas = document.getElementById('originalCanvas');
  const divider   = document.getElementById('compareDivider');
  const w = glCanvas.offsetWidth;
  const h = glCanvas.offsetHeight;
  if (!w || !h) return;
  const splitX = Math.round(compareFraction * w);

  // Match display size.
  origCanvas.style.width  = w + 'px';
  origCanvas.style.height = h + 'px';
  origCanvas.width  = w;
  origCanvas.height = h;

  // Draw the original image scaled to fill the canvas display size.
  const ctx = origCanvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(sourceElement, 0, 0, w, h);

  // Clip to the left portion.
  origCanvas.style.clipPath = `inset(0 ${w - splitX}px 0 0)`;

  // Position the divider.
  divider.style.left = splitX + 'px';
}

/**
 * exitCompare()
 *
 * Turns off compare mode and resets the divider.
 */
function exitCompare() {
  compareActive = false;
  compareFraction = 0.5;
  const btn = document.getElementById('compareBtn');
  const overlay = document.getElementById('compareOverlay');
  if (btn) btn.classList.remove('active');
  if (overlay) overlay.classList.remove('active');
  const labels = document.getElementById('compareLabels');
  if (labels) labels.classList.remove('active');
}

function setupCanvasResizeSync() {
  const glCanvas = document.getElementById('glCanvas');
  let frame = null;

  const syncCompare = () => {
    if (frame !== null) return;

    frame = window.requestAnimationFrame(() => {
      frame = null;
      updateCompare();
    });
  };

  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(syncCompare);
    observer.observe(glCanvas);
  }

  window.addEventListener('resize', syncCompare, { passive: true });
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/**
 * fetchShader(path)
 *
 * Loads a GLSL source file from the given path using the Fetch API.
 * Throws a descriptive error if the request fails so the UI can surface it.
 *
 * @param {string} path — relative URL, e.g. 'shaders/grayscale.glsl'
 * @returns {Promise<string>} — raw GLSL source text
 */
async function fetchShader(path) {
  const url = resolveAssetUrl(path);
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status} fetching ${url}`);
  }
  return resp.text();
}

function resolveAssetUrl(path) {
  return new URL(path, window.location.origin + BASE_URL).toString();
}

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

function setupThemeToggle() {
  const button = document.getElementById('themeToggleBtn');
  const label = document.getElementById('themeToggleLabel');
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  const getPreferredTheme = () => {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === 'light' || storedTheme === 'dark') return storedTheme;
    return mediaQuery.matches ? 'dark' : 'light';
  };

  const applyTheme = (theme) => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;

    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    label.textContent = nextTheme;
    button.setAttribute('aria-label', `switch to ${nextTheme} mode`);
    button.setAttribute('title', `switch to ${nextTheme} mode`);
  };

  applyTheme(getPreferredTheme());

  button.addEventListener('click', () => {
    const currentTheme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    applyTheme(nextTheme);
  });

  mediaQuery.addEventListener('change', (event) => {
    if (localStorage.getItem(THEME_STORAGE_KEY)) return;
    applyTheme(event.matches ? 'dark' : 'light');
  });
}
