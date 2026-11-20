#!/usr/bin/env node
// scripts/gate-a-connected-matrix/91_db_cred_probe.mjs
//
// §16.48.20 · stand-alone operator probe · NOT part of _runner.mjs dispatch manifest
//
// Gate A Connected Matrix — DB credential probe for gate G-DB-CRED.
// Authored by Agent B · 2026-11-20 · OFFLINE SPEC MODE in CI (spec drives
// behaviour with a pg stub); operator-run against sandbox is a separate
// owner-gated step and is not performed by this task.
//
// HARD INVARIANTS
// ───────────────
// · Resolves SANDBOX_DATABASE_URL from env ONLY (never from .env.local here).
//   This probe is a stand-alone operator invocation; _runner.mjs reads the
//   file, this script receives the URL explicitly via env.
// · CANONICAL_PROJECT_REF pinned to sandbox kdstoyyeygcopkogqsyv.
// · PRODUCTION_REF ijvqdvsvwtwxzcqmoqit is a hard-refuse (WRONG_TARGET_REF).
// · Pooler username must match /^postgres\.kdstoyyeygcopkogqsyv$/ or
//   direct-host form must be (db.)?kdstoyyeygcopkogqsyv.supabase.co — this
//   mirrors _runner.mjs's extractProjectRef exactly.
// · Never prints the URL, password, user, or project ref on refusal paths.
//   Errors redact user:pass as [REDACTED] before echoing.
// · Flag file is ONLY written after BOTH queries succeed. Flag content
//   is a short JSON with timestamp + probe version + current_database()
//   value. NO URL, NO password, NO user.
// · Env grammar for stub flag mirrors 90_cleanup.mjs fail-closed pattern
//   (unset/"" → false; "1" → true; else exit 2 WITHOUT echoing the value).
// · Exit codes:
//     0 = pass (flag written)
//     2 = refusal with MISSING_SANDBOX_DATABASE_URL or env-grammar violation
//     3 = refusal with WRONG_TARGET_REF
//     1 = connect/query failure (no flag written)
// · Final stdout line is always a JSON summary {verdict, refusalCode?} so
//   a parent harness can grep it.

import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, URL as NodeURL } from "node:url";
import pg from "pg";

const PROBE_VERSION = "§16.48.20";
const CANONICAL_PROJECT_REF = "kdstoyyeygcopkogqsyv";
const PRODUCTION_REF = "ijvqdvsvwtwxzcqmoqit";
const POOLER_USERNAME_RE = /^postgres\.kdstoyyeygcopkogqsyv$/;

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dir, "../..");
const DEFAULT_FLAG_PATH = resolve(REPO_ROOT, "evidence", "attestations", "db-cred-verified.flag");

// Mirror _runner.mjs extractProjectRef() exactly. Returns the canonical
// project ref string, or null if the URL cannot be unambiguously classified.
function extractProjectRef(parsedUrl) {
  if (parsedUrl.hostname.endsWith(".pooler.supabase.com")) {
    const m = parsedUrl.username.match(/^postgres\.([a-z0-9]+)$/);
    return m ? m[1] : null;
  }
  if (parsedUrl.hostname.endsWith(".supabase.co")) {
    const m = parsedUrl.hostname.match(/^(?:db\.)?([a-z0-9]+)\.supabase\.co$/);
    return m ? m[1] : null;
  }
  return null;
}

// Redact credentials from any string before echoing. The URL embeds
// user:pass@host; we blank the userinfo so the password never leaks.
function redactUrlLike(s) {
  if (typeof s !== "string") return String(s);
  // Replace "scheme://user:pass@" with "scheme://[REDACTED]@"
  return s.replace(/(\w+:\/\/)[^@\s/]+@/g, "$1[REDACTED]@");
}

function emitVerdict(verdict, refusalCode) {
  const payload = { verdict };
  if (refusalCode) payload.refusalCode = refusalCode;
  process.stdout.write(JSON.stringify(payload) + "\n");
}

function refuse(code, exitCode, humanMessage) {
  // Never print the raw URL / host / password. humanMessage is caller-owned
  // and must not contain unvetted values — callers pre-redact.
  if (humanMessage) process.stderr.write(`REFUSAL: ${code} — ${humanMessage}\n`);
  else process.stderr.write(`REFUSAL: ${code}\n`);
  emitVerdict("DB_CRED_PROBE_FAIL", code);
  process.exit(exitCode);
}

function fail(humanMessage) {
  if (humanMessage) process.stderr.write(`FAIL: ${humanMessage}\n`);
  emitVerdict("DB_CRED_PROBE_FAIL");
  process.exit(1);
}

async function main() {
  // ── Env grammar for the pg stub flag (fail-closed) ─────────────────────
  const RAW_PG_STUB = process.env.GATE_A_DB_CRED_PROBE_PG_STUB;
  let PG_STUB;
  if (RAW_PG_STUB === undefined || RAW_PG_STUB === "") {
    PG_STUB = false;
  } else if (RAW_PG_STUB === "1") {
    PG_STUB = true;
  } else {
    process.stderr.write(
      "FATAL: GATE_A_DB_CRED_PROBE_PG_STUB has an unrecognised value — " +
        "expected unset, empty, or '1'\n"
    );
    emitVerdict("DB_CRED_PROBE_FAIL", "BAD_ENV_GRAMMAR");
    process.exit(2);
  }

  // ── Env grammar for the stub mode (only read when stub is on) ──────────
  // happy | connect_error | query_error (default "happy" when stub on)
  const RAW_STUB_MODE = process.env.GATE_A_DB_CRED_PROBE_STUB_MODE;
  let STUB_MODE = "happy";
  if (PG_STUB) {
    if (RAW_STUB_MODE === undefined || RAW_STUB_MODE === "" || RAW_STUB_MODE === "happy") {
      STUB_MODE = "happy";
    } else if (RAW_STUB_MODE === "connect_error" || RAW_STUB_MODE === "query_error") {
      STUB_MODE = RAW_STUB_MODE;
    } else {
      process.stderr.write(
        "FATAL: GATE_A_DB_CRED_PROBE_STUB_MODE has an unrecognised value — " +
          "expected unset, empty, 'happy', 'connect_error', or 'query_error'\n"
      );
      emitVerdict("DB_CRED_PROBE_FAIL", "BAD_ENV_GRAMMAR");
      process.exit(2);
    }
  }

  // ── Resolve SANDBOX_DATABASE_URL ───────────────────────────────────────
  const sandboxDbUrl = process.env.SANDBOX_DATABASE_URL;
  if (!sandboxDbUrl || sandboxDbUrl === "") {
    refuse(
      "MISSING_SANDBOX_DATABASE_URL",
      2,
      "SANDBOX_DATABASE_URL is unset or empty"
    );
    return;
  }

  // ── Parse URL ──────────────────────────────────────────────────────────
  let parsed;
  try {
    parsed = new NodeURL(sandboxDbUrl);
  } catch {
    // Do NOT print the URL. Generic shape error.
    refuse("WRONG_TARGET_REF", 3, "SANDBOX_DATABASE_URL is not a parseable URL");
    return;
  }

  // ── Extract + verify project ref ───────────────────────────────────────
  // Defence in depth: refuse production ref string match even if parse
  // somehow returns something weird. Check substring first.
  if (sandboxDbUrl.includes(PRODUCTION_REF)) {
    refuse(
      "WRONG_TARGET_REF",
      3,
      "URL references the sealed production project — refusing"
    );
    return;
  }

  const ref = extractProjectRef(parsed);
  if (!ref) {
    refuse(
      "WRONG_TARGET_REF",
      3,
      "URL did not resolve to a Supabase pooler or direct host pattern"
    );
    return;
  }
  if (ref === PRODUCTION_REF) {
    refuse(
      "WRONG_TARGET_REF",
      3,
      "URL resolves to the sealed production project — refusing"
    );
    return;
  }
  if (ref !== CANONICAL_PROJECT_REF) {
    // Do NOT echo the observed ref; log only a static reason.
    refuse(
      "WRONG_TARGET_REF",
      3,
      "URL project ref does not match the canonical sandbox"
    );
    return;
  }
  // If pooler, also enforce the username pattern (mirrors _runner.mjs)
  if (
    parsed.hostname.endsWith(".pooler.supabase.com") &&
    !POOLER_USERNAME_RE.test(parsed.username)
  ) {
    refuse(
      "WRONG_TARGET_REF",
      3,
      "Pooler username does not match required pattern"
    );
    return;
  }

  // ── Build client (real or stub) ────────────────────────────────────────
  let client;
  if (PG_STUB) {
    const stubLogPath = process.env.GATE_A_DB_CRED_PROBE_STUB_LOG_OVERRIDE;
    const calls = [];
    const writeLog = () => {
      if (!stubLogPath) return;
      try {
        writeFileSync(stubLogPath, JSON.stringify(calls, null, 2), "utf8");
      } catch { /* best-effort */ }
    };
    client = {
      async connect() {
        calls.push({ op: "connect" });
        if (STUB_MODE === "connect_error") {
          writeLog();
          throw new Error("stub connect_error");
        }
      },
      async query(sql) {
        calls.push({ op: "query", sql });
        if (STUB_MODE === "query_error") {
          writeLog();
          throw new Error("stub query_error");
        }
        if (/current_database\(\)/i.test(sql)) {
          return { rows: [{ db: "postgres" }] };
        }
        if (/SELECT\s+1/i.test(sql)) {
          return { rows: [{ ping: 1 }] };
        }
        return { rows: [] };
      },
      async end() {
        calls.push({ op: "end" });
        writeLog();
      },
    };
  } else {
    client = new pg.Client({ connectionString: sandboxDbUrl });
  }

  // ── Connect ────────────────────────────────────────────────────────────
  try {
    await client.connect();
  } catch (e) {
    // Redact and report; do not write the flag.
    const msg = redactUrlLike(e && e.message ? e.message : "connect failed");
    try { await client.end(); } catch { /* ignore */ }
    fail(`connect: ${msg}`);
    return;
  }

  // ── Run the two probe queries ──────────────────────────────────────────
  let dbName = null;
  try {
    const ping = await client.query("SELECT 1 AS ping");
    if (!ping || !Array.isArray(ping.rows) || ping.rows.length === 0) {
      try { await client.end(); } catch { /* ignore */ }
      fail("ping query returned no rows");
      return;
    }
    const dbRes = await client.query("SELECT current_database() AS db");
    if (!dbRes || !Array.isArray(dbRes.rows) || dbRes.rows.length === 0) {
      try { await client.end(); } catch { /* ignore */ }
      fail("current_database() returned no rows");
      return;
    }
    dbName = dbRes.rows[0].db;
  } catch (e) {
    const msg = redactUrlLike(e && e.message ? e.message : "query failed");
    try { await client.end(); } catch { /* ignore */ }
    fail(`query: ${msg}`);
    return;
  }

  try { await client.end(); } catch { /* ignore */ }

  // ── Write flag — ONLY on query success ─────────────────────────────────
  const flagPathOverride = process.env.GATE_A_DB_CRED_PROBE_FLAG_OVERRIDE;
  const flagPath = flagPathOverride && flagPathOverride !== ""
    ? resolve(flagPathOverride)
    : DEFAULT_FLAG_PATH;

  const flagBody = {
    verdict: "DB_CRED_PROBE_PASS",
    probe_version: PROBE_VERSION,
    checked_at: new Date().toISOString(),
    current_database: typeof dbName === "string" ? dbName : null,
  };
  try {
    mkdirSync(dirname(flagPath), { recursive: true });
    writeFileSync(flagPath, JSON.stringify(flagBody, null, 2), "utf8");
  } catch (e) {
    // Even if we cannot write the flag, do not leak paths/creds. Report FAIL.
    const msg = redactUrlLike(e && e.message ? e.message : "flag write failed");
    fail(`flag write: ${msg}`);
    return;
  }

  process.stdout.write(`PASS: DB credential probe succeeded; flag written\n`);
  emitVerdict("DB_CRED_PROBE_PASS");
  process.exit(0);
}

// Only execute as a script, never on import.
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
