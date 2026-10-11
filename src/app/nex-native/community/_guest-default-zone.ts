// src/app/nex-native/community/_guest-default-zone.ts
//
// Default public zone for the guest community-feed preview.
// --------------------------------------------------------
// When a guest opens /nex-native/community/feed we don't have a
// membership to lean on. Rather than silently geo-locate the visitor
// (privacy-respecting default per the first-time-experience
// directive) we show the Danurejan kecamatan feed as a public
// example. Danurejan is the sealed seed zone that already carries
// real public notices in the live DB.
//
// If the directory ever ships a visitor-chosen default (e.g. "show
// me the nearest kecamatan"), this constant becomes the fallback
// when the choice is unavailable.
//
// Zone IDs are stable Supabase UUIDs seeded by migration
// 147_nex_community_zone_seed_id_yogyakarta.sql.

import "server-only";
import { getZoneById, resolveDistrictFor } from "@/lib/nex-native/community/zone-service";

export const GUEST_DEFAULT_HYPERLOCAL_ZONE_ID =
  "b3d5e450-8940-44ed-a50c-213fb7fe2359";

/** Resolve the guest's default (hyperlocal, district) zone pair.
 *  Returns null if the seed is missing · caller renders an empty
 *  state rather than crashing. */
export async function resolveGuestDefaultZones(): Promise<{
  hyperlocalZoneId: string;
  districtZoneId: string;
} | null> {
  const hyperlocal = await getZoneById(GUEST_DEFAULT_HYPERLOCAL_ZONE_ID);
  if (!hyperlocal) return null;
  const district = await resolveDistrictFor(hyperlocal);
  return {
    hyperlocalZoneId: hyperlocal.id,
    districtZoneId: district.id,
  };
}
