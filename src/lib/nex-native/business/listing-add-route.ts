// src/lib/nex-native/business/listing-add-route.ts
//
// Owner-authorised 2026-10-20 · pure function mapping a
// `BusinessSubtype` to the correct existing listing-creation surface.
// Reuses the sealed `/manage/menu` (Bridge 15a) · `/manage/services`
// (Bridge Services-C) · `/manage/products` (migration 003 canonical)
// routes · DOES NOT create a new creation form.
//
// Returns:
//   - { state: "ready", href, label }   · creation surface exists today
//   - { state: "blocked", label, reason } · no creation surface yet · the
//     caller renders an honest "coming in Phase X" chip instead of a
//     Link. Phase A1 release hold is explicit for accommodation ·
//     property listing surface has not been built either.
//   - null · the subtype is absent / unrecognised (defensive null handling)
//
// When accommodation gets its Phase B backend, update the
// ACCOMMODATION branch below to return a "ready" route · do NOT
// change the function signature.

import type { BusinessSubtype } from "./types";

export type ListingAddRoute =
  | { readonly state: "ready"; readonly href: string; readonly label: string }
  | { readonly state: "blocked"; readonly label: string; readonly reason: string };

// ─── Subtype → category sets (verified against business/types.ts) ────

const FOOD_SUBTYPES: ReadonlySet<BusinessSubtype> = new Set([
  "restaurant",
  "cafe",
  "bakery",
  "food_maker",
  "catering",
  "drinks",
  "food_delivery",
]);

const SERVICES_SUBTYPES: ReadonlySet<BusinessSubtype> = new Set([
  "beauty",
  "health_wellness",
  "home_services",
  "professional",
  "trade_construction",
  "automotive",
  "events",
  "creative",
]);

const PRODUCTS_SUBTYPES: ReadonlySet<BusinessSubtype> = new Set([
  "retail",
  "manufacturer",
  "wholesale",
  "local_artisan",
  "exporter",
  "motorbike_shop",
]);

const ACCOMMODATION_SUBTYPES: ReadonlySet<BusinessSubtype> = new Set([
  "hotel",
  "villa",
  "guesthouse",
  "homestay",
  "resort",
  "short_rental",
  "kost",
]);

const PROPERTY_SUBTYPES: ReadonlySet<BusinessSubtype> = new Set([
  "for_sale",
  "for_rent",
  "developer",
  "agent",
]);

// ─── Route resolution ────────────────────────────────────────────────

export function listingAddRouteFor(
  subtype: BusinessSubtype | null | undefined,
): ListingAddRoute | null {
  if (!subtype) return null;

  if (FOOD_SUBTYPES.has(subtype)) {
    return {
      state: "ready",
      href: "/nex-native/manage/menu",
      label: "Add menu item",
    };
  }

  if (SERVICES_SUBTYPES.has(subtype)) {
    return {
      state: "ready",
      href: "/nex-native/manage/services",
      label: "Add service",
    };
  }

  if (PRODUCTS_SUBTYPES.has(subtype)) {
    return {
      state: "ready",
      href: "/nex-native/manage/products",
      label: "Add product",
    };
  }

  if (ACCOMMODATION_SUBTYPES.has(subtype)) {
    // Phase A1 build state 2026-10-21:
    //   · Migration 213 (`nex_accommodation_unit`) · AUTHORED (file-only)
    //   · `accommodation-service.ts` · AUTHORED
    //   · `/manage/accommodation` surface · AUTHORED
    //   · Customer render path on `/[businessSlug]/page.tsx` · AUTHORED
    //
    // What's missing: migration 213 has NOT been applied to any
    // database. Writing a room via the authored UI would currently
    // throw a "relation 'nex_accommodation_unit' does not exist"
    // error from Postgres. The owner's build authorisation
    // explicitly says: "Do not leave a ready CTA pointing to a
    // broken or placeholder route." · so the CTA stays `blocked`
    // until a separate authorisation applies the migration to an
    // isolated local Supabase.
    //
    // POST-APPLY: once migration 213 is applied + verified, flip
    // this branch to:
    //   return { state: "ready", href: "/nex-native/manage/accommodation", label: "Add room" };
    return {
      state: "blocked",
      label: "Rooms · backend authored · awaiting migration apply",
      reason:
        "nex_accommodation_unit backend is authored (migration 213 + accommodation-service + /manage/accommodation + customer render path) but migration 213 is not yet applied. The CTA stays blocked until an authorised migration apply lands against an isolated local Supabase.",
    };
  }

  if (PROPERTY_SUBTYPES.has(subtype)) {
    return {
      state: "blocked",
      label: "Property listings coming soon",
      reason:
        "Property listing creation surface has not been built yet",
    };
  }

  // Defensive: a brand-new subtype gets added to types.ts and we
  // haven't updated this helper. Return null · the caller shows no
  // button. Add new subtypes to one of the sets above.
  return null;
}
