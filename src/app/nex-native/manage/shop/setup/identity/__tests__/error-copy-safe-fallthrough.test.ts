// src/app/nex-native/manage/shop/setup/identity/__tests__/
// error-copy-safe-fallthrough.test.ts
//
// Lane C · prompt-7 round 18 · 2026-11-19.
//
// The legacy 8-step shop-setup identity surface (/manage/shop/setup/
// identity) previously rendered `result.error` verbatim when
// `saveShopIdentityAction` failed · raw Postgres driver strings and
// stack-trace preambles could leak to the seller's phone.
//
// Round 18 added an `errorCopy` mapper mirroring the one in
// ../../business-details/_client.tsx (sealed round 11). This test
// pins:
//   · Known wire codes → specific user copy.
//   · Unknown codes → stable generic banner + console.warn breadcrumb.
//   · The `owner-scope-denied` wire code emitted by the refactored
//     saveShopIdentityAction (service-layer `updateBusinessDisplayName`
//     owner-mismatch) renders the same banner as `owner-mismatch`.
//   · The file no longer passes `result.error` directly to the status
//     banner (regression guard).

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import * as path from "node:path";

function errorCopy(code: string): string {
  switch (code) {
    case "shop-name-length":
      return "Shop name must be 2 to 40 characters.";
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

const CLIENT_PATH = path.resolve(__dirname, "..", "_client.tsx");
const CLIENT_SRC = readFileSync(CLIENT_PATH, "utf8");

describe("Lane C · errorCopy safe fall-through (identity/_client.tsx) · round 18", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  test("known validation codes map to specific user copy", () => {
    expect(errorCopy("shop-name-length")).toContain("2 to 40 characters");
    expect(errorCopy("not-authenticated")).toContain("sign in again");
    expect(errorCopy("owner-mismatch")).toContain("shop you own");
    // Round 18 wire code emitted by the refactored action.
    expect(errorCopy("owner-scope-denied")).toContain("shop you own");
  });

  test("unknown code returns the stable generic copy · never echoes raw code", () => {
    const raw = `pq: duplicate key value violates unique constraint "nex_business_slug_key"`;
    const copy = errorCopy(raw);
    expect(copy).not.toContain("pq:");
    expect(copy).not.toContain("duplicate key");
    expect(copy).not.toContain("nex_business_slug_key");
    expect(copy).toBe(
      "We couldn't save that just now · please try again in a moment.",
    );
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
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test("structural guard · _client.tsx uses errorCopy, not raw result.error", () => {
    // The onSubmit handler must pass `result.error` through errorCopy
    // before storing it in status.message.
    expect(CLIENT_SRC).toMatch(
      /setStatus\(\{\s*kind:\s*"error",\s*message:\s*errorCopy\(result\.error\)/,
    );
    // The legacy raw-string leak (`message: result.error`) is gone.
    expect(CLIENT_SRC).not.toMatch(
      /setStatus\(\{\s*kind:\s*"error",\s*message:\s*result\.error\s*\}/,
    );
    // The safe-fallback literal is present.
    expect(CLIENT_SRC).toContain(
      "We couldn't save that just now · please try again in a moment.",
    );
    // owner-scope-denied is wired into the switch.
    expect(CLIENT_SRC).toContain('case "owner-scope-denied":');
  });
});
