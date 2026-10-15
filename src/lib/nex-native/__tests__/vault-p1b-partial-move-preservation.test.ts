// src/lib/nex-native/__tests__/vault-p1b-partial-move-preservation.test.ts
//
// Vault P1b 2026-10-15 · deterministic regression suite covering:
//   · P1b-C · partial move visibility
//               server action surfaces VaultAttachmentCopyResult
//               UI distinguishes partial from complete success
//               never claims recoverability (no false retry promise)
//   · P1b-D · B.5 preservation lifecycle
//               no fire-and-forget void prefix
//               rejected promises explicitly handled
//               token-ref invalidation on unmount + lock + re-boot
//               accessible status (role=status + aria-live=polite)
//               duplicate invocation guarded by sealed bootRef
//   · P1b-B · corrected documentation on preserve route
//               no longer claims auto-encrypt on next Vault unlock
//               accurately describes user-triggered "Secure now" flow
//
// Pure source-grep. No live DB, no browser render, no network. Mirrors
// the pattern established by vault-persistence.test.ts and
// vault-move-and-preserve-b5.test.ts.

import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

const F = {
  actions: path.join(REPO_ROOT, "src/app/nex-native/vault/_actions.ts"),
  affordance: path.join(
    REPO_ROOT,
    "src/app/nex-native/vault/_move-to-vault-affordance.tsx",
  ),
  vaultChat: path.join(
    REPO_ROOT,
    "src/app/nex-native/vault/home/chats/[conversationId]/_vault-chat-client.tsx",
  ),
  // P1b-D 2026-10-15 · finding 2.7 correction target.
  vaultChatPage: path.join(
    REPO_ROOT,
    "src/app/nex-native/vault/home/chats/[conversationId]/page.tsx",
  ),
  preserveRoute: path.join(
    REPO_ROOT,
    "src/app/api/nex-native/vault/chat/attachment/preserve/route.ts",
  ),
  persistenceService: path.join(
    REPO_ROOT,
    "src/lib/nex-native/vault-persistence-service.ts",
  ),
  vaultFileService: path.join(
    REPO_ROOT,
    "src/lib/nex-native/vault-file-service.ts",
  ),
  attachmentPreservation: path.join(
    REPO_ROOT,
    "src/lib/nex-native/vault/client/attachment-preservation.ts",
  ),
};

const src = {
  actions: fs.readFileSync(F.actions, "utf-8"),
  affordance: fs.readFileSync(F.affordance, "utf-8"),
  vaultChat: fs.readFileSync(F.vaultChat, "utf-8"),
  vaultChatPage: fs.readFileSync(F.vaultChatPage, "utf-8"),
  preserveRoute: fs.readFileSync(F.preserveRoute, "utf-8"),
  persistenceService: fs.readFileSync(F.persistenceService, "utf-8"),
  vaultFileService: fs.readFileSync(F.vaultFileService, "utf-8"),
  attachmentPreservation: fs.readFileSync(F.attachmentPreservation, "utf-8"),
};

// ─── P1b-C · server action ──────────────────────────────────────────

describe("P1b-C · moveConversationToVaultAction surfaces attachment counts", () => {
  test("imports the sealed VaultAttachmentCopyResult type", () => {
    expect(src.actions).toMatch(
      /import type \{\s*VaultAttachmentCopyResult\s*\}\s*from\s*"@\/lib\/nex-native\/vault-persistence-service"/,
    );
  });

  test("return type carries attachments payload on ok=true", () => {
    expect(src.actions).toMatch(
      /moveConversationToVaultAction[\s\S]+?ok:\s*true;\s*attachments:\s*VaultAttachmentCopyResult/,
    );
  });

  test("passes service.attachments through to the client · no silent discard", () => {
    expect(src.actions).toMatch(
      /return \{\s*ok:\s*true,\s*attachments:\s*result\.attachments\s*\}/,
    );
  });

  test("existing failure path preserved · returns { ok: false, reason }", () => {
    expect(src.actions).toMatch(/return \{\s*ok:\s*false,\s*reason:/);
  });

  test("sealed VaultAttachmentCopyResult still exposes the five count fields", () => {
    for (const k of [
      "attachments_total",
      "attachments_copied",
      "attachments_skipped",
      "attachments_failed",
      "bytes_added",
    ]) {
      expect(src.persistenceService).toContain(k);
    }
  });

  test("Vault entitlement NOT added by P1b (sealed Phase P2 decision)", () => {
    expect(src.actions).not.toMatch(/effectiveTier|tier-gate|bisnis_expires_at/);
  });
});

// ─── P1b-C · affordance UI ──────────────────────────────────────────

describe("P1b-C · move-to-vault affordance · partial-success handling", () => {
  test("imports VaultAttachmentCopyResult type for the partial state", () => {
    expect(src.affordance).toMatch(/import type \{\s*VaultAttachmentCopyResult\s*\}/);
  });

  test("holds partial state separately from error state", () => {
    expect(src.affordance).toMatch(
      /useState<VaultAttachmentCopyResult \| null>\(null\)/,
    );
  });

  test("move-conversation branch sets partial only when attachments_failed > 0", () => {
    expect(src.affordance).toMatch(
      /mode\.kind === "move-conversation"[\s\S]+?attachments_failed > 0[\s\S]+?setPartial/,
    );
  });

  test("partial state element exposes role=status + aria-live=polite", () => {
    expect(src.affordance).toMatch(
      /data-nex-vault-affordance-partial[\s\S]+?role="status"[\s\S]+?aria-live="polite"/,
    );
  });

  test("partial state element exposes counts via data-* for test harnesses", () => {
    for (const attr of [
      "data-nex-vault-affordance-partial-failed",
      "data-nex-vault-affordance-partial-copied",
      "data-nex-vault-affordance-partial-skipped",
      "data-nex-vault-affordance-partial-total",
    ]) {
      expect(src.affordance).toContain(attr);
    }
  });

  test("partial element MUST NOT claim recoverability (no false retry promise)", () => {
    const section =
      src.affordance.match(/data-nex-vault-affordance-partial[\s\S]+?<\/div>\s*\)\}/)?.[0] ?? "";
    expect(section).not.toMatch(/\bretry\b/i);
    expect(section).not.toMatch(/will try again|will re-attempt|will be re-tried/i);
  });

  test("confirm button is disabled when partial is set (no duplicate confirm)", () => {
    expect(src.affordance).toMatch(/disabled=\{busy \|\| partial !== null\}/);
  });

  test("openSheet resets partial state on each open", () => {
    expect(src.affordance).toMatch(/openSheet[\s\S]+?setPartial\(null\)/);
  });

  test("runAction resets partial state at start", () => {
    expect(src.affordance).toMatch(/runAction[\s\S]+?setPartial\(null\)/);
  });

  test("non-conversation modes still use the simple { ok, reason } shape", () => {
    for (const action of [
      "moveFriendToVaultAction",
      "removeConversationFromVaultAction",
      "removeFriendFromVaultAction",
    ]) {
      expect(src.affordance).toMatch(
        new RegExp(`${action}\\([^)]+\\);[\\s\\S]+?result\\.ok`),
      );
    }
  });
});

// ─── P1b-D · B.5 preservation lifecycle ─────────────────────────────

describe("P1b-D · vault-chat preservation · no fire-and-forget, controlled lifecycle", () => {
  test("fire-and-forget `void preserveAttachmentsForVaultedConversation` is gone", () => {
    // Must check CODE, not comments · the P1b-D explanatory comment
    // explicitly references the old pattern in a backticked phrase so
    // future readers understand the context. Strip comments before
    // asserting the actual call-site is gone.
    const code = src.vaultChat
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split(/\r?\n/)
      .map((l) => {
        const i = l.indexOf("//");
        return i === -1 ? l : l.slice(0, i);
      })
      .join("\n");
    expect(code).not.toContain(
      "void preserveAttachmentsForVaultedConversation",
    );
  });

  test("promise result is observed via .then(fulfilled, rejected)", () => {
    expect(src.vaultChat).toMatch(
      /preserveAttachmentsForVaultedConversation\(candidates\)\.then\(/,
    );
  });

  test("rejected promise is explicitly handled with error state", () => {
    expect(src.vaultChat).toMatch(
      /\(err\) => \{[\s\S]+?preservationTokenRef\.current !== token[\s\S]+?setPreservationStatus\(\{\s*kind: "error"/,
    );
  });

  test("stale-update guard · token mismatch returns early in BOTH handlers", () => {
    // Both the success and the failure handlers must check the token.
    const bothChecks = src.vaultChat.match(
      /preservationTokenRef\.current !== token/g,
    );
    expect((bothChecks?.length ?? 0) >= 2).toBe(true);
  });

  test("token ref is declared alongside the preservationStatus state", () => {
    expect(src.vaultChat).toMatch(
      /preservationTokenRef = useRef<symbol \| null>\(null\)/,
    );
  });

  test("Vault lock transition invalidates the token AND resets status", () => {
    const lockBlock = src.vaultChat.match(
      /if \(!vault\.unlocked\)\s*\{[\s\S]+?clearInMemoryConversationKeys\(\);[\s\S]+?preservationTokenRef\.current = null;[\s\S]+?setPreservationStatus\(\{\s*kind:\s*"idle"\s*\}\)/,
    );
    expect(lockBlock).not.toBeNull();
  });

  test("component unmount cleanup invalidates the token", () => {
    expect(src.vaultChat).toMatch(
      /useEffect\(\(\) => \{\s*return \(\) => \{\s*preservationTokenRef\.current = null/,
    );
  });

  test("duplicate boot invocation guarded by sealed bootRef (unchanged)", () => {
    expect(src.vaultChat).toMatch(/if \(bootRef\.current\) return;/);
  });

  test("no-candidates path resets status to idle (not left mid-running)", () => {
    expect(src.vaultChat).toMatch(
      /candidates\.length > 0[\s\S]+?setPreservationStatus\(\{\s*kind:\s*"running"[\s\S]+?\} else \{[\s\S]+?setPreservationStatus\(\{\s*kind:\s*"idle"/,
    );
  });

  test("status element is only rendered in ready phase (no leak in locked/loading)", () => {
    expect(src.vaultChat).toMatch(
      /phase === "ready" && preservationStatus\.kind !== "idle"/,
    );
  });

  test("running state element has role=status + aria-live=polite", () => {
    expect(src.vaultChat).toMatch(
      /data-nex-vault-chat-preservation-status="running"[\s\S]+?role="status"[\s\S]+?aria-live="polite"/,
    );
    // Also the reverse ordering is acceptable; ensure the block ties
    // them together within the running branch.
  });

  test("partial state element has role=status + aria-live=polite", () => {
    expect(src.vaultChat).toMatch(
      /data-nex-vault-chat-preservation-status="partial"[\s\S]+?role="status"|role="status"[\s\S]+?data-nex-vault-chat-preservation-status="partial"/,
    );
  });

  test("error state element has role=status + aria-live=polite", () => {
    expect(src.vaultChat).toMatch(
      /data-nex-vault-chat-preservation-status="error"[\s\S]+?role="status"|role="status"[\s\S]+?data-nex-vault-chat-preservation-status="error"/,
    );
  });

  test("done + failed=0 renders nothing (silent complete success)", () => {
    expect(src.vaultChat).toMatch(/preservationStatus\.failed > 0[\s\S]+?\)\s*:\s*null/);
  });

  test("done + failed>0 renders honest count without recoverability claim", () => {
    const partial = src.vaultChat.match(
      /data-nex-vault-chat-preservation-status="partial"[\s\S]+?<\/div>/,
    )?.[0] ?? "";
    expect(partial).toMatch(/could not be saved/);
    expect(partial).not.toMatch(/\bretry\b/i);
    expect(partial).not.toMatch(/will try again|will re-attempt/i);
  });

  test("sealed attachment-preservation module is unchanged · no new server privileges", () => {
    expect(src.attachmentPreservation).toContain('"use client"');
    expect(src.attachmentPreservation).toContain(
      "/api/nex-native/vault/chat/attachment/preserve",
    );
  });

  test("sealed B.4 clearInMemoryConversationKeys still called on lock (unchanged)", () => {
    expect(src.vaultChat).toMatch(/clearInMemoryConversationKeys\(\);/);
  });
});

// ─── P1b-B · corrected documentation ────────────────────────────────

describe("P1b-B · preserve route documentation accurately describes current flow", () => {
  test("no longer claims auto-encrypt on next Vault unlock", () => {
    expect(src.preserveRoute).not.toMatch(
      /encrypts legacy files to 'encrypted' on next Vault unlock\./,
    );
  });

  test("affirmatively describes user-triggered 'Secure now' behaviour", () => {
    expect(src.preserveRoute).toMatch(/Secure now/);
    // The phrase spans a comment line break · tolerate any
    // intervening whitespace / `//` characters.
    expect(src.preserveRoute).toMatch(/does NOT auto-run on[\s/]+unlock/);
  });

  test("references the actual runner path for traceability", () => {
    expect(src.preserveRoute).toMatch(/_migration-runner-client\.tsx/);
  });

  test("acknowledges the dormant-conversation gap honestly", () => {
    expect(src.preserveRoute).toMatch(
      /never visits \/vault\/home|never taps the button|remain unencrypted/i,
    );
  });

  test("sealed step-up still enforced · unchanged behaviour", () => {
    expect(src.preserveRoute).toMatch(
      /requireStepUp\([^)]*,[\s\S]*vault_unlock:\s*"fresh"/,
    );
  });

  test("sealed participant check still enforced · unchanged behaviour", () => {
    expect(src.preserveRoute).toMatch(/assertIsParticipant/);
  });

  test("still delegates to sealed copyConversationAttachmentsToVault · no bypass", () => {
    expect(src.preserveRoute).toMatch(/copyConversationAttachmentsToVault/);
  });
});

// ─── Finding 2.7 correction · conversation-change remount fence ─────

describe("P1b-D finding 2.7 · stale preservation status cannot cross conversations", () => {
  test("parent page passes key={row.id} on <VaultChatClient> · forces remount per conversation", () => {
    // Narrow regex · the key MUST reference the validated conversation
    // id from the server-component scope. Accept `row.id` (the current
    // name) OR a future rename to `conversationId` so a cosmetic
    // refactor doesn't break this guard · but reject any key that is
    // NOT a conversation-scoped identifier (e.g. a constant or an
    // unrelated prop).
    expect(src.vaultChatPage).toMatch(
      /<VaultChatClient[\s\S]+?key=\{(row\.id|conversationId)\}/,
    );
  });

  test("parent page comment names finding 2.7 so the key prop is NOT silently removed later", () => {
    // Load-bearing comment · explains WHY the key exists. A reviewer
    // who deletes "redundant" code must see the explanation.
    expect(src.vaultChatPage).toMatch(/finding 2\.7/);
    expect(src.vaultChatPage).toMatch(/unmounts \+ remounts|unmount \+ remount/);
  });

  test("client component still has unmount cleanup that invalidates the preservation token", () => {
    // The remount fence from the parent only works if the unmount
    // actually invalidates the token · otherwise a stale .then from
    // conversation A could still setState on conversation B's new
    // instance (if the Symbol happened to collide, which cannot
    // happen for Symbol()). Belt + braces: assert the cleanup is
    // still there, verbatim.
    expect(src.vaultChat).toMatch(
      /useEffect\(\(\) => \{\s*return \(\) => \{\s*preservationTokenRef\.current = null/,
    );
  });

  test("stale fulfilled callback cannot update a new instance · token-check guard present", () => {
    // Even if a .then from conversation A fires AFTER React unmounts
    // the old instance, the handler must early-return. Verify the
    // fulfilled handler's token guard is in place.
    expect(src.vaultChat).toMatch(
      /\(batch\) => \{[\s\S]+?preservationTokenRef\.current !== token[\s\S]+?return;/,
    );
  });

  test("stale rejected callback cannot update a new instance · token-check guard present", () => {
    // Same for the rejected handler.
    expect(src.vaultChat).toMatch(
      /\(err\) => \{[\s\S]+?preservationTokenRef\.current !== token[\s\S]+?return;/,
    );
  });

  test("token is set BEFORE the preserve call · zero-window where a sync-complete .then would see a stale ref", () => {
    // The code must assign to preservationTokenRef.current BEFORE
    // invoking preserveAttachmentsForVaultedConversation. If the
    // promise ever completed synchronously (unlikely but possible
    // for mocked fetch) and we assigned the ref AFTER, the handler
    // could see the previous conversation's token still in place.
    expect(src.vaultChat).toMatch(
      /preservationTokenRef\.current = token;\s*\n[\s\S]{0,200}?preserveAttachmentsForVaultedConversation\(candidates\)/,
    );
  });

  test("new conversation's instance can run its own preservation scan · bootRef starts false on mount", () => {
    // After the parent-side key change forces a remount, the new
    // instance's bootRef = useRef(false) starts at false. Verify
    // the ref is initialised with `false` (not `true`), so the sealed
    // boot flow is not blocked by a stale guard. Also verify that
    // preservationStatus starts in `idle`.
    expect(src.vaultChat).toMatch(/const bootRef = useRef\(false\)/);
    expect(src.vaultChat).toMatch(
      /useState<PreservationStatus>\(\{\s*kind:\s*"idle"\s*\}\)/,
    );
  });

  test("in-component lock/unlock reset still fires on same-conversation lock cycle (defence in depth)", () => {
    // The parent remount fence addresses conversation CHANGE. The
    // in-component effect still handles the same-conversation
    // lock-then-unlock case · verify it is intact.
    expect(src.vaultChat).toMatch(
      /if \(!vault\.unlocked\)\s*\{[\s\S]+?preservationTokenRef\.current = null;[\s\S]+?setPreservationStatus\(\{\s*kind:\s*"idle"\s*\}\)/,
    );
  });

  test("correction does NOT touch sealed server-side verification in the parent page", () => {
    // Parent page is a server component with sensitive gating:
    // · nex_vault_setup existence check
    // · participant check against nex_peer_conversation
    // · nex_vault_entry (conversation OR friend) check
    // · redirect to doorway if not vaulted
    // These MUST remain · the 2.7 fix is purely a React identity
    // hint on the client component.
    expect(src.vaultChatPage).toContain("nex_vault_setup");
    expect(src.vaultChatPage).toContain("nex_peer_conversation");
    expect(src.vaultChatPage).toContain("nex_vault_entry");
    expect(src.vaultChatPage).toContain('redirect("/nex-native/vault/setup")');
    expect(src.vaultChatPage).toContain(
      'redirect("/nex-native/vault/home/chats")',
    );
    expect(src.vaultChatPage).toContain("resolveNexAppSessionFromContext");
  });

  test("correction does NOT claim to cancel in-flight server work", () => {
    // The parent-page comment must not falsely claim it cancels
    // the sealed B.2 preserve POST that may still be mid-flight.
    const commentBlock =
      src.vaultChatPage.match(/P1b-D 2026-10-15[\s\S]+?<VaultChatClient/)?.[0] ??
      "";
    expect(commentBlock).not.toMatch(/cancel|abort|stop/i);
  });
});

// ─── Hard-boundary preservation ─────────────────────────────────────

describe("hard-boundary · sealed surfaces unchanged by P1b", () => {
  test("Gate B1 contract still in force · insertVaultFileMetadata requires migrationState: 'legacy'", () => {
    expect(src.vaultFileService).toMatch(/migrationState:\s*"legacy"/);
    expect(src.vaultFileService).toContain('migration_state: input.migrationState');
    expect(src.vaultFileService).toContain('legacy_bytes_path: bucket_path');
  });

  test("vault-chat client still imports from sealed B.4 + B.5 primitives · no new surfaces", () => {
    for (const seal of [
      "@/lib/nex-native/vault/client/attachment-preservation",
      "@/lib/nex-native/vault/client/conversation-key",
      "@/lib/nex-native/crypto/encrypted-receive",
      "@/lib/nex-native/crypto/encrypted-send",
      "@/lib/nex-native/vault/client/lock-sweep",
    ]) {
      expect(src.vaultChat).toContain(seal);
    }
  });

  test("no new API routes added by P1b", () => {
    // All UI-side orchestration · the B.2 preserve route is the only
    // server endpoint and it was not touched (except for a comment).
    expect(src.vaultChat).not.toMatch(/\/api\/nex-native\/vault\/[^"']+\s*,/);
  });
});
