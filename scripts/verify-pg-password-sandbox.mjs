#!/usr/bin/env node
// scripts/verify-pg-password-sandbox.mjs
//
// One-shot, sandbox-only Postgres credential-authentication check.
// Proves the current .env.local DATABASE_URL + NEX_POSTGRES_URL both
// target sandbox ref `kdstoyyeygcopkogqsyv` and that the rotated
// password successfully opens exactly one connection and executes
// `SELECT 1`. Nothing else.
//
// Authorised by operator prompt-7 round 7 (2026-11-19) as the
// smallest credential-authentication check referenced in ledger
// §16.25.9. Lifts the DB pause ONLY for the sandbox sign-in /
// session lanes authorised in the same prompt — does NOT authorise
// production work.
//
// Hard rules (sealed by the authorising prompt):
//   · NO printing of connection values, passwords, env values,
//     tokens, encrypted env blobs, raw driver errors containing the
//     DSN, or full connection URLs. ONLY the public project ref
//     (kdstoyyeygcopkogqsyv) is allowed to surface; it is already a
//     non-secret URL-visible identifier.
//   · Fail-closed on any target ambiguity. If either active
//     password-bearing env var does not target sandbox, abort BEFORE
//     attempting a connection.
//   · Bounded timeout on connect + statement.
//   · Sanitised error categories only (no `err.message` passthrough).
//   · Exactly one Postgres connection. Exactly one statement:
//     `SELECT 1 AS ok`. No schema inspection, no `auth.users` read,
//     no migration-list query, no `pg_catalog` beyond the SELECT 1,
//     no `current_database()` / `current_user` reads either.
//   · Exit non-zero on any failure or refusal.
//
// Scope OUTSIDE this script: app-route probes, Playwright, migrations,
// REST / Supabase SDK calls, commits, pushes, deploys, server
// restarts, credential rotations, config changes.

import pg from "pg";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = resolve(__dirname, "..", ".env.local");
const SANDBOX_REF = "kdstoyyeygcopkogqsyv";
const TARGET_VARS = ["DATABASE_URL", "NEX_POSTGRES_URL"];
const CONNECT_TIMEOUT_MS = 10_000;
const STATEMENT_TIMEOUT_MS = 10_000;

function stderr(msg) {
  process.stderr.write(`[verify-pg] ${msg}\n`);
}
function fail(exitCode, payload) {
  // Final JSON payload on fail; no raw values.
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  process.exit(exitCode);
}

function loadEnvFile(p) {
  // Same pattern as existing scripts (probe-disposable-auth-sandbox.mjs).
  // Reads only — never echoes values.
  const map = {};
  if (!existsSync(p)) return map;
  const raw = readFileSync(p, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim().replace(/^['"]|['"]$/g, "");
    map[k] = v;
  }
  return map;
}

function classifyTarget(url) {
  // Returns "sandbox" | "production" | "unknown" | "unparseable".
  // Never returns the URL or any part of it beyond the sealed public
  // sandbox ref.
  if (typeof url !== "string" || url.length === 0) return "unparseable";
  if (url.includes(SANDBOX_REF)) return "sandbox";
  // We deliberately do NOT compare against the production ref here;
  // any non-sandbox classification is simply "non-sandbox" and the
  // script refuses. We avoid echoing production refs from this file.
  return "non-sandbox";
}

function categoriseError(err) {
  // Map a pg driver error to a short category so the caller gets a
  // useful signal without us echoing any URL / DSN / password / hint
  // from err.message.
  if (!err || typeof err !== "object") return "unknown";
  const code = typeof err.code === "string" ? err.code : null;
  // Postgres SQLSTATE codes we care about:
  //   28P01 invalid_password
  //   28000 invalid_authorization_specification
  //   3D000 invalid_catalog_name (db does not exist)
  //   08006 connection_failure
  //   08001 sqlclient_unable_to_establish_sqlconnection
  //   53300 too_many_connections
  //   57P03 cannot_connect_now
  if (code === "28P01") return "auth_failed_password";
  if (code === "28000") return "auth_failed_role";
  if (code === "3D000") return "database_missing";
  if (code === "53300") return "too_many_connections";
  if (code === "57P03") return "server_not_ready";
  if (code === "08001" || code === "08006") return "connection_failure";
  // Node/socket errors (no SQLSTATE):
  if (code === "ETIMEDOUT") return "timeout";
  if (code === "ECONNREFUSED") return "connection_refused";
  if (code === "ENOTFOUND") return "dns_lookup_failed";
  if (code === "ECONNRESET") return "connection_reset";
  if (code === "EAI_AGAIN") return "dns_temporary_failure";
  if (code === "CERT_HAS_EXPIRED" || code === "DEPTH_ZERO_SELF_SIGNED_CERT") {
    return "ssl_error";
  }
  // Timeout we installed via setTimeout / AbortController.
  if (err.__localTimeout === true) return "local_timeout";
  // Fallback — do NOT echo err.message.
  return code ? `pg_code_${code}` : "unknown";
}

// --- Phase A · load + classify env, fail closed on ambiguity ------
const env = loadEnvFile(ENV_PATH);

// We need BOTH target vars to agree that we are on sandbox. If either
// is missing OR not sandbox → refuse. This matches the rotation
// script's two-line invariant.
const classifications = {};
let hasAnyMissing = false;
let hasAnyNonSandbox = false;
for (const v of TARGET_VARS) {
  const value = env[v];
  if (!value) {
    classifications[v] = "missing";
    hasAnyMissing = true;
    continue;
  }
  const c = classifyTarget(value);
  classifications[v] = c;
  if (c !== "sandbox") hasAnyNonSandbox = true;
}

if (hasAnyMissing || hasAnyNonSandbox) {
  fail(3, {
    check: "verify-pg-password-sandbox",
    outcome: "refused",
    reason: hasAnyMissing
      ? "env_var_missing"
      : "target_not_sandbox",
    target_classification: classifications,
    sandbox_ref_expected: SANDBOX_REF,
    authenticated: null,
    roundtrip_ms: null,
    error_category: null,
    note:
      "No connection attempted. The authorising prompt requires both " +
      TARGET_VARS.join(" + ") +
      " to target sandbox before the credential-authentication check " +
      "runs. DB pause remains in force.",
  });
}

// --- Phase B · open ONE connection, SELECT 1, close ---------------
// Use DATABASE_URL (the primary pooler target in CLAUDE.md §8).
const connectionString = env.DATABASE_URL;

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
  // pg's own connect-timeout:
  connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
  statement_timeout: STATEMENT_TIMEOUT_MS,
  query_timeout: STATEMENT_TIMEOUT_MS,
});

// Belt-and-braces: a local hard timeout that fires even if pg hangs
// in a non-connect state.
let localTimeoutHit = false;
const localTimer = setTimeout(() => {
  localTimeoutHit = true;
  // Attempt to abort; swallow any error
  client.end().catch(() => {});
}, CONNECT_TIMEOUT_MS + STATEMENT_TIMEOUT_MS + 2_000);

const t0 = process.hrtime.bigint();
let authenticated = false;
let errorCategory = null;
let roundtripMs = null;
let selectOneOk = false;

try {
  await client.connect();
  authenticated = true;
  const res = await client.query("SELECT 1 AS ok");
  selectOneOk =
    Array.isArray(res?.rows) &&
    res.rows.length === 1 &&
    res.rows[0]?.ok === 1;
  const t1 = process.hrtime.bigint();
  roundtripMs = Number((t1 - t0) / 1_000_000n);
} catch (err) {
  if (localTimeoutHit) {
    err.__localTimeout = true;
  }
  errorCategory = categoriseError(err);
  authenticated = false;
} finally {
  clearTimeout(localTimer);
  try {
    await client.end();
  } catch {
    // ignore close errors; don't let them mask the primary signal
  }
}

if (!authenticated) {
  fail(4, {
    check: "verify-pg-password-sandbox",
    outcome: "failed",
    target_classification: classifications,
    sandbox_ref_expected: SANDBOX_REF,
    authenticated: false,
    select_one_ok: false,
    roundtrip_ms: null,
    error_category: errorCategory,
    note:
      "No raw driver message surfaced. error_category is the mapped " +
      "sanitised signal only. DB pause remains in force.",
  });
}

if (!selectOneOk) {
  // Auth succeeded but SELECT 1 shape wrong — treat as failure.
  fail(5, {
    check: "verify-pg-password-sandbox",
    outcome: "select_one_shape_unexpected",
    target_classification: classifications,
    sandbox_ref_expected: SANDBOX_REF,
    authenticated: true,
    select_one_ok: false,
    roundtrip_ms: roundtripMs,
    error_category: null,
    note: "Connection authenticated but SELECT 1 did not return rows=[{ok:1}].",
  });
}

process.stdout.write(
  `${JSON.stringify(
    {
      check: "verify-pg-password-sandbox",
      outcome: "passed",
      target_classification: classifications,
      sandbox_ref_expected: SANDBOX_REF,
      authenticated: true,
      select_one_ok: true,
      roundtrip_ms: roundtripMs,
      error_category: null,
      note:
        "Exactly one connection opened, one SELECT 1 executed, " +
        "connection closed. No schema inspection, no auth.users " +
        "read, no app-route touch.",
    },
    null,
    2,
  )}\n`,
);
process.exit(0);
