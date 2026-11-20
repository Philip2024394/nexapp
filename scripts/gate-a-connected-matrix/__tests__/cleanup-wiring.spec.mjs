// scripts/gate-a-connected-matrix/__tests__/cleanup-wiring.spec.mjs
//
// §16.48.19 · Proves assertIdentityDeletable is wired into 90_cleanup.mjs
// before any client.connect() or query().
//
// Approach: spawn 90_cleanup.mjs as a real child process, redirect its
// capture + results + .env.local lookups into a temp dir, use
// GATE_A_CLEANUP_PG_STUB=1 to substitute a recording pg.Client (no network),
// and inspect:
//   • exit code
//   • stderr/stdout for refusal name
//   • the pg stub call log (presence/absence, count, kind)
//
// Scenarios:
//   1. Happy path · three approved fixtures · exactly one connect + one
//      end + one DELETE per non-empty table (nex_peer_message in this
//      fixture set); final JSON verdict CLEANUP_COMPLETE.
//   2. Hammerex in fixture · refused by validateCleanupPlan with
//      FORBIDDEN_IDENTITY_IN_MANIFEST · stub log file is absent (client
//      never instantiated) · exit code 4.
//   3. Rosa in fixture · same shape as (2).
//   4. Foreign provenance_tag on fixture · refused by validateCleanupPlan
//      with MISSING_OR_FOREIGN_PROVENANCE_TAG · stub log absent · exit 4.
//   5. GATE_A_CLEANUP_LIST_ONLY=1 happy path · prints per-fixture verdict,
//      final JSON CLEANUP_LIST_ONLY, stub log ABSENT (list-only never
//      reaches the client branch); exit 0.
//   6. GATE_A_CLEANUP_LIST_ONLY=1 with a poisoned manifest · still refused
//      by validateCleanupPlan BEFORE the list-only branch runs (because
//      the whole-plan validator refuses first); exit 4 · stub absent.
//   7. Env grammar · GATE_A_CLEANUP_LIST_ONLY=bogus → exit 2 refusal, raw
//      value NOT printed.
//   8. Env grammar · GATE_A_CLEANUP_PG_STUB=bogus → exit 2 refusal.
//   9. Secret hygiene · no plaintext token / password / jwt appears in
//      stdout+stderr across all above runs.
//
// All runs: mkdtempSync + GATE_A_CAPTURE_FILE/RESULTS overrides.
// Neither pg nor the real sandbox is ever contacted.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync, cpSync, mkdirSync,
} from "node:fs";
import { resolve, dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { randomUUID, randomBytes } from "node:crypto";

const __dir = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(__dir, "..", "90_cleanup.mjs");
const SCRIPT_DIR = resolve(__dir, "..");

const HAMMEREX = "11111111-1111-4111-8111-111111111111";
const ROSA = "11111111-1111-4111-8111-111111111113";

// Run 90_cleanup.mjs with capture + results + stub log directed at per-test
// temp files via env overrides (§16.48.19). No files touched in SCRIPT_DIR.
function runWithCapture({ capture, results, env = {} }) {
  const tmp = mkdtempSync(join(tmpdir(), "gate-a-cleanup-wiring-"));
  const CAPTURE_PATH = join(tmp, "capture.json");
  const RESULTS_PATH = join(tmp, "results.json");
  const STUB_LOG = join(tmp, "pg_stub.log.json");

  writeFileSync(CAPTURE_PATH, JSON.stringify(capture, null, 2), "utf8");
  writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2), "utf8");

  try {
    const out = spawnSync(process.execPath, [SCRIPT], {
      env: {
        PATH: process.env.PATH,
        // Point the script at the per-test temp files. Default PG_STUB=1
        // so no real pg client is ever instantiated by these tests.
        GATE_A_CLEANUP_PG_STUB: "1",
        GATE_A_CLEANUP_CAPTURE_PATH_OVERRIDE: CAPTURE_PATH,
        GATE_A_CLEANUP_RESULTS_PATH_OVERRIDE: RESULTS_PATH,
        GATE_A_CLEANUP_STUB_LOG_OVERRIDE: STUB_LOG,
        ...env,
      },
      encoding: "utf8",
    });
    const stubLogExists = existsSync(STUB_LOG);
    const stubLog = stubLogExists ? JSON.parse(readFileSync(STUB_LOG, "utf8")) : null;
    return { status: out.status, stdout: out.stdout ?? "", stderr: out.stderr ?? "", stubLogExists, stubLog };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function mkCapture({ runId, fixtures, createdAt, provenanceTag }) {
  const prov = provenanceTag ?? `gate-a-${runId}-${randomBytes(4).toString("hex")}`;
  const taggedFixtures = fixtures.map((f) => ({
    ...f,
    provenance_tag: Object.prototype.hasOwnProperty.call(f, "provenance_tag") ? f.provenance_tag : prov,
  }));
  const cap = {
    run_id: runId,
    created_at: createdAt ?? new Date().toISOString(),
    provenance_tag: prov,
    created_fixtures: taggedFixtures,
  };
  for (const f of taggedFixtures) {
    cap[f.label] = {
      status: "OK",
      email: `${f.label.toLowerCase()}@test.invalid`,
      supabase_user_id: f.supabase_user_id,
      nex_account_id: f.dependent_rows?.[0]?.id ?? null,
      nex_account_found: !!f.dependent_rows?.length,
    };
  }
  return cap;
}

function mkResults(runId, retainedByTable = {}) {
  const entries = [];
  for (const [table, ids] of Object.entries(retainedByTable)) {
    entries.push({
      file: `fixture_${table}.mjs`,
      structured: { verdict: "PASS", retained_rows: { [table]: ids } },
    });
  }
  return {
    runner_started_at: new Date().toISOString(),
    canonical_project_ref: "kdstoyyeygcopkogqsyv",
    run_id: runId,
    entries,
  };
}

describe("§16.48.19 · 90_cleanup.mjs wiring — assertIdentityDeletable gates every delete", () => {
  it("1 · happy path · three approved fixtures · exactly one query per non-empty DELETE + connect/end", () => {
    const runId = randomUUID();
    const aUid = randomUUID(), bUid = randomUUID(), cUid = randomUUID();
    const msgA = randomUUID(), msgB = randomUUID();
    const fixtures = [
      { label: "A", supabase_user_id: aUid, dependent_rows: [{ table: "nex_peer_message", id: msgA, owner_user_id: aUid }] },
      { label: "B", supabase_user_id: bUid, dependent_rows: [{ table: "nex_peer_message", id: msgB, owner_user_id: bUid }] },
      { label: "C", supabase_user_id: cUid, dependent_rows: [] },
    ];
    const capture = mkCapture({ runId, fixtures });
    const results = mkResults(runId, { nex_peer_message: [msgA, msgB] });
    const r = runWithCapture({ capture, results, env: { GATE_A_RUN_ID: runId } });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/Guard PASS · 3 fixture identities approved/);
    // Stub log must exist · must show connect + end + exactly one DELETE query
    expect(r.stubLogExists).toBe(true);
    const ops = r.stubLog.map((c) => c.op);
    expect(ops.filter((o) => o === "connect")).toHaveLength(1);
    expect(ops.filter((o) => o === "end")).toHaveLength(1);
    const deletes = r.stubLog.filter((c) => c.op === "query" && /DELETE FROM/i.test(c.sql));
    // msgA + msgB land in nex_peer_message → exactly one DELETE query batch
    // with ids_count = 2 (no additional tables in this fixture).
    expect(deletes).toHaveLength(1);
    expect(deletes[0].sql).toMatch(/DELETE FROM nex_peer_message/i);
    expect(deletes[0].ids_count).toBe(2);
    // Final verdict
    expect(r.stdout).toMatch(/CLEANUP_COMPLETE/);
  });

  it("2 · Hammerex in fixture → FORBIDDEN_IDENTITY_IN_MANIFEST · stub log absent · exit 4", () => {
    const runId = randomUUID();
    const capture = mkCapture({
      runId,
      fixtures: [{ label: "A", supabase_user_id: HAMMEREX, dependent_rows: [] }],
    });
    const results = mkResults(runId);
    const r = runWithCapture({ capture, results, env: { GATE_A_RUN_ID: runId } });
    expect(r.status).toBe(4);
    expect(r.stderr + r.stdout).toMatch(/FORBIDDEN_IDENTITY_IN_MANIFEST/);
    expect(r.stubLogExists).toBe(false);
  });

  it("3 · Rosa in fixture → FORBIDDEN_IDENTITY_IN_MANIFEST · stub log absent · exit 4", () => {
    const runId = randomUUID();
    const capture = mkCapture({
      runId,
      fixtures: [{ label: "A", supabase_user_id: ROSA, dependent_rows: [] }],
    });
    const results = mkResults(runId);
    const r = runWithCapture({ capture, results, env: { GATE_A_RUN_ID: runId } });
    expect(r.status).toBe(4);
    expect(r.stderr + r.stdout).toMatch(/FORBIDDEN_IDENTITY_IN_MANIFEST/);
    expect(r.stubLogExists).toBe(false);
  });

  it("4 · foreign provenance_tag on fixture → MISSING_OR_FOREIGN_PROVENANCE_TAG · stub log absent · exit 4", () => {
    const runId = randomUUID();
    const aUid = randomUUID();
    const capture = mkCapture({
      runId,
      fixtures: [{ label: "A", supabase_user_id: aUid, dependent_rows: [], provenance_tag: "not-a-gate-a-tag" }],
    });
    const results = mkResults(runId);
    const r = runWithCapture({ capture, results, env: { GATE_A_RUN_ID: runId } });
    expect(r.status).toBe(4);
    expect(r.stderr + r.stdout).toMatch(/MISSING_OR_FOREIGN_PROVENANCE_TAG/);
    expect(r.stubLogExists).toBe(false);
  });

  it("5 · LIST_ONLY=1 · happy path · verdict CLEANUP_LIST_ONLY · stub log absent · exit 0", () => {
    const runId = randomUUID();
    const aUid = randomUUID(), bUid = randomUUID();
    const capture = mkCapture({
      runId,
      fixtures: [
        { label: "A", supabase_user_id: aUid, dependent_rows: [] },
        { label: "B", supabase_user_id: bUid, dependent_rows: [] },
      ],
    });
    const results = mkResults(runId);
    const r = runWithCapture({
      capture, results,
      env: { GATE_A_RUN_ID: runId, GATE_A_CLEANUP_LIST_ONLY: "1" },
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/CLEANUP LIST-ONLY/);
    expect(r.stdout).toMatch(/CLEANUP_LIST_ONLY/);
    expect(r.stubLogExists).toBe(false);
  });

  it("6 · LIST_ONLY=1 · poisoned manifest · still refused before the list-only branch · exit 4", () => {
    const runId = randomUUID();
    const capture = mkCapture({
      runId,
      fixtures: [{ label: "A", supabase_user_id: HAMMEREX, dependent_rows: [] }],
    });
    const results = mkResults(runId);
    const r = runWithCapture({
      capture, results,
      env: { GATE_A_RUN_ID: runId, GATE_A_CLEANUP_LIST_ONLY: "1" },
    });
    expect(r.status).toBe(4);
    expect(r.stderr + r.stdout).toMatch(/FORBIDDEN_IDENTITY_IN_MANIFEST/);
    expect(r.stubLogExists).toBe(false);
  });

  it("7 · env grammar · GATE_A_CLEANUP_LIST_ONLY=bogus → exit 2 · raw token NOT printed", () => {
    const runId = randomUUID();
    const aUid = randomUUID();
    const capture = mkCapture({ runId, fixtures: [{ label: "A", supabase_user_id: aUid, dependent_rows: [] }] });
    const results = mkResults(runId);
    const r = runWithCapture({
      capture, results,
      env: { GATE_A_RUN_ID: runId, GATE_A_CLEANUP_LIST_ONLY: "bogus-xyz-token" },
    });
    expect(r.status).toBe(2);
    expect(r.stderr + r.stdout).not.toMatch(/bogus-xyz-token/);
    expect(r.stderr).toMatch(/GATE_A_CLEANUP_LIST_ONLY has an unrecognised value/);
  });

  it("8 · env grammar · GATE_A_CLEANUP_PG_STUB=bogus → exit 2", () => {
    const runId = randomUUID();
    const aUid = randomUUID();
    const capture = mkCapture({ runId, fixtures: [{ label: "A", supabase_user_id: aUid, dependent_rows: [] }] });
    const results = mkResults(runId);
    const r = runWithCapture({
      capture, results,
      env: { GATE_A_RUN_ID: runId, GATE_A_CLEANUP_PG_STUB: "bogus-stub-flag" },
    });
    expect(r.status).toBe(2);
    expect(r.stderr + r.stdout).not.toMatch(/bogus-stub-flag/);
    expect(r.stderr).toMatch(/GATE_A_CLEANUP_PG_STUB has an unrecognised value/);
  });

  it("9 · secret hygiene · no plaintext token/password/jwt in combined stdout+stderr across refusal paths", () => {
    const runId = randomUUID();
    // Build one refusal run (Hammerex) and inspect its output
    const capture = mkCapture({
      runId,
      fixtures: [{ label: "A", supabase_user_id: HAMMEREX, dependent_rows: [] }],
    });
    const results = mkResults(runId);
    const r = runWithCapture({ capture, results, env: { GATE_A_RUN_ID: runId } });
    const combined = (r.stdout + r.stderr).toLowerCase();
    expect(combined).not.toMatch(/\bpassword\s*[:=]/);
    expect(combined).not.toMatch(/\btoken\s*[:=]/);
    expect(combined).not.toMatch(/\bjwt\s*[:=]/);
    expect(combined).not.toMatch(/\baccess[_-]?token\s*[:=]/);
    expect(combined).not.toMatch(/\brefresh[_-]?token\s*[:=]/);
    expect(combined).not.toMatch(/\bservice[_-]?role[_-]?key/);
    expect(combined).not.toMatch(/\banon[_-]?key/);
    expect(combined).not.toMatch(/\bapi[_-]?key\s*[:=]/);
  });
});
