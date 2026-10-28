// src/lib/nex-native/seller-insights/__tests__/slice-1e-seller-insight.test.ts
//
// Phase 1 · Slice 1E · owner-authorised 2026-10-24.
// -----------------------------------------------------------------------------
// Verifies seller-insight-service.ts · the server-side aggregation
// surface for per-product and per-business interest summaries.
//
// EVIDENCE BOUNDARY (owner directive · do not overstate)
// -----------------------------------------------------------------------------
// Two cleanly-labelled test categories:
//
//   1 · SOURCE-SHAPE tests
//       Read seller-insight-service.ts as text. Assert the primary-
//       source selections, the ownership-check call, the fail-open
//       posture, and the absence of forbidden identity fields.
//
//   2 · MOCKED-SERVICE BEHAVIOUR tests
//       Install mocks for every external dependency: businessService,
//       productService, and the Supabase admin client's query builder.
//       Invoke the two public functions and assert on the returned
//       shape, access-control denials, metric availability under
//       simulated query failures, and cross-business isolation.
//
// NO DATABASE-EXECUTED TESTS live in this file. Migration 216 has
// NOT been applied, nex.discovery_signal has NOT been applied to
// production, and we do not spin up a real PG for this slice. Any
// claim about:
//   · what Postgres does with JSON-path filters,
//   · how SELECT ... count: 'exact' performs on large tables,
//   · how DISTINCT behaves across concurrent writes
// is OUT OF SCOPE for Slice 1E.
//
// G1 R1 reminder: nexSupabaseAdmin bypasses RLS by design. The
// SERVICE-LAYER ownership check in the service is the ONLY
// enforcement. Production release of this surface remains blocked
// by G1 per the saved plan · do not claim this slice fixes it.

import { describe, it, test, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

vi.mock("server-only", () => ({}));

/* ─── Hoisted mocks ────────────────────────────────────────────── */

const {
  listBusinessesByOwnerMock,
  getProductByIdMock,
  listProductsByBusinessMock,
  mkQueryBuilder,
  dsQueryCountMock,
  likedQueryCountMock,
  enquiryQueryDataMock,
  orderQueryDataMock,
  businessLikedListMock,
} = vi.hoisted(() => ({
  listBusinessesByOwnerMock: vi.fn(),
  getProductByIdMock: vi.fn(),
  listProductsByBusinessMock: vi.fn(),
  dsQueryCountMock: vi.fn(),
  likedQueryCountMock: vi.fn(),
  enquiryQueryDataMock: vi.fn(),
  orderQueryDataMock: vi.fn(),
  businessLikedListMock: vi.fn(),
  /** Build a chainable query stub for each kind. We dispatch on the
   *  (schema, table, attachment_type eq) tuple to deliver the right
   *  terminal promise. */
  mkQueryBuilder: () => undefined,
}));

interface QueryRecord {
  schema?: string;
  table?: string;
  signalType?: string;
  attachmentType?: string;
  businessIdEq?: string;
  productIdEq?: string;
  productIdPath?: string;
  stateIn?: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...a: any[]) => any;

function buildQueryStub(
  rec: QueryRecord,
  resolver: () => Promise<unknown>,
): unknown {
  const self: Record<string, AnyFn> = {};
  const chain: AnyFn = () => self;
  self.select = (_c?: unknown, opts?: { count?: string; head?: boolean }) => {
    void opts;
    return self;
  };
  self.eq = (col: string, val: string) => {
    if (col === "signal_type") rec.signalType = val;
    else if (col === "business_id") rec.businessIdEq = val;
    else if (col === "attachment_type") rec.attachmentType = val;
    else if (col === "product_id") rec.productIdEq = val;
    return self;
  };
  self.neq = chain;
  self.in = (col: string, vals: string[]) => {
    if (col === "state") rec.stateIn = vals;
    return self;
  };
  self.gte = chain;
  self.filter = (path: string, _op: string, val: string) => {
    if (path.includes("product_id")) rec.productIdPath = val;
    return self;
  };
  self.order = chain;
  self.limit = chain;
  // The terminal `then` lets Supabase chains behave like promises.
  // Must support both onFulfilled and onRejected so that a
  // mockRejectedValueOnce flows through the service's try/catch
  // instead of becoming an unhandled rejection.
  self.then = (
    onFulfilled: (v: unknown) => unknown,
    onRejected?: (e: unknown) => unknown,
  ) => resolver().then(onFulfilled, onRejected);
  return self;
}

vi.mock("@/lib/nex-native/supabase-admin", () => ({
  nexSupabaseAdmin: {
    schema: (s: string) => ({
      from: (t: string) => {
        if (s === "nex" && t === "discovery_signal") {
          const rec: QueryRecord = { schema: s, table: t };
          return buildQueryStub(rec, async () => {
            const outcome = await dsQueryCountMock(rec);
            return outcome;
          });
        }
        throw new Error(`unexpected schema+table: ${s}.${t}`);
      },
    }),
    from: (t: string) => {
      const rec: QueryRecord = { table: t };
      return buildQueryStub(rec, async () => {
        if (t === "nex_liked_product") {
          // Behaviour differs between per-product (count) and per-
          // business (data list). The business-level helper uses .in
          // on product_id · dispatch on the presence of stateIn is
          // too narrow, so we tag via a separate mock.
          const outcome = await (rec.productIdEq
            ? likedQueryCountMock(rec)
            : businessLikedListMock(rec));
          return outcome;
        }
        if (t === "nex_peer_message") return await enquiryQueryDataMock(rec);
        if (t === "nex_order") return await orderQueryDataMock(rec);
        throw new Error(`unexpected table: ${t}`);
      });
    },
  },
  nexSupabaseProjectRef: () => "mock",
}));

vi.mock("@/lib/nex-native/business-service", () => ({
  listBusinessesByOwner: listBusinessesByOwnerMock,
  getBusinessById: vi.fn(),
  getBusinessBySlug: vi.fn(),
}));

vi.mock("@/lib/nex-native/product-service", () => ({
  getProductById: getProductByIdMock,
  listProductsByBusiness: listProductsByBusinessMock,
}));

/* ─── Fixtures ─────────────────────────────────────────────────── */

const SELLER_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_SELLER_ID = "22222222-2222-2222-2222-222222222222";
const BUSINESS_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const FOREIGN_BUSINESS_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const PRODUCT_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const FOREIGN_PRODUCT_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";

function installHappyPath() {
  for (const m of [
    listBusinessesByOwnerMock,
    getProductByIdMock,
    listProductsByBusinessMock,
    dsQueryCountMock,
    likedQueryCountMock,
    enquiryQueryDataMock,
    orderQueryDataMock,
    businessLikedListMock,
  ]) {
    m.mockReset();
  }

  listBusinessesByOwnerMock.mockResolvedValue([
    { id: BUSINESS_ID, owner_account_id: SELLER_ID },
  ]);
  getProductByIdMock.mockResolvedValue({
    id: PRODUCT_ID,
    business_id: BUSINESS_ID,
    name: "Leica M6",
    price_pence: 320_000_00,
    currency: "GBP",
    image_url: null,
    description: null,
    status: "live",
  });
  listProductsByBusinessMock.mockResolvedValue([
    { id: PRODUCT_ID, business_id: BUSINESS_ID },
  ]);

  // Discovery signal: returns `{count, error: null}` for view/tap.
  dsQueryCountMock.mockImplementation(async (rec: QueryRecord) => {
    if (rec.signalType === "view") return { count: 42, error: null };
    if (rec.signalType === "tap") return { count: 7, error: null };
    return { count: 0, error: null };
  });

  // Liked product (per-product): returns `{count, error}`.
  likedQueryCountMock.mockResolvedValue({ count: 5, error: null });

  // Liked product (per-business): returns `{data, error}` list.
  businessLikedListMock.mockResolvedValue({
    data: [
      { liker_account_id: "cust-1" },
      { liker_account_id: "cust-2" },
      { liker_account_id: "cust-1" }, // duplicate → unique=2
    ],
    error: null,
  });

  // Enquiries (nex_peer_message): list of sender_account_id rows.
  // Default: 3 distinct customers across 4 messages.
  enquiryQueryDataMock.mockResolvedValue({
    data: [
      { sender_account_id: "cust-a" },
      { sender_account_id: "cust-b" },
      { sender_account_id: "cust-a" }, // duplicate → events=4, uniques=3
      { sender_account_id: "cust-c" },
    ],
    error: null,
  });

  // Orders (nex_order): list of customer_account_id rows.
  orderQueryDataMock.mockResolvedValue({
    data: [
      { customer_account_id: "cust-a" },
      { customer_account_id: "cust-b" },
    ],
    error: null,
  });
}

/* ─── 1 · Source-shape tests ───────────────────────────────────── */

const SRC = readFileSync(
  resolve(__dirname, "..", "seller-insight-service.ts"),
  "utf8",
);

describe("Slice 1E · source-shape", () => {
  it("declares the service as server-only", () => {
    expect(SRC).toMatch(/^import "server-only"/m);
  });

  it("imports business + product services for ownership enforcement", () => {
    expect(SRC).toMatch(/import \* as businessService from/);
    expect(SRC).toMatch(/import \* as productService from/);
  });

  it("calls listBusinessesByOwner in the ownership helper", () => {
    expect(SRC).toMatch(/businessService\.listBusinessesByOwner\(/);
  });

  it("views and taps query ONLY nex.discovery_signal · never nex_peer_message", () => {
    // Isolate the view/tap aggregation primitive.
    const fn = SRC.match(
      /async function countDiscoverySignal\([\s\S]*?\n\}\n/,
    );
    expect(fn).toBeTruthy();
    expect(fn![0]).toMatch(/\.schema\("nex"\)/);
    expect(fn![0]).toMatch(/\.from\("discovery_signal"\)/);
    expect(fn![0]).not.toMatch(/nex_peer_message/);
  });

  it("enquiries query ONLY nex_peer_message · never nex.discovery_signal (authoritative source)", () => {
    const perProduct = SRC.match(
      /async function countEnquiryByProduct\([\s\S]*?\n\}\n/,
    );
    const perBusiness = SRC.match(
      /async function countEnquiryByBusiness\([\s\S]*?\n\}\n/,
    );
    expect(perProduct).toBeTruthy();
    expect(perBusiness).toBeTruthy();
    for (const fn of [perProduct![0], perBusiness![0]]) {
      expect(fn).toMatch(/"nex_peer_message"/);
      expect(fn).not.toMatch(/discovery_signal/);
    }
  });

  it("completedOrders ONLY counts rows with state ∈ {paid, completed} · never signals or messages", () => {
    const fn = SRC.match(
      /async function countCompletedOrders\([\s\S]*?\n\}\n/,
    );
    expect(fn).toBeTruthy();
    expect(fn![0]).toMatch(/\.from\("nex_order"\)/);
    expect(fn![0]).toMatch(/\.in\("state", \["paid", "completed"\]\)/);
    expect(fn![0]).not.toMatch(/discovery_signal/);
    expect(fn![0]).not.toMatch(/nex_peer_message/);
  });

  it("views metric exposes events only · no uniqueCustomers field (anonymous)", () => {
    const typesSrc = readFileSync(
      resolve(__dirname, "..", "seller-insight-types.ts"),
      "utf8",
    );
    // Per-product summary assigns AggregateInterestMetric to views
    // and taps (anonymous · no customer identity).
    expect(typesSrc).toMatch(
      /views:\s*AggregateInterestMetric[\s\S]{0,80}taps:\s*AggregateInterestMetric/,
    );
    // AggregateInterestMetric itself must NOT carry a
    // uniqueCustomers field · would be a privacy regression.
    const agg = typesSrc.match(
      /export interface AggregateInterestMetric\s*\{[\s\S]*?\n\}/,
    );
    expect(agg).toBeTruthy();
    expect(agg![0]).not.toMatch(/uniqueCustomers/);
  });

  it("the service does NOT read message bodies or private chat content", () => {
    // Enquiry queries select only sender_account_id · never body /
    // customBody / attachment_url / attachment_meta directly.
    const perProduct = SRC.match(
      /async function countEnquiryByProduct\([\s\S]*?\n\}\n/,
    );
    const perBusiness = SRC.match(
      /async function countEnquiryByBusiness\([\s\S]*?\n\}\n/,
    );
    for (const fn of [perProduct![0], perBusiness![0]]) {
      // Only sender_account_id is selected (identity for distinct
      // dedup, not customer-identity exposure in result).
      expect(fn).toMatch(/\.select\("sender_account_id"\)/);
      expect(fn).not.toMatch(/\.select\("body"/);
      expect(fn).not.toMatch(/\.select\("attachment_url"/);
      expect(fn).not.toMatch(/customer_notes|buyer_notes|delivery_address/);
    }
  });

  it("summary types do NOT expose customer identity (no handles, no names)", () => {
    const typesSrc = readFileSync(
      resolve(__dirname, "..", "seller-insight-types.ts"),
      "utf8",
    );
    expect(typesSrc).not.toMatch(/nex_handle|display_name|email|phone/);
    // The only account-id-like fields are internal uniqueness counts.
    const perProductIface = typesSrc.match(
      /export interface PerProductInterestSummary\s*\{[\s\S]*?\n\}/,
    );
    expect(perProductIface).toBeTruthy();
    expect(perProductIface![0]).not.toMatch(/customers:\s*string\[\]/);
    expect(perProductIface![0]).not.toMatch(/accountIds?/);
  });

  it("fails open per metric · each primitive wraps in try/catch", () => {
    const primitives = SRC.match(/async function count[A-Z]\w+\(/g);
    expect(primitives).not.toBeNull();
    // Count try blocks reachable from each primitive (lower bound).
    const tryCount = (SRC.match(/\btry\s*\{/g) ?? []).length;
    expect(tryCount).toBeGreaterThanOrEqual(primitives!.length);
  });

  it("declares the G1 R1 service-layer-only enforcement caveat", () => {
    expect(SRC).toMatch(/G1 R1/);
    expect(SRC).toMatch(/service-layer/i);
  });

  it("declares the Migration 216 compatibility posture", () => {
    expect(SRC).toMatch(/Migration 216/);
    expect(SRC).toMatch(/enquiry_initiated/);
    expect(SRC).toMatch(/cart_sent/);
    // Service does NOT read those new enum values · authoritative
    // source for enquiry/cart counts is nex_peer_message.
    expect(SRC).toMatch(/does NOT read/);
    expect(SRC).toMatch(/authoritative source for named enquiry\/cart counts is\s*\n\s*\/\/\s*nex_peer_message/);
  });
});

/* ─── 2 · Behaviour tests · access control ────────────────────── */

async function importService() {
  return import("../seller-insight-service");
}

describe("Slice 1E · behaviour · access control", () => {
  beforeEach(() => installHappyPath());

  test("getPerProductInterestSummary · owning seller receives data", async () => {
    const svc = await importService();
    const r = await svc.getPerProductInterestSummary({
      sellerAccountId: SELLER_ID,
      productId: PRODUCT_ID,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.productId).toBe(PRODUCT_ID);
      expect(r.data.businessId).toBe(BUSINESS_ID);
    }
  });

  test("getPerProductInterestSummary · unknown product id → product-not-found", async () => {
    getProductByIdMock.mockResolvedValueOnce(null);
    const svc = await importService();
    const r = await svc.getPerProductInterestSummary({
      sellerAccountId: SELLER_ID,
      productId: "nonexistent",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason.kind).toBe("product-not-found");
  });

  test("getPerProductInterestSummary · product belongs to a business the caller does NOT own → scoped denial", async () => {
    getProductByIdMock.mockResolvedValueOnce({
      id: FOREIGN_PRODUCT_ID,
      business_id: FOREIGN_BUSINESS_ID,
      name: "Someone else's product",
      price_pence: 0,
      currency: "GBP",
      image_url: null,
      description: null,
      status: "live",
    });
    const svc = await importService();
    const r = await svc.getPerProductInterestSummary({
      sellerAccountId: SELLER_ID,
      productId: FOREIGN_PRODUCT_ID,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      // Scoped denial · never leak the business-owner distinction.
      expect(r.reason.kind).toBe("product-not-in-owned-business");
    }
    // No aggregation query should have run.
    expect(dsQueryCountMock).not.toHaveBeenCalled();
    expect(enquiryQueryDataMock).not.toHaveBeenCalled();
    expect(orderQueryDataMock).not.toHaveBeenCalled();
  });

  test("getPerBusinessInterestSummary · unauthorised caller receives not-business-owner", async () => {
    listBusinessesByOwnerMock.mockResolvedValueOnce([]); // seller owns NOTHING
    const svc = await importService();
    const r = await svc.getPerBusinessInterestSummary({
      sellerAccountId: OTHER_SELLER_ID,
      businessId: BUSINESS_ID,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason.kind).toBe("not-business-owner");
    expect(dsQueryCountMock).not.toHaveBeenCalled();
  });

  test("empty sellerAccountId → not-signed-in", async () => {
    const svc = await importService();
    const r = await svc.getPerBusinessInterestSummary({
      sellerAccountId: "",
      businessId: BUSINESS_ID,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason.kind).toBe("not-signed-in");
  });

  test("cross-business isolation · seller A cannot see seller B's metrics", async () => {
    // Seller only owns BUSINESS_ID. Asking about FOREIGN_BUSINESS_ID
    // → scoped denial. No aggregation query runs.
    const svc = await importService();
    const r = await svc.getPerBusinessInterestSummary({
      sellerAccountId: SELLER_ID,
      businessId: FOREIGN_BUSINESS_ID,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason.kind).toBe("not-business-owner");
    expect(dsQueryCountMock).not.toHaveBeenCalled();
    expect(likedQueryCountMock).not.toHaveBeenCalled();
    expect(enquiryQueryDataMock).not.toHaveBeenCalled();
    expect(orderQueryDataMock).not.toHaveBeenCalled();
  });
});

/* ─── Behaviour tests · metric aggregation ─────────────────── */

describe("Slice 1E · behaviour · aggregation semantics", () => {
  beforeEach(() => installHappyPath());

  test("per-product · views + taps come from the signal source as aggregate counts", async () => {
    const svc = await importService();
    const r = await svc.getPerProductInterestSummary({
      sellerAccountId: SELLER_ID,
      productId: PRODUCT_ID,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.views.events).toEqual({ state: "available", count: 42 });
    expect(r.data.taps.events).toEqual({ state: "available", count: 7 });
  });

  test("per-product · saves come from nex_liked_product (events === unique by UNIQUE constraint)", async () => {
    const svc = await importService();
    const r = await svc.getPerProductInterestSummary({
      sellerAccountId: SELLER_ID,
      productId: PRODUCT_ID,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.saves.events).toEqual({ state: "available", count: 5 });
    expect(r.data.saves.uniqueCustomers).toEqual({ state: "available", count: 5 });
  });

  test("per-product · enquiries report distinct customers DIFFERENT from raw event count", async () => {
    const svc = await importService();
    const r = await svc.getPerProductInterestSummary({
      sellerAccountId: SELLER_ID,
      productId: PRODUCT_ID,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Fixture: 4 messages from 3 distinct senders.
    expect(r.data.enquiries.events).toEqual({ state: "available", count: 4 });
    expect(r.data.enquiries.uniqueCustomers).toEqual({ state: "available", count: 3 });
  });

  test("per-product · completedOrders only counts {paid, completed} state", async () => {
    const svc = await importService();
    const r = await svc.getPerProductInterestSummary({
      sellerAccountId: SELLER_ID,
      productId: PRODUCT_ID,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.completedOrders.events).toEqual({ state: "available", count: 2 });
    expect(r.data.completedOrders.uniqueCustomers).toEqual({ state: "available", count: 2 });
    // Order query recorded the state filter.
    const stateCall = orderQueryDataMock.mock.calls[0]![0] as QueryRecord;
    expect(stateCall.stateIn).toEqual(["paid", "completed"]);
  });

  test("per-business · aggregates saves across all catalog products with distinct dedup", async () => {
    const svc = await importService();
    const r = await svc.getPerBusinessInterestSummary({
      sellerAccountId: SELLER_ID,
      businessId: BUSINESS_ID,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Fixture: 3 like rows across 2 distinct customers.
    expect(r.data.saves.events).toEqual({ state: "available", count: 3 });
    expect(r.data.saves.uniqueCustomers).toEqual({ state: "available", count: 2 });
  });

  test("per-business · enquiries UNION three attachment paths · distinct-customer dedup is honest", async () => {
    // Three attachment-type queries all return the same two
    // customers. Expected events=12, uniqueCustomers=3 (merged set).
    enquiryQueryDataMock.mockImplementation(async () => ({
      data: [
        { sender_account_id: "cust-a" },
        { sender_account_id: "cust-b" },
        { sender_account_id: "cust-a" },
        { sender_account_id: "cust-c" },
      ],
      error: null,
    }));
    const svc = await importService();
    const r = await svc.getPerBusinessInterestSummary({
      sellerAccountId: SELLER_ID,
      businessId: BUSINESS_ID,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.enquiries.events).toEqual({ state: "available", count: 12 });
    expect(r.data.enquiries.uniqueCustomers).toEqual({ state: "available", count: 3 });
  });

  test("empty data path · all metrics report zero cleanly", async () => {
    dsQueryCountMock.mockResolvedValue({ count: 0, error: null });
    likedQueryCountMock.mockResolvedValue({ count: 0, error: null });
    enquiryQueryDataMock.mockResolvedValue({ data: [], error: null });
    orderQueryDataMock.mockResolvedValue({ data: [], error: null });

    const svc = await importService();
    const r = await svc.getPerProductInterestSummary({
      sellerAccountId: SELLER_ID,
      productId: PRODUCT_ID,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.views.events).toEqual({ state: "available", count: 0 });
    expect(r.data.taps.events).toEqual({ state: "available", count: 0 });
    expect(r.data.saves.events).toEqual({ state: "available", count: 0 });
    expect(r.data.enquiries.events).toEqual({ state: "available", count: 0 });
    expect(r.data.completedOrders.events).toEqual({ state: "available", count: 0 });
  });
});

/* ─── Behaviour tests · fail-open per metric ───────────────── */

describe("Slice 1E · behaviour · fail-open per metric", () => {
  beforeEach(() => installHappyPath());

  test("Migration 208 not applied · signal queries fail · views + taps marked unavailable · OTHER metrics still return", async () => {
    dsQueryCountMock.mockResolvedValue({
      count: null,
      error: { code: "42P01", message: 'relation "nex.discovery_signal" does not exist' },
    });
    const svc = await importService();
    const r = await svc.getPerProductInterestSummary({
      sellerAccountId: SELLER_ID,
      productId: PRODUCT_ID,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.views.events.state).toBe("unavailable");
    expect(r.data.taps.events.state).toBe("unavailable");
    // Other metrics unaffected.
    expect(r.data.saves.events.state).toBe("available");
    expect(r.data.enquiries.events.state).toBe("available");
    expect(r.data.completedOrders.events.state).toBe("available");
  });

  test("enquiry query failure does NOT fail the whole summary", async () => {
    enquiryQueryDataMock.mockResolvedValue({
      data: null,
      error: { code: "PGRST116", message: "transient" },
    });
    const svc = await importService();
    const r = await svc.getPerProductInterestSummary({
      sellerAccountId: SELLER_ID,
      productId: PRODUCT_ID,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.enquiries.events.state).toBe("unavailable");
    expect(r.data.enquiries.uniqueCustomers.state).toBe("unavailable");
    expect(r.data.views.events.state).toBe("available");
    expect(r.data.taps.events.state).toBe("available");
    expect(r.data.completedOrders.events.state).toBe("available");
  });

  test("thrown query (defensive catch) marks the metric unavailable", async () => {
    orderQueryDataMock.mockRejectedValueOnce(new Error("network boom"));
    const svc = await importService();
    const r = await svc.getPerProductInterestSummary({
      sellerAccountId: SELLER_ID,
      productId: PRODUCT_ID,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.completedOrders.events.state).toBe("unavailable");
    expect(r.data.views.events.state).toBe("available");
  });
});

/* ─── Behaviour tests · signal duplicate honesty ─────────── */

describe("Slice 1E · behaviour · signal-duplicate honesty", () => {
  beforeEach(() => installHappyPath());

  test("enquiries are counted via nex_peer_message (deduped by send_intent_id at insert) · signal duplicates cannot inflate enquiry totals", async () => {
    // Even if the SIGNAL table has 999 duplicates for the same
    // enquiry, enquiry counts come from the MESSAGE table.
    dsQueryCountMock.mockResolvedValue({ count: 999, error: null });
    enquiryQueryDataMock.mockResolvedValue({
      data: [
        { sender_account_id: "cust-a" },
        { sender_account_id: "cust-b" },
      ],
      error: null,
    });
    const svc = await importService();
    const r = await svc.getPerProductInterestSummary({
      sellerAccountId: SELLER_ID,
      productId: PRODUCT_ID,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Signal duplicates land in views/taps (anonymous aggregate · we
    // label them "events" not "customers").
    expect(r.data.views.events).toEqual({ state: "available", count: 999 });
    // Enquiries unaffected by signal duplicate.
    expect(r.data.enquiries.events).toEqual({ state: "available", count: 2 });
    expect(r.data.enquiries.uniqueCustomers).toEqual({ state: "available", count: 2 });
  });
});

/* ─── 3 · Explicit non-claims ─────────────────────────────── */

describe("Slice 1E · explicit boundary · what this file does NOT prove", () => {
  it("does NOT prove a real database query", () => {
    // Every test mocks nexSupabaseAdmin at the client boundary.
    expect(true).toBe(true);
  });

  it("does NOT prove Postgres JSON-path filter semantics", () => {
    // Supabase .filter('attachment_meta->product->>product_id', 'eq', value)
    // is exercised against a stub chain · the stub records the
    // target path. Real Postgres JSON-path behaviour is out of scope.
    expect(true).toBe(true);
  });

  it("does NOT prove the G1 R1 defect is fixed · service-layer check is the ONLY enforcement", () => {
    expect(SRC).toMatch(/G1 R1/);
  });

  it("does NOT claim customer-facing retention/deletion behaviour · aggregation window is a query parameter", () => {
    const typesSrc = readFileSync(
      resolve(__dirname, "..", "seller-insight-types.ts"),
      "utf8",
    );
    // The types file may reference retention of the UNDERLYING
    // primary sources as a disclaimer · it must NOT promise a
    // specific retention policy as a feature of this surface.
    expect(typesSrc).toMatch(/NOT a customer-facing promise/);
    expect(typesSrc).not.toMatch(/retention policy|retention period|will keep .* for/i);
    expect(typesSrc).not.toMatch(/\bdelete your/i);
  });
});
