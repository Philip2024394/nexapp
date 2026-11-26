// tests/e2e/why-nex-editorial-verification.spec.ts
//
// CYCLE 11 · C11-NEX-006 · editorial verification for /nex-native/why-nex.
// Authored 2026-11-25. Supersedes smoke-only coverage in
// smoke-why-nex.spec.ts by adding content-level honesty checks.
//
// This spec locks in what the page is contractually required to say
// based on Owner Directive 2026-11-23 (Why NEX page · "no first /
// only / best claims · label LIVE / BETA / PLANNED honestly").
//
// Observable contract (seven advantage cards, two LIVE sealed by
// owner in src/app/nex-native/why-nex/page.tsx:64-121):
//   1. Exactly 7 [data-nex-why-advantage] cards render.
//   2. Each card carries one of LIVE / BETA / PLANNED status attr.
//   3. The TWO LIVE cards MUST be the sealed pair:
//      - "Merchant-direct payments"
//      - "Flat monthly shop subscription · 0% NEX commission"
//      Any additional LIVE card is a regression (over-claim).
//   4. Every card carries a "What this does not claim:" caveat
//      block · empty caveat block == over-claim regression.
//   5. The three CTAs are present with their sealed hrefs:
//      - /nex-native/manage/shop/setup (primary = "1")
//      - /nex-native/switch
//      - /nex-native/pricing
//   6. The Honest Limits footer contains the sealed phrase
//      "nexapp.app" (domain disclosure) and does NOT claim
//      outage immunity · the exact phrase "not an outage-immunity
//      promise" is required.
//   7. The page MUST NOT contain the forbidden claim words
//      "first", "only", "best" in a user-facing assertion
//      position (checked loosely — a hard regex would fight the
//      editorial style; we only check case-insensitive word
//      boundaries on the specific over-claim patterns the owner
//      directive forbids).
//
// Caveats of this spec (what it does NOT prove):
//   * Does not run SEO/indexability checks.
//   * Does not verify the drawer actually opens from the header
//     (the header mounts the UnifiedDrawer · interaction is
//     separately owned by the drawer spec families).
//   * Does not assert pricing numbers — those come from the
//     country-detected spec which the smoke spec already covers.

import { expect, test } from "@playwright/test";

test.describe("C11-NEX-006 · Why NEX · editorial verification", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test("renders exactly 7 advantage cards with sealed LIVE pair and no over-claim", async ({
    page,
  }) => {
    const response = await page.goto("/nex-native/why-nex", {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status(), "Why NEX route returns 200").toBe(200);

    const root = page.locator("[data-nex-why-page]").first();
    await expect(root).toBeVisible({ timeout: 10_000 });

    // --- Advantage card count ---------------------------------------
    const cards = page.locator("[data-nex-why-advantage]");
    await expect(
      cards,
      "page must render exactly 7 advantage cards (owner directive 2026-11-23)",
    ).toHaveCount(7);

    // --- LIVE sealed pair -------------------------------------------
    const liveCards = page.locator('[data-nex-why-status="LIVE"]');
    await expect(
      liveCards,
      "exactly 2 LIVE cards may be present · any extra LIVE is over-claim",
    ).toHaveCount(2);
    await expect(
      liveCards.getByText(/Merchant-direct payments/i).first(),
    ).toBeVisible();
    await expect(
      liveCards
        .getByText(/Flat monthly shop subscription.+0%.+NEX commission/i)
        .first(),
    ).toBeVisible();

    // --- BETA and PLANNED presence (lower bound only) --------------
    await expect(
      page.locator('[data-nex-why-status="BETA"]'),
      "at least one BETA card is expected",
    ).not.toHaveCount(0);
    await expect(
      page.locator('[data-nex-why-status="PLANNED"]'),
      "at least one PLANNED card is expected",
    ).not.toHaveCount(0);

    // --- Caveat block on every card --------------------------------
    // Each card contains a <p> with "What this does not claim: "
    // · absence on any card is a regression.
    const caveats = page.getByText(/What this does not claim/i);
    const count = await caveats.count();
    expect(
      count,
      "every advantage card must carry a 'What this does not claim' caveat",
    ).toBeGreaterThanOrEqual(7);
  });

  test("renders the three sealed CTAs with correct hrefs", async ({ page }) => {
    await page.goto("/nex-native/why-nex", { waitUntil: "domcontentloaded" });
    const createShop = page.locator(
      '[data-nex-why-cta][data-nex-why-cta-primary="1"]',
    );
    await expect(createShop, "primary CTA must be present and marked primary=1")
      .toHaveCount(1);
    await expect(createShop).toHaveAttribute(
      "href",
      "/nex-native/manage/shop/setup",
    );

    const switchCta = page.locator('[data-nex-why-cta][href="/nex-native/switch"]');
    await expect(switchCta, "Switch calculator CTA must link to /nex-native/switch")
      .toHaveCount(1);

    const pricingCta = page.locator('[data-nex-why-cta][href="/nex-native/pricing"]');
    await expect(pricingCta, "Pricing CTA must link to /nex-native/pricing")
      .toHaveCount(1);
  });

  test("Honest limits footer declares nexapp.app domain + no outage-immunity promise", async ({
    page,
  }) => {
    await page.goto("/nex-native/why-nex", { waitUntil: "domcontentloaded" });
    const honestLimits = page.getByRole("region", { name: /Honest limits/i });
    await expect(
      honestLimits,
      "Honest limits section must be present",
    ).toBeVisible({ timeout: 5_000 });

    await expect(
      honestLimits,
      "must disclose shop URL lives on nexapp.app, not own domain",
    ).toContainText(/nexapp\.app/i);

    await expect(
      honestLimits,
      "must explicitly deny outage-immunity promise",
    ).toContainText(/not an outage-immunity promise/i);

    await expect(
      honestLimits,
      "must note that listing alone does not create traffic",
    ).toContainText(/Listing on NEX does not create traffic/i);
  });

  test("page does not make 'first / only / best' over-claims in user-facing copy", async ({
    page,
  }) => {
    await page.goto("/nex-native/why-nex", { waitUntil: "domcontentloaded" });
    const mainText =
      (await page.locator("[data-nex-why-page]").first().innerText()) ?? "";
    const normalised = mainText.toLowerCase();

    // These are the exact over-claim patterns the owner directive
    // 2026-11-23 forbids. A single-word match would fight editorial
    // style (e.g. "the only way to export…" is fine context), so
    // we test for the superlative construction the directive meant.
    const forbidden = [
      /\bthe first\b.+(platform|app|service|shop|marketplace|solution)/,
      /\bthe only\b.+(platform|app|service|shop|marketplace|solution)/,
      /\bthe best\b.+(platform|app|service|shop|marketplace|solution)/,
      /\bworld[- ]?class\b/,
      /\bunrivalled\b/,
      /\bunmatched\b/,
    ];

    for (const re of forbidden) {
      expect(
        normalised.match(re),
        `page must not include an over-claim matching ${re}`,
      ).toBeNull();
    }
  });
});
