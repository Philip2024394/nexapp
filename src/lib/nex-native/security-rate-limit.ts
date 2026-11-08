// src/lib/nex-native/security-rate-limit.ts
//
// NEX Security Programme · Phase 0 · Item 4 · per-identity rolling-
// window rate limiter for sensitive security endpoints. Owner-sealed
// 2026-11-08.
// -----------------------------------------------------------------------------
// Primary mode · DB-backed via nex_security_rate_limit (migration 290
// AUTHORED · NOT YET APPLIED). When the table is present, counters
// are shared across Vercel instances via the single Supabase project
// so a determined attacker cannot bypass the limit by bouncing
// requests off different lambdas.
//
// Fallback mode · process-local in-memory Map<string, {count, windowMs}>
// when the DB table returns "does not exist". This is a DEGRADED
// fallback · it is NOT distributed enforcement. Each Vercel instance
// has its own map and an attacker with enough concurrency can hit
// different instances. The fallback is loud about this · every
// throttled request writes a warn to the server logs so the gap is
// visible.
//
// Identity key format (sealed · CHECK-enforced at the DB too):
//   · acct:<uuid>          · authenticated endpoints (account id)
//   · ip:<sha256>          · unauthenticated endpoints (hashed IP)
//
// Cold-bucket race · inherited from nex_community_rate_limit · two
// concurrent calls at a fresh (key, action, windowStartedAt) can
// both pass. Acceptable for Phase 0 · stricter atomicity (advisory
// lock / stored proc) is a Phase 1.1 upgrade.
//
// Doctrine · fail-safe when at-limit (throws); fail-open when the
// read itself errors (returns · logs). Never blocks legitimate users
// due to infra wobble.

import "server-only";
import { createHash } from "node:crypto";
import { nexSupabaseAdmin } from "./supabase-admin";

// ─── Action enum + policy (sealed starting values) ────────────────────

export type SecurityRateLimitAction =
  | "password_change"
  | "session_revoke"
  | "session_revoke_all"
  | "chat_message"
  | "account_create"
  | "webauthn_assert"
  | "webauthn_enroll";

/** Owner directive 2026-11-08 · Part A · per-action behaviour when
 *  the DB-backed path cannot run (probe negative) OR when a
 *  DB-backed read/write errors mid-call.
 *
 *    "in_memory"  · delegate to the process-local Map limiter. NOT
 *                   distributed enforcement but per-lambda cap is
 *                   strictly better than fail-open. Default for every
 *                   action except session_revoke.
 *    "fail_open"  · return without touching any counter. Owner
 *                   decision 2026-11-08 · session_revoke only ·
 *                   single-session revoke has low abuse value + is
 *                   a legitimate ops path that shouldn't be blocked
 *                   because of a Supabase wobble.
 */
export type SecurityRateLimitFallback = "in_memory" | "fail_open";

export interface SecurityRateLimitPolicy {
  readonly windowMinutes: number;
  readonly maxPerWindow: number;
  readonly fallback: SecurityRateLimitFallback;
  readonly rationale: string;
}

/** Owner-sealed 2026-11-08 · starting values documented inline. Tune
 *  only with explicit owner approval · changes affect legitimate
 *  users' throttling floor. */
export const SECURITY_RATE_LIMITS: Record<
  SecurityRateLimitAction,
  SecurityRateLimitPolicy
> = {
  password_change: {
    windowMinutes: 15,
    maxPerWindow: 5,
    fallback: "in_memory",
    rationale:
      "Defends against drive-by password churn on a compromised session · 5 attempts gives the legitimate user room for typos · 15min window expires before lockout fatigue.",
  },
  session_revoke: {
    windowMinutes: 15,
    maxPerWindow: 10,
    fallback: "fail_open",
    rationale:
      "A legitimate user rarely revokes more than one or two sessions back-to-back · 10 is comfortably above any legit flow · 15min window. Fallback is fail-open because single-session revoke is a legitimate ops path and abuse value is low.",
  },
  session_revoke_all: {
    windowMinutes: 60,
    maxPerWindow: 3,
    fallback: "in_memory",
    rationale:
      "Mass invalidation is a high-impact rare operation · 3 per hour is well above any legitimate pattern and caps retries after a legitimate trigger.",
  },
  chat_message: {
    windowMinutes: 60,
    maxPerWindow: 60,
    fallback: "in_memory",
    rationale:
      "Chat is core · 1 msg/sec average is generous enough to never bother a legitimate user · caps scripted spam at 60/hour per account.",
  },
  account_create: {
    windowMinutes: 60,
    maxPerWindow: 3,
    fallback: "in_memory",
    rationale:
      "Per hashed IP · 3 new accounts per hour is enough for family / shared-device onboarding but caps automated signup rings. Also triggers the 503 escalation path (see ACCOUNT_CREATE_DB_FAILURE_* state) when the DB can't keep up.",
  },
  webauthn_assert: {
    windowMinutes: 15,
    maxPerWindow: 10,
    fallback: "in_memory",
    rationale:
      "Per hashed IP · WebAuthn should never need more than a handful of asserts in a window · 10 is a soft ceiling against enumeration attacks.",
  },
  webauthn_enroll: {
    windowMinutes: 60,
    maxPerWindow: 5,
    fallback: "in_memory",
    rationale:
      "Per account · legitimate enrolment of 5 passkeys per hour is more than enough for every scenario including multi-device setup days.",
  },
};

// ─── Error ────────────────────────────────────────────────────────────

export class SecurityRateLimitError extends Error {
  readonly action: SecurityRateLimitAction;
  readonly retryAfterSeconds: number;
  constructor(action: SecurityRateLimitAction, retryAfterSeconds: number) {
    super(`security-rate-limit: ${action} throttled · retry in ${retryAfterSeconds}s`);
    this.name = "SecurityRateLimitError";
    this.action = action;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function isSecurityRateLimitError(
  e: unknown,
): e is SecurityRateLimitError {
  return e instanceof SecurityRateLimitError;
}

/** Owner directive 2026-11-08 · Part A · account_create ONLY escalates
 *  to 503 when the DB-backed limiter can't run reliably. Thrown before
 *  any account mutation so the handler never half-creates a user.
 *
 *  Triggered when > ACCOUNT_CREATE_FAILURE_THRESHOLD consecutive DB
 *  failures occur in a rolling ACCOUNT_CREATE_FAILURE_WINDOW_MS. The
 *  counter resets on the next successful DB operation for the same
 *  action · owner safeguard · failure state must auto-recover. */
export class SecurityUnavailableError extends Error {
  readonly action: SecurityRateLimitAction;
  readonly retryAfterSeconds: number;
  constructor(action: SecurityRateLimitAction, retryAfterSeconds: number) {
    super(
      `security-rate-limit: ${action} unavailable · DB-backed limiter degraded · retry in ${retryAfterSeconds}s`,
    );
    this.name = "SecurityUnavailableError";
    this.action = action;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function isSecurityUnavailableError(
  e: unknown,
): e is SecurityUnavailableError {
  return e instanceof SecurityUnavailableError;
}

// ─── Key derivation ───────────────────────────────────────────────────

const KEY_SHAPE = /^(acct|ip):[a-z0-9-]{16,}$/;

/** `acct:<uuid>` key. Owner-scoped · service layer passes the
 *  authenticated session's account id, never a client-supplied value. */
export function accountRateLimitKey(accountId: string): string {
  // Lowercase UUID · matches the CHECK regex on the DB.
  const key = `acct:${accountId.toLowerCase()}`;
  if (!KEY_SHAPE.test(key)) {
    throw new Error(
      `security-rate-limit: accountRateLimitKey · malformed accountId`,
    );
  }
  return key;
}

/** `ip:<sha256>` key. The service hashes the raw IP so the DB never
 *  stores IPs in plaintext. Caller passes the IP derived via the
 *  sealed `readClientIp` helper · header-derived values are trusted
 *  only under Vercel's forwarded-for policy. */
export function ipRateLimitKey(rawIp: string | null | undefined): string {
  const safe = typeof rawIp === "string" && rawIp.length > 0 ? rawIp : "unknown";
  const hash = createHash("sha256").update(safe, "utf8").digest("hex");
  return `ip:${hash}`;
}

// ─── Window helper ────────────────────────────────────────────────────

function floorWindow(nowMs: number, windowMinutes: number): Date {
  const windowMs = windowMinutes * 60_000;
  return new Date(Math.floor(nowMs / windowMs) * windowMs);
}

// ─── Column-probe cache ───────────────────────────────────────────────

let TABLE_READY: boolean | null = null;

async function ensureTableReady(): Promise<boolean> {
  if (TABLE_READY !== null) return TABLE_READY;
  try {
    const { error } = await nexSupabaseAdmin
      .from("nex_security_rate_limit")
      .select("key")
      .limit(0);
    TABLE_READY = !error;
    if (!TABLE_READY) {
      // eslint-disable-next-line no-console
      console.warn(
        "[security-rate-limit] nex_security_rate_limit table unavailable " +
          "· DEGRADED to process-local in-memory fallback. NOT distributed " +
          "across Vercel instances. Apply migration 290 to activate full " +
          "enforcement.",
        { error: error?.message ?? null },
      );
    }
    return TABLE_READY;
  } catch {
    TABLE_READY = false;
    return false;
  }
}

/** Exposed so tests can reset the probe between isolated runs. */
export function _resetSecurityRateLimitProbeCacheForTests(): void {
  TABLE_READY = null;
}

// ─── Fallback · process-local Map (not distributed) ──────────────────
//
// Owner directive 2026-11-08 · Part A FINAL REVIEW · the in-memory
// fallback must be BOUNDED so a sustained outage + many unique keys
// (e.g. attacker rotating IP hashes) cannot grow the map without
// limit.
//
// Approach · two defences:
//
//   1. Soft bound · every LOCAL_SWEEP_EVERY_N calls we sweep all
//      entries whose window has already ended. This keeps the map
//      close to "active-window-only" during normal operation.
//
//   2. Hard bound · LOCAL_MAX_ENTRIES caps the map's size. When the
//      cap is hit we run an immediate sweep, and if the map is still
//      above the cap we delete entries in insertion order (Map
//      preserves insertion order) until we're back under. Oldest
//      entries are the ones closest to expiring anyway.
//
// Both defences are PROCESS-LOCAL · an attacker who can reach a
// different lambda has a different map. This matches the sealed
// "degraded enforcement" doctrine documented at the top of the file.

interface LocalEntry {
  readonly windowStartedAtMs: number;
  readonly windowEndMs: number;
  readonly action: SecurityRateLimitAction;
  count: number;
}

const LOCAL: Map<string, LocalEntry> = new Map();

const LOCAL_MAX_ENTRIES = 50_000;
const LOCAL_SWEEP_EVERY_N = 256;
let LOCAL_OPS_SINCE_SWEEP = 0;

function sweepExpiredLocalEntries(): void {
  const now = Date.now();
  for (const [k, v] of LOCAL) {
    if (v.windowEndMs <= now) {
      LOCAL.delete(k);
    }
  }
}

function enforceLocalHardBound(): void {
  if (LOCAL.size <= LOCAL_MAX_ENTRIES) return;
  sweepExpiredLocalEntries();
  if (LOCAL.size <= LOCAL_MAX_ENTRIES) return;
  // Still over · drop oldest-by-insertion-order until under.
  // eslint-disable-next-line no-console
  console.warn(
    "[security-rate-limit] in-memory fallback map at hard bound · " +
      "dropping oldest entries to maintain bound. Investigate load pattern.",
    { size: LOCAL.size, cap: LOCAL_MAX_ENTRIES },
  );
  const toDrop = LOCAL.size - LOCAL_MAX_ENTRIES;
  let dropped = 0;
  for (const k of LOCAL.keys()) {
    if (dropped >= toDrop) break;
    LOCAL.delete(k);
    dropped++;
  }
}

/** Exposed so tests can clear the in-memory fallback between runs. */
export function _resetSecurityRateLimitLocalForTests(): void {
  LOCAL.clear();
  LOCAL_OPS_SINCE_SWEEP = 0;
}

/** Exposed so tests can observe the fallback map's size. */
export function _localFallbackSizeForTests(): number {
  return LOCAL.size;
}

/** Exposed so tests can force the periodic sweep deterministically. */
export function _forceLocalSweepForTests(): void {
  sweepExpiredLocalEntries();
  enforceLocalHardBound();
}

function localRecordIfAllowed(
  key: string,
  action: SecurityRateLimitAction,
): void {
  // Periodic + size-triggered cleanup · bounded fallback map.
  LOCAL_OPS_SINCE_SWEEP++;
  if (LOCAL_OPS_SINCE_SWEEP >= LOCAL_SWEEP_EVERY_N) {
    LOCAL_OPS_SINCE_SWEEP = 0;
    sweepExpiredLocalEntries();
  }
  enforceLocalHardBound();

  const policy = SECURITY_RATE_LIMITS[action];
  const windowStart = floorWindow(Date.now(), policy.windowMinutes);
  const windowEndMs = windowStart.getTime() + policy.windowMinutes * 60_000;
  const mapKey = `${key}|${action}|${windowStart.getTime()}`;
  const entry = LOCAL.get(mapKey);
  const currentCount = entry?.count ?? 0;
  if (currentCount >= policy.maxPerWindow) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil(
        (windowStart.getTime() + policy.windowMinutes * 60_000 - Date.now()) /
          1000,
      ),
    );
    // eslint-disable-next-line no-console
    console.warn(
      "[security-rate-limit] local fallback throttled a request · " +
        "NOT distributed enforcement · apply migration 290 to close the gap.",
      { action, retryAfterSeconds },
    );
    throw new SecurityRateLimitError(action, retryAfterSeconds);
  }
  LOCAL.set(mapKey, {
    windowStartedAtMs: windowStart.getTime(),
    windowEndMs,
    action,
    count: currentCount + 1,
  });
}

// ─── account_create · 503 escalation state ───────────────────────────
//
// Owner directive 2026-11-08 · Part A · ONLY account_create escalates
// to a hard unavailable response when the DB-backed limiter is
// repeatedly failing. Rationale · account creation is the one call
// site where "fall back to in-memory per-lambda cap" is NOT good
// enough · an attacker with enough concurrency could still create
// hundreds of accounts across lambdas. For every other action the
// per-lambda in-memory cap is acceptable.
//
// Shape · a bounded ring of recent failure timestamps. Pruned on every
// access so the memory footprint is capped at ACCOUNT_CREATE_MAX_TRACKED
// entries and the window is truly rolling (not a quiet-period reset).
//
// Recovery · ANY successful DB read/write for account_create clears
// the ring. This prevents indefinite escalation after a brief outage.

const ACCOUNT_CREATE_FAILURE_WINDOW_MS = 60_000;
const ACCOUNT_CREATE_FAILURE_THRESHOLD = 10;
/** Hard cap so a sustained outage can't grow the ring without bound.
 *  THRESHOLD + 10 slack is enough to still observe "deeply escalated"
 *  without storing every failure during an outage. */
const ACCOUNT_CREATE_MAX_TRACKED = ACCOUNT_CREATE_FAILURE_THRESHOLD + 10;

const ACCOUNT_CREATE_DB_FAILURES: number[] = [];

function pruneAccountCreateDbFailures(nowMs: number): void {
  const cutoff = nowMs - ACCOUNT_CREATE_FAILURE_WINDOW_MS;
  while (
    ACCOUNT_CREATE_DB_FAILURES.length > 0 &&
    (ACCOUNT_CREATE_DB_FAILURES[0] as number) < cutoff
  ) {
    ACCOUNT_CREATE_DB_FAILURES.shift();
  }
}

function recordAccountCreateDbFailure(): void {
  const now = Date.now();
  pruneAccountCreateDbFailures(now);
  if (ACCOUNT_CREATE_DB_FAILURES.length >= ACCOUNT_CREATE_MAX_TRACKED) {
    // Already over threshold · no value in growing the ring further.
    return;
  }
  ACCOUNT_CREATE_DB_FAILURES.push(now);
}

function resetAccountCreateDbFailures(): void {
  ACCOUNT_CREATE_DB_FAILURES.length = 0;
}

function isAccountCreateEscalated(): boolean {
  pruneAccountCreateDbFailures(Date.now());
  return ACCOUNT_CREATE_DB_FAILURES.length > ACCOUNT_CREATE_FAILURE_THRESHOLD;
}

/** Exposed so tests can observe/reset the account_create escalation
 *  state between scenarios. */
export function _resetAccountCreateFailureStateForTests(): void {
  ACCOUNT_CREATE_DB_FAILURES.length = 0;
}
export function _accountCreateFailureCountForTests(): number {
  pruneAccountCreateDbFailures(Date.now());
  return ACCOUNT_CREATE_DB_FAILURES.length;
}

// ─── DB-backed path ──────────────────────────────────────────────────

async function dbRecordIfAllowed(
  key: string,
  action: SecurityRateLimitAction,
): Promise<void> {
  const policy = SECURITY_RATE_LIMITS[action];
  const windowStart = floorWindow(Date.now(), policy.windowMinutes).toISOString();

  const { data: existing, error: readErr } = await nexSupabaseAdmin
    .from("nex_security_rate_limit")
    .select("count")
    .eq("key", key)
    .eq("action", action)
    .eq("window_started_at", windowStart)
    .maybeSingle();

  if (readErr) {
    // Owner directive 2026-11-08 · Part A · DB read failure handling.
    // For account_create · record the failure and escalate to 503 if
    // the rolling-window threshold is exceeded. The escalation runs
    // BEFORE any fallback so the account handler halts before creating.
    if (action === "account_create") {
      recordAccountCreateDbFailure();
      if (isAccountCreateEscalated()) {
        // eslint-disable-next-line no-console
        console.error(
          "[security-rate-limit] account_create · DB-backed limiter " +
            "ESCALATED to 503 · >",
          ACCOUNT_CREATE_FAILURE_THRESHOLD,
          "DB failures in",
          ACCOUNT_CREATE_FAILURE_WINDOW_MS / 1000,
          "s · caller must not create an account until this clears.",
          { error: readErr.message },
        );
        throw new SecurityUnavailableError("account_create", 60);
      }
    }
    // Per-action fallback decision · in_memory delegates to the
    // process-local Map (throws SecurityRateLimitError when full),
    // fail_open returns silently. Both log loudly.
    if (policy.fallback === "in_memory") {
      // eslint-disable-next-line no-console
      console.warn(
        "[security-rate-limit] DB read failed · degrading to in-memory " +
          "per-lambda fallback · NOT distributed enforcement.",
        { action, error: readErr.message },
      );
      localRecordIfAllowed(key, action);
      return;
    }
    // fail_open (session_revoke only)
    // eslint-disable-next-line no-console
    console.warn(
      "[security-rate-limit] DB read failed · fail-open",
      { action, error: readErr.message },
    );
    return;
  }

  const currentCount = existing?.count ?? 0;
  if (currentCount >= policy.maxPerWindow) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil(
        (Date.parse(windowStart) + policy.windowMinutes * 60_000 - Date.now()) /
          1000,
      ),
    );
    // Successful DB read · the limiter is healthy for this action.
    // Clear the escalation ring on success for account_create.
    if (action === "account_create") {
      resetAccountCreateDbFailures();
    }
    throw new SecurityRateLimitError(action, retryAfterSeconds);
  }

  const { error: writeErr } = await nexSupabaseAdmin
    .from("nex_security_rate_limit")
    .upsert(
      {
        key,
        action,
        window_started_at: windowStart,
        count: currentCount + 1,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key,action,window_started_at" },
    );
  if (writeErr) {
    // Owner directive 2026-11-08 · Part A FINAL REVIEW · the write-error
    // branch was previously a `return` that let the user through. Under
    // repeated write failures (e.g. attacker-triggered primary-replica
    // lag or storage pressure), the DB counter never persisted and each
    // call read count=0 · bypass. Fix · identical treatment to the read-
    // error branch · same failure record, same escalation check,
    // same in-memory fallback. This guarantees the per-lambda cap still
    // bounds requests when the DB can't enforce its own.
    //
    // Non-double-count invariant · a single `dbRecordIfAllowed` call
    // enters AT MOST ONE of {read-error, write-error} branches because
    // the read-error branch returns early. recordAccountCreateDbFailure
    // is therefore called exactly once per DB failure (zero or one).
    if (action === "account_create") {
      recordAccountCreateDbFailure();
      if (isAccountCreateEscalated()) {
        // eslint-disable-next-line no-console
        console.error(
          "[security-rate-limit] account_create · write path ESCALATED " +
            "to 503 · caller must not create an account until this clears.",
          { error: writeErr.message },
        );
        // Owner invariant · "No account can be created after a 503 is
        // raised." Throw on the CURRENT call once the threshold is
        // crossed · the current user is refused along with everyone
        // after them until the ring prunes or a DB op succeeds.
        throw new SecurityUnavailableError("account_create", 60);
      }
    }
    // Per-action fallback decision · identical to the read-error
    // branch. in_memory delegates to the process-local Map so the
    // per-lambda cap still fires; fail_open returns silently.
    if (policy.fallback === "in_memory") {
      // eslint-disable-next-line no-console
      console.warn(
        "[security-rate-limit] DB write failed · degrading to in-memory " +
          "per-lambda fallback · NOT distributed enforcement.",
        { action, error: writeErr.message },
      );
      localRecordIfAllowed(key, action);
      return;
    }
    // fail_open (session_revoke only)
    // eslint-disable-next-line no-console
    console.warn(
      "[security-rate-limit] DB write failed · counter not incremented · fail-open",
      { action, error: writeErr.message },
    );
    return;
  }

  // Full success · DB round-trip healthy. Clear the account_create
  // escalation ring per owner safeguard · auto-recovery semantics.
  if (action === "account_create") {
    resetAccountCreateDbFailures();
  }
}

// ─── Public API ───────────────────────────────────────────────────────

/** Record one request against the counter · throw
 *  SecurityRateLimitError when the window is full. Call this BEFORE
 *  the action's business logic so rejection is honest. */
export async function recordIfAllowed(
  key: string,
  action: SecurityRateLimitAction,
): Promise<void> {
  if (!KEY_SHAPE.test(key)) {
    // Service-layer defence · a malformed key is a programmer error.
    // Fail closed so bugs are visible instead of silently unlimiting.
    throw new Error(
      `security-rate-limit: recordIfAllowed · malformed key shape`,
    );
  }
  const tableReady = await ensureTableReady();
  if (!tableReady) {
    localRecordIfAllowed(key, action);
    return;
  }
  await dbRecordIfAllowed(key, action);
}

/** Build a consistent 429 response payload + Retry-After header
 *  value for route handlers. */
export function buildRateLimitResponse(err: SecurityRateLimitError): {
  readonly status: 429;
  readonly body: {
    readonly ok: false;
    readonly error: "rate_limited";
    readonly action: SecurityRateLimitAction;
    readonly retry_after_seconds: number;
  };
  readonly headers: Record<string, string>;
} {
  return {
    status: 429,
    body: {
      ok: false,
      error: "rate_limited",
      action: err.action,
      retry_after_seconds: err.retryAfterSeconds,
    },
    headers: {
      "Retry-After": String(err.retryAfterSeconds),
      "X-RateLimit-Reason": err.action,
    },
  };
}

/** Owner directive 2026-11-08 · Part A · 503 response for the
 *  account_create escalation path. Retry-After is 60 per owner
 *  safeguard · clients retry after a minute, by which time the
 *  rolling window has cleared enough for the counter to recover. */
export function buildUnavailableResponse(err: SecurityUnavailableError): {
  readonly status: 503;
  readonly body: {
    readonly ok: false;
    readonly error: "service_unavailable";
    readonly action: SecurityRateLimitAction;
    readonly retry_after_seconds: number;
  };
  readonly headers: Record<string, string>;
} {
  return {
    status: 503,
    body: {
      ok: false,
      error: "service_unavailable",
      action: err.action,
      retry_after_seconds: err.retryAfterSeconds,
    },
    headers: {
      "Retry-After": String(err.retryAfterSeconds),
      "X-Security-Reason": err.action,
    },
  };
}
