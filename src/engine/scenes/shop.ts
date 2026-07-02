/* RPGAtlas — src/engine/scenes/shop.ts
   The shop scene, extracted verbatim from the js/engine.js monolith (Phase 1
   Stage B): buy (stock from the shop command's goods list, 99-cap and gold
   gating), sell (half price, everything owned across item/weapon/armor),
   and the running gold line. Logic unchanged. GPL-3.0-or-later. */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { RA } from "../../shared/deps.js";
import { clamp, sysSe } from "../util.js";
import { showList } from "../ui-stack.js";
import { ctx } from "../state/engine-context.js";
import { G, dbFor, invCount, addInv } from "../state/game-state.js";
import { iconEntryHtml } from "./menus.js";

export const Shop: any = {
  async run(goods: any) {
    const goldLine = () => "Gold: " + G.gold + " " + ctx.proj.system.currency;
    while (true) {
      const i = await showList(
        [{ label: "Buy" }, { label: "Sell" }, { label: "Leave" }],
        { title: "Shop — " + goldLine(), className: "shopwin" },
      );
      if (i < 0 || i === 2) return;
      if (i === 0) {
        while (true) {
          const entries = goods
            .map((gd: any) => ({ gd, e: RA.byId(dbFor(gd.kind), gd.id) }))
            .filter((x: any) => x.e);
          const bi = await showList(
            entries.map(({ gd, e }: any) => ({
              html:
                iconEntryHtml(e) +
                ' <span class="cnt">' +
                e.price +
                " " +
                ctx.proj.system.currency +
                " · own ×" +
                invCount(gd.kind, gd.id) +
                "</span>",
              disabled: G.gold < e.price || invCount(gd.kind, gd.id) >= 99,
              help:
                e.desc ||
                (e.params
                  ? Object.entries(e.params)
                      .map(([k, v]) => k.toUpperCase() + "+" + v)
                      .join(" ")
                  : ""),
            })),
            { title: "Buy — " + goldLine(), className: "shopwin" },
          );
          if (bi < 0) break;
          const { gd, e } = entries[bi];
          G.gold -= e.price;
          addInv(gd.kind, gd.id, 1);
          sysSe("equip");
        }
      } else {
        while (true) {
          const owned = [];
          for (const kind of ["item", "weapon", "armor"]) {
            for (const idStr of Object.keys(G.inv[kind])) {
              const e = RA.byId(dbFor(kind), +idStr);
              if (e) owned.push({ kind, e });
            }
          }
          if (!owned.length) {
            await ctx.showMessage("", "Nothing to sell.");
            break;
          }
          const si = await showList(
            owned.map(({ kind, e }: any) => ({
              html:
                iconEntryHtml(e) +
                ' <span class="cnt">×' +
                invCount(kind, e.id) +
                " · " +
                Math.floor(e.price / 2) +
                " " +
                ctx.proj.system.currency +
                "</span>",
            })),
            { title: "Sell — " + goldLine(), className: "shopwin" },
          );
          if (si < 0) break;
          const { kind, e } = owned[si];
          addInv(kind, e.id, -1);
          G.gold = clamp(G.gold + Math.floor(e.price / 2), 0, 9999999);
          sysSe("equip");
        }
      }
    }
  },
};
