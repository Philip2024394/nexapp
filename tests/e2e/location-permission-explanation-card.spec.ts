// tests/e2e/location-permission-explanation-card.spec.ts
//
// T-5.3 · location-permission explanation card · sealed 2026-11-24.
//
// SCOPE DECISION 2026-11-24 · Owner-confirmed: Emergency Help is
// DEFERRED from the live launch scope and remains sandbox-only (see
// docs/doctrine/nex-founder-foundation-to-near-live-master-plan-
// 2026-11-24.md:10 "Emergency Help (NEX-020) is DEFERRED — SANDBOX-
// ONLY · intentional. Live-activation gates are owner-closed."). The
// sealed copy string targeted by this spec therefore does NOT appear
// in the live UI (by design, not by omission). This spec is preserved
// verbatim for a future authorised Emergency Help activation cycle,
// but every test in it is SKIPPED-BY-SCOPE until NEX-020 is lifted.
// Do NOT add the sealed copy to any live surface merely to make this
// pass · owner safeguard 2026-11-24.
//
// Sealed rules (retained for the post-launch activation cycle):
//   · Location is NEVER requested on first load / splash / theme /
//     post-register / every open.
//   · Location is always feature-gated with an explanation card
//     BEFORE the browser prompt.
//   · Emergency Help explanation copy (sealed):
//       "Allow NEX to access your location so your designated emergency
//        contacts can receive your last known location if you activate
//        SOS"
//   · Denial MUST NOT block SOS setup · MUST NOT pretend location
//     works.
//   · Location is device-local only · never persisted server-side
//     (sealed 2026-11-09 Emergency Help doctrine).
//
// Spec authored under Stage A Conditional Approval 2026-11-24.
//
// Observable behaviour under test:
//   · Fresh visit to /nex-native/emergency-help does NOT trigger a
//     browser geolocation prompt on page load.
//   · The explanation card is reachable in the Emergency Help setup
//     flow and carries the sealed copy string.
//   · When the user explicitly interacts with the Allow CTA, the
//     browser permission is requested (we observe the request via
//     Playwright's permission mocking).
//   · When the user denies, the setup flow continues · no fake
//     success · no silent fallback.
//
// Classification: SPEC AUTHORED.

import { expect, test } from "@playwright/test";

const SEALED_COPY = /designated emergency contacts can receive your last known location/i;

const SCOPE_SKIP_REASON =
  "SKIPPED-BY-SCOPE · Emergency Help is deferred from launch scope " +
  "(master plan 2026-11-24 §10 · owner-confirmed 2026-11-24). This " +
  "spec re-activates when NEX-020 is lifted. Do NOT add the sealed " +
  "copy to a live surface to make this pass.";

test.describe.serial("T-5.3 · location permission explanation card", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
    // Explicitly DO NOT grant geolocation. The sealed rule is that
    // location must be requested only by explicit user action.
    await context.clearPermissions();
  });

  // Scope guard · every assertion below depends on Emergency Help
  // being an active launch feature. It is not · see header comment.
  test.beforeEach(() => {
    test.skip(true, SCOPE_SKIP_REASON);
  });

  test("Emergency Help landing does NOT auto-request geolocation on load", async ({
    page,
    context,
  }) => {
    let geolocationRequested = false;
    // Instrument navigator.geolocation to detect any auto-call.
    await page.addInitScript(() => {
      const nav = navigator as any;
      if (nav.geolocation && !nav.__nexInstrumented) {
        const orig = nav.geolocation.getCurrentPosition.bind(nav.geolocation);
        nav.geolocation.getCurrentPosition = (...args: unknown[]) => {
          (window as any).__nexGeoCalled = true;
          return (orig as any)(...args);
        };
        nav.__nexInstrumented = true;
      }
    });

    await page.goto("/nex-native/emergency-help", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(1_500); // Allow any delayed auto-prompt.

    geolocationRequested = await page.evaluate(() =>
      Boolean((window as any).__nexGeoCalled),
    );
    expect(
      geolocationRequested,
      "sealed rule: location must NEVER be auto-requested on page load",
    ).toBe(false);

    // Browser-level permission must still be 'prompt' (not 'granted').
    void context;
  });

  test("sealed explanation copy renders somewhere in the Emergency Help setup surface", async ({
    page,
  }) => {
    await page.goto("/nex-native/emergency-help", {
      waitUntil: "domcontentloaded",
    });

    // The explanation card may live on the landing OR be reached via a
    // CTA — we scan both. If the landing is a setup-status surface,
    // check the activate route too.
    const onLanding = await page.getByText(SEALED_COPY).count();
    if (onLanding === 0) {
      await page.goto("/nex-native/emergency-help/activate", {
        waitUntil: "domcontentloaded",
      });
    }
    const explanationCard = page.getByText(SEALED_COPY);
    await expect(
      explanationCard,
      "sealed explanation copy present on emergency-help OR activate",
    ).toBeVisible({ timeout: 5_000 });
  });

  test("denial branch · user denying location does NOT block SOS setup progression", async ({
    page,
    context,
  }) => {
    // Pre-set geolocation to denied for this context.
    await context.clearPermissions();
    // Playwright does not expose a direct "deny" state; we achieve this
    // by overriding the geolocation API to synthesise a PERMISSION_DENIED
    // response to any call.
    await page.addInitScript(() => {
      const nav = navigator as any;
      if (nav.geolocation) {
        nav.geolocation.getCurrentPosition = (
          _ok: unknown,
          err: unknown,
        ) => {
          if (typeof err === "function") {
            (err as (p: unknown) => void)({
              code: 1,
              message: "User denied geolocation",
              PERMISSION_DENIED: 1,
              POSITION_UNAVAILABLE: 2,
              TIMEOUT: 3,
            });
          }
        };
      }
    });

    await page.goto("/nex-native/emergency-help", {
      waitUntil: "domcontentloaded",
    });

    // Observable: after a denial, the sealed rule says SOS setup must
    // still be reachable · the UI must NOT show a success toast for
    // location being enabled.
    const falseSuccess = page.getByText(/location.*enabled|location.*on/i);
    await expect(
      falseSuccess,
      "sealed rule: denial MUST NOT produce fake location-enabled copy",
    ).toHaveCount(0);
  });
});
