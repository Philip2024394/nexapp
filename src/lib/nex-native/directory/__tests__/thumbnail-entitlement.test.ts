// src/lib/nex-native/directory/__tests__/thumbnail-entitlement.test.ts
//
// Pure precedence tests for resolveThumbnailAllowanceFromRaw.
// The DB-adapter getThumbnailAllowance is covered by integration tests
// elsewhere; here we assert every input combination of the sealed ladder.

import { describe, test, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/nex/db", () => ({ withClient: vi.fn() }));
vi.mock("@/lib/nex-native/supabase-admin", () => ({
  nexSupabaseAdmin: { from: vi.fn() },
}));

import {
  resolveThumbnailAllowanceFromRaw,
  UNCLAIMED_ALLOWANCE,
  CLAIMED_GRATIS_ALLOWANCE,
  BISNIS_ALLOWANCE,
  PRO_ALLOWANCE,
  LISTING_MERCHANDISING_RULES,
} from "../thumbnail-entitlement";

describe("resolveThumbnailAllowanceFromRaw · precedence ladder", () => {
  // ─── step 1 · unclaimed gate ─────────────────────────────────────

  test("UNVERIFIED lifecycle → 0 slots regardless of tier", () => {
    expect(
      resolveThumbnailAllowanceFromRaw({
        lifecycleState: "UNVERIFIED",
        effectiveTier: "bisnis",
        subscriptionPlan: "bisnis",
      }),
    ).toEqual(UNCLAIMED_ALLOWANCE);
  });

  test("VERIFIED lifecycle (not yet claimed) → 0 slots", () => {
    expect(
      resolveThumbnailAllowanceFromRaw({
        lifecycleState: "VERIFIED",
        effectiveTier: "bisnis",
        subscriptionPlan: null,
      }),
    ).toEqual(UNCLAIMED_ALLOWANCE);
  });

  test("DISCONTINUED → 0 slots", () => {
    expect(
      resolveThumbnailAllowanceFromRaw({
        lifecycleState: "DISCONTINUED",
        effectiveTier: "pro",
        subscriptionPlan: "custom",
      }),
    ).toEqual(UNCLAIMED_ALLOWANCE);
  });

  test("null lifecycle → 0 slots (fail-closed on unknown)", () => {
    expect(
      resolveThumbnailAllowanceFromRaw({
        lifecycleState: null,
        effectiveTier: "bisnis",
        subscriptionPlan: null,
      }),
    ).toEqual(UNCLAIMED_ALLOWANCE);
  });

  // ─── step 2 · owner lookup failed → fallback to gratis ────────────

  test("OWNER_CLAIMED + effectiveTier=null → Claimed Gratis (fail-closed, not Bisnis)", () => {
    expect(
      resolveThumbnailAllowanceFromRaw({
        lifecycleState: "OWNER_CLAIMED",
        effectiveTier: null,
        subscriptionPlan: null,
      }),
    ).toEqual(CLAIMED_GRATIS_ALLOWANCE);
  });

  test("owner lookup failure never silently upgrades · even with custom plan", () => {
    // When the owner can't be loaded, we don't know if the plan is real.
    // The resolver must NOT trust subscriptionPlan without a tier.
    expect(
      resolveThumbnailAllowanceFromRaw({
        lifecycleState: "OWNER_CLAIMED",
        effectiveTier: null,
        subscriptionPlan: "custom",
      }),
    ).toEqual(CLAIMED_GRATIS_ALLOWANCE);
  });

  // ─── step 3 · Pro reserved ───────────────────────────────────────

  test("OWNER_CLAIMED + Pro → 24 slots + featured + custom (reserved · same as 'custom')", () => {
    const r = resolveThumbnailAllowanceFromRaw({
      lifecycleState: "OWNER_CLAIMED",
      effectiveTier: "pro",
      subscriptionPlan: null,
    });
    expect(r).toEqual(PRO_ALLOWANCE);
    expect(r.slots).toBe(24);
    expect(r.featured).toBe(true);
    expect(r.custom).toBe(true);
  });

  // ─── step 4 · 'custom' subscription plan ─────────────────────────

  test("OWNER_CLAIMED + Gratis tier + subscription_plan=custom → 24 slots", () => {
    // Edge case: a Gratis account that bought Own Theme (Rp 1jt).
    // The ladder promises them 24 slots regardless of their underlying tier.
    const r = resolveThumbnailAllowanceFromRaw({
      lifecycleState: "OWNER_CLAIMED",
      effectiveTier: "gratis",
      subscriptionPlan: "custom",
    });
    expect(r.slots).toBe(24);
    expect(r.tierLabel).toBe("custom");
    expect(r.featured).toBe(true);
    expect(r.custom).toBe(true);
  });

  test("OWNER_CLAIMED + Bisnis tier + subscription_plan=custom → 24 slots (custom beats bisnis in precedence)", () => {
    const r = resolveThumbnailAllowanceFromRaw({
      lifecycleState: "OWNER_CLAIMED",
      effectiveTier: "bisnis",
      subscriptionPlan: "custom",
    });
    expect(r.slots).toBe(24);
    expect(r.tierLabel).toBe("custom");
  });

  // ─── step 5 · Bisnis tier ─────────────────────────────────────────

  test("OWNER_CLAIMED + Bisnis tier + no plan → 12 slots + featured", () => {
    const r = resolveThumbnailAllowanceFromRaw({
      lifecycleState: "OWNER_CLAIMED",
      effectiveTier: "bisnis",
      subscriptionPlan: "bisnis",
    });
    expect(r).toEqual(BISNIS_ALLOWANCE);
    expect(r.slots).toBe(12);
    expect(r.featured).toBe(true);
    expect(r.custom).toBe(false);
  });

  test("OWNER_VERIFIED + Bisnis tier → same as OWNER_CLAIMED (both are claimed states)", () => {
    const r = resolveThumbnailAllowanceFromRaw({
      lifecycleState: "OWNER_VERIFIED",
      effectiveTier: "bisnis",
      subscriptionPlan: "bisnis",
    });
    expect(r).toEqual(BISNIS_ALLOWANCE);
  });

  // ─── step 6 · 'ringan' subscription plan ─────────────────────────

  test("OWNER_CLAIMED + Gratis tier + subscription_plan=ringan → 6 slots (explicit merchandising rule)", () => {
    const r = resolveThumbnailAllowanceFromRaw({
      lifecycleState: "OWNER_CLAIMED",
      effectiveTier: "gratis",
      subscriptionPlan: "ringan",
    });
    expect(r.slots).toBe(6);
    expect(r.tierLabel).toBe("ringan");
    expect(r.featured).toBe(false);
    expect(r.custom).toBe(false);
  });

  // ─── step 7 · Claimed Gratis default ─────────────────────────────

  test("OWNER_CLAIMED + Gratis + no subscription → 3 slots", () => {
    const r = resolveThumbnailAllowanceFromRaw({
      lifecycleState: "OWNER_CLAIMED",
      effectiveTier: "gratis",
      subscriptionPlan: null,
    });
    expect(r).toEqual(CLAIMED_GRATIS_ALLOWANCE);
    expect(r.slots).toBe(3);
  });

  test("OWNER_CLAIMED + Gratis + subscription_plan=buy → 3 slots (one-shot theme does NOT upgrade merchandising)", () => {
    // Critical test: 'buy' is a one-shot theme purchase · it must NOT
    // sneak into the merchandising ladder.
    const r = resolveThumbnailAllowanceFromRaw({
      lifecycleState: "OWNER_CLAIMED",
      effectiveTier: "gratis",
      subscriptionPlan: "buy",
    });
    expect(r.slots).toBe(3);
    expect(r.tierLabel).toBe("gratis");
  });

  test("OWNER_CLAIMED + Gratis + subscription_plan=bisnis without tier upgrade → 3 slots", () => {
    // Edge case: subscription_plan='bisnis' set but tier NOT upgraded
    // (data inconsistency · admin forgot to flip tier). We MUST fall
    // through to Gratis rather than silently upgrading on the plan axis.
    // Only tier=bisnis grants 12 slots.
    const r = resolveThumbnailAllowanceFromRaw({
      lifecycleState: "OWNER_CLAIMED",
      effectiveTier: "gratis",
      subscriptionPlan: "bisnis",
    });
    expect(r.slots).toBe(3);
    expect(r.tierLabel).toBe("gratis");
  });

  // ─── downgrade behaviour (lapsed subscriptions) ──────────────────

  test("downgrade · effectiveTier returns 'gratis' when Bisnis lapsed · allowance follows", () => {
    // The caller passes effectiveTier (which already respects
    // bisnis_expires_at). Here we simulate the result: a lapsed Bisnis
    // user who was previously at 12 slots is now at 3 slots.
    // Downgrade preservation of DB rows happens at the resolver query
    // layer (LIMIT N), not here · this test asserts the allowance
    // correctly reports the current post-lapse number.
    const r = resolveThumbnailAllowanceFromRaw({
      lifecycleState: "OWNER_CLAIMED",
      effectiveTier: "gratis",  // because bisnis_expires_at < now()
      subscriptionPlan: "bisnis",  // still records what they bought
    });
    expect(r.slots).toBe(3);
  });

  test("downgrade from custom to gratis · 24 → 3", () => {
    // If someone's custom subscription is cancelled, subscription_plan
    // becomes null (admin unsets it). Allowance drops back to gratis.
    const r = resolveThumbnailAllowanceFromRaw({
      lifecycleState: "OWNER_CLAIMED",
      effectiveTier: "gratis",
      subscriptionPlan: null,
    });
    expect(r.slots).toBe(3);
  });

  // ─── theme/merchandising separation integrity ────────────────────

  test("LISTING_MERCHANDISING_RULES only couples ringan + custom · not buy or bisnis", () => {
    // This test documents the explicit coupling. If a product change
    // adds (or removes) a coupling, this test must be updated · which
    // forces a code reviewer to notice.
    const keys = Object.keys(LISTING_MERCHANDISING_RULES);
    expect(keys).toEqual(["ringan", "custom"]);
    expect(LISTING_MERCHANDISING_RULES.ringan).toBeDefined();
    expect(LISTING_MERCHANDISING_RULES.custom).toBeDefined();
    // Negative assertions: these must NOT be in the rules.
    expect(LISTING_MERCHANDISING_RULES).not.toHaveProperty("buy");
    expect(LISTING_MERCHANDISING_RULES).not.toHaveProperty("bisnis");
  });
});
