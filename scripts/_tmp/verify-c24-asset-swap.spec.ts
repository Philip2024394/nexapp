// scripts/_tmp/verify-c24-asset-swap.spec.ts
//
// Visual verification of the 3 new NEX assets wired in 2026-11-11:
//   · nex-splash.png  → NEX Chat & Shop App Poster (portrait, phone frame)
//   · nex-brand/nex-global-connection-experience.png → landscape backdrop
//   · nex-native/vault-intro/hero.png → Vault portrait
//
// Plus the splash timing bump 2s → 5s.

import { test } from "@playwright/test";

const BASE = process.env.NEX_TEST_BASE ?? "http://localhost:3015";

test("mobile · splash shows new poster then sits for 5s", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const splashRequestAt = Date.now();
  await page.goto(`${BASE}/nex-native`, { waitUntil: "domcontentloaded" });
  await page.screenshot({ path: `${testInfo.outputDir}/mobile-splash-00-at-100ms.png` });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${testInfo.outputDir}/mobile-splash-01-at-600ms.png` });
  await page.waitForTimeout(4000);
  const urlBefore5s = page.url();
  await page.screenshot({ path: `${testInfo.outputDir}/mobile-splash-02-at-4500ms.png` });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${testInfo.outputDir}/mobile-splash-03-at-6000ms.png` });
  const urlAfter5s = page.url();
  console.log(`\n=== Splash timing ===`);
  console.log(`  URL @ +4.5s: ${urlBefore5s}`);
  console.log(`  URL @ +6.0s: ${urlAfter5s}`);
  console.log(`  (splash should still be on /nex-native at +4.5s, diverted by +6.0s)`);
});

test("desktop · new landscape backdrop visible behind phone frame", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.context().addCookies([
    { name: "nex_dev_override", value: "nex-99901", url: BASE },
  ]);
  await page.goto(`${BASE}/nex-native/free-chat`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".nex-native-frame", { timeout: 20_000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${testInfo.outputDir}/desktop-backdrop.png` });
});

test("vault · new intro hero", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.context().addCookies([
    { name: "nex_dev_override", value: "nex-99901", url: BASE },
  ]);
  await page.goto(`${BASE}/nex-native/vault/intro`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".nex-native-frame", { timeout: 20_000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${testInfo.outputDir}/vault-intro.png` });
});
