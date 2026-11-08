// src/lib/nex-native/recovery/__tests__/degradation.test.ts

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { TimeoutError, withFallback, withTimeout } from "../degradation";

describe("withTimeout", () => {
  it("resolves when the inner promise settles in time", async () => {
    const v = await withTimeout(Promise.resolve("ok"), 100);
    expect(v).toBe("ok");
  });

  it("rejects with TimeoutError when the inner is slower than the budget", async () => {
    const slow = new Promise<string>((resolve) => {
      setTimeout(() => resolve("too late"), 50);
    });
    await expect(withTimeout(slow, 5)).rejects.toBeInstanceOf(TimeoutError);
  });

  it("rejects immediately for a 0ms budget", async () => {
    await expect(withTimeout(Promise.resolve("x"), 0)).rejects.toBeInstanceOf(
      TimeoutError,
    );
  });

  it("propagates inner rejection unchanged", async () => {
    const boom = Promise.reject(new Error("boom"));
    await expect(withTimeout(boom, 100)).rejects.toThrow("boom");
  });
});

describe("withFallback", () => {
  it("returns the primary value on success", async () => {
    const onFailure = vi.fn();
    const v = await withFallback(
      async () => "primary",
      async () => "fallback",
      { onFailure },
    );
    expect(v).toBe("primary");
    expect(onFailure).not.toHaveBeenCalled();
  });

  it("returns the fallback on primary failure", async () => {
    const onFailure = vi.fn();
    const v = await withFallback(
      async () => {
        throw new Error("primary-boom");
      },
      async () => "fallback",
      { onFailure },
    );
    expect(v).toBe("fallback");
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledWith(expect.any(Error));
  });

  it("returns the fallback on primary timeout", async () => {
    const slow = () =>
      new Promise<string>((resolve) => {
        setTimeout(() => resolve("too late"), 50);
      });
    const v = await withFallback(slow, async () => "fallback", { timeoutMs: 5 });
    expect(v).toBe("fallback");
  });

  it("accepts a synchronous fallback value", async () => {
    const v = await withFallback<string>(
      async () => {
        throw new Error("x");
      },
      () => "sync-fallback",
    );
    expect(v).toBe("sync-fallback");
  });

  it("re-throws when shouldFallback returns false", async () => {
    await expect(
      withFallback(
        async () => {
          throw new Error("original");
        },
        async () => "fallback",
        { shouldFallback: () => false },
      ),
    ).rejects.toThrow("original");
  });

  it("re-throws if fallback itself throws", async () => {
    await expect(
      withFallback(
        async () => {
          throw new Error("primary");
        },
        async () => {
          throw new Error("fallback-also-broken");
        },
      ),
    ).rejects.toThrow("fallback-also-broken");
  });
});
