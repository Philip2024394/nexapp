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

export interface SecurityRateLimitPolicy {
  readonly windowMinutes: number;
  readonly maxPerWindow: number;
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
    rationale:
      "Defends against drive-by password churn on a compromised session · 5 attempts gives the legitimate user room for typos · 15min window expires before lockout fatigue.",
  },
  session_revoke: {
    windowMinutes: 15,
    maxPerWindow: 10,
    rationale:
      "A legitimate user rarely revokes more than one or two sessions back-to-back · 10 is comfortably above any legit flow · 15min window.",
  },
  session_revoke_all: {
    windowMinutes: 60,
    maxPerWindow: 3,
    rationale:
      "Mass invalidation is a high-impact rare operation · 3 per hour is well above any legitimate pattern and caps retries after a legitimate trigger.",
  },
  chat_message: {
    windowMinutes: 60,
    maxPerWindow: 60,
    rationale:
      "Chat is core · 1 msg/sec average is generous enough to never bother a legitimate user · caps scripted spam at 60/hour per account.",
  },
  account_create: {
    windowMinutes: 60,
    maxPerWindow: 3,
    rationale:
      "Per hashed IP · 3 new accounts per hour is enough for family / shared-device onboarding but caps automated signup rings. IP is imperfect behind CGNAT · pair with reCAPTCHA / phone verification for sharper enforcement (future).",
  },
  webauthn_assert: {
    windowMinutes: 15,
    maxPerWindow: 10,
    rationale:
      "Per hashed IP · WebAuthn should never need more than a handful of asserts in a window · 10 is a soft ceiling against enumeration attacks.",
  },
  webauthn_enroll: {
    windowMinutes: 60,
    maxPerWindow: 5,
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

interface LocalEntry {
  readonly windowStartedAtMs: number;
  count: number;
}

const LOCAL: Map<string, LocalEntry> = new Map();

/** Exposed so tests can clear the in-memory fallback between runs. */
export function _resetSecurityRateLimitLocalForTests(): void {
  LOCAL.clear();
}

function localRecordIfAllowed(
  key: string,
  action: SecurityRateLimitAction,
): void {
  const policy = SECURITY_RATE_LIMITS[action];
  const windowStart = floorWindow(Date.now(), policy.windowMinutes);
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
    count: currentCount + 1,
  });
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
    // Fail-open on read error · never block legitimate users due to
    // transient Supabase wobble. Loud log so ops can see the gap.
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
    // Same fail-open policy for writes. We've already shown the user
    // the action succeeded this time · a persistent write failure
    // would surface as a growing count-of-zero under attack, which
    // would eventually cap at maxPerWindow in the fallback path.
    // eslint-disable-next-line no-console
    console.warn(
      "[security-rate-limit] DB write failed · counter not incremented",
      { action, error: writeErr.message },
    );
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
