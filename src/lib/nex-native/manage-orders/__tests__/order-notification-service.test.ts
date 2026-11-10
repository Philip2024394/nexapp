// src/lib/nex-native/manage-orders/__tests__/order-notification-service.test.ts
//
// P4 · order notification service · privacy + behaviour + preference
// enforcement tests · owner-sealed 2026-11-10 after migration 318.
//
// The service now routes every event through the sealed
// dispatchPushNotification · tests verify the call-site contract
// (category "order" · kind "system" · owner-sealed visible copy ·
// data payload with only orderId + url + eventKind).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NexOrderRow } from "@/lib/nex-native/types";

const dispatchPushNotificationMock = vi.fn();
const supabaseMaybeSingleMock = vi.fn();

vi.mock("@/lib/nex-native/notification-dispatch-service", () => ({
  dispatchPushNotification: (...args: unknown[]) => dispatchPushNotificationMock(...args),
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

function fakeOrder(overrides: Partial<NexOrderRow> = {}): NexOrderRow {
  return {
    id: "abcdef12-3456-7890-abcd-ef0123456789" as NexOrderRow["id"],
    business_id: "biz-id" as NexOrderRow["business_id"],
    customer_account_id: "buyer-id" as NexOrderRow["customer_account_id"],
    currency: "EUR",
    price_pence: 1999,
    state: "paid",
    source_conversation_id: null,
    idempotency_key: "k1",
    customer_note: "SECRET NOTE SHOULD NOT APPEAR IN PUSH",
    merchant_note: "SECRET MERCHANT NOTE",
    tracking_number: null,
    carrier: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  } as NexOrderRow;
}

describe("order-notification-service · P4 · post-mig-318", () => {
  beforeEach(() => {
    dispatchPushNotificationMock.mockReset();
    supabaseMaybeSingleMock.mockReset();
    delete process.env.NEX_ORDER_NOTIFICATIONS_DISABLED;
  });
  afterEach(() => vi.resetModules());

  it("payment_confirmed · dispatches with category 'order' + system kind + generic copy", async () => {
    const { notifyBuyerPaymentConfirmed } = await import(
      "../order-notification-service"
    );
    dispatchPushNotificationMock.mockResolvedValueOnce({
      attempted: 1,
      delivered: 1,
      failed: 0,
      pruned: 0,
    });

    const result = await notifyBuyerPaymentConfirmed(fakeOrder());
    expect(result.kind).toBe("payment_confirmed");
    expect(result.recipientAccountId).toBe("buyer-id");
    expect(result.delivered).toBe(1);

    const [recipientId, category, payload] = dispatchPushNotificationMock.mock.calls[0];
    expect(recipientId).toBe("buyer-id");
    expect(category).toBe("order");
    expect(payload.kind).toBe("system");
    expect(payload.title).toBe("NEX");
    expect(payload.body).toBe("Your order payment has been confirmed.");
    // Privacy hardcheck · no amount, currency, id, or notes in visible copy.
    expect(payload.title).not.toMatch(/19\.99|€|EUR|ABCDEF12|SECRET/i);
    expect(payload.body).not.toMatch(/19\.99|€|EUR|ABCDEF12|SECRET/i);
    // Data payload hardcheck · only orderId + url + eventKind.
    expect(Object.keys(payload.data).sort()).toEqual(["eventKind", "orderId", "url"]);
    expect(payload.data.orderId).toBe("abcdef12-3456-7890-abcd-ef0123456789");
    expect(payload.data.url).toBe("/nex-native/manage/orders/abcdef12-3456-7890-abcd-ef0123456789");
    expect(payload.data.eventKind).toBe("payment_confirmed");
  });

  it("order_cancelled · visible body is sealed generic sentence · no reason / amount / id", async () => {
    const { notifyBuyerOrderCancelled } = await import(
      "../order-notification-service"
    );
    dispatchPushNotificationMock.mockResolvedValueOnce({
      attempted: 1,
      delivered: 1,
      failed: 0,
      pruned: 0,
    });
    const result = await notifyBuyerOrderCancelled(fakeOrder({ state: "cancelled" }));
    expect(result.delivered).toBe(1);
    const [, category, payload] = dispatchPushNotificationMock.mock.calls[0];
    expect(category).toBe("order");
    expect(payload.title).toBe("NEX");
    expect(payload.body).toBe("Your order has been cancelled.");
    expect(payload.body).not.toMatch(/19\.99|€|EUR|ABCDEF12|SECRET/i);
  });

  it("new_order · resolves seller via nex_business · dispatches to seller · generic copy", async () => {
    const { notifySellerNewOrder } = await import(
      "../order-notification-service"
    );
    supabaseMaybeSingleMock.mockResolvedValueOnce({
      data: { owner_account_id: "seller-id" },
    });
    dispatchPushNotificationMock.mockResolvedValueOnce({
      attempted: 2,
      delivered: 2,
      failed: 0,
      pruned: 0,
    });
    const result = await notifySellerNewOrder(fakeOrder());
    expect(result.recipientAccountId).toBe("seller-id");
    expect(result.delivered).toBe(2);
    const [recipientId, category, payload] = dispatchPushNotificationMock.mock.calls[0];
    expect(recipientId).toBe("seller-id");
    expect(category).toBe("order");
    expect(payload.title).toBe("NEX");
    expect(payload.body).toBe("You have received a new order.");
  });

  it("env kill-switch · NEX_ORDER_NOTIFICATIONS_DISABLED=true skips dispatcher entirely", async () => {
    process.env.NEX_ORDER_NOTIFICATIONS_DISABLED = "true";
    const { notifyBuyerPaymentConfirmed } = await import(
      "../order-notification-service"
    );
    const result = await notifyBuyerPaymentConfirmed(fakeOrder());
    expect(result.skipped_reason).toBe("disabled_by_env");
    expect(dispatchPushNotificationMock).not.toHaveBeenCalled();
  });

  it("new_order · missing business row · no recipient · zero fanout · cannot notify another seller", async () => {
    const { notifySellerNewOrder } = await import(
      "../order-notification-service"
    );
    supabaseMaybeSingleMock.mockResolvedValueOnce({ data: null });
    const result = await notifySellerNewOrder(fakeOrder());
    expect(result.recipientAccountId).toBe(null);
    expect(result.attempted).toBe(0);
    expect(result.skipped_reason).toBe("no_recipient_resolved");
    expect(dispatchPushNotificationMock).not.toHaveBeenCalled();
  });

  it("preference opt-out propagates · dispatcher 'disabled' skip surfaces as skipped_reason", async () => {
    // This is the critical preference-enforcement test. The sealed
    // dispatchPushNotification returns { skipped_reason: "disabled" }
    // when the user has set order_enabled = false. Our service must
    // propagate that honestly without attempting any send.
    const { notifyBuyerPaymentConfirmed } = await import(
      "../order-notification-service"
    );
    dispatchPushNotificationMock.mockResolvedValueOnce({
      attempted: 0,
      delivered: 0,
      failed: 0,
      pruned: 0,
      skipped_reason: "disabled",
    });
    const result = await notifyBuyerPaymentConfirmed(fakeOrder());
    expect(result.skipped_reason).toBe("disabled");
    expect(result.attempted).toBe(0);
    expect(result.delivered).toBe(0);
  });

  it("preference read outage · fail-closed · skipped_reason=prefs_unavailable propagates", async () => {
    const { notifyBuyerPaymentConfirmed } = await import(
      "../order-notification-service"
    );
    dispatchPushNotificationMock.mockResolvedValueOnce({
      attempted: 0,
      delivered: 0,
      failed: 0,
      pruned: 0,
      skipped_reason: "prefs_unavailable",
    });
    const result = await notifyBuyerPaymentConfirmed(fakeOrder());
    expect(result.skipped_reason).toBe("prefs_unavailable");
    expect(result.delivered).toBe(0);
  });

  it("recipient has no push subscriptions · honest no_subscriptions skip", async () => {
    const { notifyBuyerPaymentConfirmed } = await import(
      "../order-notification-service"
    );
    dispatchPushNotificationMock.mockResolvedValueOnce({
      attempted: 0,
      delivered: 0,
      failed: 0,
      pruned: 0,
      skipped_reason: "no_subscriptions",
    });
    const result = await notifyBuyerPaymentConfirmed(fakeOrder());
    expect(result.skipped_reason).toBe("no_subscriptions");
    expect(result.attempted).toBe(0);
  });
});
