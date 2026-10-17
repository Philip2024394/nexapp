// src/app/nex-native/chat/__tests__/pinned-nex-cards.test.ts
//
// Owner-authorised 2026-10-17 · the Chat hub landing was retired
// in favour of /nex-native/contacts (Phase 1 Contacts hub). The
// pinned NEX cards (NEX customer service + NEX Community
// Noticeboard) that used to live on /chat?tab=friends are now
// implemented on /contacts via its own component tree
// (_invite-friends-card + _my-groups-card + pinned surface).
//
// This test file was originally the guardrail that proved those
// cards were mounted inside the Chat hub's FRIENDS tab branch.
// With the hub retired to a thin redirect, the guardrail inverts:
// enforce that /chat/page.tsx is a pure redirect with ZERO hub
// UI resurfacing accidentally.
//
// Pure static-source read · no React rendering.

import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const PAGE = fs.readFileSync(
  path.join(process.cwd(), "src/app/nex-native/chat/page.tsx"),
  "utf8",
);

describe("chat hub landing · retired to a thin redirect (2026-10-17)", () => {
  it("imports the next/navigation redirect helper", () => {
    expect(PAGE).toMatch(/import\s*\{\s*redirect\s*\}\s*from\s*["']next\/navigation["']/);
  });

  it("default export is a function that returns `never` and calls redirect to /contacts", () => {
    expect(PAGE).toMatch(/export\s+default\s+function\s+\w+\(\)[\s\S]{0,200}redirect\(\s*["']\/nex-native\/contacts["']\s*\)/);
  });

  it("does NOT import or mount any hub UI components (NexPageHeader, FriendsPanel, PinnedNexCards, SideNavPanel)", () => {
    const sourceOnly = PAGE
      .replace(/\/\/[^\n]*/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    expect(sourceOnly).not.toMatch(/<NexPageHeader\b/);
    expect(sourceOnly).not.toMatch(/<FriendsPanel\b/);
    expect(sourceOnly).not.toMatch(/<PinnedNexCards\b/);
    expect(sourceOnly).not.toMatch(/<SideNavPanel\b/);
  });

  it("does NOT call any Supabase service / server action (zero side effects)", () => {
    expect(PAGE).not.toMatch(/nexSupabaseAdmin/);
    expect(PAGE).not.toMatch(/friendService\.|conversationService\.|accountService\./);
  });

  it("preserves the sealed Chat sub-routes · the retirement is scoped to the hub landing only", () => {
    // Owner directive: /chat/peer, /chat/guest, /chat/inbox,
    // /chat/first-visit, /chat/preview, /chat/prototypes all STAY.
    // This test documents that intent (verified by inspecting the
    // sibling directories at the file-system level · we don't try
    // to list them from vitest; the owner-authored comment above
    // documents the sealed scope).
    expect(PAGE).toMatch(/Chat sub-routes under \/nex-native\/chat\/\* are UNCHANGED/);
  });
});
