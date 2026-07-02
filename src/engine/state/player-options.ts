/* RPGAtlas — src/engine/state/player-options.ts
   Per-player overrides (input rebinds + audio/game settings) and their
   setters, extracted verbatim from the js/engine.js monolith (Phase 1
   Stage B). Stored separately from the project so author defaults stay intact
   and a player's remaps/preferences persist across sessions; per-game
   namespaced like saveKey(). The mutable option state itself (playerOptions,
   dash latch scalars) lives on the shared engine context — the monolith's
   closure `let`s — so the remaining engine code and these setters observe the
   same values. GPL-3.0-or-later (see LICENSE). */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Music, Sfx } from "../../shared/deps.js";
import { clamp } from "../util.js";
import { ctx } from "./engine-context.js";

export function optionsKey(): string {
  const gameId = (window as any).RPGATLAS_GAME_ID;
  return gameId ? "rpgatlas_" + gameId + "_options" : "rpgatlas_options";
}
export function loadOptions(): any {
  try {
    const raw = localStorage.getItem(optionsKey());
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
export function saveOptions(): void {
  try {
    localStorage.setItem(optionsKey(), JSON.stringify(ctx.playerOptions));
  } catch {
    /* storage full or unavailable — options simply don't persist */
  }
}
// ---- player-option setters (mutate playerOptions + persist) ----
export function audioVol(ch: any): number {
  const a = ctx.playerOptions.audio || {};
  return a[ch] == null ? 1 : a[ch];
}
export function setOptAudio(ch: any, v: any): void {
  v = clamp(v, 0, 1);
  ctx.playerOptions.audio = ctx.playerOptions.audio || {};
  ctx.playerOptions.audio[ch] = v;
  if (ch === "master") Sfx.setMasterVolume(v);
  else if (ch === "bgm") {
    Sfx.setBgmVolume(v);
    if (v > 0 && !Music.enabled) Music.setEnabled(true);
  } else if (ch === "se") Sfx.setSeVolume(v);
  saveOptions();
}
export function setOpt(key: any, v: any): void {
  ctx.playerOptions[key] = v;
  saveOptions();
}
export function setOptTextSpeed(v: any): void {
  ctx.playerOptions.textSpeed = v;
  saveOptions();
  if (ctx.setMsgSpeed) ctx.setMsgSpeed(v);
}
// Dash mode (Options): Hold = held button; Toggle = tap to latch; Always On = always run.
export function wantsDash(): boolean {
  const m = ctx.playerOptions.dashMode || "hold";
  if (m === "always") return true;
  if (m === "toggle") return ctx.dashLatch;
  return ctx.Input.pressed("dash");
}
