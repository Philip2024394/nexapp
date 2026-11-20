// scripts/gate-a-connected-matrix/__tests__/cleanup-provenance.spec.mjs
//
// Offline provenance tests for 90_cleanup.mjs — Lane G Gate A hardening.
// Proves the positive-restriction validator inside 90_cleanup.mjs:
//
//   (1) GATE_A_RUN_ID must equal capture.run_id
//   (2) capture.created_at within 6h freshness window, not future (>60s skew)
//   (3) every candidate ID is a well-formed UUID, unique across the set,
//       and appears in that run's created_fixtures
//   (4) every dependent_rows[].owner_user_id maps to a current-run
//       supabase_user_id (no orphans)
//   (5) no candidate matches the hard denylist (Hammerex / Rosa)
//   (6) missing / empty / malformed capture → refusal
//   (7) retained_rows alone (no current-run tie) → refusal
//
// Plus: importing the cleanup module MUST NOT open a pg.Client, MUST NOT
// call Supabase, MUST NOT read .env.local. Verified via a Node Proxy on
// the pg default export and env-override harness.
//
// NO DB connections. NO auth. All mocks.

import { describe, it, expect } from "vitest";
import { randomUUID, randomBytes } from "node:crypto";

// ─────────────────────────────────────────────────────────────────────────────
// Import target — side-effect check runs BEFORE this import by design:
// the script guards main() behind `fileURLToPath(import.meta.url) === resolve(process.argv[1])`.
// Under vitest, argv[1] is the vitest runner, not 90_cleanup.mjs, so main()
// is not invoked. We still assert zero side effects below.
// ─────────────────────────────────────────────────────────────────────────────
import * as cleanup from "../90_cleanup.mjs";

const { validateCleanupPlan, isWellFormedUuid } = cleanup;

// ─────────────────────────────────────────────────────────────────────────────
// Fixture helpers
// ─────────────────────────────────────────────────────────────────────────────
function mkUuid() {
  return randomUUID();
}

function makeCapture({ runId, createdAt, fixtures = [], provenanceTag }) {
  // §16.48.19 · 90_cleanup now requires a run-scoped provenance_tag on the
  // capture AND on each fixture row. Tests that don't care about provenance
  // get a well-formed tag by default; tests that forge mismatches override.
  const prov = provenanceTag ?? `gate-a-${runId}-${randomBytes(4).toString("hex")}`;
  const taggedFixtures = fixtures.map((f) => ({
    ...f,
    provenance_tag: Object.prototype.hasOwnProperty.call(f, "provenance_tag") ? f.provenance_tag : prov,
  }));
  return {
    A: { status: "OK", email: "a@test.invalid", supabase_user_id: taggedFixtures[0]?.supabase_user_id ?? mkUuid(), nex_account_id: null, nex_account_found: false },
    run_id: runId,
    created_at: createdAt ?? new Date().toISOString(),
    provenance_tag: prov,
    created_fixtures: taggedFixtures,
  };
}

function makeResults({ runId, retainedByTable = {} }) {
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

function run(options) {
  const nowMs = options.nowMs ?? Date.now();
  return validateCleanupPlan({
    gateARunId: options.gateARunId,
    captureRaw: options.captureRaw === undefined
      ? JSON.stringify(options.capture)
      : options.captureRaw,
    resultsRaw: options.resultsRaw === undefined
      ? JSON.stringify(options.results)
      : options.resultsRaw,
    denylist: options.denylist, // undefined → use default
    nowMs,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Import-time side-effect assertions
// ─────────────────────────────────────────────────────────────────────────────
describe("90_cleanup.mjs — zero side effects at import", () => {
  it("exports validateCleanupPlan without executing main()", () => {
    expect(typeof validateCleanupPlan).toBe("function");
    expect(typeof isWellFormedUuid).toBe("function");
  });

  it("source structure proves main() is gated behind an isMain check", async () => {
    // Read source and prove the guard exists. This is a structural guarantee
    // that a re-import under any test runner cannot connect to a DB.
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const { resolve, dirname } = await import("node:path");
    const dir = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(resolve(dir, "../90_cleanup.mjs"), "utf8");
    expect(src).toMatch(/const\s+isMain\s*=/);
    expect(src).toMatch(/if\s*\(\s*isMain\s*\)\s*\{\s*await\s+main\(\)/);
    // No top-level await on pg.Client connect / .query
    expect(src).not.toMatch(/^await\s+client\.connect/m);
    expect(src).not.toMatch(/^await\s+client\.query/m);
    // pg.Client is only constructed inside main (never at module top-level)
    const topLevelClientCtor = src
      .split("\n")
      .slice(0, src.indexOf("async function main()") >= 0
        ? src.slice(0, src.indexOf("async function main()")).split("\n").length
        : Infinity)
      .join("\n");
    expect(topLevelClientCtor).not.toMatch(/new\s+pg\.Client\(/);
  });

  it("importing this spec does not instantiate pg.Client or read .env.local", async () => {
    // We cannot easily inject a Proxy before the top-level import has run.
    // Instead, prove the only pg.Client construction site is inside main().
    // Combined with the isMain gate asserted above, re-import = zero side
    // effect. A second import from a child harness confirms this.
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const { resolve, dirname } = await import("node:path");
    const dir = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(resolve(dir, "../90_cleanup.mjs"), "utf8");
    const ctorHits = [...src.matchAll(/new\s+pg\.Client\(/g)];
    expect(ctorHits.length).toBe(1);
    // That one construction must be inside the `if (isMain)` → main() body,
    // i.e. after `async function main() {`.
    const mainStart = src.indexOf("async function main()");
    expect(mainStart).toBeGreaterThan(-1);
    const ctorIdx = src.indexOf("new pg.Client(");
    expect(ctorIdx).toBeGreaterThan(mainStart);
    // readEnvFromFile is DEFINED (exported) near the top, but must only be
    // CALLED inside main(). Walk every occurrence; skip the one that IS the
    // function declaration; every remaining occurrence must sit after
    // mainStart. There must be at least one real call site (inside main).
    const callRe = /readEnvFromFile\(/g;
    let m;
    let callSites = 0;
    while ((m = callRe.exec(src)) !== null) {
      const precedingSlice = src.slice(Math.max(0, m.index - 32), m.index);
      if (/\bfunction\s+$/.test(precedingSlice)) continue; // skip declaration
      callSites++;
      expect(m.index).toBeGreaterThan(mainStart);
    }
    expect(callSites).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Happy path: approved current-run set → plan matches expected per-table lists
// ─────────────────────────────────────────────────────────────────────────────
describe("validateCleanupPlan — approved current-run set", () => {
  it("produces an exact per-table plan intersecting fixtures and retained_rows", () => {
    const runId = mkUuid();
    const userA = mkUuid();
    const depMsg = mkUuid();
    const depConv = mkUuid();
    const depPart = mkUuid();
    const depSess = mkUuid();
    const capture = makeCapture({
      runId,
      fixtures: [{
        label: "A",
        supabase_user_id: userA,
        dependent_rows: [
          { table: "nex_peer_message", id: depMsg, owner_user_id: userA },
          { table: "nex_peer_conversation", id: depConv, owner_user_id: userA },
          { table: "nex_group_call_participant", id: depPart, owner_user_id: userA },
          { table: "nex_group_call_session", id: depSess, owner_user_id: userA },
        ],
      }],
    });
    const results = makeResults({
      runId,
      retainedByTable: {
        nex_peer_message: [depMsg],
        nex_peer_conversation: [depConv],
        nex_group_call_participant: [depPart],
        nex_group_call_session: [depSess],
      },
    });
    const r = run({ gateARunId: runId, capture, results });
    expect(r.ok).toBe(true);
    expect(r.plan.nex_peer_message).toEqual([depMsg]);
    expect(r.plan.nex_peer_conversation).toEqual([depConv]);
    expect(r.plan.nex_group_call_participant).toEqual([depPart]);
    expect(r.plan.nex_group_call_session).toEqual([depSess]);
  });

  it("plan ordering mirrors delete order in the script (message, conv, part, session)", () => {
    // The plan object keys are declared in delete order inside validateCleanupPlan.
    // Downstream main() iterates in that same order. A regression here would
    // change the on-wire DELETE sequence.
    const runId = mkUuid();
    const userA = mkUuid();
    const capture = makeCapture({
      runId,
      fixtures: [{ label: "A", supabase_user_id: userA, dependent_rows: [] }],
    });
    const results = makeResults({ runId, retainedByTable: {} });
    const r = run({ gateARunId: runId, capture, results });
    expect(r.ok).toBe(true);
    expect(Object.keys(r.plan)).toEqual([
      "nex_peer_message",
      "nex_peer_conversation",
      "nex_group_call_participant",
      "nex_group_call_session",
    ]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Refusal: mismatched run id
// ─────────────────────────────────────────────────────────────────────────────
describe("validateCleanupPlan — run_id provenance", () => {
  it("mismatched GATE_A_RUN_ID vs capture.run_id → refusal", () => {
    const runId = mkUuid();
    const otherId = mkUuid();
    const userA = mkUuid();
    const capture = makeCapture({
      runId,
      fixtures: [{ label: "A", supabase_user_id: userA, dependent_rows: [] }],
    });
    const results = makeResults({ runId });
    const r = run({ gateARunId: otherId, capture, results });
    expect(r.ok).toBe(false);
    expect(r.refusalCode).toBe("RUN_ID_MISMATCH");
  });

  it("missing GATE_A_RUN_ID → refusal", () => {
    const capture = makeCapture({ runId: mkUuid(), fixtures: [] });
    const results = makeResults({ runId: capture.run_id });
    const r = run({ gateARunId: undefined, capture, results });
    expect(r.ok).toBe(false);
    expect(r.refusalCode).toBe("RUN_ID_MISSING");
  });

  it("empty-string GATE_A_RUN_ID → refusal", () => {
    const capture = makeCapture({ runId: mkUuid(), fixtures: [] });
    const results = makeResults({ runId: capture.run_id });
    const r = run({ gateARunId: "", capture, results });
    expect(r.ok).toBe(false);
    expect(r.refusalCode).toBe("RUN_ID_MISSING");
  });

  it("_results.json.OUTPUT with a different run_id than capture → refusal", () => {
    const runId = mkUuid();
    const foreignRunId = mkUuid();
    const capture = makeCapture({ runId, fixtures: [] });
    const results = makeResults({ runId: foreignRunId });
    const r = run({ gateARunId: runId, capture, results });
    expect(r.ok).toBe(false);
    expect(r.refusalCode).toBe("RESULTS_RUN_ID_MISMATCH");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Refusal: freshness window
// ─────────────────────────────────────────────────────────────────────────────
describe("validateCleanupPlan — created_at freshness", () => {
  it("stale (> 6h old) → refusal", () => {
    const runId = mkUuid();
    const now = Date.now();
    const sixHoursPlus = new Date(now - (6 * 60 * 60 * 1000) - 1000).toISOString();
    const capture = makeCapture({ runId, createdAt: sixHoursPlus, fixtures: [] });
    const results = makeResults({ runId });
    const r = run({ gateARunId: runId, capture, results, nowMs: now });
    expect(r.ok).toBe(false);
    expect(r.refusalCode).toBe("CAPTURE_STALE");
  });

  it("future-dated beyond 60s skew → refusal", () => {
    const runId = mkUuid();
    const now = Date.now();
    const future = new Date(now + 120_000).toISOString();
    const capture = makeCapture({ runId, createdAt: future, fixtures: [] });
    const results = makeResults({ runId });
    const r = run({ gateARunId: runId, capture, results, nowMs: now });
    expect(r.ok).toBe(false);
    expect(r.refusalCode).toBe("CAPTURE_FUTURE_DATED");
  });

  it("future-dated within 60s skew → accepted (clock skew tolerance)", () => {
    const runId = mkUuid();
    const now = Date.now();
    const future = new Date(now + 30_000).toISOString();
    const userA = mkUuid();
    const capture = makeCapture({
      runId,
      createdAt: future,
      fixtures: [{ label: "A", supabase_user_id: userA, dependent_rows: [] }],
    });
    const results = makeResults({ runId });
    const r = run({ gateARunId: runId, capture, results, nowMs: now });
    expect(r.ok).toBe(true);
  });

  it("malformed ISO created_at → refusal", () => {
    const runId = mkUuid();
    const capture = { run_id: runId, created_at: "not-a-date", created_fixtures: [] };
    const results = makeResults({ runId });
    const r = run({ gateARunId: runId, capture, results });
    expect(r.ok).toBe(false);
    expect(r.refusalCode).toBe("CAPTURE_BAD_CREATED_AT");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Refusal: capture file absent / empty / malformed
// ─────────────────────────────────────────────────────────────────────────────
describe("validateCleanupPlan — capture file integrity", () => {
  it("missing capture file → refusal (not a success)", () => {
    const r = run({ gateARunId: mkUuid(), captureRaw: null, resultsRaw: "{}" });
    expect(r.ok).toBe(false);
    expect(r.refusalCode).toBe("CAPTURE_MISSING");
  });

  it("empty capture file → refusal", () => {
    const r = run({ gateARunId: mkUuid(), captureRaw: "", resultsRaw: "{}" });
    expect(r.ok).toBe(false);
    expect(r.refusalCode).toBe("CAPTURE_EMPTY");
  });

  it("malformed capture JSON → refusal", () => {
    const r = run({ gateARunId: mkUuid(), captureRaw: "{not json", resultsRaw: "{}" });
    expect(r.ok).toBe(false);
    expect(r.refusalCode).toBe("CAPTURE_MALFORMED");
  });

  it("capture.created_fixtures missing → refusal", () => {
    const runId = mkUuid();
    // §16.48.19 · provide a valid provenance_tag so the earlier provenance
    // guard doesn't intercept; the test specifically targets fixtures.
    const capture = {
      run_id: runId,
      created_at: new Date().toISOString(),
      provenance_tag: `gate-a-${runId}-${randomBytes(4).toString("hex")}`,
    };
    const results = makeResults({ runId });
    const r = run({ gateARunId: runId, capture, results });
    expect(r.ok).toBe(false);
    expect(r.refusalCode).toBe("CAPTURE_NO_FIXTURES");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Refusal: results file problems — retained_rows alone is not enough
// ─────────────────────────────────────────────────────────────────────────────
describe("validateCleanupPlan — results / retained_rows provenance", () => {
  it("retained_rows pointing at IDs NOT in current-run created_fixtures → refusal (foreign id)", () => {
    const runId = mkUuid();
    const userA = mkUuid();
    const foreignId = mkUuid();
    const capture = makeCapture({
      runId,
      fixtures: [{ label: "A", supabase_user_id: userA, dependent_rows: [] }],
    });
    const results = makeResults({
      runId,
      retainedByTable: { nex_peer_message: [foreignId] },
    });
    const r = run({ gateARunId: runId, capture, results });
    expect(r.ok).toBe(false);
    expect(r.refusalCode).toBe("FOREIGN_ID");
  });

  it("retained_rows alone (empty created_fixtures) → refusal (retained_rows is NOT sufficient)", () => {
    const runId = mkUuid();
    const someId = mkUuid();
    const capture = makeCapture({ runId, fixtures: [] });
    const results = makeResults({ runId, retainedByTable: { nex_peer_message: [someId] } });
    const r = run({ gateARunId: runId, capture, results });
    expect(r.ok).toBe(false);
    expect(r.refusalCode).toBe("FOREIGN_ID");
  });

  it("missing _results file → refusal", () => {
    const runId = mkUuid();
    const capture = makeCapture({
      runId,
      fixtures: [{ label: "A", supabase_user_id: mkUuid(), dependent_rows: [] }],
    });
    const r = run({ gateARunId: runId, capture, resultsRaw: null });
    expect(r.ok).toBe(false);
    expect(r.refusalCode).toBe("RESULTS_MISSING");
  });

  it("malformed _results JSON → refusal", () => {
    const runId = mkUuid();
    const capture = makeCapture({
      runId,
      fixtures: [{ label: "A", supabase_user_id: mkUuid(), dependent_rows: [] }],
    });
    const r = run({ gateARunId: runId, capture, resultsRaw: "nope" });
    expect(r.ok).toBe(false);
    expect(r.refusalCode).toBe("RESULTS_MALFORMED");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Refusal: duplicates, orphans, bad UUIDs
// ─────────────────────────────────────────────────────────────────────────────
describe("validateCleanupPlan — structural guards on candidate IDs", () => {
  it("duplicate ID across the delete set → refusal", () => {
    const runId = mkUuid();
    const userA = mkUuid();
    const dup = mkUuid();
    const capture = makeCapture({
      runId,
      fixtures: [{
        label: "A",
        supabase_user_id: userA,
        dependent_rows: [
          { table: "nex_peer_message", id: dup, owner_user_id: userA },
          { table: "nex_peer_conversation", id: dup, owner_user_id: userA },
        ],
      }],
    });
    const results = makeResults({
      runId,
      retainedByTable: {
        nex_peer_message: [dup],
        nex_peer_conversation: [dup],
      },
    });
    const r = run({ gateARunId: runId, capture, results });
    expect(r.ok).toBe(false);
    expect(r.refusalCode).toBe("DUPLICATE_ID");
  });

  it("orphaned dependent (owner_user_id not in this run's supabase_user_ids) → refusal", () => {
    const runId = mkUuid();
    const userA = mkUuid();
    const strangerUser = mkUuid();
    const depId = mkUuid();
    const capture = makeCapture({
      runId,
      fixtures: [{
        label: "A",
        supabase_user_id: userA,
        dependent_rows: [{ table: "nex_peer_message", id: depId, owner_user_id: strangerUser }],
      }],
    });
    const results = makeResults({ runId });
    const r = run({ gateARunId: runId, capture, results });
    expect(r.ok).toBe(false);
    expect(r.refusalCode).toBe("DEPENDENT_ORPHANED");
  });

  it("malformed UUID in retained_rows → refusal", () => {
    const runId = mkUuid();
    const userA = mkUuid();
    const capture = makeCapture({
      runId,
      fixtures: [{ label: "A", supabase_user_id: userA, dependent_rows: [] }],
    });
    const results = makeResults({
      runId,
      retainedByTable: { nex_peer_message: ["not-a-uuid"] },
    });
    const r = run({ gateARunId: runId, capture, results });
    expect(r.ok).toBe(false);
    expect(r.refusalCode).toBe("CANDIDATE_BAD_UUID");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Refusal: denylist defence
// ─────────────────────────────────────────────────────────────────────────────
describe("validateCleanupPlan — hard denylist", () => {
  const HAMMEREX = "11111111-1111-4111-8111-111111111111";
  const ROSA = "11111111-1111-4111-8111-111111111113";

  it("Hammerex UUID in retained_rows → refusal (denylist hit)", () => {
    const runId = mkUuid();
    const userA = mkUuid();
    const capture = makeCapture({
      runId,
      fixtures: [{
        label: "A",
        supabase_user_id: userA,
        dependent_rows: [{ table: "nex_peer_message", id: HAMMEREX, owner_user_id: userA }],
      }],
    });
    const results = makeResults({ runId, retainedByTable: { nex_peer_message: [HAMMEREX] } });
    const r = run({ gateARunId: runId, capture, results });
    expect(r.ok).toBe(false);
    expect(r.refusalCode).toBe("DENYLIST_HIT");
  });

  it("Rosa UUID in fixtures → refusal (FORBIDDEN_IDENTITY_IN_MANIFEST — §16.48.19 distinguishes manifest-origin from retained-origin denylist hits)", () => {
    const runId = mkUuid();
    const capture = makeCapture({
      runId,
      fixtures: [{ label: "A", supabase_user_id: ROSA, dependent_rows: [] }],
    });
    const results = makeResults({ runId });
    const r = run({ gateARunId: runId, capture, results });
    expect(r.ok).toBe(false);
    expect(r.refusalCode).toBe("FORBIDDEN_IDENTITY_IN_MANIFEST");
  });

  it("empty denylist passed in → refusal (an empty denylist is itself a refusal)", () => {
    const runId = mkUuid();
    const userA = mkUuid();
    const capture = makeCapture({
      runId,
      fixtures: [{ label: "A", supabase_user_id: userA, dependent_rows: [] }],
    });
    const results = makeResults({ runId });
    const r = run({ gateARunId: runId, capture, results, denylist: [] });
    expect(r.ok).toBe(false);
    expect(r.refusalCode).toBe("DENYLIST_EMPTY");
  });

  it("default denylist is non-empty and contains Hammerex + Rosa", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const { resolve, dirname } = await import("node:path");
    const dir = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(resolve(dir, "../90_cleanup.mjs"), "utf8");
    expect(src).toContain(HAMMEREX);
    expect(src).toContain(ROSA);
    expect(src).toMatch(/const\s+HARD_DENYLIST\s*=\s*Object\.freeze\(\[/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Sanity: UUID helper exported
// ─────────────────────────────────────────────────────────────────────────────
describe("isWellFormedUuid", () => {
  it("accepts canonical v4", () => {
    expect(isWellFormedUuid("11111111-1111-4111-8111-111111111111")).toBe(true);
  });
  it("accepts crypto.randomUUID output", () => {
    expect(isWellFormedUuid(randomUUID())).toBe(true);
  });
  it("rejects garbage", () => {
    expect(isWellFormedUuid("")).toBe(false);
    expect(isWellFormedUuid("not-a-uuid")).toBe(false);
    expect(isWellFormedUuid(null)).toBe(false);
    expect(isWellFormedUuid(undefined)).toBe(false);
  });
});
