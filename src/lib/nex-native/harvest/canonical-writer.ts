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

import "server-only";
import { withClient } from "@/lib/nex/db";
import type { OverpassElement } from "./overpass-fetcher";
import type { CityBbox } from "./city-rotation";
import { buildCanonicalMetadata } from "./canonical-metadata";

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
