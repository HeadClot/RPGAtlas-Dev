/* RPGAtlas — vitest.config.mjs
   Vitest for new code. The legacy suites keep running under `node --test`
   (npm test); Vitest owns TS/ESM unit tests under src/ and tests-unit/.
   GPL-3.0-or-later. */

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // Only pick up the new Vitest specs; the node:test suites in tests/ are run
    // separately by `npm test` and must not be double-collected here.
    include: [
      "src/**/*.{test,spec}.{js,mjs,ts}",
      "tests-unit/**/*.{test,spec}.{js,mjs,ts}",
    ],
  },
});
