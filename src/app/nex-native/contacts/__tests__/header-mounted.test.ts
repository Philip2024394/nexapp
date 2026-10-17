// src/app/nex-native/contacts/__tests__/header-mounted.test.ts
//
// Owner-authorised 2026-10-17 Phase 1 · /nex-native/contacts is a
// dedicated Contacts hub (NEX CONTACTS redesign) when the launch
// flag NEX_CONTACTS_V2_ENABLED is on. When the flag is OFF the page
// server-side redirects to /chat?tab=friends (same honest fallback
// as before Phase 1).
//
// Static-source guardrails:
//   · Launch-flag import is present
//   · Flag-off redirect to /chat?tab=friends is preserved
//   · Flag-on path mounts the new Contacts hub components
//   · Session resolve + sign-in redirect for unauthenticated viewers
//   · Contact data contract: friends via friend-service.listFriends +
//     per-id account hydration; business via conversation-service
//     with side === "customer" dedup
//   · D1 · no city display in rows (no `last_known_city_label`)
//   · D2 · no presence dot (no `nex_presence`)
//   · D7 · the retired opt-out props are not re-introduced
//
// Pure source read · no React rendering.

import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const PAGE_PATH = path.join(
  process.cwd(),
  "src/app/nex-native/contacts/page.tsx",
);
const SOURCE = fs.readFileSync(PAGE_PATH, "utf8");

describe("contacts page · launch-flag gated hub (Phase 1 · 2026-10-17)", () => {
  it("imports the sealed NEX_CONTACTS_V2_ENABLED launch flag", () => {
    expect(SOURCE).toMatch(
      /import\s*\{\s*NEX_CONTACTS_V2_ENABLED\s*\}\s*from\s*["']@\/lib\/nex-native\/launch-flags["']/,
    );
  });

  it("preserves the flag-off redirect to /chat?tab=friends (honest fallback)", () => {
    expect(SOURCE).toMatch(/!NEX_CONTACTS_V2_ENABLED/);
    expect(SOURCE).toMatch(
      /redirect\(\s*["']\/nex-native\/chat\?tab=friends["']\s*\)/,
    );
  });

  it("session-gates the flag-on path · unauthenticated → /sign-in", () => {
    expect(SOURCE).toMatch(
      /resolveNexAppSessionFromContext/,
    );
    expect(SOURCE).toMatch(
      /redirect\(\s*["']\/nex-native\/sign-in["']\s*\)/,
    );
  });
});

describe("contacts page · hub component tree mounted (Phase 1)", () => {
  it("mounts ContactsShell · ContactsHeader · ContactsSearchBar · ContactsFilterPills", () => {
    expect(SOURCE).toMatch(/<ContactsShell\b/);
    expect(SOURCE).toMatch(/<ContactsHeader\s*\/>/);
    expect(SOURCE).toMatch(/<ContactsSearchBar\s*\/>/);
    expect(SOURCE).toMatch(/<ContactsFilterPills\s+active=\{\s*activeFilter\s*\}/);
  });

  it("mounts InviteFriendsCard · MyGroupsCard · ContactsList", () => {
    expect(SOURCE).toMatch(/<InviteFriendsCard\b/);
    expect(SOURCE).toMatch(/<MyGroupsCard\s*\/>/);
    expect(SOURCE).toMatch(/<ContactsList\b/);
  });
});

describe("contacts page · data contract (Safeguard #1)", () => {
  it("reads friends via friend-service.listFriends and hydrates per id via account-service", () => {
    expect(SOURCE).toMatch(/friendService\.listFriends\(/);
    expect(SOURCE).toMatch(/accountService\.getAccountById\(/);
  });

  it("reads business contacts via conversation-service and dedups by business_id when side === 'customer'", () => {
    expect(SOURCE).toMatch(/conversationService\.listConversationsForAccount\(/);
    expect(SOURCE).toMatch(/my_side\s*===\s*["']customer["']/);
    expect(SOURCE).toMatch(/businessContactsByBusinessId/);
  });
});

describe("contacts page · owner directives (D1 · D2 · D7)", () => {
  it("D1 · never surfaces last_known_city_label or city text in the page shell", () => {
    // Strip comments first · the header explanation legitimately
    // documents the sealed rule by name, which should not fail the
    // test. We assert against emitted code only.
    const sourceOnly = SOURCE
      .replace(/\/\/[^\n]*/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    expect(sourceOnly).not.toMatch(/last_known_city_label/);
    expect(sourceOnly).not.toMatch(/\bcity\b/i);
  });

  it("D2 · never reads from a nex_presence table or renders a 'presence' field", () => {
    const sourceOnly = SOURCE
      .replace(/\/\/[^\n]*/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    expect(sourceOnly).not.toMatch(/nex_presence/);
    expect(sourceOnly).not.toMatch(/\bpresence\b/i);
  });

  it("D7 · the retired shared-header opt-out props are not resurrected here", () => {
    expect(SOURCE).not.toMatch(/showHome\b/);
    expect(SOURCE).not.toMatch(/showSettings\b/);
    expect(SOURCE).not.toMatch(/pingBadgeSize\b/);
  });
});
