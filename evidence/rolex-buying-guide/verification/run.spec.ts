// Rolex Buying Guide · verification evidence capture · 2026-11-17.
//
// Independent verification agent screenshot-capture script. Runs under
// the existing playwright.config.ts base URL (http://localhost:3008)
// against the already-running dev server. Captures three phone-sized
// screenshots and performs the Phase 3 overflow + keyboard + routing
// checks. READ-ONLY on the app · no DB writes · no server restarts.
//
// The config's testDir is "./tests/e2e" and this file lives OUTSIDE
// that path, so it is invoked explicitly by path on the CLI. Playwright
// accepts a path arg and ignores testMatch when a file is specified.

import { test, expect } from "@playwright/test";
import path from "node:path";

const screenshotDir = path.join(__dirname, "screenshots");

// Phone viewport · 360×780 per verification brief. Matches NEX phone
// frame width · smaller than the config's default Pixel 7 viewport
// because the brief specifically asks 360×780.
test.use({
  viewport: { width: 360, height: 780 },
  hasTouch: true,
  isMobile: true,
  baseURL: "http://localhost:3008",
});

test("drawer baseline on /nex-native/sign-in", async ({ page }) => {
  await page.goto("/nex-native/sign-in", { waitUntil: "domcontentloaded" });
  // best-effort wait for the phone frame content to paint
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.screenshot({
    path: path.join(screenshotDir, "01-sign-in-baseline.png"),
    fullPage: false,
  });
});

test("buying-guides index page", async ({ page }) => {
  await page.goto("/nex-generated/buying-guides", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.screenshot({
    path: path.join(screenshotDir, "02-buying-guides-index.png"),
    fullPage: true,
  });
  // 360px horizontal overflow check
  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth;
  });
  expect(overflow, "buying-guides index has horizontal overflow at 360px").toBe(false);
});

test("rolex guide · scroll + overflow + keyboard + recruitment", async ({ page }) => {
  await page.goto("/nex-generated/buying-guides/rolex", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});

  // (j) scrolled to top
  await page.screenshot({
    path: path.join(screenshotDir, "03-rolex-top.png"),
    fullPage: false,
  });

  // (k) 360px horizontal overflow check
  const overflow = await page.evaluate(() => {
    const w = document.documentElement.scrollWidth;
    const iw = window.innerWidth;
    return { overflow: w > iw, scrollWidth: w, innerWidth: iw };
  });
  expect(overflow.overflow, `rolex page overflow at ${overflow.scrollWidth}px > ${overflow.innerWidth}px`).toBe(false);

  // (l) tab reachability · best-effort. Tab a few times and record the
  // tag of the focused element each time. If any <summary> gets focus,
  // keyboard reach is proven. Do not fail hard · the brief says
  // best-effort.
  const focusTags: string[] = [];
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press("Tab");
    const tag = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return "none";
      return (el.tagName || "unknown").toLowerCase();
    });
    focusTags.push(tag);
    if (tag === "summary") break;
  }
  // Record the sequence as a test annotation instead of asserting.
  test.info().annotations.push({
    type: "keyboard-tab-sequence",
    description: focusTags.join(","),
  });

  // (j) full-page scroll screenshot (captures recruitment block below the fold)
  await page.screenshot({
    path: path.join(screenshotDir, "04-rolex-fullpage.png"),
    fullPage: true,
  });

  // (m) recruitment button destination. The brief expects either
  // /nex-native/manage/shop/start OR a sign-in redirect pointing at
  // that path. Find the button by accessible name.
  const candidate = page.getByRole("link", { name: /create your next shop/i });
  const asButton = page.getByRole("button", { name: /create your next shop/i });
  const linkCount = await candidate.count();
  const btnCount = await asButton.count();
  test.info().annotations.push({
    type: "recruitment-trigger-count",
    description: `link=${linkCount} button=${btnCount}`,
  });

  if (linkCount > 0) {
    const href = await candidate.first().getAttribute("href");
    test.info().annotations.push({
      type: "recruitment-href",
      description: href ?? "(none)",
    });
    // Click and wait for nav
    await Promise.all([
      page.waitForLoadState("domcontentloaded"),
      candidate.first().click(),
    ]);
    const landed = page.url();
    test.info().annotations.push({ type: "recruitment-landed", description: landed });
    await page.screenshot({
      path: path.join(screenshotDir, "05-recruitment-destination.png"),
      fullPage: false,
    });
    // Accept either direct manage/shop/start OR sign-in?next=...
    const okDirect = landed.includes("/nex-native/manage/shop/start");
    const okRedirect = landed.includes("/sign-in") && landed.includes("shop");
    expect(okDirect || okRedirect, `recruitment landed at unexpected URL: ${landed}`).toBe(true);
  } else if (btnCount > 0) {
    test.info().annotations.push({
      type: "recruitment-trigger-note",
      description: "found as <button> not <a> · cannot verify href statically",
    });
  } else {
    test.info().annotations.push({
      type: "recruitment-trigger-note",
      description: "no recruitment link/button found on rolex page",
    });
  }
});
