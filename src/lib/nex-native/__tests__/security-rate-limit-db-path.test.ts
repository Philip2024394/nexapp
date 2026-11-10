// src/lib/nex-native/__tests__/security-rate-limit-db-path.test.ts
//
// NEX Security Programme · Phase 0 · Item 4 · DB-path detection via
// information_schema. Owner directive 2026-11-08.
// -----------------------------------------------------------------------------
// Covers the `detectRateLimitTable()` + `_resetRateLimitDetectionForTests()`
// seam added so the service can autodetect whether migration 290 has
// been applied:
//
//   · Detection returns FALSE (information_schema has no matching
//     columns) → the service degrades to the process-local in-memory
//     Map limiter. Observable via mock supabase: the DB `.from(...)`
//     read/write path MUST NOT be hit for the counter.
//   · Detection returns TRUE (information_schema reports the four
//     migration-290 columns) → the DB path IS taken. Observable via
//     mock supabase: the counter read + upsert ARE invoked.
//   · DB path throws SecurityRateLimitError when the recorded count
//     is already at or above policy.maxPerWindow.
//   · DB path resolves silently when the recorded count is under the
//     cap (normal happy-path).
//   · DB insert (observability write) failure does NOT block the
//     request · fail-open on observability writes · the throttle
//     decision itself remains fail-closed per policy.
//
// All scenarios mock nexSupabaseAdmin with a fluent chain so we can
// observe which path the service takes without touching Supabase.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Hoisted mutable state · each test configures the mock's behaviour
// before importing the module-under-test.
const STATE = vi.hoisted(() => ({
  // information_schema.columns probe · simulate migration-290 state.
  //   present: 4 column rows (all migration-290 columns)
  //   absent:  empty array
  //   error:   { data: null, error: { message } }
  infoSchema: {
    data: [] as Array<{ column_name: string }> | null,
    error: null as { message: string } | null,
  },
  // Direct `.from("nex_security_rate_limit").select("key").limit(0)`
  // probe · the fallback detection path. Default → return an error so
  // the service correctly degrades when the info_schema probe is
  // negative. Tests that want the DB path flip this.
  tableProbe: {
    error: {
      message: "relation nex_security_rate_limit does not exist",
    } as { message: string } | null,
  },
  // Counter read via .eq().eq().eq().maybeSingle(). Default empty.
  counterRead: {
    data: null as { count: number } | null,
    error: null as { message: string } | null,
  },
  // Counter write via .upsert(). Default success.
  counterWrite: { error: null as { message: string } | null },
  // RPC path · default "function does not exist" so the service
  // falls through to the 2-phase table-based path.
  rpc: {
    data: null as unknown,
    error: {
      message:
        "function nex_security_rate_limit_claim(text, text, integer, integer) does not exist",
      code: "42883",
    } as { message: string; code?: string } | null,
  },
  // Observability · which paths were exercised.
  observedFromCalls: [] as string[],
  observedRpcCalls: [] as string[],
  observedCounterReads: 0,
  observedCounterWrites: 0,
}));

vi.mock("../supabase-admin", () => ({
  nexSupabaseAdmin: {
    rpc(fn: string, _args: Record<string, unknown>) {
      STATE.observedRpcCalls.push(fn);
      return Promise.resolve({
        data: STATE.rpc.data,
        error: STATE.rpc.error,
      });
    },
    from(table: string) {
      STATE.observedFromCalls.push(table);
      if (table === "information_schema.columns") {
        // Fluent chain · .select(col).eq(c, v).eq(c, v).in(col, arr)
        // Returns a thenable at the end · Supabase's builder awaits.
        return {
          select(_col: string) {
            return {
              eq(_c: string, _v: unknown) {
                return {
                  eq(_c2: string, _v2: unknown) {
                    return {
                      in(_col2: string, _arr: unknown[]) {
                        return Promise.resolve({
                          data: STATE.infoSchema.data,
                          error: STATE.infoSchema.error,
                        });
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }
      // table === "nex_security_rate_limit"
      return {
        select(_col: string) {
          return {
            // Probe · .select("key").limit(0)
            limit(_n: number) {
              return Promise.resolve({ error: STATE.tableProbe.error });
            },
            // Counter read · .eq().eq().eq().maybeSingle()
            eq(_c: string, _v: unknown) {
              return {
                eq(_c2: string, _v2: unknown) {
                  return {
                    eq(_c3: string, _v3: unknown) {
                      return {
                        maybeSingle() {
                          STATE.observedCounterReads++;
                          return Promise.resolve({
                            data: STATE.counterRead.data,
                            error: STATE.counterRead.error,
                          });
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        },
        upsert(_row: unknown, _opts: unknown) {
          STATE.observedCounterWrites++;
          return Promise.resolve({ error: STATE.counterWrite.error });
        },
      };
    },
  },
}));

import {
  _localFallbackSizeForTests,
  _resetAccountCreateFailureStateForTests,
  _resetRateLimitDetectionForTests,
  _resetSecurityRateLimitLocalForTests,
  _resetSecurityRateLimitProbeCacheForTests,
  accountRateLimitKey,
  isSecurityRateLimitError,
  recordIfAllowed,
  SECURITY_RATE_LIMITS,
  SecurityRateLimitError,
} from "../security-rate-limit";

function resetAllCaches(): void {
  _resetSecurityRateLimitProbeCacheForTests();
  _resetRateLimitDetectionForTests();
  _resetSecurityRateLimitLocalForTests();
  _resetAccountCreateFailureStateForTests();
}

function resetMockState(): void {
  STATE.observedFromCalls.length = 0;
  STATE.observedRpcCalls.length = 0;
  STATE.observedCounterReads = 0;
  STATE.observedCounterWrites = 0;
  // Default · information_schema says the table is absent.
  STATE.infoSchema = { data: [], error: null };
  // Default · the direct-table probe also reports absent.
  STATE.tableProbe = {
    error: { message: "relation nex_security_rate_limit does not exist" },
  };
  STATE.counterRead = { data: null, error: null };
  STATE.counterWrite = { error: null };
  STATE.rpc = {
    data: null,
    error: {
      message:
        "function nex_security_rate_limit_claim(text, text, integer, integer) does not exist",
      code: "42883",
    },
  };
}

function markTablePresent(): void {
  STATE.infoSchema = {
    data: [
      { column_name: "key" },
      { column_name: "action" },
      { column_name: "window_started_at" },
      { column_name: "count" },
    ],
    error: null,
  };
  // Keep the direct-table probe also healthy · belt + braces.
  STATE.tableProbe = { error: null };
}

describe("detectRateLimitTable · autodetection via information_schema", () => {
  beforeEach(() => {
    resetAllCaches();
    resetMockState();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("detection reports ABSENT → service uses in-memory path · no counter read/write", async () => {
    // Default state · information_schema returns [] AND the direct
    // probe returns an error. The service MUST take the in-memory path.
    const key = accountRateLimitKey("00000000-0000-0000-0000-000000000a01");
    await recordIfAllowed(key, "password_change");
    // The counter table was NEVER touched · no reads, no writes.
    expect(STATE.observedCounterReads).toBe(0);
    expect(STATE.observedCounterWrites).toBe(0);
    // In-memory fallback registered this call.
    expect(_localFallbackSizeForTests()).toBeGreaterThan(0);
  });

  it("detection reports PRESENT → service uses DB path · counter read is invoked", async () => {
    markTablePresent();
    const key = accountRateLimitKey("00000000-0000-0000-0000-000000000a02");
    await recordIfAllowed(key, "password_change");
    // DB counter read was invoked.
    expect(STATE.observedCounterReads).toBeGreaterThanOrEqual(1);
    // DB write was invoked (the service records the attempt).
    expect(STATE.observedCounterWrites).toBeGreaterThanOrEqual(1);
    // In-memory fallback did NOT register this call.
    expect(_localFallbackSizeForTests()).toBe(0);
  });

  it("DB path throws SecurityRateLimitError when count is already at the cap", async () => {
    markTablePresent();
    const policy = SECURITY_RATE_LIMITS.password_change;
    // Simulate a pre-existing row at the cap.
    STATE.counterRead = {
      data: { count: policy.maxPerWindow },
      error: null,
    };
    const key = accountRateLimitKey("00000000-0000-0000-0000-000000000a03");
    try {
      await recordIfAllowed(key, "password_change");
      throw new Error("expected throw");
    } catch (err) {
      expect(isSecurityRateLimitError(err)).toBe(true);
      const e = err as SecurityRateLimitError;
      expect(e.action).toBe("password_change");
      expect(e.retryAfterSeconds).toBeGreaterThan(0);
    }
    // When the cap is hit, the service MUST NOT write a new counter
    // row · only the read happens.
    expect(STATE.observedCounterReads).toBeGreaterThanOrEqual(1);
    expect(STATE.observedCounterWrites).toBe(0);
  });

  it("DB path allows the call when count is under the cap", async () => {
    markTablePresent();
    const policy = SECURITY_RATE_LIMITS.password_change;
    // Simulate an existing row strictly below the cap.
    STATE.counterRead = {
      data: { count: Math.max(0, policy.maxPerWindow - 1) },
      error: null,
    };
    const key = accountRateLimitKey("00000000-0000-0000-0000-000000000a04");
    await expect(
      recordIfAllowed(key, "password_change"),
    ).resolves.toBeUndefined();
    expect(STATE.observedCounterReads).toBeGreaterThanOrEqual(1);
    expect(STATE.observedCounterWrites).toBeGreaterThanOrEqual(1);
  });

  it("DB insert failure does NOT block the request · fail-open on observability writes", async () => {
    markTablePresent();
    // Simulate a healthy read reporting an empty window · then the
    // write that records this attempt fails. The service's contract
    // is to log + degrade (per-action fallback), NOT to block the
    // user because the observability write failed.
    STATE.counterRead = { data: null, error: null };
    STATE.counterWrite = {
      error: { message: "insert failed · statement timeout" },
    };
    const key = accountRateLimitKey("00000000-0000-0000-0000-000000000a05");
    // The caller must not see a thrown error on a single write-fail
    // · the in-memory fallback takes over and this first call is
    // well under its cap.
    await expect(
      recordIfAllowed(key, "password_change"),
    ).resolves.toBeUndefined();
    expect(STATE.observedCounterWrites).toBeGreaterThanOrEqual(1);
  });

  it("_resetRateLimitDetectionForTests clears the detection cache so the next call re-detects", async () => {
    // First call · table is absent · service takes in-memory path.
    const keyA = accountRateLimitKey("00000000-0000-0000-0000-000000000a06");
    await recordIfAllowed(keyA, "password_change");
    expect(STATE.observedCounterReads).toBe(0);
    // Flip the mock to report "table now present" · without clearing
    // the detection cache, the service would stay on in-memory.
    markTablePresent();
    _resetRateLimitDetectionForTests();
    const keyB = accountRateLimitKey("00000000-0000-0000-0000-000000000a07");
    await recordIfAllowed(keyB, "password_change");
    // After the reset, the service re-detects and uses the DB path.
    expect(STATE.observedCounterReads).toBeGreaterThanOrEqual(1);
  });
});
