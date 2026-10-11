#!/usr/bin/env node
// scripts/browser-trace-nav-themes.mjs
//
// Reproduce the "themes disappear when I navigate back" bug.
// Captures theme counts and errors at every nav boundary.

import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3010";
const LIB = `${BASE}/nex-native/chat-themes-library`;
const THEME = `${BASE}/nex-native/themes/nex-bubbles`;

const EXISTING_CHROME =
  "C:\\Users\\Victus\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe";

async function countThemes(page) {
  // The ACTUAL category tile selector is `[data-nex-category-tile]`
  // on the outer <a> wrapper · `nex-category-phone-tile` is the
  // inner CSS class · neither is `[data-nex-category-phone-tile]`
  // which does not exist in the DOM.
  const categoryCount = await page
    .locator('[data-nex-category-tile]')
    .count();
  const categoryHeroes = await page
    .locator('[data-nex-category-phone-fallback], [data-nex-category-phone-header]')
    .count();
  const freePhones = await page
    .locator('[data-nex-space-free-phone]')
    .count();
  const totalRendered = categoryCount + freePhones;
  const guestInvite = (await page
    .locator('[data-nex-themes-guest-invite]')
    .count()) > 0;
  return {
    categoryCount,
    categoryHeroes,
    freePhones,
    totalRendered,
    guestInvite,
  };
}

async function captureConsole(page) {
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  return errors;
}

async function run() {
  console.log(`Launching Chromium headless · base=${BASE}`);
  const browser = await chromium.launch({
    headless: true,
    executablePath: EXISTING_CHROME,
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = await captureConsole(page);

  const states = [];

  console.log(`\n[1] First visit: GET ${LIB}`);
  await page.goto(LIB, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const s1 = await countThemes(page);
  states.push({ step: "1. first visit library", ...s1 });
  console.log("  ", JSON.stringify(s1));

  console.log(`\n[2] Click a theme tile (nex-bubbles) via navigation`);
  const nexBubblesTile = await page
    .locator('[data-nex-space-free-phone="nex-bubbles"] a')
    .first();
  const found = (await nexBubblesTile.count()) > 0;
  if (found) {
    await nexBubblesTile.click();
    await page.waitForURL(/\/themes\/nex-bubbles/, { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(500);
    console.log(`   now at: ${page.url()}`);
  } else {
    console.log("   tile not clickable · falling back to direct goto");
    await page.goto(THEME, { waitUntil: "networkidle" });
  }

  console.log(`\n[3] Click browser BACK to return to library`);
  await page.goBack({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const s3 = await countThemes(page);
  states.push({ step: "3. back nav → library", ...s3 });
  console.log("  ", JSON.stringify(s3));
  console.log(`   url: ${page.url()}`);

  console.log(`\n[4] Click BACK again · forward · back (stress nav)`);
  await page.goForward({ waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(500);
  await page.goBack({ waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(800);
  const s4 = await countThemes(page);
  states.push({ step: "4. fwd+back stress", ...s4 });
  console.log("  ", JSON.stringify(s4));

  console.log(`\n[5] Hard reload`);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const s5 = await countThemes(page);
  states.push({ step: "5. hard reload", ...s5 });
  console.log("  ", JSON.stringify(s5));

  console.log(`\n[6] Follow a themePreviewHref link via next/link (soft nav)`);
  await page.goto(LIB, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  // Explore link into category/food
  const foodLink = await page
    .locator('a[href="/nex-native/chat-themes-library/category/food"]')
    .first();
  if ((await foodLink.count()) > 0) {
    await foodLink.click();
    await page.waitForTimeout(1000);
    console.log(`   now at: ${page.url()}`);
    await page.goBack({ waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    const s6 = await countThemes(page);
    states.push({ step: "6. soft nav to food → back", ...s6 });
    console.log("  ", JSON.stringify(s6));
  }

  console.log(`\n[7] Capture console/page errors (last 15)`);
  for (const e of errors.slice(-15)) console.log(`  ! ${e.slice(0, 220)}`);
  console.log(`total errors: ${errors.length}`);

  console.log(`\n== SUMMARY TABLE ==`);
  console.log(
    "step".padEnd(32),
    "cats".padEnd(6),
    "free".padEnd(6),
    "total".padEnd(7),
    "guest",
  );
  for (const s of states) {
    console.log(
      s.step.padEnd(32),
      String(s.categoryCount).padEnd(6),
      String(s.freePhones).padEnd(6),
      String(s.totalRendered).padEnd(7),
      String(s.guestInvite),
    );
  }

  await browser.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
