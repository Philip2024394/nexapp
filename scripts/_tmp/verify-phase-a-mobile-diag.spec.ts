// scripts/_tmp/verify-phase-a-mobile-diag.spec.ts
//
// One-off diagnostic for 2026-11-11 investigation: why does
// desktop cold public nav show 1 click-window fetch but mobile
// shows 2?
//
// Hypothesis: on mobile Chromium the idle prefetcher's fetch races
// the click, so both the kind:"full" prefetch and the router.push
// navigate fetch land in the 100ms click window. On desktop, rIC
// fires faster and the prefetch completes before click.

import { test } from "@playwright/test";

const BASE = "http://localhost:3011";

const INIT = `
(() => {
  const w = window;
  w.__nexRecs = [];
  const origFetch = w.fetch.bind(w);
  w.fetch = async (input, init) => {
    const url = typeof input === 'string'
      ? input
      : (input instanceof URL ? input.toString() : input.url);
    w.__nexRecs.push({ t: performance.now(), url, source: 'start' });
    const res = await origFetch(input, init);
    w.__nexRecs.push({ t: performance.now(), url, source: 'done', status: res.status });
    return res;
  };
})();
`;

test.use({
  viewport: { width: 390, height: 844 },
  extraHTTPHeaders: { cookie: "nex_dev_override=nex-99901" },
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(INIT);
});

test("DIAG · mobile cold public nav · dump every /directory fetch", async ({ page }) => {
  await page.goto(`${BASE}/nex-native/free-chat`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForSelector(".nex-native-frame", { timeout: 20_000 });
  const shellMountAt = await page.evaluate(() => performance.now());
  await page.waitForTimeout(100);

  const clickAt = await page.evaluate(() => {
    const a = document.createElement("a");
    a.href = "/nex-native/directory";
    a.id = "test-nav-link";
    document.body.appendChild(a);
    const t = performance.now();
    a.click();
    return t;
  });

  await page.waitForTimeout(2000);

  const recs = await page.evaluate(() => {
    const w = window as unknown as {
      __nexRecs: Array<{ t: number; url: string; source: string; status?: number }>;
    };
    return w.__nexRecs;
  });

  const dir = recs.filter((r) => r.url.includes("/nex-native/directory"));
  console.log(`\n=== shell mounted at ~${shellMountAt.toFixed(1)}ms`);
  console.log(`=== click at ~${clickAt.toFixed(1)}ms (${(clickAt - shellMountAt).toFixed(1)}ms after mount)`);
  console.log(`\n=== All /directory fetches ===`);
  for (const r of dir) {
    const fromClick = r.t - clickAt;
    const fromMount = r.t - shellMountAt;
    console.log(
      `  t=${r.t.toFixed(1)}ms (mount+${fromMount.toFixed(1)}, click${fromClick >= 0 ? "+" : ""}${fromClick.toFixed(1)}) ` +
      `${r.source.padEnd(5)} ${r.status ?? "-"} ${r.url}`,
    );
  }

  const inWindow = dir.filter((r) => r.source === "start" && r.t >= clickAt - 50 && r.t <= clickAt + 100);
  console.log(`\n=== Fetches starting in click window [-50ms, +100ms]: ${inWindow.length} ===`);
  for (const r of inWindow) {
    console.log(`  ${r.url}`);
  }
});
