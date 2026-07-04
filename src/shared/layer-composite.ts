/* RPGAtlas — src/shared/layer-composite.ts
   The one shared "composite a map's generalized layer stack into the two
   engine buffers" routine (Phase 8 Stage B).

   The engine (map-runtime.ts prerenderMap) and the live HD-2D viewport
   (hd-viewport.ts buildBuffers) both fold a map into a lower buffer (drawn
   under characters) and an upper/overhead buffer. Classic maps run their
   verbatim four-array loops (byte-identical, golden-proof). When map.layersAdv
   is present those callers hand off to composeAdvBuffers here, which walks the
   flattened layer-view stack: "below"-slot entries composite into the lower
   buffer, "above"-slot into the upper, each honoring opacity (globalAlpha),
   blend (globalCompositeOperation) and tint. Baking blend into the 2D buffer
   means the HD-2D renderer, which consumes the buffers as textures, gets the
   same composite for free.
   Copyright (C) 2026 RPGAtlas contributors — GPL-3.0-or-later (see LICENSE). */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { drawLayerCell } from "./autotile-draw";
import { layerView, entryArray, BLEND_COMPOSITE } from "./layer-view";

type DrawTile = (g: any, id: number, dx: number, dy: number) => void;

/** Draw every cell of one layer array into `g` at TILE size. When `tint` is a
 *  CSS color it is multiplied over the layer's own pixels (via an offscreen so
 *  the multiply is confined to painted cells, not the whole map rect). The
 *  caller sets globalAlpha / globalCompositeOperation for opacity and blend. */
export function drawEntryTiles(
  g: any, arr: number[], m: any, drawTile: DrawTile, TILE: number, tint?: string,
): void {
  const paint = (dst: any) => {
    for (let y = 0; y < m.height; y++) {
      for (let x = 0; x < m.width; x++) {
        drawLayerCell(dst, arr, m.width, m.height, x, y, x * TILE, y * TILE, TILE, drawTile);
      }
    }
  };
  if (!tint) { paint(g); return; }
  const tmp = document.createElement("canvas");
  tmp.width = m.width * TILE;
  tmp.height = m.height * TILE;
  const tg = tmp.getContext("2d") as any;
  paint(tg);
  tg.globalCompositeOperation = "multiply";
  tg.fillStyle = tint;
  tg.fillRect(0, 0, tmp.width, tmp.height);
  tg.globalCompositeOperation = "destination-in"; // clip the tint back to painted pixels
  paint(tg);
  tg.globalCompositeOperation = "source-over";
  g.drawImage(tmp, 0, 0);
}

/** Composite a layersAdv map into the engine's two buffers. `lg`/`ug` are the
 *  lower and upper (overhead) buffer contexts, already background-filled by the
 *  caller. Shadows stay the caller's job (drawn into `lg` after this, matching
 *  the classic "shadows under the overhead layer" position). */
export function composeAdvBuffers(
  lg: any, ug: any, m: any, drawTile: DrawTile, TILE: number,
): void {
  for (const e of layerView(m)) {
    if (!e.visible) continue;
    const arr = entryArray(m, e);
    if (!arr) continue;
    const g = e.slot === "above" ? ug : lg;
    g.globalAlpha = e.opacity;
    g.globalCompositeOperation = BLEND_COMPOSITE[e.blend];
    drawEntryTiles(g, arr, m, drawTile, TILE, e.tint);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }
}
