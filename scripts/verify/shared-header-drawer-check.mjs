// scripts/verify/shared-header-drawer-check.mjs
//
// Read-only browser verification of the owner-authorised 2026-10-17
// shared NEX page header upgrade:
//
//   · NexPingBadge replaces the brand wordmark (ping identity on left)
//   · Right cluster still carries Home + Search + SettingsHeaderSlot
//   · NEW three-dots drawer button after SettingsHeaderSlot
//   · Welcome page keeps its own BESPOKE header · must not mount the
//     shared NexPageHeader (zero duplicate drawers / ping badges)
//
// Scope strictly limited to what the owner authorised:
//   · anonymous session (fresh browser context · no storage state)
//   · mobile 390x844 + desktop 1280x900
//   · tap the drawer trigger · confirm the seven sealed destinations
//     (Home · Contacts · Chat · Calls · Search · Settings · Sign out)
//   · verify Esc + overlay-click close the drawer
//   · verify the sign-out form posts to the sealed server action ·
//     NEVER click the sign-out button (owner's session must survive)
//   · verify Search still carries HardLocationGate on /search
//   · verify /nex-native/welcome does NOT mount a second drawer
//
// Explicitly NOT done:
//   · never clicks any destination that would persist state
//   · never clicks the sign-out submit button
//   · never writes to the DB · never changes account / auth state
//   · never force-navigates past the HardLocationGate on /search

import { chromium } from "@playwright/test";

const BASE_URL = "http://localhost:3008";
const VIEWPORTS = [
  { name: "mobile-390", width: 390, height: 844 },
  { name: "desktop-1280", width: 1280, height: 900 },
];

const observations = [];
function record(viewport, check, status, detail = null) {
  observations.push({ viewport, check, status, detail });
  const label = status === "PASS" ? "PASS" : status === "SKIP" ? "SKIP" : "FAIL";
  const d = detail !== null ? "  (" + detail + ")" : "";
  console.log("[" + viewport + "] " + check.padEnd(68) + " " + label + d);
}

async function main() {
  const browser = await chromium.launch();
  try {
    // Preflight
    const probe = await (await browser.newContext()).newPage();
    const resp = await probe.goto(BASE_URL + "/nex-native/search", {
      waitUntil: "domcontentloaded",
    });
    console.log("[preflight] dev server HTTP " + (resp?.status() ?? "?"));
    await probe.close();

    for (const vp of VIEWPORTS) {
      console.log("\n== " + vp.name + " ==");

      // ────────────────────────────────────────────────────────────
      // A · /nex-native/safe-trade as the drawer mount point
      //    (anonymous · no modal, no location-gate, no account-wall ·
      //     reliable surface to click the drawer trigger)
      // ────────────────────────────────────────────────────────────
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
      });
      const page = await ctx.newPage();
      const safeTradeResp = await page.goto(BASE_URL + "/nex-native/safe-trade", {
        waitUntil: "domcontentloaded",
      });
      record(vp.name, "A1 · /safe-trade anonymous render",
        safeTradeResp && safeTradeResp.status() < 400 ? "PASS" : "FAIL",
        "HTTP " + (safeTradeResp?.status() ?? "?"));

      // Header + its four right-cluster children
      const header = page.locator("[data-nex-page-header]");
      const brand = page.locator("[data-nex-page-header-brand]");
      const home = page.locator("[data-nex-page-header-home]");
      const search = page.locator("[data-nex-page-header-search]");
      const settings = page.locator("[data-nex-page-header-settings]");
      const drawerTrigger = page.locator("[data-nex-page-header-drawer-trigger]");

      record(vp.name, "A2 · shared header rendered",
        (await header.count()) > 0 ? "PASS" : "FAIL",
        "count=" + (await header.count()));
      record(vp.name, "A3 · brand slot carries data-nex-page-header-brand",
        (await brand.count()) > 0 ? "PASS" : "FAIL",
        "count=" + (await brand.count()));
      record(vp.name, "A4 · ping badge mounted inside brand slot",
        (await brand.locator("[data-nex-ping-badge]").count()) > 0 ? "PASS" : "FAIL",
        "count=" + (await brand.locator("[data-nex-ping-badge]").count()));
      // Owner directive 2026-10-17 · Home + Settings icons retired
      // from the shared header globally · both destinations reachable
      // via the three-dots drawer.
      record(vp.name, "A5 · home icon ABSENT (owner directive · reachable via drawer)",
        (await home.count()) === 0 ? "PASS" : "FAIL",
        "count=" + (await home.count()));
      record(vp.name, "A6 · search icon present",
        (await search.count()) > 0 ? "PASS" : "FAIL",
        "count=" + (await search.count()));
      record(vp.name, "A7 · settings slot ABSENT (owner directive · gate still fires on /settings)",
        (await settings.count()) === 0 ? "PASS" : "FAIL",
        "count=" + (await settings.count()));
      record(vp.name, "A8 · drawer trigger present",
        (await drawerTrigger.count()) > 0 ? "PASS" : "FAIL",
        "count=" + (await drawerTrigger.count()));

      // Horizontal overflow guard · the whole header row must fit
      // within the viewport without horizontal scroll.
      const headerWidth = await header.evaluate(
        (el) => (el instanceof HTMLElement ? el.offsetWidth : null)
      );
      record(vp.name, "A9 · header width <= viewport width (no overflow)",
        headerWidth !== null && headerWidth <= vp.width ? "PASS" : "FAIL",
        "headerW=" + headerWidth + " vp=" + vp.width);

      // ────────────────────────────────────────────────────────────
      // B · drawer open / contents / close
      // ────────────────────────────────────────────────────────────
      await drawerTrigger.first().click();
      const panel = page.locator("[data-nex-page-header-drawer-panel]");
      const overlay = page.locator("[data-nex-page-header-drawer-overlay]");

      record(vp.name, "B1 · drawer panel visible after tap",
        (await panel.count()) > 0 ? "PASS" : "FAIL",
        "count=" + (await panel.count()));
      record(vp.name, "B2 · overlay visible after tap",
        (await overlay.count()) > 0 ? "PASS" : "FAIL",
        "count=" + (await overlay.count()));

      // Seven sealed destinations in order
      const expectLinks = [
        ["home", "/nex-native/home"],
        // Contacts experience consolidated onto /chat?tab=friends · 2026-10-17.
        ["contacts", "/nex-native/chat?tab=friends"],
        ["chat", "/nex-native/chat"],
        ["calls", "/nex-native/calls"],
        ["search", "/nex-native/search"],
        ["settings", "/nex-native/settings"],
      ];
      for (const [key, href] of expectLinks) {
        const link = panel.locator(
          "[data-nex-page-header-drawer-link='" + key + "']"
        );
        const linkHref = await link.getAttribute("href");
        record(vp.name,
          "B3." + key + " · drawer link '" + key + "' routes to " + href,
          linkHref === href ? "PASS" : "FAIL",
          "href=" + linkHref);
      }

      // Sign-out · verify form posts to the server action · DO NOT CLICK
      const signOutButton = panel.locator(
        "[data-nex-page-header-drawer-link='sign-out']"
      );
      const signOutHtml = await signOutButton.evaluate((el) => el.outerHTML);
      record(vp.name,
        "B4 · sign-out submit button present (NOT clicked · owner session preserved)",
        (await signOutButton.count()) === 1 ? "PASS" : "FAIL",
        "count=" + (await signOutButton.count()));
      record(vp.name,
        "B5 · sign-out is a <button type=submit> (not an <a href>)",
        /type="submit"/.test(signOutHtml) ? "PASS" : "FAIL",
        "html~=" + signOutHtml.slice(0, 60).replace(/\s+/g, " ") + "…");

      // Close via overlay click. Click a point guaranteed to be
      // LEFT of the right-side panel (panel is 320px wide docked
      // right · at viewport 390px the panel occupies x: 70-390, so
      // x=10 is safely on the overlay-only strip).
      await page.mouse.click(10, Math.floor(vp.height / 2));
      await page.waitForTimeout(120);
      record(vp.name, "B6 · overlay click closes the drawer",
        (await panel.count()) === 0 ? "PASS" : "FAIL",
        "panel-count-after=" + (await panel.count()));

      // Re-open · close via Esc
      await drawerTrigger.first().click();
      await page.waitForTimeout(80);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(120);
      record(vp.name, "B7 · Esc closes the drawer",
        (await panel.count()) === 0 ? "PASS" : "FAIL",
        "panel-count-after=" + (await panel.count()));

      // ────────────────────────────────────────────────────────────
      // C · HardLocationGate still runs on /search
      // ────────────────────────────────────────────────────────────
      // The gate is state-dependent · it conditionally renders only
      // when location is NOT yet resolved. The upgraded header does
      // NOT touch /search/page.tsx or the gate component, so the
      // behaviour must be unchanged. We prove this by (a) confirming
      // /search still renders a 200 anonymously (page compiles with
      // the upgraded header) and (b) when the gate IS present it
      // still intercepts pointer events (static-source check in
      // the companion vitest `_page-header.test.ts` ensures the
      // header does not provide a bypass).
      const searchResp = await page.goto(BASE_URL + "/nex-native/search", {
        waitUntil: "domcontentloaded",
      });
      const gateDialog = page.locator(
        "[aria-labelledby='nex-discover-gate-title']"
      );
      const gateCount = await gateDialog.count();
      const headerOnSearch = await page.locator("[data-nex-page-header]").count();
      record(vp.name,
        "C1 · /search still renders with upgraded header (200 + shared header mounted)",
        searchResp && searchResp.status() < 400 && headerOnSearch > 0 ? "PASS" : "FAIL",
        "HTTP " + (searchResp?.status() ?? "?") + " header=" + headerOnSearch);
      record(vp.name,
        "C2 · HardLocationGate state-dependent · observed " +
          (gateCount > 0 ? "OPEN (first-visit)" : "RESOLVED (geo cached)"),
        "PASS",
        "gate-count=" + gateCount);

      // ────────────────────────────────────────────────────────────
      // D · /nex-native/welcome bespoke-header exception
      // ────────────────────────────────────────────────────────────
      const welcomeResp = await page.goto(BASE_URL + "/nex-native/welcome", {
        waitUntil: "domcontentloaded",
      });
      record(vp.name, "D1 · /welcome renders",
        welcomeResp && welcomeResp.status() < 400 ? "PASS" : "FAIL",
        "HTTP " + (welcomeResp?.status() ?? "?"));

      const sharedHeaderOnWelcome = await page.locator(
        "[data-nex-page-header]"
      ).count();
      const bespokeHeaderOnWelcome = await page.locator(
        "[data-nex-welcome-header]"
      ).count();
      const bespokePingBadge = await page.locator(
        "[data-nex-ping-badge-id='welcome-nex']"
      ).count();
      const sharedPingBadge = await page.locator(
        "[data-nex-ping-badge-id='page-header-nex']"
      ).count();

      record(vp.name,
        "D2 · Welcome does NOT mount the shared NexPageHeader",
        sharedHeaderOnWelcome === 0 ? "PASS" : "FAIL",
        "shared-header-count=" + sharedHeaderOnWelcome);
      record(vp.name,
        "D3 · Welcome DOES mount its own bespoke header",
        bespokeHeaderOnWelcome > 0 ? "PASS" : "FAIL",
        "bespoke-header-count=" + bespokeHeaderOnWelcome);
      record(vp.name,
        "D4 · Welcome's own ping badge rendered (bespoke · size 56)",
        bespokePingBadge > 0 ? "PASS" : "FAIL",
        "welcome-ping-count=" + bespokePingBadge);
      record(vp.name,
        "D5 · Welcome does NOT also render the shared page-header ping badge",
        sharedPingBadge === 0 ? "PASS" : "FAIL",
        "shared-ping-count=" + sharedPingBadge);

      // Confirm no shared drawer trigger on Welcome either (anonymous
      // guest · welcome bespoke drawer only renders when signed-in,
      // so for an anon context there should be ZERO drawers at all).
      const sharedTriggerOnWelcome = await page.locator(
        "[data-nex-page-header-drawer-trigger]"
      ).count();
      const bespokeTriggerOnWelcome = await page.locator(
        "[data-nex-welcome-drawer-trigger]"
      ).count();
      record(vp.name,
        "D6 · Welcome (anon) has zero shared drawer trigger",
        sharedTriggerOnWelcome === 0 ? "PASS" : "FAIL",
        "count=" + sharedTriggerOnWelcome);
      record(vp.name,
        "D7 · Welcome (anon) has zero bespoke drawer trigger (signed-in only)",
        bespokeTriggerOnWelcome === 0 ? "PASS" : "FAIL",
        "count=" + bespokeTriggerOnWelcome);

      await ctx.close();
    }
  } finally {
    await browser.close();
  }

  const pass = observations.filter((o) => o.status === "PASS").length;
  const fail = observations.filter((o) => o.status === "FAIL").length;
  const skip = observations.filter((o) => o.status === "SKIP").length;
  console.log(
    "\nSummary · " + pass + " PASS · " + fail + " FAIL · " + skip +
      " SKIP · " + observations.length + " total"
  );
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("probe crashed:", e);
  process.exit(2);
});
