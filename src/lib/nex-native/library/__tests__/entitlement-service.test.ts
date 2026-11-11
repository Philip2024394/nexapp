// src/lib/nex-native/library/__tests__/entitlement-service.test.ts
//
// Unit tests · chat-theme entitlement commercial separation.
// Owner-authorised 2026-11-11.

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isThemesPlusActive,
  canAccessChatTheme,
} from "../entitlement-service";

describe("isThemesPlusActive · pure helper", () => {
  it("returns false for null", () => {
    expect(isThemesPlusActive(null)).toBe(false);
  });
  it("returns false for invalid string", () => {
    expect(isThemesPlusActive("not-a-date")).toBe(false);
  });
  it("returns false for timestamp in the past", () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    expect(isThemesPlusActive(past)).toBe(false);
  });
  it("returns true for timestamp in the future", () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    expect(isThemesPlusActive(future)).toBe(true);
  });
});

// Mock the Supabase admin client so canAccessChatTheme() runs without
// a real DB. Each test reconfigures the mock for its scenario.
vi.mock("../../supabase-admin", () => {
  const client = {
    from: vi.fn(),
  };
  return { nexSupabaseAdmin: client };
});

import { nexSupabaseAdmin } from "../../supabase-admin";

function stubOwnership(rows: Array<{ id: string }>) {
  (nexSupabaseAdmin.from as any).mockImplementation((table: string) => {
    if (table === "nex_theme_ownership") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              is: () => ({
                limit: async () => ({ data: rows, error: null }),
              }),
            }),
          }),
        }),
      };
    }
    throw new Error(`unexpected table: ${table}`);
  });
}

describe("canAccessChatTheme · commercial separation", () => {
  beforeEach(() => {
    (nexSupabaseAdmin.from as any).mockReset?.();
    stubOwnership([]);  // default: no ownership rows
  });

  it("anonymous viewer gets free theme", async () => {
    const d = await canAccessChatTheme({ id: "default", tier: "gratis" }, null);
    expect(d).toEqual({ allow: true, reason: "free" });
  });

  it("anonymous viewer is denied premium", async () => {
    const d = await canAccessChatTheme({ id: "library-m-1", tier: "bisnis" }, null);
    expect(d).toEqual({ allow: false, reason: "not_signed_in" });
  });

  it("free theme always allowed for signed-in viewer", async () => {
    const d = await canAccessChatTheme(
      { id: "library-ireland-1", tier: "gratis" },
      { id: "acc-1", themes_plus_until: null },
    );
    expect(d).toEqual({ allow: true, reason: "free" });
  });

  it("CRITICAL · shop subscriber with NO themes_plus_until is DENIED premium chat theme", async () => {
    // This is the owner-sealed commercial separation: shop tier must
    // NOT automatically unlock premium chat themes. The account has
    // no themes_plus_until and no ownership. Must deny.
    const d = await canAccessChatTheme(
      { id: "library-m-1", tier: "bisnis" },
      { id: "shop-subscriber-acc", themes_plus_until: null },
    );
    expect(d).toEqual({ allow: false, reason: "themes_plus_required" });
  });

  it("CRITICAL · Themes Plus subscriber (future timestamp) can access premium", async () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const d = await canAccessChatTheme(
      { id: "library-m-1", tier: "bisnis" },
      { id: "plus-subscriber-acc", themes_plus_until: future },
    );
    expect(d).toEqual({ allow: true, reason: "themes_plus" });
  });

  it("CRITICAL · Lapsed Themes Plus (past timestamp) is denied premium", async () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const d = await canAccessChatTheme(
      { id: "library-m-1", tier: "bisnis" },
      { id: "lapsed-acc", themes_plus_until: past },
    );
    expect(d).toEqual({ allow: false, reason: "themes_plus_required" });
  });

  it("Legacy ownership · viewer owns the premium theme via nex_theme_ownership", async () => {
    stubOwnership([{ id: "own-row-1" }]);
    const d = await canAccessChatTheme(
      { id: "library-m-1", tier: "bisnis" },
      { id: "legacy-owner-acc", themes_plus_until: null },
    );
    expect(d).toEqual({ allow: true, reason: "owned" });
  });

  it("Pro tier theme requires Themes Plus too (same gate)", async () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const d = await canAccessChatTheme(
      { id: "pro-theme", tier: "pro" },
      { id: "plus-subscriber-acc", themes_plus_until: future },
    );
    expect(d).toEqual({ allow: true, reason: "themes_plus" });
  });
});
