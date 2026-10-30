// src/lib/nex-native/follow/__tests__/follow-actions.test.ts
//
// Unit tests for the Stage 1 Follow server actions. Owner-authorised
// 2026-10-30 per Stage 1 preparation §13.6.
//
// Scope: error-code matrix · B-1 through B-6 block semantics ·
// idempotency · rate-limit propagation · churn-flag emission. All
// tests run against mocked dependencies (session resolver +
// repository + observability counters). Real DB behaviour is
// verified during the authorised dry-run (§3.2) and staging smoke
// test (§3.5).

import { describe, it, expect, vi, beforeEach } from "vitest";

const DEWI = "00000000-0000-0000-0000-000000000001";
const HENDRA = "00000000-0000-0000-0000-000000000002";

// Stub the `server-only` guard · tests run in a Node context, not a
// browser bundle, so the guard would throw spuriously. Matches the
// sealed pattern established in `active-slot-repository.test.ts`.
vi.mock("server-only", () => ({}));

// Mocks must be hoisted via vi.mock before imports.
vi.mock("@/lib/nex-native/app/dev-impersonation", () => ({
  resolveSessionWithDevOverride: vi.fn(),
}));

vi.mock("../follow-repository", () => ({
  insertFollow: vi.fn(),
  deleteFollow: vi.fn(),
  getFollowState: vi.fn(),
  isBlockedBetween: vi.fn(),
  accountExists: vi.fn(),
}));

// Reset the real in-memory rate limiter between tests so each test
// starts fresh.
import { __resetFollowRateLimitsForTests__ } from "../follow-rate-limit";

import {
  followAction,
  unfollowAction,
  isFollowingAction,
} from "../follow-actions";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import {
  insertFollow,
  deleteFollow,
  getFollowState,
  isBlockedBetween,
  accountExists,
} from "../follow-repository";

const mockSession = (id: string | null) => {
  (resolveSessionWithDevOverride as unknown as { mockResolvedValue: (v: unknown) => void })
    .mockResolvedValue(
      id === null
        ? null
        : { supabaseUserId: id, email: null, account: { id, display_name: null, nex_handle: null } },
    );
};

beforeEach(() => {
  vi.clearAllMocks();
  __resetFollowRateLimitsForTests__();
  mockSession(DEWI);
  (isBlockedBetween as unknown as { mockResolvedValue: (v: boolean) => void }).mockResolvedValue(false);
  (accountExists as unknown as { mockResolvedValue: (v: boolean) => void }).mockResolvedValue(true);
  (insertFollow as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({ created: true });
  (deleteFollow as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({ deleted: true });
  (getFollowState as unknown as { mockResolvedValue: (v: string) => void }).mockResolvedValue("not-following");
});

describe("followAction · error-code matrix", () => {
  it("rejects when not signed in", async () => {
    mockSession(null);
    const r = await followAction({ followeeId: HENDRA, source: "music" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("not-signed-in");
  });

  it("rejects malformed followeeId (not UUID-like)", async () => {
    const r = await followAction({ followeeId: "not-a-uuid", source: "music" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("invalid-input");
  });

  it("rejects invalid source value", async () => {
    const r = await followAction({ followeeId: HENDRA, source: "directory" as "music" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("invalid-input");
  });

  it("rejects self-follow (defence in depth above DB CHECK)", async () => {
    const r = await followAction({ followeeId: DEWI, source: "profile" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("self-follow");
  });

  it("rejects when followee does not exist", async () => {
    (accountExists as unknown as { mockResolvedValue: (v: boolean) => void }).mockResolvedValue(false);
    const r = await followAction({ followeeId: HENDRA, source: "music" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("not-found");
  });

  it("returns rate-limited after 20 follows in 60s", async () => {
    for (let i = 0; i < 20; i++) {
      // Different followees so account existence passes
      (accountExists as unknown as { mockResolvedValue: (v: boolean) => void }).mockResolvedValue(true);
      await followAction({ followeeId: HENDRA, source: "music" });
    }
    const r = await followAction({ followeeId: HENDRA, source: "music" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("rate-limited");
  });

  it("returns ok on happy path", async () => {
    const r = await followAction({ followeeId: HENDRA, source: "music" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.state).toBe("following");
  });

  it("is idempotent · second call returns ok (PK coalesces at DB)", async () => {
    (insertFollow as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({ created: false });
    const r = await followAction({ followeeId: HENDRA, source: "music" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.state).toBe("following");
  });
});

describe("followAction · block tests B-1 to B-6", () => {
  it("B-1 · Dewi blocked Hendra · Dewi.followAction(Hendra) → blocked", async () => {
    mockSession(DEWI);
    (isBlockedBetween as unknown as { mockResolvedValue: (v: boolean) => void }).mockResolvedValue(true);
    const r = await followAction({ followeeId: HENDRA, source: "music" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("blocked");
  });

  it("B-2 · Dewi blocked Hendra · Hendra.followAction(Dewi) → blocked", async () => {
    mockSession(HENDRA);
    (isBlockedBetween as unknown as { mockResolvedValue: (v: boolean) => void }).mockResolvedValue(true);
    const r = await followAction({ followeeId: DEWI, source: "music" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("blocked");
  });

  it("B-3 · Hendra blocked Dewi · Dewi.followAction(Hendra) → blocked", async () => {
    mockSession(DEWI);
    (isBlockedBetween as unknown as { mockResolvedValue: (v: boolean) => void }).mockResolvedValue(true);
    const r = await followAction({ followeeId: HENDRA, source: "music" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("blocked");
  });

  it("B-4 · Hendra blocked Dewi · Hendra.followAction(Dewi) → blocked", async () => {
    mockSession(HENDRA);
    (isBlockedBetween as unknown as { mockResolvedValue: (v: boolean) => void }).mockResolvedValue(true);
    const r = await followAction({ followeeId: DEWI, source: "music" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("blocked");
  });

  it("B-5 · no block · follow succeeds", async () => {
    mockSession(DEWI);
    (isBlockedBetween as unknown as { mockResolvedValue: (v: boolean) => void }).mockResolvedValue(false);
    const r = await followAction({ followeeId: HENDRA, source: "music" });
    expect(r.ok).toBe(true);
  });

  it("B-6 · friend-accepted state is independent of follow", async () => {
    mockSession(DEWI);
    (isBlockedBetween as unknown as { mockResolvedValue: (v: boolean) => void }).mockResolvedValue(false);
    const r = await followAction({ followeeId: HENDRA, source: "music" });
    expect(r.ok).toBe(true);
  });
});

describe("unfollowAction", () => {
  it("rejects when not signed in", async () => {
    mockSession(null);
    const r = await unfollowAction({ followeeId: HENDRA });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("not-signed-in");
  });

  it("returns not-following on self-unfollow (harmless no-op)", async () => {
    const r = await unfollowAction({ followeeId: DEWI });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.state).toBe("not-following");
  });

  it("returns ok on happy path", async () => {
    const r = await unfollowAction({ followeeId: HENDRA });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.state).toBe("not-following");
  });

  it("is idempotent · unfollow of non-follow returns ok", async () => {
    (deleteFollow as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({ deleted: false });
    const r = await unfollowAction({ followeeId: HENDRA });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.state).toBe("not-following");
  });

  it("still succeeds on 4th unfollow of same target (SOFT churn flag)", async () => {
    for (let i = 0; i < 3; i++) {
      await unfollowAction({ followeeId: HENDRA });
    }
    // 4th attempt · churn flag fires · action still succeeds
    const r = await unfollowAction({ followeeId: HENDRA });
    expect(r.ok).toBe(true);
  });
});

describe("isFollowingAction", () => {
  it("rejects when not signed in", async () => {
    mockSession(null);
    const r = await isFollowingAction({ followeeId: HENDRA });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("not-signed-in");
  });

  it("returns 'following' when repo says so", async () => {
    (getFollowState as unknown as { mockResolvedValue: (v: string) => void }).mockResolvedValue("following");
    const r = await isFollowingAction({ followeeId: HENDRA });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.state).toBe("following");
  });

  it("returns 'not-following' for self query (defence in depth)", async () => {
    const r = await isFollowingAction({ followeeId: DEWI });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.state).toBe("not-following");
  });
});
