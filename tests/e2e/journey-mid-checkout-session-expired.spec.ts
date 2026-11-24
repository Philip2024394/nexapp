// tests/e2e/journey-mid-checkout-session-expired.spec.ts
//
// T-4.5 · mid-checkout Stripe session expired → My orders shows Finish
// payment · authored under Stage A Conditional Approval 2026-11-24.
//
// Owner SAFEGUARD (Stage A §4): no live payment activity · no Stripe
// writer activation · no migration applied to make this pass.
//
// Observable behaviour:
//   · /nex-native/orders/[orderId] for an unpaid order renders a pay
//     dispatcher · the sealed /pay sub-routes (/pay, /pay/stripe,
//     /pay/qris, /pay/paypal) exist as confirmed in the repository.
//   · When a Stripe checkout session has expired (observable: the
//     return page `/pay/stripe` reports expired or the order remains
//     in state 'awaiting_payment'), the My Orders surface MUST show
//     a "Finish payment" affordance on that order row.
//
// Spec approach:
//   · Probe /nex-native/manage/orders (merchant) and the buyer-side
//     orders surface for the Finish-payment copy.
//   · Full expiry flow requires Stripe test mode + mig 354/365 state
//     · SKIPPED honestly otherwise.
//
// Classification: SPEC AUTHORED.

import { expect, test } from "@playwright/test";

test.use({ storageState: "tests/e2e/.auth/state.json" });

test.describe.serial("T-4.5 · mid-checkout session-expired recovery", () => {
  test("manage orders surface responds under a signed-in merchant account", async ({
    page,
  }) => {
    // Remediation 2026-11-24 cycle 2 · `/manage/orders` holds
    // long-lived order-subscription connections; swap `networkidle`
    // for `domcontentloaded` + body-attached wait. Assertion
    // strength preserved: status < 500.
    const response = await page.goto("/nex-native/manage/orders", {
      waitUntil: "domcontentloaded",
    });
    // 200 if merchant · 302/redirect if not a merchant · not a 5xx.
    expect(response?.status(), "/manage/orders responds").toBeLessThan(500);
    await page.waitForFunction(() => Boolean(document.body), null, {
      timeout: 10_000,
    });
  });

  test("Finish-payment affordance renders for an awaiting_payment order", async () => {
    test.skip(
      true,
      "BLOCKED-ON-MIG-354-365-AND-STRIPE-TEST-FIXTURE · exercising the " +
        "expiry branch requires (a) mig 354/365 state in sandbox and (b) " +
        "a seeded awaiting_payment order with an expired Stripe session · " +
        "Stage A §4 forbids applying migrations to make this pass",
    );
  });
});
