/* RPGAtlas — tests-e2e/fixtures/atlas-quest.mjs
   Shared helpers for seeding the bundled sample project ("Atlas Quest") into
   the app's storage before a spec navigates to index.html/play.html.

   Both the editor and player load a project from localStorage under the
   "rpgatlas_project" key (see js/editor/project-io.js loadStoredProject and
   js/engine.js loadProject). Seeding that key before navigation is the
   supported, non-invasive way to get a real project into either page without
   touching engine/editor source. GPL-3.0-or-later. */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const projectPath = join(here, "..", "..", "Atlas_Quest.json");

let cached = null;
export function atlasQuestJson() {
  if (!cached) cached = readFileSync(projectPath, "utf8");
  return cached;
}

/**
 * Seeds localStorage with the Atlas Quest sample project, then navigates to
 * `path`. Must set localStorage before any app script runs, so we navigate
 * to the target origin first (about:blank has no localStorage bound to the
 * app's origin), seed, then navigate again to the real page.
 *
 * `installClock: true` installs Playwright's fake clock (see clock.install())
 * in between the seed and the real navigation, so it is in place before
 * js/engine.js boot() ever calls requestAnimationFrame(loop) — needed for
 * deterministic golden-image captures (see tests-e2e/renderer-golden.spec.mjs).
 */
export async function gotoWithAtlasQuest(page, path, { installClock = false } = {}) {
  // Prime the origin so we can write to its localStorage before boot.
  await page.goto(path);
  await page.evaluate((json) => {
    localStorage.setItem("rpgatlas_project", json);
  }, atlasQuestJson());
  if (installClock) {
    // Fixed epoch start so any incidental Date.now()/timestamp text in the
    // UI (e.g. save-slot listings) is also reproducible across runs.
    await page.clock.install({ time: new Date("2024-01-01T00:00:00Z") });
  }
  await page.goto(path);
}
