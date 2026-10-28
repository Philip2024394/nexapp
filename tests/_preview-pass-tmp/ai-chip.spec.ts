import { test, expect } from "@playwright/test";

test("AI chip renders on flagged video (dev-video-3) · absent on dev-video-1", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });

  // dev-video-3 · marked isAiGenerated: true in the manifest
  await page.goto("http://localhost:3008/nex-native/videos/dev-video-3", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1800);
  const flaggedChip = page.locator("[data-nex-video-viewer-ai-chip]");
  const flaggedCount = await flaggedChip.count();
  const flaggedText = flaggedCount ? await flaggedChip.textContent() : "n/a";
  const flaggedColor = flaggedCount ? await flaggedChip.evaluate((el) => (el as HTMLElement).style.color) : "n/a";
  console.log(`dev-video-3 · chip=${flaggedCount} text="${flaggedText}" color="${flaggedColor}"`);
  await page.screenshot({ path: "tests/e2e-screenshots/preview-pass-2026-10-25/ai-chip-video-3.png", fullPage: false, clip: { x: 0, y: 0, width: 412, height: 100 } });

  // dev-video-1 · NOT marked (default false) · chip must be absent
  await page.goto("http://localhost:3008/nex-native/videos/dev-video-1", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1800);
  const unflaggedCount = await page.locator("[data-nex-video-viewer-ai-chip]").count();
  console.log(`dev-video-1 · chip=${unflaggedCount}`);
  await page.screenshot({ path: "tests/e2e-screenshots/preview-pass-2026-10-25/ai-chip-video-1-absent.png", fullPage: false, clip: { x: 0, y: 0, width: 412, height: 100 } });

  expect(flaggedCount).toBe(1);
  expect(flaggedText).toBe("AI");
  expect(flaggedColor).toBe("rgb(255, 51, 85)");
  expect(unflaggedCount).toBe(0);
});
