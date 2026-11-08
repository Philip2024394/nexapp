// src/lib/nex-native/recovery/__tests__/idempotency.test.ts

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { _resetIdempotencyForTests, withIdempotencyKey } from "../idempotency";

function createClock(start = 1_000_000): { now: () => number; advance: (ms: number) => void } {
  let t = start;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

describe("withIdempotencyKey", () => {
  beforeEach(() => {
    _resetIdempotencyForTests();
  });

  it("returns cached result for duplicate call within TTL", async () => {
    const clock = createClock();
    let hits = 0;
    const fn = async () => {
      hits++;
      return `value-${hits}`;
    };
    const first = await withIdempotencyKey("k1", fn, {
      namespace: "ns",
      ttlMs: 1_000,
      now: clock.now,
    });
    clock.advance(500);
    const second = await withIdempotencyKey("k1", fn, {
      namespace: "ns",
      ttlMs: 1_000,
      now: clock.now,
    });
    expect(first).toBe("value-1");
    expect(second).toBe("value-1");
    expect(hits).toBe(1);
  });

  it("shares the same in-flight promise for concurrent duplicates", async () => {
    const clock = createClock();
    let hits = 0;
    let release!: (v: string) => void;
    const promise = new Promise<string>((r) => {
      release = r;
    });
    const fn = async () => {
      hits++;
      return promise;
    };
    const a = withIdempotencyKey("k2", fn, {
      namespace: "ns",
      ttlMs: 1_000,
      now: clock.now,
    });
    const b = withIdempotencyKey("k2", fn, {
      namespace: "ns",
      ttlMs: 1_000,
      now: clock.now,
    });
    release("shared");
    const [av, bv] = await Promise.all([a, b]);
    expect(av).toBe("shared");
    expect(bv).toBe("shared");
    expect(hits).toBe(1);
  });

  it("re-executes after TTL expires", async () => {
    const clock = createClock();
    let hits = 0;
    const fn = async () => {
      hits++;
      return hits;
    };
    const v1 = await withIdempotencyKey("k3", fn, {
      namespace: "ns",
      ttlMs: 100,
      now: clock.now,
    });
    clock.advance(200);
    const v2 = await withIdempotencyKey("k3", fn, {
      namespace: "ns",
      ttlMs: 100,
      now: clock.now,
    });
    expect(v1).toBe(1);
    expect(v2).toBe(2);
    expect(hits).toBe(2);
  });

  it("isolates keys by namespace", async () => {
    const clock = createClock();
    let a = 0;
    let b = 0;
    const r1 = await withIdempotencyKey(
      "same",
      async () => {
        a++;
        return `a-${a}`;
      },
      { namespace: "ns-a", ttlMs: 1_000, now: clock.now },
    );
    const r2 = await withIdempotencyKey(
      "same",
      async () => {
        b++;
        return `b-${b}`;
      },
      { namespace: "ns-b", ttlMs: 1_000, now: clock.now },
    );
    expect(r1).toBe("a-1");
    expect(r2).toBe("b-1");
    expect(a).toBe(1);
    expect(b).toBe(1);
  });

  it("does NOT cache failures · next call re-executes", async () => {
    const clock = createClock();
    let calls = 0;
    const fn = async () => {
      calls++;
      if (calls === 1) throw new Error("first failed");
      return "ok";
    };
    await expect(
      withIdempotencyKey("k4", fn, { namespace: "ns", ttlMs: 1_000, now: clock.now }),
    ).rejects.toThrow("first failed");
    const second = await withIdempotencyKey("k4", fn, {
      namespace: "ns",
      ttlMs: 1_000,
      now: clock.now,
    });
    expect(second).toBe("ok");
    expect(calls).toBe(2);
  });

  it("empty key bypasses the guard", async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      return "x";
    };
    await withIdempotencyKey("", fn, { namespace: "ns" });
    await withIdempotencyKey("", fn, { namespace: "ns" });
    expect(calls).toBe(2);
  });
});
