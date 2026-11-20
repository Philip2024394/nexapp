// scripts/gate-a-connected-matrix/_shared.mjs
//
// Shared utilities for Gate A Connected Matrix scripts.
// Authored by Agent HARNESS · 2026-11-19 · OFFLINE ONLY · NOT EXECUTED.
//
// HARD INVARIANTS
// ───────────────
// · CANONICAL_PROJECT_REF pinned to kdstoyyeygcopkogqsyv.
// · Production ref ijvqdvsvwtwxzcqmoqit is a hard-refuse.
// · Never prints DATABASE_URL, JWT, password, or anon key.
// · Never uses supabase.auth.admin.createUser.
// · Never uses service_role for RPC invocation.

import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dir = dirname(fileURLToPath(import.meta.url));

export const CANONICAL_PROJECT_REF = "kdstoyyeygcopkogqsyv";
export const PRODUCTION_REF = "ijvqdvsvwtwxzcqmoqit";
export const POOLER_USERNAME_RE = /^postgres\.kdstoyyeygcopkogqsyv$/;
export const REPO_ROOT = resolve(__dir, "../..");
export const IDENTITY_CAPTURE_FILE = resolve(__dir, "99_identity_capture.json.OUTPUT");
export const RESULTS_FILE = resolve(__dir, "_results.json.OUTPUT");

// ── Env reader — never prints values ─────────────────────────────────────────
export function readEnv(key) {
  const envPath = resolve(REPO_ROOT, ".env.local");
  if (!existsSync(envPath)) {
    console.error(`FATAL: .env.local not found`);
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
export function extractProjectRef(urlStr) {
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

// ── Validate Supabase URL contains sandbox ref ────────────────────────────────
export function validateSupabaseUrl(urlStr, label) {
  if (!urlStr) {
    console.error(`FATAL: ${label} missing`);
    process.exit(2);
  }
  if (urlStr.includes(PRODUCTION_REF)) {
    console.error(`FATAL: ${label} contains production ref — refusing`);
    process.exit(3);
  }
  if (!urlStr.includes(CANONICAL_PROJECT_REF)) {
    console.error(`FATAL: ${label} does not reference sandbox ${CANONICAL_PROJECT_REF}`);
    process.exit(3);
  }
}

// ── Build anon supabase client (read env, validate, return client) ────────────
// Never prints the anon key.
export function buildAnonClient() {
  const url = readEnv("NEXT_PUBLIC_NEX_SUPABASE_URL");
  validateSupabaseUrl(url, "NEXT_PUBLIC_NEX_SUPABASE_URL");
  const key = readEnv("NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY");
  if (!key) {
    console.error("FATAL: NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY missing");
    process.exit(2);
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

// ── Sign in a captured identity from 99_identity_capture.json.OUTPUT ─────────
// Returns a signed-in supabase client whose session is in memory only.
// If the identity capture file is missing, exits with BLOCKED.
// Passwords are not stored; sign-in is NOT possible from the capture file.
// The sign-in password must be passed by the caller from an in-memory source.
// In practice: the signup script keeps passwords in memory and passes them
// via a shared in-process store. For serialized child-process runs, sign-in
// is re-performed per-script. Each script calls buildAnonClient() + signIn.
export function readIdentityCapture() {
  if (!existsSync(IDENTITY_CAPTURE_FILE)) {
    console.error(`BLOCKED: ${IDENTITY_CAPTURE_FILE} not found — run 20_signup_disposable_identities.mjs first`);
    process.exit(2);
  }
  return JSON.parse(readFileSync(IDENTITY_CAPTURE_FILE, "utf8"));
}

// ── Re-sign-in an identity using the capture file + env-stored test password ──
// The test password is stored ONLY in the env var GATE_A_TEST_PASSWORD_{A,B,C,...}
// set by the signup script's OUTPUT to process.env (or a temp file that the
// runner can read). Since we cannot persist passwords in the capture JSON
// (by design), subsequent scripts must re-read the password from the env
// or from a separate (in-memory, temp) password store.
//
// Design note: in a fully serialized run from _runner.mjs (single process),
// the signup script can export the passwords into a module-level store that
// subsequent child processes inherit via GATE_A_TEST_PASSWORD_A etc. env vars.
// _runner.mjs does NOT set these; it is the signup script's responsibility to
// emit them to stdout in a machine-readable format that the runner can parse
// and pass as env vars. The runner captures stdout and can re-inject as env.
// This design keeps passwords OUT of disk files while allowing multi-script runs.
//
// If the env var is missing, the script marks BLOCKED and exits 0.
export async function signInCapturedIdentity(label) {
  const capture = readIdentityCapture();
  const identity = capture[label];
  if (!identity) {
    console.error(`BLOCKED: identity '${label}' not found in capture file`);
    process.exit(2);
  }
  const pwKey = `GATE_A_TEST_PASSWORD_${label}`;
  const password = process.env[pwKey];
  if (!password) {
    console.error(
      `BLOCKED: env var ${pwKey} not set. ` +
      `The signup script must export passwords via GATE_A_TEST_PASSWORD_{label} env vars. ` +
      `Mark this scenario BLOCKED.`
    );
    process.exit(2);
  }
  const client = buildAnonClient();
  const { data, error } = await client.auth.signInWithPassword({
    email: identity.email,
    password,
  });
  if (error) {
    console.error(`BLOCKED: signInWithPassword for ${label} failed: ${error.message}`);
    process.exit(2);
  }
  if (!data.session) {
    console.error(`BLOCKED: signInWithPassword for ${label} returned no session`);
    process.exit(2);
  }
  // Return both the client (with session) and the nex_account_id
  return { client, nex_account_id: identity.nex_account_id, email: identity.email, supabase_user_id: identity.supabase_user_id };
}

// ── Structured result emitter ─────────────────────────────────────────────────
// Scripts emit one JSON line to stdout that the runner parses.
export function emitResult(verdict, detail, retainedRows = {}, extra = {}) {
  const r = {
    verdict,
    detail,
    retained_rows: retainedRows,
    ...extra,
  };
  console.log(JSON.stringify(r));
  return r;
}

// ── Append to results file (optional, scripts may use this for per-row detail) ─
export function appendToResults(data) {
  let existing = { entries: [] };
  if (existsSync(RESULTS_FILE)) {
    try { existing = JSON.parse(readFileSync(RESULTS_FILE, "utf8")); } catch { /* ignore */ }
  }
  existing.entries = existing.entries || [];
  existing.entries.push({ ...data, appended_at: new Date().toISOString() });
  writeFileSync(RESULTS_FILE, JSON.stringify(existing, null, 2), "utf8");
}

// ── Classify Supabase/PG error ────────────────────────────────────────────────
export function classifyError(error) {
  if (!error) return null;
  const msg = error.message ?? "";
  const code = error.code ?? "";
  return { code, msg };
}

// ── UUID shape validator ──────────────────────────────────────────────────────
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(v) { return typeof v === "string" && UUID_RE.test(v); }

// ── Dummy valid UUID for attachment_url placeholder ──────────────────────────
export const DUMMY_SESSION_UUID = "00000000-0000-4000-8000-000000000001";
export function buildAttachmentUrl(sessionId) {
  return `/nex-native/call/preview?session=${sessionId}&accept=1`;
}
