/* RPGAtlas — src/engine/state/engine-context.ts
   The shared mutable engine context: the seam that replaces the monolith's
   closure variables (Phase 1 Stage B). Extracted modules read and write live
   engine state through `ctx` (project, scene, camera/shake/flash scalars, map
   runtime state, DOM roots, late-bound message/input systems) and reach
   engine functions that live in later-extracted modules — or still in the
   shrinking engine.js — through the `fns` forward-ref registry.

   While engine.js exists it installs getter/setter bridges over these fields
   so both the remaining closure code and the extracted modules observe the
   SAME live values (the generalized ctxScalars pattern from the interpreter
   extraction). When boot.ts replaces the monolith, the bridges go away and
   these become plain mutable fields. The initial values below mirror the
   monolith's `let` initializers. Typed loosely this phase; Stage D tightens.
   GPL-3.0-or-later (see LICENSE). */

/* eslint-disable @typescript-eslint/no-explicit-any */

export const ctx: any = {
  // project + DOM roots (set at boot)
  proj: null,
  stage: null,
  canvas: null,
  g2d: null, // the game canvas 2d context (the monolith's `ctx`)
  uiLayer: null,
  fader: null,
  // screen size (overridden at boot from system.screenWidth/Height)
  SCREEN_W: 0,
  SCREEN_H: 0,
  // scene flags
  scene: "boot", // boot | title | map | battle | gameover
  menuOpen: false,
  // camera / shake / flash scalars (written by interpreter command handlers)
  cameraZoom: 1,
  shakePower: 0,
  shakeSpeed: 0,
  shakeDuration: 0,
  shakeTimer: 0,
  flashColor: "#ffffff",
  flashOpacity: 0.5,
  flashDuration: 0,
  flashTimer: 0,
  // unified input system (created at wiring, rebound at boot)
  Input: null,
  // message system (late-bound: assigned at wiring)
  richText: null,
  showMessage: null,
  setMsgSpeed: null,
  // map runtime
  map: null,
  lowerBuf: null,
  upperBuf: null,
  hdActive: false, // current map renders through the WebGL HD-2D path
  evRTs: [],
  blockingRun: false, // an action/touch/autorun interpreter is active
  parallels: new Map(), // evRT -> running flag
  commonParallels: new Map(), // common event id -> running flag
  // map scene clock + fixed-timestep loop accumulator (render interpolates)
  globalT: 0,
  loopLast: 0,
  loopAcc: 0,
  // per-player overrides (input rebinds + audio/game settings)
  playerOptions: {},
  dashLatch: false,
  dashPrev: false,
};

/** Late-bound engine functions. Modules that need functions defined in
 *  later-extracted modules (or still in engine.js) call through here; each
 *  owner installs its entries before they can be called (boot, or engine.js
 *  module evaluation). */
export const fns: any = {};
