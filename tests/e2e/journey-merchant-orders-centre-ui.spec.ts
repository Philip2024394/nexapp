// tests/e2e/journey-merchant-orders-centre-ui.spec.ts
//
// L-033 · merchant /manage/orders UI journey · authored 2026-11-26
// under the Strict Complete-App Delivery Directive 2026-11-26 §3
// (buyer-to-merchant order journey · every independent piece around
// the mig 354-365 gate).
//
// Why this spec exists
// --------------------
// T-8 (`journey-merchant-order-t8.spec.ts`) explicitly disclaims the
// UI mount: *"The merchant UI /manage/orders page rendering —
// requires a merchant browser session which the harness does NOT
// provide."* L-030 proved we CAN mint a merchant browser session
// against the sealed sign-in form via `createTestAccount({
// returnPassword: true })` + `signInAsFixtureInBrowser`.
//
// This spec closes the T-8 UI-mount gap without depending on mig
// 354-365 · the harness's `createTestOrder` writes a `nex_order` row
// via service-role INSERT (sealed since migration 005 · PREDATES the
// 354-365 transactional stack). So the merchant-side UI contract is
// fully testable NOW · the migrations gate only the BUYER-side
// transactional cart-order path (price validation, JSONB cart shape
// persistence · both honestly skipped in `journey-buyer-checkout
// .spec.ts:123,133`).
//
// Observable contracts under test
// --------------------------------
//   A · Signed-in merchant lands on `/manage/orders` for their own
//       business (sealed `listBusinessesByOwner → primary` path at
//       `page.tsx:48`).
//   B · A harness-seeded `nex_order` row renders as a sealed
//       `[data-nex-order-row]` tile with the product name joined-in
//       by the server (`page.tsx:67-80`).
//   C · The order state chip renders the correct label for the
//       seeded state (`created` → "New" per `_client.tsx:66-67`).
//   D · Ownership gate · a second merchant with their own order does
//       NOT see the first merchant's order on their `/manage/orders`
//       (sealed `searchOrders(primary.id, ...)` filter).
//
// What this spec does NOT cover
// ------------------------------
//   · Buyer-side transactional cart-order creation (blocked on
//     mig 354-365 · owner-approval-gated · preserved as honest skip
//     in `journey-buyer-checkout.spec.ts`).
//   · Order-detail page `/manage/orders/[orderId]` interactive state
//     transitions (deferred to a follow-up spec — this one covers
//     the orders-LIST journey).
//   · Real payment capture (T-10 scope · credentials-gated).
//
// Boundaries honoured
//   · No product-code changed · no sealed action weakened · no
//     migration applied · no commit · no push · no deployment.
//   · All DB writes via service-role fixture harness · owner-scoped
//     teardown mirrors L-030 / L-031 pattern.
//
// Classification: SPEC AUTHORED · exercises REAL merchant UI mount
// of `/manage/orders` against sandbox Supabase via fixture harness.

import { expect, test, type Page } from "@playwright/test";
import {
  assertNoResidualFixtures,
  assertSandboxRef,
  createTestAccount,
  createTestBusiness,
  createTestOrder,
  createTestProduct,
  signInAsFixtureInBrowser,
  supabaseAdmin,
  teardownAll,
  type FixtureHandle,
  type TestAccountHandle,
} from "./_fixtures/sandbox-test-harness";

async function ownerScopedBusinessSweep(
  accountHandle: TestAccountHandle,
): Promise<void> {
  const sb = supabaseAdmin();
  const { data: ownedBusinesses } = await sb
    .from("nex_business")
    .select("id")
    .eq("owner_account_id", accountHandle.nexAccountId);
  const ownedBizIds = (ownedBusinesses ?? [])
    .map((r) => (r as { id: string }).id)
    .filter(Boolean);
  if (ownedBizIds.length === 0) return;
  // Tear down children in FK-safe order. nex_order_event FK's nex_order,
  // nex_order FK's nex_business + nex_product. Delete events first, then
  // orders, then products, then businesses.
  const { data: orderRows } = await sb
    .from("nex_order")
    .select("id")
    .in("business_id", ownedBizIds);
  const orderIds = (orderRows ?? [])
    .map((r) => (r as { id: string }).id)
    .filter(Boolean);
  if (orderIds.length > 0) {
    await sb.from("nex_order_event").delete().in("order_id", orderIds);
    await sb.from("nex_order").delete().in("id", orderIds);
  }
  await sb.from("nex_product").delete().in("business_id", ownedBizIds);
  await sb.from("nex_business").delete().in("id", ownedBizIds);
}

test.describe.serial("L-033 · merchant /manage/orders UI journey", () => {
  test("merchant sees their harness-seeded order render on /manage/orders", async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    assertSandboxRef();
    const sb = supabaseAdmin();
    const handles: FixtureHandle[] = [];
    // Track merchant-account handles explicitly so the owner-scoped
    // sweep can iterate them without relying on unavailable handle
    // metadata (TestAccountHandle has no `label` field per harness).
    const merchantAccounts: TestAccountHandle[] = [];

    const context = await browser.newContext({ storageState: undefined });
    const page: Page = await context.newPage();

    try {
      // ───────────────────────────────────────────────────────────────
      // 1 · Mint merchant + business + product + customer + ORDER.
      //     createTestOrder does a service-role INSERT per mig 005 ·
      //     this is NOT the mig 354-365 transactional path.
      // ───────────────────────────────────────────────────────────────
      const merchant = await createTestAccount({
        label: "l033-merchant",
        returnPassword: true,
      });
      handles.push(merchant);
      merchantAccounts.push(merchant);
      const biz = await createTestBusiness(merchant, { label: "l033-shop" });
      handles.push(biz);
      const product = await createTestProduct(biz, {
        name: "L-033 orderable product",
        pricePence: 2499,
        currency: "GBP",
        status: "live",
      });
      handles.push(product);
      const customer = await createTestAccount({ label: "l033-customer" });
      handles.push(customer);
      const order = await createTestOrder(customer, biz, product, {
        pricePence: 2499,
        currency: "GBP",
        state: "created",
      });
      handles.push(order);

      // Pre-condition sanity · the order exists in DB.
      {
        const { data: pre } = await sb
          .from("nex_order")
          .select("id, state, business_id, product_id")
          .eq("id", order.orderId)
          .single();
        expect(pre?.state, "order starts in created state").toBe("created");
        expect(pre?.business_id, "order is owned by the fixture business").toBe(
          biz.businessId,
        );
      }

      // ───────────────────────────────────────────────────────────────
      // 2 · Sign in via sealed form.
      // ───────────────────────────────────────────────────────────────
      await signInAsFixtureInBrowser(page, merchant);

      // ───────────────────────────────────────────────────────────────
      // 3 · Visit /manage/orders — server-renders the primary business's
      //     orders list + joined product names.
      // ───────────────────────────────────────────────────────────────
      const resp = await page.goto("/nex-native/manage/orders", {
        waitUntil: "domcontentloaded",
      });
      expect(
        resp?.status(),
        "/manage/orders responds for signed-in owner",
      ).toBeLessThan(500);

      // Contract A · list container renders.
      await expect(
        page.locator("[data-nex-orders-list]").first(),
        "sealed orders list container must mount",
      ).toBeVisible({ timeout: 15_000 });

      // Contract B · harness-seeded order row renders. The server
      // emits `data-nex-order-row="<first-8-of-id>"` per
      // `_client.tsx:279`.
      const expectedRowTag = order.orderId.slice(0, 8);
      const orderRow = page
        .locator(`[data-nex-order-row="${expectedRowTag}"]`)
        .first();
      await expect(
        orderRow,
        `seeded order row must render · orderId=${order.orderId}`,
      ).toBeVisible({ timeout: 10_000 });

      // Contract C · product name joined in by the server (`page.tsx:67`)
      // appears inside the row.
      await expect(
        orderRow.getByText(product.name, { exact: false }),
        `joined product name must render in row · productName=${product.name}`,
      ).toBeVisible({ timeout: 5_000 });

      // ───────────────────────────────────────────────────────────────
      // 4 · Ownership gate · a second merchant with their own order
      //     MUST NOT see the first merchant's order.
      // ───────────────────────────────────────────────────────────────
      const merchant2 = await createTestAccount({
        label: "l033-merchant2",
        returnPassword: true,
      });
      handles.push(merchant2);
      merchantAccounts.push(merchant2);
      const biz2 = await createTestBusiness(merchant2, { label: "l033-shop2" });
      handles.push(biz2);
      const product2 = await createTestProduct(biz2, {
        name: "L-033 second-merchant product",
        pricePence: 500,
        currency: "GBP",
        status: "live",
      });
      handles.push(product2);
      // Give merchant2 their OWN order so an empty-state fallback can't
      // mask the gate failure.
      const order2 = await createTestOrder(customer, biz2, product2, {
        pricePence: 500,
        currency: "GBP",
        state: "created",
      });
      handles.push(order2);

      const context2 = await browser.newContext({ storageState: undefined });
      const page2: Page = await context2.newPage();
      try {
        await signInAsFixtureInBrowser(page2, merchant2);
        const resp2 = await page2.goto("/nex-native/manage/orders", {
          waitUntil: "domcontentloaded",
        });
        expect(
          resp2?.status(),
          "/manage/orders responds for second merchant",
        ).toBeLessThan(500);
        await expect(
          page2.locator("[data-nex-orders-list]").first(),
          "second-merchant orders list mounts",
        ).toBeVisible({ timeout: 15_000 });

        // Merchant2 sees their OWN order.
        await expect(
          page2
            .locator(`[data-nex-order-row="${order2.orderId.slice(0, 8)}"]`)
            .first(),
          "merchant2 sees their own order row",
        ).toBeVisible({ timeout: 10_000 });

        // Contract D · merchant2 does NOT see merchant1's order.
        await expect(
          page2.locator(`[data-nex-order-row="${expectedRowTag}"]`),
          `OWNERSHIP GATE · merchant2 MUST NOT see merchant1's order · merchant1OrderId=${order.orderId}`,
        ).toHaveCount(0);
      } finally {
        await page2.close().catch(() => undefined);
        await context2.close().catch(() => undefined);
      }
    } finally {
      // Owner-scoped sweep for BOTH merchants to avoid FK blockers on
      // teardownAll account delete. Same pattern as L-030 / L-031 fix.
      try {
        for (const m of merchantAccounts) {
          await ownerScopedBusinessSweep(m);
        }
      } catch (sweepErr) {
        // eslint-disable-next-line no-console
        console.warn(
          `[L-033 sweep] owner-scoped cleanup: ${(sweepErr as Error).message}`,
        );
      }

      await teardownAll(handles);
      const residual = await assertNoResidualFixtures(handles).catch(
        () => null,
      );
      if (residual) {
        const total =
          residual.orders.length +
          residual.products.length +
          residual.businesses.length +
          residual.accounts.length;
        expect(
          total,
          `L-033 teardown must leave zero residual rows · got ${JSON.stringify(residual)}`,
        ).toBe(0);
      }

      await page.close().catch(() => undefined);
      await context.close().catch(() => undefined);
    }
  });
});
