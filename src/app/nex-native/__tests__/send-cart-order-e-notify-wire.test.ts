// src/app/nex-native/__tests__/send-cart-order-e-notify-wire.test.ts
//
// Owner directive 2026-11-23 · rewritten from the Round-17 Lane-E
// test. The original test enforced that `sendCartOrderAction`
// notified the seller at order CREATE time. That behaviour is now
// forbidden: a created order has not been settled yet, and firing a
// push on create would mis-advertise unpaid orders (incl. after a
// "payment sent" tap or a bank-detail share) as sales.
//
// New contract this test enforces:
//   1. `_actions.ts` MUST NOT import notifySellerNewOrder.
//   2. `_actions.ts` MUST NOT call notifySellerNewOrder anywhere
//      (sendCartOrderAction OR placeOrderAction).
//   3. The Stripe webhook route MUST import notifySellerPaidOrder.
//   4. The Stripe webhook route MUST gate markOrderPaid on
//      `payment_status === "paid"` before firing the seller push.
//   5. The PayPal webhook route MUST import notifySellerPaidOrder
//      and MUST call it inside the PAYMENT.CAPTURE.COMPLETED branch.
//   6. Both webhooks MUST write a `seller_notified_paid` marker row
//      for idempotency.
//   7. The seller order-notifications feed MUST query `state = "paid"`,
//      NOT `state = "created"`.
//
// These are source-shape regressions · live settlement is verified
// separately against the sandbox Stripe test mode + sandbox DB.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ACTIONS_SRC = readFileSync(
  resolve(__dirname, "..", "_actions.ts"),
  "utf8",
);

const STRIPE_WEBHOOK_SRC = readFileSync(
  resolve(
    __dirname,
    "..",
    "..",
    "api",
    "nex-native",
    "stripe",
    "webhook",
    "route.ts",
  ),
  "utf8",
);

const PAYPAL_WEBHOOK_SRC = readFileSync(
  resolve(
    __dirname,
    "..",
    "..",
    "api",
    "nex-native",
    "paypal",
    "webhook",
    "route.ts",
  ),
  "utf8",
);

const SELLER_ORDER_FEED_SRC = readFileSync(
  resolve(
    __dirname,
    "..",
    "..",
    "..",
    "lib",
    "nex-native",
    "notifications",
    "seller-order-notifications.ts",
  ),
  "utf8",
);

describe("Owner directive 2026-11-23 · seller push fires only after verified settlement", () => {
  it("_actions.ts does NOT import notifySellerNewOrder", () => {
    expect(ACTIONS_SRC).not.toMatch(/import\s*\{\s*notifySellerNewOrder\s*\}/);
  });

  it("_actions.ts does NOT call notifySellerNewOrder anywhere", () => {
    expect(ACTIONS_SRC).not.toMatch(/notifySellerNewOrder\s*\(/);
  });

  it("Stripe webhook imports notifySellerPaidOrder", () => {
    expect(STRIPE_WEBHOOK_SRC).toMatch(
      /import\s*\{\s*notifySellerPaidOrder\s*\}\s*from\s*"@\/lib\/nex-native\/manage-orders\/order-notification-service"/,
    );
  });

  it("Stripe webhook gates markOrderPaid on payment_status === 'paid'", () => {
    // The `payment_status !== "paid"` short-circuit MUST appear
    // BEFORE the markOrderPaid CALL SITE (not the import) so a
    // non-paid session cannot transition the order.
    const idxGuard = STRIPE_WEBHOOK_SRC.indexOf(`paymentStatus !== "paid"`);
    const idxMarkCall = STRIPE_WEBHOOK_SRC.indexOf(
      "await markOrderPaid(",
    );
    expect(idxGuard, "payment_status guard not found").toBeGreaterThan(-1);
    expect(idxMarkCall, "markOrderPaid await call not found").toBeGreaterThan(-1);
    expect(idxGuard).toBeLessThan(idxMarkCall);
  });

  it("Stripe webhook fires notifySellerPaidOrder after markOrderPaid", () => {
    const paidBlock = STRIPE_WEBHOOK_SRC.match(
      /markOrderPaid\([\s\S]{0,2000}?notifySellerPaidOrder\(result\.order\)/,
    );
    expect(
      paidBlock,
      "notifySellerPaidOrder not fired after markOrderPaid in Stripe webhook",
    ).not.toBeNull();
  });

  it("Stripe webhook writes seller_notified_paid marker for idempotency", () => {
    expect(STRIPE_WEBHOOK_SRC).toMatch(/event:\s*"seller_notified_paid"/);
  });

  it("PayPal webhook imports notifySellerPaidOrder", () => {
    expect(PAYPAL_WEBHOOK_SRC).toMatch(
      /import\s*\{\s*notifySellerPaidOrder\s*\}\s*from\s*"@\/lib\/nex-native\/manage-orders\/order-notification-service"/,
    );
  });

  it("PayPal webhook fires notifySellerPaidOrder inside PAYMENT.CAPTURE.COMPLETED branch", () => {
    const captureBlock = PAYPAL_WEBHOOK_SRC.match(
      /PAYMENT\.CAPTURE\.COMPLETED[\s\S]{0,4000}?notifySellerPaidOrder\(result\.order\)/,
    );
    expect(
      captureBlock,
      "notifySellerPaidOrder not fired inside PAYMENT.CAPTURE.COMPLETED",
    ).not.toBeNull();
  });

  it("PayPal webhook writes seller_notified_paid marker for idempotency", () => {
    expect(PAYPAL_WEBHOOK_SRC).toMatch(/event:\s*"seller_notified_paid"/);
  });

  it("seller order-notifications feed queries state='paid' (not 'created')", () => {
    expect(SELLER_ORDER_FEED_SRC).toMatch(/\.eq\("state",\s*"paid"\)/);
    expect(SELLER_ORDER_FEED_SRC).not.toMatch(/\.eq\("state",\s*"created"\)/);
  });
});
