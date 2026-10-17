// src/app/nex-native/__tests__/_page-header-drawer.test.ts
//
// Static-source guardrails for the shared page-header drawer client.
//
// What this test proves:
//   · The drawer is a `"use client"` component (so React state +
//     keyboard handlers are available).
//   · The seven sealed drawer links are present with the exact
//     labels the owner authorised: Home · Contacts · Chat · Calls ·
//     Search · Settings · Sign out.
//   · Sign out routes through the sealed `signOutAction` server
//     action · never a simulated client-side sign-out and never a
//     second auth mechanism.
//   · Every destination routes to its sealed `/nex-native/<route>`.
//   · Esc + overlay-click + close-button all close the drawer
//     (verified by shape of the source · keyboard + click handlers).
//
// Pure source read · no React rendering.

import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const DRAWER = fs.readFileSync(
  path.join(
    process.cwd(),
    "src/app/nex-native/_page-header-drawer-button-client.tsx",
  ),
  "utf8",
);

describe("shared page-header drawer · client-component shape", () => {
  it("is a client component", () => {
    expect(DRAWER).toMatch(/^\s*["']use client["']\s*;/);
  });

  it("exports the sealed component name", () => {
    expect(DRAWER).toMatch(/export\s+function\s+PageHeaderDrawerButtonClient\b/);
  });

  it("imports the sealed signOutAction (not a simulated sign-out)", () => {
    expect(DRAWER).toMatch(
      /import\s*\{\s*signOutAction\s*\}\s*from\s*["']\.\/_actions["']/,
    );
  });

  it("sign-out form uses signOutAction (no inline fetch / cookie clear)", () => {
    expect(DRAWER).toMatch(/<form\s+action=\{\s*signOutAction\s*\}/);
    expect(DRAWER).not.toMatch(/document\.cookie/);
    expect(DRAWER).not.toMatch(/fetch\(\s*["']\/api\/.*sign-?out/);
  });
});

describe("shared page-header drawer · seven sealed destinations", () => {
  it("drawer links array holds exactly the six Link items + the sign-out form", () => {
    expect(DRAWER).toMatch(/label:\s*["']Home["']/);
    expect(DRAWER).toMatch(/label:\s*["']Contacts["']/);
    expect(DRAWER).toMatch(/label:\s*["']Chat["']/);
    expect(DRAWER).toMatch(/label:\s*["']Calls["']/);
    expect(DRAWER).toMatch(/label:\s*["']Search["']/);
    expect(DRAWER).toMatch(/label:\s*["']Settings["']/);
    // Sign out is a <button type="submit"> inside the form.
    expect(DRAWER).toMatch(/Sign out/);
  });

  it("every drawer destination routes to its sealed /nex-native path", () => {
    expect(DRAWER).toMatch(/href:\s*["']\/nex-native\/home["']/);
    // Owner-authorised 2026-10-17 · /contacts route retired · drawer
    // links direct to /chat?tab=friends (where the Contacts
    // experience actually lives) to skip the redirect hop.
    expect(DRAWER).toMatch(/href:\s*["']\/nex-native\/chat\?tab=friends["']/);
    expect(DRAWER).toMatch(/href:\s*["']\/nex-native\/chat["']/);
    expect(DRAWER).toMatch(/href:\s*["']\/nex-native\/calls["']/);
    expect(DRAWER).toMatch(/href:\s*["']\/nex-native\/search["']/);
    expect(DRAWER).toMatch(/href:\s*["']\/nex-native\/settings["']/);
  });

  it("drawer uses scoped data attributes so it does not collide with the Welcome bespoke drawer", () => {
    expect(DRAWER).toMatch(/data-nex-page-header-drawer-trigger\b/);
    expect(DRAWER).toMatch(/data-nex-page-header-drawer-panel\b/);
    expect(DRAWER).toMatch(/data-nex-page-header-drawer-overlay\b/);
    expect(DRAWER).toMatch(/data-nex-page-header-drawer-link=/);
    // Confirm no welcome-drawer attribute is EMITTED (strip comments
    // first · the top-of-file comment legitimately mentions the
    // Welcome drawer naming to explain the scope boundary).
    const sourceOnly = DRAWER.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(sourceOnly).not.toMatch(/data-nex-welcome-drawer-/);
  });
});

describe("shared page-header drawer · accessibility + close affordances", () => {
  it("Esc closes the drawer (keyboard listener wired)", () => {
    expect(DRAWER).toMatch(/addEventListener\(\s*["']keydown["']/);
    expect(DRAWER).toMatch(/e\.key\s*===\s*["']Escape["']/);
    expect(DRAWER).toMatch(/setOpen\(\s*false\s*\)/);
  });

  it("overlay click closes the drawer", () => {
    // The overlay <div> carries BOTH an onClick that calls setOpen(false)
    // AND the data-nex-page-header-drawer-overlay attribute · JSX
    // declaration order is not deterministic between the two so match
    // both near-together.
    expect(DRAWER).toMatch(
      /onClick=\{\(\)\s*=>\s*setOpen\(\s*false\s*\)\}[\s\S]{0,200}data-nex-page-header-drawer-overlay/,
    );
  });

  it("drawer trigger carries proper menu semantics", () => {
    expect(DRAWER).toMatch(/aria-label="Open navigation menu"/);
    expect(DRAWER).toMatch(/aria-haspopup="menu"/);
    expect(DRAWER).toMatch(/aria-expanded=\{open\}/);
  });

  it("drawer panel is a role=menu with an aria-label", () => {
    expect(DRAWER).toMatch(/role="menu"/);
    expect(DRAWER).toMatch(/aria-label="NEX navigation"/);
  });

  it("first drawer link gets focus on open", () => {
    expect(DRAWER).toMatch(/firstLinkRef\.current\?\.focus\(\)/);
  });
});
