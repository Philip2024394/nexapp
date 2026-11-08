// src/lib/nex-native/recovery/__tests__/retry.test.ts

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  computeBackoff,
  defaultShouldRetry,
  NonIdempotentRetryError,
  withRetry,
} from "../retry";

function withStatus(status: number, message = "http error"): Error {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

function withCode(code: string, message = "network error"): Error {
  const err = new Error(message) as Error & { code: string };
  err.code = code;
  return err;
}

describe("withRetry · success paths", () => {
  it("returns the value on first-try success and does not sleep", async () => {
    const sleep = vi.fn(async () => {});
    const fn = vi.fn(async () => "ok");
    const result = await withRetry(fn, { idempotent: true, sleep });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("retries transient failures and resolves on the 3rd attempt", async () => {
    let calls = 0;
    const sleep = vi.fn(async () => {});
    const result = await withRetry(
      async () => {
        calls++;
        if (calls < 3) throw withCode("ECONNRESET");
        return "late ok";
      },
      { idempotent: true, maxAttempts: 3, sleep, jitter: false },
    );
    expect(result).toBe("late ok");
    expect(calls).toBe(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });
});

describe("withRetry · exhaustion and refusal", () => {
  it("throws the last error after exhausting attempts", async () => {
    const sleep = vi.fn(async () => {});
    let calls = 0;
    const attempt = vi.fn();
    await expect(
      withRetry(
        async () => {
          calls++;
          throw withCode("ETIMEDOUT", `attempt ${calls}`);
        },
        { idempotent: true, maxAttempts: 4, sleep, onAttempt: attempt },
      ),
    ).rejects.toMatchObject({ message: "attempt 4" });
    expect(calls).toBe(4);
    expect(attempt).toHaveBeenCalledTimes(4);
  });

  it("refuses to retry when idempotent is false · single shot, rethrows", async () => {
    const sleep = vi.fn(async () => {});
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls++;
          throw withCode("ECONNRESET");
        },
        { idempotent: false, sleep },
      ),
    ).rejects.toMatchObject({ code: "ECONNRESET" });
    expect(calls).toBe(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("non-idempotent fast path still honours onAttempt hook", async () => {
    const hook = vi.fn();
    await expect(
      withRetry(
        async () => {
          throw new Error("boom");
        },
        { idempotent: false, onAttempt: hook },
      ),
    ).rejects.toThrow("boom");
    expect(hook).toHaveBeenCalledTimes(1);
    expect(hook).toHaveBeenCalledWith(1, expect.any(Error));
  });
});

describe("withRetry · shouldRetry predicate", () => {
  it("honours a caller predicate and stops when it returns false", async () => {
    const sleep = vi.fn(async () => {});
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls++;
          throw new Error(`call-${calls}`);
        },
        {
          idempotent: true,
          maxAttempts: 5,
          sleep,
          shouldRetry: (_err, attempt) => attempt < 2, // stop after 2 attempts
        },
      ),
    ).rejects.toThrow("call-2");
    expect(calls).toBe(2);
  });

  it("does NOT retry on 4xx auth errors", async () => {
    for (const status of [401, 403, 404, 422]) {
      let calls = 0;
      await expect(
        withRetry(
          async () => {
            calls++;
            throw withStatus(status);
          },
          { idempotent: true, maxAttempts: 5, sleep: async () => {} },
        ),
      ).rejects.toMatchObject({ status });
      expect(calls, `status ${status} must be single-shot`).toBe(1);
    }
  });

  it("DOES retry on 429 / 502 / 503 / 504 via default predicate", async () => {
    for (const status of [429, 502, 503, 504]) {
      let calls = 0;
      await expect(
        withRetry(
          async () => {
            calls++;
            throw withStatus(status);
          },
          { idempotent: true, maxAttempts: 3, sleep: async () => {} },
        ),
      ).rejects.toMatchObject({ status });
      expect(calls, `status ${status} should retry`).toBe(3);
    }
  });

  it("does NOT retry on unknown-shape errors by default", async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls++;
          throw new Error("unknown shape");
        },
        { idempotent: true, maxAttempts: 4, sleep: async () => {} },
      ),
    ).rejects.toThrow("unknown shape");
    expect(calls).toBe(1);
  });
});

describe("withRetry · backoff", () => {
  it("respects baseDelay and cap (no jitter)", async () => {
    const delays: number[] = [];
    const sleep = async (ms: number) => {
      delays.push(ms);
    };
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls++;
          throw withCode("ECONNRESET");
        },
        {
          idempotent: true,
          maxAttempts: 5,
          baseDelayMs: 100,
          capMs: 500,
          jitter: false,
          sleep,
        },
      ),
    ).rejects.toBeInstanceOf(Error);
    // 4 sleeps (between 5 attempts) · 100, 200, 400, 500 (capped)
    expect(delays).toEqual([100, 200, 400, 500]);
  });

  it("computeBackoff · exponential schedule + cap", () => {
    expect(computeBackoff(1, 100, 5000, false)).toBe(100);
    expect(computeBackoff(2, 100, 5000, false)).toBe(200);
    expect(computeBackoff(3, 100, 5000, false)).toBe(400);
    expect(computeBackoff(10, 100, 5000, false)).toBe(5000);
  });

  it("computeBackoff · jitter lands inside ±20% band", () => {
    for (let i = 0; i < 100; i++) {
      const v = computeBackoff(3, 100, 5000, true);
      // attempt 3 · base 100 · exp = 400 · band = [320, 480]
      expect(v).toBeGreaterThanOrEqual(320);
      expect(v).toBeLessThanOrEqual(480);
    }
  });
});

describe("withRetry · clamping and defaults", () => {
  it("clamps maxAttempts below 1 to 1", async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls++;
          throw withCode("ECONNRESET");
        },
        { idempotent: true, maxAttempts: 0, sleep: async () => {} },
      ),
    ).rejects.toBeDefined();
    expect(calls).toBe(1);
  });

  it("clamps maxAttempts above 10 to 10", async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls++;
          throw withCode("ECONNRESET");
        },
        { idempotent: true, maxAttempts: 999, sleep: async () => {} },
      ),
    ).rejects.toBeDefined();
    expect(calls).toBe(10);
  });

  it("defaultShouldRetry returns false for 401/403/404/422", () => {
    expect(defaultShouldRetry(withStatus(401))).toBe(false);
    expect(defaultShouldRetry(withStatus(403))).toBe(false);
    expect(defaultShouldRetry(withStatus(404))).toBe(false);
    expect(defaultShouldRetry(withStatus(422))).toBe(false);
  });

  it("NonIdempotentRetryError is exported with recognisable name", () => {
    expect(new NonIdempotentRetryError().name).toBe("NonIdempotentRetryError");
  });
});
