/* RPGAtlas — scripts/package-exe.mjs
   Builds the self-contained desktop executable and drops it at the project
   root as RPGAtlas-Desktop.exe (alongside the browser launcher RPGAtlas.exe).
   Re-run this after changing engine code, since the desktop exe embeds the
   editor at build time. GPL-3.0-or-later. */

import { execSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FRONTEND_INCLUDE } from "../js/build-manifest.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const win = process.platform === "win32";
const builtName = win ? "rpgatlas.exe" : "rpgatlas";
const outName = win ? "RPGAtlas-Desktop.exe" : "RPGAtlas-Desktop";

const run = (cmd) => execSync(cmd, { cwd: root, stdio: "inherit" });

// The frontend embedded in the exe is the shared manifest's file set, staged by
// stage-frontend.mjs. Referencing it here keeps this consumer bound to the same
// single source of truth (kills the packaging-drift risk).
console.log("[package-exe] embedding frontend: " + FRONTEND_INCLUDE.join(", "));
run("node scripts/stage-frontend.mjs");
run("cargo build --release --manifest-path src-tauri/Cargo.toml");

const src = join(root, "src-tauri", "target", "release", builtName);
if (!existsSync(src)) {
  console.error("[package-exe] build output not found: " + src);
  process.exit(1);
}
const dst = join(root, outName);
copyFileSync(src, dst);
console.log("[package-exe] wrote " + dst);
