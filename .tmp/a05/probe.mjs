// .tmp/a05/probe.mjs
// Playwright probe to isolate the A05 blocker. Confirms:
//   1 · browser launches in-process (no install required)
//   2 · :3008 is reachable from a Playwright context
//   3 · /nex-native/settings/tier redirects to sign-in under clean cookies
//   4 · desktop (1280) + mobile (390) viewport captures work on sign-in
//      (a public page), proving tooling is available
// No founder cookies. No credentials. No POSTs. Read-only.
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";

const OUT = ".tmp/a05";
mkdirSync(OUT, { recursive: true });

const log = (k, v) => console.log(`${k}=${JSON.stringify(v)}`);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ storageState: undefined });
const requests = [];
const responses = [];

context.on("request", (r) =>
  requests.push({ method: r.method(), url: r.url(), ts: Date.now() }),
);
context.on("response", (r) =>
  responses.push({ status: r.status(), url: r.url() }),
);

const page = await context.newPage();
page.setDefaultTimeout(10000);

try {
  // 1 · Probe /settings/tier under clean cookies.
  const r1 = await page.goto(
    "http://localhost:3008/nex-native/settings/tier",
    { waitUntil: "domcontentloaded" },
  );
  log("tier.status", r1?.status() ?? null);
  log("tier.initial_url", page.url());
  // Honour any meta-refresh / client-side redirect before continuing.
  try {
    await page.waitForURL(
      (url) => !url.toString().endsWith("/settings/tier"),
      { timeout: 4000 },
    );
  } catch {
    // No redirect fired within 4s · the page is stable where it is.
  }
  await page.waitForLoadState("domcontentloaded", { timeout: 3000 }).catch(() => {});
  log("tier.after_settle_url", page.url());

  // 2 · Capture rendered HTML + body text snippets so we can confirm
  //     what the clean-cookie Playwright navigation actually landed on.
  const title = await page.title();
  log("tier.title", title);
  const html = await page.content();
  writeFileSync(`${OUT}/tier-rendered.html`, html);
  const bodyText = await page.evaluate(() =>
    (document.body?.innerText ?? "").slice(0, 2000),
  );
  writeFileSync(`${OUT}/tier-body-text.txt`, bodyText);
  // Flag whether the disclosure component actually mounted.
  const discloseCount = await page.locator(
    "[data-nex-shop-trial-pre-disclosure]",
  ).count();
  log("disclosure.mounted", discloseCount);
  // Desktop + 390 screenshots, without fullPage to avoid the font-load bug.
  try {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.waitForLoadState("networkidle", { timeout: 4000 }).catch(() => {});
    await page.screenshot({ path: `${OUT}/tier-desktop.png`, fullPage: false });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${OUT}/tier-390.png`, fullPage: false });
    log("screenshots", "ok");
  } catch (sErr) {
    log("screenshots.error", sErr?.message ?? String(sErr));
  }

  // 4 · Report the redirect chain + any POSTs captured (there should be
  //     ZERO POSTs since we never clicked anything).
  const posts = requests.filter((r) => r.method === "POST");
  log("posts.count", posts.length);
  log("posts.sample", posts.slice(0, 3));
  const checkoutHits = requests.filter((r) =>
    r.url.includes("/api/nex-native/billing/checkout/shop"),
  );
  log("checkout_post_requests.count", checkoutHits.length);

  writeFileSync(
    `${OUT}/probe-report.json`,
    JSON.stringify(
      {
        tier: {
          http: r1?.status() ?? null,
          final_url: page.url(),
        },
        posts: posts.length,
        checkout_posts: checkoutHits.length,
        screenshots: ["tier-desktop.png", "tier-390.png"],
        responses_sample: responses.slice(0, 10),
      },
      null,
      2,
    ),
  );
  console.log("OK · probe-report.json written");
} catch (e) {
  console.error("PROBE_ERROR", e?.message ?? String(e));
  writeFileSync(
    `${OUT}/probe-error.txt`,
    `${e?.stack ?? e?.message ?? String(e)}\n`,
  );
  process.exitCode = 2;
} finally {
  await context.close();
  await browser.close();
}
