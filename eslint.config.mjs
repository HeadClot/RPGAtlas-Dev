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
    // node:test suites (owned elsewhere). Both monoliths (engine.js, editor.js)
    // are fully dissolved into typed src/ modules as of Phase 1 Stages B and C,
    // so everything under src/ is linted.
    ignores: [
      "dist/**",
      "node_modules/**",
      "src-tauri/**",
      "js/**",
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
