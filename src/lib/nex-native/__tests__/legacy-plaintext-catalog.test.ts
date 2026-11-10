// src/lib/nex-native/__tests__/legacy-plaintext-catalog.test.ts
//
// NEX device-key chat · legacy plaintext catalog unit tests.
// Owner-authorised 2026-11-10.
// -----------------------------------------------------------------
// Mocks `nexSupabaseAdmin` and asserts:
//   · The query targets `nex_peer_message`
//   · The query filters `encrypted = false`
//   · The query filters `sender_account_id = <arg>`
//   · Returns the honest count on success
//   · Surfaces a honest error object on DB failure
//   · Never writes / updates / deletes (verified by the mock)

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

interface RecordedCall {
  table: string;
  selectCols: string;
  selectOpts: unknown;
  filters: Array<{ col: string; val: unknown }>;
  writeCalled: boolean;
}

const recorded = vi.hoisted(
  () => ({
    last: null as RecordedCall | null,
    nextResponse: null as
      | { data?: unknown; count?: number | null; error?: { message: string } | null }
      | null,
  }),
);

vi.mock("../supabase-admin", () => ({
  nexSupabaseAdmin: {
    from(table: string) {
      const call: RecordedCall = {
        table,
        selectCols: "",
        selectOpts: undefined,
        filters: [],
        writeCalled: false,
      };
      recorded.last = call;
      const builder = {
        select(cols: string, opts?: unknown) {
          call.selectCols = cols;
          call.selectOpts = opts;
          const chain: {
            eq: (col: string, val: unknown) => typeof chain;
            then: Promise<unknown>["then"];
          } = {
            eq(col: string, val: unknown) {
              call.filters.push({ col, val });
              return chain;
            },
            // Make the chain awaitable: resolving produces
            // { data, count, error } like a real PostgREST head-count query.
            then(onFulfilled: (value: unknown) => unknown) {
              const resp = recorded.nextResponse ?? {
                data: null,
                count: 0,
                error: null,
              };
              return Promise.resolve(resp).then(onFulfilled);
            },
          };
          return chain;
        },
        update() {
          call.writeCalled = true;
          return { eq: () => Promise.resolve({ error: null }) };
        },
        delete() {
          call.writeCalled = true;
          return { eq: () => Promise.resolve({ error: null }) };
        },
        insert() {
          call.writeCalled = true;
          return Promise.resolve({ error: null });
        },
      };
      return builder;
    },
  },
}));

import { countLegacyPlaintextRows } from "../crypto/legacy-plaintext-catalog";

beforeEach(() => {
  recorded.last = null;
  recorded.nextResponse = null;
});

describe("countLegacyPlaintextRows", () => {
  it("queries nex_peer_message with sender_account_id + encrypted=false filter", async () => {
    recorded.nextResponse = { data: null, count: 42, error: null };
    const result = await countLegacyPlaintextRows("acct-abc");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.count).toBe(42);
    }
    expect(recorded.last).not.toBeNull();
    expect(recorded.last!.table).toBe("nex_peer_message");
    // Head-count request · must set count:"exact" and head:true.
    const opts = recorded.last!.selectOpts as { count: string; head: boolean };
    expect(opts.count).toBe("exact");
    expect(opts.head).toBe(true);
    // Filter assertions · both filters applied, exact values.
    expect(recorded.last!.filters).toEqual([
      { col: "sender_account_id", val: "acct-abc" },
      { col: "encrypted", val: false },
    ]);
    // Non-destructive · no write path was touched.
    expect(recorded.last!.writeCalled).toBe(false);
  });

  it("returns an honest error on DB failure", async () => {
    recorded.nextResponse = {
      data: null,
      count: null,
      error: { message: "network broken" },
    };
    const result = await countLegacyPlaintextRows("acct-abc");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("network broken");
    }
  });

  it("rejects an empty accountId without touching the DB", async () => {
    const result = await countLegacyPlaintextRows("");
    expect(result.ok).toBe(false);
    // last recorded call MUST be null because the function returned
    // before touching `nexSupabaseAdmin.from(...)`.
    expect(recorded.last).toBeNull();
  });

  it("treats a null count from the DB as zero", async () => {
    recorded.nextResponse = { data: null, count: null, error: null };
    const result = await countLegacyPlaintextRows("acct-abc");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.count).toBe(0);
    }
  });
});
