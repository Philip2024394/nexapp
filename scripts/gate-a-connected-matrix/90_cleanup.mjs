#!/usr/bin/env node
// scripts/gate-a-connected-matrix/90_cleanup.mjs
//
// Gate A Connected Matrix — scoped cleanup of test-fixture rows.
// Authored by Agent HARNESS · 2026-11-19 · OFFLINE ONLY · NOT EXECUTED.
// Hardened by Agent CLEANUP · Lane G Gate A · 2026-11-19.
// §16.48.19 additions · 2026-11-20 · adds FORBIDDEN_IDENTITY_IN_MANIFEST,
// MISSING_OR_FOREIGN_PROVENANCE_TAG, CAPTURE_RUN_ID_MISMATCH + empty-manifest
// NOOP + assertIdentityDeletable last-mile export.
//
// POSITIVE RESTRICTION
// Cleanup deletes ONLY exact IDs that:
//   (a) were recorded as created by the CURRENT run (99_identity_capture.json.OUTPUT
//       written by 20_signup_disposable_identities.mjs), AND
//   (b) appear in _results.json.OUTPUT retained_rows for this same run_id.
//
// All validation runs BEFORE any client connects or any DELETE issues.
// Any failed check → zero deletes, zero client connects, non-zero exit.
//
// Delete order (unchanged):
//   1. nex_peer_message WHERE id = ANY($1)
//   2. nex_peer_conversation WHERE id = ANY($1)
//   3. nex_group_call_participant WHERE id = ANY($1) OR session_id = ANY($2)
//   4. nex_group_call_session WHERE id = ANY($1)
//
// Does NOT delete nex_account rows or auth.users rows.
// Disposable auth identities persist (acceptable per supported-signup rule).
//
// If cleanup permission is withdrawn (env GATE_A_CLEANUP_SKIPPED=1):
// prints captured IDs for manual action, exits 0 with CLEANUP SKIPPED verdict.

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dir, "../..");
// §16.48.19 · overrideable paths so cleanup-wiring.spec can direct the
// script at a temp-dir manifest without racing other suites that also write
// to the default OUTPUT files. Empty/unset → canonical defaults.
const IDENTITY_CAPTURE_FILE = process.env.GATE_A_CLEANUP_CAPTURE_PATH_OVERRIDE
  ? resolve(process.env.GATE_A_CLEANUP_CAPTURE_PATH_OVERRIDE)
  : resolve(__dir, "99_identity_capture.json.OUTPUT");
const RESULTS_FILE = process.env.GATE_A_CLEANUP_RESULTS_PATH_OVERRIDE
  ? resolve(process.env.GATE_A_CLEANUP_RESULTS_PATH_OVERRIDE)
  : resolve(__dir, "_results.json.OUTPUT");
const STUB_LOG_FILE = process.env.GATE_A_CLEANUP_STUB_LOG_OVERRIDE
  ? resolve(process.env.GATE_A_CLEANUP_STUB_LOG_OVERRIDE)
  : resolve(__dir, "_cleanup_pg_stub.log.OUTPUT");
const CANONICAL_PROJECT_REF = "kdstoyyeygcopkogqsyv";
const PRODUCTION_REF = "ijvqdvsvwtwxzcqmoqit";

// ─────────────────────────────────────────────────────────────────────────────
// Hard denylist — UUIDs that cleanup must never target regardless of input.
// Canonical protected IDs found in repo:
//   scripts/_tmp/seed-disposable-product-inquiry.mjs: PROTECTED_IDS
// Hammerex (nex-99901) and Rosa (nex-99903). Owner must keep this list
// populated. An EMPTY list is a refusal condition.
// ─────────────────────────────────────────────────────────────────────────────
const HARD_DENYLIST = Object.freeze([
  "11111111-1111-4111-8111-111111111111", // Hammerex (nex-99901)
  "11111111-1111-4111-8111-111111111113", // Rosa (nex-99903)
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FRESHNESS_WINDOW_MS = 6 * 60 * 60 * 1000; // 6 hours
const FUTURE_SKEW_MS = 60 * 1000; // 60 seconds

export function isWellFormedUuid(v) {
  return typeof v === "string" && UUID_RE.test(v);
}

export function readEnvFromFile(key, envPath) {
  const raw = readFileSync(envPath, "utf8");
  const m = raw.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!m) return null;
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure validation core — zero side effects, zero DB, zero fs.
// Returns { ok: true, plan } or { ok: false, refusalCode, reason }.
// `plan` is the merged candidate ID set per table, ready for DELETE.
// ─────────────────────────────────────────────────────────────────────────────
export function validateCleanupPlan({
  gateARunId,
  captureRaw,          // string | null — raw JSON text of capture file, null if missing
  resultsRaw,          // string | null — raw JSON text of results file, null if missing
  denylist = HARD_DENYLIST,
  nowMs = Date.now(),
}) {
  // (D0) denylist must be non-empty
  if (!Array.isArray(denylist) || denylist.length === 0) {
    return { ok: false, refusalCode: "DENYLIST_EMPTY", reason: "hard denylist is empty — refusing to proceed" };
  }

  // (1a) GATE_A_RUN_ID must be present
  if (typeof gateARunId !== "string" || gateARunId.length === 0) {
    return { ok: false, refusalCode: "RUN_ID_MISSING", reason: "GATE_A_RUN_ID not supplied by parent runner" };
  }

  // (6) capture file must exist
  if (captureRaw === null || captureRaw === undefined) {
    return { ok: false, refusalCode: "CAPTURE_MISSING", reason: "99_identity_capture.json.OUTPUT not found" };
  }
  if (typeof captureRaw !== "string" || captureRaw.trim().length === 0) {
    return { ok: false, refusalCode: "CAPTURE_EMPTY", reason: "capture file is empty" };
  }

  // (6) capture must parse
  let capture;
  try {
    capture = JSON.parse(captureRaw);
  } catch {
    return { ok: false, refusalCode: "CAPTURE_MALFORMED", reason: "capture file is not valid JSON" };
  }
  if (!capture || typeof capture !== "object") {
    return { ok: false, refusalCode: "CAPTURE_MALFORMED", reason: "capture JSON root is not an object" };
  }

  // (1b) run_id must match exactly, string compare
  if (capture.run_id !== gateARunId) {
    return { ok: false, refusalCode: "RUN_ID_MISMATCH", reason: "capture.run_id does not match GATE_A_RUN_ID" };
  }

  // (2) created_at parses, within freshness window, not in future
  if (typeof capture.created_at !== "string" || capture.created_at.length === 0) {
    return { ok: false, refusalCode: "CAPTURE_NO_CREATED_AT", reason: "capture.created_at missing" };
  }
  const createdAtMs = Date.parse(capture.created_at);
  if (!Number.isFinite(createdAtMs)) {
    return { ok: false, refusalCode: "CAPTURE_BAD_CREATED_AT", reason: "capture.created_at is not a valid ISO timestamp" };
  }
  if (createdAtMs > nowMs + FUTURE_SKEW_MS) {
    return { ok: false, refusalCode: "CAPTURE_FUTURE_DATED", reason: "capture.created_at is in the future beyond allowed skew" };
  }
  if (nowMs - createdAtMs > FRESHNESS_WINDOW_MS) {
    return { ok: false, refusalCode: "CAPTURE_STALE", reason: "capture.created_at is older than the freshness window" };
  }

  // §16.48.19 · capture.provenance_tag must bear the run-scoped prefix.
  // A manifest without provenance cannot prove this run owns the rows it
  // names; refuse before any further checks.
  if (typeof capture.provenance_tag !== "string" || capture.provenance_tag.length === 0) {
    return { ok: false, refusalCode: "MISSING_OR_FOREIGN_PROVENANCE_TAG", reason: "capture.provenance_tag missing" };
  }
  if (!capture.provenance_tag.startsWith("gate-a-")) {
    return { ok: false, refusalCode: "MISSING_OR_FOREIGN_PROVENANCE_TAG", reason: "capture.provenance_tag does not start with 'gate-a-'" };
  }

  // (3,4) created_fixtures must be an array of well-formed fixture entries.
  // §16.48.19 · empty array is accepted — main() exits NOOP downstream.
  if (!Array.isArray(capture.created_fixtures)) {
    return { ok: false, refusalCode: "CAPTURE_NO_FIXTURES", reason: "capture.created_fixtures missing or not an array" };
  }

  // Denylist set computed up front so per-fixture denylist refusal can
  // distinguish FORBIDDEN_IDENTITY_IN_MANIFEST (fixture supabase_user_id)
  // from DENYLIST_HIT (dependent row / retained row).
  const denylistLower = new Set(denylist.map((u) => String(u).toLowerCase()));

  const ownerUserIds = new Set();
  const allowedIds = new Set();
  for (const f of capture.created_fixtures) {
    if (!f || typeof f !== "object") {
      return { ok: false, refusalCode: "FIXTURE_MALFORMED", reason: "created_fixtures entry is not an object" };
    }
    if (!isWellFormedUuid(f.supabase_user_id)) {
      return { ok: false, refusalCode: "FIXTURE_BAD_USER_ID", reason: `fixture label=${f.label ?? "?"} supabase_user_id is not a well-formed UUID` };
    }
    const fixtureIdLower = f.supabase_user_id.toLowerCase();
    // §16.48.19 · fixture rows MAY NOT name a protected identity, even
    // if the retained_rows check would also catch it later.
    if (denylistLower.has(fixtureIdLower)) {
      return { ok: false, refusalCode: "FORBIDDEN_IDENTITY_IN_MANIFEST", reason: `fixture label=${f.label ?? "?"} supabase_user_id is on the hard denylist` };
    }
    // §16.48.19 · fixture provenance_tag must equal capture.provenance_tag.
    // Mixed-run manifests are refused — they cannot come from a clean run.
    if (typeof f.provenance_tag !== "string" || f.provenance_tag !== capture.provenance_tag) {
      return { ok: false, refusalCode: "MISSING_OR_FOREIGN_PROVENANCE_TAG", reason: `fixture label=${f.label ?? "?"} provenance_tag missing or does not match capture.provenance_tag` };
    }
    ownerUserIds.add(fixtureIdLower);
    allowedIds.add(fixtureIdLower);
    const deps = Array.isArray(f.dependent_rows) ? f.dependent_rows : [];
    for (const d of deps) {
      if (!d || typeof d !== "object") {
        return { ok: false, refusalCode: "DEPENDENT_MALFORMED", reason: `fixture label=${f.label ?? "?"} dependent row is not an object` };
      }
      if (!isWellFormedUuid(d.id)) {
        return { ok: false, refusalCode: "DEPENDENT_BAD_ID", reason: `fixture label=${f.label ?? "?"} dependent_row.id is not a well-formed UUID` };
      }
      if (!isWellFormedUuid(d.owner_user_id)) {
        return { ok: false, refusalCode: "DEPENDENT_BAD_OWNER", reason: `fixture label=${f.label ?? "?"} dependent_row.owner_user_id is not a well-formed UUID` };
      }
      // (4) owner_user_id must map to a supabase_user_id in THIS run
      if (!ownerUserIds.has(d.owner_user_id.toLowerCase())) {
        return { ok: false, refusalCode: "DEPENDENT_ORPHANED", reason: `dependent row id=${d.id} owner_user_id not in this run's supabase_user_ids` };
      }
      allowedIds.add(d.id.toLowerCase());
    }
  }

  // Denylist defence for dependent rows (fixture supabase_user_id hits are
  // already refused above with FORBIDDEN_IDENTITY_IN_MANIFEST). This loop
  // still catches any dependent_row.id that lands on the hard denylist.
  for (const id of allowedIds) {
    if (denylistLower.has(id)) {
      return { ok: false, refusalCode: "DENYLIST_HIT", reason: `candidate ID is on the hard denylist` };
    }
  }

  // (7) retained_rows from results — require current-run tie.
  // If results file is missing/empty/malformed, that is a refusal (we cannot
  // honestly validate scope). The runner always writes this file on startup.
  if (resultsRaw === null || resultsRaw === undefined) {
    return { ok: false, refusalCode: "RESULTS_MISSING", reason: "_results.json.OUTPUT not found" };
  }
  if (typeof resultsRaw !== "string" || resultsRaw.trim().length === 0) {
    return { ok: false, refusalCode: "RESULTS_EMPTY", reason: "_results.json.OUTPUT is empty" };
  }
  let results;
  try {
    results = JSON.parse(resultsRaw);
  } catch {
    return { ok: false, refusalCode: "RESULTS_MALFORMED", reason: "_results.json.OUTPUT is not valid JSON" };
  }
  if (!results || typeof results !== "object") {
    return { ok: false, refusalCode: "RESULTS_MALFORMED", reason: "results JSON root is not an object" };
  }
  if (results.run_id !== gateARunId) {
    return { ok: false, refusalCode: "RESULTS_RUN_ID_MISMATCH", reason: "_results.json.OUTPUT run_id does not match GATE_A_RUN_ID" };
  }

  // Merge retained_rows (preserving the structured ?? direct symmetric fallback)
  // but intersect each candidate ID against allowedIds from created_fixtures.
  const perTable = {
    nex_peer_message: [],
    nex_peer_conversation: [],
    nex_group_call_participant: [],
    nex_group_call_session: [],
  };
  const seenAcrossSet = new Map(); // id -> table

  for (const entry of (results.entries ?? [])) {
    const rr = entry?.structured?.retained_rows ?? entry?.retained_rows ?? {};
    for (const table of Object.keys(perTable)) {
      const list = Array.isArray(rr[table]) ? rr[table] : [];
      for (const rawId of list) {
        if (!rawId) continue;
        if (!isWellFormedUuid(rawId)) {
          return { ok: false, refusalCode: "CANDIDATE_BAD_UUID", reason: `retained ${table} id is not a well-formed UUID` };
        }
        const idLower = rawId.toLowerCase();
        // (5) denylist
        if (denylistLower.has(idLower)) {
          return { ok: false, refusalCode: "DENYLIST_HIT", reason: `retained ${table} id is on the hard denylist` };
        }
        // (3) must appear in current run's created_fixtures
        if (!allowedIds.has(idLower)) {
          return { ok: false, refusalCode: "FOREIGN_ID", reason: `retained ${table} id is not in current run's created_fixtures` };
        }
        // (3) no duplicates across the whole delete set
        if (seenAcrossSet.has(idLower)) {
          return { ok: false, refusalCode: "DUPLICATE_ID", reason: `id appears in both ${seenAcrossSet.get(idLower)} and ${table}` };
        }
        seenAcrossSet.set(idLower, table);
        perTable[table].push(rawId);
      }
    }
  }

  return { ok: true, plan: perTable, capture, results };
}

// ─────────────────────────────────────────────────────────────────────────────
// §16.48.19 last-mile guard · assertIdentityDeletable
//
// Pure, in-memory single-ID gate. Called by any deletion site immediately
// before issuing an actual DELETE for a given auth user id. Independent
// of the whole-plan validator so that a mid-flight row discovered outside
// the manifest (e.g. harvested from a live retained_rows scan, a future
// code path, or a human-injected ad-hoc delete) cannot bypass the
// manifest + denylist invariant.
//
// Shape:
//   assertIdentityDeletable({ supabaseUserId, manifestRows, forbiddenIdentities })
//     → { ok: true }
//     | { ok: false, refusalCode, reason }
//
// Refusal codes:
//   BAD_USER_ID                         — supabaseUserId not a UUID
//   FORBIDDEN_IDENTITY                  — ID is on the hard denylist
//   DENYLIST_EMPTY                      — forbiddenIdentities is empty
//   MANIFEST_EMPTY                      — manifestRows is empty/missing
//   NOT_IN_MANIFEST                     — ID absent from manifestRows
//   MISSING_OR_FOREIGN_PROVENANCE_TAG   — matching manifest row lacks
//                                         a provenance_tag starting
//                                         with "gate-a-"
// ─────────────────────────────────────────────────────────────────────────────
export function assertIdentityDeletable({
  supabaseUserId,
  manifestRows,
  forbiddenIdentities = HARD_DENYLIST,
}) {
  if (!Array.isArray(forbiddenIdentities) || forbiddenIdentities.length === 0) {
    return { ok: false, refusalCode: "DENYLIST_EMPTY", reason: "hard denylist is empty — refusing to proceed" };
  }
  if (!isWellFormedUuid(supabaseUserId)) {
    return { ok: false, refusalCode: "BAD_USER_ID", reason: "supabaseUserId is not a well-formed UUID" };
  }
  const idLower = supabaseUserId.toLowerCase();
  const denySet = new Set(forbiddenIdentities.map((u) => String(u).toLowerCase()));
  if (denySet.has(idLower)) {
    return { ok: false, refusalCode: "FORBIDDEN_IDENTITY", reason: "supabaseUserId is on the hard denylist" };
  }
  if (!Array.isArray(manifestRows) || manifestRows.length === 0) {
    return { ok: false, refusalCode: "MANIFEST_EMPTY", reason: "manifestRows is empty or missing — refusing to delete an identity without current-run provenance" };
  }
  const match = manifestRows.find((r) => {
    if (!r || typeof r !== "object") return false;
    const rid = r.supabase_user_id;
    return typeof rid === "string" && rid.toLowerCase() === idLower;
  });
  if (!match) {
    return { ok: false, refusalCode: "NOT_IN_MANIFEST", reason: "supabaseUserId is not present in current-run manifestRows" };
  }
  if (typeof match.provenance_tag !== "string" || !match.provenance_tag.startsWith("gate-a-")) {
    return { ok: false, refusalCode: "MISSING_OR_FOREIGN_PROVENANCE_TAG", reason: "matched manifest row is missing a well-formed provenance_tag" };
  }
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main — executes only when invoked as a script, never on import.
// ─────────────────────────────────────────────────────────────────────────────
const isMain = (() => {
  try {
    return fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? "");
  } catch {
    return false;
  }
})();

if (isMain) {
  await main();
}

async function main() {
  console.log("=== Gate A cleanup script ===");
  console.log("Scope: test-fixture rows only. No nex_account or auth.users deletions.");

  const gateARunId = process.env.GATE_A_RUN_ID;

  // §16.48.19 · GATE_A_CLEANUP_LIST_ONLY grammar (unset | "" | "1"; else exit 2).
  // "1" prints the per-fixture guard verdict and exits 0 WITHOUT instantiating
  // pg.Client or issuing any query. This is the owner-authorised list-only mode.
  const RAW_LIST_ONLY = process.env.GATE_A_CLEANUP_LIST_ONLY;
  let LIST_ONLY;
  if (RAW_LIST_ONLY === undefined || RAW_LIST_ONLY === "") {
    LIST_ONLY = false;
  } else if (RAW_LIST_ONLY === "1") {
    LIST_ONLY = true;
  } else {
    console.error("FATAL: GATE_A_CLEANUP_LIST_ONLY has an unrecognised value — expected unset, empty, or '1'");
    process.exit(2);
  }

  // §16.48.19 · GATE_A_CLEANUP_PG_STUB grammar (unset | "" | "1"; else exit 2).
  // "1" substitutes an in-memory pg.Client recorder — used by cleanup-wiring.spec
  // to prove "zero query() on guard refusal · one DELETE per approved row on happy path".
  // Never consulted when LIST_ONLY=1 (that path skips the client entirely).
  const RAW_PG_STUB = process.env.GATE_A_CLEANUP_PG_STUB;
  let PG_STUB;
  if (RAW_PG_STUB === undefined || RAW_PG_STUB === "") {
    PG_STUB = false;
  } else if (RAW_PG_STUB === "1") {
    PG_STUB = true;
  } else {
    console.error("FATAL: GATE_A_CLEANUP_PG_STUB has an unrecognised value — expected unset, empty, or '1'");
    process.exit(2);
  }

  // Load capture + results as raw text (so validators can report malformed)
  const captureRaw = existsSync(IDENTITY_CAPTURE_FILE) ? readFileSync(IDENTITY_CAPTURE_FILE, "utf8") : null;
  const resultsRaw = existsSync(RESULTS_FILE) ? readFileSync(RESULTS_FILE, "utf8") : null;

  const validation = validateCleanupPlan({ gateARunId, captureRaw, resultsRaw });

  // SKIP branch — same contract applies. If validation fails, we still refuse.
  // If validation passes, we print the per-run candidate IDs (no secrets).
  if (process.env.GATE_A_CLEANUP_SKIPPED === "1") {
    console.log("CLEANUP SKIPPED: GATE_A_CLEANUP_SKIPPED=1 is set.");
    if (!validation.ok) {
      console.error(`REFUSAL: ${validation.refusalCode} — ${validation.reason}`);
      console.log(JSON.stringify({ verdict: "CLEANUP_REFUSED", refusalCode: validation.refusalCode }));
      process.exit(4);
    }
    console.log("Captured IDs for manual cleanup (current run only):");
    for (const [table, ids] of Object.entries(validation.plan)) {
      console.log(`  ${table}:`, ids);
    }
    console.log(JSON.stringify({ verdict: "CLEANUP_SKIPPED", detail: "GATE_A_CLEANUP_SKIPPED=1" }));
    process.exit(0);
  }

  if (!validation.ok) {
    console.error(`REFUSAL: ${validation.refusalCode} — ${validation.reason}`);
    console.error("Zero deletes, zero client connects. Exiting non-zero.");
    console.log(JSON.stringify({ verdict: "CLEANUP_REFUSED", refusalCode: validation.refusalCode }));
    process.exit(4);
  }

  const { plan, capture } = validation;

  // §16.48.19 · Plan-wide last-mile guard. Before ANY pg client instantiation,
  // every fixture identity must pass assertIdentityDeletable. A refusal aborts
  // with exit 4 and zero DB touch — the Hammerex / Rosa / unknown-ID /
  // missing-provenance-tag invariants become a test, not luck.
  const manifestRows = capture.created_fixtures;
  const guardVerdicts = [];
  for (const row of manifestRows) {
    const r = assertIdentityDeletable({
      supabaseUserId: row.supabase_user_id,
      manifestRows,
    });
    guardVerdicts.push({ label: row.label, supabase_user_id: row.supabase_user_id, verdict: r });
    if (!r.ok) {
      console.error(`REFUSAL (guard): label=${row.label} supabase_user_id=${row.supabase_user_id} → ${r.refusalCode} — ${r.reason}`);
      console.error("Zero deletes, zero client connects. Exiting non-zero.");
      console.log(JSON.stringify({ verdict: "CLEANUP_REFUSED", refusalCode: r.refusalCode, guard: "assertIdentityDeletable" }));
      process.exit(4);
    }
  }
  console.log(`Guard PASS · ${guardVerdicts.length} fixture identities approved by assertIdentityDeletable.`);

  // §16.48.19 · List-only mode (owner-authorised). Prints per-fixture verdict
  // and exits 0 without any pg.Client / connect / query.
  if (LIST_ONLY) {
    console.log("CLEANUP LIST-ONLY: GATE_A_CLEANUP_LIST_ONLY=1 is set.");
    console.log("Per-fixture guard verdict (no client calls will be made):");
    for (const v of guardVerdicts) {
      console.log(`  label=${v.label} supabase_user_id=${v.supabase_user_id} → OK`);
    }
    console.log("Captured IDs that WOULD be deleted if authorised:");
    for (const [table, ids] of Object.entries(plan)) {
      console.log(`  ${table}:`, ids);
    }
    console.log(JSON.stringify({
      verdict: "CLEANUP_LIST_ONLY",
      detail: "GATE_A_CLEANUP_LIST_ONLY=1 — zero client calls",
      approved_identities: guardVerdicts.length,
      plan,
    }));
    process.exit(0);
  }
  const totalRows =
    plan.nex_peer_message.length +
    plan.nex_peer_conversation.length +
    plan.nex_group_call_participant.length +
    plan.nex_group_call_session.length;

  console.log("IDs to delete (all validated against current-run created_fixtures):");
  console.log(`  nex_peer_message: ${plan.nex_peer_message.length} rows`);
  console.log(`  nex_peer_conversation: ${plan.nex_peer_conversation.length} rows`);
  console.log(`  nex_group_call_participant: ${plan.nex_group_call_participant.length} rows (by id)`);
  console.log(`  nex_group_call_session: ${plan.nex_group_call_session.length} rows`);

  if (totalRows === 0) {
    console.log("No rows to clean up. Exiting.");
    console.log(JSON.stringify({ verdict: "CLEANUP_NOOP", detail: "no current-run rows to delete" }));
    process.exit(0);
  }

  let client;
  if (PG_STUB) {
    // §16.48.19 · in-memory stub for cleanup-wiring.spec. Records every call
    // so the test can assert exact counts. Dumped to _cleanup_pg_stub.log.OUTPUT
    // in __dir on client.end(). No .env.local read, no real pg, no network.
    const stubLog = STUB_LOG_FILE;
    const calls = [];
    client = {
      async connect() { calls.push({ op: "connect" }); },
      async query(sql, args) {
        const idsCount = Array.isArray(args?.[0]) ? args[0].length : 0;
        calls.push({ op: "query", sql, ids_count: idsCount });
        // Simulate rowCount matching ids length so happy-path accounting is clean.
        return { rowCount: idsCount };
      },
      async end() {
        calls.push({ op: "end" });
        try {
          const { writeFileSync } = await import("node:fs");
          writeFileSync(stubLog, JSON.stringify(calls, null, 2), "utf8");
        } catch { /* best-effort */ }
      },
    };
  } else {
    const databaseUrl = readEnvFromFile("SANDBOX_DATABASE_URL", resolve(REPO_ROOT, ".env.local"));
    if (!databaseUrl || databaseUrl.includes(PRODUCTION_REF)) {
      console.error("FATAL: SANDBOX_DATABASE_URL missing or contains production ref");
      process.exit(2);
    }
    let u;
    try { u = new URL(databaseUrl); } catch { console.error("FATAL: invalid URL"); process.exit(2); }
    const ref = u.username.match(/^postgres\.([a-z0-9]+)$/)?.[1] ?? u.hostname.match(/^(?:db\.)?([a-z0-9]+)\.supabase\.co$/)?.[1];
    if (ref === PRODUCTION_REF || ref !== CANONICAL_PROJECT_REF) {
      console.error(`FATAL: ref check failed: ${ref}`);
      process.exit(3);
    }
    client = new pg.Client({ connectionString: databaseUrl });
  }
  await client.connect();

  let overallOk = true;
  const report = {};

  // 1. Delete nex_peer_message
  {
    const ids = plan.nex_peer_message;
    if (ids.length > 0) {
      try {
        const res = await client.query("DELETE FROM nex_peer_message WHERE id = ANY($1::uuid[])", [ids]);
        console.log(`Deleted nex_peer_message: ${res.rowCount} rows (expected ${ids.length})`);
        report.nex_peer_message = { expected: ids.length, deleted: res.rowCount };
        if (res.rowCount === 0 && ids.length > 0) {
          console.log("  NOTE: 0 rows deleted (expected >0). Rows may have already been cleaned up. Continuing.");
        }
      } catch (e) {
        console.error(`  nex_peer_message delete failed: ${e.message}`);
        report.nex_peer_message = { error: e.message };
        overallOk = false;
      }
    } else {
      report.nex_peer_message = { expected: 0, deleted: 0 };
    }
  }

  // 2. Delete nex_peer_conversation
  {
    const ids = plan.nex_peer_conversation;
    if (ids.length > 0) {
      try {
        const res = await client.query("DELETE FROM nex_peer_conversation WHERE id = ANY($1::uuid[])", [ids]);
        console.log(`Deleted nex_peer_conversation: ${res.rowCount} rows (expected ${ids.length})`);
        report.nex_peer_conversation = { expected: ids.length, deleted: res.rowCount };
        if (res.rowCount === 0 && ids.length > 0) {
          console.log("  NOTE: 0 rows deleted. Continuing.");
        }
      } catch (e) {
        console.error(`  nex_peer_conversation delete failed: ${e.message}`);
        report.nex_peer_conversation = { error: e.message };
        overallOk = false;
      }
    } else {
      report.nex_peer_conversation = { expected: 0, deleted: 0 };
    }
  }

  // 3. Delete nex_group_call_participant (by id OR session_id cascade coverage)
  {
    const partIds = plan.nex_group_call_participant;
    const sessIds = plan.nex_group_call_session;
    try {
      let deleted = 0;
      if (partIds.length > 0) {
        const r1 = await client.query("DELETE FROM nex_group_call_participant WHERE id = ANY($1::uuid[])", [partIds]);
        deleted += r1.rowCount;
      }
      if (sessIds.length > 0) {
        // Also delete any remaining participants by session_id (catches rows not in the captured id list)
        const r2 = await client.query("DELETE FROM nex_group_call_participant WHERE session_id = ANY($1::uuid[])", [sessIds]);
        deleted += r2.rowCount;
      }
      console.log(`Deleted nex_group_call_participant: ${deleted} rows`);
      report.nex_group_call_participant = { deleted };
    } catch (e) {
      console.error(`  nex_group_call_participant delete failed: ${e.message}`);
      report.nex_group_call_participant = { error: e.message };
      overallOk = false;
    }
  }

  // 4. Delete nex_group_call_session
  {
    const ids = plan.nex_group_call_session;
    if (ids.length > 0) {
      try {
        const res = await client.query("DELETE FROM nex_group_call_session WHERE id = ANY($1::uuid[])", [ids]);
        console.log(`Deleted nex_group_call_session: ${res.rowCount} rows (expected ${ids.length})`);
        report.nex_group_call_session = { expected: ids.length, deleted: res.rowCount };
        if (res.rowCount === 0 && ids.length > 0) {
          console.log("  NOTE: 0 rows deleted (may already be cleaned up). Continuing.");
        }
      } catch (e) {
        console.error(`  nex_group_call_session delete failed: ${e.message}`);
        report.nex_group_call_session = { error: e.message };
        overallOk = false;
      }
    } else {
      report.nex_group_call_session = { expected: 0, deleted: 0 };
    }
  }

  await client.end();

  console.log("\nRetained row report (by category):");
  for (const [table, info] of Object.entries(report)) {
    console.log(`  ${table}: ${JSON.stringify(info)}`);
  }

  console.log(`\nNOTE: disposable auth.users identities are intentionally NOT deleted.`);
  console.log(`  They persist per supported-signup-only policy.`);

  console.log(JSON.stringify({
    verdict: overallOk ? "CLEANUP_COMPLETE" : "CLEANUP_PARTIAL",
    detail: overallOk ? "all scoped rows deleted" : "some deletes failed — see report",
    report,
  }));
  process.exit(overallOk ? 0 : 1);
}
