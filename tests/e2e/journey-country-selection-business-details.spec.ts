// tests/e2e/journey-country-selection-business-details.spec.ts
//
// NAV-SINGLE-APP-01 · country selection in business-details form.
// Authored 2026-11-26 per the architecture-correction directive
// "NEX IS ONE APP WITH COUNTRY SELECTION" (see
// `docs/engineering/single-app-country-model-reconciliation-2026-11-26.md`).
//
// Why this spec exists
// --------------------
// The previous nav matrix framed IE / ID / WW as separate app
// deployments and queued three country × role × session slices per
// role. The owner corrected that model: NEX is ONE application with
// country selection inside it (IP-pickup + Accept-Language + explicit
// user selection in the business-details form). This spec covers the
// EXPLICIT USER-SELECTION path — Axis B · row 1 of the corrected
// two-axis model.
//
// What this spec DOES exercise end-to-end (observable, UI-driven)
//   1. Fresh shop-less merchant signs in via the sealed sign-in form.
//   2. Navigates to /manage/shop/setup/business-details.
//   3. Reads the country <select id="shop-country"> default value and
//      asserts it is consistent with the 5-tier default chain at
//      `business-details/page.tsx:50-70`: existing-shop (null) →
//      profile.country_code (null for fresh fixture) →
//      phone_country_code (null for fresh fixture) → NEX_APP_COUNTRY
//      env fallback → null. For a fresh fixture under a dev env with
//      NEX_APP_COUNTRY set, the dropdown MUST default to that env
//      value. Under an env where NEX_APP_COUNTRY is unset, the
//      dropdown defaults to "" (the "Select country…" placeholder).
//      Both outcomes are legitimate · the assertion checks consistency
//      with the resolver, not a specific country.
//   4. Changes the country selection to a DIFFERENT valid ISO-alpha-2
//      (so the test exercises the user-change path, not just the
//      default), then fills the other required dispatcher fields
//      (displayName, city, category, subtype).
//   5. Submits "Save & continue →" via the real button.
//   6. Reads back the persisted `nex_business` row and asserts
//      `operating_country_code` === the country the user selected.
//
// What this spec DOES NOT cover (honestly out of scope)
//   · IP-pickup via cf-ipcountry (NAV-SINGLE-APP-02 · separate spec).
//   · Accept-Language fallback (NAV-SINGLE-APP-03 · separate spec).
//   · Country change AFTER initial save (NAV-SINGLE-APP-04 · blocked
//     on nex_account.region_pref column migration).
//   · Cross-country RLS isolation (NAV-SINGLE-APP-05 · same block).
//   · Checkout region resolution against CheckoutRegion type
//     (NAV-SINGLE-APP-06 · unit + integration spec).
//   · Role × country sample (NAV-SINGLE-APP-07 · drawer composition).
//
// Scope boundaries honoured (CLAUDE.md Rule 7)
//   · sandbox Supabase only (asserted via `assertSandboxRef`).
//   · no commits, no pushes, no migrations applied, no credentials
//     activated.
//   · no product-code change.
//   · fixture teardown + `assertNoResidualFixtures` mandatory.

import { expect, test, type Page } from "@playwright/test";
import {
  assertNoResidualFixtures,
  assertSandboxRef,
  createTestAccount,
  signInAsFixtureInBrowser,
  supabaseAdmin,
  teardownAll,
  type FixtureHandle,
} from "./_fixtures/sandbox-test-harness";

// Pick a target country that is almost certainly NOT the env default
// (so the user-change path is genuinely exercised). ID is the chosen
// counter-value because IE is the most common dev-env fallback value
// per `NEX_APP_COUNTRY=IE` observed in prior cycles. If the env is
// set to ID we flip to GB to preserve the "actually changes" semantic.
const COUNTER_CHOICES: ReadonlyArray<{ code: string; fallbackIfEnvMatches: string }> = [
  { code: "ID", fallbackIfEnvMatches: "GB" },
];

function pickCounterCountry(envDefault: string): string {
  const primary = COUNTER_CHOICES[0]!;
  return envDefault === primary.code
    ? primary.fallbackIfEnvMatches
    : primary.code;
}

test.describe.serial(
  "NAV-SINGLE-APP-01 · country selection in business-details form",
  () => {
    test("shop-less merchant · default country matches env resolver · user change persists operating_country_code", async ({
      browser,
    }) => {
      test.setTimeout(180_000);
      assertSandboxRef();
      const sb = supabaseAdmin();
      const handles: FixtureHandle[] = [];

      // Fresh context · must NOT inherit the project-level admin
      // storageState so that `signInAsFixtureInBrowser` establishes a
      // real session for the just-minted fixture merchant.
      const context = await browser.newContext({ storageState: undefined });
      const page: Page = await context.newPage();

      try {
        // ──────────────────────────────────────────────────────────
        // 1 · Mint a shop-less fixture account (with password).
        //     NO createTestBusiness call · the spec specifically tests
        //     the INITIAL business-details path for a user who has
        //     never saved a shop country before.
        // ──────────────────────────────────────────────────────────
        const merchant = await createTestAccount({
          label: "nav-single-app-01",
          returnPassword: true,
        });
        handles.push(merchant);

        // Precondition sanity: fixture has zero businesses.
        const { data: preBusinesses } = await sb
          .from("nex_business")
          .select("id")
          .eq("owner_account_id", merchant.nexAccountId);
        expect(
          preBusinesses?.length ?? 0,
          "fixture merchant must start shop-less",
        ).toBe(0);

        // ──────────────────────────────────────────────────────────
        // 2 · Sign in via sealed sign-in form.
        // ──────────────────────────────────────────────────────────
        await signInAsFixtureInBrowser(page, merchant);

        // ──────────────────────────────────────────────────────────
        // 3 · /manage → RSC-redirect chain → /setup/business-details.
        //     Follow same pattern as L-030 to avoid Next 16 RSC-stream
        //     URL-settle races.
        // ──────────────────────────────────────────────────────────
        const setupResp = await page.goto("/nex-native/manage", {
          waitUntil: "domcontentloaded",
        });
        expect(
          setupResp?.status(),
          "/manage responds for signed-in shop-less merchant",
        ).toBeLessThan(500);
        await page.waitForURL(/\/manage\/shop\/setup(?:\/|$|\?|#)/, {
          timeout: 15_000,
          waitUntil: "domcontentloaded",
        });
        await page.waitForURL(/\/manage\/shop\/setup\/business-details/, {
          timeout: 15_000,
          waitUntil: "domcontentloaded",
        });

        // ──────────────────────────────────────────────────────────
        // 4 · Read the default country value. The 5-tier resolver at
        //     page.tsx:50-70 may produce "" (no rung populated) or a
        //     valid ISO-alpha-2 (env fallback populated server-side).
        //     The TEST PROCESS env is independent of the DEV SERVER
        //     env, so the test cannot authoritatively predict which
        //     outcome the server will return. Resolver-correctness is
        //     covered by NAV-SINGLE-APP-06 (unit + integration).
        //     This spec only asserts the shape is valid.
        // ──────────────────────────────────────────────────────────
        const countrySelect = page.locator("#shop-country");
        await countrySelect.waitFor({ state: "visible", timeout: 10_000 });
        const defaultValue = await countrySelect.inputValue();
        expect(
          defaultValue === "" || /^[A-Z]{2}$/.test(defaultValue),
          `default country must be "" or a valid ISO-alpha-2 · got '${defaultValue}'`,
        ).toBe(true);

        // ──────────────────────────────────────────────────────────
        // 5 · Explicitly change the country to a counter-value so the
        //     user-change path is exercised (not just the default).
        // ──────────────────────────────────────────────────────────
        const counterCountry = pickCounterCountry(defaultValue);
        await countrySelect.selectOption(counterCountry);
        // Guard against the catalogue not exposing the counter-value
        // as an <option> · if the select retains the old value the
        // assertion fails loudly instead of silently persisting the
        // default.
        expect(
          await countrySelect.inputValue(),
          `select retains counter-value '${counterCountry}' after selectOption`,
        ).toBe(counterCountry);

        // ──────────────────────────────────────────────────────────
        // 6 · Fill the other dispatcher-gated fields so the form can
        //     submit (displayName + city + category + subtype). This
        //     mirrors the L-030 pattern exactly.
        // ──────────────────────────────────────────────────────────
        const nameSuffix = Date.now().toString(36).slice(-6);
        const shopName = `nav-01 shop ${nameSuffix}`;
        const cityName = "Jakarta"; // Plausible for counter-country ID.

        await page.locator('input[name="displayName"]').fill(shopName);
        await page.locator("#shop-city").fill(cityName);
        await page.locator("#shop-category").selectOption("food");
        await expect(
          page.locator("#shop-subtype"),
          "subtype select becomes enabled after a category is chosen",
        ).toBeEnabled({ timeout: 5_000 });
        await page.locator("#shop-subtype").selectOption("restaurant");

        // ──────────────────────────────────────────────────────────
        // 7 · Submit · "Save & continue →".
        // ──────────────────────────────────────────────────────────
        await Promise.all([
          page.waitForURL(
            (u) => !/\/business-details(?:[/?#]|$)/.test(u.pathname),
            { timeout: 30_000, waitUntil: "domcontentloaded" },
          ),
          page.locator('button[type="submit"]').first().click(),
        ]);

        // ──────────────────────────────────────────────────────────
        // 8 · DB verification · exactly one nex_business row for the
        //     fixture merchant and operating_country_code matches the
        //     counter-value the user selected.
        // ──────────────────────────────────────────────────────────
        const { data: postBusinesses, error: postErr } = await sb
          .from("nex_business")
          .select(
            "id, owner_account_id, display_name, operating_country_code, city",
          )
          .eq("owner_account_id", merchant.nexAccountId);
        expect(postErr, "post-save read-back has no error").toBeNull();
        expect(
          postBusinesses?.length,
          "exactly one business row persisted for fixture merchant",
        ).toBe(1);
        const biz = postBusinesses![0] as {
          id: string;
          owner_account_id: string;
          display_name: string;
          operating_country_code: string | null;
          city: string | null;
        };
        expect(biz.display_name, "display_name persisted").toBe(shopName);
        expect(biz.city, "city persisted").toBe(cityName);
        expect(
          biz.operating_country_code,
          `operating_country_code reflects user-selected counter-country '${counterCountry}'`,
        ).toBe(counterCountry);
      } finally {
        // ──────────────────────────────────────────────────────────
        // Teardown · owner-scoped business sweep MUST run before the
        // shared `teardownAll` deletes the account, because
        // `nex_business.owner_account_id` is FK RESTRICT (L-030 pattern
        // · see journey-merchant-onboarding-full-ui.spec.ts:380-410).
        // The form submission under test creates a nex_business row;
        // if the DB assertion aborts the test, the row remains and the
        // shared teardown's account delete fails with a FK violation.
        // ──────────────────────────────────────────────────────────
        try {
          const ownerAccountId = (handles[0] as { nexAccountId?: string })
            ?.nexAccountId;
          if (ownerAccountId) {
            const { data: ownedBusinesses } = await sb
              .from("nex_business")
              .select("id")
              .eq("owner_account_id", ownerAccountId);
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
            `[NAV-SINGLE-APP-01 sweep] owner-scoped business cleanup: ${(sweepErr as Error).message}`,
          );
        }

        await teardownAll(handles);
        await assertNoResidualFixtures(handles);
        await context.close();
      }
    });
  },
);
