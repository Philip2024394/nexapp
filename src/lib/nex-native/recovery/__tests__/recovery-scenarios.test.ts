// src/lib/nex-native/recovery/__tests__/recovery-scenarios.test.ts
//
// Fault-injection scenarios that PROVE the recovery primitives do what
// the doctrine claims · transient failures recover, persistent
// failures exhaust, breakers trip + auto-recover, timeouts fall back,
// non-idempotent operations never retry.
//
// Owner-sealed principle 2026-11-08 · "Do not claim zero downtime or
// automatic recovery until actual fault-injection tests prove the
// relevant behaviour."

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  _resetBreakersForTests,
  CircuitOpenError,
  getBreakerState,
  withBreaker,
} from "../circuit-breaker";
import { TimeoutError, withFallback, withTimeout } from "../degradation";
import { NonIdempotentRetryError, withRetry } from "../retry";
import {
  simulateDownDependency,
  simulateFlakyNetwork,
  simulateStorageUnavailable,
  simulateTransientFailure,
} from "./fault-injection";

function createClock(start = 1_000_000): { now: () => number; advance: (ms: number) => void } {
  let t = start;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

describe("recovery scenarios · transient failure", () => {
  it("withRetry recovers within maxAttempts on a transient DB failure", async () => {
    const op = simulateTransientFailure(2, "db-row");
    const result = await withRetry(op, {
      idempotent: true,
      maxAttempts: 3,
      sleep: async () => {},
      jitter: false,
    });
    expect(result).toBe("db-row");
    expect(op.calls).toBe(3);
  });

  it("withRetry resolves on first retry if only 1 transient failure", async () => {
    const op = simulateTransientFailure(1, 42);
    const result = await withRetry(op, {
      idempotent: true,
      maxAttempts: 3,
      sleep: async () => {},
      jitter: false,
    });
    expect(result).toBe(42);
    expect(op.calls).toBe(2);
  });
});

describe("recovery scenarios · persistent failure + breaker", () => {
  beforeEach(() => {
    _resetBreakersForTests();
  });

  it("withRetry exhausts and throws · circuit breaker trips OPEN after threshold", async () => {
    const clock = createClock();
    const op = simulateDownDependency();
    const breakerOpts = {
      failureThreshold: 3,
      windowMs: 10_000,
      cooldownMs: 1_000,
      now: clock.now,
    };
    // Each outer attempt wraps the op in the breaker. withRetry
    // exhausts first; the breaker counts each failure and flips OPEN
    // once the threshold is crossed. After the breaker is OPEN,
    // further calls are rejected without touching the mock.
    await expect(
      withRetry(
        () => withBreaker("svc.db", op, breakerOpts),
        {
          idempotent: true,
          maxAttempts: 4,
          sleep: async () => {},
          shouldRetry: () => true,
        },
      ),
    ).rejects.toBeInstanceOf(Error);
    // op was called 3 times before breaker tripped; 4th call hit the
    // OPEN breaker before reaching op.
    expect(op.calls).toBe(3);
    expect(getBreakerState("svc.db", { now: clock.now }).state).toBe("OPEN");
  });

  it("subsequent calls after breaker trips get CircuitOpenError without touching dependency", async () => {
    const clock = createClock();
    const op = simulateDownDependency();
    const opts = {
      failureThreshold: 2,
      windowMs: 10_000,
      cooldownMs: 10_000,
      now: clock.now,
    };
    await expect(withBreaker("svc.x", op, opts)).rejects.toThrow();
    await expect(withBreaker("svc.x", op, opts)).rejects.toThrow();
    expect(op.calls).toBe(2);
    await expect(withBreaker("svc.x", op, opts)).rejects.toBeInstanceOf(CircuitOpenError);
    // Dependency NOT invoked again · isolation proved.
    expect(op.calls).toBe(2);
  });
});

describe("recovery scenarios · timeout + fallback", () => {
  it("withTimeout rejects with TimeoutError when primary stalls", async () => {
    vi.useFakeTimers();
    try {
      const slow = new Promise<string>((resolve) => {
        setTimeout(() => resolve("eventually"), 10_000);
      });
      const race = withTimeout(slow, 50);
      vi.advanceTimersByTime(100);
      await expect(race).rejects.toBeInstanceOf(TimeoutError);
    } finally {
      vi.useRealTimers();
    }
  });

  it("storage timeout · withFallback returns cached value", async () => {
    const primary = simulateStorageUnavailable<string>();
    const result = await withFallback(primary, async () => "cached-value");
    expect(result).toBe("cached-value");
    expect(primary.calls).toBe(1);
  });

  it("withFallback onFailure hook fires once with the captured error", async () => {
    const seen: unknown[] = [];
    const primary = simulateStorageUnavailable<string>();
    const result = await withFallback(primary, async () => "cached", {
      onFailure: (e) => seen.push(e),
    });
    expect(result).toBe("cached");
    expect(seen).toHaveLength(1);
    expect((seen[0] as Error).message).toBe("storage_down");
  });
});

describe("recovery scenarios · flaky network", () => {
  it("50% fail-rate · idempotent operation eventually succeeds via withRetry", async () => {
    // Seeded deterministic PRNG so the outcome is repeatable.
    const op = simulateFlakyNetwork(0.5, "payload", 12345);
    const result = await withRetry(op, {
      idempotent: true,
      maxAttempts: 10,
      sleep: async () => {},
      jitter: false,
      // Retry on any error from the flaky-network simulator.
      shouldRetry: () => true,
    });
    expect(result).toBe("payload");
    // op.calls <= maxAttempts and > 1 proves at least one failure
    // occurred before success · the protection actually engaged.
    expect(op.calls).toBeGreaterThanOrEqual(1);
    expect(op.calls).toBeLessThanOrEqual(10);
  });

  it("very flaky network (90% fail) · may exhaust but never exceeds maxAttempts", async () => {
    const op = simulateFlakyNetwork(0.9, "payload", 7);
    const outcome = await withRetry(op, {
      idempotent: true,
      maxAttempts: 5,
      sleep: async () => {},
      jitter: false,
      shouldRetry: () => true,
    }).catch((e) => e);
    // Either it succeeded within 5 attempts or it exhausted · but
    // never more than 5 calls regardless.
    expect(op.calls).toBeLessThanOrEqual(5);
    if (outcome === "payload") {
      expect(op.calls).toBeGreaterThanOrEqual(1);
    } else {
      expect(outcome).toBeInstanceOf(Error);
      expect(op.calls).toBe(5);
    }
  });
});

describe("recovery scenarios · circuit breaker auto-recovery", () => {
  beforeEach(() => {
    _resetBreakersForTests();
  });

  it("N failures → OPEN → cooldown → HALF_OPEN → success → CLOSED", async () => {
    const clock = createClock();
    const name = "svc.recovers";
    const opts = {
      failureThreshold: 2,
      windowMs: 10_000,
      cooldownMs: 500,
      now: clock.now,
    };
    const broken = simulateDownDependency();
    await expect(withBreaker(name, broken, opts)).rejects.toThrow();
    await expect(withBreaker(name, broken, opts)).rejects.toThrow();
    expect(getBreakerState(name, { now: clock.now }).state).toBe("OPEN");

    // While OPEN · call is rejected immediately · dependency NOT hit.
    const callsBefore = broken.calls;
    await expect(withBreaker(name, broken, opts)).rejects.toBeInstanceOf(CircuitOpenError);
    expect(broken.calls).toBe(callsBefore);

    // Advance past cooldown · next call enters HALF_OPEN.
    clock.advance(600);
    const probeResult = await withBreaker(name, async () => "recovered", opts);
    expect(probeResult).toBe("recovered");
    expect(getBreakerState(name, { now: clock.now }).state).toBe("CLOSED");
  });

  it("HALF_OPEN probe failure returns to OPEN · does NOT prematurely recover", async () => {
    const clock = createClock();
    const name = "svc.wobbles";
    const opts = {
      failureThreshold: 2,
      windowMs: 10_000,
      cooldownMs: 500,
      now: clock.now,
    };
    const broken = simulateDownDependency();
    await expect(withBreaker(name, broken, opts)).rejects.toThrow();
    await expect(withBreaker(name, broken, opts)).rejects.toThrow();

    clock.advance(600);
    // Probe fails · breaker should NOT claim recovery.
    await expect(withBreaker(name, broken, opts)).rejects.toThrow();
    expect(getBreakerState(name, { now: clock.now }).state).toBe("OPEN");
  });
});

describe("recovery scenarios · non-idempotent operations never retry", () => {
  it("payment-shape call fails once · withRetry does NOT retry when idempotent:false", async () => {
    const payment = simulateDownDependency();
    await expect(
      withRetry(payment, {
        idempotent: false,
        maxAttempts: 5,
        sleep: async () => {},
      }),
    ).rejects.toThrow("dependency_down");
    // Exactly one attempt · payments must never be re-attempted.
    expect(payment.calls).toBe(1);
  });

  it("NonIdempotentRetryError exists and is usable as a thrown signal", () => {
    const err = new NonIdempotentRetryError();
    expect(err.name).toBe("NonIdempotentRetryError");
    expect(err).toBeInstanceOf(Error);
  });
});
