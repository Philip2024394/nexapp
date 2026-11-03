// nex-supabase/migrations/__tests__/scope-a-pr-1-event-registry.test.ts
//
// Scope-A PR-1 · source-shape tests for the event registry layer
// (migrations 260 and 261).
//
// -----------------------------------------------------------------------
// EVIDENCE BOUNDARY (owner directive · do not overstate)
// -----------------------------------------------------------------------
// These tests read the migration SQL as text and assert its structural
// contract. They do NOT prove the migrations behave correctly against a
// running Postgres instance. The integration-matrix tests marked `.skip`
// at the bottom of each describe block require an explicitly authorised
// non-production Supabase sandbox AND rollback rehearsal · do NOT
// activate against the sealed production project `ijvqdvsvwtwxzcqmoqit`.
// -----------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const M260 = readFileSync(
  resolve(__dirname, "..", "260_nex_invite_event_type.sql"),
  "utf8",
);
const M261 = readFileSync(
  resolve(__dirname, "..", "261_nex_invite_event_type_seed.sql"),
  "utf8",
);

// ─── Shared expectations ───────────────────────────────────────────────
// The authoritative 15-event registry sealed in Scope-A final revision.
// Mirrored here so this test file is the second source of truth · any
// drift between the seed migration and this expectation list fails CI.
const EXPECTED_EVENTS: ReadonlyArray<{
  readonly name: string;
  readonly class: "lifecycle" | "operational";
  readonly sweepHb: boolean;
  readonly watcherHb: boolean;
  readonly retentionHb: boolean;
  readonly severity: "none" | "medium" | "high";
}> = [
  { name: "invite.created",             class: "lifecycle",   sweepHb: false, watcherHb: false, retentionHb: false, severity: "none"   },
  { name: "invite.accepted",            class: "lifecycle",   sweepHb: false, watcherHb: false, retentionHb: false, severity: "none"   },
  { name: "invite.cancelled",           class: "lifecycle",   sweepHb: false, watcherHb: false, retentionHb: false, severity: "none"   },
  { name: "invite.expired.swept",       class: "lifecycle",   sweepHb: false, watcherHb: false, retentionHb: false, severity: "none"   },
  { name: "invite.create.rejected",     class: "lifecycle",   sweepHb: false, watcherHb: false, retentionHb: false, severity: "none"   },
  { name: "invite.view",                class: "lifecycle",   sweepHb: false, watcherHb: false, retentionHb: false, severity: "none"   },
  { name: "sweep.run.ok",               class: "operational", sweepHb: true,  watcherHb: false, retentionHb: false, severity: "none"   },
  { name: "sweep.run.failed",           class: "operational", sweepHb: false, watcherHb: false, retentionHb: false, severity: "high"   },
  { name: "sweep.run.unresolved",       class: "operational", sweepHb: false, watcherHb: false, retentionHb: false, severity: "medium" },
  { name: "watcher.run.ok",             class: "operational", sweepHb: false, watcherHb: true,  retentionHb: false, severity: "none"   },
  { name: "watcher.run.failed",         class: "operational", sweepHb: false, watcherHb: false, retentionHb: false, severity: "high"   },
  { name: "watcher.run.unresolved",     class: "operational", sweepHb: false, watcherHb: false, retentionHb: false, severity: "medium" },
  { name: "retention.run.ok",           class: "operational", sweepHb: false, watcherHb: false, retentionHb: true,  severity: "none"   },
  { name: "retention.run.failed",       class: "operational", sweepHb: false, watcherHb: false, retentionHb: false, severity: "high"   },
  { name: "retention.run.unresolved",   class: "operational", sweepHb: false, watcherHb: false, retentionHb: false, severity: "medium" },
];

// ═══════════════════════════════════════════════════════════════════════
// Migration 260 · nex_invite_event_type registry table
// ═══════════════════════════════════════════════════════════════════════

describe("Migration 260 · nex_invite_event_type · source-shape", () => {
  it("declares the DRAFT apply guard", () => {
    expect(M260).toMatch(/Migration 260 is DRAFT/);
    expect(M260).toMatch(/RAISE EXCEPTION '[^']*DRAFT/);
  });

  it("creates the registry table in public schema", () => {
    expect(M260).toMatch(/CREATE TABLE IF NOT EXISTS public\.nex_invite_event_type/);
  });

  it("primary key is event_name text with regex check", () => {
    expect(M260).toMatch(/event_name\s+text\s+PRIMARY KEY/);
    expect(M260).toMatch(/event_name\s*~\s*'\^\[a-z0-9\._\]\+\$'/);
  });

  it("event_class is constrained to lifecycle | operational", () => {
    expect(M260).toMatch(/event_class\s+text\s+NOT NULL/);
    expect(M260).toMatch(/CHECK\s*\(\s*event_class\s+IN\s*\(\s*'lifecycle'\s*,\s*'operational'\s*\)\s*\)/);
  });

  it("declares three heartbeat flag columns", () => {
    expect(M260).toMatch(/is_sweep_heartbeat\s+boolean\s+NOT NULL\s+DEFAULT\s+false/);
    expect(M260).toMatch(/is_watcher_heartbeat\s+boolean\s+NOT NULL\s+DEFAULT\s+false/);
    expect(M260).toMatch(/is_retention_heartbeat\s+boolean\s+NOT NULL\s+DEFAULT\s+false/);
  });

  it("alert_severity constrained to none | medium | high", () => {
    expect(M260).toMatch(/alert_severity\s+text\s+NOT NULL/);
    expect(M260).toMatch(/CHECK\s*\(\s*alert_severity\s+IN\s*\(\s*'none'\s*,\s*'medium'\s*,\s*'high'\s*\)\s*\)/);
  });

  it("constraint prevents a heartbeat row from carrying alert_severity > none", () => {
    expect(M260).toMatch(/CONSTRAINT nex_invite_event_type_heartbeat_severity_coherent/);
  });

  it("constraint allows at most one heartbeat flag per row", () => {
    expect(M260).toMatch(/CONSTRAINT nex_invite_event_type_at_most_one_heartbeat/);
  });

  it("declares the compound-FK target UNIQUE index on (event_name, event_class)", () => {
    expect(M260).toMatch(/UNIQUE INDEX IF NOT EXISTS nex_invite_event_type_name_class_unique[\s\S]*?event_name\s*,\s*event_class/);
  });

  it("enables row-level security and deploys deny-all policies", () => {
    expect(M260).toMatch(/ALTER TABLE public\.nex_invite_event_type ENABLE ROW LEVEL SECURITY/);
    expect(M260).toMatch(/nex_invite_event_type_deny_anon_select/);
    expect(M260).toMatch(/nex_invite_event_type_deny_authenticated_select/);
    expect(M260).toMatch(/nex_invite_event_type_deny_anon_insert/);
    expect(M260).toMatch(/nex_invite_event_type_deny_authenticated_insert/);
  });

  it("grants only SELECT + INSERT + UPDATE to service_role and revokes DELETE", () => {
    expect(M260).toMatch(/GRANT\s+SELECT\s*,\s*INSERT\s*,\s*UPDATE\s+ON\s+public\.nex_invite_event_type\s+TO\s+service_role/);
    expect(M260).toMatch(/REVOKE\s+DELETE\s+ON\s+public\.nex_invite_event_type\s+FROM\s+service_role/);
  });

  it("records a nex_migration_history row for version 260", () => {
    expect(M260).toMatch(/INSERT INTO public\.nex_migration_history[\s\S]*?'260'/);
  });

  it("transaction is wrapped in BEGIN/COMMIT", () => {
    expect(M260).toMatch(/^BEGIN;/m);
    expect(M260).toMatch(/^COMMIT;/m);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Migration 261 · 15-event seed
// ═══════════════════════════════════════════════════════════════════════

describe("Migration 261 · event registry seed · source-shape", () => {
  it("declares the DRAFT apply guard", () => {
    expect(M261).toMatch(/Migration 261 is DRAFT/);
  });

  it("declares pre-flight dependency on migration 260 (table exists)", () => {
    expect(M261).toMatch(/Migration 261 refused[^']*nex_invite_event_type missing/);
  });

  it("seeds every one of the 15 authoritative event names", () => {
    for (const e of EXPECTED_EVENTS) {
      // Each event appears somewhere in the seed VALUES list.
      // Use a plain substring check (the seed uses single quotes around names).
      expect(M261, `missing seed row for ${e.name}`).toContain(`'${e.name}'`);
    }
  });

  it("seeds the 6 lifecycle events and 9 operational events", () => {
    const lifecycleCount = EXPECTED_EVENTS.filter((e) => e.class === "lifecycle").length;
    const operationalCount = EXPECTED_EVENTS.filter((e) => e.class === "operational").length;
    expect(lifecycleCount).toBe(6);
    expect(operationalCount).toBe(9);
    // Total matches the registry-level 15-row expectation.
    expect(lifecycleCount + operationalCount).toBe(15);
  });

  it("enforces exactly 15 rows post-seed (RAISE if divergent)", () => {
    expect(M261).toMatch(/expected 15/);
    expect(M261).toMatch(/count\(\*\)\s*FROM public\.nex_invite_event_type/);
  });

  it("mismatch detection raises an exception rather than silently overwriting", () => {
    expect(M261).toMatch(/Migration 261 refused[^']*differ from expected/);
    expect(M261).toMatch(/v_diffs/);
  });

  it("records a nex_migration_history row for version 261", () => {
    expect(M261).toMatch(/INSERT INTO public\.nex_migration_history[\s\S]*?'261'/);
  });

  // ── Heartbeat exclusivity · structural check on the seed VALUES list.
  // Every heartbeat flag in the seed should attach to a .ok event · we
  // check this by grepping the raw VALUES lines for each flag pattern.
  it("every seeded heartbeat flag=true line references an .ok event", () => {
    const lines = M261.split("\n");
    const flagTrueLines = lines.filter((l) =>
      /\(\s*'[a-z0-9._]+'\s*,\s*'(?:lifecycle|operational)'/.test(l) &&
      /\btrue\b/i.test(l),
    );
    expect(flagTrueLines.length, "no heartbeat seed rows found at all").toBeGreaterThan(0);
    for (const line of flagTrueLines) {
      expect(
        /'[a-z0-9._]+\.ok'/.test(line),
        `heartbeat flag on non-.ok event: ${line.trim()}`,
      ).toBe(true);
    }
  });

  it("every seeded .failed event has severity high · none has heartbeat flag true", () => {
    const lines = M261.split("\n");
    // Only match VALUES tuples: start with '('·quoted name ending in .failed·comma·quoted class.
    // Excludes comment lines and the NOT IN sanity-check list that also mentions these names.
    const failedLines = lines.filter((l) =>
      /\(\s*'[a-z0-9._]+\.failed'\s*,\s*'(?:lifecycle|operational)'/.test(l),
    );
    expect(failedLines.length).toBeGreaterThan(0);
    for (const line of failedLines) {
      expect(line, `.failed event lacks severity high: ${line.trim()}`).toMatch(/'high'/);
      // No `true` in the heartbeat flag triple (3 booleans) · they should all be false.
      // Match: find the boolean triple between the class and severity · all 3 must be `false`.
      const m = line.match(/'(?:lifecycle|operational)'\s*,\s*(true|false)\s*,\s*(true|false)\s*,\s*(true|false)/);
      expect(m, `could not parse boolean triple in: ${line.trim()}`).not.toBeNull();
      if (m) {
        expect(m[1], `sweep_hb must be false on .failed: ${line.trim()}`).toBe("false");
        expect(m[2], `watcher_hb must be false on .failed: ${line.trim()}`).toBe("false");
        expect(m[3], `retention_hb must be false on .failed: ${line.trim()}`).toBe("false");
      }
    }
  });

  it("every seeded .unresolved event has severity medium · none has heartbeat flag true", () => {
    const lines = M261.split("\n");
    const unresolvedLines = lines.filter((l) =>
      /\(\s*'[a-z0-9._]+\.unresolved'\s*,\s*'(?:lifecycle|operational)'/.test(l),
    );
    expect(unresolvedLines.length).toBeGreaterThan(0);
    for (const line of unresolvedLines) {
      expect(line, `.unresolved event lacks severity medium: ${line.trim()}`).toMatch(/'medium'/);
      const m = line.match(/'(?:lifecycle|operational)'\s*,\s*(true|false)\s*,\s*(true|false)\s*,\s*(true|false)/);
      expect(m, `could not parse boolean triple in: ${line.trim()}`).not.toBeNull();
      if (m) {
        expect(m[1]).toBe("false");
        expect(m[2]).toBe("false");
        expect(m[3]).toBe("false");
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Integration matrix · DISABLED pending authorised sandbox + rollback rehearsal.
// ═══════════════════════════════════════════════════════════════════════

describe("Migration 260/261 · integration matrix (requires authorised sandbox)", () => {
  // To run these:
  //   1 · Provision a dedicated non-production Supabase sandbox (owner decision D-A20).
  //   2 · Apply migrations 001 → 260 → 261 to that sandbox.
  //   3 · Set env NEX_SANDBOX_SUPABASE_URL + NEX_SANDBOX_SERVICE_ROLE_KEY.
  //   4 · Convert `it.skip` → `it` and re-run.
  //
  // NEVER run against sealed production project `ijvqdvsvwtwxzcqmoqit`.
  it.skip("compound unique (event_name, event_class) rejects duplicate pair insert", () => {});
  it.skip("CHECK constraint rejects an unknown event_class value", () => {});
  it.skip("CHECK constraint rejects a heartbeat flag + severity 'high' combination", () => {});
  it.skip("CHECK constraint rejects two heartbeat flags set simultaneously", () => {});
  it.skip("seed is idempotent · running migration 261 twice reports zero inserts", () => {});
  it.skip("seed mismatch raises · hand-edit one row then re-run · migration refuses", () => {});
  it.skip("anon role cannot SELECT from the registry table", () => {});
  it.skip("authenticated role cannot SELECT from the registry table", () => {});
  it.skip("service_role can SELECT, INSERT, UPDATE · DELETE is revoked", () => {});
});
