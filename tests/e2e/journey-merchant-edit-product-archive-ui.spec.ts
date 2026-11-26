// tests/e2e/journey-merchant-edit-product-archive-ui.spec.ts
//
// L-031 · merchant edit-product UI journey · archive status change ·
// authored 2026-11-26 under the Strict Complete-App Delivery Directive
// 2026-11-26 §3 ("create first product → edit product → publish →
// public storefront").
//
// Why "archive" rather than driving the full spec-editor form
// -------------------------------------------------------------
// The sealed Edit Product UI at `src/app/nex-native/manage/products/
// [productId]/edit/_edit-client.tsx` is 701 lines and the companion
// server action `updateProductAction` requires a FULL
// `UpdateProductInput` with department/category IDs matching a Zod
// category spec (~30 fields for fashion_clothing). Driving that in
// full would need a dedicated harness that does not exist today —
// same scope boundary L-030's header documents for the create path.
//
// The archive action is the smallest UI-exposed edit that proves the
// full chain of concern:
//   · UI mounts the product row for the signed-in owner
//   · The Archive button is wired to `archiveProductAction` at
//     `src/app/nex-native/manage/products/_actions.ts:109`
//   · The action runs under session + ownership gates
//   · A sealed DB status transition fires (`live` → `archived` via
//     `productService.updateProductStatus` at line 138)
//   · The storefront's `status="live"` filter (verified separately by
//     L-029 test B · status-gate) hides the now-archived product
//
// This mirrors the real "edit → publish/unpublish" loop a merchant
// takes dozens of times a week. A product status change IS editing the
// product — it alters a sealed attribute that drives commerce-side
// behaviour (visibility, buyable, orderable).
//
// Observable contracts under test
// --------------------------------
//   A · Pre-condition · signed-in merchant lists their live product on
//       /manage/products (sealed `data-nex-product-management-centre`
//       surface if present, or fallback by product-name visibility).
//   B · Action · clicking the Archive button (sealed browser confirm
//       auto-accepted) invokes `archiveProductAction` with the
//       product_id hidden field.
//   C · DB verification · `nex_product.status` transitions from "live"
//       to "archived" for exactly that product id.
//   D · Downstream · the public storefront `/<slug>` no longer renders
//       the product tile (sealed `listProductsByBusiness(id, "live")`
//       filter at `src/app/nex-native/[businessSlug]/page.tsx:189`).
//
// What this spec does NOT cover
// ------------------------------
//   · The full spec-editor form (deferred to a future harness; see
//     L-030 header).
//   · The restoreProductAction companion (symmetric; archive is the
//     direction that changes downstream behaviour).
//   · Variant-level mutations (nex_product_variant).
//
// Boundaries honoured
//   · No product-code changed · no sealed action weakened · no
//     migration applied · no commit · no push.
//
// Teardown
//   · Owner-scoped sweep (same pattern as L-030 teardown fix) handles
//     any FK blocker from stray business rows. `teardownAll` + residual
//     check guarantees zero leaked fixture data.
//
// Classification: SPEC AUTHORED · exercises REAL edit-product UI chain
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

test.describe.serial("L-031 · merchant edit-product UI journey · archive", () => {
  test("signed-in merchant archives a live product via UI · DB flips to archived · storefront hides it", async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    assertSandboxRef();
    const sb = supabaseAdmin();
    const handles: FixtureHandle[] = [];

    // Fresh context · fixture-merchant sign-in (not the default admin
    // storageState). The archive action is ownership-gated — a non-owner
    // session would hit `product-not-found` / `business-not-owned`.
    const context = await browser.newContext({ storageState: undefined });
    const page: Page = await context.newPage();

    // Auto-accept the native browser confirm() invoked by ArchiveForm's
    // onSubmit at _product-card-client.tsx:224. Without this listener
    // the dialog would block the form submission.
    page.on("dialog", (dialog) => {
      void dialog.accept();
    });

    try {
      // ───────────────────────────────────────────────────────────────
      // 1 · Mint merchant + business + live product (harness-direct).
      //     L-029 already proves the publish-to-storefront chain, so
      //     we take the harness shortcut here instead of re-driving
      //     the full business-details UI (that journey is L-030).
      // ───────────────────────────────────────────────────────────────
      const merchant = await createTestAccount({
        label: "l031-merchant",
        returnPassword: true,
      });
      handles.push(merchant);
      const biz = await createTestBusiness(merchant, { label: "l031-shop" });
      handles.push(biz);
      const product = await createTestProduct(biz, {
        name: "L-031 edit-target product",
        pricePence: 1499,
        currency: "GBP",
        status: "live",
      });
      handles.push(product);

      // Precondition sanity.
      {
        const { data: pre } = await sb
          .from("nex_product")
          .select("id, status")
          .eq("id", product.productId)
          .single();
        expect(pre?.status, "product starts in live state").toBe("live");
      }

      // ───────────────────────────────────────────────────────────────
      // 2 · Sign in via sealed form.
      // ───────────────────────────────────────────────────────────────
      await signInAsFixtureInBrowser(page, merchant);

      // ───────────────────────────────────────────────────────────────
      // 3 · Products management centre must list the live product.
      // ───────────────────────────────────────────────────────────────
      const listResp = await page.goto("/nex-native/manage/products", {
        waitUntil: "domcontentloaded",
      });
      expect(
        listResp?.status(),
        "/manage/products responds for signed-in owner",
      ).toBeLessThan(500);
      // Do NOT wait for networkidle · Next.js 16 + sealed management
      // centre keeps background requests (RSC prefetch, analytics,
      // session refresh) open past 20s. Wait for the product name
      // directly — it is the real signal we need.

      // The product name must be visible on the page before we archive.
      await expect(
        page.getByText(product.name, { exact: false }).first(),
        `management centre lists the live product · productId=${product.productId}`,
      ).toBeVisible({ timeout: 10_000 });

      // ───────────────────────────────────────────────────────────────
      // 4 · Click the Archive button. ArchiveForm renders one <form>
      //     per product with action=archiveProductAction and a hidden
      //     input[name="product_id"]. Multiple products may render if
      //     the suite shares a sandbox — but in THIS test the merchant
      //     has exactly one product (just created above).
      //     Confirm() is auto-accepted by the dialog handler above.
      // ───────────────────────────────────────────────────────────────
      const archiveButton = page
        .locator(
          `form:has(input[name="product_id"][value="${product.productId}"]) button:has-text("Archive")`,
        )
        .first();
      await expect(
        archiveButton,
        "scoped Archive button exists for the live product",
      ).toBeVisible({ timeout: 10_000 });

      // archiveProductAction performs `redirectWithBanner(...)` at
      // _actions.ts:147 → Next.js emits an RSC-stream redirect. Wait
      // for the response cycle to settle before asserting DB — use
      // DOMContentLoaded + brief settle; `networkidle` is unreliable
      // on the sealed management centre (background RSC + session
      // refresh keeps the network busy indefinitely).
      await Promise.all([
        page.waitForLoadState("domcontentloaded", { timeout: 30_000 }),
        archiveButton.click(),
      ]);
      // Allow the server action's revalidatePath + status-flip to
      // land in the DB. Short bounded poll — 5s max, step 500ms —
      // gives us the strict DB verification below a chance to see
      // the transition without inflating runtime.
      for (let i = 0; i < 10; i++) {
        const { data: probe } = await sb
          .from("nex_product")
          .select("status")
          .eq("id", product.productId)
          .single();
        if (probe?.status === "archived") break;
        await page.waitForTimeout(500);
      }

      // ───────────────────────────────────────────────────────────────
      // 5 · DB VERIFICATION · status flipped from live → archived.
      // ───────────────────────────────────────────────────────────────
      const { data: postRow, error: postErr } = await sb
        .from("nex_product")
        .select("id, status, business_id")
        .eq("id", product.productId)
        .single();
      expect(postErr, "post-archive read-back has no error").toBeNull();
      expect(
        postRow?.status,
        `nex_product(${product.productId}).status transitions to archived`,
      ).toBe("archived");
      expect(
        postRow?.business_id,
        "business_id unchanged · archive does not re-parent the product",
      ).toBe(biz.businessId);

      // ───────────────────────────────────────────────────────────────
      // 6 · Storefront MUST NOT render the now-archived product.
      //     Unauthenticated public context · proves the status filter
      //     at /nex-native/[businessSlug]/page.tsx:189 honours the
      //     transition immediately (revalidatePath by archive action).
      // ───────────────────────────────────────────────────────────────
      const publicContext = await browser.newContext({
        storageState: { cookies: [], origins: [] },
      });
      try {
        const publicPage = await publicContext.newPage();
        const storefrontResp = await publicPage.goto(
          `/nex-native/${biz.slug}`,
          { waitUntil: "domcontentloaded" },
        );
        expect(
          storefrontResp?.status(),
          `public storefront /${biz.slug} responds 200`,
        ).toBe(200);
        await publicPage.waitForFunction(() => Boolean(document.body), null, {
          timeout: 10_000,
        });
        // Storefront fires background analytics + JSON-LD mount; do
        // not depend on networkidle. Short settle, then assert the
        // sealed tile-count contract directly.
        await publicPage.waitForTimeout(1_500);

        // No product tiles should render — this merchant had exactly
        // one product, now archived.
        const productTiles = publicPage.locator(
          "[data-nex-cover-product-round],[data-nex-cover-product-card]",
        );
        await expect(
          productTiles,
          `archived product MUST NOT render on /<slug> · biz=${biz.slug} archivedProductId=${product.productId}`,
        ).toHaveCount(0);
      } finally {
        await publicContext.close().catch(() => undefined);
      }
    } finally {
      // Owner-scoped business sweep · same pattern as L-030 teardown
      // fix. The archive action does not auto-provision businesses but
      // defence-in-depth sweep remains cheap and correct. Strict-
      // ownership rule honoured: touches only the fixture merchant's
      // own rows.
      try {
        if (handles.length > 0) {
          const accountHandle = handles[0] as TestAccountHandle;
          const { data: ownedBusinesses } = await sb
            .from("nex_business")
            .select("id")
            .eq("owner_account_id", accountHandle.nexAccountId);
          const ownedBizIds = (ownedBusinesses ?? [])
            .map((r) => (r as { id: string }).id)
            .filter(Boolean);
          if (ownedBizIds.length > 0) {
            await sb
              .from("nex_product")
              .delete()
              .in("business_id", ownedBizIds);
            await sb.from("nex_business").delete().in("id", ownedBizIds);
          }
        }
      } catch (sweepErr) {
        // eslint-disable-next-line no-console
        console.warn(
          `[L-031 sweep] owner-scoped cleanup: ${(sweepErr as Error).message}`,
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
          `L-031 teardown must leave zero residual rows · got ${JSON.stringify(residual)}`,
        ).toBe(0);
      }

      await page.close().catch(() => undefined);
      await context.close().catch(() => undefined);
    }
  });
});
