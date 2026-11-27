// tests/e2e/regression-public-surfaces-no-crash.spec.ts
//
// NEX public-surface no-crash regression · 2026-11-27.
// --------------------------------------------------------------------
// Companion to `regression-sign-in-public-branches.spec.ts`. That
// spec anchors the sign-in segment specifically. This spec extends
// the same shape to the ten OTHER top-level public surfaces that
// the dev-password gate does not block — if any of them throws
// during render, the segment's error boundary surfaces a
// `[data-nex-segment-error="<section>"]` fallback and we catch it
// here rather than at a customer's screen.
//
// Observable contracts (per URL):
//   1. The page responds with an HTTP status > 0 (goto succeeds).
//   2. NO element with the marker `[data-nex-segment-error]` is
//      visible after a short hydration + router-flush settle window.
//      This single selector catches both the shared dark-emerald
//      SegmentErrorBoundary and the sign-in cream fallback.
//   3. No uncaught exceptions reach `window` (`page.on('pageerror')`
//      list is empty at the end of the test window).
//
// Covered surfaces (all public, no auth gate):
//   · /nex-native/pricing       · region-specific pricing table
//   · /nex-native/why-nex       · marketing explainer
//   · /nex-native/terms         · terms of service
//   · /nex-native/privacy       · privacy policy
//   · /nex-native/about         · about / mission
//   · /nex-native/support       · support / contact
//   · /nex-native/help          · help centre
//   · /nex-native/for-creators  · creator onboarding explainer
//   · /nex-native/for-sellers   · seller onboarding explainer
//   · /nex-native/switch        · switch-platform calculator
//
// What this spec does NOT cover:
//   · Form submissions, per-surface content, or region-specific
//     price-label correctness (anchored separately by
//     `journey-single-app-02-ip-pickup.spec.ts` and
//     `src/lib/nex-native/commercial/__tests__/region-resolver.test.ts`).
//   · Authenticated surfaces (`/manage`, `/settings`, `/profile`,
//     `/orders`) — these ride the dev-password gate and are
//     anchored by the authenticated journey specs.
//   · The sign-in segment — anchored by
//     `regression-sign-in-public-branches.spec.ts`.
//
// Placement rationale: mounted under the public
// `mobile-chromium-pixel7` project (no `auth-setup` dependency) for
// the same reason as the sign-in regression — these surfaces are
// genuinely tested as unauthenticated.

import { expect, test } from "@playwright/test";

const SURFACES = [
  "/nex-native/pricing",
  "/nex-native/why-nex",
  "/nex-native/terms",
  "/nex-native/privacy",
  "/nex-native/about",
  "/nex-native/support",
  "/nex-native/help",
  "/nex-native/for-creators",
  "/nex-native/for-sellers",
  "/nex-native/switch",
];

test.describe("public surfaces · no uncaught errors · no segment fallback visible", () => {
  for (const relativeUrl of SURFACES) {
    test(`public surface · ${relativeUrl}`, async ({ page }) => {
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

      // Give the segment a brief settle window (hydration + router
      // flush) before asserting absence — 1200 ms matches the
      // sign-in regression's value.
      await page.waitForTimeout(1200);

      const fallbackVisible = await page
        .locator("[data-nex-segment-error]")
        .first()
        .isVisible()
        .catch(() => false);

      expect(
        fallbackVisible,
        `no segment-error fallback must appear on ${relativeUrl}`,
      ).toBe(false);

      expect(
        pageErrors,
        `no uncaught errors on ${relativeUrl} · observed: ${pageErrors.join(" | ")}`,
      ).toEqual([]);
    });
  }
});
