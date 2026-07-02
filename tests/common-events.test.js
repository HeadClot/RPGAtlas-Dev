"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const context = vm.createContext({
  console,
  Assets: { T: {} },
});
vm.runInContext(fs.readFileSync("js/plugins.js", "utf8"), context, { filename: "js/plugins.js" });
vm.runInContext(fs.readFileSync("js/data.js", "utf8"), context, { filename: "js/data.js" });

function evaluate(source) {
  return vm.runInContext(source, context);
}
const clone = (value) => JSON.parse(JSON.stringify(value));

assert.deepEqual(clone(evaluate("RA.defaultCommonEvent()")), {
  id: 0,
  name: "Common Event",
  trigger: "none",
  switchId: 0,
  commands: [],
});
assert.deepEqual(clone(evaluate("DataDefaults.newProject().commonEvents")), [],
  "new projects include an empty Common Events database");

const migrated = evaluate(`RA.migrateProject({
  meta: { engine: "rpgatlas", version: 3 },
  system: {},
  commonEvents: [
    { id: 4, name: "Clock", trigger: "parallel", switchId: "2", commands: [{ t: "wait", frames: 10 }] },
    { name: "", trigger: "invalid", switchId: -3, commands: null }
  ]
})`);
assert.deepEqual(clone(migrated.commonEvents), [
  { id: 4, name: "Clock", trigger: "parallel", switchId: 2, commands: [{ t: "wait", frames: 10 }] },
  { id: 2, name: "Common Event", trigger: "none", switchId: 0, commands: [] },
]);

assert.equal(evaluate("RA.commonEventEnabled({ switchId: 0 }, {})"), true,
  "no activation switch means always active");
assert.equal(evaluate("RA.commonEventEnabled({ switchId: 3 }, { 3: true })"), true,
  "selected switch ON enables automatic processing");
assert.equal(evaluate("RA.commonEventEnabled({ switchId: 3 }, { 3: false })"), false,
  "selected switch OFF disables automatic processing");

const editorSource = fs.readFileSync("src/editor/editor.js", "utf8");
const engineSource = fs.readFileSync("src/engine/engine.js", "utf8");
assert.match(editorSource, /\{ label: "Common Events"/, "Database exposes the Common Events tab");
assert.match(editorSource, /t: "commonEvent", label: "Call Common Event"/,
  "event command picker exposes Call Common Event");
// The `commonEvent` interpreter command moved to the extracted registry
// (src/engine/interpreter/commands/flow.ts) in Phase 1 Stage B. Assert the
// handler awaits interp.callCommonEvent by bundling and driving it, rather than
// grepping the (now-deleted) switch case. The Script-API bridge and the
// recursion guard moved to src/engine/{script-api,interpreter/interp}.ts and
// are behavior-tested below; the autorun/parallel scheduler still lives in
// engine.js.
assert.match(engineSource, /commonEvent\.trigger === "auto"/,
  "runtime schedules switch-enabled Autorun common events");
assert.match(engineSource, /commonEvent\.trigger !== "parallel"/,
  "runtime schedules switch-enabled Parallel common events");

(async () => {
  const { build } = require("esbuild");
  const path = require("node:path");
  const root = path.resolve(__dirname, "..");
  const entry = `
    export { getCommand } from ${JSON.stringify(
      path.join(root, "src/engine/interpreter/registry.ts").replace(/\\/g, "/"),
    )};
    export { registerBuiltinCommands } from ${JSON.stringify(
      path.join(root, "src/engine/interpreter/commands/index.ts").replace(/\\/g, "/"),
    )};
  `;
  const out = (await build({
    stdin: { contents: entry, resolveDir: root, loader: "ts" },
    bundle: true, format: "cjs", write: false, platform: "node", logLevel: "silent",
  })).outputFiles[0].text;
  const mod = { exports: {} };
  vm.runInNewContext(out, { module: mod, exports: mod.exports, require, console, window: {} });
  mod.exports.registerBuiltinCommands();
  const handler = mod.exports.getCommand("commonEvent");
  assert.equal(typeof handler, "function", "the interpreter registers a commonEvent handler");
  let called = null;
  await handler({ t: "commonEvent", commonEventId: 7 }, {
    interp: { callCommonEvent: async (id) => { called = id; } },
    state: {}, services: {},
  });
  assert.equal(called, 7, "the commonEvent command awaits interp.callCommonEvent with the id");

  // ---- Script-API bridge + recursion guard (moved out of engine.js in
  // Phase 1 Stage B) — behavior-tested through the real extracted modules:
  // game.callCommonEvent(id) runs the referenced common event through a FRESH
  // interpreter, and a common event that calls itself is skipped with a
  // console warning instead of recursing forever.
  const entry2 = `
    export { ctx } from ${JSON.stringify(
      path.join(root, "src/engine/state/engine-context.ts").replace(/\\/g, "/"),
    )};
    export { scriptApi } from ${JSON.stringify(
      path.join(root, "src/engine/script-api.ts").replace(/\\/g, "/"),
    )};
    export { Interp } from ${JSON.stringify(
      path.join(root, "src/engine/interpreter/interp.ts").replace(/\\/g, "/"),
    )};
    export { registerCommand } from ${JSON.stringify(
      path.join(root, "src/engine/interpreter/registry.ts").replace(/\\/g, "/"),
    )};
    export { registerBuiltinCommands } from ${JSON.stringify(
      path.join(root, "src/engine/interpreter/commands/index.ts").replace(/\\/g, "/"),
    )};
  `;
  const out2 = (await build({
    stdin: { contents: entry2, resolveDir: root, loader: "ts" },
    bundle: true, format: "cjs", write: false, platform: "node", logLevel: "silent",
  })).outputFiles[0].text;
  const warns = [];
  const mod2 = { exports: {} };
  vm.runInNewContext(out2, {
    module: mod2, exports: mod2.exports, require,
    console: { ...console, warn: (...args) => warns.push(args.join(" ")) },
    // The deps seam reads window.RPGAtlasDeps at module evaluation; the
    // interpreter only needs RA.byId here.
    window: { RPGAtlasDeps: { RA: { byId: (list, id) => list.find((e) => e.id === id) || null } } },
  });
  const engine = mod2.exports;
  engine.registerBuiltinCommands();
  const ran = [];
  engine.registerCommand("probe", () => { ran.push("probe"); });
  engine.ctx.proj = {
    commonEvents: [
      { id: 7, commands: [{ t: "probe" }] },
      { id: 9, commands: [{ t: "probe" }, { t: "commonEvent", commonEventId: 9 }] },
    ],
  };
  assert.equal(await engine.scriptApi.callCommonEvent(7), true,
    "game.callCommonEvent(id) runs the common event through a fresh interpreter");
  assert.deepEqual(ran, ["probe"], "the common event's commands executed");
  ran.length = 0;
  assert.equal(await new engine.Interp(null).callCommonEvent(9), true,
    "a self-calling common event still completes");
  assert.deepEqual(ran, ["probe"], "the recursive self-call was skipped, not re-run");
  assert.ok(
    warns.some((w) => w.includes("Skipped recursive common event call")),
    "the recursion guard logs a warning",
  );

  console.log("Common event tests passed.");
})().catch((e) => { console.error(e); process.exit(1); });
