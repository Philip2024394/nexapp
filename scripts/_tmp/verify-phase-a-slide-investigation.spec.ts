// scripts/_tmp/verify-phase-a-slide-investigation.spec.ts
//
// Owner investigation 2026-11-11 · "do we run one slide or two?"
// ---------------------------------------------------------------
// Counts, per click:
//   · click events seen by document capture listeners
//   · router.push effects (via matching RSC fetches to the destination)
//   · startViewTransition calls
//   · view-transition start + finish events
//   · DOM mutations on [data-nex-page-slide-root]
//   · how many distinct "visual states" we see on the slide root
//     (empty → skeleton → real content, or just old → real content)
//
// Plus timed screenshots:
//   · 0ms   : before click
//   · 10ms  : click just fired
//   · 160ms : mid-slide (slide is 320ms)
//   · 340ms : slide done
//   · 1000ms: post-slide settlement
//   · 2500ms: fully settled
//
// Cold target  = /nex-native/pricing (public but NOT in SHELL_WARM_PATHS,
//                 so idle prefetcher doesn't warm it; we don't hover it
//                 either). Pure cold.
// Warm target  = /nex-native/directory (public, in SHELL_WARM_PATHS,
//                 idle prefetcher warms it + we hover-prefetch before
//                 click).

import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3011";

const INIT = `
(() => {
  const w = window;
  w.__nex = {
    fetches: [],
    clicks: 0,
    svtCalls: 0,
    svtStarts: [],
    svtFinishes: [],
    slideRootMutations: [],
    visualStates: [],
    rafTicks: 0,
  };
  const n = w.__nex;

  // Fetch recorder (tagged with RSC-ness via URL).
  const origFetch = w.fetch.bind(w);
  w.fetch = async (input, init) => {
    const url = typeof input === 'string'
      ? input
      : (input instanceof URL ? input.toString() : input.url);
    n.fetches.push({ t: performance.now(), url });
    return origFetch(input, init);
  };

  // Count capture-phase click listeners seen on document (can't easily
  // introspect existing listeners, but we CAN wrap addEventListener to
  // catch any FUTURE registrations · the shell's registration already
  // happened before this script runs since addInitScript fires before
  // page JS). We detect duplicate installs by counting actual click
  // events dispatched to the document instead.
  document.addEventListener('click', () => { n.clicks += 1; }, { capture: true });

  // Patch startViewTransition · the production shell captures its
  // reference in useEffect, AFTER our addInitScript ran, so it will
  // see this wrapped version.
  const origSvt = document.startViewTransition
    ? document.startViewTransition.bind(document)
    : null;
  if (origSvt) {
    document.startViewTransition = function (cb) {
      const callIdx = ++n.svtCalls;
      n.svtStarts.push({ t: performance.now(), callIdx });
      const t = origSvt(function () {
        return cb();
      });
      if (t && t.finished) {
        t.finished
          .then(() => n.svtFinishes.push({ t: performance.now(), callIdx, ok: true }))
          .catch(() => n.svtFinishes.push({ t: performance.now(), callIdx, ok: false }));
      }
      return t;
    };
  }

  // MutationObserver on the slide root · must wait for it to mount.
  const attachObserver = () => {
    const root = document.querySelector('[data-nex-page-slide-root]');
    if (!root) return false;
    const snap = () => {
      // Lightweight signature of the root's current content.
      const text = (root.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 120);
      const html = root.innerHTML.length;
      const state = { t: performance.now(), chars: html, textHead: text };
      // Dedup consecutive identical states.
      const last = n.visualStates[n.visualStates.length - 1];
      if (!last || last.chars !== state.chars || last.textHead !== state.textHead) {
        n.visualStates.push(state);
      }
    };
    snap();
    const mo = new MutationObserver((mutations) => {
      n.slideRootMutations.push({ t: performance.now(), count: mutations.length });
      snap();
    });
    mo.observe(root, { childList: true, subtree: true, characterData: true });
    return true;
  };
  if (!attachObserver()) {
    const retry = setInterval(() => { if (attachObserver()) clearInterval(retry); }, 50);
  }

  // Count RAF ticks so we can gauge main-thread activity.
  const tick = () => { n.rafTicks += 1; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
})();
`;

type NavCapture = {
  clickAt: number;
  fetches: Array<{ t: number; url: string }>;
  clicks: number;
  svtCalls: number;
  svtStarts: Array<{ t: number; callIdx: number }>;
  svtFinishes: Array<{ t: number; callIdx: number; ok: boolean }>;
  slideRootMutations: Array<{ t: number; count: number }>;
  visualStates: Array<{ t: number; chars: number; textHead: string }>;
};

async function clickAndCapture(
  page: import("@playwright/test").Page,
  href: string,
  hoverFirst: boolean,
  outDir: string,
  tag: string,
): Promise<NavCapture> {
  await page.evaluate((h) => {
    document.getElementById('test-nav-link')?.remove();
    const a = document.createElement('a');
    a.href = h;
    a.id = 'test-nav-link';
    a.style.cssText = 'position:fixed;top:4px;left:4px;z-index:9999;background:magenta;color:white;padding:4px;';
    a.textContent = 'GO';
    document.body.appendChild(a);
  }, href);

  if (hoverFirst) {
    await page.evaluate(() => {
      document.getElementById('test-nav-link')!
        .dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    });
    await page.waitForTimeout(1500);
  }

  // Reset counters immediately before click so we only measure
  // click-driven activity.
  await page.evaluate(() => {
    const w = window as unknown as { __nex: { clicks: number; svtCalls: number; svtStarts: unknown[]; svtFinishes: unknown[]; slideRootMutations: unknown[]; visualStates: unknown[]; fetches: unknown[] } };
    w.__nex.clicks = 0;
    w.__nex.svtCalls = 0;
    w.__nex.svtStarts.length = 0;
    w.__nex.svtFinishes.length = 0;
    w.__nex.slideRootMutations.length = 0;
    w.__nex.fetches.length = 0;
    // visualStates: keep the pre-click state as baseline.
    w.__nex.visualStates.splice(1);
  });

  await page.screenshot({ path: `${outDir}/${tag}-00-before-click.png` });

  const clickAt = await page.evaluate(() => {
    const t = performance.now();
    document.getElementById('test-nav-link')!.click();
    return t;
  });

  // Timed screenshots across the predicted slide window.
  await page.waitForTimeout(10);
  await page.screenshot({ path: `${outDir}/${tag}-01-click+10ms.png` });
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${outDir}/${tag}-02-click+160ms.png` });
  await page.waitForTimeout(180);
  await page.screenshot({ path: `${outDir}/${tag}-03-click+340ms.png` });
  await page.waitForTimeout(660);
  await page.screenshot({ path: `${outDir}/${tag}-04-click+1000ms.png` });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${outDir}/${tag}-05-click+2500ms.png` });

  const data = await page.evaluate(() => {
    const w = window as unknown as { __nex: unknown };
    return JSON.parse(JSON.stringify(w.__nex));
  });

  return { clickAt, ...(data as Omit<NavCapture, "clickAt">) };
}

function summarise(c: NavCapture, destPath: string): void {
  const destFetches = c.fetches.filter((f) => {
    try { return new URL(f.url).pathname === destPath; } catch { return false; }
  });
  console.log(`  clicks caught by document:   ${c.clicks}`);
  console.log(`  startViewTransition calls:   ${c.svtCalls}`);
  if (c.svtStarts.length) {
    for (const s of c.svtStarts) console.log(`    SVT start #${s.callIdx} at +${(s.t - c.clickAt).toFixed(1)}ms`);
  }
  if (c.svtFinishes.length) {
    for (const f of c.svtFinishes) console.log(`    SVT finish #${f.callIdx} at +${(f.t - c.clickAt).toFixed(1)}ms (ok=${f.ok})`);
  }
  console.log(`  RSC fetches to ${destPath}:  ${destFetches.length}`);
  for (const f of destFetches) console.log(`    +${(f.t - c.clickAt).toFixed(1)}ms  ${f.url}`);
  console.log(`  slide-root mutations:        ${c.slideRootMutations.length}`);
  console.log(`  distinct visual states:      ${c.visualStates.length}`);
  for (const s of c.visualStates) {
    const dt = s.t - c.clickAt;
    const dtStr = dt >= 0 ? `+${dt.toFixed(1)}` : `${dt.toFixed(1)}`;
    console.log(`    ${dtStr}ms  chars=${String(s.chars).padStart(6)}  text="${s.textHead}"`);
  }
}

test.describe("Phase A · slide-count investigation", () => {
  test.use({
    viewport: { width: 1440, height: 900 },
    extraHTTPHeaders: { cookie: "nex_dev_override=nex-99901" },
  });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(INIT);
  });

  test("COLD · /nex-native/pricing (not prefetched)", async ({ page }, testInfo) => {
    await page.goto(`${BASE}/nex-native/free-chat`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".nex-native-frame", { timeout: 20_000 });
    await page.waitForTimeout(200);

    const cap = await clickAndCapture(page, "/nex-native/pricing", false, testInfo.outputDir, "cold");
    console.log(`\n=== COLD nav → /nex-native/pricing ===`);
    summarise(cap, "/nex-native/pricing");

    expect(cap.svtCalls, "exactly one startViewTransition per click").toBe(1);
    expect(cap.clicks, "exactly one click captured by document listener").toBe(1);
  });

  test("WARM · /nex-native/directory (hover + idle prefetched)", async ({ page }, testInfo) => {
    await page.goto(`${BASE}/nex-native/free-chat`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".nex-native-frame", { timeout: 20_000 });
    // Idle prefetcher has time to warm /directory from SHELL_WARM_PATHS.
    await page.waitForTimeout(2000);

    const cap = await clickAndCapture(page, "/nex-native/directory", true, testInfo.outputDir, "warm");
    console.log(`\n=== WARM nav → /nex-native/directory ===`);
    summarise(cap, "/nex-native/directory");

    expect(cap.svtCalls, "exactly one startViewTransition per click").toBe(1);
    expect(cap.clicks, "exactly one click captured by document listener").toBe(1);
  });

  test("COLD HEAVY · /nex-native/contacts (private, loading.tsx, no prefetch)", async ({ page }, testInfo) => {
    await page.goto(`${BASE}/nex-native/free-chat`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".nex-native-frame", { timeout: 20_000 });
    await page.waitForTimeout(200);

    const cap = await clickAndCapture(page, "/nex-native/contacts", false, testInfo.outputDir, "cold-heavy");
    console.log(`\n=== COLD HEAVY nav → /nex-native/contacts ===`);
    summarise(cap, "/nex-native/contacts");

    expect(cap.svtCalls, "exactly one startViewTransition per click").toBe(1);
    expect(cap.clicks, "exactly one click captured by document listener").toBe(1);
  });

  test("BACK · browser history popstate", async ({ page }, testInfo) => {
    await page.goto(`${BASE}/nex-native/free-chat`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".nex-native-frame", { timeout: 20_000 });
    await page.waitForTimeout(200);

    // First nav forward to /pricing.
    const fwd = await clickAndCapture(page, "/nex-native/pricing", false, testInfo.outputDir, "back-step1");
    console.log(`\n=== BACK · step 1 forward → /pricing ===`);
    summarise(fwd, "/nex-native/pricing");

    // Reset counters, then press back.
    await page.evaluate(() => {
      const w = window as unknown as { __nex: { clicks: number; svtCalls: number; svtStarts: unknown[]; svtFinishes: unknown[]; slideRootMutations: unknown[]; visualStates: unknown[]; fetches: unknown[] } };
      w.__nex.clicks = 0;
      w.__nex.svtCalls = 0;
      w.__nex.svtStarts.length = 0;
      w.__nex.svtFinishes.length = 0;
      w.__nex.slideRootMutations.length = 0;
      w.__nex.fetches.length = 0;
      w.__nex.visualStates.splice(1);
    });

    const backAt = await page.evaluate(() => {
      const t = performance.now();
      history.back();
      return t;
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${testInfo.outputDir}/back-99-after.png` });

    const backCap = await page.evaluate(() => {
      const w = window as unknown as { __nex: NavCapture };
      return JSON.parse(JSON.stringify(w.__nex));
    });
    console.log(`\n=== BACK · step 2 history.back() ===`);
    console.log(`  startViewTransition calls on back: ${backCap.svtCalls}`);
    for (const s of backCap.svtStarts) {
      console.log(`    SVT start at +${(s.t - backAt).toFixed(1)}ms`);
    }
    console.log(`  slide-root mutations on back:      ${backCap.slideRootMutations.length}`);
    console.log(`  visual states on back:             ${backCap.visualStates.length}`);
    for (const s of backCap.visualStates) {
      const dt = s.t - backAt;
      const dtStr = dt >= 0 ? `+${dt.toFixed(1)}` : `${dt.toFixed(1)}`;
      console.log(`    ${dtStr}ms  chars=${String(s.chars).padStart(6)}  text="${s.textHead}"`);
    }
  });
});
