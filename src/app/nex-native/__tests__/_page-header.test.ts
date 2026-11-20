// src/app/nex-native/__tests__/_page-header.test.ts
//
// Static-source guardrails for the shared NEX page header.
//
// Shape history
//   · 2026-10-17 (retired) · brand ping-badge LEFT + search icon MIDDLE +
//     three-dots drawer RIGHT.
//   · 2026-11-12 (CURRENT · owner directive) · brand ping-badge and
//     search icon globally retired from the shared header. The header
//     renders a SINGLE element: the shared drawer button pinned to the
//     right. Every surface gets the stripped header automatically · no
//     per-page hide-flag needed. Legacy props (brandAvatarUrl / brandAccent
//     / brandSlot / hideSearch / hideBrand / searchStyle) remain on the
//     interface for backward compat with existing callers and are
//     explicitly no-ops.
//   · 2026-11-12 (CURRENT · auto-resolve directive) · when `drawerSession`
//     is undefined, the header resolves it server-side via
//     resolveSessionWithDevOverride so every mounting page carries an
//     identity bar without having to thread it manually.
//
// This file verifies the CURRENT shape only. The old brand+search
// assertions are NOT reinstated · any drive to reintroduce them must
// cite a new owner directive and update this file in the same change.
//
// Three-drawer system boundary (owner correction 2026-11-18)
//   · Header "+" button (this file's drawer) = right-side navigation
//     drawer via the shared ControlDrawer.
//   · Bell icon = SEPARATE left-side notifications drawer (not here).
//   · Lower-right three-dot = SEPARATE left-side product drawer (not
//     here).
//   These three drawers must stay independent · this test file must
//   NOT assert about the bell or product drawers.
//
// Pure source read · no React rendering.

import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const PAGE_HEADER = fs.readFileSync(
  path.join(process.cwd(), "src/app/nex-native/_page-header.tsx"),
  "utf8",
);

describe("shared NEX page header · 2026-11-12 stripped shape", () => {
  it("still emits the top-level header data attribute for layout tests", () => {
    expect(PAGE_HEADER).toMatch(/data-nex-page-header\b/);
  });

  it("imports and mounts the shared drawer button client", () => {
    expect(PAGE_HEADER).toMatch(
      /import\s*\{\s*PageHeaderDrawerButtonClient\s*\}\s*from\s*["']\.\/_page-header-drawer-button-client["']/,
    );
    expect(PAGE_HEADER).toMatch(/<PageHeaderDrawerButtonClient\b/);
  });

  it("header is right-aligned (justifyContent: flex-end)", () => {
    expect(PAGE_HEADER).toMatch(/justifyContent:\s*["']flex-end["']/);
  });
});

describe("shared NEX page header · retired surface elements", () => {
  it("does NOT re-mount the NexPingBadge or a brand link", () => {
    // Owner directive 2026-11-12 · brand ping-badge globally removed.
    expect(PAGE_HEADER).not.toMatch(/<NexPingBadge\b/);
    expect(PAGE_HEADER).not.toMatch(/data-nex-page-header-brand\b/);
    expect(PAGE_HEADER).not.toMatch(/href="\/nex-native"/);
  });

  it("does NOT re-mount a search icon or route it anywhere", () => {
    // Owner directive 2026-11-12 · magnifier globally removed. Search is
    // reachable via the drawer (Directory row) not via a header icon.
    expect(PAGE_HEADER).not.toMatch(/data-nex-page-header-search\b/);
    expect(PAGE_HEADER).not.toMatch(/href="\/nex-native\/directory\/landing"/);
    expect(PAGE_HEADER).not.toMatch(/href="\/nex-native\/search"/);
  });

  it("Home icon stays absent from the shared header", () => {
    expect(PAGE_HEADER).not.toMatch(/data-nex-page-header-home\b/);
    expect(PAGE_HEADER).not.toMatch(/href="\/nex-native\/home"/);
    expect(PAGE_HEADER).not.toMatch(/<HomeIcon\s*\/>/);
  });

  it("SettingsHeaderSlot stays unimported from the shared header", () => {
    expect(PAGE_HEADER).not.toMatch(/import\s*\{[^}]*SettingsHeaderSlot/);
    expect(PAGE_HEADER).not.toMatch(/<SettingsHeaderSlot\b/);
  });

  it("the dead GearIcon helper stays removed", () => {
    expect(PAGE_HEADER).not.toMatch(/function\s+GearIcon\s*\(/);
  });
});

describe("shared NEX page header · drawer-session auto-resolve (2026-11-12)", () => {
  it("imports the dev-override session resolver for identity-bar auto-mount", () => {
    expect(PAGE_HEADER).toMatch(
      /import\s*\{\s*resolveSessionWithDevOverride\s*\}\s*from\s*["']@\/lib\/nex-native\/app\/dev-impersonation["']/,
    );
  });

  it("resolves a session only when drawerSession is undefined (explicit null is respected)", () => {
    expect(PAGE_HEADER).toMatch(/drawerSession\s*===\s*undefined/);
    // Non-threaded pages trigger the resolver; explicitly-null pages
    // (welcome / sign-in) do not.
    expect(PAGE_HEADER).toMatch(/resolveSessionWithDevOverride\s*\(/);
  });
});

describe("shared NEX page header · legacy props kept inert (backward compat)", () => {
  it("retains the legacy prop names but voids them so nothing renders", () => {
    // Keeping the legacy props on the interface lets ~dozens of existing
    // call-sites compile unchanged · the body must not render them.
    expect(PAGE_HEADER).toMatch(/brandAvatarUrl:\s*_brandAvatarUrl/);
    expect(PAGE_HEADER).toMatch(/hideSearch:\s*_hideSearch/);
    expect(PAGE_HEADER).toMatch(/hideBrand:\s*_hideBrand/);
    expect(PAGE_HEADER).toMatch(/void\s+_brandAvatarUrl/);
    expect(PAGE_HEADER).toMatch(/void\s+_hideSearch/);
    expect(PAGE_HEADER).toMatch(/void\s+_hideBrand/);
  });

  it("the retired opt-out props (showHome / showSettings / pingBadgeSize) are not re-added", () => {
    expect(PAGE_HEADER).not.toMatch(/showHome\s*\?/);
    expect(PAGE_HEADER).not.toMatch(/showSettings\s*\?/);
    expect(PAGE_HEADER).not.toMatch(/pingBadgeSize\s*\?/);
  });
});
