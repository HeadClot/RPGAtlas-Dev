/* RPGAtlas — src/engine/interpreter/commands/world.ts
   World/scene interpreter commands (Phase 1 Stage B), extracted verbatim from
   the monolith's Interp.exec switch: transfer, move, save, gameover, totitle.
   Scene transitions and routing go through the engine services surface.
   GPL-3.0-or-later (see LICENSE). */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { registerCommand, type InterpContext } from "../registry.js";

export function registerWorldCommands(): void {
  registerCommand("transfer", async (c: any, { services }: InterpContext) => {
    await services.transferPlayer(c.mapId, c.x, c.y, c.dir);
  });

  registerCommand("move", async (c: any, { interp, state, services }: InterpContext) => {
    const target = c.target === "player" ? state.player : interp.evRT;
    if (!target) return;
    if (c.wait) {
      await new Promise<void>((res) =>
        services.setRoute(target, c.steps.slice(), res),
      );
    } else {
      services.setRoute(target, c.steps.slice(), null);
    }
  });

  registerCommand("save", async (_c: any, { services }: InterpContext) => {
    await services.saveLoadMenu("save");
  });

  registerCommand("gameover", async (_c: any, { services }: InterpContext) => {
    await services.gameOver();
  });

  registerCommand("totitle", async (_c: any, { services }: InterpContext) => {
    await services.toTitle();
  });
}
