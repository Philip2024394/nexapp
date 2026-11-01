// src/app/nex-native/nex-feed/[videoId]/page.tsx
//
// NEX Feed · one and only NEX feed · full-bleed · vertical-swipe reel.
// -----------------------------------------------------------------------------
// Owner directive 2026-10-30 (iteration B) · "when a user selects Live
// on their music preview, the music post must enter the NEX feed".
// This single feed carries BOTH uploaded videos AND published-music
// active-slots. The server shell:
//   1 · composes the combined pool via `listNexFeedEntries`
//   2 · looks up the current slug (video id OR `music-<trackId>`)
//   3 · branches to `VideoViewerClient` or `MusicViewerClient`
// Both clients share the sibling-id pool so swipe navigation moves
// freely across the whole feed regardless of entry kind.

import { notFound } from "next/navigation";
import {
  getCategoryChain,
  buildCategoryQueue,
  resolveCurrentTopic,
  formatTopicLabel,
  type CategoryQueueVideoLike,
} from "@/lib/nex-native/live-broadcast/category-chain";
import {
  listNexFeedEntries,
  resolveVideoFeedEntry,
  isMusicEntryId,
  trackIdFromMusicEntryId,
  type NexFeedEntry,
  type MusicFeedEntryWrapped,
} from "@/lib/nex-native/nex-feed/nex-feed-entries";
// Owner directive 2026-11-01 · Batch E · Stage 3B country switcher +
// Ireland feed reader. Default stays Worldwide; `?country=IE` swaps
// the pool to Ireland's approved placements. Fallback to Worldwide
// on any invalid / disabled country code (sealed §4 safeguard).
import {
  resolveCountryFeedMode,
  listEligibleFeedCountries,
} from "@/lib/nex-native/nex-feed/country-feed-mode";
import { listCountryFeedEntries } from "@/lib/nex-native/nex-feed/ireland-feed-reader";
import { CountryFeedSwitcher } from "@/components/nex-native/nex-feed/CountryFeedSwitcher";
// Owner-authorised 2026-11-01 · Batch E.2.c · entry overlay for the
// feed-mode switch · fires the country-flavoured burst + the large
// "Live Ireland" / "Live World" pill when the viewer lands on the
// destination route carrying `?entering=1` (appended by the switcher).
import { FeedModeEntryOverlay } from "@/components/nex-native/nex-feed/FeedModeEntryOverlay";
// Owner directive 2026-11-01 · Batch E.1 · My Live Music target.
// Resolves the signed-in viewer's own active-slot track OR most
// recent eligible shared_live track · null if neither exists.
// Consumed by (a) the MusicActionsStack icon on owner self-view and
// (b) the LiveSideDrawer My Music row (owner-only).
import { resolveMyMusicTargetForOwner } from "@/lib/nex-native/music/owner-my-music-target";
// Owner-authorised 2026-11-01 · P0-1 · NEX Media Engine performance
// overlay. Dev-only rendering · gated by NODE_ENV inside the
// component · zero cost in production.
import { NexPerfOverlay } from "@/components/nex-native/media-engine/NexPerfOverlay";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import {
  getTrackById,
  listTracksByOwner,
} from "@/lib/nex-native/music/music-repository";
import { getMusicStorageAdapter } from "@/lib/nex-native/music/storage-adapter";
import type { NexMusicTrackRow } from "@/lib/nex-native/music/types";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { getFollowState, readFollowCounts } from "@/lib/nex-native/follow/follow-repository";
import { dialCodeToIsoCountry } from "@/lib/nex-native/country/dial-code-to-iso";
import { isIrishAccount } from "@/lib/nex-native/country/is-irish-account";
import { VideoViewerClient } from "./_video-viewer-client";
import { MusicViewerClient } from "./_music-viewer-client";

export const metadata = {
  title: "NEX · Feed",
  description: "Swipe up and down through NEX.",
};

export const dynamic = "force-dynamic";

export default async function NexFeedViewerPage({
  params,
  searchParams,
}: {
  params: Promise<{ videoId: string }>;
  searchParams: Promise<{ chain?: string; country?: string }>;
}): Promise<React.JSX.Element> {
  const { videoId } = await params;
  const { chain: chainSlugRaw, country: countryParamRaw } = await searchParams;
  const nowMs = Date.now();

  // Owner directive 2026-11-01 · Batch E · resolve country-feed mode
  // from URL state. Default Worldwide; invalid / disabled codes fall
  // back to Worldwide. The switcher icon toggles ?country=IE on/off.
  // Eligible countries read from nex_country_registry · adding a new
  // country is a data change, not a code change.
  const [countryMode, eligibleCountries] = await Promise.all([
    resolveCountryFeedMode(countryParamRaw),
    listEligibleFeedCountries(),
  ]);

  // Owner-authorised 2026-11-01 · Batch E.2 · header pill label that
  // reflects the viewer's current feed mode (NOT the broadcaster's or
  // the video's country of origin). Worldwide → "Live World", country
  // mode → "Live {displayName}" (e.g. "Live Ireland", "Live Indonesia").
  // The displayName comes from nex_country_registry so adding a new
  // country is a registry data change · no label hardcoding.
  const feedModeLabel =
    countryMode.kind === "worldwide"
      ? "Live World"
      : `Live ${countryMode.displayName}`;

  // Owner-authorised 2026-11-01 · Batch E.2.c · world id for the entry
  // overlay burst dispatch. Worldwide → the sealed nex-original world
  // (globe spin). Country mode → lowercase country code mapped to the
  // world registry key. Ireland is currently the only country with a
  // dedicated burst (shamrock); future countries register their own
  // burst in FeedModeEntryOverlay's dispatch map (one-liner).
  const feedModeWorldId: string =
    countryMode.kind === "worldwide"
      ? "nex-original"
      : countryMode.code === "IE"
        ? "ireland"
        : countryMode.code.toLowerCase();
  // The switcher toggles between Worldwide and ONE country (Batch E
  // scope · multi-country toggle deferred to Stage 3B.1). Preference
  // chain:
  //   1. If the viewer is ALREADY in a specific country mode, that
  //      country stays the toggle target (so the globe tap returns
  //      them to Worldwide and the flag tap returns them to the same
  //      country · symmetric).
  //   2. Else prefer Ireland (IE) because it is the only country with
  //      approved placements at Batch E launch · targeting Indonesia
  //      first would show "Switch to Indonesia feed" with an empty
  //      pool, violating the "no dead buttons" rule.
  //   3. Else fall back to the first eligible country.
  //   4. Else null (switcher hides).
  // Future · Stage 3B.1 will replace this preference with a per-
  // country placement-count query so new active countries surface
  // automatically as they come online.
  const switcherTarget =
    countryMode.kind === "country"
      ? eligibleCountries.find((c) => c.code === countryMode.code) ??
        eligibleCountries[0] ??
        null
      : eligibleCountries.find((c) => c.code === "IE") ??
        eligibleCountries[0] ??
        null;

  // Owner directive 2026-10-30 · "it should be hendra post showing his
  // profile image in header yes" + "with nex id". The music slide
  // header must render the broadcaster's avatar + display name + NEX-ID.
  // `nex_account` carries display_name + nex_handle; `nex_account_profile`
  // carries avatar_url. The lookup joins both so the shell renders the
  // same identity the preview page shows via `getProfileByAccountId`.
  const accountLookup = async (ids: readonly string[]) => {
    if (ids.length === 0) return [];
    try {
      const [{ data: accountRows }, { data: profileRows }] = await Promise.all([
        nexSupabaseAdmin
          .from("nex_account")
          .select("id, display_name, nex_handle")
          .in("id", ids),
        nexSupabaseAdmin
          .from("nex_account_profile")
          .select("account_id, avatar_url")
          .in("account_id", ids),
      ]);
      const profileById = new Map<string, string | null>();
      for (const p of (profileRows as Array<{
        account_id: string;
        avatar_url: string | null;
      }> | null) ?? []) {
        profileById.set(p.account_id, p.avatar_url ?? null);
      }
      return (
        (accountRows as Array<{
          id: string;
          display_name: string | null;
          nex_handle: string | null;
        }> | null) ?? []
      ).map((r) => ({
        id: r.id,
        displayName: r.display_name ?? "NEX user",
        nexHandle: r.nex_handle ?? null,
        avatarUrl: profileById.get(r.id) ?? null,
      }));
    } catch {
      return [];
    }
  };

  // Owner directive 2026-11-01 · Batch E · pool switch.
  //   Worldwide (default) → listNexFeedEntries (interleaved music +
  //   video pool).
  //   Country mode → listCountryFeedEntries (approved placements for
  //   that country only; sealed §3 preserves content identity · never
  //   duplicates records · never mutates visibility).
  // Both readers return the identical NexFeedEntry shape so every
  // downstream path (sibling resolution, swipe, in-player arrows)
  // works unchanged.
  const allEntries: readonly NexFeedEntry[] =
    countryMode.kind === "country"
      ? await listCountryFeedEntries({
          country: countryMode.code,
          nowMs,
          accountLookup,
        })
      : await listNexFeedEntries({ nowMs, accountLookup });

  let current: NexFeedEntry | null =
    allEntries.find((e) => e.feedEntryId === videoId) ?? null;

  // Owner directive 2026-10-30 · "the play icons for next track and
  // previous on nex feed music hendra is not showing the tracks" ·
  // the in-player arrows walk the creator's chronological music
  // cycle (not the mixed-feed sibling pool). Non-active-slot tracks
  // DO have a URL, so the arrow can land here · the server shell
  // resolves them directly from the track row + owner profile and
  // builds a feed entry on the fly. The sibling pool stays based on
  // active-slot entries so vertical swipe still walks the shared
  // feed (next entry = next active slot or video).
  if (!current && isMusicEntryId(videoId)) {
    const trackId = trackIdFromMusicEntryId(videoId);
    if (trackId) {
      const row = await getTrackById(trackId);
      const permittedRights = new Set([
        "owner_content",
        "licensed",
        "public_domain",
      ]);
      if (
        row &&
        row.visibility !== "removed" &&
        permittedRights.has(row.rights_declaration)
      ) {
        // Owner-authorised 2026-10-31 (Phase B+): mint via the
        // reference-prefix-aware factory so fs:// and sb:// both play.
        const mintSigned = async (
          ref: string | null,
        ): Promise<string | null> => {
          if (!ref) return null;
          if (!ref.startsWith("fs://") && !ref.startsWith("sb://")) {
            return ref;
          }
          try {
            const s = await getMusicStorageAdapter(ref).getSignedReadUrl({
              reference: ref,
              ownerAccountId: row.owner_account_id,
              // Owner-authorised 2026-10-30 · 60 s → 3600 s to match
              // the preview page's signed-URL TTL.
              expiresInSeconds: 3600,
            });
            return s.signedUrl;
          } catch {
            return null;
          }
        };
        const [coverSignedUrl, backgroundSignedUrl, audioSignedUrl] =
          await Promise.all([
            mintSigned(row.cover_image_url),
            mintSigned(row.background_image_url),
            mintSigned(row.media_url),
          ]);
        // Reuse the same accountLookup path (nex_account + nex_account_profile).
        let ownerDisplayName = "NEX user";
        let ownerNexHandle: string | null = null;
        let ownerAvatarUrl: string | null = null;
        try {
          const [{ data: accountRows }, { data: profileRows }] =
            await Promise.all([
              nexSupabaseAdmin
                .from("nex_account")
                .select("id, display_name, nex_handle")
                .eq("id", row.owner_account_id),
              nexSupabaseAdmin
                .from("nex_account_profile")
                .select("account_id, avatar_url")
                .eq("account_id", row.owner_account_id),
            ]);
          const a = (
            accountRows as Array<{
              id: string;
              display_name: string | null;
              nex_handle: string | null;
            }> | null
          )?.[0];
          if (a) {
            ownerDisplayName = a.display_name ?? "NEX user";
            ownerNexHandle = a.nex_handle ?? null;
          }
          const p = (
            profileRows as Array<{
              account_id: string;
              avatar_url: string | null;
            }> | null
          )?.[0];
          if (p) ownerAvatarUrl = p.avatar_url ?? null;
        } catch {
          /* fail-open · fallback values keep the shell honest */
        }
        const synthesized: MusicFeedEntryWrapped = {
          kind: "music",
          feedEntryId: videoId,
          entry: {
            activeSlotOwnerId: row.owner_account_id,
            ownerAccountId: row.owner_account_id,
            ownerDisplayName,
            ownerNexHandle,
            ownerAvatarUrl,
            trackId: row.id,
            title: row.title,
            artist: row.artist,
            publishAsMode: "cover_audio",
            coverSignedUrl,
            backgroundSignedUrl,
            audioSignedUrl,
            sourceUrl: row.source_url,
            publishedAtMs: Date.parse(row.created_at),
            publishGeneration: 0,
            likeCount: row.like_count,
            shareCount: row.share_count,
          },
        };
        current = synthesized;
      }
    }
  }

  if (!current) notFound();

  // Resolve the viewer session ONCE · used by the private-track
  // filter (music branch), the self-view guard on the message icon,
  // and the dev viewer badge below. Fail-open to null · all three
  // consumers treat null as "guest / unresolved".
  const session = await resolveSessionWithDevOverride().catch(() => null);
  const viewerAccountId: string | null = session?.account.id ?? null;

  // Owner directive 2026-11-01 · Batch E.1 · resolve the viewer's own
  // "My Live Music" destination (active-slot track OR most recent
  // eligible shared_live). Returned as a plain href + trackId · null
  // when the signed-in viewer has no eligible music (guest, or a
  // signed-in user with 0 shared_live tracks).
  //   · MusicActionsStack icon shown only when the viewer is on their
  //     OWN track (self-view) AND myMusicTarget is non-null.
  //   · LiveSideDrawer row shown whenever myMusicTarget is non-null,
  //     regardless of self-view (owner's drawer always surfaces My
  //     Music when they have music to show).
  const myMusicTarget = await resolveMyMusicTargetForOwner(
    viewerAccountId,
  ).catch(() => null);

  // Default sibling pool is every feed entry (music + video).
  let siblingIds: readonly string[] = allEntries.map((e) => e.feedEntryId);

  // Chain playback (owner directive 2026-10-24) still restricts the
  // sibling pool when the viewer arrived via `?chain=<slug>`. The chain
  // queue is a video-only concept today — music entries are excluded
  // from a chain walk. If a chain query is present but the current
  // entry is music, we fall through to the full pool (chain context
  // doesn't apply here).
  let chainLabel: string | null = null;
  let currentTopicLabel: string | null = null;
  if (chainSlugRaw && current.kind === "video") {
    const chain = getCategoryChain(chainSlugRaw);
    if (chain) {
      const videoLikes: readonly CategoryQueueVideoLike[] = allEntries
        .filter((e): e is Extract<NexFeedEntry, { kind: "video" }> => e.kind === "video")
        .map((e) => ({ id: e.video.id, topic_tags: e.video.topic_tags }));
      const queue = buildCategoryQueue(chain, videoLikes);
      if (queue.includes(videoId)) {
        siblingIds = queue;
        chainLabel = chain.label;
        const topic = resolveCurrentTopic(chain, {
          id: current.video.id,
          topic_tags: current.video.topic_tags,
        });
        currentTopicLabel = topic ? formatTopicLabel(topic) : null;
      }
    }
  }

  // Owner directive 2026-10-30 · "if user selects next song or
  // previous or picks from hendra library and its playing loaded ·
  // can the user also swipe up or down and they are still in the
  // nex feed · yes". When the current slug is a non-active music
  // track (synthesised earlier so the URL resolves), anchor its
  // feed position to the owner's active-slot music entry. Swipe-
  // up/down then transitions to the feed sibling after/before the
  // owner's active slot — the viewer stays inside the mixed feed.
  let feedPositionId = videoId;
  if (siblingIds.indexOf(videoId) === -1 && current.kind === "music") {
    const ownerActiveSlotId =
      allEntries.find(
        (e) =>
          e.kind === "music" &&
          e.entry.ownerAccountId === current.entry.ownerAccountId,
      )?.feedEntryId ?? null;
    if (ownerActiveSlotId !== null) {
      feedPositionId = ownerActiveSlotId;
    }
  }
  const currentIndex = siblingIds.indexOf(feedPositionId);
  // Owner directive 2026-11-01 (follow-up) · country-mode swipe
  // wraparound. In country mode the pool is small (6 Ireland tracks
  // today) · hitting the end should NOT dead-end the swipe. Wrap
  // modularly so swipe-forward from the last entry → siblings[0] and
  // swipe-backward from siblings[0] → last entry. Owner called this
  // "randomly show pages from before"; this ships deterministic
  // circular (every pass through yields the same order). If owner
  // wants true shuffled random, that's a follow-up (needs stable
  // per-session seed OR reshuffled pool composition in the reader).
  // Worldwide mode keeps the sealed bounded behaviour: Worldwide has
  // many entries, cycling could feel weird; let the owner opt-in
  // explicitly if they want Worldwide to wrap too.
  const siblingsLen = siblingIds.length;
  const canWrap = countryMode.kind === "country" && siblingsLen > 1;
  const nextId =
    currentIndex >= 0 && currentIndex < siblingsLen - 1
      ? siblingIds[currentIndex + 1]!
      : canWrap && currentIndex === siblingsLen - 1
        ? siblingIds[0]!
        : null;
  const prevId =
    currentIndex > 0
      ? siblingIds[currentIndex - 1]!
      : canWrap && currentIndex === 0
        ? siblingIds[siblingsLen - 1]!
        : null;

  // Owner directive 2026-10-30 · dev-only visibility badge · "yellow
  // badge for its hendra viewing and blue for user is viewing so i
  // know for dev who is watching the screen i see". Null in
  // production so no leakage; "owner" when viewer owns the entry,
  // "viewer" otherwise.
  const isDev = process.env.NODE_ENV !== "production";
  let devViewerBadge: "owner" | "viewer" | null = null;
  if (isDev) {
    const ownerIdForEntry =
      current.kind === "music"
        ? current.entry.ownerAccountId
        : current.video.owner_account_id ?? null;
    if (viewerAccountId && ownerIdForEntry) {
      devViewerBadge =
        viewerAccountId === ownerIdForEntry ? "owner" : "viewer";
    } else {
      // Owner-authorised 2026-10-30 · null viewerAccountId = guest
      // (either dev-impersonation returned no persona or there is
      // genuinely no session). From the owner's perspective that's
      // still a NON-owner view, so the blue "VIEWING · USER" chip
      // should surface to make dev visibility unambiguous.
      devViewerBadge = "viewer";
    }
  }

  if (current.kind === "music") {
    // Owner-authorised 2026-10-30 · the music slide renders the same
    // MusicPostShell the preview page uses. The shell needs the full
    // track row (for NexMusicPlayerOverlay) + the creator's library
    // for the cover-tap overlay. Signing re-mint failures are non-
    // fatal · the shell falls back gracefully (overlay without
    // cover, library hidden, etc.).
    const musicEntry = current.entry;
    const track = await getTrackById(musicEntry.trackId);

    // Build the viewer's library view of the creator's tracks. On
    // this public surface we only expose non-removed tracks whose
    // rights still permit publish. Covers are signed owner-scoped
    // (the D1 public-listening primitive — sealed as DRAFT in
    // `nex-main-feed-public-music-listening-design-2026-10-30.md` —
    // is not yet implemented; owner-scope signing is the honest
    // interim path).
    const permittedRights = new Set([
      "owner_content",
      "licensed",
      "public_domain",
    ]);
    const ownerTracks = await listTracksByOwner(musicEntry.ownerAccountId).catch(
      () => [] as NexMusicTrackRow[],
    );
    // Owner directive 2026-10-30 · the arrow cycle must only expose
    // what a given viewer is allowed to see. The preview page is a
    // self-view and includes PRIVATE tracks (sealed 2026-10-29
    // expanded-cycle rule). On the feed, viewers who are NOT the
    // owner must not be arrow-navigated into private tracks — so
    // the filter is tightened to `shared_live` for them. Reuses the
    // top-level `viewerAccountId` resolved once above.
    const viewerIsOwner = viewerAccountId === musicEntry.ownerAccountId;
    const eligibleTracks = ownerTracks.filter((t) => {
      if (t.visibility === "removed") return false;
      if (!permittedRights.has(t.rights_declaration)) return false;
      if (!viewerIsOwner && t.visibility !== "shared_live") return false;
      return true;
    });
    const libraryTracks = await Promise.all(
      eligibleTracks.map(async (t) => {
        let coverUrl: string | null = null;
        if (
          t.cover_image_url &&
          (t.cover_image_url.startsWith("fs://") ||
            t.cover_image_url.startsWith("sb://"))
        ) {
          try {
            const s = await getMusicStorageAdapter(t.cover_image_url).getSignedReadUrl({
              reference: t.cover_image_url,
              ownerAccountId: musicEntry.ownerAccountId,
              expiresInSeconds: 3600,
            });
            coverUrl = s.signedUrl;
          } catch {
            coverUrl = null;
          }
        } else if (t.cover_image_url) {
          coverUrl = t.cover_image_url;
        }
        return {
          id: t.id,
          title: t.title,
          artist: t.artist,
          coverUrl,
          viewCount: t.view_count,
        };
      }),
    );

    // (`viewerAccountId` already resolved above at top-level.)

    // Owner directive 2026-10-30 · "the play icons for next track
    // and previous on nex feed music hendra is not showing the
    // tracks . it is diverting to swipe". The in-player prev/next
    // arrows must walk the OWNER's music cycle (same chronological
    // sort the preview page uses), not the mixed music+video feed
    // order. Vertical swipe + wheel still move through the full
    // feed via siblingIds · the arrows specifically shortcut to
    // another music track by the same creator. Wrap at ends is
    // preserved (matches `_preview-client.tsx` behaviour).
    const chronoCycle = [...eligibleTracks].sort((a, b) =>
      a.created_at.localeCompare(b.created_at),
    );
    const currentCycleIdx = chronoCycle.findIndex(
      (t) => t.id === musicEntry.trackId,
    );
    let prevOwnerTrackId: string | null = null;
    let nextOwnerTrackId: string | null = null;
    if (currentCycleIdx !== -1 && chronoCycle.length > 1) {
      prevOwnerTrackId =
        chronoCycle[
          (currentCycleIdx - 1 + chronoCycle.length) % chronoCycle.length
        ]?.id ?? null;
      nextOwnerTrackId =
        chronoCycle[(currentCycleIdx + 1) % chronoCycle.length]?.id ?? null;
    }

    // Owner directive 2026-10-30 · "why the container is not showing
    // on all music pages when 30 seconds should show the next song".
    // Resolve the next-track row + signed cover/background so the
    // feed music slide can render the Up-Next banner during the last
    // 30 s · same semantics as the preview page (`_preview-client.
    // tsx` passes nextTrack / nextCoverUrl / nextBackgroundUrl).
    const nextOwnerTrackRow =
      nextOwnerTrackId !== null
        ? chronoCycle.find((t) => t.id === nextOwnerTrackId) ?? null
        : null;
    let nextOwnerCoverUrl: string | null = null;
    let nextOwnerBackgroundUrl: string | null = null;
    // Owner-authorised 2026-10-31 · world-class gapless · also mint the
    // audio URL for the next track so the shell preloader can warm the
    // browser cache 5 s before the current track ends.
    let nextOwnerAudioUrl: string | null = null;
    if (nextOwnerTrackRow) {
      const mintUpNext = async (
        ref: string | null,
      ): Promise<string | null> => {
        if (!ref) return null;
        if (!ref.startsWith("fs://") && !ref.startsWith("sb://")) return ref;
        try {
          const s = await getMusicStorageAdapter(ref).getSignedReadUrl({
            reference: ref,
            ownerAccountId: musicEntry.ownerAccountId,
            expiresInSeconds: 3600,
          });
          return s.signedUrl;
        } catch {
          return null;
        }
      };
      [nextOwnerCoverUrl, nextOwnerBackgroundUrl, nextOwnerAudioUrl] =
        await Promise.all([
          mintUpNext(nextOwnerTrackRow.cover_image_url),
          mintUpNext(nextOwnerTrackRow.background_image_url),
          mintUpNext(nextOwnerTrackRow.media_url),
        ]);
    }

    // Owner-authorised 2026-10-30 · Stage 1+2 Follow SSR seeds.
    // Resolve the viewer's follow state AND the owner's follower
    // count in parallel so the person-plus icon paints both the
    // correct state AND the correct count on first render. Guest
    // + self-view both short-circuit `initialFollowed` to false
    // (self cannot follow self; guest cannot follow anything).
    // The count fetch is universal (we always want to display the
    // owner's follower count, even for owner self-view). Fails
    // open independently to false / null so a repository error on
    // one path never cascades to the other.
    // Owner-authorised 2026-10-30 · broadcaster country derived from
    // nex_account.phone_country_code (sealed Four-Country doctrine
    // reference project_nex_country_scope_from_phone_country_code_
    // 2026_08_22). Resolve the owner's phone dial code once, map to
    // ISO 3166-1 alpha-2, pass to MusicViewerClient so the "Live
    // {country}" header line in MusicPostShell renders truthfully.
    // Null-tolerant: unknown dial codes fall through to the sealed
    // "Live NEX" fallback at MusicPostShell:559.
    const [initialFollowed, initialFollowerCount, broadcasterCountryInfo] = await Promise.all([
      viewerAccountId !== null && !viewerIsOwner
        ? getFollowState({
            followerId: viewerAccountId,
            followeeId: musicEntry.ownerAccountId,
          })
            .then((s) => s === "following")
            .catch(() => false)
        : Promise.resolve(false),
      readFollowCounts(musicEntry.ownerAccountId)
        .then((c) => c.followersCount)
        .catch(() => null as number | null),
      (async (): Promise<{ iso: string | null; isIrish: boolean }> => {
        try {
          const { data } = await nexSupabaseAdmin
            .from("nex_account")
            .select("phone_country_code")
            .eq("id", musicEntry.ownerAccountId)
            .maybeSingle<{ phone_country_code: string | null }>();
          const dial = data?.phone_country_code ?? null;
          return {
            iso: dialCodeToIsoCountry(dial),
            isIrish: isIrishAccount(dial),
          };
        } catch {
          return { iso: null, isIrish: false };
        }
      })(),
    ]);
    const broadcasterCountryCode = broadcasterCountryInfo.iso;
    const isIrishBroadcaster = broadcasterCountryInfo.isIrish;

    return (
      <>
        <MusicViewerClient
          entry={musicEntry}
          trackRow={track}
          libraryTracks={libraryTracks}
          feedEntryId={current.feedEntryId}
          siblingIds={siblingIds}
          nextId={nextId}
          prevId={prevId}
          viewerAccountId={viewerAccountId}
          feedModeLabel={feedModeLabel}
          initialFollowed={initialFollowed}
          initialFollowerCount={initialFollowerCount}
          broadcasterCountryCode={broadcasterCountryCode}
          isIrishBroadcaster={isIrishBroadcaster}
          prevOwnerTrackId={prevOwnerTrackId}
          nextOwnerTrackId={nextOwnerTrackId}
          nextOwnerTrack={nextOwnerTrackRow}
          nextOwnerCoverUrl={nextOwnerCoverUrl}
          nextOwnerBackgroundUrl={nextOwnerBackgroundUrl}
          nextOwnerAudioUrl={nextOwnerAudioUrl}
          devViewerBadge={devViewerBadge}
          myMusicHref={myMusicTarget?.href ?? null}
        />
        {/* Owner directive 2026-11-01 · Batch E · country switcher
         *  mounted as a sibling of the viewer client so it floats on
         *  the right action-rail without touching the 766-line viewer
         *  component. Fixed positioning keeps it in place during
         *  swipe transitions. Server-resolved mode + target so the
         *  icon state (globe vs flag) matches URL state on first
         *  paint. */}
        <div
          data-nex-country-feed-switcher-mount="music"
          style={{
            position: "fixed",
            right: 12,
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 50,
            pointerEvents: "auto",
          }}
        >
          <CountryFeedSwitcher
            currentMode={countryMode}
            toggleTarget={switcherTarget}
          />
        </div>
        {/* Owner-authorised 2026-11-01 · Batch E.2.c · feed-mode entry
         *  overlay · fires once when the viewer lands on this route
         *  with `?entering=1` (appended by CountryFeedSwitcher). */}
        <FeedModeEntryOverlay
          worldId={feedModeWorldId}
          pillLabel={feedModeLabel}
        />
        {/* Owner-authorised 2026-11-01 · P0-1 · perf overlay (dev-only) */}
        <NexPerfOverlay />
      </>
    );
  }

  // Video branch · preload next/prev public URLs for the <video>
  // preload="auto" hint. Only preload neighbours that are also videos;
  // for music neighbours we skip (MusicFeedCard streams on demand).
  const resolveIfVideo = async (id: string | null): Promise<string | null> => {
    if (!id) return null;
    if (isMusicEntryId(id)) return null;
    const r = await resolveVideoFeedEntry(id);
    return r?.publicUrl ?? null;
  };
  const [nextPublicUrl, prevPublicUrl] = await Promise.all([
    resolveIfVideo(nextId),
    resolveIfVideo(prevId),
  ]);

  const chain = chainSlugRaw ? getCategoryChain(chainSlugRaw) : null;
  return (
    <>
      <VideoViewerClient
        video={current.video}
        publicUrl={current.publicUrl}
        siblingIds={siblingIds}
        chainLabel={chainLabel}
        chainSlug={chain ? chain.slug : null}
        currentTopicLabel={currentTopicLabel}
        nextPublicUrl={nextPublicUrl}
        prevPublicUrl={prevPublicUrl}
        devViewerBadge={devViewerBadge}
        feedModeLabel={feedModeLabel}
      />
      {/* Owner directive 2026-11-01 · Batch E · same switcher mount
       *  as the music branch above. Zero intrusion into the 1536-line
       *  video viewer client. */}
      <div
        data-nex-country-feed-switcher-mount="video"
        style={{
          position: "fixed",
          right: 12,
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: 50,
          pointerEvents: "auto",
        }}
      >
        <CountryFeedSwitcher
          currentMode={countryMode}
          toggleTarget={switcherTarget}
        />
      </div>
      {/* Owner-authorised 2026-11-01 · Batch E.2.c · same overlay mount
       *  as the music branch above. One component, same semantics. */}
      <FeedModeEntryOverlay
        worldId={feedModeWorldId}
        pillLabel={feedModeLabel}
      />
    </>
  );
}
