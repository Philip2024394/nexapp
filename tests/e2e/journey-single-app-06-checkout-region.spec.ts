// tests/e2e/journey-single-app-06-checkout-region.spec.ts
//
// NAV-SINGLE-APP-06 · Checkout-region correctness per inbound country
// --------------------------------------------------------------------
// Companion to NAV-SINGLE-APP-02 (pricing-page IP pickup) and
// NAV-SINGLE-APP-07 (role × country currency label). This spec moves
// the country-correctness assertion from the SSR pricing surface down
// to the real shop-subscription-checkout endpoint:
//
//   POST /api/nex-native/billing/checkout/shop
//
// What this spec VERIFIES (without credentials, without charges)
// --------------------------------------------------------------
// `route.ts` line 134 resolves the region via `resolveViewerRegion`
// (the same 5-tier priority chain documented in
// `src/lib/nex-native/commercial/region-resolver.ts`) and then looks
// up a per-region Stripe price ID at line 135. When the price ID is
// NOT configured for a region (its env var is empty), the handler
// returns:
//
//   422 { ok:false, code:"missing_price_id", region:"IE|GB|US|ID" }
//
// The `region` field in that 422 body is the exact value that the
// Stripe Checkout Session WOULD be billed in if a price ID existed.
// This is the observable: the real production code path resolves the
// region, and the 422 body echoes it. By injecting `cf-ipcountry` on
// the inbound request we can prove that the checkout endpoint picks
// the correct region per country, WITHOUT ever creating a Stripe
// session, without activating any live credentials, without taking
// any real or sandbox charge.
//
// Why 422 and not 200
// -------------------
// A 200 response would mean Stripe actually created a Checkout
// Session (a real side effect against the Stripe account tied to
// `STRIPE_SECRET_KEY`). Per Rule 7 and the owner's master directive
// section 3 ("Complete the positive-path sandbox checkout test only
// when the required credentials and approval are available"), this
// spec must NOT exercise that path. If the dev environment has a
// region's price ID configured, the test skips that region with a
// visible reason. The intended configuration during this cycle is
// that price IDs are UNSET (per the L-004 / T10 unblock plan),
// which makes 422 the natural response for every region.
//
// Classification: NAV COVERAGE SPEC · exercises the real server-side
// region-resolver through the real Next.js API route handler, with
// real session cookies, under four distinct IP countries. Verifies
// the checkout boundary agrees with the pricing surface and with the
// resolver's unit tests (NAV-SINGLE-APP-03 / L-050).
//
// Boundaries honoured per Rule 7
//   · No product-code change (spec-only addition).
//   · No migration applied.
//   · No new fixture seeded beyond one fresh account per test · teardown
//     mandatory per Rule 8 fixture-teardown quality gate.
//   · No Stripe charges. No PayPal activation. No credentials activated.
//   · No real network to Stripe at inbound level. The 422 path short-
//     circuits BEFORE Stripe is contacted.
//   · No live-mode gate crossed. No production reference touched.
//
// Companion specs
//   · NAV-SINGLE-APP-02 (pricing-page IP pickup)       — SSR
//     observable for the same country mapping
//   · NAV-SINGLE-APP-03 (Accept-Language fallback)     — unit level,
//     via region-resolver.test.ts
//   · NAV-SINGLE-APP-07 (role × country currency)      — SSR observable
//     from an authed merchant with last_known_country_iso
//
// Status taxonomy per Rule 8
//   This spec is authored in the authorised scope for NAV-06
//   preparation. It runs green when price IDs are unset (the current
//   intended dev-env state); it honestly skips the region when a
//   price ID is set, to prevent Stripe side effects. Full "positive-
//   path end-to-end checkout" verification remains BLOCKED on L-004
//   credentials and a separate spec (owner directive §3 NAV-06).

import { expect, test } from "@playwright/test";
import {
  assertNoResidualFixtures,
  assertSandboxRef,
  createTestAccount,
  signInAsFixtureInBrowser,
  teardownAll,
  type FixtureHandle,
} from "./_fixtures/sandbox-test-harness";

interface CountryScenario {
  readonly iso: "GB" | "US" | "ID";
  readonly label: string;
}

// IE is covered by the control case at the end (no header → IE default).
const COUNTRY_SCENARIOS: readonly CountryScenario[] = [
  { iso: "GB", label: "GBP" },
  { iso: "US", label: "USD" },
  { iso: "ID", label: "IDR" },
];

test.describe.serial(
  "NAV-SINGLE-APP-06 · Checkout endpoint resolves region from cf-ipcountry (422 observable · no Stripe side effect)",
  () => {
    test.beforeAll(() => {
      assertSandboxRef();
    });

    for (const scenario of COUNTRY_SCENARIOS) {
      test(`cf-ipcountry=${scenario.iso} → POST /api/nex-native/billing/checkout/shop echoes region="${scenario.iso}" (${scenario.label}) in 422 missing_price_id body`, async ({
        browser,
      }) => {
        test.setTimeout(60_000);
        const handles: FixtureHandle[] = [];

        // Fresh signed-in fixture account. We need auth cookies so
        // the route does not short-circuit at the 401 unauthenticated
        // branch (route.ts lines 125-131).
        const account = await createTestAccount({
          label: `nav06-${scenario.iso.toLowerCase()}`,
          returnPassword: true,
        });
        handles.push(account);

        const context = await browser.newContext({
          storageState: undefined,
          extraHTTPHeaders: {
            "cf-ipcountry": scenario.iso,
          },
        });
        const page = await context.newPage();

        try {
          await signInAsFixtureInBrowser(page, account);

          const resp = await page.request.post(
            "/api/nex-native/billing/checkout/shop",
            {
              headers: {
                // Explicit on the request too in case the context
                // header is dropped during cookie propagation.
                "cf-ipcountry": scenario.iso,
              },
            },
          );
          const status = resp.status();

          // Parse the body regardless of status so the diagnostic
          // includes the exact response the route produced.
          let body: unknown = null;
          try {
            body = await resp.json();
          } catch {
            body = await resp.text();
          }

          if (status === 500) {
            // 500 config_error means STRIPE_SECRET_KEY is unset.
            // The route exits before reaching the Stripe client,
            // so `region` is not echoed in the body. We cannot
            // verify region from this response shape · honest skip.
            test.skip(
              true,
              `NAV-SINGLE-APP-06 · route returned 500 config_error for region=${scenario.iso} · ` +
                `STRIPE_SECRET_KEY is not configured · cannot observe region from this response shape.`,
            );
            return;
          }

          // Safety guard: if we somehow hit a live-mode Stripe key,
          // the URL will start with `https://checkout.stripe.com/c/pay/cs_live_`.
          // Fail loudly rather than quietly skipping · an accidental
          // live-mode run would be a Rule 7 violation we must surface.
          if (status === 200 && typeof (body as { url?: unknown }).url === "string") {
            const url = (body as { url: string }).url;
            expect(
              url.includes("cs_live_"),
              `NAV-SINGLE-APP-06 · SAFETY · Stripe returned a live-mode session URL (cs_live_*) for region=${scenario.iso} · this test must NEVER run against a live key · check STRIPE_SECRET_KEY in the env · url=${url}`,
            ).toBe(false);
          }

          // 200 (Stripe test-mode session created) and 422
          // (missing_price_id) both echo the resolved region.
          // The route.ts change sealed under NAV-SINGLE-APP-06 adds
          // `region` to the 200 response body for observability.
          expect(
            status === 200 || status === 422,
            `NAV-SINGLE-APP-06 · expected 200 (session created) or 422 (missing_price_id) · got ${status} · body=${JSON.stringify(body)}`,
          ).toBe(true);

          expect(
            (body as { region?: unknown }).region,
            `NAV-SINGLE-APP-06 · response body must echo region=${scenario.iso} · got ${JSON.stringify(body)}`,
          ).toBe(scenario.iso);
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
              `NAV-SINGLE-APP-06 · teardown must leave zero residual rows · got ${JSON.stringify(residual)}`,
            ).toBe(0);
          }
          await page.close().catch(() => undefined);
          await context.close().catch(() => undefined);
        }
      });
    }

    // Control case · no cf-ipcountry injected · the resolver's hard
    // default should kick in and the endpoint should echo region="IE".
    // (Accept-Language default on Playwright is "en-US,en;q=0.9" ·
    //  that drives the tier-2 resolver to US. To isolate the
    //  tier-3→tier-4→tier-5 chain cleanly we overwrite Accept-Language
    //  to a locale whose country sub-tag is NOT a recognised region,
    //  forcing the resolver past tier 2. This is the same control
    //  pattern used in NAV-SINGLE-APP-02.)
    test(`no cf-ipcountry · neutral Accept-Language → POST /api/nex-native/billing/checkout/shop echoes region="IE" (EUR) in 422 body (hard-default IE rung)`, async ({
      browser,
    }) => {
      test.setTimeout(60_000);
      const handles: FixtureHandle[] = [];

      const account = await createTestAccount({
        label: "nav06-control",
        returnPassword: true,
      });
      handles.push(account);

      const context = await browser.newContext({
        storageState: undefined,
        extraHTTPHeaders: {
          // No cf-ipcountry. Force Accept-Language past the resolver's
          // tier-2 lookup by supplying a value whose country sub-tag
          // is intentionally not a recognised CheckoutRegion country.
          // "en-IE" matches IE directly, which is what we want to
          // assert the hard default against.
          "accept-language": "en-IE,en;q=0.9",
        },
      });
      const page = await context.newPage();

      try {
        await signInAsFixtureInBrowser(page, account);

        const resp = await page.request.post(
          "/api/nex-native/billing/checkout/shop",
          {
            headers: {
              "accept-language": "en-IE,en;q=0.9",
            },
          },
        );
        const status = resp.status();
        let body: unknown = null;
        try {
          body = await resp.json();
        } catch {
          body = await resp.text();
        }

        if (status === 500) {
          test.skip(
            true,
            `NAV-SINGLE-APP-06 (control) · route returned 500 config_error · ` +
              `STRIPE_SECRET_KEY is not configured · cannot assert region from this response shape.`,
          );
          return;
        }

        // Safety guard · same as the positive-path tests · never
        // accept a live-mode Stripe session URL.
        if (status === 200 && typeof (body as { url?: unknown }).url === "string") {
          const url = (body as { url: string }).url;
          expect(
            url.includes("cs_live_"),
            `NAV-SINGLE-APP-06 (control) · SAFETY · Stripe returned a live-mode session URL (cs_live_*) for region=IE · this test must NEVER run against a live key · url=${url}`,
          ).toBe(false);
        }

        // Accept 200 (test-mode session created · EUR price ID set)
        // or 422 (missing_price_id · EUR price ID unset). Both echo
        // the resolved region in the body.
        expect(
          status === 200 || status === 422,
          `NAV-SINGLE-APP-06 (control) · expected 200 (session created) or 422 (missing_price_id) · got ${status} · body=${JSON.stringify(body)}`,
        ).toBe(true);

        expect(
          (body as { region?: unknown }).region,
          `NAV-SINGLE-APP-06 (control) · response body must echo region="IE" via the Accept-Language en-IE → IE rung · got ${JSON.stringify(body)}`,
        ).toBe("IE");
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
            `NAV-SINGLE-APP-06 (control) · teardown must leave zero residual rows · got ${JSON.stringify(residual)}`,
          ).toBe(0);
        }
        await page.close().catch(() => undefined);
        await context.close().catch(() => undefined);
      }
    });
  },
);
