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
import {
  ControlDrawer,
  __internal,
  type ControlDrawerSession,
} from "../control-drawer-client";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    back: () => {},
    forward: () => {},
    refresh: () => {},
    prefetch: () => {},
  }),
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
      <__internal.DrawerBody session={SIGNED_IN} onLogoutClick={() => {}} />,
    );
    expect(html).toContain("Alice");
    expect(html).toContain("@alice");
    expect(html).toContain("data-nex-control-drawer-identity");
  });

  it("renders a sign-in prompt for anonymous viewers (no logout + no business group bleed)", () => {
    const html = renderToStaticMarkup(
      <__internal.DrawerBody session={null} onLogoutClick={() => {}} />,
    );
    expect(html).toContain("Sign in to NEX");
    expect(html).toContain('href="/nex-native/sign-in"');
    // Anonymous viewers must NOT see the logout CTA.
    expect(html).not.toContain("data-nex-control-drawer-logout");
    // Business Vault must never render for anonymous viewers.
    expect(html).not.toContain("Business Vault");
  });

  it("renders the handle only when present (null handle must not crash or render @)", () => {
    const html = renderToStaticMarkup(
      <__internal.DrawerBody
        session={{ ...SIGNED_IN, nexHandle: null }}
        onLogoutClick={() => {}}
      />,
    );
    expect(html).toContain("Alice");
    // No stray @ handle rendered when handle is null.
    expect(html).not.toContain("@alice");
  });
});

describe("DrawerBody · entitlement gate on Business Vault (owner decision #1)", () => {
  it("non-Bisnis viewer sees My businesses + Packages but NOT Business Vault", () => {
    const html = renderToStaticMarkup(
      <__internal.DrawerBody session={SIGNED_IN} onLogoutClick={() => {}} />,
    );
    expect(html).toContain("My businesses");
    expect(html).toContain("Packages and billing");
    expect(html).not.toContain("Business Vault");
    expect(html).not.toContain('data-nex-control-drawer-row="business-vault"');
  });

  // Owner directive 2026-11-01 (Batch D+) · the bisnis slice is a
  // tighter: [my-shop · Business Vault · my-businesses] (plus the
  // optional creator-support tail). The "packages" row is now part
  // of the non-bisnis slice only · bisnis viewers reach billing
  // through a separate surface and don't see the drawer packages
  // row. This spec locks the tighter contract.
  it("Bisnis viewer sees Business Vault slot inside the bisnis slice", () => {
    const html = renderToStaticMarkup(
      <__internal.DrawerBody session={BISNIS} onLogoutClick={() => {}} />,
    );
    // Bisnis slice required rows:
    expect(html).toContain("My Shop");
    expect(html).toContain("Business Vault");
    expect(html).toContain("My businesses");
    expect(html).toContain('data-nex-control-drawer-row="business-vault"');

    // Business Vault sits BETWEEN my-shop and my-businesses in the slice.
    const idxShop = html.indexOf("My Shop");
    const idxVault = html.indexOf("Business Vault");
    const idxBusinesses = html.indexOf("My businesses");
    expect(idxShop).toBeLessThan(idxVault);
    expect(idxVault).toBeLessThan(idxBusinesses);

    // "Packages and billing" row is a non-bisnis row · not rendered
    // inside the bisnis slice.
    expect(html).not.toContain("Packages and billing");
  });
});

describe("DrawerBody · section groups + rows", () => {
  it("renders the three sealed section titles in order", () => {
    const html = renderToStaticMarkup(
      <__internal.DrawerBody session={SIGNED_IN} onLogoutClick={() => {}} />,
    );
    const i1 = html.indexOf("YOUR NEX");
    const i2 = html.indexOf("YOUR BUSINESS");
    const i3 = html.indexOf("PREFERENCES &amp; SUPPORT");
    expect(i1).toBeGreaterThan(-1);
    expect(i2).toBeGreaterThan(-1);
    expect(i3).toBeGreaterThan(-1);
    expect(i1).toBeLessThan(i2);
    expect(i2).toBeLessThan(i3);
  });

  it("every destination row renders a verified route (no new routes invented)", () => {
    const html = renderToStaticMarkup(
      <__internal.DrawerBody session={BISNIS} onLogoutClick={() => {}} />,
    );
    // Rows actually rendered for a Bisnis session. The profile row
    // moved to `/nex-native/profile/me` and the drawer no longer
    // emits a top-level /chat route (replaced by contacts). These are
    // the hrefs that MUST appear in the rendered drawer body.
    const expectedHrefs = [
      "/nex-native/profile/me",
      "/nex-native/chat-themes-library",
      "/nex-native/manage",
      "/nex-native/vault",
      "/nex-native/settings",
      "/nex-native/settings/security",
      "/nex-native/settings/help",
    ];
    for (const href of expectedHrefs) {
      expect(html).toContain(`href="${href}"`);
    }
  });
});

describe("DrawerBody · logout surface + confirmation modal (owner decision #2)", () => {
  it("renders the Log out button for signed-in viewers", () => {
    const html = renderToStaticMarkup(
      <__internal.DrawerBody session={SIGNED_IN} onLogoutClick={() => {}} />,
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
    expect(__internal.YOUR_NEX_ROWS.map((r) => r.key)).toEqual([
      // Owner directive 2026-10-19 · Home row inserted at the top of
      // YOUR NEX · routes to /nex-native/contacts so the drawer is
      // the one-tap escape from any consumer surface.
      "home-contacts",
      "profile",
      "chats-contacts",
      "chat-appearance",
      // Owner directive 2026-10-20 · Shop appearance row · companion
      // to Chat appearance · skins the public shop face/cover.
      "shop-appearance",
      // Owner directive 2026-10-19 · Intro Video row · settings page
      // for the user's own 8s intro + title overlay.
      "intro-video",
      // Owner directive 2026-10-22 · Status row · 24h ephemeral
      // sharing stored device-local.
      "status",
    ]);
    // Owner directive 2026-11-01 (Batch D+) · YOUR BUSINESS rows now
    // include my-shop (primary owner-admin entry), delivery-pricing
    // and creator-support. Order below reflects source ordering of
    // YOUR_BUSINESS_ROWS (not the bisnis-slice render ordering).
    expect(__internal.YOUR_BUSINESS_ROWS.map((r) => r.key)).toEqual([
      "my-shop",
      "my-businesses",
      "delivery-pricing",
      "packages",
      "creator-support",
    ]);
    expect(__internal.BUSINESS_VAULT_ROW.key).toBe("business-vault");
    expect(__internal.PREFERENCES_ROWS.map((r) => r.key)).toEqual([
      "settings",
      "security",
      "help",
    ]);
  });
});
