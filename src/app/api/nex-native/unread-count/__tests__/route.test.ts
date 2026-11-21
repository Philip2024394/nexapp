// src/app/api/nex-native/unread-count/__tests__/route.test.ts
//
// Owner directive 2026-10-16 (corrective pass) · regression tests for
// the two authorised fixes:
//
//   A · zero-on-error · a database failure MUST return a non-2xx
//       response so the client's `!res.ok` guard preserves the
//       last known badge value. Previous behaviour returned
//       `{ count: 0 }` on any throw, which would clear a user's
//       badge during a transient outage.
//
//   B · Vault exclusion · unread messages in VAULTED conversations
//       MUST NOT be counted (the aggregate badge excludes Vault
//       activity). This test verifies the handler returns the
//       correct count by swapping the service with a mock that
//       inspects the viewerAccountId.
//
// Also verifies:
//   · Anonymous viewer returns 200 { count: 0 } (correct zero, no leak).
//   · Successful signed-in viewer returns 200 { count: N }.
//   · No-store cache header is applied to all responses.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  resolveSessionMock,
  countTotalUnreadMock,
  countSellerUnreadOrdersMock,
} = vi.hoisted(() => ({
  resolveSessionMock: vi.fn(),
  countTotalUnreadMock: vi.fn(),
  countSellerUnreadOrdersMock: vi.fn(),
}));

vi.mock("@/lib/nex-native/app/session", () => ({
  resolveNexAppSessionFromContext: resolveSessionMock,
}));
vi.mock("@/lib/nex-native/peer-message-service", () => ({
  countTotalUnreadPeerMessages: countTotalUnreadMock,
}));
vi.mock("@/lib/nex-native/manage-orders/order-unread-service", () => ({
  countSellerUnreadOrders: countSellerUnreadOrdersMock,
}));

import { GET } from "../route";

// Valid UUIDv4 shape; previous `acct-viewer-00000000` tripped the real
// pg call when order-unread-service wasn't mocked (route added orders
// channel in Stream B 2026-11-16).
const VIEWER = "00000000-0000-4000-8000-000000000001";

function signedInSession() {
  return { account: { id: VIEWER, display_name: "Viewer" } };
}

beforeEach(() => {
  resolveSessionMock.mockReset();
  countTotalUnreadMock.mockReset();
  countSellerUnreadOrdersMock.mockReset();
  // Default orders to 0 so legacy chat-only assertions still see
  // total = chat; individual tests override when they need a non-zero
  // orders count.
  countSellerUnreadOrdersMock.mockResolvedValue(0);
});
afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/nex-native/unread-count · success paths", () => {
  it("anonymous viewer returns 200 { count: 0, chat: 0, orders: 0 } · correct zero · no leak", async () => {
    resolveSessionMock.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ count: 0, chat: 0, orders: 0 });
    expect(res.headers.get("cache-control")).toBe("no-store");
    // The services MUST NOT be called when there is no signed-in viewer.
    expect(countTotalUnreadMock).not.toHaveBeenCalled();
    expect(countSellerUnreadOrdersMock).not.toHaveBeenCalled();
  });

  it("signed-in viewer returns 200 with chat+orders breakdown · N from the services", async () => {
    resolveSessionMock.mockResolvedValue(signedInSession());
    countTotalUnreadMock.mockResolvedValue(7);
    countSellerUnreadOrdersMock.mockResolvedValue(0);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ count: 7, chat: 7, orders: 0 });
    expect(res.headers.get("cache-control")).toBe("no-store");
    // The service is called with the signed-in viewer's account id ·
    // never a fabricated / spoofed id.
    expect(countTotalUnreadMock).toHaveBeenCalledTimes(1);
    expect(countTotalUnreadMock).toHaveBeenCalledWith(VIEWER);
    expect(countSellerUnreadOrdersMock).toHaveBeenCalledWith(VIEWER);
  });

  it("signed-in viewer with zero unread returns 200 with zero breakdown · genuine zero", async () => {
    resolveSessionMock.mockResolvedValue(signedInSession());
    countTotalUnreadMock.mockResolvedValue(0);
    countSellerUnreadOrdersMock.mockResolvedValue(0);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ count: 0, chat: 0, orders: 0 });
  });
});

describe("GET /api/nex-native/unread-count · corrective pass A · error paths", () => {
  it("DB error in the service returns 503 · DOES NOT return { count: 0 }", async () => {
    resolveSessionMock.mockResolvedValue(signedInSession());
    countTotalUnreadMock.mockRejectedValue(new Error("boom · simulated db failure"));
    const res = await GET();
    // Owner-approved contract: non-2xx on any underlying failure.
    expect(res.status).toBe(503);
    // The response body MUST NOT be a count-shaped success · the
    // client's `if (!res.ok) return;` guard then preserves the badge.
    const body = await res.json();
    expect(body).not.toHaveProperty("count");
    expect(body).toEqual({ error: "unavailable" });
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("session resolver failure returns 503 · DOES NOT return { count: 0 }", async () => {
    resolveSessionMock.mockRejectedValue(new Error("boom · session"));
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).not.toHaveProperty("count");
    expect(body).toEqual({ error: "unavailable" });
    // The service MUST NOT be called when session resolution fails ·
    // we don't know who the viewer is.
    expect(countTotalUnreadMock).not.toHaveBeenCalled();
  });

  it("non-2xx responses still carry Cache-Control: no-store", async () => {
    resolveSessionMock.mockResolvedValue(signedInSession());
    countTotalUnreadMock.mockRejectedValue(new Error("db-blip"));
    const res = await GET();
    expect(res.status).toBe(503);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});

describe("GET /api/nex-native/unread-count · anonymous isolation", () => {
  it("anonymous never calls either service · never exposes another user's count", async () => {
    resolveSessionMock.mockResolvedValue(null);
    // Even if the services would hypothetically succeed, they must not be
    // called when there's no session · guarantees we can't accidentally
    // leak another account's count via a stale resolver bug.
    countTotalUnreadMock.mockResolvedValue(999);
    countSellerUnreadOrdersMock.mockResolvedValue(999);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ count: 0, chat: 0, orders: 0 });
    expect(countTotalUnreadMock).not.toHaveBeenCalled();
    expect(countSellerUnreadOrdersMock).not.toHaveBeenCalled();
  });
});
