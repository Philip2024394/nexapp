import { test, expect } from "@playwright/test";

test("composer author · avatar + rotating placeholder · initial name", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto("http://localhost:3008/nex-native/videos/dev-video-18", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);

  const author = page.locator("[data-nex-live-footer-author]");
  const authorCount = await author.count();
  const isLive = authorCount ? await author.first().getAttribute("data-nex-live-footer-author-live") : "n/a";
  const input = page.locator("[data-nex-live-footer-text-input]").first();
  const rotation = await input.getAttribute("data-nex-live-footer-placeholder-rotation");
  const placeholderAtT0 = await input.getAttribute("placeholder");
  console.log(`T0 · author=${authorCount} isLive=${isLive} rotation=${rotation} placeholder="${placeholderAtT0}"`);

  await page.screenshot({ path: "tests/e2e-screenshots/preview-pass-2026-10-25/composer-01-recorded-name.png", fullPage: false, clip: { x: 0, y: 740, width: 412, height: 175 } });

  // Wait 2.1s for the rotation to flip once
  await page.waitForTimeout(2100);
  const rotationAfter = await input.getAttribute("data-nex-live-footer-placeholder-rotation");
  const placeholderAtT1 = await input.getAttribute("placeholder");
  console.log(`T1 · rotation=${rotationAfter} placeholder="${placeholderAtT1}"`);

  await page.screenshot({ path: "tests/e2e-screenshots/preview-pass-2026-10-25/composer-02-recorded-prompt.png", fullPage: false, clip: { x: 0, y: 740, width: 412, height: 175 } });

  // Second rotation back to name
  await page.waitForTimeout(2100);
  const rotationBack = await input.getAttribute("data-nex-live-footer-placeholder-rotation");
  const placeholderAtT2 = await input.getAttribute("placeholder");
  console.log(`T2 · rotation=${rotationBack} placeholder="${placeholderAtT2}"`);

  await page.screenshot({ path: "tests/e2e-screenshots/preview-pass-2026-10-25/composer-03-recorded-name-again.png", fullPage: false, clip: { x: 0, y: 740, width: 412, height: 175 } });

  expect(authorCount).toBe(1);
  expect(isLive).toBe("false");  // recorded video → no ping
  expect(["name", "prompt"]).toContain(rotation);
  // Rotation must flip over 2s
  expect(rotationAfter).not.toBe(rotation);
  // And flip back
  expect(rotationBack).toBe(rotation);
});

test("composer author · 360×780 mobile", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("http://localhost:3008/nex-native/videos/dev-video-21", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "tests/e2e-screenshots/preview-pass-2026-10-25/composer-04-recorded-360.png", fullPage: false, clip: { x: 0, y: 600, width: 360, height: 180 } });
});
