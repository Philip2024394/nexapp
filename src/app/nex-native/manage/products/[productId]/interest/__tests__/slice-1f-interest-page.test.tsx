// src/app/nex-native/manage/products/[productId]/interest/__tests__/slice-1f-interest-page.test.tsx
//
// Phase 1 · Slice 1F · owner-authorised 2026-10-24.
// -----------------------------------------------------------------------------
// Verifies the seller-facing per-product interest surface at
// /manage/products/[productId]/interest.
//
// EVIDENCE BOUNDARY (owner directive · do not overstate)
// -----------------------------------------------------------------------------
// Three cleanly-labelled test categories:
//
//   1 · PAGE SOURCE-SHAPE tests
//       Read page.tsx + _interest-dashboard.tsx as text. Assert
//       the wiring: session gate, service call, denial handling,
//       delegation to the dashboard component.
//
//   2 · DASHBOARD RENDER tests
//       Use renderToStaticMarkup (sealed repo convention · see
//       _focused-shop-sheet.test.tsx + _shop-slider-focus.test.tsx)
//       to turn the InterestDashboard into HTML and assert on the
//       output. No DOM, no jsdom, no react-testing-library.
//
//   3 · PAGE BEHAVIOUR tests
//       Mock the session service, product service, and seller-
//       insight service. Invoke the server-component page function.
//       Assert on which routing primitive fired (notFound vs
//       redirect) for each denial case · assert the dashboard
//       received the correct summary on the happy path.
//
// NO DATABASE-EXECUTED ACCESS-CONTROL TESTS live in this file. The
// service's own ownership check was exercised in slice-1e-seller-
// insight.test.ts against mocked Supabase. The page's trust chain
// through the service is tested here against mocked services. A
// real DB test is out of scope · G1 R1 production-release blocker
// remains open.
//
// Hiding a UI link is not access control. The access control is in
// the service layer (Slice 1E) and is reinforced at the page shell
// by routing denials to notFound / redirect. Both layers are
// exercised in this file.

import { describe, test, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

vi.mock("server-only", () => ({}));

/* ─── Hoisted mocks ───────────────────────────────────────────── */

const {
  resolveSessionMock,
  getProductByIdMock,
  getPerProductInterestSummaryMock,
  redirectMock,
  notFoundMock,
} = vi.hoisted(() => ({
  resolveSessionMock: vi.fn(),
  getProductByIdMock: vi.fn(),
  getPerProductInterestSummaryMock: vi.fn(),
  redirectMock: vi.fn(),
  notFoundMock: vi.fn(),
}));

vi.mock("@/lib/nex-native/app/session", () => ({
  resolveNexAppSessionFromContext: resolveSessionMock,
}));

vi.mock("@/lib/nex-native/product-service", () => ({
  getProductById: getProductByIdMock,
  listProductsByBusiness: vi.fn(() => []),
}));

vi.mock("@/lib/nex-native/seller-insights/seller-insight-service", () => ({
  getPerProductInterestSummary: getPerProductInterestSummaryMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock.mockImplementation((url: string) => {
    const err = new Error(`REDIRECT:${url}`);
    (err as unknown as { digest: string }).digest = "NEXT_REDIRECT";
    throw err;
  }),
  notFound: notFoundMock.mockImplementation(() => {
    const err = new Error("NOT_FOUND");
    (err as unknown as { digest: string }).digest = "NEXT_NOT_FOUND";
    throw err;
  }),
}));

/* ─── Fixtures ────────────────────────────────────────────────── */

const SELLER_ID = "11111111-1111-1111-1111-111111111111";
const BUSINESS_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const PRODUCT_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const WINDOW_START = "2026-09-24T00:00:00.000Z";

import type { PerProductInterestSummary } from "@/lib/nex-native/seller-insights/seller-insight-types";

function makeHappyPathSummary(): PerProductInterestSummary {
  return {
    productId: PRODUCT_ID,
    businessId: BUSINESS_ID,
    windowDays: 30,
    windowStart: WINDOW_START,
    views: { events: { state: "available", count: 142 } },
    taps: { events: { state: "available", count: 23 } },
    saves: {
      events: { state: "available", count: 7 },
      uniqueCustomers: { state: "available", count: 7 },
    },
    enquiries: {
      events: { state: "available", count: 5 },
      uniqueCustomers: { state: "available", count: 3 },
    },
    completedOrders: {
      events: { state: "available", count: 2 },
      uniqueCustomers: { state: "available", count: 2 },
    },
  };
}

function installHappyPath() {
  for (const m of [
    resolveSessionMock,
    getProductByIdMock,
    getPerProductInterestSummaryMock,
    redirectMock,
    notFoundMock,
  ]) {
    m.mockReset();
    // Re-install the throwing implementations after reset.
    if (m === redirectMock) {
      m.mockImplementation((url: string) => {
        const err = new Error(`REDIRECT:${url}`);
        (err as unknown as { digest: string }).digest = "NEXT_REDIRECT";
        throw err;
      });
    } else if (m === notFoundMock) {
      m.mockImplementation(() => {
        const err = new Error("NOT_FOUND");
        (err as unknown as { digest: string }).digest = "NEXT_NOT_FOUND";
        throw err;
      });
    }
  }
  resolveSessionMock.mockResolvedValue({
    account: { id: SELLER_ID, nex_handle: "nex-seller", display_name: "Aisha" },
    business: null,
  });
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
  getPerProductInterestSummaryMock.mockResolvedValue({
    ok: true,
    data: makeHappyPathSummary(),
  });
}

async function invokePage(): Promise<unknown> {
  const mod = await import("../page");
  return mod.default({ params: Promise.resolve({ productId: PRODUCT_ID }) });
}

/* ─── 1 · Source-shape tests ─────────────────────────────────── */

const PAGE_SRC = readFileSync(
  resolve(__dirname, "..", "page.tsx"),
  "utf8",
);
const DASH_SRC = readFileSync(
  resolve(__dirname, "..", "_interest-dashboard.tsx"),
  "utf8",
);

/** Strip JS/TS comments so negative-match assertions don't trip on
 *  commentary that only describes what the file does NOT do. Does
 *  not try to preserve URL protocols · acceptable because the
 *  negative assertions here match on user-facing CTA keywords, not
 *  on URLs. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ");
}

const PAGE_CODE = stripComments(PAGE_SRC);
const DASH_CODE = stripComments(DASH_SRC);

describe("Slice 1F · page.tsx · source-shape", () => {
  it("gates on resolveNexAppSessionFromContext and redirects guests", () => {
    expect(PAGE_SRC).toMatch(/resolveNexAppSessionFromContext/);
    expect(PAGE_SRC).toMatch(/if \(!session\)/);
    expect(PAGE_SRC).toMatch(/redirect\(\s*`\/nex-native\/sign-in\?next=/);
  });

  it("calls getProductById and notFounds a missing product", () => {
    expect(PAGE_SRC).toMatch(/productService\.getProductById/);
    expect(PAGE_SRC).toMatch(/if \(!product\) notFound\(\)/);
  });

  it("delegates to getPerProductInterestSummary (no duplicate aggregation in UI)", () => {
    expect(PAGE_SRC).toMatch(/getPerProductInterestSummary\(/);
    // No raw Supabase client access or primary-table reads in the
    // page shell · comments-stripped source. Comments may mention
    // these names in disclaimers; what matters is that the shell
    // never queries them.
    expect(PAGE_CODE).not.toMatch(/nexSupabaseAdmin/);
    expect(PAGE_CODE).not.toMatch(/\.schema\(["']nex["']\)/);
    expect(PAGE_CODE).not.toMatch(/nex_peer_message/);
    expect(PAGE_CODE).not.toMatch(/nex_liked_product/);
    expect(PAGE_CODE).not.toMatch(/discovery_signal/);
    expect(PAGE_CODE).not.toMatch(/nex_order/);
  });

  it("maps every SellerInsightDenial kind to a routing primitive (fail-closed)", () => {
    for (const kind of [
      "not-signed-in",
      "product-not-found",
      "product-not-in-owned-business",
      "business-not-found",
      "not-business-owner",
    ]) {
      expect(PAGE_SRC).toMatch(new RegExp(`case "${kind}"`));
    }
  });

  it("declares G1 R1 production-release blocker remains open", () => {
    expect(PAGE_SRC).toMatch(/G1 R1/);
    // Multi-line comment · match across newlines.
    expect(PAGE_SRC).toMatch(/production release[\s\S]{0,80}blocked by G1/i);
  });

  it("declares Migration 216 unapplied compatibility posture", () => {
    expect(PAGE_SRC).toMatch(/Migration 216/);
    expect(PAGE_SRC).toMatch(/unavailable|does not crash/i);
  });
});

describe("Slice 1F · _interest-dashboard.tsx · source-shape", () => {
  it("does NOT import any data-fetching, session or Supabase surface", () => {
    expect(DASH_SRC).not.toMatch(/supabase/i);
    expect(DASH_SRC).not.toMatch(/resolveNexAppSession/);
    expect(DASH_SRC).not.toMatch(/getProductById|getPerProductInterestSummary/);
    expect(DASH_SRC).not.toMatch(/businessService/);
  });

  it("renders aggregate metrics without a uniqueCustomers field", () => {
    const agg = DASH_SRC.match(
      /function AggregateCard\([\s\S]*?\n\}\n/,
    );
    expect(agg).toBeTruthy();
    expect(agg![0]).not.toMatch(/uniqueCustomers/);
  });

  it("named metrics show BOTH events and uniqueCustomers from the service only", () => {
    const named = DASH_SRC.match(/function NamedCard\([\s\S]*?\n\}\n/);
    expect(named).toBeTruthy();
    expect(named![0]).toMatch(/metric\.events/);
    expect(named![0]).toMatch(/metric\.uniqueCustomers/);
    // No invention: never derives a count from anything other than
    // the service-provided metric.
    expect(named![0]).not.toMatch(/Math\.(ceil|floor|round|max)/);
  });

  it("renders no customer identity fields", () => {
    expect(DASH_SRC).not.toMatch(/nex_handle|display_name|email|phone/);
    expect(DASH_SRC).not.toMatch(/sender_account_id|customer_account_id/);
  });

  it("does NOT render a marketing/export/message CTA (verified via rendered HTML)", async () => {
    // Verified at the render boundary · a CTA would surface in the
    // output HTML of a happy-path render. Checking source alone is
    // brittle because the TS keyword `export` collides with the
    // CTA keyword "Export".
    const InterestDashboard = (await import("../_interest-dashboard"))
      .InterestDashboard;
    const html = renderToStaticMarkup(
      InterestDashboard({
        productId: PRODUCT_ID,
        productName: "P",
        summary: makeHappyPathSummary(),
      }),
    );
    // CTA keywords must not appear in rendered output.
    for (const needle of [
      "Export",
      "Message these",
      "Download",
      "Send to customers",
      "Contact these",
    ]) {
      expect(html).not.toContain(needle);
    }
    // No <button> element should appear in the dashboard output.
    expect(html).not.toMatch(/<button\b/);
  });

  it("surfaces unavailable reason to the seller (no silent zero)", () => {
    expect(DASH_SRC).toMatch(/data unavailable/);
    expect(DASH_SRC).toMatch(/data-nex-metric-reason/);
  });
});

/* ─── 2 · Dashboard render tests · renderToStaticMarkup ──────── */

async function importDashboard() {
  return (await import("../_interest-dashboard")).InterestDashboard;
}

describe("Slice 1F · dashboard render · happy path", () => {
  test("renders product name + window + all five metric cards", async () => {
    const InterestDashboard = await importDashboard();
    const html = renderToStaticMarkup(
      InterestDashboard({
        productId: PRODUCT_ID,
        productName: "Leica M6",
        summary: makeHappyPathSummary(),
      }),
    );
    expect(html).toContain("Leica M6");
    expect(html).toContain("Showing the last 30 days");
    expect(html).toContain("Views");
    expect(html).toContain("Taps");
    expect(html).toContain("Saved");
    expect(html).toContain("Enquiries");
    expect(html).toContain("Confirmed orders");
  });

  test("views + taps render as aggregate · never surface a customer count", async () => {
    const InterestDashboard = await importDashboard();
    const html = renderToStaticMarkup(
      InterestDashboard({
        productId: PRODUCT_ID,
        productName: "P",
        summary: makeHappyPathSummary(),
      }),
    );
    // Each aggregate card is tagged.
    expect(html).toMatch(/data-nex-metric-card="views"[^>]*data-nex-metric-kind="aggregate"/);
    expect(html).toMatch(/data-nex-metric-card="taps"[^>]*data-nex-metric-kind="aggregate"/);
    // Aggregate scope label present.
    expect(html).toContain("Aggregate · anonymous");
    // Numbers appear as events, with the right unit suffix.
    expect(html).toContain("142");
    expect(html).toContain("views observed");
    expect(html).toContain("23");
    expect(html).toContain("taps observed");
  });

  test("named metrics render events + unique customers · distinct values", async () => {
    const InterestDashboard = await importDashboard();
    const html = renderToStaticMarkup(
      InterestDashboard({
        productId: PRODUCT_ID,
        productName: "P",
        summary: makeHappyPathSummary(),
      }),
    );
    // Enquiries: 5 events from 3 customers.
    expect(html).toMatch(/5[\s\S]*?enquiries[\s\S]*?from[\s\S]*?3[\s\S]*?customers/);
    // Confirmed orders: 2 orders from 2 customers.
    expect(html).toMatch(/2[\s\S]*?orders[\s\S]*?from[\s\S]*?2[\s\S]*?customers/);
    // Named scope label present.
    expect(html).toContain("Named · identifiable action");
  });

  test("does NOT render any raw account id or customer handle (service excludes identity)", async () => {
    const InterestDashboard = await importDashboard();
    const html = renderToStaticMarkup(
      InterestDashboard({
        productId: PRODUCT_ID,
        productName: "P",
        summary: makeHappyPathSummary(),
      }),
    );
    // Strip the product-id data-attribute AND the back-link href
    // which is intentionally a product URL (NOT a customer id).
    // After stripping, no UUID shape should survive in the body.
    const cleaned = html
      .replace(/data-nex-product-id="[^"]*"/g, "")
      .replace(/href="[^"]*"/g, "");
    expect(cleaned).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/,
    );
    // Common customer-field names must not appear anywhere.
    expect(html).not.toMatch(/@\w+/); // handle-ish
    expect(html).not.toContain("sender_account_id");
    expect(html).not.toContain("customer_account_id");
  });

  test("confirmed-orders card does NOT describe views, taps or enquiries as sales", async () => {
    const InterestDashboard = await importDashboard();
    const html = renderToStaticMarkup(
      InterestDashboard({
        productId: PRODUCT_ID,
        productName: "P",
        summary: makeHappyPathSummary(),
      }),
    );
    // The caption for Confirmed orders must restrict counting to
    // confirmed sales. The caption text includes "paid or completed"
    // · pending/cancelled are not counted.
    expect(html).toMatch(/Confirmed orders[\s\S]*?paid or completed/);
  });
});

describe("Slice 1F · dashboard render · unavailable / empty / zero", () => {
  test("empty summary (all zeros) renders cleanly · no unavailable states", async () => {
    const InterestDashboard = await importDashboard();
    const zero: ReturnType<typeof makeHappyPathSummary> = {
      ...makeHappyPathSummary(),
      views: { events: { state: "available", count: 0 } },
      taps: { events: { state: "available", count: 0 } },
      saves: {
        events: { state: "available", count: 0 },
        uniqueCustomers: { state: "available", count: 0 },
      },
      enquiries: {
        events: { state: "available", count: 0 },
        uniqueCustomers: { state: "available", count: 0 },
      },
      completedOrders: {
        events: { state: "available", count: 0 },
        uniqueCustomers: { state: "available", count: 0 },
      },
    };
    const html = renderToStaticMarkup(
      InterestDashboard({
        productId: PRODUCT_ID,
        productName: "P",
        summary: zero,
      }),
    );
    // "0 customers" or "0 enquiries" render as values · never as
    // "data unavailable".
    expect(html).toContain("0");
    expect(html).not.toContain("data unavailable");
  });

  test("unavailable aggregate (Migration 208 missing) renders — data unavailable with the reason surfaced", async () => {
    const InterestDashboard = await importDashboard();
    const summary: ReturnType<typeof makeHappyPathSummary> = {
      ...makeHappyPathSummary(),
      views: {
        events: {
          state: "unavailable",
          reason: '42P01: relation "nex.discovery_signal" does not exist',
        },
      },
      taps: {
        events: {
          state: "unavailable",
          reason: '42P01: relation "nex.discovery_signal" does not exist',
        },
      },
    };
    const html = renderToStaticMarkup(
      InterestDashboard({
        productId: PRODUCT_ID,
        productName: "P",
        summary,
      }),
    );
    expect(html).toContain("— data unavailable");
    expect(html).toContain("42P01");
    // The named metrics should still render their numbers.
    expect(html).toMatch(/5[\s\S]*?enquiries/);
  });

  test("partial availability on a named metric (events available, uniques not) is NOT faked", async () => {
    const InterestDashboard = await importDashboard();
    const summary: ReturnType<typeof makeHappyPathSummary> = {
      ...makeHappyPathSummary(),
      enquiries: {
        events: { state: "available", count: 5 },
        uniqueCustomers: {
          state: "unavailable",
          reason: "transient",
        },
      },
    };
    const html = renderToStaticMarkup(
      InterestDashboard({
        productId: PRODUCT_ID,
        productName: "P",
        summary,
      }),
    );
    // The named card falls back to the "unavailable" state when
    // either side is missing · we never invent a unique-customer
    // number.
    const section = html.split('data-nex-metric-card="enquiries"')[1]!;
    const nextCard = section.indexOf("data-nex-metric-card=");
    const cardOnly = nextCard > -1 ? section.slice(0, nextCard) : section;
    expect(cardOnly).toContain("— data unavailable");
  });
});

/* ─── 3 · Page behaviour tests · access control ──────────────── */

describe("Slice 1F · page behaviour · access control", () => {
  beforeEach(() => installHappyPath());

  test("happy path · owning seller receives a dashboard with service data", async () => {
    const el = (await invokePage()) as React.JSX.Element;
    expect(el).toBeTruthy();
    expect(el.type).toBeTypeOf("function");
    // The returned element is <InterestDashboard> with the
    // service's summary as props.
    const props = (el.props ?? {}) as {
      productId?: string;
      productName?: string;
      summary?: unknown;
    };
    expect(props.productId).toBe(PRODUCT_ID);
    expect(props.productName).toBe("Leica M6");
    expect(props.summary).toBeTruthy();
  });

  test("guest · no session · redirects to sign-in with next hop", async () => {
    installHappyPath();
    resolveSessionMock.mockResolvedValueOnce(null);
    await expect(invokePage()).rejects.toThrowError(/^REDIRECT:/);
    const call = redirectMock.mock.calls.at(-1)?.[0] as string;
    expect(call).toContain("/nex-native/sign-in?next=");
    // The next= value is URL-encoded · decode before asserting on
    // the intended destination.
    const decoded = decodeURIComponent(call.split("?next=")[1] ?? "");
    expect(decoded).toContain("/manage/products/");
    expect(decoded).toContain("/interest");
  });

  test("product does not exist · notFound · no leak", async () => {
    installHappyPath();
    getProductByIdMock.mockResolvedValueOnce(null);
    await expect(invokePage()).rejects.toThrowError(/^NOT_FOUND$/);
    expect(notFoundMock).toHaveBeenCalled();
    // No service call should happen if the product does not exist.
    expect(getPerProductInterestSummaryMock).not.toHaveBeenCalled();
  });

  test("service returns product-not-in-owned-business · redirect to /manage · scoped error", async () => {
    installHappyPath();
    getPerProductInterestSummaryMock.mockResolvedValueOnce({
      ok: false,
      reason: { kind: "product-not-in-owned-business" },
    });
    await expect(invokePage()).rejects.toThrowError(/^REDIRECT:/);
    const call = redirectMock.mock.calls.at(-1)?.[0] as string;
    expect(call).toContain("/nex-native/manage?e=interest_forbidden");
  });

  test("service returns product-not-found (defensive) · notFound", async () => {
    installHappyPath();
    getPerProductInterestSummaryMock.mockResolvedValueOnce({
      ok: false,
      reason: { kind: "product-not-found" },
    });
    await expect(invokePage()).rejects.toThrowError(/^NOT_FOUND$/);
    expect(notFoundMock).toHaveBeenCalled();
  });

  test("service returns not-signed-in (defensive) · redirect to sign-in", async () => {
    installHappyPath();
    getPerProductInterestSummaryMock.mockResolvedValueOnce({
      ok: false,
      reason: { kind: "not-signed-in" },
    });
    await expect(invokePage()).rejects.toThrowError(/^REDIRECT:/);
    const call = redirectMock.mock.calls.at(-1)?.[0] as string;
    expect(call).toContain("/nex-native/sign-in");
  });

  test("service returns business-level denials (defence-in-depth) · fail-closed to /manage", async () => {
    for (const kind of ["business-not-found", "not-business-owner"] as const) {
      installHappyPath();
      getPerProductInterestSummaryMock.mockResolvedValueOnce({
        ok: false,
        reason: { kind },
      });
      await expect(invokePage()).rejects.toThrowError(/^REDIRECT:/);
      const call = redirectMock.mock.calls.at(-1)?.[0] as string;
      expect(call).toContain("/nex-native/manage?e=interest_forbidden");
    }
  });

  test("session is passed to the service as sellerAccountId · service determines ownership", async () => {
    installHappyPath();
    await invokePage();
    expect(getPerProductInterestSummaryMock).toHaveBeenCalledTimes(1);
    const args = getPerProductInterestSummaryMock.mock.calls[0]![0];
    expect(args.sellerAccountId).toBe(SELLER_ID);
    expect(args.productId).toBe(PRODUCT_ID);
  });
});

/* ─── 4 · Explicit non-claims ─────────────────────────────── */

describe("Slice 1F · explicit boundary · what this file does NOT prove", () => {
  it("does NOT prove the service's own access-control against a real database", () => {
    // The service is mocked. Real DB enforcement is out of scope.
    // Slice 1E tested service-layer logic against mocked Supabase.
    // G1 R1 production-release blocker remains open.
    expect(true).toBe(true);
  });

  it("does NOT prove that hiding a UI link protects data (service is the enforcer)", () => {
    // UI tests cannot substitute for server-side ownership checks.
    // The service always runs its ownership helper before returning
    // any aggregation query result (verified in Slice 1E).
    expect(true).toBe(true);
  });

  it("does NOT make retention or deletion promises", () => {
    expect(DASH_SRC).not.toMatch(/retention/i);
    expect(DASH_SRC).not.toMatch(/\bdelete your/i);
    expect(PAGE_SRC).not.toMatch(/retention/i);
    expect(PAGE_SRC).not.toMatch(/\bdelete your/i);
  });
});
