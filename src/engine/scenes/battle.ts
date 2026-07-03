/* RPGAtlas — src/engine/scenes/battle.ts
   The turn-based battle scene, extracted verbatim from the js/engine.js
   monolith (Phase 1 Stage B): troop setup (stale enemy ids filtered, `.i`
   indexed off the FILTERED list — the battle-index invariant), front/side
   view layout, command collection, agility-ordered resolution, damage/
   crit/element math, states (poison/stun/regen ticks, turn expiry,
   battle-end shedding), escape odds, victory EXP/gold + level-up log, and
   defeat bookkeeping. The visual effects live in ./battle-fx.ts (the one
   natural seam in the scene); everything else is unchanged. The module
   self-installs fns.Battle for the plugin runtime's atlas.startBattle and
   the map scene's random encounters. GPL-3.0-or-later (see LICENSE). */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Assets, Music, RA, Sfx } from "../../shared/deps.js";
import { el, esc, sleep, clamp, rnd, sysSe, sysBgm } from "../util.js";
import { showList } from "../ui-stack.js";
import { ctx, fns } from "../state/engine-context.js";
import {
  G,
  actorClass,
  param,
  learnedSkills,
  skillMpCost,
  skillPowerRate,
  actorIncomingRate,
  skillElement,
  gainExp,
  invCount,
  onEnemyKilled,
  noteBattleFailure,
} from "../state/game-state.js";
import { useItemOn, iconEntryHtml, bar } from "./menus.js";
import { createBattleFx } from "./battle-fx.js";
import { playAnimation } from "../../shared/anim-player.js";

const TILE = Assets.TILE;

export const Battle: any = {
  async run(troopId: any, canEscape: any) {
    const proj = ctx.proj;
    const troop = RA.byId(proj.troops, troopId);
    if (!troop) return "win";
    const prevScene = ctx.scene,
      prevMusic = Music.current;
    ctx.scene = "battle";
    Music.play(sysBgm("battle"));

    // This statement stays verbatim, annotation-free JS: tests/battle-index.test.js
    // extracts its source text and executes it to pin the filtered-index invariant.
    const enemies = troop.enemies
      // @ts-expect-error -- untyped callback params, kept extractable as plain JS
      .map((eid) => {
        const d = RA.byId(proj.enemies, eid);
        return d ? { d, hp: d.stats.mhp, alive: true } : null;
      })
      .filter(Boolean)
      // @ts-expect-error -- untyped callback params, kept extractable as plain JS
      .map((en, i) => ((en.i = i), en));

    const sideView = proj.system.battleView === "side";
    const win = el("div", "battlewin" + (sideView ? " side" : ""));
    const fxLayer = el("div", "battle-fx");
    const enemyArea = el("div", "battle-enemies");
    const log = el("div", "battle-log");
    const partyArea = el("div", "battle-party");
    win.appendChild(fxLayer);
    if (sideView) {
      const fieldRow = el("div", "battle-field");
      fieldRow.appendChild(enemyArea);
      win.appendChild(fieldRow);
    } else {
      win.appendChild(enemyArea);
    }
    win.appendChild(log);
    win.appendChild(partyArea);
    ctx.uiLayer.appendChild(win);

    const sprs = enemies.map((en: any) => {
      const spriteClass = String(en.d.sprite || "slime").replace(
        /[^a-z0-9_-]/gi,
        "-",
      );
      const wrap = el("div", "enemy-spr enemy-" + spriteClass);
      const source = Assets.enemyCanvas(
        en.d.sprite,
        en.d.color,
        sideView ? 108 : 132,
      );
      const battlerCanvas = document.createElement("canvas");
      battlerCanvas.width = source.width;
      battlerCanvas.height = source.height;
      battlerCanvas.getContext("2d")!.drawImage(source, 0, 0);
      wrap.appendChild(battlerCanvas);
      wrap.appendChild(el("div", "enemy-name", esc(en.d.name)));
      wrap.appendChild(el("div", "battler-states"));
      enemyArea.appendChild(wrap);
      return wrap;
    });
    // side view: the party stands on the right, facing the enemies
    let actorSprs: any[] = [];
    if (sideView) {
      const actorArea = el("div", "battle-actors");
      win.querySelector(".battle-field")!.appendChild(actorArea);
      actorSprs = G.party.map((a: any) => {
        const wrap = el("div", "actor-spr");
        const ci = Assets.charsetIndex(a.charset);
        if (ci >= 0) {
          // copy the cached frame — the cache canvas itself must stay off-DOM
          const c = document.createElement("canvas");
          c.width = c.height = TILE;
          c.getContext("2d")!.drawImage(
            Assets.charFrameCanvas(ci, 1, 1),
            0,
            0,
          ); // facing left
          wrap.appendChild(c);
        }
        wrap.appendChild(el("div", "actor-name", esc(a.name)));
        wrap.appendChild(el("div", "battler-states"));
        actorArea.appendChild(wrap);
        return wrap;
      });
    }
    // Battle effects (particle pool, bursts, float text, projectiles) live in
    // ./battle-fx.ts — the factory closes over the same win/fxLayer nodes the
    // monolith's inner functions closed over.
    const fx = createBattleFx(win, fxLayer);
    const { burst, floatText, skillKind, travel, castFx } = fx;
    // ---- authored battle animations (Phase 5) ----
    // A skill/weapon with animationId plays its timeline INSTEAD of the legacy
    // castFx/travel/burst-Sfx effects; absent = the legacy path, verbatim.
    const animById = (id: any) => RA.byId(proj.animations || [], Number(id) || 0);
    function attackAnim(a: any) {
      const weapon = RA.byId(proj.weapons || [], Number(a.weaponId) || 0);
      return weapon ? animById(weapon.animationId) : null;
    }
    function battleShake() {
      win.classList.remove("shake");
      void win.offsetWidth;
      win.classList.add("shake");
    }
    function playBattleAnim(anim: any, sourceEl: any, targetEls: any[]) {
      return playAnimation(anim, {
        fx,
        source: sourceEl,
        targets: targetEls,
        onSound: (se: any) => Sfx.play(se),
        onShake: () => battleShake(),
        drawIcon(index: any) {
          // copy the cached icon frame — the cache canvas must stay off-DOM
          const src = Assets.iconCanvas(index);
          const c2 = document.createElement("canvas");
          c2.width = src.width;
          c2.height = src.height;
          c2.getContext("2d")!.drawImage(src, 0, 0);
          return c2;
        },
      });
    }
    function actorElement(a: any) {
      const i = G.party.indexOf(a);
      return actorSprs[i] || partyArea.children[i] || partyArea;
    }
    function battlerElement(b: any) {
      return b && b.d ? sprs[b.i] : actorElement(b);
    }
    function refreshParty() {
      partyArea.innerHTML = G.party
        .map(
          (a: any) =>
            '<div class="brow' +
            (a.hp <= 0 ? " dead" : "") +
            '"><b>' +
            esc(a.name) +
            "</b> " +
            "HP " +
            a.hp +
            "/" +
            param(a, "mhp") +
            " " +
            bar(a.hp, param(a, "mhp"), "#58c46a") +
            " MP " +
            a.mp +
            "/" +
            param(a, "mmp") +
            " " +
            bar(a.mp, param(a, "mmp"), "#5a8ad8") +
            stateTagsHtml(a) +
            "</div>",
        )
        .join("");
      actorSprs.forEach((w: any, i: any) => {
        const a = G.party[i];
        if (a) w.classList.toggle("dead", a.hp <= 0);
      });
    }
    function refreshEnemies() {
      enemies.forEach((en: any, i: any) => {
        sprs[i].classList.toggle("dead", !en.alive);
      });
    }
    async function say(text: any, ms?: any) {
      log.textContent = text;
      await sleep(ms == null ? 650 : ms);
    }
    function flash(i: any) {
      sprs[i].classList.remove("flash");
      void sprs[i].offsetWidth;
      sprs[i].classList.add("flash");
    }
    const livingE = () => enemies.filter((e: any) => e.alive);
    const livingP = () => G.party.filter((a: any) => a.hp > 0);
    function variance(v: any) {
      return Math.max(1, Math.floor(v * (0.85 + Math.random() * 0.3)));
    }

    async function pickTarget() {
      const live = livingE();
      if (live.length === 1) return live[0];
      const i = await showList(
        live.map((en: any) => ({ label: en.d.name + "  (HP " + en.hp + ")" })),
        { className: "targetwin" },
      );
      return i < 0 ? null : live[i];
    }
    async function pickAlly(deadOk: any) {
      const pool = deadOk ? G.party : livingP();
      const i = await showList(
        pool.map((a: any) => ({ label: a.name + "  (HP " + a.hp + ")" })),
        { className: "targetwin" },
      );
      return i < 0 ? null : pool[i];
    }

    async function actorCommand(a: any): Promise<any> {
      while (true) {
        const items = [
          { html: Assets.iconHtml(48, "menu-icon") + "Attack" },
          {
            html: Assets.iconHtml(8, "menu-icon") + "Skills",
            disabled: !learnedSkills(a).length,
          },
          {
            html: Assets.iconHtml(24, "menu-icon") + "Items",
            disabled: !proj.items.some((it: any) => invCount("item", it.id) > 0),
          },
          { html: Assets.iconHtml(22, "menu-icon") + "Guard" },
          {
            html: Assets.iconHtml(7, "menu-icon") + "Escape",
            disabled: !canEscape,
          },
        ];
        const i = await showList(items, {
          title: a.name,
          className: "cmdwin",
          cancellable: false,
        });
        if (i === 0) {
          const t = await pickTarget();
          if (t) return { type: "attack", target: t };
        } else if (i === 1) {
          const skills = learnedSkills(a);
          const si = await showList(
            skills.map((s: any) => ({
              html:
                iconEntryHtml(s) +
                ' <span class="cnt">' +
                skillMpCost(a, s) +
                " MP</span>",
              disabled: a.mp < skillMpCost(a, s),
            })),
            { title: "Skill", className: "cmdwin" },
          );
          if (si < 0) continue;
          const s = skills[si];
          if (s.scope === "enemy") {
            const t = await pickTarget();
            if (t) return { type: "skill", skill: s, target: t };
          } else if (s.scope === "ally") {
            const t = await pickAlly(false);
            if (t) return { type: "skill", skill: s, target: t };
          } else {
            return { type: "skill", skill: s };
          }
        } else if (i === 2) {
          const list = proj.items.filter((it: any) => invCount("item", it.id) > 0);
          const ii = await showList(
            list.map((it: any) => ({
              html:
                iconEntryHtml(it) +
                ' <span class="cnt">×' +
                invCount("item", it.id) +
                "</span>",
            })),
            { title: "Item", className: "cmdwin" },
          );
          if (ii < 0) continue;
          const t = await pickAlly(false);
          if (t) return { type: "item", item: list[ii], target: t };
        } else if (i === 3) {
          return { type: "guard" };
        } else if (i === 4) {
          return { type: "escape" };
        }
      }
    }

    function enemyAction(en: any): any {
      const acts =
        en.d.actions && en.d.actions.length
          ? en.d.actions
          : [{ skillId: 0, weight: 1 }];
      const total = acts.reduce((s: any, a2: any) => s + (a2.weight || 1), 0);
      let roll = Math.random() * total;
      let chosen = acts[0];
      for (const a2 of acts) {
        roll -= a2.weight || 1;
        if (roll <= 0) {
          chosen = a2;
          break;
        }
      }
      const skill = chosen.skillId
        ? RA.byId(proj.skills, chosen.skillId)
        : null;
      return { type: skill ? "skill" : "attack", skill, enemy: en };
    }

    async function dealToEnemy(en: any, dmg: any, idx: any, kind?: any) {
      const target = sprs[idx];
      const wasAlive = en.alive;
      en.hp -= dmg;
      flash(idx);
      burst(target, kind || "hit", {
        color: kind === "poison" ? "#a050d8" : null,
      });
      floatText(target, "-" + dmg, kind === "crit" ? "crit" : "damage");
      if (en.hp <= 0) {
        en.hp = 0;
        en.alive = false;
      }
      refreshEnemies();
      if (wasAlive && !en.alive) {
        onEnemyKilled(en.d.id);
        burst(target, "death", { count: 22, radius: 62, duration: 650 });
        floatText(target, "DEFEATED", "death");
      }
    }
    function actorDef(a: any) {
      return param(a, "def");
    }

    // ---- states (poison / stun / regen…) ----
    const stateDef = (id: any) => RA.byId(proj.states || [], id);
    const statesOf = (b: any) => b.states || (b.states = []);
    const isEnemy = (b: any) => !!b.d;
    const nameOf = (b: any) => (isEnemy(b) ? b.d.name : b.name);
    const maxHpOf = (b: any) => (isEnemy(b) ? b.d.stats.mhp : param(b, "mhp"));
    const aliveB = (b: any) => (isEnemy(b) ? b.alive : b.hp > 0);
    function cannotAct(b: any) {
      return statesOf(b).some((st: any) => {
        const d = stateDef(st.id);
        return d && d.restrict === "act";
      });
    }
    function stateTagsHtml(b: any) {
      return statesOf(b)
        .map((st: any) => {
          const d = stateDef(st.id);
          return d
            ? ' <span class="state-tag" style="color:' +
                esc(d.color || "#e8e8f4") +
                '">' +
                esc(d.name) +
                "</span>"
            : "";
        })
        .join("");
    }
    function refreshStates() {
      enemies.forEach((en: any, i: any) => {
        const slot = sprs[i].querySelector(".battler-states");
        if (slot) slot.innerHTML = stateTagsHtml(en);
      });
      actorSprs.forEach((w: any, i: any) => {
        const a = G.party[i],
          slot = w.querySelector(".battler-states");
        if (a && slot) slot.innerHTML = stateTagsHtml(a);
      });
      refreshParty();
    }
    async function addStateTo(b: any, stateId: any) {
      const d = stateDef(stateId);
      if (!d || !aliveB(b)) return;
      const min = Math.max(1, d.minTurns || 1);
      const max = Math.max(min, d.maxTurns || min);
      const turns = min + rnd(max - min + 1);
      const list = statesOf(b);
      const ex = list.find((st: any) => st.id === stateId);
      if (ex) ex.turns = Math.max(ex.turns, turns);
      else list.push({ id: stateId, turns });
      burst(battlerElement(b), stateId === 1 ? "poison" : "status", {
        color: d.color,
      });
      floatText(battlerElement(b), d.name.toUpperCase(), "state");
      refreshStates();
      await say(nameOf(b) + " is afflicted by " + d.name + "!", 600);
    }
    async function removeStateFrom(b: any, stateId: any) {
      const d = stateDef(stateId);
      const list = statesOf(b);
      const i = list.findIndex((st: any) => st.id === stateId);
      if (i < 0) return;
      list.splice(i, 1);
      burst(battlerElement(b), "heal", { color: d && d.color, count: 8 });
      refreshStates();
      if (d) await say(nameOf(b) + " is cured of " + d.name + ".", 600);
    }
    // roll a skill's state effect against a target
    async function applySkillState(skill: any, target: any) {
      if (!skill || !skill.stateId || !aliveB(target)) return;
      if (skill.stateOp === "remove") {
        await removeStateFrom(target, skill.stateId);
        return;
      }
      let chance = skill.stateChance == null ? 100 : skill.stateChance;
      if (!isEnemy(target))
        chance *= RA.traitRate(
          actorClass(target),
          "state",
          String(skill.stateId),
          1,
        );
      if (rnd(100) < chance) await addStateTo(target, skill.stateId);
    }
    // end-of-round damage/regen ticks and turn-count expiry
    async function tickStates() {
      for (const b of [...livingP(), ...livingE()]) {
        for (const st of statesOf(b).slice()) {
          const d = stateDef(st.id);
          const list = statesOf(b);
          if (!d) {
            list.splice(list.indexOf(st), 1);
            continue;
          }
          if (d.hpTurn && aliveB(b)) {
            let amt = Math.max(
              1,
              Math.floor((maxHpOf(b) * Math.abs(d.hpTurn)) / 100),
            );
            if (d.hpTurn < 0) {
              if (isEnemy(b))
                await dealToEnemy(b, amt, b.i, d.id === 1 ? "poison" : "hit");
              else {
                const tickElement = d.id === 1 ? "poison" : "magic";
                amt = Math.max(
                  1,
                  Math.floor(amt * actorIncomingRate(b, tickElement, false)),
                );
                b.hp = Math.max(0, b.hp - amt);
                actorFlash(b);
                burst(battlerElement(b), d.id === 1 ? "poison" : "hit", {
                  color: d.color,
                });
                floatText(battlerElement(b), "-" + amt, "damage");
              }
              await say(
                nameOf(b) + " takes " + amt + " damage from " + d.name + "!",
                550,
              );
              if (isEnemy(b) && !b.alive)
                await say(b.d.name + " is defeated!", 450);
              if (!isEnemy(b) && b.hp <= 0)
                await say(b.name + " falls!", 500);
            } else {
              b.hp = Math.min(maxHpOf(b), b.hp + amt);
              burst(battlerElement(b), "heal", { color: d.color });
              floatText(battlerElement(b), "+" + amt, "heal");
              await say(
                nameOf(b) + " recovers " + amt + " HP from " + d.name + "!",
                550,
              );
            }
            refreshParty();
            refreshEnemies();
          }
          st.turns--;
          if (st.turns <= 0) {
            list.splice(list.indexOf(st), 1);
            await say(nameOf(b) + "'s " + d.name + " wore off.", 500);
          }
        }
      }
      refreshStates();
    }
    // ---- side-view battler animations ----
    function actorFlash(a: any) {
      const w = actorSprs[G.party.indexOf(a)];
      if (!w) return;
      w.classList.remove("hurt");
      void w.offsetWidth;
      w.classList.add("hurt");
    }
    function actorStep(a: any) {
      const w = actorSprs[G.party.indexOf(a)];
      if (!w) return;
      w.classList.add("acting");
      burst(w, "dust", { count: 5, radius: 20, size: 5, duration: 330 });
      setTimeout(() => w.classList.remove("acting"), 380);
    }
    function enemyStep(en: any) {
      if (!sideView || !sprs[en.i]) return;
      sprs[en.i].classList.add("acting");
      burst(sprs[en.i], "dust", {
        count: 5,
        radius: 20,
        size: 5,
        duration: 330,
      });
      setTimeout(() => sprs[en.i].classList.remove("acting"), 380);
    }

    let result = null;
    try {
      await say("Enemies appear!", 700);
      battleLoop: while (true) {
        refreshParty();
        refreshEnemies();
        // ---- collect party commands ----
        const cmds = [];
        for (const a of livingP()) {
          refreshParty();
          if (cannotAct(a)) {
            cmds.push({ type: "stunned", actor: a });
            continue;
          }
          const c = await actorCommand(a);
          c.actor = a;
          if (c.type === "escape") {
            const pa =
              livingP().reduce((s: any, x: any) => s + param(x, "agi"), 0) /
              livingP().length;
            const ea =
              livingE().reduce((s: any, x: any) => s + x.d.stats.agi, 0) /
              livingE().length;
            const chance = clamp(0.55 + (pa - ea) * 0.03, 0.2, 0.95);
            if (Math.random() < chance) {
              sysSe("escape");
              await say("Got away safely!", 800);
              result = "escape";
              break battleLoop;
            } else {
              await say("Couldn't escape!", 700);
              cmds.length = 0;
              break; // enemies still act
            }
          }
          cmds.push(c);
        }
        const guards = new Set(
          cmds.filter((c: any) => c.type === "guard").map((c: any) => c.actor),
        );
        // ---- enemy commands ----
        for (const en of livingE()) cmds.push(enemyAction(en));
        // ---- sort by agility ----
        cmds.sort((x: any, y: any) => {
          const ax = x.actor ? param(x.actor, "agi") : x.enemy.d.stats.agi;
          const ay = y.actor ? param(y.actor, "agi") : y.enemy.d.stats.agi;
          return (
            ay * (0.8 + Math.random() * 0.4) -
            ax * (0.8 + Math.random() * 0.4)
          );
        });

        for (const c of cmds) {
          if (c.actor && c.actor.hp <= 0) continue;
          if (c.enemy && !c.enemy.alive) continue;
          if (c.actor) {
            // ---------- party side ----------
            const a = c.actor;
            if (c.type === "stunned") {
              await say(a.name + " can't move!", 500);
              continue;
            }
            if (c.type === "guard") {
              burst(actorElement(a), "status", {
                color: "#9ab8f0",
                count: 10,
                radius: 30,
              });
              floatText(actorElement(a), "GUARD", "state");
              await say(a.name + " guards.", 450);
              continue;
            }
            if (c.type === "item") {
              if (invCount("item", c.item.id) <= 0) continue;
              actorStep(a);
              useItemOn(c.item, c.target);
              burst(actorElement(c.target), "item", { count: 13 });
              floatText(
                actorElement(c.target),
                c.item.hp ? "+" + c.item.hp : "+" + c.item.mp + " MP",
                "heal",
              );
              refreshParty();
              await say(
                a.name +
                  " uses " +
                  c.item.name +
                  " on " +
                  c.target.name +
                  "!",
              );
              continue;
            }
            if (
              c.type === "attack" ||
              (c.type === "skill" && c.skill.scope === "enemy") ||
              (c.type === "skill" && c.skill.scope === "enemies")
            ) {
              const skill = c.type === "skill" ? c.skill : null;
              if (skill) {
                const cost = skillMpCost(a, skill);
                if (a.mp < cost) continue;
                a.mp -= cost;
              }
              const targets =
                skill && skill.scope === "enemies"
                  ? livingE().slice()
                  : [
                      c.target && c.target.alive ? c.target : livingE()[0],
                    ].filter(Boolean);
              const anim = skill ? animById(skill.animationId) : attackAnim(a);
              actorStep(a);
              if (skill && !anim) castFx(actorElement(a), skill, targets.length);
              if (anim)
                await playBattleAnim(
                  anim,
                  actorElement(a),
                  targets.map((t: any) => sprs[t.i]),
                );
              const hits = Math.max(1, Math.floor(Number(skill && skill.hits) || 1));
              for (const t of targets) {
                for (let hit = 0; hit < hits; hit++) {
                  if (!t.alive) break;
                  let dmg;
                  const critical =
                    (!skill || skill.type === "phys") &&
                    rnd(100) <
                      RA.traitSum(actorClass(a), "special", "critChance", 0);
                  if (!skill) {
                    dmg = variance(param(a, "atk") * 2 - t.d.stats.def * 1.2);
                    if (!anim) Sfx.play(critical ? "crit" : "hit");
                  } else if (skill.type === "phys") {
                    dmg = variance(
                      (skill.power +
                        param(a, "atk") * 2 -
                        t.d.stats.def * 1.2) *
                        skillPowerRate(a, skill),
                    );
                    if (!anim) Sfx.play("crit");
                  } else {
                    dmg = variance(
                      (skill.power +
                        param(a, "mat") * 2 -
                        t.d.stats.mdf * 1.5) *
                        skillPowerRate(a, skill),
                    );
                    if (!anim) Sfx.play("magic");
                  }
                  if (critical) dmg = Math.max(1, Math.floor(dmg * 1.5));
                  if (!anim) await travel(actorElement(a), sprs[t.i], skill);
                  await dealToEnemy(
                    t,
                    dmg,
                    t.i,
                    critical ? "crit" : skillKind(skill),
                  );
                  await say(
                    a.name +
                      (skill ? " casts " + skill.name : " attacks") +
                      " — " +
                      t.d.name +
                      " takes " +
                      dmg +
                      "!",
                    550,
                  );
                  if (!t.alive) await say(t.d.name + " is defeated!", 450);
                }
                await applySkillState(skill, t);
              }
            } else if (
              c.type === "skill" &&
              (c.skill.scope === "ally" || c.skill.scope === "allies")
            ) {
              const cost = skillMpCost(a, c.skill);
              if (a.mp < cost) continue;
              a.mp -= cost;
              const targets =
                c.skill.scope === "allies" ? livingP() : [c.target];
              const healAnim = animById(c.skill.animationId);
              if (!healAnim) Sfx.play("heal");
              actorStep(a);
              if (!healAnim) castFx(actorElement(a), c.skill, targets.length);
              if (healAnim)
                await playBattleAnim(
                  healAnim,
                  actorElement(a),
                  targets.map((t: any) => actorElement(t)),
                );
              for (const t of targets) {
                const amount = variance(
                  (c.skill.power + param(a, "mat") * 1.2) *
                    skillPowerRate(a, c.skill),
                );
                t.hp = clamp(t.hp + amount, 0, param(t, "mhp"));
                burst(actorElement(t), "heal", {
                  color: c.skill.color,
                  count: 14,
                });
                floatText(actorElement(t), "+" + amount, "heal");
                await say(
                  a.name +
                    " casts " +
                    c.skill.name +
                    " — " +
                    t.name +
                    " recovers " +
                    amount +
                    " HP!",
                  550,
                );
                await applySkillState(c.skill, t);
              }
              refreshParty();
            }
          } else {
            // ---------- enemy side ----------
            const en = c.enemy;
            if (cannotAct(en)) {
              await say(en.d.name + " can't move!", 500);
              continue;
            }
            const pool = livingP();
            if (!pool.length) break;
            const t = pool[rnd(pool.length)];
            const enemyAnim = c.skill ? animById(c.skill.animationId) : null;
            enemyStep(en);
            let dmg;
            if (c.skill && c.skill.type !== "heal") {
              const atkStat =
                c.skill.type === "phys" ? en.d.stats.atk : en.d.stats.mat;
              const defStat =
                c.skill.type === "phys" ? actorDef(t) : param(t, "mdf") * 1.5;
              dmg = variance(c.skill.power + atkStat * 2 - defStat);
              dmg = Math.max(
                1,
                Math.floor(
                  dmg *
                    actorIncomingRate(
                      t,
                      skillElement(c.skill),
                      guards.has(t),
                    ),
                ),
              );
              if (!enemyAnim) Sfx.play(c.skill.type === "phys" ? "hit" : "magic");
              if (enemyAnim) {
                await playBattleAnim(enemyAnim, sprs[en.i], [actorElement(t)]);
              } else {
                castFx(sprs[en.i], c.skill, 1);
                await travel(sprs[en.i], actorElement(t), c.skill);
              }
              await say(
                en.d.name +
                  " uses " +
                  c.skill.name +
                  " — " +
                  t.name +
                  " takes " +
                  dmg +
                  "!",
                550,
              );
            } else {
              dmg = variance(en.d.stats.atk * 2 - actorDef(t) * 1.2);
              dmg = Math.max(
                1,
                Math.floor(
                  dmg * actorIncomingRate(t, "physical", guards.has(t)),
                ),
              );
              Sfx.play("hit");
              await say(
                en.d.name + " attacks — " + t.name + " takes " + dmg + "!",
                550,
              );
            }
            t.hp = Math.max(0, t.hp - dmg);
            actorFlash(t);
            if (!enemyAnim)
              burst(actorElement(t), skillKind(c.skill), {
                color: c.skill && c.skill.color,
              });
            floatText(
              actorElement(t),
              "-" + dmg,
              c.skill && c.skill.type === "phys" ? "crit" : "damage",
            );
            if (t.hp <= 0) {
              burst(actorElement(t), "death", { count: 20, radius: 55 });
              floatText(actorElement(t), "FALLEN", "death");
            }
            win.classList.remove("shake");
            void win.offsetWidth;
            win.classList.add("shake");
            refreshParty();
            if (t.hp <= 0) await say(t.name + " falls!", 500);
            if (c.skill) await applySkillState(c.skill, t);
          }
          if (!livingE().length || !livingP().length) break;
        }
        if (livingE().length && livingP().length) await tickStates();
        if (!livingP().length) {
          result = "lose";
          break;
        }
        if (!livingE().length) {
          result = "win";
          break;
        }
      }

      if (result === "win") {
        const exp = enemies.reduce((s: any, e: any) => s + (e.d.exp || 0), 0);
        const gold = enemies.reduce((s: any, e: any) => s + (e.d.gold || 0), 0);
        Music.stop();
        sysSe("levelup");
        const lines: any[] = [];
        await say(
          "Victory!  +" + exp + " EXP, +" + gold + " " + proj.system.currency,
          900,
        );
        G.gold = clamp(G.gold + gold, 0, 9999999);
        for (const a of livingP()) gainExp(a, exp, (m: any) => lines.push(m));
        refreshParty();
        for (const m of lines) await say(m, 800);
      } else if (result === "lose") {
        noteBattleFailure(troopId, troop.enemies.map((id: any) => Number(id) || 0));
        await say("The party has fallen...", 1100);
      }
    } finally {
      // shed battle-only states (poison etc. configured to clear after battle)
      for (const a of G.party) {
        if (a.states)
          a.states = a.states.filter((st: any) => {
            const d = stateDef(st.id);
            return d && !d.removeAtEnd;
          });
      }
      win.remove();
      ctx.scene = prevScene;
      if (result !== "lose")
        Music.play(prevMusic || (ctx.map && ctx.map.music) || "none");
    }
    return result || "win";
  },
};

// The plugin runtime's atlas.startBattle and the map scene's random
// encounters reach the battle scene through fns.
fns.Battle = Battle;
