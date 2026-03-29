/**
 * crt.glsl — CRT monitor simulation.
 *
 * Overlays a scanline pattern and optionally a slight vignette to mimic the
 * appearance of an old cathode-ray tube screen.
 *
 * Uniforms
 *   uScanlineIntensity (float, 0–1): 0 = no effect, 1 = full darkening.
 *
 * TODO: implement your filter logic here.
 * Hint: use  mod(gl_FragCoord.y, 2.0) < 1.0  to identify even/odd scanlines
 *       and darken one set by (1.0 - uScanlineIntensity).
 */

precision mediump float;

uniform sampler2D uTexture;
uniform vec2      uResolution;
uniform float     uScanlineIntensity;

varying vec2 vTexCoord;

void main() {
  vec4 color = texture2D(uTexture, vTexCoord);

  if (mod(gl_FragCoord.y, 2.0) < 1.0) {
    color.rgb *= (1.0 - uScanlineIntensity);
  }

  gl_FragColor = color;
}
