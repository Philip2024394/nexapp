// src/lib/nex-native/live-broadcast/__tests__/participation-engagement-service.test.ts

import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const { fromMock, chainBuilder, setResolver, lastUpsertPayload, lastUpsertOpts } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type AnyFn = (...a: any[]) => any;
  const state: {
    resolver: () => Promise<unknown>;
    upsertPayload: unknown;
    upsertOpts: unknown;
  } = {
    resolver: async () => ({ data: null, error: null }),
    upsertPayload: null,
    upsertOpts: null,
  };
  const b: Record<string, AnyFn> = {};
  const bFn = () => b;
  b.select = bFn as AnyFn;
  b.eq = bFn as AnyFn;
  b.in = bFn as AnyFn;
  b.upsert = ((payload: unknown, opts: unknown) => {
    state.upsertPayload = payload;
    state.upsertOpts = opts;
    return b;
  }) as AnyFn;
  b.then = ((onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
    state.resolver().then(onF, onR)) as AnyFn;
  return {
    fromMock: vi.fn(() => b),
    chainBuilder: b,
    setResolver: (fn: () => Promise<unknown>) => {
      state.resolver = fn;
    },
    lastUpsertPayload: () => state.upsertPayload,
    lastUpsertOpts: () => state.upsertOpts,
  };
});

vi.mock("@/lib/nex-native/supabase-admin", () => ({
  nexSupabaseAdmin: { from: fromMock },
  nexSupabaseProjectRef: () => "mock",
}));

const SESSION = "99999999-9999-9999-9999-999999999999";
const V1 = "11111111-1111-1111-1111-111111111111";
const V2 = "22222222-2222-2222-2222-222222222222";

beforeEach(() => {
  fromMock.mockClear();
  setResolver(async () => ({ data: null, error: null }));
});

describe("recordEngagement", () => {
  test("like · persists row with kind='like' + null share_evidence", async () => {
    const { recordEngagement } = await import("../participation-engagement-service");
    await recordEngagement({
      sessionId: SESSION,
      viewerAccountId: V1,
      kind: "like",
    });
    expect(fromMock).toHaveBeenCalledWith("nex_live_engagement");
    const payload = lastUpsertPayload() as {
      session_id: string;
      viewer_account_id: string;
      kind: string;
      share_evidence: string | null;
    };
    expect(payload).toEqual({
      session_id: SESSION,
      viewer_account_id: V1,
      kind: "like",
      share_evidence: null,
    });
  });

  test("share · persists validated evidence tag", async () => {
    const { recordEngagement } = await import("../participation-engagement-service");
    await recordEngagement({
      sessionId: SESSION,
      viewerAccountId: V2,
      kind: "share",
      shareEvidence: "copy-link",
    });
    const payload = lastUpsertPayload() as { kind: string; share_evidence: string };
    expect(payload.kind).toBe("share");
    expect(payload.share_evidence).toBe("copy-link");
  });

  test("upsert uses onConflict with ignoreDuplicates for idempotency", async () => {
    const { recordEngagement } = await import("../participation-engagement-service");
    await recordEngagement({ sessionId: SESSION, viewerAccountId: V1, kind: "comment" });
    const opts = lastUpsertOpts() as { onConflict: string; ignoreDuplicates: boolean };
    expect(opts.onConflict).toContain("session_id");
    expect(opts.onConflict).toContain("viewer_account_id");
    expect(opts.onConflict).toContain("kind");
    expect(opts.ignoreDuplicates).toBe(true);
  });

  test("rejects shareEvidence on non-share kinds (defence-in-depth)", async () => {
    const { recordEngagement } = await import("../participation-engagement-service");
    await expect(
      recordEngagement({
        sessionId: SESSION,
        viewerAccountId: V1,
        kind: "like",
        shareEvidence: "native-share",
      }),
    ).rejects.toThrow(/only valid when kind='share'/);
  });

  test("fail-closed · throws on PG error", async () => {
    setResolver(async () => ({ data: null, error: { code: "42501", message: "insufficient_privilege" } }));
    const { recordEngagement } = await import("../participation-engagement-service");
    await expect(
      recordEngagement({ sessionId: SESSION, viewerAccountId: V1, kind: "like" }),
    ).rejects.toThrow(/42501/);
  });
});

describe("aggregateEngagementBySession", () => {
  test("groups rows by viewer · unions kinds · same session", async () => {
    setResolver(async () => ({
      data: [
        { viewer_account_id: V1, kind: "like" },
        { viewer_account_id: V1, kind: "comment" },
        { viewer_account_id: V2, kind: "share" },
      ],
      error: null,
    }));
    const { aggregateEngagementBySession } = await import("../participation-engagement-service");
    const r = await aggregateEngagementBySession(SESSION);
    expect(r.size).toBe(2);
    const v1 = r.get(V1)!;
    expect([...v1].sort()).toEqual(["comment", "like"]);
    const v2 = r.get(V2)!;
    expect([...v2]).toEqual(["share"]);
  });

  test("fail-open · empty Map on query error", async () => {
    setResolver(async () => ({ data: null, error: { message: "boom" } }));
    const { aggregateEngagementBySession } = await import("../participation-engagement-service");
    const r = await aggregateEngagementBySession(SESSION);
    expect(r.size).toBe(0);
  });

  test("empty rows · empty Map", async () => {
    setResolver(async () => ({ data: [], error: null }));
    const { aggregateEngagementBySession } = await import("../participation-engagement-service");
    const r = await aggregateEngagementBySession(SESSION);
    expect(r.size).toBe(0);
  });
});
