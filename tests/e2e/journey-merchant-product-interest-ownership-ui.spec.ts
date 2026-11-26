// tests/e2e/journey-merchant-product-interest-ownership-ui.spec.ts
//
// L-040 · merchant /manage/products/[productId]/interest OWNERSHIP-GATE
// journey · authored 2026-11-26 under Strict Complete-App Delivery
// Directive 2026-11-26 §4. Closes the sixth and final pattern in the
// merchant-ownership inventory kicked off by L-035.
//
// Why this spec exists
// --------------------
// L-035/L-037/L-038/L-039 catalogued FIVE merchant-ownership patterns.
// The pattern-hunt must terminate on an inventory that proves there
// are no more silent variants. The product/interest sub-route at
// `src/app/nex-native/manage/products/[productId]/interest/page.tsx:81-85`
// uses a SIXTH distinct pattern:
//
//   case "product-not-in-owned-business":
//     redirect(
//       "/nex-native/manage?e=interest_forbidden&m=" +
//         encodeURIComponent("You don't own this product"),
//     );
//
// The error code `interest_forbidden` is deliberately distinct from
// L-035's `spec_forbidden` — it lets merchant surfaces render a
// context-specific error state ("you don't own this product's
// INTEREST dashboard" vs "...SPEC editor"). A silent regression
// that collapsed both into one code would break any merchant banner
// component keyed off the code.
//
// Six-pattern inventory (sealed by L-040)
// ---------------------------------------
//   1 · /manage/orders/[orderId]                → notFound() single check
//   2 · /manage/products/[productId]             → redirect ?e=spec_forbidden
//   3 · /manage/menu/[itemId]                    → silent redirect (no ?e=)
//   4 · /manage/accommodation/[roomId]           → notFound() two pre-checks
//   5 · /manage/products/[productId]/edit        → redirect ?e=not-owned (two-hop)
//   6 · /manage/products/[productId]/interest    → redirect ?e=interest_forbidden
//                                                   (THIS SPEC)
//
// What this spec covers (all browser-observable)
// -----------------------------------------------
//   A · Signed-in owner lands on the interest dashboard · URL stays
//       on /manage/products/{id}/interest.
//   B · Signed-in non-owner visiting the same URL is redirected to
//       /nex-native/manage?e=interest_forbidden&m=<encoded>, with
//       the sealed "You don't own this product" message.
//
// Boundaries honoured
//   · No product-code changed · no sealed action weakened · no
//     migration applied · no commit · no push · no deployment.
//   · Fixture teardown is a QUALITY GATE · residual = no clean PASS.
//
// Classification: SPEC AUTHORED · exercises REAL merchant UI mount
// of `/manage/products/[productId]/interest` + REAL server-side
// `interest_forbidden` redirect against sandbox Supabase via fixture
// harness.

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
  "L-040 · merchant product-interest ownership · ?e=interest_forbidden redirect",
  () => {
    test("owner lands on /interest; non-owner redirected to /manage?e=interest_forbidden", async ({
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
          label: "l040-interest-merchant",
          returnPassword: true,
        });
        handles.push(merchant);
        merchantAccounts.push(merchant);
        const biz = await createTestBusiness(merchant, {
          label: "l040-interest-shop",
        });
        handles.push(biz);
        const product = await createTestProduct(biz, {
          name: "L-040 interest-gate product",
          pricePence: 2599,
          currency: "GBP",
          status: "live",
        });
        handles.push(product);

        const interestUrl = `/nex-native/manage/products/${product.productId}/interest`;

        // ─────────────────────────────────────────────────────────
        // 2 · Owner sign-in + positive-path mount.
        // ─────────────────────────────────────────────────────────
        await signInAsFixtureInBrowser(page, merchant);
        const resp = await page.goto(interestUrl, {
          waitUntil: "domcontentloaded",
        });
        expect(
          resp?.status(),
          `Contract A · interest page responds for owner · url=${interestUrl}`,
        ).toBeLessThan(500);

        // Contract A · URL stays on /interest (no silent bounce to
        // sign-in or to /manage).
        await expect
          .poll(() => new URL(page.url()).pathname, {
            message:
              "Contract A · owner must remain on /manage/products/[id]/interest",
            timeout: 10_000,
          })
          .toMatch(
            new RegExp(
              `^/nex-native/manage/products/${product.productId}/interest$`,
            ),
          );
        expect(
          new URL(page.url()).searchParams.get("e"),
          "Contract A · owner URL must NOT carry interest_forbidden",
        ).not.toBe("interest_forbidden");

        // ─────────────────────────────────────────────────────────
        // 3 · Non-owner redirect gate · second merchant visits first
        //     merchant's interest URL · expect redirect to
        //     /manage?e=interest_forbidden.
        // ─────────────────────────────────────────────────────────
        const merchant2 = await createTestAccount({
          label: "l040-interest-merchant2",
          returnPassword: true,
        });
        handles.push(merchant2);
        merchantAccounts.push(merchant2);
        const biz2 = await createTestBusiness(merchant2, {
          label: "l040-interest-shop2",
        });
        handles.push(biz2);

        const context2 = await browser.newContext({ storageState: undefined });
        const page2: Page = await context2.newPage();
        try {
          await signInAsFixtureInBrowser(page2, merchant2);
          await page2.goto(interestUrl, { waitUntil: "domcontentloaded" });
          await page2.waitForURL(
            (u) =>
              /\/nex-native\/manage(?:[/?#]|$)/.test(u.pathname) &&
              u.searchParams.get("e") === "interest_forbidden",
            { timeout: 15_000 },
          );

          // Contract B · post-redirect URL carries BOTH the distinct
          // error code `interest_forbidden` (NOT `spec_forbidden`,
          // NOT `not-owned`) AND the encoded ownership message.
          const landedUrl = new URL(page2.url());
          expect(
            landedUrl.pathname,
            "Contract B · non-owner must land on /nex-native/manage",
          ).toBe("/nex-native/manage");
          expect(
            landedUrl.searchParams.get("e"),
            "Contract B · redirect must carry e=interest_forbidden (sealed asymmetry with L-035 spec_forbidden and L-039 not-owned)",
          ).toBe("interest_forbidden");
          expect(
            landedUrl.searchParams.get("m") ?? "",
            "Contract B · redirect must carry the encoded ownership message",
          ).toContain("You don't own this product");
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
            `[L-040 sweep] owner-scoped cleanup: ${(sweepErr as Error).message}`,
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
            `L-040 teardown must leave zero residual rows · got ${JSON.stringify(residual)}`,
          ).toBe(0);
        }

        await page.close().catch(() => undefined);
        await context.close().catch(() => undefined);
      }
    });
  },
);
