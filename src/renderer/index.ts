/* RPGAtlas — src/renderer/index.ts
   The RendererAdapter seam's renderer-selection point (Phase 2 Stage A).
   Default: the three.js HD-2D renderer (three-renderer.ts). Fallback: the
   classic raw-WebGL2 script (js/renderer.js, still loaded by both HTML pages
   and the standalone export) via ?renderer=classic or
   localStorage.rpgatlas_renderer = "classic" — the roadmap's risk-register
   escape hatch until parity is signed off at phase exit, then retired.

   Hosts (engine render-glue/map-runtime, editor hd-preview) import Renderer
   from HERE and stop reaching for the window.Renderer / GLRender globals.
   Reading window.Renderer below is this module's own sanctioned bridge to the
   classic script — mirroring src/shared/deps.ts — not a pattern to copy.
   Copyright (C) 2026 RPGAtlas contributors — GPL-3.0-or-later (see LICENSE). */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { createThreeRenderer } from "./three-renderer.js";

function chosenBackend(): string {
  try {
    const q = new URLSearchParams(window.location.search).get("renderer");
    if (q) return q;
    return window.localStorage.getItem("rpgatlas_renderer") || "three";
  } catch {
    return "three"; // no DOM/storage (sandboxed export preview) — default
  }
}

const classic = (window as any).Renderer || (window as any).GLRender || null;

/** The process-wide HD-2D renderer implementing the classic surface
 *  (available/setMap/renderFrame/isLost) — see docs/phase-2-spec.md. */
export const Renderer: any =
  chosenBackend() === "classic" && classic ? classic : createThreeRenderer();

/** Which backend is live — exposed for diagnostics/tests. */
export const rendererBackend: string =
  Renderer === classic ? "classic" : "three";
