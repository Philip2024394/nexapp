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

// ─────────────────────────────────────────────────────────────────────
// User-created community moderation surface · migration 270.
// Owner-authorised 2026-11-03 (D3b flow).
// ─────────────────────────────────────────────────────────────────────

/** Row shape augmented with the two columns added in migration 270.
 *  moderation_status is 'approved' for seeded + HQ-approved rows,
 *  'pending' for user-submitted rows awaiting HQ review. */
export interface NexCommunityZoneWithModeration extends NexCommunityZoneRow {
  moderation_status: "approved" | "pending";
  created_by_account_id: NexUuid | null;
}

/** Areas (level='neighbourhood') under a county · approved + pending.
 *  Pending rows are included so the submitter sees their own listing ·
 *  the UI tags them "pending approval" so other users don't mistake
 *  them for curated communities. */
export async function listAreasForCounty(
  countyZoneId: NexUuid,
): Promise<NexCommunityZoneWithModeration[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_community_zone")
    .select("*")
    .eq("parent_zone_id", countyZoneId)
    .eq("level", "neighbourhood")
    .is("archived_at", null)
    .in("moderation_status", ["approved", "pending"])
    .order("moderation_status", { ascending: true }) // approved before pending
    .order("name", { ascending: true });
  if (error) {
    throw new Error(
      `community-zone-service.listAreasForCounty(${countyZoneId}) · ${error.message}`,
    );
  }
  return (data as NexCommunityZoneWithModeration[]) ?? [];
}

/** HQ moderation queue · all pending submissions for a country.
 *  Ordered oldest-first so the queue drains FIFO. */
export async function listPendingAreas(
  country: string,
): Promise<NexCommunityZoneWithModeration[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_community_zone")
    .select("*")
    .eq("country", country)
    .eq("moderation_status", "pending")
    .is("archived_at", null)
    .order("created_at", { ascending: true });
  if (error) {
    throw new Error(
      `community-zone-service.listPendingAreas(${country}) · ${error.message}`,
    );
  }
  return (data as NexCommunityZoneWithModeration[]) ?? [];
}

/** Normalise a user-typed community name into a valid slug.
 *  Honours the sealed slug CHECK ck_zone_slug_shape (migration 146):
 *    ^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$  OR  ^[a-z0-9]$
 *  Returns null if the result can't be made valid (empty / too short). */
export function slugifyAreaName(raw: string): string | null {
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/['`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  if (s.length === 0) return null;
  if (s.length === 1 && !/[a-z0-9]/.test(s)) return null;
  return s;
}

/** Insert a user-submitted neighbourhood under a county.
 *  Returns the new row OR a typed error ({ kind: ... }).
 *  Caller is responsible for also enrolling the creator via
 *  membership-service.confirmMembership · we deliberately keep the
 *  two writes separate so the server-action layer owns transactional
 *  intent (same pattern as the sealed addMemberByContact flow). */
export async function createPendingArea(input: {
  readonly countyZoneId: NexUuid;
  readonly creatorAccountId: NexUuid;
  readonly rawName: string;
}): Promise<
  | { ok: true; zone: NexCommunityZoneWithModeration }
  | { ok: false; kind: "parent_not_found" | "invalid_name" | "already_pending" | "slug_taken" | "db_error"; message: string }
> {
  const name = input.rawName.trim();
  if (name.length < 2 || name.length > 80) {
    return { ok: false, kind: "invalid_name", message: "Name must be 2–80 characters." };
  }
  const slug = slugifyAreaName(name);
  if (!slug) {
    return { ok: false, kind: "invalid_name", message: "That name doesn't form a valid community label." };
  }

  // Verify the parent exists, is a city (county), and lives under a country row.
  const parent = await getZoneById(input.countyZoneId);
  if (!parent || parent.level !== "city") {
    return { ok: false, kind: "parent_not_found", message: "Parent county not found." };
  }

  const { data, error } = await nexSupabaseAdmin
    .from("nex_community_zone")
    .insert({
      parent_zone_id: input.countyZoneId,
      country: parent.country,
      level: "neighbourhood",
      name,
      slug,
      moderation_status: "pending",
      created_by_account_id: input.creatorAccountId,
    })
    .select("*")
    .maybeSingle();

  if (error) {
    // Translate the two likely conflict shapes into typed errors.
    const msg = error.message.toLowerCase();
    if (msg.includes("uq_zone_pending_per_creator")) {
      return {
        ok: false,
        kind: "already_pending",
        message: "You already have a community submission waiting for review.",
      };
    }
    if (msg.includes("uq_zone_parent_slug")) {
      return {
        ok: false,
        kind: "slug_taken",
        message: "A community with a similar name already exists for this county.",
      };
    }
    return { ok: false, kind: "db_error", message: error.message };
  }
  if (!data) {
    return { ok: false, kind: "db_error", message: "insert returned no row" };
  }
  return { ok: true, zone: data as NexCommunityZoneWithModeration };
}

/** HQ approval · flip moderation_status to 'approved'.
 *  The zone becomes publicly discoverable in search. Does NOT touch
 *  existing memberships (creator is already a member). */
export async function approvePendingArea(
  pendingZoneId: NexUuid,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await nexSupabaseAdmin
    .from("nex_community_zone")
    .update({ moderation_status: "approved" })
    .eq("id", pendingZoneId)
    .eq("moderation_status", "pending");
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

/** HQ rejection · hard-delete the pending zone AND the creator's
 *  membership on it (membership FK is ON DELETE RESTRICT, so we must
 *  delete members first). The creator still has their county
 *  membership from signup · they're not left stranded. */
export async function rejectPendingArea(
  pendingZoneId: NexUuid,
): Promise<{ ok: true } | { ok: false; message: string }> {
  // 1 · delete any memberships that reference this pending zone
  const memDel = await nexSupabaseAdmin
    .from("nex_community_membership")
    .delete()
    .eq("hyperlocal_zone_id", pendingZoneId);
  if (memDel.error) return { ok: false, message: memDel.error.message };

  // 2 · delete the zone itself (must still be pending · guards against
  //     accidentally deleting an approved zone)
  const zoneDel = await nexSupabaseAdmin
    .from("nex_community_zone")
    .delete()
    .eq("id", pendingZoneId)
    .eq("moderation_status", "pending");
  if (zoneDel.error) return { ok: false, message: zoneDel.error.message };
  return { ok: true };
}

/** HQ merge · the submission's intended community already exists under
 *  a different name (e.g. user submitted "Lacken" but Fethard-on-Sea
 *  is the real community). Point the creator's membership at the
 *  target, then hard-delete the pending zone. */
export async function mergePendingArea(input: {
  readonly pendingZoneId: NexUuid;
  readonly targetZoneId: NexUuid;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (input.pendingZoneId === input.targetZoneId) {
    return { ok: false, message: "Cannot merge a zone into itself." };
  }
  const target = await getZoneById(input.targetZoneId);
  if (!target || target.level !== "neighbourhood") {
    return { ok: false, message: "Merge target must be an existing community (neighbourhood level)." };
  }

  // 1 · move the creator's membership to the target zone
  const memMove = await nexSupabaseAdmin
    .from("nex_community_membership")
    .update({ hyperlocal_zone_id: input.targetZoneId })
    .eq("hyperlocal_zone_id", input.pendingZoneId);
  if (memMove.error) return { ok: false, message: memMove.error.message };

  // 2 · hard-delete the pending zone
  const zoneDel = await nexSupabaseAdmin
    .from("nex_community_zone")
    .delete()
    .eq("id", input.pendingZoneId)
    .eq("moderation_status", "pending");
  if (zoneDel.error) return { ok: false, message: zoneDel.error.message };
  return { ok: true };
}
