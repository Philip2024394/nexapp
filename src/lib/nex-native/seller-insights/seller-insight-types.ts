// src/lib/nex-native/seller-insights/seller-insight-types.ts
//
// Phase 1 · Slice 1E · owner-authorised 2026-10-24.
// -----------------------------------------------------------------------------
// Types for the seller-facing "interested customers" aggregation
// surface. Pure types · no runtime · edge-safe.
//
// Design principles (sealed by Owner Decision Q1 Option A):
//
//   1 · No new table and no schema migration. All metrics derive
//       from EXISTING primary sources:
//
//         view / tap           ← nex.discovery_signal (aggregate only)
//         enquiry / cart       ← nex_peer_message     (deduped by
//                                                      send_intent_id)
//         save                 ← nex_liked_product    (UNIQUE pair)
//         order (completed)    ← nex_order            (idempotency_key
//                                                      + state filter)
//
//       Each metric reads a SINGLE primary source so counts can
//       never overlap or double-count across sources.
//
//   2 · Anonymous ≠ named.
//
//         AggregateInterestMetric  · view / tap · event count only ·
//                                    never a unique-customer count ·
//                                    never a customer identity.
//
//         NamedInterestMetric      · save / enquiry / order · event
//                                    count + unique-customer count ·
//                                    customer identity is NOT emitted
//                                    in this slice's result (future
//                                    slices add an opted-in named
//                                    list behind a dedicated gate).
//
//   3 · Fail-open per metric. If one metric's underlying query
//       fails (e.g. Migration 208 not applied, Migration 216 not
//       applied, transient PG error), that metric is marked
//       `unavailable` with a reason. The rest of the summary is
//       returned.
//
//   4 · Honest labelling of events vs customers. Signal duplicates
//       inflate `events`, NOT `uniqueCustomers` (distinct account
//       dedup). Views/taps return only `events` because they are
//       anonymous.
//
// Access-control sealed in the service layer: every function in
// seller-insight-service.ts verifies that the caller owns the
// business via `businessService.listBusinessesByOwner` BEFORE
// running any aggregation query. nexSupabaseAdmin bypasses RLS by
// design (G1 R1 defect pending remediation per the saved plan ·
// production release of this surface remains blocked by G1).

/** Availability of a single metric. */
export type MetricState =
  | { readonly state: "available"; readonly count: number }
  | {
      readonly state: "unavailable";
      /** Opaque reason · currently one of:
       *    "pipeline-off"   · env flag or table missing
       *    "query-failed"   · generic PG error
       *    "schema-missing" · relation/column not deployed yet
       */
      readonly reason: string;
    };

/** Metric where unique-customer counts are PROHIBITED by design
 *  (anonymous aggregate · view / tap signals). */
export interface AggregateInterestMetric {
  readonly events: MetricState;
}

/** Metric where unique-customer counts are permitted (customer
 *  took an explicit, identifiable action · save / enquiry /
 *  completed order). */
export interface NamedInterestMetric {
  readonly events: MetricState;
  readonly uniqueCustomers: MetricState;
}

/** Summary rendered for a seller viewing ONE of their products. */
export interface PerProductInterestSummary {
  readonly productId: string;
  readonly businessId: string;
  readonly windowDays: number;
  /** ISO timestamp · inclusive start of the aggregation window. */
  readonly windowStart: string;

  /** Anonymous aggregates · event counts only · never named. */
  readonly views: AggregateInterestMetric;
  readonly taps: AggregateInterestMetric;

  /** Named actions · event count + unique-customer count. */
  readonly saves: NamedInterestMetric;
  readonly enquiries: NamedInterestMetric;
  /** Confirmed sales only · state ∈ {paid, completed}. Never
   *  derived from signals or messages · nex_order is the
   *  authoritative source. */
  readonly completedOrders: NamedInterestMetric;
}

/** Summary rendered for a seller viewing ALL products of ONE of
 *  their businesses. */
export interface PerBusinessInterestSummary {
  readonly businessId: string;
  readonly windowDays: number;
  readonly windowStart: string;

  readonly views: AggregateInterestMetric;
  readonly taps: AggregateInterestMetric;
  readonly saves: NamedInterestMetric;
  readonly enquiries: NamedInterestMetric;
  readonly completedOrders: NamedInterestMetric;
}

/** Denials a seller might receive. Never leak information about
 *  businesses or products the seller does not own. */
export type SellerInsightDenial =
  | { readonly kind: "not-signed-in" }
  | { readonly kind: "business-not-found" }
  | { readonly kind: "not-business-owner" }
  | { readonly kind: "product-not-found" }
  | { readonly kind: "product-not-in-owned-business" };

export type SellerInsightResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly reason: SellerInsightDenial };

/** Default aggregation window in days. Query parameter only · this
 *  is NOT a customer-facing promise about how long NEX stores
 *  underlying events. Retention of the primary sources is governed
 *  by their own policies, which this surface does not change. */
export const DEFAULT_WINDOW_DAYS = 30;
