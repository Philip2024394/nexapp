// src/lib/nex-native/__tests__/account-deletion-service.test.ts

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.stubEnv("NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEX_SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY", "mock-anon");

const SHARED = vi.hoisted(() => ({
  bumpCalls: [] as string[],
  bumpShouldThrow: false,
  rpcCalls: [] as Array<{ fn: string; args: Record<string, unknown> }>,
  rpcError: null as null | { message: string },
  authDeleteCalls: [] as string[],
  authDeleteError: null as null | { message: string },
  auditCalls: [] as Array<{ event: string; outcome: string }>,
  auditEvents: {} as Record<
    string,
    "ok" | "throw-write" | "throw-unknown"
  >,
  eraseCalls: [] as Array<{ uuid: string; identity: string }>,
  eraseResult: { ok: true as boolean, skipped: undefined as string | undefined },
}));

vi.mock("../security-service", () => ({
  bumpSessionsInvalidatedAtForOwner: (id: string) => {
    SHARED.bumpCalls.push(id);
    if (SHARED.bumpShouldThrow) return Promise.reject(new Error("bump failed"));
    return Promise.resolve({ invalidated_at: "2026-11-08T00:00:00.000Z" });
  },
}));

vi.mock("../supabase-admin", () => ({
  nexSupabaseAdmin: {
    rpc(fn: string, args: Record<string, unknown>) {
      SHARED.rpcCalls.push({ fn, args });
      return Promise.resolve({ data: true, error: SHARED.rpcError });
    },
    auth: {
      admin: {
        deleteUser(id: string) {
          SHARED.authDeleteCalls.push(id);
          return Promise.resolve({
            data: SHARED.authDeleteError ? null : { user: { id } },
            error: SHARED.authDeleteError,
          });
        },
      },
    },
  },
}));

vi.mock("../security-audit-service", () => {
  class AuditWriteErrorForTest extends Error {
    readonly event: string;
    readonly phase: string;
    constructor(event: string, phase: string, cause: string) {
      super(`security-audit: ${event} ${phase} write failed · ${cause}`);
      this.name = "AuditWriteError";
      this.event = event;
      this.phase = phase;
    }
  }
  return {
    recordAuditEvent: (input: { event: string; outcome: string }) => {
      SHARED.auditCalls.push({ event: input.event, outcome: input.outcome });
      const behavior = SHARED.auditEvents[input.event] ?? "ok";
      if (behavior === "throw-write") {
        return Promise.reject(
          new AuditWriteErrorForTest(
            input.event,
            input.outcome === "attempted" ? "attempted" : "completion",
            "table_not_available",
          ),
        );
      }
      if (behavior === "throw-unknown") {
        return Promise.reject(new Error("unknown error"));
      }
      return Promise.resolve({ ok: true, logId: SHARED.auditCalls.length });
    },
    isAuditWriteError: (e: unknown) =>
      e instanceof Error && e.name === "AuditWriteError",
    eraseActorIdentityInAudit: (uuid: string, identity: string) => {
      SHARED.eraseCalls.push({ uuid, identity });
      return Promise.resolve(SHARED.eraseResult);
    },
    generateErasedActorIdentity: () => "erased:deadbeefcafebabe12345678",
    AuditWriteError: AuditWriteErrorForTest,
  };
});

import { deleteOwnAccount } from "../account-deletion-service";

const ACCOUNT = "11111111-1111-1111-1111-111111111111";
const SUPABASE_USER = "22222222-2222-2222-2222-222222222222";

describe("deleteOwnAccount", () => {
  beforeEach(() => {
    SHARED.bumpCalls = [];
    SHARED.bumpShouldThrow = false;
    SHARED.rpcCalls = [];
    SHARED.rpcError = null;
    SHARED.authDeleteCalls = [];
    SHARED.authDeleteError = null;
    SHARED.auditCalls = [];
    SHARED.auditEvents = {};
    SHARED.eraseCalls = [];
    SHARED.eraseResult = { ok: true, skipped: undefined };
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("happy path · emits attempted + completed · invalidates sessions · soft-deletes · erases · deletes Auth", async () => {
    const r = await deleteOwnAccount({
      ownerAccountId: ACCOUNT,
      supabaseUserId: SUPABASE_USER,
      reason: "user-initiated",
    });
    expect(r.ok).toBe(true);
    // Invariants: order matters
    expect(SHARED.auditCalls[0]).toEqual({
      event: "security.account.delete.attempted",
      outcome: "attempted",
    });
    expect(SHARED.bumpCalls).toEqual([ACCOUNT]);
    expect(SHARED.rpcCalls).toHaveLength(1);
    expect(SHARED.rpcCalls[0]!.fn).toBe("nex_account_mark_deleted");
    expect(SHARED.rpcCalls[0]!.args._account_id).toBe(ACCOUNT);
    expect(SHARED.eraseCalls).toHaveLength(1);
    expect(SHARED.eraseCalls[0]!.uuid).toBe(ACCOUNT);
    expect(SHARED.eraseCalls[0]!.identity).toMatch(/^erased:/);
    expect(SHARED.authDeleteCalls).toEqual([SUPABASE_USER]);
    expect(SHARED.auditCalls[SHARED.auditCalls.length - 1]).toEqual({
      event: "security.account.delete.completed",
      outcome: "completed",
    });
  });

  it("attempted audit fail-loud → aborts before any mutation", async () => {
    SHARED.auditEvents["security.account.delete.attempted"] = "throw-write";
    const r = await deleteOwnAccount({
      ownerAccountId: ACCOUNT,
      supabaseUserId: SUPABASE_USER,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("audit_unavailable");
    // No downstream mutations ran
    expect(SHARED.bumpCalls).toEqual([]);
    expect(SHARED.rpcCalls).toEqual([]);
    expect(SHARED.eraseCalls).toEqual([]);
    expect(SHARED.authDeleteCalls).toEqual([]);
  });

  it("soft-delete RPC error → emits failed + returns soft_delete_failed", async () => {
    SHARED.rpcError = { message: "db timeout" };
    const r = await deleteOwnAccount({
      ownerAccountId: ACCOUNT,
      supabaseUserId: SUPABASE_USER,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("soft_delete_failed");
    // Auth delete NEVER called when soft-delete failed
    expect(SHARED.authDeleteCalls).toEqual([]);
    // A failed audit event should have been attempted
    expect(
      SHARED.auditCalls.some((c) => c.event === "security.account.delete.failed"),
    ).toBe(true);
  });

  it("auth deletion 'user not found' → treated as idempotent success", async () => {
    SHARED.authDeleteError = { message: "User not found" };
    const r = await deleteOwnAccount({
      ownerAccountId: ACCOUNT,
      supabaseUserId: SUPABASE_USER,
    });
    expect(r.ok).toBe(true);
    // Completed emitted
    expect(
      SHARED.auditCalls.some((c) => c.event === "security.account.delete.completed"),
    ).toBe(true);
  });

  it("auth deletion real error → returns auth_delete_failed + emits failed audit", async () => {
    SHARED.authDeleteError = { message: "auth backend down" };
    const r = await deleteOwnAccount({
      ownerAccountId: ACCOUNT,
      supabaseUserId: SUPABASE_USER,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("auth_delete_failed");
    expect(
      SHARED.auditCalls.some((c) => c.event === "security.account.delete.failed"),
    ).toBe(true);
  });

  it("completion audit fail-loud after Auth succeeded → returns audit_completion_failed (not silent success)", async () => {
    SHARED.auditEvents["security.account.delete.completed"] = "throw-write";
    const r = await deleteOwnAccount({
      ownerAccountId: ACCOUNT,
      supabaseUserId: SUPABASE_USER,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("audit_completion_failed");
    // Auth delete already succeeded so it was called
    expect(SHARED.authDeleteCalls).toEqual([SUPABASE_USER]);
  });

  it("pseudonymisation skipped (function_not_available) → workflow still completes", async () => {
    SHARED.eraseResult = { ok: false, skipped: "function_not_available" };
    const r = await deleteOwnAccount({
      ownerAccountId: ACCOUNT,
      supabaseUserId: SUPABASE_USER,
    });
    expect(r.ok).toBe(true);
  });

  it("bump session invalidation failure is non-fatal → workflow continues", async () => {
    SHARED.bumpShouldThrow = true;
    const r = await deleteOwnAccount({
      ownerAccountId: ACCOUNT,
      supabaseUserId: SUPABASE_USER,
    });
    expect(r.ok).toBe(true);
    expect(SHARED.rpcCalls).toHaveLength(1);
    expect(SHARED.authDeleteCalls).toEqual([SUPABASE_USER]);
  });
});
