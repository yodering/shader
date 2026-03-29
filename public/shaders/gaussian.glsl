/**
 * gaussian.glsl — Gaussian blur.
 *
 * Uniforms
 *   uKernelSize (int, 1–20): half-width in pixels.
 *   uSigma      (float):     standard deviation of the Gaussian.
 */

 precision mediump float;

 uniform sampler2D uTexture;
 uniform vec2 uResolution;
 uniform int uKernelSize; // this is r
 uniform float uSigma;


 varying vec2 vTexCoord;

 void main() {
     vec2 uv = vTexCoord;
     vec3 total = vec3(0.0);
     int r = uKernelSize;
     float totalWeight = 0.0;

     for (int dx = -20; dx <= 20; dx++) {
         if (dx < -r || dx > r) continue;
         for (int dy = -20; dy <= 20; dy++) {
             if (dy < -r || dy > r) continue;
             float weight = exp(-((float(dx) * float(dx)) + (float(dy) * float(dy))) / (2.0 * uSigma * uSigma));
             vec2 offset = vec2(float(dx), float(dy)) / uResolution;
             total += texture2D(uTexture, uv + offset).rgb * weight;
             totalWeight += weight;
         }
     }

   gl_FragColor = vec4(total / totalWeight, 1.0);
 }
