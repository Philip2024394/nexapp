import { test, expect } from "@playwright/test";

test("progress bar visible under composer", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto("http://localhost:3008/nex-native/videos/dev-video-18", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);
  const bar = page.locator("[data-nex-live-footer-video-progress]");
  const count = await bar.count();
  const value = count ? await bar.getAttribute("data-nex-live-footer-video-progress-value") : "n/a";
  console.log(`progress bar count=${count} value=${value}`);
  await page.screenshot({ path: "tests/e2e-screenshots/preview-pass-2026-10-25/progress-bar-under-composer.png", fullPage: false, clip: { x: 0, y: 735, width: 412, height: 190 } });
  expect(count).toBe(1);
});

test("Message pill opens MessagePanel overlay from the recorded viewer", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto("http://localhost:3008/nex-native/videos/dev-video-18", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1800);
  await page.locator("[data-nex-live-footer-more]").click();
  await page.waitForTimeout(400);
  const message = page.locator("[data-nex-live-footer-extra-message='true']");
  expect(await message.count()).toBe(1);
  await message.click();
  await page.waitForTimeout(1200); // give the server-action resolution a moment
  const panel = page.locator("[data-nex-live-message-panel]");
  const panelCount = await panel.count();
  console.log(`panel visible=${panelCount}`);
  await page.screenshot({ path: "tests/e2e-screenshots/preview-pass-2026-10-25/message-panel-open-from-recorded.png", fullPage: false });
  expect(panelCount).toBe(1);
});
