/* RPGAtlas — src/editor/importers/rm-import-wizard.ts
   Project Compass M1·D: the "Import from RPG Maker MZ / MV" wizard — the user
   face of the whole migration. It lets a beginner point RPGAtlas at their own MV
   or MZ project (a picked folder, or a .zip of it), runs the M1·A–C conversion
   pipeline behind a progress note, loads the result as the current project, and
   shows a plain-language report of what came along, what changed, and what to do
   next — never a stack trace (locked decision 6).

   The DOM-free conversion core lives in ./mz (runRmImport / readZip); this module
   owns the file-pickers, the progress + report modals, and committing the
   imported project into the editor. Copyright (C) 2026 RPGAtlas contributors —
   GPL-3.0-or-later (see LICENSE). */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { h } from "../dom";
import { modal } from "../modals";
import { Assets, DataDefaults, RA, editorState as S, editorHooks } from "../editor-state";
import { touch } from "../persistence";
import { validateProject, type ImportReportDoc, type ImportReportLine } from "../../shared/schema";
import { consumeEmbeddedAssets, libraryImageEntries } from "../../shared/asset-library";
import {
  fileListSource,
  objectSource,
  readZip,
  runRmImport,
  type MzFileSource,
  type RmImportOutcome,
} from "./mz";

// ---------------------------------------------------------------------------
// Source builders (folder pick vs .zip)
// ---------------------------------------------------------------------------

/** Strip a common leading folder so paths are project-root-relative, anchored on
 *  `data/System.json` (a real project always has one). Mirrors what
 *  `fileListSource` does for a picked folder; needed for a zip whose entries may
 *  sit under a top-level game folder. */
function stripToProjectRoot(map: Record<string, Uint8Array>): Record<string, Uint8Array> {
  const norm = (p: string) => p.replace(/\\/g, "/").replace(/^\.?\//, "");
  let prefix = "";
  for (const k of Object.keys(map)) {
    const m = /^(.*?)data\/system\.json$/i.exec(norm(k));
    if (m) { prefix = m[1]; break; }
  }
  const out: Record<string, Uint8Array> = {};
  for (const [k, v] of Object.entries(map)) {
    const nk = norm(k);
    const key = prefix && nk.toLowerCase().startsWith(prefix.toLowerCase()) ? nk.slice(prefix.length) : nk;
    out[key] = v;
  }
  return out;
}

async function openZipSource(bytes: Uint8Array): Promise<MzFileSource> {
  return objectSource(stripToProjectRoot(await readZip(bytes)));
}

// ---------------------------------------------------------------------------
// Run + commit
// ---------------------------------------------------------------------------

/** Load the imported project into the editor — the same live-refresh path as a
 *  .json Open (persistence.importProject), plus the saved report. */
async function commit(outcome: RmImportOutcome): Promise<void> {
  const project = validateProject(RA.migrateProject(outcome.project), "import");
  project.importReport = outcome.report; // survive migrate (mutates in place)
  S.proj = project;
  await consumeEmbeddedAssets(S.proj);
  Assets.registerCustomChars(S.proj.customChars);
  await Assets.registerExternalAssets(libraryImageEntries(), S.proj);
  S.curMapId = S.proj.maps[0].id;
  S.selectedEvent = null;
  S.selection = null;
  S.pasteMode = null;
  S.undoStack.length = 0;
  S.redoStack.length = 0;
  editorHooks.rebuildAll();
  touch();
}

function showError(e: any): void {
  const msg = e && e.message ? String(e.message) : String(e);
  modal({
    title: "Import didn't work",
    content: h("div", { class: "helpbox" },
      h("p", null, "We couldn't bring that project in — but nothing on your computer was changed."),
      h("p", { class: "dim" }, msg),
      h("p", null, "Make sure you picked the game's project folder (the one with a ",
        h("b", null, "data"), " folder inside), or a .zip of it.")),
    buttons: [{ label: "OK", primary: true }],
  });
}

/** The shared pick → progress → convert → load → report flow. `getSource` is
 *  awaited only after the progress note is on screen, so a big project shows
 *  feedback before the CPU-heavy convert blocks the thread. */
async function importFromSource(getSource: () => Promise<MzFileSource>): Promise<void> {
  const prog = modal({
    title: "Importing your game…",
    dismissable: false,
    buttons: [],
    content: h("div", { class: "helpbox" },
      h("p", null, "Reading your RPG Maker project and converting it into RPGAtlas…"),
      h("p", { class: "dim" }, "This can take a moment for a big game.")),
  });
  // Let the modal paint before the synchronous conversion work starts.
  await new Promise((r) => setTimeout(r, 20));
  try {
    const source = await getSource();
    const outcome = await runRmImport(source, DataDefaults.newProject());
    await commit(outcome);
    prog.close();
    showReport(outcome.report);
  } catch (e) {
    prog.close();
    showError(e);
  }
}

// ---------------------------------------------------------------------------
// The report
// ---------------------------------------------------------------------------

function chip(label: string, n: number): HTMLElement {
  return h("span", {
    style:
      "display:inline-block;margin:2px 4px;padding:2px 9px;border-radius:11px;" +
      "background:rgba(120,216,144,.16);border:1px solid rgba(120,216,144,.45);font-size:12px",
  }, `${n} ${label}`);
}

/** Render the saved import report as kid-friendly HTML (locked decision 6):
 *  good news first, then honest notes on what changed / is coming / was left
 *  out, then next steps. Reused by the post-import modal and File ▸ Import
 *  Report. */
export function renderReportDoc(doc: ImportReportDoc): HTMLElement {
  const srcName = doc.source === "mz" ? "RPG Maker MZ" : "RPG Maker MV";
  const s = doc.summary;
  const chips = h("div", { style: "margin:6px 0 4px" });
  const add = (label: string, n: number) => { if (n > 0) chips.appendChild(chip(label, n)); };
  add("maps", s.maps); add("heroes", s.actors); add("skills", s.skills);
  add("items", s.items); add("weapons", s.weapons); add("armor pieces", s.armors);
  add("enemies", s.enemies); add("battle groups", s.troops);
  add("common events", s.commonEvents); add("switches", s.switches); add("variables", s.variables);

  const box = h("div", { class: "helpbox" },
    h("h3", null, `🎉 Your ${srcName} game is in RPGAtlas!`),
    doc.gameTitle ? h("p", null, h("b", null, doc.gameTitle)) : null,
    h("p", null, "Here's everything that came along:"),
    chips);

  const byKind = (k: ImportReportLine["kind"]) => doc.lines.filter((l) => l.kind === k);
  const section = (title: string, lines: ImportReportLine[]) => {
    if (!lines.length) return;
    const ul = h("ul");
    for (const l of lines) {
      const suffix = l.count && l.count > 1 ? ` (seen ${l.count} times)` : "";
      ul.appendChild(h("li", null,
        h("b", null, l.what),
        h("span", null, (l.detail ? " — " + l.detail : "") + suffix)));
    }
    box.appendChild(h("h4", null, title));
    box.appendChild(ul);
  };

  const partial = byKind("partial"), todo = byKind("todo"), skipped = byKind("skipped"), notes = byKind("converted");
  if (!partial.length && !todo.length && !skipped.length) {
    box.appendChild(h("p", null, "Everything came across cleanly — nothing was left behind. 🎉"));
  } else {
    box.appendChild(h("p", { class: "dim" }, "A few things need a note — nothing was thrown away:"));
  }
  section("✏️ Came in a little differently", partial);
  section("⏳ Saved for a later update", todo);
  section("📦 Left out on purpose", skipped);
  section("ℹ️ Notes", notes);

  box.appendChild(h("h4", null, "What next?"));
  box.appendChild(h("ul", null,
    h("li", null, "Press ▶ Playtest (F5) to try your game right away."),
    h("li", null, "Your maps kept their shapes, layout, and events. To bring in your own " +
      "tile artwork, use the Asset Browser (Tools ▸ Asset Browser) and Import Autotile Sheet."),
    h("li", null, "You can reopen this report any time from File ▸ Import Report.")));
  return box;
}

function showReport(doc: ImportReportDoc): void {
  modal({
    title: "Import Report",
    wide: true,
    content: renderReportDoc(doc),
    buttons: [{ label: "Start Editing", primary: true }],
  });
}

// ---------------------------------------------------------------------------
// Entry points (wired from workspace.ts actions + boot.ts)
// ---------------------------------------------------------------------------

/** Open the "which one" launcher: pick a folder or a .zip. The hidden inputs'
 *  change handlers (wired by initRmImport) do the actual work. */
export function openRmImportWizard(): void {
  const pick = (id: string) => {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (el) el.click();
  };
  modal({
    title: "Import from RPG Maker MZ / MV",
    content: h("div", { class: "helpbox" },
      h("p", null, "Bring your own RPG Maker MV or MZ game into RPGAtlas. Pick the game's project " +
        "folder (the one with a ", h("b", null, "data"), " folder inside), or a ", h("b", null, ".zip"), " of it."),
      h("p", { class: "dim" }, "Only your own project works — encrypted artwork is unlocked with the " +
        "project's own key. Your current project will be replaced, so use File ▸ Export first if you want to keep it.")),
    buttons: [
      { label: "Choose Folder…", primary: true, onClick(close: any) { close(); pick("rm-import-folder"); } },
      { label: "Choose .zip File…", onClick(close: any) { close(); pick("rm-import-zip"); } },
      { label: "Cancel" },
    ],
  });
}

/** Reopen the report saved on the current project (File ▸ Import Report). */
export function openSavedImportReport(): void {
  const doc = (S.proj as any).importReport as ImportReportDoc | undefined;
  if (!doc) return; // the action is disabled when there's no report
  modal({
    title: "Import Report",
    wide: true,
    content: renderReportDoc(doc),
    buttons: [{ label: "Close", primary: true }],
  });
}

/** True when the current project carries a saved import report. */
export function hasImportReport(): boolean {
  return !!(S.proj as any).importReport;
}

/** Wire the hidden folder/zip inputs to the import flow. Called once at boot. */
export function initRmImport(): void {
  const folder = document.getElementById("rm-import-folder") as HTMLInputElement | null;
  if (folder) folder.addEventListener("change", (e: any) => {
    const files = Array.from(e.target.files || []) as File[];
    e.target.value = "";
    if (files.length) void importFromSource(async () => fileListSource(files));
  });
  const zip = document.getElementById("rm-import-zip") as HTMLInputElement | null;
  if (zip) zip.addEventListener("change", (e: any) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (f) void importFromSource(async () => openZipSource(new Uint8Array(await f.arrayBuffer())));
  });
}
