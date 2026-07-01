/* RPGAtlas — tests-unit/build-manifest.test.ts
   Sanity test proving the toolchain wiring: Vitest runs TS, and the shared build
   manifest is importable and well-formed. GPL-3.0-or-later. */

import { describe, expect, it } from "vitest";
// The manifest is plain ESM under js/; imported here at runtime for the test.
import {
  STANDALONE_EXPORT_FILES,
  FRONTEND_INCLUDE,
  HTML_ENTRIES,
  PASSTHROUGH_DIRS,
} from "../js/build-manifest.mjs";

describe("build-manifest", () => {
  it("lists standalone export files, engine.js included, css first", () => {
    expect(Array.isArray(STANDALONE_EXPORT_FILES)).toBe(true);
    expect(STANDALONE_EXPORT_FILES.length).toBeGreaterThan(0);
    expect(STANDALONE_EXPORT_FILES).toContain("js/engine.js");
    expect(STANDALONE_EXPORT_FILES[0]).toBe("css/play.css");
  });

  it("lists the full frontend include set and HTML entries", () => {
    expect(FRONTEND_INCLUDE).toContain("index.html");
    expect(FRONTEND_INCLUDE).toContain("play.html");
    expect(FRONTEND_INCLUDE).toContain("js");
    expect(HTML_ENTRIES).toEqual(["index.html", "play.html"]);
  });

  it("derives passthrough dirs as frontend include minus HTML entries", () => {
    expect(PASSTHROUGH_DIRS).toEqual(["css", "js", "img", "bin"]);
    for (const entry of HTML_ENTRIES) {
      expect(PASSTHROUGH_DIRS).not.toContain(entry);
    }
  });
});
