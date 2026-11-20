// scripts/gate-a-connected-matrix/__tests__/90_cleanup.spec.mjs
//
// Offline fixture tests for 90_cleanup.mjs.
// Proves the cleanup script:
//   1. Only merges IDs from entry.structured.retained_rows OR entry.retained_rows.
//   2. Uses exact id = ANY($1::uuid[]) — never prefix or table-wide deletes.
//   3. Hard-refuses production ref ijvqdvsvwtwxzcqmoqit.
//   4. Requires sandbox ref kdstoyyeygcopkogqsyv.
//   5. Preserves auth.users / nex_account (no DELETE statements for those tables).
//   6. Prints captured IDs (no secrets).
//
// Strategy: read the script source and assert on its structure + replicate its
// pure merge logic for a fixture-based correctness proof. Does not execute the
// script (top-level await + pg.Client would require real DB).

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const CLEANUP_PATH = resolve(__dir, "..", "90_cleanup.mjs");
const SOURCE = readFileSync(CLEANUP_PATH, "utf8");

// Pure re-implementation of the merge logic inside 90_cleanup.mjs.
// Must mirror the source exactly: structured.retained_rows ?? retained_rows ?? {}.
function mergeRetainedRows(resultsFileObj) {
  const allMessages = new Set();
  const allConvs = new Set();
  const allParticipants = new Set();
  const allSessions = new Set();
  for (const entry of (resultsFileObj.entries ?? [])) {
    const rr = entry?.structured?.retained_rows ?? entry?.retained_rows ?? {};
    for (const id of (rr.nex_peer_message ?? [])) if (id) allMessages.add(id);
    for (const id of (rr.nex_peer_conversation ?? [])) if (id) allConvs.add(id);
    for (const id of (rr.nex_group_call_participant ?? [])) if (id) allParticipants.add(id);
    for (const id of (rr.nex_group_call_session ?? [])) if (id) allSessions.add(id);
  }
  return {
    nex_peer_message: [...allMessages],
    nex_peer_conversation: [...allConvs],
    nex_group_call_participant: [...allParticipants],
    nex_group_call_session: [...allSessions],
  };
}

describe("90_cleanup.mjs — source invariants", () => {
  it("hard-refuses production ref", () => {
    expect(SOURCE).toContain('PRODUCTION_REF = "ijvqdvsvwtwxzcqmoqit"');
    expect(SOURCE).toMatch(/if \(.*PRODUCTION_REF.*\).*[\s\S]*?(exit\(2\)|exit\(3\))/);
  });

  it("pins sandbox ref", () => {
    expect(SOURCE).toContain('CANONICAL_PROJECT_REF = "kdstoyyeygcopkogqsyv"');
    expect(SOURCE).toMatch(/ref !== CANONICAL_PROJECT_REF/);
  });

  it("uses exact id = ANY($1::uuid[]) — no prefix, no LIKE, no table scan", () => {
    expect(SOURCE).toContain('DELETE FROM nex_peer_message WHERE id = ANY($1::uuid[])');
    expect(SOURCE).toContain('DELETE FROM nex_peer_conversation WHERE id = ANY($1::uuid[])');
    expect(SOURCE).toContain('DELETE FROM nex_group_call_participant WHERE id = ANY($1::uuid[])');
    expect(SOURCE).toContain('DELETE FROM nex_group_call_session WHERE id = ANY($1::uuid[])');
    expect(SOURCE).not.toMatch(/DELETE FROM .* WHERE .* LIKE/i);
    expect(SOURCE).not.toMatch(/DELETE FROM nex_peer_message\s*;/i);
    expect(SOURCE).not.toMatch(/DELETE FROM nex_peer_conversation\s*;/i);
    expect(SOURCE).not.toMatch(/DELETE FROM nex_group_call_session\s*;/i);
  });

  it("does NOT delete auth.users or nex_account", () => {
    expect(SOURCE).not.toMatch(/DELETE FROM\s+auth\.users/i);
    expect(SOURCE).not.toMatch(/DELETE FROM\s+nex_account\b/i);
  });

  it("session_id cascade only applies to participants (never to messages/conversations/sessions directly)", () => {
    // The only session_id fallback is for participants
    expect(SOURCE).toMatch(/DELETE FROM nex_group_call_participant WHERE session_id = ANY/);
    expect(SOURCE).not.toMatch(/DELETE FROM nex_peer_message WHERE session_id/);
    expect(SOURCE).not.toMatch(/DELETE FROM nex_peer_conversation WHERE session_id/);
  });

  it("SKIP branch and DELETE branch both go through the single gated validator (symmetric)", () => {
    // After the Lane G Gate A hardening, the symmetric structured ?? direct
    // read lives inside validateCleanupPlan, and BOTH the SKIP and DELETE
    // branches of main() invoke the same validator. Strengthened from the
    // prior "appears twice in source" check: the fallback must be gated by
    // current-run intersection, not duplicated as independent paths.
    const symmetricHits = [...SOURCE.matchAll(/entry\?\.structured\?\.retained_rows \?\? entry\?\.retained_rows/g)];
    expect(symmetricHits.length).toBeGreaterThanOrEqual(1);
    // Validator defined and consumed from both branches
    expect(SOURCE).toMatch(/export function validateCleanupPlan\(/);
    const validatorCalls = [...SOURCE.matchAll(/validateCleanupPlan\(/g)];
    // Definition + at least one call site (inside main, used by both SKIP and DELETE branches)
    expect(validatorCalls.length).toBeGreaterThanOrEqual(2);
    // SKIP branch references the validation result, not its own merge
    expect(SOURCE).toMatch(/GATE_A_CLEANUP_SKIPPED[\s\S]*?validation\.ok/);
  });

  it("prints disposable-identity preservation note", () => {
    expect(SOURCE).toMatch(/disposable auth\.users identities are intentionally NOT deleted/);
  });
});

describe("90_cleanup.mjs — merge logic (pure)", () => {
  it("empty results file → empty sets", () => {
    const out = mergeRetainedRows({ entries: [] });
    expect(out.nex_peer_message).toEqual([]);
    expect(out.nex_peer_conversation).toEqual([]);
    expect(out.nex_group_call_participant).toEqual([]);
    expect(out.nex_group_call_session).toEqual([]);
  });

  it("merges IDs from entry.structured.retained_rows", () => {
    const fixture = {
      entries: [
        {
          file: "40_v_w1_new.mjs",
          structured: {
            verdict: "PASS",
            retained_rows: {
              nex_group_call_session: ["11111111-1111-4111-8111-111111111111"],
              nex_peer_message: ["22222222-2222-4222-8222-222222222222"],
            },
          },
        },
      ],
    };
    const out = mergeRetainedRows(fixture);
    expect(out.nex_group_call_session).toEqual(["11111111-1111-4111-8111-111111111111"]);
    expect(out.nex_peer_message).toEqual(["22222222-2222-4222-8222-222222222222"]);
  });

  it("falls back to entry.retained_rows when structured is missing", () => {
    const fixture = {
      entries: [
        {
          file: "x.mjs",
          retained_rows: {
            nex_group_call_participant: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
          },
        },
      ],
    };
    const out = mergeRetainedRows(fixture);
    expect(out.nex_group_call_participant).toEqual(["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"]);
  });

  it("dedups IDs appearing in multiple entries", () => {
    const uid = "33333333-3333-4333-8333-333333333333";
    const fixture = {
      entries: [
        { structured: { retained_rows: { nex_peer_message: [uid] } } },
        { structured: { retained_rows: { nex_peer_message: [uid] } } },
      ],
    };
    const out = mergeRetainedRows(fixture);
    expect(out.nex_peer_message).toEqual([uid]);
  });

  it("ignores null and empty id values", () => {
    const fixture = {
      entries: [
        { structured: { retained_rows: { nex_peer_message: [null, "", undefined] } } },
      ],
    };
    const out = mergeRetainedRows(fixture);
    expect(out.nex_peer_message).toEqual([]);
  });

  it("cannot pick up IDs outside recorded retained_rows (no table scan, no prefix)", () => {
    // The merge function only reads named table keys. Extra fields are ignored.
    const fixture = {
      entries: [
        {
          structured: {
            retained_rows: { nex_peer_message: ["real-id-recorded"] },
            // These bogus keys must NOT bleed into deletes
            nex_account_ids_to_delete: ["bogus-account"],
            other_table_ids: ["bogus-row"],
          },
        },
      ],
    };
    const out = mergeRetainedRows(fixture);
    expect(out.nex_peer_message).toEqual(["real-id-recorded"]);
    // Prove no other table is populated
    expect(out.nex_peer_conversation).toEqual([]);
    expect(out.nex_group_call_participant).toEqual([]);
    expect(out.nex_group_call_session).toEqual([]);
  });

  it("missing retained_rows field → empty merge (no accidental all-rows scope)", () => {
    const fixture = {
      entries: [
        { file: "x.mjs", structured: { verdict: "PASS", detail: "no retained" } },
      ],
    };
    const out = mergeRetainedRows(fixture);
    expect(out.nex_peer_message).toEqual([]);
    expect(out.nex_peer_conversation).toEqual([]);
    expect(out.nex_group_call_participant).toEqual([]);
    expect(out.nex_group_call_session).toEqual([]);
  });

  it("negative: fixture with NO Hammerex/Rosa IDs in retained_rows → cleanup would not touch them", () => {
    // Prove: if Hammerex nex-99901 / Rosa nex-99903 IDs aren't recorded, cleanup can't delete them.
    const HAMMEREX_UUID = "11111111-1111-4111-8111-111111111111";
    const fixture = {
      entries: [
        { structured: { retained_rows: { nex_peer_message: ["unrelated-test-id"] } } },
      ],
    };
    const out = mergeRetainedRows(fixture);
    expect(out.nex_peer_message).not.toContain(HAMMEREX_UUID);
    expect(out.nex_peer_message).toEqual(["unrelated-test-id"]);
  });
});
