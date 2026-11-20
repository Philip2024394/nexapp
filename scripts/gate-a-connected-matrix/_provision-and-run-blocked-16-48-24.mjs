#!/usr/bin/env node
// scripts/gate-a-connected-matrix/_provision-and-run-blocked-16-48-24.mjs
//
// §16.48.24 orchestrator · owner-authorised 2026-11-20.
//
// Purpose
// ───────
// Lift the 10 BLOCKED verdicts from §16.48.23 by provisioning nex_account
// rows for the three existing auth.users rows (A, B, C from run cedfcd89)
// via the REAL app code path, then re-run ONLY the 10 BLOCKED scripts.
//
// The nex_account provisioning replicates the DB operations that
// src/lib/nex-native/account-service.ts :: createAccount() performs:
//   1. INSERT into public.nex_account via service-role PostgREST.
//      Same column shape: supabase_user_id, display_name, chat_theme='theme-0'.
//   2. RPC public.nex_allocate_handle(p_account_id) — allocates the public
//      nex_handle, matching ensureNexHandle() at account-service.ts:360-382.
// That is the exact chain resolveFromUser() runs on first authed request.
//
// Password-reset step
// ───────────────────
// The §16.48.23 runner held disposable passwords in parent memory only.
// Those passwords are gone. To re-exercise the V-* scripts (which call
// signInWithPassword), we reset passwords on the EXISTING auth.users rows
// via admin.updateUserById(). This is a credential update on existing
// rows, not a new signup. The three auth.users UUIDs do not change.
//
// Scope
// ─────
// · Sandbox only: hard-refuses production ref ijvqdvsvwtwxzcqmoqit at parse time.
// · Single-attempt. Stops on first non-zero child exit, or "429" seen in child
//   stderr/stdout.
// · List-only cleanup — this script never calls 90_cleanup.mjs.
// · No commit, no push, no deploy, no .env.local edit.
// · Only the 3 run-cedfcd89 manifest identities are touched.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dir, "../..");
const IDENTITY_CAPTURE_FILE = resolve(__dir, "99_identity_capture.json.OUTPUT");
const RESULTS_FILE = resolve(__dir, "_results.16-48-24.json.OUTPUT");

const CANONICAL_PROJECT_REF = "kdstoyyeygcopkogqsyv";
const PRODUCTION_REF = "ijvqdvsvwtwxzcqmoqit";

// ── Expected identities (frozen from §16.48.23 manifest) ─────────────────────
const EXPECTED = Object.freeze({
  A: {
    email: "<op-email>",
    supabase_user_id: "64f60d28-23af-446b-a50c-5d236c080449",
  },
  B: {
    email: "<op-email+1>",
    supabase_user_id: "4effbb70-c041-44fa-b861-95daa3ac3622",
  },
  C: {
    email: "<op-email+2>",
    supabase_user_id: "284b4502-84bb-44d9-a1a7-58677a047290",
  },
});

const BLOCKED_SCRIPTS = Object.freeze([
  "32_v_auth_unauthorized_diff.mjs",
  "40_v_w1_new.mjs",
  "41_v_w1_exist.mjs",
  "44_v_w1_whitespace.mjs",
  "45_v_w1_dup.mjs",
  "50_v_w2_ok.mjs",
  "52_v_w2_dup.mjs",
  "60_v_w3_update.mjs",
  "65_v_w3_promote.mjs",
  "66_v_w3_nopromote.mjs",
]);

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

// ── Project ref extractor ─────────────────────────────────────────────────────
function extractRef(url) {
  try {
    const u = new URL(url);
    if (u.hostname.endsWith(".supabase.co")) {
      const m = u.hostname.match(/^(?:db\.)?([a-z0-9]+)\.supabase\.co$/);
      return m ? m[1] : null;
    }
    if (u.hostname.endsWith(".pooler.supabase.com")) {
      const m = u.username.match(/^postgres\.([a-z0-9]+)$/);
      return m ? m[1] : null;
    }
  } catch { /* fall-through */ }
  return null;
}

function hardRefuseProd(urlStr, label) {
  if (!urlStr) {
    console.error(`FATAL: ${label} missing from .env.local`);
    process.exit(2);
  }
  if (urlStr.includes(PRODUCTION_REF)) {
    console.error(`FATAL: ${label} contains production ref ${PRODUCTION_REF} — refusing`);
    process.exit(3);
  }
  const ref = extractRef(urlStr);
  if (!ref || ref !== CANONICAL_PROJECT_REF) {
    console.error(
      `FATAL: ${label} project ref '${ref ?? "(unparseable)"}' ` +
      `does not match canonical '${CANONICAL_PROJECT_REF}'`
    );
    process.exit(3);
  }
  console.log(`VERIFIED: ${label} → sandbox ${CANONICAL_PROJECT_REF}`);
}

// ── Startup validation ────────────────────────────────────────────────────────
const supabaseUrl = readEnv("NEXT_PUBLIC_NEX_SUPABASE_URL");
const anonKey = readEnv("NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY");
const serviceKey = readEnv("NEX_SUPABASE_SERVICE_ROLE_KEY");

hardRefuseProd(supabaseUrl, "NEXT_PUBLIC_NEX_SUPABASE_URL");
if (!anonKey) { console.error("FATAL: NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY missing"); process.exit(2); }
if (!serviceKey) { console.error("FATAL: NEX_SUPABASE_SERVICE_ROLE_KEY missing"); process.exit(2); }

console.log("STARTUP: safety pins verified");
console.log(`TARGET:  sandbox ${CANONICAL_PROJECT_REF}`);
console.log(`RUNNER:  §16.48.24 provision + 10-script re-run`);
console.log("");

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ── Load existing identity capture ────────────────────────────────────────────
if (!existsSync(IDENTITY_CAPTURE_FILE)) {
  console.error("FATAL: identity capture missing — run §16.48.23 first");
  process.exit(2);
}
const capture = JSON.parse(readFileSync(IDENTITY_CAPTURE_FILE, "utf8"));

// Assert the capture matches the frozen §16.48.23 identities.
for (const label of ["A", "B", "C"]) {
  const ident = capture[label];
  if (!ident) { console.error(`FATAL: capture missing label ${label}`); process.exit(2); }
  if (ident.email !== EXPECTED[label].email) {
    console.error(`FATAL: capture ${label} email mismatch`); process.exit(2);
  }
  if (ident.supabase_user_id !== EXPECTED[label].supabase_user_id) {
    console.error(`FATAL: capture ${label} supabase_user_id mismatch`); process.exit(2);
  }
}
console.log("VERIFIED: identity capture matches §16.48.23 cedfcd89 manifest (A, B, C)");
console.log("");

// ── Phase A · provision nex_account via the real app code path ──────────────
//
// Matches src/lib/nex-native/account-service.ts :: createAccount() at
// line 102-148. Column defaults identical. chat_theme='theme-0' matches
// the sealed Joker-theme-at-signup rule (2026-10-01).
//
// Then calls RPC nex_allocate_handle to mirror ensureNexHandle() at line
// 360-382. The RPC is SECURITY DEFINER and is the function the live app
// invokes on first authed request.
async function provisionAccount(label) {
  const { email, supabase_user_id } = EXPECTED[label];
  const localPart = email.split("@")[0] || email;
  const display_name = localPart; // matches session.ts:203 derivation

  // Idempotency check — don't double-insert if a prior run already did it.
  const existing = await admin
    .from("nex_account")
    .select("id, nex_handle")
    .eq("supabase_user_id", supabase_user_id)
    .maybeSingle();
  if (existing.error) {
    throw new Error(`[${label}] pre-check: ${existing.error.message}`);
  }
  if (existing.data) {
    console.log(`[${label}] nex_account EXISTS id=${existing.data.id} handle=${existing.data.nex_handle ?? "(null)"} · skipping INSERT`);
    // Still ensure handle if somehow missing.
    if (!existing.data.nex_handle) {
      const alloc = await admin.rpc("nex_allocate_handle", { p_account_id: existing.data.id });
      if (alloc.error) throw new Error(`[${label}] nex_allocate_handle: ${alloc.error.message}`);
      console.log(`[${label}] nex_allocate_handle → ${alloc.data}`);
    }
    return { nex_account_id: existing.data.id };
  }

  const ins = await admin
    .from("nex_account")
    .insert({
      supabase_user_id,
      display_name,
      phone_country_code: null,
      phone_national_number: null,
      chosen_handle: null,
      chat_theme: "theme-0",
    })
    .select("id, nex_handle")
    .single();
  if (ins.error || !ins.data) {
    throw new Error(`[${label}] nex_account insert: ${ins.error?.message ?? "no row"}`);
  }
  console.log(`[${label}] nex_account INSERTED id=${ins.data.id}`);

  if (!ins.data.nex_handle) {
    const alloc = await admin.rpc("nex_allocate_handle", { p_account_id: ins.data.id });
    if (alloc.error) throw new Error(`[${label}] nex_allocate_handle: ${alloc.error.message}`);
    console.log(`[${label}] nex_allocate_handle → ${alloc.data}`);
  }
  return { nex_account_id: ins.data.id };
}

// ── Phase B · reset password on existing auth.users row ─────────────────────
//
// NOT a new signup — the auth.users row already exists with its original
// UUID. admin.updateUserById mutates the credential only. Password is
// held in parent memory only and passed to child processes via env.
function freshPassword() {
  return randomBytes(24).toString("base64url"); // ≥32 chars, URL-safe
}

async function resetPassword(label, password) {
  const { supabase_user_id } = EXPECTED[label];
  const { error } = await admin.auth.admin.updateUserById(supabase_user_id, { password });
  if (error) throw new Error(`[${label}] password reset: ${error.message}`);
  console.log(`[${label}] password reset OK (not printed)`);
}

// ── Orchestrate ──────────────────────────────────────────────────────────────
const nexAccountIds = {};
const passwords = {};

console.log("PHASE A · provisioning nex_account for A, B, C");
for (const label of ["A", "B", "C"]) {
  const { nex_account_id } = await provisionAccount(label);
  nexAccountIds[label] = nex_account_id;
}
console.log("");

console.log("PHASE B · resetting passwords on existing auth.users rows (not signups)");
for (const label of ["A", "B", "C"]) {
  passwords[label] = freshPassword();
  await resetPassword(label, passwords[label]);
}
console.log("");

// ── Phase C · update identity capture ───────────────────────────────────────
for (const label of ["A", "B", "C"]) {
  capture[label] = {
    ...capture[label],
    nex_account_id: nexAccountIds[label],
    nex_account_found: true,
  };
}
capture.provision_16_48_24 = {
  at: new Date().toISOString(),
  nex_account_ids: nexAccountIds,
  note: "§16.48.24 · nex_account provisioned via createAccount DB chain; passwords reset for test re-run",
};
writeFileSync(IDENTITY_CAPTURE_FILE, JSON.stringify(capture, null, 2), "utf8");
console.log(`WRITTEN: identity capture updated with nex_account_id for A/B/C`);
console.log("");

// ── Phase D · re-run 10 BLOCKED scripts sequentially ────────────────────────
const RUN_ID = randomBytes(8).toString("hex");
const results = {
  round: "§16.48.24",
  run_id: RUN_ID,
  started_at: new Date().toISOString(),
  target_ref: CANONICAL_PROJECT_REF,
  entries: [],
  stop_reason: null,
};

console.log("PHASE D · dispatching 10 previously-BLOCKED scripts");
console.log("");

const childEnv = {
  ...process.env,
  GATE_A_TEST_PASSWORD_A: passwords.A,
  GATE_A_TEST_PASSWORD_B: passwords.B,
  GATE_A_TEST_PASSWORD_C: passwords.C,
};

let stopped = false;
for (const basename of BLOCKED_SCRIPTS) {
  if (stopped) break;
  const scriptPath = resolve(__dir, basename);
  if (!existsSync(scriptPath)) {
    results.entries.push({ file: basename, verdict: "MISSING", exit: null });
    results.stop_reason = `${basename} missing on disk`;
    stopped = true;
    break;
  }
  console.log(`── ${basename} ──`);
  const r = spawnSync(process.execPath, [scriptPath], {
    cwd: REPO_ROOT,
    env: childEnv,
    encoding: "utf8",
    timeout: 60_000,
  });
  const stdout = r.stdout ?? "";
  const stderr = r.stderr ?? "";
  const combined = stdout + "\n" + stderr;

  // Extract last JSON line from stdout (scripts emit a final verdict JSON)
  let verdict = null;
  let detail = null;
  const jsonLines = stdout.split(/\r?\n/).map((s) => s.trim()).filter((s) => s.startsWith("{") && s.endsWith("}"));
  if (jsonLines.length > 0) {
    try {
      const parsed = JSON.parse(jsonLines[jsonLines.length - 1]);
      verdict = parsed.verdict ?? null;
      detail = parsed.detail ?? null;
    } catch { /* keep verdict null */ }
  }

  const is429 = /\b429\b|rate.limit/i.test(combined);
  const entry = {
    file: basename,
    exit: r.status,
    verdict,
    detail,
    rate_limited: is429,
  };
  results.entries.push(entry);

  // Echo stdout/stderr tails (bounded) so run evidence stays in console log
  const tail = (s) => {
    const lines = s.split(/\r?\n/);
    return lines.slice(Math.max(0, lines.length - 20)).join("\n");
  };
  if (stdout.trim()) console.log(tail(stdout));
  if (stderr.trim()) console.error("STDERR:\n" + tail(stderr));
  console.log(`VERDICT: ${verdict ?? "(none)"} · exit=${r.status}${is429 ? " · 429" : ""}`);
  console.log("");

  if (is429) {
    results.stop_reason = `429 rate limit on ${basename}`;
    stopped = true;
    break;
  }
  if (r.status !== 0) {
    results.stop_reason = `${basename} exited ${r.status}`;
    stopped = true;
    break;
  }
  if (verdict && /^FAIL/i.test(verdict)) {
    results.stop_reason = `${basename} FAIL verdict`;
    stopped = true;
    break;
  }
}

results.finished_at = new Date().toISOString();
writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2), "utf8");
console.log(`WRITTEN: ${RESULTS_FILE}`);
console.log("");

// ── Summary ─────────────────────────────────────────────────────────────────
console.log("─── §16.48.24 SUMMARY ───");
console.log(`run_id: ${RUN_ID}`);
console.log(`entries: ${results.entries.length} / ${BLOCKED_SCRIPTS.length}`);
console.log(`stop_reason: ${results.stop_reason ?? "(none)"}`);
for (const e of results.entries) {
  const tag = e.verdict ?? `exit=${e.exit}`;
  console.log(`  ${e.file.padEnd(36)} ${tag}${e.rate_limited ? " (429)" : ""}`);
}

process.exit(stopped ? 1 : 0);
