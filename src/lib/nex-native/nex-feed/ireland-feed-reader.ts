// src/lib/nex-native/nex-feed/ireland-feed-reader.ts
//
// NEX Global Feed · Ireland (country) feed reader · owner directive
// 2026-11-01 (Batch E · Stage 3B).
// --------------------------------------------------------------------
// Reads the approved per-country placements for a specific country
// code and composes a feed pool shaped identically to the Worldwide
// `listNexFeedEntries` output. Callers can swap pools at request
// time based on `resolveCountryFeedMode` without changing the viewer
// client contract.
//
// Query shape (sealed Stage 3A schema · no new migrations):
//   SELECT content_id FROM nex_country_placement
//    WHERE country=$1 AND placement_status='approved'
//      AND content_type IN ('music_track','uploaded_video',
//                           'live_post','live_session')
//
// Current scope · music_track only (owner Batch E §3 initial content).
// uploaded_video / live_post / live_session placements return 0 rows
// for the initial Ireland test and are deferred until creators actually
// use the publishing selector (Stage 3D).
//
// Content eligibility re-check (per owner Batch E §3):
//   · visibility != 'removed'
//   · rights_declaration still permits publish ('owner_content' |
//     'licensed' | 'public_domain')
//   · track row still exists (defensive against race with content
//     deletion)
//
// A placement row to a content that fails the re-check is TREATED AS
// IF the placement didn't exist — the row is silently excluded. The
// placement row remains in the DB for audit purposes; HQ moderators
// can transition it to 'removed' via Stage 3C.
//
// Fail-open on every DB error · an outage drops to empty feed, never
// an error page.

import "server-only";
import { nexSupabaseAdmin } from "../supabase-admin";
import type { NexFeedEntry, MusicFeedEntryWrapped } from "./nex-feed-entries";
import { musicEntryIdForTrack } from "./nex-feed-entries";
import { getMusicStorageAdapter } from "../music/storage-adapter";
import type { NexMusicTrackRow } from "../music/types";

interface AccountLookup {
  readonly id: string;
  readonly displayName: string;
  readonly nexHandle: string | null;
  readonly avatarUrl: string | null;
}

async function mintSignedUrlIfReference(
  ref: string | null,
  ownerAccountId: string,
  expiresInSeconds: number,
): Promise<string | null> {
  if (!ref) return null;
  if (!ref.startsWith("fs://") && !ref.startsWith("sb://")) return ref;
  try {
    const storage = getMusicStorageAdapter(ref);
    const { signedUrl } = await storage.getSignedReadUrl({
      reference: ref,
      ownerAccountId,
      expiresInSeconds,
    });
    return signedUrl;
  } catch {
    return null;
  }
}

/** List country-approved feed entries. Shape matches
 *  `listNexFeedEntries` so the viewer page can swap pools transparently.
 *
 *  Current scope: music_track only (Batch E §3 initial content).
 *  Video / live content types are listed in the schema CHECK but
 *  return no rows for the initial Ireland test. */
export async function listCountryFeedEntries(args: {
  readonly country: string;
  readonly nowMs: number;
  readonly accountLookup?: (
    ids: readonly string[],
  ) => Promise<readonly AccountLookup[]>;
}): Promise<readonly NexFeedEntry[]> {
  const permittedRights = new Set([
    "owner_content",
    "licensed",
    "public_domain",
  ]);

  // Step 1 · list approved music_track placements for the country.
  let placementRows: Array<{ content_id: string }> = [];
  try {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_country_placement")
      .select("content_id")
      .eq("country", args.country)
      .eq("placement_status", "approved")
      .eq("content_type", "music_track")
      .order("reviewed_at", { ascending: false });
    if (error) return [];
    placementRows = (data as Array<{ content_id: string }> | null) ?? [];
  } catch {
    return [];
  }

  if (placementRows.length === 0) return [];
  const trackIds = placementRows.map((r) => r.content_id);

  // Step 2 · fetch the track rows + re-check eligibility.
  let tracks: readonly NexMusicTrackRow[] = [];
  try {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_music_track")
      .select("*")
      .in("id", trackIds)
      .neq("visibility", "removed");
    if (error) return [];
    tracks = (data as readonly NexMusicTrackRow[] | null) ?? [];
  } catch {
    return [];
  }

  // Step 3 · defensive rights-permit filter + preserve placement order.
  const trackById = new Map<string, NexMusicTrackRow>();
  for (const t of tracks) {
    if (!permittedRights.has(t.rights_declaration)) continue;
    trackById.set(t.id, t);
  }
  const eligibleOrdered: NexMusicTrackRow[] = [];
  for (const trackId of trackIds) {
    const t = trackById.get(trackId);
    if (t) eligibleOrdered.push(t);
  }
  if (eligibleOrdered.length === 0) return [];

  // Step 4 · resolve account details for the owners in parallel.
  const accountIds = Array.from(
    new Set(eligibleOrdered.map((t) => t.owner_account_id)),
  );
  const accountMap = new Map<string, AccountLookup>();
  if (args.accountLookup && accountIds.length > 0) {
    try {
      const rows = await args.accountLookup(accountIds);
      for (const r of rows) accountMap.set(r.id, r);
    } catch {
      /* fail-open · entries render with fallback display */
    }
  }

  // Step 5 · mint signed URLs + build MusicFeedEntryWrapped shape.
  const wrapped: MusicFeedEntryWrapped[] = [];
  for (const track of eligibleOrdered) {
    const account = accountMap.get(track.owner_account_id);
    const [coverSignedUrl, backgroundSignedUrl, audioSignedUrl] =
      await Promise.all([
        mintSignedUrlIfReference(track.cover_image_url, track.owner_account_id, 3600),
        mintSignedUrlIfReference(track.background_image_url, track.owner_account_id, 3600),
        mintSignedUrlIfReference(track.media_url, track.owner_account_id, 3600),
      ]);
    const publishedAtMs = Date.parse(track.created_at);
    if (!Number.isFinite(publishedAtMs)) continue;
    wrapped.push({
      kind: "music",
      feedEntryId: musicEntryIdForTrack(track.id),
      entry: {
        activeSlotOwnerId: track.owner_account_id,
        ownerAccountId: track.owner_account_id,
        ownerDisplayName: account?.displayName ?? "NEX user",
        ownerNexHandle: account?.nexHandle ?? null,
        ownerAvatarUrl: account?.avatarUrl ?? null,
        trackId: track.id,
        title: track.title,
        artist: track.artist,
        // Country placements promote the track regardless of active-slot
        // state (owner Batch E §3 "If there is no active slot, open the
        // owner's most recent eligible shared_live track"). The feed
        // card renders audio+cover using the signed URLs above.
        publishAsMode: "cover_audio",
        coverSignedUrl,
        backgroundSignedUrl,
        audioSignedUrl,
        sourceUrl: track.source_url,
        publishedAtMs,
        publishGeneration: 0,
        likeCount: track.like_count,
        shareCount: track.share_count,
      },
    });
  }

  return wrapped;
}
