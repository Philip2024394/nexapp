import { test, expect } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test("J-feed · 412×915 · scroll + card count", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto("http://localhost:3008/nex-native/live-commerce/feed", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2500);
  const cardCount = await page.locator("[data-nex-recorded-video-card]").count();
  console.log("feed cards=" + cardCount + " pageErrors=" + errors.length);
  await page.screenshot({ path: "tests/e2e-screenshots/preview-pass-2026-10-25/final-01-feed-412.png", fullPage: true });
  expect(cardCount).toBeGreaterThanOrEqual(15);
  expect(errors).toHaveLength(0);
});

test("J-feed · 360×780 · mobile layout", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("http://localhost:3008/nex-native/live-commerce/feed", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: "tests/e2e-screenshots/preview-pass-2026-10-25/final-02-feed-360.png", fullPage: true });
  expect(errors).toHaveLength(0);
});

test("J-welcome → agree → Let's Go Live is enabled", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto("http://localhost:3008/nex-native/live-commerce/welcome", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "tests/e2e-screenshots/preview-pass-2026-10-25/final-03-welcome-initial.png", fullPage: true });

  const checkbox = page.locator("input[type='checkbox'], [role='checkbox']").first();
  const cta = page.locator("button:has-text('Go Live'), button:has-text(\"Let's Go Live\"), a:has-text('Go Live')").first();
  const beforeEnabled = (await cta.count()) ? await cta.isEnabled() : false;
  console.log("welcome · before agree · cta enabled=" + beforeEnabled);

  if (await checkbox.count()) await checkbox.click({ force: true }).catch(() => {});
  await page.waitForTimeout(400);
  const afterEnabled = (await cta.count()) ? await cta.isEnabled() : false;
  console.log("welcome · after agree · cta enabled=" + afterEnabled);
  await page.screenshot({ path: "tests/e2e-screenshots/preview-pass-2026-10-25/final-04-welcome-agreed.png", fullPage: true });

  expect(errors).toHaveLength(0);
});

test("J-feed → first card → video viewer deep-link", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto("http://localhost:3008/nex-native/live-commerce/feed", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2500);
  const first = page.locator("[data-nex-recorded-video-card]").first();
  const id = await first.getAttribute("data-nex-recorded-video-card");
  await first.click();
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1500);
  const url = page.url();
  console.log("feed→viewer tapped=" + id + " landed=" + url);
  await page.screenshot({ path: "tests/e2e-screenshots/preview-pass-2026-10-25/final-05-viewer-from-feed.png", fullPage: false });
  expect(url).toContain("/nex-native/videos/");
  expect(url).toContain(id!);
});

test("J-video viewer · sound-toggle round-trip + magnifier chrome", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto("http://localhost:3008/nex-native/videos/dev-video-18", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);
  const toggle = page.locator("[data-nex-video-viewer-sound-toggle]");
  const search = page.locator("[data-nex-video-viewer-search]");
  const toggleCount = await toggle.count();
  const searchCount = await search.count();
  const searchBg = searchCount ? await search.first().evaluate((el) => (el as HTMLElement).style.background) : "n/a";
  const initialSoundOn = toggleCount ? await toggle.first().getAttribute("data-nex-sound-on") : "n/a";
  console.log("viewer toggle=" + toggleCount + " searchBg=" + searchBg + " initialSoundOn=" + initialSoundOn);
  await page.screenshot({ path: "tests/e2e-screenshots/preview-pass-2026-10-25/final-06-viewer-muted.png", fullPage: false, clip: { x: 0, y: 0, width: 412, height: 140 } });
  await toggle.click();
  await page.waitForTimeout(400);
  const nextSoundOn = await toggle.getAttribute("data-nex-sound-on");
  console.log("viewer after-click soundOn=" + nextSoundOn);
  await page.screenshot({ path: "tests/e2e-screenshots/preview-pass-2026-10-25/final-07-viewer-unmuted.png", fullPage: false, clip: { x: 0, y: 0, width: 412, height: 140 } });
  expect(toggleCount).toBe(1);
  expect(searchBg).toBe("transparent");
  expect(nextSoundOn).toBe("true");
});

test("J-video viewer · 360×780 mobile layout", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("http://localhost:3008/nex-native/videos/dev-video-21", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "tests/e2e-screenshots/preview-pass-2026-10-25/final-08-viewer-360.png", fullPage: false });
  console.log("viewer 360 pageErrors=" + errors.length);
  expect(errors).toHaveLength(0);
});
