// scripts/_tmp/round-29-ui-verify.mjs
//
// Owner-authorised 2026-11-08 (round 29g) · Playwright visual
// verification of the new pricing + storage + tier surfaces. Runs
// against the local dev server on :3009 · writes screenshots into
// scripts/_tmp/ · artifacts are NOT committed.

import { chromium } from "playwright";

const DEV_BASE = process.env.DEV_BASE_URL ?? "http://localhost:3009";

const ROUTES = [
  { name: "pricing", path: "/nex-native/pricing" },
  { name: "storage", path: "/nex-native/settings/storage" },
  {
    name: "storage-limit-preview",
    path: "/nex-native/settings/storage?preview=limit",
  },
  { name: "tier", path: "/nex-native/settings/tier" },
];

const VIEWPORTS = [
  { label: "mobile-400", width: 400, height: 820 },
  { label: "desktop-1440", width: 1440, height: 900 },
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const results = [];
  for (const route of ROUTES) {
    for (const vp of VIEWPORTS) {
      const outPath = `scripts/_tmp/r29g-${route.name}-${vp.label}.png`;
      try {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        const resp = await page.goto(`${DEV_BASE}${route.path}`, {
          waitUntil: "networkidle",
          timeout: 15_000,
        });
        // Give the phone-frame CSS a tick to settle.
        await page.waitForTimeout(400);
        await page.screenshot({ path: outPath, fullPage: false });
        results.push({
          route: route.path,
          viewport: vp.label,
          status: resp?.status() ?? 0,
          file: outPath,
        });
      } catch (err) {
        results.push({
          route: route.path,
          viewport: vp.label,
          status: "error",
          file: outPath,
          error: err?.message ?? String(err),
        });
      }
    }
  }
  await browser.close();

  console.log("\n=== Round 29g visual verification ===");
  for (const r of results) {
    const line = `${r.status} · ${r.viewport.padEnd(14)} · ${r.route.padEnd(50)} · ${r.file}`;
    console.log(line);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
