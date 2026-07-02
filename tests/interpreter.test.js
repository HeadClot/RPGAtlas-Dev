"use strict";

// Phase 1 Stage B migrated this from grepping js/engine.js source
// (`code.includes('case "shake":')`) to a behavior test against the extracted
// interpreter registry (src/engine/interpreter/). Interp.exec is now a registry
// lookup; the built-in commands live in src/engine/interpreter/commands/*.ts and
// register handlers by type. We bundle just the registry + built-in
// registration with esbuild (the same tool the player bundle uses) and assert
// the handlers are registered — the real dispatch path — then exercise one end
// to end. The `actor` conditional branch still lives in engine.js's
// Interp.testCond (not a registry command), so its logic is mirrored below as
// before.

const assert = require("node:assert/strict");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

// Bundle the registry + built-in command registration to a CJS module we can
// require in-process, exposing getCommand/registerCommand and a function that
// registers every built-in (matching what the engine does at boot).
async function loadRegistry() {
  const { build } = require("esbuild");
  const entry = `
    export { getCommand, registerCommand } from ${JSON.stringify(
      path.join(root, "src/engine/interpreter/registry.ts").replace(/\\/g, "/"),
    )};
    export { registerBuiltinCommands } from ${JSON.stringify(
      path.join(root, "src/engine/interpreter/commands/index.ts").replace(/\\/g, "/"),
    )};
  `;
  const out = (await build({
    stdin: { contents: entry, resolveDir: root, loader: "ts" },
    bundle: true,
    format: "cjs",
    write: false,
    platform: "node",
    logLevel: "silent",
  })).outputFiles[0].text;
  const module = { exports: {} };
  vm.runInNewContext(out, {
    module,
    exports: module.exports,
    require,
    console,
    window: {},
  });
  return module.exports;
}

(async () => {
  const { getCommand, registerBuiltinCommands } = await loadRegistry();
  registerBuiltinCommands();

  // The commands the old grep test pinned are registered handlers now.
  for (const type of ["shake", "weather", "flash", "text", "choices", "if",
    "switch", "var", "battle", "shop", "transfer", "commonEvent"]) {
    assert.equal(
      typeof getCommand(type),
      "function",
      "interpreter registers a handler for the '" + type + "' command",
    );
  }
  // Unknown command types resolve to undefined — the interpreter's silent-skip
  // (the old switch `default` when no plugin handler existed).
  assert.equal(getCommand("no-such-command"), undefined,
    "unknown command types are a silent no-op");

  // Behavior: the `shake` handler writes the clamped shake scalars onto the
  // shared engine context (services.ctx), exactly as the old case did.
  const ctx = {
    cameraZoom: 1, shakePower: 0, shakeSpeed: 0, shakeTimer: 0, shakeDuration: 0,
    flashColor: "#ffffff", flashOpacity: 0.5, flashTimer: 0, flashDuration: 0,
  };
  const services = { ctx, clamp: (v, a, b) => (v < a ? a : v > b ? b : v) };
  await getCommand("shake")({ t: "shake", power: 99, speed: 4, duration: 40 },
    { interp: {}, state: {}, services });
  assert.equal(ctx.shakePower, 9, "shake power is clamped to 9");
  assert.equal(ctx.shakeSpeed, 4, "shake speed passes through");
  assert.equal(ctx.shakeTimer, 40, "shake duration seeds the timer");
  assert.equal(ctx.shakeDuration, 40, "shake duration is recorded");

  // Behavior: the `switch` handler sets state + refreshes pages/quests.
  let refreshed = 0, quests = 0;
  const state = { switches: {} };
  await getCommand("switch")({ t: "switch", id: 5, val: true }, {
    interp: {}, state,
    services: { refreshAllPages: () => refreshed++, evaluateQuestFailures: () => quests++ },
  });
  assert.equal(state.switches[5], true, "switch command sets the switch");
  assert.equal(refreshed, 1, "switch command refreshes event pages");
  assert.equal(quests, 1, "switch command re-evaluates quest failures");

  // ---- actor conditional branch (still in engine.js Interp.testCond) ----
  function testCond(cond, G) {
    const actor = G.party.find((a) => a.actorId === cond.actorId);
    if (!actor) return false;
    if (cond.check === "inParty") return true;
    if (cond.check === "weapon") return actor.weaponId === cond.itemId;
    if (cond.check === "armor") return actor.armorId === cond.itemId;
    return true;
  }
  const G = {
    party: [
      { actorId: 1, weaponId: 10, armorId: 20 },
      { actorId: 2, weaponId: 0, armorId: 0 },
    ],
  };
  assert.equal(testCond({ kind: "actor", actorId: 1, check: "inParty" }, G), true);
  assert.equal(testCond({ kind: "actor", actorId: 3, check: "inParty" }, G), false);
  assert.equal(testCond({ kind: "actor", actorId: 1, check: "weapon", itemId: 10 }, G), true);
  assert.equal(testCond({ kind: "actor", actorId: 1, check: "weapon", itemId: 5 }, G), false);
  assert.equal(testCond({ kind: "actor", actorId: 1, check: "armor", itemId: 20 }, G), true);
  assert.equal(testCond({ kind: "actor", actorId: 2, check: "armor", itemId: 20 }, G), false);

  console.log("Interpreter registry and branching logic tests passed.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
