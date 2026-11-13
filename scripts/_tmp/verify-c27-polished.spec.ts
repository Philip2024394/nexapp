import { test } from "@playwright/test";

const BASE = "http://localhost:3021";

async function setup(page: import("@playwright/test").Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.context().addCookies([
    { name: "nex_dev_override", value: "nex-99901", url: BASE },
  ]);
}

test("C27 polished · contacts tab", async ({ page }, testInfo) => {
  await setup(page);
  await page.goto(`${BASE}/nex-native/contacts`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForSelector(".nex-native-frame", { timeout: 20_000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${testInfo.outputDir}/c27-polished-default.png`, fullPage: true });
});

test("C27 polished · groups tab", async ({ page }, testInfo) => {
  await setup(page);
  await page.goto(`${BASE}/nex-native/contacts?tab=groups`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForSelector(".nex-native-frame", { timeout: 20_000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${testInfo.outputDir}/c27-polished-groups.png`, fullPage: true });
});

test("C27 polished · business tab", async ({ page }, testInfo) => {
  await setup(page);
  await page.goto(`${BASE}/nex-native/contacts?tab=business`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForSelector(".nex-native-frame", { timeout: 20_000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${testInfo.outputDir}/c27-polished-business.png`, fullPage: true });
});
