// nex-supabase/migrations/__tests__/scope-a-pr-1-event-table.test.ts
//
// Scope-A PR-1 · source-shape tests for migrations 262 (event table)
// and 263 (event hold table).
//
// Evidence boundary: see scope-a-pr-1-event-registry.test.ts.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const M262 = readFileSync(
  resolve(__dirname, "..", "262_nex_invite_event.sql"),
  "utf8",
);
const M263 = readFileSync(
  resolve(__dirname, "..", "263_nex_invite_event_hold.sql"),
  "utf8",
);

// ═══════════════════════════════════════════════════════════════════════
// Migration 262 · nex_invite_event
// ═══════════════════════════════════════════════════════════════════════

describe("Migration 262 · nex_invite_event · source-shape", () => {
  it("declares the DRAFT apply guard", () => {
    expect(M262).toMatch(/Migration 262 is DRAFT/);
  });

  it("declares pre-flight dependencies on 260 and 261", () => {
    expect(M262).toMatch(/nex_invite_event_type missing[^']*Apply migration 260 first/);
    expect(M262).toMatch(/count\(\*\) FROM public\.nex_invite_event_type/);
  });

  it("creates the event table", () => {
    expect(M262).toMatch(/CREATE TABLE IF NOT EXISTS public\.nex_invite_event\b/);
  });

  it("primary key is uuid with gen_random_uuid default", () => {
    expect(M262).toMatch(/id\s+uuid\s+PRIMARY KEY\s+DEFAULT\s+gen_random_uuid\(\)/);
  });

  it("correlation_id is NOT NULL uuid", () => {
    expect(M262).toMatch(/correlation_id\s+uuid\s+NOT NULL/);
  });

  it("event_name and event_class are NOT NULL text", () => {
    expect(M262).toMatch(/event_name\s+text\s+NOT NULL/);
    expect(M262).toMatch(/event_class\s+text\s+NOT NULL/);
  });

  it("declares the compound FK (event_name, event_class) → registry with RESTRICT", () => {
    expect(M262).toMatch(/CONSTRAINT nex_invite_event_type_fk/);
    expect(M262).toMatch(
      /FOREIGN KEY\s*\(\s*event_name\s*,\s*event_class\s*\)\s*REFERENCES\s+public\.nex_invite_event_type\s*\(\s*event_name\s*,\s*event_class\s*\)/,
    );
    expect(M262).toMatch(/ON UPDATE RESTRICT\s+ON DELETE RESTRICT/);
  });

  it("request_id is nullable with NO foreign key (soft reference)", () => {
    expect(M262).toMatch(/request_id\s+uuid\s+NULL/);
    // No REFERENCES on the request_id column line itself.
    const requestIdLine = M262.split("\n").find((l) => /request_id\s+uuid\s+NULL/.test(l));
    expect(requestIdLine, "request_id column line not found").toBeTruthy();
    expect(requestIdLine ?? "").not.toMatch(/REFERENCES/);
  });

  it("stores dims as jsonb with DEFAULT '{}'::jsonb", () => {
    expect(M262).toMatch(/dims\s+jsonb\s+NOT NULL\s+DEFAULT\s+'\{\}'::jsonb/);
  });

  it("rejection_reason check enumerates the four reasons", () => {
    expect(M262).toMatch(/'cooldown'/);
    expect(M262).toMatch(/'duplicate_pending'/);
    expect(M262).toMatch(/'idempotency_key_conflict'/);
    expect(M262).toMatch(/'idempotency_lookup_lost'/);
  });

  it("category check accepts only friends | business", () => {
    expect(M262).toMatch(/category IS NULL OR category IN\s*\(\s*'friends'\s*,\s*'business'\s*\)/);
  });

  it("elapsed_ms_from_created rejects negatives", () => {
    expect(M262).toMatch(/elapsed_ms_from_created IS NULL OR elapsed_ms_from_created\s*>=\s*0/);
  });

  it("declares 4 indexes · occurred · name+occurred · correlation · request partial", () => {
    expect(M262).toMatch(/nex_invite_event_occurred_at_idx[\s\S]*?\(\s*occurred_at DESC\s*\)/);
    expect(M262).toMatch(/nex_invite_event_name_occurred_at_idx[\s\S]*?\(\s*event_name\s*,\s*occurred_at DESC\s*\)/);
    expect(M262).toMatch(/nex_invite_event_correlation_idx[\s\S]*?\(\s*correlation_id\s*\)/);
    expect(M262).toMatch(/nex_invite_event_request_id_idx[\s\S]*?WHERE\s+request_id IS NOT NULL/);
  });

  it("enables RLS and declares deny-all policies for anon + authenticated", () => {
    expect(M262).toMatch(/ALTER TABLE public\.nex_invite_event ENABLE ROW LEVEL SECURITY/);
    for (const role of ["anon", "authenticated"]) {
      for (const op of ["select", "insert", "update", "delete"]) {
        expect(M262, `missing deny ${role}/${op} policy`).toMatch(
          new RegExp(`nex_invite_event_deny_${role}_${op}`),
        );
      }
    }
  });

  it("grants SELECT + INSERT + DELETE to service_role (append + retention · no UPDATE)", () => {
    expect(M262).toMatch(/GRANT\s+SELECT\s*,\s*INSERT\s*,\s*DELETE\s+ON\s+public\.nex_invite_event\s+TO\s+service_role/);
    // No explicit UPDATE grant on nex_invite_event (append-only invariant).
    const updateGrants = M262
      .split("\n")
      .filter((l) => /GRANT[^;]*\bUPDATE\b[^;]*ON\s+public\.nex_invite_event\b/i.test(l));
    expect(updateGrants).toEqual([]);
  });

  it("does NOT define columns that could leak chat body, handle, or PII", () => {
    const forbidden = [
      /^\s*body\s+text/im,
      /message_body\s+text/i,
      /intro_note\s+text/i,
      /nex_handle\s+text/i,
      /display_name\s+text/i,
      /\bemail\s+text/i,
      /\bphone\s+text/i,
    ];
    for (const pattern of forbidden) {
      expect(M262, `event table must not include ${pattern}`).not.toMatch(pattern);
    }
  });

  it("records a nex_migration_history row for version 262", () => {
    expect(M262).toMatch(/INSERT INTO public\.nex_migration_history[\s\S]*?'262'/);
  });

  it("transaction is wrapped in BEGIN/COMMIT", () => {
    expect(M262).toMatch(/^BEGIN;/m);
    expect(M262).toMatch(/^COMMIT;/m);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Migration 263 · nex_invite_event_hold
// ═══════════════════════════════════════════════════════════════════════

describe("Migration 263 · nex_invite_event_hold · source-shape", () => {
  it("declares the DRAFT apply guard", () => {
    expect(M263).toMatch(/Migration 263 is DRAFT/);
  });

  it("declares pre-flight on migration 262 and nex_account", () => {
    expect(M263).toMatch(/nex_invite_event missing[^']*Apply migration 262 first/);
    expect(M263).toMatch(/nex_account missing/);
  });

  it("FK to nex_invite_event uses ON DELETE RESTRICT (defence in depth)", () => {
    expect(M263).toMatch(
      /invite_event_id\s+uuid\s+NOT NULL[\s\S]*?REFERENCES\s+public\.nex_invite_event\(id\)\s+ON DELETE RESTRICT/,
    );
  });

  it("actor FKs reference nex_account with ON DELETE RESTRICT", () => {
    expect(M263).toMatch(/held_by_account_id\s+uuid\s+NOT NULL[\s\S]*?REFERENCES\s+public\.nex_account\(id\)\s+ON DELETE RESTRICT/);
    expect(M263).toMatch(/cleared_by_account_id\s+uuid\s+NULL[\s\S]*?REFERENCES\s+public\.nex_account\(id\)\s+ON DELETE RESTRICT/);
  });

  it("declares the all-or-nothing cleared-fields coherence CHECK", () => {
    expect(M263).toMatch(/CONSTRAINT nex_invite_event_hold_cleared_coherent/);
    expect(M263).toMatch(/cleared_at IS NULL AND cleared_by_account_id IS NULL AND clear_reason IS NULL/);
    expect(M263).toMatch(/cleared_at IS NOT NULL AND cleared_by_account_id IS NOT NULL AND clear_reason IS NOT NULL/);
  });

  it("declares the temporal clear-after-hold CHECK", () => {
    expect(M263).toMatch(/CONSTRAINT nex_invite_event_hold_clear_after_hold/);
    expect(M263).toMatch(/cleared_at IS NULL OR cleared_at\s*>=\s*held_at/);
  });

  it("partial unique index enforces at most one active hold per event", () => {
    expect(M263).toMatch(/nex_invite_event_hold_single_active_per_event/);
    expect(M263).toMatch(/WHERE\s+cleared_at IS NULL/);
  });

  it("declares the active-hold index for the retention NOT EXISTS guard", () => {
    expect(M263).toMatch(/nex_invite_event_hold_active_idx[\s\S]*?WHERE\s+cleared_at IS NULL/);
  });

  it("enables RLS with deny-all policies for anon + authenticated", () => {
    expect(M263).toMatch(/ALTER TABLE public\.nex_invite_event_hold ENABLE ROW LEVEL SECURITY/);
    expect(M263).toMatch(/nex_invite_event_hold_deny_anon_select/);
    expect(M263).toMatch(/nex_invite_event_hold_deny_authenticated_select/);
  });

  it("grants only SELECT + INSERT + UPDATE to service_role · revokes DELETE", () => {
    expect(M263).toMatch(/GRANT\s+SELECT\s*,\s*INSERT\s*,\s*UPDATE\s+ON\s+public\.nex_invite_event_hold\s+TO\s+service_role/);
    expect(M263).toMatch(/REVOKE\s+DELETE\s+ON\s+public\.nex_invite_event_hold\s+FROM\s+service_role/);
  });

  it("records a nex_migration_history row for version 263", () => {
    expect(M263).toMatch(/INSERT INTO public\.nex_migration_history[\s\S]*?'263'/);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Integration matrix · DISABLED pending authorised sandbox + rollback rehearsal.
// ═══════════════════════════════════════════════════════════════════════

describe("Migration 262/263 · integration matrix (requires authorised sandbox)", () => {
  it.skip("compound FK rejects INSERT with unknown event_name", () => {});
  it.skip("compound FK rejects INSERT with (known name, wrong class)", () => {});
  it.skip("ON DELETE RESTRICT · deleting an event with an active hold fails", () => {});
  it.skip("partial unique index rejects a second active hold on the same event", () => {});
  it.skip("CHECK rejects coherent-fields violation (cleared_at set, cleared_by null)", () => {});
  it.skip("anon and authenticated roles cannot SELECT either table", () => {});
  it.skip("service_role has no UPDATE grant on nex_invite_event (append-only)", () => {});
});
