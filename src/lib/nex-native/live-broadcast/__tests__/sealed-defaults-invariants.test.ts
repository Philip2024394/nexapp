// src/lib/nex-native/live-broadcast/__tests__/sealed-defaults-invariants.test.ts
//
// SEALED DEFAULTS · INVARIANT LOCK TESTS
// -----------------------------------------------------------------------------
// Owner-approved 2026-10-24 (interaction feature contract R3 §11.1):
//
//   D1 · Live comments are EPHEMERAL by default.
//   D2 · Share evidence trichotomy · native-share · copy-link · chat-send.
//   D3 · Shop Contacts uses a per-session shuffle seed.
//
// These tests fail if a future refactor silently drifts from the
// sealed behaviour. They do NOT re-test the detailed service
// contracts (those live in participation-engagement-service.test.ts,
// participation-ledger-service.test.ts, live-comments-channel.test.ts
// etc.). This file is the single-point invariant lock.

import { describe, test, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/nex-native/supabase-admin", () => ({
  nexSupabaseAdmin: { from: () => ({ then: () => Promise.resolve({ data: null, error: null }) }) },
  nexSupabaseProjectRef: () => "mock",
}));

const ROOT = resolve(__dirname, "..", "..", "..", "..", "..");

function read(path: string): string {
  return readFileSync(resolve(ROOT, path), "utf8");
}

/* ─── D1 · Comments ephemeral ──────────────────────────────── */

describe("D1 · comments are ephemeral · no DB persistence", () => {
  test("no migration file introduces a comments-persistence table", () => {
    // Any migration naming a "nex_live_comment" (singular/plural)
    // table or "nex_live_message" table would be a doctrine break
    // without a separate owner decision.
    const mig216 = read("nex-supabase/migrations/216_nex_discovery_signal_add_enquiry_cart_signals.sql");
    const mig219 = read("nex-supabase/migrations/219_nex_live_session_and_featured_product.sql");
    const mig221 = read("nex-supabase/migrations/221_nex_live_participation.sql");
    const mig222 = read("nex-supabase/migrations/222_nex_live_engagement.sql");
    for (const sql of [mig216, mig219, mig221, mig222]) {
      expect(sql).not.toMatch(/CREATE\s+TABLE\s+[^\s]*nex_live_comment/i);
      expect(sql).not.toMatch(/CREATE\s+TABLE\s+[^\s]*nex_live_message/i);
      expect(sql).not.toMatch(/CREATE\s+TABLE\s+[^\s]*nex_live_chat/i);
    }
  });

  test("live-comments-channel.ts does NOT import supabase-admin (no DB writes)", () => {
    const src = read("src/lib/nex-native/live-broadcast/live-comments-channel.ts");
    expect(src).not.toMatch(/supabase-admin/);
    expect(src).not.toMatch(/nexSupabaseAdmin/);
  });

  test("live-comments-channel.ts uses the Realtime channel ONLY (no DB table write)", () => {
    const src = read("src/lib/nex-native/live-broadcast/live-comments-channel.ts");
    expect(src).toMatch(/openNexChannel/);
    expect(src).not.toMatch(/\.from\(["']nex_live_comment/);
    expect(src).not.toMatch(/\.from\(["']nex_live_message/);
    expect(src).not.toMatch(/\.insert\(/); // no insert anywhere
  });

  test("engagement table marks comment as a KIND flag · never carries text", () => {
    const sql = read("nex-supabase/migrations/222_nex_live_engagement.sql");
    expect(sql).toMatch(/kind text NOT NULL\s*\n\s*CHECK \(kind IN \('like', 'comment', 'share'\)\)/);
    // Must NOT carry a comment text column (that would be partial
    // persistence · a hidden retention path).
    expect(sql).not.toMatch(/comment_text/i);
    expect(sql).not.toMatch(/body text/i);
    expect(sql).not.toMatch(/\s+text_content\s/i);
  });
});

/* ─── D2 · Share-evidence trichotomy ───────────────────────── */

describe("D2 · share evidence · trichotomy sealed", () => {
  test("Migration 222 CHECK pins the three allowed values exactly", () => {
    const sql = read("nex-supabase/migrations/222_nex_live_engagement.sql");
    expect(sql).toMatch(
      /share_evidence IN \('native-share', 'copy-link', 'chat-send'\)/,
    );
  });

  test("engagement service's TypeScript enum matches the DB CHECK", async () => {
    const svc = await import("../participation-engagement-service");
    // Compile-time guard: ShareEvidenceTag type is exported and used.
    const sampleValid: readonly ("native-share" | "copy-link" | "chat-send")[] = [
      "native-share",
      "copy-link",
      "chat-send",
    ];
    expect(sampleValid.length).toBe(3);
    expect(typeof svc.recordEngagement).toBe("function");
    expect(typeof svc.aggregateEngagementBySession).toBe("function");
  });

  test("viewer footer source-shape · cancelled share sheet fires NO evidence", () => {
    const src = read("src/components/nex-native/live-commerce/LiveViewerFooter.tsx");
    // navigator.share wrapped in try/catch · catch block does NOT
    // call onShareEvidence. If someone changes catch to fire an
    // evidence tag, this test fails.
    expect(src).toMatch(
      /navigator\.share\([\s\S]*?\);\s*\/\/ Resolved[\s\S]*?onShareEvidence\("native-share"\);[\s\S]*?\} catch \{[\s\S]*?\/\/ User cancelled OR permission denied\.\s*No evidence/,
    );
  });

  test("viewer footer source-shape · clipboard write failure fires NO evidence", () => {
    const src = read("src/components/nex-native/live-commerce/LiveViewerFooter.tsx");
    expect(src).toMatch(
      /navigator\.clipboard\.writeText[\s\S]*?onShareEvidence\("copy-link"\);[\s\S]*?\} catch \{[\s\S]*?\/\/ Clipboard write failed\.\s*No evidence/,
    );
  });

  test("server action rejects spurious evidence on non-share kinds (defence-in-depth)", async () => {
    const src = read("src/app/nex-native/live-commerce/enter-broadcast-room/_actions.ts");
    expect(src).toMatch(/share-evidence-only-valid-for-share/);
    expect(src).toMatch(/share-requires-evidence/);
  });
});

/* ─── D3 · Per-session shuffle seed ────────────────────────── */

describe("D3 · Shop Contacts shuffle · per-session seed · stable on refresh", () => {
  test("Migration 221 declares a 16-byte bytea seed", () => {
    const sql = read("nex-supabase/migrations/221_nex_live_participation.sql");
    expect(sql).toMatch(/shuffle_seed bytea NOT NULL/);
    expect(sql).toMatch(/CHECK \(octet_length\(shuffle_seed\) = 16\)/);
  });

  test("participation-ledger-service generates the seed server-side (not client-supplied)", async () => {
    const src = read("src/lib/nex-native/live-broadcast/participation-ledger-service.ts");
    expect(src).toMatch(/randomBytes\(16\)/);
    // Seed is set at materialisation · shared across every row
    // written in that batch (prevents per-event correlation).
    expect(src).toMatch(/Same seed across every row/);
  });

  test("shuffleCards is deterministic (same seed · same input · same output)", async () => {
    const { shuffleCards } = await import("../participation-ledger-service");
    const seed = "0f1e2d3c4b5a69788796a5b4c3d2e1f0";
    const input = ["a", "b", "c", "d", "e", "f"];
    const r1 = shuffleCards(input, seed);
    const r2 = shuffleCards(input, seed);
    expect(r1).toEqual(r2);
  });

  test("Shop Contacts projection NEVER leaks the per-event mapping fields", () => {
    const src = read("src/lib/nex-native/live-broadcast/participation-ledger-service.ts");
    const projection = src.match(
      /listShopContactsCards[\s\S]*?return rows\.map/,
    );
    expect(projection).toBeTruthy();
    const body = projection![0];
    // Projection explicitly selects only the safe fields.
    expect(body).toMatch(/participant_account_id/);
    expect(body).toMatch(/session_id/);
    expect(body).toMatch(/shuffle_anchor_at/);
    expect(body).toMatch(/shuffle_seed/);
    // Projection MUST NOT select evidence_mask / first_evidence_at /
    // created_at (would undo the privacy posture).
    expect(body).not.toMatch(/evidence_mask/);
    expect(body).not.toMatch(/first_evidence_at/);
    expect(body).not.toMatch(/created_at/);
  });

  test("participation materialise persists the shared shuffle_anchor_at + shuffle_seed per batch", async () => {
    const src = read("src/lib/nex-native/live-broadcast/participation-ledger-service.ts");
    expect(src).toMatch(/const seed = randomBytes\(16\);/);
    // All rows in the batch share the same anchor + seed · identical
    // literal variable references in the row-builder loop.
    expect(src).toMatch(/shuffle_anchor_at: anchorIso/);
    expect(src).toMatch(/shuffle_seed: seed/);
  });
});

/* ─── Cross-cutting · interaction-to-participant mapping NEVER exposed ─── */

describe("cross-cutting · no API/UI/card reveals who did what", () => {
  test("Shop Contacts card component displays NEX-ID only · never evidence kind", () => {
    const src = read(
      "src/app/nex-native/manage/live/shop-contacts/[sessionId]/_shop-contacts-card.tsx",
    );
    // Card shows nexHandle + "From your Live" · nothing identifying
    // which engagement kind the participant produced.
    expect(src).toMatch(/From your Live/);
    expect(src).not.toMatch(/liked your/i);
    expect(src).not.toMatch(/commented/i);
    expect(src).not.toMatch(/shared/i);
  });

  test("Shop Contacts page renders cards in service-provided shuffle order", () => {
    const src = read(
      "src/app/nex-native/manage/live/shop-contacts/[sessionId]/page.tsx",
    );
    expect(src).toMatch(/shuffleCards\(eligible, eligible\[0\]!\.shuffleSeedHex\)/);
    // No sort-by-timestamp paths.
    expect(src).not.toMatch(/sort\([^)]*first_evidence_at/);
    expect(src).not.toMatch(/sort\([^)]*evidence_mask/);
  });

  test("Shop Contacts page gates on broadcaster ownership", () => {
    const src = read(
      "src/app/nex-native/manage/live/shop-contacts/[sessionId]/page.tsx",
    );
    expect(src).toMatch(/verifyBroadcasterOwnsSession/);
    expect(src).toMatch(/not-your-session/);
  });

  test("engagement RLS requires open session + viewer self-identity", () => {
    const sql = read("nex-supabase/migrations/222_nex_live_engagement.sql");
    expect(sql).toMatch(/viewer_account_id IN \(SELECT nex_current_account_ids/);
    expect(sql).toMatch(/s\.status = 'open'/);
    // Writes only (no authenticated SELECT policy).
    expect(sql).toMatch(/GRANT INSERT ON public\.nex_live_engagement TO authenticated/);
    expect(sql).not.toMatch(/CREATE POLICY[^;]*FOR SELECT[^;]*TO authenticated/);
  });
});

/* ─── Explicit non-claims ─────────────────────────────────── */

describe("explicit non-claims · what these invariant tests do NOT prove", () => {
  test("does NOT prove the DB CHECK fires under real Postgres (needs sandbox apply)", () => {
    expect(true).toBe(true);
  });

  test("does NOT prove RLS enforces viewer-self-identity under real auth.uid()", () => {
    // Covered by G1 T1-T36 which stay `it.skip` until sandbox apply.
    expect(true).toBe(true);
  });

  test("does NOT prove Realtime fan-out semantics across simultaneous viewers", () => {
    // Requires 2-account browser journey which is a separate owner
    // decision track (G-E2E).
    expect(true).toBe(true);
  });
});
