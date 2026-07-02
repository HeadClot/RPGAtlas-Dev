/* RPGAtlas — src/engine/interpreter/commands/flow.ts
   Control-flow + dialogue interpreter commands (Phase 1 Stage B), extracted
   verbatim from the monolith's Interp.exec switch: text, choices, if,
   commonEvent, wait, script. Behavior unchanged — same control codes, same
   silent-skip on unknown types (handled by the registry). GPL-3.0-or-later. */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { registerCommand, type InterpContext } from "../registry.js";

export function registerFlowCommands(): void {
  registerCommand("text", async (c: any, { services }: InterpContext) => {
    await services.showMessage(c.name, c.text, c.face);
  });

  registerCommand("choices", async (c: any, { interp, services }: InterpContext) => {
    const i = await services.showList(
      c.options.map((o: any) => ({ html: services.richText(o) })),
      { className: "choicewin", cancellable: false },
    );
    await interp.runList(c.branches[i] || []);
  });

  registerCommand("if", async (c: any, { interp }: InterpContext) => {
    const ok2 = interp.testCond(c.cond);
    await interp.runList(ok2 ? c.then : c.else);
  });

  registerCommand("commonEvent", async (c: any, { interp }: InterpContext) => {
    await interp.callCommonEvent(c.commonEventId);
  });

  registerCommand("wait", async (c: any, { services }: InterpContext) => {
    await services.waitFrames(c.frames || 30);
  });

  registerCommand("script", async (c: any, { interp, services }: InterpContext) => {
    try {
      const api = Object.create(services.scriptApi);
      api.callCommonEvent = (id: any) => interp.callCommonEvent(id);
      const result = new Function("game", c.code)(api);
      if (result && typeof result.then === "function") await result;
    } catch (e) {
      console.error("Script command error:", e);
    }
    services.refreshAllPages();
  });
}
