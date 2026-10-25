// src/lib/nex-native/live-broadcast/__tests__/directory-live-state-by-business-id.test.ts
//
// Phase 2 · G2 · tests for the production-landing resolver variant.

import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const {
  fromMock,
  businessBuilder,
  mockListOpenSessions,
  mockListActivePins,
} = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type AnyFn = (...a: any[]) => any;
  const state: { resolver: () => Promise<unknown> } = {
    resolver: async () => ({ data: [], error: null }),
  };
  const b: Record<string, AnyFn> = {};
  const bFn = () => b;
  b.select = bFn as AnyFn;
  b.in = bFn as AnyFn;
  b.eq = bFn as AnyFn;
  b.is = bFn as AnyFn;
  b.then = ((onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
    state.resolver().then(onF, onR)) as AnyFn;
  (b as unknown as { _setResolver: (r: () => Promise<unknown>) => void })._setResolver = (r) => {
    state.resolver = r;
  };
  return {
    fromMock: vi.fn(() => b),
    businessBuilder: b,
    mockListOpenSessions: vi.fn(),
    mockListActivePins: vi.fn(),
  };
});

vi.mock("@/lib/nex-native/supabase-admin", () => ({
  nexSupabaseAdmin: { from: fromMock },
  nexSupabaseProjectRef: () => "mock",
}));

vi.mock("../live-session-service", () => ({
  listOpenSessionsForBroadcasters: mockListOpenSessions,
  listActiveFeaturedProductsForSessions: mockListActivePins,
}));

function setBusinessRows(rows: readonly unknown[]): void {
  (businessBuilder as unknown as { _setResolver: (r: () => Promise<unknown>) => void })._setResolver(
    async () => ({ data: rows, error: null }),
  );
}
function setBusinessError(): void {
  (businessBuilder as unknown as { _setResolver: (r: () => Promise<unknown>) => void })._setResolver(
    async () => ({ data: null, error: { message: "boom" } }),
  );
}

const BID_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const BID_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const BID_C = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const OWNER_A = "11111111-1111-1111-1111-111111111111";
const OWNER_B = "22222222-2222-2222-2222-222222222222";
const SESSION_A = "99999999-9999-9999-9999-999999999999";
const PRODUCT_A = "dddddddd-dddd-dddd-dddd-dddddddddddd";

beforeEach(() => {
  fromMock.mockClear();
  mockListOpenSessions.mockReset();
  mockListActivePins.mockReset();
  setBusinessRows([]);
  mockListOpenSessions.mockResolvedValue(new Map());
  mockListActivePins.mockResolvedValue(new Map());
});

describe("resolveLiveStateByBusinessIds", () => {
  test("empty input · empty Map · no DB calls", async () => {
    const { resolveLiveStateByBusinessIds } = await import("../directory-live-state");
    const r = await resolveLiveStateByBusinessIds([]);
    expect(r.size).toBe(0);
    expect(fromMock).not.toHaveBeenCalled();
    expect(mockListOpenSessions).not.toHaveBeenCalled();
  });

  test("nobody live · every id maps to empty state", async () => {
    setBusinessRows([
      { id: BID_A, owner_account_id: OWNER_A },
      { id: BID_B, owner_account_id: OWNER_B },
    ]);
    mockListOpenSessions.mockResolvedValue(new Map());
    const { resolveLiveStateByBusinessIds } = await import("../directory-live-state");
    const r = await resolveLiveStateByBusinessIds([BID_A, BID_B]);
    expect(r.get(BID_A)).toEqual({ isOwnerLive: false, liveWatchHref: null });
    expect(r.get(BID_B)).toEqual({ isOwnerLive: false, liveWatchHref: null });
  });

  test("live with featured product · href includes product id", async () => {
    setBusinessRows([{ id: BID_A, owner_account_id: OWNER_A }]);
    mockListOpenSessions.mockResolvedValue(
      new Map([
        [
          OWNER_A,
          {
            id: SESSION_A,
            broadcaster_account_id: OWNER_A,
            business_id: BID_A,
            status: "open",
            started_at: new Date().toISOString(),
            ended_at: null,
            last_heartbeat_at: null,
          },
        ],
      ]),
    );
    mockListActivePins.mockResolvedValue(
      new Map([
        [
          SESSION_A,
          {
            id: "pin-a",
            session_id: SESSION_A,
            product_id: PRODUCT_A,
            started_featuring_at: "x",
            ended_featuring_at: null,
          },
        ],
      ]),
    );
    const { resolveLiveStateByBusinessIds } = await import("../directory-live-state");
    const r = await resolveLiveStateByBusinessIds([BID_A]);
    expect(r.get(BID_A)?.isOwnerLive).toBe(true);
    expect(r.get(BID_A)?.liveWatchHref).toContain(SESSION_A);
    expect(r.get(BID_A)?.liveWatchHref).toContain(`product=${PRODUCT_A}`);
  });

  test("live without featured product · href is the session only", async () => {
    setBusinessRows([{ id: BID_A, owner_account_id: OWNER_A }]);
    mockListOpenSessions.mockResolvedValue(
      new Map([
        [
          OWNER_A,
          {
            id: SESSION_A,
            broadcaster_account_id: OWNER_A,
            business_id: null,
            status: "open",
            started_at: new Date().toISOString(),
            ended_at: null,
            last_heartbeat_at: null,
          },
        ],
      ]),
    );
    mockListActivePins.mockResolvedValue(new Map());
    const { resolveLiveStateByBusinessIds } = await import("../directory-live-state");
    const r = await resolveLiveStateByBusinessIds([BID_A]);
    expect(r.get(BID_A)?.isOwnerLive).toBe(true);
    expect(r.get(BID_A)?.liveWatchHref).toBe(
      `/nex-native/live-commerce/${SESSION_A}`,
    );
    expect(r.get(BID_A)?.liveWatchHref).not.toContain("product=");
  });

  test("business lookup DB error · every id fails open", async () => {
    setBusinessError();
    const { resolveLiveStateByBusinessIds } = await import("../directory-live-state");
    const r = await resolveLiveStateByBusinessIds([BID_A, BID_B]);
    expect(r.get(BID_A)).toEqual({ isOwnerLive: false, liveWatchHref: null });
    expect(r.get(BID_B)).toEqual({ isOwnerLive: false, liveWatchHref: null });
  });

  test("deduplicates business ids before the IN(...) query", async () => {
    let capturedIds: readonly unknown[] | undefined;
    (businessBuilder as unknown as {
      in: (col: string, vals: readonly unknown[]) => unknown;
    }).in = vi.fn((_col, vals) => {
      capturedIds = vals;
      return businessBuilder;
    });
    setBusinessRows([]);
    const { resolveLiveStateByBusinessIds } = await import("../directory-live-state");
    await resolveLiveStateByBusinessIds([BID_A, BID_A, BID_B, "", BID_B]);
    expect(capturedIds).toBeDefined();
    expect(capturedIds!.length).toBe(2); // BID_A + BID_B, empty filtered out
  });

  test("budget · ≤ 3 round trips (business lookup + 2 service helpers)", async () => {
    setBusinessRows([
      { id: BID_A, owner_account_id: OWNER_A },
      { id: BID_B, owner_account_id: OWNER_B },
    ]);
    mockListOpenSessions.mockResolvedValue(new Map());
    const { resolveLiveStateByBusinessIds } = await import("../directory-live-state");
    // 20 unique ids
    const ids: string[] = Array.from({ length: 20 }, (_, i) =>
      i % 2 === 0 ? BID_A : BID_B,
    );
    ids.push(BID_C); // one more unique
    await resolveLiveStateByBusinessIds(ids);
    expect(fromMock.mock.calls.length).toBe(1); // only nex_business
    expect(mockListOpenSessions.mock.calls.length).toBe(1);
    expect(mockListActivePins.mock.calls.length).toBe(1);
  });

  test("business with null owner_account_id · never claimed · empty state", async () => {
    setBusinessRows([
      { id: BID_A, owner_account_id: null }, // unclaimed / corrupt data
    ]);
    mockListOpenSessions.mockResolvedValue(new Map());
    const { resolveLiveStateByBusinessIds } = await import("../directory-live-state");
    const r = await resolveLiveStateByBusinessIds([BID_A]);
    expect(r.get(BID_A)).toEqual({ isOwnerLive: false, liveWatchHref: null });
  });
});
