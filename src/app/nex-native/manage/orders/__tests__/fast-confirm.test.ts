// src/app/nex-native/manage/orders/__tests__/fast-confirm.test.ts
//
// P5 · verifies the sub-60s fast-confirm note gate on
// sellerMarkOrderPaidAction.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resolveSessionMock = vi.fn();
const getOrderByIdMock = vi.fn();
const supabaseMaybeSingleMock = vi.fn();
const markOrderPaidMock = vi.fn();
const recordOrderEventMock = vi.fn();
const notifyBuyerPaymentConfirmedMock = vi.fn();

vi.mock("@/lib/nex-native/app/dev-impersonation", () => ({
  resolveSessionWithDevOverride: () => resolveSessionMock(),
}));

vi.mock("@/lib/nex-native/supabase-admin", () => ({
  nexSupabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => supabaseMaybeSingleMock(),
        }),
      }),
    }),
  },
}));

vi.mock("@/lib/nex-native/order-service", () => ({
  getOrderById: (...args: unknown[]) => getOrderByIdMock(...args),
  recordOrderEvent: (...args: unknown[]) => recordOrderEventMock(...args),
  listOrderEvents: vi.fn(),
  listOrdersByBusiness: vi.fn(),
  searchOrders: vi.fn(),
  listOrdersByCustomer: vi.fn(),
  transitionOrderState: vi.fn(),
  updateMerchantNote: vi.fn(),
  updateOrderTracking: vi.fn(),
  setPaymentMethod: vi.fn(),
  createOrder: vi.fn(),
}));

vi.mock("@/lib/nex-native/commerce-service", () => ({
  markOrderPaid: (...args: unknown[]) => markOrderPaidMock(...args),
  markOrderPending: vi.fn(),
  markOrderCompleted: vi.fn(),
  cancelOrder: vi.fn(),
  refundOrder: vi.fn(),
}));

vi.mock("@/lib/nex-native/manage-orders/order-notification-service", () => ({
  notifyBuyerPaymentConfirmed: (...args: unknown[]) => notifyBuyerPaymentConfirmedMock(...args),
  notifyBuyerOrderCancelled: vi.fn(),
  notifySellerNewOrder: vi.fn(),
}));

function fakeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "order-1",
    business_id: "biz-1",
    customer_account_id: "buyer-1",
    currency: "EUR",
    price_pence: 1999,
    state: "pending",
    source_conversation_id: null,
    idempotency_key: null,
    customer_note: null,
    merchant_note: null,
    tracking_number: null,
    carrier: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  } as unknown;
}

describe("sellerMarkOrderPaidAction · P5 fast-confirm gate", () => {
  beforeEach(() => {
    resolveSessionMock.mockReset();
    getOrderByIdMock.mockReset();
    supabaseMaybeSingleMock.mockReset();
    markOrderPaidMock.mockReset();
    recordOrderEventMock.mockReset();
    notifyBuyerPaymentConfirmedMock.mockReset();
    resolveSessionMock.mockResolvedValue({ account: { id: "seller-1" } });
  });
  afterEach(() => vi.resetModules());

  it("pending < 60s + no note · blocks with note_required_fast_confirm", async () => {
    const recentPending = fakeOrder({ updated_at: new Date(Date.now() - 10_000).toISOString() });
    getOrderByIdMock.mockResolvedValueOnce(recentPending);
    supabaseMaybeSingleMock.mockResolvedValueOnce({ data: { owner_account_id: "seller-1" } });

    const { sellerMarkOrderPaidAction } = await import("../_actions");
    const res = await sellerMarkOrderPaidAction({ orderId: "order-1" });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("note_required_fast_confirm");
    expect(markOrderPaidMock).not.toHaveBeenCalled();
  });

  it("pending < 60s + note provided · proceeds + marks fast_confirm=true in audit", async () => {
    const recentPending = fakeOrder({ updated_at: new Date(Date.now() - 10_000).toISOString() });
    getOrderByIdMock.mockResolvedValueOnce(recentPending);
    supabaseMaybeSingleMock.mockResolvedValueOnce({ data: { owner_account_id: "seller-1" } });
    markOrderPaidMock.mockResolvedValueOnce({ order: { ...(recentPending as object), state: "paid" } });

    const { sellerMarkOrderPaidAction } = await import("../_actions");
    const res = await sellerMarkOrderPaidAction({ orderId: "order-1", note: "QRIS receipt 09:42 verified" });
    expect(res.ok).toBe(true);
    expect(markOrderPaidMock).toHaveBeenCalledWith("order-1", "seller-1");
    expect(recordOrderEventMock).toHaveBeenCalledTimes(1);
    const eventArgs = recordOrderEventMock.mock.calls[0][0];
    expect(eventArgs.event).toBe("manual_payment_confirmed");
    expect(eventArgs.metadata.note).toBe("QRIS receipt 09:42 verified");
    expect(eventArgs.metadata.fast_confirm).toBe(true);
  });

  it("pending > 60s + no note · proceeds · fast_confirm=false", async () => {
    const oldPending = fakeOrder({ updated_at: new Date(Date.now() - 120_000).toISOString() });
    getOrderByIdMock.mockResolvedValueOnce(oldPending);
    supabaseMaybeSingleMock.mockResolvedValueOnce({ data: { owner_account_id: "seller-1" } });
    markOrderPaidMock.mockResolvedValueOnce({ order: { ...(oldPending as object), state: "paid" } });

    const { sellerMarkOrderPaidAction } = await import("../_actions");
    const res = await sellerMarkOrderPaidAction({ orderId: "order-1" });
    expect(res.ok).toBe(true);
    expect(recordOrderEventMock).toHaveBeenCalledTimes(1);
    const eventArgs = recordOrderEventMock.mock.calls[0][0];
    expect(eventArgs.metadata.fast_confirm).toBe(false);
  });

  it("non-pending state (created) · no fast-confirm gate · proceeds without note", async () => {
    const createdOrder = fakeOrder({ state: "created", updated_at: new Date().toISOString() });
    getOrderByIdMock.mockResolvedValueOnce(createdOrder);
    supabaseMaybeSingleMock.mockResolvedValueOnce({ data: { owner_account_id: "seller-1" } });
    markOrderPaidMock.mockResolvedValueOnce({ order: { ...(createdOrder as object), state: "paid" } });

    const { sellerMarkOrderPaidAction } = await import("../_actions");
    const res = await sellerMarkOrderPaidAction({ orderId: "order-1" });
    expect(res.ok).toBe(true);
    const eventArgs = recordOrderEventMock.mock.calls[0][0];
    expect(eventArgs.metadata.fast_confirm).toBe(false);
  });

  it("non-owner is rejected before fast-confirm check runs", async () => {
    const recentPending = fakeOrder({ updated_at: new Date(Date.now() - 1_000).toISOString() });
    getOrderByIdMock.mockResolvedValueOnce(recentPending);
    supabaseMaybeSingleMock.mockResolvedValueOnce({ data: { owner_account_id: "someone-else" } });
    const { sellerMarkOrderPaidAction } = await import("../_actions");
    const res = await sellerMarkOrderPaidAction({ orderId: "order-1" });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("not_owner");
    expect(markOrderPaidMock).not.toHaveBeenCalled();
  });
});
