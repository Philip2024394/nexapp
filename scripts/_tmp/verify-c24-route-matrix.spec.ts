// scripts/_tmp/verify-c24-route-matrix.spec.ts
//
// Cycle 24 investigation (owner directive 2026-11-11) · per-route
// navigation + destination-readiness probe against the live Vercel
// deployment.
//
// What we measure per destination:
//   · click time
//   · first RSC fetch time + response time + response size
//   · first React commit to slide-root (MutationObserver)
//   · when slide-root first contains "real" content (> 2000 chars)
//   · startViewTransition start + finished timings
//   · screenshots at +100ms, +300ms, +600ms, +1200ms, +2500ms, +5000ms
//
// Destinations under test:
//   · /pricing      · public, lightweight · baseline for good UX
//   · /directory    · public, medium · idle prefetched by shell
//   · /chat         · private, heavy · SilentLoading fallback
//   · /contacts     · private, heavy · ContactsListSkeleton fallback
//   · /home         · private · SilentLoading fallback
//
// All runs start from /free-chat with no prior hover prefetch, so
// the public routes are effectively cold too (idle prefetcher may
// warm /directory but not the others).

import { test } from "@playwright/test";

const BASE = process.env.NEX_TEST_BASE ?? "https://nex-ireland-preview.vercel.app";

const INIT = `
(() => {
  const w = window;
  w.__m = {
    fetches: [],
    svtCalls: 0,
    svtStarts: [],
    svtFinishes: [],
    rootStates: [],
  };
  const m = w.__m;
  const origFetch = w.fetch.bind(w);
  w.fetch = async (input, init) => {
    const url = typeof input === 'string'
      ? input
      : (input instanceof URL ? input.toString() : input.url);
    const rec = { t: performance.now(), url, startedAt: performance.now(), endedAt: 0, status: 0, size: 0 };
    m.fetches.push(rec);
    const res = await origFetch(input, init);
    rec.endedAt = performance.now();
    rec.status = res.status;
    try {
      const clone = res.clone();
      const buf = await clone.arrayBuffer();
      rec.size = buf.byteLength;
    } catch { rec.size = -1; }
    return res;
  };
  const origSvt = document.startViewTransition
    ? document.startViewTransition.bind(document)
    : null;
  if (origSvt) {
    document.startViewTransition = function (cb) {
      const i = ++m.svtCalls;
      m.svtStarts.push({ t: performance.now(), i });
      const t = origSvt(cb);
      if (t && t.finished) {
        t.finished.then(() => m.svtFinishes.push({ t: performance.now(), i, ok: true }))
                  .catch(() => m.svtFinishes.push({ t: performance.now(), i, ok: false }));
      }
      return t;
    };
  }
  const attach = () => {
    const root = document.querySelector('[data-nex-page-slide-root]');
    if (!root) return false;
    const snap = () => {
      const chars = root.innerHTML.length;
      const text = (root.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 80);
      const last = m.rootStates[m.rootStates.length - 1];
      if (!last || last.chars !== chars || last.text !== text) {
        m.rootStates.push({ t: performance.now(), chars, text });
      }
    };
    snap();
    new MutationObserver(snap).observe(root, { childList: true, subtree: true });
    return true;
  };
  if (!attach()) {
    const i = setInterval(() => { if (attach()) clearInterval(i); }, 50);
  }
})();
`;

type RouteCase = {
  name: string;
  href: string;
  classification: string;
};

const routes: RouteCase[] = [
  { name: "pricing", href: "/nex-native/pricing", classification: "public · light · SilentLoading" },
  { name: "directory", href: "/nex-native/directory", classification: "public · idle-prefetched · DirectorySkeleton" },
  { name: "chat", href: "/nex-native/chat?tab=friends", classification: "private · heavy · SilentLoading" },
  { name: "contacts", href: "/nex-native/contacts", classification: "private · heavy · ContactsListSkeleton" },
  { name: "home", href: "/nex-native/home", classification: "private · heavy · SilentLoading" },
];

test.describe("C24 route-matrix investigation", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    extraHTTPHeaders: { cookie: "nex_dev_override=nex-99901" },
  });
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(INIT);
  });

  for (const r of routes) {
    test(`route · ${r.name} · ${r.classification}`, async ({ page }, testInfo) => {
      await page.goto(`${BASE}/nex-native/free-chat`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector(".nex-native-frame", { timeout: 20_000 });
      await page.waitForTimeout(300);

      // Reset counters after the shell warm period but BEFORE click.
      await page.evaluate(() => {
        const w = window as unknown as { __m: { fetches: unknown[]; svtCalls: number; svtStarts: unknown[]; svtFinishes: unknown[]; rootStates: unknown[] } };
        w.__m.fetches.length = 0;
        w.__m.svtCalls = 0;
        w.__m.svtStarts.length = 0;
        w.__m.svtFinishes.length = 0;
        // Keep root states (baseline).
      });

      await page.evaluate((href) => {
        const a = document.createElement("a");
        a.href = href;
        a.id = "test-nav-link";
        a.textContent = "GO";
        a.style.cssText = "position:fixed;top:4px;left:4px;z-index:9999;background:magenta;color:white;padding:4px;";
        document.body.appendChild(a);
      }, r.href);

      await page.screenshot({ path: `${testInfo.outputDir}/${r.name}-00-before.png` });

      const clickAt = await page.evaluate(() => {
        const t = performance.now();
        document.getElementById("test-nav-link")!.click();
        return t;
      });

      const shots = [100, 300, 600, 1200, 2500, 5000];
      let acc = 0;
      for (const target of shots) {
        const wait = target - acc;
        if (wait > 0) await page.waitForTimeout(wait);
        acc = target;
        await page.screenshot({ path: `${testInfo.outputDir}/${r.name}-${String(target).padStart(5, "0")}ms.png` });
      }

      const data = await page.evaluate(() => {
        const w = window as unknown as { __m: unknown };
        return JSON.parse(JSON.stringify(w.__m));
      }) as {
        fetches: Array<{ t: number; url: string; startedAt: number; endedAt: number; status: number; size: number }>;
        svtCalls: number;
        svtStarts: Array<{ t: number; i: number }>;
        svtFinishes: Array<{ t: number; i: number; ok: boolean }>;
        rootStates: Array<{ t: number; chars: number; text: string }>;
      };

      const pathname = new URL(r.href, "http://x").pathname;
      const destFetches = data.fetches.filter((f) => f.url.includes(pathname));
      const sinceClick = (t: number): string => `${(t - clickAt).toFixed(0)}ms`;

      console.log(`\n=== ${r.name} · ${r.classification} ===`);
      console.log(`  clicks fired · 1 (test-driven)`);
      console.log(`  SVT calls:              ${data.svtCalls}`);
      for (const s of data.svtStarts) console.log(`    start @ +${sinceClick(s.t)}`);
      for (const f of data.svtFinishes) console.log(`    finish @ +${sinceClick(f.t)} ok=${f.ok}`);
      console.log(`  RSC fetches to ${pathname}:  ${destFetches.length}`);
      for (const f of destFetches.slice(0, 8)) {
        const dur = (f.endedAt - f.startedAt).toFixed(0);
        console.log(`    @ +${sinceClick(f.startedAt)}  status=${f.status}  size=${f.size}  took=${dur}ms  ${f.url}`);
      }
      console.log(`  slide-root state transitions after click:`);
      const postClick = data.rootStates.filter((s) => s.t >= clickAt - 100);
      for (const s of postClick.slice(0, 10)) {
        console.log(`    +${sinceClick(s.t)}  chars=${String(s.chars).padStart(6)}  text="${s.text}"`);
      }
      const firstRealContent = postClick.find((s) => s.chars > 2000);
      if (firstRealContent) {
        console.log(`  → first "real" content (>2000 chars) @ +${sinceClick(firstRealContent.t)}`);
      } else {
        console.log(`  → NO real content captured in 5s window`);
      }
    });
  }
});
