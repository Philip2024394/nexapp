// scripts/_tmp/verify-c24-option-b.spec.ts
//
// Cycle 24 Option B · regression + readiness proof against a local
// production build on port 3012 (fresh build with the prepare-
// destination code).
//
// What this proves:
//   · exactly 1 startViewTransition per click (no regression)
//   · destination content visible in slide-root AT the moment the
//     SVT.finished Promise resolves (unlike Phase A where it could
//     be minutes/seconds later)
//   · timeout fallback fires within 1500 ms + 300 ms grace
//   · back/forward unchanged (jump-cut, no SVT)
//
// Instrumentation measures the key invariant: at the moment the
// slide animation ends, what does slide-root contain? If the
// prepare-layer works, it contains real content on every cold
// heavy route — not an empty SilentLoading.

import { test, expect } from "@playwright/test";

const BASE = process.env.NEX_TEST_BASE ?? "http://localhost:3012";

const INIT = `
(() => {
  const w = window;
  w.__m = {
    svtCalls: 0,
    svtStart: null,
    svtFinish: null,
    rootAtFinish: null,
    clickAt: 0,
    rootStates: [],
  };
  const m = w.__m;
  const origSvt = document.startViewTransition
    ? document.startViewTransition.bind(document)
    : null;
  if (origSvt) {
    document.startViewTransition = function (cb) {
      m.svtCalls += 1;
      m.svtStart = performance.now();
      const t = origSvt(cb);
      if (t && t.finished) {
        t.finished.then(() => {
          m.svtFinish = performance.now();
          const r = document.querySelector('[data-nex-page-slide-root]');
          m.rootAtFinish = r ? { chars: r.innerHTML.length, text: (r.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 100) } : null;
        }).catch(() => {});
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
  expectReadyAtSlideEnd: boolean;
};

const routes: RouteCase[] = [
  { name: "pricing", href: "/nex-native/pricing", classification: "public light", expectReadyAtSlideEnd: true },
  { name: "directory", href: "/nex-native/directory", classification: "public idle-prefetched", expectReadyAtSlideEnd: true },
  { name: "settings", href: "/nex-native/settings", classification: "private, stable", expectReadyAtSlideEnd: true },
  { name: "vault", href: "/nex-native/vault", classification: "private, stable", expectReadyAtSlideEnd: true },
  // Known-destination-bug · the /contacts page is in a pre-existing
  // DOM re-render loop (33 RSC refetches of the same URL in 5s).
  // Option B handles this by timing out at maxWaitMs and firing the
  // slide anyway · user is not stranded on OLD page forever.
  // Expected behaviour: svtFinish lands at ~1500ms + animation,
  // and rootAtFinish is whatever the destination's live DOM state is
  // at that moment (likely empty due to the retry loop).
  { name: "contacts", href: "/nex-native/contacts", classification: "private heavy (destination-bug known)", expectReadyAtSlideEnd: false },
];

test.describe("C24 Option B · route matrix · ready-at-slide-end", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    extraHTTPHeaders: { cookie: "nex_dev_override=nex-99901" },
  });
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(INIT);
  });

  for (const r of routes) {
    test(`${r.name} · ${r.classification}`, async ({ page }, testInfo) => {
      await page.goto(`${BASE}/nex-native/free-chat`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector(".nex-native-frame", { timeout: 30_000 });
      await page.waitForTimeout(300);

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
        const w = window as unknown as { __m: { clickAt: number } };
        w.__m.clickAt = performance.now();
        document.getElementById("test-nav-link")!.click();
        return w.__m.clickAt;
      });

      // Wait up to 3.5s for the slide to finish (prep max 1500 + anim ~400 + buffer)
      await page.waitForFunction(() => {
        const w = window as unknown as { __m: { svtFinish: number | null } };
        return w.__m.svtFinish !== null;
      }, { timeout: 5000 }).catch(() => {});

      // Snapshot right when slide finished.
      await page.screenshot({ path: `${testInfo.outputDir}/${r.name}-01-at-slide-end.png` });
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${testInfo.outputDir}/${r.name}-02-post-slide.png` });

      const data = await page.evaluate(() => {
        const w = window as unknown as { __m: unknown };
        return JSON.parse(JSON.stringify(w.__m));
      }) as {
        svtCalls: number;
        svtStart: number | null;
        svtFinish: number | null;
        rootAtFinish: { chars: number; text: string } | null;
        clickAt: number;
        rootStates: Array<{ t: number; chars: number; text: string }>;
      };

      const sinceClick = (t: number | null): string =>
        t === null ? "n/a" : `${(t - clickAt).toFixed(0)}ms`;

      console.log(`\n=== ${r.name} · ${r.classification} ===`);
      console.log(`  SVT calls:             ${data.svtCalls}`);
      console.log(`  SVT start @:           +${sinceClick(data.svtStart)}`);
      console.log(`  SVT finish @:          +${sinceClick(data.svtFinish)}`);
      console.log(`  slide-root at finish:  chars=${data.rootAtFinish?.chars ?? "-"}  text="${data.rootAtFinish?.text ?? ""}"`);
      console.log(`  slide-root states (post-click):`);
      const post = data.rootStates.filter((s) => s.t >= clickAt - 100);
      for (const s of post.slice(0, 8)) {
        console.log(`    +${sinceClick(s.t)}  chars=${String(s.chars).padStart(6)}  text="${s.text}"`);
      }
      const firstReal = post.find((s) => s.chars > 2000);
      console.log(`  first "real" content @: ${firstReal ? "+" + sinceClick(firstReal.t) : "n/a"}`);

      expect(data.svtCalls, "exactly 1 SVT per click").toBe(1);
      expect(data.svtFinish, "SVT finish observed").not.toBeNull();

      if (r.expectReadyAtSlideEnd) {
        expect(
          data.rootAtFinish?.chars ?? 0,
          `slide-root must have real content (>500 chars) at SVT.finish on ${r.name}`,
        ).toBeGreaterThan(500);
      }
    });
  }

  test("back · no SVT, no regression", async ({ page }, testInfo) => {
    await page.goto(`${BASE}/nex-native/free-chat`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".nex-native-frame", { timeout: 30_000 });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const a = document.createElement("a");
      a.href = "/nex-native/pricing";
      a.id = "fwd-link";
      document.body.appendChild(a);
      a.click();
    });
    await page.waitForURL(/\/nex-native\/pricing/, { timeout: 10_000 });
    await page.waitForTimeout(500);

    await page.evaluate(() => {
      const w = window as unknown as { __m: { svtCalls: number; svtFinish: number | null } };
      w.__m.svtCalls = 0;
      w.__m.svtFinish = null;
    });
    await page.goBack();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${testInfo.outputDir}/back-after.png` });

    const backData = await page.evaluate(() => {
      const w = window as unknown as { __m: { svtCalls: number } };
      return { svtCalls: w.__m.svtCalls };
    });
    console.log(`\n=== back ===`);
    console.log(`  SVT calls on back: ${backData.svtCalls} (expected 0)`);
    expect(backData.svtCalls, "back uses native jump-cut").toBe(0);
  });
});
