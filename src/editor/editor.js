/* RPGAtlas — editor.js
   Map editor, event editor, database editor.
   Copyright (C) 2026 RPGAtlas contributors — GPL-3.0-or-later (see LICENSE). */
"use strict";

import * as host from "../../js/editor/host.js";
import { PATCH_NOTES } from "../../js/patch-notes.js?v=4";
import {
  Assets, AtlasBuiltins, DataDefaults, GLRender, Music, RA, Sfx,
  editorI18n,
  TILE, LAYER_ORDER, LAYER_LABELS, TOOL_LABELS, ZOOMS,
  editorState as S,
  editorHooks,
  curMap,
} from "./editor-state";
import {
  $, h, esc, tIn, nIn, sel, chk, rangeIn, field, row,
  dbOpts, switchOpts, varOpts, cmpOpts, charsetOpts,
  DIR_OPTS, SE_NAMES, MUSIC_OPTS,
  elementSelOpts, skillTypeSelOpts, typeSelOpts, stringSelOpts,
} from "./dom";
import { modalRoot, modal, confirmBox, closePopupMenu, showPopupMenu } from "./modals";
import {
  touch, saveNow, loadStored, desktopSave, exportProject,
  openStandaloneExport, importProject,
} from "./persistence";
import { renderMap, renderPalette, effectivePass, normRect } from "./map-editor/map-render";
import { pushUndo, undo, redo, snapshotOf, applySnapshot } from "./map-editor/history";
import {
  eventAt, heightsOf, newEventAt, deleteSelectedEvent, openCanvasMenu,
  onCanvasDown, onCanvasMove, onCanvasUp, onCanvasDbl,
  cellFromMouse, topLayerAt, getCell,
} from "./map-editor/painting";
import { canCopy, copySelection, startPaste, clearSelection } from "./map-editor/clipboard";
import { setStatus, flashStatus } from "./map-editor/status";
import { rebuildMapList, addMap, deleteMap, openMapGenProps, openMapProps } from "./map-editor/map-list";
import { toggleHdPreview, isHdPreviewOpen } from "./map-editor/hd-preview";
import { cmdListWidget, walkCommands } from "./event-editor/command-list";
import { openEventEditor } from "./event-editor/event-editor";
import { ICONS } from "./icons";
import { openDatabase } from "./database";
import { openPluginManager } from "./tools/plugin-manager";
import { openAudioManager } from "./tools/audio-manager";
import { openEventSearcher } from "./tools/event-searcher";
import { openResourceManager } from "./tools/resource-manager";
import { openCharGenerator } from "./tools/character-generator";

(() => {
  const t = editorI18n.t;

  function playtestUrl() { return "play.html?playtest=" + Date.now(); }

  // Cross-boundary hook registrations: functions that still live in this
  // closure but are called from the extracted modules (see editor-state.ts).
  // Function declarations hoist, so registering here is safe.
  Object.assign(editorHooks, {
    refreshToolbar,
    setMode,
    rebuildAll,
  });









  // ============================ command definitions ============================
  // Extracted verbatim to src/editor/event-editor/command-defs.ts (Package 2):
  // cmdSummary, textCodesHelp, CMD_DEFS, cmdDef, mountForm, editCommand, pickCommand.

  // ============================ command list widget ============================
  // Extracted verbatim to src/editor/event-editor/command-list.ts (Package 2):
  // buildCmdRows, cmdListWidget.


  // ============================ database ============================
  // Extracted verbatim to src/editor/database/* (Phase 1 Stage C, Package 3):
  //   shared.ts        — listFormTab, nameRefresher, iconPickerField, STAT/PARAM keys,
  //                       TRAIT_SKILL_TYPES, traitDefault, skillTypeTraitOpts
  //   system-tab.ts    — System, Controls tabs
  //   battler-tabs.ts  — Actors, Classes, Skills, Enemies, States tabs
  //   item-tabs.ts     — Items, Weapons, Armors, Troops, Common Events tabs
  //   quests-tab.ts    — Quests tab
  //   tilesets-tab.ts  — Tilesets tab
  //   types-tab.ts     — Types tab + nameListTab (Switches, Variables)
  //   index.ts         — dbTabs() + openDatabase() modal shell/rail (imported above)


  // ============================ tools ============================
  // Extracted verbatim to src/editor/tools/* (Phase 1 Stage C, Package 3):
  //   plugin-manager.ts      — openPluginManager (imported above)
  //   audio-manager.ts       — openAudioManager (imported above)
  //   event-searcher.ts      — openEventSearcher (imported above)
  //   resource-manager.ts    — openResourceManager (imported above)
  //   character-generator.ts — openCharGenerator (imported above)


  // ============================ help / about ============================
  function refreshLocalizedChrome() {
    editorI18n.localizeStatic();
    buildMenubar();
    buildToolbar();
    refreshToolbar();
    setStatus();
    const saveIndicator = $("save-ind");
    if (saveIndicator.textContent.startsWith("●")) saveIndicator.textContent = "● " + t("unsaved");
    else if (saveIndicator.textContent.startsWith("⚠")) saveIndicator.textContent = "⚠ " + t("save failed");
    else saveIndicator.textContent = "✓ " + t("saved");
  }
  function openLanguageSettings() {
    let selectedLocale = editorI18n.locale;
    const languageSelect = h("select", {
      onchange(e) { selectedLocale = e.target.value; },
    }, ...editorI18n.locales().map((locale) =>
      h("option", { value: locale.id, ...(locale.id === selectedLocale ? { selected: "" } : {}) }, locale.label)));
    modal({
      title: "Interface Language",
      content: h("div", null,
        h("p", null, t("Choose the language used by the editor. Project content is not translated.")),
        field("Language", languageSelect)),
      buttons: [
        { label: "Apply", primary: true, onClick(close) {
          editorI18n.setLocale(selectedLocale);
          close();
          refreshLocalizedChrome();
        } },
        { label: "Cancel" },
      ],
    });
  }
  function openPatchNotes() {
    const list = h("div", { class: "patch-notes" });
    PATCH_NOTES.forEach((note) => {
      const items = h("ul");
      (note.items || []).forEach((item) => items.appendChild(h("li", null, item)));
      list.appendChild(h("article", { class: "patch-note" },
        h("div", { class: "patch-note-head" },
          h("h3", null, note.title),
          h("time", null, note.date)),
        h("p", null, note.summary),
        items));
    });
    modal({
      title: "RPGAtlas - Patch Notes",
      wide: true,
      content: list,
      buttons: [{ label: "Close", primary: true }],
    });
  }
  function openHelp() {
    modal({
      title: "RPGAtlas — Quick Help",
      wide: true,
      content: h("div", { class: "helpbox", html: `
<h3>Drawing maps</h3>
<ul>
<li><b>Tools</b>: Pen <kbd>Q</kbd>, Eraser <kbd>W</kbd>, Rectangle <kbd>E</kbd>, Circle <kbd>R</kbd>, Fill <kbd>T</kbd>, Shadow Pen <kbd>Y</kbd>. Right-click = pick tile from the map.</li>
<li><b>Layers</b>: Auto <kbd>&#96;</kbd> places terrain on Layer 1 and stacks decorations on Layers 2–3 automatically. <kbd>1</kbd>–<kbd>4</kbd> select Ground / Decor / Decor&nbsp;2 / Overhead directly (Overhead draws above the player).</li>
<li><b>Shadow Pen</b>: left-click paints a half-tile shadow quadrant, right-click erases it.</li>
<li><b>Modes</b>: press <kbd>Tab</kbd> (<kbd>Shift</kbd>+<kbd>Tab</kbd> reverse) to cycle Map → Event → Passability → Height. <b>Height Mode</b>: paint HD-2D elevation with Pen / Rectangle / Circle / Fill. Keys <kbd>0</kbd>–<kbd>9</kbd> set the value, right-click picks it up, Eraser clears. Raised tiles become 3D blocks when the map's HD-2D rendering is on.</li>
<li><b>HD-2D</b>: enable per map in Game ▸ Map Properties (camera tilt, bloom, depth of field, fog, point lights). Game ▸ HD-2D Preview opens a live panel that follows your edits — drag it to pan. Lights are events named “light #rrggbb radius”.</li>
<li><b>Selection</b>: Shift+drag selects an area. Cut <kbd>Ctrl+X</kbd> / Copy <kbd>Ctrl+C</kbd> / Paste <kbd>Ctrl+V</kbd>, then click to stamp (Esc cancels). Works for events too.</li>
<li>Undo <kbd>Ctrl+Z</kbd> · Redo <kbd>Ctrl+Y</kbd> · Zoom <kbd>+</kbd>/<kbd>−</kbd>, <kbd>Ctrl</kbd>+wheel, <kbd>Ctrl+0</kbd> = 100%. Press <kbd>?</kbd> for the full keyboard shortcut list.</li>
</ul>
<h3>Passability</h3>
<ul>
<li>By default the topmost decoration tile decides (○ passable / ✕ blocked); otherwise the ground tile.</li>
<li>In <b>Passability mode</b> click a tile to cycle: auto → force ✕ → force ○. Overridden tiles get a yellow corner badge.</li>
</ul>
<h3>Events</h3>
<ul>
<li>In <b>Event mode</b> double-click a cell to create/edit an event; drag to move; <kbd>Del</kbd> deletes. <b>Right-click</b> for a menu: New Event, <b>Quick Events</b> (Transfer / Sign / Chest), Cut/Copy/Paste, and Set Start Position Here. Each event has <b>pages</b> — the last page whose conditions hold is active.</li>
<li>Triggers: Action button (Z), Player touch, Autorun (blocks play), Parallel (background). Use Self-Switches for chest-like one-time events.</li>
<li><b>Event Searcher</b> (Tools menu) finds text, names, or switch/variable usage across all maps.</li>
</ul>
<h3>Tools</h3>
<ul>
<li><b>Database</b>: actors, classes, skills, items, equipment, enemies, troops, common events, states, types, switches, variables, system.</li>
<li><b>System tab</b>: screen size, UI area, screen scale, fonts &amp; font size, window opacity, system sounds &amp; music, side-view or front-view battles, start-transparent player.</li>
<li><b>States</b>: poison / stun / regen-style battle effects, inflicted or cured by skills.</li>
<li><b>Plugin Manager</b>: project-embedded JavaScript that runs at game boot, with map-load and per-frame hooks.</li>
<li><b>Character Generator</b>: build original walking sprites; they appear in every sprite picker.</li>
<li><b>Resource Manager</b>: browse every generated tile/character/battler and export PNGs.</li>
<li><b>Custom assets</b>: copy images into the shared <code>img/characters</code>, <code>facesets</code>, <code>enemies</code>, or <code>tilesets</code> folders, then reload the editor.</li>
</ul>
<h3>Playtesting & saving</h3>
<ul>
<li><b>▶ Playtest</b> opens the player. In game: Arrows/WASD move, Shift dashes, Z/Enter confirms, X/Esc menu/cancel.</li>
<li>Your project autosaves to this browser (<kbd>Ctrl+S</kbd> forces it). Use File ▸ Export for a .json backup; Open to load one.</li>
<li><b>Export Standalone Game</b> creates a Windows .exe or cross-platform .html that runs without the editor or engine folder.</li>
</ul>
<h3>License</h3>
<p>RPGAtlas is free and open source software under the <b>GNU GPLv3</b>. The content you create — maps, story, database, characters — is yours. Exported games bundle the engine runtime, which stays under the GPL (its readable source ships inside every export).</p>
` }),
    });
  }
  function openKeyboardShortcuts() {
    const box = h("div", { class: "helpbox" });
    const kbd = (s) => h("kbd", null, s);
    const keys = (...labels) => {
      const out = [];
      labels.forEach((l, i) => { if (i) out.push(" / "); out.push(kbd(l)); });
      return out;
    };
    const line = (chips, desc) => h("li", null, ...chips, h("span", { class: "cl-desc" }, " — " + desc));
    const aKey = (id) => ACT[id].key;
    const aLabel = (id) => actionLabel(ACT[id]);
    const section = (title, rows) => {
      box.appendChild(h("h3", null, title));
      const ul = h("ul", { class: "code-legend-list" });
      rows.forEach((r) => ul.appendChild(r));
      box.appendChild(ul);
    };

    const toolIds = ["tool-pen", "tool-erase", "tool-rect", "tool-circle", "tool-fill", "tool-shadow"];
    const layerIds = ["layer-auto", "layer-ground", "layer-decor", "layer-decor2", "layer-over"];

    section("Modes", [
      line(keys("Tab"), "next mode  (Map → Event → Passability → Height, wraps)"),
      line(keys("Shift", "Tab"), "previous mode"),
      h("li", { class: "dim" }, "Set Start Position is reached from the Mode menu, not the Tab cycle."),
    ]);
    section("Tools  (Map or Height mode)", toolIds.map((id) => line(keys(aKey(id)), aLabel(id))));
    section("Layers  (Map mode)", layerIds.map((id) => line(keys(aKey(id)), aLabel(id))));
    section("Height mode", [line(keys("0–9"), "set the painted elevation value")]);
    section("Edit & file", ["undo", "redo", "cut", "copy", "paste", "save"].map((id) => line(keys(aKey(id)), aLabel(id))));
    section("View", [
      line(keys("+", "−"), "zoom in / out  (Ctrl + wheel also zooms)"),
      line(keys(aKey("zoom1")), "zoom to 100%"),
    ]);
    section("Application", ["db", "hdpreview", "play"].map((id) => line(keys(aKey(id)), aLabel(id))));
    section("Selection & events", [
      line(keys("Shift", "drag"), "select an area of tiles"),
      line(keys("Del"), "delete the selected event (Event mode)"),
      line(keys("Esc"), "clear selection / cancel paste / deselect"),
    ]);
    box.appendChild(h("div", { class: "dim", style: "margin-top:10px;font-size:12px" },
      "Tool and layer keys do nothing outside their mode — switch with Tab first. Toolbar and menu clicks switch mode automatically. F1 and F5 take over the browser's Help and Reload while the editor is focused."));

    modal({ title: "Keyboard Shortcuts", wide: true, content: box, dialogKeys: true });
  }
  function openAbout() {
    modal({
      title: "About RPGAtlas",
      content: h("div", { class: "helpbox", html: `
<div style="display:flex;align-items:center;gap:14px;margin-bottom:10px">
  <img src="img/system/rpgatlas-logo.svg" alt="" width="56" height="56">
  <div>
    <div style="font-size:20px;font-weight:800">RPG<span style="font-weight:300">Atlas</span></div>
    <div class="dim">Chart your world. Tell your story.</div>
  </div>
</div>
<p><b>RPGAtlas</b> — a free and open source RPG maker that runs entirely in your browser.</p>
<ul>
<li>No build step or dependencies — built-in art and audio are generated procedurally, with optional shared custom images from the <code>img</code> folder.</li>
<li>Free software under the <b>GNU GPLv3</b> — use it, study it, share it, improve it.</li>
<li>Your game's content (maps, story, data, art) is yours — sell it, remix it, no credit required. Exported games include the engine runtime, which remains GPL-licensed.</li>
</ul>
<p class="dim">Editor: index.html · Player: play.html · Data: one portable .json project file.</p>
` }),
    });
  }

  // ============================ icons (original line art) ============================
  // Extracted verbatim to src/editor/icons.ts (Package 3): ICONS (imported above).

  // ============================ actions / menus / toolbar ============================
  const ACT = {};
  function act(id, def) {
    def.labelKey = def.label;
    def.tipKey = def.tip;
    ACT[id] = def;
  }
  function actionLabel(action) { return t(action.labelKey); }
  function actionTip(action) { return t(action.tipKey || action.labelKey); }
  function runAct(id) {
    const a = ACT[id];
    if (!a || (a.enabled && !a.enabled())) return;
    a.run();
    refreshToolbar();
  }

  act("new", { label: "New Project…", icon: "new", tip: "New project (resets to the bundled sample game)", run() {
    confirmBox("Start a fresh project (the bundled sample game)? Your current project will be replaced — Export first if you want to keep it.", () => {
      S.proj = DataDefaults.newProject();
      Assets.registerCustomChars(S.proj.customChars);
      Assets.bindExternalAssets(S.proj);
      S.curMapId = S.proj.maps[0].id;
      S.selectedEvent = null; S.selection = null; S.pasteMode = null;
      S.undoStack.length = 0; S.redoStack.length = 0;
      rebuildAll(); touch();
    });
  } });
  act("open", { label: "Open Project (.json)…", icon: "open", tip: "Open / import a project file", run() { $("import-file").click(); } });
  act("save", { label: "Save Project", icon: "save", key: "Ctrl+S",
    tip: host.isTauri ? "Save the project to its file" : "Save the project to this browser now",
    run() {
      if (host.isTauri) { desktopSave(false); return; }
      saveNow();
      flashStatus("Project saved to this browser — use File ▸ Export for a backup file");
    } });
  act("export", { label: "Export Project As File…", run: exportProject });
  act("build", { label: "Export Standalone Game…", run: openStandaloneExport });
  act("play", { label: "Playtest", icon: "play", key: "F5", tip: "Save and run the game", run() {
    saveNow();
    if (host.isTauri) {
      host.openPlaytest().catch((e) => alert("Could not open play-test window: " + ((e && e.message) || e)));
    } else {
      window.open(playtestUrl(), "rpgatlas_play");
    }
  } });
  act("mapprops", { label: "Map Properties…", run: openMapProps });
  act("hdpreview", { label: "HD-2D Preview", icon: "hd2d", key: "F2", tip: "Toggle the live HD-2D preview panel (uses this map's HD-2D settings)", active: () => isHdPreviewOpen(), run: toggleHdPreview });

  act("undo", { label: "Undo", icon: "undo", key: "Ctrl+Z", enabled: () => S.undoStack.length > 0, run: undo });
  act("redo", { label: "Redo", icon: "redo", key: "Ctrl+Y", enabled: () => S.redoStack.length > 0, run: redo });
  act("cut", { label: "Cut", icon: "cut", key: "Ctrl+X", tip: "Cut the selected area / event", enabled: canCopy, run: () => copySelection(true) });
  act("copy", { label: "Copy", icon: "copy", key: "Ctrl+C", tip: "Copy the selected area / event (Shift+drag selects tiles)", enabled: canCopy, run: () => copySelection(false) });
  act("paste", { label: "Paste", icon: "paste", key: "Ctrl+V", tip: "Paste — then click the map to place", enabled: () => !!(S.clipTiles || S.clipEvent), run: startPaste });
  act("deselect", { label: "Clear Selection", key: "Esc", enabled: () => !!(S.selection || S.pasteMode), run: clearSelection });

  act("mode-map", { label: "Map (Tile) Mode", icon: "map", key: "Tab ⇆", tip: "Tile layer — draw the map", active: () => S.mode === "map", run: () => setMode("map") });
  act("mode-event", { label: "Event Mode", icon: "event", key: "Tab ⇆", tip: "Event layer — place and edit events", active: () => S.mode === "event", run: () => setMode("event") });
  act("mode-pass", { label: "Passability Mode", icon: "pass", key: "Tab ⇆", tip: "Passability — click tiles to cycle auto → ✕ block → ○ pass", active: () => S.mode === "pass", run: () => setMode("pass") });
  act("mode-height", { label: "Height Mode (HD-2D)", icon: "height", key: "Tab ⇆",
    tip: "Heights — paint HD-2D elevation with the Pen / Rectangle / Circle / Fill tools (digits 0–9 set the value)",
    active: () => S.mode === "height", run: () => setMode("height") });
  act("mode-start", { label: "Set Start Position…", active: () => S.mode === "start", run() {
    setMode("start");
    flashStatus("Click the map to set the player start position");
  } });

  [["auto", "`"], ["ground", "1"], ["decor", "2"], ["decor2", "3"], ["over", "4"]].forEach(([ln, key]) => {
    act("layer-" + ln, { label: LAYER_LABELS[ln], icon: "layer-" + ln, key,
      active: () => S.layer === ln && S.mode === "map",
      run() { if (S.mode !== "map") setMode("map"); setLayer(ln); } });
  });
  [["pen", "Q"], ["erase", "W"], ["rect", "E"], ["circle", "R"], ["fill", "T"], ["shadow", "Y"]].forEach(([t, key]) => {
    act("tool-" + t, { label: TOOL_LABELS[t], icon: t, key,
      tip: t === "shadow" ? "Shadow Pen — left paints a shadow quadrant, right erases" : TOOL_LABELS[t],
      active: () => S.tool === t && (S.mode === "map" || S.mode === "height"),
      run() { if (S.mode !== "map" && S.mode !== "height") setMode("map"); setTool(t); } });
  });

  act("zoomin", { label: "Zoom In", icon: "zoomin", key: "+", run: () => zoomStep(1) });
  act("zoomout", { label: "Zoom Out", icon: "zoomout", key: "−", run: () => zoomStep(-1) });
  act("zoom1", { label: "Zoom 1:1", icon: "zoom1", key: "0", tip: "Set zoom to 100%", active: () => Math.abs(S.zoom - 1) < 0.01, run: () => setZoom(1) });
  act("zoomfit", { label: "Fit Map In View", run: () => zoomFit() });

  act("db", { label: "Database…", icon: "db", key: "F1", tip: "Database — actors, items, enemies, switches…", run: openDatabase });
  act("plugins", { label: "Plugin Manager…", icon: "plugins", tip: "Plugin Manager — project JavaScript run at game boot", run: openPluginManager });
  act("audio", { label: "Audio Manager…", icon: "audio", tip: "Audio Manager — preview sounds and music", run: openAudioManager });
  act("search", { label: "Event Searcher…", icon: "search", tip: "Event Searcher — find text / switches / variables across maps", run: openEventSearcher });
  act("resources", { label: "Resource Manager…", icon: "resources", tip: "Resource Manager — browse and export generated assets", run: openResourceManager });
  act("chargen", { label: "Character Generator…", icon: "chargen", tip: "Character Generator — build original walking sprites", run: openCharGenerator });
  act("language", { label: "Interface Language…", run: openLanguageSettings });
  act("patchnotes", { label: "Patch Notes", run: openPatchNotes });
  act("shortcuts", { label: "Keyboard Shortcuts…", key: "?", run: openKeyboardShortcuts });
  act("help", { label: "Quick Help", run: openHelp });
  act("about", { label: "About RPGAtlas", run: openAbout });

  const TOOLBAR = [
    ["new", "open", "save"],
    ["cut", "copy", "paste"],
    ["undo", "redo"],
    ["mode-map", "mode-event", "mode-pass", "mode-height"],
    ["layer-auto", "layer-ground", "layer-decor", "layer-decor2", "layer-over"],
    ["tool-pen", "tool-erase", "tool-rect", "tool-circle", "tool-fill", "tool-shadow"],
    ["zoomin", "zoomout", "zoom1"],
    ["db", "plugins", "audio", "search", "resources", "chargen"],
    ["hdpreview", "play"],
  ];
  function buildToolbar() {
    const bar = $("toolbar");
    bar.innerHTML = "";
    TOOLBAR.forEach((group, gi) => {
      if (gi) bar.appendChild(h("span", { class: "tb-sep" }));
      for (const id of group) {
        const a = ACT[id];
        const btn = h("button", {
          class: "tbtn" + (id === "play" ? " play-btn" : ""),
          title: actionTip(a) + (a.key ? "  (" + a.key + ")" : ""),
          onclick: () => runAct(id),
        });
        btn.innerHTML = ICONS[a.icon] || "";
        if (id === "play") btn.appendChild(document.createTextNode(actionLabel(a)));
        a.btn = btn;
        bar.appendChild(btn);
      }
    });
  }
  function refreshToolbar() {
    for (const id of Object.keys(ACT)) {
      const a = ACT[id];
      if (!a.btn) continue;
      a.btn.classList.toggle("sel", !!(a.active && a.active()));
      a.btn.disabled = !!(a.enabled && !a.enabled());
    }
  }

  const MENUS = [
    { label: "File", items: ["new", "open", "save", "export", "build", "-", "play"] },
    { label: "Edit", items: ["undo", "redo", "-", "cut", "copy", "paste", "-", "deselect"] },
    { label: "Mode", items: ["mode-map", "mode-event", "mode-pass", "mode-height", "-", "mode-start"] },
    { label: "Draw", items: ["tool-pen", "tool-erase", "tool-rect", "tool-circle", "tool-fill", "tool-shadow"] },
    { label: "Layer", items: ["layer-auto", "layer-ground", "layer-decor", "layer-decor2", "layer-over"] },
    { label: "Scale", items: ["zoomin", "zoomout", "zoom1", "zoomfit"] },
    { label: "Tools", items: ["db", "plugins", "audio", "search", "resources", "chargen"] },
    { label: "Game", items: ["play", "build", "-", "mapprops", "hdpreview", "mode-start"] },
    { label: "Help", items: ["language", "-", "shortcuts", "patchnotes", "help", "about"] },
  ];
  let menuOpenRef = null;
  let menuDismissBound = false;
  function closeMenus() {
    if (!menuOpenRef) return;
    menuOpenRef.drop.remove();
    menuOpenRef.lab.classList.remove("open");
    menuOpenRef = null;
  }
  function openMenuFor(menu, lab) {
    closeMenus();
    const drop = h("div", { class: "menu-drop" });
    for (const it of menu.items) {
      if (it === "-") { drop.appendChild(h("div", { class: "menu-sep" })); continue; }
      const a = ACT[it];
      const dis = !!(a.enabled && !a.enabled());
      drop.appendChild(h("div", {
        class: "menu-item" + (dis ? " disabled" : ""),
        onclick() { if (dis) return; closeMenus(); a.run(); refreshToolbar(); },
      },
        h("span", { class: "mi-check" }, a.active && a.active() ? "✓" : ""),
        h("span", { class: "mi-label" }, actionLabel(a)),
        a.key ? h("span", { class: "mi-key" }, a.key) : null));
    }
    const r = lab.getBoundingClientRect();
    drop.style.left = r.left + "px";
    drop.style.top = (r.bottom + 2) + "px";
    document.body.appendChild(drop);
    lab.classList.add("open");
    menuOpenRef = { drop, lab };
  }
  function buildMenubar() {
    const nav = $("menus");
    nav.innerHTML = "";
    for (const menu of MENUS) {
      const lab = h("span", { class: "menu-label" }, t(menu.label));
      lab.addEventListener("mousedown", (e) => {
        e.preventDefault(); e.stopPropagation();
        if (menuOpenRef && menuOpenRef.lab === lab) closeMenus();
        else openMenuFor(menu, lab);
      });
      lab.addEventListener("mouseenter", () => {
        if (menuOpenRef && menuOpenRef.lab !== lab) openMenuFor(menu, lab);
      });
      nav.appendChild(lab);
    }
    if (!menuDismissBound) {
      document.addEventListener("mousedown", (e) => {
        if (menuOpenRef && !menuOpenRef.drop.contains(e.target)) closeMenus();
      });
      menuDismissBound = true;
    }
  }

  // ============================ modes / zoom ============================
  function setMode(m) {
    S.mode = m;
    S.selectedEvent = null;
    S.pasteMode = null;
    renderMap(); refreshToolbar(); setStatus();
  }
  const MODE_CYCLE = ["map", "event", "pass", "height"]; // "start" intentionally excluded
  function cycleMode(dir) {
    let i = MODE_CYCLE.indexOf(S.mode);
    if (i < 0) i = 0; // "start"/unexpected -> enter at "map"
    const n = MODE_CYCLE.length;
    setMode(MODE_CYCLE[(i + dir + n) % n]);
  }
  function setTool(t) {
    S.tool = t;
    renderMap(); refreshToolbar(); setStatus();
  }
  function setLayer(l) {
    S.layer = l;
    renderMap(); refreshToolbar(); setStatus();
  }
  function setZoom(z, pivot) {
    z = Math.max(0.15, Math.min(3, z));
    const sc = $("mapscroll");
    const px = pivot ? pivot.x : sc.clientWidth / 2;
    const py = pivot ? pivot.y : sc.clientHeight / 2;
    const wx = (sc.scrollLeft + px - 14) / S.zoom;  // 14 = #mapscroll padding
    const wy = (sc.scrollTop + py - 14) / S.zoom;
    S.zoom = z;
    renderMap();
    sc.scrollLeft = wx * S.zoom + 14 - px;
    sc.scrollTop = wy * S.zoom + 14 - py;
    setStatus(); refreshToolbar();
  }
  function zoomStep(d, pivot) {
    let best = 0, bd = Infinity;
    ZOOMS.forEach((z, i) => { const dd = Math.abs(z - S.zoom); if (dd < bd) { bd = dd; best = i; } });
    setZoom(ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, best + d))], pivot);
  }
  function zoomFit() {
    const m = curMap(), sc = $("mapscroll");
    if (!m) return;
    setZoom(Math.min((sc.clientWidth - 30) / (m.width * TILE), (sc.clientHeight - 30) / (m.height * TILE), 1.5));
  }

  // ============================ boot / wiring ============================
  function rebuildAll() {
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
    S.palCanvas.addEventListener("mousedown", (e) => {
      const r = S.palCanvas.getBoundingClientRect();
      const x = Math.floor((e.clientX - r.left) / TILE), y = Math.floor((e.clientY - r.top) / TILE);
      const id = y * Assets.PALETTE_COLS + x;
      if (id >= 0 && Assets.tiles[id]) { S.selectedTile = id; renderPalette(); setStatus(); }
    });
    S.palCanvas.addEventListener("mousemove", (e) => {
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
    S.mapCanvas.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      if (S.suppressNextCtxMenu) { S.suppressNextCtxMenu = false; return; }
      if (S.mode === "event") openCanvasMenu(e);
    });
    S.mapCanvas.addEventListener("mouseleave", () => { S.hoverCell = null; S.hoverQuad = 0; renderMap(); });

    // ctrl+wheel zooms around the cursor
    $("mapscroll").addEventListener("wheel", (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const r = $("mapscroll").getBoundingClientRect();
      zoomStep(e.deltaY < 0 ? 1 : -1, { x: e.clientX - r.left, y: e.clientY - r.top });
    }, { passive: false });

    $("import-file").addEventListener("change", (e) => {
      if (e.target.files[0]) importProject(e.target.files[0]);
      e.target.value = "";
    });
    $("map-add").addEventListener("click", addMap);
    $("map-del").addEventListener("click", deleteMap);
    $("map-gen").addEventListener("click", openMapGenProps);

    document.addEventListener("keydown", (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return;
      if (modalRoot().children.length) return;
      if (e.code === "Escape") {
        if (menuOpenRef) { closeMenus(); return; }
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
  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
