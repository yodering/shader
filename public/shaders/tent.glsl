/**
 * tent.glsl — Tent (triangular / bilinear) blur.
 *
 * Uniforms
 *   uKernelSize (int, 1–20): half-width in pixels.
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
     float totalWeight = 0.0;

     for (int dx = -20; dx <= 20; dx++) {
         if (dx < -r || dx > r) continue;
         for (int dy = -20; dy <= 20; dy++) {
             if (dy < -r || dy > r) continue;
             float weight = (1.0 - abs(float(dx)) / float(r)) * (1.0 - abs(float(dy)) / float(r));
             vec2 offset = vec2(float(dx), float(dy)) / uResolution;
             total += texture2D(uTexture, uv + offset).rgb * weight;
             totalWeight += weight;
         }
     }

   gl_FragColor = vec4(total / totalWeight, 1.0);
 }
