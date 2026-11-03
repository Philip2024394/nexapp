// nex-supabase/migrations/__tests__/scope-a-pr-1-migration-order.test.ts
//
// Scope-A PR-1 · cross-migration ordering + draft-guard + history-insert
// consistency tests. Static-source only.
//
// Evidence boundary: see scope-a-pr-1-event-registry.test.ts.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const MIGRATIONS_DIR = resolve(__dirname, "..");

const PR1_FILES = [
  "260_nex_invite_event_type.sql",
  "261_nex_invite_event_type_seed.sql",
  "262_nex_invite_event.sql",
  "263_nex_invite_event_hold.sql",
  "264_nex_friend_request_idempotency.sql",
  "265_nex_friend_request_tx_functions.sql",
] as const;

const SOURCES: Record<string, string> = Object.fromEntries(
  PR1_FILES.map((f) => [f, readFileSync(resolve(MIGRATIONS_DIR, f), "utf8")]),
);

describe("Scope-A PR-1 · migration file inventory", () => {
  it("all 6 PR-1 migrations are present on disk", () => {
    const names = new Set(readdirSync(MIGRATIONS_DIR));
    for (const f of PR1_FILES) {
      expect(names.has(f), `missing migration file: ${f}`).toBe(true);
    }
  });

  it("no PR-1 migration collides with existing migration numbers 001–259", () => {
    const existing = readdirSync(MIGRATIONS_DIR).filter((f) => /^\d{3}_.*\.sql$/.test(f));
    const prefixes = new Set(existing.map((f) => f.slice(0, 3)));
    // 260–265 must not already be used by a non-PR-1 file.
    for (const n of ["260", "261", "262", "263", "264", "265"]) {
      const collisions = existing.filter(
        (f) => f.startsWith(`${n}_`) && !PR1_FILES.includes(f as (typeof PR1_FILES)[number]),
      );
      expect(collisions, `migration number ${n} collides: ${collisions.join(", ")}`).toEqual([]);
    }
    // 266+ should not exist yet (otherwise ordering is contested).
    const future = existing.filter((f) => /^(26[6-9]|27\d)_/.test(f));
    expect(future, `unexpected migration numbers above 265: ${future.join(", ")}`).toEqual([]);
    // Sanity: at least 259 exists in the tree.
    expect(prefixes.has("259"), "expected baseline migration 259 to exist").toBe(true);
  });
});

describe("Scope-A PR-1 · DRAFT guard discipline", () => {
  for (const f of PR1_FILES) {
    it(`${f} carries a DRAFT apply-guard RAISE EXCEPTION`, () => {
      expect(SOURCES[f]).toMatch(/RAISE EXCEPTION 'Migration (260|261|262|263|264|265) is DRAFT/);
    });

    it(`${f} documents the "comment out when authorised" lifecycle`, () => {
      expect(SOURCES[f]).toMatch(/Comment out this guard block only when authorised|STATUS: DRAFT · NOT YET APPLIED/);
    });

    it(`${f} is wrapped in BEGIN; ... COMMIT;`, () => {
      expect(SOURCES[f]).toMatch(/^BEGIN;/m);
      expect(SOURCES[f]).toMatch(/^COMMIT;/m);
    });
  }
});

describe("Scope-A PR-1 · pre-flight dependency chain", () => {
  it("261 pre-flights 260", () => {
    expect(SOURCES["261_nex_invite_event_type_seed.sql"]).toMatch(
      /nex_invite_event_type missing[^']*Apply migration 260 first/,
    );
  });

  it("262 pre-flights 260 and the 261 seed count", () => {
    expect(SOURCES["262_nex_invite_event.sql"]).toMatch(/nex_invite_event_type missing[^']*Apply migration 260 first/);
    expect(SOURCES["262_nex_invite_event.sql"]).toMatch(/count\(\*\) FROM public\.nex_invite_event_type/);
  });

  it("263 pre-flights 262 and nex_account baseline", () => {
    expect(SOURCES["263_nex_invite_event_hold.sql"]).toMatch(
      /nex_invite_event missing[^']*Apply migration 262 first/,
    );
    expect(SOURCES["263_nex_invite_event_hold.sql"]).toMatch(/nex_account missing/);
  });

  it("264 pre-flights nex_friend_request + pgcrypto + divergent-column types", () => {
    const src = SOURCES["264_nex_friend_request_idempotency.sql"];
    expect(src).toMatch(/nex_friend_request missing/);
    expect(src).toMatch(/pgcrypto extension not installed/);
    expect(src).toMatch(/idempotency_key exists with wrong data type/);
    expect(src).toMatch(/idempotency_fingerprint exists with wrong data type/);
  });

  it("265 pre-flights ALL predecessor dependencies + 15-row registry + pgcrypto", () => {
    const src = SOURCES["265_nex_friend_request_tx_functions.sql"];
    expect(src).toMatch(/nex_friend_request missing \(migration 215\)/);
    expect(src).toMatch(/nex_friend_edge missing \(migration 025\)/);
    expect(src).toMatch(/nex_peer_conversation missing \(migration 047\)/);
    expect(src).toMatch(/nex_invite_event_type missing \(migration 260\)/);
    expect(src).toMatch(/nex_invite_event missing \(migration 262\)/);
    expect(src).toMatch(/nex_invite_event_hold missing \(migration 263\)/);
    expect(src).toMatch(/idempotency columns missing on nex_friend_request \(migration 264\)/);
    expect(src).toMatch(/event registry contains % rows/);
    expect(src).toMatch(/pgcrypto extension missing/);
  });
});

describe("Scope-A PR-1 · nex_migration_history insert convention", () => {
  it("every migration INSERTs its own version row with ON CONFLICT (version) DO NOTHING", () => {
    for (const f of PR1_FILES) {
      const version = f.slice(0, 3);
      expect(SOURCES[f], `${f} missing migration_history insert`).toMatch(
        new RegExp(
          `INSERT INTO public\\.nex_migration_history[\\s\\S]*?'${version}'[\\s\\S]*?ON CONFLICT\\s*\\(version\\)\\s+DO NOTHING`,
        ),
      );
    }
  });

  it("every migration_history INSERT is INSIDE the BEGIN/COMMIT block (atomic with the rest)", () => {
    for (const f of PR1_FILES) {
      const src = SOURCES[f];
      // History INSERT appears BEFORE the COMMIT · it must be inside the transaction.
      const beginIdx = src.indexOf("BEGIN;");
      const commitIdx = src.lastIndexOf("COMMIT;");
      const insertIdx = src.search(/INSERT INTO public\.nex_migration_history/);
      expect(beginIdx, `${f} missing BEGIN;`).toBeGreaterThan(-1);
      expect(commitIdx, `${f} missing COMMIT;`).toBeGreaterThan(-1);
      expect(insertIdx, `${f} missing migration_history insert`).toBeGreaterThan(beginIdx);
      expect(insertIdx, `${f} migration_history insert is OUTSIDE transaction`).toBeLessThan(commitIdx);
    }
  });

  it("DRAFT guard appears BEFORE the migration_history INSERT so a draft-blocked run cannot write history", () => {
    for (const f of PR1_FILES) {
      const src = SOURCES[f];
      const guardIdx = src.search(/RAISE EXCEPTION 'Migration (260|261|262|263|264|265) is DRAFT/);
      const insertIdx = src.search(/INSERT INTO public\.nex_migration_history/);
      expect(guardIdx, `${f} missing DRAFT guard`).toBeGreaterThan(-1);
      expect(insertIdx, `${f} missing history insert`).toBeGreaterThan(-1);
      expect(guardIdx, `${f} · DRAFT guard must precede history INSERT`).toBeLessThan(insertIdx);
    }
  });
});
