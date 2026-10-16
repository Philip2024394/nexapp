// scripts/verify/pagination-live-check.mjs
//
// NEX pagination · live-check at 360 px + 390 px per owner directive
// 2026-10-16 (pagination second-pass review).
// --------------------------------------------------------------------
// Verifies:
//   · Left arrow is disabled (span, not Link) on page 1.
//   · Clicking right arrow updates URL ?page=N AND the visible page
//     count number.
//   · Clicking left arrow decrements.
//   · Pagination hides when 0 rows AND when only 1 page of rows.
//   · Touch targets at both arrows are >= 44×44 (owner's mobile
//     comfort target).
//   · First / middle / last page states observable.
//
// Preconditions:
//   · Dev server already running on http://localhost:3008.
//   · No login required (/nex-native/directory is public).

import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const BASE_URL = "http://localhost:3008";
const OUT_DIR = "tests/e2e-screenshots/pagination-live-check";

const VIEWPORTS = [
  { name: "mobile-360", width: 360, height: 800, deviceScaleFactor: 2 },
  { name: "mobile-390", width: 390, height: 844, deviceScaleFactor: 2 },
];

const observations = [];
function record(viewport, check, status, detail = null) {
  const row = { viewport, check, status, detail };
  observations.push(row);
  const pad = `[${viewport}] ${check}`.padEnd(70);
  console.log(`${pad} ${status}${detail ? `  (${detail})` : ""}`);
}

async function ensureOutDir() {
  await fs.mkdir(OUT_DIR, { recursive: true });
}

async function screenshot(page, name) {
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

async function verifyPagination(browser, vp) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.deviceScaleFactor,
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });

  // ─── Page 1 · verify left-arrow disabled + right-arrow present ──
  await page.goto(`${BASE_URL}/nex-native/directory`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await page
    .waitForSelector("[data-nex-directory-pagination]", { timeout: 10_000 })
    .catch(() => {});
  await screenshot(page, `${vp.name}-01-page-1`);

  const paginationCount = await page
    .locator("[data-nex-directory-pagination]")
    .count();
  record(
    vp.name,
    "pagination mounts when results exist",
    paginationCount >= 1 ? "PASS" : "NOT VERIFIED",
    `nav count=${paginationCount}`,
  );

  if (paginationCount === 0) {
    // No pagination = no results OR only one page · acceptable per
    // owner's "do not suggest pages exist" rule, but we can't test
    // interaction without data. Record and continue.
    record(
      vp.name,
      "cannot test interaction · no pagination mounted",
      "NOT VERIFIED",
      "need > pageSize rows for interaction tests",
    );
    await context.close();
    return;
  }

  const prevDisabled = await page
    .locator("[data-nex-directory-prev-disabled]")
    .count();
  const prevLink = await page.locator("[data-nex-directory-prev]").count();
  record(
    vp.name,
    "left arrow is DISABLED span (not Link) on page 1",
    prevDisabled === 1 && prevLink === 0 ? "PASS" : "FAIL",
    `disabled-span=${prevDisabled} prev-link=${prevLink}`,
  );

  // Visible page number on page 1
  const pageNumPage1 = await page
    .locator("[data-nex-directory-page-current]")
    .innerText();
  record(
    vp.name,
    "visible page number reads '1' on first page",
    pageNumPage1.trim() === "1" ? "PASS" : "FAIL",
    `text=${pageNumPage1.trim()}`,
  );

  // Measure touch-target bounding boxes
  const nextBox = await page
    .locator("[data-nex-directory-next]")
    .boundingBox()
    .catch(() => null);
  if (nextBox) {
    const okSize = nextBox.width >= 44 && nextBox.height >= 44;
    record(
      vp.name,
      "right arrow touch target >= 44x44",
      okSize ? "PASS" : "FAIL",
      `${nextBox.width}x${nextBox.height}`,
    );
  } else {
    record(
      vp.name,
      "right arrow touch target >= 44x44",
      "NOT VERIFIED",
      "right-arrow not present (only 1 page of results)",
    );
  }
  const prevBox = await page
    .locator("[data-nex-directory-prev-disabled]")
    .boundingBox()
    .catch(() => null);
  if (prevBox) {
    const okSize = prevBox.width >= 44 && prevBox.height >= 44;
    record(
      vp.name,
      "left (disabled) arrow touch target >= 44x44",
      okSize ? "PASS" : "FAIL",
      `${prevBox.width}x${prevBox.height}`,
    );
  }

  // Horizontal overflow at this viewport
  const horizontalOverflow = await page.evaluate(() => {
    return (
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth + 1
    );
  });
  record(
    vp.name,
    "no horizontal overflow",
    !horizontalOverflow ? "PASS" : "FAIL",
    `overflow=${horizontalOverflow}`,
  );

  // ─── Interact · click Next · verify URL + page number update ───
  const nextLink = page.locator("[data-nex-directory-next]");
  const nextCount = await nextLink.count();
  if (nextCount !== 1) {
    record(
      vp.name,
      "next link present on page 1",
      "NOT VERIFIED",
      `count=${nextCount} · results may fit on one page in dev DB`,
    );
    await screenshot(page, `${vp.name}-99-single-page-no-next`);
    await context.close();
    return;
  }

  const t0 = Date.now();
  await Promise.all([
    page.waitForURL(/page=2/, { timeout: 20_000 }),
    nextLink.click(),
  ]);
  const t1 = Date.now();
  record(
    vp.name,
    "Next arrow navigates to page=2",
    "PASS",
    `${t1 - t0} ms`,
  );
  await screenshot(page, `${vp.name}-02-page-2`);

  const pageNumPage2 = await page
    .locator("[data-nex-directory-page-current]")
    .innerText();
  record(
    vp.name,
    "visible page number reads '2' after Next",
    pageNumPage2.trim() === "2" ? "PASS" : "FAIL",
    `text=${pageNumPage2.trim()}`,
  );

  // Verify Previous is now a Link (not disabled span)
  const prevLinkPage2 = await page
    .locator("[data-nex-directory-prev]")
    .count();
  const prevDisabledPage2 = await page
    .locator("[data-nex-directory-prev-disabled]")
    .count();
  record(
    vp.name,
    "left arrow is enabled Link on page 2",
    prevLinkPage2 === 1 && prevDisabledPage2 === 0 ? "PASS" : "FAIL",
    `prev-link=${prevLinkPage2} prev-disabled=${prevDisabledPage2}`,
  );

  // ─── Click Prev · verify URL returns + page number decrements ──
  const t2 = Date.now();
  await Promise.all([
    page.waitForURL((url) => !/page=/.test(url.toString()), { timeout: 20_000 }),
    page.locator("[data-nex-directory-prev]").click(),
  ]);
  const t3 = Date.now();
  record(
    vp.name,
    "Prev arrow navigates back to page 1 (page param removed)",
    "PASS",
    `${t3 - t2} ms`,
  );
  const pageNumBack = await page
    .locator("[data-nex-directory-page-current]")
    .innerText();
  record(
    vp.name,
    "visible page number reads '1' after Prev",
    pageNumBack.trim() === "1" ? "PASS" : "FAIL",
    `text=${pageNumBack.trim()}`,
  );

  // ─── Last page probe · navigate to a very high page number and
  //     verify Next renders as disabled span (no further navigation) ──
  await page.goto(`${BASE_URL}/nex-native/directory?page=999`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  const paginationOnHighPage = await page
    .locator("[data-nex-directory-pagination]")
    .count();
  if (paginationOnHighPage >= 1) {
    const nextDisabledHigh = await page
      .locator("[data-nex-directory-next-disabled]")
      .count();
    const nextLinkHigh = await page
      .locator("[data-nex-directory-next]")
      .count();
    record(
      vp.name,
      "last-page probe · next arrow disabled (no further pages)",
      nextDisabledHigh === 1 && nextLinkHigh === 0 ? "PASS" : "FAIL",
      `next-disabled=${nextDisabledHigh} next-link=${nextLinkHigh}`,
    );
    await screenshot(page, `${vp.name}-03-last-page-probe`);
  } else {
    // Combined.length === 0 at page 999 · pagination correctly hidden
    record(
      vp.name,
      "last-page probe · pagination hidden when combined.length===0",
      "PASS",
      "no pagination mounted at page=999",
    );
    await screenshot(page, `${vp.name}-03-empty-high-page`);
  }

  // Console errors clean?
  record(
    vp.name,
    "no console errors during pass",
    consoleErrors.length === 0 ? "PASS" : "FAIL",
    consoleErrors.length ? consoleErrors.slice(0, 2).join(" | ") : "0",
  );

  await context.close();
}

async function main() {
  await ensureOutDir();
  const health = await fetch(`${BASE_URL}/nex-native/directory`);
  if (!health.ok) throw new Error(`Dev server not healthy: ${health.status}`);
  console.log(`[preflight] dev server HTTP ${health.status} on ${BASE_URL}`);

  const browser = await chromium.launch({ headless: true });
  try {
    for (const vp of VIEWPORTS) {
      console.log(`\n== ${vp.name} (${vp.width}x${vp.height}) ==`);
      await verifyPagination(browser, vp);
    }
  } finally {
    await browser.close();
  }

  const summary = {
    total: observations.length,
    pass: observations.filter((o) => o.status === "PASS").length,
    fail: observations.filter((o) => o.status === "FAIL").length,
    notVerified: observations.filter((o) => o.status === "NOT VERIFIED").length,
  };
  console.log(
    `\nSummary: ${summary.pass} PASS · ${summary.fail} FAIL · ${summary.notVerified} NOT VERIFIED · ${summary.total} total`,
  );
  await fs.writeFile(
    path.join(OUT_DIR, "report.json"),
    JSON.stringify({ summary, observations }, null, 2),
    "utf8",
  );
  if (summary.fail > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error("[verification] fatal:", err);
  process.exit(2);
});
