// src/lib/nex-native/delivery/cart-delivery-shape.ts
//
// Authored 2026-11-19 · Lane F · Decision F-A sealed §16.19.7.
//
// Pure, framework-free helpers that let `sendCartOrderAction` classify
// a retail cart by delivery-pricing shape BEFORE picking which server-
// side verification path to run:
//
//   · "per_ring"   → every item is a product whose
//                    `spec.__delivery.local.radii` is non-empty →
//                    verify via quoteLocalDelivery (owner's per-ring
//                    model, anchored on nex_business location).
//   · "rate_card"  → every item is either a menu_item (no per-item
//                    per-ring config) or a product with absent/empty
//                    radii → verify via estimateBikeFare (existing
//                    rate-card model, Indonesian bike-hail baseline).
//   · "mixed"      → the cart has at least one per-ring item AND at
//                    least one rate-card item → REJECT at the cart
//                    boundary per owner directive (owner-exact: "Do
//                    not guess missing delivery data, change pricing
//                    policy silently or conflate retail with
//                    wholesale"). Silently coercing a mixed cart
//                    into one model would be exactly that.
//   · "empty"      → caller should treat as degenerate (every
//                    sendCartOrderAction path already rejects empty
//                    carts upstream with "Cart is empty"; this label
//                    exists so the classifier is total).
//
// This library is deliberately framework-free (no "server-only", no
// React, no Supabase) so the same classifier can be exercised from
// vitest offline tests, a server action, or a future API route
// without pulling in a server bootstrap.
//
// Writes NOTHING. Reads NOTHING. Pure shape work.

import {
  extractDelivery,
  type LocalRadiusEntryT,
} from "@/lib/nex-native/catalogue/delivery-spec";

// ─── Single-item classification ──────────────────────────────────────

export type CartItemDeliveryKind = "per_ring" | "rate_card";

/** Classify one cart line by its delivery-pricing kind.
 *
 *  Inputs:
 *    - `kind` is the item kind as parsed by sendCartOrderAction
 *      ("product" | "menu_item"). Any other value is treated as
 *      rate-card (defensive · the action already rejects unknown
 *      kinds upstream).
 *    - `productSpec` is the raw `nex_product.spec` jsonb (or any
 *      unknown value) for product lines. The classifier reads
 *      `spec.__delivery.local.radii` via the sealed `extractDelivery`
 *      helper; malformed rows fall through to rate-card (same posture
 *      as the editor and the pure quote library).
 *
 *  Menu items have no per-item per-ring config in the schema · they
 *  always classify as "rate_card".
 */
export function classifyCartItemDelivery(
  kind: string,
  productSpec: unknown,
): CartItemDeliveryKind {
  if (kind !== "product") return "rate_card";
  const d = extractDelivery(productSpec);
  if (
    d &&
    d.local &&
    Array.isArray(d.local.radii) &&
    d.local.radii.length > 0
  ) {
    return "per_ring";
  }
  return "rate_card";
}

/** Extract the local-radius list for one cart line. Returns an empty
 *  array for menu items, products without delivery config, or
 *  malformed specs. Pairs 1:1 with `classifyCartItemDelivery` so
 *  callers can gather per-item radii while classifying. */
export function extractCartItemRadii(
  kind: string,
  productSpec: unknown,
): readonly LocalRadiusEntryT[] {
  if (kind !== "product") return [];
  const d = extractDelivery(productSpec);
  if (d && d.local && Array.isArray(d.local.radii)) {
    return d.local.radii;
  }
  return [];
}

// ─── Whole-cart classification ───────────────────────────────────────

export type CartDeliveryShape = "per_ring" | "rate_card" | "mixed" | "empty";

/** Classify the whole cart from its per-item delivery kinds. */
export function classifyCartDeliveryShape(
  itemKinds: readonly CartItemDeliveryKind[],
): CartDeliveryShape {
  if (itemKinds.length === 0) return "empty";
  const first = itemKinds[0]!;
  for (let i = 1; i < itemKinds.length; i++) {
    if (itemKinds[i] !== first) return "mixed";
  }
  return first;
}

// ─── Per-ring radii union ────────────────────────────────────────────

/** Union of per-ring radii across a cart whose shape is "per_ring".
 *
 *  F-A directive §16.19.7: "quoteLocalDelivery using the tightest
 *  rate (lowest `price_pence` for the applicable ring across items);
 *  radius = largest of all per-item largest rings".
 *
 *  Implementation:
 *    1. Flatten all items' radii into one list.
 *    2. Group by `km`; within a group keep the entry with the LOWEST
 *       `price_pence` (tightest · buyer-favourable).
 *    3. Return the resulting list sorted ascending by km. `quoteLocal
 *       Delivery` applies its own smallest-ring-covering-distance
 *       selection, so the largest-ring bound (max of max km) is
 *       enforced implicitly by the unioned list: distances beyond
 *       that km hit the "out_of_range" branch exactly as they would
 *       for a single item at the largest km. The applicable-ring
 *       price is the tightest across items for the ring that covers
 *       the distance.
 *
 *  Pure; deterministic; no I/O. */
export function unionPerRingRadii(
  perItemRadii: readonly (readonly LocalRadiusEntryT[])[],
): LocalRadiusEntryT[] {
  const byKm = new Map<number, LocalRadiusEntryT>();
  for (const radii of perItemRadii) {
    for (const r of radii) {
      const existing = byKm.get(r.km);
      if (!existing) {
        byKm.set(r.km, r);
        continue;
      }
      if (r.price_pence < existing.price_pence) {
        byKm.set(r.km, r);
      }
    }
  }
  const unioned = [...byKm.values()];
  unioned.sort((a, b) => {
    if (a.km !== b.km) return a.km - b.km;
    return a.price_pence - b.price_pence;
  });
  return unioned;
}
