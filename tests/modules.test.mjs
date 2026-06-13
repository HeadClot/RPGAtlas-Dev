import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
async function importBrowserModule(relativePath) {
  const source = await fs.readFile(path.join(root, relativePath), "utf8");
  return import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
}
const {
  buildStandaloneGame,
  loadStoredProject,
  safeFileName,
  saveProject,
} = await importBrowserModule("js/editor/project-io.js");
const { createMessageSystem } = await importBrowserModule("js/runtime/messages.js");

class MemoryStorage {
  constructor(entries = {}) {
    this.entries = new Map(Object.entries(entries));
  }
  getItem(key) {
    return this.entries.has(key) ? this.entries.get(key) : null;
  }
  setItem(key, value) {
    this.entries.set(key, String(value));
  }
  removeItem(key) {
    this.entries.delete(key);
  }
}

const storage = new MemoryStorage({
  driftwood_project: JSON.stringify({ meta: { engine: "driftwood" }, system: {} }),
});
const migrated = loadStoredProject(storage, (project) => ({
  ...project,
  meta: { engine: "rpgatlas", version: 3 },
}));
assert.equal(migrated.meta.engine, "rpgatlas");
assert.ok(storage.getItem("rpgatlas_project"));
assert.equal(storage.getItem("driftwood_project"), null);

saveProject(storage, { meta: { engine: "rpgatlas" } });
assert.match(storage.getItem("rpgatlas_project"), /rpgatlas/);
assert.equal(safeFileName("My: Game!", "fallback"), "My_Game");

const messages = createMessageSystem({
  Assets: {},
  el() {},
  esc(value) {
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  },
  getPlugins: () => ({
    textProcessors: [(html) => html.replace("Gold", "<b>Gold</b>")],
  }),
  getProject: () => ({
    actors: [{ id: 2, name: "Mira" }],
    system: { currency: "Gold" },
  }),
  getState: () => ({ vars: { 4: 12 }, gold: 90 }),
  getUiLayer() {},
  pushUI() {},
  removeUI() {},
});
assert.equal(messages.convertText("\\n[2] has \\v[4]."), "Mira has 12.");
assert.equal(messages.richText("\\g"), "90 <b>Gold</b>");

const originalFetch = globalThis.fetch;
const originalFileReader = globalThis.FileReader;
globalThis.fetch = async (resource) => {
  const filePath = path.join(root, String(resource).replace(/\//g, path.sep));
  try {
    const bytes = await fs.readFile(filePath);
    return new Response(bytes, { status: 200 });
  } catch {
    return new Response("", { status: 404 });
  }
};
globalThis.FileReader = class {
  readAsDataURL(blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = "data:application/octet-stream;base64," +
        Buffer.from(buffer).toString("base64");
      this.onload();
    }, (error) => {
      this.error = error;
      this.onerror();
    });
  }
};

try {
  const game = await buildStandaloneGame(
    { system: { title: "Module Test" } },
    { exportUsedExternalAssets: async () => [] },
  );
  assert.equal(game.baseName, "Module_Test");
  assert.match(game.html, /<script type="importmap">/);
  assert.match(game.html, /data:text\/javascript;charset=utf-8/);
  assert.match(game.html, /<script type="module">/);
  assert.match(game.html, /import \{ createMessageSystem \} from "\.\/runtime\/messages\.js";/);
  if (process.env.RPGATLAS_WRITE_STANDALONE_SMOKE) {
    await fs.writeFile(path.join(root, "tests", "standalone-smoke.html"), game.html);
  }
} finally {
  globalThis.fetch = originalFetch;
  globalThis.FileReader = originalFileReader;
}

console.log("Module tests passed.");
