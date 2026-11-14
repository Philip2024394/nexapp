// src/lib/nex-native/__tests__/peer-unread-counts-batch.test.ts
//
// Stage 9 · item 6 · 2026-11-14 · build-only.
// -----------------------------------------------------------------------------
// Proves the Stage-9 batched unread-count helper · replaces N
// `countUnreadPeerMessages` round-trips with ONE batched tally.
//
// Invariants tested:
//   · Empty input returns an empty Map (no DB call wasted).
//   · N conversation ids → ONE call into `.from(...).select(...).in(...)`.
//   · Tally matches an in-memory count of rows per conversation_id.
//   · Supabase error path returns an empty Map (fail-soft parity
//     with the single-conversation variant).
//   · Deduplicates input ids before the DB call.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { fromMock, selectMock, inMock, neqMock, isMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  selectMock: vi.fn(),
  inMock: vi.fn(),
  neqMock: vi.fn(),
  isMock: vi.fn(),
}));

vi.mock("@/lib/nex-native/supabase-admin", () => ({
  nexSupabaseAdmin: {
    from: fromMock,
  },
}));

import { listUnreadPeerCountsByConversation } from "@/lib/nex-native/peer-message-service";

const VIEWER = "11111111-1111-4111-8111-111111111111";
const C1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const C2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const C3 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function setMockReturn(data: Array<{ conversation_id: string }> | null, error: unknown = null) {
  // Build the fluent chain so each terminal call returns {data, error}.
  isMock.mockResolvedValue({ data, error });
  neqMock.mockReturnValue({ is: isMock });
  inMock.mockReturnValue({ neq: neqMock });
  selectMock.mockReturnValue({ in: inMock });
  fromMock.mockReturnValue({ select: selectMock });
}

beforeEach(() => {
  fromMock.mockReset();
  selectMock.mockReset();
  inMock.mockReset();
  neqMock.mockReset();
  isMock.mockReset();
});
afterEach(() => vi.clearAllMocks());

describe("listUnreadPeerCountsByConversation · Stage 9 N+1 collapse", () => {
  it("empty input returns empty Map · never hits the DB", async () => {
    const out = await listUnreadPeerCountsByConversation([], VIEWER);
    expect(out.size).toBe(0);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("3 conversations with mixed unread counts tallies correctly", async () => {
    setMockReturn([
      { conversation_id: C1 },
      { conversation_id: C1 },
      { conversation_id: C1 },
      { conversation_id: C2 },
      // C3 has no unread · returns no rows for its id
    ]);
    const out = await listUnreadPeerCountsByConversation(
      [C1, C2, C3],
      VIEWER,
    );
    expect(out.get(C1)).toBe(3);
    expect(out.get(C2)).toBe(1);
    expect(out.get(C3)).toBeUndefined(); // missing = 0 for callers
    // ONE query · the sealed contract: no N+1 round-trips.
    expect(fromMock).toHaveBeenCalledTimes(1);
    expect(inMock).toHaveBeenCalledTimes(1);
  });

  it("dedupes conversation ids before the IN() call", async () => {
    setMockReturn([{ conversation_id: C1 }]);
    await listUnreadPeerCountsByConversation([C1, C1, C2, C1], VIEWER);
    const inArgs = inMock.mock.calls[0];
    // inMock was called with ("conversation_id", uniqueArray)
    expect(inArgs?.[0]).toBe("conversation_id");
    const uniqueIds = inArgs?.[1] as string[];
    expect(uniqueIds).toHaveLength(2);
    expect(new Set(uniqueIds)).toEqual(new Set([C1, C2]));
  });

  it("filters out viewer's own messages (neq sender_account_id)", async () => {
    setMockReturn([]);
    await listUnreadPeerCountsByConversation([C1], VIEWER);
    expect(neqMock).toHaveBeenCalledWith("sender_account_id", VIEWER);
  });

  it("filters to unread (read_at IS NULL)", async () => {
    setMockReturn([]);
    await listUnreadPeerCountsByConversation([C1], VIEWER);
    expect(isMock).toHaveBeenCalledWith("read_at", null);
  });

  it("returns empty Map on Supabase error (fail-soft)", async () => {
    setMockReturn(null, { message: "transient blip" });
    const out = await listUnreadPeerCountsByConversation([C1, C2], VIEWER);
    expect(out.size).toBe(0);
  });
});
