/* RPGAtlas — src/editor/map-editor/history.ts
   Undo / redo (full map snapshots: tiles, shadows, passability, events).
   Verbatim move from the editor monolith (Phase 1 Stage C, Package 1):
   logic unchanged, closure vars routed through editor-state.ts; refreshToolbar
   is imported directly from workspace.ts (function-only cycle — workspace binds
   undo/redo to actions; safe).
   Copyright (C) 2026 RPGAtlas contributors - GPL-3.0-or-later (see LICENSE). */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { RA, editorState as S } from "../editor-state";
import { touch } from "../persistence";
import { renderMap } from "./map-render";
import { heightsOf } from "./painting";
import { rebuildMapList } from "./map-list";
import { flashStatus } from "./status";
import { refreshToolbar } from "../workspace";

  // ---- undo / redo (full map snapshots: tiles, shadows, passability, events) ----
  export function snapshotOf(mapId: any) {
    const m = RA.byId(S.proj.maps, mapId);
    return { mapId, layers: RA.clone(m.layers), shadows: m.shadows.slice(), passOv: m.passOv.slice(), heights: heightsOf(m).slice(), events: RA.clone(m.events) };
  }
  export function applySnapshot(s: any) {
    const m = RA.byId(S.proj.maps, s.mapId);
    if (!m) return;
    m.layers = s.layers; m.shadows = s.shadows; m.passOv = s.passOv; m.heights = s.heights; m.events = s.events;
    if (S.curMapId !== s.mapId) { S.curMapId = s.mapId; rebuildMapList(); }
    S.selectedEvent = null;
    touch(); renderMap(); refreshToolbar();
  }
  export function pushUndo() {
    S.undoStack.push(snapshotOf(S.curMapId));
    if (S.undoStack.length > 60) S.undoStack.shift();
    S.redoStack.length = 0;
    refreshToolbar();
  }
  export function undo() {
    const u = S.undoStack.pop();
    if (!u) { flashStatus("Nothing to undo"); return; }
    S.redoStack.push(snapshotOf(u.mapId));
    applySnapshot(u);
  }
  export function redo() {
    const r = S.redoStack.pop();
    if (!r) { flashStatus("Nothing to redo"); return; }
    S.undoStack.push(snapshotOf(r.mapId));
    applySnapshot(r);
  }
