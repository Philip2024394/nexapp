#!/usr/bin/env node
// scripts/gate-a-connected-matrix/_reset-and-run-16-48-29.mjs
//
// §16.48.29 · Lane G Gate A · direct-dispatch sandbox probe · 2026-11-20
// Authorisation: owner A1 path 2026-11-20 — ONE sandbox run · ten cases ·
//   sandbox kdstoyyeygcopkogqsyv ONLY · production ijvqdvsvwtwxzcqmoqit SEALED.
//
// WHY THIS FILE EXISTS
// ────────────────────
// `_runner.mjs` only accepts GATE_A_BOUNDED_PROFILE="abc-14"; the §16.48.29
// authorised batch (40, 41, 44, 45, 50, 52, 60, 65, 66, 70) is not that
// manifest (70 is missing, 20/30/31/32/53 are present), and the owner has
// forbidden editing `_runner.mjs`. This file therefore dispatches the ten
// authorised cases directly, preserving every safeguard that `_runner.mjs`
// normally provides.
//
// HARD INVARIANTS
// ───────────────
// · CANONICAL_PROJECT_REF pinned to kdstoyyeygcopkogqsyv at: Supabase URL,
//   SANDBOX_DATABASE_URL, pooler username, and service-role JWT `ref` claim.
// · Production ref ijvqdvsvwtwxzcqmoqit → HARD REFUSE at every pin above.
// · NEVER prints DATABASE_URL, JWT, password, anon key, or service-role key.
// · NEVER uses supabase.auth.admin.createUser.
// · Resets ONLY the three pre-existing A/B/C identities already in the capture
//   file, once each, via supabase.auth.admin.updateUserById.
// · Child spawn: 180 000 ms timeout + SIGKILL on expiry.
// · Child env: GATE_A_TEST_PASSWORD_{A,B,C} + GATE_A_SKIP_CLEANUP=1 so
//   90_cleanup.mjs is REFUSED by any downstream code that might reach it.
// · Atomic JSON write of _results.16-48-29.json.OUTPUT (tmp + rename).
// · Redaction via actual-string split/join — never a regex derived from the
//   password (so it still redacts strings containing regex metacharacters).
// · Stops on first FAIL · continues on BLOCKED · continues on PASS.
// · In-memory passwords overwritten before process exit.
// · No commit · no push · no deploy · no migration · no config write.
//
// BATCH (owner-authorised · §16.48.29 · EXACT order)
// ──────────────────────────────────────────────────
//   40_v_w1_new.mjs
//   41_v_w1_exist.mjs
//   44_v_w1_whitespace.mjs
//   45_v_w1_dup.mjs
//   50_v_w2_ok.mjs
//   52_v_w2_dup.mjs
//   60_v_w3_update.mjs
//   65_v_w3_promote.mjs
//   66_v_w3_nopromote.mjs
//   70_v_atomic.mjs   ← Case G STATE_BLOCKER · dispatched for CURRENT
//                       evidence only · remains independently blocked per
//                       A1 §5. No attempt here to resolve the architectural
//                       EXCEPTION-handler finding at
//                       nex_invite_to_call_tx::BEGIN...EXCEPTION
//                       WHEN unique_violation THEN...END (catches +
//                       handles, does NOT re-raise → no RPC rollback).
//
// NOT IN BATCH (deliberately omitted · do NOT re-expand)
// ──────────────────────────────────────────────────────
//   20 signup — identities already captured and provisioned
//   30/31/32 auth-null/unknown/unauthorized
//   42/43 (w1 cap + cap_race)
//   51 (w2 over)
//   53 (w2 auth)
//   61/62/63/64 (w3 insert/role/cap/race)
//   80/81/82 rollback — failure-path only
//   90 cleanup — REFUSED unconditionally via GATE_A_SKIP_CLEANUP=1
//
// ─────────────────────────────────────────────────────────────────────────────

import {
  readFileSync,
  writeFileSync,
  renameSync,
  existsSync,
} from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// ── Paths + refs ─────────────────────────────────────────────────────────────
const __dir = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dir, "../..");
const MATRIX_DIR = __dir;

const CANON_REF = "kdstoyyeygcopkogqsyv";
const PROD_REF = "ijvqdvsvwtwxzcqmoqit";
const POOLER_USERNAME_RE = /^postgres\.kdstoyyeygcopkogqsyv$/;

const CAPTURE_PATH = join(MATRIX_DIR, "99_identity_capture.json.OUTPUT");
const VERDICT_PATH = join(MATRIX_DIR, "_results.16-48-29.json.OUTPUT");

const BATCH = Object.freeze([
  "40_v_w1_new.mjs",
  "41_v_w1_exist.mjs",
  "44_v_w1_whitespace.mjs",
  "45_v_w1_dup.mjs",
  "50_v_w2_ok.mjs",
  "52_v_w2_dup.mjs",
  "60_v_w3_update.mjs",
  "65_v_w3_promote.mjs",
  "66_v_w3_nopromote.mjs",
  "70_v_atomic.mjs",
]);

const IDENTITY_LABELS = Object.freeze(["A", "B", "C"]);

// ── Env reader · never prints values ─────────────────────────────────────────
function readEnvLocal(key) {
  const envPath = resolve(REPO_ROOT, ".env.local");
  if (!existsSync(envPath)) return null;
  const raw = readFileSync(envPath, "utf8");
  const m = raw.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!m) return null;
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v;
}

// ── Project-ref extractors ───────────────────────────────────────────────────
function extractRefFromUrl(urlStr) {
  let u;
  try { u = new URL(urlStr); } catch { return null; }
  if (u.hostname.endsWith(".pooler.supabase.com")) {
    const m = u.username.match(/^postgres\.([a-z0-9]+)$/);
    return m ? m[1] : null;
  }
  if (u.hostname.endsWith(".supabase.co")) {
    const m = u.hostname.match(/^(?:db\.)?([a-z0-9]+)\.supabase\.co$/);
    return m ? m[1] : null;
  }
  return null;
}

// Decode a Supabase JWT without verifying the signature — we only need to
// read the `ref` claim to confirm the service-role key targets sandbox.
// The key is NEVER printed. Only the ref claim is returned (short string).
function extractRefFromJwt(jwt) {
  if (!jwt || typeof jwt !== "string") return null;
  const parts = jwt.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = Buffer.from(
      parts[1].replace(/-/g, "+").replace(/_/g, "/"),
      "base64",
    ).toString("utf8");
    const obj = JSON.parse(payload);
    return typeof obj.ref === "string" ? obj.ref : null;
  } catch {
    return null;
  }
}

// ── Redaction helpers ────────────────────────────────────────────────────────
// Pass the in-memory passwords explicitly (not via process.env) so the caller
// controls exactly which strings are scrubbed. Uses split/join — never a
// regex derived from the password — so passwords containing regex meta-
// characters are still fully redacted.
function makeRedactor(secretStrings) {
  const list = Array.isArray(secretStrings)
    ? secretStrings.filter((s) => typeof s === "string" && s.length >= 6)
    : [];
  return function redact(s) {
    if (!s) return s;
    let out = String(s);
    for (const secret of list) {
      out = out.split(secret).join("***");
    }
    return out;
  };
}

function tailLines(s, n) {
  if (!s) return "";
  const lines = s.split(/\r?\n/);
  return lines.slice(Math.max(0, lines.length - n)).join("\n");
}

// ── Atomic JSON writer ───────────────────────────────────────────────────────
function atomicWriteJson(path, obj) {
  const tmp = `${path}.tmp-${randomBytes(4).toString("hex")}`;
  writeFileSync(tmp, JSON.stringify(obj, null, 2) + "\n", "utf8");
  renameSync(tmp, path);
}

function nowIso() { return new Date().toISOString(); }

// ── Child dispatch · timeout + SIGKILL ───────────────────────────────────────
function runChild(scriptPath, childEnv, timeoutMs = 180_000) {
  return new Promise((resolveP) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    const child = spawn(process.execPath, [scriptPath], {
      cwd: REPO_ROOT,
      env: { ...process.env, ...childEnv },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const timer = setTimeout(() => {
      if (!settled) {
        try { child.kill("SIGKILL"); } catch { /* ignore */ }
      }
    }, timeoutMs);
    child.stdout.on("data", (b) => { stdout += b.toString("utf8"); });
    child.stderr.on("data", (b) => { stderr += b.toString("utf8"); });
    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolveP({ exit: -1, stdout, stderr: `${stderr}\nSPAWN_ERROR: ${err.message}`, signal: null });
    });
    child.on("close", (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolveP({
        exit: typeof code === "number" ? code : -1,
        stdout,
        stderr,
        signal: signal ?? null,
      });
    });
  });
}

// ── Verdict classifier ──────────────────────────────────────────────────────
// Child scripts emit a structured JSON line via _shared.mjs::emitResult with
// a `verdict` field. That field is the authoritative truth: the child knows
// whether it produced PASS vs PARTIAL vs BLOCKED even when it chooses to
// exit 0 in all those cases (70_v_atomic exits 0 on PARTIAL · §16.48.29
// classifier bug). Only fall back to exit-code logic when no structured
// verdict is present (child crashed before emitResult or malformed output).
function classify(exit, stdout, stderr, childStructured) {
  const all = `${stdout}\n${stderr}`;
  const rateLimited = /\b429\b/.test(all) || /rate[\s_-]?limit/i.test(all);

  if (childStructured && typeof childStructured.verdict === "string") {
    const v = childStructured.verdict.toUpperCase();
    const d = typeof childStructured.detail === "string" && childStructured.detail
      ? `child verdict=${v}: ${childStructured.detail}`
      : `child verdict=${v}`;
    if (v === "PASS")    return { verdict: "PASS",    rate_limited: false,       detail: d };
    if (v === "PARTIAL") return { verdict: "PARTIAL", rate_limited: false,       detail: d };
    if (v === "BLOCKED") return { verdict: "BLOCKED", rate_limited: rateLimited, detail: d };
    if (v === "FAIL")    return { verdict: "FAIL",    rate_limited: rateLimited, detail: d };
    // Unknown structured verdict · fall through to exit-code logic.
  }

  if (exit === 0) return { verdict: "PASS", rate_limited: false, detail: "exit 0 · no structured verdict" };
  if (rateLimited) {
    return { verdict: "STOP_RATE_LIMITED", rate_limited: true, detail: "rate-limit signal in output" };
  }
  if (/\bBLOCKED\b/.test(all)) {
    return { verdict: "BLOCKED", rate_limited: false, detail: "BLOCKED marker in output" };
  }
  return { verdict: "FAIL", rate_limited: false, detail: `exit ${exit} · no structured verdict` };
}

// ── Abort helper (writes a verdict stub so we don't vanish silently) ────────
function abort(reason, code = 3) {
  console.error(`ABORT: ${reason}`);
  try {
    atomicWriteJson(VERDICT_PATH, {
      round: "§16.48.29",
      run_id: null,
      started_at: nowIso(),
      finished_at: nowIso(),
      target_ref: CANON_REF,
      entries: [],
      stop_reason: `preamble_abort: ${reason}`,
    });
  } catch { /* ignore */ }
  process.exit(code);
}

// ── Safety preamble ──────────────────────────────────────────────────────────
function safetyPreamble() {
  // 1. NEXT_PUBLIC_NEX_SUPABASE_URL
  const publicUrl = readEnvLocal("NEXT_PUBLIC_NEX_SUPABASE_URL");
  if (!publicUrl) abort("NEXT_PUBLIC_NEX_SUPABASE_URL missing from .env.local");
  if (publicUrl.includes(PROD_REF)) abort("NEXT_PUBLIC_NEX_SUPABASE_URL contains production ref");
  const publicRef = extractRefFromUrl(publicUrl);
  if (publicRef !== CANON_REF) abort(`NEXT_PUBLIC_NEX_SUPABASE_URL project ref '${publicRef ?? "(unparseable)"}' !== '${CANON_REF}'`);

  // 2. SANDBOX_DATABASE_URL (optional here but validated when present)
  const dbUrl = readEnvLocal("SANDBOX_DATABASE_URL");
  if (dbUrl) {
    if (dbUrl.includes(PROD_REF)) abort("SANDBOX_DATABASE_URL contains production ref");
    const dbRef = extractRefFromUrl(dbUrl);
    if (dbRef !== CANON_REF) abort(`SANDBOX_DATABASE_URL project ref '${dbRef ?? "(unparseable)"}' !== '${CANON_REF}'`);
    // Pooler-username pin
    try {
      const u = new URL(dbUrl);
      if (u.hostname.endsWith(".pooler.supabase.com") && !POOLER_USERNAME_RE.test(u.username)) {
        abort("SANDBOX_DATABASE_URL pooler username does not match required pattern");
      }
    } catch (e) {
      abort(`SANDBOX_DATABASE_URL is not a valid URL: ${e.message}`);
    }
  }

  // 3. Service-role key (used ONLY for admin.updateUserById password reset).
  //    JWT ref claim MUST match canonical sandbox ref.
  const serviceKey = readEnvLocal("NEX_SUPABASE_SERVICE_ROLE_KEY")
    ?? readEnvLocal("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) abort("NEX_SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_ROLE_KEY) missing from .env.local");
  const srRef = extractRefFromJwt(serviceKey);
  if (srRef === null) abort("service-role key could not be decoded (not a valid JWT)");
  if (srRef === PROD_REF) abort("service-role key JWT ref claim = production — refusing");
  if (srRef !== CANON_REF) abort(`service-role key JWT ref claim '${srRef}' !== '${CANON_REF}'`);

  // 4. Anon key (passed through to children via their own .env.local read).
  const anonKey = readEnvLocal("NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY");
  if (!anonKey) abort("NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY missing from .env.local");
  const anonRef = extractRefFromJwt(anonKey);
  if (anonRef !== CANON_REF) abort(`anon key JWT ref claim '${anonRef ?? "(undecodable)"}' !== '${CANON_REF}'`);

  // 5. Identity capture file present + A/B/C fully specified.
  if (!existsSync(CAPTURE_PATH)) abort(`identity capture missing: ${CAPTURE_PATH}`);
  let capture;
  try { capture = JSON.parse(readFileSync(CAPTURE_PATH, "utf8")); }
  catch (e) { abort(`identity capture is not valid JSON: ${e.message}`); }
  for (const label of IDENTITY_LABELS) {
    const id = capture?.[label];
    if (!id) abort(`capture missing identity '${label}'`);
    if (!id.email || typeof id.email !== "string") abort(`capture ${label}.email missing`);
    if (!id.supabase_user_id || typeof id.supabase_user_id !== "string") abort(`capture ${label}.supabase_user_id missing`);
    if (!id.nex_account_id || typeof id.nex_account_id !== "string") abort(`capture ${label}.nex_account_id missing`);
  }

  // 6. Every BATCH script exists on disk.
  for (const name of BATCH) {
    const p = join(MATRIX_DIR, name);
    if (!existsSync(p)) abort(`BATCH script missing on disk: ${name}`);
  }

  return { publicUrl, serviceKey, capture };
}

// ── Admin verify then reset · getUserById check before any updateUserById ───
//
// Two-phase to honour authorisation §5 "Read current sandbox Auth records;
// match frozen A/B/C UUID + email mappings against capture file. On any
// mismatch, STOP."
//
//  Phase 1 · READ-ONLY · admin.getUserById for each label. Confirm:
//    - user exists for the capture UUID
//    - user.email (case-insensitive) matches capture[label].email
//  If anything is off: STOP with no mutations attempted.
//
//  Phase 2 · MUTATION · admin.updateUserById(password) for each label, once.
//  No admin.createUser is ever reachable in this file.
async function verifyAndResetAbcPasswords({ publicUrl, serviceKey, capture }, passwords) {
  const admin = createClient(publicUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Phase 1 · verify.
  const verifications = {};
  for (const label of IDENTITY_LABELS) {
    const supaUserId = capture[label].supabase_user_id;
    const expectedEmail = String(capture[label].email).toLowerCase();
    const { data, error } = await admin.auth.admin.getUserById(supaUserId);
    if (error) {
      return {
        ok: false,
        phase: "verify",
        outcomes: verifications,
        failedLabel: label,
        failedMessage: `getUserById: ${error.message}`,
      };
    }
    const user = data?.user;
    if (!user) {
      return {
        ok: false,
        phase: "verify",
        outcomes: verifications,
        failedLabel: label,
        failedMessage: "getUserById returned no user",
      };
    }
    const actualEmail = String(user.email ?? "").toLowerCase();
    if (actualEmail !== expectedEmail) {
      return {
        ok: false,
        phase: "verify",
        outcomes: verifications,
        failedLabel: label,
        failedMessage: "email mismatch between capture and sandbox Auth record",
      };
    }
    verifications[label] = {
      verified: true,
      user_id: supaUserId,
      email_matches: true,
    };
  }

  // Phase 2 · reset.
  const outcomes = {};
  for (const label of IDENTITY_LABELS) {
    const supaUserId = capture[label].supabase_user_id;
    const newPw = passwords[label];
    const { data, error } = await admin.auth.admin.updateUserById(
      supaUserId,
      { password: newPw },
    );
    if (error) {
      outcomes[label] = { ok: false, user_id: supaUserId, error_code: error.code ?? null };
      return {
        ok: false,
        phase: "reset",
        outcomes: { ...verifications, ...outcomes },
        failedLabel: label,
        failedMessage: error.message,
      };
    }
    outcomes[label] = {
      ok: true,
      user_id: supaUserId,
      updated_at: data?.user?.updated_at ?? null,
    };
  }
  return {
    ok: true,
    phase: "reset",
    outcomes: { ...verifications, ...outcomes },
    failedLabel: null,
    failedMessage: null,
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const started_at = nowIso();
  const run_id = randomBytes(8).toString("hex");

  console.log(`§16.48.29 · direct-dispatch · run_id=${run_id} · target=${CANON_REF}`);
  console.log("STARTUP: safety preamble …");

  const pre = safetyPreamble();
  console.log("STARTUP: safety preamble PASS");

  // Generate 3 passwords IN MEMORY ONLY. Never printed, never written.
  const passwords = {};
  for (const label of IDENTITY_LABELS) {
    passwords[label] = randomBytes(24).toString("base64url").slice(0, 32);
  }
  const redact = makeRedactor([
    passwords.A, passwords.B, passwords.C,
    pre.serviceKey,
  ]);

  console.log("STARTUP: 3 disposable passwords generated in memory (not printed)");

  // Verify (read-only) then reset for A/B/C.
  console.log("VERIFY: admin.getUserById for A, B, C (read-only pre-check) …");
  const reset = await verifyAndResetAbcPasswords(pre, passwords);
  if (!reset.ok) {
    const verdict = {
      round: "§16.48.29",
      run_id,
      started_at,
      finished_at: nowIso(),
      target_ref: CANON_REF,
      entries: [],
      stop_reason: `${reset.phase}_fail: ${reset.failedLabel}: ${redact(reset.failedMessage ?? "")}`,
      reset_outcomes: reset.outcomes,
    };
    atomicWriteJson(VERDICT_PATH, verdict);
    // Scrub in-memory passwords best-effort.
    for (const label of IDENTITY_LABELS) passwords[label] = "";
    console.error(`${reset.phase.toUpperCase()} FAIL on identity ${reset.failedLabel}`);
    process.exit(1);
  }
  console.log("VERIFY: A, B, C — UUID/email match sandbox Auth records");
  console.log("RESET: A, B, C — passwords updated via admin.updateUserById");

  // Build the child env. GATE_A_SKIP_CLEANUP=1 ensures 90_cleanup.mjs is
  // refused anywhere it might be reached. GATE_A_IDENTITY_MODE=three is
  // forwarded for clarity; children that read it will see the matching
  // three-label world.
  const childEnv = {
    GATE_A_TEST_PASSWORD_A: passwords.A,
    GATE_A_TEST_PASSWORD_B: passwords.B,
    GATE_A_TEST_PASSWORD_C: passwords.C,
    GATE_A_SKIP_CLEANUP: "1",
    GATE_A_IDENTITY_MODE: "three",
    GATE_A_RUN_ID: run_id,
  };

  // Dispatch loop · STOP on first FAIL · continue on PASS/BLOCKED.
  const entries = [];
  let stopReason = null;
  for (const name of BATCH) {
    const scriptPath = join(MATRIX_DIR, name);
    console.log(`\n${"─".repeat(60)}`);
    console.log(`DISPATCH: ${name}`);
    const { exit, stdout, stderr, signal } = await runChild(scriptPath, childEnv, 180_000);

    // Do NOT forward raw child stderr to our stdout; capture a sanitised
    // tail for the verdict file only.
    const combined = `${stdout}\n${stderr}`;
    const tail = redact(tailLines(combined.trimEnd(), 40));

    // Parse the child's structured verdict line BEFORE classifying so that
    // classify() can use the child's authoritative `verdict` field. The
    // contract (per _shared.mjs::emitResult) is one JSON line on stdout
    // whose object includes a string `verdict` field. Multiple matches are
    // possible if the child emits progress JSON — take the LAST one.
    let childStructured = null;
    for (const line of stdout.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed.startsWith("{") && trimmed.includes('"verdict"')) {
        try { childStructured = JSON.parse(trimmed); } catch { /* ignore */ }
      }
    }

    const cls = classify(exit, stdout, stderr, childStructured);

    const entry = {
      file: name,
      exit,
      signal,
      verdict: cls.verdict,
      detail: cls.detail,
      rate_limited: cls.rate_limited,
      structured: childStructured,
      last_lines: tail,
    };
    entries.push(entry);
    console.log(`→ ${cls.verdict} (${cls.detail})`);

    if (cls.verdict === "STOP_RATE_LIMITED") {
      stopReason = `rate_limited_at:${name}`;
      break;
    }
    if (cls.verdict === "FAIL") {
      stopReason = `first_fail_at:${name}`;
      break;
    }
    // PASS, PARTIAL, and BLOCKED → cascade continues. PARTIAL is a
    // documented coverage-limited outcome (e.g. 70_v_atomic needs ≥4
    // provisioned identities) and is not a hard failure.
  }

  const verdict = {
    round: "§16.48.29",
    run_id,
    started_at,
    finished_at: nowIso(),
    target_ref: CANON_REF,
    batch_size: BATCH.length,
    identity_mode: "three",
    reset_outcomes: reset.outcomes,
    entries,
    stop_reason: stopReason,
  };
  atomicWriteJson(VERDICT_PATH, verdict);

  // Scrub in-memory passwords best-effort before exit.
  for (const label of IDENTITY_LABELS) passwords[label] = "";

  // Exit 0 regardless — the verdict file carries per-entry truth. Non-zero
  // would be misleading when e.g. Case G BLOCKED is the authorised outcome.
  const counts = { PASS: 0, PARTIAL: 0, BLOCKED: 0, FAIL: 0, STOP_RATE_LIMITED: 0 };
  for (const e of entries) counts[e.verdict] = (counts[e.verdict] ?? 0) + 1;
  console.log(
    `\nDONE §16.48.29 · run_id=${run_id} · entries=${entries.length}/${BATCH.length}` +
    ` · PASS=${counts.PASS} PARTIAL=${counts.PARTIAL} BLOCKED=${counts.BLOCKED}` +
    ` FAIL=${counts.FAIL} STOP_RATE_LIMITED=${counts.STOP_RATE_LIMITED}` +
    ` · stop=${stopReason ?? "none"}`,
  );
  console.log(`VERDICT: ${VERDICT_PATH}`);
  process.exit(0);
}

main().catch((err) => {
  // Catch-all. Never print the raw stack if it could carry a secret —
  // but we have no redactor in scope here (passwords may already have been
  // scrubbed). Emit the message only.
  const msg = err?.message ?? String(err);
  console.error(`UNCAUGHT: ${msg}`);
  try {
    atomicWriteJson(VERDICT_PATH, {
      round: "§16.48.29",
      run_id: null,
      started_at: nowIso(),
      finished_at: nowIso(),
      target_ref: CANON_REF,
      entries: [],
      stop_reason: `uncaught: ${msg}`,
    });
  } catch { /* ignore */ }
  process.exit(2);
});
