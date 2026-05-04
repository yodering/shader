/**
 * passthrough.glsl — Identity filter.
 *
 * Samples the texture at the interpolated coordinate and outputs it unchanged.
 * Useful as a baseline and for verifying the pipeline works correctly.
 */

precision mediump float;

// The uploaded image, bound to texture unit 0.
uniform sampler2D uTexture;

// Interpolated texture coordinate from the vertex shader.
varying vec2 vTexCoord;

void main() {
  // texture2D samples the texture at the given UV coordinate and returns
  // a vec4(red, green, blue, alpha), each in the range [0, 1].
  gl_FragColor = texture2D(uTexture, vTexCoord);
}
