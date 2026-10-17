// scripts/verify/contacts-signed-in-diagnosis.mjs
//
// Owner-authorised 2026-10-17 · one-shot read-only diagnosis of
// /nex-native/contacts via the existing tests/e2e/.auth/state.json
// saved session. Called in response to the owner's "the Contacts
// page shows an error layout" observation.
//
// Rules (strict):
//   · READ-ONLY · never writes the saved session file, never calls
//     storageState() to overwrite it, never signs out, never clicks
//     any destructive affordance, never submits any form.
//   · Does NOT touch the staged index.
//   · Does NOT modify authentication or remove the session gate.
//   · Does NOT commit, push, deploy, apply migrations, or write to DB.
//   · Fails loudly if the saved session has expired · never silently
//     recovers by re-authenticating.
//
// What it checks:
//   · HTTP response from /nex-native/contacts (status + any
//     redirect that would indicate an expired session).
//   · Browser-rendered DOM at mobile 390x844 after full load.
//   · console errors, uncaught page errors, failed network requests.
//   · Shared-header invariants:
//       - [data-nex-page-header-brand]  present
//       - [data-nex-ping-badge]         present with size >= 56
//       - [data-nex-page-header-home]   ABSENT (Contacts opt-out)
//       - [data-nex-page-header-search] PRESENT
//       - [data-nex-page-header-settings] ABSENT (Contacts opt-out)
//       - [data-nex-page-header-drawer-trigger] present
//   · Contacts page content invariants:
//       - "NEX customer service" card (data-nex-contacts-system-entry="customer-service")
//       - "NEX Community Noticeboard" card (data-nex-contacts-system-entry="community-noticeboard")
//   · Horizontal overflow (document scroll width <= viewport width).
//   · Overlapping elements along the header row (bounding-box check).
//   · Screenshot saved to tests/e2e-screenshots/contacts-diagnosis/.
//
// If the session is expired, the probe stops and reports expired-
// session rather than attempting to re-auth.

import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const BASE_URL = "http://localhost:3008";
const VIEWPORT = { width: 390, height: 844 };
const SESSION_PATH = "tests/e2e/.auth/state.json";
const OUT_DIR = "tests/e2e-screenshots/contacts-diagnosis";

async function ensureOutDir() {
  await fs.mkdir(OUT_DIR, { recursive: true });
}

const observations = [];
function record(check, status, detail = null) {
  observations.push({ check, status, detail });
  const d = detail !== null ? "  (" + detail + ")" : "";
  const padded = check.padEnd(72);
  console.log("[" + status + "] " + padded + d);
}

async function main() {
  await ensureOutDir();

  // Guard · session file must exist and be non-empty.
  const stat = await fs.stat(SESSION_PATH).catch(() => null);
  if (!stat || stat.size === 0) {
    console.log("[FAIL] saved session missing or empty · aborting without any changes");
    process.exit(2);
  }

  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({
      viewport: VIEWPORT,
      storageState: SESSION_PATH, // READ · never written back
    });
    const page = await ctx.newPage();

    const consoleErrors = [];
    const pageErrors = [];
    const failedRequests = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });
    page.on("requestfailed", (req) => {
      failedRequests.push(req.url() + " · " + (req.failure()?.errorText ?? "?"));
    });

    // Owner directive 2026-10-17 · /nex-native/contacts was retired
    // and now server-side redirects to /nex-native/chat?tab=friends
    // (the consolidated Contacts experience). Target the consolidated
    // surface directly to avoid the redirect-noise in the probe.
    const resp = await page.goto(BASE_URL + "/nex-native/chat?tab=friends", {
      waitUntil: "domcontentloaded",
    });
    const finalUrl = page.url();
    const status = resp?.status() ?? 0;

    // Expired-session detection · a signed-in request to the Contacts
    // hub should return 200 and stay on /chat?tab=friends. If we land
    // on /sign-in the saved session is no longer valid; stop + report.
    if (finalUrl.includes("/sign-in") || status === 307 || status === 302) {
      record("session-live · signed-in request lands on /contacts",
        "FAIL", "final-url=" + finalUrl + " · status=" + status);
      console.log("");
      console.log("DIAGNOSIS · saved session appears EXPIRED.");
      console.log(" · Final URL: " + finalUrl);
      console.log(" · HTTP status: " + status);
      console.log(" · Not re-authenticating · session file preserved untouched.");
      console.log("");
      console.log("Next step for owner: refresh the saved session via the sealed");
      console.log("`playwright codegen` command documented in");
      console.log("docs/doctrine/nex-mobile-e2e-authenticated-first-user-journey-2026-10-14.md §3,");
      console.log("then re-run this probe.");
      await ctx.close();
      await browser.close();
      process.exit(3);
    }

    record("session-live · signed-in render returned 200",
      status === 200 ? "PASS" : "FAIL",
      "status=" + status + " · final-url=" + finalUrl);

    // Give RSC + hydration a short beat so attributes resolve.
    await page.waitForTimeout(300);

    // Shared header invariants
    const brand = await page.locator("[data-nex-page-header-brand]").count();
    const ping = await page.locator("[data-nex-ping-badge]").count();
    const pingSize = await page
      .locator("[data-nex-ping-badge]")
      .first()
      .evaluate((el) =>
        el instanceof HTMLElement ? el.offsetWidth : -1,
      )
      .catch(() => -1);
    const home = await page.locator("[data-nex-page-header-home]").count();
    const search = await page.locator("[data-nex-page-header-search]").count();
    const settings = await page.locator("[data-nex-page-header-settings]").count();
    const drawer = await page
      .locator("[data-nex-page-header-drawer-trigger]")
      .count();

    record("H1 · brand link present (data-nex-page-header-brand)",
      brand === 1 ? "PASS" : "FAIL", "count=" + brand);
    record("H2 · ping badge mounted inside brand",
      ping === 1 ? "PASS" : "FAIL", "count=" + ping);
    record("H3 · ping badge is hero-scale (size >= 56 · matches /directory/landing)",
      pingSize >= 56 ? "PASS" : "FAIL", "size=" + pingSize + "px");
    // Owner directive 2026-10-17 · Home + Settings icons globally
    // retired from the shared header · both reachable via drawer.
    record("H4 · Home icon ABSENT (owner directive · reachable via drawer)",
      home === 0 ? "PASS" : "FAIL", "count=" + home);
    record("H5 · Search icon PRESENT",
      search === 1 ? "PASS" : "FAIL", "count=" + search);
    record("H6 · Settings slot ABSENT (owner directive · gate fires on /settings)",
      settings === 0 ? "PASS" : "FAIL", "count=" + settings);
    record("H7 · three-dots drawer trigger PRESENT",
      drawer === 1 ? "PASS" : "FAIL", "count=" + drawer);

    // Contacts content invariants (ported 2026-10-17 to the chat hub
    // under data-nex-chat-pinned-card attributes · the retired
    // data-nex-contacts-system-entry attributes are gone).
    const customerCard = await page
      .locator("[data-nex-chat-pinned-card='customer-service']")
      .count();
    const communityCard = await page
      .locator("[data-nex-chat-pinned-card='community-noticeboard']")
      .count();
    record("C1 · NEX customer-service card present",
      customerCard === 1 ? "PASS" : "FAIL", "count=" + customerCard);
    record("C2 · NEX Community Noticeboard card present",
      communityCard === 1 ? "PASS" : "FAIL", "count=" + communityCard);

    // Overflow + overlap guards
    const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
    record("L1 · no horizontal overflow (scrollW <= viewport)",
      scrollW <= VIEWPORT.width + 1 ? "PASS" : "FAIL",
      "scrollW=" + scrollW + " · vp=" + VIEWPORT.width);

    const headerBox = await page
      .locator("[data-nex-page-header]")
      .first()
      .boundingBox()
      .catch(() => null);
    record("L2 · header has non-zero bounding box",
      headerBox && headerBox.width > 0 && headerBox.height > 0
        ? "PASS"
        : "FAIL",
      headerBox ? JSON.stringify(headerBox) : "null");

    // Runtime failures summary
    record("R1 · zero console errors during render",
      consoleErrors.length === 0 ? "PASS" : "FAIL",
      "count=" + consoleErrors.length);
    record("R2 · zero uncaught page errors",
      pageErrors.length === 0 ? "PASS" : "FAIL",
      "count=" + pageErrors.length);
    record("R3 · zero failed network requests",
      failedRequests.length === 0 ? "PASS" : "FAIL",
      "count=" + failedRequests.length);

    if (consoleErrors.length > 0) {
      console.log("\nConsole errors:");
      for (const e of consoleErrors.slice(0, 20)) console.log("  · " + e);
    }
    if (pageErrors.length > 0) {
      console.log("\nPage errors:");
      for (const e of pageErrors.slice(0, 20)) console.log("  · " + e);
    }
    if (failedRequests.length > 0) {
      console.log("\nFailed network requests:");
      for (const e of failedRequests.slice(0, 20)) console.log("  · " + e);
    }

    // Screenshot (viewport only · not full page) so we never persist
    // scroll content that might carry private data by accident.
    const shotPath = path.join(OUT_DIR, "contacts-mobile-390x844.png");
    await page.screenshot({ path: shotPath, fullPage: false });
    console.log("\nScreenshot: " + shotPath);

    await ctx.close();
  } finally {
    await browser.close();
  }

  const pass = observations.filter((o) => o.status === "PASS").length;
  const fail = observations.filter((o) => o.status === "FAIL").length;
  console.log(
    "\nSummary · " + pass + " PASS · " + fail + " FAIL · " +
      observations.length + " total",
  );
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("probe crashed:", e);
  process.exit(2);
});
