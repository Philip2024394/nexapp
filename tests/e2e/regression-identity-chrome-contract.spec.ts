// tests/e2e/regression-identity-chrome-contract.spec.ts
//
// L-032 · country-identity browser-observable contract · authored
// 2026-11-26 under the Strict Complete-App Delivery Directive 2026-11-26.
//
// Why this spec exists
// --------------------
// The identity registry at `src/lib/nex-native/app/resolve-app-identity
// .ts:41` is the canonical source of truth: `"ireland" | "hq" |
// "worldwide"`. Indonesia was explicitly REMOVED from the registered
// list per the owner-sealed 2026-11-03 Ireland-only consolidation
// (line 30-40 of the resolver file). Worldwide was ADDED per the
// 2026-11-10 cycle-5 directive as a distinct no-country identity.
//
// Three prior-art guarantees we lean on (not re-tested here):
//   · `src/lib/nex-native/app/__tests__/resolve-app-identity.test.ts`
//     proves env-var → identity resolution + fail-closed on unknown
//     values at the unit level.
//   · `src/lib/nex-native/app/__tests__/identity-chrome-ssr.test.ts`
//     proves identity → palette at the server-component level.
//   · `src/lib/nex-native/seo/__tests__/site-url-resolver.test.ts`
//     proves identity → canonical site URL at the SEO level.
//
// What was MISSING is browser-observable evidence that the running
// deployment actually emits the correct `data-nex-identity` and
// `data-nex-world-root` attributes on the <style data-nex-world-root>
// tag that `_world-stylesheet.tsx:410-417` serialises. This is the
// one DOM-level contract an operator can verify without rebooting the
// server under different env vars.
//
// Observable contracts under test
// --------------------------------
//   A · The `<style data-nex-world-root>` tag is present on any
//       `/nex-native/*` page (SSR chrome mounted).
//   B · The emitted `data-nex-identity` value is one of the three
//       REGISTERED identities (`ireland` | `hq` | `worldwide`) —
//       NEVER `indonesia`, NEVER `none` in a configured deployment,
//       NEVER an unregistered string. This is the regression that
//       catches a silent reintroduction of Indonesia or a misconfigured
//       deployment emitting a bogus identity.
//   C · The emitted `data-nex-world-root` value matches the known
//       world-registry id (`ireland` for all three identities today
//       per `_world-stylesheet.tsx:311-328` + SSR unit tests).
//
// What this spec does NOT cover
// ------------------------------
//   · Re-running `resolve-app-identity.ts` under different env vars
//     at runtime (handled by the vitest unit tests cited above).
//   · Full palette-value verification (handled by the SSR integration
//     test with hex-level assertions).
//
// Boundaries honoured
//   · No product-code changed · no sealed config modified · no
//     identity reintroduced · no migration applied · no commit · no
//     push · no deployment.
//
// Classification: SPEC AUTHORED · exercises REAL running deployment
// DOM contract. If the dev server is not up, the test fails loudly
// (no false skip).

import { expect, test } from "@playwright/test";

// Public context · identity chrome is emitted for signed-out visitors
// on every /nex-native/* page, so no auth state needed.
test.use({ storageState: { cookies: [], origins: [] } });

const REGISTERED_IDENTITIES = ["ireland", "hq", "worldwide"] as const;
type RegisteredIdentity = (typeof REGISTERED_IDENTITIES)[number];

test.describe("L-032 · identity chrome browser-observable contract", () => {
  test("running deployment emits a registered identity on /nex-native", async ({
    page,
  }) => {
    test.setTimeout(45_000);

    const resp = await page.goto("/nex-native", {
      waitUntil: "domcontentloaded",
    });
    expect(resp?.status(), "/nex-native responds").toBeLessThan(500);

    // Wait for the SSR-emitted style tag. _world-stylesheet.tsx
    // renders it inside the layout tree so it is present on first
    // paint of any /nex-native/* page.
    const styleTag = page.locator("style[data-nex-world-root]").first();
    await expect(
      styleTag,
      "SSR identity-chrome <style data-nex-world-root> must be present",
    ).toBeAttached({ timeout: 10_000 });

    const identity = await styleTag.getAttribute("data-nex-identity");
    const worldRoot = await styleTag.getAttribute("data-nex-world-root");

    // Contract B · identity MUST be one of the three registered values.
    // This is the regression that catches a silent reintroduction of
    // "indonesia" (sealed OFF per 2026-11-03 directive) or any other
    // unregistered string.
    expect(
      REGISTERED_IDENTITIES as readonly string[],
      `data-nex-identity="${identity}" must be one of ${JSON.stringify(REGISTERED_IDENTITIES)} · "indonesia" is sealed OFF per 2026-11-03`,
    ).toContain(identity);

    // Explicit anti-regression for the removed identity. Belt-and-
    // braces · the toContain above would also fail, but this makes
    // the failure message unambiguous.
    expect(
      identity,
      'data-nex-identity MUST NOT be "indonesia" · identity sealed OFF per 2026-11-03',
    ).not.toBe("indonesia");

    // Contract C · the world-root today is "ireland" for all three
    // identities per _world-stylesheet.tsx:311-328. If a future directive
    // registers a new world this assertion will fail loudly and force
    // the test to be updated with the new mapping.
    expect(
      worldRoot,
      `data-nex-world-root="${worldRoot}" currently expected to be "ireland" per _world-stylesheet.tsx fall-through`,
    ).toBe("ireland");

    // Record the observed identity in the test annotation so the
    // evidence log captures WHICH identity the deployment is serving
    // without needing to grep stdout.
    test.info().annotations.push({
      type: "observed-identity",
      description: `data-nex-identity=${identity} · data-nex-world-root=${worldRoot}`,
    });
  });

  test("identity chrome also present on the splash page", async ({ page }) => {
    // Splash page is the deepest consumer surface — if identity chrome
    // is absent here the whole country-scoped behaviour is broken.
    const resp = await page.goto("/nex-native", {
      waitUntil: "domcontentloaded",
    });
    expect(resp?.status(), "splash responds").toBeLessThan(500);

    const identityAttr = await page
      .locator("style[data-nex-world-root]")
      .first()
      .getAttribute("data-nex-identity");
    expect(
      identityAttr,
      "splash page must render identity chrome",
    ).not.toBeNull();
    expect(
      REGISTERED_IDENTITIES as readonly string[],
      `splash identity "${identityAttr}" must be registered`,
    ).toContain(identityAttr as RegisteredIdentity);
  });
});
