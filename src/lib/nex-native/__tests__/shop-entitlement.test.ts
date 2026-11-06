// src/lib/nex-native/__tests__/shop-entitlement.test.ts
//
// Phase 4 Batch 4.5 · Shop Entitlement Contract § B2 LOCK · 2026-11-06.
// --------------------------------------------------------------------
// Covers `getShopEntitlement` fail-closed shim-phase behaviour.
// The predicate inside is delegated to the sealed `hasShopAccess`
// (K14 Option β 2026-10-22) · those semantics are covered by the
// existing `business-trial/__tests__/entitlements.test.ts`. Here we
// only assert the DB-adapter contract:
//   · active paid tier surfaces hasShop=true + periodEnd=Date
//   · lapsed paid tier surfaces hasShop=false + periodEnd=Date (past)
//   · free account surfaces hasShop=false + periodEnd=null
//   · account not found → DENY shape
//   · DB error → DENY shape (fail-closed)

import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const { fromMock, setResolver } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type AnyFn = (...a: any[]) => any;
  const state: { resolver: () => Promise<unknown> } = {
    resolver: async () => ({ data: null, error: null }),
  };
  const b: Record<string, AnyFn> = {};
  const bFn = () => b;
  b.select = bFn as AnyFn;
  b.eq = bFn as AnyFn;
  b.in = bFn as AnyFn;
  b.maybeSingle = (() => state.resolver()) as AnyFn;
  b.then = ((onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
    state.resolver().then(onF, onR)) as AnyFn;
  return {
    fromMock: vi.fn(() => b),
    setResolver: (fn: () => Promise<unknown>) => {
      state.resolver = fn;
    },
  };
});

vi.mock("@/lib/nex-native/supabase-admin", () => ({
  nexSupabaseAdmin: { from: fromMock },
  nexSupabaseProjectRef: () => "mock",
}));

const ACCOUNT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

beforeEach(() => {
  fromMock.mockClear();
  setResolver(async () => ({ data: null, error: null }));
});

describe("getShopEntitlement · DB-adapter contract", () => {
  test("tier='bisnis' + bisnis_expires_at in future → hasShop=true + periodEnd=Date", async () => {
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    setResolver(async () => ({
      data: {
        tier: "bisnis",
        bisnis_expires_at: future,
        themes_trial_used_at: null,
        business_trial_status: null,
      },
      error: null,
    }));
    const { getShopEntitlement } = await import("../shop-entitlement");
    const res = await getShopEntitlement(ACCOUNT);
    expect(res.hasShop).toBe(true);
    expect(res.periodEnd).toBeInstanceOf(Date);
    expect(res.periodEnd!.toISOString()).toBe(future);
  });

  test("tier='bisnis' + bisnis_expires_at in past → hasShop=false + periodEnd=Date (past)", async () => {
    const past = new Date(Date.now() - 60 * 1000).toISOString();
    setResolver(async () => ({
      data: {
        tier: "bisnis",
        bisnis_expires_at: past,
        themes_trial_used_at: null,
        business_trial_status: null,
      },
      error: null,
    }));
    const { getShopEntitlement } = await import("../shop-entitlement");
    const res = await getShopEntitlement(ACCOUNT);
    expect(res.hasShop).toBe(false);
    expect(res.periodEnd).toBeInstanceOf(Date);
    expect(res.periodEnd!.toISOString()).toBe(past);
  });

  test("tier='gratis' + no trial → hasShop=false + periodEnd=null", async () => {
    setResolver(async () => ({
      data: {
        tier: "gratis",
        bisnis_expires_at: null,
        themes_trial_used_at: null,
        business_trial_status: null,
      },
      error: null,
    }));
    const { getShopEntitlement } = await import("../shop-entitlement");
    const res = await getShopEntitlement(ACCOUNT);
    expect(res.hasShop).toBe(false);
    expect(res.periodEnd).toBeNull();
  });

  test("account not found → DENY shape", async () => {
    setResolver(async () => ({ data: null, error: null }));
    const { getShopEntitlement } = await import("../shop-entitlement");
    const res = await getShopEntitlement(ACCOUNT);
    expect(res.hasShop).toBe(false);
    expect(res.periodEnd).toBeNull();
  });

  test("DB error → DENY shape (fail-closed) + logs", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    setResolver(async () => ({
      data: null,
      error: { message: "simulated", code: "PG000" },
    }));
    const { getShopEntitlement } = await import("../shop-entitlement");
    const res = await getShopEntitlement(ACCOUNT);
    expect(res.hasShop).toBe(false);
    expect(res.periodEnd).toBeNull();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  test("active business trial (no paid tier) → hasShop=true + periodEnd=null", async () => {
    setResolver(async () => ({
      data: {
        tier: "gratis",
        bisnis_expires_at: null,
        themes_trial_used_at: null,
        business_trial_status: "active",
      },
      error: null,
    }));
    const { getShopEntitlement } = await import("../shop-entitlement");
    const res = await getShopEntitlement(ACCOUNT);
    expect(res.hasShop).toBe(true);
    expect(res.periodEnd).toBeNull();
  });
});
