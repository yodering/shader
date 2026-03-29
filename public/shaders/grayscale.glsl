/**
 * grayscale.glsl — Convert the image to grayscale.
 */

precision mediump float;

uniform sampler2D uTexture;
uniform vec2 uResolution;

varying vec2 vTexCoord;

void main() {
    vec2 uv = vTexCoord;
    vec4 color = texture2D(uTexture, uv);
    float luma = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));

  gl_FragColor = vec4(luma, luma, luma, 1.0);
}
