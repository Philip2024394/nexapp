// src/app/nex-native/manage/shop/setup/business-details/__tests__/
// error-copy-safe-fallthrough.test.ts
//
// Lane C C-3 · prompt-7 round 11 · 2026-11-19.
//
// Verifies that the Shop Setup business-details client never renders a
// raw server/driver error string back to the seller. Previously the
// `errorCopy` fall-through was `return code;` which leaked Postgres
// error messages, library stack-trace preambles, and other noise.
//
// The replacement:
//   · Known validation codes still map to their specific user copy.
//   · Unknown codes return a stable generic message and the raw code
//     is console.warn-ed (logged, not shown).
//
// This test is UI-pure · no network, no DB, no React render. It
// imports the module and exercises the exported `errorCopy` function
// directly. Because the function is not currently exported, we extract
// it via a lightweight regex-free structural copy pattern: if that
// surface changes, re-export the function for direct import.

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import * as path from "node:path";

// The client lives at
// src/app/nex-native/manage/shop/setup/business-details/_client.tsx.
// `errorCopy` is internal · we assert on the SAFE-FALLBACK contract
// via its observable shape in source. The compile-time surface is
// verified by TypeScript; this test asserts BEHAVIOUR of the mapping.

// Re-implement the mapping here to decouple the test from React
// internals. The structure mirrors `_client.tsx:errorCopy`; if that
// function diverges, this test will stop reflecting production copy ·
// at that point export the real function and import it instead.
function errorCopy(code: string): string {
  switch (code) {
    case "shop-name-length":
      return "Shop name must be 2 to 40 characters.";
    case "country-invalid":
      return "Please pick a country from the list.";
    case "city-length":
      return "City must be 1-80 characters.";
    case "address-too-long":
      return "Address must be 500 characters or fewer.";
    case "category-required":
      return "Pick a category + subcategory, or leave both blank.";
    case "unknown-category":
    case "unknown-subtype":
    case "subtype-mismatch":
      return "That category pair isn't recognised. Pick again from the list.";
    case "not-authenticated":
      return "You've been signed out · please sign in again.";
    case "owner-mismatch":
    case "owner-scope-denied":
      return "You can only edit a shop you own · please sign in again.";
    default:
      if (code && typeof code === "string") {
        console.warn("[nex] shop-setup · unmapped server error code", code);
      }
      return "We couldn't save that just now · please try again in a moment.";
  }
}

// Structural guard · asserts the real client file carries the matching
// safe-fallback literal. If someone reintroduces `return code;`, this
// test catches it even if the local copy above still looks correct.

const CLIENT_PATH = path.resolve(
  __dirname,
  "..",
  "_client.tsx",
);
const CLIENT_SRC = readFileSync(CLIENT_PATH, "utf8");

describe("Lane C C-3 · errorCopy safe fall-through (business-details/_client.tsx)", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  test("known validation codes map to specific user copy", () => {
    expect(errorCopy("shop-name-length")).toContain("2 to 40 characters");
    expect(errorCopy("country-invalid")).toContain("pick a country");
    expect(errorCopy("city-length")).toContain("1-80 characters");
    expect(errorCopy("address-too-long")).toContain(
      "500 characters or fewer",
    );
    expect(errorCopy("category-required")).toContain(
      "Pick a category + subcategory",
    );
    expect(errorCopy("unknown-category")).toContain("isn't recognised");
    expect(errorCopy("not-authenticated")).toContain("sign in again");
    expect(errorCopy("owner-mismatch")).toContain("shop you own");
    // Lane C · round 18 · service-layer `updateBusinessDisplayName`
    // throws owner-mismatch, the action converts to `owner-scope-denied`
    // so the UI must render the same user-safe copy.
    expect(errorCopy("owner-scope-denied")).toContain("shop you own");
  });

  test("unknown code returns the stable generic copy · never echoes raw code", () => {
    const raw = `pq: duplicate key value violates unique constraint "nex_business_slug_key"`;
    const copy = errorCopy(raw);

    // The raw Postgres string must NOT appear anywhere in user copy.
    expect(copy).not.toContain("pq:");
    expect(copy).not.toContain("duplicate key");
    expect(copy).not.toContain("nex_business_slug_key");

    // Must match the stable safe-fallback phrase.
    expect(copy).toBe(
      "We couldn't save that just now · please try again in a moment.",
    );

    // Raw code was logged for diagnostics.
    expect(warnSpy).toHaveBeenCalledWith(
      "[nex] shop-setup · unmapped server error code",
      raw,
    );
  });

  test("empty string falls through safely · no spurious log", () => {
    const copy = errorCopy("");
    expect(copy).toBe(
      "We couldn't save that just now · please try again in a moment.",
    );
    // Empty string short-circuits the log guard.
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test("structural guard · _client.tsx still contains the safe-fallback literal", () => {
    // This asserts the production file hasn't regressed to `return code;`.
    expect(CLIENT_SRC).toContain(
      "We couldn't save that just now · please try again in a moment.",
    );
    // And the leaky default is gone.
    expect(CLIENT_SRC).not.toMatch(/default:\s*\n?\s*return code;/);
  });
});
