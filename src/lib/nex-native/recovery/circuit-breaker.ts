// src/lib/nex-native/recovery/circuit-breaker.ts
//
// NEX Security & Recovery · classic 3-state circuit breaker.
// Owner-sealed 2026-11-08.
// -----------------------------------------------------------------------------
// Server-only · pure library · no DB · no network. State lives in a
// module-level Map keyed by breaker name · each lambda holds its own
// copy (we accept this · distributed breakers would require a DB
// round-trip on every call, defeating the point).
//
// States
//   · CLOSED     · operations pass through · failures counted over a
//                  rolling window · reaching the threshold opens the
//                  circuit.
//   · OPEN       · every call is rejected with `CircuitOpenError`
//                  without invoking `fn`. After `cooldownMs`, the
//                  next call transitions the breaker to HALF_OPEN.
//   · HALF_OPEN  · exactly ONE probe call is allowed. Concurrent
//                  callers while a probe is in flight get
//                  `CircuitOpenError`. Success returns to CLOSED and
//                  clears failures. Failure returns to OPEN with a
//                  fresh cooldown.
//
// Doctrine
//   · Named breakers are isolated · `withBreaker("supabase:read", …)`
//     is independent of `withBreaker("supabase:write", …)`.
//   · `getBreakerState` is read-only observability · safe for HQ
//     dashboards and incident recorders to poll.
//   · `_resetBreakersForTests` is the only sanctioned way to clear
//     state · production code must NEVER call it.

import "server-only";

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
  readonly name: string;
  /** Failures within `windowMs` needed to trip the breaker. Default 5. */
  readonly failureThreshold?: number;
  /** Rolling window length in ms. Default 10_000. */
  readonly windowMs?: number;
  /** How long to stay OPEN before allowing a probe. Default 30_000. */
  readonly cooldownMs?: number;
  /** Clock override · tests inject a fixed clock for deterministic flow. */
  readonly now?: () => number;
}

interface BreakerRecord {
  state: CircuitState;
  /** Sliding window of failure timestamps (ms). */
  failures: number[];
  /** Epoch ms when the breaker last opened. */
  openedAt: number | null;
  /** True while a HALF_OPEN probe is in flight. */
  probeInFlight: boolean;
}

const BREAKERS = new Map<string, BreakerRecord>();

const DEFAULT_THRESHOLD = 5;
const DEFAULT_WINDOW_MS = 10_000;
const DEFAULT_COOLDOWN_MS = 30_000;

function ensure(name: string): BreakerRecord {
  let rec = BREAKERS.get(name);
  if (!rec) {
    rec = {
      state: "CLOSED",
      failures: [],
      openedAt: null,
      probeInFlight: false,
    };
    BREAKERS.set(name, rec);
  }
  return rec;
}

function prune(rec: BreakerRecord, nowMs: number, windowMs: number): void {
  const cutoff = nowMs - windowMs;
  while (rec.failures.length > 0 && rec.failures[0]! < cutoff) {
    rec.failures.shift();
  }
}

/** Thrown when a call is refused because the breaker is OPEN (or the
 *  single HALF_OPEN probe slot is taken). */
export class CircuitOpenError extends Error {
  readonly breakerName: string;
  readonly breakerState: CircuitState;
  constructor(name: string, state: CircuitState) {
    super(`circuit breaker '${name}' is ${state} · call rejected`);
    this.name = "CircuitOpenError";
    this.breakerName = name;
    this.breakerState = state;
  }
}

/**
 * Wrap `fn` with a named circuit breaker. See file header for state
 * semantics. Options use ms-based thresholds and are bounded below.
 */
export async function withBreaker<T>(
  name: string,
  fn: () => Promise<T>,
  opts?: Omit<CircuitBreakerOptions, "name">,
): Promise<T> {
  const failureThreshold = Math.max(1, opts?.failureThreshold ?? DEFAULT_THRESHOLD);
  const windowMs = Math.max(1, opts?.windowMs ?? DEFAULT_WINDOW_MS);
  const cooldownMs = Math.max(1, opts?.cooldownMs ?? DEFAULT_COOLDOWN_MS);
  const now = opts?.now ?? Date.now;

  const rec = ensure(name);
  const t = now();

  // ── State transition evaluation (OPEN → HALF_OPEN after cooldown) ──
  if (rec.state === "OPEN") {
    if (rec.openedAt !== null && t - rec.openedAt >= cooldownMs) {
      rec.state = "HALF_OPEN";
      rec.probeInFlight = false;
    } else {
      throw new CircuitOpenError(name, "OPEN");
    }
  }

  // ── HALF_OPEN · exactly one probe at a time ───────────────────────
  if (rec.state === "HALF_OPEN") {
    if (rec.probeInFlight) {
      throw new CircuitOpenError(name, "HALF_OPEN");
    }
    rec.probeInFlight = true;
    try {
      const result = await fn();
      rec.state = "CLOSED";
      rec.failures = [];
      rec.openedAt = null;
      return result;
    } catch (err) {
      rec.state = "OPEN";
      rec.openedAt = now();
      rec.failures = [];
      throw err;
    } finally {
      rec.probeInFlight = false;
    }
  }

  // ── CLOSED · count failures in the rolling window ─────────────────
  try {
    return await fn();
  } catch (err) {
    const t2 = now();
    rec.failures.push(t2);
    prune(rec, t2, windowMs);
    if (rec.failures.length >= failureThreshold) {
      rec.state = "OPEN";
      rec.openedAt = t2;
    }
    throw err;
  }
}

/** Observability snapshot · safe to call from readers / dashboards. */
export interface BreakerSnapshot {
  readonly name: string;
  readonly state: CircuitState;
  readonly failuresInWindow: number;
  readonly openedAt: number | null;
  readonly probeInFlight: boolean;
}

export function getBreakerState(
  name: string,
  opts?: { readonly windowMs?: number; readonly now?: () => number },
): BreakerSnapshot {
  const rec = BREAKERS.get(name);
  if (!rec) {
    return {
      name,
      state: "CLOSED",
      failuresInWindow: 0,
      openedAt: null,
      probeInFlight: false,
    };
  }
  const windowMs = Math.max(1, opts?.windowMs ?? DEFAULT_WINDOW_MS);
  const now = opts?.now ?? Date.now;
  prune(rec, now(), windowMs);
  return {
    name,
    state: rec.state,
    failuresInWindow: rec.failures.length,
    openedAt: rec.openedAt,
    probeInFlight: rec.probeInFlight,
  };
}

/** TEST-ONLY · reset all breaker state. Production code must never call. */
export function _resetBreakersForTests(): void {
  BREAKERS.clear();
}
