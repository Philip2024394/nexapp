import { test } from "@playwright/test";
test.use({ viewport: { width: 1280, height: 820 } });

test("CAPTURE · Live persona Bayu", async ({ page }) => {
  await page.goto("/nex-native/dev/live-persona/bayu", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(600);
  await page.screenshot({
    path: "tests/e2e-screenshots/live-persona/01-bayu.png",
    fullPage: false,
  });
});
