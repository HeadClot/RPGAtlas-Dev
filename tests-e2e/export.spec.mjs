/* RPGAtlas — tests-e2e/export.spec.mjs
   Standalone-export smoke test (Phase 1 Stage A safety net).

   The standalone HTML export is the highest-severity thing this refactor can
   break — a regression means users can no longer ship their games. Before
   Stage A the export fetched js/engine.js and inlined it; Stage A replaces that
   with the single-file player bundle (esbuild IIFE of src/engine/main.ts,
   emitted to dist/player-bundle.js). This spec drives the REAL export code path
   (js/editor/project-io.js#buildStandaloneGame) inside the built editor page,
   then loads the produced HTML in a fresh page and asserts the composition and
   boot behavior are byte-functionally identical to the pre-refactor baseline.

   IMPORTANT — pre-existing export bug (documented, NOT introduced or fixed
   here): the exported game does NOT currently reach the title screen. It boots
   to a "Cannot read properties of undefined (reading 'create')" error thrown at
   engine boot (window.RPGAtlasQuests.create), because STANDALONE_EXPORT_FILES
   inlines the classic deps css/assets/sfx/data/messages + engine only, and
   OMITS js/quests.js, js/journal-view.js, js/runtime/input.js — which the
   engine unconditionally requires at boot (window.RPGAtlasQuests.create /
   window.RPGAtlasJournalView.create / createInputSystem). This omission
   predates the refactor (verified against the baseline commit) and Stage A is
   behavior-frozen, so the export composition is preserved EXACTLY and this test
   asserts the SAME boot failure rather than a working title screen. When a
   later stage fixes the export composition (adding the missing deps), this test
   should be updated to assert a booting title screen — see phase-1-spec.md.

   GPL-3.0-or-later. */

import { test, expect } from "@playwright/test";
import { atlasQuestJson } from "./fixtures/atlas-quest.mjs";

// The boot error the (composition-frozen) export throws before it can render a
// title screen — the first missing dep the engine dereferences at boot.
const KNOWN_EXPORT_BOOT_ERROR = /Cannot read properties of undefined \(reading 'create'\)/;

async function buildExportHtml(page) {
  // Seed the sample project, then drive buildStandaloneGame in page context —
  // the same code the editor's "Export → Standalone HTML" menu item calls.
  await page.goto("/index.html");
  await page.evaluate((json) => localStorage.setItem("rpgatlas_project", json), atlasQuestJson());
  await page.goto("/index.html");
  await expect(page.locator("#menubar")).toBeVisible();

  return page.evaluate(async () => {
    const io = await import("/js/editor/project-io.js");
    const Assets = window.RPGAtlasDeps.Assets;
    const proj = JSON.parse(localStorage.getItem("rpgatlas_project"));
    const game = await io.buildStandaloneGame(proj, Assets);
    return game.html;
  });
}

test.describe("standalone export", () => {
  test("buildStandaloneGame inlines the player bundle and the classic deps", async ({ page }) => {
    const html = await buildExportHtml(page);

    // Non-trivial single-file document (project + assets + runtime inlined).
    expect(html.length).toBeGreaterThan(100_000);
    // Player bundle is inlined as a module (replacing the old inline engine.js);
    // its presence is proven by the engine's own boot-time global reads.
    expect(html).toMatch(/<script type="module">/);
    expect(html).toContain("window.RPGAtlasQuests.create");
    // Classic deps still inlined ahead of it, populating window globals.
    expect(html).toContain("window.createMessageSystem = createMessageSystem;");
    expect(html).toContain("window.RPGAtlasDeps = {");
    // The project JSON and title screen title are embedded.
    expect(html).toContain('id="rpgatlas-project"');
    expect(html).toContain("Atlas Quest");
  });

  test("exported game boots byte-functionally identically to the pre-refactor baseline", async ({ page, context }) => {
    const html = await buildExportHtml(page);

    const game = await context.newPage();
    const errors = [];
    game.on("pageerror", (err) => errors.push(String(err)));
    game.on("console", (msg) => {
      if (msg.type() !== "error") return;
      if (/Failed to load resource.*404/.test(msg.text())) return;
      errors.push(msg.text());
    });

    // setContent runs the inlined scripts in order, exactly as opening the
    // exported .html file would.
    await game.setContent(html, { waitUntil: "load" });

    // Behavior-frozen baseline: the composition-limited export throws at engine
    // boot before any title UI mounts (see file header). Assert we reproduce
    // that exact failure — proving the player bundle faithfully replaced the
    // inline engine.js without changing what the export ships.
    await expect
      .poll(() => errors.some((e) => KNOWN_EXPORT_BOOT_ERROR.test(e)), { timeout: 5000 })
      .toBe(true);
    // And, consistent with the baseline, no title screen is reached.
    expect(await game.locator(".titlewin").count()).toBe(0);

    await game.close();
  });
});
