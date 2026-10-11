// src/lib/nex-native/__tests__/theme-view-service.test.ts
//
// Pure-helper regression for the Step 1G view-tracking service.
// Only `isValidThemeId` is exercised here · the DB-touching
// functions (`trackThemeView`, `listPopularThemeIds`,
// `getThemeViewStats`) are covered by live-DB integration against
// Supabase, not vitest.

import { describe, test, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
// theme-view-service imports supabase-admin at module load · the test
// only exercises the pure `isValidThemeId` helper so we stub the admin
// module to avoid the env-var requirement in vitest's bare env.
vi.mock("../supabase-admin", () => ({ nexSupabaseAdmin: null }));

import { isValidThemeId } from "../theme-view-service";

describe("isValidThemeId · theme-id shape", () => {
  test("accepts live-world ids", () => {
    expect(isValidThemeId("waterworld")).toBe(true);
    expect(isValidThemeId("nex-bubbles")).toBe(true);
    expect(isValidThemeId("nex-flat")).toBe(true);
    expect(isValidThemeId("coffee")).toBe(true);
    expect(isValidThemeId("botanical-cafe")).toBe(true);
    expect(isValidThemeId("midnight-cafe")).toBe(true);
    expect(isValidThemeId("french-cafe")).toBe(true);
    expect(isValidThemeId("food")).toBe(true);
    expect(isValidThemeId("pizza")).toBe(true);
    expect(isValidThemeId("bike-rental")).toBe(true);
  });

  test("accepts DB-registered legacy ids", () => {
    expect(isValidThemeId("haunted-hotel")).toBe(true);
    expect(isValidThemeId("theme-0")).toBe(true);
  });

  test("rejects empty / null / undefined", () => {
    expect(isValidThemeId("")).toBe(false);
    expect(isValidThemeId(null)).toBe(false);
    expect(isValidThemeId(undefined)).toBe(false);
  });

  test("rejects uppercase", () => {
    expect(isValidThemeId("Waterworld")).toBe(false);
    expect(isValidThemeId("NEX-BUBBLES")).toBe(false);
  });

  test("rejects underscores · spaces · dots · slashes", () => {
    expect(isValidThemeId("nex_bubbles")).toBe(false);
    expect(isValidThemeId("nex bubbles")).toBe(false);
    expect(isValidThemeId("nex.bubbles")).toBe(false);
    expect(isValidThemeId("nex/bubbles")).toBe(false);
  });

  test("rejects leading / trailing hyphen", () => {
    expect(isValidThemeId("-leading")).toBe(false);
    expect(isValidThemeId("trailing-")).toBe(false);
  });

  test("rejects over-length (> 64)", () => {
    expect(isValidThemeId("a" + "b".repeat(63) + "c")).toBe(false);
  });

  test("rejects path traversal / injection attempts", () => {
    expect(isValidThemeId("../etc/passwd")).toBe(false);
    expect(isValidThemeId("'; DROP TABLE--")).toBe(false);
    expect(isValidThemeId("coffee; INSERT")).toBe(false);
    expect(isValidThemeId("<script>")).toBe(false);
  });
});
