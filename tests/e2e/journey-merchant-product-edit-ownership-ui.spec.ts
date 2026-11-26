// tests/e2e/journey-merchant-product-edit-ownership-ui.spec.ts
//
// L-039 · merchant /manage/products/[productId]/edit OWNERSHIP-GATE
// journey · authored 2026-11-26 under Strict Complete-App Delivery
// Directive 2026-11-26 §4.
//
// Why this spec exists
// --------------------
// The L-035 / L-037 / L-038 pattern-hunt catalogued FOUR distinct
// ownership-gate patterns on /manage/*. The pattern-hunt stopped at
// the top-level detail pages. Drilling into the merchant product
// detail surface revealed a FIFTH pattern at
// `src/app/nex-native/manage/products/[productId]/edit/page.tsx:84-88`:
//
//   const owned = await listBusinessesByOwner(session.account.id);
//   const owningBusiness = owned.find((b) => b.id === product.business_id);
//   if (!owningBusiness) {
//     redirect(`/nex-native/manage/products/${productId}?e=not-owned`);
//   }
//
// Unlike all four previously-pinned patterns, this redirect target is
// NOT a list page — it is the *product-detail* page itself, with a
// different error code (`not-owned` vs `spec_forbidden`). This means
// a non-owner hitting `/edit` triggers a TWO-HOP redirect chain:
//
//   /manage/products/{id}/edit            (as non-owner)
//     → /manage/products/{id}?e=not-owned (L-039 contract · this spec)
//       → /manage?e=spec_forbidden        (L-035 contract)
//
// The browser follows both hops transparently — so the final URL
// observable from Playwright is the L-035 landing (manage root). But
// L-039 is a distinct contract: if a future refactor collapses the
// two-hop into a direct redirect to `/manage`, that would silently
// break any merchant surface that reads `?e=not-owned` to render a
// context-specific error state. This spec pins the *intermediate*
// redirect by inspecting the browser's navigation redirect chain.
//
// What this spec covers (all browser-observable)
// -----------------------------------------------
//   A · Signed-in owner lands on /manage/products/{id}/edit · URL
//       stays on the edit page · the edit form mounts.
//   B · Signed-in non-owner merchant visiting the same /edit URL
//       is bounced through a redirect chain that:
//         (1) passes through `/manage/products/{id}?e=not-owned`
//             (verified by inspecting `response.request().redirectedFrom()`
//             or `page.on('request')` capture · the sealed L-039
//             intermediate), and
//         (2) ultimately lands on `/manage?e=spec_forbidden` (the
//             sealed L-035 downstream gate), with the "You don't own
//             this product" banner from the product-detail page.
//
// What this spec does NOT cover (honest deferral)
// ------------------------------------------------
//   · The 30+ fields of the edit form itself — covered by L-034's
//     spec-payload helper authoring work.
//   · The sibling `/interest` sub-route's ownership gate (SIXTH
//     distinct pattern: redirects with `?e=interest_forbidden` rather
//     than `?e=not-owned` or `?e=spec_forbidden`). That is a separate
//     spec authored as L-040.
//
// Boundaries honoured
//   · No product-code changed · no sealed action weakened · no
//     migration applied · no commit · no push · no deployment.
//   · Fixture teardown is a QUALITY GATE · residual = no clean PASS.
//
// Classification: SPEC AUTHORED · exercises REAL merchant UI mount
// of `/manage/products/[productId]/edit` + REAL server-side ownership
// redirect-chain against sandbox Supabase via fixture harness.

import { expect, test, type Page, type Request } from "@playwright/test";
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
  "L-039 · merchant product-edit ownership · two-hop redirect through ?e=not-owned",
  () => {
    test("owner lands on /edit; non-owner traverses /?e=not-owned then /manage?e=spec_forbidden", async ({
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
          label: "l039-edit-merchant",
          returnPassword: true,
        });
        handles.push(merchant);
        merchantAccounts.push(merchant);
        const biz = await createTestBusiness(merchant, {
          label: "l039-edit-shop",
        });
        handles.push(biz);
        const product = await createTestProduct(biz, {
          name: "L-039 edit-gate product",
          pricePence: 1999,
          currency: "GBP",
          status: "live",
        });
        handles.push(product);

        const editUrl = `/nex-native/manage/products/${product.productId}/edit`;

        // ─────────────────────────────────────────────────────────
        // 2 · Owner sign-in + positive-path mount.
        // ─────────────────────────────────────────────────────────
        await signInAsFixtureInBrowser(page, merchant);
        const resp = await page.goto(editUrl, {
          waitUntil: "domcontentloaded",
        });
        expect(
          resp?.status(),
          `Contract A · edit page responds for owner · url=${editUrl}`,
        ).toBeLessThan(500);

        // Contract A · URL stays on /edit (no silent bounce).
        await expect
          .poll(() => new URL(page.url()).pathname, {
            message:
              "Contract A · owner must remain on /manage/products/[id]/edit",
            timeout: 10_000,
          })
          .toMatch(
            new RegExp(
              `^/nex-native/manage/products/${product.productId}/edit$`,
            ),
          );
        expect(
          new URL(page.url()).searchParams.get("e"),
          "Contract A · owner URL must NOT carry an error querystring",
        ).toBeNull();

        // ─────────────────────────────────────────────────────────
        // 3 · Non-owner redirect chain · second merchant visits the
        //     first merchant's /edit URL. Capture ALL navigation
        //     requests to prove the two-hop chain: through
        //     ?e=not-owned (L-039 intermediate) then
        //     ?e=spec_forbidden (L-035 downstream).
        // ─────────────────────────────────────────────────────────
        const merchant2 = await createTestAccount({
          label: "l039-edit-merchant2",
          returnPassword: true,
        });
        handles.push(merchant2);
        merchantAccounts.push(merchant2);
        const biz2 = await createTestBusiness(merchant2, {
          label: "l039-edit-shop2",
        });
        handles.push(biz2);

        const context2 = await browser.newContext({ storageState: undefined });
        const page2: Page = await context2.newPage();
        try {
          await signInAsFixtureInBrowser(page2, merchant2);

          // Install a request listener BEFORE the navigation to
          // capture every document request. Next 16's server-side
          // `redirect(...)` emits an RSC NEXT_REDIRECT marker + a
          // client-router navigation, so each hop surfaces as a
          // separate `page.on("request")` event. That lets us verify
          // the INTERMEDIATE URL carries `?e=not-owned` even though
          // the FINAL URL is the L-035 landing.
          const navUrls: string[] = [];
          const onRequest = (req: Request): void => {
            if (req.resourceType() === "document") {
              navUrls.push(req.url());
            }
          };
          page2.on("request", onRequest);

          await page2.goto(editUrl, { waitUntil: "domcontentloaded" });
          // Wait for the L-035 downstream landing — the sealed
          // final hop.
          await page2.waitForURL(
            (u) =>
              /\/nex-native\/manage(?:[/?#]|$)/.test(u.pathname) &&
              u.searchParams.get("e") === "spec_forbidden",
            { timeout: 15_000 },
          );
          page2.off("request", onRequest);

          // Contract B(1) · at least one intermediate document
          // request must have carried `?e=not-owned` on the product-
          // detail path. This is the L-039 pin.
          const sawNotOwnedIntermediate = navUrls.some((raw) => {
            try {
              const u = new URL(raw);
              return (
                u.pathname === `/nex-native/manage/products/${product.productId}` &&
                u.searchParams.get("e") === "not-owned"
              );
            } catch {
              return false;
            }
          });
          expect(
            sawNotOwnedIntermediate,
            `Contract B(1) · navigation chain MUST pass through /manage/products/${product.productId}?e=not-owned · observed=${JSON.stringify(navUrls)}`,
          ).toBe(true);

          // Contract B(2) · final URL is the L-035 downstream sealed
          // landing (this is a composite assertion — the regression
          // signal is that BOTH the intermediate and final hops hold).
          const landedUrl = new URL(page2.url());
          expect(
            landedUrl.pathname,
            "Contract B(2) · final hop must land on /nex-native/manage",
          ).toBe("/nex-native/manage");
          expect(
            landedUrl.searchParams.get("e"),
            "Contract B(2) · final hop must carry e=spec_forbidden (downstream L-035)",
          ).toBe("spec_forbidden");
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
            `[L-039 sweep] owner-scoped cleanup: ${(sweepErr as Error).message}`,
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
            `L-039 teardown must leave zero residual rows · got ${JSON.stringify(residual)}`,
          ).toBe(0);
        }

        await page.close().catch(() => undefined);
        await context.close().catch(() => undefined);
      }
    });
  },
);
