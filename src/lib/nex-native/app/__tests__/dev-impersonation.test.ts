// src/lib/nex-native/app/__tests__/dev-impersonation.test.ts
//
// Regression tests for the dev-impersonation gate.
//
// History:
//   · 2026-11-07 (Item 1) · added VERCEL_ENV=production hard-fail as
//     defence-in-depth.
//   · 2026-11-10 (sign-in-as-99901 round) · owner SOFTENED the gate ·
//     VERCEL_ENV=production is no longer the authoritative refusal;
//     the Supabase-URL guard (matching the sealed production project
//     ref `ijvqdvsvwtwxzcqmoqit`) is authoritative. The
//     dev-impersonation.ts source comment at lines 66-84 documents
//     this relaxation and explains why.
//
// These tests exercise the current authoritative gate:
//   · NODE_ENV!=="production"                       → PASS (dev shell)
//   · NODE_ENV==="production" + URL=sandbox          → PASS (preview)
//   · NODE_ENV==="production" + URL=prod (sealed)    → REFUSE
//   · NODE_ENV==="production" + URL missing          → REFUSE (fail-closed)
//   · handle var unset                               → REFUSE (always)

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../../supabase-admin", () => ({ nexSupabaseAdmin: null }));
vi.mock("../session", () => ({
  resolveNexAppSessionFromContext: vi.fn(),
}));

import { devImpersonationHandle } from "../dev-impersonation";

const SANDBOX_URL = "https://kdstoyyeygcopkogqsyv.supabase.co";
const PROD_URL = "https://ijvqdvsvwtwxzcqmoqit.supabase.co";

describe("dev-impersonation · authoritative Supabase-URL gate (sealed 2026-11-10)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("local dev shell (NODE_ENV=development, handle set) → PASS", () => {
    vi.stubEnv("NEX_DEV_IMPERSONATE_HANDLE", "hendra");
    vi.stubEnv("NODE_ENV", "development");
    expect(devImpersonationHandle()).toBe("hendra");
  });

  it("preview deployment (NODE_ENV=production, URL=sandbox, handle set) → PASS", () => {
    vi.stubEnv("NEX_DEV_IMPERSONATE_HANDLE", "hendra");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEX_SUPABASE_URL", SANDBOX_URL);
    expect(devImpersonationHandle()).toBe("hendra");
  });

  it("preview deployment with VERCEL_ENV=production + sandbox URL → PASS (post-sealed-relaxation)", () => {
    // Sealed 2026-11-10: VERCEL_ENV is no longer the authoritative
    // gate. The Supabase-URL guard is. With a sandbox URL set, the
    // gate must pass even if VERCEL_ENV=production · documented in
    // dev-impersonation.ts:66-84.
    vi.stubEnv("NEX_DEV_IMPERSONATE_HANDLE", "hendra");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEX_SUPABASE_URL", SANDBOX_URL);
    expect(devImpersonationHandle()).toBe("hendra");
  });

  it("production deployment pointing at sealed prod project ref → REFUSE", () => {
    vi.stubEnv("NEX_DEV_IMPERSONATE_HANDLE", "hendra");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEX_SUPABASE_URL", PROD_URL);
    expect(devImpersonationHandle()).toBeNull();
  });

  it("production NODE_ENV with no Supabase URL → REFUSE (fail-closed)", () => {
    vi.stubEnv("NEX_DEV_IMPERSONATE_HANDLE", "hendra");
    vi.stubEnv("NODE_ENV", "production");
    // Explicitly unset Supabase URL
    vi.stubEnv("NEX_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_URL", "");
    expect(devImpersonationHandle()).toBeNull();
  });

  it("handle var not set → REFUSE regardless of env", () => {
    vi.stubEnv("NEX_DEV_IMPERSONATE_HANDLE", "");
    vi.stubEnv("NODE_ENV", "development");
    expect(devImpersonationHandle()).toBeNull();
  });

  it("NEXT_PUBLIC_NEX_SUPABASE_URL is honoured as fallback URL source", () => {
    vi.stubEnv("NEX_DEV_IMPERSONATE_HANDLE", "hendra");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEX_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_URL", PROD_URL);
    expect(devImpersonationHandle()).toBeNull();
  });
});
