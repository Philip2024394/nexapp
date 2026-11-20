#!/usr/bin/env node
// scripts/gate-a-connected-matrix/_runner.mjs
//
// Gate A Connected Matrix — serialized runner.
// Authored by Agent HARNESS · 2026-11-19 · OFFLINE ONLY · NOT EXECUTED.
// Execution is Agent DB's responsibility.
//
// HARD INVARIANTS
// ───────────────
// · CANONICAL_PROJECT_REF pinned to sandbox kdstoyyeygcopkogqsyv.
// · Production ref ijvqdvsvwtwxzcqmoqit is a hard-refuse.
// · Pooler username must match /^postgres\.kdstoyyeygcopkogqsyv$/.
// · STOP on first FAIL — mandatory, not overridable.
// · Never prints DATABASE_URL, JWT, password, or anon key.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import pg from "pg";
import { createHash, randomBytes, randomUUID } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../..");
const OUTPUT_FILE = resolve(__dirname, "_results.json.OUTPUT");
const V_STAR_ELIGIBILITY_FILE = resolve(__dirname, "__tests__/_v-star-eligibility.generated.json");

// ── Identity-mode selector · HARNESS-2USER · Lane G Gate A · 2026-11-19 ──
// Mode is sourced at invocation time from the process env var
// GATE_A_IDENTITY_MODE (NOT from .env.local — owner prohibits env-file edits).
// Accepted values:
//   (unset) or "three" → default, behaves exactly as prior harness: A/B/C
//   "two"              → A/B only; no C password generated, no C signup, no
//                        C in capture; V-* classified BLOCKED_NEEDS_C or
//                        BLOCKED_NEEDS_MORE_THAN_3 are SKIPPED with verdict
//                        BLOCKED (not FAIL, no cascade stop).
// Any other value → fail closed with exit(2). Invalid values are NOT guessed.
const RAW_IDENTITY_MODE = process.env.GATE_A_IDENTITY_MODE;
const IDENTITY_MODE = (RAW_IDENTITY_MODE === undefined || RAW_IDENTITY_MODE === "")
  ? "three"
  : RAW_IDENTITY_MODE;
if (IDENTITY_MODE !== "three" && IDENTITY_MODE !== "two") {
  // Name the reason, not the value, to avoid logging unvetted env contents.
  console.error(
    "FATAL: GATE_A_IDENTITY_MODE has an unrecognised value — " +
    "accepted values are (unset), \"three\", or \"two\". Refusing to proceed."
  );
  process.exit(2);
}

// ── Bounded-profile selector · §16.48.17 · Lane G Gate A · 2026-11-19 ────────
// Owner-authorised forward-run subset for the bounded A/B/C sandbox probe.
// GATE_A_BOUNDED_PROFILE grammar:
//   (unset) or ""  → no bounded profile · full MJS_FILES run
//   "abc-14"       → restrict forward MJS run to EXACTLY these 14 scripts in
//                    this order · 1 signup + 13 behavioural (NO cleanup):
//                      20 signup
//                      30/31/32 auth
//                      40/41/44/45 w1 · (42,43 omitted)
//                      50/52/53 w2  · (51 omitted)
//                      60/65/66 w3  · (61,62,63,64 omitted)
//   Any other value → fail closed with exit(2) · raw value is NOT printed.
// A bounded profile DOES NOT authorise cleanup · GATE_A_SKIP_CLEANUP=1 must
// also be set (enforced below).
const RAW_BOUNDED_PROFILE = process.env.GATE_A_BOUNDED_PROFILE;
const BOUNDED_PROFILE =
  RAW_BOUNDED_PROFILE === undefined || RAW_BOUNDED_PROFILE === ""
    ? null
    : RAW_BOUNDED_PROFILE;
if (BOUNDED_PROFILE !== null && BOUNDED_PROFILE !== "abc-14") {
  console.error(
    "FATAL: GATE_A_BOUNDED_PROFILE has an unrecognised value — " +
    "accepted values are (unset) or \"abc-14\". Refusing to proceed."
  );
  process.exit(2);
}

// Frozen manifest for the abc-14 bounded forward run · exact filenames · exact
// order · cleanup 90 deliberately absent · rollback 80/81/82 deliberately
// absent · MIXED cases 61/62 deliberately absent · NEEDS_MORE_THAN_3 cases
// 42/43/51/63/64/70 deliberately absent.
const BOUNDED_PROFILE_ABC14 = Object.freeze([
  "20_signup_disposable_identities.mjs",
  "30_v_auth_null.mjs",
  "31_v_auth_unknown.mjs",
  "32_v_auth_unauthorized_diff.mjs",
  "40_v_w1_new.mjs",
  "41_v_w1_exist.mjs",
  "44_v_w1_whitespace.mjs",
  "45_v_w1_dup.mjs",
  "50_v_w2_ok.mjs",
  "52_v_w2_dup.mjs",
  "53_v_w2_auth.mjs",
  "60_v_w3_update.mjs",
  "65_v_w3_promote.mjs",
  "66_v_w3_nopromote.mjs",
]);

// ── Cleanup-skip gate · §16.48.17 · Lane G Gate A · 2026-11-19 ───────────────
// GATE_A_SKIP_CLEANUP grammar:
//   (unset) or ""  → cleanup runs as before (90_cleanup.mjs dispatches)
//   "1"            → cleanup is REFUSED · 90_cleanup.mjs never dispatches
//                    even through the two-mode INFRA bypass or any allowlist.
//   Any other value → fail closed with exit(2) · raw value is NOT printed.
// This is a real code gate, not a comment. The guard sits at the top of the
// per-file dispatch loop and short-circuits with verdict=BLOCKED.
const RAW_SKIP_CLEANUP = process.env.GATE_A_SKIP_CLEANUP;
let SKIP_CLEANUP;
if (RAW_SKIP_CLEANUP === undefined || RAW_SKIP_CLEANUP === "") {
  SKIP_CLEANUP = false;
} else if (RAW_SKIP_CLEANUP === "1") {
  SKIP_CLEANUP = true;
} else {
  console.error(
    "FATAL: GATE_A_SKIP_CLEANUP has an unrecognised value — " +
    "accepted values are (unset) or \"1\". Refusing to proceed."
  );
  process.exit(2);
}

// A bounded forward run must gate cleanup separately · refuse if someone sets
// GATE_A_BOUNDED_PROFILE=abc-14 without also setting GATE_A_SKIP_CLEANUP=1.
// (The abc-14 manifest already omits 90, but belt-and-suspenders: a later
// edit that accidentally re-adds 90 to the manifest would still be refused.)
if (BOUNDED_PROFILE !== null && !SKIP_CLEANUP) {
  console.error(
    "FATAL: GATE_A_BOUNDED_PROFILE is active but GATE_A_SKIP_CLEANUP=1 is not — " +
    "a bounded forward run must gate cleanup separately. Refusing to proceed."
  );
  process.exit(2);
}

// ── Dry-run selector · §16.48.18 · 2026-11-20 ────────────────────────────────
// GATE_A_DRY_RUN grammar:
//   (unset) or ""  → normal run
//   "1"            → resolve RESOLVED_MJS_FILES, print the ordered basenames,
//                    write a dry-run manifest, exit 0 BEFORE any SQL_FILES or
//                    MJS_FILES dispatch · no pg.Client.connect(), no
//                    createClient(), no spawnSync for V-* children, no
//                    Supabase Auth call.
//   Any other value → fail closed with exit(2) · raw value is NOT printed.
const RAW_DRY_RUN = process.env.GATE_A_DRY_RUN;
let DRY_RUN;
if (RAW_DRY_RUN === undefined || RAW_DRY_RUN === "") {
  DRY_RUN = false;
} else if (RAW_DRY_RUN === "1") {
  DRY_RUN = true;
} else {
  console.error(
    "FATAL: GATE_A_DRY_RUN has an unrecognised value — " +
    "accepted values are (unset) or \"1\". Refusing to proceed."
  );
  process.exit(2);
}

// ── Safety pins ───────────────────────────────────────────────────────────────
const CANONICAL_PROJECT_REF = "kdstoyyeygcopkogqsyv";
const POOLER_USERNAME_RE = /^postgres\.kdstoyyeygcopkogqsyv$/;
const PRODUCTION_REF = "ijvqdvsvwtwxzcqmoqit";

// ── Env reader — never prints values ─────────────────────────────────────────
function readEnv(key) {
  const envPath = resolve(REPO_ROOT, ".env.local");
  if (!existsSync(envPath)) {
    console.error("FATAL: .env.local not found at", envPath);
    process.exit(2);
  }
  const raw = readFileSync(envPath, "utf8");
  const m = raw.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!m) return null;
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v;
}

// ── Project ref extractor ──────────────────────────────────────────────────
function extractProjectRef(url) {
  let parsed;
  try { parsed = new URL(url); } catch { return null; }
  if (parsed.hostname.endsWith(".pooler.supabase.com")) {
    const m = parsed.username.match(/^postgres\.([a-z0-9]+)$/);
    return m ? m[1] : null;
  }
  if (parsed.hostname.endsWith(".supabase.co")) {
    const m = parsed.hostname.match(/^(?:db\.)?([a-z0-9]+)\.supabase\.co$/);
    return m ? m[1] : null;
  }
  return null;
}

// ── Safety check for DATABASE_URL ────────────────────────────────────────────
function validateDatabaseUrl(urlStr, label) {
  if (!urlStr) {
    console.error(`FATAL: ${label} missing from .env.local`);
    process.exit(2);
  }
  // Hard-refuse production in URL string (belt-and-suspenders before parse)
  if (urlStr.includes(PRODUCTION_REF)) {
    console.error(`FATAL: ${label} contains production ref ${PRODUCTION_REF} — refusing`);
    process.exit(3);
  }
  const ref = extractProjectRef(urlStr);
  if (!ref || ref !== CANONICAL_PROJECT_REF) {
    console.error(
      `FATAL: ${label} project ref '${ref ?? "(unparseable)"}' ` +
      `does not match canonical '${CANONICAL_PROJECT_REF}'`
    );
    process.exit(3);
  }
  // Validate pooler username
  let parsed;
  try { parsed = new URL(urlStr); } catch (e) {
    console.error(`FATAL: ${label} is not a valid URL: ${e.message}`);
    process.exit(2);
  }
  if (parsed.hostname.endsWith(".pooler.supabase.com")) {
    if (!POOLER_USERNAME_RE.test(parsed.username)) {
      console.error(
        `FATAL: ${label} pooler username '${parsed.username}' ` +
        `does not match required pattern`
      );
      process.exit(3);
    }
  }
  console.log(`VERIFIED: ${label} → sandbox ${CANONICAL_PROJECT_REF}`);
}

// ── Startup validation ────────────────────────────────────────────────────────
const sandboxDbUrl = readEnv("SANDBOX_DATABASE_URL");
validateDatabaseUrl(sandboxDbUrl, "SANDBOX_DATABASE_URL");

const anonKey = readEnv("NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY");
if (!anonKey) {
  console.error("FATAL: NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY missing from .env.local");
  process.exit(2);
}

const supabaseUrl = readEnv("NEXT_PUBLIC_NEX_SUPABASE_URL");
if (!supabaseUrl) {
  console.error("FATAL: NEXT_PUBLIC_NEX_SUPABASE_URL missing from .env.local");
  process.exit(2);
}
if (supabaseUrl.includes(PRODUCTION_REF)) {
  console.error(`FATAL: NEXT_PUBLIC_NEX_SUPABASE_URL contains production ref — refusing`);
  process.exit(3);
}

console.log("STARTUP: all safety pins verified");
console.log(`TARGET:  sandbox ${CANONICAL_PROJECT_REF}`);
console.log(`RUNNER:  Gate A Connected Matrix`);
console.log(`OUTPUT:  ${OUTPUT_FILE}`);
console.log("");

// ── Parent-generated disposable test passwords ───────────────────────────────
// Cryptographically random 32-char passwords generated in the PARENT and
// held in parent memory only. Passed explicitly into each child's env so the
// signup child and every downstream V-* child see the SAME value per label.
// Never printed. Never written to disk. Never passed via CLI args.
//
// IDENTITY_LABELS is derived from IDENTITY_MODE:
//   three (default) → ["A","B","C"]
//   two             → ["A","B"] — no password is generated for C, and
//                     buildChildEnv() does NOT set GATE_A_TEST_PASSWORD_C.
const IDENTITY_LABELS = IDENTITY_MODE === "two" ? ["A", "B"] : ["A", "B", "C"];
const DISPOSABLE_PASSWORDS = {};
for (const label of IDENTITY_LABELS) {
  DISPOSABLE_PASSWORDS[label] = randomBytes(24).toString("base64url").slice(0, 32);
}
// No console.log of DISPOSABLE_PASSWORDS. Ever.
console.log(`STARTUP: identity mode = ${IDENTITY_MODE} (${IDENTITY_LABELS.length} identities: ${IDENTITY_LABELS.join(",")})`);
console.log("STARTUP: disposable test passwords generated in parent memory (not printed)");

// ── Parent-generated GATE_A_RUN_ID ───────────────────────────────────────────
// A single run_id per runner invocation, generated with crypto randomUUID().
// Held in parent memory and relayed into every child's env via buildChildEnv().
// Not secret — may appear in capture files and in stdout. Downstream agents
// (CLEANUP, EVIDENCE) read it to correlate rows written during this run.
const GATE_A_RUN_ID = randomUUID();
console.log(`STARTUP: GATE_A_RUN_ID = ${GATE_A_RUN_ID}`);
console.log("");

// ── Results accumulator ───────────────────────────────────────────────────────
const results = {
  runner_started_at: new Date().toISOString(),
  canonical_project_ref: CANONICAL_PROJECT_REF,
  run_id: GATE_A_RUN_ID,
  identity_mode: IDENTITY_MODE,
  identity_labels: IDENTITY_LABELS,
  entries: [],
};

function appendResult(entry) {
  results.entries.push({ ...entry, recorded_at: new Date().toISOString() });
  writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2), "utf8");
}

// ── SQL file executor (uses migrator-role pg connection) ─────────────────────
async function runSqlFile(filePath) {
  const fileName = filePath.split("/").pop();
  console.log(`\n${"─".repeat(60)}`);
  console.log(`SQL: ${fileName}`);
  const sql = readFileSync(filePath, "utf8");
  const client = new pg.Client({ connectionString: sandboxDbUrl });
  await client.connect();
  let exitCode = 0;
  let output = "";
  let errorDetail = null;
  try {
    const result = await client.query(sql);
    // Collect rows from last statement that returns rows
    const rows = Array.isArray(result) ? result.flatMap(r => r.rows ?? []) : (result.rows ?? []);
    output = JSON.stringify(rows, null, 2);
    // Check for any passed_bool = false (preflight check)
    const failures = rows.filter(r => r.passed_bool === false);
    if (failures.length > 0) {
      console.error(`PREFLIGHT FAIL: ${failures.length} check(s) failed`);
      for (const f of failures) {
        console.error(`  check=${f.check_name} expected=${f.expected} observed=${f.observed}`);
      }
      exitCode = 1;
      errorDetail = `passed_bool=false in ${failures.length} row(s)`;
    } else {
      console.log(`PASS: ${rows.length} row(s) returned`);
      if (rows.length > 0 && rows.length <= 50) console.log(output);
    }
  } catch (e) {
    console.error(`FAIL: ${e.message}`);
    exitCode = 1;
    errorDetail = e.message;
  } finally {
    try { await client.end(); } catch { /* ignore */ }
  }
  const entry = {
    file: fileName,
    type: "sql",
    verdict: exitCode === 0 ? "PASS" : "FAIL",
    exit_code: exitCode,
    output: output.slice(0, 2000),
    error: errorDetail,
  };
  appendResult(entry);
  return exitCode;
}

// ── MJS file executor (child process with inherited env) ──────────────────────
// buildChildEnv explicitly merges the parent-held disposable passwords into the
// child's env so the signup child AND each downstream V-* child receive the
// SAME value per label. This replaces the previous
// `env: { ...process.env }` snapshot pattern, which did not propagate child-only
// writes back to the parent and therefore left downstream V-* children with
// empty GATE_A_TEST_PASSWORD_{A,B,C} values.
function buildChildEnv() {
  const childEnv = { ...process.env };
  for (const label of IDENTITY_LABELS) {
    childEnv[`GATE_A_TEST_PASSWORD_${label}`] = DISPOSABLE_PASSWORDS[label];
  }
  childEnv.GATE_A_RUN_ID = GATE_A_RUN_ID;
  return childEnv;
}

function runMjsFile(filePath) {
  const fileName = filePath.split("/").pop();
  console.log(`\n${"─".repeat(60)}`);
  console.log(`MJS: ${fileName}`);

  const child = spawnSync(
    process.execPath,
    [filePath],
    {
      cwd: REPO_ROOT,
      env: buildChildEnv(),
      encoding: "utf8",
      timeout: 120_000,
      maxBuffer: 10 * 1024 * 1024,
    }
  );

  const stdout = child.stdout ?? "";
  const stderr = child.stderr ?? "";
  const exitCode = child.status ?? 1;

  // Print stdout/stderr but NOT the full env (never leak secrets)
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);

  if (child.error) {
    console.error(`SPAWN ERROR: ${child.error.message}`);
  }

  const verdict = exitCode === 0 ? "PASS" : "FAIL";
  console.log(`EXIT: ${exitCode} → ${verdict}`);

  // Attempt to parse structured result from stdout if the script emits a JSON line
  let structuredResult = null;
  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("{") && trimmed.includes('"verdict"')) {
      try { structuredResult = JSON.parse(trimmed); } catch { /* ignore */ }
    }
  }

  const entry = {
    file: fileName,
    type: "mjs",
    verdict,
    exit_code: exitCode,
    structured: structuredResult,
    stdout_tail: stdout.slice(-1500),
    stderr_tail: stderr.slice(-500),
  };
  appendResult(entry);
  return exitCode;
}

// ── V-* eligibility map (consumed in two-mode) ────────────────────────────────
// Read once at startup from the generated classification file. In three-mode
// this map is ignored; all scripts dispatch as before. In two-mode, scripts
// whose two_mode_status is BLOCKED_NEEDS_C or BLOCKED_NEEDS_MORE_THAN_3 are
// recorded with verdict BLOCKED and SKIPPED (no FAIL cascade). MIXED cases
// default to BLOCKED per the owner directive (do not weaken assertions).
let V_STAR_ELIGIBILITY = null;
if (IDENTITY_MODE === "two") {
  if (!existsSync(V_STAR_ELIGIBILITY_FILE)) {
    console.error(
      "FATAL: two-mode requires __tests__/_v-star-eligibility.generated.json — not found"
    );
    process.exit(2);
  }
  try {
    const parsed = JSON.parse(readFileSync(V_STAR_ELIGIBILITY_FILE, "utf8"));
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.scripts)) {
      console.error(
        "FATAL: _v-star-eligibility.generated.json is malformed — expected object with a scripts[] array"
      );
      process.exit(2);
    }
    V_STAR_ELIGIBILITY = {};
    for (const s of parsed.scripts) {
      if (!s || typeof s !== "object" || typeof s.file !== "string" || s.file === "") {
        console.error(
          "FATAL: _v-star-eligibility.generated.json contains a malformed entry (missing/empty file)"
        );
        process.exit(2);
      }
      if (Object.prototype.hasOwnProperty.call(V_STAR_ELIGIBILITY, s.file)) {
        // Duplicate file entry is ambiguous — refuse rather than pick the last one.
        console.error(
          "FATAL: _v-star-eligibility.generated.json contains duplicate entry for a script file — refusing ambiguous classification"
        );
        process.exit(2);
      }
      V_STAR_ELIGIBILITY[s.file] = s;
    }
  } catch (e) {
    console.error("FATAL: failed to parse _v-star-eligibility.generated.json: " + e.message);
    process.exit(2);
  }
}

// ── Allowlist of harness-infra scripts exempt from eligibility gating ────────
// These two scripts are infrastructure (identity bootstrap, cleanup), not V-*
// behavioural scripts, and therefore have no eligibility entry. Every other
// script dispatched in two-mode MUST have an eligibility entry with
// two_mode_status === "ELIGIBLE" exactly.
const INFRA_MJS_FILENAMES = new Set([
  "20_signup_disposable_identities.mjs",
  "90_cleanup.mjs",
]);
const KNOWN_TWO_MODE_STATUSES = new Set([
  "ELIGIBLE",
  "BLOCKED_NEEDS_C",
  "BLOCKED_NEEDS_MORE_THAN_3",
  "MIXED",
]);

// ── File list (run order) ─────────────────────────────────────────────────────
// Rollback scripts (80-82) are excluded from the forward run; they are
// manually invoked after a FAIL and must not be part of the STOP cascade.
const SQL_FILES = [
  resolve(__dirname, "00_preflight.sql"),
  resolve(__dirname, "10_grants.sql"),
];

const MJS_FILES = [
  resolve(__dirname, "20_signup_disposable_identities.mjs"),
  resolve(__dirname, "30_v_auth_null.mjs"),
  resolve(__dirname, "31_v_auth_unknown.mjs"),
  resolve(__dirname, "32_v_auth_unauthorized_diff.mjs"),
  resolve(__dirname, "40_v_w1_new.mjs"),
  resolve(__dirname, "41_v_w1_exist.mjs"),
  resolve(__dirname, "42_v_w1_cap.mjs"),
  resolve(__dirname, "43_v_w1_cap_race.mjs"),
  resolve(__dirname, "44_v_w1_whitespace.mjs"),
  resolve(__dirname, "45_v_w1_dup.mjs"),
  resolve(__dirname, "50_v_w2_ok.mjs"),
  resolve(__dirname, "51_v_w2_over.mjs"),
  resolve(__dirname, "52_v_w2_dup.mjs"),
  resolve(__dirname, "53_v_w2_auth.mjs"),
  resolve(__dirname, "60_v_w3_update.mjs"),
  resolve(__dirname, "61_v_w3_insert.mjs"),
  resolve(__dirname, "62_v_w3_role.mjs"),
  resolve(__dirname, "63_v_w3_cap.mjs"),
  resolve(__dirname, "64_v_w3_race.mjs"),
  resolve(__dirname, "65_v_w3_promote.mjs"),
  resolve(__dirname, "66_v_w3_nopromote.mjs"),
  resolve(__dirname, "70_v_atomic.mjs"),
  // 80/81/82 excluded from forward run (failure-path only)
  resolve(__dirname, "90_cleanup.mjs"),
];

// ── Resolve bounded-profile selector against MJS_FILES ───────────────────────
// When BOUNDED_PROFILE === "abc-14", the forward run executes exactly the
// 14-entry manifest in its stated order, intersected with MJS_FILES. Any
// missing, duplicate, or ambiguous basename fails closed. 90_cleanup.mjs is
// not in the manifest and must not appear in the resolved list.
let RESOLVED_MJS_FILES = MJS_FILES;
if (BOUNDED_PROFILE === "abc-14") {
  const basenameIndex = new Map();
  for (const full of MJS_FILES) {
    const b = basename(full);
    if (basenameIndex.has(b)) {
      console.error(
        "FATAL: MJS_FILES contains duplicate basename — refusing ambiguous bounded resolution"
      );
      process.exit(2);
    }
    basenameIndex.set(b, full);
  }
  const resolved = [];
  for (const name of BOUNDED_PROFILE_ABC14) {
    const full = basenameIndex.get(name);
    if (!full) {
      console.error(
        "FATAL: GATE_A_BOUNDED_PROFILE=abc-14 references a script not present in MJS_FILES — refusing"
      );
      process.exit(2);
    }
    resolved.push(full);
  }
  if (resolved.length !== BOUNDED_PROFILE_ABC14.length) {
    console.error(
      "FATAL: bounded-profile resolution length mismatch — refusing"
    );
    process.exit(2);
  }
  if (resolved.some((p) => basename(p) === "90_cleanup.mjs")) {
    console.error(
      "FATAL: bounded-profile abc-14 unexpectedly contains 90_cleanup.mjs — refusing"
    );
    process.exit(2);
  }
  RESOLVED_MJS_FILES = resolved;
  console.log(
    `STARTUP: bounded profile abc-14 active → ${resolved.length} scripts (cleanup excluded)`
  );
}

if (SKIP_CLEANUP) {
  console.log("STARTUP: GATE_A_SKIP_CLEANUP=1 — cleanup (90_cleanup.mjs) will be refused at dispatch");
}

// ── Preflight checklist · §16.48.18 · 2026-11-20 ─────────────────────────────
// Optional module. If present, prints an UNVERIFIED-tiered checklist listing
// the operator's current flag state. Never reads or prints secrets. Absence of
// the module is NOT a fatal — the runner proceeds normally.
try {
  const { printPreflightChecklist } = await import("./_preflight-checklist.mjs");
  if (typeof printPreflightChecklist === "function") {
    printPreflightChecklist({
      identityMode: IDENTITY_MODE,
      boundedProfile: BOUNDED_PROFILE,
      skipCleanup: SKIP_CLEANUP,
      dryRun: DRY_RUN,
    });
  }
} catch (_) {
  // Module not present — intentional no-op.
}

// ── Dry-run short-circuit · §16.48.18 · 2026-11-20 ───────────────────────────
// When GATE_A_DRY_RUN=1, resolve + print the ordered RESOLVED_MJS_FILES
// basenames, write a dry-run manifest to OUTPUT_FILE, and exit 0 BEFORE any
// SQL_FILES or MJS_FILES dispatch. No pg.Client.connect(), no createClient(),
// no spawnSync for V-* children, no Supabase Auth call occurs below this point.
if (DRY_RUN) {
  const dryRunBasenames = RESOLVED_MJS_FILES.map((p) => basename(p));
  console.log(`\n${"═".repeat(60)}`);
  console.log(`GATE_A_DRY_RUN=1 — resolved ${dryRunBasenames.length} MJS script(s), no dispatch`);
  console.log(`${"─".repeat(60)}`);
  for (let i = 0; i < dryRunBasenames.length; i += 1) {
    console.log(`  ${String(i + 1).padStart(2, " ")}. ${dryRunBasenames[i]}`);
  }
  console.log(`${"─".repeat(60)}`);
  console.log(`DRY-RUN COMPLETE — no network, no DB, no spawn`);
  results.dry_run = true;
  results.dry_run_manifest = dryRunBasenames;
  results.runner_exit = 0;
  results.runner_completed_at = new Date().toISOString();
  writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2), "utf8");
  console.log(`Results: ${OUTPUT_FILE}`);
  process.exit(0);
}

// ── Main run ──────────────────────────────────────────────────────────────────
let overallExit = 0;

for (const f of SQL_FILES) {
  const code = await runSqlFile(f);
  if (code !== 0) {
    console.error(`\nSTOP: ${f.split("/").pop()} FAILED — mandatory stop`);
    results.stopped_at = f.split("/").pop();
    results.runner_exit = 1;
    writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2), "utf8");
    process.exit(1);
  }
}

for (const f of RESOLVED_MJS_FILES) {
  const fileName = basename(f);

  // Cleanup-skip gate · §16.48.17 · 2026-11-19 · unconditional.
  // When GATE_A_SKIP_CLEANUP=1, 90_cleanup.mjs is BLOCKED here regardless of
  // identity mode, bounded-profile state, or any downstream INFRA bypass.
  // Verdict=BLOCKED is not FAIL · cascade continues · no child is spawned ·
  // no Auth/DB call is made. This guard runs BEFORE the two-mode dispatcher
  // gate so that the INFRA allowlist cannot reach cleanup when skip is on.
  if (SKIP_CLEANUP && fileName === "90_cleanup.mjs") {
    console.log(`\n${"─".repeat(60)}`);
    console.log(`MJS: ${fileName} — SKIPPED (GATE_A_SKIP_CLEANUP=1)`);
    const entry = {
      file: fileName,
      type: "mjs",
      verdict: "BLOCKED",
      reason: "GATE_A_SKIP_CLEANUP=1 — cleanup refused in this run",
      exit_code: null,
      skipped: true,
    };
    appendResult(entry);
    continue;
  }

  // Two-mode dispatch gate (positive allowlist · §16.48.17 · 2026-11-19).
  // Infra scripts (signup 20, cleanup 90) always run · they have no eligibility
  // entry. For every other (V-*) script, dispatch requires an eligibility entry
  // with two_mode_status === "ELIGIBLE" EXACTLY. All other cases — missing
  // entry, missing status, unknown/typo status, known BLOCKED statuses, MIXED —
  // record verdict BLOCKED with a named reason and skip the spawn. BLOCKED is
  // not FAIL · cascade continues · no child process started · no Auth/DB call.
  if (IDENTITY_MODE === "two" && !INFRA_MJS_FILENAMES.has(fileName)) {
    const elig = V_STAR_ELIGIBILITY ? V_STAR_ELIGIBILITY[fileName] : undefined;
    let blockReason = null;
    let blockStatusLabel = null;
    if (!elig) {
      blockReason = "two-mode: script has no eligibility entry — refusing to dispatch unclassified V-* in two-mode";
      blockStatusLabel = "NOT_CLASSIFIED";
    } else if (typeof elig.two_mode_status !== "string" || elig.two_mode_status === "") {
      blockReason = "two-mode: eligibility entry present but two_mode_status field is missing or empty";
      blockStatusLabel = "MISSING_STATUS";
    } else if (!KNOWN_TWO_MODE_STATUSES.has(elig.two_mode_status)) {
      // Name the reason, not the raw value — same rule as the mode-selector.
      blockReason = "two-mode: eligibility entry has an unrecognised two_mode_status value — accepted values are ELIGIBLE, BLOCKED_NEEDS_C, BLOCKED_NEEDS_MORE_THAN_3, MIXED";
      blockStatusLabel = "UNKNOWN_STATUS";
    } else if (elig.two_mode_status !== "ELIGIBLE") {
      // Known non-ELIGIBLE status: BLOCKED_NEEDS_C / BLOCKED_NEEDS_MORE_THAN_3 / MIXED.
      blockReason = elig.two_mode_blocker_reason || `two-mode: status=${elig.two_mode_status}`;
      blockStatusLabel = elig.two_mode_status;
    }
    if (blockReason !== null) {
      console.log(`\n${"─".repeat(60)}`);
      console.log(`MJS: ${fileName} — SKIPPED (two-mode)`);
      console.log(`  two_mode_status: ${blockStatusLabel}`);
      console.log(`  reason: ${blockReason}`);
      const entry = {
        file: fileName,
        type: "mjs",
        verdict: "BLOCKED",
        two_mode_status: blockStatusLabel,
        reason: blockReason,
        assertions_blocked_in_two_mode: elig && typeof elig.assertions_blocked_in_two_mode === "number"
          ? elig.assertions_blocked_in_two_mode
          : null,
        exit_code: null,
        skipped: true,
      };
      appendResult(entry);
      continue; // cascade continues; BLOCKED is not FAIL; no child spawned
    }
    // elig.two_mode_status === "ELIGIBLE" — fall through to normal dispatch.
  }

  const code = runMjsFile(f);
  if (code !== 0) {
    console.error(`\nSTOP: ${fileName} FAILED — mandatory stop`);
    results.stopped_at = fileName;
    results.runner_exit = 1;
    writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2), "utf8");
    process.exit(1);
  }
}

results.runner_exit = 0;
results.runner_completed_at = new Date().toISOString();

// ── Summary finaliser · §16.48.18 · 2026-11-20 ───────────────────────────────
// Optional module. If present, classifies SKIP_CLEANUP entries as
// SKIPPED_BY_DESIGN and attaches a counts-by-verdict summary without lowering
// the overall verdict. Absence of the module is NOT a fatal.
try {
  const { finaliseSummary } = await import("./_summary-reporter.mjs");
  if (typeof finaliseSummary === "function") {
    finaliseSummary(results);
  }
} catch (_) {
  // Module not present — intentional no-op.
}

writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2), "utf8");
console.log(`\n${"═".repeat(60)}`);
console.log(`GATE A RUNNER COMPLETE — all scripts PASS`);
console.log(`Results: ${OUTPUT_FILE}`);
process.exit(0);
