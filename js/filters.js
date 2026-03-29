/**
 * filters.js — The single file you need to edit to add a new filter.
 *
 * Each entry in the FILTERS array describes one filter.  The app reads this
 * array to populate the sidebar, load the GLSL file, and build the parameter
 * sliders automatically.
 *
 * ── How to add a new filter ─────────────────────────────────────────────────
 *
 *  1. Drop a .glsl fragment shader file into /shaders/.
 *  2. Add a new object to the FILTERS array below with the following shape:
 *
 *     {
 *       id:      'my-filter',       // unique slug, must match the filename
 *       name:    'My Filter',       // display name shown in the sidebar
 *       shader:  'shaders/my-filter.glsl',
 *       uniforms: [                 // array of uniform descriptors (may be [])
 *         {
 *           name:    'uMyParam',    // must match the uniform name in the GLSL
 *           label:   'My Param',   // human-readable label for the slider
 *           type:    'float',      // 'float' | 'int'
 *           min:     0.0,
 *           max:     1.0,
 *           step:    0.01,
 *           default: 0.5,
 *         },
 *       ],
 *     }
 *
 *  That's it.  No changes needed in app.js or webgl.js.
 *
 * ── Uniform types ────────────────────────────────────────────────────────────
 *
 *  'float' → rendered as a range slider, passed as gl.uniform1f
 *  'int'   → rendered as a range slider with integer steps, passed as gl.uniform1i
 *
 * ── Built-in uniforms (always available, no need to declare here) ─────────────
 *
 *  uniform sampler2D uTexture;    // the uploaded image
 *  uniform vec2      uResolution; // canvas width and height in pixels
 */

export const FILTERS = [
  {
    id:      'passthrough',
    name:    'Passthrough',
    shader:  'shaders/passthrough.glsl',
    uniforms: [],
  },

  {
    id:      'grayscale',
    name:    'Grayscale',
    shader:  'shaders/grayscale.glsl',
    uniforms: [],
  },

  {
    id:      'box',
    name:    'Box Blur',
    shader:  'shaders/box.glsl',
    uniforms: [
      {
        name:    'uKernelSize',
        label:   'Kernel Size',
        type:    'int',
        min:     1,
        max:     20,
        step:    1,
        default: 3,
      },
    ],
  },

  {
    id:      'tent',
    name:    'Tent Blur',
    shader:  'shaders/tent.glsl',
    uniforms: [
      {
        name:    'uKernelSize',
        label:   'Kernel Size',
        type:    'int',
        min:     1,
        max:     20,
        step:    1,
        default: 3,
      },
    ],
  },

  {
    id:      'gaussian',
    name:    'Gaussian Blur',
    shader:  'shaders/gaussian.glsl',
    uniforms: [
      {
        name:    'uKernelSize',
        label:   'Kernel Size',
        type:    'int',
        min:     1,
        max:     20,
        step:    1,
        default: 5,
      },
      {
        name:    'uSigma',
        label:   'Sigma',
        type:    'float',
        min:     0.1,
        max:     10.0,
        step:    0.1,
        default: 2.0,
      },
    ],
  },

  {
    id:      'sobel',
    name:    'Sobel Edge',
    shader:  'shaders/sobel.glsl',
    uniforms: [],
  },

  {
    id:      'prewitt',
    name:    'Prewitt Edge',
    shader:  'shaders/prewitt.glsl',
    uniforms: [],
  },

  {
    id:      'emboss',
    name:    'Emboss',
    shader:  'shaders/emboss.glsl',
    uniforms: [],
  },

  {
    id:      'chromatic',
    name:    'Chromatic Aberration',
    shader:  'shaders/chromatic.glsl',
    uniforms: [
      {
        name:    'uOffset',
        label:   'Offset',
        type:    'float',
        min:     0.0,
        max:     0.05,
        step:    0.001,
        default: 0.01,
      },
    ],
  },

  {
    id:      'crt',
    name:    'CRT',
    shader:  'shaders/crt.glsl',
    uniforms: [
      {
        name:    'uScanlineIntensity',
        label:   'Scanline Intensity',
        type:    'float',
        min:     0.0,
        max:     1.0,
        step:    0.01,
        default: 0.5,
      },
    ],
  },

  {
    id:      'fisheye',
    name:    'Fisheye',
    shader:  'shaders/fisheye.glsl',
    uniforms: [
      {
        name:    'uStrength',
        label:   'Strength',
        type:    'float',
        min:     0.0,
        max:     1.0,
        step:    0.01,
        default: 0.5,
      },
    ],
  },

  {
    id:      'kuwahara',
    name:    'Kuwahara',
    shader:  'shaders/kuwahara.glsl',
    uniforms: [
      {
        name:    'uRadius',
        label:   'Radius',
        type:    'int',
        min:     1,
        max:     10,
        step:    1,
        default: 3,
      },
    ],
  },
];
