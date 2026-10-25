// src/lib/nex-native/live-broadcast/__tests__/shop-contacts-dedup.test.ts

import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const { fromMock, edgeBuilder, requestBuilder, setEdgeResolver, setRequestResolver } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type AnyFn = (...a: any[]) => any;
  function makeBuilder() {
    const state: { resolver: () => Promise<unknown> } = {
      resolver: async () => ({ data: [], error: null }),
    };
    const b: Record<string, AnyFn> = {};
    const bFn = () => b;
    b.select = bFn as AnyFn;
    b.in = bFn as AnyFn;
    b.eq = bFn as AnyFn;
    b.or = bFn as AnyFn;
    b.then = ((onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
      state.resolver().then(onF, onR)) as AnyFn;
    return { b, state };
  }
  const edge = makeBuilder();
  const request = makeBuilder();
  return {
    fromMock: vi.fn((table: string) => {
      if (table === "nex_friend_edge") return edge.b;
      if (table === "nex_friend_request") return request.b;
      throw new Error(`unexpected table ${table}`);
    }),
    edgeBuilder: edge.b,
    requestBuilder: request.b,
    setEdgeResolver: (fn: () => Promise<unknown>) => {
      edge.state.resolver = fn;
    },
    setRequestResolver: (fn: () => Promise<unknown>) => {
      request.state.resolver = fn;
    },
  };
});

vi.mock("@/lib/nex-native/supabase-admin", () => ({
  nexSupabaseAdmin: { from: fromMock },
  nexSupabaseProjectRef: () => "mock",
}));

const BROADCASTER = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const P_ACCEPTED = "11111111-1111-1111-1111-111111111111";
const P_PENDING = "22222222-2222-2222-2222-222222222222";
const P_COOLDOWN = "33333333-3333-3333-3333-333333333333";
const P_CLEAN = "44444444-4444-4444-4444-444444444444";

beforeEach(() => {
  fromMock.mockClear();
  setEdgeResolver(async () => ({ data: [], error: null }));
  setRequestResolver(async () => ({ data: [], error: null }));
});

describe("dedupShopContactsCohort", () => {
  test("empty participants · empty Map · no DB call", async () => {
    const svc = await import("../shop-contacts-dedup");
    const r = await svc.dedupShopContactsCohort({
      broadcasterAccountId: BROADCASTER,
      participantAccountIds: [],
    });
    expect(r.size).toBe(0);
    expect(fromMock).not.toHaveBeenCalled();
  });

  test("empty broadcaster · all participants pass through as not-suppressed", async () => {
    const svc = await import("../shop-contacts-dedup");
    const r = await svc.dedupShopContactsCohort({
      broadcasterAccountId: "",
      participantAccountIds: [P_CLEAN],
    });
    expect(r.get(P_CLEAN)?.suppress).toBe(false);
  });

  test("accepted edge suppresses the card with reason 'accepted-edge'", async () => {
    setEdgeResolver(async () => ({
      data: [
        {
          sender_account_id: BROADCASTER,
          recipient_account_id: P_ACCEPTED,
          status: "accepted",
        },
      ],
      error: null,
    }));
    const svc = await import("../shop-contacts-dedup");
    const r = await svc.dedupShopContactsCohort({
      broadcasterAccountId: BROADCASTER,
      participantAccountIds: [P_ACCEPTED, P_CLEAN],
    });
    expect(r.get(P_ACCEPTED)).toEqual({ suppress: true, reason: "accepted-edge" });
    expect(r.get(P_CLEAN)).toEqual({ suppress: false, reason: "none" });
  });

  test("accepted edge works in reverse direction (participant was the sender)", async () => {
    setEdgeResolver(async () => ({
      data: [
        {
          sender_account_id: P_ACCEPTED,
          recipient_account_id: BROADCASTER,
          status: "accepted",
        },
      ],
      error: null,
    }));
    const svc = await import("../shop-contacts-dedup");
    const r = await svc.dedupShopContactsCohort({
      broadcasterAccountId: BROADCASTER,
      participantAccountIds: [P_ACCEPTED],
    });
    expect(r.get(P_ACCEPTED)?.suppress).toBe(true);
    expect(r.get(P_ACCEPTED)?.reason).toBe("accepted-edge");
  });

  test("pending invite suppresses with reason 'pending-invite'", async () => {
    setRequestResolver(async () => ({
      data: [
        {
          sender_account_id: BROADCASTER,
          recipient_account_id: P_PENDING,
          status: "pending",
          cooldown_ends_at: null,
        },
      ],
      error: null,
    }));
    const svc = await import("../shop-contacts-dedup");
    const r = await svc.dedupShopContactsCohort({
      broadcasterAccountId: BROADCASTER,
      participantAccountIds: [P_PENDING, P_CLEAN],
    });
    expect(r.get(P_PENDING)?.reason).toBe("pending-invite");
    expect(r.get(P_CLEAN)?.suppress).toBe(false);
  });

  test("active cooldown (72h) suppresses with reason 'cooldown-active'", async () => {
    const future = new Date(Date.now() + 60 * 1000).toISOString();
    setRequestResolver(async () => ({
      data: [
        {
          sender_account_id: BROADCASTER,
          recipient_account_id: P_COOLDOWN,
          status: "expired",
          cooldown_ends_at: future,
        },
      ],
      error: null,
    }));
    const svc = await import("../shop-contacts-dedup");
    const r = await svc.dedupShopContactsCohort({
      broadcasterAccountId: BROADCASTER,
      participantAccountIds: [P_COOLDOWN],
    });
    expect(r.get(P_COOLDOWN)?.reason).toBe("cooldown-active");
  });

  test("expired cooldown does NOT suppress", async () => {
    const past = new Date(Date.now() - 60 * 1000).toISOString();
    setRequestResolver(async () => ({
      data: [
        {
          sender_account_id: BROADCASTER,
          recipient_account_id: P_CLEAN,
          status: "expired",
          cooldown_ends_at: past,
        },
      ],
      error: null,
    }));
    const svc = await import("../shop-contacts-dedup");
    const r = await svc.dedupShopContactsCohort({
      broadcasterAccountId: BROADCASTER,
      participantAccountIds: [P_CLEAN],
    });
    expect(r.get(P_CLEAN)?.suppress).toBe(false);
  });

  test("precedence · accepted > pending > cooldown > none", async () => {
    setEdgeResolver(async () => ({
      data: [
        {
          sender_account_id: BROADCASTER,
          recipient_account_id: P_ACCEPTED,
          status: "accepted",
        },
      ],
      error: null,
    }));
    const future = new Date(Date.now() + 60 * 1000).toISOString();
    setRequestResolver(async () => ({
      data: [
        {
          sender_account_id: BROADCASTER,
          recipient_account_id: P_ACCEPTED,
          status: "pending",
          cooldown_ends_at: null,
        },
      ],
      error: null,
    }));
    const svc = await import("../shop-contacts-dedup");
    const r = await svc.dedupShopContactsCohort({
      broadcasterAccountId: BROADCASTER,
      participantAccountIds: [P_ACCEPTED],
    });
    // Accepted edge wins the precedence.
    expect(r.get(P_ACCEPTED)?.reason).toBe("accepted-edge");
  });

  test("fail-open · edge query error · no suppression claim · verdict is 'none'", async () => {
    setEdgeResolver(async () => ({
      data: null,
      error: { message: "boom" },
    }));
    const svc = await import("../shop-contacts-dedup");
    const r = await svc.dedupShopContactsCohort({
      broadcasterAccountId: BROADCASTER,
      participantAccountIds: [P_ACCEPTED],
    });
    expect(r.get(P_ACCEPTED)).toEqual({ suppress: false, reason: "none" });
  });

  test("dedup input · dedup across duplicate ids + empty string filtering", async () => {
    let edgeInCall: readonly unknown[] | undefined;
    (edgeBuilder as unknown as {
      in: (col: string, vals: readonly unknown[]) => unknown;
    }).in = vi.fn((_col, vals) => {
      edgeInCall = vals;
      return edgeBuilder;
    });
    setEdgeResolver(async () => ({ data: [], error: null }));
    const svc = await import("../shop-contacts-dedup");
    await svc.dedupShopContactsCohort({
      broadcasterAccountId: BROADCASTER,
      participantAccountIds: [P_CLEAN, P_CLEAN, "", P_ACCEPTED],
    });
    expect(edgeInCall).toBeDefined();
    // first call sets sender_account_id · broadcaster + 2 unique participants
    expect((edgeInCall as unknown[]).length).toBe(3);
  });

  test("budget · ≤ 2 round trips regardless of participant count", async () => {
    const svc = await import("../shop-contacts-dedup");
    const participants = Array.from({ length: 30 }, (_, i) =>
      `11111111-1111-1111-1111-${(i + 100).toString().padStart(12, "0")}`,
    );
    await svc.dedupShopContactsCohort({
      broadcasterAccountId: BROADCASTER,
      participantAccountIds: participants,
    });
    // from() called at most twice (nex_friend_edge + nex_friend_request).
    expect(fromMock.mock.calls.length).toBeLessThanOrEqual(2);
  });
});
