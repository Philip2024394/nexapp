// tests/e2e/smoke-why-nex.spec.ts
//
// NEX-006 · smoke verification for /nex-native/why-nex · 2026-11-25.
// Authored under Founder Decision 2 (2026-11-25) which authorised a
// smoke test on the Why NEX surface independently of Ask Seller.
//
// Observable contract:
//   1. Route returns 200.
//   2. Server-rendered root marker [data-nex-why-page] is visible.
//   3. At least one honesty-labelled advantage card is rendered
//      ([data-nex-why-advantage]), AND at least one carries status
//      "LIVE" — the Founder-sealed directive 2026-11-23 requires LIVE
//      capabilities to be visibly labelled so no-one mistakes the
//      page for a universal claims list.
//   4. The sealed Switch-calculator cross-link renders
//      ([data-nex-why-cta] whose href resolves to /nex-native/switch).
//
// What this spec DOES NOT do:
//   · Does not assert exact copy (copy is editorial · owner-owned).
//   · Does not interact with the drawer (its own contract has its
//     own tests under stage-a-pixel7).
//   · Does not validate conversion numbers · the page by design
//     carries no fabricated figures.
//
// Classification: SMOKE · route-reachability + sealed marker surface.

import { expect, test } from "@playwright/test";

test.describe("NEX-006 · Why NEX · public smoke", () => {
  test("public route renders sealed markers + LIVE advantage + Switch cross-link", async ({
    page,
    context,
  }) => {
    await context.clearCookies();

    const response = await page.goto("/nex-native/why-nex", {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status(), "/nex-native/why-nex returns 200").toBe(200);

    const root = page.locator("[data-nex-why-page]").first();
    await expect(root, "Why NEX page root marker renders").toBeVisible({
      timeout: 10_000,
    });

    const advantages = page.locator("[data-nex-why-advantage]");
    await expect
      .poll(() => advantages.count(), { timeout: 5_000 })
      .toBeGreaterThan(0);

    const liveAdvantage = page
      .locator('[data-nex-why-advantage][data-nex-why-status="LIVE"]')
      .first();
    await expect(
      liveAdvantage,
      "at least one advantage is labelled LIVE per the sealed honesty directive",
    ).toBeVisible();

    // The Switch cross-link is the sealed exit to the savings calculator.
    const switchCta = page
      .locator('[data-nex-why-cta][href="/nex-native/switch"]')
      .first();
    await expect(
      switchCta,
      "Switch-calculator CTA links to /nex-native/switch",
    ).toBeVisible();
  });
});
