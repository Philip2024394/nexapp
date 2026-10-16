// scripts/verify/travel-tile-probe.mjs
//
// Focused diagnostic · the landing-page "Travel" category tile was
// reported BROKEN by the click-audit harness. Investigate using a
// normal Playwright click, record URL before + after, listen for
// navigation events, collect console errors, and probe the actual
// destination response.
//
// Not a product change · investigation only.

import { chromium } from "@playwright/test";

const BASE_URL = "http://localhost:3008";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const reqFailures = [];
  const navEvents = [];
  const responses = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  page.on("requestfailed", (r) =>
    reqFailures.push(`${r.failure()?.errorText ?? ""} ${r.url()}`),
  );
  page.on("framenavigated", (f) => {
    if (f === page.mainFrame()) navEvents.push(`navigated: ${f.url()}`);
  });
  page.on("response", (r) => {
    const url = r.url();
    if (url.includes("/nex-native/directory/travel")) {
      responses.push(`${r.status()} ${url}`);
    }
  });

  console.log("1 · Load landing page");
  await page.goto(`${BASE_URL}/nex-native/directory/landing`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  console.log(`   URL after goto: ${page.url()}`);

  console.log("2 · Confirm Travel tile exists + has correct href");
  const travel = page.locator('[data-nex-landing-category="travel"]');
  const count = await travel.count();
  const href = await travel.getAttribute("href");
  const text = (await travel.innerText()).trim();
  const box = await travel.boundingBox();
  console.log(`   count=${count}  href=${href}  text="${text}"  box=${JSON.stringify(box)}`);

  console.log("3 · elementFromPoint at tile center · is Travel topmost?");
  const topmost = await page.evaluate(() => {
    const el = document.querySelector('[data-nex-landing-category="travel"]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cx = r.x + r.width / 2;
    const cy = r.y + r.height / 2;
    const top = document.elementFromPoint(cx, cy);
    return top
      ? {
          tag: top.tagName,
          dataNex: top.getAttribute("data-nex-landing-category"),
          href: top.getAttribute("href"),
          isTravelLink: top === el || el.contains(top),
        }
      : null;
  });
  console.log(`   topmost=${JSON.stringify(topmost)}`);

  console.log("4 · Normal click (NOT force) + wait for URL change");
  const urlBefore = page.url();
  const t0 = Date.now();
  let navOk = false;
  let err = null;
  try {
    await Promise.all([
      page.waitForURL(/\/nex-native\/directory\/travel/, { timeout: 15_000 }),
      travel.click({ timeout: 5_000 }),
    ]);
    navOk = true;
  } catch (e) {
    err = String(e).slice(0, 200);
  }
  const t1 = Date.now();
  const urlAfter = page.url();
  console.log(`   urlBefore: ${urlBefore}`);
  console.log(`   urlAfter:  ${urlAfter}`);
  console.log(`   navOk=${navOk}  elapsed=${t1 - t0}ms  err=${err ?? "(none)"}`);
  console.log(`   nav events: ${JSON.stringify(navEvents)}`);
  console.log(`   /travel responses: ${JSON.stringify(responses)}`);

  console.log("5 · Verify destination renders (console/page/request errors?)");
  console.log(`   console.error count: ${consoleErrors.length}`);
  if (consoleErrors.length) console.log(`      ${consoleErrors[0]}`);
  console.log(`   pageerror count: ${pageErrors.length}`);
  if (pageErrors.length) console.log(`      ${pageErrors[0]}`);
  console.log(`   requestfailed count: ${reqFailures.length}`);
  if (reqFailures.length) console.log(`      ${reqFailures[0]}`);

  console.log("6 · Raw curl check · HTTP + timing on /directory/travel");
  // Fallback: a raw fetch to confirm server returns 200 for the route.
  const r = await fetch(`${BASE_URL}/nex-native/directory/travel`);
  console.log(`   fetch HTTP ${r.status}  content-length=${r.headers.get("content-length") ?? "?"}`);

  await context.close();
  await browser.close();
})();
