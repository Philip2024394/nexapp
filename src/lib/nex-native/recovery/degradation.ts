// src/lib/nex-native/recovery/degradation.ts
//
// NEX Security & Recovery · graceful degradation primitives.
// Owner-sealed 2026-11-08.
// -----------------------------------------------------------------------------
// Server-only · pure library · no DB · no network. Two primitives:
//
//   · withTimeout(promise, ms)
//       Resolves with the inner promise if it settles within `ms`,
//       otherwise rejects with `TimeoutError`. Does NOT cancel the
//       inner promise (JavaScript has no promise cancellation) · if
//       the caller needs cancellation they must pass an AbortSignal
//       through their own fetcher.
//
//   · withFallback(primary, fallback, opts)
//       Runs `primary`. If it throws OR exceeds `opts.timeoutMs`,
//       returns the fallback value. The fallback is a function so
//       its evaluation can be deferred (and can itself be async).
//
// Doctrine
//   · The fallback MUST be a safe, bounded, observability-friendly
//     value. Never fall back to "retry forever" or to "silently
//     ignore the user's request" · use a stub/cached/empty result
//     and surface the degradation via the incident recorder.
//   · `withFallback` captures the primary error internally and
//     exposes it via `opts.onFailure` for observability. It does not
//     re-throw unless the FALLBACK itself also throws.

import "server-only";

export class TimeoutError extends Error {
  readonly timeoutMs: number;
  constructor(timeoutMs: number) {
    super(`operation timed out after ${timeoutMs}ms`);
    this.name = "TimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Race `promise` against a `ms`-duration timer. Rejects with
 * `TimeoutError` if the timer wins. The inner promise is NOT
 * cancelled · callers responsible for concurrent work must plumb
 * their own cancellation (AbortSignal).
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeoutMs = Math.max(0, Math.trunc(ms));
  if (timeoutMs === 0) {
    return Promise.reject(new TimeoutError(0));
  }
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new TimeoutError(timeoutMs));
    }, timeoutMs);
    // unref so a stuck timer never holds the event loop in unit tests.
    if (typeof (timer as { unref?: () => void }).unref === "function") {
      (timer as { unref: () => void }).unref();
    }
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export interface FallbackOptions<T> {
  /** Optional timeout for the primary path. If unset, no timeout. */
  readonly timeoutMs?: number;
  /** Advisory hook fired when the primary fails / times out. The
   *  returned value (if any) is ignored · the fallback runs regardless. */
  readonly onFailure?: (err: unknown) => void;
  /** Predicate deciding whether a primary error triggers fallback.
   *  Default · every error triggers fallback. Return `false` to
   *  re-throw the original error without invoking the fallback. */
  readonly shouldFallback?: (err: unknown) => boolean;
  // phantom `T` reference so TS infers through the options arg even
  // when the type parameter cannot be inferred from the other fields.
  readonly _phantom?: T;
}

/**
 * Run `primary`. If it throws (or exceeds `timeoutMs`), run `fallback`
 * and return its value. The fallback is itself async-safe.
 */
export async function withFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T> | T,
  opts?: FallbackOptions<T>,
): Promise<T> {
  const timeoutMs = opts?.timeoutMs;
  const onFailure = opts?.onFailure;
  const shouldFallback = opts?.shouldFallback ?? (() => true);
  try {
    if (typeof timeoutMs === "number" && timeoutMs > 0) {
      return await withTimeout(primary(), timeoutMs);
    }
    return await primary();
  } catch (err) {
    let gate = true;
    try {
      gate = shouldFallback(err);
    } catch {
      gate = true;
    }
    if (!gate) {
      throw err;
    }
    try {
      onFailure?.(err);
    } catch {
      /* observability hook must never throw through */
    }
    return await fallback();
  }
}
