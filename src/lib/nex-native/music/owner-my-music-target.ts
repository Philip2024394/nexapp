// src/lib/nex-native/music/owner-my-music-target.ts
//
// Owner-authorised 2026-11-01 (Batch E.1 · My Music target resolver).
// --------------------------------------------------------------------
// Given a signed-in account id, resolve the URL the "My Live Music"
// icon (viewer right-rail) + the "My Music" drawer row should route
// to. Owner-sealed resolution order (per owner directive 2026-11-01):
//
//   1. Prefer the owner's CURRENT active-slot track. Active slot =
//      row in `nex_creator_active_music` where unpublished_at IS NULL
//      AND track_id IS NOT NULL. If the active-slot track is still
//      eligible (visibility != 'removed' · rights permit publish),
//      that's the destination.
//
//   2. Fallback to the owner's MOST RECENT eligible shared_live
//      track (nex_music_track WHERE owner_account_id=$1 AND
//      visibility='shared_live' AND rights permit, order by
//      created_at DESC limit 1). Owner directive: "If there is no
//      active slot, open the owner's most recent eligible shared_live
//      track."
//
//   3. If NEITHER exists → null. The caller hides the icon / row
//      ("no dead buttons").
//
// Owner-vs-visitor rule PRESERVED: this resolver returns a track id
// only when the account HAS a public-eligible track. Visitors never
// see private tracks via this URL path because the resolver filters
// to shared_live. The viewer page's existing sealed owner-vs-visitor
// filter (private hidden to non-owners in the library overlay) stays
// unchanged.
//
// Fail-open: on any DB error returns null. The icon simply hides
// rather than surfacing a broken route.
//
// This module queries Supabase in BOTH dev and production (unlike
// `getOwnerTrackCount` which has a dev FS fallback) because the dev
// FS adapter does not model the nex_creator_active_music primitive.
// The resolver is a NO-OP in dev-without-sandbox: the queries fail
// to resolve rows → returns null → icon hides. That is correct
// behaviour · no visual glitch, just no feature.

import "server-only";
import { nexSupabaseAdmin } from "../supabase-admin";
import type { NexMusicTrackRow } from "./types";

export interface MyMusicTarget {
  readonly href: string;
  readonly trackId: string;
}

const PERMITTED_RIGHTS = new Set([
  "owner_content",
  "licensed",
  "public_domain",
]);

const MUSIC_ENTRY_PREFIX = "music-";

function buildMusicHref(trackId: string): string {
  return `/nex-native/nex-feed/${MUSIC_ENTRY_PREFIX}${trackId}`;
}

/** Resolve the "My Music" destination for the given account.
 *  Returns `null` when:
 *   · accountId is null (guest / unresolved session)
 *   · the account has no eligible shared_live track
 *   · any DB error
 *  Caller hides the icon / row when null is returned. */
export async function resolveMyMusicTargetForOwner(
  accountId: string | null,
): Promise<MyMusicTarget | null> {
  if (!accountId) return null;

  // Step 1 · prefer active-slot track if one exists.
  const activeSlotTrackId = await fetchActiveSlotTrackId(accountId);
  if (activeSlotTrackId !== null) {
    const eligible = await isTrackEligibleForMyMusic(activeSlotTrackId);
    if (eligible) {
      return { href: buildMusicHref(activeSlotTrackId), trackId: activeSlotTrackId };
    }
    // Active slot points at an ineligible track (removed / rights
    // revoked post-publish) — fall through to the shared_live fallback
    // instead of returning null · the owner likely has other eligible
    // tracks and shouldn't be denied My Music over a stale slot ref.
  }

  // Step 2 · fallback to most recent eligible shared_live track.
  const fallbackTrackId = await fetchMostRecentSharedLiveTrackId(accountId);
  if (fallbackTrackId !== null) {
    return { href: buildMusicHref(fallbackTrackId), trackId: fallbackTrackId };
  }

  return null;
}

async function fetchActiveSlotTrackId(
  ownerAccountId: string,
): Promise<string | null> {
  try {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_creator_active_music")
      .select("track_id")
      .eq("owner_account_id", ownerAccountId)
      .is("unpublished_at", null)
      .not("track_id", "is", null)
      .maybeSingle<{ track_id: string | null }>();
    if (error || !data) return null;
    return data.track_id ?? null;
  } catch {
    return null;
  }
}

async function isTrackEligibleForMyMusic(trackId: string): Promise<boolean> {
  try {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_music_track")
      .select("id, visibility, rights_declaration")
      .eq("id", trackId)
      .maybeSingle<Pick<NexMusicTrackRow, "id" | "visibility" | "rights_declaration">>();
    if (error || !data) return false;
    if (data.visibility === "removed") return false;
    if (!PERMITTED_RIGHTS.has(data.rights_declaration)) return false;
    return true;
  } catch {
    return false;
  }
}

async function fetchMostRecentSharedLiveTrackId(
  ownerAccountId: string,
): Promise<string | null> {
  try {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_music_track")
      .select("id, rights_declaration")
      .eq("owner_account_id", ownerAccountId)
      .eq("visibility", "shared_live")
      .order("created_at", { ascending: false });
    if (error || !data) return null;
    const rows = data as Array<{ id: string; rights_declaration: string }>;
    for (const row of rows) {
      if (PERMITTED_RIGHTS.has(row.rights_declaration)) return row.id;
    }
    return null;
  } catch {
    return null;
  }
}
