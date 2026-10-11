#!/usr/bin/env node
// Verify the Joker 3-dot combo + animation column flow.
import { chromium } from "playwright";

const EXE =
  "C:\\Users\\Victus\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe";
const BASE = "http://localhost:3010";
const URL = `${BASE}/nex-native/themes/theme-0`;

const browser = await chromium.launch({
  headless: true,
  executablePath: EXE,
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

const consoleErrors = [];
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(`console: ${msg.text()}`);
});

console.log(`[1] GET ${URL}`);
const resp = await page.goto(URL, { waitUntil: "networkidle" });
console.log(`    HTTP ${resp?.status()}`);
await page.waitForTimeout(1200);

// Confirm the 3-dot toggle exists
const toggle = page.locator('[data-nex-universal-call-actions-toggle]');
const toggleCount = await toggle.count();
console.log(`\n[2] 3-dot toggle buttons: ${toggleCount}`);
if (toggleCount > 0) {
  const toggleBox = await toggle.first().boundingBox();
  console.log(`    position: ${JSON.stringify(toggleBox)}`);
  const toggleStyle = await toggle.first().evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      right: cs.right,
      bottom: cs.bottom,
      display: cs.display,
      visibility: cs.visibility,
      opacity: cs.opacity,
      zIndex: cs.zIndex,
    };
  });
  console.log(`    style: ${JSON.stringify(toggleStyle)}`);
}

// Confirm the animation column exists in DOM (closed state)
const column = page.locator('[data-nex-universal-animation-column]');
const columnCount = await column.count();
console.log(`\n[3] Animation column elements in DOM: ${columnCount}`);
if (columnCount > 0) {
  const columnStyle = await column.first().evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      right: cs.right,
      bottom: cs.bottom,
      opacity: cs.opacity,
      pointerEvents: cs.pointerEvents,
      display: cs.display,
      visibility: cs.visibility,
      zIndex: cs.zIndex,
      transform: cs.transform,
    };
  });
  console.log(`    closed-state style: ${JSON.stringify(columnStyle)}`);
}

const variantButtons = page.locator('[data-nex-animation-variant]');
console.log(`\n[4] Variant buttons in DOM: ${await variantButtons.count()}`);

console.log(`\n[5] Click the 3-dot toggle · open the combo`);
await toggle.first().click();
await page.waitForTimeout(600);

// Re-check column style now that it's "open"
if (columnCount > 0) {
  const columnOpenStyle = await column.first().evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      opacity: cs.opacity,
      pointerEvents: cs.pointerEvents,
      transform: cs.transform,
    };
  });
  console.log(`    open-state style: ${JSON.stringify(columnOpenStyle)}`);
  const columnBox = await column.first().boundingBox();
  console.log(`    bounding box: ${JSON.stringify(columnBox)}`);
}

// Click the "lightning" variant and verify the overlay renders
const lightningBtn = page.locator('[data-nex-animation-variant="lightning"]');
if ((await lightningBtn.count()) > 0) {
  console.log(`\n[6] Click 🌩 Lightning button`);
  await lightningBtn.click();
  await page.waitForTimeout(600);
  const btnState = await lightningBtn.evaluate((el) =>
    el.getAttribute("data-nex-animation-variant-state"),
  );
  console.log(`    button state after click: ${btnState}`);
  // JokerMotionOverlay for lightning should mount somewhere · check
  // for its data-nex-joker-motion attribute or a lightning-specific
  // element.
  const motionDoms = await page.locator("[data-nex-joker-motion], [class*='lightning']").count();
  console.log(`    motion-overlay-like elements: ${motionDoms}`);
}

console.log(`\n[7] Console / page errors (last 10)`);
for (const e of consoleErrors.slice(-10)) console.log(`  ! ${e.slice(0, 200)}`);
console.log(`total: ${consoleErrors.length}`);

await browser.close();
