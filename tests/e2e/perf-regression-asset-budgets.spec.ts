// tests/e2e/perf-regression-asset-budgets.spec.ts
//
// Perf regression guardrail · owner-sealed 2026-11-23 (CLAUDE.md §10).
// -----------------------------------------------------------------------------
// Protects two verified loading fixes from regressing:
//
//   1. **Backdrop preload is desktop-only.** The 2.1 MB country-specific
//      PNG was unconditionally preloaded in src/app/nex-native/layout.tsx,
//      shipping to mobile viewports that never render it. The fix added
//      `media="(min-width: 500px)"` so mobile skips the preload entirely.
//
//   2. **Supabase origin is preconnected.** Every signed-in route hits
//      Supabase. Opening the TLS handshake in parallel with the HTML
//      download saves ~1 RTT on the first query. The fix added
//      <link rel="preconnect"> + <link rel="dns-prefetch"> pointing at
//      the resolved `NEXT_PUBLIC_NEX_SUPABASE_URL`.
//
// The tests do NOT grep source code (renaming the asset would bypass
// that). They inspect the live DOM + network behavior of the running
// Next.js server, so the guardrail survives file renames.
//
// Budget: a single preloaded image ≥ 600 KB that is not media-gated to
// desktop-only is considered a regression. Mobile should fetch zero
// preloaded images ≥ 600 KB. The budget is deliberately above the
// optimised backdrop size (2.1 MB · desktop-gated) so a correctly-
// gated large asset still passes, but any unconditional preload of a
// large image fails.
//
// If you need to increase the budget, that is an explicit owner review
// decision · see CLAUDE.md §10 (non-negotiable Definition of Done).

import { test, expect, devices } from "@playwright/test";

// -----------------------------------------------------------------------------
// Budget constants · change via owner-approved review only.
// -----------------------------------------------------------------------------
const PRELOAD_IMAGE_BUDGET_BYTES = 600 * 1024; // 600 KB
// Target route for the critical-path checks. Public landing page · does
// not require authentication so CI can run against a fresh server
// without seeded accounts.
const TARGET_ROUTE = "/nex-native";

type PreloadDescriptor = {
  href: string;
  as: string | null;
  media: string | null;
  fetchPriority: string | null;
};

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
async function collectPreloadLinks(
  page: import("@playwright/test").Page
): Promise<PreloadDescriptor[]> {
  return page.$$eval('link[rel="preload"]', (links) =>
    links.map((el) => {
      const link = el as HTMLLinkElement;
      return {
        href: link.href,
        as: link.getAttribute("as"),
        media: link.getAttribute("media"),
        fetchPriority: link.getAttribute("fetchpriority"),
      };
    })
  );
}

async function fetchByteSize(
  page: import("@playwright/test").Page,
  url: string
): Promise<number | null> {
  try {
    const response = await page.request.fetch(url, { method: "GET" });
    if (!response.ok()) return null;
    const body = await response.body();
    return body.byteLength;
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
// Desktop viewport: preloads are allowed, but any single image preload
// must be media-gated OR under the budget.
// -----------------------------------------------------------------------------
test("desktop: no unconditional image preload exceeds the budget", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();
  try {
    await page.goto(TARGET_ROUTE, { waitUntil: "domcontentloaded" });
    const preloads = await collectPreloadLinks(page);
    const imagePreloads = preloads.filter((p) => p.as === "image");

    const sized = await Promise.all(
      imagePreloads.map(async (p) => ({
        ...p,
        size: await fetchByteSize(page, p.href),
      }))
    );

    const overBudgetUnconditional = sized.filter((p) => {
      if (p.size === null) return false;
      if (p.size < PRELOAD_IMAGE_BUDGET_BYTES) return false;
      if (p.media && p.media.includes("min-width")) return false;
      return true;
    });

    expect(
      overBudgetUnconditional,
      `Found unconditional image preload(s) above ${PRELOAD_IMAGE_BUDGET_BYTES} bytes. ` +
        `Either compress the asset, or add a media="(min-width: Npx)" attribute ` +
        `to the <link rel="preload"> so mobile skips it. Offending entries: ` +
        JSON.stringify(overBudgetUnconditional, null, 2)
    ).toEqual([]);
  } finally {
    await context.close();
  }
});

// -----------------------------------------------------------------------------
// Mobile viewport: no large image preload should be matched. We check
// `window.matchMedia(media).matches` for each image preload's media
// attribute. Any unconditional (no media attr) image preload larger
// than the budget is a regression.
// -----------------------------------------------------------------------------
test("mobile: no large image preload is active on a mobile viewport", async ({
  browser,
}) => {
  const context = await browser.newContext({ ...devices["Pixel 7"] });
  const page = await context.newPage();
  try {
    await page.goto(TARGET_ROUTE, { waitUntil: "domcontentloaded" });

    const activePreloads = await page.evaluate(() => {
      const links = Array.from(
        document.querySelectorAll('link[rel="preload"]')
      ) as HTMLLinkElement[];
      return links
        .filter((link) => link.getAttribute("as") === "image")
        .filter((link) => {
          const media = link.getAttribute("media");
          if (!media) return true;
          return window.matchMedia(media).matches;
        })
        .map((link) => ({
          href: link.href,
          media: link.getAttribute("media"),
        }));
    });

    const sized = await Promise.all(
      activePreloads.map(async (p) => ({
        ...p,
        size: await fetchByteSize(page, p.href),
      }))
    );

    const overBudgetOnMobile = sized.filter(
      (p) => p.size !== null && p.size >= PRELOAD_IMAGE_BUDGET_BYTES
    );

    expect(
      overBudgetOnMobile,
      `Mobile viewport would download preloaded image(s) ≥ ${PRELOAD_IMAGE_BUDGET_BYTES} bytes. ` +
        `Add media="(min-width: 500px)" (or a tighter breakpoint) to the ` +
        `<link rel="preload">. Offending entries: ` +
        JSON.stringify(overBudgetOnMobile, null, 2)
    ).toEqual([]);
  } finally {
    await context.close();
  }
});

// -----------------------------------------------------------------------------
// Supabase preconnect: every signed-in route hits Supabase · the TLS
// handshake must be opened in parallel with the HTML download.
// -----------------------------------------------------------------------------
test("desktop: supabase origin is preconnected or dns-prefetched", async ({
  browser,
}) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_NEX_SUPABASE_URL;
  test.skip(
    !supabaseUrl,
    "NEXT_PUBLIC_NEX_SUPABASE_URL unset · preconnect hint cannot be emitted"
  );

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();
  try {
    await page.goto(TARGET_ROUTE, { waitUntil: "domcontentloaded" });

    const hints = await page.$$eval(
      'link[rel="preconnect"], link[rel="dns-prefetch"]',
      (links) =>
        links.map((el) => {
          const link = el as HTMLLinkElement;
          return { rel: link.getAttribute("rel"), href: link.href };
        })
    );

    const matchesSupabase = hints.some((h) =>
      h.href.startsWith(supabaseUrl!)
    );

    expect(
      matchesSupabase,
      `Expected <link rel="preconnect"> or <link rel="dns-prefetch"> to ` +
        `point at ${supabaseUrl}. Found hints: ${JSON.stringify(hints)}`
    ).toBe(true);
  } finally {
    await context.close();
  }
});
