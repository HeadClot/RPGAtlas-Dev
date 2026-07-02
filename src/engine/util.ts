/* RPGAtlas — src/engine/util.ts
   Leaf utilities extracted verbatim from the js/engine.js monolith (Phase 1
   Stage B): DOM helper, async sleep, numeric helpers, and HTML escape. The
   system-tab sound/music key lookups (sysSe/sysBgm) read the live project, so
   they take a project provider the engine installs once at boot rather than
   reaching into the closure. Behavior unchanged. GPL-3.0-or-later (see LICENSE). */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Sfx } from "../shared/deps.js";

export function el(tag: string, cls?: string, html?: any): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}
export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
export function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}
export function rnd(n: number): number {
  return Math.floor(Math.random() * n);
}
export function compareVariable(a: any, b: any, cmp: any): boolean {
  switch (cmp) {
    case "==": return a === b;
    case "!=": return a !== b;
    case ">": return a > b;
    case ">=": return a >= b;
    case "<": return a < b;
    case "<=": return a <= b;
    default:
      throw new Error("Invalid comparator: " + cmp);
  }
}
export function esc(s: any): string {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// system-tab sound/music lookups (logical key -> chosen SE / theme). The engine
// installs the project provider at boot via setSysProjectProvider().
let getSysProject: () => any = () => null;
export function setSysProjectProvider(fn: () => any): void {
  getSysProject = fn;
}
export function sysSe(key: string): void {
  const proj = getSysProject();
  const m = (proj && proj.system && proj.system.sounds) || {};
  Sfx.play(m[key] || key);
}
export function sysBgm(key: string): string {
  const proj = getSysProject();
  const m = (proj && proj.system && proj.system.music) || {};
  return m[key] || key;
}
