// src/lib/nex-native/delivery/local-delivery-quote.ts
//
// Authored 2026-11-18 · Phase Delivery · D1
//
// Pure library that resolves a LOCAL delivery quote for a single
// cart line / shop from:
//
//   · the seller's per-ring price list stored in
//     nex_product.spec.__delivery.local.radii (owner-authorised
//     2026-10-31 · see delivery-spec.ts for the sealed shape),
//   · the seller's shop origin coordinates stored on
//     nex_business.location_lat / location_lng,
//   · the buyer's destination coordinates (geocoded from the
//     delivery address or captured via navigator.geolocation on the
//     cart page after explicit consent).
//
// Distance semantics (explicit, non-negotiable):
//   The distance returned here is STRAIGHT-LINE (Haversine great-
//   circle), NOT routed road distance. The master-prompt for Phase
//   Delivery is explicit about never silently substituting one for
//   the other, so every consumer of this library MUST render the
//   distance with an honest "straight-line" label and MUST NOT
//   promise a billable road-kilometre figure based on this output.
//
//   If an authorised routing capability is added later, swap the
//   Haversine call for the routed-distance call behind the same
//   interface and update the `distanceKind` field.
//
// Pricing semantics:
//   The sealed owner directive 2026-10-31 uses PER-RING pricing, not
//   per-kilometre. Each ring is "deliver within N km for M in
//   currency C". The applicable ring is the SMALLEST ring whose
//   radius is ≥ the straight-line distance. If no ring covers the
//   distance, the destination is OUT OF RANGE.
//
//   This library does NOT interpolate between rings and does NOT
//   compute a per-km rate from the ring prices · the owner
//   specifically chose a per-ring model. Callers who need a
//   per-kilometre model should flag the mismatch rather than compute
//   silently.
//
// Server-side integration (the tamper-rejection use case):
//   `sendCartOrderAction` currently validates only the structural
//   shape of the client-submitted delivery_quote (positive numbers,
//   allowed `kind`). It does not verify the fare against seller
//   configuration or reject destinations beyond the shop's largest
//   configured ring. This library is the pure core that server-side
//   validation should call: it is deliberately framework-free so
//   either a server action, an API route, a vitest unit test, or a
//   client-side preview can use the same resolver and disagree
//   deterministically.
//
// This file writes NOTHING. It reads NOTHING. Pure math + shape
// selection.

import {
  LocalDeliverySpec,
  type LocalRadiusEntryT,
} from "@/lib/nex-native/catalogue/delivery-spec";
import { haversineKm } from "@/lib/nex-native/bike-delivery-service";

// ─── Inputs ──────────────────────────────────────────────────────────

export interface LocalDeliveryQuoteInput {
  /** Seller radii list · may come from `extractDelivery(product.spec)`.
   *  Pass an empty array when the seller has not configured any rings. */
  readonly radii: readonly LocalRadiusEntryT[];
  /** Shop origin from nex_business.location_lat/lng. Either coordinate
   *  may be null when the seller has not set the shop location yet. */
  readonly origin: { readonly lat: number | null; readonly lng: number | null };
  /** Buyer destination · null when the buyer has not yet supplied a
   *  deliverable address / coordinates. */
  readonly destination: { readonly lat: number; readonly lng: number } | null;
}

// ─── Outputs ─────────────────────────────────────────────────────────

/** Kinds of distance a quote can be computed from. Future expansions
 *  (`routed_road`, etc.) belong here, not inline booleans. */
export type DistanceKind = "straight_line_haversine";

export type LocalDeliveryQuoteResult =
  | {
      readonly ok: true;
      /** Smallest ring (by km) whose radius covers the distance. */
      readonly applicableRingKm: number;
      readonly fareMinor: number;
      readonly currency: string;
      readonly deliveryDays?: number;
      /** Straight-line kilometres from origin to destination, three
       *  decimal places. The caller MUST NOT present this as road
       *  distance in any UI. */
      readonly distanceKm: number;
      readonly distanceKind: DistanceKind;
    }
  | {
      readonly ok: false;
      readonly reason:
        | "no_rings_configured"
        | "missing_origin"
        | "missing_destination"
        | "out_of_range";
      /** Present when the reason is `out_of_range` · the caller can
       *  render "you are 24 km away, largest ring is 20 km". */
      readonly distanceKm?: number;
      readonly largestRingKm?: number;
    };

// ─── Core resolver ───────────────────────────────────────────────────

/** Deterministic, pure. No I/O, no clock, no randomness. Accepts
 *  unvalidated input; validates via the same Zod schema the editor
 *  persists through, so a malformed seller row is treated the same as
 *  "no rings configured". */
export function quoteLocalDelivery(
  input: LocalDeliveryQuoteInput,
): LocalDeliveryQuoteResult {
  // Validate seller radii via the sealed schema. Malformed rows are
  // silently dropped · they should never have persisted, but the
  // resolver refuses to invent a fare from them.
  const sanitized: LocalRadiusEntryT[] = [];
  for (const r of input.radii) {
    const parsed = LocalDeliverySpec.shape.radii.element.safeParse(r);
    if (parsed.success) sanitized.push(parsed.data);
  }
  if (sanitized.length === 0) {
    return { ok: false, reason: "no_rings_configured" };
  }

  const { origin, destination } = input;
  if (
    origin.lat === null ||
    origin.lng === null ||
    !Number.isFinite(origin.lat) ||
    !Number.isFinite(origin.lng)
  ) {
    return { ok: false, reason: "missing_origin" };
  }
  if (
    destination === null ||
    !Number.isFinite(destination.lat) ||
    !Number.isFinite(destination.lng)
  ) {
    return { ok: false, reason: "missing_destination" };
  }

  const rawKm = haversineKm(
    origin.lat,
    origin.lng,
    destination.lat,
    destination.lng,
  );
  // Three decimal places · enough to distinguish 10.000 km from
  // 10.001 km across the ring boundary, far short of any precision
  // claim that could be mistaken for "metres certainty".
  const distanceKm = Math.round(rawKm * 1000) / 1000;

  // Ascending by ring size · tie-break by ascending price so a
  // seller's accidental duplicate km with a cheaper second row is
  // still deterministic (the schema allows duplicates; the editor
  // disables already-set km in the picker but legacy rows may slip
  // through).
  const sorted = [...sanitized].sort((a, b) => {
    if (a.km !== b.km) return a.km - b.km;
    return a.price_pence - b.price_pence;
  });

  // Smallest ring that covers the distance (inclusive boundary · a
  // buyer at exactly 10.000 km rides on the 10 km ring).
  const applicable = sorted.find((r) => r.km >= distanceKm);
  if (!applicable) {
    return {
      ok: false,
      reason: "out_of_range",
      distanceKm,
      largestRingKm: sorted[sorted.length - 1]!.km,
    };
  }

  const out: LocalDeliveryQuoteResult = {
    ok: true,
    applicableRingKm: applicable.km,
    fareMinor: applicable.price_pence,
    currency: applicable.currency,
    distanceKm,
    distanceKind: "straight_line_haversine",
    ...(typeof applicable.delivery_days === "number"
      ? { deliveryDays: applicable.delivery_days }
      : {}),
  };
  return out;
}

// ─── Tamper rejection helper ─────────────────────────────────────────

/** Compare a client-submitted quote against what the pure resolver
 *  would independently produce. Used by server-side cart validation
 *  to reject fare/distance/ring tampering without having to duplicate
 *  the comparison logic in each caller.
 *
 *  The function returns `true` when the submitted quote matches the
 *  authoritative resolver output; `false` otherwise. A `false` result
 *  must be treated by the caller as "reject the order and ask the
 *  buyer to re-fetch the quote". */
export interface SubmittedLocalQuote {
  readonly fareMinor: number;
  readonly currency: string;
  readonly distanceKm?: number;
}

export function isSubmittedLocalQuoteAuthentic(
  submitted: SubmittedLocalQuote,
  authoritative: LocalDeliveryQuoteResult,
): boolean {
  if (!authoritative.ok) return false;
  if (submitted.fareMinor !== authoritative.fareMinor) return false;
  if (submitted.currency !== authoritative.currency) return false;
  // Distance is optional in the submitted quote (legacy clients) ·
  // when present we require the integer-km truncation to match so a
  // client cannot claim a distance that lands on a cheaper ring.
  if (typeof submitted.distanceKm === "number") {
    const sTrunc = Math.floor(submitted.distanceKm);
    const aTrunc = Math.floor(authoritative.distanceKm);
    if (sTrunc !== aTrunc) return false;
  }
  return true;
}
