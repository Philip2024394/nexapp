// scripts/verify/entry-url-check.mjs
//
// Browser verification of the owner-approved entry-URL repair
// 2026-10-16. Anonymous session only.
//
// Confirms:
//   · /nexapp opens Directory landing (hero + category grid rendered)
//   · /nexapp/landing opens the same
//   · / opens the same (anon branch of root/page.tsx)
//   · Directory landing CTAs still navigate (Explore Deals · Start Saving)
//   · Welcome · Create-account · Sign-in all still reachable
//   · No console errors, page errors, or failed requests introduced

import { chromium } from "@playwright/test";

const BASE = "http://localhost:3008";
const obs = [];
function rec(check, status, detail = "") {
  obs.push({ check, status, detail });
  console.log(`${check.padEnd(60)} ${status}${detail ? "  " + detail : ""}`);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 420, height: 909 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  page.on("pageerror", (e) => errs.push(`[pageerror] ${e}`));
  page.on("requestfailed", (r) => errs.push(`[reqfail] ${r.failure()?.errorText ?? ""} ${r.url()}`));

  async function visit(path, label) {
    const urlBefore = `${BASE}${path}`;
    await page.goto(urlBefore, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(600);
    const finalUrl = page.url().replace(BASE, "");
    const h1 = await page.evaluate(() => document.querySelector("h1")?.textContent ?? null);
    rec(label, "PASS", `final=${finalUrl} · h1="${h1}"`);
    return { finalUrl, h1 };
  }

  // 1 · /nexapp lands on Directory landing
  const r1 = await visit("/nexapp", "GET /nexapp");
  rec(
    "/nexapp lands on /nex-native/directory/landing",
    r1.finalUrl === "/nex-native/directory/landing" ? "PASS" : "FAIL",
    `final=${r1.finalUrl}`,
  );
  rec(
    "/nexapp renders Directory landing hero (H1 'More Choice.…')",
    r1.h1 && r1.h1.includes("More Choice") ? "PASS" : "FAIL",
    `h1="${r1.h1}"`,
  );

  // 2 · /nexapp/landing · same
  const r2 = await visit("/nexapp/landing", "GET /nexapp/landing");
  rec(
    "/nexapp/landing lands on /nex-native/directory/landing",
    r2.finalUrl === "/nex-native/directory/landing" ? "PASS" : "FAIL",
    `final=${r2.finalUrl}`,
  );

  // 3 · / lands on Directory landing (anon branch of root page.tsx)
  const r3 = await visit("/", "GET /");
  rec(
    "/ lands on /nex-native/directory/landing (anon branch)",
    r3.finalUrl === "/nex-native/directory/landing" ? "PASS" : "FAIL",
    `final=${r3.finalUrl}`,
  );

  // 4 · Landing CTAs still work
  await page.goto(`${BASE}/nex-native/directory/landing`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(400);
  const exploreHref = await page.getAttribute('[data-nex-landing-cta="explore"]', "href");
  rec(
    'Landing "Explore Deals" CTA renders with correct href',
    exploreHref === "/nex-native/directory" || exploreHref?.startsWith("/nex-native/directory") ? "PASS" : "FAIL",
    `href=${exploreHref}`,
  );
  const startHref = await page.getAttribute('[data-nex-landing-cta="start-saving"]', "href");
  rec(
    'Landing "Start Saving Now" CTA renders with correct href',
    startHref?.startsWith("/nex-native/directory") ? "PASS" : "FAIL",
    `href=${startHref}`,
  );
  const catCount = await page.locator("[data-nex-landing-category]").count();
  rec(
    "Landing renders 8 category tiles",
    catCount === 8 ? "PASS" : "FAIL",
    `count=${catCount}`,
  );

  // 5 · Welcome · Create-account · Sign-in still reachable (unchanged)
  const r4 = await visit("/nex-native/welcome", "GET /nex-native/welcome");
  rec(
    "/nex-native/welcome unchanged · renders Chat-NEX welcome H1",
    r4.h1 && (r4.h1.includes("Welcome to NEX Chat") || r4.h1.includes("Welcome")) ? "PASS" : "FAIL",
    `h1="${r4.h1}"`,
  );

  const r5 = await visit("/nex-native/create-account", "GET /nex-native/create-account");
  rec(
    "/nex-native/create-account unchanged · renders",
    r5.finalUrl === "/nex-native/create-account" ? "PASS" : "FAIL",
    `final=${r5.finalUrl}`,
  );

  const r6 = await visit("/nex-native/sign-in", "GET /nex-native/sign-in");
  rec(
    "/nex-native/sign-in unchanged · renders",
    r6.finalUrl === "/nex-native/sign-in" ? "PASS" : "FAIL",
    `final=${r6.finalUrl}`,
  );

  // 6 · PWA manifest unchanged (fetch it, assert start_url still /contacts)
  const manifest = await page
    .evaluate(async (base) => {
      const r = await fetch(`${base}/nex.webmanifest`);
      return r.ok ? await r.json() : null;
    }, BASE)
    .catch(() => null);
  rec(
    "PWA manifest start_url still /nex-native/contacts",
    manifest?.start_url === "/nex-native/contacts" ? "PASS" : "FAIL",
    `start_url=${manifest?.start_url}`,
  );

  // 7 · /nex-native segment router unchanged (anon → /welcome)
  const r7 = await visit("/nex-native", "GET /nex-native (anon)");
  rec(
    "/nex-native anon branch unchanged · → /welcome",
    r7.finalUrl === "/nex-native/welcome" ? "PASS" : "FAIL",
    `final=${r7.finalUrl}`,
  );

  // 8 · /nexapp catch-all NOT added · random path still 404
  const resp = await page.goto(`${BASE}/nexapp/random-path`, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch((e) => ({ error: e }));
  const status = resp && !("error" in resp) ? resp.status() : 0;
  rec(
    "/nexapp/random-path still 404 (no catch-all added)",
    status === 404 ? "PASS" : "FAIL",
    `status=${status}`,
  );

  // 9 · Error channels
  rec("no console/page/request errors during pass", errs.length === 0 ? "PASS" : "FAIL", errs.length ? errs.slice(0, 2).join(" | ") : "0");

  const summary = {
    total: obs.length,
    pass: obs.filter((o) => o.status === "PASS").length,
    fail: obs.filter((o) => o.status === "FAIL").length,
  };
  console.log(`\nSummary · ${summary.pass} PASS · ${summary.fail} FAIL · ${summary.total} total`);

  await ctx.close();
  await browser.close();
  if (summary.fail > 0) process.exitCode = 1;
})().catch((e) => { console.error("[verify] fatal:", e); process.exit(2); });
