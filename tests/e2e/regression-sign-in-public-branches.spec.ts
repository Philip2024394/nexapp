// tests/e2e/regression-sign-in-public-branches.spec.ts
//
// NEX sign-in public-surface regression · 2026-11-27.
// --------------------------------------------------------------------
// Promoted from the throwaway `probe-signin-crash.spec.ts` diagnostic
// (and its sibling `probe.playwright.config.ts`) authored earlier in
// the 2026-11-27 investigation that confirmed the cream sign-in
// fallback appears only on genuine error states.
//
// The investigation is closed: the sign-in surface renders cleanly on
// every documented public query-string branch. This file preserves
// that signal as a durable regression so any future reintroduction of
// a client-side throw inside the sign-in segment is caught by the
// stage-a-pixel7 regression suite instead of by customers.
//
// Observable contracts (per URL branch):
//   1. The page responds with an HTTP status > 0 (goto succeeds).
//   2. The sealed cream error fallback locator
//      `[data-nex-segment-error='auth']` is NOT visible. If it were,
//      the sign-in segment threw during render.
//   3. No uncaught exceptions reach `window` (`page.on('pageerror')`
//      list is empty at the end of the test window).
//
// Covered branches:
//   · `/nex-native/sign-in`              · bare sign-in
//   · `/nex-native/sign-in?mode=signup`  · signup variant
//   · `/nex-native/sign-in?e=...&m=...`  · 3 OAuth error-copy variants
//   · `/nex-native/sign-in?next=...`     · post-auth return URL
//
// What this spec does NOT cover:
//   · Form field rendering per branch (anchored separately by
//     `journey-buyer-signup-wiring.spec.ts`).
//   · The cream fallback's own contract on forced failure (anchored
//     by `src/app/nex-native/sign-in/__tests__/error-fallback-
//     contract.test.tsx`).
//   · Rate-limiting, OAuth provider callback, or `createNexAccount`
//     submission (each anchored by its own spec).

import { expect, test } from "@playwright/test";

const BRANCHES = [
  "/nex-native/sign-in",
  "/nex-native/sign-in?mode=signup",
  "/nex-native/sign-in?e=oauth_unavailable&m=Google%20sign-in%20is%20currently%20unavailable.",
  "/nex-native/sign-in?e=oauth_cancelled&m=Google%20sign-in%20was%20cancelled.",
  "/nex-native/sign-in?e=oauth_exchange_failed&m=We%20couldnt%20finish",
  "/nex-native/sign-in?next=%2Fnex-native%2Fprofile",
];

test.describe("sign-in public surface · no uncaught errors · fallback hidden", () => {
  for (const relativeUrl of BRANCHES) {
    test(`sign-in branch · ${relativeUrl}`, async ({ page }) => {
      const pageErrors: string[] = [];
      page.on("pageerror", (err) => {
        pageErrors.push(`${err.name}: ${err.message}`);
      });

      const resp = await page.goto(relativeUrl, {
        waitUntil: "networkidle",
        timeout: 30_000,
      });
      const status = resp?.status() ?? 0;
      expect(status, `page loaded with some HTTP status for ${relativeUrl}`).toBeGreaterThan(0);

      // The cream error fallback exposes a deterministic locator; if it
      // becomes visible the segment threw during render. We give the
      // segment a brief settle window (hydration + router flush) before
      // asserting absence — 1200ms matches the probe's previous value.
      await page.waitForTimeout(1200);

      const fallbackVisible = await page
        .locator("[data-nex-segment-error='auth']")
        .first()
        .isVisible()
        .catch(() => false);

      expect(
        fallbackVisible,
        `cream error fallback must NOT appear on ${relativeUrl}`,
      ).toBe(false);

      expect(
        pageErrors,
        `no uncaught errors on ${relativeUrl} · observed: ${pageErrors.join(" | ")}`,
      ).toEqual([]);
    });
  }
});
