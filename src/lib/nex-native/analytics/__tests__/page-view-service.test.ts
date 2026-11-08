// src/lib/nex-native/analytics/__tests__/page-view-service.test.ts

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.stubEnv("NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEX_SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY", "mock-anon");

const BUSINESS_ID = "11111111-1111-4111-8111-111111111111";
const PRODUCT_ID = "22222222-2222-4222-8222-222222222222";
const ACCOUNT_ID = "33333333-3333-4333-8333-333333333333";
const VALID_HASH = "a".repeat(64);
const OTHER_HASH = "b".repeat(64);

const STATE = vi.hoisted(() => ({
  probeError: null as null | { message: string },
  insertResult: {
    data: { id: "view-uuid-1" } as { id: string } | null,
    error: null as null | { message: string },
  },
  insertedRows: [] as Array<{ table: string; row: Record<string, unknown> }>,
  selectRows: [] as Array<Record<string, unknown>>,
  deleteRows: null as null | Array<Record<string, unknown>>,
  lastUpdatePatch: null as null | Record<string, unknown>,
  lastMutateKind: null as null | "update" | "delete",
}));

vi.mock("../../supabase-admin", () => {
  function makeChain() {
    const chain: Record<string, unknown> = {};
    const list = () =>
      Promise.resolve({ data: STATE.selectRows, error: STATE.probeError });
    chain.eq = () => chain;
    chain.is = () => chain;
    chain.in = () => chain;
    chain.gte = () => chain;
    chain.lt = () => chain;
    chain.order = () => chain;
    chain.limit = () => chain;
    (chain as Record<string, unknown>).then = (
      resolve?: ((v: unknown) => unknown) | null,
      reject?: ((r: unknown) => unknown) | null,
    ) => list().then(resolve ?? undefined, reject ?? undefined);
    return chain;
  }
  function makeDelUpd(kind: "update" | "delete") {
    const chain: Record<string, unknown> = {};
    const list = () =>
      Promise.resolve({ data: STATE.deleteRows ?? STATE.selectRows, error: STATE.probeError });
    chain.eq = () => chain;
    chain.lt = () => chain;
    chain.limit = () => chain;
    chain.select = () => chain;
    STATE.lastMutateKind = kind;
    (chain as Record<string, unknown>).then = (
      resolve?: ((v: unknown) => unknown) | null,
      reject?: ((r: unknown) => unknown) | null,
    ) => list().then(resolve ?? undefined, reject ?? undefined);
    return chain;
  }
  return {
    nexSupabaseAdmin: {
      from(table: string) {
        return {
          select: () => makeChain(),
          insert(row: Record<string, unknown> | Record<string, unknown>[]) {
            const rows = Array.isArray(row) ? row : [row];
            for (const r of rows) STATE.insertedRows.push({ table, row: r });
            return {
              select: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: STATE.insertResult.data,
                    error: STATE.insertResult.error,
                  }),
              }),
            };
          },
          update(patch: Record<string, unknown>) {
            STATE.lastUpdatePatch = patch;
            return makeDelUpd("update");
          },
          delete() {
            return makeDelUpd("delete");
          },
        };
      },
    },
  };
});

import {
  _resetPageViewProbeForTests,
  fetchBusinessHourlyBuckets,
  fetchBusinessPageViewSummary,
  fetchBusinessViewCounts30d,
  generateViewerToken,
  hashesEqual,
  isLikelyBot,
  pruneOldPageViews,
  recordPageView,
  resolveViewCountry,
  scrubViewerAccountId,
  sha256Hex,
} from "../page-view-service";

describe("hash helpers", () => {
  it("sha256Hex · deterministic · 64 lowercase hex", () => {
    const h = sha256Hex("hello");
    expect(h).toHaveLength(64);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(sha256Hex("hello")).toBe(h);
  });

  it("generateViewerToken · 64-char hex · unique per call", () => {
    const a = generateViewerToken();
    const b = generateViewerToken();
    expect(a).toHaveLength(64);
    expect(a).not.toBe(b);
  });

  it("hashesEqual · constant-time compare", () => {
    expect(hashesEqual(VALID_HASH, VALID_HASH)).toBe(true);
    expect(hashesEqual(VALID_HASH, OTHER_HASH)).toBe(false);
    expect(hashesEqual("short", VALID_HASH)).toBe(false);
  });
});

describe("isLikelyBot", () => {
  it("flags common bot UAs", () => {
    for (const ua of [
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "facebookexternalhit/1.1",
      "python-requests/2.28.1",
      "curl/7.81.0",
      "Mozilla/5.0 AppleWebKit (KHTML, like Gecko) HeadlessChrome/120",
      "Anthropic-ai/1.0",
    ]) {
      expect(isLikelyBot(ua)).toBe(true);
    }
  });

  it("does NOT flag quiet human browsers", () => {
    for (const ua of [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1) AppleWebKit/605.1.15",
      "Mozilla/5.0 (Windows NT 10.0; Win64) AppleWebKit/537.36 Chrome/122",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/605 Version/16 Safari/605",
    ]) {
      expect(isLikelyBot(ua)).toBe(false);
    }
  });

  it("flags suspiciously short UAs", () => {
    expect(isLikelyBot("hi")).toBe(true);
    expect(isLikelyBot("")).toBe(false); // null-equiv · don't flag empty
  });

  it("does not flag null / undefined", () => {
    expect(isLikelyBot(null)).toBe(false);
    expect(isLikelyBot(undefined)).toBe(false);
  });
});

describe("resolveViewCountry", () => {
  it("IE → ireland", () => {
    expect(resolveViewCountry({ vercelIpCountry: "IE" })).toBe("ireland");
  });
  it("ID → indonesia", () => {
    expect(resolveViewCountry({ vercelIpCountry: "ID" })).toBe("indonesia");
  });
  it("other country + worldwide env → worldwide", () => {
    expect(resolveViewCountry({ vercelIpCountry: "US", envCountry: "worldwide" })).toBe(
      "worldwide",
    );
  });
  it("no vercel + no env → global", () => {
    expect(resolveViewCountry({})).toBe("global");
  });
  it("case-insensitive on vercel header", () => {
    expect(resolveViewCountry({ vercelIpCountry: "ie" })).toBe("ireland");
  });
});

describe("recordPageView · validation", () => {
  beforeEach(() => {
    _resetPageViewProbeForTests();
    STATE.probeError = null;
    STATE.insertResult = { data: { id: "view-uuid-1" }, error: null };
    STATE.insertedRows = [];
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("rejects malformed businessId", async () => {
    const r = await recordPageView({
      businessId: "not-uuid",
      pageType: "business",
      country: "global",
      viewerTokenHash: VALID_HASH,
      botLikely: false,
    });
    expect(r.ok).toBe(false);
    expect(r.skipped).toBe("invalid_input");
    expect(STATE.insertedRows).toEqual([]);
  });

  it("rejects malformed viewer hash", async () => {
    const r = await recordPageView({
      businessId: BUSINESS_ID,
      pageType: "business",
      country: "global",
      viewerTokenHash: "nope",
      botLikely: false,
    });
    expect(r.ok).toBe(false);
    expect(r.skipped).toBe("invalid_input");
  });

  it("rejects product view without product_id", async () => {
    const r = await recordPageView({
      businessId: BUSINESS_ID,
      pageType: "product",
      country: "global",
      viewerTokenHash: VALID_HASH,
      botLikely: false,
    });
    expect(r.ok).toBe(false);
    expect(r.skipped).toBe("invalid_input");
  });

  it("rejects business view carrying product_id", async () => {
    const r = await recordPageView({
      businessId: BUSINESS_ID,
      pageType: "business",
      productId: PRODUCT_ID,
      country: "global",
      viewerTokenHash: VALID_HASH,
      botLikely: false,
    });
    expect(r.ok).toBe(false);
    expect(r.skipped).toBe("invalid_input");
  });

  it("rejects bad country enum", async () => {
    const r = await recordPageView({
      businessId: BUSINESS_ID,
      pageType: "business",
      // @ts-expect-error · deliberate
      country: "narnia",
      viewerTokenHash: VALID_HASH,
      botLikely: false,
    });
    expect(r.ok).toBe(false);
  });
});

describe("recordPageView · behaviour", () => {
  beforeEach(() => {
    _resetPageViewProbeForTests();
    STATE.probeError = null;
    STATE.insertResult = { data: { id: "view-uuid-1" }, error: null };
    STATE.insertedRows = [];
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("writes a well-formed business-view row", async () => {
    const r = await recordPageView({
      businessId: BUSINESS_ID,
      pageType: "business",
      country: "ireland",
      viewerTokenHash: VALID_HASH,
      viewerAccountId: ACCOUNT_ID,
      userAgentHash: OTHER_HASH,
      botLikely: false,
    });
    expect(r.ok).toBe(true);
    expect(r.viewId).toBe("view-uuid-1");
    expect(STATE.insertedRows).toHaveLength(1);
    const row = STATE.insertedRows[0]!.row;
    expect(row.business_id).toBe(BUSINESS_ID);
    expect(row.page_type).toBe("business");
    expect(row.product_id).toBeNull();
    expect(row.country).toBe("ireland");
    expect(row.viewer_token_hash).toBe(VALID_HASH);
    expect(row.viewer_account_id).toBe(ACCOUNT_ID);
    expect(row.user_agent_hash).toBe(OTHER_HASH);
    expect(row.bot_likely).toBe(false);
  });

  it("writes a product view", async () => {
    const r = await recordPageView({
      businessId: BUSINESS_ID,
      pageType: "product",
      productId: PRODUCT_ID,
      country: "indonesia",
      viewerTokenHash: VALID_HASH,
      botLikely: false,
    });
    expect(r.ok).toBe(true);
    const row = STATE.insertedRows[0]!.row;
    expect(row.page_type).toBe("product");
    expect(row.product_id).toBe(PRODUCT_ID);
  });

  it("skips bots without writing", async () => {
    const r = await recordPageView({
      businessId: BUSINESS_ID,
      pageType: "business",
      country: "global",
      viewerTokenHash: VALID_HASH,
      botLikely: true,
    });
    expect(r.ok).toBe(true);
    expect(r.skipped).toBe("bot");
    expect(STATE.insertedRows).toEqual([]);
  });

  it("dedupes repeat views from the same viewer+business within 60s", async () => {
    const first = await recordPageView({
      businessId: BUSINESS_ID,
      pageType: "business",
      country: "global",
      viewerTokenHash: VALID_HASH,
      botLikely: false,
    });
    expect(first.ok).toBe(true);
    expect(first.viewId).toBeDefined();

    const second = await recordPageView({
      businessId: BUSINESS_ID,
      pageType: "business",
      country: "global",
      viewerTokenHash: VALID_HASH,
      botLikely: false,
    });
    expect(second.ok).toBe(true);
    expect(second.skipped).toBe("dedup");
    expect(STATE.insertedRows).toHaveLength(1);
  });

  it("does NOT dedupe different viewers on the same business", async () => {
    await recordPageView({
      businessId: BUSINESS_ID,
      pageType: "business",
      country: "global",
      viewerTokenHash: VALID_HASH,
      botLikely: false,
    });
    STATE.insertResult = { data: { id: "view-uuid-2" }, error: null };
    const r = await recordPageView({
      businessId: BUSINESS_ID,
      pageType: "business",
      country: "global",
      viewerTokenHash: OTHER_HASH,
      botLikely: false,
    });
    expect(r.ok).toBe(true);
    expect(r.skipped).toBeUndefined();
    expect(STATE.insertedRows).toHaveLength(2);
  });

  it("returns table_not_available when migration 303 is missing", async () => {
    _resetPageViewProbeForTests();
    STATE.probeError = { message: 'relation "nex_page_view" does not exist' };
    const r = await recordPageView({
      businessId: BUSINESS_ID,
      pageType: "business",
      country: "global",
      viewerTokenHash: VALID_HASH,
      botLikely: false,
    });
    expect(r.ok).toBe(false);
    expect(r.skipped).toBe("table_not_available");
    expect(STATE.insertedRows).toEqual([]);
  });
});

describe("aggregation readers", () => {
  beforeEach(() => {
    _resetPageViewProbeForTests();
    STATE.probeError = null;
    STATE.insertResult = { data: null, error: null };
    STATE.insertedRows = [];
    STATE.selectRows = [];
  });

  it("fetchBusinessHourlyBuckets · empty when invalid businessId", async () => {
    const out = await fetchBusinessHourlyBuckets("not-uuid");
    expect(out).toEqual([]);
  });

  it("fetchBusinessHourlyBuckets · empty array when probe fails", async () => {
    _resetPageViewProbeForTests();
    STATE.probeError = { message: "schema cache missing" };
    const out = await fetchBusinessHourlyBuckets(BUSINESS_ID);
    expect(out).toEqual([]);
  });

  it("fetchBusinessHourlyBuckets · fills missing hours with zero", async () => {
    // Seed one row so there's exactly one real bucket and the rest
    // should come back as zero-filled.
    const now = new Date();
    now.setUTCMinutes(10, 0, 0); // mid-hour
    STATE.selectRows = [
      {
        viewed_at: now.toISOString(),
        viewer_token_hash: VALID_HASH,
        viewer_account_id: null,
        country: "global",
      },
    ];
    const out = await fetchBusinessHourlyBuckets(BUSINESS_ID, { hours: 24 });
    expect(out).toHaveLength(24);
    const nonZero = out.filter((b) => b.views > 0);
    expect(nonZero).toHaveLength(1);
    expect(nonZero[0]!.uniqueViewerHashes).toBe(1);
    expect(nonZero[0]!.signedInViewers).toBe(0);
  });

  it("fetchBusinessHourlyBuckets · counts unique hashes per bucket", async () => {
    const now = new Date();
    now.setUTCMinutes(10, 0, 0);
    STATE.selectRows = [
      { viewed_at: now.toISOString(), viewer_token_hash: VALID_HASH, viewer_account_id: null, country: "global" },
      { viewed_at: now.toISOString(), viewer_token_hash: VALID_HASH, viewer_account_id: null, country: "global" },
      { viewed_at: now.toISOString(), viewer_token_hash: OTHER_HASH, viewer_account_id: ACCOUNT_ID, country: "ireland" },
    ];
    const out = await fetchBusinessHourlyBuckets(BUSINESS_ID, { hours: 2 });
    const busy = out.find((b) => b.views > 0)!;
    expect(busy.views).toBe(3);
    expect(busy.uniqueViewerHashes).toBe(2);
    expect(busy.signedInViewers).toBe(1);
  });

  it("fetchBusinessPageViewSummary · tallies total + unique + country", async () => {
    const now = new Date().toISOString();
    STATE.selectRows = [
      { viewed_at: now, viewer_token_hash: VALID_HASH, viewer_account_id: null, country: "ireland" },
      { viewed_at: now, viewer_token_hash: VALID_HASH, viewer_account_id: null, country: "ireland" },
      { viewed_at: now, viewer_token_hash: OTHER_HASH, viewer_account_id: ACCOUNT_ID, country: "indonesia" },
    ];
    const s = await fetchBusinessPageViewSummary(BUSINESS_ID);
    expect(s).not.toBeNull();
    expect(s!.totalViews).toBe(3);
    expect(s!.uniqueViewerHashes).toBe(2);
    expect(s!.signedInViewers).toBe(1);
    expect(s!.byCountry.ireland).toBe(2);
    expect(s!.byCountry.indonesia).toBe(1);
    expect(s!.peakHourIso).not.toBeNull();
  });

  it("fetchBusinessViewCounts30d · aggregates per business_id", async () => {
    STATE.selectRows = [
      { business_id: BUSINESS_ID },
      { business_id: BUSINESS_ID },
      { business_id: "44444444-4444-4444-8444-444444444444" },
    ];
    const out = await fetchBusinessViewCounts30d([
      BUSINESS_ID,
      "44444444-4444-4444-8444-444444444444",
    ]);
    expect(out.get(BUSINESS_ID)).toBe(2);
    expect(out.get("44444444-4444-4444-8444-444444444444")).toBe(1);
  });

  it("fetchBusinessViewCounts30d · empty map on empty input", async () => {
    const out = await fetchBusinessViewCounts30d([]);
    expect(out.size).toBe(0);
  });

  it("fetchBusinessViewCounts30d · empty when table missing", async () => {
    _resetPageViewProbeForTests();
    STATE.probeError = { message: "schema cache missing" };
    const out = await fetchBusinessViewCounts30d([BUSINESS_ID]);
    expect(out.size).toBe(0);
  });
});

describe("retention + scrub helpers", () => {
  beforeEach(() => {
    _resetPageViewProbeForTests();
    STATE.probeError = null;
    STATE.selectRows = [];
    STATE.deleteRows = null;
    STATE.lastUpdatePatch = null;
    STATE.lastMutateKind = null;
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("pruneOldPageViews · returns deletedCount from the delete result", async () => {
    STATE.deleteRows = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const r = await pruneOldPageViews({ olderThanDays: 180 });
    expect(r.ok).toBe(true);
    expect(r.deletedCount).toBe(3);
    expect(r.olderThanIso).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(STATE.lastMutateKind).toBe("delete");
  });

  it("pruneOldPageViews · rejects a cutoff less than 7 days in the past (clamped to 7 days)", async () => {
    STATE.deleteRows = [];
    const r = await pruneOldPageViews({ olderThanDays: 1 });
    // The function clamps to 7 days min · the delete still runs
    // against the 7-day cutoff, not the 1-day one.
    expect(r.ok).toBe(true);
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const cutoffMs = Date.parse(r.olderThanIso);
    expect(Date.now() - cutoffMs).toBeGreaterThanOrEqual(sevenDaysMs - 1000);
  });

  it("pruneOldPageViews · returns table_not_available when migration 303 missing", async () => {
    _resetPageViewProbeForTests();
    STATE.probeError = { message: "schema cache missing" };
    const r = await pruneOldPageViews();
    expect(r.ok).toBe(false);
    expect(r.skipped).toBe("table_not_available");
  });

  it("scrubViewerAccountId · nulls viewer_account_id and returns count", async () => {
    STATE.deleteRows = [{ id: "a" }, { id: "b" }]; // used as "select rows" of the update
    const r = await scrubViewerAccountId(ACCOUNT_ID);
    expect(r.ok).toBe(true);
    expect(r.scrubbedCount).toBe(2);
    expect(STATE.lastUpdatePatch).toEqual({ viewer_account_id: null });
    expect(STATE.lastMutateKind).toBe("update");
  });

  it("scrubViewerAccountId · bad accountId is rejected", async () => {
    const r = await scrubViewerAccountId("not-uuid");
    expect(r.ok).toBe(false);
    expect(r.error).toBe("bad_account_id");
  });

  it("scrubViewerAccountId · no-op when table missing · returns ok", async () => {
    _resetPageViewProbeForTests();
    STATE.probeError = { message: "relation does not exist" };
    const r = await scrubViewerAccountId(ACCOUNT_ID);
    expect(r.ok).toBe(true);
    expect(r.scrubbedCount).toBe(0);
  });
});
