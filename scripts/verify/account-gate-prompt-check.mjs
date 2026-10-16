// scripts/verify/account-gate-prompt-check.mjs
//
// Read-only, anonymous-session verification of the sealed
// CreateAccountPrompt modal · owner directive 2026-10-16 (post
// Rank 1-3 repair pass).
//
// Scope strictly limited to what the owner authorised:
//   · open the prompt from the Search settings icon
//   · check layout at mobile (390x844) + desktop (1280x900)
//   · test close via normal (non-forced) backdrop click
//   · test close via Escape key
//   · test close via "Not now" button
//   · click "Create account" → verify navigation to /nex-native/create-account
//   · verify Search is usable again after closing
//   · screenshots + console errors
//
// Does NOT · modify production accounts, redesign the modal, touch
// middleware / caching / rendering, commit, push, migrate.

import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const BASE_URL = "http://localhost:3008";
const OUT = "tests/e2e-screenshots/account-gate-prompt";

const observations = [];
function record(viewport, check, status, detail = null) {
  observations.push({ viewport, check, status, detail });
  console.log(
    `[${viewport}] ${check.padEnd(60)} ${status}${detail ? `  (${detail})` : ""}`,
  );
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
}

async function verify(browser, vp) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const requestFailures = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  page.on("requestfailed", (r) =>
    requestFailures.push(`${r.failure()?.errorText ?? ""} ${r.url()}`),
  );

  // ─── Navigate to /search ────────────────────────────────────────
  await page.goto(`${BASE_URL}/nex-native/search`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  // Search may have the HardLocationGate overlay on top of everything
  // for anonymous visitors. We need to dismiss it (or verify the
  // settings icon is reachable even with the gate open). The gate is
  // a separate component · we just note it and move on.
  const hardGate = await page
    .locator('[data-nex-hard-location-gate], [role="dialog"]')
    .count();
  record(
    vp.name,
    `baseline · /search loaded · HardLocationGate present=${hardGate >= 1}`,
    "PASS",
  );
  await shot(page, `${vp.name}-00-search-baseline`);

  // ─── Try to click the settings icon ─────────────────────────────
  // The settings icon may be behind the HardLocationGate overlay.
  // Use evaluate-click to bypass pointer-events chain for this test
  // (we're verifying the modal behaviour, not the gate).
  await page.evaluate(() => {
    const btn = document.querySelector(
      '[data-nex-page-header-settings][data-nex-settings-locked="true"]',
    );
    if (btn instanceof HTMLElement) btn.click();
  });
  await page
    .waitForSelector('[data-testid="nex-create-account-prompt"]', {
      timeout: 5_000,
    })
    .catch(() => {});
  const promptCount = await page
    .locator('[data-testid="nex-create-account-prompt"]')
    .count();
  record(
    vp.name,
    "prompt opens from Search settings icon",
    promptCount === 1 ? "PASS" : "FAIL",
    `count=${promptCount}`,
  );
  if (promptCount === 0) {
    await context.close();
    return;
  }
  await shot(page, `${vp.name}-01-prompt-open`);

  // ─── Visual sanity · dialog bounds + title/body + both buttons ─
  const title = await page
    .locator('[data-testid="nex-create-account-prompt"] h2')
    .innerText();
  const dialogBox = await page
    .locator('[data-testid="nex-create-account-prompt"]')
    .boundingBox();
  const titleOk =
    title.includes("Create your NEX account") ||
    title.includes("Finish creating your NEX account");
  record(
    vp.name,
    "prompt title reads the anonymous or finish-setup variant",
    titleOk ? "PASS" : "FAIL",
    `title="${title}"`,
  );
  // Owner clarification 2026-10-16 · the `maxWidth: 420` on the modal
  // applies to the CSS content box, NOT the border-box returned by
  // getBoundingClientRect (which includes padding + border). Measure
  // the content width directly (clientWidth minus horizontal padding
  // minus horizontal border) and assert that against 420 so we test
  // the intended CSS constraint rather than a derived outer value.
  const contentWidth = await page.evaluate(() => {
    const el = document.querySelector(
      '[data-testid="nex-create-account-prompt"]',
    );
    if (!el) return null;
    const cs = getComputedStyle(el);
    const padL = parseFloat(cs.paddingLeft) || 0;
    const padR = parseFloat(cs.paddingRight) || 0;
    const bordL = parseFloat(cs.borderLeftWidth) || 0;
    const bordR = parseFloat(cs.borderRightWidth) || 0;
    // clientWidth already excludes border; subtract padding to get content.
    return {
      contentWidth: el.clientWidth - padL - padR,
      pads: padL + padR,
      borders: bordL + bordR,
      boxSizing: cs.boxSizing,
      outer: el.getBoundingClientRect().width,
    };
  });
  const okContent =
    contentWidth !== null && contentWidth.contentWidth <= 420 && dialogBox !== null && dialogBox.height > 0;
  record(
    vp.name,
    "dialog CONTENT box (maxWidth: 420 target) is <= 420",
    okContent ? "PASS" : "FAIL",
    contentWidth
      ? `content=${contentWidth.contentWidth}px · pad=${contentWidth.pads}px · bord=${contentWidth.borders}px · outer=${contentWidth.outer}px · box-sizing=${contentWidth.boxSizing}`
      : "no element",
  );
  const primaryText = await page
    .locator('[data-testid="nex-create-account-prompt-primary"]')
    .innerText();
  const dismissText = await page
    .locator('[data-testid="nex-create-account-prompt-dismiss"]')
    .innerText();
  record(
    vp.name,
    `primary CTA renders · text="${primaryText}"`,
    /create account|finish setup/i.test(primaryText) ? "PASS" : "FAIL",
  );
  record(
    vp.name,
    `dismiss CTA renders · text="${dismissText}"`,
    /not now/i.test(dismissText) ? "PASS" : "FAIL",
  );

  // ─── Close via Escape ───────────────────────────────────────────
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  let afterEsc = await page
    .locator('[data-testid="nex-create-account-prompt"]')
    .count();
  record(
    vp.name,
    "Escape key closes the prompt",
    afterEsc === 0 ? "PASS" : "FAIL",
    `remaining=${afterEsc}`,
  );

  // ─── Reopen and close via "Not now" button ──────────────────────
  await page.evaluate(() => {
    const btn = document.querySelector(
      '[data-nex-page-header-settings][data-nex-settings-locked="true"]',
    );
    if (btn instanceof HTMLElement) btn.click();
  });
  await page
    .waitForSelector('[data-testid="nex-create-account-prompt"]', {
      timeout: 5_000,
    })
    .catch(() => {});
  // Normal click, no force.
  try {
    await page
      .locator('[data-testid="nex-create-account-prompt-dismiss"]')
      .click({ timeout: 3_000 });
    record(vp.name, '"Not now" button clickable (normal click)', "PASS");
  } catch (e) {
    record(
      vp.name,
      '"Not now" button clickable (normal click)',
      "FAIL",
      String(e).slice(0, 80),
    );
  }
  await page.waitForTimeout(200);
  const afterNotNow = await page
    .locator('[data-testid="nex-create-account-prompt"]')
    .count();
  record(
    vp.name,
    '"Not now" closes the prompt',
    afterNotNow === 0 ? "PASS" : "FAIL",
    `remaining=${afterNotNow}`,
  );

  // ─── Reopen and close via backdrop click (NORMAL click) ─────────
  await page.evaluate(() => {
    const btn = document.querySelector(
      '[data-nex-page-header-settings][data-nex-settings-locked="true"]',
    );
    if (btn instanceof HTMLElement) btn.click();
  });
  await page
    .waitForSelector('[data-testid="nex-create-account-prompt"]', {
      timeout: 5_000,
    })
    .catch(() => {});
  // Click the backdrop at a coord known to be OUTSIDE the dialog.
  // The dialog is centered + maxWidth 420 · click at (10, 10) which
  // is far outside the dialog bounds on both viewports.
  let backdropClickOk = false;
  try {
    await page
      .locator("[data-nex-account-gate-backdrop]")
      .click({ position: { x: 10, y: 10 }, timeout: 3_000 });
    backdropClickOk = true;
    record(vp.name, "backdrop clickable (normal click, no force)", "PASS");
  } catch (e) {
    record(
      vp.name,
      "backdrop clickable (normal click, no force)",
      "FAIL",
      String(e).slice(0, 80),
    );
  }
  await page.waitForTimeout(200);
  const afterBackdrop = await page
    .locator('[data-testid="nex-create-account-prompt"]')
    .count();
  record(
    vp.name,
    "backdrop click closes the prompt",
    afterBackdrop === 0 ? "PASS" : "FAIL",
    `remaining=${afterBackdrop} · clickOk=${backdropClickOk}`,
  );

  // ─── Clicking inside the dialog MUST NOT close ──────────────────
  await page.evaluate(() => {
    const btn = document.querySelector(
      '[data-nex-page-header-settings][data-nex-settings-locked="true"]',
    );
    if (btn instanceof HTMLElement) btn.click();
  });
  await page
    .waitForSelector('[data-testid="nex-create-account-prompt"]', {
      timeout: 5_000,
    })
    .catch(() => {});
  // Click on the title (inside dialog) · should NOT close.
  await page
    .locator('[data-testid="nex-create-account-prompt"] h2')
    .click({ timeout: 3_000 })
    .catch(() => {});
  await page.waitForTimeout(200);
  const stillOpen = await page
    .locator('[data-testid="nex-create-account-prompt"]')
    .count();
  record(
    vp.name,
    "click INSIDE dialog does NOT close prompt (backdrop guard)",
    stillOpen === 1 ? "PASS" : "FAIL",
    `remaining=${stillOpen}`,
  );
  // Clean up · press Escape before next step.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);

  // ─── Reopen and click "Create account" primary → verify nav ────
  await page.evaluate(() => {
    const btn = document.querySelector(
      '[data-nex-page-header-settings][data-nex-settings-locked="true"]',
    );
    if (btn instanceof HTMLElement) btn.click();
  });
  await page
    .waitForSelector('[data-testid="nex-create-account-prompt"]', {
      timeout: 5_000,
    })
    .catch(() => {});
  await shot(page, `${vp.name}-02-prompt-reopen`);
  const t0 = Date.now();
  let navOk = false;
  try {
    await Promise.all([
      page.waitForURL(/\/nex-native\/create-account/, { timeout: 20_000 }),
      page
        .locator('[data-testid="nex-create-account-prompt-primary"]')
        .click({ timeout: 3_000 }),
    ]);
    navOk = true;
    record(
      vp.name,
      "primary CTA navigates to /nex-native/create-account",
      "PASS",
      `${Date.now() - t0} ms · landed on ${page.url().replace(BASE_URL, "")}`,
    );
  } catch (e) {
    record(
      vp.name,
      "primary CTA navigates to /nex-native/create-account",
      "FAIL",
      String(e).slice(0, 80),
    );
  }
  await shot(page, `${vp.name}-03-create-account-landed`);

  // ─── Return to Search and verify it's usable ────────────────────
  await page.goto(`${BASE_URL}/nex-native/search`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  const searchAliveSearch = await page
    .locator('[data-nex-page-header-search], input[type="search"], [data-nex-discover-root]')
    .count();
  record(
    vp.name,
    "returning to /search renders a usable surface (header or discover root present)",
    searchAliveSearch >= 1 ? "PASS" : "FAIL",
    `markers=${searchAliveSearch}`,
  );
  await shot(page, `${vp.name}-04-search-after-close`);

  // ─── Errors ─────────────────────────────────────────────────────
  record(
    vp.name,
    "no console errors during verification",
    consoleErrors.length === 0 ? "PASS" : "FAIL",
    consoleErrors.length
      ? consoleErrors.slice(0, 2).join(" | ")
      : "0",
  );
  record(
    vp.name,
    "no uncaught page errors during verification",
    pageErrors.length === 0 ? "PASS" : "FAIL",
    pageErrors.length ? pageErrors.slice(0, 2).join(" | ") : "0",
  );
  record(
    vp.name,
    "no failed network requests during verification",
    requestFailures.length === 0 ? "PASS" : "FAIL",
    requestFailures.length
      ? requestFailures.slice(0, 2).join(" | ")
      : "0",
  );

  await context.close();
}

(async () => {
  await fs.mkdir(OUT, { recursive: true });
  const health = await fetch(`${BASE_URL}/nex-native/search`);
  if (!health.ok) throw new Error(`dev server HTTP ${health.status}`);
  console.log(`[preflight] dev server HTTP ${health.status}`);

  const browser = await chromium.launch({ headless: true });
  try {
    for (const vp of [
      { name: "mobile-390", width: 390, height: 844 },
      { name: "desktop-1280", width: 1280, height: 900 },
    ]) {
      console.log(`\n== ${vp.name} ==`);
      await verify(browser, vp);
    }
  } finally {
    await browser.close();
  }

  const summary = {
    total: observations.length,
    pass: observations.filter((o) => o.status === "PASS").length,
    fail: observations.filter((o) => o.status === "FAIL").length,
  };
  console.log(
    `\nSummary · ${summary.pass} PASS · ${summary.fail} FAIL · ${summary.total} total`,
  );
  await fs.writeFile(
    path.join(OUT, "report.json"),
    JSON.stringify({ summary, observations }, null, 2),
    "utf8",
  );
  if (summary.fail > 0) process.exitCode = 1;
})().catch((e) => {
  console.error("[verify] fatal:", e);
  process.exit(2);
});
