// src/lib/nex-native/directory/directory-image-adapter.ts
//
// NEX Directory · A-strict CATEGORY_FALLBACK adapter · 2026-10-27.
// -------------------------------------------------------------------
// Pure function (no DB access, no I/O) that resolves a CATEGORY_FALLBACK
// image URL for a Directory card ROW. Returns null for every row that
// is OUT OF SCOPE — the card UI then falls back to its letter-monogram.
//
// Owner-authorised scope (2026-10-27 · A-strict):
//   · country === "ID"
//   · AND entity_type is in the canonical food family (today just "food")
//
// Why the gate is tighter than the resolver's own universal fallback:
//   The sealed `resolveDirectoryHero` always resolves to SOME url
//   (never-null contract). Its PHASE 1 UNIVERSAL_FALLBACK_URL happens
//   to be a food dish (`nva-011` grain bowl). Letting that leak onto a
//   hotel, service, or non-Indonesian row would misrepresent category.
//   This adapter rejects any resolver output whose `source` is not
//   `nex.categoryLibrary` so only Philip-curated library hits survive.
//
// Priority preservation (per Universal Image Doctrine, 2026-08-22):
//   OWNER_IMAGE (approved) > VERIFIED_REAL (approved) > CATEGORY_FALLBACK > UNIVERSAL_FALLBACK
//
//   · OWNER_IMAGE is honoured ABOVE this adapter: the caller passes
//     `row.logo_url` first and only consults this adapter when
//     logo_url is null. See landing-feed-service.ts adaptRowToCard.
//   · VERIFIED_REAL + nex.business_image rows are passed as [] here:
//     all 660 captured rows are approved=false (owner directive
//     2026-10-27 · the capture backlog remains unapproved under A-strict).
//     When owner-approved rows exist, this is the join seam.
//   · CATEGORY_FALLBACK fires from the Philip-curated library only.
//   · UNIVERSAL_FALLBACK is deliberately rejected here (see above).
//
// Doctrine anchors:
//   project_nex_universal_directory_image_doctrine_2026_08_22
//   project_nex_country_scope_from_phone_country_code_2026_08_22
//   project_nex_visual_assets_2026_08_21
//
// This module is PURE · no server-only, no DB access, no side effects.

import type { NexBusinessRow } from "@/lib/nex-native/types";
import { resolveDirectoryHero } from "@/lib/nex/images/resolveDirectoryHero";

/** Canonical `entity_type` values that are in the owner-authorised
 *  A-strict food family. Narrower than the resolver's library · the
 *  library ALSO has keys like `restaurant` / `coffee-cafe` keyed on
 *  nex_business sub-categories, but those are not reachable through
 *  this adapter today because nex_business rows have no country
 *  column and therefore cannot be gated to Indonesia. */
const CANONICAL_FOOD_ENTITY_TYPES: ReadonlySet<string> = new Set(["food"]);

/**
 * Resolve the CATEGORY_FALLBACK image URL for a directory card row,
 * or null when the row is out of A-strict scope.
 *
 * Pure. Does not read business_image rows, does not touch the DB,
 * does not fabricate · the only data in is the adapted row + the
 * declared source. Caller is responsible for priority ordering
 * (owner-upload wins · see adaptRowToCard).
 */
export function resolveCategoryFallbackImageUrl(
  row: NexBusinessRow,
  source: "canonical" | "nex_business",
): string | null {
  // nex_business rows have no country column today. Owner directive
  // 2026-10-27 · do not expand category fallback beyond Indonesia.
  // Without a verifiable country, the row is out of scope regardless
  // of its category.
  if (source !== "canonical") return null;

  const country = readCountryIso(row);
  if (country !== "ID") return null;

  const categoryId = row.business_category;
  if (!categoryId || !CANONICAL_FOOD_ENTITY_TYPES.has(categoryId)) return null;

  const resolved = resolveDirectoryHero({
    businessType: categoryId,
    businessCountry: country,
    businessRef: row.id,
    categoryId,
    // Owner directive 2026-10-27 · the 660 captured business_image
    // rows are all approved=false. Passing [] here is operationally
    // identical to joining in the unapproved set and relying on the
    // resolver's approval gate, but avoids an N-per-feed DB round-trip.
    // When owner-approved rows exist, this is the join seam.
    images: [],
  });

  // Reject the universal-fallback branch · we only honour explicit
  // library hits. The library has a `food` entry so canonical food
  // rows always get a specific URL here, but the double-check
  // protects the scope against future library edits.
  if (resolved.source !== "nex.categoryLibrary") return null;
  return resolved.url;
}

/** Defensive country reader · the `NexBusinessRow` interface does not
 *  declare `country`, but the canonical adapter emits it as an extra
 *  property via `as unknown as NexBusinessRow`. ISO alpha-2 validator. */
const ISO_ALPHA_2 = /^[A-Z]{2}$/;
function readCountryIso(row: NexBusinessRow): string | null {
  const anyRow = row as unknown as { country?: unknown };
  if (typeof anyRow.country !== "string") return null;
  const upper = anyRow.country.trim().toUpperCase();
  return ISO_ALPHA_2.test(upper) ? upper : null;
}
