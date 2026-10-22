// src/lib/nex-native/business-trial/__tests__/entitlements.test.ts
//
// G1 regression tests · K14 Option β verification · tests T20, T21, T23, T24, T25
// (negative-access tests from G1 Design Package §11.5).

import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
import {
  effectiveTrialEntitlements,
  hasShopAccess,
} from "../entitlements";

describe("effectiveTrialEntitlements · K14 Option β", () => {
  it("T21 · active trial grants shop:true · all other fields explicitly false", () => {
    const e = effectiveTrialEntitlements({ business_trial_status: "active" });
    expect(e.shop).toBe(true);
    // Explicit per-field negative assertions · prevents accidental elevation
    expect(e.vault).toBe(false);
    expect(e.themes_premium).toBe(false);
    expect(e.intros_premium).toBe(false);
    expect(e.p1_verified).toBe(false);
    expect(e.p2_boosted).toBe(false);
    expect(e.p3_cancel).toBe(false);
  });

  it("T20 adjacent · NULL status: shop:false · everything else false", () => {
    const e = effectiveTrialEntitlements({ business_trial_status: null });
    expect(e.shop).toBe(false);
    expect(e.vault).toBe(false);
    expect(e.themes_premium).toBe(false);
    expect(e.intros_premium).toBe(false);
    expect(e.p1_verified).toBe(false);
    expect(e.p2_boosted).toBe(false);
    expect(e.p3_cancel).toBe(false);
  });

  it("converted status · shop:false (shop access flows via effectiveTier=bisnis, not trial)", () => {
    const e = effectiveTrialEntitlements({ business_trial_status: "converted" });
    expect(e.shop).toBe(false);
    expect(e.vault).toBe(false);
  });

  it("expired status · shop:false · all fields false", () => {
    const e = effectiveTrialEntitlements({ business_trial_status: "expired" });
    expect(e.shop).toBe(false);
    expect(e.vault).toBe(false);
    expect(e.themes_premium).toBe(false);
    expect(e.intros_premium).toBe(false);
  });
});

describe("hasShopAccess · composition with existing tier semantics", () => {
  const NOW = new Date("2026-10-22T12:00:00Z").getTime();

  it("free account with no trial · no shop access", () => {
    const result = hasShopAccess(
      {
        business_trial_status: null,
        tier: "gratis",
        bisnis_expires_at: null,
        themes_trial_used_at: null,
      },
      NOW,
    );
    expect(result).toBe(false);
  });

  it("active business trial · shop access granted", () => {
    const result = hasShopAccess(
      {
        business_trial_status: "active",
        tier: "gratis",
        bisnis_expires_at: null,
        themes_trial_used_at: null,
      },
      NOW,
    );
    expect(result).toBe(true);
  });

  it("paid bisnis (unlapsed) · shop access granted", () => {
    const result = hasShopAccess(
      {
        business_trial_status: null,
        tier: "bisnis",
        bisnis_expires_at: new Date(NOW + 30 * 24 * 60 * 60 * 1000).toISOString(),
        themes_trial_used_at: null,
      },
      NOW,
    );
    expect(result).toBe(true);
  });

  it("paid bisnis (lapsed) · shop access denied", () => {
    const result = hasShopAccess(
      {
        business_trial_status: null,
        tier: "bisnis",
        bisnis_expires_at: new Date(NOW - 60 * 1000).toISOString(),
        themes_trial_used_at: null,
      },
      NOW,
    );
    expect(result).toBe(false);
  });

  it("active themes-trial · shop access granted (K1 themes elevation unchanged)", () => {
    const themesStart = new Date(NOW - 24 * 60 * 60 * 1000).toISOString(); // started 24h ago
    const result = hasShopAccess(
      {
        business_trial_status: null,
        tier: "gratis",
        bisnis_expires_at: null,
        themes_trial_used_at: themesStart,
      },
      NOW,
    );
    expect(result).toBe(true);
  });

  it("expired themes-trial (>168h ago) · shop access denied", () => {
    const themesStart = new Date(NOW - 200 * 60 * 60 * 1000).toISOString(); // 200h ago
    const result = hasShopAccess(
      {
        business_trial_status: null,
        tier: "gratis",
        bisnis_expires_at: null,
        themes_trial_used_at: themesStart,
      },
      NOW,
    );
    expect(result).toBe(false);
  });

  it("converted trial · relies on effectiveTier (bisnis) · not on trial status", () => {
    // After conversion, trial status is 'converted' but shop access comes
    // from tier='bisnis' set by G3 (future). Here we simulate what G3 will set.
    const result = hasShopAccess(
      {
        business_trial_status: "converted",
        tier: "bisnis",
        bisnis_expires_at: new Date(NOW + 30 * 24 * 60 * 60 * 1000).toISOString(),
        themes_trial_used_at: null,
      },
      NOW,
    );
    expect(result).toBe(true);
  });

  it("expired trial · no paid tier · shop access denied", () => {
    const result = hasShopAccess(
      {
        business_trial_status: "expired",
        tier: "gratis",
        bisnis_expires_at: null,
        themes_trial_used_at: null,
      },
      NOW,
    );
    expect(result).toBe(false);
  });
});
