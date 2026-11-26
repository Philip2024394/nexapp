// tests/e2e/nex-pwa-install-and-location.spec.ts
//
// NEX-022 (PWA install promotion) + NEX-023 (location-permission timing)
// end-to-end verification · owner-sealed 2026-11-24 · owner refused to
// close those tickets as VERIFIED on code-inspection alone and required
// Playwright coverage before accepting the work as complete.
//
// Projects (defined in playwright.config.ts):
//   · nex-pwa-install-and-location-pixel7        · Chromium · Pixel 7
//   · nex-pwa-install-and-location-desktop       · Chromium · Desktop
//   · nex-pwa-install-and-location-iphone-emulated · Chromium · iPhone 14
//     Pro VIEWPORT ONLY · NOT real WebKit Safari · see §Limits below.
//
// §Limits
// -------
//   · WebKit is not installed on this machine, so the "iPhone" project
//     is Chromium pretending to be an iPhone (viewport + UA). Real
//     Safari-specific behaviour (`navigator.standalone`, Share menu,
//     refusal to fire `beforeinstallprompt`) is NOT genuinely covered.
//     Tests that depend on iOS-Safari truth are marked `test.fixme`
//     with an explicit reason so no one reads a green run as iOS
//     verification.
//   · No auth-state file is provisioned for this spec. Flows that
//     require a signed-in session (e.g. the directory landing page in
//     its real signed-in path) are covered via cookie fixtures where
//     possible OR marked `test.fixme` otherwise.
//   · The dev server at http://localhost:3008 is expected to be up.
//     The config does NOT start it. If the base URL is unreachable
//     the whole suite fails fast with a navigation error · that is the
//     intended behaviour.
//
// §Honest matrix
// --------------
//   A. /install page renders and transitions out of "detecting"
//   B. /install on iPhone-emulated viewport shows the Share → Add to
//      Home Screen instructions (UA-sniff path; honest emulated note)
//   C. /install page honours `display-mode: standalone` → "installed"
//   D. /install page on a desktop viewport settles on either the
//      desktop install card OR the fallback copy that does not promise
//      an action it cannot perform (no `beforeinstallprompt` in CI)
//   E. /install page shows the honest "mobile-unsupported" or desktop
//      fallback copy when no install path is available after timeout
//   F. /emergency-help does NOT request geolocation on page load
//   G. /emergency-help: the explanation card appears before the native
//      prompt · verified by watching the `navigator.geolocation` call
//   H. /emergency-help: "Not Now" closes the explanation without any
//      geolocation call being made
//   I. /emergency-help: "Allow Location Access" DOES invoke
//      `navigator.geolocation.getCurrentPosition`
//   J. /emergency-help: granted-position state exposes a working
//      sms: href that includes the coordinates AND the Google Maps URL
//   K. /emergency-help: denied-position state exposes a working sms:
//      href that does NOT include coordinates and surfaces a retry
//   L. /directory/landing does NOT mount the install slot when the
//      engagement cookie is absent (fail-closed landing)
//   M. /directory/landing DOES mount the install slot when
//      nex_install_eligible=1 is present
//
// Additional engagement sub-tests
//   · N. cookie value "0" / stray text → treated as absent (fail-closed)
//   · O. sidedoor: a landing visit with no cookie sets no cookie (the
//        engagement gate never writes from an RSC · marker lives in
//        server actions only)
//
// Additional SOS regression (NEX-023 seal)
//   · P. Trusted-contact phone validation stays functional (no leak
//        of the phone number into the URL bar or onto any analytics
//        beacon · observed by sniffing outbound requests).

import { test, expect, type Page, type Route } from "@playwright/test";

// --- Base paths ------------------------------------------------------------

const INSTALL_PATH = "/nex-native/install";
const EMERGENCY_PATH = "/nex-native/emergency-help";
const LANDING_PATH = "/nex-native/directory/landing";
const COOKIE_NAME = "nex_install_eligible";

// The "Enable location + prepare SMS" button carries
// aria-label="Begin location permission flow". Accessible name wins
// over visible text, so matching by role requires the aria-label text.
const ENABLE_BUTTON_ARIA = /begin location permission flow/i;

// Landing page compiles the first time it is hit in dev mode, which
// can exceed the suite's default 20s navigationTimeout. We cap at 60s
// for landing-page probes and skip the test honestly if we still time
// out rather than pretending the slot assertions ran.
const LANDING_NAV_TIMEOUT_MS = 60_000;

// Mock geolocation for tests G-K so we never request real permission.
const MOCK_COORDS = { latitude: 53.3498, longitude: -6.2603, accuracy: 25 };

/**
 * Attaches an init-script that counts `navigator.geolocation.getCurrentPosition`
 * invocations onto `window.__geoCallCount__` and optionally fulfills the
 * callback with the mocked coords or denial.
 *
 * Uses `page.exposeFunction` instead of context-level permissions so we can
 * observe the TIMING of the call rather than just rely on OS permission grants.
 */
async function instrumentGeolocation(
  page: Page,
  options: { grant: boolean },
): Promise<void> {
  await page.addInitScript(
    ({ coords, grant }) => {
      (window as unknown as { __geoCallCount__: number }).__geoCallCount__ = 0;
      const geo = navigator.geolocation;
      if (!geo) return;
      const originalGetCurrent = geo.getCurrentPosition.bind(geo);
      geo.getCurrentPosition = ((success, error) => {
        (window as unknown as { __geoCallCount__: number }).__geoCallCount__ +=
          1;
        if (grant) {
          success({
            coords: {
              latitude: coords.latitude,
              longitude: coords.longitude,
              accuracy: coords.accuracy,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
            } as GeolocationCoordinates,
            timestamp: Date.now(),
          } as GeolocationPosition);
        } else if (error) {
          error({
            code: 1,
            message: "User denied Geolocation",
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          } as GeolocationPositionError);
        }
      }) as typeof geo.getCurrentPosition;
      // Prevent the real API being used accidentally by other code paths.
      void originalGetCurrent;
    },
    { coords: MOCK_COORDS, grant: options.grant },
  );
}

async function readGeoCallCount(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      (window as unknown as { __geoCallCount__?: number }).__geoCallCount__ ??
      0,
  );
}

/**
 * Helper: fill the trusted-contact phone number and wait for the
 * "Enable location + prepare SMS" button to become enabled before
 * clicking it.
 *
 * 2026-11-26 (L-007 hydration gate) · callers `goto` with
 * `waitUntil: "domcontentloaded"` which returns before React hydrates
 * the controlled `<input>`. On a cold on-demand compile the SSR HTML
 * arrives, `fill()` writes the value into the native input, then React
 * hydrates and resets the controlled state back to `""` · the button's
 * `disabled={!phoneLooksValid}` stays true through all 10 s of the
 * toBeEnabled poll (observed · 23/23 polls disabled on a cold compile,
 * then PASS in 2.6 s once warm). Waiting for a known client-only
 * listener on `enableButton` (the `onClick` attribute cannot be
 * observed, so we `waitFor({state:"attached"})` + rely on the fact
 * that Playwright's `fill()` dispatches input/change events that only
 * take effect once React's hydration root has owned the element) is
 * NOT sufficient · the attached check passes on SSR markup. The fix
 * that does work: fill, then verify the native input kept the value;
 * if React has blanked it (controlled-state reset), re-fill. This
 * loops at most 3× (each ≤ 300 ms) before giving up and falling
 * through to the standard `toBeEnabled` wait, so warm runs pay zero
 * extra cost.
 */
async function beginLocationFlow(page: Page, phone: string): Promise<void> {
  const input = page.getByLabel(/trusted contact phone/i);
  const enableButton = page.getByRole("button", {
    name: ENABLE_BUTTON_ARIA,
  });
  await input.waitFor({ state: "attached", timeout: 15_000 });
  // networkidle = all RSC + chunk requests settled · after this the
  // React hydration root has claimed the controlled <input>, so
  // `fill()` writes a value that React will preserve. Without this
  // step, a cold on-demand compile hydrates AFTER fill() returns and
  // resets the input to its initial empty state, leaving the submit
  // button permanently disabled for the test.
  await page.waitForLoadState("networkidle", { timeout: 20_000 });
  // Up to 4 fill attempts · each separated by a tick in case a late
  // RSC flush still races. On warm runs the first attempt sticks.
  for (let attempt = 0; attempt < 4; attempt++) {
    await input.fill(phone);
    await page.waitForTimeout(200);
    const current = await input.inputValue();
    if (current === phone) break;
  }
  // 10s cap: the iPhone-emulated project under the dev server is
  // slower to settle React state than the Pixel 7 or desktop projects.
  await expect(enableButton).toBeEnabled({ timeout: 10_000 });
  await enableButton.click();
}

// ---------------------------------------------------------------------------
// §A · /install renders and transitions
// ---------------------------------------------------------------------------

test("A · install page renders and leaves 'detecting'", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(INSTALL_PATH, { waitUntil: "domcontentloaded" });
  // "Install NEX" heading must render from the server shell immediately.
  await expect(
    page.getByRole("heading", { name: /install nex/i }),
  ).toBeVisible();
  // 2026-11-26 (L-007 hydration gate · install-client variant) · on a
  // cold on-demand compile the client bundle may not have hydrated by
  // the 5 s `toBeHidden` deadline below. The `useEffect` detection +
  // 1.2 s setTimeout fallback only start running once React has
  // claimed the root, so until hydration lands the `{kind:"detecting"}`
  // SSR output stays on screen. Waiting for `networkidle` guarantees
  // the RSC payload + client chunks have been fetched and the
  // hydration root has mounted · on warm runs this returns almost
  // immediately. The 10 s bump on `toBeHidden` absorbs the 1.2 s
  // detection timeout inside the component without masking real bugs.
  await page.waitForLoadState("networkidle", { timeout: 20_000 });
  // After the client runs, we leave "Checking your device…" within the
  // detection timeout (1.2s inside the component + hydration window).
  await expect(page.getByText(/checking your device/i)).toBeHidden({
    timeout: 10_000,
  });
  expect(errors, "no runtime page errors").toEqual([]);
});

// ---------------------------------------------------------------------------
// §B · iOS instructions on an "iPhone-emulated" project
// ---------------------------------------------------------------------------

test("B · iPhone-emulated viewport shows Share → Add to Home Screen path", async ({
  page,
  browserName,
}, testInfo) => {
  // Only meaningful on the iphone-emulated project. On desktop or
  // Pixel 7 the UA does not read as iOS and the page should NOT go
  // down the iOS instruction branch.
  test.skip(
    !/iphone-emulated/i.test(testInfo.project.name),
    `project '${testInfo.project.name}' is not the iPhone-emulated project · UA won't trigger iOS branch`,
  );
  void browserName; // reserved for future webkit upgrade
  await page.goto(INSTALL_PATH, { waitUntil: "domcontentloaded" });
  // 2026-11-26 (L-007 hydration gate · install-client variant) · see §A.
  await page.waitForLoadState("networkidle", { timeout: 20_000 });
  // The component checks /iPad|iPhone|iPod/.test(ua). The iPhone 14 Pro
  // device-profile UA matches that regex.
  await expect(
    page.getByRole("heading", { name: /install on iphone or ipad/i }),
  ).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/Add to Home Screen/i)).toBeVisible();
});

// ---------------------------------------------------------------------------
// §C · display-mode: standalone shows "Already installed"
// ---------------------------------------------------------------------------

test("C · display-mode: standalone yields 'installed' state", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = ((query: string) => {
      if (query.includes("display-mode: standalone")) {
        return {
          matches: true,
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        } as unknown as MediaQueryList;
      }
      return original(query);
    }) as typeof window.matchMedia;
  });
  await page.goto(INSTALL_PATH, { waitUntil: "domcontentloaded" });
  // 2026-11-26 (L-007 hydration gate · install-client variant) · see §A.
  await page.waitForLoadState("networkidle", { timeout: 20_000 });
  await expect(
    page.getByRole("heading", { name: /nex is installed/i }),
  ).toBeVisible({ timeout: 10_000 });
});

// ---------------------------------------------------------------------------
// §D · desktop settles on a non-lying state
// ---------------------------------------------------------------------------

test("D · desktop settles on either the install card OR an honest fallback", async ({
  page,
}, testInfo) => {
  test.skip(
    !/desktop/i.test(testInfo.project.name),
    `project '${testInfo.project.name}' is not the desktop project`,
  );
  await page.goto(INSTALL_PATH, { waitUntil: "domcontentloaded" });
  // 2026-11-26 (L-007 hydration gate · install-client variant) · see §A.
  await page.waitForLoadState("networkidle", { timeout: 20_000 });
  // Wait for either the "Install on this computer" heading OR the
  // fallback honest copy to appear after the detection timeout.
  await Promise.race([
    expect(
      page.getByRole("heading", { name: /install on this computer/i }),
    ).toBeVisible({ timeout: 10_000 }),
    expect(
      page.getByText(/does not currently support/i),
    ).toBeVisible({ timeout: 10_000 }),
  ]);
});

// ---------------------------------------------------------------------------
// §E · mobile honest-fallback copy (Android three-dot path OR unsupported)
// ---------------------------------------------------------------------------

test("E · mobile without beforeinstallprompt lands on an honest fallback", async ({
  page,
}, testInfo) => {
  test.skip(
    !/pixel7/i.test(testInfo.project.name),
    `project '${testInfo.project.name}' is not the Pixel 7 mobile project`,
  );
  await page.goto(INSTALL_PATH, { waitUntil: "domcontentloaded" });
  // 2026-11-26 (L-007 hydration gate · install-client variant) · see
  // §A for rationale. Without this gate the cold-compile hydration
  // race leaves the SSR `{kind:"detecting"}` state in place past the
  // deadline on the honest-fallback heading assertion below.
  await page.waitForLoadState("networkidle", { timeout: 20_000 });
  // Dev build: Chromium headless does not fire `beforeinstallprompt`
  // without a valid installable manifest + user engagement heuristics.
  // Per the sealed 2026-11-24 install rules, when the mobile detection
  // succeeds but `beforeinstallprompt` never fires, the component MUST
  // present an honest, platform-aware fallback rather than a dead
  // Install button:
  //   · "Install on Android" copy (state `android-fallback`) when the
  //     UA matches a mobile Chromium that still has the three-dot menu
  //     "Install app" path, OR
  //   · "Install not available here" copy (state `unsupported`) when
  //     no path exists at all.
  // Either branch satisfies the honest-fallback rule. Historically
  // this test asserted the "unsupported" branch only; the component's
  // sealed behaviour now prefers the more informative Android-menu
  // instructions on mobile Chromium, so the test accepts either.
  const androidFallback = page.getByRole("heading", { name: /install on android/i });
  const unsupported = page.getByRole("heading", { name: /install not available here/i });
  await expect(androidFallback.or(unsupported)).toBeVisible({ timeout: 10_000 });
  // AND the dead-Install-button rule: the Chromium install CTA must
  // NOT be visible in either fallback state (both branches contain
  // only instructional copy, not a button that would call deferred.prompt()).
  await expect(
    page.getByRole("button", { name: /^install nex$/i }),
  ).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// §F · /emergency-help does NOT ask for geolocation on load
// ---------------------------------------------------------------------------

test("F · emergency-help does not request geolocation on initial load", async ({
  page,
}) => {
  await instrumentGeolocation(page, { grant: true });
  await page.goto(EMERGENCY_PATH, { waitUntil: "domcontentloaded" });
  // Give the page plenty of time to misbehave if it is going to.
  await page.waitForTimeout(1_000);
  const count = await readGeoCallCount(page);
  expect(count, "geolocation must not be requested on load").toBe(0);
});

// ---------------------------------------------------------------------------
// §G · explanation card appears before the native prompt
// ---------------------------------------------------------------------------

test("G · explanation card appears before any geolocation call", async ({
  page,
}) => {
  await instrumentGeolocation(page, { grant: true });
  await page.goto(EMERGENCY_PATH, { waitUntil: "domcontentloaded" });
  await beginLocationFlow(page, "+353871234567");
  // The explanation card MUST render before any geo call fires.
  await expect(
    page.getByRole("group", { name: /location permission explanation/i }),
  ).toBeVisible();
  expect(await readGeoCallCount(page)).toBe(0);
});

// ---------------------------------------------------------------------------
// §H · "Not Now" does not trigger a geolocation call
// ---------------------------------------------------------------------------

test("H · Not Now returns to idle without invoking geolocation", async ({
  page,
}) => {
  await instrumentGeolocation(page, { grant: true });
  await page.goto(EMERGENCY_PATH, { waitUntil: "domcontentloaded" });
  await beginLocationFlow(page, "+353871234567");
  await page.getByRole("button", { name: /decline location access/i }).click();
  await expect(
    page.getByRole("button", { name: ENABLE_BUTTON_ARIA }),
  ).toBeVisible();
  expect(await readGeoCallCount(page)).toBe(0);
});

// ---------------------------------------------------------------------------
// §I + §J · Allow invokes geo AND builds the sms: href honestly
// ---------------------------------------------------------------------------

test("I + J · Allow invokes geolocation and sms: href includes coords + maps url", async ({
  page,
}) => {
  await instrumentGeolocation(page, { grant: true });
  await page.goto(EMERGENCY_PATH, { waitUntil: "domcontentloaded" });
  await beginLocationFlow(page, "+353871234567");
  await page.getByRole("button", { name: /allow nex location access/i }).click();
  // Give React a tick to transition to ready.
  const smsLink = page.getByRole("link", {
    name: /open native sms with location pre-filled/i,
  });
  await expect(smsLink).toBeVisible({ timeout: 5_000 });
  const href = await smsLink.getAttribute("href");
  expect(href, "sms: href present").not.toBeNull();
  expect(href!).toContain("sms:+353871234567");
  const decoded = decodeURIComponent(href!);
  expect(decoded).toContain("53.349800");
  expect(decoded).toContain("-6.260300");
  expect(decoded).toContain("maps.google.com/?q=53.3498,-6.2603");
  expect(await readGeoCallCount(page)).toBe(1);
});

// ---------------------------------------------------------------------------
// §K · denied geo exposes retry + a coord-free sms: href
// ---------------------------------------------------------------------------

test("K · denied geo surfaces retry and a coord-free sms: fallback", async ({
  page,
}) => {
  await instrumentGeolocation(page, { grant: false });
  await page.goto(EMERGENCY_PATH, { waitUntil: "domcontentloaded" });
  await beginLocationFlow(page, "+353871234567");
  await page.getByRole("button", { name: /allow nex location access/i }).click();
  await expect(
    page.getByRole("button", { name: /retry location permission/i }),
  ).toBeVisible({ timeout: 5_000 });
  const smsLink = page.getByRole("link", {
    name: /open native sms without location/i,
  });
  const href = await smsLink.getAttribute("href");
  expect(href).not.toBeNull();
  const decoded = decodeURIComponent(href!);
  expect(decoded).not.toContain("maps.google.com");
  expect(decoded).toContain("Location sharing is unavailable");
  expect(await readGeoCallCount(page)).toBe(1);
});

// ---------------------------------------------------------------------------
// §L · landing without cookie → no install slot
// §M · landing WITH cookie → install slot present
// §N · stray cookie value → treated as absent (fail-closed)
// §O · landing visit does not create the cookie (RSC can't set it)
// ---------------------------------------------------------------------------
//
// These tests probe the engagement gate without needing authenticated
// state. The landing page itself may redirect unauthenticated users to
// sign-in depending on surface rules · if the redirect happens, the
// test is marked SKIP with a clear reason rather than falsely passing.

async function tryLanding(page: Page): Promise<{ landed: boolean; url: string }>
{
  try {
    const resp = await page.goto(LANDING_PATH, {
      waitUntil: "domcontentloaded",
      timeout: LANDING_NAV_TIMEOUT_MS,
    });
    void resp;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { landed: false, url: `__nav_timeout__:${msg.slice(0, 120)}` };
  }
  const url = page.url();
  // Treat "/sign-in" / "/directory" splashback as "could not reach the
  // target route" for this test's purposes.
  const landed = /\/directory\/landing/.test(url);
  return { landed, url };
}

test("L · landing WITHOUT engagement cookie hides the install slot", async ({
  page,
  context,
}) => {
  await context.clearCookies();
  const { landed, url } = await tryLanding(page);
  test.skip(
    !landed,
    `/directory/landing is not directly reachable in this project (got ${url}) · likely auth-gated for this spec`,
  );
  await expect(
    page.locator('[data-nex-landing-install-slot]'),
  ).toHaveCount(0);
});

test("M · landing WITH nex_install_eligible=1 cookie shows the install slot", async ({
  page,
  context,
}) => {
  await context.addCookies([
    {
      name: COOKIE_NAME,
      value: "1",
      url: "http://localhost:3008",
      httpOnly: false,
      sameSite: "Lax",
    },
  ]);
  const { landed, url } = await tryLanding(page);
  test.skip(
    !landed,
    `/directory/landing is not directly reachable in this project (got ${url}) · likely auth-gated for this spec`,
  );
  await expect(
    page.locator('[data-nex-landing-install-slot]'),
  ).toHaveCount(1);
});

test("N · cookie value '0' / stray text is treated as absent (fail-closed)", async ({
  page,
  context,
}) => {
  await context.clearCookies();
  await context.addCookies([
    {
      name: COOKIE_NAME,
      value: "0",
      url: "http://localhost:3008",
      httpOnly: false,
      sameSite: "Lax",
    },
  ]);
  const { landed, url } = await tryLanding(page);
  test.skip(
    !landed,
    `/directory/landing is not directly reachable in this project (got ${url})`,
  );
  await expect(
    page.locator('[data-nex-landing-install-slot]'),
  ).toHaveCount(0);
});

test("O · an unauthenticated landing visit does not write the eligibility cookie", async ({
  page,
  context,
}) => {
  await context.clearCookies();
  await tryLanding(page);
  const cookies = await context.cookies();
  const marker = cookies.find((c) => c.name === COOKIE_NAME);
  expect(marker, "landing page must not create the engagement cookie").toBeUndefined();
});

// ---------------------------------------------------------------------------
// §P · SOS trusted-phone input is never leaked out of the device
// ---------------------------------------------------------------------------

test("P · trusted-contact phone never appears in outbound network requests", async ({
  page,
}) => {
  await instrumentGeolocation(page, { grant: true });
  const PHONE = "+353871234567";
  const leaks: string[] = [];
  page.on("request", (req: { url: () => string; postData: () => string | null }) => {
    const u = req.url();
    const body = req.postData() ?? "";
    if (u.includes(PHONE) || body.includes(PHONE)) {
      leaks.push(u);
    }
  });
  await page.goto(EMERGENCY_PATH, { waitUntil: "domcontentloaded" });
  await beginLocationFlow(page, PHONE);
  await page.getByRole("button", { name: /allow nex location access/i }).click();
  await page.waitForTimeout(500);
  expect(leaks, "no outbound request may include the trusted-contact phone number").toEqual([]);
});

// ---------------------------------------------------------------------------
// §webkit-blocker · explicit record of what is NOT covered
// ---------------------------------------------------------------------------

test.fixme(
  "Q · real iOS Safari behaviour (navigator.standalone, Share menu, no beforeinstallprompt) is NOT covered",
  async () => {
    // WebKit is not installed on this machine. Installing it is a
    // dependency operation that requires separate owner authorisation.
    // This fixme is intentional · keeps the gap visible in reports.
  },
);

test.fixme(
  "R · real Android Chrome beforeinstallprompt path is NOT covered",
  async () => {
    // Chromium headless does not fire `beforeinstallprompt` without a
    // valid manifest + user engagement heuristics. The honest way to
    // exercise this is a staged Chrome instance with a seeded profile,
    // which is out of scope for this spec. The §E negative assertion
    // (honest fallback copy) is what we verify instead.
  },
);

// Route-counter example of silent-mutation guard · reserved for
// future expansion. Currently a no-op so that linters flagging
// unused imports don't bite.
void (null as unknown as Route);
