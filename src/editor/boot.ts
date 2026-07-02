/* RPGAtlas — src/editor/boot.ts
   The editor composition root: loads/creates the project, wires the palette and
   map-canvas events, installs the global keyboard map, and boots the workspace.
   This is the last piece of the old editor.js closure; main.ts imports it.
   Verbatim move from the editor monolith (Phase 1 Stage C, Package 3):
   logic unchanged, closure vars routed through editor-state.ts. rebuildAll,
   setMode, and refreshToolbar are now direct imports/exports rather than the
   editorHooks slots the earlier packages used.
   Copyright (C) 2026 RPGAtlas contributors — GPL-3.0-or-later (see LICENSE). */
/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  Assets, DataDefaults, RA, TILE, editorI18n, editorState as S, editorHooks,
} from "./editor-state";
import { $ } from "./dom";
import { modalRoot } from "./modals";
import { loadStored, saveNow, importProject } from "./persistence";
import { renderMap, renderPalette } from "./map-editor/map-render";
import { undo, redo } from "./map-editor/history";
import { copySelection, startPaste, clearSelection } from "./map-editor/clipboard";
import { setStatus } from "./map-editor/status";
import { rebuildMapList, addMap, deleteMap, openMapGenProps } from "./map-editor/map-list";
import {
  deleteSelectedEvent, openCanvasMenu,
  onCanvasDown, onCanvasMove, onCanvasUp, onCanvasDbl,
} from "./map-editor/painting";
import {
  buildMenubar, buildToolbar, refreshToolbar, runAct,
  setMode, setTool, setLayer, setZoom, zoomStep, cycleMode,
  closeMenus, isMenuOpen,
} from "./workspace";
import { openKeyboardShortcuts } from "./help";

export function rebuildAll() {
  if (!RA.byId(S.proj.maps, S.curMapId)) S.curMapId = S.proj.maps[0].id;
  rebuildMapList();
  renderPalette();
  renderMap();
  refreshToolbar();
  setStatus();
}

async function boot() {
  S.proj = loadStored() || DataDefaults.newProject();
  Assets.registerCustomChars(S.proj.customChars);
  await Promise.all([Assets.loadIconSet(), Assets.loadExternalAssets(S.proj)]);
  S.mapCanvas = $("mapcanvas");
  S.mapCtx = S.mapCanvas.getContext("2d");
  S.palCanvas = $("palette");

  editorI18n.localizeStatic();
  buildMenubar();
  buildToolbar();

  // palette
  S.palCanvas.addEventListener("mousedown", (e: any) => {
    const r = S.palCanvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) / TILE), y = Math.floor((e.clientY - r.top) / TILE);
    const id = y * Assets.PALETTE_COLS + x;
    if (id >= 0 && Assets.tiles[id]) { S.selectedTile = id; renderPalette(); setStatus(); }
  });
  S.palCanvas.addEventListener("mousemove", (e: any) => {
    const r = S.palCanvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) / TILE), y = Math.floor((e.clientY - r.top) / TILE);
    const id = y * Assets.PALETTE_COLS + x;
    S.palCanvas.title = Assets.tiles[id] ? Assets.tiles[id].name : "";
  });

  // map canvas
  S.mapCanvas.addEventListener("mousedown", onCanvasDown);
  S.mapCanvas.addEventListener("mousemove", onCanvasMove);
  window.addEventListener("mouseup", onCanvasUp);
  S.mapCanvas.addEventListener("dblclick", onCanvasDbl);
  S.mapCanvas.addEventListener("contextmenu", (e: any) => {
    e.preventDefault();
    if (S.suppressNextCtxMenu) { S.suppressNextCtxMenu = false; return; }
    if (S.mode === "event") openCanvasMenu(e);
  });
  S.mapCanvas.addEventListener("mouseleave", () => { S.hoverCell = null; S.hoverQuad = 0; renderMap(); });

  // ctrl+wheel zooms around the cursor
  $("mapscroll").addEventListener("wheel", (e: any) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const r = $("mapscroll").getBoundingClientRect();
    zoomStep(e.deltaY < 0 ? 1 : -1, { x: e.clientX - r.left, y: e.clientY - r.top });
  }, { passive: false });

  $("import-file").addEventListener("change", (e: any) => {
    if (e.target.files[0]) importProject(e.target.files[0]);
    e.target.value = "";
  });
  $("map-add").addEventListener("click", addMap);
  $("map-del").addEventListener("click", deleteMap);
  $("map-gen").addEventListener("click", openMapGenProps);

  document.addEventListener("keydown", (e: any) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return;
    if (modalRoot().children.length) return;
    if (e.code === "Escape") {
      if (isMenuOpen()) { closeMenus(); return; }
      if (S.pasteMode || S.selection) { clearSelection(); return; }
      if (S.selectedEvent) { S.selectedEvent = null; renderMap(); refreshToolbar(); }
      return;
    }
    if (e.key === "?" && !e.ctrlKey && !e.metaKey) { e.preventDefault(); openKeyboardShortcuts(); return; }
    // Mode cycle (always available). Tab forward, Shift+Tab back. Skip when Ctrl/Meta held.
    if (e.code === "Tab" && !e.ctrlKey && !e.metaKey) { e.preventDefault(); cycleMode(e.shiftKey ? -1 : 1); return; }

    if (e.ctrlKey || e.metaKey) {
      switch (e.code) {
        case "KeyZ": e.preventDefault(); undo(); break;
        case "KeyY": e.preventDefault(); redo(); break;
        case "KeyX": e.preventDefault(); copySelection(true); break;
        case "KeyC": e.preventDefault(); copySelection(false); break;
        case "KeyV": e.preventDefault(); startPaste(); break;
        case "KeyS": e.preventDefault(); runAct("save"); break;
      }
      return;
    }
    // Application shortcuts — global (any mode). F1/F5 override the browser's Help/Reload.
    switch (e.code) {
      case "F1": e.preventDefault(); runAct("db");        return;
      case "F2": e.preventDefault(); runAct("hdpreview"); return;
      case "F5": e.preventDefault(); runAct("play");      return;
    }
    // Height mode consumes ALL digits for the painted elevation (0–9). Must stay above the layer gate.
    if (S.mode === "height" && /^Digit\d$/.test(e.code)) {
      S.heightVal = Number(e.code.slice(5));
      setStatus();
      return;
    }
    // Tools
    if (S.mode === "map" || S.mode === "height") {
      switch (e.code) {
        case "KeyQ": setTool("pen");    return;
        case "KeyW": setTool("erase");  return;
        case "KeyE": setTool("rect");   return;
        case "KeyR": setTool("circle"); return;
        case "KeyT": setTool("fill");   return;
        case "KeyY": setTool("shadow"); return;
      }
    }
    // Layers
    if (S.mode === "map") {
      switch (e.code) {
        case "Backquote": setLayer("auto");   return;
        case "Digit1":    setLayer("ground"); return;
        case "Digit2":    setLayer("decor");  return;
        case "Digit3":    setLayer("decor2"); return;
        case "Digit4":    setLayer("over");   return;
      }
    }
    switch (e.code) {
      case "Equal": case "NumpadAdd": zoomStep(1); break;
      case "Minus": case "NumpadSubtract": zoomStep(-1); break;
      case "Digit0": case "Numpad0": setZoom(1); break; // reset to 100% (height mode consumes 0 above)
      case "Delete": case "Backspace":
        if (S.mode === "event") deleteSelectedEvent();
        break;
    }
  });

  setTool("pen");
  setLayer("auto");
  setMode("map");
  rebuildAll();
  saveNow();
}

// The "new" action (workspace.ts) and project import (persistence.ts) rebuild
// everything; register our impl in the one remaining editorHooks slot.
editorHooks.rebuildAll = rebuildAll;

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
