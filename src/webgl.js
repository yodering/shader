/**
 * webgl.js — Isolated WebGL boilerplate.
 *
 * This module handles every low-level WebGL operation so that app.js and
 * filters.js never need to touch gl directly.  All exported functions are
 * pure in the sense that they take explicit arguments rather than relying on
 * module-level mutable state — the one exception is the gl context itself,
 * which is returned by initGL() and threaded through every call.
 */

// ---------------------------------------------------------------------------
// Context initialisation
// ---------------------------------------------------------------------------

/**
 * initGL(canvas)
 *
 * Obtain a WebGL rendering context from the given <canvas> element.
 * We request 'preserveDrawingBuffer: true' so that toDataURL() (used by the
 * download button) captures the last rendered frame instead of a blank image.
 * Without this flag most browsers clear the drawing buffer immediately after
 * compositing, making canvas exports unreliable.
 *
 * Returns: { gl, canvas } or throws on failure.
 */
export function initGL(canvas) {
  const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true })
           || canvas.getContext('experimental-webgl', { preserveDrawingBuffer: true });

  if (!gl) {
    throw new Error('WebGL is not supported in this browser.');
  }

  // Tell WebGL the mapping from clip-space to canvas pixels.
  // Must be called again whenever the canvas is resized.
  gl.viewport(0, 0, canvas.width, canvas.height);

  return gl;
}

// ---------------------------------------------------------------------------
// Shader compilation
// ---------------------------------------------------------------------------

/**
 * compileShader(gl, type, source)
 *
 * Compiles a single shader stage (vertex or fragment).
 *
 * WebGL shaders are small GPU programs written in GLSL.  Before they can run
 * they must be compiled by the driver.  Compilation errors are retrieved via
 * gl.getShaderInfoLog() and surfaced as a thrown Error so the UI can show them.
 *
 * @param {WebGLRenderingContext} gl
 * @param {GLenum} type  — gl.VERTEX_SHADER or gl.FRAGMENT_SHADER
 * @param {string} source — raw GLSL source text
 * @returns {WebGLShader}
 */
export function compileShader(gl, type, source) {
  const shader = gl.createShader(type);

  // Upload the GLSL source to the GPU driver.
  gl.shaderSource(shader, source);

  // Ask the driver to compile the source.
  gl.compileShader(shader);

  // Check for compile errors.
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    const typeName = type === gl.VERTEX_SHADER ? 'vertex' : 'fragment';
    throw new Error(`GLSL compile error (${typeName} shader):\n${info}`);
  }

  return shader;
}

// ---------------------------------------------------------------------------
// Program linking
// ---------------------------------------------------------------------------

/**
 * linkProgram(gl, vertexShader, fragmentShader)
 *
 * Links a compiled vertex shader and fragment shader together into a
 * "program" — the unit that runs on the GPU.
 *
 * Linking resolves cross-shader references: e.g. the fragment shader's
 * 'varying' inputs must match outputs declared in the vertex shader.
 * Link errors are surfaced the same way as compile errors.
 *
 * @returns {WebGLProgram}
 */
export function linkProgram(gl, vertexShader, fragmentShader) {
  const program = gl.createProgram();

  // Attach both shader stages to the program object.
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);

  // Perform the link step.
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`GLSL link error:\n${info}`);
  }

  // Individual shader objects are no longer needed once the program is linked.
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  return program;
}

// ---------------------------------------------------------------------------
// Geometry — the fullscreen quad
// ---------------------------------------------------------------------------

/**
 * createQuad(gl)
 *
 * Creates a vertex buffer containing two triangles that together cover the
 * entire clip-space square (x: -1..1, y: -1..1).  This is the standard
 * technique for full-screen image processing in WebGL.
 *
 * Each vertex stores: [ x, y, u, v ]
 *   - x, y: clip-space position
 *   - u, v: texture coordinate (0,0 = top-left, 1,1 = bottom-right)
 *
 * We pack position and UV into one interleaved buffer to minimise GPU state
 * changes.
 *
 * @returns {WebGLBuffer}
 */
export function createQuad(gl) {
  // Two triangles, specified as a triangle strip:
  //  (-1, 1) ---- (1, 1)
  //     |    \       |
  //  (-1,-1) ---- (1,-1)
  //
  // Format: [x, y, u, v]
  const vertices = new Float32Array([
    -1,  1,   0, 1,   // top-left
    -1, -1,   0, 0,   // bottom-left
     1,  1,   1, 1,   // top-right
     1, -1,   1, 0,   // bottom-right
  ]);

  const buffer = gl.createBuffer();

  // ARRAY_BUFFER is the binding point for vertex data.
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

  // Upload the Float32Array to GPU memory.
  // STATIC_DRAW hints to the driver that this data won't change.
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

  return buffer;
}

// ---------------------------------------------------------------------------
// Attribute binding
// ---------------------------------------------------------------------------

/**
 * bindQuadAttributes(gl, program, quadBuffer)
 *
 * Connects the vertex buffer data to the attribute variables declared in the
 * vertex shader (aPosition and aTexCoord).
 *
 * A vertex attribute is how the vertex shader reads per-vertex data from a
 * buffer.  We describe the layout (stride, offset, component count) so the
 * driver knows how to stride through the interleaved array.
 */
export function bindQuadAttributes(gl, program, quadBuffer) {
  // Bind the buffer that holds our quad vertices.
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);

  // Each vertex is 4 floats × 4 bytes = 16 bytes.
  const STRIDE = 16;

  // --- aPosition (x, y) ---
  const posLoc = gl.getAttribLocation(program, 'aPosition');
  if (posLoc !== -1) {
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(
      posLoc,
      2,          // 2 components (x, y)
      gl.FLOAT,
      false,      // don't normalise
      STRIDE,
      0           // byte offset within each vertex
    );
  }

  // --- aTexCoord (u, v) ---
  const uvLoc = gl.getAttribLocation(program, 'aTexCoord');
  if (uvLoc !== -1) {
    gl.enableVertexAttribArray(uvLoc);
    gl.vertexAttribPointer(
      uvLoc,
      2,          // 2 components (u, v)
      gl.FLOAT,
      false,
      STRIDE,
      8           // 8-byte offset: skip the x,y floats (2 × 4 bytes)
    );
  }
}

// ---------------------------------------------------------------------------
// Texture upload
// ---------------------------------------------------------------------------

/**
 * uploadTexture(gl, image)
 *
 * Uploads an HTMLImageElement (or ImageBitmap, etc.) to GPU memory as a
 * 2D texture bound to texture unit 0.
 *
 * Key decisions:
 * - TEXTURE_WRAP: CLAMP_TO_EDGE avoids artifacts at borders when sampling
 *   outside [0,1] UV range (common with non-power-of-two images).
 * - TEXTURE_MIN/MAG_FILTER: LINEAR gives smooth results for most photo filters.
 * - We call gl.pixelStorei(UNPACK_FLIP_Y_WEBGL, true) because HTML images
 *   have their origin at the top-left while WebGL textures expect bottom-left.
 *
 * @returns {WebGLTexture}
 */
export function uploadTexture(gl, image) {
  // If a texture was previously allocated we could reuse it, but for
  // simplicity we always create a fresh one here.
  const texture = gl.createTexture();

  // Activate texture unit 0 and bind our texture to it.
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);

  // Flip Y so UV (0,0) maps to the top-left of the image as expected.
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  // Upload pixel data to the GPU.
  // args: target, mipmap level, internal format, format, type, source
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

  // Wrapping mode — clamp rather than repeat at edges.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  // Filtering — LINEAR for smooth magnification and minification.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  return texture;
}

// ---------------------------------------------------------------------------
// Uniform setters
// ---------------------------------------------------------------------------

/**
 * setUniforms(gl, program, uniforms)
 *
 * Sets all uniform values for the currently active program.
 *
 * Uniforms are GPU-side "constant" variables that stay the same across all
 * vertices/fragments in a single draw call.  They are used to pass slider
 * values, textures, resolution, etc. into shaders.
 *
 * @param {WebGLRenderingContext} gl
 * @param {WebGLProgram} program
 * @param {Object} uniforms — plain object: { uniformName: value, ... }
 *   Values may be numbers (float/int), arrays [x,y] / [x,y,z] / [x,y,z,w],
 *   or { type: 'int'|'float'|'vec2'|..., value } descriptors.
 */
export function setUniforms(gl, program, uniforms) {
  for (const [name, descriptor] of Object.entries(uniforms)) {
    const loc = gl.getUniformLocation(program, name);
    if (loc === null) continue; // uniform not used in this shader — skip silently

    // Determine type and raw value.
    let type, val;
    if (descriptor !== null && typeof descriptor === 'object' && 'type' in descriptor) {
      type = descriptor.type;
      val  = descriptor.value;
    } else {
      // Plain number: infer float.
      type = 'float';
      val  = descriptor;
    }

    // Dispatch to the correct gl.uniform* call.
    switch (type) {
      case 'int':
        gl.uniform1i(loc, Math.round(val));
        break;
      case 'float':
        gl.uniform1f(loc, val);
        break;
      case 'vec2':
        gl.uniform2fv(loc, val);
        break;
      case 'vec3':
        gl.uniform3fv(loc, val);
        break;
      case 'vec4':
        gl.uniform4fv(loc, val);
        break;
      case 'sampler2D':
        // val is the texture unit index (integer).
        gl.uniform1i(loc, val);
        break;
      default:
        console.warn(`setUniforms: unknown type '${type}' for uniform '${name}'`);
    }
  }
}

// ---------------------------------------------------------------------------
// Draw
// ---------------------------------------------------------------------------

/**
 * drawQuad(gl)
 *
 * Issues the actual draw call.  By this point the program is active, the
 * texture is bound, uniforms are set, and attributes are configured — the
 * draw call is therefore the final trigger that sends work to the GPU.
 *
 * TRIANGLE_STRIP with 4 vertices produces 2 triangles sharing an edge,
 * which together cover the quad.
 */
export function drawQuad(gl) {
  // Clear to black before drawing (harmless for full-screen quads but good
  // practice so residual pixels from earlier frames don't bleed through).
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}
