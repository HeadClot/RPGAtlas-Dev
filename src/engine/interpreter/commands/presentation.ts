/* RPGAtlas — src/engine/interpreter/commands/presentation.ts
   Presentation interpreter commands (Phase 1 Stage B), extracted verbatim from
   the monolith's Interp.exec switch: se, music, cameraZoom, shake, weather,
   flash. The camera/shake/flash timers live on the shared engine context
   (services.ctx), preserving the monolith's mutable-scalar semantics.
   GPL-3.0-or-later (see LICENSE). */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { registerCommand, type InterpContext } from "../registry.js";

export function registerPresentationCommands(): void {
  registerCommand("se", (c: any, { services }: InterpContext) => {
    services.Sfx.play(c.name);
  });

  registerCommand("music", (c: any, { services }: InterpContext) => {
    services.Music.play(c.theme);
  });

  registerCommand("cameraZoom", async (c: any, { services }: InterpContext) => {
    const ctx = services.ctx;
    const start = ctx.cameraZoom;
    const target = services.clamp(Number(c.zoom) || 1, 0.25, 4);
    const frames = Math.max(0, Math.floor(Number(c.frames) || 0));
    if (!frames) {
      ctx.cameraZoom = target;
    } else {
      await services.tickTween(frames, (t: number) => {
        ctx.cameraZoom = start + (target - start) * (t * t * (3 - 2 * t));
      });
    }
    ctx.cameraZoom = target;
  });

  registerCommand("shake", async (c: any, { services }: InterpContext) => {
    const ctx = services.ctx;
    ctx.shakePower = services.clamp(c.power || 5, 1, 9);
    ctx.shakeSpeed = services.clamp(c.speed || 5, 1, 9);
    ctx.shakeTimer = services.clamp(c.duration || 30, 1, 600);
    ctx.shakeDuration = ctx.shakeTimer;
    if (c.wait) {
      while (ctx.shakeTimer > 0) await services.frameWait();
    }
  });

  registerCommand("weather", (c: any) => {
    if ((window as any).Atlas && typeof (window as any).Atlas.weather === "function") {
      (window as any).Atlas.weather(c.kind, c.power);
    }
  });

  registerCommand("flash", async (c: any, { services }: InterpContext) => {
    const ctx = services.ctx;
    ctx.flashColor = c.color || "#ffffff";
    ctx.flashOpacity = services.clamp(Number(c.opacity) || 0.5, 0.01, 1.0);
    ctx.flashTimer = services.clamp(c.duration || 15, 1, 300);
    ctx.flashDuration = ctx.flashTimer;
    if (c.wait) {
      while (ctx.flashTimer > 0) await services.frameWait();
    }
  });
}
