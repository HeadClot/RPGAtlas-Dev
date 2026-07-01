/* RPGAtlas — vite.config.mjs
   Multi-page Vite setup for the zero-build classic-script frontend.

   HARD CONSTRAINT: every file under js/ must stay a byte-identical classic
   script served at the same relative URL in dev AND present in the build output
   — never bundled, transformed, or reformatted. index.html loads js/editor.js
   as a module and play.html loads js/engine.js; css/, img/, and bin/ must also
   remain available at their current relative paths, because project-io.js
   fetches "css/play.css", "bin/RPGAtlasLauncher.exe", and
   "img/system/icon_set.png" at runtime.

   Vite's normal HTML pipeline would bundle the module scripts, inline/hash the
   CSS <link>, and fingerprint the favicon — all of which break the
   byte-identical requirement. So we deliberately bypass Rollup's HTML crawl and
   treat the entire frontend as passthrough: in dev, Vite's server already serves
   every file from the project root at its real URL; for the build, a tiny plugin
   copies index.html, play.html, and the js/css/img/bin directories verbatim into
   dist/. The two HTML pages remain the entry points (served at "/" and
   "/play.html"); they are simply emitted unmodified rather than bundled.

   GPL-3.0-or-later. */

import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FRONTEND_INCLUDE } from "./js/build-manifest.mjs";

const root = dirname(fileURLToPath(import.meta.url));

// Rollup requires at least one input; we give it a virtual no-op entry so the
// build runs, then discard whatever it emitted and copy the real frontend.
const VIRTUAL_ENTRY = "\0rpgatlas-noop-entry";

/* Emit the frontend into dist/ exactly as it is on disk (no bundling). */
function passthroughFrontend() {
  const outDir = join(root, "dist");
  return {
    name: "rpgatlas-passthrough-frontend",
    apply: "build",
    resolveId(id) {
      if (id === VIRTUAL_ENTRY) return VIRTUAL_ENTRY;
      return null;
    },
    load(id) {
      if (id === VIRTUAL_ENTRY) return "export default null;";
      return null;
    },
    // Runs after Rollup has written its (throwaway) output; wipe dist and copy
    // the real frontend verbatim so nothing is bundled or fingerprinted.
    writeBundle() {
      rmSync(outDir, { recursive: true, force: true });
      mkdirSync(outDir, { recursive: true });
      for (const name of FRONTEND_INCLUDE) {
        const src = join(root, name);
        const dest = join(outDir, name);
        mkdirSync(dirname(dest), { recursive: true });
        cpSync(src, dest, { recursive: true });
      }
    },
  };
}

export default {
  root,
  base: "./",
  // The passthrough plugin owns all static files; no public/ dir.
  publicDir: false,
  appType: "mpa",
  plugins: [passthroughFrontend()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // No Rollup input: we intentionally do NOT feed the HTML pages through the
    // bundler (that would bundle js/editor.js and js/engine.js). The passthrough
    // plugin produces the entire output.
    rollupOptions: {
      input: VIRTUAL_ENTRY,
    },
  },
};
