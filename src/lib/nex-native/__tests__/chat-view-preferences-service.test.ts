// src/lib/nex-native/__tests__/chat-view-preferences-service.test.ts
//
// NEX Chat · viewer-side chat view preferences service · unit tests.
// Owner-authorised 2026-11-07.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const store = vi.hoisted(() => ({
  accountRow: null as Record<string, unknown> | null,
  accountReadError: null as string | null,
  columnProbeFails: false,
  updateError: null as string | null,
  lastUpdatePatch: null as Record<string, unknown> | null,
}));

vi.mock("../supabase-admin", () => ({
  nexSupabaseAdmin: {
    from(table: string) {
      const chain = {
        select(_cols?: string) {
          return {
            eq(_c: string, _v: unknown) {
              return {
                async maybeSingle() {
                  if (table !== "nex_account") return { data: null, error: null };
                  if (store.accountReadError) {
                    return {
                      data: null,
                      error: { message: store.accountReadError },
                    };
                  }
                  return { data: store.accountRow, error: null };
                },
              };
            },
            async limit(_n: number) {
              if (table === "nex_account" && store.columnProbeFails) {
                return {
                  data: null,
                  error: { message: "column does not exist" },
                };
              }
              return { data: [], error: null };
            },
          };
        },
        update(patch: Record<string, unknown>) {
          store.lastUpdatePatch = patch;
          return {
            eq(_c: string, _v: unknown) {
              if (store.updateError) {
                return Promise.resolve({ error: { message: store.updateError } });
              }
              return Promise.resolve({ error: null });
            },
          };
        },
      };
      return chain;
    },
  },
}));

import {
  CHAT_FONT_FAMILIES,
  CHAT_FONT_SIZES,
  DEFAULT_CHAT_VIEW_PREFS,
  _resetChatViewPrefsColumnProbeCacheForTests,
  getChatViewPreferences,
  getChatViewPreferencesSafe,
  hasChatViewPrefsColumns,
  resetChatBackgroundSync,
  resetChatFont,
  resetChatProtection,
  resolveFontFamilyCss,
  resolveFontSizeCss,
  updateChatViewPreferences,
} from "../chat-view-preferences-service";

const ACCT = "00000000-0000-0000-0000-000000000011";

beforeEach(() => {
  store.accountRow = null;
  store.accountReadError = null;
  store.columnProbeFails = false;
  store.updateError = null;
  store.lastUpdatePatch = null;
  _resetChatViewPrefsColumnProbeCacheForTests();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ─── Catalogues ───────────────────────────────────────────────────────

describe("catalogues", () => {
  it("CHAT_FONT_FAMILIES has the 5 owner-sealed presets", () => {
    expect(CHAT_FONT_FAMILIES.map((f) => f.value)).toEqual([
      "default",
      "system",
      "serif",
      "monospace",
      "handwritten",
    ]);
    for (const f of CHAT_FONT_FAMILIES) {
      expect(f.label.length).toBeGreaterThan(0);
      expect(f.cssStack.length).toBeGreaterThan(0);
      expect(f.description.length).toBeGreaterThan(0);
    }
  });
  it("CHAT_FONT_SIZES has small/medium/large", () => {
    expect(CHAT_FONT_SIZES.map((f) => f.value)).toEqual([
      "small",
      "medium",
      "large",
    ]);
  });
});

// ─── Resolvers ────────────────────────────────────────────────────────

describe("CSS resolvers", () => {
  it("resolveFontFamilyCss returns the preset's cssStack", () => {
    expect(resolveFontFamilyCss("serif")).toContain("Georgia");
    expect(resolveFontFamilyCss("monospace")).toContain("monospace");
  });
  it("resolveFontFamilyCss falls back to default for unknown values", () => {
    expect(resolveFontFamilyCss("xyz" as never)).toContain("Inter");
  });
  it("resolveFontSizeCss returns pixel size", () => {
    expect(resolveFontSizeCss("small")).toBe("13px");
    expect(resolveFontSizeCss("medium")).toBe("15px");
    expect(resolveFontSizeCss("large")).toBe("17px");
  });
});

// ─── Column probe ─────────────────────────────────────────────────────

describe("hasChatViewPrefsColumns", () => {
  it("returns true when probe succeeds", async () => {
    store.columnProbeFails = false;
    expect(await hasChatViewPrefsColumns()).toBe(true);
  });
  it("returns false when probe fails (column absent · pre-migration)", async () => {
    store.columnProbeFails = true;
    expect(await hasChatViewPrefsColumns()).toBe(false);
  });
  it("caches first result · second call does not re-probe", async () => {
    store.columnProbeFails = false;
    expect(await hasChatViewPrefsColumns()).toBe(true);
    store.columnProbeFails = true;
    expect(await hasChatViewPrefsColumns()).toBe(true); // cached
  });
});

// ─── Getters ──────────────────────────────────────────────────────────

describe("getChatViewPreferences", () => {
  it("returns sealed defaults when columns absent", async () => {
    store.columnProbeFails = true;
    expect(await getChatViewPreferences(ACCT)).toEqual(DEFAULT_CHAT_VIEW_PREFS);
  });
  it("returns sealed defaults when row missing", async () => {
    store.accountRow = null;
    expect(await getChatViewPreferences(ACCT)).toEqual(DEFAULT_CHAT_VIEW_PREFS);
  });
  it("narrows + returns live values from the row", async () => {
    store.accountRow = {
      screenshot_copy_protection_enabled: true,
      chat_font_family: "serif",
      chat_font_size: "large",
      chat_bg_from_shop_cover: true,
      shop_cover_from_chat_theme: false,
    };
    expect(await getChatViewPreferences(ACCT)).toEqual({
      screenshot_copy_protection_enabled: true,
      chat_font_family: "serif",
      chat_font_size: "large",
      chat_bg_from_shop_cover: true,
      shop_cover_from_chat_theme: false,
    });
  });
  it("clamps unknown font family to default", async () => {
    store.accountRow = {
      screenshot_copy_protection_enabled: false,
      chat_font_family: "comic-wingdings",
      chat_font_size: "medium",
      chat_bg_from_shop_cover: false,
      shop_cover_from_chat_theme: false,
    };
    const p = await getChatViewPreferences(ACCT);
    expect(p.chat_font_family).toBe("default");
  });
  it("clamps unknown font size to medium", async () => {
    store.accountRow = {
      screenshot_copy_protection_enabled: false,
      chat_font_family: "default",
      chat_font_size: "xxl",
      chat_bg_from_shop_cover: false,
      shop_cover_from_chat_theme: false,
    };
    const p = await getChatViewPreferences(ACCT);
    expect(p.chat_font_size).toBe("medium");
  });
  it("throws on unrelated DB errors", async () => {
    store.accountReadError = "connection reset";
    await expect(getChatViewPreferences(ACCT)).rejects.toThrow(/connection/);
  });
  it("handles column-absence error gracefully → defaults", async () => {
    store.accountReadError = "column does not exist";
    expect(await getChatViewPreferences(ACCT)).toEqual(DEFAULT_CHAT_VIEW_PREFS);
  });
});

describe("getChatViewPreferencesSafe", () => {
  it("returns defaults on ANY error", async () => {
    store.accountReadError = "boom";
    expect(await getChatViewPreferencesSafe(ACCT)).toEqual(
      DEFAULT_CHAT_VIEW_PREFS,
    );
  });
});

// ─── Updates ──────────────────────────────────────────────────────────

describe("updateChatViewPreferences", () => {
  it("refuses to write when columns absent · throws migration-285 error", async () => {
    store.columnProbeFails = true;
    await expect(
      updateChatViewPreferences(ACCT, {
        screenshot_copy_protection_enabled: true,
      }),
    ).rejects.toThrow(/migration 285/);
  });
  it("narrows unknown font family · stores default", async () => {
    store.accountRow = {
      screenshot_copy_protection_enabled: false,
      chat_font_family: "default",
      chat_font_size: "medium",
      chat_bg_from_shop_cover: false,
      shop_cover_from_chat_theme: false,
    };
    await updateChatViewPreferences(ACCT, {
      chat_font_family: "invalid" as never,
    });
    expect(store.lastUpdatePatch?.chat_font_family).toBe("default");
  });
  it("writes new boolean + preserves others", async () => {
    store.accountRow = {
      screenshot_copy_protection_enabled: false,
      chat_font_family: "serif",
      chat_font_size: "large",
      chat_bg_from_shop_cover: false,
      shop_cover_from_chat_theme: false,
    };
    await updateChatViewPreferences(ACCT, {
      screenshot_copy_protection_enabled: true,
    });
    expect(store.lastUpdatePatch?.screenshot_copy_protection_enabled).toBe(true);
    expect(store.lastUpdatePatch?.chat_font_family).toBe("serif");
    expect(store.lastUpdatePatch?.chat_font_size).toBe("large");
  });
  it("throws on DB error (UI surfaces honest failure)", async () => {
    store.accountRow = {
      screenshot_copy_protection_enabled: false,
      chat_font_family: "default",
      chat_font_size: "medium",
      chat_bg_from_shop_cover: false,
      shop_cover_from_chat_theme: false,
    };
    store.updateError = "some pg error";
    await expect(
      updateChatViewPreferences(ACCT, {
        screenshot_copy_protection_enabled: true,
      }),
    ).rejects.toThrow(/some pg error/);
  });
});

// ─── Reset helpers ────────────────────────────────────────────────────

describe("reset helpers", () => {
  beforeEach(() => {
    store.accountRow = {
      screenshot_copy_protection_enabled: true,
      chat_font_family: "handwritten",
      chat_font_size: "large",
      chat_bg_from_shop_cover: true,
      shop_cover_from_chat_theme: true,
    };
  });
  it("resetChatProtection sets screenshot_copy_protection_enabled = false", async () => {
    await resetChatProtection(ACCT);
    expect(store.lastUpdatePatch?.screenshot_copy_protection_enabled).toBe(false);
    // other fields preserved
    expect(store.lastUpdatePatch?.chat_font_family).toBe("handwritten");
    expect(store.lastUpdatePatch?.chat_bg_from_shop_cover).toBe(true);
  });
  it("resetChatFont restores default/medium", async () => {
    await resetChatFont(ACCT);
    expect(store.lastUpdatePatch?.chat_font_family).toBe("default");
    expect(store.lastUpdatePatch?.chat_font_size).toBe("medium");
    expect(store.lastUpdatePatch?.screenshot_copy_protection_enabled).toBe(true);
  });
  it("resetChatBackgroundSync turns both toggles off", async () => {
    await resetChatBackgroundSync(ACCT);
    expect(store.lastUpdatePatch?.chat_bg_from_shop_cover).toBe(false);
    expect(store.lastUpdatePatch?.shop_cover_from_chat_theme).toBe(false);
    // font + protection preserved
    expect(store.lastUpdatePatch?.chat_font_family).toBe("handwritten");
    expect(store.lastUpdatePatch?.screenshot_copy_protection_enabled).toBe(true);
  });
});

// ─── Migration 285 SQL text sanity ────────────────────────────────────

describe("migration 285 · on-disk text sanity", () => {
  it("adds the 5 columns + both CHECK constraints", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync(
      "nex-supabase/migrations/285_nex_account_chat_view_preferences.sql",
      "utf8",
    );
    expect(src).toMatch(/screenshot_copy_protection_enabled boolean/i);
    expect(src).toMatch(/chat_font_family text/i);
    expect(src).toMatch(/chat_font_size text/i);
    expect(src).toMatch(/chat_bg_from_shop_cover boolean/i);
    expect(src).toMatch(/shop_cover_from_chat_theme boolean/i);
    expect(src).toMatch(/chat_font_family in \('default', 'system', 'serif', 'monospace', 'handwritten'\)/i);
    expect(src).toMatch(/chat_font_size in \('small', 'medium', 'large'\)/i);
  });
});
