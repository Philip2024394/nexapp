// src/lib/nex-native/discovery/__tests__/slice-1c-migration-216-signal-types.test.ts
//
// Phase 1 · Slice 1C · owner-authorised 2026-10-24.
// -------------------------------------------------------------------
// Verifies the SCHEMA CONTRACT of Migration 216
// (`216_nex_discovery_signal_add_enquiry_cart_signals.sql`) and the
// matching TypeScript enum in `discovery-signal-types.ts`.
//
// EXPLICIT EVIDENCE BOUNDARY (owner directive)
// -------------------------------------------------------------------
// This file deliberately contains THREE distinct test categories:
//
//   1 · MIGRATION SOURCE-SHAPE tests
//       Read the .sql file as text and assert its content. Do NOT
//       execute SQL. Do NOT assert anything about any live database.
//
//   2 · TS ENUM SOURCE-SHAPE tests
//       Read the .ts file as text and assert its content (the sealed
//       mirror of the PG ENUM).
//
//   3 · CONTRACT tests
//       Import the exported `isDiscoverySignalType` predicate and
//       the `DISCOVERY_SIGNAL_TYPES` array at runtime (pure in-
//       process, no DB). Assert that acceptance/rejection matches
//       the new contract.
//
// NO DATABASE-EXECUTED TESTS LIVE IN THIS FILE. Migration 216 has
// NOT been applied to any database. Any assertion of DB-level
// behaviour (e.g. a real INSERT with signal_type='enquiry_initiated'
// succeeding) is out of scope for Slice 1C. That evidence will come
// when a reviewer explicitly authorises application to a sandbox.
//
// Slice 1C is schema contract only. Writer wiring (Slice 1D) is a
// separate authorisation. The presence of these enum values after
// Migration 216 is NOT evidence that any action currently emits
// them.
//
// Gate posture (unchanged by this slice):
//   · G1 R1 / R2 unchanged.
//   · G2 unchanged.
//   · G3 unchanged · this slice makes no retention / deletion promise.
//
// NEX Marketing-layer boundary (preserved):
//   · nex.discovery_signal must NOT be joined into Intelligence or
//     Directory canonical queries. The new signal types inherit the
//     same boundary. Readers that aggregate are seller-dashboard
//     only (Phase 1 Slice 1E · future).

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  DISCOVERY_SIGNAL_TYPES,
  isDiscoverySignalType,
  type DiscoverySignalType,
} from "../discovery-signal-types";

/* ─── Fixtures ──────────────────────────────────────────────── */

const MIGRATION = readFileSync(
  resolve(
    __dirname,
    "..",
    "..",
    "..",
    "..",
    "..",
    "nex-supabase",
    "migrations",
    "216_nex_discovery_signal_add_enquiry_cart_signals.sql",
  ),
  "utf8",
);

const TS_ENUM_FILE = readFileSync(
  resolve(__dirname, "..", "discovery-signal-types.ts"),
  "utf8",
);

/* ─── 1 · Migration source-shape ─────────────────────────────── */

describe("Slice 1C · Migration 216 · source-shape (SQL file read as text)", () => {
  it("declares that it is NOT YET APPLIED anywhere", () => {
    expect(MIGRATION).toMatch(/NOT YET APPLIED/);
  });

  it("references the production project ref as off-limits without approval", () => {
    expect(MIGRATION).toMatch(/ijvqdvsvwtwxzcqmoqit/);
  });

  it("declares the Migration 208 dependency", () => {
    expect(MIGRATION).toMatch(/208_nex_discovery_signal\.sql/);
  });

  it("adds 'enquiry_initiated' via ALTER TYPE ... ADD VALUE IF NOT EXISTS", () => {
    expect(MIGRATION).toMatch(
      /ALTER TYPE nex\.discovery_signal_type ADD VALUE IF NOT EXISTS 'enquiry_initiated'/,
    );
  });

  it("adds 'cart_sent' via ALTER TYPE ... ADD VALUE IF NOT EXISTS", () => {
    expect(MIGRATION).toMatch(
      /ALTER TYPE nex\.discovery_signal_type ADD VALUE IF NOT EXISTS 'cart_sent'/,
    );
  });

  it("does NOT introduce any marketing consent / preference change", () => {
    expect(MIGRATION).not.toMatch(/marketing_enabled\s*=\s*(true|TRUE)/);
    expect(MIGRATION).not.toMatch(/UPDATE\s+nex_account_notification_prefs/);
    expect(MIGRATION).not.toMatch(/ALTER TABLE\s+nex_account_notification_prefs/);
  });

  it("does NOT touch RLS policies, grants, indexes or the table definition", () => {
    expect(MIGRATION).not.toMatch(/CREATE POLICY/);
    expect(MIGRATION).not.toMatch(/DROP POLICY/);
    expect(MIGRATION).not.toMatch(/ALTER TABLE\s+nex\.discovery_signal/);
    expect(MIGRATION).not.toMatch(/CREATE INDEX/);
    expect(MIGRATION).not.toMatch(/DROP INDEX/);
    expect(MIGRATION).not.toMatch(/GRANT\s+/);
  });

  it("does NOT drop or modify the ENUM type itself (append-only semantics)", () => {
    expect(MIGRATION).not.toMatch(/DROP TYPE\s+nex\.discovery_signal_type/);
    expect(MIGRATION).not.toMatch(
      /ALTER TYPE nex\.discovery_signal_type\s+(RENAME|DROP|SET)/,
    );
  });

  it("re-affirms the MARKETING-LAYER-ONLY boundary", () => {
    expect(MIGRATION).toMatch(/MARKETING-LAYER ONLY/);
    expect(MIGRATION).toMatch(/Intelligence/);
    expect(MIGRATION).toMatch(/Directory/);
  });

  it("does NOT claim writer-level behaviour (schema-only disclaimer)", () => {
    expect(MIGRATION).toMatch(/PURELY SCHEMA/);
    expect(MIGRATION).toMatch(/does NOT guarantee that\s*\n--\s*any action currently emits/);
  });

  it("explicitly flags Slice 1D as a separate authorisation", () => {
    expect(MIGRATION).toMatch(/Slice 1D/);
  });

  it("does NOT make a retention / deletion promise beyond Migration 208 posture", () => {
    expect(MIGRATION).not.toMatch(/CREATE OR REPLACE FUNCTION .*purge/i);
    expect(MIGRATION).not.toMatch(/CREATE TRIGGER .*delete/i);
    expect(MIGRATION).toMatch(/retention posture[\s\S]*?unchanged/i);
  });
});

/* ─── 2 · TS enum source-shape ───────────────────────────────── */

describe("Slice 1C · DISCOVERY_SIGNAL_TYPES · source-shape (TS file as text)", () => {
  it("contains the string literal 'enquiry_initiated' as an array entry", () => {
    expect(TS_ENUM_FILE).toMatch(/"enquiry_initiated",/);
  });

  it("contains the string literal 'cart_sent' as an array entry", () => {
    expect(TS_ENUM_FILE).toMatch(/"cart_sent",/);
  });

  it("preserves all pre-existing enum values (no removal)", () => {
    for (const legacy of ["view", "tap", "chat_open", "save", "dismiss"]) {
      expect(TS_ENUM_FILE).toMatch(new RegExp(`"${legacy}",`));
    }
  });

  it("declares the sync requirement with Migration 216", () => {
    expect(TS_ENUM_FILE).toMatch(/Migration 216|Migrations 208 \+ 216/);
  });

  it("names Slice 1D as the writer-wiring slice (not this one)", () => {
    expect(TS_ENUM_FILE).toMatch(/Writer wiring is Slice 1D/);
  });
});

/* ─── 3 · Contract tests · pure in-process, zero DB ─────────── */

describe("Slice 1C · isDiscoverySignalType contract · pure", () => {
  it("accepts the two new signal types", () => {
    expect(isDiscoverySignalType("enquiry_initiated")).toBe(true);
    expect(isDiscoverySignalType("cart_sent")).toBe(true);
  });

  it("continues to accept all pre-existing signal types", () => {
    expect(isDiscoverySignalType("view")).toBe(true);
    expect(isDiscoverySignalType("tap")).toBe(true);
    expect(isDiscoverySignalType("chat_open")).toBe(true);
    expect(isDiscoverySignalType("save")).toBe(true);
    expect(isDiscoverySignalType("dismiss")).toBe(true);
  });

  it("rejects unknown strings", () => {
    expect(isDiscoverySignalType("")).toBe(false);
    expect(isDiscoverySignalType("ENQUIRY_INITIATED")).toBe(false);
    expect(isDiscoverySignalType("Cart_Sent")).toBe(false);
    expect(isDiscoverySignalType("purchase_completed")).toBe(false);
    expect(isDiscoverySignalType("enquiry")).toBe(false);
  });

  it("rejects non-string inputs", () => {
    expect(isDiscoverySignalType(undefined)).toBe(false);
    expect(isDiscoverySignalType(null)).toBe(false);
    expect(isDiscoverySignalType(42)).toBe(false);
    expect(isDiscoverySignalType({})).toBe(false);
    expect(isDiscoverySignalType([])).toBe(false);
  });

  it("exposes DISCOVERY_SIGNAL_TYPES with exactly seven canonical members", () => {
    expect(DISCOVERY_SIGNAL_TYPES).toHaveLength(7);
    expect(DISCOVERY_SIGNAL_TYPES).toContain("view");
    expect(DISCOVERY_SIGNAL_TYPES).toContain("tap");
    expect(DISCOVERY_SIGNAL_TYPES).toContain("chat_open");
    expect(DISCOVERY_SIGNAL_TYPES).toContain("save");
    expect(DISCOVERY_SIGNAL_TYPES).toContain("dismiss");
    expect(DISCOVERY_SIGNAL_TYPES).toContain("enquiry_initiated");
    expect(DISCOVERY_SIGNAL_TYPES).toContain("cart_sent");
  });

  it("DISCOVERY_SIGNAL_TYPES has no duplicate entries", () => {
    expect(new Set(DISCOVERY_SIGNAL_TYPES).size).toBe(
      DISCOVERY_SIGNAL_TYPES.length,
    );
  });

  it("preserves the existing TS DiscoverySignalType union (compile-time only · narrowing works)", () => {
    const enq: DiscoverySignalType = "enquiry_initiated";
    const cart: DiscoverySignalType = "cart_sent";
    const legacy: DiscoverySignalType = "chat_open";
    expect(enq).toBe("enquiry_initiated");
    expect(cart).toBe("cart_sent");
    expect(legacy).toBe("chat_open");
  });
});

/* ─── 4 · Explicit non-claims (what Slice 1C does NOT prove) ─ */

describe("Slice 1C · explicit boundary · what this file does NOT prove", () => {
  it("does NOT execute SQL against any database", () => {
    // Marker test · if a future contributor adds DB execution here,
    // they must update this comment AND the owner must authorise
    // the sandbox apply. The migration remains unapplied.
    expect(MIGRATION).toMatch(/NOT YET APPLIED/);
  });

  it("does NOT verify that any action emits the new signal types (Slice 1D scope)", () => {
    expect(TS_ENUM_FILE).toMatch(/Writer wiring is Slice 1D/);
  });

  it("does NOT demonstrate concurrent-insert behaviour (would require a real DB)", () => {
    // Record of the limitation · a future test that spins up a real
    // PG instance can supersede this marker, under a separate
    // authorisation.
    expect(true).toBe(true);
  });
});
