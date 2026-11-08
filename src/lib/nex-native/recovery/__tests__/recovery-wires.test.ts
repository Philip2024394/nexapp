// src/lib/nex-native/recovery/__tests__/recovery-wires.test.ts
//
// NEX Security & Recovery · integration-shape tests for the recovery
// wires added to real callsites. Owner-authorised 2026-11-08.
// -----------------------------------------------------------------------------
// These tests exercise the primitives against call-shapes that mirror
// the production wires (Supabase auth.admin.getUserById,
// storage.download, auth admin circuit-breaker, bounded fetch timeout,
// and the non-idempotent refusal invariant). They do NOT boot the
// Next route handlers · the route-level behaviour is covered in
// assert-routes.test.ts / enroll-routes.test.ts. Instead they prove
// that the primitives behave exactly how the wires rely on them to
// behave:
//
//   · auth.admin.getUserById · network blip on attempts 1-2, success
//     on attempt 3 · the wrapped read returns the final data, with 2
//     internal retries + 1 breaker call (breaker records zero failure).
//   · auth.admin.getUserById · 3 sustained ECONNRESET errors · the
//     wrapped read throws after attempt 3 · 1 breaker failure recorded.
//   · storage.download · transient 503 then success · wrapped read
//     returns the final blob with 1 retry.
//   · circuit breaker · 5 sustained failures trip the breaker · the
//     6th call rejects fast with CircuitOpenError (fn NOT invoked).
//   · non-idempotent operation · withRetry with { idempotent: false }
//     runs once and rethrows · explicit guard against accidental wrap
//     of a mutation.
//   · withTimeout · long-running fetch stub rejects with TimeoutError
//     when the deadline elapses before the fetch resolves.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { withRetry } from "../retry";
import {
  _resetBreakersForTests,
  CircuitOpenError,
  getBreakerState,
  withBreaker,
} from "../circuit-breaker";
import { TimeoutError, withTimeout } from "../degradation";

/** Emulate the gotrue-admin shape: { data, error } · never throws
 *  natively · the real wrapper synthesises an Error from error.status
 *  so withRetry's defaultShouldRetry can judge transient-ness. */
interface AdminResult<T> {
  data: T | null;
  error: null | { message: string; status?: number; code?: string };
}

function statusError(status: number, message = "upstream error"): Error {
  const e = new Error(message) as Error & { status: number };
  e.status = status;
  return e;
}

function codeError(code: string, message = "network error"): Error {
  const e = new Error(message) as Error & { code: string };
  e.code = code;
  return e;
}

/** Thin re-implementation of the wrapper used in
 *  assert-finish/route.ts · keeps behaviour in one place under test. */
async function readAuthUser(
  getUserById: (id: string) => Promise<AdminResult<{ user: { email: string } | null }>>,
  id: string,
): Promise<AdminResult<{ user: { email: string } | null }>> {
  return withBreaker(
    "supabase_auth_admin",
    () =>
      withRetry(
        async () => {
          const result = await getUserById(id);
          if (result.error) {
            const synthetic = new Error(result.error.message) as Error & {
              status?: number;
              code?: string;
            };
            if (typeof result.error.status === "number") {
              synthetic.status = result.error.status;
            }
            if (typeof result.error.code === "string") {
              synthetic.code = result.error.code;
            }
            throw synthetic;
          }
          return result;
        },
        {
          idempotent: true,
          maxAttempts: 3,
          sleep: async () => {},
          jitter: false,
        },
      ),
    { failureThreshold: 5, windowMs: 30_000, cooldownMs: 60_000 },
  );
}

/** Supabase storage shape: Promise<{ data: Blob|null, error: Error|null }>. */
async function readStoredObject(
  download: (path: string) => Promise<{ data: Uint8Array | null; error: null | { message: string; status?: number } }>,
  path: string,
): Promise<Uint8Array> {
  const result = await withRetry(
    async () => {
      const r = await download(path);
      if (r.error) {
        const e = new Error(r.error.message) as Error & { status?: number };
        if (typeof r.error.status === "number") e.status = r.error.status;
        throw e;
      }
      if (!r.data) throw new Error("storage.download returned no data");
      return r.data;
    },
    {
      idempotent: true,
      maxAttempts: 3,
      sleep: async () => {},
      jitter: false,
    },
  );
  return result;
}

describe("recovery wires · auth.admin.getUserById", () => {
  beforeEach(() => {
    _resetBreakersForTests();
  });

  it("succeeds on the 3rd attempt after two transient network blips", async () => {
    let calls = 0;
    const getUserById = vi.fn(async (_id: string): Promise<AdminResult<{ user: { email: string } | null }>> => {
      calls++;
      if (calls < 3) {
        return { data: null, error: { message: "network blip", code: "ECONNRESET" } };
      }
      return { data: { user: { email: "ok@example.com" } }, error: null };
    });

    const result = await readAuthUser(getUserById, "user-id");
    expect(result.data?.user?.email).toBe("ok@example.com");
    expect(getUserById).toHaveBeenCalledTimes(3);
    // One successful breaker call · zero failures recorded.
    const snap = getBreakerState("supabase_auth_admin");
    expect(snap.state).toBe("CLOSED");
    expect(snap.failuresInWindow).toBe(0);
  });

  it("exhausts and propagates after 3 sustained ECONNRESET errors", async () => {
    let calls = 0;
    const getUserById = vi.fn(async (_id: string): Promise<AdminResult<{ user: { email: string } | null }>> => {
      calls++;
      return { data: null, error: { message: `blip-${calls}`, code: "ECONNRESET" } };
    });

    await expect(readAuthUser(getUserById, "user-id")).rejects.toMatchObject({
      code: "ECONNRESET",
      message: "blip-3",
    });
    expect(getUserById).toHaveBeenCalledTimes(3);
    // One breaker failure recorded (the full retry burst counts as one
    // upstream incident).
    const snap = getBreakerState("supabase_auth_admin");
    expect(snap.state).toBe("CLOSED"); // threshold is 5 · not yet open
    expect(snap.failuresInWindow).toBe(1);
  });
});

describe("recovery wires · storage.download retry", () => {
  it("succeeds on the 2nd attempt after one 503 upstream blip", async () => {
    let calls = 0;
    const download = vi.fn(async (_path: string) => {
      calls++;
      if (calls === 1) {
        return { data: null, error: { message: "service unavailable", status: 503 } };
      }
      return { data: new Uint8Array([1, 2, 3, 4]), error: null };
    });

    const bytes = await readStoredObject(download, "bucket/key.bin");
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(Array.from(bytes)).toEqual([1, 2, 3, 4]);
    expect(download).toHaveBeenCalledTimes(2);
  });
});

describe("recovery wires · circuit breaker on supabase_auth_admin", () => {
  beforeEach(() => {
    _resetBreakersForTests();
  });

  it("trips after 5 sustained failures and rejects next call fast", async () => {
    const fn = vi.fn(async () => {
      throw codeError("ECONNRESET", "upstream down");
    });

    for (let i = 0; i < 5; i++) {
      await expect(
        withBreaker("supabase_auth_admin", fn, {
          failureThreshold: 5,
          windowMs: 30_000,
          cooldownMs: 60_000,
        }),
      ).rejects.toThrow("upstream down");
    }
    expect(fn).toHaveBeenCalledTimes(5);

    // 6th call must be rejected fast · fn MUST NOT be invoked.
    await expect(
      withBreaker("supabase_auth_admin", fn, {
        failureThreshold: 5,
        windowMs: 30_000,
        cooldownMs: 60_000,
      }),
    ).rejects.toBeInstanceOf(CircuitOpenError);
    expect(fn).toHaveBeenCalledTimes(5);

    const snap = getBreakerState("supabase_auth_admin");
    expect(snap.state).toBe("OPEN");
  });
});

describe("recovery wires · non-idempotent refusal", () => {
  it("withRetry({idempotent:false}) runs once and rethrows · no retries", async () => {
    let calls = 0;
    // Simulates the shape of a non-idempotent mutation (e.g. message
    // send, createUser, payment). Even though the thrown error looks
    // retry-safe (ECONNRESET), withRetry MUST NOT retry.
    await expect(
      withRetry(
        async () => {
          calls++;
          throw codeError("ECONNRESET", "non-idempotent mutation failed");
        },
        {
          idempotent: false,
          maxAttempts: 5,
          sleep: async () => {},
          jitter: false,
        },
      ),
    ).rejects.toMatchObject({ code: "ECONNRESET" });
    expect(calls).toBe(1);
  });
});

describe("recovery wires · withTimeout on external fetch", () => {
  it("rejects with TimeoutError when the fetch stub exceeds the budget", async () => {
    // Stub a long-running fetch that resolves in 1s · deadline is 20ms.
    const stuckFetch = new Promise<Response>((resolve) => {
      setTimeout(() => resolve(new Response("too late")), 1_000);
    });
    await expect(withTimeout(stuckFetch, 20)).rejects.toBeInstanceOf(
      TimeoutError,
    );
  });

  it("resolves when the fetch stub beats the deadline", async () => {
    const fastFetch = Promise.resolve(new Response("fast"));
    const r = await withTimeout(fastFetch, 50);
    expect(r).toBeInstanceOf(Response);
  });
});
