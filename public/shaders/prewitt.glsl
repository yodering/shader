/**
 * prewitt.glsl — Prewitt edge detection.
 *
 * Computes horizontal (Gx) and vertical (Gy) gradient magnitudes using the
 * 3×3 Prewitt operator, then outputs sqrt(Gx²+Gy²).
 *
 *   Gx = [[-1,0,1],[-1,0,1],[-1,0,1]]
 *   Gy = [[-1,-1,-1],[0,0,0],[1,1,1]]
 */

precision mediump float;

uniform sampler2D uTexture;
uniform vec2 uResolution;

varying vec2 vTexCoord;

vec2 offset(int dx, int dy) {
    return vec2(float(dx), float(dy)) / uResolution;
}

void main() {
    vec2 uv = vTexCoord;

    float gx = 0.0;
    gx += texture2D(uTexture, uv + offset(-1,-1)).r * -1.0;
    gx += texture2D(uTexture, uv + offset( 1,-1)).r *  1.0;

    gx += texture2D(uTexture, uv + offset(-1, 0)).r * -1.0;
    gx += texture2D(uTexture, uv + offset( 1, 0)).r *  1.0;

    gx += texture2D(uTexture, uv + offset(-1, 1)).r * -1.0;
    gx += texture2D(uTexture, uv + offset( 1, 1)).r *  1.0;

    float gy = 0.0;
    gy += texture2D(uTexture, uv + offset(-1,-1)).r * -1.0;
    gy += texture2D(uTexture, uv + offset( 0,-1)).r * -1.0;
    gy += texture2D(uTexture, uv + offset( 1,-1)).r * -1.0;

    gy += texture2D(uTexture, uv + offset(-1, 1)).r *  1.0;
    gy += texture2D(uTexture, uv + offset( 0, 1)).r *  1.0;
    gy += texture2D(uTexture, uv + offset( 1, 1)).r *  1.0;

    float g = sqrt(gx*gx + gy*gy);

    gl_FragColor = vec4(g, g, g, 1.0);
}
