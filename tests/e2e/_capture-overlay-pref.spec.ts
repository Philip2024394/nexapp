import { test, expect } from "@playwright/test";
test.use({ viewport: { width: 1280, height: 820 } });

test("CAPTURE · Promotional overlays tri-state", async ({ page }) => {
  const dir = "tests/e2e-screenshots/overlay-pref";

  await page.goto("/nex-native/dev/live-viewer", {
    waitUntil: "domcontentloaded",
  });
  await page.evaluate(() => window.localStorage.removeItem("nex-live-feed-prefs-v1"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await page.locator("[data-nex-live-footer-more]").click();
  await page.waitForTimeout(260);
  await page.locator("[data-nex-live-footer-extra-feed]").click();
  await page.waitForTimeout(260);

  const section = page.locator("[data-nex-live-feed-prefs-overlay]");
  await expect(section).toBeVisible();

  // Default = all.
  const options = page.locator("[data-nex-live-feed-prefs-overlay-option]");
  await expect(options).toHaveCount(3);
  const allSelected = await page
    .locator('[data-nex-live-feed-prefs-overlay-option="all"]')
    .getAttribute("data-nex-live-feed-prefs-overlay-selected");
  expect(allSelected).toBe("true");
  await page.screenshot({
    path: `${dir}/01-default-show-all.png`,
    fullPage: false,
  });

  // Switch to Reduce.
  await page.locator('[data-nex-live-feed-prefs-overlay-option="reduce"]').click();
  await page.waitForTimeout(100);
  const reduceSel = await page
    .locator('[data-nex-live-feed-prefs-overlay-option="reduce"]')
    .getAttribute("data-nex-live-feed-prefs-overlay-selected");
  expect(reduceSel).toBe("true");
  const stored1 = await page.evaluate(() =>
    window.localStorage.getItem("nex-live-feed-prefs-v1"),
  );
  console.log(`stored after reduce = ${stored1}`);
  expect(stored1).toContain('"overlayPref":"reduce"');
  await page.screenshot({
    path: `${dir}/02-after-reduce.png`,
    fullPage: false,
  });

  // Switch to Hide.
  await page.locator('[data-nex-live-feed-prefs-overlay-option="hide"]').click();
  await page.waitForTimeout(100);
  const hideSel = await page
    .locator('[data-nex-live-feed-prefs-overlay-option="hide"]')
    .getAttribute("data-nex-live-feed-prefs-overlay-selected");
  expect(hideSel).toBe("true");
  const stored2 = await page.evaluate(() =>
    window.localStorage.getItem("nex-live-feed-prefs-v1"),
  );
  console.log(`stored after hide = ${stored2}`);
  expect(stored2).toContain('"overlayPref":"hide"');

  // Reload persistence.
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await page.locator("[data-nex-live-footer-more]").click();
  await page.waitForTimeout(260);
  await page.locator("[data-nex-live-footer-extra-feed]").click();
  await page.waitForTimeout(260);
  const hideAfterReload = await page
    .locator('[data-nex-live-feed-prefs-overlay-option="hide"]')
    .getAttribute("data-nex-live-feed-prefs-overlay-selected");
  expect(hideAfterReload).toBe("true");
  console.log(`hide after reload = ${hideAfterReload}`);
});
