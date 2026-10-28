// nex-supabase/migrations/__tests__/g1-rls-harden-217-218.test.ts
//
// G1 · B99+rls-harden · test matrix for Migrations 217 + 218.
// -----------------------------------------------------------------------------
// Owner-authorised design review 2026-10-24.
//
// EVIDENCE BOUNDARY (owner directive · do not overstate)
// -----------------------------------------------------------------------------
// This file is split into TWO cleanly-labelled categories:
//
//   1 · SOURCE-SHAPE tests
//       Read the two SQL migration files as text. Assert the sealed
//       content shape: policy names, role qualifiers, helper calls,
//       trigger coordination, rollback presence, status disclaimer.
//       These are source-structure contracts · they do NOT prove the
//       migrations behave correctly against Postgres.
//
//   2 · REAL-DATABASE tests (T1–T36 · it.skip until sandbox exists)
//       Full identity-isolation matrix. Each test documents its
//       identity, fixture, operation, expected result, and the
//       security invariant it verifies. All marked `it.skip` because
//       no dedicated non-production Supabase sandbox has been
//       identified (D6 unresolved per the saved plan).
//
// To RUN the T1–T36 matrix:
//   1 · Identify / provision a dedicated non-production Supabase
//       project (D6).
//   2 · Apply Migrations 001 → 216 → 217 → 218 to that project.
//   3 · Set NEX_RLS_TEST_SUPABASE_URL + NEX_RLS_TEST_SERVICE_ROLE_KEY
//       env vars pointing at that project.
//   4 · Convert `it.skip` → `it` in this file (or set env
//       NEX_RLS_TEST_ENABLED=1 and swap the gate below).
//   5 · Run `vitest run nex-supabase/migrations/__tests__/`.
//
// NEVER run T1–T36 against the sealed production project
// `ijvqdvsvwtwxzcqmoqit`. The matrix creates test accounts and may
// pollute the authoritative dataset.
//
// Risk register anchors
//   R1  · nex_peer_message RLS identity-mismatch · closed by 218 Part A/B
//   R2  · nex_live_post missing policies         · closed by 218 Part C
//   R11 · peer-message column immutability       · closed by 218 Part D
//   R12 · trigger coordination with Migration 125 · documented in 218 Part D

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const M217 = readFileSync(
  resolve(__dirname, "..", "217_nex_rls_helper_search_path_harden.sql"),
  "utf8",
);
const M218 = readFileSync(
  resolve(
    __dirname,
    "..",
    "218_nex_rls_harden_peer_message_and_live_post.sql",
  ),
  "utf8",
);

/* ─── 1 · Source-shape tests · Migration 217 ─────────────────── */

describe("Migration 217 · source-shape", () => {
  it("declares the file as NOT YET APPLIED", () => {
    expect(M217).toMatch(/NOT YET APPLIED/);
  });

  it("is explicit as a prerequisite to Migration 218", () => {
    expect(M217).toMatch(/prerequisite to Migration 218/i);
  });

  it("pins search_path on all four Migration 010 helpers", () => {
    for (const fn of [
      "nex_current_account_ids",
      "nex_current_owned_business_ids",
      "nex_current_participant_conversation_ids",
      "nex_conversations_of_my_businesses",
    ]) {
      expect(M217).toMatch(
        new RegExp(
          `ALTER FUNCTION ${fn}\\(\\)\\s+SET search_path = pg_catalog, public`,
        ),
      );
    }
  });

  it("does NOT alter function body or ownership", () => {
    expect(M217).not.toMatch(/CREATE OR REPLACE FUNCTION/);
    expect(M217).not.toMatch(/ALTER FUNCTION.*OWNER TO/);
  });

  it("has a rollback block (RESET search_path on all four helpers)", () => {
    expect(M217).toMatch(/Rollback/);
    expect(M217).toMatch(/RESET search_path/);
    expect(M217.match(/RESET search_path/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it("inserts a ledger row with version '217'", () => {
    expect(M217).toMatch(/INSERT INTO nex_migration_history[\s\S]*?'217'/);
  });

  it("is wrapped in a single BEGIN/COMMIT block", () => {
    const lines = M217.split(/\r?\n/).map((l) => l.trim());
    expect(lines.filter((l) => l === "BEGIN;").length).toBe(1);
    expect(lines.filter((l) => l === "COMMIT;").length).toBe(1);
  });
});

/* ─── 1 · Source-shape tests · Migration 218 ─────────────────── */

describe("Migration 218 · source-shape · policies", () => {
  it("declares NOT YET APPLIED + production project constraint", () => {
    expect(M218).toMatch(/NOT YET APPLIED/);
    expect(M218).toMatch(/ijvqdvsvwtwxzcqmoqit/);
  });

  it("declares apply order 216 → 217 → 218", () => {
    expect(M218).toMatch(/APPLY ORDER: 216 → 217 → 218/);
  });

  it("rewrites 6 Migration 047 policies with TO authenticated", () => {
    for (const policy of [
      "nex_peer_conversation_select",
      "nex_peer_conversation_insert",
      "nex_peer_conversation_update",
      "nex_peer_message_select",
      "nex_peer_message_insert",
      "nex_peer_message_update_read",
    ]) {
      expect(M218).toMatch(
        new RegExp(`DROP POLICY IF EXISTS ${policy} ON nex_peer_`),
      );
      // Each new CREATE POLICY is TO authenticated.
      const createBlock = M218.match(
        new RegExp(`CREATE POLICY ${policy}[\\s\\S]*?;`),
      );
      expect(createBlock).toBeTruthy();
      expect(createBlock![0]).toMatch(/TO authenticated/);
    }
  });

  it("uses Migration 010 helpers (not raw auth.uid()) for policy identity", () => {
    // Rewritten policies must not reference bare `auth.uid()` any more.
    // The helpers wrap it inside SECURITY DEFINER functions.
    // Anchor on the actual DDL (not the doc headers) so the span
    // includes the policy SQL body.
    const rewrittenSection = M218.match(
      /DROP POLICY IF EXISTS nex_peer_conversation_select[\s\S]*?CREATE POLICY nex_live_post_public_select/,
    );
    expect(rewrittenSection).toBeTruthy();
    expect(rewrittenSection![0]).toMatch(/nex_current_account_ids\(\)/);
    // Bare `= auth.uid()` must not reappear in the rewritten policies.
    expect(rewrittenSection![0]).not.toMatch(/= auth\.uid\(\)/);
  });

  it("creates 3 new nex_live_post policies · public SELECT · owner INSERT · owner UPDATE", () => {
    expect(M218).toMatch(/CREATE POLICY nex_live_post_public_select[\s\S]*?FOR SELECT/);
    expect(M218).toMatch(/CREATE POLICY nex_live_post_owner_insert[\s\S]*?FOR INSERT/);
    expect(M218).toMatch(/CREATE POLICY nex_live_post_owner_update[\s\S]*?FOR UPDATE/);
  });

  it("public SELECT on live_post filters by expiry only · NO role restriction", () => {
    const publicSelect = M218.match(
      /CREATE POLICY nex_live_post_public_select[\s\S]*?;/,
    );
    expect(publicSelect).toBeTruthy();
    expect(publicSelect![0]).toMatch(/expires_at IS NULL OR expires_at > now\(\)/);
    // No TO authenticated · default PUBLIC covers anon + authenticated.
    expect(publicSelect![0]).not.toMatch(/TO authenticated/);
  });

  it("owner INSERT/UPDATE on live_post uses nex_current_owned_business_ids helper", () => {
    expect(M218).toMatch(
      /CREATE POLICY nex_live_post_owner_insert[\s\S]*?nex_current_owned_business_ids\(\)/,
    );
    expect(M218).toMatch(
      /CREATE POLICY nex_live_post_owner_update[\s\S]*?nex_current_owned_business_ids\(\)/,
    );
  });

  it("does NOT create a DELETE policy on nex_live_post (D3 · hard-delete deferred)", () => {
    expect(M218).not.toMatch(/CREATE POLICY[^;]*ON nex_live_post FOR DELETE/);
  });

  it("documents guest-chat (D4) must stay on service-role", () => {
    expect(M218).toMatch(/Guest-chat compatibility \(D4\)/);
    expect(M218).toMatch(/service-role/i);
  });
});

describe("Migration 218 · source-shape · F4 immutability trigger (R11)", () => {
  it("defines nex_peer_message_enforce_immutability function", () => {
    expect(M218).toMatch(
      /CREATE OR REPLACE FUNCTION nex_peer_message_enforce_immutability\(\)/,
    );
  });

  it("function uses SECURITY DEFINER with pinned search_path = pg_catalog, public", () => {
    const fn = M218.match(
      /CREATE OR REPLACE FUNCTION nex_peer_message_enforce_immutability[\s\S]*?\$fn\$;/,
    );
    expect(fn).toBeTruthy();
    expect(fn![0]).toMatch(/SECURITY DEFINER/);
    expect(fn![0]).toMatch(/SET search_path = pg_catalog, public/);
  });

  it("rejects mutation of all 17 immutable columns via IS DISTINCT FROM", () => {
    for (const col of [
      "id",
      "conversation_id",
      "sender_account_id",
      "body",
      "sent_at",
      "reply_to_id",
      "attachment_url",
      "attachment_type",
      "attachment_meta",
      "encrypted",
      "ciphertext",
      "nonce",
      "sender_public_key",
      "sender_device_id",
      "recipient_device_id",
      "message_group_id",
      "send_intent_id",
    ]) {
      expect(M218).toMatch(
        new RegExp(`NEW\\.${col} IS DISTINCT FROM OLD\\.${col}`),
      );
    }
  });

  it("does NOT reject the sealed-mutable 6 columns (read_at, deleted_for_everyone, deleted_at, reactions, reactions_order, delivered_at)", () => {
    const fn = M218.match(
      /CREATE OR REPLACE FUNCTION nex_peer_message_enforce_immutability[\s\S]*?\$fn\$;/,
    );
    for (const mutableCol of [
      "read_at",
      "deleted_for_everyone",
      "deleted_at",
      "reactions",
      "reactions_order",
      "delivered_at",
    ]) {
      // Mutable column should NOT appear in an "IS DISTINCT FROM" check.
      expect(fn![0]).not.toMatch(
        new RegExp(`NEW\\.${mutableCol} IS DISTINCT FROM OLD\\.${mutableCol}`),
      );
    }
  });

  it("trigger name sorts before Migration 125's link_preview_delete_trigger (alphabetical)", () => {
    expect(M218).toMatch(
      /CREATE TRIGGER nex_peer_message_immutability_guard/,
    );
    // Verify ordering: 'immutability_guard' < 'link_preview_delete_trigger'
    expect("nex_peer_message_immutability_guard".localeCompare(
      "nex_peer_message_link_preview_delete_trigger",
    )).toBeLessThan(0);
  });

  it("trigger fires BEFORE UPDATE on nex_peer_message", () => {
    const trig = M218.match(
      /CREATE TRIGGER nex_peer_message_immutability_guard[\s\S]*?;/,
    );
    expect(trig).toBeTruthy();
    expect(trig![0]).toMatch(/BEFORE UPDATE ON nex_peer_message/);
    expect(trig![0]).toMatch(/FOR EACH ROW/);
    expect(trig![0]).toMatch(/EXECUTE FUNCTION nex_peer_message_enforce_immutability\(\)/);
  });

  it("documents R12 · coexistence with Migration 125 trigger via alphabetical ordering", () => {
    expect(M218).toMatch(/R12 ·/);
    expect(M218).toMatch(/alphabetical/i);
    expect(M218).toMatch(/nex_peer_message_link_preview_delete_trigger/);
  });
});

describe("Migration 218 · source-shape · rollback + ledger", () => {
  it("provides a complete rollback block", () => {
    expect(M218).toMatch(/-- Rollback/);
    expect(M218).toMatch(/DROP TRIGGER IF EXISTS nex_peer_message_immutability_guard/);
    expect(M218).toMatch(/DROP FUNCTION IF EXISTS nex_peer_message_enforce_immutability/);
    for (const policy of [
      "nex_live_post_public_select",
      "nex_live_post_owner_insert",
      "nex_live_post_owner_update",
    ]) {
      expect(M218).toMatch(new RegExp(`DROP POLICY IF EXISTS ${policy}`));
    }
    expect(M218).toMatch(/DELETE FROM nex_migration_history WHERE version = '218'/);
  });

  it("inserts a ledger row with version '218'", () => {
    expect(M218).toMatch(/INSERT INTO nex_migration_history[\s\S]*?'218'/);
  });

  it("has exactly one BEGIN/COMMIT pair (the main migration)", () => {
    // The rollback block is in a comment · it uses -- BEGIN; which is
    // commented, so the main migration should have exactly one active
    // BEGIN; and one active COMMIT; at column 0. Use line-level
    // equality so Windows / Unix line endings and leading-space
    // variants don't matter.
    const lines = M218.split(/\r?\n/).map((l) => l.trim());
    const beginLines = lines.filter((l) => l === "BEGIN;");
    const commitLines = lines.filter((l) => l === "COMMIT;");
    expect(beginLines.length).toBe(1);
    expect(commitLines.length).toBe(1);
  });
});

/* ─── 2 · Real-database tests · T1–T36 (sandbox required) ────── */

// All tests below are `it.skip` because no dedicated non-production
// sandbox has been identified (D6 unresolved). Convert to `it` under
// the sandbox-run procedure documented at the file head. Each test
// documents its security invariant · a maintainer must be able to
// read the test name and immediately know what it proves.

describe.skip("T1-T36 · real-database policy matrix · requires sandbox", () => {
  describe("R1 · nex_peer_message / nex_peer_conversation", () => {
    it("T1 · anon SELECT nex_peer_message → 0 rows", () => {});
    it("T2 · authenticated participant SELECT → own conversation rows only", () => {});
    it("T3 · authenticated non-participant SELECT → 0 rows", () => {});
    it("T4 · non-participant INSERT into {A,B} conversation → DENIED", () => {});
    it("T5 · forged sender_account_id INSERT → DENIED", () => {});
    it("T6 · legitimate participant INSERT → ALLOWED", () => {});
    it("T7 · participant UPDATE read_at → ALLOWED", () => {});
    it("T8 · non-participant UPDATE read_at → DENIED", () => {});
    it("T9 · service_role SELECT without filter → ALL rows (RLS bypassed)", () => {});
    it("T10 · authenticated DELETE on peer_message → DENIED (no DELETE policy)", () => {});
    it("T11 · provisional guest (supabase_user_id=NULL) SELECT → 0 rows (helper returns empty)", () => {});
    it("T12 · provisional guest INSERT via service-role path → ALLOWED (RLS bypassed)", () => {});
    it("T13 · provisional-to-claimed transition · SELECT begins returning rows", () => {});
    it("T14 · unit · nex_account.id ≠ supabase_user_id by construction", () => {});
  });

  describe("R2 · nex_live_post", () => {
    it("T15 · anon SELECT unexpired → row visible", () => {});
    it("T16 · anon SELECT expired → 0 rows", () => {});
    it("T17 · authenticated owner INSERT on own business → ALLOWED", () => {});
    it("T18 · authenticated owner INSERT on foreign business → DENIED", () => {});
    it("T19 · authenticated owner UPDATE body on own post → ALLOWED", () => {});
    it("T20 · authenticated non-owner UPDATE body → DENIED", () => {});
    it("T21 · authenticated owner DELETE → DENIED (no DELETE policy, D3)", () => {});
    it("T22a · service_role SELECT including expired → ALL rows (RLS bypassed)", () => {});
    it("T22b · service_role SELECT unexpired only via app-layer filter → expected rows", () => {});
    it("T23 · owner at Gratis tier cap attempting INSERT → DENIED (tier gate rejects before RLS)", () => {});
    it("T24 · anon INSERT on nex_live_post → DENIED", () => {});
  });

  describe("Regression · existing NEX flows against sandbox", () => {
    it("T25 · Phase 1 happy-path cart-send E2E → still green against new policies", () => {});
  });

  describe("F4 · immutability trigger (R11)", () => {
    it("T26 · participant UPDATE SET body='changed' → DENIED (trigger)", () => {});
    it("T27 · participant UPDATE SET attachment_url='…' → DENIED (trigger)", () => {});
    it("T28 · participant UPDATE SET attachment_meta='{…}' → DENIED (trigger)", () => {});
    it("T29 · participant UPDATE SET reply_to_id='…' → DENIED (trigger)", () => {});
    it("T30 · participant UPDATE SET ciphertext=NULL → DENIED (trigger)", () => {});
  });

  describe("F4-OK · legitimate mutable updates (via service-role)", () => {
    it("T31 · service-role UPDATE SET read_at=now() → ALLOWED", () => {});
    it("T32 · service-role UPDATE SET reactions, reactions_order → ALLOWED", () => {});
    it("T33 · service-role UPDATE SET deleted_for_everyone=true, deleted_at=now() → ALLOWED (+ Migration 125 trigger nulls link_preview if attachment_type='link_preview')", () => {});
    it("T34 · service-role UPDATE SET delivered_at=now() → ALLOWED", () => {});
  });

  describe("Role qualifier + Realtime", () => {
    it("T35 · anon SELECT on peer tables → 0 rows (TO authenticated restricts)", () => {});
    it("T36 · Realtime subscription inventory on production → manual check (NOT this test)", () => {});
  });
});
