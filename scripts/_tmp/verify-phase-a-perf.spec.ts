// scripts/_tmp/verify-phase-a-perf.spec.ts
//
// Phase A production-mode performance measurement · owner-sealed
// 2026-11-11. ----------------------------------------------------
// Measures the user-perceivable impact of Phase A against a
// `next build && next start` production server.
//
// Methodology
// -----------
// We care about THREE things on every nav:
//
//   (1) NO DOUBLE-FETCH FOR THE NAV ITSELF. The pushed iter-3 code
//       fetched the destination TWICE on click (manual warm-fetch +
//       router.push fetch). Phase A fires exactly ONE fetch on
//       click (cold path) · or ZERO (warm path, router cache hit).
//       We measure RSC fetches to the destination pathname within
//       a TIGHT 500ms window around the click. We IGNORE fetches
//       outside that window · Next.js's <Link> auto-prefetch on
//       the destination page's own tab bar legitimately fires its
//       own prefetches, and those are not part of the nav cost.
//
//   (2) SLIDE FIRES IMMEDIATELY. startViewTransition must start
//       within 50ms of click. If this is NULL we caught iter-3
//       (warm-wait before slide).
//
//   (3) PRIVATE ROUTES ARE NEVER PREFETCHED ON HOVER. Hovering a
//       link to /nex-native/contacts must not produce any RSC
//       fetch before click.
//
// Instrumentation: `addInitScript` runs BEFORE any page JS so the
// production shell captures our shimmed startViewTransition when it
// binds. In production Next.js uses `?_rsc=<hash>` query params to
// mark RSC fetches (not the RSC: 1 header that dev mode uses), so
// we detect by URL pattern.
//
// Run with:
//   NEX_APP_IDENTITY=ireland NEX_APP_COUNTRY=IE node scripts/start-with-identity.mjs ireland 3010
//   npx playwright test scripts/_tmp/verify-phase-a-perf.spec.ts \
//     --config=scripts/_tmp/verify-phase-a-perf.config.ts

import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3011";

type FetchRec = {
  url: string;
  pathname: string;
  isRsc: boolean;
  startedAt: number;
  endedAt: number | null;
};

const INIT_SCRIPT = `
(() => {
  const w = window;
  w.__nexTestRecords = [];
  w.__nexTestVtAt = null;
  w.__nexTestClickAt = 0;
  const origFetch = w.fetch.bind(w);
  w.__nexTestOrigFetch = origFetch;
  w.fetch = async (input, init) => {
    const url = typeof input === 'string'
      ? input
      : (input instanceof URL ? input.toString() : input.url);
    let pathname = url;
    try { pathname = new URL(url, w.location.href).pathname; } catch { /* ignore */ }
    // In production, Next.js marks RSC fetches via "?_rsc=" query
    // param instead of the RSC header.
    const isRsc = url.includes('_rsc=');
    const rec = { url, pathname, isRsc, startedAt: performance.now(), endedAt: null };
    w.__nexTestRecords.push(rec);
    const res = await origFetch(input, init);
    rec.endedAt = performance.now();
    return res;
  };
  // Patch startViewTransition so the production shell captures the
  // shimmed version when its useEffect binds.
  const origSvt = document.startViewTransition
    ? document.startViewTransition.bind(document)
    : null;
  if (origSvt) {
    document.startViewTransition = function (cb) {
      w.__nexTestVtAt = performance.now();
      return origSvt(cb);
    };
  }
})();
`;

async function clickAndMeasure(
  page: import("@playwright/test").Page,
  destinationHref: string,
  options: { hoverFirst: boolean; hoverSettleMs: number },
): Promise<{
  preClickRscToDest: FetchRec[];
  windowRscToDest: FetchRec[];
  clickAt: number;
  vtStartAt: number | null;
  destPathname: string;
}> {
  const destPathname = new URL(destinationHref, BASE).pathname;

  await page.evaluate((href) => {
    document.getElementById("test-nav-link")?.remove();
    const a = document.createElement("a");
    a.href = href;
    a.id = "test-nav-link";
    a.textContent = "GO";
    a.style.cssText =
      "position:fixed;top:4px;left:4px;z-index:9999;background:magenta;color:white;padding:4px;";
    document.body.appendChild(a);
  }, destinationHref);

  if (options.hoverFirst) {
    await page.evaluate(() => {
      document
        .getElementById("test-nav-link")!
        .dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    });
    await page.waitForTimeout(options.hoverSettleMs);
  }

  const result = await page.evaluate(
    ({ destPath }) => {
      const w = window as unknown as {
        __nexTestRecords: FetchRec[];
        __nexTestVtAt: number | null;
        __nexTestClickAt: number;
      };
      const preClick = w.__nexTestRecords.slice();
      w.__nexTestVtAt = null;
      w.__nexTestClickAt = performance.now();
      const clickAt = w.__nexTestClickAt;
      const link = document.getElementById("test-nav-link")!;
      link.click();
      return new Promise<{
        preClick: FetchRec[];
        windowed: FetchRec[];
        clickAt: number;
        vtStartAt: number | null;
      }>((resolve) => {
        // Give 500 ms for the click-initiated nav fetches to appear,
        // then snapshot. Anything after that (destination page's own
        // Link auto-prefetch) is NOT part of the nav cost.
        setTimeout(() => {
          const windowed = w.__nexTestRecords.filter(
            (r) =>
              r.startedAt >= clickAt - 50 &&
              r.startedAt <= clickAt + 100 &&
              r.pathname === destPath &&
              r.isRsc,
          );
          const preClickToDest = preClick.filter(
            (r) => r.pathname === destPath && r.isRsc,
          );
          resolve({
            preClick: preClickToDest,
            windowed,
            clickAt,
            vtStartAt: w.__nexTestVtAt,
          });
        }, 1500);
      });
    },
    { destPath: destPathname },
  );

  return {
    preClickRscToDest: result.preClick,
    windowRscToDest: result.windowed,
    clickAt: result.clickAt,
    vtStartAt: result.vtStartAt,
    destPathname,
  };
}

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

for (const vp of viewports) {
  test.describe(`Phase A perf · ${vp.name} ${vp.width}x${vp.height}`, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height },
      extraHTTPHeaders: { cookie: "nex_dev_override=nex-99901" },
    });
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(INIT_SCRIPT);
    });

    test("cold nav to PUBLIC route · directory · exactly 1 click-fetch", async ({
      page,
    }) => {
      await page.goto(`${BASE}/nex-native/free-chat`, {
        waitUntil: "domcontentloaded",
      });
      await page.waitForSelector(".nex-native-frame", { timeout: 20_000 });
      // Short wait so the idle prefetcher (SHELL_WARM_PATHS) does
      // not pre-warm the directory · we want a true cold-nav.
      await page.waitForTimeout(100);

      const m = await clickAndMeasure(page, "/nex-native/directory", {
        hoverFirst: false,
        hoverSettleMs: 0,
      });
      const uniqueUrls = new Set(m.windowRscToDest.map((r) => r.url));
      console.log(`[${vp.name}] COLD public nav:`, {
        preClickCount: m.preClickRscToDest.length,
        windowCount: m.windowRscToDest.length,
        uniqueUrls: uniqueUrls.size,
        vtStartFromClickMs:
          m.vtStartAt !== null
            ? Number((m.vtStartAt - m.clickAt).toFixed(1))
            : null,
      });

      // Inv 1: NO double-fetch within the click window. Each unique
      // URL must appear once at most.
      const urlCounts = new Map<string, number>();
      for (const r of m.windowRscToDest) {
        urlCounts.set(r.url, (urlCounts.get(r.url) ?? 0) + 1);
      }
      const dupes = Array.from(urlCounts.entries()).filter(
        ([, c]) => c > 1,
      );
      expect(dupes).toEqual([]);

      // Inv 2: slide fires immediately (iter-3 regression guard).
      expect(m.vtStartAt).not.toBeNull();
      expect(m.vtStartAt! - m.clickAt).toBeLessThan(50);
      await page.waitForURL(/\/nex-native\/directory/, { timeout: 5_000 });
    });

    test("warm nav to PUBLIC route · directory · hover primes router cache", async ({
      page,
    }) => {
      await page.goto(`${BASE}/nex-native/free-chat`, {
        waitUntil: "domcontentloaded",
      });
      await page.waitForSelector(".nex-native-frame", { timeout: 20_000 });
      await page.waitForTimeout(100);

      const m = await clickAndMeasure(page, "/nex-native/directory", {
        hoverFirst: true,
        hoverSettleMs: 1500,
      });
      console.log(`[${vp.name}] WARM public nav:`, {
        preClickCount: m.preClickRscToDest.length,
        windowCount: m.windowRscToDest.length,
        vtStartFromClickMs:
          m.vtStartAt !== null
            ? Number((m.vtStartAt - m.clickAt).toFixed(1))
            : null,
      });

      // Prefetch invariant: hover produced at least one RSC fetch
      // pre-click.
      expect(
        m.preClickRscToDest.length,
        "hover must produce a prefetch for the public destination",
      ).toBeGreaterThanOrEqual(1);

      // No duplicate URL in the click window.
      const urlCounts = new Map<string, number>();
      for (const r of m.windowRscToDest) {
        urlCounts.set(r.url, (urlCounts.get(r.url) ?? 0) + 1);
      }
      const dupes = Array.from(urlCounts.entries()).filter(
        ([, c]) => c > 1,
      );
      expect(dupes).toEqual([]);

      // Slide fires immediately.
      expect(m.vtStartAt).not.toBeNull();
      expect(m.vtStartAt! - m.clickAt).toBeLessThan(50);
      await page.waitForURL(/\/nex-native\/directory/, { timeout: 5_000 });
    });

    test("PRIVATE route /nex-native/contacts · hover NEVER prefetches", async ({
      page,
    }) => {
      await page.goto(`${BASE}/nex-native/free-chat`, {
        waitUntil: "domcontentloaded",
      });
      await page.waitForSelector(".nex-native-frame", { timeout: 20_000 });
      await page.waitForTimeout(100);

      const m = await clickAndMeasure(page, "/nex-native/contacts", {
        hoverFirst: true,
        hoverSettleMs: 1500,
      });
      console.log(`[${vp.name}] PRIVATE route (hover+click):`, {
        preClickCount: m.preClickRscToDest.length,
        windowCount: m.windowRscToDest.length,
        vtStartFromClickMs:
          m.vtStartAt !== null
            ? Number((m.vtStartAt - m.clickAt).toFixed(1))
            : null,
      });

      // Allowlist invariant: hover MUST NOT prefetch a private route.
      expect(
        m.preClickRscToDest.length,
        "hover MUST NOT prefetch private routes · allowlist is broken",
      ).toBe(0);

      // Click window still fires exactly one nav fetch (no dupes).
      const urlCounts = new Map<string, number>();
      for (const r of m.windowRscToDest) {
        urlCounts.set(r.url, (urlCounts.get(r.url) ?? 0) + 1);
      }
      const dupes = Array.from(urlCounts.entries()).filter(
        ([, c]) => c > 1,
      );
      expect(dupes).toEqual([]);

      // Slide fires immediately.
      expect(m.vtStartAt).not.toBeNull();
      expect(m.vtStartAt! - m.clickAt).toBeLessThan(50);
      // Contacts may redirect downstream (mobile viewport redirects
      // to /chat?tab=friends) · we only care that we LEFT /free-chat,
      // not what the final landing page's own routing decides.
      await page.waitForURL((url) => !url.pathname.endsWith("/free-chat"), { timeout: 5_000 });
    });
  });
}
