// src/app/nex-native/directory/__tests__/mock-page-gating.test.ts
//
// Phase A.1 regression · owner directive 2026-10-16 "mocks on page 1
// only · page 2+ shows real listings only". Structural anchor on the
// directory view's merge logic · fails if a future edit silently
// re-adds mocks to every page.

import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const VIEW_PATH = path.resolve(
  __dirname,
  "..",
  "_landing-directory-view.tsx",
);

function readView(): string {
  return fs.readFileSync(VIEW_PATH, "utf8");
}

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
}

describe("directory view · mocks appear on page 1 only", () => {
  it("the mocks assignment gates on page === 1 (NOT unconditional)", () => {
    const src = stripComments(readView());
    // The gate must involve the `page` variable AND an equality check
    // against 1. If a future edit removes the gate, this fails.
    expect(src).toMatch(/getMockSeedListings\(\)/);
    expect(src).toMatch(/page\s*===\s*1[\s\S]{0,80}getMockSeedListings/);
  });

  it("the SHOW_MOCK_SEEDS_ON_DIRECTORY constant is still present (owner can flip to false)", () => {
    const src = stripComments(readView());
    expect(src).toContain("SHOW_MOCK_SEEDS_ON_DIRECTORY");
  });
});
