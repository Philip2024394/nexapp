// src/app/api/nex-native/cron/security-audit-reconcile/__tests__/route.test.ts

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.stubEnv("NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEX_SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY", "mock-anon");

const SHARED = vi.hoisted(() => ({
  reconcileResult: {
    ok: true as boolean,
    unresolvedInserted: 0 as number | undefined,
    skipped: undefined as string | undefined,
    error: undefined as string | undefined,
  },
  reconcileCalls: 0,
}));

vi.mock("@/lib/nex-native/security-audit-reconciler", () => ({
  reconcileUnmatchedAudits: () => {
    SHARED.reconcileCalls++;
    return Promise.resolve({
      ok: SHARED.reconcileResult.ok,
      unresolvedInserted: SHARED.reconcileResult.unresolvedInserted,
      skipped: SHARED.reconcileResult.skipped,
      error: SHARED.reconcileResult.error,
    });
  },
}));

const CRON_SECRET = "test-cron-secret-00000000";

function makeReq(auth: string | null) {
  const headers: Record<string, string> = {};
  if (auth !== null) headers["Authorization"] = auth;
  return new Request(
    "http://localhost/api/nex-native/cron/security-audit-reconcile",
    { method: "POST", headers },
  ) as never;
}

describe("POST /api/nex-native/cron/security-audit-reconcile", () => {
  beforeEach(() => {
    vi.stubEnv("NEX_CRON_SECRET", CRON_SECRET);
    SHARED.reconcileResult = { ok: true, unresolvedInserted: 0, skipped: undefined, error: undefined };
    SHARED.reconcileCalls = 0;
  });

  it("missing NEX_CRON_SECRET → 500 cron_secret_not_configured", async () => {
    vi.stubEnv("NEX_CRON_SECRET", "");
    const { POST } = await import("../route");
    const res = await POST(makeReq(`Bearer ${CRON_SECRET}`));
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("cron_secret_not_configured");
    expect(SHARED.reconcileCalls).toBe(0);
  });

  it("no Authorization header → 401 unauthorized", async () => {
    const { POST } = await import("../route");
    const res = await POST(makeReq(null));
    expect(res.status).toBe(401);
    expect(SHARED.reconcileCalls).toBe(0);
  });

  it("wrong bearer → 401", async () => {
    const { POST } = await import("../route");
    const res = await POST(makeReq("Bearer not-the-secret-value-aaaaaaa"));
    expect(res.status).toBe(401);
    expect(SHARED.reconcileCalls).toBe(0);
  });

  it("wrong scheme (not Bearer) → 401", async () => {
    const { POST } = await import("../route");
    const res = await POST(makeReq(`Basic ${CRON_SECRET}`));
    expect(res.status).toBe(401);
  });

  it("happy path → 200 + unresolved_inserted", async () => {
    SHARED.reconcileResult = { ok: true, unresolvedInserted: 3, skipped: undefined, error: undefined };
    const { POST } = await import("../route");
    const res = await POST(makeReq(`Bearer ${CRON_SECRET}`));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      unresolved_inserted: number;
      window_seconds: number;
      ran_at: string;
    };
    expect(body.ok).toBe(true);
    expect(body.unresolved_inserted).toBe(3);
    expect(body.window_seconds).toBe(300);
    expect(body.ran_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(SHARED.reconcileCalls).toBe(1);
  });

  it("function_not_available → 200 skipped (cron keeps running)", async () => {
    SHARED.reconcileResult = { ok: false, unresolvedInserted: undefined, skipped: "function_not_available", error: undefined };
    const { POST } = await import("../route");
    const res = await POST(makeReq(`Bearer ${CRON_SECRET}`));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; skipped: string };
    expect(body.ok).toBe(false);
    expect(body.skipped).toBe("function_not_available");
  });

  it("transient error → 500 with error detail", async () => {
    SHARED.reconcileResult = { ok: false, unresolvedInserted: undefined, skipped: "transient_error", error: "connection reset" };
    const { POST } = await import("../route");
    const res = await POST(makeReq(`Bearer ${CRON_SECRET}`));
    expect(res.status).toBe(500);
    const body = (await res.json()) as { ok: boolean; skipped: string; error: string };
    expect(body.ok).toBe(false);
    expect(body.skipped).toBe("transient_error");
    expect(body.error).toBe("connection reset");
  });

  it("GET also works (Vercel cron sends GET by default)", async () => {
    SHARED.reconcileResult = { ok: true, unresolvedInserted: 0, skipped: undefined, error: undefined };
    const { GET } = await import("../route");
    const res = await GET(makeReq(`Bearer ${CRON_SECRET}`));
    expect(res.status).toBe(200);
  });
});
