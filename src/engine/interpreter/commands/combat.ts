/* RPGAtlas — src/engine/interpreter/commands/combat.ts
   Combat/economy interpreter commands (Phase 1 Stage B), extracted verbatim
   from the monolith's Interp.exec switch: battle, shop. `battle` still triggers
   the game-over flow on a loss unless the command opts out (c.lose).
   GPL-3.0-or-later (see LICENSE). */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { registerCommand, type InterpContext } from "../registry.js";

export function registerCombatCommands(): void {
  registerCommand("battle", async (c: any, { services }: InterpContext) => {
    const result = await services.Battle.run(c.troopId, c.escape !== false);
    if (result === "lose" && !c.lose) await services.gameOver();
  });

  registerCommand("shop", async (c: any, { services }: InterpContext) => {
    await services.Shop.run(c.goods || []);
  });
}
