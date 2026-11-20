// src/app/nex-native/__tests__/_page-header-drawer.test.ts
//
// Static-source guardrails for the shared page-header drawer button.
//
// Shape history
//   · 2026-10-17 → 2026-11-03 (retired) · inline drawer panel owned
//     labels, hrefs, Esc handler, overlay click, aria-* wiring,
//     firstLinkRef focus.
//   · 2026-11-05 (CURRENT · owner unify directive) · the inline drawer
//     retired in favour of the shared `ControlDrawer` so Community
//     pages, Settings, Directory, Chat 9001, free-chat and every other
//     NexPageHeader surface show the SAME menu with ONE set of links.
//   · 2026-11-11 (CURRENT · owner Cycle 28) · trigger glyph colour
//     changed from Cycle-25 orange to a BLACK background with a WHITE
//     "+" glyph across every NexPageHeader surface.
//   · 2026-11-09 (CURRENT · owner directive) · Emergency Help row
//     REMOVED from this drawer · emergency UX moved to the splash page
//     (/nex-native/_splash-emergency-ui-client.tsx). This file's drawer
//     must NOT re-mount an Emergency / tel:112 row.
//
// What this file now covers
//   · Button client is a pure thin wrapper · it imports ControlDrawer
//     and forwards `triggerIcon="plus"`, a sealed trigger-style object,
//     and the server-resolved `session` prop. It must NOT redeclare
//     labels, hrefs, Esc handler, overlay, aria-* or focus logic locally.
//
// What this file does NOT cover (legitimately moved elsewhere)
//   · The sealed menu rows (My profile · Chats and contacts · Chat
//     themes · Help · NEX1 · Log out etc.) + the Esc handler + overlay
//     click + firstLinkRef focus + role="menu" semantics now live in
//     `src/components/nex-native/control-drawer/control-drawer-client.tsx`.
//     That file has its own test suite at
//     `src/components/nex-native/control-drawer/__tests__/`.
//
// Three-drawer system boundary (owner correction 2026-11-18)
//   · This drawer (header "+") = right-side navigation drawer.
//   · Bell icon = SEPARATE left-side notifications drawer (not here).
//   · Lower-right three-dot = SEPARATE left-side product drawer (not
//     here).
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

describe("header '+' button client · thin-wrapper shape (2026-11-05)", () => {
  it("is a client component", () => {
    expect(DRAWER).toMatch(/^\s*["']use client["']\s*;/);
  });

  it("exports the sealed component name", () => {
    expect(DRAWER).toMatch(/export\s+function\s+PageHeaderDrawerButtonClient\b/);
  });

  it("imports ControlDrawer from the sealed shared path", () => {
    expect(DRAWER).toMatch(
      /import\s*\{[\s\S]*?ControlDrawer[\s\S]*?\}\s*from\s*["']@\/components\/nex-native\/control-drawer\/control-drawer-client["']/,
    );
  });

  it("imports the ControlDrawerSession type (session identity is typed, not any)", () => {
    expect(DRAWER).toMatch(/type\s+ControlDrawerSession\b/);
  });

  it("mounts exactly one <ControlDrawer /> and forwards triggerIcon=\"plus\"", () => {
    // Exactly one mount · the wrapper does not fan out to multiple
    // drawers (that would conflict with the three-drawer boundary).
    const mounts = DRAWER.match(/<ControlDrawer\b/g) ?? [];
    expect(mounts.length).toBe(1);
    expect(DRAWER).toMatch(/triggerIcon=["']plus["']/);
  });

  it("forwards the server-resolved session prop into ControlDrawer (defaulting to null)", () => {
    expect(DRAWER).toMatch(
      /function\s+PageHeaderDrawerButtonClient\s*\(\s*\{\s*session\s*=\s*null\b/,
    );
    expect(DRAWER).toMatch(/<ControlDrawer[\s\S]{0,200}session=\{\s*session\s*\}/);
  });
});

describe("header '+' button client · sealed trigger style (2026-11-11 Cycle 28)", () => {
  it("passes a 40x40 round black-on-white '+' trigger via triggerStyle", () => {
    // Cycle 28 · supersedes Cycle 25 orange. Owner directive 2026-11-11.
    expect(DRAWER).toMatch(/const\s+TRIGGER_STYLE\s*:\s*React\.CSSProperties/);
    expect(DRAWER).toMatch(/width:\s*40\b/);
    expect(DRAWER).toMatch(/height:\s*40\b/);
    expect(DRAWER).toMatch(/borderRadius:\s*["']50%["']/);
    expect(DRAWER).toMatch(/background:\s*["']#000000["']/);
    expect(DRAWER).toMatch(/color:\s*["']#FFFFFF["']/);
  });

  it("the retired Cycle-25 orange trigger colour does not linger", () => {
    // Cycle 25 orange surfaces (#FF6A00 / #F67D00 / #FFA000 etc.)
    // should not reappear in the trigger style. Limit the match to the
    // trigger style literal so legitimate orange tokens elsewhere in
    // the codebase are not flagged.
    const triggerStyleBlock = DRAWER.match(
      /const\s+TRIGGER_STYLE[\s\S]*?\n\};/,
    );
    expect(triggerStyleBlock).not.toBeNull();
    expect(triggerStyleBlock![0]).not.toMatch(/#FF6A00/i);
    expect(triggerStyleBlock![0]).not.toMatch(/#F67D00/i);
    expect(triggerStyleBlock![0]).not.toMatch(/#FFA000/i);
  });
});

describe("header '+' button client · behaviour moved into ControlDrawer (NOT redeclared here)", () => {
  // These assertions protect the thin-wrapper contract. If someone
  // later tries to re-inline labels / aria wiring / Esc here, the
  // regressions below catch it and the ControlDrawer test suite stays
  // the authoritative source for that behaviour.

  it("drawer labels are NOT redeclared in the button client", () => {
    expect(DRAWER).not.toMatch(/label:\s*["']Profile["']/);
    expect(DRAWER).not.toMatch(/label:\s*["']Chat themes["']/);
    expect(DRAWER).not.toMatch(/label:\s*["']Privacy["']/);
    expect(DRAWER).not.toMatch(/label:\s*["']Notifications["']/);
    expect(DRAWER).not.toMatch(/label:\s*["']Vault["']/);
    expect(DRAWER).not.toMatch(/label:\s*["']Live["']/);
    expect(DRAWER).not.toMatch(/label:\s*["']Package & billing["']/);
    expect(DRAWER).not.toMatch(/label:\s*["']Help · NEX1["']/);
  });

  it("drawer hrefs are NOT redeclared in the button client", () => {
    // If any href literal pops up here, the wrapper has started
    // owning destinations that belong in ControlDrawer.
    expect(DRAWER).not.toMatch(/href:\s*["']\/nex-native\/settings\/profile\/edit["']/);
    expect(DRAWER).not.toMatch(/href:\s*["']\/nex-native\/chat-themes-library["']/);
    expect(DRAWER).not.toMatch(/href:\s*["']\/nex-native\/vault["']/);
    expect(DRAWER).not.toMatch(/href:\s*["']\/nex-native\/settings\/tier["']/);
    expect(DRAWER).not.toMatch(/href:\s*["']\/nex-native\/help["']/);
  });

  it("Esc / overlay / firstLinkRef / aria-* wiring is NOT redeclared here", () => {
    expect(DRAWER).not.toMatch(/firstLinkRef\.current\?\.focus\(\)/);
    expect(DRAWER).not.toMatch(/e\.key\s*===\s*["']Escape["']/);
    expect(DRAWER).not.toMatch(/data-nex-page-header-drawer-overlay\b/);
    expect(DRAWER).not.toMatch(/aria-label="NEX menu"/);
    expect(DRAWER).not.toMatch(/aria-label="Open menu"/);
    expect(DRAWER).not.toMatch(/role="menu"/);
  });

  it("signOutAction is NOT imported or inline-wired here (ControlDrawer owns the form)", () => {
    expect(DRAWER).not.toMatch(
      /import\s*\{\s*signOutAction\s*\}\s*from\s*["']\.\/_actions["']/,
    );
    expect(DRAWER).not.toMatch(/<form\s+action=\{\s*signOutAction\s*\}/);
    expect(DRAWER).not.toMatch(/document\.cookie/);
    expect(DRAWER).not.toMatch(/fetch\(\s*["']\/api\/.*sign-?out/);
  });

  it("Emergency Help row stays removed from this surface (owner directive 2026-11-09)", () => {
    // Emergency UX lives on the splash page. If a tel:112 or an actual
    // "Emergency help" row reappears, flag it. Strip comments first so
    // the shape-history header in this file's docstring (which
    // legitimately mentions emergency UX) is not counted as emitted
    // markup.
    const sourceOnly = DRAWER.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(sourceOnly).not.toMatch(/href=["']tel:112["']/);
    expect(sourceOnly).not.toMatch(/Emergency help/i);
  });
});
