// src/lib/nex-native/directory/landing-feed-service.ts
//
// NEX Directory · landing feed service · Phase A · sealed 2026-10-16.
// --------------------------------------------------------------------
// Server-only orchestration layer that:
//
//   (1) Fetches eligible listings from the TWO existing data sources
//       in parallel · owner-claimed `nex_business` (via sealed
//       discovery-service · Supabase) + harvester canonical
//       `nex.business_canonical` (via sealed local-directory-service
//       · NEX Postgres).
//
//   (2) Deduplicates across sources by `slug || id`, with owner-
//       claimed rows winning. This mirrors the sealed Discover-page
//       pattern at `src/app/nex-native/search/page.tsx:426-434` ·
//       Phase A does NOT change deduplication semantics.
//
//   (3) Shapes each row into a lean `ListingCardViewModel` with ONLY
//       the fields the shared card UI needs · title + category label
//       + optional image + optional description + destination href.
//       NEVER fabricates prices, discounts, ratings, images or
//       promotional offers · owner rule #6, 2026-10-16.
//
//   (4) Returns an HONEST empty / reduced state when fewer than the
//       requested number of eligible rows exist. Zero padding, zero
//       mock cards.
//
// What this service deliberately does NOT do:
//
//   · Does NOT call the harvester's sealed services with a modified
//     signature · we consume the existing public APIs only.
//   · Does NOT apply migration 999_WIP (owner decision G5) · slug
//     dedup is the Phase A primitive.
//   · Does NOT invent any publication predicate · gaps G1 (Stay) /
//     G2 (Services) stay exactly as the owner approved. If a slug
//     has no coverage, we return [].
//   · Does NOT touch `nex_product` / `nex_menu_item` / `nex_service`
//     rows (owner decision G3 · one card per shop).
//
// Random ordering is driven by a `visitorSeed` the caller supplies.
// Same seed → same order (stable across refresh + Prev/Next). A fresh
// visit should mint a fresh seed · see `pickOrMintSeed` below.

import "server-only";

import * as discoveryService from "@/lib/nex-native/discovery-service";
import * as localDirectory from "@/lib/nex-native/local-directory-service";
import type { NexBusinessRow } from "@/lib/nex-native/types";
import { haversineKm } from "@/lib/nex-native/bike-delivery-service";

import {
  resolveLandingSlugToCategories,
  slugHasCanonicalVerticalCoverage,
  visualsForCategoryId,
  visualsForCanonicalEntityType,
  type LandingCategorySlug,
  type CategoryVisuals,
} from "./landing-category-mapping";
// A-strict Universal Directory Image · scope-gated CATEGORY_FALLBACK
// resolver · 2026-10-27 · see directory-image-adapter.ts for the full
// owner-authorised scope. Pure · no I/O.
import { resolveCategoryFallbackImageUrl } from "./directory-image-adapter";

// ─── Public view model ──────────────────────────────────────────────

/** Trimmed listing shape the shared `ListingCard` consumes. Fields
 *  that are not reliably present on either source are explicitly
 *  nullable · the card has graceful fallbacks and NEVER fabricates. */
export interface ListingCardViewModel {
  /** Opaque stable id for React keys + telemetry. Mirrors the row's
   *  database primary key (`nex_business.id` or
   *  `nex.business_canonical.canonical_business_id`). */
  readonly id: string;
  /** URL slug used for dedup AND for the destination route. For
   *  canonical rows that have no slug today, falls back to the row id. */
  readonly slug: string;
  /** Human-readable display name · guaranteed non-empty. */
  readonly title: string;
  /** Short human-readable category label (e.g. "Food", "Services").
   *  Mirrors the landing-tile group label the row belongs to. */
  readonly categoryLabel: string;
  /** Raw category enum id for downstream filters / telemetry.
   *  Nullable when the source row has no category. */
  readonly categoryId: string | null;
  /** Per-category accent colour for the card footer (icon glow +
   *  category label text). Resolved via `visualsForCategoryId` so
   *  the colour matches the landing-tile for the same category. */
  readonly categoryAccent: string;
  /** Sprite coordinates on `/nex-directory/icons/category-grid.png`
   *  for the card footer icon · 4 cols × 2 rows. Matches the
   *  landing-tile icon for the same category. */
  readonly categoryIconCol: 0 | 1 | 2 | 3;
  readonly categoryIconRow: 0 | 1;
  /** Optional primary image URL · null when the row has no image.
   *  Card renders an honest no-image treatment in the null case. */
  readonly imageUrl: string | null;
  /** Optional short description · null when none. */
  readonly description: string | null;
  /** Owner directive 2026-10-18 · when present, the directory card
   *  renders this as the bold HEADLINE (e.g. "Kings Room", "Nasi
   *  Goreng Istimewa", "Massage · 60 min") and demotes the business
   *  `title` to a small muted eyebrow above it. When null, the card
   *  falls back to showing `title` as the headline with no eyebrow
   *  (byte-identical to the pre-2026-10-18 render). Honest Phase A
   *  default: ALWAYS null for real feed rows · no data source yet
   *  carries featured-offering strings. Mock seeds populate this
   *  slot so the preview surface shows the two-line layout. */
  readonly featuredOffering: string | null;
  /** Optional city for the under-title line · null when none. */
  readonly city: string | null;
  /** Internal NEX route the card links to. For now: the per-shop
   *  landing page `/nex-native/{slug}`. */
  readonly href: string;
  /** Which source this listing came from · consumed by the card for
   *  a small source-identity chip:
   *    · `nex_business` → "Owner"
   *    · `canonical`    → "Directory"
   *    · `mock_seed`    → "SAMPLE" (orange · owner-authorised preview
   *      cards only · see `mock-seed-listings.ts`). Never confused
   *      with production data because the chip is visually distinct. */
  readonly source: "nex_business" | "canonical" | "mock_seed";
  // ─── Owner card-design template · 2026-10-16 ───────────────────
  //
  // The card template supports an orange discount badge, a cyan
  // now-price and a strikethrough was-price. Owner rule #6 stands:
  // these fields are populated ONLY from genuine listing data. The
  // card renders each slot CONDITIONALLY · a listing with no price
  // data shows no price row, no discount badge. Never fabricated.
  //
  // Phase A has NO data source that carries pricing today · the
  // adapter sets all three fields to `null` for every row. These
  // slots light up when a Phase 1.5+ data model wires them.
  /** Owner directive 2026-10-18 · Slice 2 · structured price amount
   *  for buyer-currency conversion. Minor units (e.g. 95,000,000
   *  for Rp 950,000 at IDR's 100 minor-units-per-major scale from
   *  the sealed currencies.ts). Null when no price data today. The
   *  display string `priceNow` stays authoritative for the seller's
   *  currency · this field exists ONLY so the FX pipeline can
   *  convert the amount into the viewer's picked currency. */
  readonly priceAmountMinor: number | null;
  /** Owner directive 2026-10-18 · Slice 2 · ISO 4217 code of the
   *  authoritative seller currency associated with `priceAmountMinor`.
   *  Null when no price data. Validated against NEX_CURRENCIES at
   *  consume-time; a code outside the whitelist is treated as null. */
  readonly priceCurrency: string | null;
  /** Current price as a pre-formatted string (e.g. "$59.99").
   *  Null when the listing has no pricing data today. */
  readonly priceNow: string | null;
  /** Previous / crossed-out price (e.g. "$99.99"). Null when
   *  no promotional pricing exists.
   *  2026-10-16 · the directory ListingCard no longer renders this
   *  field (owner directive · "do not imply a discount without
   *  genuine supporting data"). The field stays in the view model
   *  so a future surface with verified discount data can light it
   *  up without a view-model reshape. */
  readonly priceWas: string | null;
  /** Discount badge text (e.g. "-40%"). Null when no promotion.
   *  Same policy as `priceWas` · directory card does not render,
   *  slot retained for future verified-discount surfaces. */
  readonly discountLabel: string | null;
  // ─── Seller flag + buyer-currency conversion · Phase A patch ─
  //
  // Owner directive 2026-10-16 · the directory card shows a small
  // circular flag next to the authoritative seller price. The
  // secondary (buyer-currency) slot stays nullable and empty until
  // a Phase 1.5 FX-source + freshness policy is approved. Country
  // (location) and currency (ISO-4217) are deliberately separate:
  // the flag is location, the price must use the actual seller
  // currency.
  /** The seller's country · ISO alpha-2 uppercase (`^[A-Z]{2}$`).
   *  Null when the source doesn't expose country for this row.
   *  Today:
   *    · nex_business rows: always null (table has no country column)
   *    · canonical rows: null today (sealed adapter does not yet
   *      emit country on the NexBusinessRow it returns · a future
   *      owner-authorised adapter update would unlock this)
   *    · mock_seed rows: whatever the mock seed declares
   *  Never inferred from the viewer's location. */
  readonly sellerCountryIso: string | null;
  /** Approximate buyer-currency equivalent · populated by a future
   *  Phase 1.5 FX surface only when a real, sufficiently-fresh rate
   *  is available. ALWAYS null in Phase A. Shape fixes the slot so
   *  Phase 1.5 can light it up without a view-model reshape:
   *    · priceDisplay · pre-formatted (e.g. "~Rp 950,000")
   *    · countryIso   · buyer's country ISO alpha-2 for the flag
   *    · fxUpdatedAt  · ISO timestamp for the "rate updated" hint
   *  Rendered empty today. */
  readonly buyerLocalPrice: {
    readonly priceDisplay: string;
    readonly countryIso: string;
    readonly fxUpdatedAt: string;
  } | null;
}

// ─── Options + outcomes ─────────────────────────────────────────────

export interface GetLandingFeedOptions {
  /** Max cards to return · owner-approved 2 for mobile Featured Deals,
   *  up to 24 for the directory grid. Clamped to [1, 24]. */
  readonly limit?: number;
  /** Stable per-visit random seed. SAME seed → SAME ordering across
   *  refresh + pagination. Caller mints a fresh seed per fresh visit
   *  (see `pickOrMintSeed`). */
  readonly visitorSeed: string;
  /** Optional landing category slug (`products`, `food`, `stay`, …).
   *  Honoured per `landing-category-mapping.ts`. Unsupported slugs
   *  return an honest empty feed. */
  readonly categorySlug?: LandingCategorySlug | null;
  /** Optional ISO-3166 alpha-2 country filter (uppercased). The
   *  canonical source honours this · the Supabase source has no
   *  country column and will contribute an empty list when a country
   *  filter is set (owner-approved honest-null, mirrors the Discover
   *  page's behaviour). */
  readonly country?: string | null;
  /** Pagination offset for the directory grid. Ignored by the Featured
   *  Deals row (which always wants the first N). */
  readonly offset?: number;
  /** Owner directive 2026-10-16 · optional distance filter in
   *  kilometres from the viewer's coordinates. Applied AFTER
   *  merge+shuffle so pagination stays stable. Rows without
   *  `location_lat` / `location_lng` are EXCLUDED when a distance
   *  filter is active (honest-null · never fabricate). */
  readonly maxDistanceKm?: number | null;
  readonly viewerLat?: number | null;
  readonly viewerLng?: number | null;
}

export interface LandingFeedOutcome {
  readonly ok: boolean;
  readonly cards: readonly ListingCardViewModel[];
  readonly totalEligible: number | null; // null if either source failed
  readonly seed: string; // echoed back so caller can thread through URLs
  readonly reducedState?:
    | "no_eligible_rows"
    | "fewer_than_requested"
    | "slug_unsupported";
}

const MAX_LIMIT = 24;
const MIN_LIMIT = 1;
const CANONICAL_POOL = 100;
const NEX_BUSINESS_POOL = 100;

/** Resolve the effective limit · clamped and defaulting to 2
 *  (owner-approved Featured Deals default on mobile). */
function clampLimit(input: number | undefined): number {
  const n = Math.floor(input ?? 2);
  if (!Number.isFinite(n) || n < MIN_LIMIT) return MIN_LIMIT;
  if (n > MAX_LIMIT) return MAX_LIMIT;
  return n;
}

/** Resolve a visitor seed · if the caller passed a usable one, keep
 *  it; otherwise mint a fresh short seed. Owner directive 2026-10-16
 *  "url is small" · the minted seed is a 6-character base36 slice of
 *  a 32-bit random draw, giving ~2 billion possible values · more
 *  than enough entropy for shuffle stability and keeps the URL short
 *  (e.g. `?s=k9x3zq`). */
const MIN_SEED_LENGTH = 1;
const MAX_SEED_LENGTH = 64;
const MINTED_SEED_LENGTH = 6;

export function pickOrMintSeed(input: string | null | undefined): string {
  if (
    typeof input === "string" &&
    input.length >= MIN_SEED_LENGTH &&
    input.length <= MAX_SEED_LENGTH
  ) {
    return input;
  }
  // Node + browser crypto both expose getRandomValues; fall back to
  // Math.random when neither is available (jsdom test envs). The seed
  // is non-security-critical · it only drives stable sort ordering.
  const g = (globalThis as { crypto?: { getRandomValues?: (b: Uint32Array) => void } }).crypto;
  const buf = new Uint32Array(1);
  if (g?.getRandomValues) {
    g.getRandomValues(buf);
  } else {
    buf[0] = Math.floor(Math.random() * 0xffffffff);
  }
  // Pad with leading '0's so the seed length is deterministic even
  // when the random draw is small (e.g. 42 → base36 "16" → "000016").
  return buf[0]!.toString(36).padStart(MINTED_SEED_LENGTH, "0").slice(
    0,
    MINTED_SEED_LENGTH,
  );
}

// ─── Core orchestrator ──────────────────────────────────────────────

/**
 * Fetch merged, deduped, shuffled, category-filtered eligible
 * listings for a given visitor seed. Server-only.
 *
 * Honours the owner's Phase A rules:
 *   · One card per shop (G3) · never multiplies rows per product.
 *   · Honest empty when no eligible rows exist.
 *   · Honest reduced when fewer than requested limit are eligible.
 *   · Honest empty for unsupported slugs (G1 Stay has no owner-side
 *     coverage · G4 travel/transport/deals have no mapping).
 *   · Preserves existing visibility predicates in each source · we
 *     consume the sealed `list*` services and do no raw-table reads.
 */
export async function getLandingFeed(
  opts: GetLandingFeedOptions,
): Promise<LandingFeedOutcome> {
  const limit = clampLimit(opts.limit);
  const seed = pickOrMintSeed(opts.visitorSeed);
  const country = normaliseCountry(opts.country);
  const slug = opts.categorySlug ?? null;

  // ─── Slug coverage check (G1 + G4) ──────────────────────────────
  //
  // If the slug is a known unsupported one (travel / transport /
  // deals) OR a canonical-only one (stay / accommodation) where the
  // canonical layer has no eligible rows yet, we short-circuit with
  // an honest empty response rather than fabricating.
  const nexBusinessCategories = resolveLandingSlugToCategories(slug);
  const canonicalVertical = slugHasCanonicalVerticalCoverage(slug);
  const slugIsSupported =
    slug === null ||
    nexBusinessCategories.length > 0 ||
    canonicalVertical;

  if (!slugIsSupported) {
    return {
      ok: true,
      cards: [],
      totalEligible: 0,
      seed,
      reducedState: "slug_unsupported",
    };
  }

  // ─── Parallel source fetches · stable pool · Phase A.1 fix ──────
  //
  // Phase A audit D-1/D-2 fix (owner-approved 2026-10-16):
  //
  //   · nex_business was previously fetched via
  //     `listRandomBusinesses` which Fisher-Yates shuffles with
  //     `Math.random()` (NOT seeded). Two refreshes with the same
  //     visitor seed produced different cards · across pages, rows
  //     could duplicate or be skipped.
  //
  //   · We now fetch a DETERMINISTIC pool from each source at
  //     offset 0 (always). The merged pool is then shuffled ONCE
  //     with the mulberry+seed PRNG and the page's slice is taken
  //     by `[offset..offset+limit]`. Same seed + same page → same
  //     cards. Different pages → non-overlapping slices.
  //
  //   · nex_business is a Supabase source · no country column, so
  //     when a country filter is active we skip it (honest-null).
  const [nexBusinessRows, canonicalRows] = await Promise.all([
    fetchNexBusinessRows({
      categories: nexBusinessCategories,
      skipBecauseCountryFilter: country !== null,
      poolSize: NEX_BUSINESS_POOL,
    }),
    fetchCanonicalRows({
      limit: CANONICAL_POOL,
      offset: 0, // ALWAYS 0 · page slicing happens on the merged pool
      country,
      seed,
    }),
  ]);

  // ─── Slug-based dedup · owner-claimed WINS ──────────────────────
  //
  // Mirrors `src/app/nex-native/search/page.tsx:426-434` exactly.
  // When a slug collides, the `nex_business` row (owner-claimed)
  // takes precedence over the canonical row carrying the same slug.
  const seen = new Set<string>();
  const merged: NexBusinessRow[] = [];
  for (const row of [...nexBusinessRows, ...canonicalRows]) {
    const key = row.slug || row.id;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(row);
  }

  // ─── Seed-stable shuffle (Fisher-Yates with seeded PRNG) ────────
  //
  // Both source fetches are now deterministic for identical args.
  // Mulberry shuffle with the same seed on the same input produces
  // the same output. Combined with the slice-by-page-offset below,
  // this guarantees: same seed + same page → same cards; different
  // pages → non-overlapping slices.
  shuffleInPlaceWithSeed(merged, seed);

  // ─── Distance filter · owner directive 2026-10-16 ───────────────
  //
  // Applied AFTER the shuffle so pagination remains stable. When a
  // maxDistanceKm is active AND viewer coordinates are present:
  //   · Rows WITH `location_lat` + `location_lng` are kept iff
  //     haversineKm <= maxDistanceKm.
  //   · Rows WITHOUT coordinates are EXCLUDED (honest-null · we
  //     cannot assert they are within range).
  // When maxDistanceKm is null or the viewer has no coords, every
  // row passes through untouched.
  const maxKm = opts.maxDistanceKm ?? null;
  const vLat = opts.viewerLat ?? null;
  const vLng = opts.viewerLng ?? null;
  const filtered =
    maxKm !== null && vLat !== null && vLng !== null
      ? merged.filter((row) => {
          const rLat = (row as unknown as { location_lat?: unknown }).location_lat;
          const rLng = (row as unknown as { location_lng?: unknown }).location_lng;
          if (typeof rLat !== "number" || typeof rLng !== "number") return false;
          return haversineKm(vLat, vLng, rLat, rLng) <= maxKm;
        })
      : merged;

  // ─── Page slice ─────────────────────────────────────────────────
  const offset = Math.max(0, opts.offset ?? 0);
  const page = filtered.slice(offset, offset + limit);
  const cards = page.map(adaptRowToCard);

  // ─── Honest-reduced classification ──────────────────────────────
  let reducedState: LandingFeedOutcome["reducedState"] | undefined;
  if (cards.length === 0) reducedState = "no_eligible_rows";
  else if (cards.length < limit) reducedState = "fewer_than_requested";

  return {
    ok: true,
    cards,
    // Reflect the post-filter count so the directory header + prev/next
    // numbers stay honest when a distance filter is active.
    totalEligible: filtered.length,
    seed,
    reducedState,
  };
}

// ─── Internals ──────────────────────────────────────────────────────

interface FetchNexBusinessArgs {
  readonly categories: readonly string[];
  readonly skipBecauseCountryFilter: boolean;
  readonly poolSize: number;
}

/** Pull a DETERMINISTIC pool of owner-claimed, non-archived
 *  businesses from Supabase and (if a category filter is live)
 *  narrow to the slugs the landing-category mapping resolves to.
 *
 *  Phase A.1 fix (owner-approved 2026-10-16) · switched from
 *  `listRandomBusinesses` (non-deterministic Math.random Fisher-Yates
 *  shuffle inside the sealed service) to `listBusinessesPaged` which
 *  returns rows in a stable `created_at DESC` order. The feed
 *  service's own `shuffleInPlaceWithSeed` is now the ONLY shuffle
 *  layer, keyed on the visitor seed · fully deterministic for the
 *  same seed. Resolves Phase A audit defects D-1 (duplicates/skips
 *  across pages) + D-2 (nex_business offset never applied).
 *
 *  Note on the category-filter path: `listBusinessesPaged` doesn't
 *  accept a category filter so we fetch the pool, then narrow
 *  client-side. The sealed `listBusinessesPaged` caps `limit` at
 *  100 rows, so the Phase A pool size is bounded naturally. */
async function fetchNexBusinessRows(
  args: FetchNexBusinessArgs,
): Promise<readonly NexBusinessRow[]> {
  if (args.skipBecauseCountryFilter) return [];
  try {
    const pool = await discoveryService.listBusinessesPaged(
      args.poolSize,
      0, // always 0 · page slicing happens on the merged pool
    );
    if (args.categories.length === 0) return pool;
    const want = new Set<string>(args.categories);
    return pool.filter(
      (r) => r.business_category !== null && want.has(r.business_category),
    );
  } catch {
    return [];
  }
}

interface FetchCanonicalArgs {
  readonly limit: number;
  readonly offset: number;
  readonly country: string | null;
  readonly seed: string;
}

/** Pull a seed-shuffled page of canonical, non-superseded, named rows
 *  from the sealed local-directory service. */
async function fetchCanonicalRows(
  args: FetchCanonicalArgs,
): Promise<readonly NexBusinessRow[]> {
  try {
    return await localDirectory.listCanonicalBusinessesPaged(
      args.limit,
      args.offset,
      { country: args.country, seed: args.seed },
    );
  } catch {
    return [];
  }
}

function normaliseCountry(input: string | null | undefined): string | null {
  if (typeof input !== "string") return null;
  const upper = input.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(upper) ? upper : null;
}

/** Deterministic small-state PRNG seeded from the visitor seed.
 *  Mulberry32 · one 32-bit state · adequate for shuffle stability.
 *  Not cryptographically secure · never used for secrets. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a 32-bit hash · maps the visitor-seed string into the 32-bit
 *  seed Mulberry32 expects. */
function seedHash(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function shuffleInPlaceWithSeed<T>(arr: T[], seed: string): void {
  const rnd = mulberry32(seedHash(seed));
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
}

/** Shape an existing NexBusinessRow into the shared view model.
 *  NEVER fabricates: fields that are not reliably present on a row
 *  are passed through as null. The card renders them accordingly. */
function adaptRowToCard(row: NexBusinessRow): ListingCardViewModel {
  const slug = row.slug || row.id;
  const categoryId = row.business_category ?? null;
  const source: "nex_business" | "canonical" = isCanonicalSyntheticSlug(
    slug,
    row.id,
  )
    ? "canonical"
    : "nex_business";
  // Canonical rows carry `entity_type` in their `business_category`
  // slot (see adaptCanonical in local-directory-service.ts). That is
  // NOT a NEX_BUSINESS_CATEGORIES value · route it through the
  // canonical-entity-type visuals resolver which pins the neutral
  // default. nex_business rows go through the standard resolver.
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
    // Universal Image Doctrine priority (2026-08-22) · the resolver is
    // the single authority. OWNER_IMAGE is honoured upstream via the
    // seller-uploaded `logo_url` and takes precedence. When no owner
    // image exists, the A-strict adapter supplies a CATEGORY_FALLBACK
    // url ONLY for owner-authorised rows (country=ID + canonical food
    // family). Every other row keeps a null here and the card renders
    // its honest letter-monogram.
    imageUrl: row.logo_url ?? resolveCategoryFallbackImageUrl(row, source),
    description: row.description ?? null,
    // Owner directive 2026-10-18 · featured-offering slot wired in
    // the view model so the directory card can show "Kings Room" /
    // "Nasi Goreng Istimewa" style headlines. Phase A has no data
    // source for this yet · the adapter sets null and the card
    // falls back to the business title as the headline. Mock seeds
    // populate this slot so the two-line layout is visible in
    // preview.
    featuredOffering: null,
    city: readOptionalCity(row),
    // Owner directive 2026-10-27 · fix broken detail navigation.
    // The directory-side detail surface lives at
    // src/app/nex-native/directory/[id]/page.tsx. The route handler
    // accepts BOTH canonical UUIDs AND nex_business slugs (it 301-
    // redirects nex_business rows to their owner cover page).
    //
    // Previously this adapter emitted `/nex-native/${slug}` which has
    // no matching route · the request falls through to the catch-all
    // and 307-redirects to /nex-native/home. The sibling resolvers
    // (market-cta-resolver.ts:135, _landing-directory-view.tsx:114,
    // _filter-sheet-client.tsx:116) all use `/nex-native/directory/
    // ${slug}` · we now match that pattern for cards too.
    //
    // Verified live 2026-10-27 against the running dev server:
    //   /nex-native/directory/<canonical-uuid> → 200
    //   /nex-native/directory/<nex_business-slug> → 200
    //   /nex-native/<any> → 307 → /nex-native/home (BROKEN)
    href: `/nex-native/directory/${slug}`,
    source,
    // Phase A · no data source carries pricing today · owner rule #6.
    // Card renders each slot conditionally so a null simply hides it.
    priceNow: null,
    priceWas: null,
    discountLabel: null,
    // Owner directive 2026-10-18 · Slice 2 · structured price slot
    // for buyer-currency conversion. Null today for production rows ·
    // mocks populate both so the FX pipeline is demonstrable now.
    priceAmountMinor: null,
    priceCurrency: null,
    // Phase A · defensive pull · the sealed adapter in local-directory
    // service does not currently emit `country` on NexBusinessRow but
    // the raw canonical row has an ISO alpha-2 country column. If a
    // future owner-authorised adapter update exposes it, this picks
    // up automatically. For nex_business rows (no country column),
    // this returns null · the card falls back to the price-only line.
    sellerCountryIso: readOptionalCountryIso(row),
    // Phase A · buyer-currency conversion is a deferred capability ·
    // slot is wired in the view model so Phase 1.5 can light it up
    // without a reshape. Owner directive · never populated from a
    // fabricated rate.
    buyerLocalPrice: null,
  };
}

/** Guess the source by comparing the slug to the id · a canonical
 *  row with no proper slug has `slug === id`. This heuristic is
 *  pragmatic for Phase A · future work (G5 · migration 999_WIP)
 *  can replace it with an explicit `source` tag on the row. */
function isCanonicalSyntheticSlug(slug: string, id: string): boolean {
  return slug === id;
}

/** Some rows carry an optional city field through the adapter · we
 *  read it defensively because the `NexBusinessRow` type does not
 *  declare it uniformly across both sources. */
function readOptionalCity(row: NexBusinessRow): string | null {
  const anyRow = row as unknown as { city?: unknown };
  if (typeof anyRow.city === "string" && anyRow.city.length > 0) {
    return anyRow.city;
  }
  return null;
}

/** Pure validator · owner-approved shape `^[A-Z]{2}$`. Rejects
 *  invalid or missing values · returns null so the card's flag slot
 *  falls back cleanly (price-only line). Never infers from the
 *  viewer's location. */
const ISO_ALPHA_2 = /^[A-Z]{2}$/;
function readOptionalCountryIso(row: NexBusinessRow): string | null {
  const anyRow = row as unknown as { country?: unknown };
  if (typeof anyRow.country !== "string") return null;
  const upper = anyRow.country.trim().toUpperCase();
  return ISO_ALPHA_2.test(upper) ? upper : null;
}

// Expose a few internals for tests · never for app code.
export const __internal = {
  shuffleInPlaceWithSeed,
  seedHash,
  adaptRowToCard,
};
