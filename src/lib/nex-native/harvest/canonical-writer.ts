// src/lib/nex-native/harvest/canonical-writer.ts
//
// Dedupe + insert into nex.business_canonical.
// --------------------------------------------
// Reads Overpass elements and tries to add them as DISCOVERED
// canonical businesses · dedupe is defensive: `(lower(name), country)`
// uniqueness + an `osm_<type>_<id>` short-circuit via `aliases` so a
// re-harvest never doubles the row.
//
// Nothing published to the public directory bypasses the sealed
// media approval gate · this writer only creates identity rows, no
// image references.
//
// Email qualification extension (sealed 2026-10-16 · migration 202 ·
// REVISED 2026-10-16 to decouple FOUND from QUALIFIED per owner
// directive):
//   · When OSM provides an email via `tags.email` / `tags["contact:email"]`
//     the writer attempts to persist it as `email_status='FOUND'`. The
//     row's `qualification_status` is NOT set here · it defaults to
//     'PENDING' per migration 202. "FOUND" means an address was
//     observed; "QUALIFIED" is reserved for addresses that have passed
//     the separate validation step (future deliverability pipeline),
//     and the owner rule is clear: a discovered business MUST NOT
//     become publicly qualified merely because an email-shaped string
//     exists in its source data.
//   · Pre-migration-202: the extra columns do not exist · the extended
//     INSERT would fail with 42703. The writer DETECTS that failure and
//     transparently falls back to the identity-only INSERT · an outage
//     of the migration is never allowed to break discovery.
//   · OSM email coverage is low (<10% of listings) · the vast majority
//     of email evidence will come from the website-walk backfill
//     orchestrator (sealed 2026-10-16 · src/lib/nex-native/harvest/
//     email-backfill-orchestrator.ts · env-flag gated).
//   · The six-method extractor at src/lib/nex/discovery-world/
//     email-extractor.ts remains authoritative for walked emails · the
//     writer here NEVER constructs an address.

import "server-only";
import { withClient } from "@/lib/nex/db";
import type { OverpassElement } from "./overpass-fetcher";
import type { CityBbox } from "./city-rotation";
import { buildCanonicalMetadata } from "./canonical-metadata";
import { extractOsmEmail } from "./osm-email-extract";

export interface WriteSummary {
  readonly inserted: number;
  readonly duplicates: number;
  readonly skipped_no_name: number;
  readonly skipped_no_coords: number;
  readonly errors: number;
}

export async function writeCanonicalRowsFromOverpass(
  bbox: CityBbox,
  elements: readonly OverpassElement[],
  cycleId: string,
): Promise<WriteSummary> {
  const result = await withClient(async (client) => {
    let inserted = 0;
    let duplicates = 0;
    let skipped_no_name = 0;
    let skipped_no_coords = 0;
    let errors = 0;

    for (const el of elements) {
      const name = (el.tags.name ?? "").trim();
      if (!name) {
        skipped_no_name++;
        continue;
      }
      if (el.lat === null || el.lon === null) {
        skipped_no_coords++;
        continue;
      }
      const osmRef = `osm_${el.type}_${el.id}`;
      // Pure metadata object · stamped with the current cycle id so a
      // dashboard can later verify how many canonical rows a single
      // tick actually produced (count where metadata->>'cycle_id' =
      // <id>) rather than approximating via city + time window.
      const metadata = buildCanonicalMetadata({
        bbox: bbox.id,
        osmLat: el.lat,
        osmLon: el.lon,
        cycleId,
      });
      // OSM-tag email extraction · low coverage but free, so always
      // attempt it. The resulting email (if any) is persisted when
      // the migration-202 columns exist · otherwise we fall back to
      // the identity-only insert and let the website-walk orchestrator
      // find the email later.
      const osmEmail = extractOsmEmail(el.tags);

      try {
        // Dedup target is the existing partial unique index
        // `uq_bc_country_osm_id` on (country, osm_id) WHERE osm_id
        // IS NOT NULL. The ON CONFLICT inference clause must match
        // the partial-index predicate exactly for PG to pick it.
        // The row still carries `osmRef` in `aliases` so downstream
        // consumers that search aliases keep working.
        //
        // name_norm is a generated column on production · PG rejects
        // explicit values for generated columns (SQLSTATE 428C9) so
        // we must omit it from the column list and let PG compute it.
        //
        // Email qualification extension (sealed 2026-10-16 · migration
        // 202 · REVISED same day): when the extra columns exist we set
        // email + email_source_url + email_verified_at +
        // email_status='FOUND' for OSM-sourced emails. We DO NOT set
        // qualification_status · it defaults to 'PENDING' per the
        // schema so FOUND cannot be mis-read as QUALIFIED. Promotion
        // to QUALIFIED is reserved for the separate validation path
        // (email_status='VALIDATED') in the orchestrator.
        //
        // Pre-migration the extended query fails with 42703 "column
        // does not exist" · the catch block below falls back to the
        // identity-only insert so discovery never stalls on the
        // migration.
        const { rowCount } = osmEmail
          ? await client.query(
              `
              INSERT INTO nex.business_canonical
                (canonical_business_id, name_canonical,
                 entity_type, country, lifecycle_state, city, district,
                 category_ids, aliases, osm_id, metadata,
                 email, email_source_url, email_verified_at,
                 email_status)
              VALUES
                (gen_random_uuid(), $1,
                 $2, $3, 'DISCOVERED', $4, $5,
                 $6::text[], ARRAY[$7]::text[], $7, $8::jsonb,
                 $9, $10, now(), 'FOUND')
              ON CONFLICT (country, osm_id) WHERE osm_id IS NOT NULL DO NOTHING
              `,
              [
                name,
                inferEntityType(el.tags),
                bbox.isoAlpha2,
                bbox.cityName,
                inferDistrict(el.tags),
                inferCategoryIds(el.tags),
                osmRef,
                JSON.stringify(metadata),
                osmEmail.email,
                osmEmail.sourceUrl,
              ],
            )
          : await client.query(
              `
              INSERT INTO nex.business_canonical
                (canonical_business_id, name_canonical,
                 entity_type, country, lifecycle_state, city, district,
                 category_ids, aliases, osm_id, metadata)
              VALUES
                (gen_random_uuid(), $1,
                 $2, $3, 'DISCOVERED', $4, $5,
                 $6::text[], ARRAY[$7]::text[], $7, $8::jsonb)
              ON CONFLICT (country, osm_id) WHERE osm_id IS NOT NULL DO NOTHING
              `,
              [
                name,
                inferEntityType(el.tags),
                bbox.isoAlpha2,
                bbox.cityName,
                inferDistrict(el.tags),
                inferCategoryIds(el.tags),
                osmRef,
                JSON.stringify(metadata),
              ],
            );
        if (rowCount && rowCount > 0) inserted++;
        else duplicates++;
      } catch (e) {
        // Pre-migration-202 safety net · the extended email query
        // fails with PG error 42703 ("column does not exist"). Retry
        // with the identity-only insert so the running cron keeps
        // discovering businesses even before the migration lands.
        const msg = e instanceof Error ? e.message : String(e);
        const isColumnMissing =
          msg.includes("column") &&
          (msg.includes("does not exist") || msg.includes("42703"));
        if (osmEmail && isColumnMissing) {
          try {
            const { rowCount } = await client.query(
              `
              INSERT INTO nex.business_canonical
                (canonical_business_id, name_canonical,
                 entity_type, country, lifecycle_state, city, district,
                 category_ids, aliases, osm_id, metadata)
              VALUES
                (gen_random_uuid(), $1,
                 $2, $3, 'DISCOVERED', $4, $5,
                 $6::text[], ARRAY[$7]::text[], $7, $8::jsonb)
              ON CONFLICT (country, osm_id) WHERE osm_id IS NOT NULL DO NOTHING
              `,
              [
                name,
                inferEntityType(el.tags),
                bbox.isoAlpha2,
                bbox.cityName,
                inferDistrict(el.tags),
                inferCategoryIds(el.tags),
                osmRef,
                JSON.stringify(metadata),
              ],
            );
            if (rowCount && rowCount > 0) inserted++;
            else duplicates++;
          } catch {
            errors++;
          }
        } else {
          errors++;
        }
      }
    }

    return { inserted, duplicates, skipped_no_name, skipped_no_coords, errors };
  });

  return (
    result ?? {
      inserted: 0,
      duplicates: 0,
      skipped_no_name: 0,
      skipped_no_coords: 0,
      errors: 0,
    }
  );
}

function inferEntityType(tags: Readonly<Record<string, string>>): string {
  if (tags.tourism) return "accommodation";
  if (tags.amenity && FOOD_AMENITIES.has(tags.amenity)) return "food";
  if (tags.shop) return "marketplace_seller";
  if (tags.leisure) return "service";
  return "service";
}

function inferCategoryIds(
  tags: Readonly<Record<string, string>>,
): readonly string[] {
  const list: string[] = [];
  if (tags.amenity) list.push(`osm:amenity:${tags.amenity}`);
  if (tags.shop) list.push(`osm:shop:${tags.shop}`);
  if (tags.tourism) list.push(`osm:tourism:${tags.tourism}`);
  if (tags.leisure) list.push(`osm:leisure:${tags.leisure}`);
  if (tags.cuisine) list.push(`osm:cuisine:${tags.cuisine}`);
  return list.slice(0, 10);
}

function inferDistrict(tags: Readonly<Record<string, string>>): string | null {
  return (
    tags["addr:suburb"] ??
    tags["addr:district"] ??
    tags["addr:neighbourhood"] ??
    null
  );
}

const FOOD_AMENITIES = new Set([
  "restaurant",
  "cafe",
  "fast_food",
  "bar",
  "pub",
  "bakery",
  "ice_cream",
]);
