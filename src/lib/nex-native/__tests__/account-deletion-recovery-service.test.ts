// src/lib/nex-native/__tests__/account-deletion-recovery-service.test.ts

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.stubEnv("NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEX_SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY", "mock-anon");

const SHARED = vi.hoisted(() => ({
  lookupRow: null as null | {
    supabase_user_id: string | null;
    deleted_at: string | null;
  },
  lookupError: null as null | { message: string },
  authDeleteError: null as null | { message: string },
  authDeleteCalls: [] as string[],
  finalizeError: null as null | { message: string },
  finalizeData: true as unknown,
  rpcCalls: [] as Array<{ fn: string; args: Record<string, unknown> }>,
  auditCalls: [] as Array<{ event: string; outcome: string; metadata?: unknown }>,
  auditEvents: {} as Record<string, "ok" | "throw-write">,
}));

vi.mock("../supabase-admin", () => ({
  nexSupabaseAdmin: {
    from(_table: string) {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({ data: SHARED.lookupRow, error: SHARED.lookupError }),
          }),
          not: () => ({
            not: () => ({
              order: () => ({
                limit: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
        }),
      };
    },
    rpc(fn: string, args: Record<string, unknown>) {
      SHARED.rpcCalls.push({ fn, args });
      return Promise.resolve({ data: SHARED.finalizeData, error: SHARED.finalizeError });
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
    recordAuditEvent: (input: { event: string; outcome: string; metadata?: unknown }) => {
      SHARED.auditCalls.push({ event: input.event, outcome: input.outcome, metadata: input.metadata });
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
      return Promise.resolve({ ok: true, logId: SHARED.auditCalls.length });
    },
    isAuditWriteError: (e: unknown) =>
      e instanceof Error && e.name === "AuditWriteError",
    AuditWriteError: AuditWriteErrorForTest,
  };
});

import { retryAccountDeletionAuthStep } from "../account-deletion-recovery-service";

const HQ = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const TARGET = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const SUPA_USER = "cccccccc-cccc-cccc-cccc-cccccccccccc";

describe("retryAccountDeletionAuthStep", () => {
  beforeEach(() => {
    SHARED.lookupRow = { supabase_user_id: SUPA_USER, deleted_at: "2026-11-08T00:00:00Z" };
    SHARED.lookupError = null;
    SHARED.authDeleteError = null;
    SHARED.authDeleteCalls = [];
    SHARED.finalizeError = null;
    SHARED.finalizeData = true;
    SHARED.rpcCalls = [];
    SHARED.auditCalls = [];
    SHARED.auditEvents = {};
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("happy path · soft-deleted + auth still present → attempts audit, deletes auth, finalizes, completes audit", async () => {
    const r = await retryAccountDeletionAuthStep({ hqAccountId: HQ, targetAccountId: TARGET });
    expect(r.ok).toBe(true);
    // attempted + completed emitted with stage=recovery
    expect(SHARED.auditCalls[0]).toMatchObject({
      event: "security.account.delete.attempted",
      outcome: "attempted",
      metadata: { initiator: "admin", stage: "recovery" },
    });
    expect(SHARED.authDeleteCalls).toEqual([SUPA_USER]);
    expect(SHARED.rpcCalls).toHaveLength(1);
    expect(SHARED.rpcCalls[0]!.fn).toBe("nex_account_finalize_deletion");
    expect(SHARED.rpcCalls[0]!.args).toEqual({ _account_id: TARGET });
    expect(SHARED.auditCalls[SHARED.auditCalls.length - 1]).toMatchObject({
      event: "security.account.delete.completed",
      outcome: "completed",
      metadata: { stage: "recovery" },
    });
  });

  it("target already finalized (supabase_user_id NULL) → idempotent · returns already_complete without side effects", async () => {
    SHARED.lookupRow = { supabase_user_id: null, deleted_at: "2026-11-08T00:00:00Z" };
    const r = await retryAccountDeletionAuthStep({ hqAccountId: HQ, targetAccountId: TARGET });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.already_complete).toBe(true);
    expect(SHARED.authDeleteCalls).toEqual([]);
    expect(SHARED.rpcCalls).toEqual([]);
    expect(SHARED.auditCalls).toEqual([]);
  });

  it("target not soft-deleted → refuses · returns target_not_soft_deleted · no mutation", async () => {
    SHARED.lookupRow = { supabase_user_id: SUPA_USER, deleted_at: null };
    const r = await retryAccountDeletionAuthStep({ hqAccountId: HQ, targetAccountId: TARGET });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("target_not_soft_deleted");
    expect(SHARED.authDeleteCalls).toEqual([]);
    expect(SHARED.rpcCalls).toEqual([]);
    expect(SHARED.auditCalls).toEqual([]);
  });

  it("target not found → target_not_found · no side effects", async () => {
    SHARED.lookupRow = null;
    const r = await retryAccountDeletionAuthStep({ hqAccountId: HQ, targetAccountId: TARGET });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("target_not_found");
  });

  it("attempted audit fail-loud → audit_unavailable · no auth delete attempted", async () => {
    SHARED.auditEvents["security.account.delete.attempted"] = "throw-write";
    const r = await retryAccountDeletionAuthStep({ hqAccountId: HQ, targetAccountId: TARGET });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("audit_unavailable");
    expect(SHARED.authDeleteCalls).toEqual([]);
    expect(SHARED.rpcCalls).toEqual([]);
  });

  it("auth deleteUser 'not found' → treated as idempotent success · falls through to finalize + completed", async () => {
    SHARED.authDeleteError = { message: "User not found in auth" };
    const r = await retryAccountDeletionAuthStep({ hqAccountId: HQ, targetAccountId: TARGET });
    expect(r.ok).toBe(true);
    expect(SHARED.rpcCalls).toHaveLength(1);
    expect(
      SHARED.auditCalls.some((c) => c.event === "security.account.delete.completed"),
    ).toBe(true);
  });

  it("auth deleteUser real error → failed audit · auth_delete_failed returned · no finalize attempted", async () => {
    SHARED.authDeleteError = { message: "auth backend down" };
    const r = await retryAccountDeletionAuthStep({ hqAccountId: HQ, targetAccountId: TARGET });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("auth_delete_failed");
    expect(SHARED.rpcCalls).toEqual([]);
    expect(
      SHARED.auditCalls.some((c) => c.event === "security.account.delete.failed"),
    ).toBe(true);
  });

  it("finalize RPC error → failed audit · finalize_failed returned", async () => {
    SHARED.finalizeError = { message: "function not available" };
    const r = await retryAccountDeletionAuthStep({ hqAccountId: HQ, targetAccountId: TARGET });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("finalize_failed");
    expect(
      SHARED.auditCalls.some((c) => c.event === "security.account.delete.failed"),
    ).toBe(true);
  });

  it("completion audit fail-loud after auth + finalize succeeded → returns audit_completion_failed (not silent success)", async () => {
    SHARED.auditEvents["security.account.delete.completed"] = "throw-write";
    const r = await retryAccountDeletionAuthStep({ hqAccountId: HQ, targetAccountId: TARGET });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("audit_completion_failed");
    expect(SHARED.authDeleteCalls).toEqual([SUPA_USER]);
    expect(SHARED.rpcCalls).toHaveLength(1);
  });
});
