/**
 * vertex.glsl — Standard passthrough vertex shader.
 *
 * Runs once per vertex of the fullscreen quad (4 times per draw call).
 * Its job is to:
 *  1. Forward the clip-space position directly as gl_Position.
 *  2. Pass the texture coordinate through to the fragment shader as a varying.
 *
 * "varying" variables are interpolated by the GPU across the surface of each
 * triangle, so every fragment receives a smoothly blended value rather than
 * a raw per-vertex value.  For texture coordinates this gives us the correct
 * UV at every pixel without any extra work.
 */

// Per-vertex inputs coming from the vertex buffer (see bindQuadAttributes).
attribute vec2 aPosition;   // clip-space position: x in [-1,1], y in [-1,1]
attribute vec2 aTexCoord;   // texture UV:          u in [0,1],  v in [0,1]

// Output to the fragment shader.
varying vec2 vTexCoord;

void main() {
  // Pass the UV through unchanged.
  vTexCoord = aTexCoord;

  // gl_Position is a built-in output — the clip-space position of this vertex.
  // The z=0, w=1 make it a standard 2-D point with no depth or perspective.
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
