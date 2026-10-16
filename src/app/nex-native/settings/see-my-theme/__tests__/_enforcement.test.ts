// src/app/nex-native/settings/see-my-theme/__tests__/_enforcement.test.ts
//
// Structural enforcement anchor · sealed 2026-10-16.
//
// Owner directive: "Enforce the symmetric rule in the actual server-
// authoritative theme resolution, not just in the UI." This file reads
// `src/app/nex-native/chat/peer/[accountId]/page.tsx` and asserts that
// the resolved peer theme is gated by `isThemeMutuallyVisibleSafe`
// BEFORE any theme row / emoji / sticker / intro-video lookup. A
// regression that removes the gate or reorders it to run AFTER a
// resolution step would break the AND-rule contract.

import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../../../../../..");
function read(rel: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
}
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
}

const CHAT_PAGE = stripComments(
  read("src/app/nex-native/chat/peer/[accountId]/page.tsx"),
);
const RELATIONSHIP_SERVICE = stripComments(
  read("src/lib/nex-native/relationship-service.ts"),
);
const SECTIONS = stripComments(
  read("src/app/nex-native/settings/_sections.ts"),
);

describe("See-My-Theme · peer-chat page gates theme resolution", () => {
  test("peer-chat page imports relationship-service", () => {
    expect(CHAT_PAGE).toMatch(
      /import\s+\*\s+as\s+relationshipService\s+from\s+["']@\/lib\/nex-native\/relationship-service["']/,
    );
  });

  test("peer-chat page calls isThemeMutuallyVisibleSafe BEFORE resolving peerThemeRow", () => {
    const gateIdx = CHAT_PAGE.indexOf(
      "relationshipService.isThemeMutuallyVisibleSafe",
    );
    const resolveIdx = CHAT_PAGE.indexOf(
      "chatThemeService.getThemeById(peer.chat_theme)",
    );
    expect(gateIdx).toBeGreaterThan(-1);
    expect(resolveIdx).toBeGreaterThan(-1);
    expect(gateIdx).toBeLessThan(resolveIdx);
  });

  test("peerThemeRow is set to null when the gate is false", () => {
    // Guards against a regression that resolves the theme row and
    // then only hides it in presentation. The row must be null so
    // every downstream dependent (emoji/sticker/intro-video)
    // cascades to the sealed NEX default.
    expect(CHAT_PAGE).toMatch(
      /canShowPeerTheme\s*&&\s*peer\.chat_theme[\s\S]{0,160}chatThemeService\.getThemeById\(peer\.chat_theme\)[\s\S]{0,80}:\s*null/,
    );
  });

  test("the gate passes session.account.id as viewer (not the peer)", () => {
    // Multi-line arg list · match across whitespace + newlines + optional
    // trailing commas. CRLF-tolerant.
    expect(CHAT_PAGE).toMatch(
      /relationshipService\.isThemeMutuallyVisibleSafe\([\s\S]*?session\.account\.id[\s\S]*?peer\.id[\s\S]*?\)/,
    );
  });
});

describe("See-My-Theme · relationship-service exposes the sealed primitives", () => {
  test("exports isThemeMutuallyVisibleSafe", () => {
    expect(RELATIONSHIP_SERVICE).toContain(
      "export async function isThemeMutuallyVisibleSafe",
    );
  });

  test("exports setThemeVisibilityPreference with grandfather-init semantics", () => {
    expect(RELATIONSHIP_SERVICE).toContain(
      "export async function setThemeVisibilityPreference",
    );
    // Grandfather-init: when existing is null, OTHER side starts TRUE.
    expect(RELATIONSHIP_SERVICE).toMatch(
      /if\s*\(\s*existing\s*\)[\s\S]{0,400}else\s*\{[\s\S]{0,200}:\s*true/,
    );
  });

  test("exports getActorToggleState with grandfather-fallback", () => {
    expect(RELATIONSHIP_SERVICE).toContain(
      "export async function getActorToggleState",
    );
    expect(RELATIONSHIP_SERVICE).toMatch(/if\s*\(!row\)\s*return\s+true/);
  });

  test("isThemeMutuallyVisibleSafe is fail-CLOSED on friend-edge lookup", () => {
    const fn = RELATIONSHIP_SERVICE.slice(
      RELATIONSHIP_SERVICE.indexOf(
        "export async function isThemeMutuallyVisibleSafe",
      ),
      RELATIONSHIP_SERVICE.indexOf(
        "export async function setThemeVisibilityPreference",
      ),
    );
    // Friend-edge error path must return false (non-friends never see).
    expect(fn).toMatch(/nex_friend_edge[\s\S]{0,600}return\s+false/);
  });

  test("legacy setThemeShare is NOT modified · still consumed by /nex-native/contacts", () => {
    // The legacy setter should still exist with its original semantics
    // (other side falls back to false via nullish-coalescing). Our new
    // setter is additive; we did not touch the legacy function.
    expect(RELATIONSHIP_SERVICE).toContain(
      "export async function setThemeShare",
    );
    expect(RELATIONSHIP_SERVICE).toMatch(
      /existing\?\.a_shares_theme\s*\?\?\s*false/,
    );
  });
});

describe("See-My-Theme · Settings IA registers the new card", () => {
  test("_sections.ts registers 'see-my-theme' with the sealed href", () => {
    expect(SECTIONS).toMatch(/key:\s*["']see-my-theme["']/);
    expect(SECTIONS).toMatch(
      /href:\s*["']\/nex-native\/settings\/see-my-theme["']/,
    );
  });
});
