// scripts/_tmp/verify-live-asset-swap.spec.ts
// Visual verification of asset refresh on live Vercel deployment.

import { test } from "@playwright/test";

const BASE = "https://nex-ireland-preview.vercel.app";

test("live · splash shows new poster", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/nex-native`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${testInfo.outputDir}/live-splash.png` });
  await page.waitForTimeout(3700);
  const urlAt4500ms = page.url();
  await page.waitForTimeout(1200);
  const urlAt6000ms = page.url();
  console.log(`\n=== Splash timing on live ===`);
  console.log(`  URL @ +4.5s: ${urlAt4500ms} (should still be /nex-native if splash=5s)`);
  console.log(`  URL @ +6.0s: ${urlAt6000ms} (should have diverted)`);
});

test("live · desktop golden backdrop behind phone frame", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.context().addCookies([
    { name: "nex_dev_override", value: "nex-99901", url: BASE },
  ]);
  await page.goto(`${BASE}/nex-native/free-chat`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForSelector(".nex-native-frame", { timeout: 20_000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${testInfo.outputDir}/live-backdrop.png` });
});
