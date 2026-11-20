// src/app/nex-native/__tests__/send-cart-order-e-notify-wire.test.ts
//
// Lane E · E-NOTIFY source-shape regression · round 17 · 2026-11-19.
//
// Covers the owner-directed Round 17 part-1 wire-up: after a successful
// `orderService.createOrder` return inside `sendCartOrderAction`, the
// action MUST call `notifySellerNewOrder(createdOrder)` with three
// retry/dedup safeguards:
//
//   1. Only after a CONFIRMED order-row insert (inside the try-branch
//      that captured a non-null `createdOrder`).
//   2. Dedup-guarded by a prior-events check (`listOrderEvents` ·
//      `.some(ev => ev.event === "seller_notified")`) so a retry that
//      hits the idempotency_key dedup path does NOT double-notify.
//   3. Fail-soft: the notify call is itself wrapped in try/catch so a
//      push-dispatch failure never reverses the cart or order rows.
//   4. On a fresh notify success, a `seller_notified` event marker row
//      is written via `recordOrderEvent` so the next retry of this
//      send_intent_id short-circuits.
//
// Why source-shape and not functional:
//   The sister idempotency test (send-cart-order-idempotency.test.ts)
//   already demonstrates how expensive it is to mock every boundary.
//   This file is the honest low-ceiling check that the WIRING is
//   present in the exact shape Round 17 part-1 names. Live behaviour
//   still requires BROWSER + PERSISTENCE tier verification against the
//   sandbox, which is separately gated.
//
// Negative assertions:
//   · The call MUST NOT be outside the try-branch that captured the
//     successful order row (otherwise we would emit on a failed order).
//   · The call MUST be import-reachable from the same file (not from
//     a transitive indirection that could be silently stubbed).

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ACTIONS_SRC = readFileSync(
  resolve(__dirname, "..", "_actions.ts"),
  "utf8",
);

describe("Lane E · E-NOTIFY · sendCartOrderAction wire-up (§16.35)", () => {
  it("imports notifySellerNewOrder from the supported service module", () => {
    expect(ACTIONS_SRC).toMatch(
      /import \{ notifySellerNewOrder \} from "@\/lib\/nex-native\/manage-orders\/order-notification-service"/,
    );
  });

  it("captures the createOrder return value as createdOrder (needed for recipient resolution)", () => {
    const block = ACTIONS_SRC.match(
      /sendCartOrderAction[\s\S]*?const createdOrder = await orderService\.createOrder/,
    );
    expect(block, "createdOrder capture not found inside sendCartOrderAction").not.toBeNull();
  });

  it("checks nex_order_event for prior seller_notified marker before firing", () => {
    const check = ACTIONS_SRC.match(
      /const priorEvents = await orderService\.listOrderEvents\(createdOrder\.id\)[\s\S]{0,400}?priorEvents\.some\(\s*\(ev\) => ev\.event === "seller_notified"/,
    );
    expect(check, "dedup check against seller_notified marker not found").not.toBeNull();
  });

  it("calls notifySellerNewOrder only when the marker is absent", () => {
    const call = ACTIONS_SRC.match(
      /if \(!alreadyNotified\) \{[\s\S]{0,400}?await notifySellerNewOrder\(createdOrder\)/,
    );
    expect(call, "notifySellerNewOrder is not gated by alreadyNotified check").not.toBeNull();
  });

  it("records seller_notified event marker after a fresh notify", () => {
    const marker = ACTIONS_SRC.match(
      /await notifySellerNewOrder\(createdOrder\);[\s\S]{0,800}?orderService\.recordOrderEvent\(\{[\s\S]{0,300}?event: "seller_notified"/,
    );
    expect(marker, "recordOrderEvent seller_notified marker write not found after notify").not.toBeNull();
  });

  it("wraps the notify branch in try/catch (fail-soft)", () => {
    const failSoft = ACTIONS_SRC.match(
      /try \{\s*const priorEvents = await orderService\.listOrderEvents[\s\S]{0,2000}?\} catch \(notifyErr\)/,
    );
    expect(failSoft, "notify branch is not try-wrapped").not.toBeNull();
  });

  it("notify call lives INSIDE the createdOrder try-branch (never after a failed order)", () => {
    // The createdOrder capture, the listOrderEvents call, and the
    // notifySellerNewOrder invocation MUST all live between the same
    // `try {` and `} catch (e)` that fail-softs the createOrder itself.
    const outerBlock = ACTIONS_SRC.match(
      /const createdOrder = await orderService\.createOrder[\s\S]+?\} catch \(e\) \{\s*console\.warn\(\s*"\[cart-order #14\] deterministic nex_order insert failed/,
    );
    expect(outerBlock, "notify branch escaped the createOrder try-catch").not.toBeNull();
    const block = outerBlock![0];
    expect(block).toMatch(/notifySellerNewOrder\(createdOrder\)/);
    expect(block).toMatch(/orderService\.listOrderEvents/);
    expect(block).toMatch(/event: "seller_notified"/);
  });

  it("marker-write failure logs but does NOT reverse the notify (defensive nested try/catch)", () => {
    const nested = ACTIONS_SRC.match(
      /await notifySellerNewOrder\(createdOrder\);\s*try \{[\s\S]{0,600}?event: "seller_notified"[\s\S]{0,400}?\} catch \(markErr\)/,
    );
    expect(nested, "marker-write nested try/catch not found").not.toBeNull();
  });
});
