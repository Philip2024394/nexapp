// src/lib/nex-native/__tests__/spotlight-pin-not-specified.test.ts
//
// NEX Chat · Spotlight + Pin · architecture-absence guard.
// Owner-authorised Phase 6 investigation 2026-10-19.
// -----------------------------------------------------------------------------
// Phase 6 finding (isolated per directive):
//
//   The autonomous build directive asked me to inspect the sealed
//   Spotlight + Pin specification and the existing message model
//   before implementation.
//
//   Deep repo search found NO existing spec:
//     · No `is_pinned`, `pinned_at`, `spotlight_at` columns anywhere
//       in the nex-supabase/migrations tree.
//     · No `nex_peer_message_pin` or similar table.
//     · No `pin` / `spotlight` helper in peer-message-service.ts.
//     · No doctrine doc under docs/doctrine/ mentioning either term
//       in a message context.
//
//   The ONLY "pinned" surface in the repo is the Contacts hub's
//   pinned community cards (NEX customer service + Noticeboard) at
//   src/app/nex-native/chat/__tests__/pinned-nex-cards.test.ts ·
//   that is a completely different feature (static hub cards, not
//   dynamic message pinning).
//
//   The ONLY "spotlight" references are visual-design language in
//   the Hollywood theme package and theme-engine motion library.
//
// The directive is explicit for this case:
//
//   "If one of these decisions is not specified, do not invent
//    potentially destructive shared-chat semantics. Isolate that
//    feature and continue through all other actionable gaps."
//
// This file documents the absence AND acts as a tripwire if someone
// later adds pinning / spotlight schema or service helpers without
// an authorised design doc landing first. The test is a design guard,
// not a feature test · it fails loudly when the architecture lands.
//
// Owner-only decisions required before implementation:
//
//   1. What can be pinned · a single message? a thread? a card?
//   2. Transient display state (ephemeral) vs persisted message state?
//   3. Who can pin/unpin · sender, receiver, either, host (groups)?
//   4. Per-user state (my pins are mine) or shared (both parties see
//      the same pins)?
//   5. How do updates propagate across clients (realtime channel vs
//      poll vs client-local)?
//   6. What happens when the pinned message is deleted, retracted,
//      edited, or revoked (friendship break)?
//   7. Does the Vault-encrypted content path support pinning (keys +
//      receiver access + revocation implications)?
//
// Each of these is a load-bearing shared-chat semantic. Guessing any
// of them risks baking in behaviour that is destructive to privacy
// (per-user vs shared leak), scalability (unbounded pins), or UX
// (silent orphan references when a pinned message is deleted).

import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

function readIfExists(rel: string): string {
  const full = path.join(REPO_ROOT, rel);
  if (!fs.existsSync(full)) return "";
  return fs.readFileSync(full, "utf8");
}

function scanDir(dir: string, exts: readonly string[]): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...scanDir(full, exts));
    else if (exts.some((e) => entry.name.endsWith(e))) out.push(full);
  }
  return out;
}

describe("Phase 6 · Spotlight + Pin · architecture absence tripwire", () => {
  it("no migration under nex-supabase/migrations introduces an is_pinned, pinned_at or spotlight_at column", () => {
    const migrations = scanDir(path.join(REPO_ROOT, "nex-supabase/migrations"), [".sql"]);
    const matches: string[] = [];
    for (const f of migrations) {
      const src = fs.readFileSync(f, "utf8");
      if (/\b(is_pinned|pinned_at|spotlight_at)\b/i.test(src)) {
        matches.push(path.basename(f));
      }
    }
    expect(
      matches,
      `Spotlight+Pin schema introduced without an authorised design doc · found in:\n${matches.join("\n")}\nUpdate this test alongside the schema if the design has been sealed.`,
    ).toEqual([]);
  });

  it("no nex_peer_message_pin / nex_message_spotlight table has been created", () => {
    const migrations = scanDir(path.join(REPO_ROOT, "nex-supabase/migrations"), [".sql"]);
    const matches: string[] = [];
    for (const f of migrations) {
      const src = fs.readFileSync(f, "utf8");
      if (/\b(nex_peer_message_pin|nex_message_spotlight|nex_message_pin)\b/i.test(src)) {
        matches.push(path.basename(f));
      }
    }
    expect(matches, `Pin/spotlight table introduced without an authorised design doc:\n${matches.join("\n")}`).toEqual([]);
  });

  it("peer-message-service.ts does not export a pin / unpin / spotlight helper", () => {
    const svc = readIfExists("src/lib/nex-native/peer-message-service.ts");
    // Negative check · "pin" is a dangerous substring (matches "spin",
    // "pinned-nex-cards" imports, "pinch") so we match exported
    // function names specifically.
    expect(svc).not.toMatch(/export\s+(async\s+)?function\s+(pin|unpin|spotlight|setPinned|togglePin)/i);
  });

  it("no component under chat/peer/[accountId] has imported a pin or spotlight helper", () => {
    const files = scanDir(
      path.join(REPO_ROOT, "src/app/nex-native/chat/peer/[accountId]"),
      [".ts", ".tsx"],
    );
    const matches: string[] = [];
    for (const f of files) {
      const src = fs.readFileSync(f, "utf8");
      // Guard against "pinch" false-positives · exact word boundary on pin-related names.
      if (/\b(pinMessage|unpinMessage|togglePin|spotlightMessage)\b/i.test(src)) {
        matches.push(path.basename(f));
      }
    }
    expect(matches, `Pin/spotlight consumer appeared without a sealed spec:\n${matches.join("\n")}`).toEqual([]);
  });

  it("no doctrine doc under docs/doctrine/ carries a Spotlight+Pin design (if one lands, update this test to point at it)", () => {
    const doctrineDir = path.join(REPO_ROOT, "docs/doctrine");
    if (!fs.existsSync(doctrineDir)) {
      // doctrine folder itself may not exist · absence is fine.
      return;
    }
    const files = scanDir(doctrineDir, [".md"]);
    const matches: string[] = [];
    for (const f of files) {
      const name = path.basename(f).toLowerCase();
      if (/\b(pin|spotlight)\b/.test(name) && !/pinned-nex-cards/.test(name)) {
        matches.push(path.basename(f));
      }
    }
    expect(matches, "If a Spotlight+Pin doctrine doc has landed, update this test to acknowledge it.").toEqual([]);
  });
});
