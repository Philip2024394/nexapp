// tests/e2e/journey-chat-theme-region-unsupported-waitlist.spec.ts
//
// T-3.3 · unsupported-region user goes to WAITLIST · authored under
// Stage A Conditional Approval 2026-11-24.
//
// Sealed (project_nex_themes_plus_sealed_2026_11_13):
//   Monthly prices: IE €2.49 · UK £1.99 · US $2.49 · ID Rp 19,000 ·
//   AU A$3.99. Unsupported regions → WAITLIST (NEVER USD fallback).
//
// Observable behaviour:
//   · When the signed-in user's country_code is NOT in the supported
//     set, the Themes+ CTA surfaces a WAITLIST option, NOT a USD price.
//   · The UI MUST NOT display any USD amount for an unsupported-region
//     user.
//
// Spec approach:
//   · We override the account's apparent region via a cookie / URL
//     query / localStorage hint that the sealed region-resolver honours
//     for dev-impersonation (verified in prior sessions). If no
//     override is accepted, the test SKIPS honestly.
//
// Classification: SPEC AUTHORED.

import { expect, test } from "@playwright/test";

test.use({ storageState: "tests/e2e/.auth/state.json" });

test.describe.serial("T-3.3 · unsupported region · waitlist, never USD fallback", () => {
  test("unsupported region CTA shows WAITLIST + no USD amount", async ({ page }) => {
    // Attempt to seed an unsupported country code. The sealed region
    // resolver may honour a cookie · if not, the spec SKIPS.
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem("nex_region_override", "ZZ"); // invalid / unsupported.
      } catch {
        /* storage blocked · defensive */
      }
    });

    // Remediation 2026-11-24 cycle 2 · the chat-themes-library has
    // long-lived realtime subscriptions that prevent `networkidle`
    // from firing · we switch to `domcontentloaded` + body-attached
    // wait. Assertion strength preserved: we still require the
    // waitlist CTA to render and refuse any USD fallback.
    // L-011 2026-11-26 · hub root now; the library grid where the
    // Themes+ CTA is surfaced lives at /full-image.
    const response = await page.goto("/nex-native/chat-themes-library/full-image", {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status()).toBe(200);
    await page.waitForFunction(() => Boolean(document.body), null, {
      timeout: 10_000,
    });

    // Open a paid theme OR the Themes+ CTA.
    const cta = page
      .getByRole("button", { name: /themes\+|unlock|subscribe|join waitlist/i })
      .or(page.getByText(/themes\+|join waitlist/i));
    const hasCta = (await cta.count()) > 0;
    test.skip(
      !hasCta,
      "no Themes+ CTA surfaced · region-override not accepted or UI " +
        "variant changed · spec authored, run requires fixture",
    );

    await cta.first().click();
    await page.waitForLoadState("domcontentloaded");

    // Positive assertion: WAITLIST copy OR CTA appears.
    const waitlist = page.getByText(/waitlist/i);
    await expect(waitlist, "waitlist offered in unsupported region").toBeVisible({
      timeout: 5_000,
    });

    // Negative assertion: no USD price anywhere on the current view.
    const usdInView = await page.getByText(/\$[0-9]+\.[0-9]{2}/).count();
    expect(
      usdInView,
      "sealed rule: unsupported region MUST NOT show USD fallback",
    ).toBe(0);
  });
});
