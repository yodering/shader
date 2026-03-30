/**
 * kuwahara.glsl — Kuwahara painterly filter.
 *
 * Divides the neighbourhood around each pixel into four quadrants, computes
 * the mean and variance of each, then outputs the mean of the quadrant with
 * the lowest variance.  This produces an oil-painting-like stylisation.
 *
 * Uniforms
 *   uRadius (int, 1–10): kernel half-width per quadrant.
 */

precision mediump float;

uniform sampler2D uTexture;
uniform vec2      uResolution;
uniform int       uRadius;

varying vec2 vTexCoord;

void main() {
    vec2 texel = 1.0 / uResolution;
    int r = uRadius;

    const int MAX_RADIUS = 10;
    const vec3 luma = vec3(0.2126, 0.7152, 0.0722);

    float minVariance = 1e10;
    vec3 result = vec3(0.0);

    // 4 quadrants: (xSign, ySign) = (-1,-1), (1,-1), (1,1), (-1,1)
    for (int q = 0; q < 4; q++) {
        float xs = (q == 1 || q == 2) ? 1.0 : -1.0;
        float ys = (q == 2 || q == 3) ? 1.0 : -1.0;

        vec3 S1 = vec3(0.0);
        vec3 S2 = vec3(0.0);
        float n = 0.0;

        for (int i = 0; i <= MAX_RADIUS; i++) {
            if (i > r) break;
            for (int j = 0; j <= MAX_RADIUS; j++) {
                if (j > r) break;
                vec2 offset = vec2(float(i) * xs, float(j) * ys) * texel;
                vec3 c = texture2D(uTexture, vTexCoord + offset).rgb;
                S1 += c;
                S2 += c * c;
                n += 1.0;
            }
        }

        vec3 mean = S1 / n;
        vec3 variance = max(S2 / n - mean * mean, vec3(0.0));
        float totalVar = dot(variance, luma);

        if (totalVar < minVariance) {
            minVariance = totalVar;
            result = mean;
        }
    }

    gl_FragColor = vec4(result, 1.0);
}
