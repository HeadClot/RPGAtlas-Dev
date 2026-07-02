/* RPGAtlas — eslint.config.mjs (ESLint 9 flat config)
   Scoped deliberately: lint covers new code (src/, tests-unit/) and the repo's
   config/tooling files. The existing js/ frontend (classic scripts) is
   intentionally NOT linted so this toolchain lands with zero diffs to legacy
   source; those
   files are converted module-by-module in later phases. GPL-3.0-or-later. */

import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  {
    // Never lint build output, deps, the desktop crate, legacy JS, or the
    // node:test suites (owned elsewhere). The engine monolith moved verbatim
    // into src/ in Phase 1 Stage A (engine.js) is still legacy classic source
    // — it is converted to typed modules in Stage B and is ignored until then
    // so the move lands with zero diffs to its logic. (editor.js is fully
    // dissolved into typed modules as of Stage C Package 3.)
    ignores: [
      "dist/**",
      "node_modules/**",
      "src-tauri/**",
      "js/**",
      "src/engine/engine.js",
      "tests/**",
      "tools/**",
      "wiki/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,ts}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node },
    },
  },
];
