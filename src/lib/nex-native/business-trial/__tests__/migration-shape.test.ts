// src/lib/nex-native/business-trial/__tests__/migration-shape.test.ts
//
// G1 regression test · structural shape of migration 214.
// Reads the SQL file from disk and asserts the required elements are
// present per the sealed G1 Design Package §3.2. This is a documentation
// anchor · it does NOT execute the SQL against any database.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATION_PATH = join(
  process.cwd(),
  "nex-supabase",
  "migrations",
  "214_nex_business_trial_system.sql",
);

const sql = readFileSync(MIGRATION_PATH, "utf8");

describe("Migration 214 · structural shape", () => {
  it("declares the exact 4 trial columns on nex_account", () => {
    expect(sql).toContain("ADD COLUMN business_trial_status text");
    expect(sql).toContain("ADD COLUMN business_trial_start_at timestamptz");
    expect(sql).toContain("ADD COLUMN business_trial_end_at   timestamptz");
    expect(sql).toContain("ADD COLUMN business_trial_conversion_opt_out boolean");
  });

  it("K9 · enforces exact 168-hour trial duration at DB layer", () => {
    expect(sql).toMatch(
      /business_trial_end_at\s*=\s*business_trial_start_at\s*\+\s*interval\s*'168 hours'/,
    );
  });

  it("defensive · opt_out requires active status", () => {
    expect(sql).toContain("nex_account_opt_out_requires_active");
    expect(sql).toContain("business_trial_conversion_opt_out = false");
  });

  it("partial index for G4 cron efficient sweep", () => {
    expect(sql).toContain("idx_nex_account_business_trial_active_end");
    expect(sql).toContain("WHERE business_trial_status = 'active'");
  });

  it("S1 fail-safe · trigger + function for coexistence enforcement", () => {
    expect(sql).toContain("CREATE OR REPLACE FUNCTION nex_enforce_trial_coexistence");
    expect(sql).toContain("CREATE TRIGGER tr_nex_account_trial_coexistence");
    expect(sql).toContain("BEFORE UPDATE ON nex_account");
    expect(sql).toContain("business_trial_blocked_by_active_themes_trial");
    expect(sql).toContain("themes_trial_blocked_by_active_business_trial");
    expect(sql).toContain("ERRCODE = 'exclusion_violation'");
  });

  it("S4 · pilot audit table with three-transaction-friendly shape", () => {
    expect(sql).toContain("CREATE TABLE nex_pilot_operator_audit");
    expect(sql).toContain("operator_identity text NOT NULL");
    expect(sql).toContain("attempt_status text NOT NULL DEFAULT 'pending'");
    expect(sql).toContain("outcome_at timestamptz");
    expect(sql).toContain("before_state jsonb");
    expect(sql).toContain("after_state jsonb");
    expect(sql).toContain("error_message text");
    expect(sql).toContain("request_id text");
    // Reconciliation index
    expect(sql).toContain("idx_nex_pilot_operator_audit_pending");
  });

  it("explicitly deferred elements · NOT present in this migration", () => {
    // Confirms owner's "reduced scope" directive · deferred payment columns
    // are not snuck in.
    expect(sql).not.toMatch(/ADD COLUMN tier_activated_at/);
    expect(sql).not.toMatch(/ADD COLUMN payment_provider /);
    expect(sql).not.toMatch(/ADD COLUMN payment_provider_customer_id/);
    expect(sql).not.toContain("CREATE TABLE nex_billing_attempt");
    expect(sql).not.toContain("CREATE TABLE nex_data_sunset_schedule");
    // X3 safeguard · migration 207 columns are NOT altered or added here.
    // The migration header mentions `vault_trial_used_at` in a comment to
    // document deferral, but no ADD COLUMN or ALTER operation touches it.
    expect(sql).not.toMatch(/ADD COLUMN\s+vault_trial_used_at/i);
    expect(sql).not.toMatch(/ADD COLUMN\s+vault_tier/i);
    expect(sql).not.toMatch(/ALTER TABLE[^;]*vault_tier[^;]*ADD/i);
  });

  it("has BEGIN/COMMIT transaction wrapper", () => {
    expect(sql).toContain("BEGIN;");
    expect(sql.trim()).toMatch(/COMMIT;\s*$/);
  });
});
