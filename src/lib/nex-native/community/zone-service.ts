// src/lib/nex-native/community/zone-service.ts
//
// NEX Community Noticeboard · zone discovery + hierarchy queries.
//
// Server-only. Uses the sealed nexSupabaseAdmin service-role client.
// All reads honour archived_at IS NULL unless explicitly asked.

import "server-only";
import { nexSupabaseAdmin } from "../supabase-admin";
import type { NexUuid } from "../types";
import type { NexCommunityZoneLevel, NexCommunityZoneRow } from "./types";

/** List top-level country zones. For the picker's first screen. */
export async function listCountries(): Promise<NexCommunityZoneRow[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_community_zone")
    .select("*")
    .is("archived_at", null)
    .eq("level", "country")
    .is("parent_zone_id", null)
    .order("name", { ascending: true });
  if (error) {
    throw new Error(`community-zone-service.listCountries · ${error.message}`);
  }
  return (data as NexCommunityZoneRow[]) ?? [];
}

/** List immediate children of a given zone, filtered by level if given. */
export async function listChildren(
  parentZoneId: NexUuid,
  level?: NexCommunityZoneLevel,
): Promise<NexCommunityZoneRow[]> {
  let q = nexSupabaseAdmin
    .from("nex_community_zone")
    .select("*")
    .is("archived_at", null)
    .eq("parent_zone_id", parentZoneId);
  if (level) q = q.eq("level", level);
  const { data, error } = await q.order("name", { ascending: true });
  if (error) {
    throw new Error(
      `community-zone-service.listChildren(${parentZoneId}) · ${error.message}`,
    );
  }
  return (data as NexCommunityZoneRow[]) ?? [];
}

/** Fetch a single zone by id, returning null if archived or missing. */
export async function getZoneById(
  zoneId: NexUuid,
): Promise<NexCommunityZoneRow | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_community_zone")
    .select("*")
    .eq("id", zoneId)
    .is("archived_at", null)
    .maybeSingle();
  if (error) {
    throw new Error(
      `community-zone-service.getZoneById(${zoneId}) · ${error.message}`,
    );
  }
  return (data as NexCommunityZoneRow) ?? null;
}

/** Walk the ancestor chain (self + parents) up to the country row.
 *  Returns root-first — country, province, city, kecamatan, ... .
 *  Capped at 8 levels to avoid pathological loops. */
export async function getAncestorChain(
  zoneId: NexUuid,
): Promise<NexCommunityZoneRow[]> {
  const chain: NexCommunityZoneRow[] = [];
  let cursor: NexUuid | null = zoneId;
  for (let i = 0; i < 8 && cursor; i++) {
    const row = await getZoneById(cursor);
    if (!row) break;
    chain.unshift(row);
    cursor = row.parent_zone_id;
  }
  return chain;
}

/** For a hyperlocal zone, pick the natural "district" zone — the
 *  nearest ancestor at kecamatan level (Indonesia) or the hyperlocal
 *  itself if the user picked a kecamatan directly.
 *
 *  Non-Indonesia fallback: return the first non-country ancestor. */
export async function resolveDistrictFor(
  hyperlocalZone: NexCommunityZoneRow,
): Promise<NexCommunityZoneRow> {
  if (hyperlocalZone.level === "kecamatan") return hyperlocalZone;
  if (hyperlocalZone.country !== "ID") {
    // Walk until we find a non-country ancestor (province/city/etc.).
    const chain = await getAncestorChain(hyperlocalZone.id);
    const nonCountry = chain.find((z) => z.level !== "country");
    return nonCountry ?? hyperlocalZone;
  }
  const chain = await getAncestorChain(hyperlocalZone.id);
  const kecamatan = chain.find((z) => z.level === "kecamatan");
  return kecamatan ?? hyperlocalZone;
}

/** Suggest an initial zone set during onboarding. For Phase 1 we return
 *  the kecamatan-level zones under Kota Yogyakarta. Future revisions
 *  can take a geoip hint or an account country prefix. */
export async function suggestZonesForOnboarding(): Promise<
  NexCommunityZoneRow[]
> {
  const { data: city, error: cityErr } = await nexSupabaseAdmin
    .from("nex_community_zone")
    .select("id")
    .eq("country", "ID")
    .eq("level", "city")
    .eq("slug", "kota-yogyakarta")
    .is("archived_at", null)
    .maybeSingle();
  if (cityErr) {
    throw new Error(
      `community-zone-service.suggestZonesForOnboarding · ${cityErr.message}`,
    );
  }
  if (!city) return [];
  return listChildren(city.id as NexUuid, "kecamatan");
}
