// src/lib/nex-native/__tests__/security-audit-reconciler.test.ts
//
// NEX Security Programme · Item 5 · reconciler wrapper tests.
// Owner-sealed 2026-11-08.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const RPC_STATE = vi.hoisted(() => ({
  data: null as unknown,
  error: null as { message: string; code?: string } | null,
  calls: [] as Array<{ fn: string; args: Record<string, unknown> }>,
}));

vi.mock("../supabase-admin", () => ({
  nexSupabaseAdmin: {
    rpc(fn: string, args: Record<string, unknown>) {
      RPC_STATE.calls.push({ fn, args });
      return Promise.resolve({ data: RPC_STATE.data, error: RPC_STATE.error });
    },
  },
}));

import { reconcileUnmatchedAudits } from "../security-audit-reconciler";

describe("reconcileUnmatchedAudits", () => {
  beforeEach(() => {
    RPC_STATE.data = null;
    RPC_STATE.error = null;
    RPC_STATE.calls.length = 0;
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("calls the SQL function with the configured window seconds", async () => {
    RPC_STATE.data = 0;
    const r = await reconcileUnmatchedAudits(120);
    expect(r.ok).toBe(true);
    expect(r.unresolvedInserted).toBe(0);
    expect(RPC_STATE.calls).toHaveLength(1);
    expect(RPC_STATE.calls[0]!.fn).toBe("nex_security_audit_reconcile_unmatched");
    expect(RPC_STATE.calls[0]!.args).toEqual({ _reconciliation_window_seconds: 120 });
  });

  it("returns the count of newly-inserted unresolved rows", async () => {
    RPC_STATE.data = 7;
    const r = await reconcileUnmatchedAudits();
    expect(r.ok).toBe(true);
    expect(r.unresolvedInserted).toBe(7);
  });

  it("handles 42883 (function missing) as function_not_available · migration 293 unapplied", async () => {
    RPC_STATE.error = {
      message: "function nex_security_audit_reconcile_unmatched does not exist",
      code: "42883",
    };
    const r = await reconcileUnmatchedAudits();
    expect(r.ok).toBe(false);
    expect(r.skipped).toBe("function_not_available");
  });

  it("transient errors return transient_error · never throw", async () => {
    RPC_STATE.error = { message: "connection reset", code: "08006" };
    const r = await reconcileUnmatchedAudits();
    expect(r.ok).toBe(false);
    expect(r.skipped).toBe("transient_error");
    expect(r.error).toBe("connection reset");
  });

  it("window below 60s is rejected · caller programmer error", async () => {
    await expect(reconcileUnmatchedAudits(30)).rejects.toThrow(/\[60, 3600\]/);
  });

  it("window above 3600s is rejected", async () => {
    await expect(reconcileUnmatchedAudits(7200)).rejects.toThrow(/\[60, 3600\]/);
  });
});
