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
  // Owner directive 2026-11-03 (NEX Ireland) · for Ireland, the user
  // picks a county (level='city') and the county IS the natural
  // district · don't walk up to province (would show "Leinster" when
  // the user actually joined "Dublin"). Return hyperlocal unchanged.
  if (hyperlocalZone.country === "IE" && hyperlocalZone.level === "city") {
    return hyperlocalZone;
  }
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

/** Suggest an initial zone set during onboarding.
 *
 *  Owner directive 2026-11-03 · "we don't need Indonesia · we are
 *  working on Ireland". NEX Ireland is the active product · return
 *  the 26 Republic of Ireland counties seeded by migration 266 as
 *  the pickable zone set. The counties live at level='city' under
 *  the four provinces, so we list all level='city' zones for
 *  country='IE'. */
export async function suggestZonesForOnboarding(): Promise<
  NexCommunityZoneRow[]
> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_community_zone")
    .select("*")
    .eq("country", "IE")
    .eq("level", "city")
    .is("archived_at", null)
    .order("name", { ascending: true });
  if (error) {
    throw new Error(
      `community-zone-service.suggestZonesForOnboarding · ${error.message}`,
    );
  }
  return (data as NexCommunityZoneRow[]) ?? [];
}
