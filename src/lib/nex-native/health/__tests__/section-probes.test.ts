// src/lib/nex-native/health/__tests__/section-probes.test.ts
//
// NEX Security & Self-Protection · unit tests for section-probes.ts.
// Mirrors the mock shape used by health-probes.test.ts so the two
// suites behave identically re: Supabase shape, env stubbing, and
// "missing schema → unknown" semantics.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.stubEnv("NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEX_SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY", "mock-anon");

// Per-table error toggles. Each probe reads from exactly one table;
// toggling the matching key lets us simulate success / missing schema
// / hard outage independently.
const STATE = vi.hoisted(() => ({
  peerConvError: null as null | { message: string },
  businessError: null as null | { message: string },
  livePostError: null as null | { message: string },
  liveSessionError: null as null | { message: string },
}));

vi.mock("../../supabase-admin", () => ({
  nexSupabaseAdmin: {
    from(table: string) {
      // Build a thenable chainable that can terminate at `.limit(n)`
      // regardless of which chain each probe uses (e.g. .is().limit,
      // .not().limit, .eq().limit). A minimal chain is enough for
      // these unit tests · no need to model Supabase's real builder.
      const settle = () => {
        if (table === "nex_peer_conversation")
          return Promise.resolve({ data: [], error: STATE.peerConvError });
        if (table === "nex_business")
          return Promise.resolve({ data: [], error: STATE.businessError });
        if (table === "nex_live_post")
          return Promise.resolve({ data: [], error: STATE.livePostError });
        if (table === "nex_live_session")
          return Promise.resolve({ data: [], error: STATE.liveSessionError });
        return Promise.resolve({ data: [], error: null });
      };
      const chainable: Record<string, unknown> = {};
      const link = () => chainable;
      chainable.select = link;
      chainable.eq = link;
      chainable.is = link;
      chainable.not = link;
      chainable.limit = () => settle();
      return chainable;
    },
  },
}));

import {
  probeAllSections,
  probeChat,
  probeDirectory,
  probeFeed,
  probeLive,
  probeShops,
} from "../section-probes";

describe("probeChat", () => {
  beforeEach(() => {
    STATE.peerConvError = null;
  });
  it("returns ok when nex_peer_conversation responds", async () => {
    const r = await probeChat();
    expect(r.name).toBe("chat");
    expect(r.ok).toBe(true);
    expect(["ok", "degraded"]).toContain(r.status);
    expect(r.latency_ms).toBeGreaterThanOrEqual(0);
    expect(r.latency_ms).toBeLessThanOrEqual(1_500);
  });
  it("returns unknown (not down, not healthy) when the table is missing", async () => {
    STATE.peerConvError = {
      message: 'relation "nex_peer_conversation" does not exist',
    };
    const r = await probeChat();
    expect(r.status).toBe("unknown");
    expect(r.ok).toBe(false);
    expect(r.detail).toContain("nex_peer_conversation");
  });
});

describe("probeShops", () => {
  beforeEach(() => {
    STATE.businessError = null;
  });
  it("returns ok when nex_business responds", async () => {
    const r = await probeShops();
    expect(r.name).toBe("shops");
    expect(r.ok).toBe(true);
    expect(r.latency_ms).toBeLessThanOrEqual(1_500);
  });
  it("returns unknown when nex_business/deleted_at missing", async () => {
    STATE.businessError = {
      message: 'column "deleted_at" does not exist',
    };
    const r = await probeShops();
    expect(r.status).toBe("unknown");
    expect(r.detail).toContain("nex_business");
  });
});

describe("probeFeed", () => {
  beforeEach(() => {
    STATE.livePostError = null;
  });
  it("returns ok when nex_live_post responds", async () => {
    const r = await probeFeed();
    expect(r.name).toBe("feed");
    expect(r.ok).toBe(true);
  });
  it("returns unknown when nex_live_post missing", async () => {
    STATE.livePostError = {
      message: 'relation "nex_live_post" does not exist',
    };
    const r = await probeFeed();
    expect(r.status).toBe("unknown");
    expect(r.ok).toBe(false);
  });
});

describe("probeLive", () => {
  beforeEach(() => {
    STATE.liveSessionError = null;
  });
  it("returns ok when nex_live_session responds", async () => {
    const r = await probeLive();
    expect(r.name).toBe("live");
    expect(r.ok).toBe(true);
  });
  it("returns unknown when nex_live_session missing", async () => {
    STATE.liveSessionError = {
      message: 'relation "nex_live_session" does not exist',
    };
    const r = await probeLive();
    expect(r.status).toBe("unknown");
  });
  it("returns down (not unknown) on a non-schema DB error", async () => {
    STATE.liveSessionError = { message: "connection refused to 10.0.0.1" };
    const r = await probeLive();
    expect(r.status).toBe("down");
    // Redaction · raw IPs must never appear in the detail.
    expect(r.detail).not.toContain("10.0.0.1");
    expect(r.detail).toContain("[REDACTED]");
  });
});

describe("probeDirectory", () => {
  beforeEach(() => {
    STATE.businessError = null;
  });
  it("returns ok when nex_business responds (is_public filter path)", async () => {
    const r = await probeDirectory();
    expect(r.name).toBe("directory");
    expect(r.ok).toBe(true);
  });
  it("returns unknown when is_public column missing", async () => {
    STATE.businessError = {
      message: 'column "is_public" does not exist',
    };
    const r = await probeDirectory();
    expect(r.status).toBe("unknown");
  });
});

describe("probeAllSections", () => {
  beforeEach(() => {
    STATE.peerConvError = null;
    STATE.businessError = null;
    STATE.livePostError = null;
    STATE.liveSessionError = null;
  });
  it("returns one result per section, in parallel, each bounded by the per-probe timeout", async () => {
    const started = performance.now();
    const results = await probeAllSections();
    const elapsed = performance.now() - started;

    // Nine sections · chat, shops, feed, live, directory + food,
    // fashion, accommodation, property (added 2026-11-08).
    expect(results).toHaveLength(9);
    const names = results.map((r) => r.name).sort();
    expect(names).toEqual([
      "accommodation",
      "chat",
      "directory",
      "fashion",
      "feed",
      "food",
      "live",
      "property",
      "shops",
    ]);

    // Total wall-clock is bounded by a single probe's timeout · the
    // probes fan out in parallel.
    expect(elapsed).toBeLessThanOrEqual(1_500 + 500);

    // Every result reports latency within the per-probe cap.
    for (const r of results) {
      expect(r.latency_ms).toBeLessThanOrEqual(1_500);
    }
  });
});
