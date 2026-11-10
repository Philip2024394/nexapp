// src/lib/nex-native/manage-orders/__tests__/order-notification-service.test.ts
//
// P4 · order notification service · privacy + behaviour tests.
// Verifies the sealed privacy contract (no PII in push bodies) and
// the three recipient-resolution paths.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NexOrderRow } from "@/lib/nex-native/types";

// Hoisted mocks — the service does a dynamic import of
// nexSupabaseAdmin, listPushSubscriptions and getNotifications via
// `import` statements at module top-level, so mock them before the
// module under test is imported.
const listPushSubscriptionsMock = vi.fn();
const adapterSendMock = vi.fn();
const supabaseMaybeSingleMock = vi.fn();

vi.mock("@/lib/nex-native/push-subscription-service", () => ({
  listPushSubscriptions: (...args: unknown[]) => listPushSubscriptionsMock(...args),
  prunePushSubscription: vi.fn(),
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

vi.mock("@/lib/nex/notifications/registry", () => ({
  getNotifications: () => ({
    name: "web-push",
    send: (...args: unknown[]) => adapterSendMock(...args),
  }),
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

describe("order-notification-service · P4", () => {
  beforeEach(() => {
    listPushSubscriptionsMock.mockReset();
    adapterSendMock.mockReset();
    supabaseMaybeSingleMock.mockReset();
    delete process.env.NEX_ORDER_NOTIFICATIONS_DISABLED;
  });

  afterEach(() => vi.resetModules());

  it("payment_confirmed · push body contains amount + currency ONLY · no notes", async () => {
    const { notifyBuyerPaymentConfirmed } = await import(
      "../order-notification-service"
    );
    listPushSubscriptionsMock.mockResolvedValueOnce([
      { endpoint: "https://e", p256dh: "k1", auth: "a1" },
    ]);
    adapterSendMock.mockResolvedValueOnce({ ok: true });

    const result = await notifyBuyerPaymentConfirmed(fakeOrder());
    expect(result.kind).toBe("payment_confirmed");
    expect(result.delivered).toBe(1);

    const sent = adapterSendMock.mock.calls[0][0];
    expect(sent.subject).toMatch(/^Order #[A-F0-9]{8} · payment confirmed$/);
    // Body must be currency + amount only. No notes. No buyer id. No addresses.
    expect(sent.body).toBe("€19.99");
    expect(sent.body).not.toContain("SECRET");
    expect(sent.body).not.toContain("buyer-id");
    expect(sent.subject).not.toContain("SECRET");
  });

  it("order_cancelled · body does not include reason", async () => {
    const { notifyBuyerOrderCancelled } = await import(
      "../order-notification-service"
    );
    listPushSubscriptionsMock.mockResolvedValueOnce([
      { endpoint: "https://e", p256dh: "k1", auth: "a1" },
    ]);
    adapterSendMock.mockResolvedValueOnce({ ok: true });

    const result = await notifyBuyerOrderCancelled(fakeOrder({ state: "cancelled" }));
    expect(result.delivered).toBe(1);
    const sent = adapterSendMock.mock.calls[0][0];
    expect(sent.subject).toMatch(/· cancelled$/);
    expect(sent.body).toBe("€19.99");
  });

  it("new_order · resolves seller from nex_business · fans to seller subscriptions", async () => {
    const { notifySellerNewOrder } = await import(
      "../order-notification-service"
    );
    supabaseMaybeSingleMock.mockResolvedValueOnce({
      data: { owner_account_id: "seller-id" },
    });
    listPushSubscriptionsMock.mockResolvedValueOnce([
      { endpoint: "https://e", p256dh: "k1", auth: "a1" },
    ]);
    adapterSendMock.mockResolvedValueOnce({ ok: true });

    const result = await notifySellerNewOrder(fakeOrder());
    expect(result.recipientAccountId).toBe("seller-id");
    expect(listPushSubscriptionsMock).toHaveBeenCalledWith("seller-id");
    expect(result.delivered).toBe(1);
    const sent = adapterSendMock.mock.calls[0][0];
    expect(sent.subject).toMatch(/^New order #[A-F0-9]{8}$/);
  });

  it("env disable kill-switch · NEX_ORDER_NOTIFICATIONS_DISABLED=true skips everything", async () => {
    process.env.NEX_ORDER_NOTIFICATIONS_DISABLED = "true";
    const { notifyBuyerPaymentConfirmed } = await import(
      "../order-notification-service"
    );
    const result = await notifyBuyerPaymentConfirmed(fakeOrder());
    expect(result.skipped_reason).toBe("disabled_by_env");
    expect(result.attempted).toBe(0);
    expect(adapterSendMock).not.toHaveBeenCalled();
  });

  it("no subscriptions · honest no_subscriptions skip", async () => {
    const { notifyBuyerPaymentConfirmed } = await import(
      "../order-notification-service"
    );
    listPushSubscriptionsMock.mockResolvedValueOnce([]);
    const result = await notifyBuyerPaymentConfirmed(fakeOrder());
    expect(result.skipped_reason).toBe("no_subscriptions");
    expect(result.attempted).toBe(0);
    expect(adapterSendMock).not.toHaveBeenCalled();
  });

  it("push data payload · includes deep-link url + orderId · NOT buyer notes", async () => {
    const { notifyBuyerPaymentConfirmed } = await import(
      "../order-notification-service"
    );
    listPushSubscriptionsMock.mockResolvedValueOnce([
      { endpoint: "https://e", p256dh: "k1", auth: "a1" },
    ]);
    adapterSendMock.mockResolvedValueOnce({ ok: true });

    await notifyBuyerPaymentConfirmed(fakeOrder());
    const sent = adapterSendMock.mock.calls[0][0];
    expect(sent.data.orderId).toBe("abcdef12-3456-7890-abcd-ef0123456789");
    expect(sent.data.url).toBe(
      "/nex-native/manage/orders/abcdef12-3456-7890-abcd-ef0123456789",
    );
    expect(sent.data.eventKind).toBe("payment_confirmed");
    const serialised = JSON.stringify(sent);
    expect(serialised).not.toContain("SECRET");
  });
});
