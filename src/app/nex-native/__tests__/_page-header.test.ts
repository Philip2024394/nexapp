// src/app/nex-native/__tests__/_page-header.test.ts
//
// Static-source guardrails for the shared NEX page header.
//
// Owner-authorised shape (2026-10-17 final · after Home + Settings
// icon removal):
//   · Left   · NEX ping badge (size 56 · hero scale matching
//              /directory/landing) wrapped in a Link to /nex-native
//   · Right  · Search icon (routes to /nex-native/directory/landing ·
//              the canonical NEX Directory entry per the 2026-10-17
//              canonical-directory doctrine)
//            · Three-dots drawer (shared PageHeaderDrawerButtonClient
//              with Home · Contacts · Chat · Calls · Search · Settings
//              · Sign out destinations)
//
// What this test proves:
//   · Brand slot still routes to /nex-native and carries the
//     data-nex-page-header-brand attribute (entry-router contract).
//   · Ping badge is mounted at size 56 (not 36 · owner directive).
//   · Search icon still carries data-nex-page-header-search.
//   · Shared drawer button is mounted at the end of the right cluster.
//   · Home + Settings icons are NOT mounted in the shared header
//     (both reachable via drawer · owner directive 2026-10-17).
//   · SettingsHeaderSlot is NOT imported here any more (component
//     preserved at its original path for future surfaces).
//   · The retired opt-out props are not re-added without a consumer.
//
// Pure source read · no React rendering.

import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const PAGE_HEADER = fs.readFileSync(
  path.join(process.cwd(), "src/app/nex-native/_page-header.tsx"),
  "utf8",
);

describe("shared NEX page header · sealed data attributes", () => {
  it("brand link still routes to /nex-native and carries data-nex-page-header-brand", () => {
    expect(PAGE_HEADER).toMatch(/href="\/nex-native"/);
    expect(PAGE_HEADER).toMatch(/data-nex-page-header-brand\b/);
  });

  it("search icon link routes to the canonical NEX Directory landing (2026-10-17 doctrine)", () => {
    // Owner-sealed canonical directory · /search retired as competing surface.
    expect(PAGE_HEADER).toMatch(/href="\/nex-native\/directory\/landing"/);
    expect(PAGE_HEADER).toMatch(/data-nex-page-header-search\b/);
    expect(PAGE_HEADER).not.toMatch(/href="\/nex-native\/search"/);
  });
});

describe("shared NEX page header · Home + Settings removed (owner-authorised 2026-10-17)", () => {
  it("Home icon is NOT mounted in the shared header (reachable via drawer)", () => {
    expect(PAGE_HEADER).not.toMatch(/data-nex-page-header-home\b/);
    expect(PAGE_HEADER).not.toMatch(/href="\/nex-native\/home"/);
    expect(PAGE_HEADER).not.toMatch(/<HomeIcon\s*\/>/);
  });

  it("SettingsHeaderSlot is NOT imported or mounted in the shared header", () => {
    expect(PAGE_HEADER).not.toMatch(/import\s*\{[^}]*SettingsHeaderSlot/);
    expect(PAGE_HEADER).not.toMatch(/<SettingsHeaderSlot\b/);
  });

  it("the dead GearIcon helper is removed from the header file", () => {
    expect(PAGE_HEADER).not.toMatch(/function\s+GearIcon\s*\(/);
  });
});

describe("shared NEX page header · ping-badge identity (hero-scale 2026-10-17)", () => {
  it("imports NexPingBadge from the sealed shared primitive", () => {
    expect(PAGE_HEADER).toMatch(
      /import\s*\{\s*NexPingBadge\s*\}\s*from\s*["']@\/lib\/nex-native\/nex-ping-badge-client["']/,
    );
  });

  it("mounts the NexPingBadge inside the brand link slot at size 56 (matches /directory/landing hero scale)", () => {
    expect(PAGE_HEADER).toMatch(/<NexPingBadge\s/);
    expect(PAGE_HEADER).toMatch(/<NexPingBadge[\s\S]{0,120}size=\{\s*56\s*\}/);
  });

  it("the plain 'NE/X' wordmark spans are retired", () => {
    expect(PAGE_HEADER).not.toMatch(/<span[^>]*>NE<\/span>/);
    expect(PAGE_HEADER).not.toMatch(/<span[^>]*>X<\/span>/);
  });
});

describe("shared NEX page header · no opt-out props (owner-authorised re-scope 2026-10-17)", () => {
  // The original 2026-10-17 scope introduced showHome / showSettings /
  // pingBadgeSize as a Contacts-only opt-out. The Contacts route was
  // then retired in favour of /nex-native/chat?tab=friends, which
  // removes the only consumer of those props. The shared header
  // reverts to its single-shape form · if a future surface needs
  // to opt out, the props can be reintroduced in the same shape.
  it("the retired opt-out props are not re-added without a consumer", () => {
    expect(PAGE_HEADER).not.toMatch(/showHome\s*\?/);
    expect(PAGE_HEADER).not.toMatch(/showSettings\s*\?/);
    expect(PAGE_HEADER).not.toMatch(/pingBadgeSize\s*\?/);
  });
});

describe("shared NEX page header · three-dots drawer (owner-authorised 2026-10-17)", () => {
  it("imports the shared drawer client component", () => {
    expect(PAGE_HEADER).toMatch(
      /import\s*\{\s*PageHeaderDrawerButtonClient\s*\}\s*from\s*["']\.\/_page-header-drawer-button-client["']/,
    );
  });

  it("mounts the drawer button inside the right cluster", () => {
    expect(PAGE_HEADER).toMatch(/<PageHeaderDrawerButtonClient\s*\/>/);
  });

  it("drawer is mounted AFTER the search icon (right-cluster order preserved)", () => {
    const searchIdx = PAGE_HEADER.indexOf("data-nex-page-header-search");
    const drawerIdx = PAGE_HEADER.indexOf("<PageHeaderDrawerButtonClient");
    expect(searchIdx).toBeGreaterThan(-1);
    expect(drawerIdx).toBeGreaterThan(-1);
    expect(drawerIdx).toBeGreaterThan(searchIdx);
  });
});
