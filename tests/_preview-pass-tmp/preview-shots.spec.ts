import { test, expect } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test("harness · S8 chips + Timeout rename", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto("http://localhost:3008/nex-native/dev/live-chip-ttl-harness?ttl=5000", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: "tests/e2e-screenshots/preview-pass-2026-10-25/01-s8-chips-harness.png",
    fullPage: true,
  });
});

test("enter-broadcast-room · broadcaster entry (auth gate expected)", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto("http://localhost:3008/nex-native/live-commerce/enter-broadcast-room", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForTimeout(2000);
  const url = page.url();
  await page.screenshot({
    path: "tests/e2e-screenshots/preview-pass-2026-10-25/02-go-live-landed.png",
    fullPage: true,
  });
  console.log("GO_LIVE_FINAL_URL=" + url);
});

test("feed · central discovery (expected 500 before fix)", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  const resp = await page.goto("http://localhost:3008/nex-native/live-commerce/feed", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  console.log("FEED_HTTP_STATUS=" + (resp?.status() ?? "n/a"));
  await page.waitForTimeout(1200);
  await page.screenshot({
    path: "tests/e2e-screenshots/preview-pass-2026-10-25/03-feed-500.png",
    fullPage: true,
  });
});
