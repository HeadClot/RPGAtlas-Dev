/* RPGAtlas — js/build-manifest.mjs
   Single source of truth for the frontend files that the build/export/packaging
   pipelines depend on. Plain ESM, no dependencies, so it is importable from both
   browser ES modules (js/editor/project-io.js) and Node tooling
   (scripts/stage-frontend.mjs, scripts/package-exe.mjs, Vite config, Vitest).

   Keep this list authoritative: the standalone HTML export, the Tauri staging
   step, and the packaged exe all read from here, which removes the
   packaging-drift risk called out in the production roadmap. GPL-3.0-or-later. */

/* Ordered list of sources inlined into a single-file standalone game export.
   Order matters: the CSS is embedded first as a <style>, the classic runtime
   scripts run in sequence to populate globals, and engine.js runs last as a
   module. This mirrors the classic <script> load order in play.html. */
export const STANDALONE_EXPORT_FILES = [
  "css/play.css",
  "js/assets.js",
  "js/sfx.js",
  "js/data.js",
  "js/runtime/messages.js",
  "js/engine.js",
];

/* Top-level paths (files and directories) that make up the complete frontend
   the editor and player need at runtime. Copied verbatim into the Tauri dist by
   scripts/stage-frontend.mjs; also the set Vite must pass through untouched so
   the classic js/ scripts, css/, and runtime-fetched assets under img/ and bin/
   remain available at their current relative URLs in dev and in the build. */
export const FRONTEND_INCLUDE = [
  "index.html",
  "play.html",
  "css",
  "js",
  "img",
  "bin",
];

/* The two HTML entry points Vite builds as multi-page bundles. */
export const HTML_ENTRIES = ["index.html", "play.html"];

/* Directories that Vite must serve/copy through byte-identical (no bundling or
   transforming). Derived from FRONTEND_INCLUDE minus the HTML entries. */
export const PASSTHROUGH_DIRS = FRONTEND_INCLUDE.filter(
  (name) => !HTML_ENTRIES.includes(name),
);
