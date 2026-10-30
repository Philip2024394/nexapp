// src/lib/nex-native/follow/__tests__/follow-repository.test.ts
//
// Unit tests for the Follow repository layer. Owner-authorised
// 2026-10-30 per Stage 1 preparation §13.6.
//
// Scope: query SHAPE + response handling. Does NOT execute against a
// real database (per the Stage 1 preparation authorisation: no DB
// connection, no migration apply). Real concurrency + CASCADE tests
// (C-1 through C-9) execute during the authorised dry-run against a
// disposable schema (§3.2) and the staging smoke test (§3.5).

import { describe, it, expect, vi, beforeEach } from "vitest";

// Stub the `server-only` guard · tests run in a Node context, not a
// browser bundle, so the guard would throw spuriously. Matches the
// sealed pattern established in `active-slot-repository.test.ts`.
vi.mock("server-only", () => ({}));

// Mock nexSupabaseAdmin to a chainable builder stub so we can
// capture the query shape per call.
vi.mock("@/lib/nex-native/supabase-admin", () => {
  // Mock response is stored OUTSIDE `_last` so that `.from()` resetting
  // `_last` (to capture a fresh query shape per call) doesn't wipe the
  // response the test just configured via `__mock(...)`.
  const builder = {
    _last: {} as Record<string, unknown>,
    _mockData: null as unknown,
    _mockError: null as { code?: string; message: string } | null,
    from(table: string) {
      this._last = { table };
      return this;
    },
    insert(row: unknown) {
      this._last.op = "insert";
      this._last.row = row;
      return this;
    },
    delete() {
      this._last.op = "delete";
      return this;
    },
    select(sel?: string) {
      this._last.select = sel;
      return this;
    },
    eq(col: string, val: unknown) {
      this._last[`eq_${col}`] = val;
      return this;
    },
    lt(col: string, val: unknown) {
      this._last[`lt_${col}`] = val;
      return this;
    },
    order(col: string, opts: unknown) {
      this._last.order = { col, opts };
      return this;
    },
    limit(n: number) {
      this._last.limit = n;
      return this;
    },
    maybeSingle<T>() {
      return Promise.resolve({ data: this._mockData as T | null, error: this._mockError });
    },
    // The call sites that end in `.select(...)` without `.maybeSingle` get a
    // bare `then` on the builder (query await). We implement thenable:
    then(resolve: (v: unknown) => void) {
      resolve({ data: this._mockData, error: this._mockError });
    },
    // Test-only · set the mocked response for the next await.
    __mock(data: unknown, error?: { code?: string; message: string } | null) {
      this._mockData = data;
      this._mockError = error ?? null;
      return this;
    },
  };
  return { nexSupabaseAdmin: builder };
});

import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import {
  insertFollow,
  deleteFollow,
  getFollowState,
  isBlockedBetween,
  accountExists,
  readFollowCounts,
} from "../follow-repository";

const DEWI = "00000000-0000-0000-0000-000000000001";
const HENDRA = "00000000-0000-0000-0000-000000000002";

type MockBuilder = typeof nexSupabaseAdmin & {
  __mock: (data: unknown, error?: { code?: string; message: string } | null) => MockBuilder;
  _last: Record<string, unknown>;
  _mockData: unknown;
  _mockError: { code?: string; message: string } | null;
};

const mb = nexSupabaseAdmin as unknown as MockBuilder;

beforeEach(() => {
  mb._last = {};
  mb._mockData = null;
  mb._mockError = null;
});

describe("insertFollow", () => {
  it("sends INSERT to nex_follow with follower_id, followee_id, source", async () => {
    mb.__mock([{ follower_id: DEWI }]);
    const r = await insertFollow({ followerId: DEWI, followeeId: HENDRA, source: "music" });
    expect(mb._last.table).toBe("nex_follow");
    expect(mb._last.op).toBe("insert");
    expect(mb._last.row).toEqual({
      follower_id: DEWI,
      followee_id: HENDRA,
      source: "music",
    });
    expect(r.created).toBe(true);
  });

  it("returns {created:false} on 23505 unique_violation (idempotent)", async () => {
    mb.__mock(null, { code: "23505", message: "duplicate key value violates unique constraint" });
    const r = await insertFollow({ followerId: DEWI, followeeId: HENDRA, source: "music" });
    expect(r.created).toBe(false);
  });

  it("throws on non-23505 errors", async () => {
    mb.__mock(null, { message: "connection refused" });
    await expect(
      insertFollow({ followerId: DEWI, followeeId: HENDRA, source: "music" }),
    ).rejects.toThrow(/connection refused/);
  });
});

describe("deleteFollow", () => {
  it("sends DELETE with correct eq filters", async () => {
    mb.__mock([{ follower_id: DEWI }]);
    const r = await deleteFollow({ followerId: DEWI, followeeId: HENDRA });
    expect(mb._last.table).toBe("nex_follow");
    expect(mb._last.op).toBe("delete");
    expect(mb._last.eq_follower_id).toBe(DEWI);
    expect(mb._last.eq_followee_id).toBe(HENDRA);
    expect(r.deleted).toBe(true);
  });

  it("returns {deleted:false} when no matching row", async () => {
    mb.__mock([]);
    const r = await deleteFollow({ followerId: DEWI, followeeId: HENDRA });
    expect(r.deleted).toBe(false);
  });
});

describe("getFollowState", () => {
  it("returns 'following' when a row exists", async () => {
    mb.__mock({ follower_id: DEWI });
    const s = await getFollowState({ followerId: DEWI, followeeId: HENDRA });
    expect(s).toBe("following");
  });

  it("returns 'not-following' when no row", async () => {
    mb.__mock(null);
    const s = await getFollowState({ followerId: DEWI, followeeId: HENDRA });
    expect(s).toBe("not-following");
  });
});

describe("isBlockedBetween", () => {
  it("queries nex_friend_edge with canonical-pair ordering (a < b)", async () => {
    mb.__mock(null);
    // DEWI < HENDRA alphabetically (both are UUIDs; the comparison
    // operates on the string form which satisfies the canonical
    // pair rule).
    await isBlockedBetween({ a: DEWI, b: HENDRA });
    expect(mb._last.table).toBe("nex_friend_edge");
    expect(mb._last.eq_a_account_id).toBe(DEWI < HENDRA ? DEWI : HENDRA);
    expect(mb._last.eq_b_account_id).toBe(DEWI < HENDRA ? HENDRA : DEWI);
    expect(mb._last.eq_status).toBe("blocked");
  });

  it("swaps order when a > b to maintain canonical ordering", async () => {
    mb.__mock(null);
    // Pass HENDRA first; expect a_account_id = DEWI (the lesser).
    await isBlockedBetween({ a: HENDRA, b: DEWI });
    expect(mb._last.eq_a_account_id).toBe(DEWI < HENDRA ? DEWI : HENDRA);
    expect(mb._last.eq_b_account_id).toBe(DEWI < HENDRA ? HENDRA : DEWI);
  });

  it("returns true when a blocked row exists", async () => {
    mb.__mock({ a_account_id: DEWI });
    const blocked = await isBlockedBetween({ a: DEWI, b: HENDRA });
    expect(blocked).toBe(true);
  });

  it("returns false when no blocked row", async () => {
    mb.__mock(null);
    const blocked = await isBlockedBetween({ a: DEWI, b: HENDRA });
    expect(blocked).toBe(false);
  });
});

describe("accountExists", () => {
  it("returns true when nex_account row exists", async () => {
    mb.__mock({ id: HENDRA });
    expect(await accountExists(HENDRA)).toBe(true);
  });

  it("returns false when no row", async () => {
    mb.__mock(null);
    expect(await accountExists(HENDRA)).toBe(false);
  });
});

describe("readFollowCounts", () => {
  it("returns both counts from nex_account", async () => {
    mb.__mock({ followers_count: 42, following_count: 7 });
    const c = await readFollowCounts(HENDRA);
    expect(c.followersCount).toBe(42);
    expect(c.followingCount).toBe(7);
  });

  it("returns zeros when account not found", async () => {
    mb.__mock(null);
    const c = await readFollowCounts(HENDRA);
    expect(c.followersCount).toBe(0);
    expect(c.followingCount).toBe(0);
  });
});
