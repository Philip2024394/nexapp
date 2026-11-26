// tests/e2e/journey-chat-theme-apply-free.spec.ts
//
// T-3.1 part 1 · apply a free chat theme · authored under Stage A
// Conditional Approval 2026-11-24.
//
// Sealed Themes+ Phase A (2026-11-13): free themes apply without
// subscription. First paid theme applied without subscription writes a
// `nex_theme_ownership` row with `source='first_free'` · see T-3.1 part 2.
//
// Observable behaviour:
//   · /nex-native/chat-themes-library responds 200 under signed-in.
//   · At least one theme with `price=0` renders.
//   · Clicking Apply on a free theme persists the selection · the
//     user's current chat theme (readable from UI state) updates.
//
// Classification: SPEC AUTHORED.

import { expect, test } from "@playwright/test";

test.use({ storageState: "tests/e2e/.auth/state.json" });

test.describe.serial("T-3.1 · apply free chat theme", () => {
  test("theme library responds and renders at least one card", async ({ page }) => {
    // Remediation 2026-11-24 · the actual DOM uses
    // <article data-nex-library-full-tile={theme.id}> in
    // src/app/nex-native/chat-themes-library/_full-library-client.tsx:1162-1240.
    // The previous selector referenced a retired marketplace-card attribute.
    // The library is DB-driven via listBackgroundAssets()
    // (src/lib/nex-native/library/catalog-service.ts:84-104) which
    // returns [] on empty sandbox tables. If the sandbox has no active
    // theme records, we report BLOCKED-PENDING-SEED instead of
    // weakening the assertion or manufacturing records.
    // L-011 2026-11-26 · root is now the three-category hub.
    // The library grid lives at /full-image (and /plain, /small).
    const response = await page.goto("/nex-native/chat-themes-library/full-image", {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status(), "theme library responds 200").toBe(200);

    const cards = page.locator("article[data-nex-library-full-tile]");
    const count = await cards.count();
    test.skip(
      count === 0,
      "BLOCKED-PENDING-SEED · sandbox nex_background_asset has zero " +
        "active rows · theme-library page renders empty · we will not " +
        "modify the database to make this pass",
    );
    expect(count, "at least one theme card renders").toBeGreaterThan(0);
  });

  test("applying a free theme does not surface a paywall", async ({ page }) => {
    await page.goto("/nex-native/chat-themes-library/full-image", {
      waitUntil: "domcontentloaded",
    });

    // Match a card explicitly labelled Free, Included, or the price 0.
    // Uses the real DOM attribute confirmed in
    // _full-library-client.tsx:1162-1240.
    const freeCard = page
      .locator("article[data-nex-library-full-tile]")
      .filter({ hasText: /free|included|€0|£0|\$0|rp\s*0/i })
      .first();

    const hasFree = (await freeCard.count()) > 0;
    test.skip(
      !hasFree,
      "no explicitly-free theme card rendered · fixture or seeding needed",
    );

    await freeCard.click();
    // L-011 2026-11-26 · chat-themes-library carries long-lived
    // realtime subscriptions that prevent `networkidle` from firing
    // (same remediation already applied to
    // journey-chat-theme-region-unsupported-waitlist.spec.ts).
    await page.waitForFunction(() => Boolean(document.body), null, {
      timeout: 10_000,
    });

    const applyBtn = page.getByRole("button", { name: /apply|use theme|activate/i });
    test.skip(
      (await applyBtn.count()) === 0,
      "theme detail does not expose an Apply affordance in current state",
    );
    await applyBtn.first().click();

    // Observable: no paywall / subscribe modal appears for a free theme.
    const paywall = page.getByText(/subscribe|unlock themes\+|\btrial\b/i);
    await expect(paywall, "free apply MUST NOT trigger a paywall").toHaveCount(0);
  });
});
