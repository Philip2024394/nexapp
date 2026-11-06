// src/lib/nex-native/chat-chrome/__tests__/no-reimplementation.test.ts
//
// NEX CHAT MASTER LAYOUT · regression protection ·  sealed 2026-10-14.
//
// Owner rule (feedback_nex_chat_master_layout_rule.md): ONE master chat
// chrome. Joker chat is the architectural reference. All chat surfaces
// render through `ChatIdentityHeader` + `ChatComposerPill` primitives.
// Themes are skins; themes may NEVER redesign the header or composer.
//
// This test guards against two kinds of regression:
//
//   (A) A converged consumer file silently drops its primitive import
//       (someone "fixes" PeerComposer by rolling their own pill again).
//
//   (B) A NEW file in the repo renders chat chrome without going through
//       the primitives (someone adds a new chat surface and re-rolls the
//       composer / identity header from scratch).
//
// It does NOT yet try to converge the known-drift surfaces listed below
// — those are documented debt the owner has deferred to a later audit.
// If the drift list grows, this test fails and the author must either:
//   (a) refactor the new file to use the primitives, OR
//   (b) add the file to KNOWN_DRIFT with a one-line justification.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..", "..", "..", "..");

// ─── Converged consumer files · MUST import the primitive they consume ──

const CONVERGED_CONSUMERS: Array<{ file: string; mustImport: string[] }> = [
  {
    file: "src/app/nex-native/chat/_portrait-bloom-shell.tsx",
    mustImport: ["chat-identity-header"],
  },
  {
    file: "src/app/nex-native/chat/guest/[ownerAccountId]/_guest-chat-client.tsx",
    mustImport: ["chat-identity-header", "chat-composer-pill"],
  },
  {
    file: "src/app/nex-native/chat/peer/[accountId]/_composer.tsx",
    mustImport: ["chat-composer-pill"],
  },
  {
    file: "src/app/nex-native/chat-standard/_universal-composer-footer.tsx",
    mustImport: ["chat-composer-pill"],
  },
  // Phase 3A · 2026-10-14 · theme-page headers converged to the primitive.
  {
    file: "src/app/nex-native/chat-standard/_standard-experience.tsx",
    mustImport: ["chat-identity-header"],
  },
  {
    file: "src/app/nex-native/themes/cyber-grid/page.tsx",
    mustImport: ["chat-identity-header"],
  },
  {
    file: "src/app/nex-native/themes/theme-1/page.tsx",
    mustImport: ["chat-identity-header"],
  },
  {
    file: "src/app/nex-native/themes/pink-dream/page.tsx",
    mustImport: ["chat-identity-header"],
  },
];

// ─── Known drift · files that reimplement chat chrome today, with the
//     specific reason the owner has NOT authorised a fix in this session.
//     Shrinking this map is the goal; growing it requires justification.

const KNOWN_DRIFT: Record<string, string> = {
  "src/app/nex-native/vault/home/chats/[conversationId]/_vault-chat-client.tsx":
    "Vault chat scope-locked per founder sealed memory 2026-10-07 · requires separate authorisation to touch",
  // Legacy NexNativeChatClient entry removed 2026-11-06 together with
  // the [businessSlug] subtree deletion.
  // Phase 3A entries removed 2026-10-14 (Standard Experience +
  // cyber-grid + theme-1 + pink-dream now consume ChatIdentityHeader).
  // See CONVERGED_CONSUMERS above.
  "src/app/nex-native/chat/prototypes/portrait-bloom/page.tsx":
    "Prototype preview · mounts sealed PortraitBloomShell + PeerComposer for isolated testing",
  "src/app/nex-native/chat/prototypes/depth-cards/page.tsx":
    "Design prototype · explores depth-card bubble styling · not a shipping surface",
  "src/app/nex-native/chat/prototypes/nex-bubbles/page.tsx":
    "Design prototype · explores NEX bubble treatments · not a shipping surface",
  "src/app/nex-native/chat/prototypes/footers/page.tsx":
    "Design prototype · explores composer footer variants · not a shipping surface",
  "src/app/nex-native/chat/prototypes/haunted-hotel-effects/page.tsx":
    "Design prototype · showcases Haunted Hotel atmosphere FX · not a shipping surface",
  "src/app/nex-native/chat/prototypes/hauntedhoteltheme/page.tsx":
    "Design prototype · Haunted Hotel theme preview · pending theme-viewer convergence",
  "src/app/nex-native/chat/prototypes/direct-text/page.tsx":
    "Design prototype · explores direct-text UI treatments · not a shipping surface",
  "src/app/nex-native/dev/hotel-flow/chat/page.tsx":
    "Dev-only prototype · not a shipping surface",
};

// ─── Attribute signatures that indicate a chat composer / identity ─────
//     surface. A new file matching one of these but NOT in CONVERGED or
//     KNOWN_DRIFT is a regression.

const COMPOSER_SIGNATURES = [
  "data-nex-chat-composer-pill",   // the primitive marker
  "data-nex-peer-composer",         // PeerComposer wrapper
  "data-nex-universal-composer-footer", // UniversalComposerFooter wrapper
  "data-nex-guest-composer",        // guest chat composer wrapper
  "data-nex-vault-chat-composer",   // Vault composer (known drift)
  "data-nex-chat-compose",          // Legacy NexNativeChatClient marker
];

const IDENTITY_SIGNATURES = [
  "data-nex-chat-identity-header",  // the primitive marker
];

// Files allowed to carry these attributes · union of primitive source
// + converged consumers + documented known drift.
const PRIMITIVE_FILES = new Set([
  "src/lib/nex-native/chat-chrome/chat-identity-header.tsx",
  "src/lib/nex-native/chat-chrome/chat-composer-pill.tsx",
]);
const ALLOW_LIST = new Set<string>([
  ...PRIMITIVE_FILES,
  ...CONVERGED_CONSUMERS.map((c) => c.file),
  ...Object.keys(KNOWN_DRIFT),
]);

function readRepoFile(relPath: string): string {
  return readFileSync(join(ROOT, relPath), "utf8");
}

function grepFiles(pattern: string, scope = "src/"): string[] {
  // Use git grep · fast + respects .gitignore. Fall back to ripgrep-less
  // behaviour if git is unavailable (CI should always have git).
  try {
    const out = execSync(
      `git grep -l -F -- ${JSON.stringify(pattern)} -- ${scope}`,
      { cwd: ROOT, encoding: "utf8" },
    );
    return out
      .split("\n")
      .map((s) => s.trim().replace(/\\/g, "/"))
      .filter((s) => s.length > 0);
  } catch {
    // git grep exits 1 when there are no matches · that is not an error.
    return [];
  }
}

describe("NEX Chat master layout · no-reimplementation guard", () => {
  describe("A. Converged consumers import the primitive", () => {
    for (const { file, mustImport } of CONVERGED_CONSUMERS) {
      it(`${file} imports ${mustImport.join(" + ")}`, () => {
        const src = readRepoFile(file);
        for (const name of mustImport) {
          expect(src, `${file} must still import ${name}`).toMatch(
            new RegExp(`from\\s+["'][^"']*chat-chrome/${name}["']`),
          );
        }
      });
    }
  });

  describe("B. No new composer surface outside the allow-list", () => {
    for (const sig of COMPOSER_SIGNATURES) {
      it(`attribute "${sig}" appears only in allow-listed files`, () => {
        const matches = grepFiles(sig);
        // Filter out test files · tests reference these markers in
        // assertions, which is legitimate.
        const violations = matches.filter(
          (f) =>
            !ALLOW_LIST.has(f) &&
            !f.includes("__tests__") &&
            !f.endsWith(".test.ts") &&
            !f.endsWith(".test.tsx") &&
            !f.endsWith(".spec.ts") &&
            !f.endsWith(".spec.tsx") &&
            !f.startsWith("tests/"),
        );
        expect(
          violations,
          `New reimplementation of chat composer signature "${sig}" detected ·  ` +
            `either refactor to use ChatComposerPill from ` +
            `src/lib/nex-native/chat-chrome/chat-composer-pill.tsx ·  ` +
            `or add the file to KNOWN_DRIFT with justification. Offending files: ${violations.join(", ")}`,
        ).toEqual([]);
      });
    }
  });

  describe("C. No new identity header surface outside the allow-list", () => {
    for (const sig of IDENTITY_SIGNATURES) {
      it(`attribute "${sig}" appears only in allow-listed files`, () => {
        const matches = grepFiles(sig);
        const violations = matches.filter(
          (f) =>
            !ALLOW_LIST.has(f) &&
            !f.includes("__tests__") &&
            !f.endsWith(".test.ts") &&
            !f.endsWith(".test.tsx") &&
            !f.endsWith(".spec.ts") &&
            !f.endsWith(".spec.tsx") &&
            !f.startsWith("tests/"),
        );
        expect(
          violations,
          `New reimplementation of chat identity-header signature "${sig}" detected ·  ` +
            `either refactor to use ChatIdentityHeader from ` +
            `src/lib/nex-native/chat-chrome/chat-identity-header.tsx ·  ` +
            `or add the file to KNOWN_DRIFT with justification. Offending files: ${violations.join(", ")}`,
        ).toEqual([]);
      });
    }
  });

  describe("D. Known-drift inventory does not grow silently", () => {
    it("every KNOWN_DRIFT entry still exists on disk", () => {
      const missing: string[] = [];
      for (const file of Object.keys(KNOWN_DRIFT)) {
        try {
          readRepoFile(file);
        } catch {
          missing.push(file);
        }
      }
      expect(
        missing,
        `KNOWN_DRIFT entries reference files that no longer exist. ` +
          `Either the file was deleted (remove the entry) or the path is wrong. ` +
          `Missing: ${missing.join(", ")}`,
      ).toEqual([]);
    });

    it("each KNOWN_DRIFT entry has a non-empty justification", () => {
      const unjustified = Object.entries(KNOWN_DRIFT)
        .filter(([, reason]) => !reason || reason.trim().length < 20)
        .map(([f]) => f);
      expect(
        unjustified,
        `Every KNOWN_DRIFT entry must have a one-line justification >= 20 chars. Weak entries: ${unjustified.join(", ")}`,
      ).toEqual([]);
    });
  });
});
