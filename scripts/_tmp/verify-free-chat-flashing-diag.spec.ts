// scripts/_tmp/verify-free-chat-flashing-diag.spec.ts
//
// Owner 2026-11-11 · investigate reported "flashing" on
// http://localhost:3011/nex-native/free-chat
//
// Captures over 5 seconds post-load:
//   · every console log + error
//   · every network request (count duplicates)
//   · DOM mutations on the slide-root
//   · page navigations (would indicate a reload loop)
//   · timed screenshots

import { test } from "@playwright/test";

const BASE = "http://localhost:3011";

test.use({
  viewport: { width: 1440, height: 900 },
  extraHTTPHeaders: { cookie: "nex_dev_override=nex-99901" },
});

test("DIAG · free-chat prod flashing", async ({ page }, testInfo) => {
  const requests: Array<{ t: number; url: string; method: string }> = [];
  const consoleMsgs: Array<{ t: number; type: string; text: string }> = [];
  const pageerrors: Array<{ t: number; msg: string }> = [];
  const navigations: Array<{ t: number; url: string }> = [];
  const startClock = Date.now();
  const since = (): number => Date.now() - startClock;

  page.on("request", (req) => {
    requests.push({ t: since(), url: req.url(), method: req.method() });
  });
  page.on("console", (msg) => {
    const t = msg.type();
    if (t === "log" || t === "error" || t === "warn") {
      consoleMsgs.push({ t: since(), type: t, text: msg.text().slice(0, 300) });
    }
  });
  page.on("pageerror", (e) => {
    pageerrors.push({ t: since(), msg: e.message.slice(0, 300) });
  });
  page.on("framenavigated", (f) => {
    if (f === page.mainFrame()) {
      navigations.push({ t: since(), url: f.url() });
    }
  });

  await page.goto(`${BASE}/nex-native/free-chat`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".nex-native-frame", { timeout: 20_000 });

  // Install a DOM mutation counter.
  await page.evaluate(() => {
    const w = window as unknown as {
      __mutCount: number;
      __mutHistory: Array<{ t: number; count: number }>;
    };
    w.__mutCount = 0;
    w.__mutHistory = [];
    const observer = new MutationObserver((muts) => {
      w.__mutCount += muts.length;
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });
    const tick = () => {
      w.__mutHistory.push({ t: performance.now(), count: w.__mutCount });
      w.__mutCount = 0;
    };
    setInterval(tick, 500);
  });

  // Take a timed series of screenshots to visually catch the flash.
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${testInfo.outputDir}/free-chat-${String(i).padStart(2, "0")}-${i * 500}ms.png` });
  }

  const mutHistory = await page.evaluate(() => {
    const w = window as unknown as { __mutHistory: Array<{ t: number; count: number }> };
    return w.__mutHistory;
  });

  console.log(`\n=== Request summary over 5 s ===`);
  console.log(`Total requests: ${requests.length}`);
  const urlCounts = new Map<string, number>();
  for (const r of requests) urlCounts.set(r.url, (urlCounts.get(r.url) ?? 0) + 1);
  const dupes = Array.from(urlCounts.entries()).filter(([, c]) => c > 1).sort((a, b) => b[1] - a[1]);
  console.log(`URLs requested more than once: ${dupes.length}`);
  for (const [url, c] of dupes.slice(0, 20)) {
    console.log(`  ${c}×  ${url}`);
  }

  console.log(`\n=== Page navigations (main frame) ===`);
  console.log(`Count: ${navigations.length}`);
  for (const n of navigations) console.log(`  t=${n.t}ms  ${n.url}`);

  console.log(`\n=== Console errors/warns ===`);
  const errs = consoleMsgs.filter((m) => m.type === "error" || m.type === "warn");
  console.log(`Count: ${errs.length}`);
  for (const m of errs.slice(0, 30)) {
    console.log(`  [${m.type}] t=${m.t}ms  ${m.text}`);
  }

  console.log(`\n=== Page errors ===`);
  for (const e of pageerrors) console.log(`  t=${e.t}ms  ${e.msg}`);

  console.log(`\n=== DOM mutations per 500ms window (after initial load) ===`);
  for (const h of mutHistory.slice(0, 20)) {
    console.log(`  t=${h.t.toFixed(0)}ms  mutations=${h.count}`);
  }
});
