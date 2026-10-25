// src/lib/nex-native/live-broadcast/__tests__/live-session-service.test.ts
//
// Phase 2 · G2 · live-session-service + Migration 219 contract tests.
// -----------------------------------------------------------------------------
// Owner-authorised 2026-10-24.
//
// EVIDENCE BOUNDARY (do not overstate)
// -----------------------------------------------------------------------------
// Three categories:
//
//   1 · MIGRATION 219 source-shape · reads the SQL file as text and
//       asserts policy names, trigger coordination, index semantics.
//
//   2 · SERVICE SOURCE-SHAPE · reads live-session-service.ts as text,
//       asserts the fail-closed-on-write / fail-open-on-read posture
//       and the public API surface.
//
//   3 · MOCKED SERVICE BEHAVIOUR · installs vi.mock for
//       nexSupabaseAdmin, invokes service functions, asserts calls +
//       returned shapes.
//
// NO DATABASE-EXECUTED TESTS. Migration 219 has not been applied to
// any database. Real DB verification is deferred to Option C per the
// saved plan.

import { describe, it, test, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

vi.mock("server-only", () => ({}));

/* ─── Hoisted mocks for the Supabase client ─────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...a: any[]) => any;

const { fromMock, chainBuilder } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type AnyFnInner = (...a: any[]) => any;
  const builder: Record<string, AnyFnInner> = {};
  const b = () => builder;
  builder.select = (() => b()) as AnyFnInner;
  builder.insert = (() => b()) as AnyFnInner;
  builder.update = (() => b()) as AnyFnInner;
  builder.eq = (() => b()) as AnyFnInner;
  builder.is = (() => b()) as AnyFnInner;
  builder.in = (() => b()) as AnyFnInner;
  builder.order = (() => b()) as AnyFnInner;
  builder.limit = (() => b()) as AnyFnInner;
  builder.maybeSingle = (() => b()) as AnyFnInner;
  builder.single = (() => b()) as AnyFnInner;
  builder.then = ((onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
    resolverPromise().then(onF, onR)) as AnyFnInner;
  return {
    fromMock: vi.fn(() => builder),
    chainBuilder: builder as unknown as Record<string, AnyFn>,
  };
});

// The resolver each terminal call awaits; tests override before invoking.
let currentResolver: () => Promise<unknown> = async () => ({
  data: null,
  error: null,
});
function resolverPromise(): Promise<unknown> {
  return currentResolver();
}
function setResolver(fn: () => Promise<unknown>) {
  currentResolver = fn;
}

vi.mock("@/lib/nex-native/supabase-admin", () => ({
  nexSupabaseAdmin: { from: fromMock },
  nexSupabaseProjectRef: () => "mock",
}));

/* ─── Fixtures ────────────────────────────────────────────── */

const BROADCASTER = "11111111-1111-1111-1111-111111111111";
const BUSINESS_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const SESSION_ID = "99999999-9999-9999-9999-999999999999";
const PRODUCT_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";

/* ─── 1 · Migration 219 source-shape ──────────────────────── */

const M219 = readFileSync(
  resolve(
    __dirname,
    "..",
    "..",
    "..",
    "..",
    "..",
    "nex-supabase",
    "migrations",
    "219_nex_live_session_and_featured_product.sql",
  ),
  "utf8",
);

describe("Migration 219 · source-shape", () => {
  it("declares NOT YET APPLIED + production project constraint", () => {
    expect(M219).toMatch(/NOT YET APPLIED/);
    expect(M219).toMatch(/ijvqdvsvwtwxzcqmoqit/);
  });

  it("defines nex_live_session with nullable business_id (free-tier §5.0)", () => {
    expect(M219).toMatch(
      /business_id\s+uuid\s+NULL\s+REFERENCES\s+nex_business\(id\)/,
    );
  });

  it("defines nex_live_featured_product with session_id + product_id FKs", () => {
    expect(M219).toMatch(
      /session_id\s+uuid\s+NOT NULL REFERENCES nex_live_session\(id\)/,
    );
    expect(M219).toMatch(
      /product_id\s+uuid\s+NOT NULL REFERENCES nex_product\(id\)/,
    );
  });

  it("partial unique index · at most one 'open' session per broadcaster", () => {
    expect(M219).toMatch(
      /CREATE UNIQUE INDEX[\s\S]*?uq_nex_live_session_one_open_per_broadcaster[\s\S]*?WHERE status = 'open'/,
    );
  });

  it("partial unique index · at most one active featured_product per session", () => {
    expect(M219).toMatch(
      /CREATE UNIQUE INDEX[\s\S]*?uq_nex_live_featured_product_one_active_per_session[\s\S]*?WHERE ended_featuring_at IS NULL/,
    );
  });

  it("public SELECT policy on live_session · open-only", () => {
    expect(M219).toMatch(
      /CREATE POLICY nex_live_session_public_select_open[\s\S]*?FOR SELECT[\s\S]*?USING \(status = 'open'\)/,
    );
  });

  it("broadcaster INSERT uses nex_current_account_ids + validates business ownership", () => {
    expect(M219).toMatch(
      /CREATE POLICY nex_live_session_broadcaster_insert[\s\S]*?nex_current_account_ids\(\)[\s\S]*?nex_current_owned_business_ids\(\)/,
    );
  });

  it("no DELETE policies (service-role only)", () => {
    expect(M219).not.toMatch(
      /CREATE POLICY[^;]*ON nex_live_session FOR DELETE/,
    );
    expect(M219).not.toMatch(
      /CREATE POLICY[^;]*ON nex_live_featured_product FOR DELETE/,
    );
  });

  it("featured_product INSERT verifies session ownership + business_id attached", () => {
    expect(M219).toMatch(
      /CREATE POLICY nex_live_featured_product_broadcaster_insert[\s\S]*?s\.business_id IS NOT NULL/,
    );
  });

  it("has a rollback block + ledger insert", () => {
    expect(M219).toMatch(/-- Rollback/);
    expect(M219).toMatch(/DROP TABLE IF EXISTS nex_live_featured_product/);
    expect(M219).toMatch(/DROP TABLE IF EXISTS nex_live_session/);
    expect(M219).toMatch(/'219'/);
  });
});

/* ─── 2 · Service source-shape ───────────────────────────── */

const SRC = readFileSync(
  resolve(__dirname, "..", "live-session-service.ts"),
  "utf8",
);

describe("live-session-service · source-shape", () => {
  it("is server-only", () => {
    expect(SRC).toMatch(/^import "server-only"/m);
  });

  it("exports the sealed Phase 2 API", () => {
    for (const fn of [
      "startLiveSession",
      "endLiveSession",
      "touchHeartbeat",
      "setFeaturedProduct",
      "clearFeaturedProduct",
      "getActiveSessionForBroadcaster",
      "isBroadcasterLive",
      "getFeaturedProductForSession",
      "isProductFeaturedLiveNow",
      "listOpenSessionsPublic",
      // Batch helpers (added for list surfaces like directory cards).
      "listOpenSessionsForBroadcasters",
      "listActiveFeaturedProductsForSessions",
    ]) {
      expect(SRC).toMatch(new RegExp(`export (async )?function ${fn}\\(`));
    }
  });

  it("write operations fail CLOSED (throw)", () => {
    for (const fn of [
      "startLiveSession",
      "endLiveSession",
      "touchHeartbeat",
      "setFeaturedProduct",
      "clearFeaturedProduct",
    ]) {
      const body = SRC.match(
        new RegExp(`export async function ${fn}[\\s\\S]*?(?=\\nexport )`),
      );
      expect(body).toBeTruthy();
      expect(body![0]).toMatch(/throw new Error/);
    }
  });

  it("read operations fail OPEN (return null / false / [] / Map)", () => {
    const reads = [
      "getActiveSessionForBroadcaster",
      "getFeaturedProductForSession",
      "isProductFeaturedLiveNow",
      "listOpenSessionsPublic",
      "listOpenSessionsForBroadcasters",
      "listActiveFeaturedProductsForSessions",
    ];
    for (const fn of reads) {
      const body = SRC.match(
        new RegExp(`export async function ${fn}[\\s\\S]*?(?=\\nexport |\\n$)`),
      );
      expect(body).toBeTruthy();
      // Each has a try/catch returning an empty value (Map, null, false, []).
      expect(body![0]).toMatch(
        /try \{[\s\S]*?} catch \{[\s\S]*?return (null|false|\[\]|new Map\(\))/,
      );
    }
  });

  it("setFeaturedProduct asserts caller is the broadcaster and session is open", () => {
    const body = SRC.match(
      /export async function setFeaturedProduct[\s\S]*?(?=\nexport )/,
    );
    expect(body![0]).toMatch(/caller is not the broadcaster of this session/);
    expect(body![0]).toMatch(/session is not open/);
  });

  it("endLiveSession closes any active pin before flipping the session", () => {
    const body = SRC.match(
      /export async function endLiveSession[\s\S]*?(?=\nexport )/,
    );
    expect(body![0]).toMatch(/nex_live_featured_product[\s\S]*?update[\s\S]*?ended_featuring_at/);
    expect(body![0]).toMatch(/nex_live_session[\s\S]*?update[\s\S]*?status.*ended/);
  });
});

/* ─── 3 · Mocked service behaviour ───────────────────────── */

describe("live-session-service · behaviour", () => {
  beforeEach(() => {
    fromMock.mockClear();
    setResolver(async () => ({ data: null, error: null }));
  });

  test("startLiveSession returns the inserted row on success", async () => {
    const row = {
      id: SESSION_ID,
      broadcaster_account_id: BROADCASTER,
      business_id: BUSINESS_ID,
      status: "open",
      started_at: "2026-10-24T00:00:00.000Z",
      ended_at: null,
      last_heartbeat_at: null,
    };
    setResolver(async () => ({ data: row, error: null }));
    const svc = await import("../live-session-service");
    const result = await svc.startLiveSession({
      broadcasterAccountId: BROADCASTER,
      businessId: BUSINESS_ID,
    });
    expect(result).toEqual(row);
    expect(fromMock).toHaveBeenCalledWith("nex_live_session");
  });

  test("startLiveSession throws on PG error (fail-closed)", async () => {
    setResolver(async () => ({
      data: null,
      error: { code: "23505", message: "duplicate key" },
    }));
    const svc = await import("../live-session-service");
    await expect(
      svc.startLiveSession({ broadcasterAccountId: BROADCASTER }),
    ).rejects.toThrow(/23505/);
  });

  test("endLiveSession first closes active pin then flips session (two calls)", async () => {
    setResolver(async () => ({ data: null, error: null }));
    const svc = await import("../live-session-service");
    await svc.endLiveSession({
      sessionId: SESSION_ID,
      broadcasterAccountId: BROADCASTER,
    });
    // Called twice · once on featured_product, once on live_session.
    const tables = fromMock.mock.calls.map((c) => (c as unknown[])[0]);
    expect(tables).toContain("nex_live_featured_product");
    expect(tables).toContain("nex_live_session");
  });

  test("setFeaturedProduct refuses non-broadcaster callers", async () => {
    // First call: session lookup returns a different broadcaster.
    setResolver(async () => ({
      data: {
        id: SESSION_ID,
        broadcaster_account_id: "ffffffff-ffff-ffff-ffff-ffffffffffff",
        status: "open",
      },
      error: null,
    }));
    const svc = await import("../live-session-service");
    await expect(
      svc.setFeaturedProduct({
        sessionId: SESSION_ID,
        broadcasterAccountId: BROADCASTER,
        productId: PRODUCT_ID,
      }),
    ).rejects.toThrow(/not the broadcaster/i);
  });

  test("setFeaturedProduct refuses ended sessions", async () => {
    setResolver(async () => ({
      data: {
        id: SESSION_ID,
        broadcaster_account_id: BROADCASTER,
        status: "ended",
      },
      error: null,
    }));
    const svc = await import("../live-session-service");
    await expect(
      svc.setFeaturedProduct({
        sessionId: SESSION_ID,
        broadcasterAccountId: BROADCASTER,
        productId: PRODUCT_ID,
      }),
    ).rejects.toThrow(/not open/);
  });

  test("getActiveSessionForBroadcaster returns null on query error (fail-open)", async () => {
    setResolver(async () => ({ data: null, error: { message: "boom" } }));
    const svc = await import("../live-session-service");
    const r = await svc.getActiveSessionForBroadcaster(BROADCASTER);
    expect(r).toBeNull();
  });

  test("isBroadcasterLive is derived from the active session read", async () => {
    // started_at = recent + null heartbeat · lands in the stale-session
    // policy's startup-grace path · policy returns live=true.
    setResolver(async () => ({
      data: {
        id: SESSION_ID,
        broadcaster_account_id: BROADCASTER,
        business_id: null,
        status: "open",
        started_at: new Date().toISOString(),
        ended_at: null,
        last_heartbeat_at: null,
      },
      error: null,
    }));
    const svc = await import("../live-session-service");
    expect(await svc.isBroadcasterLive(BROADCASTER)).toBe(true);
  });

  test("listOpenSessionsPublic returns [] on query error (fail-open)", async () => {
    setResolver(async () => ({ data: null, error: { message: "boom" } }));
    const svc = await import("../live-session-service");
    const r = await svc.listOpenSessionsPublic({ limit: 5 });
    expect(r).toEqual([]);
  });

  test("listOpenSessionsPublic clamps limit [1..100]", async () => {
    let capturedLimit: number | undefined;
    const original = chainBuilder as unknown as {
      limit: (n: number) => unknown;
    };
    const spy = vi.fn((n: number) => {
      capturedLimit = n;
      return chainBuilder;
    });
    original.limit = spy;
    setResolver(async () => ({ data: [], error: null }));
    const svc = await import("../live-session-service");
    await svc.listOpenSessionsPublic({ limit: 9999 });
    expect(capturedLimit).toBeLessThanOrEqual(100);
    await svc.listOpenSessionsPublic({ limit: 0 });
    expect(capturedLimit).toBeGreaterThanOrEqual(1);
  });
});

/* ─── 3b · Batch helpers behaviour ──────────────────────── */

describe("live-session-service · batch helpers · behaviour", () => {
  beforeEach(() => {
    fromMock.mockClear();
    setResolver(async () => ({ data: null, error: null }));
  });

  test("listOpenSessionsForBroadcasters returns empty Map for empty input (no DB call)", async () => {
    const svc = await import("../live-session-service");
    const r = await svc.listOpenSessionsForBroadcasters([]);
    expect(r.size).toBe(0);
    expect(fromMock).not.toHaveBeenCalled();
  });

  test("listOpenSessionsForBroadcasters deduplicates + filters empty strings", async () => {
    let capturedIn: readonly unknown[] | undefined;
    const original = chainBuilder as unknown as {
      in: (c: string, vals: readonly unknown[]) => unknown;
    };
    original.in = vi.fn((_col: string, vals: readonly unknown[]) => {
      capturedIn = vals;
      return chainBuilder;
    });
    setResolver(async () => ({ data: [], error: null }));
    const svc = await import("../live-session-service");
    await svc.listOpenSessionsForBroadcasters([
      BROADCASTER,
      BROADCASTER,
      "",
      "99999999-9999-9999-9999-999999999999",
    ]);
    expect(capturedIn).toBeDefined();
    // 2 unique non-empty values after dedup/filter.
    expect(capturedIn!.length).toBe(2);
  });

  test("listOpenSessionsForBroadcasters returns broadcaster→session Map", async () => {
    // started_at recent + null heartbeat · lands in the stale-session
    // policy's startup-grace path · passes the filter.
    const rows = [
      {
        id: SESSION_ID,
        broadcaster_account_id: BROADCASTER,
        business_id: BUSINESS_ID,
        status: "open",
        started_at: new Date().toISOString(),
        ended_at: null,
        last_heartbeat_at: null,
      },
    ];
    setResolver(async () => ({ data: rows, error: null }));
    const svc = await import("../live-session-service");
    const r = await svc.listOpenSessionsForBroadcasters([BROADCASTER]);
    expect(r.size).toBe(1);
    expect(r.get(BROADCASTER)?.id).toBe(SESSION_ID);
  });

  test("listOpenSessionsForBroadcasters returns empty Map on query error (fail-open)", async () => {
    setResolver(async () => ({ data: null, error: { message: "boom" } }));
    const svc = await import("../live-session-service");
    const r = await svc.listOpenSessionsForBroadcasters([BROADCASTER]);
    expect(r.size).toBe(0);
  });

  test("listActiveFeaturedProductsForSessions returns session→pin Map", async () => {
    const rows = [
      {
        id: "pin-1",
        session_id: SESSION_ID,
        product_id: PRODUCT_ID,
        started_featuring_at: "2026-10-24T00:00:00Z",
        ended_featuring_at: null,
      },
    ];
    setResolver(async () => ({ data: rows, error: null }));
    const svc = await import("../live-session-service");
    const r = await svc.listActiveFeaturedProductsForSessions([SESSION_ID]);
    expect(r.size).toBe(1);
    expect(r.get(SESSION_ID)?.product_id).toBe(PRODUCT_ID);
  });

  test("listActiveFeaturedProductsForSessions fail-open on error", async () => {
    setResolver(async () => ({ data: null, error: { message: "boom" } }));
    const svc = await import("../live-session-service");
    const r = await svc.listActiveFeaturedProductsForSessions([SESSION_ID]);
    expect(r.size).toBe(0);
  });

  test("listActiveFeaturedProductsForSessions returns empty Map for empty input (no DB call)", async () => {
    fromMock.mockClear();
    const svc = await import("../live-session-service");
    const r = await svc.listActiveFeaturedProductsForSessions([]);
    expect(r.size).toBe(0);
    expect(fromMock).not.toHaveBeenCalled();
  });
});

/* ─── 4 · Explicit non-claims ────────────────────────────── */

describe("Phase 2 G2 · explicit boundary · what this file does NOT prove", () => {
  it("does NOT prove Migration 219 applies cleanly against Postgres", () => {
    // Awaits sandbox provisioning (D6).
    expect(true).toBe(true);
  });

  it("does NOT prove the partial unique indexes catch races under concurrent inserts", () => {
    expect(true).toBe(true);
  });

  it("does NOT prove RLS policies enforce the intended identity scope", () => {
    // Policy enforcement is a Postgres-level property · verified in
    // sandbox against real auth.uid() cookies, not vitest mocks.
    expect(true).toBe(true);
  });
});
