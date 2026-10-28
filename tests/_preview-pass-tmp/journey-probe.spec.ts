import { test, expect } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test("J1 · welcome → check agreement → Let's Go Live", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto("http://localhost:3008/nex-native/live-commerce/welcome", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500);

  // Try to click agreement checkbox
  const checkbox = page.locator("input[type='checkbox'], [role='checkbox'], [data-nex-welcome-agree]").first();
  const checkboxCount = await checkbox.count();
  console.log("checkbox count=" + checkboxCount);

  await page.screenshot({ path: "tests/e2e-screenshots/preview-pass-2026-10-25/J1a-welcome-initial.png", fullPage: true });

  if (checkboxCount) {
    await checkbox.click({ force: true }).catch(() => {});
    await page.waitForTimeout(400);
  }

  // Look for "Let's Go Live" or similar primary CTA
  const cta = page.locator("button:has-text('Go Live'), button:has-text(\"Let's Go Live\"), a:has-text('Go Live')").first();
  const ctaCount = await cta.count();
  console.log("cta count=" + ctaCount);
  if (ctaCount) {
    const enabled = await cta.isEnabled();
    console.log("cta enabled=" + enabled);
  }
  await page.screenshot({ path: "tests/e2e-screenshots/preview-pass-2026-10-25/J1b-welcome-agreed.png", fullPage: true });
});

test("J2 · feed → tap recorded card → video viewer navigation", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto("http://localhost:3008/nex-native/live-commerce/feed", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2500);
  const cards = page.locator("[data-nex-recorded-video-card]");
  const cardCount = await cards.count();
  console.log("recorded-card count=" + cardCount);
  if (cardCount > 0) {
    const firstCardId = await cards.first().getAttribute("data-nex-recorded-video-card");
    console.log("first card id=" + firstCardId);
    await cards.first().click();
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1500);
    console.log("after click url=" + page.url());
    await page.screenshot({ path: "tests/e2e-screenshots/preview-pass-2026-10-25/J2-after-feed-card-click.png", fullPage: false });
  }
});

test("J3 · viewer scroll · check for runtime errors", async ({ page }) => {
  const errors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("http://localhost:3008/nex-native/videos/dev-video-5", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2500);
  console.log("viewer pageErrors=" + errors.length + " consoleErrors=" + consoleErrors.length);
  if (errors.length) console.log("first page err=" + errors[0]);
  if (consoleErrors.length) console.log("first console err=" + consoleErrors[0]);
  await page.screenshot({ path: "tests/e2e-screenshots/preview-pass-2026-10-25/J3-viewer-360x780.png", fullPage: false });
});

test("J4 · feed @ 360x780 mobile", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("http://localhost:3008/nex-native/live-commerce/feed", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "tests/e2e-screenshots/preview-pass-2026-10-25/J4-feed-360x780.png", fullPage: true });
});
