// scripts/_tmp/hq-browser-acceptance.mjs
//
// NEX HQ · real-browser acceptance test (commit ddfcc42).
// Owner-authorised 2026-10-31 (round 5) · follow-up final test.
// Runs against the dev server already on http://localhost:3008.
// Writes screenshots + an artefact JSON to scripts/_tmp/.
//
// This script does NOT modify anything. It only opens pages, clicks,
// and reads state. No DB, no auth, no cookies written beyond what
// Playwright maintains in its own context.

import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const BASE = "http://localhost:3008";
const OUT = "scripts/_tmp";
mkdirSync(OUT, { recursive: true });

const results = [];
let pass = 0;
let fail = 0;

function record(step, verdict, note, extra = {}) {
  const row = { step, verdict, note, ...extra };
  results.push(row);
  if (verdict === "PASS") pass++;
  else if (verdict === "FAIL") fail++;
  const marker = verdict === "PASS" ? "✓" : verdict === "FAIL" ? "✗" : "·";
  console.log(`${marker} ${step} · ${verdict} · ${note}`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });

  const consoleErrors = [];
  const failedRequests = [];
  context.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  context.on("requestfailed", (req) => {
    failedRequests.push({ url: req.url(), failure: req.failure()?.errorText });
  });

  const page = await context.newPage();

  // ---- Step 1 · /nex-native/hq loads ------------------------------------
  const resp1 = await page.goto(`${BASE}/nex-native/hq`, { waitUntil: "networkidle" });
  const status1 = resp1?.status() ?? 0;
  const title1 = await page.locator('h1:visible').first().textContent().catch(() => null);
  if (status1 === 200 && (title1 ?? "").includes("NEX HEADQUARTERS")) {
    record("1. /nex-native/hq loads for admin", "PASS", `HTTP ${status1} · h1="${title1}"`);
  } else {
    record("1. /nex-native/hq loads for admin", "FAIL", `HTTP ${status1} · h1="${title1}"`);
  }
  await page.screenshot({ path: join(OUT, "01-hq-home.png"), fullPage: false });

  // ---- Step 2 · Country artwork visible, correct, not distorted ----------
  // Target the two country-card images by src.
  const irelandImg = page.locator('img[src*="ireland-studio.png"]').first();
  const indonesiaImg = page.locator('img[src*="indonesia-studio.png"]').first();
  const irelandVisible = await irelandImg.isVisible().catch(() => false);
  const indonesiaVisible = await indonesiaImg.isVisible().catch(() => false);
  const irelandBox = await irelandImg.boundingBox().catch(() => null);
  const indonesiaBox = await indonesiaImg.boundingBox().catch(() => null);
  const irelandNatural = await irelandImg.evaluate((el) => ({
    nw: el.naturalWidth,
    nh: el.naturalHeight,
    complete: el.complete,
  })).catch(() => null);
  const indonesiaNatural = await indonesiaImg.evaluate((el) => ({
    nw: el.naturalWidth,
    nh: el.naturalHeight,
    complete: el.complete,
  })).catch(() => null);
  const bothVisible = irelandVisible && indonesiaVisible;
  const bothLoaded =
    irelandNatural?.complete &&
    irelandNatural.nw > 0 &&
    indonesiaNatural?.complete &&
    indonesiaNatural.nw > 0;
  if (bothVisible && bothLoaded) {
    record(
      "2. Country artwork visible + loaded",
      "PASS",
      `IE ${irelandBox?.width}x${irelandBox?.height} (natural ${irelandNatural.nw}x${irelandNatural.nh}) · ID ${indonesiaBox?.width}x${indonesiaBox?.height} (natural ${indonesiaNatural.nw}x${indonesiaNatural.nh})`
    );
  } else {
    record(
      "2. Country artwork visible + loaded",
      "FAIL",
      `visible: IE=${irelandVisible} ID=${indonesiaVisible} · loaded: IE=${JSON.stringify(irelandNatural)} ID=${JSON.stringify(indonesiaNatural)}`
    );
  }

  // ---- Step 3 · Click Ireland · navigate · focus · scroll -----------------
  const irelandLink = page.locator('a[href*="focus=ireland"]').first();
  await irelandLink.click();
  await page.waitForURL("**/hq/worlds?focus=ireland", { timeout: 10_000 });
  await page.waitForLoadState("networkidle");
  const url3 = page.url();
  // Wait for section + check class applied within the 2.2s window
  await page.waitForSelector("#world-ireland", { state: "attached", timeout: 5000 });
  // Scroll into view can take a moment · poll briefly for the focus class
  let hasFocusClass = false;
  for (let i = 0; i < 10; i++) {
    hasFocusClass = await page.evaluate(() =>
      document.getElementById("world-ireland")?.classList.contains("nex-hq-world-focus") ?? false,
    );
    if (hasFocusClass) break;
    await page.waitForTimeout(100);
  }
  // scrollIntoView({behavior:'smooth'}) is async · wait for scroll position
  // to settle before checking viewport (poll until two readings match).
  await page.evaluate(async () => {
    const el = document.getElementById("world-ireland");
    if (!el) return;
    let last = -1;
    for (let i = 0; i < 20; i++) {
      const t = el.getBoundingClientRect().top;
      if (Math.abs(t - last) < 0.5) return;
      last = t;
      await new Promise((r) => setTimeout(r, 100));
    }
  });
  const inViewport = await page.evaluate(() => {
    const el = document.getElementById("world-ireland");
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.top < window.innerHeight && r.bottom > 0;
  });
  if (url3.endsWith("/hq/worlds?focus=ireland") && hasFocusClass && inViewport) {
    record("3. Ireland click → navigate + highlight + scroll", "PASS",
      `URL=${url3} · focus-class=${hasFocusClass} · in-viewport=${inViewport}`);
  } else {
    record("3. Ireland click → navigate + highlight + scroll", "FAIL",
      `URL=${url3} · focus-class=${hasFocusClass} · in-viewport=${inViewport}`);
  }
  await page.screenshot({ path: join(OUT, "03-worlds-ireland-focus.png"), fullPage: false });

  // ---- Step 4 · Return to HQ Home ----------------------------------------
  await page.locator('aside >> a[href="/nex-native/hq"]').first().click();
  await page.waitForURL("**/nex-native/hq", { timeout: 10_000 });
  await page.waitForLoadState("networkidle");
  const back = page.url();
  const title4 = await page.locator('h1:visible').first().textContent().catch(() => null);
  if (back.endsWith("/nex-native/hq") && (title4 ?? "").includes("NEX HEADQUARTERS")) {
    record("4. Return to HQ Home via sidebar", "PASS", `URL=${back}`);
  } else {
    record("4. Return to HQ Home via sidebar", "FAIL", `URL=${back} · h1=${title4}`);
  }

  // ---- Step 5 · Click Indonesia -----------------------------------------
  const indonesiaLink = page.locator('a[href*="focus=indonesia"]').first();
  await indonesiaLink.click();
  await page.waitForURL("**/hq/worlds?focus=indonesia", { timeout: 10_000 });
  await page.waitForLoadState("networkidle");
  const url5 = page.url();
  await page.waitForSelector("#world-indonesia", { state: "attached", timeout: 5000 });
  let hasFocusClass5 = false;
  for (let i = 0; i < 10; i++) {
    hasFocusClass5 = await page.evaluate(() =>
      document.getElementById("world-indonesia")?.classList.contains("nex-hq-world-focus") ?? false,
    );
    if (hasFocusClass5) break;
    await page.waitForTimeout(100);
  }
  // Wait for smooth scroll to settle (same pattern as step 3)
  await page.evaluate(async () => {
    const el = document.getElementById("world-indonesia");
    if (!el) return;
    let last = -1;
    for (let i = 0; i < 20; i++) {
      const t = el.getBoundingClientRect().top;
      if (Math.abs(t - last) < 0.5) return;
      last = t;
      await new Promise((r) => setTimeout(r, 100));
    }
  });
  const inViewport5 = await page.evaluate(() => {
    const el = document.getElementById("world-indonesia");
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.top < window.innerHeight && r.bottom > 0;
  });
  if (url5.endsWith("/hq/worlds?focus=indonesia") && hasFocusClass5 && inViewport5) {
    record("5. Indonesia click → navigate + highlight + scroll", "PASS",
      `URL=${url5} · focus-class=${hasFocusClass5} · in-viewport=${inViewport5}`);
  } else {
    record("5. Indonesia click → navigate + highlight + scroll", "FAIL",
      `URL=${url5} · focus-class=${hasFocusClass5} · in-viewport=${inViewport5}`);
  }
  await page.screenshot({ path: join(OUT, "05-worlds-indonesia-focus.png"), fullPage: false });

  // ---- Step 6 · Sidebar navigation (HQ Home · Worlds · Harvest) ----------
  // Click HQ Home
  await page.locator('aside >> a[href="/nex-native/hq"]').first().click();
  await page.waitForURL("**/nex-native/hq", { timeout: 10_000 });
  await page.waitForLoadState("networkidle");
  const homeActive = await page.locator('aside >> a[aria-current="page"]').first().getAttribute("href");

  // Click Worlds
  await page.locator('aside >> a[href="/nex-native/hq/worlds"]').first().click();
  await page.waitForURL("**/hq/worlds", { timeout: 10_000 });
  await page.waitForLoadState("networkidle");
  const worldsActive = await page.locator('aside >> a[aria-current="page"]').first().getAttribute("href");

  // Click Harvest · may redirect to sign-in because harvest uses the strict
  // session resolver (not dev-impersonation). Owner's audit called this out
  // and said unauthorised users should remain blocked. We treat redirect-to
  // -sign-in as a PASS for this step (route is reachable; access gate
  // enforces; this is correct per code).
  await page.locator('aside >> a[href="/nex-native/hq/harvest"]').first().click();
  // Wait for either /harvest OR /sign-in
  await page.waitForFunction(() =>
    location.pathname.endsWith("/hq/harvest") || location.pathname.includes("sign-in"),
    { timeout: 10_000 },
  );
  await page.waitForLoadState("networkidle");
  const harvestLanding = page.url();

  const homeOk = homeActive === "/nex-native/hq";
  const worldsOk = worldsActive === "/nex-native/hq/worlds";
  const harvestOk = harvestLanding.includes("/hq/harvest") || harvestLanding.includes("sign-in");
  if (homeOk && worldsOk && harvestOk) {
    record("6. Sidebar nav Home/Worlds/Harvest + active state", "PASS",
      `home-active=${homeActive} · worlds-active=${worldsActive} · harvest→${harvestLanding}`);
  } else {
    record("6. Sidebar nav Home/Worlds/Harvest + active state", "FAIL",
      `home-active=${homeActive} · worlds-active=${worldsActive} · harvest→${harvestLanding}`);
  }

  // ---- Step 7 · Direct refresh preserves layout --------------------------
  for (const url of [`${BASE}/nex-native/hq`, `${BASE}/nex-native/hq/worlds`, `${BASE}/nex-native/hq/worlds?focus=ireland`]) {
    const r = await page.goto(url, { waitUntil: "networkidle" });
    const hasSidebar = await page.locator('aside[aria-label="NEX HQ navigation"]').isVisible().catch(() => false);
    if (r?.status() === 200 && hasSidebar) {
      record(`7. Refresh ${url.replace(BASE, "")} preserves layout`, "PASS",
        `HTTP ${r.status()} · sidebar=visible`);
    } else {
      record(`7. Refresh ${url.replace(BASE, "")} preserves layout`, "FAIL",
        `HTTP ${r?.status()} · sidebar=${hasSidebar}`);
    }
  }

  // ---- Step 8 · Desktop-only boundary 899 vs 900 -------------------------
  await page.setViewportSize({ width: 899, height: 900 });
  await page.goto(`${BASE}/nex-native/hq`, { waitUntil: "networkidle" });
  const mobileMsgVisible899 = await page.locator('text="NEX HQ is desktop-only"').first().isVisible().catch(() => false);
  const sidebarVisible899 = await page.locator('aside[aria-label="NEX HQ navigation"]').isVisible().catch(() => false);
  await page.screenshot({ path: join(OUT, "08a-boundary-899.png"), fullPage: false });

  await page.setViewportSize({ width: 900, height: 900 });
  await page.goto(`${BASE}/nex-native/hq`, { waitUntil: "networkidle" });
  const mobileMsgVisible900 = await page.locator('text="NEX HQ is desktop-only"').first().isVisible().catch(() => false);
  const sidebarVisible900 = await page.locator('aside[aria-label="NEX HQ navigation"]').isVisible().catch(() => false);
  await page.screenshot({ path: join(OUT, "08b-boundary-900.png"), fullPage: false });

  if (mobileMsgVisible899 && !sidebarVisible899 && !mobileMsgVisible900 && sidebarVisible900) {
    record("8. Desktop-only boundary (899 vs 900)", "PASS",
      `899: mobile-msg=${mobileMsgVisible899} sidebar=${sidebarVisible899} · 900: mobile-msg=${mobileMsgVisible900} sidebar=${sidebarVisible900}`);
  } else {
    record("8. Desktop-only boundary (899 vs 900)", "FAIL",
      `899: mobile-msg=${mobileMsgVisible899} sidebar=${sidebarVisible899} · 900: mobile-msg=${mobileMsgVisible900} sidebar=${sidebarVisible900}`);
  }

  // Back to desktop for closing assertions
  await page.setViewportSize({ width: 1440, height: 900 });

  // ---- Step 9 · Console errors + failed requests -------------------------
  if (consoleErrors.length === 0 && failedRequests.length === 0) {
    record("9. No console errors or failed requests", "PASS", "clean");
  } else {
    record("9. No console errors or failed requests", "FAIL",
      `console-errors=${consoleErrors.length} · failed-requests=${failedRequests.length}`,
      { consoleErrors, failedRequests });
  }

  // ---- Step 10 · Admin session preserved (no bypass) ---------------------
  // Navigate to /hq · if admin bypass were broken, we'd see a 404-like page
  // or the "This page could not be found" rendered. The h1 should still read
  // NEX HEADQUARTERS.
  await page.goto(`${BASE}/nex-native/hq`, { waitUntil: "networkidle" });
  const h1Final = await page.locator('h1:visible').first().textContent().catch(() => null);
  const impersonationBannerText = await page.locator('text=/Impersonating\\s+nex-99901/').first().textContent().catch(() => null);
  if ((h1Final ?? "").includes("NEX HEADQUARTERS") && impersonationBannerText) {
    record("10. Admin session preserved · no bypass", "PASS",
      `h1="${h1Final}" · impersonation="${impersonationBannerText.trim()}"`);
  } else {
    record("10. Admin session preserved · no bypass", "FAIL",
      `h1="${h1Final}" · impersonation="${impersonationBannerText}"`);
  }

  await browser.close();

  const summary = {
    commit: "ddfcc42",
    baseUrl: BASE,
    viewport: { width: 1440, height: 900 },
    verdict: fail === 0 ? "PASS" : "FAIL",
    pass,
    fail,
    results,
    consoleErrors,
    failedRequests,
  };
  writeFileSync(join(OUT, "hq-browser-acceptance-result.json"), JSON.stringify(summary, null, 2));
  console.log(`\nFinal verdict · ${summary.verdict} · pass=${pass} · fail=${fail}`);
  console.log(`Artefact · ${join(OUT, "hq-browser-acceptance-result.json")}`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("TEST SCRIPT ERROR:", err);
  process.exit(2);
});
