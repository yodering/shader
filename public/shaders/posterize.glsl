/**
 * posterize.glsl — Quantize each color channel into a fixed number of steps.
 *
 * Uniforms
 *   uLevels (int, 2–16): number of tonal steps per channel.
 */

precision mediump float;

uniform sampler2D uTexture;
uniform int uLevels;

varying vec2 vTexCoord;

void main() {
    vec4 color = texture2D(uTexture, vTexCoord);
    float levels = max(float(uLevels), 2.0);
    vec3 posterized = floor(color.rgb * (levels - 1.0) + 0.5) / (levels - 1.0);

    gl_FragColor = vec4(posterized, color.a);
}
