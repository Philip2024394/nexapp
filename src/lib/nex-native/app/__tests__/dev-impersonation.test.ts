// src/lib/nex-native/app/__tests__/dev-impersonation.test.ts
//
// Regression tests for the dev-impersonation gate.
// Owner directive 2026-11-07 · Item 1 · "add a production hard-fail
// check using VERCEL_ENV". These tests exercise the gate through the
// public `devImpersonationHandle()` surface which returns null when
// the gate is OFF and the handle string when the gate is ON.

import { afterEach, describe, expect, it, vi } from "vitest";

// Mock "server-only" so importing the module under test doesn't
// explode under vitest's node env. Pattern matches other nex-native
// service tests in this repo.
vi.mock("server-only", () => ({}));
// Supabase admin client is imported for the persona loader but never
// invoked by the gate itself. Replace with a null stub.
vi.mock("../../supabase-admin", () => ({ nexSupabaseAdmin: null }));
// Session resolver is imported for the real-session fallback path but
// also never invoked by the gate itself.
vi.mock("../session", () => ({
  resolveNexAppSessionFromContext: vi.fn(),
}));

import { devImpersonationHandle } from "../dev-impersonation";

describe("dev-impersonation · VERCEL_ENV=production hard-fail (Item 1)", () => {
  afterEach(() => {
    // Restore every env var we stubbed so other suites aren't affected.
    vi.unstubAllEnvs();
  });

  it("refuses impersonation when VERCEL_ENV=production even with a handle + non-prod Supabase URL set", () => {
    // Set the exact pathological combination: impersonation vars
    // present, Supabase URL points at a sandbox project ref (which
    // would have passed the prior check on its own), NODE_ENV also
    // production. Only VERCEL_ENV=production is new. Gate must
    // refuse regardless.
    vi.stubEnv("NEX_DEV_IMPERSONATE_HANDLE", "hendra");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEX_SUPABASE_URL", "https://kdstoyyeygcopkogqsyv.supabase.co");

    expect(devImpersonationHandle()).toBeNull();
  });

  it("keeps the existing development behaviour (VERCEL_ENV unset, NODE_ENV=development)", () => {
    // Local dev shell · no VERCEL_ENV at all · NODE_ENV=development
    // · handle set. Gate must pass so the impersonation flow still
    // works for engineers.
    vi.stubEnv("NEX_DEV_IMPERSONATE_HANDLE", "hendra");
    vi.stubEnv("NODE_ENV", "development");
    // VERCEL_ENV intentionally not stubbed.

    expect(devImpersonationHandle()).toBe("hendra");
  });

  it("keeps the existing preview behaviour (VERCEL_ENV=preview, non-prod Supabase URL)", () => {
    // Ireland/Indonesia preview deployments · Vercel sets VERCEL_ENV
    // to "preview" and NODE_ENV to "production". Supabase URL points
    // at the sandbox project. Gate must still pass so auto-sign-in
    // works on these previews.
    vi.stubEnv("NEX_DEV_IMPERSONATE_HANDLE", "hendra");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEX_SUPABASE_URL", "https://kdstoyyeygcopkogqsyv.supabase.co");

    expect(devImpersonationHandle()).toBe("hendra");
  });

  it("still refuses when VERCEL_ENV=production even if the handle var is the only thing set", () => {
    // Belt-and-braces · the hard-fail must dominate every other code
    // path. No Supabase URL present either · older guard would have
    // short-circuited to false for the URL-missing reason; the new
    // guard must short-circuit for the VERCEL_ENV reason FIRST so
    // the refusal is explicitly attributable to the production env.
    vi.stubEnv("NEX_DEV_IMPERSONATE_HANDLE", "hendra");
    vi.stubEnv("VERCEL_ENV", "production");

    expect(devImpersonationHandle()).toBeNull();
  });
});
