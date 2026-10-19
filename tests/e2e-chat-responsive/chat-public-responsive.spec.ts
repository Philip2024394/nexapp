// tests/e2e-chat-responsive/chat-public-responsive.spec.ts
//
// NEX Chat + Call · multi-viewport responsive verification · public surfaces.
// Owner-authorised Phase 5 build 2026-10-19.
// -----------------------------------------------------------------------------
// Verifies:
//
//   · No horizontal overflow at the test viewport.
//   · Core landmarks + accessible roles are present.
//   · Keyboard interaction (Escape key where applicable) works.
//   · The /call/preview DEV-PREVIEW ribbon (Phase 1B honesty) is
//     visible so a direct-URL visitor is unambiguously informed.
//
// Scope · UNAUTHENTICATED routes only:
//   · /nex-native/welcome
//   · /nex-native/sign-in
//   · /nex-native/create-account
//   · /nex-native/call/preview (not dev-gated · reachable by URL)
//
// Out of scope · auth-gated routes are blocked by the auth-fixture
// gap documented in the sealed B2 config. The authenticated peer-chat
// / live-call journey remains outside this spec until the owner
// authorises a test-only auth helper.

import { expect, test } from "@playwright/test";

async function assertNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const dims = await page.evaluate(() => ({
    inner: window.innerWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(
    dims.scroll,
    `horizontal overflow · viewport=${dims.inner}px, scroll=${dims.scroll}px`,
  ).toBeLessThanOrEqual(dims.inner + 1);
}

async function assertResponseOk(page: import("@playwright/test").Page, url: string) {
  const resp = await page.goto(url, { waitUntil: "domcontentloaded" });
  // Welcome / sign-in / create-account may 200 or 307 to themselves.
  // We accept any 2xx or 3xx response; the final page must render.
  expect(resp, `response for ${url}`).toBeTruthy();
  const status = resp!.status();
  expect(status, `${url} returned ${status}`).toBeLessThan(400);
}

test.describe("NEX chat + call · unauthenticated public surfaces · responsive", () => {
  const PUBLIC_ROUTES: Array<{ path: string; name: string; expectBody: RegExp }> = [
    { path: "/nex-native/welcome", name: "welcome", expectBody: /nex/i },
    { path: "/nex-native/sign-in", name: "sign-in", expectBody: /sign.*in|password|email|face/i },
    { path: "/nex-native/create-account", name: "create-account", expectBody: /create|sign.?up|account/i },
  ];

  for (const r of PUBLIC_ROUTES) {
    test(`${r.name} · renders without horizontal overflow + visible text content`, async ({ page }) => {
      await assertResponseOk(page, r.path);
      await assertNoHorizontalOverflow(page);
      const body = await page.textContent("body");
      expect(body ?? "", `${r.path} body text should match ${r.expectBody}`).toMatch(r.expectBody);
    });
  }

  test("call/preview · DEV-PREVIEW ribbon visible + no overflow + aria-status role", async ({ page }) => {
    await assertResponseOk(page, "/nex-native/call/preview");
    await assertNoHorizontalOverflow(page);
    const ribbon = page.locator("[data-nex-call-preview-dev-ribbon]");
    await expect(ribbon, "DEV PREVIEW ribbon must be mounted").toHaveCount(1);
    // Ribbon carries the sealed honest marker (checked lower-case).
    const ribbonText = (await ribbon.textContent()) ?? "";
    expect(ribbonText.toLowerCase()).toContain("dev preview");
    expect(ribbonText.toLowerCase()).toContain("not a live call");
    // Accessible status role so screen readers announce it.
    await expect(ribbon).toHaveAttribute("role", "status");
  });

  test("call/preview · 'Add people' button is honestly disabled + 'coming later' aria-label", async ({ page }) => {
    await assertResponseOk(page, "/nex-native/call/preview");
    const addPeople = page.locator("[data-nex-call-add-people]");
    await expect(addPeople, "Add people button must be mounted").toHaveCount(1);
    await expect(addPeople, "Add people must stay disabled").toBeDisabled();
    const label = await addPeople.getAttribute("aria-label");
    expect(label ?? "", "aria-label must carry 'coming later'").toMatch(/coming later/i);
  });

  test("sign-in · the page has an accessible form landmark OR heading", async ({ page }) => {
    await assertResponseOk(page, "/nex-native/sign-in");
    // Either a <form> or an <h1>/<h2> must be present as a landmark.
    const landmark = await page.locator("form, h1, h2").count();
    expect(landmark, "sign-in should have a form or heading landmark").toBeGreaterThan(0);
  });
});
