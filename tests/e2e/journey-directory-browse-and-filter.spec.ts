// tests/e2e/journey-directory-browse-and-filter.spec.ts
//
// T-4.6 part 1 · buyer directory browse + filter · authored under Stage A
// Conditional Approval 2026-11-24.
//
// Observable behaviour under test:
//   · /nex-native/directory responds 200 for a signed-out visitor.
//   · The directory surface renders at least one business card OR a
//     documented empty-state message (never a crash).
//   · A category/search filter surface is present and interactive.
//   · Tapping a business card navigates to a `[businessSlug]` route
//     without requiring sign-in (per sealed public-buyer-discovery).
//
// NOT asserted here:
//   · Buyer purchase flow (that is signed-out-browse-buy-auth-gate).
//   · Signed-in merchant moderation.
//   · Row counts against Supabase.
//
// Dependencies: dev server at :3008; /directory and [businessSlug]
// routes present (confirmed in src/app/nex-native/directory/page.tsx
// and src/app/nex-native/[businessSlug]/page.tsx).
//
// Classification: SPEC AUTHORED on file creation.

import { expect, test } from "@playwright/test";

// Founder directive 2026-11-24 Cycle 4 · the public Directory is
// intentionally hidden until the 500-active-seller launch threshold is
// reached (configurable; not hardcoded). Every test in this file is
// DEFERRED while that state holds. The test bodies remain intact so
// that when the Directory re-opens the describe-level deferral can be
// lifted without re-authoring the spec. Per Cycle 4 §3: "The
// Directory-specific browse/filter test should be marked as
// intentionally deferred while public discovery is hidden."
const DIRECTORY_DEFERRED_REASON =
  "DEFERRED-WHILE-DIRECTORY-HIDDEN · public Directory discovery is " +
  "intentionally hidden until the configurable active-seller launch " +
  "threshold (initial 500) is reached · remove this skip once the " +
  "Directory re-opens";

test.describe.serial("T-4.6 · directory browse + filter (signed-out)", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
    // Describe-wide deferral · Playwright evaluates this per-test and
    // skips with the sealed reason until the Directory re-opens.
    test.skip(true, DIRECTORY_DEFERRED_REASON);
  });

  test("directory landing responds 200 and renders a list surface", async ({ page }) => {
    // Remediation 2026-11-24 · /directory keeps long-lived connections
    // (realtime presence hints) that stop `networkidle` firing. We wait
    // for DOM parsed and for the <main> region (the observable anchor
    // for "the directory landing has rendered"). Assertion strength
    // unchanged.
    const response = await page.goto("/nex-native/directory", {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status(), "/directory responds 200").toBe(200);

    // The sealed directory surface exposes a landing list. Observable
    // check: the main region exists and contains either business cards
    // or a well-documented empty state.
    const main = page.locator("main, [role='main']").first();
    await expect(main, "main region renders").toBeVisible({ timeout: 10_000 });

    // At least one of: a business card anchor, or an empty-state text.
    const cards = page.locator(
      "a[href^='/nex-native/'][data-nex-business-card], a[href*='/nex-native/'][class*='business']",
    );
    const hasCards = (await cards.count()) > 0;
    const emptyHint = await page
      .getByText(/no (shops|businesses|results)|coming soon|empty/i)
      .count();

    expect(
      hasCards || emptyHint > 0,
      "directory renders business cards OR a documented empty state",
    ).toBe(true);
  });

  test("search / filter affordance is present and interactive", async ({ page }) => {
    await page.goto("/nex-native/directory", { waitUntil: "domcontentloaded" });
    await page
      .locator("main, [role='main']")
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });

    // Observable: a search input or filter chips must be reachable.
    // We don't require a specific selector shape · the owner's sealed
    // directory landing may expose either depending on viewport.
    const searchInput = page.locator(
      'input[type="search"], input[placeholder*="Search" i], input[aria-label*="search" i]',
    );
    const filterChip = page.getByRole("button", { name: /filter|sort|category|near me/i });

    const hasSearch = (await searchInput.count()) > 0;
    const hasFilter = (await filterChip.count()) > 0;
    expect(
      hasSearch || hasFilter,
      "directory exposes a search input OR a filter affordance",
    ).toBe(true);

    if (hasSearch) {
      const input = searchInput.first();
      await input.fill("coffee");
      // Observable: after input, the URL OR the DOM reflects the query.
      // We assert the input retains the value · stronger assertions
      // (results count) require real seeded data.
      await expect(input).toHaveValue("coffee");
    }
  });

  test("tapping a business card navigates to a [businessSlug] route (no sign-in bounce)", async ({
    page,
  }) => {
    await page.goto("/nex-native/directory", { waitUntil: "domcontentloaded" });
    await page
      .locator("main, [role='main']")
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });

    const firstCard = page
      .locator("a[href*='/nex-native/']:not([href*='/directory']):not([href*='/sign-in'])")
      .first();
    const cardCount = await firstCard.count();

    // BLOCKED-PENDING-SEED-DATA: if sandbox has no seeded businesses,
    // this test is a no-op. We document the condition honestly rather
    // than weakening the assertion.
    test.skip(
      cardCount === 0,
      "no business cards present in sandbox directory · reseed and rerun",
    );

    const href = await firstCard.getAttribute("href");
    expect(href, "card points to a non-directory route").not.toContain("/directory");
    expect(href, "card does not force sign-in").not.toContain("/sign-in");

    await firstCard.click();
    await page.waitForLoadState("domcontentloaded");

    // After navigation, we should NOT be on /sign-in · the sealed
    // public-buyer-discovery allows anonymous browse.
    await expect(page).not.toHaveURL(/\/nex-native\/sign-in(?:[/?#]|$)/);
  });
});
