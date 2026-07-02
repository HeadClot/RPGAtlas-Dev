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
    // node:test suites (owned elsewhere). The two monoliths moved verbatim into
    // src/ in Phase 1 Stage A (engine.js/editor.js) are still legacy classic
    // source — they are converted to typed modules in Stages B/C and are
    // ignored until then so the move lands with zero diffs to their logic.
    ignores: [
      "dist/**",
      "node_modules/**",
      "src-tauri/**",
      "js/**",
      "src/engine/engine.js",
      "src/editor/editor.js",
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
