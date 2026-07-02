/* RPGAtlas — src/editor/tools/character-generator.ts
   The Character Generator modal: build original walking sprites (hair/skin/
   colours), preview them animated, and save them into proj.customChars so they
   appear in every sprite picker.
   Verbatim move from the editor monolith (Phase 1 Stage C, Package 3):
   logic unchanged, closure vars routed through editor-state.ts.
   Copyright (C) 2026 RPGAtlas contributors — GPL-3.0-or-later (see LICENSE). */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { Assets, RA, TILE, editorState as S } from "../editor-state";
import { h, field, row } from "../dom";
import { modal, confirmBox } from "../modals";
import { touch } from "../persistence";
import { renderMap } from "../map-editor/map-render";
import { flashStatus } from "../map-editor/status";

export function openCharGenerator() {
  const SKINS = ["#f0c8a0", "#e8b890", "#d8a070", "#c08858", "#9a6a40", "#f0d0b0"];
  const pick = (arr: any) => arr[Math.floor(Math.random() * arr.length)];
  const randCol = () => "#" + [0, 0, 0].map(() => ("0" + Math.floor(40 + Math.random() * 200).toString(16)).slice(-2)).join("");
  function randomWork() {
    return { name: "New Hero", style: pick(Assets.HAIR_STYLES), skin: pick(SKINS),
      hair: randCol(), shirt: randCol(), pants: randCol(), hat: randCol() };
  }
  let editing: any = null; // entry in proj.customChars being edited, or null for a new one
  let work: any = randomWork();
  const PV_KEY = "cg_preview";
  let animF = 0;

  const previews = [0, 1, 2, 3].map(() => {
    const c = document.createElement("canvas");
    c.width = TILE; c.height = TILE;
    return c;
  });
  function paramsOf(w: any) { return { skin: w.skin, hair: w.hair, style: w.style, shirt: w.shirt, pants: w.pants, hat: w.hat }; }
  function redrawPreview() {
    const idx = Assets.registerHuman(PV_KEY, "preview", paramsOf(work));
    const frame = [0, 1, 2, 1][animF % 4];
    previews.forEach((c, dir) => {
      const g = c.getContext("2d")!;
      g.clearRect(0, 0, TILE, TILE);
      g.drawImage(Assets.charFrameCanvas(idx, dir, frame), 0, 0);
    });
  }
  const animTimer = setInterval(() => { animF++; redrawPreview(); }, 170);

  const formBox = h("div", { class: "cg-form" });
  const listEl = h("ul", { class: "dblist" });
  function colorIn(key: any) {
    return h("input", { type: "color", value: work[key], oninput(e: any) { work[key] = e.target.value; redrawPreview(); } });
  }
  function redrawForm() {
    formBox.innerHTML = "";
    const nameIn = h("input", { type: "text", value: work.name, oninput(e: any) { work.name = e.target.value; } });
    const styleSel = h("select", { onchange(e: any) { work.style = e.target.value; redrawPreview(); } },
      ...Assets.HAIR_STYLES.map((s: any) => h("option", { value: s, ...(s === work.style ? { selected: "" } : {}) }, s)));
    const skinSel = h("select", { onchange(e: any) { work.skin = e.target.value; redrawPreview(); } },
      ...SKINS.map((s, i) => h("option", { value: s, ...(s === work.skin ? { selected: "" } : {}) }, "skin " + (i + 1))));
    formBox.appendChild(row(field("Name", nameIn), field("Hair style", styleSel)));
    formBox.appendChild(row(field("Skin", skinSel), field("Hair", colorIn("hair")),
      field("Shirt", colorIn("shirt")), field("Pants", colorIn("pants")), field("Hat", colorIn("hat"))));
    formBox.appendChild(h("div", { class: "cg-preview" }, ...previews));
    formBox.appendChild(h("div", { class: "frow", style: "margin-top:8px; gap:6px" },
      h("button", { onclick() { const n = work.name; work = randomWork(); work.name = n; redrawForm(); redrawPreview(); } }, "🎲 Randomize"),
      h("button", { class: "primary", onclick: save }, editing ? "Update “" + editing.name + "”" : "Save as new character"),
      editing ? h("button", { onclick() { editing = null; redrawForm(); } }, "Cancel edit") : null,
    ));
  }
  function save() {
    if (!work.name.trim()) work.name = "Hero";
    if (editing) {
      editing.name = work.name;
      editing.params = paramsOf(work);
      Assets.registerHuman(editing.key, editing.name, editing.params);
    } else {
      const id = RA.nextId(S.proj.customChars.length ? S.proj.customChars : [{ id: 0 }]);
      const entry = { id, key: "cg" + id, name: work.name, params: paramsOf(work) };
      S.proj.customChars.push(entry);
      Assets.registerHuman(entry.key, entry.name, entry.params);
      editing = entry;
    }
    touch();
    redrawList(); redrawForm();
    flashStatus("Character saved — pick it as a sprite for actors and events");
  }
  function redrawList() {
    listEl.innerHTML = "";
    for (const c of S.proj.customChars) {
      listEl.appendChild(h("li", { class: c === editing ? "sel" : "", onclick() {
        editing = c;
        work = Object.assign({ name: c.name }, c.params);
        redrawForm(); redrawPreview();
      } }, c.name));
    }
    if (!S.proj.customChars.length) listEl.appendChild(h("li", { class: "dim" }, "(none yet)"));
  }
  const side = h("div", { class: "cg-side" },
    h("div", { class: "subhead", style: "margin:0" }, "Saved characters"),
    listEl,
    h("button", { onclick() {
      if (!editing) return;
      confirmBox('Delete "' + editing.name + '"? Actors/events using it will show no sprite.', () => {
        Assets.removeCharset(editing.key);
        S.proj.customChars.splice(S.proj.customChars.indexOf(editing), 1);
        editing = null;
        touch(); redrawList(); redrawForm(); renderMap();
      });
    } }, "Delete selected"),
    h("div", { class: "dim" }, "Saved characters appear in every sprite picker (marked ★ in the Resource Manager)."),
  );
  redrawList(); redrawForm(); redrawPreview();
  modal({
    title: "Character Generator",
    wide: true,
    dismissable: false,
    content: h("div", { class: "cg-wrap" }, side, formBox),
    buttons: [{ label: "Close", primary: true }],
    onClose() {
      clearInterval(animTimer);
      Assets.removeCharset(PV_KEY);
      renderMap();
    },
  });
}
