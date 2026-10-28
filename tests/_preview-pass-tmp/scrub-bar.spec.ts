import { test, expect } from "@playwright/test";

test("scrub bar · white fill shrinks + drag seeks via pointer events", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto("http://localhost:3008/nex-native/videos/dev-video-1", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2500);
  const bar = page.locator("[data-nex-live-footer-video-progress]");
  const thumb = page.locator("[data-nex-live-footer-video-progress-thumb]");
  expect(await bar.count()).toBe(1);
  expect(await thumb.count()).toBe(1);
  const role = await bar.getAttribute("role");
  await page.screenshot({ path: "tests/e2e-screenshots/preview-pass-2026-10-25/scrub-bar-initial.png", fullPage: false, clip: { x: 0, y: 735, width: 412, height: 190 } });

  const result = await page.evaluate(() => {
    const bar = document.querySelector("[data-nex-live-footer-video-progress]") as HTMLElement | null;
    if (!bar) return { fired: false };
    const rect = bar.getBoundingClientRect();
    const y = rect.top + rect.height / 2;
    const startX = rect.left + rect.width * 0.1;
    const endX = rect.left + rect.width * 0.8;
    const opts = (clientX: number) => ({ bubbles: true, cancelable: true, pointerId: 1, clientX, clientY: y, pointerType: "mouse" as const, isPrimary: true });
    bar.dispatchEvent(new PointerEvent("pointerdown", opts(startX)));
    bar.dispatchEvent(new PointerEvent("pointermove", opts((startX + endX) / 2)));
    bar.dispatchEvent(new PointerEvent("pointermove", opts(endX)));
    bar.dispatchEvent(new PointerEvent("pointerup", opts(endX)));
    return { fired: true, barWidth: rect.width };
  });
  console.log(`dispatched: ${JSON.stringify(result)}`);
  await page.waitForTimeout(600);

  const afterValue = parseInt((await bar.getAttribute("data-nex-live-footer-video-progress-value")) ?? "0", 10);
  const videoTime = await page.evaluate(() => {
    const el = document.querySelector("video") as HTMLVideoElement | null;
    return el ? el.currentTime : -1;
  });
  console.log(`after=${afterValue} videoTime=${videoTime} role=${role}`);
  await page.screenshot({ path: "tests/e2e-screenshots/preview-pass-2026-10-25/scrub-bar-after-seek.png", fullPage: false, clip: { x: 0, y: 735, width: 412, height: 190 } });
  expect(role).toBe("slider");
  expect(afterValue).toBeGreaterThan(50);
  expect(videoTime).toBeGreaterThan(0);
});
