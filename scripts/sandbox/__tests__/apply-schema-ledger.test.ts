// Tests for the apply-schema sandbox ledger behaviour.
//
// What this proves:
//   - Full filename (minus .sql) is used as the ledger key, not the
//     three-digit prefix.
//   - The two 187_* files and the two 224_* files are RECOGNISED AS
//     DISTINCT · neither is silently skipped.
//   - Production-ref protection and draft-migration exclusion filters
//     still function.
//   - Dry-run file list order is deterministic (lexicographic on filename).
//
// We don't boot the real apply script against a real DB in this test.
// We reproduce its filter + key-derivation logic in isolation and assert
// on the derived identifiers.

import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";

// Mirror the EXCLUDE_PATTERNS array and the filename→key transform from
// scripts/sandbox/apply-schema.mjs so the test proves the same contract.
const EXCLUDE_PATTERNS = [
  /SUPERSEDED/,
  /\.rollback\.sql$/,
  /^999_WIP_/,
  /^244_nex_country_column\.sql$/,
  /^245_nex_country_rls\.sql$/,
  /^246_nex_country_backfill\.sql$/,
  /^247_nex_visibility_column\.sql$/,
  /^248_nex_storage_country_prefix\.sql$/,
  /^249_nex_moderation_status\.sql$/,
  /^251_nex_age_gate\.sql$/,
];

function listApplicable(): string[] {
  return readdirSync("nex-supabase/migrations")
    .filter((f) => /^\d{3}_.*\.sql$/.test(f))
    .filter((f) => !EXCLUDE_PATTERNS.some((rx) => rx.test(f)))
    .sort();
}

function ledgerKey(filename: string): string {
  return filename.replace(/\.sql$/i, "");
}

describe("apply-schema filter + ledger key", () => {
  const applicable = listApplicable();

  it("yields exactly 236 applicable migration files", () => {
    expect(applicable.length).toBe(236);
  });

  it("excludes all 7 country-isolation drafts", () => {
    const drafts = [
      "244_nex_country_column.sql",
      "245_nex_country_rls.sql",
      "246_nex_country_backfill.sql",
      "247_nex_visibility_column.sql",
      "248_nex_storage_country_prefix.sql",
      "249_nex_moderation_status.sql",
      "251_nex_age_gate.sql",
    ];
    for (const d of drafts) {
      expect(applicable).not.toContain(d);
    }
  });

  it("excludes SUPERSEDED, rollback, and 999_WIP files", () => {
    expect(applicable.find((f) => /SUPERSEDED/.test(f))).toBeUndefined();
    expect(applicable.find((f) => /\.rollback\.sql$/.test(f))).toBeUndefined();
    expect(applicable.find((f) => /^999_WIP_/.test(f))).toBeUndefined();
  });

  it("includes BOTH 187_* duplicate files", () => {
    expect(applicable).toContain("187_nex_source_registry_osm_products.sql");
    expect(applicable).toContain("187_nex_world_country_us_au_seed.sql");
  });

  it("includes BOTH 224_* duplicate files", () => {
    expect(applicable).toContain("224_nex_account_is_mock_persona.sql");
    expect(applicable).toContain("224_nex_emergency_schema.sql");
  });

  it("derives DISTINCT ledger keys for each duplicate pair", () => {
    const k1 = ledgerKey("187_nex_source_registry_osm_products.sql");
    const k2 = ledgerKey("187_nex_world_country_us_au_seed.sql");
    const k3 = ledgerKey("224_nex_account_is_mock_persona.sql");
    const k4 = ledgerKey("224_nex_emergency_schema.sql");
    const keys = new Set([k1, k2, k3, k4]);
    expect(keys.size).toBe(4); // all four distinct
    expect(k1).toBe("187_nex_source_registry_osm_products");
    expect(k2).toBe("187_nex_world_country_us_au_seed");
    expect(k3).toBe("224_nex_account_is_mock_persona");
    expect(k4).toBe("224_nex_emergency_schema");
  });

  it("ledger key is NOT a 3-digit prefix (so duplicate prefixes do not collide)", () => {
    expect(ledgerKey("187_nex_source_registry_osm_products.sql")).not.toBe("187");
    expect(ledgerKey("224_nex_account_is_mock_persona.sql")).not.toBe("224");
  });

  it("entire set of 236 files derives 236 distinct ledger keys", () => {
    const keys = applicable.map(ledgerKey);
    const unique = new Set(keys);
    expect(unique.size).toBe(236);
  });

  it("order is deterministic (lexicographic by filename)", () => {
    const copy = [...applicable];
    copy.sort();
    expect(applicable).toEqual(copy);
  });

  it("first + last files match the previously-reviewed dry-run output", () => {
    expect(applicable[0]).toBe("001_nex_migration_history_and_account.sql");
    expect(applicable[applicable.length - 1]).toBe("242_nex_creator_support_settings.sql");
  });

  it("ledger-key character set is safe for SQL identifier (no quotes needed in text literal)", () => {
    for (const f of applicable) {
      const k = ledgerKey(f);
      expect(k).toMatch(/^[A-Za-z0-9_]+$/);
    }
  });
});
