/**
 * emboss.glsl — Emboss effect.
 *
 * Creates a raised relief appearance by computing directional differences
 * between neighbouring pixels and biasing the result to mid-grey.
 *
 */

precision mediump float;

uniform sampler2D uTexture;
uniform vec2      uResolution;

varying vec2 vTexCoord;

void main() {
  vec2 texel = 1.0 / uResolution;

  // Sample all 9 neighbors
  float tl = dot(texture2D(uTexture, vTexCoord + vec2(-texel.x, -texel.y)).rgb, vec3(0.299, 0.587, 0.114));
  float t  = dot(texture2D(uTexture, vTexCoord + vec2(   0.0, -texel.y)).rgb, vec3(0.299, 0.587, 0.114));
  float tr = dot(texture2D(uTexture, vTexCoord + vec2( texel.x, -texel.y)).rgb, vec3(0.299, 0.587, 0.114));
  float l  = dot(texture2D(uTexture, vTexCoord + vec2(-texel.x,    0.0)).rgb, vec3(0.299, 0.587, 0.114));
  float c  = dot(texture2D(uTexture, vTexCoord).rgb,                          vec3(0.299, 0.587, 0.114));
  float r  = dot(texture2D(uTexture, vTexCoord + vec2( texel.x,    0.0)).rgb, vec3(0.299, 0.587, 0.114));
  float bl = dot(texture2D(uTexture, vTexCoord + vec2(-texel.x,  texel.y)).rgb, vec3(0.299, 0.587, 0.114));
  float b  = dot(texture2D(uTexture, vTexCoord + vec2(   0.0,  texel.y)).rgb, vec3(0.299, 0.587, 0.114));
  float br = dot(texture2D(uTexture, vTexCoord + vec2( texel.x,  texel.y)).rgb, vec3(0.299, 0.587, 0.114));

  // Apply emboss kernel
  float col = tl * -2.0 + t * -1.0 + tr * 0.0 +
              l  * -1.0 + c  * 1.0 + r  * 1.0 +
              bl *  0.0 + b  * 1.0 + br * 2.0;

  // Add bias and clamp
  col = col + 0.5;

  gl_FragColor = vec4(col, col, col, 1.0);
}
