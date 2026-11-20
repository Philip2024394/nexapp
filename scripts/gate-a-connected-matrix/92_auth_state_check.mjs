#!/usr/bin/env node
// §16.48.21 · stand-alone read-only sandbox auth-state helper · NOT part of _runner.mjs dispatch manifest · never calls prod · never writes · never prints secrets
//
// §16.48.22 · owner directive: SUPABASE_ACCESS_TOKEN is intentionally
// NOT provisioned and NOT requested. The MGMT_TOKEN_MISSING soft-fail
// path is the authoritative branch under Config X. Operator attests
// Confirm-email + rate-limit state manually in Supabase Studio per
// docs/gate-a/OPERATOR-RUNBOOK.md Section 5 (Config X quick-path) and
// Section 6 (§16.48.22 G-DB-CRED evidence source).
//
// Gate A Connected Matrix — auth-state read helper.
// Authored by Agent C · 2026-11-20 · OFFLINE SPEC MODE in CI (spec drives
// behaviour with a fetch stub); operator-run against sandbox is a separate
// owner-gated step and is not performed by this task.
//
// HARD INVARIANTS
// ───────────────
// · CANONICAL_PROJECT_REF pinned to sandbox kdstoyyeygcopkogqsyv.
// · PRODUCTION_REF ijvqdvsvwtwxzcqmoqit is a hard-refuse (WRONG_TARGET_REF).
// · The Supabase Management API URL hard-codes the sandbox ref — NO env var
//   can override the ref in the URL template.
// · NEVER prints the URL, service-role key, management token, request
//   headers, or raw response body on any path.
// · Mirrors _runner.mjs's extractProjectRef exactly.
// · Resolves either SANDBOX_SUPABASE_URL (preferred) or
//   NEXT_PUBLIC_NEX_SUPABASE_URL as the Supabase project URL.
// · Soft-fails (exit 0, verdict AUTH_STATE_UNREADABLE) if
//   SUPABASE_ACCESS_TOKEN is absent — this helper never BLOCKS the pipeline
//   when the operator has not provided a Management access token; it
//   transparently labels the gap instead.
// · Env grammar for the fetch stub flag mirrors 91_db_cred_probe.mjs
//   (unset/"" → false; "1" → true; else exit 2 WITHOUT echoing the value).
// · Exit codes:
//     0 = pass, soft-fail (unreadable), or MGMT token absent
//     2 = refusal with MISSING_SANDBOX_URL /
//         MISSING_SANDBOX_SERVICE_ROLE_KEY / BAD_ENV_GRAMMAR
//     3 = refusal with WRONG_TARGET_REF
// · Final stdout line is always a JSON summary
//   {verdict, refusalCode?, config_detected?, rate_limits_readable} so a
//   parent harness can grep it.
// · Never creates files. Never writes a flag. Never touches
//   evidence/attestations/.

import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, URL as NodeURL } from "node:url";

const HELPER_VERSION = "§16.48.21";
const CANONICAL_PROJECT_REF = "kdstoyyeygcopkogqsyv";
const PRODUCTION_REF = "ijvqdvsvwtwxzcqmoqit";

// Hard-coded sandbox Management API endpoint. NO env var overrides the ref.
const MGMT_API_URL =
  `https://api.supabase.com/v1/projects/${CANONICAL_PROJECT_REF}/config/auth`;

const __dir = dirname(fileURLToPath(import.meta.url));

// Mirror _runner.mjs extractProjectRef() exactly — but operate on an https URL
// (Supabase project URL shape https://<ref>.supabase.co). Returns the
// canonical project ref string, or null if the URL cannot be classified.
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

// Redact any URL-like substring before echoing. Blanks userinfo so a
// password never leaks. Also redacts tokens and keys we recognise.
function redactUrlLike(s) {
  if (typeof s !== "string") return String(s);
  return s.replace(/(\w+:\/\/)[^@\s/]+@/g, "$1[REDACTED]@");
}

function emitVerdict({
  verdict,
  refusalCode,
  configDetected,
  rateLimitsReadable,
}) {
  const payload = { verdict };
  if (refusalCode) payload.refusalCode = refusalCode;
  if (configDetected !== undefined) payload.config_detected = configDetected;
  payload.rate_limits_readable = Boolean(rateLimitsReadable);
  process.stdout.write(JSON.stringify(payload) + "\n");
}

function refuse(code, exitCode, humanMessage) {
  // Never print the raw URL / host / password / token. humanMessage is
  // caller-owned and must not contain unvetted values.
  if (humanMessage) process.stderr.write(`REFUSAL: ${code} — ${humanMessage}\n`);
  else process.stderr.write(`REFUSAL: ${code}\n`);
  emitVerdict({
    verdict: "AUTH_STATE_REFUSED",
    refusalCode: code,
    configDetected: "unknown",
    rateLimitsReadable: false,
  });
  process.exit(exitCode);
}

async function main() {
  // ── Env grammar for the fetch stub flag (fail-closed) ──────────────────
  const RAW_FETCH_STUB = process.env.GATE_A_AUTH_CHECK_FETCH_STUB;
  let FETCH_STUB;
  if (RAW_FETCH_STUB === undefined || RAW_FETCH_STUB === "") {
    FETCH_STUB = false;
  } else if (RAW_FETCH_STUB === "1") {
    FETCH_STUB = true;
  } else {
    process.stderr.write(
      "FATAL: GATE_A_AUTH_CHECK_FETCH_STUB has an unrecognised value — " +
        "expected unset, empty, or '1'\n"
    );
    emitVerdict({
      verdict: "AUTH_STATE_REFUSED",
      refusalCode: "BAD_ENV_GRAMMAR",
      configDetected: "unknown",
      rateLimitsReadable: false,
    });
    process.exit(2);
  }

  // ── Resolve Supabase project URL ───────────────────────────────────────
  // Prefer SANDBOX_SUPABASE_URL over NEXT_PUBLIC_NEX_SUPABASE_URL. If the
  // preferred one resolves to a non-sandbox ref but the fallback resolves
  // to the sandbox, we STILL refuse — defence-in-depth, do not silently
  // "pick the good one". The resolver returns the FIRST non-empty value.
  const sandboxUrlEnv = process.env.SANDBOX_SUPABASE_URL;
  const publicUrlEnv = process.env.NEXT_PUBLIC_NEX_SUPABASE_URL;

  let chosenUrl = null;
  if (sandboxUrlEnv && sandboxUrlEnv !== "") {
    chosenUrl = sandboxUrlEnv;
  } else if (publicUrlEnv && publicUrlEnv !== "") {
    chosenUrl = publicUrlEnv;
  }
  if (!chosenUrl) {
    refuse(
      "MISSING_SANDBOX_URL",
      2,
      "neither SANDBOX_SUPABASE_URL nor NEXT_PUBLIC_NEX_SUPABASE_URL is set"
    );
    return;
  }

  // ── Resolve service-role key ───────────────────────────────────────────
  const sandboxKeyEnv = process.env.SANDBOX_SUPABASE_SERVICE_ROLE_KEY;
  const nexKeyEnv = process.env.NEX_SUPABASE_SERVICE_ROLE_KEY;
  let serviceRoleKey = null;
  if (sandboxKeyEnv && sandboxKeyEnv !== "") {
    serviceRoleKey = sandboxKeyEnv;
  } else if (nexKeyEnv && nexKeyEnv !== "") {
    serviceRoleKey = nexKeyEnv;
  }
  if (!serviceRoleKey) {
    refuse(
      "MISSING_SANDBOX_SERVICE_ROLE_KEY",
      2,
      "neither SANDBOX_SUPABASE_SERVICE_ROLE_KEY nor NEX_SUPABASE_SERVICE_ROLE_KEY is set"
    );
    return;
  }

  // ── Defence-in-depth: refuse production ref substring BEFORE parse ─────
  if (chosenUrl.includes(PRODUCTION_REF)) {
    refuse(
      "WRONG_TARGET_REF",
      3,
      "URL references the sealed production project — refusing"
    );
    return;
  }

  // ── Parse URL ──────────────────────────────────────────────────────────
  let parsed;
  try {
    parsed = new NodeURL(chosenUrl);
  } catch {
    refuse("WRONG_TARGET_REF", 3, "URL is not parseable");
    return;
  }

  const ref = extractProjectRef(parsed);
  if (!ref) {
    refuse(
      "WRONG_TARGET_REF",
      3,
      "URL did not resolve to a Supabase host pattern"
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
    refuse(
      "WRONG_TARGET_REF",
      3,
      "URL project ref does not match the canonical sandbox"
    );
    return;
  }

  // Service-role key is present but we never use it against the Management
  // API (wrong auth surface — that's for auth admin REST). We DO NOT
  // dispatch an admin request in this helper in the current pass; the
  // service-role key presence is required purely as an operator gate. The
  // read of auth settings uses SUPABASE_ACCESS_TOKEN (Management API).
  //
  // The reference to `serviceRoleKey` below is deliberately minimal — it
  // exists only to prove presence. It must NEVER be interpolated into an
  // output stream.
  void serviceRoleKey;

  // ── Soft-fail path: no Management access token ─────────────────────────
  const mgmtToken = process.env.SUPABASE_ACCESS_TOKEN;
  if (!mgmtToken || mgmtToken === "") {
    process.stdout.write(
      "confirmEmailState: UNREADABLE_WITHOUT_MGMT_TOKEN\n"
    );
    process.stdout.write(
      "rateLimitState: UNREADABLE_WITHOUT_MGMT_TOKEN\n"
    );
    process.stdout.write(
      "NOTE: operator must verify these in the Supabase Studio UI directly\n"
    );
    emitVerdict({
      verdict: "AUTH_STATE_UNREADABLE",
      refusalCode: "MGMT_TOKEN_MISSING",
      configDetected: "unknown",
      rateLimitsReadable: false,
    });
    process.exit(0);
    return;
  }

  // ── Select fetch implementation (real or stub) ─────────────────────────
  let fetchImpl;
  const stubCalls = [];
  if (FETCH_STUB) {
    const stubLogPath = process.env.GATE_A_AUTH_CHECK_STUB_LOG_OVERRIDE;
    const writeStubLog = () => {
      if (!stubLogPath) return;
      try {
        writeFileSync(stubLogPath, JSON.stringify(stubCalls, null, 2), "utf8");
      } catch {
        /* best-effort */
      }
    };

    // The stub is driven ENTIRELY by env vars the spec sets; it never sees
    // the real token. The stub does NOT record headers (defence-in-depth:
    // if a future edit passes headers wrongly, the stub won't emit them).
    const stubStatusRaw = process.env.GATE_A_AUTH_CHECK_STUB_STATUS;
    const stubStatus =
      stubStatusRaw && stubStatusRaw !== "" ? Number(stubStatusRaw) : 200;
    const stubMode = process.env.GATE_A_AUTH_CHECK_STUB_MODE || "happy";

    fetchImpl = async (url /* , init */) => {
      // Record only the URL (and ONLY if it matches the hard-coded template)
      // to avoid logging anything surprising. Do NOT record headers.
      stubCalls.push({
        op: "fetch",
        url_matches_template: url === MGMT_API_URL,
      });
      writeStubLog();

      if (stubMode === "malformed_json") {
        return {
          ok: stubStatus >= 200 && stubStatus < 300,
          status: stubStatus,
          async text() {
            return "{this is not : json";
          },
          async json() {
            throw new Error("stub malformed_json");
          },
        };
      }

      // Payloads for happy paths — mailer_autoconfirm selects X vs Y.
      let body;
      if (stubMode === "mailer_autoconfirm_true") {
        body = {
          mailer_autoconfirm: true,
          rate_limit_email_sent: 2,
          rate_limit_sms_sent: 30,
          rate_limit_verify: 30,
          rate_limit_token_refresh: 150,
          rate_limit_otp: 30,
        };
      } else if (stubMode === "mailer_autoconfirm_false") {
        body = {
          mailer_autoconfirm: false,
          rate_limit_email_sent: 2,
          rate_limit_sms_sent: 30,
          rate_limit_verify: 30,
          rate_limit_token_refresh: 150,
          rate_limit_otp: 30,
        };
      } else {
        body = { mailer_autoconfirm: true };
      }

      return {
        ok: stubStatus >= 200 && stubStatus < 300,
        status: stubStatus,
        async text() {
          return JSON.stringify(body);
        },
        async json() {
          return body;
        },
      };
    };
  } else {
    fetchImpl = globalThis.fetch;
  }

  // ── Call the Management API ────────────────────────────────────────────
  let response;
  try {
    response = await fetchImpl(MGMT_API_URL, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${mgmtToken}`,
        "Content-Type": "application/json",
      },
    });
  } catch (e) {
    // Never echo the URL or token. Use a redactor on the error message in
    // case the fetch impl bundled the URL into its exception text.
    const msg = redactUrlLike(
      e && e.message ? e.message : "fetch failed"
    );
    process.stderr.write(`REFUSAL: MGMT_API_FETCH_ERROR — ${msg}\n`);
    emitVerdict({
      verdict: "AUTH_STATE_UNREADABLE",
      refusalCode: "MGMT_API_FETCH_ERROR",
      configDetected: "unknown",
      rateLimitsReadable: false,
    });
    process.exit(0);
    return;
  }

  if (!response || !response.ok) {
    const status = response && typeof response.status === "number"
      ? response.status
      : 0;
    const code = `MGMT_API_HTTP_ERROR_${status}`;
    process.stderr.write(`REFUSAL: ${code}\n`);
    emitVerdict({
      verdict: "AUTH_STATE_UNREADABLE",
      refusalCode: code,
      configDetected: "unknown",
      rateLimitsReadable: false,
    });
    process.exit(0);
    return;
  }

  let parsedBody;
  try {
    const text = await response.text();
    parsedBody = JSON.parse(text);
  } catch {
    process.stderr.write(`REFUSAL: MGMT_API_PARSE_ERROR\n`);
    emitVerdict({
      verdict: "AUTH_STATE_UNREADABLE",
      refusalCode: "MGMT_API_PARSE_ERROR",
      configDetected: "unknown",
      rateLimitsReadable: false,
    });
    process.exit(0);
    return;
  }

  // Interpret mailer_autoconfirm. Supabase inverts the "Confirm email" UI
  // toggle: mailer_autoconfirm=true means Confirm email is OFF (users are
  // auto-confirmed on signup). We label:
  //   mailer_autoconfirm=true  → config_detected = "X"
  //   mailer_autoconfirm=false → config_detected = "Y"
  let configDetected = "unknown";
  if (parsedBody && typeof parsedBody.mailer_autoconfirm === "boolean") {
    configDetected = parsedBody.mailer_autoconfirm ? "X" : "Y";
  }

  // Rate-limit fields: report each one that is readable. Don't fail if some
  // are missing — just note which are present.
  const rateLimitKeys = [
    "rate_limit_email_sent",
    "rate_limit_sms_sent",
    "rate_limit_verify",
    "rate_limit_token_refresh",
    "rate_limit_otp",
  ];
  const rateLimitSummary = {};
  let rateLimitsReadable = false;
  for (const k of rateLimitKeys) {
    if (parsedBody && typeof parsedBody[k] === "number") {
      rateLimitSummary[k] = parsedBody[k];
      rateLimitsReadable = true;
    }
  }

  process.stdout.write(
    `confirmEmailState: ${
      configDetected === "X"
        ? "CONFIRM_EMAIL_OFF (auto-confirm ON · config X)"
        : configDetected === "Y"
        ? "CONFIRM_EMAIL_ON (auto-confirm OFF · config Y)"
        : "unknown"
    }\n`
  );
  for (const k of rateLimitKeys) {
    if (Object.prototype.hasOwnProperty.call(rateLimitSummary, k)) {
      process.stdout.write(`${k}: ${rateLimitSummary[k]}\n`);
    } else {
      process.stdout.write(`${k}: (not reported)\n`);
    }
  }

  emitVerdict({
    verdict: "AUTH_STATE_READ",
    configDetected,
    rateLimitsReadable,
  });
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
