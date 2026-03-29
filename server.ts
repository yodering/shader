/**
 * server.ts — Development server using Bun.serve().
 *
 * Run with:  bun --hot server.ts
 *            (--hot enables hot module reloading for server-side changes)
 *
 * Bun automatically bundles index.html and all <script type="module"> imports
 * it references, so js/app.js → js/webgl.js → js/filters.js are all handled.
 *
 * Static files (shaders/*.glsl) are served from the /public directory via the
 * catch-all route below — the fetch() calls in app.js work unchanged.
 */

import index from "./index.html";

Bun.serve({
  routes: {
    // Bun's HTML bundler: serves index.html and automatically bundles all
    // JS modules imported from it.  HMR is provided by the development block.
    "/": index,
  },

  // Catch-all for static assets (shaders, any other public files).
  fetch(req) {
    const url = new URL(req.url);

    // Map URL path to a file inside /public.
    // e.g. GET /shaders/box.glsl → ./public/shaders/box.glsl
    const filePath = `./public${url.pathname}`;
    const file = Bun.file(filePath);
    return new Response(file);
  },

  development: {
    hmr: true,
    console: true,
  },
});

console.log("WebGL Filter Playground running at http://localhost:3000");
