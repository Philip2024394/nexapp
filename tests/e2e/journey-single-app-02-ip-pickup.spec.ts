// tests/e2e/journey-single-app-02-ip-pickup.spec.ts
//
// NAV-SINGLE-APP-02 · IP-pickup via cf-ipcountry (and x-vercel-ip-country)
// ------------------------------------------------------------------------
// Companion to NAV-SINGLE-APP-07 (role × country sample · merchant with
// `last_known_country_iso` DB column drives currency label).  This spec
// covers the IP-header rung of the in-app country resolution ·
// specifically that a GUEST request (no account, no account preference,
// no localStorage override) correctly picks up the inbound edge geo
// header and renders the matching currency on the pricing surface.
//
// Why this is observable WITHOUT any migration
// --------------------------------------------
// `src/app/nex-native/pricing/page.tsx:61-85` (`detectCountryFromHeaders`)
// reads `x-vercel-ip-country` first, then `cf-ipcountry`.  For a guest
// request, the pricing page falls through to that IP detection on first
// paint (lines 91-100 of the same file), so the IP header is the sole
// driver of the rendered currency.  The surface emits:
//
//   · `[data-nex-pricing-page]`                           — composition
//   · `[data-nex-pricing-detected-country=<ISO>]` on main  — server
//     received and processed the header value
//   · `[data-nex-pricing-shop-card]`                      — composition
//   · `[data-nex-pricing-shop-price]` → spec.priceShort   — the test
//     observable
//
// `spec.priceShort` resolves via `_pricing-data.ts:39-44`:
//
//   IE → "€4.99"       (EUR representative for the EU/EEA bloc)
//   GB → "£4.99"
//   US → "US$4.99"
//   ID → "Rp 89,000"
//
// Scope boundaries
// ----------------
// This spec does NOT prove:
//   · the business-details country submit path (NAV-SINGLE-APP-01 ·
//     blocked on mig 286 sandbox apply)
//   · the Accept-Language fallback (NAV-SINGLE-APP-03 · companion spec)
//   · the account-country-preference tier (NAV-SINGLE-APP-07 · already
//     VERIFIED as L-047 via `nex_account.last_known_country_iso`)
//   · the checkout-region currency correctness at order-creation time
//     (NAV-SINGLE-APP-06 · a separate observable — pricing surface
//     displays a suggestion-only price, not a legally binding charge)
//
// Boundaries honoured per Rule 7
//   · No product-code change (spec-only addition).
//   · No migration applied.
//   · No fixture seeded — the spec uses fresh guest contexts with
//     storageState: undefined and injects the IP header via
//     `extraHTTPHeaders` on the context.  Nothing to teardown.
//   · No real network to a live edge provider — the header is injected
//     client-side by Playwright and read by the Next server at SSR.
//
// Classification: NAV COVERAGE SPEC · exercises the real server-side IP
// header path of the pricing surface under three distinct IP countries
// plus an unset control to prove the hard-default rung.

import { expect, test } from "@playwright/test";
import { assertSandboxRef } from "./_fixtures/sandbox-test-harness";

// Keep the resolution deterministic: the pricing page's local resolver
// (`detectCountryFromHeaders`) does NOT consider Accept-Language, so
// Playwright's default `en-US,en;q=0.9` has no effect on /pricing.  That
// orthogonality is what makes this spec a clean NAV-SINGLE-APP-02
// observable rather than an entangled -02/-03 mix.

interface Scenario {
  readonly iso: "GB" | "US" | "ID";
  readonly symbol: string;
  readonly label: string;
  readonly notSymbol: string;
}

const IP_PICKUP_SCENARIOS: readonly Scenario[] = [
  { iso: "GB", symbol: "£", label: "GBP", notSymbol: "€" },
  { iso: "US", symbol: "US$", label: "USD", notSymbol: "€" },
  { iso: "ID", symbol: "Rp", label: "IDR", notSymbol: "€" },
];

test.describe(
  "NAV-SINGLE-APP-02 · IP-pickup via cf-ipcountry drives guest pricing-page currency",
  () => {
    test.beforeAll(() => {
      assertSandboxRef();
    });

    for (const scenario of IP_PICKUP_SCENARIOS) {
      test(`cf-ipcountry=${scenario.iso} → guest pricing page renders ${scenario.label} symbol '${scenario.symbol}'`, async ({
        browser,
      }) => {
        test.setTimeout(60_000);

        // Fresh guest context · storageState: undefined means no auth
        // cookies, no account-country, no localStorage override.  The
        // pricing page therefore falls through to IP detection.
        const context = await browser.newContext({
          storageState: undefined,
          extraHTTPHeaders: {
            // Lower-case header name — Playwright normalises header
            // names to lower-case on the wire regardless of casing
            // here.  The Next server reads via `headers().get(name)`
            // which is itself case-insensitive.
            "cf-ipcountry": scenario.iso,
          },
        });
        const page = await context.newPage();

        try {
          // Next 16 dev-mode streams RSC content continuously (HMR
          // polling), so `networkidle` never settles.  Use
          // `domcontentloaded` and rely on the explicit `toBeVisible`
          // below for the real signal.
          const response = await page.goto("/nex-native/pricing", {
            waitUntil: "domcontentloaded",
          });
          const status = response?.status() ?? 0;
          expect(
            status,
            `NAV-SINGLE-APP-02 · /nex-native/pricing must respond <500 · got ${status}`,
          ).toBeLessThan(500);

          // Composition: the pricing page container renders.
          await expect(
            page.locator("[data-nex-pricing-page]").first(),
            "NAV-SINGLE-APP-02 · [data-nex-pricing-page] must mount",
          ).toBeVisible({ timeout: 15_000 });

          // Server-side receipt: the main element carries the detected
          // country ISO as a data attribute.  This confirms the server
          // actually received the cf-ipcountry header and processed it
          // through `detectCountryFromHeaders`.
          await expect(
            page
              .locator(`[data-nex-pricing-detected-country="${scenario.iso}"]`)
              .first(),
            `NAV-SINGLE-APP-02 · server must detect country=${scenario.iso} from cf-ipcountry`,
          ).toBeVisible({ timeout: 10_000 });

          // Composition: the shop card renders.
          await expect(
            page.locator("[data-nex-pricing-shop-card]").first(),
            `NAV-SINGLE-APP-02 · pricing shop card must mount under ${scenario.iso}`,
          ).toBeVisible({ timeout: 10_000 });

          // Country-dependent value: the expected currency symbol
          // appears in the shop price.
          const priceText =
            (await page
              .locator("[data-nex-pricing-shop-price]")
              .first()
              .innerText()) ?? "";
          expect(
            priceText,
            `NAV-SINGLE-APP-02 · ${scenario.iso} shop price must contain '${scenario.symbol}' · got '${priceText}'`,
          ).toContain(scenario.symbol);

          // Negative assertion: the price must NOT contain the EUR
          // symbol under GB/US/ID.  This guards against a regression
          // where the IP header is ignored and the page silently
          // falls through to the hard-default IE rung.
          expect(
            priceText,
            `NAV-SINGLE-APP-02 · ${scenario.iso} shop price must NOT contain '${scenario.notSymbol}' · got '${priceText}'`,
          ).not.toContain(scenario.notSymbol);
        } finally {
          await page.close().catch(() => undefined);
          await context.close().catch(() => undefined);
        }
      });
    }

    // Control case: no edge geo header, no account, no localStorage.
    // The pricing page should fall through to the hard-default IE
    // rung and render the EUR symbol.  This proves the IP-pickup tier
    // is genuinely DRIVING the flip above, not an incidental artefact
    // of the Playwright default.
    test("no cf-ipcountry → guest pricing page renders EUR symbol (hard-default IE)", async ({
      browser,
    }) => {
      test.setTimeout(60_000);

      const context = await browser.newContext({
        storageState: undefined,
        // No `cf-ipcountry` / `x-vercel-ip-country` injected.
      });
      const page = await context.newPage();

      try {
        const response = await page.goto("/nex-native/pricing", {
          waitUntil: "domcontentloaded",
        });
        const status = response?.status() ?? 0;
        expect(
          status,
          `NAV-SINGLE-APP-02 (control) · /nex-native/pricing must respond <500 · got ${status}`,
        ).toBeLessThan(500);

        await expect(
          page.locator("[data-nex-pricing-page]").first(),
          "NAV-SINGLE-APP-02 (control) · [data-nex-pricing-page] must mount",
        ).toBeVisible({ timeout: 15_000 });

        await expect(
          page.locator("[data-nex-pricing-shop-card]").first(),
          "NAV-SINGLE-APP-02 (control) · pricing shop card must mount",
        ).toBeVisible({ timeout: 10_000 });

        const priceText =
          (await page
            .locator("[data-nex-pricing-shop-price]")
            .first()
            .innerText()) ?? "";
        expect(
          priceText,
          `NAV-SINGLE-APP-02 (control) · no-header shop price must contain '€' · got '${priceText}'`,
        ).toContain("€");
      } finally {
        await page.close().catch(() => undefined);
        await context.close().catch(() => undefined);
      }
    });
  },
);
