/* RPGAtlas — src/editor/tools/audio-manager.ts
   The Audio Manager modal: preview procedural sound effects and music themes.
   Verbatim move from the editor monolith (Phase 1 Stage C, Package 3):
   logic unchanged, closure vars routed through editor-state.ts.
   Copyright (C) 2026 RPGAtlas contributors — GPL-3.0-or-later (see LICENSE). */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { Music, Sfx } from "../editor-state";
import { h, SE_NAMES } from "../dom";
import { modal } from "../modals";

export function openAudioManager() {
  let playingTheme: any = null;
  const seGrid = h("div", { class: "audio-grid" });
  for (const n of SE_NAMES) seGrid.appendChild(h("button", { onclick() { Sfx.play(n); } }, "▶ " + n));
  const musGrid = h("div", { class: "audio-grid" });
  const musBtns: any[] = [];
  for (const t of Sfx.THEMES) {
    const b = h("button", { onclick() {
      if (playingTheme === t) { Music.stop(); playingTheme = null; }
      else { Music.play(t); playingTheme = t; }
      musBtns.forEach((x) => x.b.classList.toggle("playing", x.t === playingTheme));
    } }, "♪ " + t);
    musBtns.push({ t, b });
    musGrid.appendChild(b);
  }
  modal({
    title: "Audio Manager",
    wide: true,
    content: h("div", null,
      h("div", { class: "subhead" }, "Sound effects (used by the Play Sound event command)"),
      seGrid,
      h("div", { class: "subhead" }, "Music themes (click to preview, click again to stop)"),
      musGrid,
      h("div", { class: "dim", style: "margin-top:10px" },
        "Assign a theme per map in Map Properties. Battles always use “battle”, the title screen “title”, defeat “gameover”. All audio is generated procedurally — no files, no copyright."),
    ),
    onClose() { Music.stop(); },
  });
}
