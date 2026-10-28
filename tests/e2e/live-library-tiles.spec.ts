// tests/e2e/live-library-tiles.spec.ts
//
// Owner directive 2026-10-27 · "ok add and lets also build and the
// files for the features complete build tested working flow" ·
// end-to-end coverage for the 3-tile set that replaced the previous
// 4-tile (Live/Record/Draft/Insights) Creator Loop:
//
//   · Go Live  → /nex-native/live-commerce/welcome
//   · Create   → /nex-native/manage/watches/new (Stage A redesign
//                 2026-10-28 · was /live-commerce/create)
//   · Studio   → /nex-native/live-commerce/studio
//
// This test proves the shape of the control panel + the real routing
// for the two new surfaces. The Live Welcome route is already covered
// by the existing live-commerce visual-verify suite.

import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 412, height: 915 } });

const HENDRA = "http://localhost:3008/nex-native/dev/live-persona/hendra";

async function openLibrary(page: import("@playwright/test").Page): Promise<void> {
  // Wait for the Hendra page to settle · the dev server occasionally
  // emits the author avatar before the `isBroadcasterPreview` state
  // flips to true, which drops the `onAuthorAvatarPress` handler and
  // leaves the avatar non-pressable. Wait on the explicit pressable
  // attribute so the click lands only after the broadcaster-preview
  // path is live.
  await page.goto(HENDRA, { waitUntil: "networkidle" });
  const avatar = page.locator(
    '[data-nex-live-footer-author][data-nex-live-footer-author-pressable="true"]',
  );
  await avatar.waitFor({ state: "visible", timeout: 10_000 });
  // `force: true` sidesteps any inflight pointer-handler races in the
  // viewer-main swipe tracker that mounts siblings around the avatar.
  await avatar.click({ force: true });
  await expect(
    page.locator("[data-nex-broadcaster-library-sheet]"),
  ).toBeVisible({ timeout: 7000 });
}

test.describe("Live Library · 3-tile control panel", () => {
  test("renders Go Live + Create + Studio tiles · no retired Record/Draft/Insights", async ({ page }) => {
    await openLibrary(page);

    const tiles = page.locator("[data-nex-broadcaster-library-footer-btn]");
    await expect(tiles).toHaveCount(3);

    const live = page.locator('[data-nex-broadcaster-library-footer-btn="live"]');
    const create = page.locator('[data-nex-broadcaster-library-footer-btn="create"]');
    const studio = page.locator('[data-nex-broadcaster-library-footer-btn="studio"]');

    await expect(live).toBeVisible();
    await expect(create).toBeVisible();
    await expect(studio).toBeVisible();

    await expect(live).toHaveText(/Go Live/);
    await expect(create).toHaveText(/Create/);
    await expect(studio).toHaveText(/Studio/);

    // Retired tiles must not render.
    await expect(
      page.locator('[data-nex-broadcaster-library-footer-btn="record"]'),
    ).toHaveCount(0);
    await expect(
      page.locator('[data-nex-broadcaster-library-footer-btn="draft"]'),
    ).toHaveCount(0);
    await expect(
      page.locator('[data-nex-broadcaster-library-footer-btn="insights"]'),
    ).toHaveCount(0);
  });

  test("Create tile routes to /nex-native/create and the 5-card entry renders", async ({ page }) => {
    // Owner directive 2026-10-28 · Gate 7 Option 1 · the Library Create
    // tile is now the entry point to the 5-card NEX Create page. Only
    // Card A (Go Live) is functional · Cards B-E are Coming soon
    // placeholders. The Watches route stays reachable via its own URL
    // and via Card B once Phase 5 ships (not yet).
    await openLibrary(page);
    await page.locator('[data-nex-broadcaster-library-footer-btn="create"]').click();

    await expect(page).toHaveURL(/\/nex-native\/create$/, { timeout: 7000 });
    await expect(page.locator("[data-nex-create-page]")).toBeVisible();
    await expect(page.locator("[data-nex-create-grid]")).toBeVisible();

    // All five cards render.
    for (const cardId of [
      "go-live",
      "product-video",
      "entertainment-video",
      "image",
      "music",
    ]) {
      await expect(
        page.locator(`[data-nex-create-card="${cardId}"]`),
      ).toBeVisible();
    }

    // Card A is the only enabled card.
    await expect(
      page.locator('[data-nex-create-card="go-live"][data-nex-create-card-enabled="true"]'),
    ).toBeVisible();
    for (const cardId of [
      "product-video",
      "entertainment-video",
      "image",
      "music",
    ]) {
      await expect(
        page.locator(`[data-nex-create-card="${cardId}"][data-nex-create-card-enabled="false"]`),
      ).toBeVisible();
    }

    // Card A has a real Link to the Go Live welcome route.
    await expect(
      page.locator('[data-nex-create-card-link="go-live"]'),
    ).toHaveAttribute("href", "/nex-native/live-commerce/welcome");
  });

  test("Studio tile routes to /nex-native/live-commerce/studio and surface renders", async ({ page }) => {
    await openLibrary(page);
    await page.locator('[data-nex-broadcaster-library-footer-btn="studio"]').click();

    await expect(page).toHaveURL(/\/nex-native\/live-commerce\/studio$/, { timeout: 7000 });
    await expect(page.locator("[data-nex-live-studio]")).toBeVisible();

    // Three honest sections.
    await expect(
      page.locator('[data-nex-live-studio-card][data-nex-live-studio-card-key="insights"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-nex-live-studio-card][data-nex-live-studio-card-key="followers"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-nex-live-studio-card][data-nex-live-studio-card-key="shop"]'),
    ).toBeVisible();

    // Sealed DEMO chip on Insights · prevents accidental "we have real
    // analytics" claim until the service lands.
    await expect(page.locator("[data-nex-live-studio-demo-chip]")).toBeVisible();
    await expect(page.locator("[data-nex-live-studio-demo-chip]")).toHaveText(/Demo/i);

    // Shop open button is honestly disabled.
    await expect(page.locator("[data-nex-live-studio-shop-open]")).toBeDisabled();
  });

  test("Go Live tile routes to /nex-native/live-commerce/welcome", async ({ page }) => {
    await openLibrary(page);
    await page.locator('[data-nex-broadcaster-library-footer-btn="live"]').click();

    await expect(page).toHaveURL(/\/nex-native\/live-commerce\/welcome(\?|$)/, { timeout: 7000 });
  });
});
