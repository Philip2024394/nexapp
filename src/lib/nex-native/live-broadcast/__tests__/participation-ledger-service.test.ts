// src/lib/nex-native/live-broadcast/__tests__/participation-ledger-service.test.ts
//
// Phase 2 · Live interaction · participation ledger service tests.

import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const { fromMock, chainBuilder, setResolver } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type AnyFn = (...a: any[]) => any;
  const builder: Record<string, AnyFn> = {};
  const bFn = () => builder;
  builder.select = bFn as AnyFn;
  builder.insert = bFn as AnyFn;
  builder.eq = bFn as AnyFn;
  builder.in = bFn as AnyFn;
  const state: { resolver: () => Promise<unknown> } = {
    resolver: async () => ({ data: [], error: null }),
  };
  builder.then = ((onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
    state.resolver().then(onF, onR)) as AnyFn;

  return {
    fromMock: vi.fn(() => builder),
    chainBuilder: builder,
    setResolver: (fn: () => Promise<unknown>) => {
      state.resolver = fn;
    },
  };
});

vi.mock("@/lib/nex-native/supabase-admin", () => ({
  nexSupabaseAdmin: { from: fromMock },
  nexSupabaseProjectRef: () => "mock",
}));

const SESSION = "99999999-9999-9999-9999-999999999999";
const P1 = "11111111-1111-1111-1111-111111111111";
const P2 = "22222222-2222-2222-2222-222222222222";
const P3 = "33333333-3333-3333-3333-333333333333";

beforeEach(() => {
  fromMock.mockClear();
  setResolver(async () => ({ data: [], error: null }));
});

describe("materialiseLiveParticipation", () => {
  test("empty participants · no DB call · returns inserted=0", async () => {
    const svc = await import("../participation-ledger-service");
    const r = await svc.materialiseLiveParticipation({
      sessionId: SESSION,
      sessionEndedAt: new Date(),
      participants: new Map(),
    });
    expect(r.inserted).toBe(0);
    expect(fromMock).not.toHaveBeenCalled();
  });

  test("builds rows with correct evidence mask bits", async () => {
    let capturedRows: unknown[] | undefined;
    (chainBuilder as unknown as {
      insert: (rows: unknown[], opts?: unknown) => unknown;
    }).insert = vi.fn((rows: unknown[]) => {
      capturedRows = rows;
      return chainBuilder;
    });
    setResolver(async () => ({ data: [{ id: "a" }, { id: "b" }], error: null }));

    const svc = await import("../participation-ledger-service");
    await svc.materialiseLiveParticipation({
      sessionId: SESSION,
      sessionEndedAt: new Date("2026-10-24T22:00:00Z"),
      participants: new Map([
        [P1, new Set<"like" | "comment" | "share">(["like"])],       // 0b001 = 1
        [P2, new Set<"like" | "comment" | "share">(["like", "comment"])], // 0b011 = 3
        [P3, new Set<"like" | "comment" | "share">(["share"])],      // 0b100 = 4
      ]),
    });
    expect(capturedRows).toBeDefined();
    const rows = capturedRows as Array<{
      session_id: string;
      participant_account_id: string;
      evidence_mask: number;
      shuffle_anchor_at: string;
      shuffle_seed: Buffer;
    }>;
    expect(rows).toHaveLength(3);
    const byId = new Map(rows.map((r) => [r.participant_account_id, r]));
    expect(byId.get(P1)?.evidence_mask).toBe(1);
    expect(byId.get(P2)?.evidence_mask).toBe(3);
    expect(byId.get(P3)?.evidence_mask).toBe(4);
    // All rows share the same anchor timestamp.
    const anchors = new Set(rows.map((r) => r.shuffle_anchor_at));
    expect(anchors.size).toBe(1);
    expect(anchors.values().next().value).toBe("2026-10-24T22:00:00.000Z");
    // All rows share the same shuffle seed (16 bytes).
    const seeds = new Set(rows.map((r) => r.shuffle_seed.toString("hex")));
    expect(seeds.size).toBe(1);
    expect(rows[0]!.shuffle_seed.length).toBe(16);
  });

  test("fail-closed · throws on PG error", async () => {
    setResolver(async () => ({
      data: null,
      error: { code: "23505", message: "unique violation" },
    }));
    const svc = await import("../participation-ledger-service");
    await expect(
      svc.materialiseLiveParticipation({
        sessionId: SESSION,
        sessionEndedAt: new Date(),
        participants: new Map([[P1, new Set(["like"] as const)]]),
      }),
    ).rejects.toThrow(/23505/);
  });
});

describe("listShopContactsCards", () => {
  test("fail-open · returns [] on query error", async () => {
    setResolver(async () => ({ data: null, error: { message: "boom" } }));
    const svc = await import("../participation-ledger-service");
    const r = await svc.listShopContactsCards(SESSION);
    expect(r).toEqual([]);
  });

  test("projects only the safe fields · drops evidence + first_evidence_at", async () => {
    setResolver(async () => ({
      data: [
        {
          participant_account_id: P1,
          session_id: SESSION,
          shuffle_anchor_at: "2026-10-24T22:00:00Z",
          shuffle_seed: Buffer.from("abcdef0123456789abcdef0123456789", "hex"),
        },
      ],
      error: null,
    }));
    const svc = await import("../participation-ledger-service");
    const r = await svc.listShopContactsCards(SESSION);
    expect(r).toHaveLength(1);
    const only = r[0]!;
    expect(only.participantAccountId).toBe(P1);
    expect(only.sessionId).toBe(SESSION);
    expect(only.shuffleAnchorAt).toBe("2026-10-24T22:00:00Z");
    expect(only.shuffleSeedHex).toBe("abcdef0123456789abcdef0123456789");
    // Prove no leaked fields.
    expect((only as unknown as Record<string, unknown>).evidence_mask).toBeUndefined();
    expect((only as unknown as Record<string, unknown>).first_evidence_at).toBeUndefined();
    expect((only as unknown as Record<string, unknown>).created_at).toBeUndefined();
  });

  test("hex string seed (from text transport) passes through unchanged", async () => {
    setResolver(async () => ({
      data: [
        {
          participant_account_id: P1,
          session_id: SESSION,
          shuffle_anchor_at: "x",
          shuffle_seed: "cafebabedeadbeef1234567890abcdef",
        },
      ],
      error: null,
    }));
    const svc = await import("../participation-ledger-service");
    const r = await svc.listShopContactsCards(SESSION);
    expect(r[0]?.shuffleSeedHex).toBe("cafebabedeadbeef1234567890abcdef");
  });
});

describe("shuffleCards · deterministic", () => {
  test("same seed · same inputs · same order on every call", async () => {
    const svc = await import("../participation-ledger-service");
    const input = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const seed = "0f1e2d3c4b5a69788796a5b4c3d2e1f0";
    const r1 = svc.shuffleCards(input, seed);
    const r2 = svc.shuffleCards(input, seed);
    expect(r1).toEqual(r2);
  });

  test("different seeds · different order (near-certainly for N ≥ 4)", async () => {
    const svc = await import("../participation-ledger-service");
    const input = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const r1 = svc.shuffleCards(input, "0f1e2d3c4b5a69788796a5b4c3d2e1f0");
    const r2 = svc.shuffleCards(input, "ffffffffffffffffffffffffffffffff");
    expect(r1).not.toEqual(r2);
  });

  test("single-element input · unchanged", async () => {
    const svc = await import("../participation-ledger-service");
    expect(svc.shuffleCards(["only"], "abc")).toEqual(["only"]);
  });

  test("empty input · empty output", async () => {
    const svc = await import("../participation-ledger-service");
    expect(svc.shuffleCards([], "abc")).toEqual([]);
  });

  test("empty seed · still returns a stable permutation (no throw)", async () => {
    const svc = await import("../participation-ledger-service");
    const r = svc.shuffleCards(["a", "b", "c"], "");
    expect(r.length).toBe(3);
    expect(new Set(r)).toEqual(new Set(["a", "b", "c"]));
  });
});

describe("evidenceBit", () => {
  test("constants are the expected powers of two", async () => {
    const svc = await import("../participation-ledger-service");
    expect(svc.EVIDENCE_LIKE).toBe(1);
    expect(svc.EVIDENCE_COMMENT).toBe(2);
    expect(svc.EVIDENCE_SHARE).toBe(4);
    expect(svc.evidenceBit("like")).toBe(1);
    expect(svc.evidenceBit("comment")).toBe(2);
    expect(svc.evidenceBit("share")).toBe(4);
  });
});
