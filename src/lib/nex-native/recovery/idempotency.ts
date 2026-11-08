// src/lib/nex-native/recovery/idempotency.ts
//
// NEX Security & Recovery · in-memory idempotency guard.
// Owner-sealed 2026-11-08.
// -----------------------------------------------------------------------------
// Server-only · pure library · no DB. Guards against the common
// double-submit shape where a client retries a POST (user double-tap,
// flaky network re-send, mobile re-mount) and the server executes
// the mutation twice.
//
// Doctrine
//   · Per-lambda cache only · a determined attacker hitting two
//     Vercel instances can bypass this. For the surfaces that need
//     strict dedup (payments, account mutations) the DB must carry
//     a UNIQUE constraint on the idempotency key. This library is
//     the FIRST layer, not the only layer.
//   · TTL default 5 minutes · enough to absorb a reasonable retry
//     window without pinning memory forever.
//   · Namespacing · (namespace, key) is the composite · the same key
//     under different namespaces never collides.
//   · While a call is pending, duplicate callers AWAIT the existing
//     promise · they observe the same result or the same rejection.
//   · Rejected promises are NOT cached · the next call re-executes.
//     (If we cached failures, a transient blip would freeze a key
//     for its TTL and lock the user out.)

import "server-only";

export interface IdempotencyOptions {
  /** Logical bucket · e.g. "shop.checkout", "chat.send". */
  readonly namespace: string;
  /** TTL in ms for a cached SUCCESS. Default 5 minutes. */
  readonly ttlMs?: number;
  /** Clock override · tests inject a stepped clock. */
  readonly now?: () => number;
}

interface PendingEntry<T> {
  readonly kind: "pending";
  readonly promise: Promise<T>;
  readonly startedAt: number;
}

interface SettledEntry<T> {
  readonly kind: "settled";
  readonly value: T;
  readonly settledAt: number;
  readonly expiresAt: number;
}

type Entry<T> = PendingEntry<T> | SettledEntry<T>;

const STORE = new Map<string, Entry<unknown>>();

const DEFAULT_TTL_MS = 5 * 60 * 1000;
/** Pending entries older than this are considered abandoned · prevents
 *  a wedged promise from poisoning a key forever if a producer
 *  crashes without resolving. */
const PENDING_SAFETY_MS = 60 * 1000;

function composite(namespace: string, key: string): string {
  return `${namespace}::${key}`;
}

/**
 * Execute `fn` under an idempotency key. Duplicate calls with the
 * same (namespace, key):
 *   · while the first is in flight → share the same promise
 *   · after the first succeeds → return the cached value for TTL
 *   · after the first fails → next call re-executes
 *
 * If no key is provided (empty string), the guard is bypassed and
 * `fn` runs once with no caching.
 */
export async function withIdempotencyKey<T>(
  key: string,
  fn: () => Promise<T>,
  opts: IdempotencyOptions,
): Promise<T> {
  if (!key) {
    // No key · caller opted out · just run.
    return fn();
  }
  const ttlMs = Math.max(1, opts.ttlMs ?? DEFAULT_TTL_MS);
  const now = opts.now ?? Date.now;
  const id = composite(opts.namespace, key);

  const existing = STORE.get(id);
  const t = now();

  if (existing) {
    if (existing.kind === "pending") {
      // Abandon pending entries that are older than the safety
      // window · prevents permanent wedge.
      if (t - existing.startedAt < PENDING_SAFETY_MS) {
        return existing.promise as Promise<T>;
      }
      STORE.delete(id);
    } else {
      if (t < existing.expiresAt) {
        return existing.value as T;
      }
      STORE.delete(id);
    }
  }

  const promise = (async () => fn())();
  const pending: PendingEntry<T> = {
    kind: "pending",
    promise,
    startedAt: t,
  };
  STORE.set(id, pending as Entry<unknown>);

  try {
    const value = await promise;
    const settledAt = now();
    const entry: SettledEntry<T> = {
      kind: "settled",
      value,
      settledAt,
      expiresAt: settledAt + ttlMs,
    };
    STORE.set(id, entry as Entry<unknown>);
    return value;
  } catch (err) {
    // Rejections are NOT cached · drop the key so the next caller
    // can try again.
    STORE.delete(id);
    throw err;
  }
}

/** TEST-ONLY · reset the idempotency store. */
export function _resetIdempotencyForTests(): void {
  STORE.clear();
}
