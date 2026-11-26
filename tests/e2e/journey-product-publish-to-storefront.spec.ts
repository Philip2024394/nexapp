// tests/e2e/journey-product-publish-to-storefront.spec.ts
//
// L-029 · product-publish → storefront journey · authored 2026-11-26
// following Founder Directive 2026-11-26 ("FINISH THE APPLICATION ·
// merchant onboarding, product publishing and order management").
//
// Why this spec exists
// --------------------
// The existing shop-tree coverage proves:
//   · journey-create-shop.spec.ts   → nex_business row can be created
//     by a shop-less fixture account.
//   · journey-merchant-order-t8.spec.ts + -ui-loop variants → order
//     lifecycle AFTER products exist.
// What was MISSING is the link in the middle: does a merchant's
// published product actually render on the public storefront under the
// sealed `/<businessSlug>` surface, and do the status + ownership
// gates work correctly? Without this link proven the "publish a
// product" journey is unverified even though BOTH ends are green.
//
// Observable contracts under test
// --------------------------------
//   A · Positive · a product with status="live" owned by business A
//       appears on business A's public storefront as a tile matching
//       the sealed `data-nex-cover-product-round` / `data-nex-cover-
//       product-card` selectors in `src/app/nex-native/cover/
//       primitives.tsx:771,972`.
//   B · Status gate · a product with status="draft" MUST NOT appear
//       on the storefront. Proves `listProductsByBusiness(id, "live")`
//       (src/app/nex-native/[businessSlug]/page.tsx:189) honestly
//       filters by status.
//   C · Ownership gate · a product owned by business A MUST NOT appear
//       on business B's storefront. Proves the FK + query predicate
//       enforce business boundary.
//
// What this spec does NOT cover
// ------------------------------
//   · Full UI form submission (/create/product/category →
//     /create/product/form → createProductAction). That requires
//     driving the multi-step spec editor UI (fashion_clothing schema
//     has ~30 fields). Deferred to a follow-up spec once the harness
//     supports category-spec payload helpers.
//   · Image upload to bucket. The harness inserts rows with
//     image_url=null and the storefront renders a sealed placeholder;
//     this is the correct behaviour for a text-only product.
//
// Classification: SPEC AUTHORED · exercises REAL product-publish →
// storefront chain against sandbox Supabase via fixture harness. No
// product code changed. No assertion weakened. Teardown reverses all
// inserts.

import { expect, test } from "@playwright/test";
import {
  assertNoResidualFixtures,
  assertSandboxRef,
  createTestAccount,
  createTestBusiness,
  createTestProduct,
  supabaseAdmin,
  teardownAll,
  type FixtureHandle,
} from "./_fixtures/sandbox-test-harness";

// Device-emulated project · covers the primary consumer surface
// (public shop · unauthenticated viewer). We use the default context
// (no storageState) so the request is treated as a public GET — the
// storefront is designed to be reachable by signed-out buyers.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe.serial("L-029 · product-publish → storefront journey", () => {
  test("A · positive · live product owned by business A renders on /<slug>", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    assertSandboxRef();
    const handles: FixtureHandle[] = [];

    try {
      // Mint a merchant + business + ONE live product.
      const merchant = await createTestAccount({
        label: "product-publish-A-merchant",
      });
      handles.push(merchant);
      const biz = await createTestBusiness(merchant, {
        label: "product-publish-A-shop",
      });
      handles.push(biz);
      const product = await createTestProduct(biz, {
        name: "L-029 test product (live)",
        pricePence: 1299,
        currency: "GBP",
        status: "live",
      });
      handles.push(product);

      // Navigate to the public storefront as an unauthenticated viewer.
      // `networkidle` is intentional: `/<slug>/page.tsx` fires
      // page-view analytics + SEO JSON-LD after mount, and we want the
      // product grid fully rendered before assertions.
      const response = await page.goto(`/nex-native/${biz.slug}`, {
        waitUntil: "domcontentloaded",
      });
      expect(response?.status(), `storefront /${biz.slug} responds 200`).toBe(
        200,
      );
      await page.waitForFunction(() => Boolean(document.body), null, {
        timeout: 10_000,
      });
      await page.waitForLoadState("networkidle", { timeout: 20_000 });

      // At least one product tile must render. The sealed cover
      // primitives emit EITHER `data-nex-cover-product-round` OR
      // `data-nex-cover-product-card` depending on the layout the
      // business has chosen (same semantic; either proves publish).
      const productTiles = page.locator(
        "[data-nex-cover-product-round],[data-nex-cover-product-card]",
      );
      await expect(
        productTiles,
        `storefront must render ≥1 product tile for the just-created live product · business=${biz.slug} · productId=${product.productId}`,
      ).not.toHaveCount(0);
    } finally {
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
          `test A teardown must leave zero residual rows · got ${JSON.stringify(residual)}`,
        ).toBe(0);
      }
    }
  });

  test("B · status gate · draft product does NOT appear on /<slug>", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    assertSandboxRef();
    const handles: FixtureHandle[] = [];

    try {
      const merchant = await createTestAccount({
        label: "product-publish-B-merchant",
      });
      handles.push(merchant);
      const biz = await createTestBusiness(merchant, {
        label: "product-publish-B-shop",
      });
      handles.push(biz);
      // ONLY a draft product · no live product · the storefront
      // product grid must be empty.
      const draft = await createTestProduct(biz, {
        name: "L-029 test product (draft)",
        pricePence: 999,
        currency: "GBP",
        status: "draft",
      });
      handles.push(draft);

      // Defence in depth: confirm the DB actually has 1 draft + 0 live
      // for this business before we hit the storefront, so a storefront
      // emptiness assertion is meaningful rather than a vacuous truth
      // (e.g. the business was never created).
      const sb = supabaseAdmin();
      const { data: rows } = await sb
        .from("nex_product")
        .select("id, status")
        .eq("business_id", biz.businessId);
      const live = (rows ?? []).filter((r) => r.status === "live").length;
      const drafts = (rows ?? []).filter((r) => r.status === "draft").length;
      expect(
        { live, drafts },
        `DB precondition for status-gate test · ${biz.slug}`,
      ).toEqual({ live: 0, drafts: 1 });

      const response = await page.goto(`/nex-native/${biz.slug}`, {
        waitUntil: "domcontentloaded",
      });
      expect(response?.status(), `storefront /${biz.slug} responds 200`).toBe(
        200,
      );
      await page.waitForFunction(() => Boolean(document.body), null, {
        timeout: 10_000,
      });
      await page.waitForLoadState("networkidle", { timeout: 20_000 });

      const productTiles = page.locator(
        "[data-nex-cover-product-round],[data-nex-cover-product-card]",
      );
      await expect(
        productTiles,
        `draft products MUST NOT render · business=${biz.slug} should show 0 product tiles`,
      ).toHaveCount(0);
    } finally {
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
          `test B teardown must leave zero residual rows · got ${JSON.stringify(residual)}`,
        ).toBe(0);
      }
    }
  });

  test("C · ownership gate · product belongs to business A, business B's /<slug> MUST NOT render it", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    assertSandboxRef();
    const handles: FixtureHandle[] = [];

    try {
      // Two independent merchants, two businesses, one live product
      // owned by business A.
      const merchantA = await createTestAccount({
        label: "product-publish-C-merchantA",
      });
      handles.push(merchantA);
      const bizA = await createTestBusiness(merchantA, {
        label: "product-publish-C-shopA",
      });
      handles.push(bizA);
      const liveOnA = await createTestProduct(bizA, {
        name: "L-029 test product · belongs to A",
        pricePence: 1500,
        currency: "GBP",
        status: "live",
      });
      handles.push(liveOnA);

      const merchantB = await createTestAccount({
        label: "product-publish-C-merchantB",
      });
      handles.push(merchantB);
      const bizB = await createTestBusiness(merchantB, {
        label: "product-publish-C-shopB",
      });
      handles.push(bizB);
      // business B has NO products. If A's product leaks to B's
      // storefront that is an ownership-boundary violation.

      const sb = supabaseAdmin();
      const { data: bRows } = await sb
        .from("nex_product")
        .select("id")
        .eq("business_id", bizB.businessId);
      expect(
        bRows?.length ?? 0,
        "DB precondition · business B must have zero products",
      ).toBe(0);

      const response = await page.goto(`/nex-native/${bizB.slug}`, {
        waitUntil: "domcontentloaded",
      });
      expect(response?.status(), `storefront /${bizB.slug} responds 200`).toBe(
        200,
      );
      await page.waitForFunction(() => Boolean(document.body), null, {
        timeout: 10_000,
      });
      await page.waitForLoadState("networkidle", { timeout: 20_000 });

      const productTiles = page.locator(
        "[data-nex-cover-product-round],[data-nex-cover-product-card]",
      );
      await expect(
        productTiles,
        `business B's storefront MUST NOT leak business A's product · bizA=${bizA.slug} productId=${liveOnA.productId} · bizB=${bizB.slug}`,
      ).toHaveCount(0);
    } finally {
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
          `test C teardown must leave zero residual rows · got ${JSON.stringify(residual)}`,
        ).toBe(0);
      }
    }
  });
});
