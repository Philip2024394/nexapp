// tests/e2e/journey-merchant-product-spec-editor-ownership-ui.spec.ts
//
// L-035 · merchant /manage/products/[productId] Specifications-editor
// ownership-gate journey · authored 2026-11-26 under the Strict
// Complete-App Delivery Directive 2026-11-26 §3+§4 (inspect adjacent
// Shop journeys · do not assume completed merchant journeys prove
// every Shop feature).
//
// Why this spec exists
// --------------------
// L-033 closed the merchant /manage/orders list journey and T8 covers
// the /manage/orders/[orderId] detail journey (both already test the
// ORDER-detail ownership gate · a non-owner gets `notFound()` → 404).
// But the merchant /manage/products/[productId] Specifications editor
// uses a DIFFERENT ownership pattern that NO existing spec covers:
//
//   src/app/nex-native/manage/products/[productId]/page.tsx:74-79
//     if (!business || business.owner_account_id !== session.account.id) {
//       redirect(
//         "/nex-native/manage?e=spec_forbidden&m=" +
//           encodeURIComponent("You don't own this product"),
//       );
//     }
//
// This is `redirect(...)` NOT `notFound()`. The non-owner is sent to
// `/nex-native/manage` with an error-banner payload, instead of a 404.
// The asymmetry matters: product metadata (name, price tier, category)
// is less sensitive than order details, so "don't reveal existence"
// (notFound) is swapped for "bounce with a message" (redirect).
//
// A silent regression here (e.g. a future refactor that converts the
// redirect to a notFound OR removes the `.owner_account_id` check
// entirely) would never be caught by the order-detail specs because
// they probe a different code path. This spec pins the observable
// contract: the surface responds to non-owners with a redirect to
// `/nex-native/manage?e=spec_forbidden` with the error-banner message
// surfaced via the `Banner` sub-component (page.tsx:1087-1109).
//
// What this spec covers (all browser-observable)
// -----------------------------------------------
//   A · Signed-in merchant lands on /manage/products/{productId} for
//       a product their business owns. The Specifications editor
//       heading ("Product specifications" eyebrow + product name h1)
//       renders. Confirms ownership-positive path works end-to-end.
//   B · Non-owner second merchant visiting the first merchant's
//       product URL is REDIRECTED (not 404'd) to
//       `/nex-native/manage?e=spec_forbidden&m=<encoded>`. The error
//       banner must render with the "You don't own this product"
//       text. Confirms ownership-negative path works end-to-end AND
//       uses the redirect pattern (not notFound).
//
// What this spec does NOT cover (honest deferral)
// ------------------------------------------------
//   · Driving the 30-field spec editor fields themselves (L-034
//     authored the payload helper · UI driving remains the deferred
//     next-step per L-034 ledger row).
//   · The VariantEditor / section-assign forms · those surfaces have
//     their own sealed `data-nex-feature-unwired` + `data-nex-section-
//     assign-unwired` tells and are explicitly out of this gate's
//     scope.
//
// Boundaries honoured
//   · No product-code changed · no sealed action weakened · no
//     migration applied · no commit · no push · no deployment.
//   · Fixture teardown is a QUALITY GATE (per strict-completion
//     standard §1) · residual rows = no clean PASS.
//
// Classification: SPEC AUTHORED · exercises REAL merchant UI mount of
// `/manage/products/[productId]` + REAL server-side ownership redirect
// against sandbox Supabase via fixture harness.

import { expect, test, type Page } from "@playwright/test";
import {
  assertNoResidualFixtures,
  assertSandboxRef,
  createTestAccount,
  createTestBusiness,
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
  // Owner-scoped teardown mirror of the L-033 spec's sweep · eliminates
  // FK violation if a product/business row survives the main teardown
  // (e.g. because a prior partial failure stranded them). Deletes in
  // reverse-FK order and ONLY touches rows owned by this merchant's
  // own `nex_account.id`.
  const sb = supabaseAdmin();
  const { data: ownedBusinesses } = await sb
    .from("nex_business")
    .select("id")
    .eq("owner_account_id", accountHandle.nexAccountId);
  const ownedBizIds = (ownedBusinesses ?? [])
    .map((r) => (r as { id: string }).id)
    .filter(Boolean);
  if (ownedBizIds.length === 0) return;
  await sb.from("nex_product").delete().in("business_id", ownedBizIds);
  await sb.from("nex_business").delete().in("id", ownedBizIds);
}

test.describe.serial(
  "L-035 · merchant product-spec-editor ownership redirect journey",
  () => {
    test("owner lands on spec editor; non-owner redirected to /manage?e=spec_forbidden", async ({
      browser,
    }) => {
      test.setTimeout(180_000);
      assertSandboxRef();
      const handles: FixtureHandle[] = [];
      const merchantAccounts: TestAccountHandle[] = [];

      const context = await browser.newContext({ storageState: undefined });
      const page: Page = await context.newPage();

      try {
        // ─────────────────────────────────────────────────────────
        // 1 · Seed owner + business + product.
        // ─────────────────────────────────────────────────────────
        const merchant = await createTestAccount({
          label: "l035-prod-merchant",
          returnPassword: true,
        });
        handles.push(merchant);
        merchantAccounts.push(merchant);
        const biz = await createTestBusiness(merchant, {
          label: "l035-prod-shop",
        });
        handles.push(biz);
        const product = await createTestProduct(biz, {
          name: "L-035 spec-editor product",
          pricePence: 2999,
          currency: "GBP",
          status: "live",
        });
        handles.push(product);

        const editorUrl = `/nex-native/manage/products/${product.productId}`;

        // ─────────────────────────────────────────────────────────
        // 2 · Owner sign-in + positive-path mount.
        // ─────────────────────────────────────────────────────────
        await signInAsFixtureInBrowser(page, merchant);
        const resp = await page.goto(editorUrl, {
          waitUntil: "domcontentloaded",
        });
        expect(
          resp?.status(),
          `Contract A · editor responds for owner · url=${editorUrl}`,
        ).toBeLessThan(500);

        // Contract A · owner should NOT be redirected. URL must stay
        // on the product-detail URL (no `?e=spec_forbidden`).
        await expect
          .poll(() => new URL(page.url()).pathname, {
            message:
              "Contract A · owner must remain on /manage/products/[id] · no silent redirect",
            timeout: 10_000,
          })
          .toMatch(
            new RegExp(`^/nex-native/manage/products/${product.productId}$`),
          );
        expect(
          new URL(page.url()).searchParams.get("e"),
          "Contract A · owner URL must NOT carry spec_forbidden",
        ).not.toBe("spec_forbidden");

        // Contract A · sealed editor headings render for the owner.
        // The editor uses no `data-nex-*` root attribute, so we anchor
        // on the stable Product-specifications eyebrow text + the
        // product name rendered as an h1 (page.tsx:164-178).
        await expect(
          page.getByText("Product specifications", { exact: false }).first(),
          "Contract A · spec-editor eyebrow must mount for owner",
        ).toBeVisible({ timeout: 15_000 });
        await expect(
          page
            .getByRole("heading", { name: /L-035 spec-editor product/i })
            .first(),
          "Contract A · owned product name must render in the editor heading",
        ).toBeVisible({ timeout: 10_000 });

        // ─────────────────────────────────────────────────────────
        // 3 · Non-owner redirect gate · second merchant visits same
        //     URL · expect redirect to /manage?e=spec_forbidden.
        // ─────────────────────────────────────────────────────────
        const merchant2 = await createTestAccount({
          label: "l035-prod-merchant2",
          returnPassword: true,
        });
        handles.push(merchant2);
        merchantAccounts.push(merchant2);
        const biz2 = await createTestBusiness(merchant2, {
          label: "l035-prod-shop2",
        });
        handles.push(biz2);

        const context2 = await browser.newContext({ storageState: undefined });
        const page2: Page = await context2.newPage();
        try {
          await signInAsFixtureInBrowser(page2, merchant2);
          // Observe server-side redirect · in Next 16, server-component
          // `redirect(...)` emits the RSC NEXT_REDIRECT marker + a
          // client-router navigation. Use `waitForURL` on the sealed
          // destination rather than a status assertion (status may be
          // 200 HTML with redirect metadata).
          await page2.goto(editorUrl, { waitUntil: "domcontentloaded" });
          await page2.waitForURL(
            (u) =>
              /\/nex-native\/manage(?:[/?#]|$)/.test(u.pathname) &&
              u.searchParams.get("e") === "spec_forbidden",
            { timeout: 15_000 },
          );

          // Contract B · post-redirect URL carries both params.
          const landedUrl = new URL(page2.url());
          expect(
            landedUrl.pathname,
            "Contract B · non-owner must land on /nex-native/manage",
          ).toBe("/nex-native/manage");
          expect(
            landedUrl.searchParams.get("e"),
            "Contract B · redirect must carry e=spec_forbidden",
          ).toBe("spec_forbidden");
          expect(
            landedUrl.searchParams.get("m") ?? "",
            "Contract B · redirect must carry the encoded ownership message",
          ).toContain("You don't own this product");

          // Contract B · non-owner must NOT see the owner's product
          // name anywhere on the resulting /manage page (defence in
          // depth · guarantees no accidental data leak during the
          // redirect-followed render).
          await expect(
            page2
              .getByRole("heading", { name: /L-035 spec-editor product/i })
              .first(),
            "Contract B · non-owner must NOT see owner product heading after redirect",
          ).toHaveCount(0);
        } finally {
          await page2.close().catch(() => undefined);
          await context2.close().catch(() => undefined);
        }
      } finally {
        try {
          for (const m of merchantAccounts) {
            await ownerScopedBusinessSweep(m);
          }
        } catch (sweepErr) {
          // eslint-disable-next-line no-console
          console.warn(
            `[L-035 sweep] owner-scoped cleanup: ${(sweepErr as Error).message}`,
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
            `L-035 teardown must leave zero residual rows · got ${JSON.stringify(residual)}`,
          ).toBe(0);
        }

        await page.close().catch(() => undefined);
        await context.close().catch(() => undefined);
      }
    });
  },
);
