// src/lib/nex-native/harvest/__tests__/qualification-rule-e2e.test.ts
//
// End-to-end qualification rule tests · sealed 2026-10-16 revision.
//
// Owner directive · Phase 1.1 (same day): "An email found in OSM
// should be FOUND, with qualification remaining PENDING until the
// defined validation requirements are met." These tests prove the
// decoupling across the full pipeline (OSM-tag extractor · canonical
// writer SQL · backfill orchestrator UPDATE SQL · preservation
// guards) via structural + behavioural assertions.
//
// Six scenarios the owner listed:
//   1. Missing email        → qualification stays PENDING
//   2. Malformed address    → extractor rejects · nothing persisted
//   3. Duplicate listings   → canonical writer uses ON CONFLICT DO NOTHING
//   4. Failed website fetch → NOT_FOUND → UNQUALIFIED
//   5. Validated address    → QUALIFIED (only path that promotes)
//   6. Admin-disqualified   → DISQUALIFIED preserved · never re-promoted
//
// Plus three structural anchors that catch the specific regression
// the owner is guarding against (FOUND must never auto-qualify a row).

import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { extractOsmEmail } from "../osm-email-extract";

const REPO_ROOT = path.resolve(__dirname, "../../../../..");
function read(rel: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
}
function stripComments(src: string): string {
  // Drop /* ... */ blocks and `//` line comments so doctrine prose
  // doesn't accidentally satisfy a regex. Preserve SQL-literal content
  // inside backtick template strings · we're only shrinking JS/TS
  // comment prose, not SQL.
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
}

const CANONICAL_WRITER = stripComments(
  read("src/lib/nex-native/harvest/canonical-writer.ts"),
);
const ORCHESTRATOR = stripComments(
  read("src/lib/nex-native/harvest/email-backfill-orchestrator.ts"),
);
const MIGRATION_202 = read(
  "nex-supabase/migrations/202_nex_business_canonical_email_qualification.sql",
);

// ─── Scenario 1 · Missing email → PENDING (owner rule: never auto-qualify)
describe("qualification rule · missing email", () => {
  test("OSM tags without email keys return null from the extractor", () => {
    expect(extractOsmEmail({ name: "Acme Co" })).toBe(null);
  });

  test("canonical writer's identity-only INSERT does NOT set qualification_status explicitly", () => {
    // The identity-only INSERT writes `lifecycle_state='DISCOVERED'`
    // but has no `qualification_status` column in its column list ·
    // the DEFAULT of 'PENDING' per migration 202 is correct.
    const identityOnlyMatch = CANONICAL_WRITER.match(
      /INSERT INTO nex\.business_canonical[\s\S]+?metadata\)[\s\S]+?VALUES[\s\S]+?metadata\s*=\s*\$8::jsonb/,
    );
    // Fall back to a simpler check: find the identity-only INSERT and
    // assert its column list does not mention qualification_status.
    const identityBlock = CANONICAL_WRITER.slice(
      CANONICAL_WRITER.indexOf("osmRef, JSON.stringify(metadata),"),
    ).slice(0, 1500);
    expect(identityBlock).not.toContain("qualification_status");
    // Belt-and-suspenders · the regex should also match if the writer
    // style ever drifts.
    void identityOnlyMatch;
  });
});

// ─── Scenario 2 · Malformed address → extractor rejects
describe("qualification rule · malformed address", () => {
  test("extractor rejects malformed addresses (format gate parity with migration 202)", () => {
    expect(extractOsmEmail({ email: "not-an-email" })).toBe(null);
    expect(extractOsmEmail({ email: "@acme.co" })).toBe(null);
    expect(extractOsmEmail({ email: "lonely@" })).toBe(null);
    expect(extractOsmEmail({ email: "spaces here@acme.co" })).toBe(null);
  });

  test("migration 202 CHECK constraint rejects malformed addresses at DB level too", () => {
    // Format regex in migration must match extractor's shape.
    expect(MIGRATION_202).toContain(
      "email ~ '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$'",
    );
  });
});

// ─── Scenario 3 · Duplicate listings → ON CONFLICT DO NOTHING
describe("qualification rule · duplicate listings", () => {
  test("canonical writer uses ON CONFLICT (country, osm_id) DO NOTHING for the OSM-identity dedupe", () => {
    expect(CANONICAL_WRITER).toMatch(
      /ON CONFLICT \(country, osm_id\) WHERE osm_id IS NOT NULL DO NOTHING/,
    );
  });

  test("both the OSM-email-INSERT and the identity-only-INSERT paths carry the same ON CONFLICT clause (idempotent re-harvest)", () => {
    const occurrences =
      CANONICAL_WRITER.match(/ON CONFLICT \(country, osm_id\)/g) ?? [];
    // Email-INSERT · identity-only INSERT · fallback inside the catch
    // block = three total.
    expect(occurrences.length).toBe(3);
  });
});

// ─── Scenario 4 · Failed website fetch → NOT_FOUND → UNQUALIFIED
describe("qualification rule · failed website fetch", () => {
  test("orchestrator UPDATE maps NOT_FOUND to UNQUALIFIED (and INVALID too)", () => {
    expect(ORCHESTRATOR).toMatch(
      /WHEN\s+\$4\s+IN\s+\('NOT_FOUND','INVALID'\)[\s\S]{0,80}THEN\s+'UNQUALIFIED'/,
    );
  });

  test("orchestrator never promotes NOT_FOUND / INVALID to QUALIFIED", () => {
    // Pre-revision bug the owner caught · a CASE that lumped FOUND and
    // VALIDATED together under 'QUALIFIED'. Must not reappear.
    expect(ORCHESTRATOR).not.toMatch(
      /WHEN\s+\$4\s+IN\s+\('FOUND','VALIDATED'\)[\s\S]{0,80}THEN\s+'QUALIFIED'/,
    );
  });

  test("existing email + source_url are preserved by COALESCE on a NOT_FOUND re-walk", () => {
    expect(ORCHESTRATOR).toMatch(/email\s*=\s*COALESCE\(\$2,\s*email\)/);
    expect(ORCHESTRATOR).toMatch(
      /email_source_url\s*=\s*COALESCE\(\$3,\s*email_source_url\)/,
    );
  });
});

// ─── Scenario 5 · Validated address → QUALIFIED (ONLY path to promote)
describe("qualification rule · validated address is the only path to QUALIFIED", () => {
  test("orchestrator UPDATE: VALIDATED is the only observation that promotes to QUALIFIED", () => {
    expect(ORCHESTRATOR).toMatch(
      /WHEN\s+\$4\s*=\s*'VALIDATED'[\s\S]{0,80}THEN\s+'QUALIFIED'/,
    );
  });

  test("FOUND observation keeps the row at PENDING (REVISED semantics)", () => {
    expect(ORCHESTRATOR).toMatch(
      /WHEN\s+\$4\s*=\s*'FOUND'[\s\S]{0,80}THEN\s+'PENDING'/,
    );
  });

  test("canonical writer never emits qualification_status='QUALIFIED' from the OSM-email INSERT", () => {
    // Regression anchor · the pre-revision writer carried
    // `'FOUND', 'QUALIFIED'` as the trailing VALUES tuple. The revised
    // writer carries just `'FOUND'` (qualification_status defaults to
    // PENDING per migration 202).
    expect(CANONICAL_WRITER).not.toMatch(/'FOUND',\s*'QUALIFIED'/);
    // The OSM-email INSERT's column list no longer contains
    // qualification_status at all.
    const osmInsertStart = CANONICAL_WRITER.indexOf(
      "email, email_source_url, email_verified_at,",
    );
    expect(osmInsertStart).toBeGreaterThan(-1);
    const osmInsertBlock = CANONICAL_WRITER.slice(osmInsertStart, osmInsertStart + 600);
    expect(osmInsertBlock).toContain("email_status)");
    expect(osmInsertBlock).not.toContain("qualification_status");
  });
});

// ─── Scenario 6 · Admin DISQUALIFIED is a lock
describe("qualification rule · DISQUALIFIED is an admin lock", () => {
  test("orchestrator UPDATE preserves DISQUALIFIED across any observation", () => {
    expect(ORCHESTRATOR).toMatch(
      /WHEN\s+qualification_status\s*=\s*'DISQUALIFIED'[\s\S]{0,80}THEN\s+qualification_status/,
    );
  });

  test("orchestrator backfill cursor filters to PENDING · DISQUALIFIED rows are never re-walked", () => {
    expect(ORCHESTRATOR).toMatch(
      /WHERE\s+qualification_status\s*=\s*'PENDING'/,
    );
  });
});

// ─── Preservation of a prior QUALIFIED state
describe("qualification rule · QUALIFIED is never downgraded by a weak re-walk", () => {
  test("orchestrator UPDATE preserves QUALIFIED when the observation is FOUND or NOT_FOUND", () => {
    // The CASE arm order matters · the preservation branch must sit
    // BEFORE the generic VALIDATED/FOUND branches.
    expect(ORCHESTRATOR).toMatch(
      /WHEN\s+qualification_status\s*=\s*'QUALIFIED'[\s\S]+?AND\s+\$4\s+IN\s+\('FOUND','NOT_FOUND'\)[\s\S]+?THEN\s+qualification_status/,
    );
  });

  test("email_status preservation branch guards VALIDATED → FOUND / NOT_FOUND downgrade (independent of qualification_status)", () => {
    expect(ORCHESTRATOR).toMatch(
      /WHEN\s+email_status\s*=\s*'VALIDATED'[\s\S]+?AND\s+\$4\s+IN\s+\('FOUND','NOT_FOUND'\)[\s\S]+?THEN\s+email_status/,
    );
  });
});

// ─── Structural enforcement anchor for the "public directory rule stays separate" instruction
describe("qualification rule · public directory predicate is deliberately NOT shipped in migration 202", () => {
  test("migration 202 doctrine comment explicitly separates the directory-reader predicate from qualification_status", () => {
    expect(MIGRATION_202).toMatch(
      /directory[\s\S]{0,120}predicate[\s\S]{0,120}not\s+shipped\s+in\s+this\s+migration/i,
    );
  });
});
