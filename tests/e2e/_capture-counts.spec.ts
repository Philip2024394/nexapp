import { test, expect } from "@playwright/test";
test.use({ viewport: { width: 1280, height: 820 } });

test("CAPTURE · counts on Like / Share / Save", async ({ page }) => {
  const dir = "tests/e2e-screenshots/counts";

  // SELLER · broadcaster sees own metrics including 0.
  await page.goto("/nex-native/dev/live-seller", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(400);
  const sellerLike = await page.locator("[data-nex-live-footer-like-count]").textContent();
  const sellerShare = await page.locator("[data-nex-live-footer-share-count]").textContent();
  console.log(`SELLER like="${sellerLike}" share="${sellerShare}"`);
  await page.screenshot({
    path: `${dir}/01-seller-counts.png`,
    fullPage: false,
  });
  // Open the panel to show Save count.
  await page.locator("[data-nex-live-footer-more]").click();
  await page.waitForTimeout(260);
  const sellerSave = await page
    .locator("[data-nex-live-footer-extra-save] [data-nex-live-footer-extra-pill-count]")
    .textContent();
  console.log(`SELLER save="${sellerSave}"`);
  await page.screenshot({
    path: `${dir}/02-seller-counts-panel-open.png`,
    fullPage: false,
  });

  // VIEWER · 0 hidden.
  await page.goto("/nex-native/dev/live-viewer", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(400);
  const viewerLike = await page.locator("[data-nex-live-footer-like-count]").textContent();
  const viewerShare = await page.locator("[data-nex-live-footer-share-count]").textContent();
  console.log(`VIEWER like="${viewerLike}" share="${viewerShare}"`);
  await page.locator("[data-nex-live-footer-more]").click();
  await page.waitForTimeout(260);
  const viewerSave = await page
    .locator("[data-nex-live-footer-extra-save] [data-nex-live-footer-extra-pill-count]")
    .count();
  console.log(`VIEWER save count (should be 0 · hidden) = ${viewerSave}`);
  expect(viewerSave).toBe(0);
  await page.screenshot({
    path: `${dir}/03-viewer-counts-panel-open.png`,
    fullPage: false,
  });
});
