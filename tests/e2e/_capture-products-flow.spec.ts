// Capture-only · steps the owner can view in sequence.
import { test } from "@playwright/test";
test.use({ viewport: { width: 412, height: 915 } });
test("CAPTURE · products flow walk", async ({ page }) => {
  const dir = "tests/e2e-screenshots/products-flow-walk";
  await page.goto("/nex-native/videos/dev-video-3?preview=broadcaster", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(600);

  // Step 1 · page landed · base state (hero + action row).
  await page.screenshot({ path: `${dir}/01-landed.png`, fullPage: false });

  // Step 2 · open the 3-dot panel.
  await page.locator("[data-nex-live-footer-more]").click();
  await page.waitForTimeout(260);
  await page.screenshot({ path: `${dir}/02-panel-open.png`, fullPage: false });

  // Step 2b · zoom crop of just the panel + footer.
  await page.screenshot({
    path: `${dir}/02b-panel-crop.png`,
    clip: { x: 0, y: 600, width: 412, height: 300 },
  });

  // Step 3 · tap Products.
  await page.locator("[data-nex-live-footer-extra-products]").click();
  await page.waitForTimeout(260);
  await page.screenshot({ path: `${dir}/03-picker-open.png`, fullPage: false });

  // Step 4 · pick card 2.
  await page
    .locator('[data-nex-live-footer-product-picker-card-id="mock-product-2"]')
    .click();
  // Capture mid-glow at 500ms (early) and 2500ms (mid-fade).
  await page.waitForTimeout(500);
  await page.screenshot({
    path: `${dir}/04-featured-glow-early.png`,
    fullPage: false,
  });
  await page.screenshot({
    path: `${dir}/04b-featured-glow-early-crop.png`,
    clip: { x: 0, y: 720, width: 412, height: 195 },
  });
  await page.waitForTimeout(2000);
  await page.screenshot({
    path: `${dir}/05-featured-mid-fade.png`,
    clip: { x: 0, y: 720, width: 412, height: 195 },
  });

  // Step 6 · press-hold 2s to raise confirm.
  await page.locator("[data-nex-live-footer-featured-card]").evaluate((el) => {
    el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  });
  await page.waitForTimeout(1100);
  await page.screenshot({
    path: `${dir}/06-press-hold-mid.png`,
    clip: { x: 0, y: 720, width: 412, height: 195 },
  });
  await page.waitForTimeout(1200);
  await page.screenshot({
    path: `${dir}/07-confirm-sheet.png`,
    fullPage: false,
  });

  // Step 7 · tap Return.
  await page.locator("[data-nex-live-footer-remove-confirm-ok]").click();
  await page.waitForTimeout(300);
  await page.screenshot({
    path: `${dir}/08-after-return.png`,
    clip: { x: 0, y: 720, width: 412, height: 195 },
  });
});
