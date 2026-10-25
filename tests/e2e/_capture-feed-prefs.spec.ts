import { test, expect } from "@playwright/test";
test.use({ viewport: { width: 1280, height: 820 } });

test("CAPTURE · Live Feed Preferences in 3-dot panel", async ({ page }) => {
  const dir = "tests/e2e-screenshots/feed-prefs";

  // Reset localStorage so test is deterministic.
  await page.goto("/nex-native/dev/live-viewer", {
    waitUntil: "domcontentloaded",
  });
  await page.evaluate(() => window.localStorage.removeItem("nex-live-feed-prefs-v1"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);

  // Open the 3-dot panel, then flip to Feed (preferences now live
  // behind the Feed pill since bada8d4).
  await page.locator("[data-nex-live-footer-more]").click();
  await page.waitForTimeout(260);
  await page.locator("[data-nex-live-footer-extra-feed]").click();
  await page.waitForTimeout(260);
  await expect(page.locator("[data-nex-live-feed-prefs]")).toBeVisible();

  // Quick tier · 4 rows always visible.
  const quickRows = page.locator('[data-nex-live-feed-prefs-tier="quick"] [data-nex-live-feed-prefs-row]');
  await expect(quickRows).toHaveCount(4);
  const expandedRows = page.locator('[data-nex-live-feed-prefs-tier="expanded"] [data-nex-live-feed-prefs-row]');
  await expect(expandedRows).toHaveCount(0);
  await page.screenshot({
    path: `${dir}/01-prefs-quick.png`,
    fullPage: false,
  });

  // Expand.
  await page.locator("[data-nex-live-feed-prefs-expand]").click();
  await page.waitForTimeout(260);
  await expect(expandedRows).toHaveCount(11);
  await page.screenshot({
    path: `${dir}/02-prefs-expanded.png`,
    fullPage: true,
  });

  // Toggle AI off · verify localStorage persistence.
  const aiToggle = page.locator('[data-nex-live-feed-prefs-id="ai"] [data-nex-live-feed-prefs-toggle]');
  await aiToggle.click();
  await expect(aiToggle).toHaveAttribute("data-nex-live-feed-prefs-toggle-state", "off");
  const stored = await page.evaluate(() => window.localStorage.getItem("nex-live-feed-prefs-v1"));
  console.log(`stored=${stored}`);
  expect(stored).toContain('"ai":false');

  // Reload · AI stays off.
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await page.locator("[data-nex-live-footer-more]").click();
  await page.waitForTimeout(260);
  await page.locator("[data-nex-live-footer-extra-feed]").click();
  await page.waitForTimeout(260);
  const aiStateAfter = await page
    .locator('[data-nex-live-feed-prefs-id="ai"] [data-nex-live-feed-prefs-toggle]')
    .getAttribute("data-nex-live-feed-prefs-toggle-state");
  expect(aiStateAfter).toBe("off");
  console.log(`AI toggle state after reload = ${aiStateAfter}`);

  await page.screenshot({
    path: `${dir}/03-prefs-persisted-after-reload.png`,
    fullPage: false,
  });
});
