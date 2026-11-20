// src/lib/nex-native/__tests__/account-deletion-lane-i-anchors.test.ts
//
// Lane I · supplemental anchor tests for `deleteOwnAccount` + the
// POST /security/account/delete route. The existing
// `account-deletion-service.test.ts` + `route.test.ts` already cover
// each step's failure in isolation; this file locks in three owner-
// requested invariants that cross those seams:
//
//   I-RETRY   · a caller that retries after a partial failure (step 3
//               errored, step 5 untouched) proceeds end-to-end on the
//               second attempt. Confirms the service is safely
//               re-entrant and that a successful second attempt still
//               emits .completed exactly once per successful run.
//   I-REALITY · the service returns `ok: false` whenever ANY tracked
//               mutation (soft-delete, auth-delete, completion audit)
//               did not land. Silent `ok: true` with a partial state
//               is explicitly forbidden by owner directive 2026-11-08.
//   I-OWNER   · the route scopes the deletion to the session's own
//               account. Any `account_id` / `supabase_user_id` fields
//               a caller sneaks into the body are IGNORED. (This is
//               the "cross-account denial" shape · the route never
//               accepts a target; the session is the target.)
//
// OFFLINE ONLY · mocks every DB, auth, audit call. Offline tests DO
// NOT prove live Supabase Auth user deletion, live RPC execution, or
// live audit-row persistence. Those must be verified under a credentialed
// sandbox run after the current DB pause lifts.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.stubEnv("NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEX_SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY", "mock-anon");

// ─── Shared service-level mock state ────────────────────────────────

const SHARED = vi.hoisted(() => ({
  bumpCalls: [] as string[],
  rpcCalls: [] as Array<{ fn: string; args: Record<string, unknown> }>,
  rpcError: null as null | { message: string },
  authDeleteCalls: [] as string[],
  authDeleteError: null as null | { message: string },
  auditCalls: [] as Array<{ event: string; outcome: string }>,
  eraseCalls: [] as Array<{ uuid: string; identity: string }>,
}));

vi.mock("../security-service", () => ({
  bumpSessionsInvalidatedAtForOwner: (id: string) => {
    SHARED.bumpCalls.push(id);
    return Promise.resolve({ invalidated_at: "2026-11-19T00:00:00.000Z" });
  },
}));

vi.mock("../supabase-admin", () => ({
  nexSupabaseAdmin: {
    rpc(fn: string, args: Record<string, unknown>) {
      SHARED.rpcCalls.push({ fn, args });
      return Promise.resolve({ data: true, error: SHARED.rpcError });
    },
    from() {
      // viewer_account_id scrub step 3b · returns a chainable stub
      // whose terminal .eq resolves { error: null }.
      const chain = {
        update: () => chain,
        eq: () => Promise.resolve({ error: null }),
      };
      return chain;
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
      return Promise.resolve({ ok: true, logId: SHARED.auditCalls.length });
    },
    isAuditWriteError: (e: unknown) =>
      e instanceof Error && e.name === "AuditWriteError",
    eraseActorIdentityInAudit: (uuid: string, identity: string) => {
      SHARED.eraseCalls.push({ uuid, identity });
      return Promise.resolve({ ok: true });
    },
    generateErasedActorIdentity: () => "erased:deadbeefcafebabe12345678",
    AuditWriteError: AuditWriteErrorForTest,
  };
});

const { deleteOwnAccount } = await import("../account-deletion-service");

const ACCOUNT_OWN = "11111111-1111-1111-1111-111111111111";
const SUPA_USER_OWN = "22222222-2222-2222-2222-222222222222";

describe("Lane I · deleteOwnAccount retry + reality invariants", () => {
  beforeEach(() => {
    SHARED.bumpCalls = [];
    SHARED.rpcCalls = [];
    SHARED.rpcError = null;
    SHARED.authDeleteCalls = [];
    SHARED.authDeleteError = null;
    SHARED.auditCalls = [];
    SHARED.eraseCalls = [];
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("I-RETRY · partial failure on first call (soft-delete errors) → second call completes end-to-end · .completed emitted exactly once total", async () => {
    // First call · RPC errors.
    SHARED.rpcError = { message: "transient db blip" };
    const first = await deleteOwnAccount({
      ownerAccountId: ACCOUNT_OWN,
      supabaseUserId: SUPA_USER_OWN,
    });
    expect(first.ok).toBe(false);
    if (!first.ok) expect(first.error).toBe("soft_delete_failed");
    const completedAfterFirst = SHARED.auditCalls.filter(
      (c) => c.event === "security.account.delete.completed",
    ).length;
    expect(completedAfterFirst).toBe(0); // never emits completed on failure

    // Second call · RPC recovers. Same inputs · idempotent re-entry.
    SHARED.rpcError = null;
    const second = await deleteOwnAccount({
      ownerAccountId: ACCOUNT_OWN,
      supabaseUserId: SUPA_USER_OWN,
    });
    expect(second.ok).toBe(true);
    const completedTotal = SHARED.auditCalls.filter(
      (c) => c.event === "security.account.delete.completed",
    ).length;
    expect(completedTotal).toBe(1); // one and only one successful completion
    expect(SHARED.authDeleteCalls).toEqual([SUPA_USER_OWN]); // Auth delete only ran on the successful attempt
  });

  it("I-RETRY · auth-delete 'user not found' on retry is treated as idempotent success (prior attempt already removed the Auth user)", async () => {
    SHARED.authDeleteError = { message: "User not found" };
    const r = await deleteOwnAccount({
      ownerAccountId: ACCOUNT_OWN,
      supabaseUserId: SUPA_USER_OWN,
    });
    expect(r.ok).toBe(true);
    // Soft-delete still ran (it's idempotent), erase still ran, and
    // the final completed audit landed. No false `failed` event.
    expect(
      SHARED.auditCalls.some(
        (c) => c.event === "security.account.delete.failed",
      ),
    ).toBe(false);
    expect(
      SHARED.auditCalls.some(
        (c) => c.event === "security.account.delete.completed",
      ),
    ).toBe(true);
  });

  it("I-REALITY · soft-delete fails → return ok:false with soft_delete_failed · NEVER call Auth deleteUser · NEVER emit .completed", async () => {
    SHARED.rpcError = { message: "rpc down" };
    const r = await deleteOwnAccount({
      ownerAccountId: ACCOUNT_OWN,
      supabaseUserId: SUPA_USER_OWN,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("soft_delete_failed");
    // Hard invariants: no Auth call, no .completed audit.
    expect(SHARED.authDeleteCalls).toEqual([]);
    expect(
      SHARED.auditCalls.some(
        (c) => c.event === "security.account.delete.completed",
      ),
    ).toBe(false);
  });

  it("I-REALITY · auth-delete fails for a real reason → return ok:false with auth_delete_failed · soft-delete already landed · partial state is visible to caller (NOT silent success)", async () => {
    SHARED.authDeleteError = { message: "auth backend 500" };
    const r = await deleteOwnAccount({
      ownerAccountId: ACCOUNT_OWN,
      supabaseUserId: SUPA_USER_OWN,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("auth_delete_failed");
    // Soft-delete did land, so the account row is marked deleted but
    // the Auth user still exists. The caller gets a non-ok response
    // so UI copy + HQ reconciler can react honestly. A silent 200
    // here would leave the user believing their auth identity is
    // gone when it is not.
    expect(SHARED.rpcCalls).toHaveLength(1);
    expect(SHARED.authDeleteCalls).toEqual([SUPA_USER_OWN]);
    expect(
      SHARED.auditCalls.some(
        (c) => c.event === "security.account.delete.completed",
      ),
    ).toBe(false);
  });
});

// Route-level owner-isolation anchor (I-OWNER) lives in
// `account-deletion-lane-i-route-anchor.test.ts` · split from this
// file because `vi.mock("@/lib/nex-native/account-deletion-service")`
// would otherwise replace the REAL service import used by the
// retry/reality tests above.
