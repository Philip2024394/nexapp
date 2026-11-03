// nex-supabase/migrations/__tests__/scope-a-pr-1-idempotency.test.ts
//
// Scope-A PR-1 · source-shape tests for migration 264 (idempotency
// columns on nex_friend_request).
//
// Evidence boundary: see scope-a-pr-1-event-registry.test.ts.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const M264 = readFileSync(
  resolve(__dirname, "..", "264_nex_friend_request_idempotency.sql"),
  "utf8",
);

describe("Migration 264 · idempotency columns · source-shape", () => {
  it("declares the DRAFT apply guard", () => {
    expect(M264).toMatch(/Migration 264 is DRAFT/);
  });

  it("declares pre-flight: nex_friend_request must exist (sealed by migration 215)", () => {
    expect(M264).toMatch(/nex_friend_request missing[^']*sealed table from migration 215/);
  });

  it("declares pre-flight: pgcrypto extension must be installed", () => {
    expect(M264).toMatch(/pgcrypto extension not installed/);
    expect(M264).toMatch(/pg_extension WHERE extname\s*=\s*'pgcrypto'/);
  });

  it("rejects pre-existing column with wrong data type", () => {
    expect(M264).toMatch(/idempotency_key exists with wrong data type \(expected text\)/);
    expect(M264).toMatch(/idempotency_fingerprint exists with wrong data type \(expected bytea\)/);
  });

  it("adds idempotency_key text column (nullable) via ADD COLUMN IF NOT EXISTS", () => {
    expect(M264).toMatch(/ADD COLUMN IF NOT EXISTS idempotency_key\s+text\s+NULL/);
  });

  it("adds idempotency_fingerprint bytea column (nullable) via ADD COLUMN IF NOT EXISTS", () => {
    expect(M264).toMatch(/ADD COLUMN IF NOT EXISTS idempotency_fingerprint\s+bytea\s+NULL/);
  });

  it("constrains idempotency_key length to 1..128 chars with non-whitespace content", () => {
    expect(M264).toMatch(/nex_friend_request_idempotency_key_shape/);
    expect(M264).toMatch(/length\(idempotency_key\) BETWEEN 1 AND 128/);
    expect(M264).toMatch(/length\(trim\(idempotency_key\)\)\s*>=\s*1/);
  });

  it("constrains fingerprint to exactly 32 bytes (SHA-256 output)", () => {
    expect(M264).toMatch(/nex_friend_request_idempotency_fingerprint_shape/);
    expect(M264).toMatch(/octet_length\(idempotency_fingerprint\)\s*=\s*32/);
  });

  it("declares coherence CHECK · key and fingerprint are set together or both NULL", () => {
    expect(M264).toMatch(/nex_friend_request_idempotency_coherent/);
    expect(M264).toMatch(/idempotency_key IS NULL AND idempotency_fingerprint IS NULL/);
    expect(M264).toMatch(/idempotency_key IS NOT NULL AND idempotency_fingerprint IS NOT NULL/);
  });

  it("creates partial unique index on (sender_account_id, idempotency_key) WHERE key is set", () => {
    expect(M264).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS nex_friend_request_idempotency_unique/);
    expect(M264).toMatch(/\(\s*sender_account_id\s*,\s*idempotency_key\s*\)/);
    expect(M264).toMatch(/WHERE\s+idempotency_key IS NOT NULL/);
  });

  it("partial index does NOT include fingerprint (unique-scope is on sender+key only)", () => {
    const indexLine = M264.match(/CREATE UNIQUE INDEX IF NOT EXISTS nex_friend_request_idempotency_unique[\s\S]*?;/)?.[0] ?? "";
    expect(indexLine).not.toMatch(/idempotency_fingerprint/);
  });

  it("documents the server-computed fingerprint policy", () => {
    expect(M264).toMatch(/Server-computed/i);
    expect(M264).toMatch(/never trusted from (the )?client/i);
  });

  it("documents the fingerprint canonical encoding with schema-version salt", () => {
    expect(M264).toMatch(/sha256_hex\(lower\(coalesce\(recipient_handle/);
    expect(M264).toMatch(/'v1'/);
    expect(M264).toMatch(/schema-version salt/i);
    expect(M264).toMatch(/NULL versus empty string/i);
  });

  it("records a nex_migration_history row for version 264", () => {
    expect(M264).toMatch(/INSERT INTO public\.nex_migration_history[\s\S]*?'264'/);
  });

  it("transaction is wrapped in BEGIN/COMMIT", () => {
    expect(M264).toMatch(/^BEGIN;/m);
    expect(M264).toMatch(/^COMMIT;/m);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Integration matrix · DISABLED pending authorised sandbox.
// ═══════════════════════════════════════════════════════════════════════

describe("Migration 264 · integration matrix (requires authorised sandbox)", () => {
  it.skip("ADD COLUMN is a no-op if columns already exist with correct types", () => {});
  it.skip("ADD COLUMN raises if columns exist with wrong types (pre-flight)", () => {});
  it.skip("partial unique index allows multiple rows with NULL idempotency_key", () => {});
  it.skip("partial unique index rejects duplicate (sender, key) pair when key is set", () => {});
  it.skip("coherence CHECK rejects key-without-fingerprint and fingerprint-without-key", () => {});
  it.skip("fingerprint CHECK rejects a bytea value with octet_length <> 32", () => {});
  it.skip("pgcrypto pre-flight RAISEs when the extension is not installed", () => {});
});
