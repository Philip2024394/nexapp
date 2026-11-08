// src/lib/nex-native/recovery/__tests__/circuit-breaker.test.ts

import { beforeEach, describe, expect, it } from "vitest";
import { vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  _resetBreakersForTests,
  CircuitOpenError,
  getBreakerState,
  withBreaker,
} from "../circuit-breaker";

/** Stepped clock so cooldown transitions are deterministic. */
function createClock(start = 1_000_000): { now: () => number; advance: (ms: number) => void } {
  let t = start;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

describe("circuit breaker · CLOSED → OPEN", () => {
  beforeEach(() => {
    _resetBreakersForTests();
  });

  it("stays CLOSED below the threshold", async () => {
    const clock = createClock();
    const name = "svc.a";
    for (let i = 0; i < 2; i++) {
      await expect(
        withBreaker(
          name,
          async () => {
            throw new Error("boom");
          },
          { failureThreshold: 3, windowMs: 10_000, cooldownMs: 1_000, now: clock.now },
        ),
      ).rejects.toThrow("boom");
    }
    const snap = getBreakerState(name, { windowMs: 10_000, now: clock.now });
    expect(snap.state).toBe("CLOSED");
    expect(snap.failuresInWindow).toBe(2);
  });

  it("trips to OPEN at the threshold and rejects subsequent calls immediately", async () => {
    const clock = createClock();
    const name = "svc.b";
    let invocations = 0;
    const fn = async () => {
      invocations++;
      throw new Error("boom");
    };
    for (let i = 0; i < 3; i++) {
      await expect(
        withBreaker(name, fn, {
          failureThreshold: 3,
          windowMs: 10_000,
          cooldownMs: 1_000,
          now: clock.now,
        }),
      ).rejects.toThrow("boom");
    }
    expect(invocations).toBe(3);
    // 4th call · breaker is OPEN · fn MUST NOT be invoked.
    await expect(
      withBreaker(name, fn, {
        failureThreshold: 3,
        windowMs: 10_000,
        cooldownMs: 1_000,
        now: clock.now,
      }),
    ).rejects.toBeInstanceOf(CircuitOpenError);
    expect(invocations).toBe(3);
  });

  it("drops stale failures outside the rolling window", async () => {
    const clock = createClock();
    const name = "svc.c";
    const fn = async () => {
      throw new Error("boom");
    };
    const opts = {
      failureThreshold: 3,
      windowMs: 5_000,
      cooldownMs: 10_000,
      now: clock.now,
    };
    await expect(withBreaker(name, fn, opts)).rejects.toBeInstanceOf(Error);
    clock.advance(6_000); // outside the window
    await expect(withBreaker(name, fn, opts)).rejects.toBeInstanceOf(Error);
    await expect(withBreaker(name, fn, opts)).rejects.toBeInstanceOf(Error);
    // Only 2 recent failures inside the 5s window · still CLOSED.
    const snap = getBreakerState(name, { windowMs: 5_000, now: clock.now });
    expect(snap.state).toBe("CLOSED");
    expect(snap.failuresInWindow).toBe(2);
  });
});

describe("circuit breaker · OPEN → HALF_OPEN → CLOSED/OPEN", () => {
  beforeEach(() => {
    _resetBreakersForTests();
  });

  async function openBreaker(name: string, clock: ReturnType<typeof createClock>) {
    const fn = async () => {
      throw new Error("boom");
    };
    const opts = {
      failureThreshold: 2,
      windowMs: 10_000,
      cooldownMs: 500,
      now: clock.now,
    };
    await expect(withBreaker(name, fn, opts)).rejects.toThrow("boom");
    await expect(withBreaker(name, fn, opts)).rejects.toThrow("boom");
  }

  it("rejects while within cooldown, probes once at HALF_OPEN", async () => {
    const clock = createClock();
    const name = "svc.d";
    await openBreaker(name, clock);
    const noop = async () => "should not run";
    await expect(
      withBreaker(name, noop, {
        failureThreshold: 2,
        windowMs: 10_000,
        cooldownMs: 500,
        now: clock.now,
      }),
    ).rejects.toBeInstanceOf(CircuitOpenError);

    clock.advance(501); // cooldown elapsed
    // HALF_OPEN probe succeeds · returns to CLOSED.
    const probe = await withBreaker(
      name,
      async () => "probe-ok",
      {
        failureThreshold: 2,
        windowMs: 10_000,
        cooldownMs: 500,
        now: clock.now,
      },
    );
    expect(probe).toBe("probe-ok");
    expect(getBreakerState(name, { now: clock.now }).state).toBe("CLOSED");
  });

  it("probe failure drops back to OPEN with fresh cooldown", async () => {
    const clock = createClock();
    const name = "svc.e";
    await openBreaker(name, clock);
    clock.advance(501);
    await expect(
      withBreaker(
        name,
        async () => {
          throw new Error("probe-fail");
        },
        {
          failureThreshold: 2,
          windowMs: 10_000,
          cooldownMs: 500,
          now: clock.now,
        },
      ),
    ).rejects.toThrow("probe-fail");
    const snap = getBreakerState(name, { now: clock.now });
    expect(snap.state).toBe("OPEN");
    expect(snap.openedAt).not.toBeNull();
  });

  it("concurrent probes at HALF_OPEN · exactly one runs, others see CircuitOpenError", async () => {
    const clock = createClock();
    const name = "svc.f";
    await openBreaker(name, clock);
    clock.advance(501);

    let released!: () => void;
    const gate = new Promise<void>((r) => {
      released = r;
    });
    const slow = async () => {
      await gate;
      return "slow-ok";
    };
    const opts = {
      failureThreshold: 2,
      windowMs: 10_000,
      cooldownMs: 500,
      now: clock.now,
    };
    const first = withBreaker(name, slow, opts);
    // Give the first the microtask to flip probeInFlight.
    await Promise.resolve();
    const second = withBreaker(name, slow, opts);
    const secondResult = await second.catch((e) => e);
    expect(secondResult).toBeInstanceOf(CircuitOpenError);
    released();
    await expect(first).resolves.toBe("slow-ok");
  });
});

describe("circuit breaker · named isolation", () => {
  beforeEach(() => {
    _resetBreakersForTests();
  });

  it("different names maintain independent state", async () => {
    const clock = createClock();
    const trip = async () => {
      throw new Error("boom");
    };
    const opts = {
      failureThreshold: 2,
      windowMs: 10_000,
      cooldownMs: 1_000,
      now: clock.now,
    };
    await expect(withBreaker("alpha", trip, opts)).rejects.toThrow();
    await expect(withBreaker("alpha", trip, opts)).rejects.toThrow();
    // alpha is now OPEN · beta is still CLOSED and allowed to run.
    expect(getBreakerState("alpha", { now: clock.now }).state).toBe("OPEN");
    const ok = await withBreaker("beta", async () => "beta-ok", opts);
    expect(ok).toBe("beta-ok");
  });

  it("getBreakerState returns CLOSED snapshot for unknown names", () => {
    const snap = getBreakerState("never-seen");
    expect(snap.state).toBe("CLOSED");
    expect(snap.failuresInWindow).toBe(0);
    expect(snap.openedAt).toBeNull();
  });
});
