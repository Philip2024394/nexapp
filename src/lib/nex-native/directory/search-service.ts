// src/lib/nex-native/directory/search-service.ts
//
// NEX Directory · server-side search · Owner-authorised 2026-10-27.
// --------------------------------------------------------------------
// The directory page's search form submits `?q=<text>` back to
// `/nex-native/directory`. Prior to this file the server simply dropped
// `q` on the floor and returned the seed-shuffled landing feed. This
// module gives the server a REAL search path that:
//
//   (1) Queries BOTH the canonical harvester table (sealed
//       `searchCanonicalBusinesses`) AND the owner-authored
//       `nex_business` table (sealed `searchBusinesses`) in parallel.
//
//   (2) Deduplicates by `slug || id`, prefers the owner-authored row
//       when the same slug appears in both (same rule as
//       `landing-feed-service.ts`).
//
//   (3) Ranks results · exact name match > prefix match > alias/
//       contains match > entity-type match. No invented relevance
//       scores · the rank is a stable integer ordering.
//
//   (4) Adapts each row into the shared `ListingCardViewModel`
//       honouring the owner directive 2026-10-27 for detail href:
//       `/nex-native/directory/{slug}` (NEVER `/nex-native/{slug}`).
//
//   (5) Preserves existing publication, visibility, and trust rules.
//       We DO NOT bypass source governance here · the sealed service
//       functions already return rows the caller is allowed to see.
//
// What this module does NOT do:
//   · Does NOT change `landing-feed-service.ts` or `page.tsx`
//     logic for the no-query path. The seed-shuffled feed is
//     preserved for `?q=` empty.
//   · Does NOT invent a relevance score or display match percentages.
//   · Does NOT run its own DB queries · it consumes the two sealed
//     service functions. SQL injection + parameterisation guarantees
//     live in those services.
//   · Does NOT touch migration 202, email backfill, image gates,
//     or any sealed owner-decision gate.

import "server-only";

import * as discoveryService from "@/lib/nex-native/discovery-service";
import * as localDirectory from "@/lib/nex-native/local-directory-service";
import * as productService from "@/lib/nex-native/product-service";
import type { ProductSearchRow } from "@/lib/nex-native/product-service";
import type { NexBusinessRow } from "@/lib/nex-native/types";
import type {
  LandingFeedOutcome,
  ListingCardViewModel,
} from "./landing-feed-service";
import {
  visualsForCategoryId,
  visualsForCanonicalEntityType,
  type CategoryVisuals,
} from "./landing-category-mapping";

// ─── Public shape · reuses the sealed LandingFeedOutcome ───────────
// A search result is a LandingFeedOutcome whose `reducedState` carries
// the search-specific empty semantics the caller renders.

export interface SearchDirectoryOptions {
  readonly query: string;
  readonly limit: number;
  readonly offset: number;
  readonly country?: string | null;
  readonly seed: string; // echoed back · stable with the landing feed shape
}

// ─── Safe input bounds ─────────────────────────────────────────────
const MAX_QUERY_LEN = 100;
const MIN_LIMIT = 1;
const MAX_LIMIT = 24;

export function normaliseSearchQuery(input: string | null | undefined): string {
  if (typeof input !== "string") return "";
  // Strip leading / trailing whitespace, collapse internal runs,
  // enforce a hard length cap so a pathologically-long query cannot
  // trigger pathological ILIKE patterns in either sealed service.
  const trimmed = input.replace(/\s+/g, " ").trim();
  return trimmed.length > MAX_QUERY_LEN
    ? trimmed.slice(0, MAX_QUERY_LEN)
    : trimmed;
}

function clampLimit(input: number): number {
  if (!Number.isFinite(input)) return MAX_LIMIT;
  return Math.max(MIN_LIMIT, Math.min(MAX_LIMIT, Math.floor(input)));
}

function clampOffset(input: number): number {
  if (!Number.isFinite(input)) return 0;
  return Math.max(0, Math.floor(input));
}

// ─── Core · getDirectorySearchResults ───────────────────────────────

export async function getDirectorySearchResults(
  opts: SearchDirectoryOptions,
): Promise<LandingFeedOutcome> {
  const q = normaliseSearchQuery(opts.query);
  const limit = clampLimit(opts.limit);
  const offset = clampOffset(opts.offset);
  const country = normaliseCountry(opts.country);

  // Honest empty · query degenerates to nothing · don't call either
  // service and don't paint a "no results for \"\"" state. The caller
  // (the page) treats this as "no search in progress".
  if (q.length === 0) {
    return {
      ok: true,
      cards: [],
      totalEligible: 0,
      seed: opts.seed,
      reducedState: "no_eligible_rows",
    };
  }

  // Pool size is intentionally wider than `limit` so dedup + rank
  // have enough material to work with before slicing to the page.
  const POOL = Math.max(limit * 3, 60);

  // Three services called in parallel. Business sources return
  // NexBusinessRow[]; product source returns ProductSearchRow[].
  // Failures are swallowed to honest-empty so a single-source outage
  // doesn't poison the others (same pattern landing-feed-service uses).
  //
  // Owner-authorised 2026-10-30 · Phase 3 of the Product System
  // Implementation Contract (§K owner-resolved). Live products
  // (status='live') appear as directory cards alongside businesses.
  // Product cards route directly to the sealed product detail page
  // /nex-native/{businessSlug}/{productId} · bypasses the sealed
  // 2026-10-27 /directory/{slug} detour because for products the
  // search intent is explicit (user searched for the product).
  const [canonicalRows, nexBusinessRows, productRows] = await Promise.all([
    searchCanonicalSafe(q, POOL, country),
    searchNexBusinessSafe(q, POOL),
    searchProductsSafe(q, Math.ceil(POOL / 2)),
  ]);

  const merged = mergeDedupe(canonicalRows, nexBusinessRows);
  const ranked = rankByMatchQuality(merged, q);
  // Interleave: businesses first (sealed ranking), then products
  // (fresh ranking by name-match proximity). Rough but honest. A
  // Phase 3 enhancement can introduce unified scoring if the owner
  // decides product cards should outrank business cards for
  // product-shaped queries.
  const businessCards = ranked.slice(offset, offset + limit).map(adaptRowToSearchCard);
  const productCards = productRows
    .slice(0, Math.max(0, limit - businessCards.length))
    .map(adaptProductRowToSearchCard);
  const cards = [...businessCards, ...productCards];

  if (cards.length === 0) {
    return {
      ok: true,
      cards,
      totalEligible: 0,
      seed: opts.seed,
      reducedState: "no_eligible_rows",
    };
  }

  return {
    ok: true,
    cards,
    totalEligible: ranked.length,
    seed: opts.seed,
    reducedState:
      cards.length < limit ? "fewer_than_requested" : undefined,
  };
}

// ─── Safe source wrappers ──────────────────────────────────────────

async function searchCanonicalSafe(
  q: string,
  limit: number,
  country: string | null,
): Promise<NexBusinessRow[]> {
  try {
    const result = await localDirectory.searchCanonicalBusinesses(q, {
      limit,
      offset: 0,
    });
    // Defensive narrow · the sealed service returns NexBusinessRow[]
    // but a future refactor or a test-time undefined-return should
    // never crash the merge step. Non-array ⇒ honest-empty.
    const rows: NexBusinessRow[] = Array.isArray(result) ? result : [];
    // Country filter at the search layer when caller specifies one.
    // The sealed canonical search does not take country · we post-
    // filter here. (Country never fabricated · a row with no country
    // field is excluded only when a filter is active.)
    if (country && country.length === 2) {
      return rows.filter((r) => readCountryIso(r) === country);
    }
    return rows;
  } catch {
    return [];
  }
}

async function searchNexBusinessSafe(
  q: string,
  limit: number,
): Promise<NexBusinessRow[]> {
  try {
    const result = await discoveryService.searchBusinesses(q, {
      limit,
      offset: 0,
    });
    return Array.isArray(result) ? result : [];
  } catch {
    return [];
  }
}

// ─── Dedup · owner-authored (nex_business) wins over canonical ─────

function mergeDedupe(
  canonicalRows: readonly NexBusinessRow[],
  nexBusinessRows: readonly NexBusinessRow[],
): NexBusinessRow[] {
  const seen = new Map<string, NexBusinessRow>();
  // Order matters · we insert canonical first then let nex_business
  // overwrite · owner-authored row wins on slug collision.
  for (const row of canonicalRows) {
    const key = (row.slug || row.id).toLowerCase();
    seen.set(key, row);
  }
  for (const row of nexBusinessRows) {
    const key = (row.slug || row.id).toLowerCase();
    seen.set(key, row);
  }
  return Array.from(seen.values());
}

// ─── Rank · exact > prefix > alias / contains > entity-type ────────

function rankByMatchQuality(
  rows: readonly NexBusinessRow[],
  q: string,
): NexBusinessRow[] {
  const lq = q.toLowerCase();
  const scored = rows.map((r) => ({ row: r, rank: computeRank(r, lq) }));
  // Lower rank number = better match · tie-break by name ascending.
  scored.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return (a.row.display_name || "").localeCompare(b.row.display_name || "");
  });
  return scored.map((s) => s.row);
}

function computeRank(row: NexBusinessRow, lq: string): number {
  const name = (row.display_name || "").toLowerCase();
  const slug = (row.slug || "").toLowerCase();
  if (name === lq || slug === lq) return 0; // exact
  if (name.startsWith(lq) || slug.startsWith(lq)) return 1; // prefix
  // Keywords (nex_business) + aliases (canonical) · containment
  const kw = (row as unknown as { search_keywords?: readonly string[] })
    .search_keywords;
  if (kw && kw.some((k) => (k || "").toLowerCase() === lq)) return 2; // exact alias
  if (name.includes(lq) || slug.includes(lq)) return 3; // substring
  if (kw && kw.some((k) => (k || "").toLowerCase().includes(lq))) return 4;
  // Entity-type match (service / food / accommodation / marketplace_seller)
  const et = (row as unknown as { business_category?: string | null })
    .business_category;
  if (et && et.toLowerCase() === lq) return 5;
  return 6;
}

// ─── Adapter · same shape as landing-feed-service.adaptRowToCard ───
// Deliberately duplicated here (not imported) to keep this search path
// isolated from any pre-existing dirty-tree work on landing-feed-
// service.ts. Any future change to the shared ViewModel must update
// BOTH adapters · they are intentionally kept in sync.

function adaptRowToSearchCard(row: NexBusinessRow): ListingCardViewModel {
  const slug = row.slug || row.id;
  const categoryId =
    (row as unknown as { business_category?: string | null })
      .business_category ?? null;
  // Canonical rows carry entity_type in business_category · route
  // through the canonical visuals resolver. nex_business rows go
  // through the standard resolver.
  const source: "canonical" | "nex_business" = isCanonicalSyntheticSlug(
    slug,
    row.id,
  )
    ? "canonical"
    : "nex_business";
  const visuals: CategoryVisuals =
    source === "canonical"
      ? visualsForCanonicalEntityType(categoryId)
      : visualsForCategoryId(categoryId);

  return {
    id: row.id,
    slug,
    title: row.display_name,
    categoryLabel: visuals.label,
    categoryId,
    categoryAccent: visuals.accent,
    categoryIconCol: visuals.iconCol,
    categoryIconRow: visuals.iconRow,
    imageUrl: row.logo_url ?? null,
    description: row.description ?? null,
    featuredOffering: null,
    city: readOptionalCity(row),
    // Owner directive 2026-10-27 · detail route is
    // `/nex-native/directory/{slug}` for both source types. The route
    // handler at src/app/nex-native/directory/[id]/page.tsx accepts
    // UUIDs AND nex_business slugs (301-redirects nex_business rows).
    href: `/nex-native/directory/${slug}`,
    source,
    priceNow: null,
    priceWas: null,
    discountLabel: null,
    priceAmountMinor: null,
    priceCurrency: null,
    sellerCountryIso: readCountryIso(row),
    buyerLocalPrice: null,
  };
}

// ─── Narrow helpers · tolerate NexBusinessRow's union-of-shapes ────

function isCanonicalSyntheticSlug(slug: string, id: string): boolean {
  // A canonical row's slug is set to its UUID by adaptCanonical in
  // local-directory-service.ts. A nex_business row's slug is a
  // human-readable string that differs from its id.
  return slug === id;
}

function readOptionalCity(row: NexBusinessRow): string | null {
  const city = (row as unknown as { city?: string | null }).city;
  if (typeof city === "string" && city.trim().length > 0) return city.trim();
  const address = (row as unknown as { address?: string | null }).address;
  if (typeof address === "string" && address.trim().length > 0) {
    // Address may carry "city, district" · extract first segment.
    const first = address.split(/[,/]/)[0];
    return first ? first.trim() : null;
  }
  return null;
}

function readCountryIso(row: NexBusinessRow): string | null {
  const c = (row as unknown as { country?: string | null }).country;
  if (typeof c !== "string") return null;
  const upper = c.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(upper) ? upper : null;
}

function normaliseCountry(input: string | null | undefined): string | null {
  if (typeof input !== "string") return null;
  const upper = input.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(upper) ? upper : null;
}

// Explicit boundary marker · future owner audits can grep for this
// to find every search-path addition.
export const _DIRECTORY_SEARCH_PATH_LANDED = "2026-10-27";

// ─── Product search · Phase 3 Product System Contract ─────────────
// Owner-authorised 2026-10-30. Live products (status='live') join
// the directory search results as cards that route directly to the
// product detail page.

async function searchProductsSafe(q: string, pool: number): Promise<ProductSearchRow[]> {
  try {
    return await productService.searchLiveProducts(q, pool);
  } catch {
    return [];
  }
}

function adaptProductRowToSearchCard(row: ProductSearchRow): ListingCardViewModel {
  // Shop URL base for the product. Product tap routes to the sealed
  // detail page at /nex-native/{businessSlug}/{productId}.
  const productHref = `/nex-native/${encodeURIComponent(row.business_slug)}/${encodeURIComponent(row.id)}`;
  // Visual · prefer a shop-attributed category visual if we have one.
  // Phase 1 fallback: generic product visuals via visualsForCategoryId
  // called with the business_category axis the business lives under.
  // For Phase 3 Product System work, we don't yet carry a
  // department-visual mapping · pass null to let the sealed helper
  // return its fallback.
  const visuals: CategoryVisuals = visualsForCategoryId(null);
  return {
    id: row.id,
    slug: row.business_slug,
    title: row.name,
    categoryLabel: visuals.label,
    categoryId: row.department_id,
    categoryAccent: visuals.accent,
    categoryIconCol: visuals.iconCol,
    categoryIconRow: visuals.iconRow,
    imageUrl: row.image_url,
    description:
      row.description && row.description.length > 0
        ? row.description
        : `From ${row.business_display_name}`,
    featuredOffering: null,
    city: null,
    href: productHref,
    // Reuse the sealed ListingCardViewModel source union · we tag
    // product rows as `nex_business` for Phase 1 to avoid widening
    // the union. The href already signals the product-detail route;
    // a future union extension can introduce `nex_product` cleanly.
    source: "nex_business",
    priceNow: formatProductPrice(row.price_pence, row.currency),
    priceWas: null,
    discountLabel: null,
    priceAmountMinor: row.price_pence,
    priceCurrency: row.currency,
    sellerCountryIso: null,
    buyerLocalPrice: null,
  };
}

function formatProductPrice(pence: number, currency: string): string | null {
  if (!Number.isFinite(pence) || pence < 0) return null;
  const major = pence / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "IDR" ? 0 : 2,
    }).format(major);
  } catch {
    return `${currency} ${major.toLocaleString()}`;
  }
}
