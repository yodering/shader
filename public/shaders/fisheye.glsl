/**
 * fisheye.glsl — Fisheye / barrel distortion.
 *
 * Warps the UV coordinates radially so that the image bulges outward from
 * the centre, simulating a wide-angle fisheye lens.
 *
 * Uniforms
 *   uStrength (float, 0–1): 0 = no warp, 1 = maximum fisheye.
 */

precision mediump float;

uniform sampler2D uTexture;
uniform vec2      uResolution;
uniform float     uStrength;

varying vec2 vTexCoord;

void main() {
  vec2 uv = vTexCoord * 2.0 - 1.0;       // [-1, 1] space

  float r = length(uv);                   // distance from center
  float a = atan(uv.y, uv.x);            // angle from center

  // Barrel distortion: push outward based on r³
  r = r + uStrength * r * r * r;

  // Convert back to Cartesian
  uv = vec2(cos(a), sin(a)) * r;

  // Back to [0, 1] space
  uv = uv * 0.5 + 0.5;

  gl_FragColor = texture2D(uTexture, uv);
}
