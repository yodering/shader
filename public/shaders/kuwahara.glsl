/**
 * kuwahara.glsl — Kuwahara painterly filter.
 *
 * Divides the neighbourhood around each pixel into four quadrants, computes
 * the mean and variance of each, then outputs the mean of the quadrant with
 * the lowest variance.  This produces an oil-painting-like stylisation.
 *
 * Uniforms
 *   uRadius (int, 1–10): kernel half-width per quadrant.
 *
 * TODO: implement your filter logic here.
 * Hint: the four quadrants share the centre row/column.
 *       For each quadrant: compute mean colour and variance of luminance.
 *       Output the mean from the quadrant with the smallest variance.
 */

precision mediump float;

uniform sampler2D uTexture;
uniform vec2      uResolution;
uniform int       uRadius;

varying vec2 vTexCoord;

void main() {
  gl_FragColor = texture2D(uTexture, vTexCoord);
}
