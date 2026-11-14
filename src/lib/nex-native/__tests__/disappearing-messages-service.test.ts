// src/lib/nex-native/__tests__/disappearing-messages-service.test.ts
//
// NEX Chat · disappearing messages service · unit tests.
// Owner-authorised 2026-11-07.
// -----------------------------------------------------------------------------
// Pure-function + mocked-Supabase tests. Does NOT exercise an actual
// Postgres · the service's safe-degradation path is proven by mocking
// the column-absence error shape that PostgREST returns.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// ─── In-memory supabase-admin mock ────────────────────────────────────

const store = vi.hoisted(() => ({
  accountRow: null as Record<string, unknown> | null,
  accountReadError: null as string | null,
  columnProbeFails: false, // when true, probe simulates column-absent
}));

vi.mock("../supabase-admin", () => ({
  nexSupabaseAdmin: {
    from(table: string) {
      const builder = {
        select(_cols?: string) {
          return {
            eq(_col: string, _val: unknown) {
              return {
                async maybeSingle() {
                  if (table === "nex_account") {
                    if (store.accountReadError) {
                      return {
                        data: null,
                        error: { message: store.accountReadError },
                      };
                    }
                    return { data: store.accountRow, error: null };
                  }
                  return { data: null, error: null };
                },
              };
            },
            async limit(_n: number) {
              if (table === "nex_peer_message" && store.columnProbeFails) {
                return {
                  data: null,
                  error: {
                    message:
                      "column nex_peer_message.disappearing_at does not exist",
                  },
                };
              }
              return { data: [], error: null };
            },
          };
        },
        update(_patch: unknown) {
          return {
            eq(_col: string, _val: unknown) {
              return Promise.resolve({ error: null });
            },
          };
        },
      };
      return builder;
    },
  },
}));

import {
  AFTER_VIEW_GRACE_SECONDS,
  DEFAULT_DISAPPEARING_SECONDS,
  DISAPPEARING_PRESETS,
  _resetDisappearingAtColumnProbeCacheForTests,
  computeExpiresAtAtReadTime,
  computeExpiresAtAtSendTime,
  getDisappearingDefault,
  getDisappearingDefaultSafe,
  hasDisappearingAtColumn,
  resolveDisappearingAtPatchForSend,
} from "../disappearing-messages-service";

const ACCT = "00000000-0000-0000-0000-000000000001";

beforeEach(() => {
  store.accountRow = null;
  store.accountReadError = null;
  store.columnProbeFails = false;
  _resetDisappearingAtColumnProbeCacheForTests();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ─── Preset catalogue ─────────────────────────────────────────────────

describe("DISAPPEARING_PRESETS", () => {
  it("exposes exactly the 8 owner-sealed options (90-day added 2026-11-12)", () => {
    // 2026-11-12 owner directive · added the 90-day preset
    // (7776000s) per Chat Settings Control Centre spec. See
    // disappearing-messages-constants.ts:26-29.
    expect(DISAPPEARING_PRESETS.map((p) => p.value)).toEqual([
      0, -1, 300, 1800, 3600, 86400, 604800, 7776000,
    ]);
  });
  it("every preset has a non-empty label + description", () => {
    for (const p of DISAPPEARING_PRESETS) {
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.description.length).toBeGreaterThan(0);
    }
  });
});

// ─── Compute helpers ──────────────────────────────────────────────────

describe("computeExpiresAtAtSendTime", () => {
  const now = new Date("2026-11-07T12:00:00Z");
  it("returns null for 0 (OFF)", () => {
    expect(computeExpiresAtAtSendTime(0, now)).toBeNull();
  });
  it("returns null for -1 (stamped at read time, not send)", () => {
    expect(computeExpiresAtAtSendTime(-1, now)).toBeNull();
  });
  it("returns null for negative values other than -1 (defensive)", () => {
    expect(computeExpiresAtAtSendTime(-99 as 0, now)).toBeNull();
  });
  it("adds positive integer seconds to now", () => {
    expect(computeExpiresAtAtSendTime(300, now)?.toISOString()).toBe(
      "2026-11-07T12:05:00.000Z",
    );
    expect(computeExpiresAtAtSendTime(86400, now)?.toISOString()).toBe(
      "2026-11-08T12:00:00.000Z",
    );
    expect(computeExpiresAtAtSendTime(604800, now)?.toISOString()).toBe(
      "2026-11-14T12:00:00.000Z",
    );
  });
});

describe("computeExpiresAtAtReadTime + grace constant", () => {
  it("adds exactly 30 seconds of grace", () => {
    expect(AFTER_VIEW_GRACE_SECONDS).toBe(30);
    const readAt = new Date("2026-11-07T12:00:00Z");
    expect(computeExpiresAtAtReadTime(readAt).toISOString()).toBe(
      "2026-11-07T12:00:30.000Z",
    );
  });
});

// ─── Read ─────────────────────────────────────────────────────────────

describe("getDisappearingDefault", () => {
  it("returns sealed OFF when row is missing", async () => {
    store.accountRow = null;
    expect(await getDisappearingDefault(ACCT)).toBe(DEFAULT_DISAPPEARING_SECONDS);
    expect(DEFAULT_DISAPPEARING_SECONDS).toBe(0);
  });
  it("returns sealed OFF when column-absence error surfaces", async () => {
    store.accountReadError =
      "column nex_account.default_disappearing_messages_seconds does not exist";
    expect(await getDisappearingDefault(ACCT)).toBe(0);
  });
  it("throws on other DB errors (UI shows honest failure)", async () => {
    store.accountReadError = "connection reset";
    await expect(getDisappearingDefault(ACCT)).rejects.toThrow(
      /connection reset/,
    );
  });
  it("narrows arbitrary number → preset-safe", async () => {
    store.accountRow = { default_disappearing_messages_seconds: 3600 };
    expect(await getDisappearingDefault(ACCT)).toBe(3600);
  });
  it("accepts -1 sentinel verbatim", async () => {
    store.accountRow = { default_disappearing_messages_seconds: -1 };
    expect(await getDisappearingDefault(ACCT)).toBe(-1);
  });
  it("clamps nonsense (NaN, Infinity, < -1) to OFF", async () => {
    store.accountRow = { default_disappearing_messages_seconds: NaN };
    expect(await getDisappearingDefault(ACCT)).toBe(0);
    store.accountRow = { default_disappearing_messages_seconds: -99 };
    expect(await getDisappearingDefault(ACCT)).toBe(0);
    store.accountRow = { default_disappearing_messages_seconds: Infinity };
    expect(await getDisappearingDefault(ACCT)).toBe(0);
  });
});

describe("getDisappearingDefaultSafe", () => {
  it("returns OFF on ANY error (never throws)", async () => {
    store.accountReadError = "service unavailable";
    expect(await getDisappearingDefaultSafe(ACCT)).toBe(0);
  });
  it("returns the value when read succeeds", async () => {
    store.accountRow = { default_disappearing_messages_seconds: 1800 };
    expect(await getDisappearingDefaultSafe(ACCT)).toBe(1800);
  });
});

// ─── Column probe ─────────────────────────────────────────────────────

describe("hasDisappearingAtColumn", () => {
  it("returns TRUE when probe succeeds", async () => {
    store.columnProbeFails = false;
    expect(await hasDisappearingAtColumn()).toBe(true);
  });
  it("returns FALSE when probe fails (column absent · pre-migration)", async () => {
    store.columnProbeFails = true;
    expect(await hasDisappearingAtColumn()).toBe(false);
  });
  it("caches the first result · second call does not re-probe", async () => {
    store.columnProbeFails = false;
    expect(await hasDisappearingAtColumn()).toBe(true);
    store.columnProbeFails = true; // if we re-probed, we'd flip to false
    expect(await hasDisappearingAtColumn()).toBe(true); // cached
  });
  it("test reset hook clears the cache", async () => {
    store.columnProbeFails = false;
    expect(await hasDisappearingAtColumn()).toBe(true);
    _resetDisappearingAtColumnProbeCacheForTests();
    store.columnProbeFails = true;
    expect(await hasDisappearingAtColumn()).toBe(false);
  });
});

// ─── Resolve-patch for send path ──────────────────────────────────────

describe("resolveDisappearingAtPatchForSend", () => {
  const now = new Date("2026-11-07T12:00:00Z");

  it("OFF default · empty patch · no stamp", async () => {
    store.accountRow = { default_disappearing_messages_seconds: 0 };
    const patch = await resolveDisappearingAtPatchForSend(ACCT, now);
    expect(patch).toEqual({});
  });

  it("-1 sentinel · empty patch at send · stamping deferred to read", async () => {
    store.accountRow = { default_disappearing_messages_seconds: -1 };
    const patch = await resolveDisappearingAtPatchForSend(ACCT, now);
    expect(patch).toEqual({});
  });

  it("positive integer · stamps disappearing_at correctly", async () => {
    store.accountRow = { default_disappearing_messages_seconds: 300 };
    const patch = await resolveDisappearingAtPatchForSend(ACCT, now);
    expect(patch).toEqual({ disappearing_at: "2026-11-07T12:05:00.000Z" });
  });

  it("column absent · empty patch even with non-zero default", async () => {
    store.accountRow = { default_disappearing_messages_seconds: 300 };
    store.columnProbeFails = true;
    const patch = await resolveDisappearingAtPatchForSend(ACCT, now);
    expect(patch).toEqual({});
  });

  it("account read failure · fail-safe to OFF · empty patch", async () => {
    store.accountReadError = "boom";
    const patch = await resolveDisappearingAtPatchForSend(ACCT, now);
    expect(patch).toEqual({});
  });

  it("all 5 positive presets produce the correct future stamp", async () => {
    const cases: Array<{ seconds: number; expected: string }> = [
      { seconds: 300, expected: "2026-11-07T12:05:00.000Z" },
      { seconds: 1800, expected: "2026-11-07T12:30:00.000Z" },
      { seconds: 3600, expected: "2026-11-07T13:00:00.000Z" },
      { seconds: 86400, expected: "2026-11-08T12:00:00.000Z" },
      { seconds: 604800, expected: "2026-11-14T12:00:00.000Z" },
    ];
    for (const c of cases) {
      _resetDisappearingAtColumnProbeCacheForTests();
      store.accountRow = { default_disappearing_messages_seconds: c.seconds };
      store.columnProbeFails = false;
      const patch = await resolveDisappearingAtPatchForSend(ACCT, now);
      expect(patch).toEqual({ disappearing_at: c.expected });
    }
  });
});

// ─── SQL text sanity · migration 283 + 284 presence ───────────────────

describe("migrations · on-disk text sanity", () => {
  // These tests just read the SQL files to catch accidental drift ·
  // they don't apply anything. A full concurrency-rehearsal-style live
  // apply remains a separate owner-authorisation gate.
  it("migration 283 adds the disappearing_at column + partial index", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync(
      "nex-supabase/migrations/283_nex_peer_message_disappearing_at.sql",
      "utf8",
    );
    expect(src).toMatch(/add column if not exists disappearing_at timestamptz/i);
    expect(src).toMatch(/create index.*nex_peer_message_disappearing_at_idx/i);
    expect(src).toMatch(/where disappearing_at is not null/i);
  });
  it("migration 284 purge function is service_role only", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync(
      "nex-supabase/migrations/284_nex_purge_expired_peer_messages.sql",
      "utf8",
    );
    expect(src).toMatch(/create or replace function.*nex_purge_expired_peer_messages/i);
    expect(src).toMatch(/security definer/i);
    expect(src).toMatch(/set search_path = public, pg_temp/i);
    expect(src).toMatch(/revoke all.*from authenticated/i);
    expect(src).toMatch(/grant execute.*to service_role/i);
    expect(src).toMatch(/delete from nex_peer_message/i);
    expect(src).toMatch(/where disappearing_at is not null/i);
    expect(src).toMatch(/and disappearing_at <= now\(\)/i);
  });
});
