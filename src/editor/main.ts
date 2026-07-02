/* RPGAtlas — src/editor/main.ts
   Editor entry point. Vite serves this natively in dev (with HMR) and bundles
   it through the HTML pipeline for `vite build`.

   Stage A of the Phase 1 refactor keeps editor.js verbatim (moved from
   js/editor.js to src/editor/editor.js): this entry only side-effect-imports
   it, proving the module build pipeline before any code is split out. The
   monolith is already an ES module that imports the classic js/editor/*.js and
   js/patch-notes.js helpers (which stay in place this phase) and reads
   window.RPGAtlasDeps populated by the classic <script> tags in index.html.
   GPL-3.0-or-later (see LICENSE). */

// Side-effect import: editor.js runs its boot IIFE on evaluation.
import "./editor.js";
