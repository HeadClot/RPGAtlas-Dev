/* RPGAtlas — src/shared/autotile-registry.ts
   Decoded-autotile registry + on-demand blob assembly (Phase 3 Stage D).

   Autotile groups are project data (proj.autotiles); a group's *source* is an
   RPG-Maker A2 block (2x3 tiles = 4x6 minitiles). Map layers store a single
   reserved tile id per group — `AUTOTILE_BASE + group.id` — so painting, fill,
   copy/paste and the save format all treat an autotile like any other tile id;
   the blob shape is resolved at draw time from the neighbourhood.

   This module is the runtime side: a process-wide registry mapping that reserved
   tile id to its decoded source block, plus a per-(mask) assembled 48x48 cache.
   It is DOM-coupled (canvas) on purpose — the shape math it calls lives in the
   pure, unit-tested autotile.ts. Both the editor and the engine populate the
   registry from the loaded project (see src/editor/autotile-store.ts and the
   engine map load) and read it through the shared draw helper (autotile-draw.ts).
   Copyright (C) 2026 RPGAtlas contributors — GPL-3.0-or-later (see LICENSE). */

import { cornerSources } from "./autotile";
import { TILE_ID_MASK } from "./tile-flags";

/** Reserved tile-id base for autotile groups. Far above any real/imported tile
 *  index, so a plain `Assets.drawTile` on an un-intercepted path is a harmless
 *  no-op (its guard rejects ids past the tiles array) rather than a mis-draw.
 *  AUTOTILE_BASE (1,000,000) sits far below the transform-flag bits (1<<28),
 *  so the two id spaces never collide. */
export const AUTOTILE_BASE = 1_000_000;

/** True when `id` is an autotile reserved id. Masks the Stage-E transform-flag
 *  bits off first so a flag-bearing value can never be mis-classified (flags are
 *  v1-scoped to plain tiles, but masking here makes every call site flag-safe by
 *  construction — the audit's belt-and-braces). A clean id masks to itself, so
 *  the classic path is unchanged. */
export function isAutotileId(id: unknown): boolean {
  return typeof id === "number" && (id & TILE_ID_MASK) >= AUTOTILE_BASE;
}
export function tileIdOf(groupId: number): number { return AUTOTILE_BASE + groupId; }
/** Group id from a reserved tile id. Masks transform-flag bits first. */
export function groupIdOf(tileId: number): number { return (tileId & TILE_ID_MASK) - AUTOTILE_BASE; }

interface Entry { block: HTMLCanvasElement; cache: Map<number, HTMLCanvasElement>; }
const registry = new Map<number, Entry>();

/** Register (or replace) an autotile's decoded source block. `block` is the
 *  full A2 source at native resolution (any size that is 4 minitiles wide by 6
 *  tall; RM sheets are 96x144). Replacing clears the assembled cache. */
export function registerAutotile(tileId: number, block: HTMLCanvasElement): void {
  registry.set(tileId, { block, cache: new Map() });
}
export function hasAutotile(tileId: number): boolean { return registry.has(tileId); }
export function unregisterAutotile(tileId: number): void { registry.delete(tileId); }
export function clearAutotiles(): void { registry.clear(); }

/**
 * Assemble (and cache) the 48x48 blob for one neighbour mask. Returns null when
 * the id is not (yet) registered — callers skip the cell and a later render pass
 * picks it up once the source image has decoded.
 */
export function autotileCanvas(tileId: number, mask: number, TILE: number): HTMLCanvasElement | null {
  const e = registry.get(tileId);
  if (!e) return null;
  const key = mask * 256 + (TILE | 0);
  const cached = e.cache.get(key);
  if (cached) return cached;

  const c = document.createElement("canvas");
  c.width = TILE; c.height = TILE;
  const g = c.getContext("2d")!;
  const sw = e.block.width / 4;   // source minitile size (24 for an RM sheet)
  const sh = e.block.height / 6;
  const d = TILE / 2;             // destination minitile size
  const corners = cornerSources(mask);
  const dest: Array<[number, number]> = [[0, 0], [d, 0], [0, d], [d, d]];
  for (let i = 0; i < 4; i++) {
    const m = corners[i];
    g.drawImage(e.block, m.cx * sw, m.cy * sh, sw, sh, dest[i][0], dest[i][1], d, d);
  }
  e.cache.set(key, c);
  return c;
}
