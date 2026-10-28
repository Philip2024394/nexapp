import { test, expect } from "@playwright/test";

test("3-dot menu · closed state", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto("http://localhost:3008/nex-native/videos/dev-video-18", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1800);
  const more = page.locator("[data-nex-live-footer-more]");
  expect(await more.count()).toBe(1);
  expect(await more.getAttribute("data-nex-live-footer-more-open")).toBe("false");
  await page.screenshot({ path: "tests/e2e-screenshots/preview-pass-2026-10-25/three-dot-closed.png", fullPage: false, clip: { x: 0, y: 735, width: 412, height: 180 } });
});

test("3-dot menu · open · slide-out shows 4 pills", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto("http://localhost:3008/nex-native/videos/dev-video-18", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1800);
  await page.locator("[data-nex-live-footer-more]").click();
  await page.waitForTimeout(500);
  const more = page.locator("[data-nex-live-footer-more]");
  const panel = page.locator("[data-nex-live-footer-extra-actions]");
  expect(await more.getAttribute("data-nex-live-footer-more-open")).toBe("true");
  expect(await panel.getAttribute("data-nex-live-footer-extra-actions-open")).toBe("true");
  const pillLabels = await page.locator("[data-nex-live-footer-extra-actions] button, [data-nex-live-footer-extra-actions] a").allTextContents();
  console.log("pill labels: " + JSON.stringify(pillLabels));
  await page.screenshot({ path: "tests/e2e-screenshots/preview-pass-2026-10-25/three-dot-open.png", fullPage: false, clip: { x: 0, y: 735, width: 412, height: 180 } });
  expect(pillLabels.length).toBe(4);
});
