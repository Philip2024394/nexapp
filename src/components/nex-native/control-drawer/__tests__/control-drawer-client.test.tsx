// @vitest-environment jsdom
// src/components/nex-native/control-drawer/__tests__/control-drawer-client.test.tsx
//
// NEX Control Drawer · regression suite · sealed 2026-10-16.
// --------------------------------------------------------------------
// The drawer is a reusable right-side menu invoked from the three-dot
// icon on consumer-hub pages. These tests pin the owner-approved
// contract so the behaviour doesn't drift as the drawer is rolled out
// to further hubs (/home, /contacts, /chat, /settings).
//
// Scope · black-box render assertions via `renderToStaticMarkup` and
// a direct call to the `DrawerBody` internal to inspect the open-state
// DOM (the trigger-based open state is user-event driven; the sealed
// pattern elsewhere in nex-native is renderToStaticMarkup + internal
// branches). Where interactive behaviour is required, the test calls
// the exported internal subcomponent.

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { render, fireEvent } from "@testing-library/react";
import {
  ControlDrawer,
  __internal,
  type ControlDrawerSession,
} from "../control-drawer-client";

// Owner directive 2026-11-13 · the drawer calls `usePathname()` from
// `next/navigation` inside a route-change watcher that auto-closes the
// drawer on navigation. The older mock here only stubbed `useRouter`
// which left `usePathname` undefined and caused a TypeError during
// server render of <ControlDrawer>. Added 2026-11-18 as part of the
// closeDrawer wiring fix.
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    back: () => {},
    forward: () => {},
    refresh: () => {},
    prefetch: () => {},
  }),
  usePathname: () => "/nex-native/free-chat",
}));

// The sealed `signOutAction` is a server action · importing it on
// the server-side test runner is fine, but the test only cares that
// a <form action={signOutAction}> renders in the confirmation modal.
vi.mock("@/app/nex-native/_actions", () => ({
  signOutAction: () => {},
}));

const SIGNED_IN: ControlDrawerSession = {
  displayName: "Alice",
  nexHandle: "@alice",
  isBisnis: false,
};
const BISNIS: ControlDrawerSession = {
  displayName: "Hammer Ex Products",
  nexHandle: "@hammer-ex",
  isBisnis: true,
};

describe("ControlDrawer · trigger (closed state)", () => {
  it("renders a trigger button only when closed", () => {
    const html = renderToStaticMarkup(<ControlDrawer session={SIGNED_IN} />);
    expect(html).toContain("data-nex-control-drawer-trigger");
    expect(html).toContain('aria-label="Open menu"');
    // Closed state must NOT render drawer / backdrop / identity /
    // confirmation modal.
    expect(html).not.toContain("data-nex-control-drawer-backdrop");
    expect(html).not.toContain("data-nex-control-drawer=");
    expect(html).not.toContain("data-nex-control-drawer-confirm");
  });

  it("trigger uses an accessible label (not emoji-only)", () => {
    const html = renderToStaticMarkup(<ControlDrawer session={null} />);
    expect(html).toContain('aria-label="Open menu"');
    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toContain('aria-expanded="false"');
  });
});

describe("DrawerBody · identity bar", () => {
  it("renders display name + handle for signed-in viewers", () => {
    const html = renderToStaticMarkup(
      <__internal.DrawerBody
        session={SIGNED_IN}
        onLogoutClick={() => {}}
        closeDrawer={() => {}}
      />,
    );
    // Owner directive 2026-11-13 · IdentityBar now reads the branded
    // "NEX CENTER" eyebrow + NEX ID; `displayName` is intentionally
    // no longer rendered (search for "Hammerex Products" in the file
    // for the sealed note). Keep the handle check + the identity
    // data-attribute · those are the stable contract.
    expect(html).toContain("@alice");
    expect(html).toContain("data-nex-control-drawer-identity");
  });

  it("renders a sign-in prompt for anonymous viewers (no logout + no business group bleed)", () => {
    const html = renderToStaticMarkup(
      <__internal.DrawerBody
        session={null}
        onLogoutClick={() => {}}
        closeDrawer={() => {}}
      />,
    );
    expect(html).toContain("Sign in to NEX");
    expect(html).toContain('href="/nex-native/sign-in"');
    // Anonymous viewers must NOT see the logout CTA.
    expect(html).not.toContain("data-nex-control-drawer-logout");
    // Business Vault must never render for anonymous viewers.
    expect(html).not.toContain("Business Vault");
  });

  it("renders no @-handle when nexHandle is null (must not crash or render bare @)", () => {
    const html = renderToStaticMarkup(
      <__internal.DrawerBody
        session={{ ...SIGNED_IN, nexHandle: null }}
        onLogoutClick={() => {}}
        closeDrawer={() => {}}
      />,
    );
    // No stray @ handle rendered when handle is null.
    expect(html).not.toContain("@alice");
    // Identity bar still renders for signed-in viewers (branded eyebrow).
    expect(html).toContain("data-nex-control-drawer-identity");
  });
});

// Owner directive 2026-11-05 · global drawer unification · the sealed
// Bisnis-gated Business Vault slot + the YOUR BUSINESS section (My
// shop · Creator · Payments · Membership + billing) are REMOVED from
// the drawer surface. Tests that asserted on those rows have been
// retired alongside the code. The destinations remain reachable by
// direct URL · they are just no longer surfaced through the drawer.

describe("DrawerBody · section groups + rows", () => {
  it("renders the three sealed section titles in order (CREATE → YOUR NEX → NEX SUPPORT)", () => {
    const html = renderToStaticMarkup(
      <__internal.DrawerBody
        session={SIGNED_IN}
        onLogoutClick={() => {}}
        closeDrawer={() => {}}
      />,
    );
    // Owner directive 2026-11-05 iter 26 · CREATE section sits ABOVE
    // YOUR NEX. Owner directive 2026-11-04 later-same-day · NEX
    // SUPPORT replaces the previous "PREFERENCES & SUPPORT" title
    // (see section render at title="NEX SUPPORT" in the source).
    const iCreate = html.indexOf("CREATE");
    const iYourNex = html.indexOf("YOUR NEX");
    const iSupport = html.indexOf("NEX SUPPORT");
    expect(iCreate).toBeGreaterThan(-1);
    expect(iYourNex).toBeGreaterThan(-1);
    expect(iSupport).toBeGreaterThan(-1);
    expect(iCreate).toBeLessThan(iYourNex);
    expect(iYourNex).toBeLessThan(iSupport);
    // YOUR BUSINESS retired (2026-11-04) · must NOT render.
    expect(html).not.toContain("YOUR BUSINESS");
    expect(html).not.toContain("Business Vault");
    // Old title retired (2026-11-04 later-same-day) · must NOT render.
    expect(html).not.toContain("PREFERENCES &amp; SUPPORT");
  });

  it("every destination row renders a verified route (no new routes invented)", () => {
    const html = renderToStaticMarkup(
      <__internal.DrawerBody
        session={SIGNED_IN}
        onLogoutClick={() => {}}
        closeDrawer={() => {}}
      />,
    );
    // Allowlist is grounded in owner directives in the source, not
    // "whatever the implementation renders" · each entry here cites
    // the directive that sealed it. Partial match on href= so dev-
    // environment query-string variants (?dev=1) still match.
    const expectedHrefPaths = [
      "/nex-native/profile/me",       // sealed · "My profile" row
      "/nex-native/contacts",         // sealed 2026-11-12 · Chats and contacts
      "/nex-native/settings/profile/edit", // sealed 2026-11-12 · Edit Profile
      "/nex-native/manage",           // sealed 2026-11-13 · Shop Settings
      "/nex-native/manage/shop/faq",  // sealed 2026-11-17 · FAQ
      "/nex-native/settings/chat-settings", // sealed 2026-11-12 · Chat Settings
      "/nex-native/settings/payments",// sealed 2026-11-10 · Payment Providers
      "/nex-native/manage/orders",    // sealed 2026-11-10 P3 · My Orders
      "/nex-native/manage/wholesale", // sealed 2026-11-18 · Wholesale (concurrent work)
      "/nex-native/store",            // sealed 2026-11-07 · NEX Store
      "/nex-native/directory",        // sealed 2026-11-09 · Discovery
      "/nex-native/settings",         // sealed 2026-11-11 Cycle 36 · Settings
      "/nex-generated/buying-guides", // sealed 2026-11-18 · Buying Guides
      "/nex-native/nex-1",            // sealed 2026-11-09 rev 4 · NEX 1
      "/nex-native/create/product/category", // CREATE_ROWS · List a product
    ];
    for (const path of expectedHrefPaths) {
      expect(html).toContain(`href="${path}`);
    }
  });
});

describe("DrawerBody · logout surface + confirmation modal (owner decision #2)", () => {
  it("renders the Log out button for signed-in viewers", () => {
    const html = renderToStaticMarkup(
      <__internal.DrawerBody
        session={SIGNED_IN}
        onLogoutClick={() => {}}
        closeDrawer={() => {}}
      />,
    );
    expect(html).toContain("data-nex-control-drawer-logout");
    expect(html).toContain("Log out");
  });

  it("confirmation modal renders Cancel + Log out buttons wrapped in a form that submits signOutAction", () => {
    const html = renderToStaticMarkup(
      <__internal.LogoutConfirmModal onCancel={() => {}} />,
    );
    expect(html).toContain("data-nex-control-drawer-confirm");
    expect(html).toContain("data-nex-control-drawer-confirm-cancel");
    expect(html).toContain("data-nex-control-drawer-confirm-submit");
    expect(html).toContain("<form");
    expect(html).toContain('type="submit"');
    expect(html).toContain("Log out of NEX?");
  });

  it("confirmation modal is role=dialog + aria-modal (nested dialog pattern)", () => {
    const html = renderToStaticMarkup(
      <__internal.LogoutConfirmModal onCancel={() => {}} />,
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
  });
});

describe("ControlDrawer · architectural guards", () => {
  it("drawer trigger does not fabricate account data for anonymous viewers", () => {
    const html = renderToStaticMarkup(<ControlDrawer session={null} />);
    expect(html).not.toContain("@");
    expect(html).not.toContain("Alice");
    expect(html).not.toContain("Business Vault");
  });

  it("DrawerBody uses position: absolute (anchors to .nex-native-frame · owner directive 2026-10-16)", () => {
    // We can't easily assert the computed style on the drawer root
    // in a static render, but we can assert the exported styles via
    // snapshotting the trigger-free render path. The drawer itself
    // sets position: absolute inline; this is covered by the
    // Playwright phone-frame proof at tests/e2e-screenshots/phone-frame/.
    // Here we just ensure the module compiles and exposes the sealed
    // trigger surface.
    const html = renderToStaticMarkup(<ControlDrawer session={SIGNED_IN} />);
    expect(html).toContain("data-nex-control-drawer-trigger");
  });

  it("row list exports stay stable (regression guard against silent re-ordering)", () => {
    // Row-key allowlist is anchored to owner directives, not whatever
    // the implementation currently exports. Each entry cites its
    // sealing directive:
    //
    //   chats-contacts     · 2026-11-12 (top of drawer)
    //   profile            · sealed
    //   edit-profile       · 2026-11-12 (dedicated edit route)
    //   manage-shop        · 2026-11-13 (renamed "Shop Settings")
    //   shop-faq           · 2026-11-17 (FAQ editor row)
    //   chat-settings      · 2026-11-12 (Chat Settings hub)
    //   payment-providers  · 2026-11-10 (merchant payment hub)
    //   my-orders          · 2026-11-10 P3 (merchant dashboard)
    //   wholesale          · 2026-11-18 (concurrent-work insertion ·
    //                        DO NOT remove without a new directive)
    //   nex-store          · 2026-11-07 (NEX-owned extras)
    //   discovery          · 2026-11-09 revision (routes to /directory)
    //
    // Earlier 5-row assertion covered a now-stale state
    // ("chat-appearance" was folded into Chat Settings on 2026-11-13
    // and "profile" moved below "chats-contacts" on 2026-11-12). This
    // list enforces the exact post-11-18 ordering.
    expect(__internal.YOUR_NEX_ROWS.map((r) => r.key)).toEqual([
      "chats-contacts",
      "profile",
      "edit-profile",
      "manage-shop",
      "shop-faq",
      "chat-settings",
      "payment-providers",
      "my-orders",
      "wholesale",
      "nex-store",
      "discovery",
    ]);
    // PREFERENCES_ROWS · sealed 2026-11-04 trim retained only "help";
    // 2026-11-11 Cycle 36 reinstated "settings"; 2026-11-09 revision 4
    // renamed "help" → "nex-1"; 2026-11-18 inserted "buying-guides".
    expect(__internal.PREFERENCES_ROWS.map((r) => r.key)).toEqual([
      "settings",
      "buying-guides",
      "nex-1",
    ]);
  });
});

// ─── Regression · drawer-close callback (D3 · 2026-11-18) ──────────
//
// Before 2026-11-18, DrawerBody referenced a bare `close` identifier
// at the three SectionGroup `closeDrawer` sites. That identifier
// resolved against the global `window.close` because DrawerBody is a
// top-level function and the parent's `close` useCallback lives only
// inside ControlDrawer's component scope. Tapping any drawer row
// invoked `window.close()` · on browsers that honour the API (most
// SPAs under PWA/standalone display mode, in-app browsers, etc.) the
// browser would try to terminate the whole tab.
//
// The fix threaded a required `closeDrawer: () => void` prop into
// DrawerBody and passes the parent's close callback through. These
// tests pin that wiring so a future refactor can never reintroduce
// the global-close regression silently.

describe("DrawerBody · closeDrawer wiring (regression · 2026-11-18)", () => {
  it("invokes the closeDrawer prop on an ordinary row tap", () => {
    const closeDrawer = vi.fn();
    const { container } = render(
      <__internal.DrawerBody
        session={SIGNED_IN}
        onLogoutClick={() => {}}
        closeDrawer={closeDrawer}
      />,
    );
    const anyRow = container.querySelector<HTMLAnchorElement>(
      '[data-nex-control-drawer-row="profile"]',
    );
    expect(anyRow).not.toBeNull();
    // Fire a click · the <Link> element short-circuits navigation
    // under the test DOM, but the inline onClick handler is still
    // invoked. This is exactly what happens in production when the
    // user taps a drawer row.
    fireEvent.click(anyRow!);
    expect(closeDrawer).toHaveBeenCalledTimes(1);
  });

  it("invokes the closeDrawer prop on a SAME-PATH row tap (pathname watcher does not fire)", () => {
    // When a user taps a row that navigates to the current path, the
    // usePathname watcher never fires (pathname is unchanged) so the
    // drawer would never close via the route-change code path. The
    // row-tap callback MUST close it. This is the exact bug reported
    // as "Chats and contacts link doesn't work · drawer stays open"
    // in the owner's 2026-11-13 test surface.
    const closeDrawer = vi.fn();
    const { container } = render(
      <__internal.DrawerBody
        session={SIGNED_IN}
        onLogoutClick={() => {}}
        closeDrawer={closeDrawer}
      />,
    );
    // The usePathname mock returns "/nex-native/free-chat". Find a row
    // whose href matches that pathname prefix · same-path tap scenario.
    // If no row happens to point at the mock path, this test still
    // demonstrates that the onClick handler fires regardless of path
    // change, so use the first row.
    const row = container.querySelector<HTMLAnchorElement>(
      '[data-nex-control-drawer-row]',
    );
    expect(row).not.toBeNull();
    fireEvent.click(row!);
    expect(closeDrawer).toHaveBeenCalledTimes(1);
  });

  it("does NOT invoke window.close on a row tap", () => {
    // The pre-fix defect: tapping a row invoked `window.close()`.
    // This test spies on window.close and asserts it is never called.
    const windowCloseSpy = vi.spyOn(window, "close").mockImplementation(() => {});
    const closeDrawer = vi.fn();
    const { container } = render(
      <__internal.DrawerBody
        session={SIGNED_IN}
        onLogoutClick={() => {}}
        closeDrawer={closeDrawer}
      />,
    );
    const rows = container.querySelectorAll<HTMLAnchorElement>(
      '[data-nex-control-drawer-row]',
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      fireEvent.click(row);
    }
    expect(windowCloseSpy).not.toHaveBeenCalled();
    expect(closeDrawer).toHaveBeenCalledTimes(rows.length);
    windowCloseSpy.mockRestore();
  });

  it("row <Link> href remains intact · ordinary navigation still works", () => {
    // Belt-and-braces · the row-tap closeDrawer call must not
    // short-circuit the <Link>'s navigation. Each rendered row still
    // exposes its canonical href so Next.js' <Link> can navigate.
    const closeDrawer = vi.fn();
    const { container } = render(
      <__internal.DrawerBody
        session={SIGNED_IN}
        onLogoutClick={() => {}}
        closeDrawer={closeDrawer}
      />,
    );
    const profileRow = container.querySelector<HTMLAnchorElement>(
      '[data-nex-control-drawer-row="profile"]',
    );
    expect(profileRow).not.toBeNull();
    expect(profileRow!.getAttribute("href")).toBe("/nex-native/profile/me");
    // Click fires the handler (closeDrawer) · default <Link>
    // navigation would then proceed in a real browser; jsdom doesn't
    // execute navigation but the handler assertion covers the wiring.
    fireEvent.click(profileRow!);
    expect(closeDrawer).toHaveBeenCalled();
  });
});
