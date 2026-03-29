/**
 * box.glsl — Box (mean) blur.
 *
 * Uniforms
 *   uKernelSize (int, 1–20): half-width of the kernel in pixels.
 *     A value of N samples a (2N+1)×(2N+1) neighbourhood.
 */

precision mediump float;

uniform sampler2D uTexture;
uniform vec2 uResolution;
uniform int uKernelSize; // this is r


varying vec2 vTexCoord;

void main() {
    vec2 uv = vTexCoord;
    vec3 total = vec3(0.0);
    int r = uKernelSize;
    float count = float((2*r+1) * (2*r+1));

    for (int dx = -20; dx <= 20; dx++) {
        if (dx < -r || dx > r) continue;
        for (int dy = -20; dy <= 20; dy++) {
            if (dy < -r || dy > r) continue;
            vec2 offset = vec2(float(dx), float(dy)) / uResolution;
            total += texture2D(uTexture, uv + offset).rgb;
        }
    }

  gl_FragColor = vec4(total / count, 1.0);
}
