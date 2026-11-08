// src/lib/nex-native/recovery/retry.ts
//
// NEX Security & Recovery · bounded retry with exponential backoff.
// Owner-sealed 2026-11-08.
// -----------------------------------------------------------------------------
// Server-only · pure library · no DB · no network of its own. Safe to
// wrap idempotent operations only. The caller MUST affirm
// idempotency via `opts.idempotent` · if false, `withRetry` short-
// circuits after the first attempt and rethrows.
//
// Doctrine
//   · Default 3 attempts, baseDelay 100ms, cap 30s, ±20% jitter.
//   · maxAttempts clamped to [1, 10]. Never-ending retries are
//     forbidden across the entire NEX codebase.
//   · Default `shouldRetry` honours network-shape errors (ECONNRESET,
//     ETIMEDOUT, EAI_AGAIN) and gateway-shape HTTP (429, 502, 503,
//     504). It NEVER retries 4xx auth / not-found / unprocessable
//     errors (401, 403, 404, 422) · retrying those just rate-limits
//     the victim.
//   · Payments, purchases, message send, account deletion, and any
//     user-visible mutation MUST pass `idempotent: false`. The
//     recorder service (`incident-service`) is the right place to
//     capture the failure · not the retry loop.
//   · `onAttempt(attempt, err)` is advisory · callers may use it for
//     observability. Any exception thrown from the hook is swallowed
//     so the retry loop stays deterministic.

import "server-only";

export interface RetryOptions {
  /** Hard affirmation the operation is safe to retry. Default `false`.
   *  When `false` the function runs once and re-throws on error. */
  readonly idempotent: boolean;
  /** 1 to 10 inclusive. Values outside the range are clamped. */
  readonly maxAttempts?: number;
  /** Initial backoff in milliseconds. Default 100. */
  readonly baseDelayMs?: number;
  /** Upper bound on any single backoff delay. Default 30_000. */
  readonly capMs?: number;
  /** Apply ±20% jitter to each backoff. Default `true`. */
  readonly jitter?: boolean;
  /** Predicate deciding whether a given error should be retried. */
  readonly shouldRetry?: (err: unknown, attempt: number) => boolean;
  /** Observability hook · errors from this callback are swallowed. */
  readonly onAttempt?: (attempt: number, err: unknown) => void;
  /** Overridable sleep · tests can inject an instantaneous waiter. */
  readonly sleep?: (ms: number) => Promise<void>;
}

const MIN_ATTEMPTS = 1;
const MAX_ATTEMPTS = 10;
const DEFAULT_ATTEMPTS = 3;
const DEFAULT_BASE_MS = 100;
const DEFAULT_CAP_MS = 30_000;

/** HTTP status codes that signal "do not retry · retrying is a bug". */
const NON_RETRYABLE_HTTP = new Set<number>([400, 401, 403, 404, 405, 409, 410, 422]);

/** HTTP status codes that signal a transient upstream problem. */
const RETRYABLE_HTTP = new Set<number>([408, 425, 429, 500, 502, 503, 504]);

/** Node network error codes that are retry-safe. */
const RETRYABLE_NETWORK_CODES = new Set<string>([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "EPIPE",
  "ENETDOWN",
  "ENETUNREACH",
  "EHOSTUNREACH",
  "EBUSY",
]);

function clampAttempts(n: number | undefined): number {
  const raw = Number.isFinite(n) ? Math.trunc(n as number) : DEFAULT_ATTEMPTS;
  if (raw < MIN_ATTEMPTS) return MIN_ATTEMPTS;
  if (raw > MAX_ATTEMPTS) return MAX_ATTEMPTS;
  return raw;
}

function errorStatus(err: unknown): number | null {
  if (!err || typeof err !== "object") return null;
  const e = err as { status?: unknown; statusCode?: unknown; code?: unknown };
  if (typeof e.status === "number") return e.status;
  if (typeof e.statusCode === "number") return e.statusCode;
  // Some fetch wrappers stash the status in `code`.
  if (typeof e.code === "number") return e.code;
  return null;
}

function errorCode(err: unknown): string | null {
  if (!err || typeof err !== "object") return null;
  const e = err as { code?: unknown };
  return typeof e.code === "string" ? e.code : null;
}

/** Default predicate · retry on network-shape + gateway HTTP, never on auth. */
export function defaultShouldRetry(err: unknown): boolean {
  const code = errorCode(err);
  if (code && RETRYABLE_NETWORK_CODES.has(code)) return true;

  const status = errorStatus(err);
  if (status !== null) {
    if (NON_RETRYABLE_HTTP.has(status)) return false;
    if (RETRYABLE_HTTP.has(status)) return true;
    // Any other 4xx is NOT retried · it's a client bug.
    if (status >= 400 && status < 500) return false;
    // Any other 5xx IS retried · it's upstream.
    if (status >= 500 && status < 600) return true;
  }
  // Unknown shape · do not retry by default · caller can opt in via
  // `shouldRetry`.
  return false;
}

function defaultSleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function computeBackoff(
  attempt: number,
  baseDelayMs: number,
  capMs: number,
  jitter: boolean,
): number {
  // attempt is 1-based · delay AFTER attempt N is base * 2^(N-1).
  const safeAttempt = Math.max(1, Math.trunc(attempt));
  const exp = Math.min(capMs, baseDelayMs * 2 ** (safeAttempt - 1));
  if (!jitter) return exp;
  // ±20% jitter · deterministic range, random value.
  const spread = exp * 0.2;
  const low = Math.max(0, exp - spread);
  const high = Math.min(capMs, exp + spread);
  return low + Math.random() * (high - low);
}

/** Thrown when the caller asks to retry a non-idempotent operation. */
export class NonIdempotentRetryError extends Error {
  constructor() {
    super(
      "withRetry refused · operation is non-idempotent (payments, account deletion, message send, etc.)",
    );
    this.name = "NonIdempotentRetryError";
  }
}

/**
 * Run `fn` with bounded exponential backoff + jitter.
 *
 * Returns the resolved value, or re-throws the final error. If
 * `opts.idempotent === false`, runs once and re-throws the first
 * failure untouched (the retry loop is a no-op for non-idempotent
 * operations · this is a feature, not a limitation).
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  opts: RetryOptions,
): Promise<T> {
  const maxAttempts = clampAttempts(opts.maxAttempts);
  const baseDelayMs = Math.max(0, opts.baseDelayMs ?? DEFAULT_BASE_MS);
  const capMs = Math.max(baseDelayMs, opts.capMs ?? DEFAULT_CAP_MS);
  const jitter = opts.jitter ?? true;
  const shouldRetry = opts.shouldRetry ?? defaultShouldRetry;
  const sleep = opts.sleep ?? defaultSleep;

  // Non-idempotent fast-path · one shot, no retry.
  if (!opts.idempotent) {
    try {
      return await fn(1);
    } catch (err) {
      try {
        opts.onAttempt?.(1, err);
      } catch {
        /* observability hook must never throw through */
      }
      throw err;
    }
  }

  let lastErr: unknown = new Error("withRetry exhausted with no attempts");
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      try {
        opts.onAttempt?.(attempt, err);
      } catch {
        /* swallow */
      }
      if (attempt >= maxAttempts) break;
      let keepGoing = false;
      try {
        keepGoing = shouldRetry(err, attempt);
      } catch {
        keepGoing = false;
      }
      if (!keepGoing) break;
      const delay = computeBackoff(attempt, baseDelayMs, capMs, jitter);
      await sleep(delay);
    }
  }
  throw lastErr;
}
