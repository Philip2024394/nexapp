// src/lib/nex-native/seller-insights/seller-insight-service.ts
//
// Phase 1 · Slice 1E · owner-authorised 2026-10-24.
// -----------------------------------------------------------------------------
// Server-side aggregation reads for the seller "interested customers"
// surface. See the sealed types module for the design principles.
//
// This service is READ-ONLY · no mutations · no new table · no new
// migration. Every aggregation targets a single primary source so
// counts cannot overlap:
//
//   views / taps        ← nex.discovery_signal     (anonymous events)
//   saves               ← nex_liked_product        (UNIQUE pair)
//   enquiries           ← nex_peer_message         (idempotent via
//                                                   send_intent_id)
//   completedOrders     ← nex_order                (state filter)
//
// Access control: every public function enforces seller ownership
// BEFORE running any query. nexSupabaseAdmin bypasses RLS by design
// (service-role · the known G1 R1 defect means we cannot rely on
// nex_peer_message RLS). Service-layer checks are the ONLY
// enforcement until the B99+rls-harden migration lands · production
// release of this surface remains blocked by G1 per the saved plan.
//
// Fail-open per metric: individual query failures mark that metric
// `unavailable` with a diagnostic reason. The summary is still
// returned with the remaining metrics intact · a dashboard can
// render "— data unavailable" per metric rather than crash the
// whole page.
//
// Migration 216 compatibility: this service does NOT read
// `enquiry_initiated` or `cart_sent` signal rows. Those exist in
// nex.discovery_signal if the writer is enabled, but the
// authoritative source for named enquiry/cart counts is
// nex_peer_message. Signal rows are used ONLY for anonymous
// view/tap aggregates (pre-existing signal types).

import "server-only";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import * as businessService from "@/lib/nex-native/business-service";
import * as productService from "@/lib/nex-native/product-service";
import {
  DEFAULT_WINDOW_DAYS,
  type AggregateInterestMetric,
  type MetricState,
  type NamedInterestMetric,
  type PerBusinessInterestSummary,
  type PerProductInterestSummary,
  type SellerInsightResult,
} from "./seller-insight-types";

/* ─── Internal helpers ───────────────────────────────────────── */

function windowStartIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

function unavailable(reason: string): MetricState {
  return { state: "unavailable", reason };
}

function available(count: number): MetricState {
  return { state: "available", count };
}

/** Verify the seller owns the business. Returns the owned business
 *  ids on success; a denial reason on failure. The service NEVER
 *  returns a decoy "0 metrics" response for an unauthorised caller
 *  · we fail CLOSED on access control. */
async function assertSellerOwnsBusiness(
  sellerAccountId: string,
  businessId: string,
): Promise<SellerInsightResult<readonly string[]>> {
  if (!sellerAccountId) {
    return { ok: false, reason: { kind: "not-signed-in" } };
  }
  const owned = await businessService.listBusinessesByOwner(sellerAccountId);
  const ownedIds = owned.map((b) => b.id);
  if (!ownedIds.includes(businessId)) {
    return { ok: false, reason: { kind: "not-business-owner" } };
  }
  return { ok: true, data: ownedIds };
}

/* ─── Aggregation primitives ─────────────────────────────────── */

/** Anonymous aggregate from nex.discovery_signal. Returns event
 *  count only · never derives a unique-customer count (would leak
 *  identity for small-N product-view histories). Fails open: any
 *  query error marks the metric unavailable. */
async function countDiscoverySignal(args: {
  signalType: "view" | "tap";
  businessId: string;
  productId?: string;
  windowStart: string;
}): Promise<AggregateInterestMetric> {
  try {
    let q = nexSupabaseAdmin
      .schema("nex")
      .from("discovery_signal")
      .select("id", { count: "exact", head: true })
      .eq("signal_type", args.signalType)
      .eq("business_id", args.businessId)
      .gte("created_at", args.windowStart);
    if (args.productId) {
      q = q.filter("metadata->>product_id", "eq", args.productId);
    }
    const { count, error } = await q;
    if (error) {
      return { events: unavailable(`${error.code ?? "unknown"}: ${error.message}`) };
    }
    return { events: available(count ?? 0) };
  } catch (err) {
    return {
      events: unavailable(err instanceof Error ? err.message : String(err)),
    };
  }
}

/** Named save metric from nex_liked_product. The UNIQUE(liker,
 *  product) constraint means events === uniqueCustomers · we
 *  return both for API symmetry. */
async function countSavedProduct(args: {
  productId: string;
  windowStart: string;
}): Promise<NamedInterestMetric> {
  try {
    const { count, error } = await nexSupabaseAdmin
      .from("nex_liked_product")
      .select("liker_account_id", { count: "exact", head: true })
      .eq("product_id", args.productId)
      .gte("liked_at", args.windowStart);
    if (error) {
      const reason = `${error.code ?? "unknown"}: ${error.message}`;
      return { events: unavailable(reason), uniqueCustomers: unavailable(reason) };
    }
    const n = count ?? 0;
    return { events: available(n), uniqueCustomers: available(n) };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { events: unavailable(reason), uniqueCustomers: unavailable(reason) };
  }
}

/** Named enquiry metric from nex_peer_message. The authoritative
 *  source · send_intent_id dedups retries at insert time so count
 *  of rows is a reliable count of distinct enquiry events.
 *
 *  Unique customers = DISTINCT sender_account_id. Supabase JS SDK
 *  cannot DISTINCT · we fetch the sender ids in-window and dedupe
 *  in JS. Bounded by the window; first-phase surface is per-
 *  product or per-business for one owner · N is small.
 *
 *  For per-product scope: filter attachment_type='product' AND
 *  attachment_meta->'product'->>'product_id' = productId.
 *
 *  For per-business scope: UNION the three attachment paths that
 *  carry a seller-side business id:
 *    product    · attachment_meta->'product'->>'business_id'
 *    menu_item  · attachment_meta->'menu_item'->>'business_id'
 *    cart_order · attachment_meta->'cart'->>'shop_id' */
async function countEnquiryByProduct(args: {
  productId: string;
  windowStart: string;
  excludeSender: string;
}): Promise<NamedInterestMetric> {
  try {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_peer_message")
      .select("sender_account_id")
      .eq("attachment_type", "product")
      .filter("attachment_meta->product->>product_id", "eq", args.productId)
      .neq("sender_account_id", args.excludeSender)
      .gte("sent_at", args.windowStart);
    if (error) {
      const reason = `${error.code ?? "unknown"}: ${error.message}`;
      return { events: unavailable(reason), uniqueCustomers: unavailable(reason) };
    }
    const rows = (data ?? []) as Array<{ sender_account_id: string }>;
    const events = rows.length;
    const unique = new Set(rows.map((r) => r.sender_account_id)).size;
    return { events: available(events), uniqueCustomers: available(unique) };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { events: unavailable(reason), uniqueCustomers: unavailable(reason) };
  }
}

async function countEnquiryByBusiness(args: {
  businessId: string;
  windowStart: string;
  excludeSender: string;
}): Promise<NamedInterestMetric> {
  try {
    // Three independent queries · we UNION the sender id sets in JS.
    // Supabase JS SDK doesn't support true SQL UNION; the N here is
    // bounded by the window + one seller's enquiries so three small
    // reads are fine for the first-phase dashboard. If this grows,
    // a dedicated RPC can replace it later.
    const [productRes, menuRes, cartRes] = await Promise.all([
      nexSupabaseAdmin
        .from("nex_peer_message")
        .select("sender_account_id")
        .eq("attachment_type", "product")
        .filter("attachment_meta->product->>business_id", "eq", args.businessId)
        .neq("sender_account_id", args.excludeSender)
        .gte("sent_at", args.windowStart),
      nexSupabaseAdmin
        .from("nex_peer_message")
        .select("sender_account_id")
        .eq("attachment_type", "menu_item")
        .filter(
          "attachment_meta->menu_item->>business_id",
          "eq",
          args.businessId,
        )
        .neq("sender_account_id", args.excludeSender)
        .gte("sent_at", args.windowStart),
      nexSupabaseAdmin
        .from("nex_peer_message")
        .select("sender_account_id")
        .eq("attachment_type", "cart_order")
        .filter("attachment_meta->cart->>shop_id", "eq", args.businessId)
        .neq("sender_account_id", args.excludeSender)
        .gte("sent_at", args.windowStart),
    ]);
    const errors = [productRes.error, menuRes.error, cartRes.error].filter(
      Boolean,
    );
    if (errors.length > 0) {
      const e = errors[0]!;
      const reason = `${e.code ?? "unknown"}: ${e.message}`;
      return { events: unavailable(reason), uniqueCustomers: unavailable(reason) };
    }
    type Row = { sender_account_id: string };
    const senders: string[] = [
      ...((productRes.data ?? []) as Row[]),
      ...((menuRes.data ?? []) as Row[]),
      ...((cartRes.data ?? []) as Row[]),
    ].map((r) => r.sender_account_id);
    const events = senders.length;
    const unique = new Set(senders).size;
    return { events: available(events), uniqueCustomers: available(unique) };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { events: unavailable(reason), uniqueCustomers: unavailable(reason) };
  }
}

/** Named completed-order metric. Authoritative source: nex_order
 *  filtered to state ∈ {paid, completed}. Signals are NEVER
 *  counted as confirmed sales (owner directive). */
async function countCompletedOrders(args: {
  businessId: string;
  productId?: string;
  windowStart: string;
}): Promise<NamedInterestMetric> {
  try {
    let q = nexSupabaseAdmin
      .from("nex_order")
      .select("customer_account_id")
      .eq("business_id", args.businessId)
      .in("state", ["paid", "completed"])
      .gte("created_at", args.windowStart);
    if (args.productId) {
      q = q.eq("product_id", args.productId);
    }
    const { data, error } = await q;
    if (error) {
      const reason = `${error.code ?? "unknown"}: ${error.message}`;
      return { events: unavailable(reason), uniqueCustomers: unavailable(reason) };
    }
    const rows = (data ?? []) as Array<{ customer_account_id: string }>;
    const events = rows.length;
    const unique = new Set(rows.map((r) => r.customer_account_id)).size;
    return { events: available(events), uniqueCustomers: available(unique) };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { events: unavailable(reason), uniqueCustomers: unavailable(reason) };
  }
}

/* ─── Public API ─────────────────────────────────────────────── */

/** Returns a per-product interest summary for the owning seller.
 *  Access control enforced BEFORE any aggregation query runs.
 *  Returns denial for unauthorised callers · the caller never
 *  learns anything about products / businesses they do not own. */
export async function getPerProductInterestSummary(opts: {
  readonly sellerAccountId: string;
  readonly productId: string;
  readonly windowDays?: number;
}): Promise<SellerInsightResult<PerProductInterestSummary>> {
  if (!opts.sellerAccountId) {
    return { ok: false, reason: { kind: "not-signed-in" } };
  }
  const product = await productService.getProductById(opts.productId);
  if (!product) {
    return { ok: false, reason: { kind: "product-not-found" } };
  }
  const ownsResult = await assertSellerOwnsBusiness(
    opts.sellerAccountId,
    product.business_id,
  );
  if (!ownsResult.ok) {
    // Never leak the inner reason (not-business-owner vs not-signed-
    // in); instead return a scoped product-level denial so the
    // caller can't probe for business ownership by trying products.
    return {
      ok: false,
      reason: { kind: "product-not-in-owned-business" },
    };
  }

  const windowDays = opts.windowDays ?? DEFAULT_WINDOW_DAYS;
  const windowStart = windowStartIso(windowDays);

  const [views, taps, saves, enquiries, completedOrders] = await Promise.all([
    countDiscoverySignal({
      signalType: "view",
      businessId: product.business_id,
      productId: product.id,
      windowStart,
    }),
    countDiscoverySignal({
      signalType: "tap",
      businessId: product.business_id,
      productId: product.id,
      windowStart,
    }),
    countSavedProduct({ productId: product.id, windowStart }),
    countEnquiryByProduct({
      productId: product.id,
      windowStart,
      excludeSender: opts.sellerAccountId,
    }),
    countCompletedOrders({
      businessId: product.business_id,
      productId: product.id,
      windowStart,
    }),
  ]);

  return {
    ok: true,
    data: {
      productId: product.id,
      businessId: product.business_id,
      windowDays,
      windowStart,
      views,
      taps,
      saves,
      enquiries,
      completedOrders,
    },
  };
}

/** Returns a per-business interest summary for the owning seller.
 *  Same access-control + fail-open-per-metric contract as the
 *  per-product variant. */
export async function getPerBusinessInterestSummary(opts: {
  readonly sellerAccountId: string;
  readonly businessId: string;
  readonly windowDays?: number;
}): Promise<SellerInsightResult<PerBusinessInterestSummary>> {
  const ownsResult = await assertSellerOwnsBusiness(
    opts.sellerAccountId,
    opts.businessId,
  );
  if (!ownsResult.ok) return ownsResult;

  const windowDays = opts.windowDays ?? DEFAULT_WINDOW_DAYS;
  const windowStart = windowStartIso(windowDays);

  const [views, taps, saves, enquiries, completedOrders] = await Promise.all([
    countDiscoverySignal({
      signalType: "view",
      businessId: opts.businessId,
      windowStart,
    }),
    countDiscoverySignal({
      signalType: "tap",
      businessId: opts.businessId,
      windowStart,
    }),
    // Per-business save count: aggregate across ALL products of the
    // business. We fan out one query per product and sum. For the
    // first phase this is bounded (one seller's catalog · tens of
    // products). If it grows, a dedicated RPC can replace the
    // fan-out.
    (async (): Promise<NamedInterestMetric> => {
      try {
        const products = await productService.listProductsByBusiness(
          opts.businessId,
        );
        if (products.length === 0) {
          return { events: available(0), uniqueCustomers: available(0) };
        }
        const { data, error } = await nexSupabaseAdmin
          .from("nex_liked_product")
          .select("liker_account_id")
          .in(
            "product_id",
            products.map((p) => p.id),
          )
          .gte("liked_at", windowStart);
        if (error) {
          const reason = `${error.code ?? "unknown"}: ${error.message}`;
          return { events: unavailable(reason), uniqueCustomers: unavailable(reason) };
        }
        const rows = (data ?? []) as Array<{ liker_account_id: string }>;
        return {
          events: available(rows.length),
          uniqueCustomers: available(
            new Set(rows.map((r) => r.liker_account_id)).size,
          ),
        };
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        return { events: unavailable(reason), uniqueCustomers: unavailable(reason) };
      }
    })(),
    countEnquiryByBusiness({
      businessId: opts.businessId,
      windowStart,
      excludeSender: opts.sellerAccountId,
    }),
    countCompletedOrders({
      businessId: opts.businessId,
      windowStart,
    }),
  ]);

  return {
    ok: true,
    data: {
      businessId: opts.businessId,
      windowDays,
      windowStart,
      views,
      taps,
      saves,
      enquiries,
      completedOrders,
    },
  };
}
