// tests/e2e/pwa-install-cadence.spec.ts
//
// T-5.2 · PWA install promotion cadence · sealed 2026-11-24.
//
// Sealed rule (project_nexapp_pwa_install_and_location_timing_sealed_
// 2026_11_24.md): install prompt may be shown ONLY after:
//   register → Contacts → meaningful interaction (add contact OR send
//   first message).
// Never during registration / themes / SOS setup / first chat / active
// SOS / payment. Cooldown on dismiss. Permanent "Install NEX" side-
// drawer row when the platform supports installation.
//
// Spec authored under Stage A Conditional Approval 2026-11-24.
//
// Observable behaviour under test:
//   · On a fresh signed-out visit to the splash / welcome, NO install
//     prompt renders.
//   · On the registration page, NO install prompt renders.
//   · On a chat-themes page, NO install prompt renders.
//   · On /emergency-help, NO install prompt renders.
//   · The sealed install surface (/nex-native/install) is directly
//     reachable and renders install instructions (Android · iOS
//     Share-to-Home-Screen · desktop).
//
// What this spec canNOT do:
//   · Trigger a real `beforeinstallprompt` event — Chromium emits it
//     only against production-grade manifests served over HTTPS with
//     installability heuristics met. We assert the UI contract instead.
//
// Classification: SPEC AUTHORED.

import { expect, test } from "@playwright/test";

const FORBIDDEN_WINDOWS = [
  "/nex-native",
  "/nex-native/sign-in",
  "/nex-native/chat-themes-library",
  "/nex-native/emergency-help",
];

test.describe.serial("T-5.2 · PWA install promotion cadence", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  for (const route of FORBIDDEN_WINDOWS) {
    test(`${route} · install prompt banner MUST NOT render`, async ({ page }) => {
      // Remediation 2026-11-24 · forbidden-window routes carry
      // long-poll connections; wait for DOM parsed + body attached so
      // `toHaveCount(0)` has a stable document to probe. Assertion
      // strength preserved · we still require zero install banners.
      //
      // L-025 hardening 2026-11-26 · under full-suite load the iOS
      // install-home-slider (rendered from _install-home-slider-client
      // after the client-side eligibility check resolves) occasionally
      // hydrates AFTER our `toHaveCount(0)` snapshot on iphone-emulated.
      // Matching the sealed L-007 precedent in
      // `nex-pwa-install-and-location.spec.ts`, we add a bounded
      // `networkidle` wait so the hydration race is resolved BEFORE we
      // probe. This is NOT a weakening: the assertion `toHaveCount(0)`
      // is unchanged and the window of enforcement widens (hydration
      // completes → any late banner would now be caught, not missed).
      const response = await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(response?.status(), `${route} responds`).toBeLessThan(500);
      await page.waitForFunction(() => Boolean(document.body), null, {
        timeout: 10_000,
      });
      await page.waitForLoadState("networkidle", { timeout: 20_000 });

      // The sealed install promotion component is expected to carry a
      // stable `data-nex-install-prompt` test-id. We also match the
      // header text "Install NEX" (sealed copy from install page) as a
      // defensive fallback.
      const promptBanner = page
        .locator("[data-nex-install-prompt]")
        .or(page.getByRole("dialog", { name: /install nex/i }));
      await expect(
        promptBanner,
        `${route} · no install promotion banner in this window`,
      ).toHaveCount(0);
    });
  }

  test("/nex-native/install · sealed install surface renders instructions for the running platform", async ({
    page,
  }, testInfo) => {
    // Cycle 3 correction 2026-11-24 · the sealed NEX-022 install UI is
    // PLATFORM-AWARE: `_install-client.tsx` chooses ONE state from
    // {chromium, ios, android-fallback, desktop, installed,
    // unsupported} based on the browser's UA and emits only that
    // state's copy. The previous assertion required both Android and
    // iOS text simultaneously, which contradicts the sealed design.
    // We now assert the copy for the device profile the project is
    // actually running under:
    //   · `stage-a-pixel7`     → Pixel 7 (Android UA) → Android copy
    //   · `nex-pwa-install-and-location-pixel7` → same
    //   · `nex-pwa-install-and-location-iphone-emulated` → iOS copy
    //   · `nex-pwa-install-and-location-desktop` → desktop guidance
    const response = await page.goto("/nex-native/install", {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status(), "/install responds 200").toBe(200);
    await page.waitForFunction(() => Boolean(document.body), null, {
      timeout: 10_000,
    });

    // Give the detect-and-choose effect (1.2s timer in
    // `_install-client.tsx`) a chance to resolve. The detecting
    // state's "Checking your device…" placeholder should transition
    // to the platform branch within ~1.5s. We assert visibility with
    // Playwright's auto-retry so we don't need a fixed sleep.
    const projectName = testInfo.project.name;
    const ua = await page.evaluate(() => navigator.userAgent);
    const isAndroidProject =
      /pixel7/i.test(projectName) ||
      (/Android/i.test(ua) && !/iPhone|iPad|iPod/.test(ua));
    const isIphoneProject =
      /iphone/i.test(projectName) || /iPhone|iPad|iPod/.test(ua);
    const isDesktopProject =
      /desktop/i.test(projectName) || (!isAndroidProject && !isIphoneProject);

    if (isIphoneProject) {
      await expect(
        page.getByText(/add to home screen|share|home screen/i).first(),
        "iOS Share → Add to Home Screen copy visible on iPhone project",
      ).toBeVisible({ timeout: 5_000 });
    } else if (isAndroidProject) {
      await expect(
        page.getByText(/android|install app|home screen|browser menu/i).first(),
        "Android install instructions visible on Pixel 7 project",
      ).toBeVisible({ timeout: 5_000 });
    } else if (isDesktopProject) {
      await expect(
        page.getByText(/computer|desktop|address bar|install nex/i).first(),
        "desktop install guidance visible on desktop project",
      ).toBeVisible({ timeout: 5_000 });
    }
  });

  test("dismissing the install prompt enters cooldown · must not re-prompt on next load", async ({
    page,
  }) => {
    test.skip(
      true,
      "BLOCKED-PENDING-FIXTURE · cooldown assertion needs a seeded " +
        "authenticated account past the register→contacts→interaction gate",
    );
  });
});
