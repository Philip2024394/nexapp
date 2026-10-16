// src/lib/nex-native/local-directory-service.ts
//
// Read-only adapter from the local nex_dev Postgres directory layer
// (business_canonical + verticals) into the NEX user-facing search UI.
//
// Safety contract:
//   · "server-only" import prevents client-bundle inclusion.
//   · Every query runs inside BEGIN TRANSACTION READ ONLY ... ROLLBACK.
//     Postgres rejects any write at the session layer.
//   · This module reads NEX_POSTGRES_URL (the local dev DB). It is NOT
//     the sanctioned production read-only path at
//     src/lib/nex/verification/readonly-pg.ts (which explicitly rejects
//     localhost / nex_dev). This file exists specifically so the dev
//     server's /nex-native/search can surface the real 22k canonical
//     businesses that live in nex_dev — without touching Supabase.
//
// Shape:
//   · Returns rows cast to the public UI shape (compatible with
//     ResultBusinessCard). Adapter maps canonical columns onto the
//     fields the card actually reads; unused fields default to null.

import "server-only";
import { Pool } from "pg";
import type { NexBusinessRow } from "./types";

let pool: Pool | null = null;

function getPool(): Pool {
  if (pool) return pool;
  const url = process.env.NEX_POSTGRES_URL;
  if (!url) {
    throw new Error(
      "local-directory-service: NEX_POSTGRES_URL not set — cannot reach local Postgres directory",
    );
  }
  pool = new Pool({ connectionString: url, max: 4 });
  return pool;
}

async function readOnlyQuery<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN TRANSACTION READ ONLY");
    const result = await client.query(sql, params);
    await client.query("ROLLBACK");
    return result.rows as T[];
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    client.release();
  }
}

interface CanonicalRow {
  canonical_business_id: string;
  name_canonical: string;
  entity_type: string;
  country: string;
  lifecycle_state: string;
  city: string | null;
  district: string | null;
  category_ids: string[] | null;
  website_apex: string | null;
  phone_e164: string | null;
  last_verified_at: Date | null;
  // Pass-10 vertical-table enrichment overlay (joined via
  // `nex.food_business.canonical_business_id`). Each column is null
  // when the row does not have a food_business row OR when the
  // vertical column itself is null. The adapter uses these as
  // fallback for the display fields when the canonical column is null.
  //
  // WhatsApp is intentionally NOT selected · NEX is the messaging
  // product (NEX chat with NEX ID is the WhatsApp replacement) ·
  // surfacing WhatsApp here would send search visitors to a
  // competitor. OSM WhatsApp numbers remain in
  // `nex.food_business.whatsapp_number` for HQ marketing outreach
  // only.
  fb_phone: string | null;
  fb_website: string | null;
  fb_category: string | null;
  fb_categories: string[] | null;
  fb_address: string | null;
  // Added 2026-10-13 · accommodation vertical enrichment overlay
  // (joined via `nex.accommodation_business.canonical_business_id`).
  // Hotel / villa / guesthouse rows carry amenities + rating + review
  // count sourced from the walker. The adapter surfaces these on the
  // adapted row via loose fields so NEX Discover's AmenityChips and
  // RatingChip can read them without widening NexBusinessRow for
  // every non-accommodation caller.
  ab_amenities: string[] | null;
  ab_rating: number | null;
  ab_review_count: number | null;
  ab_rating_source: string | null;
  // Walker-sourced coordinates · nex_business.location_lat/lng is
  // populated for 0/169 shops today, but 9,203 accommodation rows +
  // 23,328 food_business rows carry real coords. Projecting them
  // through the adapter unlocks the distance pill on the full
  // directory corpus. Added 2026-10-13.
  // NUMERIC columns · node-postgres returns them as string. Keep the
  // row interface honest so the adapter uses `coerceLatLng` instead of
  // a strict typeof-number guard that would silently drop every value.
  fb_lat: number | string | null;
  fb_lng: number | string | null;
  ab_lat: number | string | null;
  ab_lng: number | string | null;
}

const VERIFIED_LIFECYCLE_STATES = new Set([
  "VERIFIED",
  "OWNER_CLAIMED",
  "OWNER_VERIFIED",
]);

/** node-postgres returns NUMERIC columns as strings by default to
 *  preserve precision. Coerce to a validated finite number · null
 *  on failure. Used for the walker lat/lng columns. */
function coerceLatLng(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Empty-string → null · OSM-origin food_business rows sometimes hold
 *  `''` where the upstream feed had no value. The fallback semantics
 *  need a true null to recognise "no vertical value either". Pure. */
function nonEmpty(v: string | null): string | null {
  if (v === null) return null;
  const trimmed = v.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function adaptCanonical(row: CanonicalRow): NexBusinessRow {
  const verifiedAt = VERIFIED_LIFECYCLE_STATES.has(row.lifecycle_state)
    ? row.last_verified_at?.toISOString() ?? new Date(0).toISOString()
    : null;
  const slug = row.canonical_business_id;

  // Enrichment-fallback semantics: canonical column wins when non-null,
  // enrichment overlay fills gaps for OSM-origin rows where the sealed
  // resolver did not re-project presentation fields. Not fabrication ·
  // the food_business row is the canonical row's upstream evidence
  // (recorded in business_evidence.legacy_source_table).
  const fbPhone = nonEmpty(row.fb_phone);
  const fbWebsite = nonEmpty(row.fb_website);
  const fbCategory = nonEmpty(row.fb_category);
  const fbCategories = row.fb_categories ?? [];
  const fbAddress = nonEmpty(row.fb_address);

  // chips: canonical category_ids win when non-empty; otherwise fall
  // back to the vertical primary + secondary categories.
  const canonicalChips = (row.category_ids ?? []).filter(
    (c) => typeof c === "string" && c.trim().length > 0,
  );
  const verticalChipsList = fbCategory
    ? [fbCategory, ...fbCategories.filter((c) => c !== fbCategory)]
    : fbCategories;
  const chips =
    canonicalChips.length > 0 ? canonicalChips.slice(0, 3) : verticalChipsList.slice(0, 3);

  // phone: canonical phone_e164 wins; fallback to food_business.phone.
  const phoneResolved = row.phone_e164 ?? fbPhone;

  // website_url: canonical website_apex wins (prefixed https://);
  // fallback to food_business.website which may already be a full URL
  // or a bare host · pass through verbatim when non-empty.
  const websiteResolved = row.website_apex
    ? `https://${row.website_apex}`
    : fbWebsite;

  // address: prefer the richer vertical address line when the canonical
  // row only has district + city granularity. Falls back to the joined
  // district+city string when neither vertical address nor those parts
  // exist. Never fabricated.
  const addressPieces = [row.district, row.city].filter(Boolean) as string[];
  const canonicalAddressLine = addressPieces.join(", ") || null;
  const addressResolved = fbAddress ?? canonicalAddressLine;

  return {
    id: row.canonical_business_id,
    owner_account_id: "",
    display_name: row.name_canonical,
    slug,
    description: null,
    logo_url: null,
    hours: null,
    address: addressResolved,
    public_phone: phoneResolved,
    public_email: null,
    website_url: websiteResolved,
    payment_instructions: null,
    accepts_cod: false,
    accepts_pickup: false,
    status_message: null,
    status_message_expires_at: null,
    archived_at: null,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
    city: row.city,
    business_category: row.entity_type,
    search_keywords: chips,
    verified_at: verifiedAt,
    // Walker-sourced coords · prefer food_business.coords, fall back
    // to accommodation_business.coords. These populate the standard
    // location_lat / location_lng fields so distance calc works for
    // 32k+ directory rows that would otherwise be location-blind.
    // NUMERIC columns arrive as string from node-postgres by
    // default; the coerceLatLng helper handles both number + string.
    location_lat: coerceLatLng(row.fb_lat ?? row.ab_lat),
    location_lng: coerceLatLng(row.fb_lng ?? row.ab_lng),
    // Accommodation-vertical overlay · surfaced via loose fields so
    // NEX Discover's AmenityChips + RatingChip can read them without
    // widening NexBusinessRow for non-accommodation callers. Values
    // from `nex.accommodation_business` via LEFT JOIN · all null on
    // non-accommodation canonical rows.
    amenities: Array.isArray(row.ab_amenities) ? row.ab_amenities : null,
    rating: typeof row.ab_rating === "number" ? row.ab_rating : null,
    review_count:
      typeof row.ab_review_count === "number" ? row.ab_review_count : null,
    rating_source:
      typeof row.ab_rating_source === "string" ? row.ab_rating_source : null,
  } as unknown as NexBusinessRow;
}

// Pass-10: LEFT JOIN on `nex.food_business` adds the vertical-table
// enrichment fields in a single round trip. The join key is
// `canonical_business_id` on both tables · identity-matched, never
// name-matched. The LEFT JOIN preserves canonical rows that have no
// food_business row (non-food verticals, pre-link rows) · their fb_*
// columns resolve to null and the adapter degrades gracefully.
//
// NEVER select `whatsapp_number` here · see interface comment above.
const LIST_SELECT = `
  bc.canonical_business_id, bc.name_canonical, bc.entity_type, bc.country,
  bc.lifecycle_state, bc.city, bc.district, bc.category_ids, bc.website_apex,
  bc.phone_e164, bc.last_verified_at,
  fb.phone        AS fb_phone,
  fb.website      AS fb_website,
  fb.category     AS fb_category,
  fb.categories   AS fb_categories,
  fb.address      AS fb_address,
  ab.amenities    AS ab_amenities,
  ab.rating       AS ab_rating,
  ab.review_count AS ab_review_count,
  ab.rating_source AS ab_rating_source,
  fb.coordinates_lat AS fb_lat,
  fb.coordinates_lng AS fb_lng,
  ab.coordinates_lat AS ab_lat,
  ab.coordinates_lng AS ab_lng
`;

const LIST_FROM = `
  nex.business_canonical bc
  LEFT JOIN nex.food_business fb
    ON fb.canonical_business_id = bc.canonical_business_id
  LEFT JOIN nex.accommodation_business ab
    ON ab.canonical_business_id = bc.canonical_business_id
`;

export async function listRandomCanonicalBusinesses(
  limit = 12,
): Promise<NexBusinessRow[]> {
  const clamped = Math.min(50, Math.max(1, Math.floor(limit)));
  const rows = await readOnlyQuery<CanonicalRow>(
    `SELECT ${LIST_SELECT}
       FROM ${LIST_FROM}
      WHERE bc.superseded_by_business_id IS NULL
        AND length(trim(bc.name_canonical)) > 0
      ORDER BY random()
      LIMIT $1`,
    [clamped],
  );
  return rows.map(adaptCanonical);
}

/**
 * Deterministic paged list for NEX Discover (added 2026-10-13).
 * Ordered by canonical_business_id (stable UUID sort) so Prev/Next
 * returns a consistent set per page. Does NOT shuffle.
 */
export async function listCanonicalBusinessesPaged(
  limit = 24,
  offset = 0,
  opts: { readonly country?: string | null; readonly seed?: string | null } = {},
): Promise<NexBusinessRow[]> {
  const l = Math.min(100, Math.max(1, Math.floor(limit)));
  const o = Math.max(0, Math.floor(offset));
  const country =
    typeof opts.country === "string" && /^[A-Z]{2}$/.test(opts.country.toUpperCase())
      ? opts.country.toUpperCase()
      : null;
  // Per-visit seed · drives md5-hashed ORDER BY so first-page content
  // varies between fresh visits but STAYS STABLE across pagination
  // within the same visit (same seed → same sort → same page content).
  // Null seed → deterministic canonical_business_id sort (reproducible
  // in tests and for cached CDN requests).
  const seed =
    typeof opts.seed === "string" && opts.seed.length > 0 && opts.seed.length <= 64
      ? opts.seed
      : null;

  const baseWhere = `bc.superseded_by_business_id IS NULL
                      AND length(trim(bc.name_canonical)) > 0`;
  const where = country ? `${baseWhere} AND bc.country = $3` : baseWhere;
  const orderBy = seed
    ? `ORDER BY md5(bc.canonical_business_id::text || $${country ? 4 : 3})`
    : `ORDER BY bc.canonical_business_id`;

  const params: unknown[] = country ? [l, o, country] : [l, o];
  if (seed) params.push(seed);

  const rows = await readOnlyQuery<CanonicalRow>(
    `SELECT ${LIST_SELECT}
       FROM ${LIST_FROM}
      WHERE ${where}
      ${orderBy}
      LIMIT $1 OFFSET $2`,
    params,
  );
  return rows.map(adaptCanonical);
}

/** Total non-superseded canonical businesses with a non-empty name.
 *  Drives hasNext on the Discover pagination control. Country filter
 *  added 2026-10-13 for the country selector · empty / unknown ISO
 *  returns the global total. */
export async function countCanonicalBusinessesAll(
  opts: { readonly country?: string | null } = {},
): Promise<number> {
  const country =
    typeof opts.country === "string" && /^[A-Z]{2}$/.test(opts.country.toUpperCase())
      ? opts.country.toUpperCase()
      : null;
  const sql = country
    ? `SELECT COUNT(*)::text AS n
         FROM nex.business_canonical bc
        WHERE bc.superseded_by_business_id IS NULL
          AND length(trim(bc.name_canonical)) > 0
          AND bc.country = $1`
    : `SELECT COUNT(*)::text AS n
         FROM nex.business_canonical bc
        WHERE bc.superseded_by_business_id IS NULL
          AND length(trim(bc.name_canonical)) > 0`;
  const rows = await readOnlyQuery<{ n: string }>(
    sql,
    country ? [country] : [],
  );
  const parsed = Number(rows[0]?.n ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

export interface CountryTotalRow {
  readonly iso: string;
  readonly n: number;
}

/** List every country ISO that has at least one canonical row, with
 *  its canonical count. Drives the NEX Discover country selector so
 *  it can show real buckets with real counts (0-count countries are
 *  surfaced separately via the world_country / discovery_programme
 *  tables, not from here). */
export async function listCountriesWithCanonical(): Promise<CountryTotalRow[]> {
  const rows = await readOnlyQuery<{ country: string; n: string }>(
    `SELECT country, COUNT(*)::text AS n
       FROM nex.business_canonical
      WHERE superseded_by_business_id IS NULL
        AND length(trim(name_canonical)) > 0
   GROUP BY country
   ORDER BY COUNT(*) DESC`,
  );
  return rows.map((r) => ({ iso: r.country, n: Number(r.n) || 0 }));
}

// Query shortcuts that map a plain word to a canonical entity_type.
// When a visitor searches one of these, we broaden the match to include
// every row of that vertical — not just rows whose NAME contains the word.
// e.g. "food" → 22,757 food_business rows, not just 406 named "food".
const ENTITY_TYPE_ALIASES: Record<string, string> = {
  food: "food",
  foods: "food",
  "food & drinks": "food",
  "food and drinks": "food",
  restaurants: "food",
  restaurant: "food",
  cafe: "food",
  cafes: "food",
  warung: "food",
  accommodation: "accommodation",
  accommodations: "accommodation",
  hotels: "accommodation",
  hotel: "accommodation",
  villa: "accommodation",
  villas: "accommodation",
  stay: "accommodation",
  service: "service",
  services: "service",
  professional: "professional",
  professionals: "professional",
  rental: "vehicle_rental",
  rentals: "vehicle_rental",
  bike: "vehicle_rental",
  motorbike: "vehicle_rental",
  taxi: "transport_driver",
  driver: "transport_driver",
  drivers: "transport_driver",
};

function resolveEntityType(q: string): string | null {
  const key = q.toLowerCase().trim();
  return ENTITY_TYPE_ALIASES[key] ?? null;
}

export async function searchCanonicalBusinesses(
  query: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<NexBusinessRow[]> {
  const q = query.trim();
  if (!q) return [];
  const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
  const offset = Math.max(0, opts.offset ?? 0);
  const entityType = resolveEntityType(q);
  const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
  const rows = await readOnlyQuery<CanonicalRow>(
    `SELECT ${LIST_SELECT}
       FROM ${LIST_FROM}
      WHERE bc.superseded_by_business_id IS NULL
        AND (
          bc.name_canonical ILIKE $1
          OR bc.name_norm ILIKE $1
          OR $2 = ANY(bc.aliases)
          OR ($3::text IS NOT NULL AND bc.entity_type = $3)
        )
      ORDER BY (bc.entity_type = COALESCE($3::text, '')) DESC, bc.name_canonical
      LIMIT $4 OFFSET $5`,
    [pattern, q.toLowerCase(), entityType, limit, offset],
  );
  return rows.map(adaptCanonical);
}

export interface CountryCount {
  isoAlpha2: string;
  name: string | null;
  count: number;
}

/** Per-country counts of non-superseded canonical businesses, sorted
 *  by count desc. Used by the search-landing CountryPicker. */
export async function listCountryCounts(): Promise<CountryCount[]> {
  const rows = await readOnlyQuery<{ country: string; count: string }>(
    `SELECT country, COUNT(*)::text AS count
       FROM nex.business_canonical
      WHERE superseded_by_business_id IS NULL
        AND country ~ '^[A-Z]{2}$'
      GROUP BY country
      ORDER BY count DESC, country ASC`,
  );
  return rows.map((r) => ({
    isoAlpha2: r.country,
    name: null,
    count: parseInt(r.count, 10),
  }));
}

export async function countCanonicalBusinesses(query: string): Promise<number> {
  const q = query.trim();
  if (!q) {
    const r = await readOnlyQuery<{ count: string }>(
      `SELECT COUNT(*)::text AS count
         FROM nex.business_canonical
        WHERE superseded_by_business_id IS NULL`,
    );
    return parseInt(r[0]?.count ?? "0", 10);
  }
  const entityType = resolveEntityType(q);
  const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
  const r = await readOnlyQuery<{ count: string }>(
    `SELECT COUNT(*)::text AS count
       FROM nex.business_canonical
      WHERE superseded_by_business_id IS NULL
        AND (
          name_canonical ILIKE $1
          OR name_norm ILIKE $1
          OR $2 = ANY(aliases)
          OR ($3::text IS NOT NULL AND entity_type = $3)
        )`,
    [pattern, q.toLowerCase(), entityType],
  );
  return parseInt(r[0]?.count ?? "0", 10);
}
