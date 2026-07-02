/* RPGAtlas — src/engine/main.ts
   Player runtime entry point. Vite serves this natively in dev (with HMR) and
   bundles it through the HTML pipeline for `vite build`; the same source is
   bundled to a single-file IIFE (player-bundle.js) for the standalone export.

   Stage A of the Phase 1 refactor keeps engine.js verbatim (moved from
   js/engine.js to src/engine/engine.js): this entry only side-effect-imports
   it, proving the module build pipeline before any code is split out. The
   monolith remains a classic-style IIFE that reads window.RPGAtlasDeps and the
   classic-script factory globals (createMessageSystem, createInputSystem,
   window.RPGAtlasQuests, window.RPGAtlasJournalView) populated by the other
   <script> tags loaded before it in play.html / inlined in the export.
   GPL-3.0-or-later (see LICENSE). */

// Side-effect import: engine.js runs its boot IIFE on evaluation.
import "./engine.js";
