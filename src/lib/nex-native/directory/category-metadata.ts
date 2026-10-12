// src/lib/nex-native/directory/category-metadata.ts
//
// Static registry of per-category visitor-facing metadata · title,
// description, and hero image · for the NEX Directory detail page.
//
// Scope:
//   · Only categories listed in CATEGORY_METADATA get the richer
//     "card" presentation (image + description + title).
//   · Categories NOT listed fall back to the existing chip-only
//     treatment · we do NOT fabricate a description or image for
//     them. Missing data stays missing.
//
// Why TypeScript (not DB):
//   · Content changes (copy, image swaps) iterate often · code
//     commits are the right change-control surface for this.
//   · The images live as static assets under `public/` for CDN
//     caching · no per-request DB round trip.
//   · The sealed `nex.category_image_library` (migration 112) stays
//     authoritative for the ADR-0022 representative-illustration
//     pattern used by the listing cards · this module is a parallel
//     presentation layer for the detail page.
//
// Honesty contract:
//   · Images represent the CATEGORY as a whole, NOT the specific
//     business. The detail page's hero caption makes this explicit
//     ("Example image · owner has not uploaded photos").
//   · Descriptions describe what the category typically means
//     ("fast-food venue · typically serving…") · they never claim
//     anything specific to the individual business.

export interface CategoryMetadata {
  /** The vertical category slug as it appears in
   *  `nex.food_business.category` / `.categories` and projected onto
   *  DirectoryListingVM.categoryIds. Lowercase, kebab-case. */
  readonly slug: string;
  /** Human-readable section title (e.g. "Fast food"). */
  readonly title: string;
  /** Visitor-facing description · category-level, never
   *  business-specific. */
  readonly description: string;
  /** Public path to the hero image (served from /public). */
  readonly heroImageUrl: string;
  /** Alt text for the hero image · screen-reader friendly, honest. */
  readonly altText: string;
}

/**
 * Known-category registry. Add entries as new category images and
 * copy are approved. Entries NOT in this map fall back to the
 * chip-only presentation on the detail page · never a fabricated
 * description.
 */
export const CATEGORY_METADATA: Readonly<Record<string, CategoryMetadata>> =
  Object.freeze({
    "fast-food": Object.freeze({
      slug: "fast-food",
      title: "Fast food",
      description:
        "This business is listed on NEX as a fast-food venue · typically serving burgers, fries, cold drinks and quick-service meals. The owner may offer other items not shown here · if in doubt, contact the business directly.",
      heroImageUrl: "/nex-category-images/fast-food/p01.png",
      altText: "Fast food · burger, fries, chicken, cold drink",
    }),
  });

/** Look up a single category's metadata by slug. Returns null when the
 *  slug is not in the registry · the UI then shows the chip-only
 *  treatment for that category. Pure. */
export function getCategoryMetadata(
  slug: string | null | undefined,
): CategoryMetadata | null {
  if (typeof slug !== "string") return null;
  const normalized = slug.trim().toLowerCase();
  if (normalized.length === 0) return null;
  return CATEGORY_METADATA[normalized] ?? null;
}

/** Given an ordered list of category slugs (as the projector yields:
 *  vertical primary first, then secondaries), return the FIRST
 *  category that has registry metadata. Deterministic. Returns null
 *  when none of the row's categories are registered yet · the UI then
 *  skips the card presentation entirely and renders only chips. */
export function getPrimaryCategoryMetadata(
  categoryIds: readonly string[],
): CategoryMetadata | null {
  for (const slug of categoryIds) {
    const meta = getCategoryMetadata(slug);
    if (meta !== null) return meta;
  }
  return null;
}

/** Partition a list of category slugs into {known, unknown}. The
 *  detail page renders known categories as full cards and unknown
 *  ones as chips below. Preserves input order within each bucket. */
export function partitionCategories(
  categoryIds: readonly string[],
): {
  readonly known: readonly CategoryMetadata[];
  readonly unknown: readonly string[];
} {
  const known: CategoryMetadata[] = [];
  const unknown: string[] = [];
  const seenSlugs = new Set<string>();
  for (const raw of categoryIds) {
    if (typeof raw !== "string") continue;
    const slug = raw.trim().toLowerCase();
    if (slug.length === 0) continue;
    if (seenSlugs.has(slug)) continue;
    seenSlugs.add(slug);
    const meta = getCategoryMetadata(slug);
    if (meta !== null) {
      known.push(meta);
    } else {
      unknown.push(raw.trim());
    }
  }
  return { known, unknown };
}
