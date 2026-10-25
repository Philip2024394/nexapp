import { test } from "@playwright/test";
test.use({ viewport: { width: 1280, height: 820 } });

test("CAPTURE · Live persona Hendra", async ({ page }) => {
  await page.goto("/nex-native/dev/live-persona/hendra", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(600);
  await page.screenshot({
    path: "tests/e2e-screenshots/live-persona/02-hendra.png",
    fullPage: false,
  });
});
