/**
 * chromatic.glsl — Chromatic aberration.
 *
 * Simulates lens colour fringing by sampling the red, green, and blue channels
 * at slightly different UV coordinates.
 *
 * Uniforms
 *   uOffset (float, 0–0.05): displacement amount in UV space.
 */

precision mediump float;

uniform sampler2D uTexture;
uniform vec2      uResolution;
uniform float     uOffset;

varying vec2 vTexCoord;

void main() {
  vec2 center = vec2(0.5, 0.5);
  vec2 dir = vTexCoord - center;

  float r = texture2D(uTexture, vTexCoord + dir * uOffset).r;
  float g = texture2D(uTexture, vTexCoord).g;
  float b = texture2D(uTexture, vTexCoord - dir * uOffset).b;

  gl_FragColor = vec4(r, g, b, 1.0);
}
