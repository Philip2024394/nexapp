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
}

const VERIFIED_LIFECYCLE_STATES = new Set([
  "VERIFIED",
  "OWNER_CLAIMED",
  "OWNER_VERIFIED",
]);

function adaptCanonical(row: CanonicalRow): NexBusinessRow {
  const verifiedAt = VERIFIED_LIFECYCLE_STATES.has(row.lifecycle_state)
    ? row.last_verified_at?.toISOString() ?? new Date(0).toISOString()
    : null;
  const slug = row.canonical_business_id;
  const addressPieces = [row.district, row.city].filter(Boolean) as string[];
  const chips = (row.category_ids ?? []).slice(0, 3);
  return {
    id: row.canonical_business_id,
    owner_account_id: "",
    display_name: row.name_canonical,
    slug,
    description: null,
    logo_url: null,
    hours: null,
    address: addressPieces.join(", ") || null,
    public_phone: row.phone_e164,
    public_email: null,
    website_url: row.website_apex ? `https://${row.website_apex}` : null,
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
  } as unknown as NexBusinessRow;
}

const LIST_COLUMNS = `
  canonical_business_id, name_canonical, entity_type, country,
  lifecycle_state, city, district, category_ids, website_apex,
  phone_e164, last_verified_at
`;

export async function listRandomCanonicalBusinesses(
  limit = 12,
): Promise<NexBusinessRow[]> {
  const clamped = Math.min(50, Math.max(1, Math.floor(limit)));
  const rows = await readOnlyQuery<CanonicalRow>(
    `SELECT ${LIST_COLUMNS}
       FROM nex.business_canonical
      WHERE superseded_by_business_id IS NULL
        AND length(trim(name_canonical)) > 0
      ORDER BY random()
      LIMIT $1`,
    [clamped],
  );
  return rows.map(adaptCanonical);
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
    `SELECT ${LIST_COLUMNS}
       FROM nex.business_canonical
      WHERE superseded_by_business_id IS NULL
        AND (
          name_canonical ILIKE $1
          OR name_norm ILIKE $1
          OR $2 = ANY(aliases)
          OR ($3::text IS NOT NULL AND entity_type = $3)
        )
      ORDER BY (entity_type = COALESCE($3::text, '')) DESC, name_canonical
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
