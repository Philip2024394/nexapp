// scripts/_tmp/verify-ready-before-slide.spec.ts
//
// Phase A regression spec · owner-sealed 2026-11-11.
// --------------------------------------------------
// Asserts the two non-negotiable invariants of the Phase A
// navigation rewrite:
//
//   1. EXACTLY ONE RSC fetch per cold navigation. The iter-3
//      double-fetch regression (manual warm-fetch + router.push
//      refetch) must stay dead.
//
//   2. The slide fires IMMEDIATELY on click · no warm-wait. Current
//      page may still be visible under the slide-out but the view
//      transition must have started before the destination RSC has
//      arrived (otherwise we're back to the warm-wait regression).
//
// Keeps the test running in dev mode so it's cheap to re-run while
// iterating. Production timing/measurement lives in
// `verify-phase-a-perf.spec.ts`.
//
// Run with:
//   npm run dev:ireland  # terminal 1
//   npx playwright test scripts/_tmp/verify-ready-before-slide.spec.ts \
//     --config=scripts/_tmp/verify-phone-frame.config.ts

import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3009";

test.describe("Phase A nav regression", () => {
  test.use({
    viewport: { width: 1440, height: 900 },
    extraHTTPHeaders: { cookie: "nex_dev_override=nex-99901" },
  });

  test("click fires one RSC fetch and starts the view transition", async ({
    page,
  }, testInfo) => {
    const outDir = testInfo.outputDir;

    await page.goto(`${BASE}/nex-native/free-chat`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForSelector(".nex-native-frame", { timeout: 20_000 });
    await page.waitForTimeout(500);

    // Inject a direct link to a known PUBLIC route · directory. This
    // avoids the drawer and lets us measure one specific nav.
    await page.evaluate(() => {
      const a = document.createElement("a");
      a.href = "/nex-native/directory";
      a.id = "test-nav-link";
      a.textContent = "GO";
      a.style.cssText =
        "position:fixed;top:4px;left:4px;z-index:9999;background:magenta;color:white;padding:4px;";
      document.body.appendChild(a);
    });

    const timings = await page.evaluate(() => {
      return new Promise<{
        clickAt: number;
        vtStartAt: number | null;
        rscFetchStartAt: number | null;
        rscFetchDoneAt: number | null;
        rscFetchCount: number;
      }>((resolve) => {
        const result = {
          clickAt: 0,
          vtStartAt: null as number | null,
          rscFetchStartAt: null as number | null,
          rscFetchDoneAt: null as number | null,
          rscFetchCount: 0,
        };

        // Instrument window.fetch · count RSC fetches to the
        // destination so we can prove no double-fetch.
        const origFetch = window.fetch.bind(window);
        window.fetch = async (
          input: RequestInfo | URL,
          init?: RequestInit,
        ): Promise<Response> => {
          const url =
            typeof input === "string"
              ? input
              : input instanceof URL
                ? input.toString()
                : input.url;
          let hasRsc = false;
          const h = init?.headers;
          if (h) {
            if (h instanceof Headers) hasRsc = h.get("RSC") === "1";
            else if (Array.isArray(h))
              hasRsc = h.some(
                ([k, v]) => k.toLowerCase() === "rsc" && v === "1",
              );
            else hasRsc = (h as Record<string, string>).RSC === "1";
          }
          const matches = url.includes("/nex-native/directory") && hasRsc;
          if (matches) {
            result.rscFetchCount += 1;
            if (result.rscFetchStartAt === null) {
              result.rscFetchStartAt = performance.now();
            }
          }
          const res = await origFetch(input, init);
          if (matches && result.rscFetchDoneAt === null) {
            result.rscFetchDoneAt = performance.now();
          }
          return res;
        };

        // Shim startViewTransition so we can prove the slide fired
        // IMMEDIATELY on click (not after a warm-wait).
        const doc = document as unknown as {
          startViewTransition?: (
            cb: () => void,
          ) => { finished: Promise<void> };
        };
        const origStart = doc.startViewTransition;
        if (origStart) {
          doc.startViewTransition = function (
            this: Document,
            cb: () => void,
          ) {
            result.vtStartAt = performance.now();
            return origStart.call(this, cb);
          };
        }

        const link = document.getElementById("test-nav-link");
        if (!link) {
          resolve(result);
          return;
        }
        result.clickAt = performance.now();
        link.click();
        setTimeout(() => resolve(result), 2500);
      });
    });

    await page.waitForTimeout(500);
    await page.screenshot({ path: `${outDir}/01-after-nav.png` });

    const dtVt =
      timings.vtStartAt !== null
        ? timings.vtStartAt - timings.clickAt
        : null;
    const dtFetchStart =
      timings.rscFetchStartAt !== null
        ? timings.rscFetchStartAt - timings.clickAt
        : null;
    const dtFetchDone =
      timings.rscFetchDoneAt !== null
        ? timings.rscFetchDoneAt - timings.clickAt
        : null;

    console.log("Timeline (ms from click):");
    console.log(`  View Transition started: ${dtVt?.toFixed(1) ?? "n/a"}`);
    console.log(`  RSC fetch started:       ${dtFetchStart?.toFixed(1) ?? "n/a"}`);
    console.log(`  RSC fetch done:          ${dtFetchDone?.toFixed(1) ?? "n/a"}`);
    console.log(`  RSC fetch count:         ${timings.rscFetchCount}`);

    // Invariant 1: exactly ONE fetch per navigation (iter-3 fired 2).
    // Dev mode may serve the route from the router cache if a hover
    // prefetch landed earlier · in that case 0 is also acceptable.
    expect(
      timings.rscFetchCount,
      "Destination RSC must be fetched 0 or 1 times · never twice",
    ).toBeLessThanOrEqual(1);

    // Invariant 2: slide fired IMMEDIATELY on click (within 50 ms).
    // If this exceeds 50 ms we're back to a warm-wait regression.
    expect(
      dtVt,
      "View transition must start synchronously on click, not after a warm-wait",
    ).not.toBeNull();
    expect(dtVt!).toBeLessThan(50);

    // Landed URL assertion.
    expect(page.url()).toContain("/nex-native/directory");
  });
});
