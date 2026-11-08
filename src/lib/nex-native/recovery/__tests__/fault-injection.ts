// src/lib/nex-native/recovery/__tests__/fault-injection.ts
//
// NEX Security & Recovery · fault-injection harness.
// Added 2026-11-08.
// -----------------------------------------------------------------------------
// Pure in-memory helpers for recovery / isolation / attack-simulation
// tests. Every helper returns a mock async function suitable for
// wrapping with withRetry / withBreaker / withFallback / withTimeout.
//
// Rules
//   · NO REAL NETWORK · everything is deterministic and in-process.
//   · Randomness uses a seeded PRNG so suites are repeatable.
//   · Each builder returns a function that also exposes a `.calls`
//     counter so tests can assert attempt counts.
//
// Owner-sealed note 2026-11-08 · "Do not claim zero downtime or
// automatic recovery until actual fault-injection tests prove the
// relevant behaviour." · this harness exists to back that claim.

export interface MockFn<T> {
  (): Promise<T>;
  /** Attempts made against this mock. */
  calls: number;
}

/** Seeded deterministic PRNG · xorshift32. Repeats across runs so a
 *  failing test can be reproduced without environment variance. */
export class SeededRandom {
  private state: number;
  constructor(seed: number) {
    // Avoid the zero fixed-point.
    const s = Math.trunc(seed) | 0;
    this.state = s === 0 ? 0x1a2b3c4d : s;
  }
  /** Returns a number in [0, 1). */
  next(): number {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x | 0;
    // Map 32-bit int to [0, 1).
    return ((x >>> 0) / 0x1_0000_0000);
  }
}

/**
 * Fails N times (throwing `Error("transient_failure")`), then resolves
 * with `then` on attempt N+1 and beyond.
 *
 *     const op = simulateTransientFailure(2, "ok");
 *     await withRetry(op, { idempotent: true, maxAttempts: 3,
 *                           shouldRetry: () => true, sleep: async () => {} });
 *     // resolves to "ok" on attempt 3; op.calls === 3
 */
export function simulateTransientFailure<T>(
  times: number,
  then: T,
  errorMessage = "transient_failure",
): MockFn<T> {
  const limit = Math.max(0, Math.trunc(times));
  const fn = (async () => {
    fn.calls += 1;
    if (fn.calls <= limit) {
      const err = new Error(errorMessage) as Error & { code: string };
      err.code = "ECONNRESET";
      throw err;
    }
    return then;
  }) as MockFn<T>;
  fn.calls = 0;
  return fn;
}

/**
 * Always throws · optionally after an artificial latency. Simulates a
 * fully-down dependency (database, storage, upstream API).
 *
 *     const op = simulateDownDependency();
 *     await expect(op()).rejects.toThrow("dependency_down");
 */
export function simulateDownDependency<T = never>(
  latencyMs = 0,
  errorMessage = "dependency_down",
): MockFn<T> {
  const fn = (async (): Promise<T> => {
    fn.calls += 1;
    if (latencyMs > 0) {
      await new Promise<void>((r) => setTimeout(r, latencyMs));
    }
    const err = new Error(errorMessage) as Error & { code: string };
    err.code = "ECONNREFUSED";
    throw err;
  }) as MockFn<T>;
  fn.calls = 0;
  return fn;
}

/**
 * Throws with probability `failRate ∈ [0, 1]`; otherwise resolves with
 * `ok`. Uses a seeded PRNG so repeated runs behave identically.
 */
export function simulateFlakyNetwork<T>(
  failRate: number,
  ok: T,
  seed = 0xdeadbeef,
  errorMessage = "flaky_network",
): MockFn<T> {
  const rate = Math.max(0, Math.min(1, failRate));
  const rng = new SeededRandom(seed);
  const fn = (async () => {
    fn.calls += 1;
    if (rng.next() < rate) {
      const err = new Error(errorMessage) as Error & { code: string };
      err.code = "ETIMEDOUT";
      throw err;
    }
    return ok;
  }) as MockFn<T>;
  fn.calls = 0;
  return fn;
}

export class AuthAttackError extends Error {
  readonly status = 401;
  constructor(message = "invalid_credentials") {
    super(message);
    this.name = "AuthAttackError";
  }
}

/**
 * Simulates `attempts` consecutive failed auth attempts. If
 * `successAt` is provided, attempt number `successAt` (1-indexed)
 * succeeds; subsequent attempts also succeed.
 */
export function simulateAuthAttack(
  attempts: number,
  successAt?: number,
): MockFn<{ ok: true }> {
  const total = Math.max(0, Math.trunc(attempts));
  const fn = (async () => {
    fn.calls += 1;
    if (successAt !== undefined && fn.calls >= successAt) {
      return { ok: true as const };
    }
    if (fn.calls <= total) {
      throw new AuthAttackError();
    }
    return { ok: true as const };
  }) as MockFn<{ ok: true }>;
  fn.calls = 0;
  return fn;
}

export class StorageUnavailableError extends Error {
  readonly code = "storage_down";
  constructor() {
    super("storage_down");
    this.name = "StorageUnavailableError";
  }
}

/** Always rejects with a storage-down error. */
export function simulateStorageUnavailable<T = never>(): MockFn<T> {
  const fn = (async (): Promise<T> => {
    fn.calls += 1;
    throw new StorageUnavailableError();
  }) as MockFn<T>;
  fn.calls = 0;
  return fn;
}

// ─── Section + health helpers (used by isolation + outage tests) ────

export type SectionName = "chat" | "shops" | "feed" | "live" | "directory";
export type CountryCode = "ireland" | "indonesia" | "worldwide";

export interface MockProbeResult {
  readonly name: string;
  readonly ok: boolean;
  readonly status: "ok" | "degraded" | "down" | "unknown";
  readonly latency_ms: number;
}

/** Build a fake section probe set where `downSections` are DOWN and
 *  the rest are OK. Mirrors the shape returned by the real
 *  `probeAllCore` output minus the server-only dependency. */
export function buildSectionProbes(
  downSections: readonly SectionName[],
): readonly MockProbeResult[] {
  const all: readonly SectionName[] = ["chat", "shops", "feed", "live", "directory"];
  return all.map((name) => {
    const down = downSections.includes(name);
    return {
      name,
      ok: !down,
      status: down ? "down" : "ok",
      latency_ms: down ? 2_000 : 42,
    };
  });
}

/** Build per-country probe sets so isolation tests can assert that a
 *  failure in Ireland does not report Indonesia or Worldwide down. */
export function buildCountryProbes(
  downCountries: readonly CountryCode[],
): Readonly<Record<CountryCode, MockProbeResult>> {
  const build = (c: CountryCode): MockProbeResult => {
    const down = downCountries.includes(c);
    return {
      name: `country:${c}`,
      ok: !down,
      status: down ? "down" : "ok",
      latency_ms: down ? 2_000 : 42,
    };
  };
  return {
    ireland: build("ireland"),
    indonesia: build("indonesia"),
    worldwide: build("worldwide"),
  };
}
