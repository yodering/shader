precision mediump float;

uniform sampler2D uTexture;
uniform vec2 uResolution;
uniform int uRadius;

varying vec2 vTexCoord;

void main() {
    vec2 texel = 1.0 / uResolution;
    float scale = max(float(uRadius), 1.0) / 3.0;

    float minVariance = 1e10;
    vec3 result = vec3(0.0);

    for (int region = 0; region < 9; region++) {
        int xMin = -1;
        int xMax = 1;
        int yMin = -1;
        int yMax = 1;

        if (region == 1) {
            xMin = -2; xMax = 0; yMin = -2; yMax = 0;
        } else if (region == 2) {
            xMin = -1; xMax = 1; yMin = -2; yMax = 0;
        } else if (region == 3) {
            xMin = 0; xMax = 2; yMin = -2; yMax = 0;
        } else if (region == 4) {
            xMin = -2; xMax = 0; yMin = -1; yMax = 1;
        } else if (region == 5) {
            xMin = 0; xMax = 2; yMin = -1; yMax = 1;
        } else if (region == 6) {
            xMin = -2; xMax = 0; yMin = 0; yMax = 2;
        } else if (region == 7) {
            xMin = -1; xMax = 1; yMin = 0; yMax = 2;
        } else if (region == 8) {
            xMin = 0; xMax = 2; yMin = 0; yMax = 2;
        }

        vec3 S1 = vec3(0.0);
        vec3 S2 = vec3(0.0);
        float n = 0.0;

        for (int y = -2; y <= 2; y++) {
            if (y < yMin || y > yMax) continue;
            for (int x = -2; x <= 2; x++) {
                if (x < xMin || x > xMax) continue;

                vec2 offset = vec2(float(x), float(y)) * texel * scale;
                vec3 c = texture2D(uTexture, vTexCoord + offset).rgb;
                S1 += c;
                S2 += c * c;
                n += 1.0;
            }
        }

        vec3 mean = S1 / n;
        vec3 variance = max(S2 / n - mean * mean, vec3(0.0));
        float totalVariance = variance.r + variance.g + variance.b;

        if (region != 0 && totalVariance >= minVariance) continue;

        minVariance = totalVariance;
        result = mean;
    }

    gl_FragColor = vec4(result, 1.0);
}
