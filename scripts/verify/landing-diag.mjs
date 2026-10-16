// scripts/verify/landing-diag.mjs
// One-shot diagnostic: load each candidate "landing" URL in a real
// browser and capture all errors + visible state. Owner directive
// 2026-10-16 · "nexapp landing page is not opening".
import { chromium } from "@playwright/test";

const BASE = "http://localhost:3008";
const URLS = [
  "/nex-native",
  "/nex-native/welcome",
  "/nex-native/home",
  "/nex-native/landing",
  "/nex-native/directory/landing",
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 420, height: 909 },
  });
  const page = await context.newPage();

  for (const u of URLS) {
    const consoleErr = [];
    const pageErr = [];
    const reqFail = [];
    const h404 = [];
    const sub = (msg) => {
      if (msg.type() === "error") consoleErr.push(msg.text());
    };
    const subPage = (e) => pageErr.push(String(e).slice(0, 160));
    const subFail = (r) =>
      reqFail.push(`${r.failure()?.errorText ?? ""} ${r.url()}`);
    const sub404 = (r) => {
      if (r.status() >= 400) h404.push(`${r.status()} ${r.url()}`);
    };
    page.on("console", sub);
    page.on("pageerror", subPage);
    page.on("requestfailed", subFail);
    page.on("response", sub404);

    console.log(`\n== ${u} ==`);
    const t0 = Date.now();
    const resp = await page
      .goto(`${BASE}${u}`, { waitUntil: "domcontentloaded", timeout: 60_000 })
      .catch((e) => ({ error: String(e).slice(0, 160) }));
    const t1 = Date.now();
    if (resp && "error" in resp) {
      console.log(`  goto FAILED · ${resp.error}`);
    } else {
      console.log(
        `  goto HTTP ${resp?.status()} · ${t1 - t0}ms · url=${page.url().replace(BASE, "")}`,
      );
    }
    // Wait a beat for any client-side hydration errors
    await page.waitForTimeout(1500);

    // Snapshot visible state
    const diag = await page.evaluate(() => {
      const body = document.body;
      const html = document.documentElement;
      const main = document.querySelector("main");
      const h1 = document.querySelector("h1");
      const errOverlay =
        document.querySelector("#__next-build-watcher, nextjs-portal, [data-nextjs-dialog]")?.outerHTML?.slice(0, 400) ??
        null;
      return {
        htmlClass: html.className,
        bodyChildren: body?.children?.length ?? 0,
        bodyText: (body?.innerText ?? "").trim().slice(0, 160),
        mainPresent: !!main,
        h1Text: h1?.textContent ?? null,
        errOverlay,
        docReady: document.readyState,
      };
    });
    console.log(
      `  bodyChildren=${diag.bodyChildren} main=${diag.mainPresent} h1="${diag.h1Text}" ready=${diag.docReady}`,
    );
    console.log(`  bodyText[0..160]: "${diag.bodyText}"`);
    if (diag.errOverlay) console.log(`  NEXT ERROR OVERLAY: ${diag.errOverlay}`);
    console.log(`  console.error count: ${consoleErr.length}`);
    for (const e of consoleErr.slice(0, 3)) console.log(`    · ${e.slice(0, 160)}`);
    console.log(`  pageerror count: ${pageErr.length}`);
    for (const e of pageErr.slice(0, 3)) console.log(`    · ${e}`);
    console.log(`  requestfailed count: ${reqFail.length}`);
    for (const e of reqFail.slice(0, 3)) console.log(`    · ${e.slice(0, 160)}`);
    console.log(`  >=400 responses: ${h404.length}`);
    for (const e of h404.slice(0, 3)) console.log(`    · ${e.slice(0, 160)}`);

    page.off("console", sub);
    page.off("pageerror", subPage);
    page.off("requestfailed", subFail);
    page.off("response", sub404);
  }
  await context.close();
  await browser.close();
})().catch((e) => {
  console.error("[diag] fatal:", e);
  process.exit(2);
});
