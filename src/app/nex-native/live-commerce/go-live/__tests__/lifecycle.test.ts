// src/app/nex-native/live-commerce/go-live/__tests__/lifecycle.test.ts
//
// Phase 2 · G2 · lifecycle coverage for the Live broadcaster actions.
// -----------------------------------------------------------------------------
// EVIDENCE BOUNDARY
//   · Behaviour tests mock resolveNexAppSessionFromContext +
//     business-service + product-service + live-session-service. They
//     do NOT verify Postgres partial unique indexes, RLS policies, or
//     concurrent write races. Those require sandbox DB apply of
//     Migration 219 and are explicitly out of scope for this file.
//
// Scenarios covered (per mandate · 10 lifecycle paths):
//   1 · start · signed-in with owned business
//   2 · start · idempotent (returns existing open session)
//   3 · heartbeat · signed-in owner · delegates to touchHeartbeat
//   4 · heartbeat · malformed sessionId · rejected
//   5 · heartbeat · unauthorised (guest) caller · rejected
//   6 · feature product · signed-in owner · succeeds
//   7 · feature product · product in a non-owned business · rejected
//   8 · feature product · malformed productId · rejected
//   9 · clear product · signed-in owner · succeeds
//  10 · end session · signed-in · delegates to endLiveSession
//  11 · end session · unauthorised (guest) · rejected
//
// Fail-closed contract: every write action returns ok=false with a
// specific reason string on failure · never { ok: true, data: ... }.

import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

/* ─── Mocks ──────────────────────────────────────────────────── */

const {
  mockResolveSession,
  mockListBusinesses,
  mockGetProduct,
  mockStartLiveSession,
  mockEndLiveSession,
  mockTouchHeartbeat,
  mockSetFeaturedProduct,
  mockClearFeaturedProduct,
  mockGetActiveSession,
  mockAggregateEngagement,
  mockMaterialiseParticipation,
  mockRecordEngagement,
} = vi.hoisted(() => ({
  mockResolveSession: vi.fn(),
  mockListBusinesses: vi.fn(),
  mockGetProduct: vi.fn(),
  mockStartLiveSession: vi.fn(),
  mockEndLiveSession: vi.fn(),
  mockTouchHeartbeat: vi.fn(),
  mockSetFeaturedProduct: vi.fn(),
  mockClearFeaturedProduct: vi.fn(),
  mockGetActiveSession: vi.fn(),
  mockAggregateEngagement: vi.fn(),
  mockMaterialiseParticipation: vi.fn(),
  mockRecordEngagement: vi.fn(),
}));

vi.mock("@/lib/nex-native/app/session", () => ({
  resolveNexAppSessionFromContext: mockResolveSession,
}));

vi.mock("@/lib/nex-native/business-service", () => ({
  listBusinessesByOwner: mockListBusinesses,
}));

vi.mock("@/lib/nex-native/product-service", () => ({
  getProductById: mockGetProduct,
}));

vi.mock("@/lib/nex-native/live-broadcast/live-session-service", () => ({
  startLiveSession: mockStartLiveSession,
  endLiveSession: mockEndLiveSession,
  touchHeartbeat: mockTouchHeartbeat,
  setFeaturedProduct: mockSetFeaturedProduct,
  clearFeaturedProduct: mockClearFeaturedProduct,
  getActiveSessionForBroadcaster: mockGetActiveSession,
}));
vi.mock("@/lib/nex-native/live-broadcast/participation-engagement-service", () => ({
  aggregateEngagementBySession: mockAggregateEngagement,
  recordEngagement: mockRecordEngagement,
}));
vi.mock("@/lib/nex-native/live-broadcast/participation-ledger-service", () => ({
  materialiseLiveParticipation: mockMaterialiseParticipation,
}));

/* ─── Fixtures ──────────────────────────────────────────────── */

const BROADCASTER = "11111111-1111-1111-1111-111111111111";
const SESSION_ID = "22222222-2222-2222-2222-222222222222";
const BUSINESS_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const PRODUCT_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const OTHER_BUSINESS = "ffffffff-ffff-ffff-ffff-ffffffffffff";

function signInAs(accountId: string): void {
  mockResolveSession.mockResolvedValue({ account: { id: accountId } });
}

function signedOut(): void {
  mockResolveSession.mockResolvedValue(null);
}

beforeEach(() => {
  mockResolveSession.mockReset();
  mockListBusinesses.mockReset();
  mockGetProduct.mockReset();
  mockStartLiveSession.mockReset();
  mockEndLiveSession.mockReset();
  mockTouchHeartbeat.mockReset();
  mockSetFeaturedProduct.mockReset();
  mockClearFeaturedProduct.mockReset();
  mockGetActiveSession.mockReset();
  mockAggregateEngagement.mockReset();
  mockAggregateEngagement.mockResolvedValue(new Map());
  mockMaterialiseParticipation.mockReset();
  mockMaterialiseParticipation.mockResolvedValue({ inserted: 0 });
  mockRecordEngagement.mockReset();
});

/* ─── 1 · start with owned business ─────────────────────────── */

describe("startLiveSessionAction", () => {
  test("1 · signed-in owner · creates session + attaches first owned business", async () => {
    signInAs(BROADCASTER);
    mockListBusinesses.mockResolvedValue([{ id: BUSINESS_ID }]);
    mockGetActiveSession.mockResolvedValue(null);
    mockStartLiveSession.mockResolvedValue({
      id: SESSION_ID,
      broadcaster_account_id: BROADCASTER,
      business_id: BUSINESS_ID,
      status: "open",
    });
    const { startLiveSessionAction } = await import("../_actions");
    const r = await startLiveSessionAction();
    expect(r).toEqual({ ok: true, data: { sessionId: SESSION_ID, businessId: BUSINESS_ID } });
    expect(mockStartLiveSession).toHaveBeenCalledWith({
      broadcasterAccountId: BROADCASTER,
      businessId: BUSINESS_ID,
    });
  });

  test("2 · idempotent · reuses existing open session instead of inserting a duplicate", async () => {
    signInAs(BROADCASTER);
    mockListBusinesses.mockResolvedValue([{ id: BUSINESS_ID }]);
    mockGetActiveSession.mockResolvedValue({
      id: SESSION_ID,
      broadcaster_account_id: BROADCASTER,
      business_id: BUSINESS_ID,
      status: "open",
    });
    const { startLiveSessionAction } = await import("../_actions");
    const r = await startLiveSessionAction();
    expect(r).toEqual({ ok: true, data: { sessionId: SESSION_ID, businessId: BUSINESS_ID } });
    expect(mockStartLiveSession).not.toHaveBeenCalled();
  });

  test("signed-out · rejected with not-signed-in", async () => {
    signedOut();
    const { startLiveSessionAction } = await import("../_actions");
    const r = await startLiveSessionAction();
    expect(r).toEqual({ ok: false, reason: "not-signed-in" });
  });

  test("owner with no businesses · free-tier · businessId null (no featured products allowed later)", async () => {
    signInAs(BROADCASTER);
    mockListBusinesses.mockResolvedValue([]);
    mockGetActiveSession.mockResolvedValue(null);
    mockStartLiveSession.mockResolvedValue({
      id: SESSION_ID,
      broadcaster_account_id: BROADCASTER,
      business_id: null,
      status: "open",
    });
    const { startLiveSessionAction } = await import("../_actions");
    const r = await startLiveSessionAction();
    expect(r).toEqual({ ok: true, data: { sessionId: SESSION_ID, businessId: null } });
  });

  test("startLiveSession throws (e.g. 23505 race) · surfaces as ok=false with message", async () => {
    signInAs(BROADCASTER);
    mockListBusinesses.mockResolvedValue([{ id: BUSINESS_ID }]);
    mockGetActiveSession.mockResolvedValue(null);
    mockStartLiveSession.mockRejectedValue(new Error("23505: duplicate key"));
    const { startLiveSessionAction } = await import("../_actions");
    const r = await startLiveSessionAction();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/23505/);
  });
});

/* ─── 3-5 · heartbeat ──────────────────────────────────────── */

describe("touchLiveHeartbeatAction", () => {
  test("3 · signed-in owner · valid UUID · delegates to touchHeartbeat", async () => {
    signInAs(BROADCASTER);
    mockTouchHeartbeat.mockResolvedValue(undefined);
    const { touchLiveHeartbeatAction } = await import("../_actions");
    const r = await touchLiveHeartbeatAction({ sessionId: SESSION_ID });
    expect(r).toEqual({ ok: true, data: undefined });
    expect(mockTouchHeartbeat).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      broadcasterAccountId: BROADCASTER,
    });
  });

  test("4 · malformed sessionId · rejected with invalid-session-id · service never called", async () => {
    signInAs(BROADCASTER);
    const { touchLiveHeartbeatAction } = await import("../_actions");
    const r = await touchLiveHeartbeatAction({ sessionId: "not-a-uuid" });
    expect(r).toEqual({ ok: false, reason: "invalid-session-id" });
    expect(mockTouchHeartbeat).not.toHaveBeenCalled();
  });

  test("5 · unauthorised (guest) caller · rejected with not-signed-in · service never called", async () => {
    signedOut();
    const { touchLiveHeartbeatAction } = await import("../_actions");
    const r = await touchLiveHeartbeatAction({ sessionId: SESSION_ID });
    expect(r).toEqual({ ok: false, reason: "not-signed-in" });
    expect(mockTouchHeartbeat).not.toHaveBeenCalled();
  });
});

/* ─── 6-8 · feature product ────────────────────────────────── */

describe("setLiveFeaturedProductAction", () => {
  test("6 · signed-in owner · product in owned business · succeeds", async () => {
    signInAs(BROADCASTER);
    mockGetProduct.mockResolvedValue({
      id: PRODUCT_ID,
      business_id: BUSINESS_ID,
    });
    mockListBusinesses.mockResolvedValue([{ id: BUSINESS_ID }]);
    mockSetFeaturedProduct.mockResolvedValue({
      id: "pin-1",
      session_id: SESSION_ID,
      product_id: PRODUCT_ID,
    });
    const { setLiveFeaturedProductAction } = await import("../_actions");
    const r = await setLiveFeaturedProductAction({
      sessionId: SESSION_ID,
      productId: PRODUCT_ID,
    });
    expect(r).toEqual({ ok: true, data: { productId: PRODUCT_ID } });
    expect(mockSetFeaturedProduct).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      broadcasterAccountId: BROADCASTER,
      productId: PRODUCT_ID,
    });
  });

  test("7 · product in non-owned business · rejected", async () => {
    signInAs(BROADCASTER);
    mockGetProduct.mockResolvedValue({
      id: PRODUCT_ID,
      business_id: OTHER_BUSINESS,
    });
    mockListBusinesses.mockResolvedValue([{ id: BUSINESS_ID }]);
    const { setLiveFeaturedProductAction } = await import("../_actions");
    const r = await setLiveFeaturedProductAction({
      sessionId: SESSION_ID,
      productId: PRODUCT_ID,
    });
    expect(r).toEqual({ ok: false, reason: "product-not-in-owned-business" });
    expect(mockSetFeaturedProduct).not.toHaveBeenCalled();
  });

  test("8 · malformed productId · rejected with invalid-product-id", async () => {
    signInAs(BROADCASTER);
    const { setLiveFeaturedProductAction } = await import("../_actions");
    const r = await setLiveFeaturedProductAction({
      sessionId: SESSION_ID,
      productId: "not-a-uuid",
    });
    expect(r).toEqual({ ok: false, reason: "invalid-product-id" });
    expect(mockGetProduct).not.toHaveBeenCalled();
    expect(mockSetFeaturedProduct).not.toHaveBeenCalled();
  });

  test("unknown productId · rejected with product-not-found", async () => {
    signInAs(BROADCASTER);
    mockGetProduct.mockResolvedValue(null);
    const { setLiveFeaturedProductAction } = await import("../_actions");
    const r = await setLiveFeaturedProductAction({
      sessionId: SESSION_ID,
      productId: PRODUCT_ID,
    });
    expect(r).toEqual({ ok: false, reason: "product-not-found" });
    expect(mockSetFeaturedProduct).not.toHaveBeenCalled();
  });

  test("signed-out · rejected with not-signed-in · product never looked up", async () => {
    signedOut();
    const { setLiveFeaturedProductAction } = await import("../_actions");
    const r = await setLiveFeaturedProductAction({
      sessionId: SESSION_ID,
      productId: PRODUCT_ID,
    });
    expect(r).toEqual({ ok: false, reason: "not-signed-in" });
    expect(mockGetProduct).not.toHaveBeenCalled();
    expect(mockSetFeaturedProduct).not.toHaveBeenCalled();
  });
});

/* ─── 9 · clear product ────────────────────────────────────── */

describe("clearLiveFeaturedProductAction", () => {
  test("9 · signed-in owner · succeeds · delegates to clearFeaturedProduct", async () => {
    signInAs(BROADCASTER);
    mockClearFeaturedProduct.mockResolvedValue(undefined);
    const { clearLiveFeaturedProductAction } = await import("../_actions");
    const r = await clearLiveFeaturedProductAction({ sessionId: SESSION_ID });
    expect(r).toEqual({ ok: true, data: undefined });
    expect(mockClearFeaturedProduct).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      broadcasterAccountId: BROADCASTER,
    });
  });

  test("clear · malformed sessionId · rejected", async () => {
    signInAs(BROADCASTER);
    const { clearLiveFeaturedProductAction } = await import("../_actions");
    const r = await clearLiveFeaturedProductAction({ sessionId: "bad" });
    expect(r).toEqual({ ok: false, reason: "invalid-session-id" });
  });
});

/* ─── 10-11 · end session ────────────────────────────────── */

describe("endLiveSessionAction", () => {
  test("10 · signed-in · delegates to endLiveSession with ownership token", async () => {
    signInAs(BROADCASTER);
    mockEndLiveSession.mockResolvedValue(undefined);
    const { endLiveSessionAction } = await import("../_actions");
    const r = await endLiveSessionAction({ sessionId: SESSION_ID });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.materialisedParticipants).toBe(0);
    expect(mockEndLiveSession).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      broadcasterAccountId: BROADCASTER,
    });
  });

  test("end session · aggregates engagement + materialises ledger when participants present", async () => {
    signInAs(BROADCASTER);
    mockEndLiveSession.mockResolvedValue(undefined);
    const map = new Map<string, Set<"like" | "comment" | "share">>([
      ["aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", new Set(["like", "comment"])],
      ["bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", new Set(["share"])],
    ]);
    mockAggregateEngagement.mockResolvedValue(map);
    mockMaterialiseParticipation.mockResolvedValue({ inserted: 2 });
    const { endLiveSessionAction } = await import("../_actions");
    const r = await endLiveSessionAction({ sessionId: SESSION_ID });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.materialisedParticipants).toBe(2);
    expect(mockAggregateEngagement).toHaveBeenCalledWith(SESSION_ID);
    expect(mockMaterialiseParticipation).toHaveBeenCalledTimes(1);
    const materArg = mockMaterialiseParticipation.mock.calls[0]![0];
    expect(materArg.sessionId).toBe(SESSION_ID);
    expect(materArg.participants).toBe(map);
  });

  test("end session · zero engagement · ledger write skipped · materialisedParticipants=0", async () => {
    signInAs(BROADCASTER);
    mockEndLiveSession.mockResolvedValue(undefined);
    mockAggregateEngagement.mockResolvedValue(new Map());
    const { endLiveSessionAction } = await import("../_actions");
    const r = await endLiveSessionAction({ sessionId: SESSION_ID });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.materialisedParticipants).toBe(0);
    expect(mockMaterialiseParticipation).not.toHaveBeenCalled();
  });

  test("end session · ledger write fails · session still ended cleanly · materialisedParticipants=0", async () => {
    signInAs(BROADCASTER);
    mockEndLiveSession.mockResolvedValue(undefined);
    mockAggregateEngagement.mockResolvedValue(
      new Map([["aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", new Set(["like"] as const)]]),
    );
    mockMaterialiseParticipation.mockRejectedValue(new Error("ledger apply failed"));
    const { endLiveSessionAction } = await import("../_actions");
    const r = await endLiveSessionAction({ sessionId: SESSION_ID });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.materialisedParticipants).toBe(0);
    expect(mockEndLiveSession).toHaveBeenCalledTimes(1);
  });

  test("end session · session end runs BEFORE engagement aggregation (closes write window)", async () => {
    signInAs(BROADCASTER);
    const order: string[] = [];
    mockEndLiveSession.mockImplementation(async () => {
      order.push("end");
    });
    mockAggregateEngagement.mockImplementation(async () => {
      order.push("aggregate");
      return new Map();
    });
    const { endLiveSessionAction } = await import("../_actions");
    await endLiveSessionAction({ sessionId: SESSION_ID });
    expect(order).toEqual(["end", "aggregate"]);
  });

  test("11 · unauthorised (guest) · rejected with not-signed-in · service never called", async () => {
    signedOut();
    const { endLiveSessionAction } = await import("../_actions");
    const r = await endLiveSessionAction({ sessionId: SESSION_ID });
    expect(r).toEqual({ ok: false, reason: "not-signed-in" });
    expect(mockEndLiveSession).not.toHaveBeenCalled();
  });

  test("end · malformed sessionId · rejected", async () => {
    signInAs(BROADCASTER);
    const { endLiveSessionAction } = await import("../_actions");
    const r = await endLiveSessionAction({ sessionId: "nope" });
    expect(r).toEqual({ ok: false, reason: "invalid-session-id" });
    expect(mockEndLiveSession).not.toHaveBeenCalled();
  });

  test("end · service throws · surfaces as ok=false", async () => {
    signInAs(BROADCASTER);
    mockEndLiveSession.mockRejectedValue(new Error("boom"));
    const { endLiveSessionAction } = await import("../_actions");
    const r = await endLiveSessionAction({ sessionId: SESSION_ID });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/boom/);
  });
});

/* ─── 12-16 · recordLiveEngagementAction ──────────────────── */

describe("recordLiveEngagementAction", () => {
  test("signed-in viewer · like · delegates with correct kind", async () => {
    signInAs(BROADCASTER);
    mockRecordEngagement.mockResolvedValue(undefined);
    const { recordLiveEngagementAction } = await import("../_actions");
    const r = await recordLiveEngagementAction({
      sessionId: SESSION_ID,
      kind: "like",
    });
    expect(r).toEqual({ ok: true, data: undefined });
    expect(mockRecordEngagement).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      viewerAccountId: BROADCASTER,
      kind: "like",
      shareEvidence: undefined,
    });
  });

  test("share · requires shareEvidence · rejected without it", async () => {
    signInAs(BROADCASTER);
    const { recordLiveEngagementAction } = await import("../_actions");
    const r = await recordLiveEngagementAction({
      sessionId: SESSION_ID,
      kind: "share",
    });
    expect(r).toEqual({ ok: false, reason: "share-requires-evidence" });
    expect(mockRecordEngagement).not.toHaveBeenCalled();
  });

  test("like · rejects spurious shareEvidence (defence-in-depth)", async () => {
    signInAs(BROADCASTER);
    const { recordLiveEngagementAction } = await import("../_actions");
    const r = await recordLiveEngagementAction({
      sessionId: SESSION_ID,
      kind: "like",
      shareEvidence: "native-share",
    });
    expect(r).toEqual({
      ok: false,
      reason: "share-evidence-only-valid-for-share",
    });
    expect(mockRecordEngagement).not.toHaveBeenCalled();
  });

  test("malformed sessionId · rejected · service never called", async () => {
    signInAs(BROADCASTER);
    const { recordLiveEngagementAction } = await import("../_actions");
    const r = await recordLiveEngagementAction({
      sessionId: "not-a-uuid",
      kind: "like",
    });
    expect(r).toEqual({ ok: false, reason: "invalid-session-id" });
    expect(mockRecordEngagement).not.toHaveBeenCalled();
  });

  test("unauthenticated · rejected · service never called", async () => {
    signedOut();
    const { recordLiveEngagementAction } = await import("../_actions");
    const r = await recordLiveEngagementAction({
      sessionId: SESSION_ID,
      kind: "like",
    });
    expect(r).toEqual({ ok: false, reason: "not-signed-in" });
    expect(mockRecordEngagement).not.toHaveBeenCalled();
  });

  test("share with valid evidence · persisted with the tag", async () => {
    signInAs(BROADCASTER);
    mockRecordEngagement.mockResolvedValue(undefined);
    const { recordLiveEngagementAction } = await import("../_actions");
    const r = await recordLiveEngagementAction({
      sessionId: SESSION_ID,
      kind: "share",
      shareEvidence: "copy-link",
    });
    expect(r.ok).toBe(true);
    expect(mockRecordEngagement).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      viewerAccountId: BROADCASTER,
      kind: "share",
      shareEvidence: "copy-link",
    });
  });
});

/* ─── Explicit non-claims ──────────────────────────────────── */

describe("explicit non-claims · what this file does NOT prove", () => {
  test("does NOT prove stale-session cleanup is scheduled", () => {
    // Phase 2 Slice 1 did not ship a stale-session worker. The schema
    // supports it (last_heartbeat_at) but there is no cron, no edge
    // function, and no DB job referenced in the migration or service.
    // This is captured as a design gap, not a defect fixed here.
    expect(true).toBe(true);
  });

  test("does NOT prove partial unique indexes catch concurrent inserts", () => {
    // Needs Postgres + Migration 219 applied. Sandbox DB not available
    // in this environment (Docker Desktop not running).
    expect(true).toBe(true);
  });

  test("does NOT prove disconnect/reconnect semantics on the WebRTC mesh", () => {
    // Those live in viewer-client / broadcaster-client plus the Realtime
    // channel. Covered by separate presence tests · not in this file.
    expect(true).toBe(true);
  });
});
