// src/lib/nex-native/__tests__/single-session-service.test.ts
//
// Phase 4 · owner-authorised 2026-11-15. In-memory tests for the
// single-session enforcement service. No DB · mocks nexSupabaseAdmin
// using the chain pattern from vault-security-service.test.ts and
// extends it with `.neq` for the supersession filter.

import { beforeEach, describe, expect, test, vi } from "vitest";

// ---- Mock the admin client before the service imports it. ----
type Row = Record<string, unknown>;
const tables: {
  account: Row[];
  session: Row[];
} = { account: [], session: [] };

function buildChain(tableName: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const api: Record<string, (...args: any[]) => any> = {
    insert(row: Row) {
      pushInto(tableName, row);
      return Promise.resolve({ error: null });
    },
    update(patch: Row) {
      const filters: Array<(r: Row) => boolean> = [];
      const chain: Record<string, unknown> = {
        eq(col: string, val: unknown) {
          filters.push((r) => r[col] === val);
          return chain;
        },
        neq(col: string, val: unknown) {
          filters.push((r) => r[col] !== val);
          return chain;
        },
        is(col: string, val: unknown) {
          filters.push((r) =>
            val === null
              ? r[col] === null || r[col] === undefined
              : r[col] === val,
          );
          return chain;
        },
        select(_cols: string) {
          const list = selectFrom(tableName);
          const matching = list.filter((r) =>
            filters.every((f) => f(r)),
          );
          const affectedCopies: Row[] = [];
          for (const m of matching) {
            Object.assign(m, patch);
            affectedCopies.push({ ...m });
          }
          // Mirror postgrest shape · .select('id') returns rows.
          return Promise.resolve({
            data: affectedCopies.map((r) => ({ id: r.id })),
            error: null,
          });
        },
        then(
          resolve: (v: { data: null; error: null }) => void,
        ) {
          const list = selectFrom(tableName);
          const matching = list.filter((r) =>
            filters.every((f) => f(r)),
          );
          for (const m of matching) Object.assign(m, patch);
          resolve({ data: null, error: null });
        },
      };
      return chain;
    },
    select(_cols: string) {
      const filters: Array<(r: Row) => boolean> = [];
      const chain: Record<string, unknown> = {
        eq(col: string, val: unknown) {
          filters.push((r) => r[col] === val);
          return chain;
        },
        neq(col: string, val: unknown) {
          filters.push((r) => r[col] !== val);
          return chain;
        },
        is(col: string, val: unknown) {
          filters.push((r) =>
            val === null
              ? r[col] === null || r[col] === undefined
              : r[col] === val,
          );
          return chain;
        },
        maybeSingle() {
          const match = selectFrom(tableName).find((r) =>
            filters.every((f) => f(r)),
          );
          return Promise.resolve({ data: match ?? null, error: null });
        },
        then(
          resolve: (v: { data: Row[] | null; error: null }) => void,
        ) {
          const matching = selectFrom(tableName).filter((r) =>
            filters.every((f) => f(r)),
          );
          resolve({ data: matching, error: null });
        },
      };
      return chain;
    },
  };
  return api;
}

function pushInto(tableName: string, row: Row): void {
  const list = selectFrom(tableName);
  list.push({ ...row });
}
function selectFrom(tableName: string): Row[] {
  switch (tableName) {
    case "nex_account":
      return tables.account;
    case "nex_session":
      return tables.session;
    default:
      throw new Error(`unknown table in test harness: ${tableName}`);
  }
}

vi.mock("@/lib/nex-native/supabase-admin", () => ({
  nexSupabaseAdmin: {
    from: (tableName: string) => buildChain(tableName),
  },
}));

// Import AFTER the mock is registered.
import {
  claimSingleSession,
  isSessionSuperseded,
  isSessionSupersededByKey,
} from "@/lib/nex-native/app/single-session-service";

const ACCOUNT_A = "11111111-1111-4111-8111-111111111111";
const ACCOUNT_B = "22222222-2222-4222-8222-222222222222";

// Helper to seed a fresh session row.
function seedSession(input: {
  id: string;
  accountId: string;
  sessionKey?: string;
  revokedAt?: string | null;
  supersededAt?: string | null;
}): void {
  tables.session.push({
    id: input.id,
    account_id: input.accountId,
    supabase_session_key: input.sessionKey ?? `key-${input.id}`,
    revoked_at: input.revokedAt ?? null,
    superseded_at: input.supersededAt ?? null,
    superseded_reason: null,
  });
}

function seedAccount(id: string): void {
  tables.account.push({
    id,
    active_single_session_id: null,
  });
}

beforeEach(() => {
  tables.account.length = 0;
  tables.session.length = 0;
});

// ---------------------------------------------------------------------------
// A · claimSingleSession
// ---------------------------------------------------------------------------

describe("claimSingleSession", () => {
  test("fresh sign-in · sets active_single_session_id · no supersessions", async () => {
    seedAccount(ACCOUNT_A);
    seedSession({ id: "sess-1", accountId: ACCOUNT_A });

    const result = await claimSingleSession({
      accountId: ACCOUNT_A,
      nexSessionId: "sess-1",
    });

    expect(result.activeSessionId).toBe("sess-1");
    expect(result.supersededSessionIds).toEqual([]);
    const account = tables.account.find((a) => a.id === ACCOUNT_A)!;
    expect(account.active_single_session_id).toBe("sess-1");
    const sess = tables.session.find((s) => s.id === "sess-1")!;
    expect(sess.superseded_at).toBeNull();
  });

  test("second sign-in · marks previous live session superseded · pointer updated", async () => {
    seedAccount(ACCOUNT_A);
    seedSession({ id: "sess-1", accountId: ACCOUNT_A });
    // First sign-in claims sess-1.
    await claimSingleSession({
      accountId: ACCOUNT_A,
      nexSessionId: "sess-1",
    });
    // Second device signs in · its row exists too.
    seedSession({ id: "sess-2", accountId: ACCOUNT_A });

    const result = await claimSingleSession({
      accountId: ACCOUNT_A,
      nexSessionId: "sess-2",
    });

    expect(result.activeSessionId).toBe("sess-2");
    expect(result.supersededSessionIds).toContain("sess-1");
    expect(result.supersededSessionIds).toHaveLength(1);

    const oldSess = tables.session.find((s) => s.id === "sess-1")!;
    expect(oldSess.superseded_at).not.toBeNull();
    expect(oldSess.superseded_reason).toBe("single_session_claimed");

    const newSess = tables.session.find((s) => s.id === "sess-2")!;
    expect(newSess.superseded_at).toBeNull();

    const account = tables.account.find((a) => a.id === ACCOUNT_A)!;
    expect(account.active_single_session_id).toBe("sess-2");
  });

  test("account scoping · account B's live sessions are NOT touched when A claims", async () => {
    seedAccount(ACCOUNT_A);
    seedAccount(ACCOUNT_B);
    seedSession({ id: "a-sess-1", accountId: ACCOUNT_A });
    seedSession({ id: "a-sess-2", accountId: ACCOUNT_A });
    seedSession({ id: "b-sess-1", accountId: ACCOUNT_B });
    seedSession({ id: "b-sess-2", accountId: ACCOUNT_B });

    const result = await claimSingleSession({
      accountId: ACCOUNT_A,
      nexSessionId: "a-sess-2",
    });

    expect(result.supersededSessionIds).toEqual(["a-sess-1"]);

    // Account B rows remain untouched.
    const bOne = tables.session.find((s) => s.id === "b-sess-1")!;
    const bTwo = tables.session.find((s) => s.id === "b-sess-2")!;
    expect(bOne.superseded_at).toBeNull();
    expect(bTwo.superseded_at).toBeNull();

    // Account B pointer untouched.
    const bAccount = tables.account.find((a) => a.id === ACCOUNT_B)!;
    expect(bAccount.active_single_session_id).toBeNull();
  });

  test("re-claim same session · idempotent · no supersession noise", async () => {
    seedAccount(ACCOUNT_A);
    seedSession({ id: "sess-1", accountId: ACCOUNT_A });
    await claimSingleSession({
      accountId: ACCOUNT_A,
      nexSessionId: "sess-1",
    });
    const result = await claimSingleSession({
      accountId: ACCOUNT_A,
      nexSessionId: "sess-1",
    });
    expect(result.supersededSessionIds).toEqual([]);
    const sess = tables.session.find((s) => s.id === "sess-1")!;
    expect(sess.superseded_at).toBeNull();
  });

  test("already-revoked sessions are NOT re-touched (treated as not live)", async () => {
    seedAccount(ACCOUNT_A);
    seedSession({
      id: "sess-old",
      accountId: ACCOUNT_A,
      revokedAt: "2026-11-01T00:00:00Z",
    });
    seedSession({ id: "sess-new", accountId: ACCOUNT_A });
    const result = await claimSingleSession({
      accountId: ACCOUNT_A,
      nexSessionId: "sess-new",
    });
    expect(result.supersededSessionIds).toEqual([]);
    const oldSess = tables.session.find((s) => s.id === "sess-old")!;
    expect(oldSess.superseded_at).toBeNull();
    // Still revoked · we didn't clobber it.
    expect(oldSess.revoked_at).toBe("2026-11-01T00:00:00Z");
  });

  test("throws on missing input", async () => {
    await expect(
      claimSingleSession({ accountId: "", nexSessionId: "sess-1" }),
    ).rejects.toThrow(/accountId and nexSessionId/);
    await expect(
      claimSingleSession({ accountId: ACCOUNT_A, nexSessionId: "" }),
    ).rejects.toThrow(/accountId and nexSessionId/);
  });
});

// ---------------------------------------------------------------------------
// B · isSessionSuperseded
// ---------------------------------------------------------------------------

describe("isSessionSuperseded", () => {
  test("returns true for a session marked superseded by a newer sign-in", async () => {
    seedAccount(ACCOUNT_A);
    seedSession({ id: "sess-1", accountId: ACCOUNT_A });
    await claimSingleSession({
      accountId: ACCOUNT_A,
      nexSessionId: "sess-1",
    });
    seedSession({ id: "sess-2", accountId: ACCOUNT_A });
    await claimSingleSession({
      accountId: ACCOUNT_A,
      nexSessionId: "sess-2",
    });
    expect(await isSessionSuperseded("sess-1")).toBe(true);
    expect(await isSessionSuperseded("sess-2")).toBe(false);
  });

  test("returns false for a missing session row", async () => {
    expect(await isSessionSuperseded("nonexistent")).toBe(false);
  });

  test("returns false on empty session id", async () => {
    expect(await isSessionSuperseded("")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// C · isSessionSupersededByKey (session.ts resolver path)
// ---------------------------------------------------------------------------

describe("isSessionSupersededByKey", () => {
  test("scopes by account + key · cross-account cannot leak a true", async () => {
    seedAccount(ACCOUNT_A);
    seedAccount(ACCOUNT_B);
    seedSession({
      id: "a-sess-1",
      accountId: ACCOUNT_A,
      sessionKey: "key-shared",
    });
    seedSession({
      id: "b-sess-1",
      accountId: ACCOUNT_B,
      sessionKey: "key-shared",
    });
    // Supersede account A's session only.
    seedSession({ id: "a-sess-2", accountId: ACCOUNT_A });
    await claimSingleSession({
      accountId: ACCOUNT_A,
      nexSessionId: "a-sess-2",
    });
    // Account A, same key = superseded.
    const aResult = await isSessionSupersededByKey({
      accountId: ACCOUNT_A,
      supabaseSessionKey: "key-shared",
    });
    expect(aResult).toBe(true);
    // Account B, same key = NOT superseded (supersession didn't touch B).
    const bResult = await isSessionSupersededByKey({
      accountId: ACCOUNT_B,
      supabaseSessionKey: "key-shared",
    });
    expect(bResult).toBe(false);
  });

  test("returns false for missing inputs", async () => {
    expect(
      await isSessionSupersededByKey({
        accountId: "",
        supabaseSessionKey: "k",
      }),
    ).toBe(false);
    expect(
      await isSessionSupersededByKey({
        accountId: ACCOUNT_A,
        supabaseSessionKey: "",
      }),
    ).toBe(false);
  });
});
