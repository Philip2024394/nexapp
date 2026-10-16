// scripts/validate-env.mjs
//
// D10 · nex-env-validator · launch-profile aware environment validation.
//
// Purpose: tell an operator whether their environment matches the
// Phase 1 operator contract defined in D9's `.env.example`, without
// loading any env file, contacting any service, printing any variable
// value, or claiming anything about live-service availability.
//
// Design:
//   · `validateEnvironment({ env, profile, log })` is a pure function.
//     It reads from the injected `env` object (never process.env),
//     emits structured messages via the optional `log` sink, and
//     returns a result containing { ok, profile, missing, invalid,
//     decisions, prohibited, warnings, messages }.
//   · `runValidator({ argv, env, log, exit })` is the CLI wrapper.
//     It parses --profile=<name>, calls validateEnvironment, and
//     maps the result onto a meaningful exit code.
//   · The CLI entry only fires when the script is invoked directly
//     via `node scripts/validate-env.mjs`. Importing from a test
//     file does NOT trigger the CLI side effect.
//
// NEVER-PRINT-VALUES discipline:
//   · No message template includes `${value}`. Every message is built
//     from a variable NAME, a static purpose string, and a static
//     reason string from a format checker.
//   · The format checkers below are pure: they return `{ ok, reason? }`
//     where `reason` is a hand-written static phrase that never
//     substitutes any value content.
//
// What this validator does NOT do:
//   · Does NOT read `.env.local`, `.env`, or any env file.
//   · Does NOT make network, DB, or filesystem calls.
//   · Does NOT prove deployment readiness or live-service availability.
//   · Does NOT invent values for unresolved operator decisions (D1-D6).
//   · Does NOT activate or configure any application feature.
//
// Reference material:
//   · docs/doctrine/nex-env-vars-inventory-2026-10-14.md (B1)
//   · docs/doctrine/nex-env-template-d9-review-2026-10-14.md (D9)
//   · .env.example (template · the operator contract)
//   · nexapp CLAUDE.md §8 (sealed canonical Supabase project rule)

import { pathToFileURL } from "node:url";

// ─── Launch profiles ──────────────────────────────────────────────

export const PROFILE_PRODUCTION_PHASE1 = "production-phase1";
export const AVAILABLE_PROFILES = Object.freeze([
  PROFILE_PRODUCTION_PHASE1,
]);

// ─── Variable classifications · mirror D9 Parts 1-5 ───────────────
//
// Each entry carries only names, purposes (static text), format
// identifiers, and (where applicable) decision identifiers. No real
// values or defaults are stored here · defaults MUST NOT be invented.

/** Phase 1 required · must be PRESENT, NON-EMPTY, FORMAT-VALID. */
export const REQUIRED_PHASE1 = Object.freeze([
  { name: "NEX_SUPABASE_URL",                      format: "https-url-supabase", purpose: "canonical Supabase project URL (server-side admin client)" },
  { name: "NEX_SUPABASE_SERVICE_ROLE_KEY",         format: "jwt",                 purpose: "canonical Supabase service_role key" },
  { name: "NEXT_PUBLIC_NEX_SUPABASE_URL",          format: "https-url-supabase", purpose: "canonical Supabase project URL (public · SSR + realtime)" },
  { name: "NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY",     format: "jwt",                 purpose: "canonical Supabase anon key" },
  { name: "NEX_SESSION_SECRET",                    format: "secret-32",           purpose: "session cookie signing secret" },
  { name: "ENC_KEY",                               format: "secret-32",           purpose: "application-layer symmetric encryption key" },
  { name: "CRON_SECRET",                           format: "secret-32",           purpose: "Vercel cron authentication secret" },
  { name: "NEXT_PUBLIC_XRATED_VAPID_PUBLIC_KEY",   format: "vapid-public",        purpose: "Web Push VAPID public key (client subscription)" },
  { name: "XRATED_VAPID_PRIVATE_KEY",              format: "vapid-private",       purpose: "Web Push VAPID private key (server sender)" },
  { name: "XRATED_VAPID_SUBJECT",                  format: "subject-url",         purpose: "Web Push RFC 8292 subject (mailto: or https://)" },
]);

/** Phase 1 operator-decision-required · if PRESENT must be format-valid.
 *  If ABSENT, reported as a DECISION-PENDING warning (not treated as a
 *  format failure; the operator decision is the resolution path). */
export const DECISION_REQUIRED = Object.freeze([
  { name: "NEX_POSTGRES_URL",         format: "postgres-url-non-local", decision: "D1", purpose: "Postgres destination (not localhost in production)" },
  { name: "NEXT_PUBLIC_APP_BASE_URL", format: "https-url",              decision: "D2", purpose: "canonical public app URL" },
  { name: "NEX_WEBAUTHN_RP_ID",       format: "dns-hostname",           decision: "D3", purpose: "WebAuthn RP ID (DNS hostname matching deployed origin's host)" },
  { name: "NEX_WEBAUTHN_ORIGIN",      format: "https-origin",           decision: "D3", purpose: "WebAuthn origin (full https:// origin matching deployed site)" },
]);

/** Prod-prohibited flag-style · ANY TRUTHY value is prohibited. Empty,
 *  "0", "false", "no", or absent is acceptable. Parse logic mirrors
 *  `src/lib/nex-native/launch-flags.ts:27-35`. */
export const PROD_PROHIBITED_FLAG = Object.freeze([
  { name: "NEX_ALLOW_DEV_ADMIN",               severity: "high",     why: "development admin bypass must not be enabled in production" },
  { name: "NEX_DEV_ROUTES",                    severity: "high",     why: "development-only routes must not be exposed in production" },
  { name: "NEX_AGENT_INTERNET_FORCE_OFFLINE",  severity: "high",     why: "development-only internet shaping flag" },
  { name: "NEX_AGENT_INTERNET_FORCE_ONLINE",   severity: "high",     why: "development-only internet shaping flag" },
  { name: "NEX_LOCAL_ONLY",                    severity: "high",     why: "development-only local-mode flag" },
  { name: "NEX_CROSS_DB_RECONCILER_ENABLED",   severity: "high",     why: "cross-DB reconciler must not run in production unless authorised" },
]);

/** Prod-prohibited presence-style · ANY NON-EMPTY value is prohibited.
 *  Primarily the legacy Supabase variable names that CLAUDE.md §8
 *  flags as pointing at the stale legacy project, plus local-dev
 *  Postgres configuration that must not appear in a serverless prod. */
export const PROD_PROHIBITED_PRESENCE = Object.freeze([
  { name: "SUPABASE_URL",                   severity: "critical", why: "legacy Supabase URL (points at stale legacy project per nexapp CLAUDE.md §8)" },
  { name: "SUPABASE_SERVICE_ROLE_KEY",      severity: "critical", why: "legacy Supabase service-role key" },
  { name: "SUPABASE_SERVICE_KEY",           severity: "critical", why: "legacy Supabase service key" },
  { name: "NEXT_PUBLIC_SUPABASE_URL",       severity: "critical", why: "legacy Supabase public URL (points at stale legacy project)" },
  { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY",  severity: "critical", why: "legacy Supabase anon key" },
  { name: "NEX_LOCALPG_USER",               severity: "high",     why: "local Postgres user in production" },
  { name: "NEX_LOCALPG_PORT",               severity: "high",     why: "local Postgres port in production" },
  { name: "NEX_LOCALPG_PASSWORD",           severity: "high",     why: "local Postgres password in production" },
]);

/** Informational warnings · variables that are set but have no runtime
 *  effect in the current codebase. Setting them does NOT enable the
 *  advertised feature. These are warning-level, not failure-level. */
export const WARN_IF_PRESENT = Object.freeze([
  { name: "STRIPE_SECRET_KEY",       reason: "payment integration is not wired in current codebase · setting this has no effect (see Phase F report §B3)" },
  { name: "STRIPE_PUBLISHABLE_KEY",  reason: "payment integration is not wired in current codebase · setting this has no effect" },
  { name: "STRIPE_WEBHOOK_SECRET",   reason: "no webhook endpoint exists for Stripe · setting this has no effect" },
]);

// ─── Format checkers ──────────────────────────────────────────────
//
// Each checker takes an unvalidated value, returns { ok, reason? }.
// `reason` is a hand-written static phrase · it NEVER substitutes
// any part of the supplied value. If a checker needs to describe
// a length or shape, it uses a hardcoded threshold word, not the
// observed value.

const JWT_SHAPE = /^eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const HTTPS_URL_SHAPE = /^https:\/\/[^\s/]+(\/.*)?$/;
const HTTPS_ORIGIN_SHAPE = /^https:\/\/[^\s/]+$/;
const DNS_HOSTNAME_SHAPE = /^[a-z0-9][a-z0-9.-]*$/i;
const BASE64URL_SHAPE = /^[A-Za-z0-9_-]+$/;
const POSTGRES_URL_SHAPE = /^postgres(ql)?:\/\//i;
const LOCALHOST_IN_URL = /@?(localhost|127\.0\.0\.1|\[::1\])(:\d+)?[/?]/i;

const FORMAT_CHECKERS = Object.freeze({
  "jwt": (v) => {
    if (typeof v !== "string") return { ok: false, reason: "not a string" };
    if (v.length === 0) return { ok: false, reason: "empty value" };
    if (/[\r\n\t\s]/.test(v)) return { ok: false, reason: "contains whitespace or control characters (JWTs do not)" };
    if (!JWT_SHAPE.test(v)) return { ok: false, reason: "not JWT-shaped · expected three dot-separated base64url segments beginning with 'eyJ'" };
    return { ok: true };
  },
  "https-url": (v) => {
    if (typeof v !== "string") return { ok: false, reason: "not a string" };
    if (v.length === 0) return { ok: false, reason: "empty value" };
    if (/[\r\n\t\s]/.test(v)) return { ok: false, reason: "contains whitespace or control characters" };
    if (!HTTPS_URL_SHAPE.test(v)) return { ok: false, reason: "not an https:// URL" };
    return { ok: true };
  },
  "https-url-supabase": (v) => {
    const base = FORMAT_CHECKERS["https-url"](v);
    if (!base.ok) return base;
    // Advisory check · Supabase URLs typically end in `.supabase.co`.
    // Operators with custom Supabase domains still pass; we do not
    // reject on this shape alone. Only warn-level advisory inside the
    // caller · the format check itself returns ok.
    return { ok: true };
  },
  "https-origin": (v) => {
    if (typeof v !== "string") return { ok: false, reason: "not a string" };
    if (v.length === 0) return { ok: false, reason: "empty value" };
    if (/[\r\n\t\s]/.test(v)) return { ok: false, reason: "contains whitespace or control characters" };
    if (!HTTPS_ORIGIN_SHAPE.test(v)) return { ok: false, reason: "not an https:// origin · must have no path and no trailing slash" };
    return { ok: true };
  },
  "dns-hostname": (v) => {
    if (typeof v !== "string") return { ok: false, reason: "not a string" };
    if (v.length === 0) return { ok: false, reason: "empty value" };
    if (/[\r\n\t\s]/.test(v)) return { ok: false, reason: "contains whitespace or control characters" };
    if (/[:/?#@]/.test(v)) return { ok: false, reason: "contains disallowed characters · DNS hostname only (no scheme, port, path, or query)" };
    if (!DNS_HOSTNAME_SHAPE.test(v)) return { ok: false, reason: "not a DNS hostname shape" };
    return { ok: true };
  },
  "secret-32": (v) => {
    if (typeof v !== "string") return { ok: false, reason: "not a string" };
    if (v.length === 0) return { ok: false, reason: "empty value" };
    if (/[\r\n]/.test(v)) return { ok: false, reason: "contains newline characters" };
    if (v.length < 32) return { ok: false, reason: "shorter than 32 characters · generate with `openssl rand -base64 32`" };
    return { ok: true };
  },
  "vapid-public": (v) => {
    if (typeof v !== "string") return { ok: false, reason: "not a string" };
    if (v.length === 0) return { ok: false, reason: "empty value" };
    if (/[\r\n\t\s]/.test(v)) return { ok: false, reason: "contains whitespace or control characters" };
    if (!BASE64URL_SHAPE.test(v)) return { ok: false, reason: "not base64url · generate with `npx web-push generate-vapid-keys`" };
    if (v.length < 80 || v.length > 100) return { ok: false, reason: "unexpected length for VAPID public key · expected ~87 base64url characters" };
    return { ok: true };
  },
  "vapid-private": (v) => {
    if (typeof v !== "string") return { ok: false, reason: "not a string" };
    if (v.length === 0) return { ok: false, reason: "empty value" };
    if (/[\r\n\t\s]/.test(v)) return { ok: false, reason: "contains whitespace or control characters" };
    if (!BASE64URL_SHAPE.test(v)) return { ok: false, reason: "not base64url · generate with `npx web-push generate-vapid-keys`" };
    if (v.length < 40 || v.length > 48) return { ok: false, reason: "unexpected length for VAPID private key · expected ~43 base64url characters" };
    return { ok: true };
  },
  "subject-url": (v) => {
    if (typeof v !== "string") return { ok: false, reason: "not a string" };
    if (v.length === 0) return { ok: false, reason: "empty value" };
    if (/[\r\n\t\s]/.test(v)) return { ok: false, reason: "contains whitespace or control characters" };
    if (!(v.startsWith("mailto:") || v.startsWith("https://"))) {
      return { ok: false, reason: "must be a mailto: URI or an https:// URL (RFC 8292)" };
    }
    if (v.startsWith("mailto:") && !/^mailto:[^@\s]+@[^@\s]+$/.test(v)) {
      return { ok: false, reason: "mailto: must contain an email address" };
    }
    if (v.startsWith("https://") && !HTTPS_URL_SHAPE.test(v)) {
      return { ok: false, reason: "https:// subject is not an https:// URL" };
    }
    return { ok: true };
  },
  "postgres-url-non-local": (v) => {
    if (typeof v !== "string") return { ok: false, reason: "not a string" };
    if (v.length === 0) return { ok: false, reason: "empty value" };
    if (/[\r\n]/.test(v)) return { ok: false, reason: "contains newline characters" };
    if (!POSTGRES_URL_SHAPE.test(v)) return { ok: false, reason: "must start with postgres:// or postgresql://" };
    if (LOCALHOST_IN_URL.test(v)) return { ok: false, reason: "resolves to a local host · not permitted in production (resolve decision D1)" };
    return { ok: true };
  },
});

// ─── Flag parse (mirror launch-flags.ts) ──────────────────────────

/** Returns true for "1" | "true" | "yes" (case-insensitive, trimmed).
 *  Returns false otherwise, including undefined / null / empty. */
export function parseFlag(value) {
  if (value === undefined || value === null) return false;
  const s = String(value).trim().toLowerCase();
  if (s.length === 0) return false;
  return s === "1" || s === "true" || s === "yes";
}

// ─── Pure validator ───────────────────────────────────────────────

/**
 * Validate an env snapshot against a launch profile.
 *
 * Pure of real I/O. Does not read process.env, .env.local, any env
 * file, the filesystem, the network, or any database. Does not
 * include any value from `env` in its outputs · only names, static
 * purposes, and static reasons.
 *
 * @param {object} options
 * @param {Record<string, string|undefined>} options.env Required · env snapshot
 * @param {string} [options.profile] Launch profile · default production-phase1
 * @param {(msg: string) => void} [options.log] Optional sink for streamed messages
 * @returns {{
 *   ok: boolean,
 *   profile: string | null,
 *   missing: Array<{name: string, requirement: string, purpose: string}>,
 *   invalid: Array<{name: string, requirement: string, reason: string}>,
 *   decisions: Array<{name: string, decision: string, remediation: string}>,
 *   prohibited: Array<{name: string, severity: string, remediation: string}>,
 *   warnings: Array<{name: string, reason: string}>,
 *   messages: string[]
 * }}
 */
export function validateEnvironment({ env, profile = PROFILE_PRODUCTION_PHASE1, log } = {}) {
  const messages = [];
  const emit = (msg) => {
    messages.push(msg);
    if (typeof log === "function") log(msg);
  };

  if (env === undefined || env === null || typeof env !== "object") {
    emit("[nex-env-validator] FAIL · env snapshot must be a non-null object");
    return { ok: false, profile: null, missing: [], invalid: [], decisions: [], prohibited: [], warnings: [], messages };
  }
  if (!AVAILABLE_PROFILES.includes(profile)) {
    emit(`[nex-env-validator] FAIL · unknown profile '${profile}' · available: ${AVAILABLE_PROFILES.join(", ")}`);
    return { ok: false, profile, missing: [], invalid: [], decisions: [], prohibited: [], warnings: [], messages };
  }

  emit(`[nex-env-validator] profile=${profile}`);

  const missing = [];
  const invalid = [];
  const decisions = [];
  const prohibited = [];
  const warnings = [];

  // 1 · Required Phase 1 vars.
  for (const entry of REQUIRED_PHASE1) {
    const value = env[entry.name];
    const isAbsentOrEmpty = value === undefined || value === null || (typeof value === "string" && value.length === 0);
    if (isAbsentOrEmpty) {
      missing.push({ name: entry.name, requirement: "required-phase1", purpose: entry.purpose });
      emit(`[nex-env-validator] MISSING · ${entry.name} · required · ${entry.purpose}`);
      continue;
    }
    const checker = FORMAT_CHECKERS[entry.format];
    const check = checker(value);
    if (!check.ok) {
      invalid.push({ name: entry.name, requirement: "required-phase1", reason: check.reason });
      emit(`[nex-env-validator] INVALID · ${entry.name} · ${check.reason}`);
    }
  }

  // 2 · Cross-field: NEX_SUPABASE_URL must equal NEXT_PUBLIC_NEX_SUPABASE_URL
  //    (CLAUDE.md §8 · both must point at the same canonical project).
  //    Only check when both are present; otherwise the per-var checks
  //    above have already flagged the missing one.
  {
    const srv = env.NEX_SUPABASE_URL;
    const pub = env.NEXT_PUBLIC_NEX_SUPABASE_URL;
    if (
      typeof srv === "string" && srv.length > 0 &&
      typeof pub === "string" && pub.length > 0 &&
      srv !== pub
    ) {
      invalid.push({
        name: "NEX_SUPABASE_URL / NEXT_PUBLIC_NEX_SUPABASE_URL",
        requirement: "pair-equality",
        reason: "server-side and public Supabase URL differ · both must point at the same canonical project (CLAUDE.md §8)",
      });
      emit("[nex-env-validator] INVALID · NEX_SUPABASE_URL and NEXT_PUBLIC_NEX_SUPABASE_URL must be identical");
    }
  }

  // 3 · Operator-decision-required vars.
  for (const entry of DECISION_REQUIRED) {
    const value = env[entry.name];
    const isAbsentOrEmpty = value === undefined || value === null || (typeof value === "string" && value.length === 0);
    if (isAbsentOrEmpty) {
      decisions.push({
        name: entry.name,
        decision: entry.decision,
        remediation: `operator must resolve decision ${entry.decision} and set ${entry.name} (${entry.purpose})`,
      });
      emit(`[nex-env-validator] DECISION PENDING · ${entry.name} · ${entry.decision} · ${entry.purpose}`);
      continue;
    }
    const checker = FORMAT_CHECKERS[entry.format];
    const check = checker(value);
    if (!check.ok) {
      invalid.push({ name: entry.name, requirement: "decision-required", reason: check.reason });
      emit(`[nex-env-validator] INVALID · ${entry.name} · ${check.reason}`);
    }
  }

  // 4 · Prod-prohibited flag-style vars (truthy = prohibited).
  for (const entry of PROD_PROHIBITED_FLAG) {
    const value = env[entry.name];
    if (parseFlag(value)) {
      prohibited.push({
        name: entry.name,
        severity: entry.severity,
        remediation: `unset ${entry.name} or set to "0"/"false" in production`,
      });
      emit(`[nex-env-validator] PROHIBITED · ${entry.name} · ${entry.why}`);
    }
  }

  // 5 · Prod-prohibited presence-style vars (any non-empty = prohibited).
  for (const entry of PROD_PROHIBITED_PRESENCE) {
    const value = env[entry.name];
    const hasValue = typeof value === "string" ? value.length > 0 : value !== undefined && value !== null;
    if (hasValue) {
      prohibited.push({
        name: entry.name,
        severity: entry.severity,
        remediation: `unset ${entry.name} in production`,
      });
      emit(`[nex-env-validator] PROHIBITED · ${entry.name} · ${entry.why}`);
    }
  }

  // 6 · Informational warnings.
  for (const entry of WARN_IF_PRESENT) {
    const value = env[entry.name];
    const hasValue = typeof value === "string" ? value.length > 0 : value !== undefined && value !== null;
    if (hasValue) {
      warnings.push({ name: entry.name, reason: entry.reason });
      emit(`[nex-env-validator] WARN · ${entry.name} · ${entry.reason}`);
    }
  }

  const ok =
    missing.length === 0 &&
    invalid.length === 0 &&
    decisions.length === 0 &&
    prohibited.length === 0;

  if (ok) {
    emit(`[nex-env-validator] OK · ${REQUIRED_PHASE1.length} required · ${DECISION_REQUIRED.length} decisions resolved · ${prohibited.length === 0 ? "no prohibited vars present" : ""}`);
  } else {
    emit(
      `[nex-env-validator] SUMMARY · missing=${missing.length} invalid=${invalid.length} ` +
      `decisions=${decisions.length} prohibited=${prohibited.length} warnings=${warnings.length}`
    );
  }

  return { ok, profile, missing, invalid, decisions, prohibited, warnings, messages };
}

// ─── CLI wrapper ──────────────────────────────────────────────────

/**
 * CLI entry point. Pure of hardcoded I/O when the caller injects
 * `env`, `exit`, and `log`.
 *
 * Exit codes:
 *   0 · OK · all required present + format-valid, no decisions
 *       pending, no prohibited vars present
 *   1 · HARD FAILURE · missing / invalid / prohibited vars present
 *   2 · DECISION PENDING · otherwise OK but one or more operator
 *       decisions (D1-D6) remain unresolved
 *
 * The pending-decision exit (code 2) is distinct from a hard failure
 * so CI can differentiate a provably-wrong configuration from one
 * that still awaits an operator decision.
 */
export function runValidator({ argv = [], env = {}, exit, log } = {}) {
  const exitFn = typeof exit === "function" ? exit : ((code) => process.exit(code));
  const logFn = typeof log === "function" ? log : ((msg) => console.error(msg));

  // Parse CLI args · very narrow surface, only --profile=<name>.
  let profile = PROFILE_PRODUCTION_PHASE1;
  for (const a of argv) {
    const m = /^--profile=(.+)$/.exec(a);
    if (m) profile = m[1];
  }

  const result = validateEnvironment({ env, profile, log: logFn });

  const hasHardFailure =
    result.missing.length > 0 ||
    result.invalid.length > 0 ||
    result.prohibited.length > 0;
  if (hasHardFailure) {
    exitFn(1);
    return result;
  }
  if (result.decisions.length > 0) {
    exitFn(2);
    return result;
  }
  if (!result.ok) {
    // Any other structural failure · unknown profile, non-object env.
    // These are configuration errors, not pending-decision states,
    // so they map onto a hard-failure exit code.
    exitFn(1);
    return result;
  }
  exitFn(0);
  return result;
}

// ─── CLI entry · only runs when invoked directly ─────────────────

const invokedAsCli =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  process.argv.length > 1 &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedAsCli) {
  runValidator({
    argv: process.argv.slice(2),
    env: process.env,
  });
}
