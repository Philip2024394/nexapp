// src/app/nex-native/welcome/__tests__/vertical-intent.test.ts
//
// NEX · Vertical intent cookie · pure parse/serialize invariants.
// Phase A1 · owner-authorised 2026-10-20.
// -----------------------------------------------------------------------------
// These tests pin the client-safe helpers:
//   · parseVerticalIntent rejects any corrupted / unknown payload.
//   · serializeVerticalIntent emits a valid JSON string that
//     parseVerticalIntent round-trips.
//   · The sealed `WELCOME_VERTICAL_COOKIE` name is unchanged (any
//     rename breaks the clear semantic in saveBusinessActivationAction).
//
// The async `readVerticalIntent` and `clearVerticalIntent` helpers
// are wrappers over `next/headers` cookies() · they are exercised by
// the Playwright e2e flow, not here.

import { describe, expect, test } from "vitest";

import {
  parseVerticalIntent,
  serializeVerticalIntent,
  WELCOME_VERTICAL_COOKIE,
  WELCOME_VERTICAL_MAX_AGE_SECONDS,
  welcomeVerticalCookieOptions,
} from "../_welcome-intent";

describe("vertical intent · cookie contract", () => {
  test("cookie name is the sealed 'nex_welcome_vertical' token", () => {
    expect(WELCOME_VERTICAL_COOKIE).toBe("nex_welcome_vertical");
  });

  test("max-age is 24 hours", () => {
    expect(WELCOME_VERTICAL_MAX_AGE_SECONDS).toBe(60 * 60 * 24);
  });

  test("cookie options are http-only / sameSite lax / path / correct max-age", () => {
    const opts = welcomeVerticalCookieOptions();
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe("lax");
    expect(opts.path).toBe("/");
    expect(opts.maxAge).toBe(WELCOME_VERTICAL_MAX_AGE_SECONDS);
    expect(typeof opts.secure).toBe("boolean");
  });
});

describe("vertical intent · parseVerticalIntent", () => {
  test("accepts a well-formed Phase A1 payload", () => {
    const raw = JSON.stringify({ category: "accommodation", subtype: "villa" });
    expect(parseVerticalIntent(raw)).toEqual({
      category: "accommodation",
      subtype: "villa",
    });
  });

  test("accepts every Phase A1 (category, subtype) pair", () => {
    for (const subtype of ["villa", "homestay", "kost"] as const) {
      const raw = JSON.stringify({ category: "accommodation", subtype });
      expect(parseVerticalIntent(raw)).toEqual({
        category: "accommodation",
        subtype,
      });
    }
  });

  test.each([null, undefined, "", " "])("returns null for empty input %p", (input) => {
    expect(parseVerticalIntent(input as string | null | undefined)).toBeNull();
  });

  test("returns null for malformed JSON", () => {
    expect(parseVerticalIntent("{not json")).toBeNull();
    expect(parseVerticalIntent("[1,2,3")).toBeNull();
  });

  test("returns null for JSON of the wrong shape", () => {
    expect(parseVerticalIntent("null")).toBeNull();
    expect(parseVerticalIntent("[]")).toBeNull();
    expect(parseVerticalIntent('"accommodation"')).toBeNull();
    expect(parseVerticalIntent("123")).toBeNull();
    expect(parseVerticalIntent("{}")).toBeNull();
  });

  test("returns null for unknown category", () => {
    const raw = JSON.stringify({ category: "bogus", subtype: "villa" });
    expect(parseVerticalIntent(raw)).toBeNull();
  });

  test("returns null for unknown subtype", () => {
    const raw = JSON.stringify({
      category: "accommodation",
      subtype: "mansion",
    });
    expect(parseVerticalIntent(raw)).toBeNull();
  });

  test("returns null when category is non-string", () => {
    const raw = JSON.stringify({ category: 7, subtype: "villa" });
    expect(parseVerticalIntent(raw)).toBeNull();
  });

  test("returns null when subtype is non-string", () => {
    const raw = JSON.stringify({ category: "accommodation", subtype: null });
    expect(parseVerticalIntent(raw)).toBeNull();
  });

  // NOTE: the strict guard in parseVerticalIntent only validates the
  // (category, subtype) tokens against the vertical-presets registry.
  // The (category, subtype) PAIRING is enforced by the server action
  // on write (`rememberVerticalAction` calls `getPreset()` as a
  // final gate), not by the parse helper on read. A hand-crafted
  // mismatched pair would therefore parse here but would never be
  // written by the server action in the first place.
});

describe("vertical intent · serializeVerticalIntent", () => {
  test("emits a stable JSON string that round-trips", () => {
    const intent = { category: "accommodation" as const, subtype: "homestay" as const };
    const serialized = serializeVerticalIntent(intent);
    expect(parseVerticalIntent(serialized)).toEqual(intent);
  });

  test("only emits category + subtype keys (no extra fields leak)", () => {
    const intent = { category: "accommodation" as const, subtype: "kost" as const };
    const serialized = serializeVerticalIntent(intent);
    const parsed = JSON.parse(serialized) as Record<string, unknown>;
    expect(Object.keys(parsed).sort()).toEqual(["category", "subtype"]);
  });
});
