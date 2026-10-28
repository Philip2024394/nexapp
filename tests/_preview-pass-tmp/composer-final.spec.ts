import { test, expect } from "@playwright/test";

async function waitForRotation(page: any, want: "name" | "prompt", timeoutMs = 3000) {
  const sel = "[data-nex-live-footer-text-input]";
  await page.waitForFunction(
    ({ sel, want }: { sel: string; want: string }) => {
      const el = document.querySelector(sel);
      return el?.getAttribute("data-nex-live-footer-placeholder-rotation") === want;
    },
    { sel, want },
    { timeout: timeoutMs },
  );
}

test("recorded video · composer · name state screenshot", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto("http://localhost:3008/nex-native/videos/dev-video-18", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500);
  await waitForRotation(page, "name");
  await page.screenshot({ path: "tests/e2e-screenshots/preview-pass-2026-10-25/composer-recorded-NAME.png", fullPage: false, clip: { x: 0, y: 740, width: 412, height: 175 } });
});

test("recorded video · composer · prompt state screenshot", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto("http://localhost:3008/nex-native/videos/dev-video-18", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500);
  await waitForRotation(page, "prompt");
  await page.screenshot({ path: "tests/e2e-screenshots/preview-pass-2026-10-25/composer-recorded-PROMPT.png", fullPage: false, clip: { x: 0, y: 740, width: 412, height: 175 } });
});

test("live viewer · composer · author ping (isLive=true) screenshot", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  // Any session id resolves to the viewer page (session may be idle/unknown)
  await page.goto("http://localhost:3008/nex-native/live-commerce/preview-session-ping", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);
  const authorExists = await page.locator("[data-nex-live-footer-author]").count();
  const isLive = authorExists ? await page.locator("[data-nex-live-footer-author]").first().getAttribute("data-nex-live-footer-author-live") : "n/a";
  console.log(`live viewer · authorExists=${authorExists} isLive=${isLive}`);
  await page.screenshot({ path: "tests/e2e-screenshots/preview-pass-2026-10-25/composer-live-maybe.png", fullPage: false, clip: { x: 0, y: 740, width: 412, height: 175 } });
});
