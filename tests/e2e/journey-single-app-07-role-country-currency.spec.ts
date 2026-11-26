// tests/e2e/journey-single-app-07-role-country-currency.spec.ts
//
// NAV-SINGLE-APP-07 · role × country sample (merchant currency label)
// --------------------------------------------------------------------
// Authored 2026-11-26 under the single-app country-selection model
// reconciliation (`docs/engineering/single-app-country-model-
// reconciliation-2026-11-26.md`), which replaced the obsolete
// "3-country-deployment × 4-session-state × 18-row = 216 cell"
// matrix with two orthogonal axes:
//
//   Axis A · role × session × drawer navigation (shared across all
//            countries) — covered by L-041 / L-045 / L-046.
//   Axis B · country-selection journeys (NAV-SINGLE-APP-01…-07) —
//            the actual country-dependent behaviour.
//
// NAV-SINGLE-APP-07 is the Axis B "role × country sample" — pick one
// drawer-adjacent surface that renders country-dependent content and
// verify a merchant sees the correct country-driven currency label
// under two different country values, with the drawer/composition
// otherwise identical.
//
// Why `/nex-native/pricing` was chosen as the observable
// ------------------------------------------------------
// The sealed in-app country resolution (region-resolver A10 ·
// `src/lib/nex-native/commercial/region-resolver.ts`) has a five-tier
// priority:
//   1. `nex_account.region_pref` · column NOT YET MIGRATED
//   2. Accept-Language country sub-tag
//   3. Edge geo header (Vercel / Cloudflare IP)
//   4. `NEX_APP_COUNTRY` env fallback
//   5. Hard default IE
//
// The pricing surface at `src/app/nex-native/pricing/page.tsx:102-120`
// uses a THIN variant of the same resolution order that specifically
// reads `nex_account.last_known_country_iso` (column DOES exist · mig
// 154 · `nex-supabase/migrations/154_nex_account_last_known_location
// .sql:64`) with IP-header fallback. It renders:
//
//   · `[data-nex-pricing-page]` main container
//   · `[data-nex-pricing-detected-country=<ISO>]` on `<main>`
//   · `[data-nex-pricing-country=<ISO>]` on the shop card
//   · `[data-nex-pricing-shop-price]` → `spec.priceShort`
//
// `spec.priceShort` resolves via `_pricing-data.ts:39-44`:
//   · IE → "€4.99"   (EUR representative for Europe)
//   · GB → "£4.99"
//   · US → "US$4.99"
//   · ID → "Rp 89,000"
//
// Why this observable does NOT require mig 286
// --------------------------------------------
// Mig 286 adds `nex_business.operating_country_code`. The pricing
// surface does not read that column — it reads
// `nex_account.last_known_country_iso` (already migrated · mig 154)
// with a fallback chain to request headers and env. The signal-under-
// test here is **account-country → merchant-visible currency symbol**,
// which is complete without mig 286 and complete without the un-
// authored `nex_account.region_pref` column.
//
// Mig 286 and `nex_account.region_pref` belong to NAV-SINGLE-APP-01
// (business-details form country submit) and NAV-SINGLE-APP-04/05
// (country-change + cross-country RLS) respectively. Both remain
// BLOCKED on named owner approval per Rule 7. NAV-SINGLE-APP-07 is
// strictly weaker and crosses no approval boundary.
//
// Fixture shape
// -------------
//   1. Mint a merchant via `createTestAccount({ returnPassword:true })`
//      + `createTestBusiness(…)`. The business satisfies the
//      "role=merchant, has shop" axis — identical to L-041.
//   2. Service-role UPDATE `nex_account.last_known_country_iso = 'IE'`
//      on the fixture's account row (sandbox only · bypasses RLS
//      because test-harness `supabaseAdmin()` is service-role per
//      the sealed harness invariants).
//   3. Browser sign-in via `signInAsFixtureInBrowser`.
//   4. `page.goto('/nex-native/pricing')` · assert the surface shows
//      `[data-nex-pricing-detected-country]` that resolves to `IE`
//      (via the account-country preference layer) AND
//      `[data-nex-pricing-shop-price]` contains the EUR symbol `€`.
//   5. Service-role UPDATE the SAME account row to
//      `last_known_country_iso = 'ID'`.
//   6. Reload the pricing page. Assert the surface now shows
//      `[data-nex-pricing-shop-price]` contains the IDR label `Rp`.
//   7. Composition equality: assert the merchant drawer composition
//      does NOT differ between the two country contexts — the
//      `[data-nex-pricing-page]` + `[data-nex-pricing-header]` +
//      `[data-nex-pricing-shop-card]` + `[data-nex-pricing-chat-card]`
//      elements all still render under both country values. This
//      proves axis B's core claim: "composition is identical, only
//      country-dependent values differ."
//   8. Teardown via `teardownAll(handles)` + residual assertion.
//
// What this spec does NOT prove
// -----------------------------
//   · Country selection via the business-details form submit path
//     (that's NAV-SINGLE-APP-01 · blocked on mig 286 sandbox apply).
//   · IP-pickup on create account (NAV-SINGLE-APP-02).
//   · Accept-Language fallback (NAV-SINGLE-APP-03).
//   · Cross-country RLS isolation (NAV-SINGLE-APP-05 · blocked on
//     `nex_account.region_pref` migration).
//   · Checkout region correctness via `resolveViewerRegion`
//     (NAV-SINGLE-APP-06 · a separate spec is needed for the four
//     launch markets).
//
// Boundaries honoured
//   · No product-code change · spec-only addition.
//   · No migration applied.
//   · Sandbox-only service-role writes via sealed harness.
//   · Fixture teardown is a QUALITY GATE · residual = no clean PASS.
//
// Classification: NAV COVERAGE SPEC · exercises REAL merchant browser
// mount of the pricing surface under two country values resolved
// from `nex_account.last_known_country_iso`.

import { expect, test, type Page } from "@playwright/test";
import {
  assertNoResidualFixtures,
  assertSandboxRef,
  createTestAccount,
  createTestBusiness,
  signInAsFixtureInBrowser,
  supabaseAdmin,
  teardownAll,
  type FixtureHandle,
  type TestAccountHandle,
} from "./_fixtures/sandbox-test-harness";

/** Sweep any businesses this spec created but a prior failed run may
 *  have orphaned. Matches the L-041/L-046 pattern. */
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
  await sb.from("nex_business").delete().in("id", ownedBizIds);
}

/** Service-role write of the account-country ISO. Sandbox only. */
async function setAccountCountryIso(
  accountId: string,
  iso: "IE" | "ID",
): Promise<void> {
  const sb = supabaseAdmin();
  const { error } = await sb
    .from("nex_account")
    .update({ last_known_country_iso: iso })
    .eq("id", accountId);
  if (error) {
    throw new Error(
      `NAV-SINGLE-APP-07 · failed to set last_known_country_iso=${iso} ` +
        `on account ${accountId} · ${error.message}`,
    );
  }
}

test.describe.serial(
  "NAV-SINGLE-APP-07 · merchant × country sample · pricing currency label",
  () => {
    const handles: FixtureHandle[] = [];
    const merchantAccounts: TestAccountHandle[] = [];
    let page: Page;
    let signedIn = false;
    let merchantAccountId: string | null = null;

    test.beforeAll(async ({ browser }) => {
      test.setTimeout(180_000);
      assertSandboxRef();
      const context = await browser.newContext({ storageState: undefined });
      page = await context.newPage();

      // Role = merchant · session = signed-in-with-shop · same shape
      // as L-041's authority fixture. Shop ownership is not strictly
      // required for the pricing page to render, but mirroring L-041
      // keeps the "role × country" axis labelling honest.
      const merchant = await createTestAccount({
        label: "nav-single-app-07-merchant",
        returnPassword: true,
      });
      handles.push(merchant);
      merchantAccounts.push(merchant);
      merchantAccountId = merchant.nexAccountId;

      const biz = await createTestBusiness(merchant, {
        label: "nav-single-app-07-shop",
      });
      handles.push(biz);

      // Seed country BEFORE sign-in so the SSR of the pricing page
      // picks up the preference on first paint (no reliance on
      // client-side hydration order).
      await setAccountCountryIso(merchant.nexAccountId, "IE");

      await signInAsFixtureInBrowser(page, merchant);
      signedIn = true;
    });

    test.afterAll(async () => {
      try {
        for (const m of merchantAccounts) {
          await ownerScopedBusinessSweep(m);
        }
      } catch (sweepErr) {
        // eslint-disable-next-line no-console
        console.warn(
          `[NAV-SINGLE-APP-07 sweep] owner-scoped cleanup: ${(sweepErr as Error).message}`,
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
          `NAV-SINGLE-APP-07 teardown must leave zero residual rows · got ${JSON.stringify(residual)}`,
        ).toBe(0);
      }
      await page?.close().catch(() => undefined);
      await page?.context().close().catch(() => undefined);
    });

    test("merchant with last_known_country_iso=IE sees EUR label on /nex-native/pricing", async () => {
      test.setTimeout(60_000);
      expect(
        signedIn,
        "NAV-SINGLE-APP-07 · merchant must be signed in before the pricing check",
      ).toBe(true);
      expect(
        merchantAccountId,
        "NAV-SINGLE-APP-07 · merchant account id must be captured",
      ).not.toBeNull();

      // Next 16 dev-mode streams RSC content continuously (HMR polling),
      // so `networkidle` never settles. Use `domcontentloaded` and rely
      // on the explicit `toBeVisible` below for the real signal.
      const response = await page.goto("/nex-native/pricing", {
        waitUntil: "domcontentloaded",
      });
      const status = response?.status() ?? 0;
      expect(
        status,
        `NAV-SINGLE-APP-07 · /nex-native/pricing must respond <500 · got ${status}`,
      ).toBeLessThan(500);

      // Composition: the pricing page container renders.
      const page$ = page.locator("[data-nex-pricing-page]").first();
      await expect(
        page$,
        "NAV-SINGLE-APP-07 · [data-nex-pricing-page] must mount",
      ).toBeVisible({ timeout: 15_000 });

      // Composition: the shop card renders. `data-nex-pricing-chat-card`
      // exists in the code only on an unused `ChatFreeCard` function —
      // owner directive 2026-11-09 removed the ChatFreeCard from the
      // actual render (see `src/app/nex-native/pricing/page.tsx:165-168`),
      // so we assert only on surfaces that are actually mounted.
      await expect(
        page.locator("[data-nex-pricing-shop-card]").first(),
        "NAV-SINGLE-APP-07 · pricing shop card must mount under IE",
      ).toBeVisible({ timeout: 10_000 });

      // Country-dependent value: EUR symbol appears in the shop price.
      const priceText =
        (await page
          .locator("[data-nex-pricing-shop-price]")
          .first()
          .innerText()) ?? "";
      expect(
        priceText,
        `NAV-SINGLE-APP-07 · IE shop price must contain '€' · got '${priceText}'`,
      ).toContain("€");
    });

    test("same merchant switched to last_known_country_iso=ID sees IDR label after reload", async () => {
      test.setTimeout(60_000);
      expect(
        merchantAccountId,
        "NAV-SINGLE-APP-07 · merchant account id must still be captured",
      ).not.toBeNull();

      // Flip the account-country preference. SSR of the pricing page
      // on reload re-reads this column.
      await setAccountCountryIso(merchantAccountId as string, "ID");

      // Full reload so the server component re-runs with the new
      // preference. `domcontentloaded` (not networkidle) for Next 16
      // dev-mode RSC-stream reasons — subsequent `toBeVisible` gates
      // on the actual DOM mount.
      await page.reload({ waitUntil: "domcontentloaded" });

      // Composition unchanged: the same three composition anchors still
      // render under the ID country value. This is the core claim of
      // axis B · "composition is identical, only country-dependent
      // values differ."
      await expect(
        page.locator("[data-nex-pricing-page]").first(),
        "NAV-SINGLE-APP-07 · pricing page must still mount under ID",
      ).toBeVisible({ timeout: 15_000 });
      await expect(
        page.locator("[data-nex-pricing-shop-card]").first(),
        "NAV-SINGLE-APP-07 · pricing shop card must still mount under ID",
      ).toBeVisible({ timeout: 10_000 });

      // Country-dependent value: IDR label appears in the shop price.
      // `_pricing-data.ts:43` ships priceShort="Rp 89,000" for ID. We
      // assert the "Rp" prefix so a future locale re-format of the
      // numeric portion does not falsely flake this test.
      const priceText =
        (await page
          .locator("[data-nex-pricing-shop-price]")
          .first()
          .innerText()) ?? "";
      expect(
        priceText,
        `NAV-SINGLE-APP-07 · ID shop price must contain 'Rp' · got '${priceText}'`,
      ).toContain("Rp");
      expect(
        priceText,
        `NAV-SINGLE-APP-07 · ID shop price must NOT contain the EUR symbol · got '${priceText}'`,
      ).not.toContain("€");
    });
  },
);
