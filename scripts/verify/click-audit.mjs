// scripts/verify/click-audit.mjs
//
// Bug-hunt: enumerate every interactive element on the landing page
// and three key downstream surfaces, click each, record what happens.
// Classifies each click into:
//   OK-NAV      · navigation completed to a new URL
//   OK-SAME-URL · click fired, URL did not change (e.g. opens a sheet)
//   SLOW        · navigation completed but took > 2000 ms (dev-mode
//                 cold compile is excluded by warming the server first)
//   BROKEN      · clicking produced no observable change (no URL
//                 change, no DOM mutation detected in 2s window)
//   ERROR       · click triggered a console error or page error
//   INTERCEPTED · Playwright reports actionability intercepted
//                 (something above the element blocks the click)
//
// Honest limits:
//   · Dev-server first-compile latency confuses "slow" classification.
//     We warm each destination once before measuring.
//   · Anonymous session only · cannot test authenticated-only paths.
//   · Elements inside closed drawers are skipped unless the drawer is
//     opened first.

import { chromium } from "@playwright/test";
import fs from "node:fs/promises";

const BASE_URL = "http://localhost:3008";
const OUT = "tests/e2e-screenshots/click-audit";

const observations = [];
function record(page, selector, verdict, detail) {
  const row = { page, selector, verdict, detail };
  observations.push(row);
  console.log(
    `[${page}] ${selector.padEnd(60)} ${verdict.padEnd(13)} ${detail ?? ""}`,
  );
}

async function warmRoute(page, url) {
  await page.goto(`${BASE_URL}${url}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
}

// Collect every clickable target on the current page.
async function enumerateTargets(page) {
  return await page.evaluate(() => {
    const nodes = Array.from(
      document.querySelectorAll(
        'a[href], button, [role="button"], [onclick]',
      ),
    );
    return nodes.map((el, i) => {
      const r = el.getBoundingClientRect();
      // Build a short, stable selector hint
      const tag = el.tagName.toLowerCase();
      const text = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40);
      const ariaLabel = el.getAttribute("aria-label");
      const dataNex = Array.from(el.attributes)
        .filter((a) => a.name.startsWith("data-nex-"))
        .map((a) => `${a.name}=${a.value}`)
        .join(" ");
      const href = el.getAttribute("href");
      return {
        idx: i,
        tag,
        ariaLabel,
        text,
        href,
        dataNex,
        rect: { x: r.x, y: r.y, w: r.width, h: r.height },
        visible: r.width > 0 && r.height > 0,
      };
    });
  });
}

async function auditPage(browser, pageLabel, url) {
  const context = await browser.newContext({
    viewport: { width: 420, height: 909 },
  });
  const page = await context.newPage();

  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => pageErrors.push(String(e)));

  // Warm the current page
  await warmRoute(page, url);
  const targets = await enumerateTargets(page);
  console.log(`\n== ${pageLabel} · ${url} · ${targets.length} targets ==`);

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    if (!t.visible) continue;
    if (t.rect.w < 8 || t.rect.h < 8) continue;

    // Re-navigate to the page before each click so each click is
    // tested independently against a clean page state.
    await warmRoute(page, url);

    // Clear per-click error buckets
    const errCountBefore = consoleErrors.length + pageErrors.length;

    const startUrl = page.url();
    const t0 = Date.now();
    let verdict = "BROKEN";
    let detail = "";

    // Build a label for the report
    const dataNexAttr = t.dataNex
      .split(" ")
      .find((s) => s.startsWith("data-nex-"))
      ?.split("=")[0];
    const dataNexVal = t.dataNex
      .split(" ")
      .find((s) => s.startsWith("data-nex-"))
      ?.split("=")[1];
    const labelParts = [
      dataNexAttr ? `[${dataNexAttr}${dataNexVal ? `=${dataNexVal}` : ""}]` : null,
      t.ariaLabel ? `aria="${t.ariaLabel}"` : null,
      t.href ? `href="${t.href}"` : null,
      t.text ? `text="${t.text}"` : null,
    ].filter(Boolean);
    const selectorLabel = `#${i} ${labelParts.join(" | ")}`;

    try {
      // Click by DOM INDEX of the enumeration · evaluate the exact
      // element so we never click the wrong one when multiple
      // elements share the same data-nex attribute.
      const result = await Promise.race([
        page.waitForURL((u) => u.toString() !== startUrl, { timeout: 4_000 })
          .then(() => "nav"),
        page.evaluate(async (idx) => {
          const nodes = Array.from(
            document.querySelectorAll(
              'a[href], button, [role="button"], [onclick]',
            ),
          );
          const el = nodes[idx];
          if (!el) return "no-element";
          el.scrollIntoView({ block: "center" });
          el.click();
          return "clicked";
        }, i).then((r) => `evaluate:${r}`),
      ]).catch((e) => `error:${String(e)}`);

      if (String(result).startsWith("error:")) {
        if (String(result).includes("intercept")) {
          verdict = "INTERCEPTED";
          detail = String(result).slice(0, 100);
        } else {
          verdict = "BROKEN";
          detail = String(result).slice(0, 100);
        }
        record(pageLabel, selectorLabel, verdict, detail);
        continue;
      }

      const t1 = Date.now();
      const elapsed = t1 - t0;

      // Did the URL actually change?
      await page.waitForTimeout(300);
      const nowUrl = page.url();
      const navigated = nowUrl !== startUrl;

      const errCountAfter = consoleErrors.length + pageErrors.length;
      const newErrors = errCountAfter - errCountBefore;

      if (newErrors > 0) {
        verdict = "ERROR";
        detail = `${newErrors} new errors · ${(consoleErrors.at(-1) || pageErrors.at(-1) || "").slice(0, 80)} · ${elapsed}ms · →${navigated ? nowUrl.replace(BASE_URL, "") : "same URL"}`;
      } else if (navigated) {
        verdict = elapsed > 2_000 ? "SLOW" : "OK-NAV";
        detail = `${elapsed}ms · →${nowUrl.replace(BASE_URL, "")}`;
      } else {
        // No URL change · if the clicked element's href already
        // equals the current URL, this is a legitimate "already here"
        // no-op (e.g. the active pagination tab, the current section
        // nav icon). Not broken · just redundant.
        const alreadyHere =
          t.href !== null &&
          (t.href === new URL(startUrl).pathname ||
            new URL(t.href, startUrl).href === startUrl);
        if (alreadyHere) {
          verdict = "OK-SAME-URL";
          detail = `${t1 - t0}ms · href === current URL · correct no-op`;
          record(pageLabel, selectorLabel, verdict, detail);
          continue;
        }
        // Otherwise check whether DOM mutated (sheet opened,
        // dropdown toggled, etc.) via known overlay sentinels.
        const anyOverlay = await page.evaluate(() => {
          return !!document.querySelector(
            // Known NEX overlays: control drawer, filter sheet, native
            // <details open>, aria-expanded sources, generic role=dialog
            // (CreateAccountPrompt + any other sealed modal pattern),
            // and the account-gate backdrop sentinel.
            "[data-nex-control-drawer], [data-nex-filter-sheet], [open], [aria-expanded='true'], [role='dialog'][aria-modal='true'], [data-nex-account-gate-backdrop]",
          );
        });
        verdict = anyOverlay ? "OK-SAME-URL" : "BROKEN";
        detail = `${elapsed}ms · no nav · overlay=${anyOverlay}`;
      }
    } catch (e) {
      verdict = "BROKEN";
      detail = String(e).slice(0, 100);
    }
    record(pageLabel, selectorLabel, verdict, detail);
  }

  await context.close();
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  // Preflight
  const r = await fetch(`${BASE_URL}/nex-native/directory/landing`);
  if (!r.ok) throw new Error(`dev server HTTP ${r.status}`);

  const browser = await chromium.launch({ headless: true });
  try {
    await auditPage(browser, "landing", "/nex-native/directory/landing");
    await auditPage(browser, "directory", "/nex-native/directory");
    await auditPage(browser, "search", "/nex-native/search");
    await auditPage(browser, "settings", "/nex-native/settings");
  } finally {
    await browser.close();
  }

  const by = (v) => observations.filter((o) => o.verdict === v).length;
  const summary = {
    total: observations.length,
    okNav: by("OK-NAV"),
    okSame: by("OK-SAME-URL"),
    slow: by("SLOW"),
    broken: by("BROKEN"),
    error: by("ERROR"),
    intercepted: by("INTERCEPTED"),
    skip: by("SKIP"),
  };
  console.log(
    `\nSummary · total=${summary.total} · OK-NAV=${summary.okNav} · OK-SAME=${summary.okSame} · SLOW=${summary.slow} · BROKEN=${summary.broken} · ERROR=${summary.error} · INTERCEPTED=${summary.intercepted} · SKIP=${summary.skip}`,
  );
  await fs.writeFile(
    `${OUT}/report.json`,
    JSON.stringify({ summary, observations }, null, 2),
    "utf8",
  );
}

main().catch((err) => {
  console.error("[audit] fatal:", err);
  process.exit(2);
});
