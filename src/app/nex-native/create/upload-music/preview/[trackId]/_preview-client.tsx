"use client";

// src/app/nex-native/create/upload-music/preview/[trackId]/_preview-client.tsx
//
// Owner-authorised 2026-10-29 (preview-first flow) · the author
// sees exactly what viewers will see of their published music post:
//   · Background image fills the frame.
//   · NexMusicPlayerOverlay sits above the viewer composer area
//     with the cover + title + artist.
// Then the author chooses:
//   · Edit (back to upload journey · existing title/artist save
//     inline here)
//   · Live · owner-updated 2026-10-30 · PUBLISHES the previewed
//     track as the author's active Music post inside the single
//     shared NEX Feed. The Live button calls
//     `publishMusicAsActivePostAction` (see goLive handler
//     line 227) · it DOES NOT open camera, microphone, WebRTC, or
//     the /live-commerce/enter-broadcast-room broadcaster flow.
//     On publish success the celebration overlay runs ~2s then
//     navigates to `/nex-native/nex-feed/music-<trackId>` which
//     mounts the shared NEX Feed on the just-published slide.

import * as React from "react";
import { useRouter } from "next/navigation";
import { NEX_FONT_SANS } from "@/lib/nex-native/design-tokens";
import { NexMusicPlayerOverlay } from "@/components/nex-native/music/NexMusicPlayerOverlay";
import { MusicActionsStack } from "@/components/nex-native/music/MusicActionsStack";
import { MusicLibraryOverlay } from "@/components/nex-native/music/MusicLibraryOverlay";
import { LiveSideDrawer } from "@/components/nex-native/live-commerce/LiveSideDrawer";
import { HendraMessageInbox } from "@/components/nex-native/live-commerce/HendraMessageInbox";
import { VideoShareSheet } from "@/components/nex-native/live-commerce/VideoShareSheet";
import { DevViewerBadge } from "@/components/nex-native/music/DevViewerBadge";
import { MusicDescriptionAffordance } from "@/components/nex-native/music/MusicDescriptionAffordance";
import { MusicPostShell } from "@/components/nex-native/music/MusicPostShell";
import type { NexMusicTrackRow } from "@/lib/nex-native/music/types";
// Note · owner directive 2026-10-29 · the top-header previously used
// SatelliteIconWithPing (sealed Live-video tower). On music pages
// it's been replaced by the rotating vinyl disk · see
// PreviewHeaderLiveCountryBlock below.
// Owner directive 2026-10-29 · the top-header RIGHT side now mirrors
// the sealed Live-video surface pattern · magnifying glass + Hendra
// inbox portal slot + LiveSideDrawer trigger. Same icon set + sizes.
import {
  updateMusicTrackMetadataAction,
  setMusicTrackVisibilityAction,
  toggleMusicTrackLikeAction,
  recordMusicTrackShareAction,
  publishMusicAsActivePostAction,
} from "../../_actions";

const CYAN = "#4FC3FF";
const INK = "#F0F6FF";
const INK_DIM = "rgba(240,246,255,0.7)";
const RED = "#FF3355";

export function PreviewClient(props: {
  readonly track: NexMusicTrackRow;
  readonly audioUrl: string | null;
  readonly coverUrl: string | null;
  readonly backgroundUrl: string | null;
  readonly selfDisplayName: string;
  readonly selfAvatarUrl?: string | null;
  readonly selfNexHandle?: string | null;
  readonly startInEditMode?: boolean;
  readonly initiallyLiked?: boolean;
  // Owner-authorised 2026-10-29 (next-song card at 30s remaining) ·
  // the server component pre-selected the next shared_live sibling
  // (if any) + signed its cover/background URLs. When nextTrack is
  // null, the next-song card is simply never rendered.
  readonly nextTrack?: NexMusicTrackRow | null;
  readonly nextCoverUrl?: string | null;
  readonly nextBackgroundUrl?: string | null;
  /** Owner-authorised 2026-10-31 · world-class gapless · signed audio
   *  URL for the next/prev track so the shell preloader can warm the
   *  browser cache 5 s before the current track ends. */
  readonly nextAudioUrl?: string | null;
  // Owner-authorised 2026-10-29 (swipe navigation on music pages) ·
  // the previous shared_live sibling in chronological order (wraps
  // at the start of the list). Used only for swipe-right navigation;
  // no card is rendered for prev.
  readonly prevTrack?: NexMusicTrackRow | null;
  readonly prevCoverUrl?: string | null;
  readonly prevBackgroundUrl?: string | null;
  readonly prevAudioUrl?: string | null;
  // Owner-authorised 2026-10-30 (Main Feed → Creator Music feature) ·
  // the current viewer's eligible track list for the library
  // overlay. Already pre-signed owner-scoped by the server
  // component. On this surface the viewer == owner (sealed by
  // preview-page auth model). When D1 public-listening lands, the
  // server component swaps the signing path; the shape passed to
  // the client does not change.
  readonly libraryTracks?: ReadonlyArray<{
    readonly id: string;
    readonly title: string;
    readonly artist: string | null;
    readonly coverUrl: string | null;
    readonly viewCount: number;
  }>;
}): React.JSX.Element {
  const router = useRouter();
  const [editing, setEditing] = React.useState(props.startInEditMode === true);
  const [title, setTitle] = React.useState(props.track.title);
  const [artist, setArtist] = React.useState(props.track.artist ?? "");
  const [description, setDescription] = React.useState(
    props.track.description ?? "",
  );
  // Owner-authorised 2026-10-30 · lifted so the shell can suppress
  // the Up-Next banner while the description panel is open.
  const [descriptionOpen, setDescriptionOpen] = React.useState(false);
  const [shareSheetOpen, setShareSheetOpen] = React.useState(false);
  const [visibility, setVisibility] = React.useState(props.track.visibility);
  const [liked, setLiked] = React.useState(props.initiallyLiked ?? false);
  const [likeCount, setLikeCount] = React.useState(props.track.like_count);
  const [shareCount, setShareCount] = React.useState(props.track.share_count);
  const [saveState, setSaveState] = React.useState<
    { readonly kind: "idle" }
    | { readonly kind: "saving" }
    | { readonly kind: "error"; readonly message: string }
  >({ kind: "idle" });

  // Owner-authorised 2026-10-29 (next-song card at 30s remaining) ·
  // the overlay publishes position + duration via `onPositionTick`.
  // When the remaining time drops to ≤ 30_000 ms, the card appears.
  const NEXT_SONG_CARD_THRESHOLD_MS = 30_000;
  const [remainingMs, setRemainingMs] = React.useState<number | null>(null);
  // Owner-authorised 2026-10-29 · lift play-state up so the page
  // header can rotate the broadcaster avatar in sync with the audio.
  // The overlay publishes transitions via `onPlayStateChange`.
  const [isPlaying, setIsPlaying] = React.useState(false);
  const showNextSongCard =
    props.nextTrack != null &&
    remainingMs != null &&
    remainingMs <= NEXT_SONG_CARD_THRESHOLD_MS;

  // Owner-authorised 2026-10-29 (swipe navigation on music pages ·
  // same flow as the Live-video surface) · pointer-based swipe:
  //   LEFT swipe  → next track preview
  //   RIGHT swipe → previous track preview
  // Only triggers if the gesture started on a non-interactive area
  // (background, header, bottom bar) · taps / drags on scrub bar,
  // buttons, and inputs are left to their own handlers.
  const SWIPE_MIN_PX = 80;
  const SWIPE_MAX_VERT_PX = 60;
  const SWIPE_MAX_MS = 600;
  const swipeStartRef = React.useRef<{ x: number; y: number; at: number } | null>(null);
  // Owner-authorised 2026-10-30 (Main Feed → Creator Music feature) ·
  // once an intentional navigation has fired (user swipe, library
  // selection), any still-pending `onAudioEnded` callback must NOT
  // override that user intent with a stale next-track push. This ref
  // is set true the moment a navigation is initiated; the overlay's
  // onAudioEnded reads it before firing router.push. The ref is
  // never reset — the current page unmounts on router.push anyway,
  // and a fresh PreviewClient instance mounts with a fresh ref.
  const navigationCommittedRef = React.useRef(false);
  // Library overlay open state. When open, `onAudioEnded` is also
  // suppressed so the user can browse without the underlying player
  // navigating away. Scrolling the library is not a navigation.
  const [isLibraryOpen, setIsLibraryOpen] = React.useState(false);
  const handleMainPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    const t = e.target as HTMLElement | null;
    if (!t) return;
    // Ignore gestures that originate on interactive controls.
    if (t.closest("button, input, textarea, [role=\"slider\"], a")) {
      swipeStartRef.current = null;
      return;
    }
    swipeStartRef.current = { x: e.clientX, y: e.clientY, at: Date.now() };
  };
  const handleMainPointerUp = (e: React.PointerEvent<HTMLElement>) => {
    const s = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    const elapsed = Date.now() - s.at;
    if (
      Math.abs(dx) > SWIPE_MIN_PX &&
      Math.abs(dy) < SWIPE_MAX_VERT_PX &&
      elapsed < SWIPE_MAX_MS
    ) {
      if (dx < 0 && props.nextTrack) {
        navigationCommittedRef.current = true;
        router.push(
          `/nex-native/create/upload-music/preview/${encodeURIComponent(props.nextTrack.id)}`,
        );
      } else if (dx > 0 && props.prevTrack) {
        navigationCommittedRef.current = true;
        router.push(
          `/nex-native/create/upload-music/preview/${encodeURIComponent(props.prevTrack.id)}`,
        );
      }
    }
  };

  const save = async () => {
    if (!title.trim()) {
      setSaveState({ kind: "error", message: "Title is required" });
      return;
    }
    setSaveState({ kind: "saving" });
    const r = await updateMusicTrackMetadataAction({
      trackId: props.track.id,
      title: title.trim(),
      artist: artist.trim() ? artist.trim() : null,
      description: description.trim() ? description.trim() : null,
    });
    if (!r.ok) {
      setSaveState({ kind: "error", message: r.message });
      return;
    }
    setSaveState({ kind: "idle" });
    setEditing(false);
    router.refresh();
  };

  // Owner-authorised 2026-10-30 (M-5 of NEX Music Publishing → Live
  // Feed) · the Live button now PUBLISHES the previewed track as the
  // creator's active Music post (replacing any prior active music),
  // then navigates to the shared Live Feed with the newly-published
  // owner highlighted. On publish failure, surfaces honest error copy
  // and stays on the preview.
  //
  // Trust boundary (R7-3) · server action resolves the session and is
  // the end-user authentication boundary.
  //
  // The `?highlight=<ownerAccountId>` query brings the newly-published
  // card into focus on the feed (D11-highlight behaviour).
  const [goLiveState, setGoLiveState] = React.useState<
    | { kind: "idle" }
    | { kind: "publishing" }
    | { kind: "celebrating" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  // Owner directive 2026-10-30 · after a successful publish, show the
  // "Music Live" celebration on the preview page (centered confetti icon
  // + text + falling confetti). After ~2s auto-navigate to the user's
  // just-published slide inside the single NEX feed so they can swipe
  // up/down to verify the post is in the feed.
  const CELEBRATE_MS = 2000;
  React.useEffect((): (() => void) | undefined => {
    if (goLiveState.kind !== "celebrating") return undefined;
    const timer = setTimeout(() => {
      router.push(`/nex-native/nex-feed/music-${props.track.id}`);
    }, CELEBRATE_MS);
    return () => clearTimeout(timer);
  }, [goLiveState.kind, props.track.id, router]);

  const goLive = async (): Promise<void> => {
    if (goLiveState.kind === "publishing" || goLiveState.kind === "celebrating") return;
    setGoLiveState({ kind: "publishing" });
    const r = await publishMusicAsActivePostAction({
      trackId: props.track.id,
      publishAsMode: "cover_audio",
    });
    if (!r.ok) {
      setGoLiveState({
        kind: "error",
        message: humanisePublishError(r.code, r.message),
      });
      return;
    }
    setGoLiveState({ kind: "celebrating" });
  };

  const toggleShared = async () => {
    const next: "shared_live" | "private" =
      visibility === "shared_live" ? "private" : "shared_live";
    const r = await setMusicTrackVisibilityAction({
      trackId: props.track.id,
      visibility: next,
    });
    if (r.ok) setVisibility(next);
  };

  const toggleLike = async () => {
    const r = await toggleMusicTrackLikeAction({ trackId: props.track.id });
    if (r.ok) {
      setLiked(r.data.liked);
      setLikeCount(r.data.likeCount);
    }
  };

  const share = async () => {
    const r = await recordMusicTrackShareAction({ trackId: props.track.id });
    if (r.ok) setShareCount(r.data.shareCount);
    // v1 share rail · copy page URL to clipboard. Native share-sheet
    // integration is a separate scope.
    try {
      if (typeof navigator !== "undefined" && "clipboard" in navigator) {
        await navigator.clipboard.writeText(
          `${window.location.origin}/nex-native/create/upload-music/preview/${props.track.id}`,
        );
      }
    } catch {
      /* ignore */
    }
  };

  const trackForOverlay: NexMusicTrackRow = {
    ...props.track,
    title: title.trim() || props.track.title,
    artist: artist.trim() ? artist.trim() : null,
  };

  // Owner-authorised 2026-10-30 · "same preview page" directive · the
  // preview surface now mounts the shared `MusicPostShell` so the feed
  // music slide and this preview render from one source of truth.
  // Chrome specific to the author's self-view (editing toolbar · Edit /
  // Live buttons · MusicActionsStack right-rail · publish celebration)
  // is passed as children + topmostOverlay. The sealed horizontal-
  // swipe handlers run via the shell's onPointer{Down,Up} slots.
  const previewHeaderRight = (
    <>
      <button
        type="button"
        data-nex-music-preview-search
        aria-label="Browse music directory"
        onClick={() => {
          router.push("/nex-native/create/upload-music");
        }}
        style={{
          width: 44,
          height: 44,
          background: "transparent",
          border: "none",
          color: "#FFFFFF",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          padding: 0,
          filter:
            "drop-shadow(0 1px 1px rgba(0,0,0,0.6)) drop-shadow(0 0 2px rgba(0,0,0,0.4))",
        }}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </button>
      <div data-nex-music-preview-menu-trigger>
        <LiveSideDrawer />
      </div>
    </>
  );

  return (
    <MusicPostShell
      track={trackForOverlay}
      audioUrl={props.audioUrl}
      coverUrl={props.coverUrl}
      backgroundUrl={props.backgroundUrl}
      broadcasterDisplayName={props.selfDisplayName}
      broadcasterNexHandle={props.selfNexHandle ?? null}
      broadcasterAvatarUrl={props.selfAvatarUrl ?? null}
      broadcasterPresence="online"
      broadcasterCountryCode="ID"
      autoPlayOnMount={true}
      identityHref={
        props.selfNexHandle
          ? `/nex-native/profile/${encodeURIComponent(props.selfNexHandle)}`
          : null
      }
      isLiked={liked}
      onPlayStateChange={setIsPlaying}
      onPositionTick={(positionMs, durationMs) => {
        if (durationMs > 0) {
          setRemainingMs(Math.max(0, durationMs - positionMs));
        }
      }}
      onAudioEnded={() => {
        if (navigationCommittedRef.current) return;
        if (isLibraryOpen) return;
        if (props.nextTrack) {
          navigationCommittedRef.current = true;
          router.push(
            `/nex-native/create/upload-music/preview/${encodeURIComponent(props.nextTrack.id)}`,
          );
        }
      }}
      onPrevTrack={
        props.prevTrack
          ? () => {
              if (!props.prevTrack) return;
              navigationCommittedRef.current = true;
              router.push(
                `/nex-native/create/upload-music/preview/${encodeURIComponent(props.prevTrack.id)}`,
              );
            }
          : undefined
      }
      onNextTrack={
        props.nextTrack
          ? () => {
              if (!props.nextTrack) return;
              navigationCommittedRef.current = true;
              router.push(
                `/nex-native/create/upload-music/preview/${encodeURIComponent(props.nextTrack.id)}`,
              );
            }
          : undefined
      }
      siblings={{
        prevTrackHref: props.prevTrack?.id ?? null,
        nextTrackHref: props.nextTrack?.id ?? null,
        prevCoverUrl: props.prevCoverUrl ?? null,
        prevBackgroundUrl: props.prevBackgroundUrl ?? null,
        prevAudioUrl: props.prevAudioUrl ?? null,
        nextCoverUrl: props.nextCoverUrl ?? null,
        nextBackgroundUrl: props.nextBackgroundUrl ?? null,
        nextAudioUrl: props.nextAudioUrl ?? null,
      }}
      siblingPrefetchBasePath="/nex-native/create/upload-music/preview/"
      upNext={
        showNextSongCard && props.nextTrack
          ? {
              track: props.nextTrack,
              coverUrl: props.nextCoverUrl ?? null,
              backgroundUrl: props.nextBackgroundUrl ?? null,
              remainingMs: remainingMs ?? 0,
              onOpenPlaylist: () => setIsLibraryOpen(true),
            }
          : undefined
      }
      suppressUpNext={descriptionOpen}
      library={{
        isOpen: isLibraryOpen,
        onOpenChange: setIsLibraryOpen,
        creatorName: props.selfDisplayName,
        creatorNexHandle: props.selfNexHandle ?? null,
        creatorAvatarUrl: props.selfAvatarUrl ?? null,
        creatorPresence: "online",
        tracks: (props.libraryTracks ?? []).map((t) => ({
          id: t.id,
          title: t.title,
          artist: t.artist,
          coverUrl: t.coverUrl,
          viewCount: t.viewCount,
          isCurrent: t.id === props.track.id,
        })),
        onSelect: (trackId) => {
          setIsLibraryOpen(false);
          if (trackId === props.track.id) return;
          navigationCommittedRef.current = true;
          router.push(
            `/nex-native/create/upload-music/preview/${encodeURIComponent(trackId)}`,
          );
        },
        onShare: async () => {
          const url = `${window.location.origin}/nex-native/create/upload-music/preview/${props.track.id}`;
          try {
            if (
              typeof navigator !== "undefined" &&
              "share" in navigator &&
              typeof navigator.share === "function"
            ) {
              await navigator.share({
                title: `${props.selfDisplayName}'s music`,
                url,
              });
              return;
            }
          } catch {
            /* user cancelled or share unsupported — fall through to clipboard */
          }
          try {
            if (typeof navigator !== "undefined" && "clipboard" in navigator) {
              await navigator.clipboard.writeText(url);
            }
          } catch {
            /* clipboard failure is non-fatal */
          }
        },
        onSendMessage: (text) => {
          // eslint-disable-next-line no-console
          console.info("[MusicLibraryOverlay] message queued (dev stub)", {
            toCreator: props.selfDisplayName,
            draftText: text,
          });
        },
      }}
      headerRightSlot={previewHeaderRight}
      onPointerDown={handleMainPointerDown}
      onPointerUp={handleMainPointerUp}
      topmostOverlay={
        goLiveState.kind === "celebrating" ? <MusicLiveCelebration /> : null
      }
    >
      {/* Dev-only session chip · the preview is always a self-view
          (sealed auth boundary `track.owner_account_id ===
          session.account.id`) so the badge is pinned to "owner".
          Tree-shaken in production. */}
      {process.env.NODE_ENV !== "production" && (
        <DevViewerBadge kind="owner" />
      )}

      {/* Owner directive 2026-10-30 (revised) · the Hendra message
          center trigger moved from the top-right header to the right
          rail (above MusicActionsStack) so long display names no
          longer collide with icons. HendraMessageInbox portals its
          💬 + count pill into this slot via its sealed selector list. */}
      <div
        data-nex-music-right-rail-inbox-slot
        style={{
          position: "absolute",
          right: 10,
          // Owner self-view stack = Share only · inbox sits tight
          // above (10 px gap). See `_music-viewer-client.tsx` for the
          // same placement rationale.
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 344px)",
          zIndex: 24,
          pointerEvents: "auto",
        }}
      />
      <HendraMessageInbox ownerDisplayName={props.selfDisplayName} />

      {/* Owner directive 2026-10-30 · sealed 3-option share sheet. */}
      <VideoShareSheet
        open={shareSheetOpen}
        shareUrl={
          typeof window !== "undefined"
            ? `${window.location.origin}/nex-native/create/upload-music/preview/${props.track.id}`
            : `/nex-native/create/upload-music/preview/${props.track.id}`
        }
        shareTitle={title.trim() || props.track.title}
        onClose={() => setShareSheetOpen(false)}
        onShared={async () => {
          const r = await recordMusicTrackShareAction({
            trackId: props.track.id,
          });
          if (r.ok) setShareCount(r.data.shareCount);
        }}
      />

      {/* Owner-authorised 2026-10-30 · description trigger bar + slide-
          up sheet. The bar is a thin pill centered above the music
          player, hidden when there's nothing to show (no description
          written yet AND not editing). Tapping it opens a frosted-
          glass sheet that slides up from the bottom with the full
          description. */}
      {!editing && (
        <MusicDescriptionAffordance
          description={description}
          open={descriptionOpen}
          onOpenChange={setDescriptionOpen}
        />
      )}
      {/* Background + darken + top header + NexMusicPlayerOverlay +
          Up-Next banner + MusicLibraryOverlay + SiblingPreloader +
          `nex-music-page-*` keyframes are now owned by `MusicPostShell`.
          The chrome below (editing bar · MusicActionsStack · Edit/Live
          cluster) is passed as `children` so it layers over the shell's
          background + overlay but under its library overlay. The
          publish celebration is passed via `topmostOverlay` so it wins
          z-order against the library. */}
      {/* Editable title / artist strip · appears when editing */}
      {editing && (
        <div
          style={{
            position: "absolute",
            top: "calc(env(safe-area-inset-top, 0px) + 54px)",
            left: 14,
            right: 150,
            padding: 10,
            background: "rgba(2,9,20,0.78)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            border: `1px solid ${CYAN}`,
            borderRadius: 12,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            zIndex: 21,
          }}
        >
          <label style={{ fontSize: 10, fontWeight: 800, color: CYAN, letterSpacing: "0.1em" }}>
            TITLE
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.2)",
              background: "rgba(255,255,255,0.08)",
              color: INK,
              fontSize: 14,
              fontWeight: 700,
              fontFamily: "inherit",
            }}
          />
          <label style={{ fontSize: 10, fontWeight: 800, color: CYAN, letterSpacing: "0.1em" }}>
            ARTIST
          </label>
          <input
            type="text"
            value={artist}
            onChange={(e) => setArtist(e.currentTarget.value)}
            placeholder="Optional"
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.2)",
              background: "rgba(255,255,255,0.08)",
              color: INK,
              fontSize: 13,
              fontFamily: "inherit",
            }}
          />
          <label
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: CYAN,
              letterSpacing: "0.1em",
            }}
          >
            DESCRIPTION
          </label>
          <textarea
            value={description}
            onChange={(e) =>
              setDescription(e.currentTarget.value.slice(0, 1500))
            }
            placeholder="Tell the story behind this song (optional, 1500 chars)"
            rows={4}
            maxLength={1500}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.2)",
              background: "rgba(255,255,255,0.08)",
              color: INK,
              fontSize: 13,
              fontFamily: "inherit",
              resize: "vertical",
              minHeight: 72,
              lineHeight: 1.4,
            }}
          />
          <small
            style={{
              fontSize: 10,
              color: INK_DIM,
              alignSelf: "flex-end",
              marginTop: -4,
            }}
          >
            {description.length}/1500
          </small>
          {saveState.kind === "error" && (
            <small style={{ color: RED, fontSize: 12 }}>{saveState.message}</small>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
            <button
              type="button"
              onClick={() => {
                setTitle(props.track.title);
                setArtist(props.track.artist ?? "");
                setEditing(false);
                setSaveState({ kind: "idle" });
              }}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.2)",
                background: "transparent",
                color: INK,
                fontSize: 12,
                fontWeight: 700,
                fontFamily: "inherit",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saveState.kind === "saving"}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: 8,
                border: "none",
                background: CYAN,
                color: "#0A1B33",
                fontSize: 12,
                fontWeight: 800,
                fontFamily: "inherit",
                cursor: saveState.kind === "saving" ? "wait" : "pointer",
              }}
            >
              {saveState.kind === "saving" ? "Saving…" : "Save"}
            </button>
          </div>
          <small style={{ color: INK_DIM, fontSize: 11, lineHeight: 1.4 }}>
            To change cover or background, delete this track in the library and re-upload.
          </small>
        </div>
      )}

      {/* NexMusicPlayerOverlay + NextSongCard are now rendered by
          MusicPostShell. onPositionTick / onAudioEnded / onPrevTrack /
          onNextTrack / library tap are plumbed via the shell props
          above and preserve the sealed autoplay + nav-commit guards. */}

      {/* Owner-authorised 2026-10-29 · music actions stack sits above
          the player on the right side · 4 small icons · like + share
          persist to existing actions · save + follow are UI shells
          (no backend yet) · liking triggers the heart-rain burst. */}
      <MusicActionsStack
        track={props.track}
        initiallyLiked={liked}
        likeCount={likeCount}
        shareCount={shareCount}
        isOwnerView={true}
        onLikeToggle={async () => {
          const r = await toggleMusicTrackLikeAction({
            trackId: props.track.id,
          });
          if (!r.ok) return null;
          setLiked(r.data.liked);
          setLikeCount(r.data.likeCount);
          return { liked: r.data.liked, likeCount: r.data.likeCount };
        }}
        onShare={async () => {
          // Owner directive 2026-10-30 · Share icon now opens the
          // sealed VideoShareSheet · 3-option (NEX contact / WhatsApp
          // / Copy link). Count-bump moves to the sheet's onShared
          // so aborted shares don't inflate the counter.
          setShareSheetOpen(true);
          return null;
        }}
      />

      {/* Bottom action bar · owner-authorised 2026-10-29 ·
          compact size · shorter labels (Edit · Go Live) · equal
          footprint for both buttons.
          Keyframes (`nex-music-page-vinyl-spin`,
          `nex-music-live-heartbeat`, `nex-music-header-heartbeat`,
          `nex-music-next-card-in`) are now owned by MusicPostShell
          via `MUSIC_POST_SHELL_KEYFRAMES`. */}

      {/* Owner-authorised 2026-10-29 · action-button pair moved
          FROM the bottom bar TO a floating cluster that sits above
          the music player (just above the track-name row of the
          overlay). Each button is a 48 px round pill carrying an
          icon · the label (Edit · Live) sits as a 10 px caption
          directly under the pill. Hidden while editing. */}
      {!editing && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            // Owner-authorised 2026-10-30 · lifted a further 40 px
            // (236 → 276) to put clear breathing space between the
            // Edit/Live cluster and the track-name row underneath.
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 276px)",
            display: "flex",
            flexDirection: "row",
            justifyContent: "center",
            gap: 24,
            zIndex: 24,
            pointerEvents: "none",
          }}
        >
          <PreviewActionButton
            label="Edit"
            onClick={() => setEditing(true)}
            tone="neutral"
            ariaLabel="Edit track"
          >
            <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
            </svg>
          </PreviewActionButton>
          <PreviewActionButton
            label="Live"
            onClick={goLive}
            tone="live"
            ariaLabel="Go live"
          >
            <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="3" fill="currentColor" />
              <path d="M5.5 5.5a9 9 0 0 0 0 13" />
              <path d="M18.5 18.5a9 9 0 0 0 0-13" />
              <path d="M8.5 8.5a5 5 0 0 0 0 7" />
              <path d="M15.5 15.5a5 5 0 0 0 0-7" />
            </svg>
          </PreviewActionButton>
        </div>
      )}

      {/* MusicLibraryOverlay is rendered by MusicPostShell · its
          `library` prop (configured above) owns the open-state,
          creator identity, tracks, share, and send-message handlers.
          Keeping this comment as a historical marker so the sealed
          2026-10-30 Main Feed → Creator Music semantics remain
          traceable. */}
    </MusicPostShell>
  );
}

// (DescriptionSheet moved to shared component
//  `src/components/nex-native/music/MusicDescriptionAffordance.tsx`
//  on 2026-10-30 so the feed music slide can mount it too.)

// Owner-authorised 2026-10-29 (next-song card at 30s remaining) ·
// sits in the top-right slot (where the camera inset normally
// lives, hidden during the countdown). Shows next track's cover
// against its own background, plus a replay-current button so the
// user can restart the song instead of auto-advancing.
// Owner-authorised 2026-10-29 · round-button pair over track name.
// Each button renders a 48 px circular pill with centered icon and
// a 10 px caption directly underneath the pill. `tone` picks the
// visual treatment: "neutral" (dark navy fill, cyan rim) · "live"
// (cyan gradient fill, white icon, red-glow halo).
function PreviewActionButton(props: {
  readonly label: string;
  readonly onClick: () => void;
  readonly tone: "neutral" | "live";
  readonly ariaLabel: string;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const isLive = props.tone === "live";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        pointerEvents: "auto",
      }}
    >
      <button
        type="button"
        onClick={props.onClick}
        aria-label={props.ariaLabel}
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          border: isLive
            ? `1.5px solid rgba(255, 255, 255, 0.35)`
            : `1.5px solid ${CYAN}`,
          background: isLive
            ? `linear-gradient(135deg, #0A1B33 0%, #1E3A6E 100%)`
            : "rgba(2, 9, 20, 0.78)",
          color: isLive ? "#FFFFFF" : INK,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          padding: 0,
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          boxShadow: isLive
            ? "0 0 18px rgba(255, 51, 85, 0.6)"
            : "0 2px 8px rgba(0, 0, 0, 0.55)",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            // Owner-authorised 2026-10-29 · subtle heartbeat on the
            // Live icon only. Scales from 1 to 1.12 and back on a
            // ~1200ms cycle · same tempo as the sealed presence rim
            // heartbeat so the two motions feel part of one app.
            animation: isLive
              ? "nex-music-live-heartbeat 1200ms cubic-bezier(0.4, 0, 0.6, 1) infinite"
              : "none",
            willChange: isLive ? "transform" : "auto",
          }}
        >
          {props.children}
        </span>
      </button>
      <span
        style={{
          fontSize: 10,
          fontWeight: 800,
          color: "#FFFFFF",
          letterSpacing: "0.04em",
          textShadow: "0 1px 2px rgba(0, 0, 0, 0.75)",
          lineHeight: 1,
          pointerEvents: "none",
        }}
      >
        {props.label}
      </span>
    </div>
  );
}

function NextSongCard(props: {
  readonly nextTrack: NexMusicTrackRow;
  readonly nextCoverUrl: string | null;
  readonly nextBackgroundUrl: string | null;
  readonly remainingMs: number;
  readonly onOpenPlaylist: () => void;
}): React.JSX.Element {
  // Owner-authorised 2026-10-29 (banner reshape) · the Up-Next card
  // is now a full-width horizontal banner sitting above the music
  // player overlay, not a portrait tile in the top-right. Layout:
  //   [cover 64 × 64] | [UP NEXT · title · artist · countdown] | [▸ Playlist]
  // The next track's background image fills the banner behind the
  // text with a dim overlay for legibility; because uploads are
  // 9:16 portraits, we show the centre horizontal slice via
  // objectFit: cover + objectPosition: center.
  const secondsLeft = Math.max(0, Math.ceil(props.remainingMs / 1000));
  return (
    <div
      data-nex-music-next-song-card
      aria-label={`Up next · ${props.nextTrack.title}`}
      style={{
        position: "absolute",
        left: 10,
        right: 10,
        // Owner-authorised 2026-10-29 (banner moved further from
        // header + taller to fit full song titles over 2 lines).
        // Offset bumped 70 → 95 to add breathing room. Height
        // bumped 72 → 92 to accommodate titles that need two lines
        // without clipping the artist row underneath.
        top: "calc(env(safe-area-inset-top, 0px) + 95px)",
        height: 92,
        borderRadius: 14,
        overflow: "hidden",
        // Owner-authorised 2026-10-29 · thicker black rim for the
        // up-next banner · 2 → 3 px with a solid #000000 ring so the
        // banner reads as a framed card against the live background.
        border: `3px solid #000000`,
        boxShadow: "0 4px 18px rgba(0, 0, 0, 0.5)",
        zIndex: 11,
        isolation: "isolate",
        animation: "nex-music-next-card-in 220ms ease-out",
        display: "flex",
        alignItems: "stretch",
      }}
    >
      {/* Background image · owner-amended 2026-10-30 · the Up-Next
          banner background now matches the main song-page background
          and uses `object-fit: cover` — fills the banner fully, no
          black letterbox at the top/bottom edges of the banner.
          Preserves aspect ratio (no stretch); crops the sides if
          the image's aspect doesn't match the banner's. Falls
          under the same §3.1a owner-authored exception recorded in
          `docs/doctrine/nex-universal-image-display-integrity-
          2026-10-30.md`. `objectPosition` kept at "center 40%" to
          favour the composed middle of a portrait upload inside
          this short-wide banner. */}
      {props.nextBackgroundUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={props.nextBackgroundUrl}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center 40%",
            backgroundColor: "var(--nex-world-background-base, #020914)",
          }}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(135deg, #020914 0%, #0A1424 100%)",
          }}
        />
      )}
      {/* Dim overlay for legibility across any image */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(90deg, rgba(2,9,20,0.75) 0%, rgba(2,9,20,0.45) 100%)",
        }}
      />

      {/* Cover thumbnail + plays counter · left column ·
          owner-authorised 2026-10-29 · a compact "{n} plays" pill
          now sits directly under the cover so viewers see the
          track's reach while the Up-Next banner is counting down. */}
      {props.nextCoverUrl ? (
        <div
          style={{
            position: "relative",
            flexShrink: 0,
            width: 56,
            margin: 8,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 3,
          }}
        >
          <div
            style={{
              position: "relative",
              width: 56,
              height: 56,
              borderRadius: 10,
              overflow: "hidden",
              border: "1px solid rgba(255, 255, 255, 0.6)",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.5)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={props.nextCoverUrl}
              alt=""
              loading="eager"
              decoding="async"
              fetchPriority="low"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
          <div
            aria-label={`${props.nextTrack.view_count} plays`}
            style={{
              padding: "1px 6px",
              borderRadius: 999,
              background: "rgba(0, 0, 0, 0.72)",
              border: "1px solid rgba(255, 255, 255, 0.25)",
              color: "#FFFFFF",
              fontSize: 9,
              fontWeight: 800,
              lineHeight: 1.2,
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              textShadow: "0 1px 2px rgba(0, 0, 0, 0.75)",
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width={8}
              height={8}
              fill="currentColor"
              aria-hidden
            >
              <path d="M8 5v14l11-7z" />
            </svg>
            {formatPlaysCount(props.nextTrack.view_count)}
          </div>
        </div>
      ) : (
        <div style={{ width: 8, flexShrink: 0 }} />
      )}

      {/* Centre text block · top-aligned so the Playlist button
          at bottom-right has clear vertical room. */}
      <div
        style={{
          position: "relative",
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-start",
          paddingTop: 8,
          paddingRight: 8,
          gap: 2,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span
            style={{
              padding: "2px 6px",
              borderRadius: 999,
              background: "rgba(255, 215, 0, 0.95)",
              color: "#1A1200",
              fontSize: 9,
              fontWeight: 900,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            Up next
          </span>
          <span
            aria-live="polite"
            style={{
              padding: "2px 5px",
              borderRadius: 6,
              background: "rgba(2, 9, 20, 0.72)",
              color: "#FFFFFF",
              fontSize: 10,
              fontWeight: 800,
              textShadow: "0 1px 2px rgba(0,0,0,0.6)",
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            {secondsLeft}s
          </span>
        </div>
        {/* Owner-authorised 2026-10-29 · title now renders on a
            single row · the Playlist button was moved to the
            banner's bottom-right so the text block has the full
            horizontal width to fit the title. */}
        <div
          style={{
            fontSize: 13,
            fontWeight: 900,
            color: "#FFFFFF",
            textShadow: "0 1px 3px rgba(0, 0, 0, 0.75)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            lineHeight: 1.2,
          }}
        >
          {stripTrailingLiveSuffix(props.nextTrack.title)}
        </div>
        {props.nextTrack.artist && (
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "rgba(255,255,255,0.85)",
              textShadow: "0 1px 2px rgba(0, 0, 0, 0.75)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              lineHeight: 1.2,
            }}
          >
            {props.nextTrack.artist}
          </div>
        )}
      </div>

      {/* Playlist button · owner-authorised 2026-10-29 (moved down) ·
          absolute-positioned at the bottom-right of the banner so
          it no longer competes with the title for horizontal space.
          The text block now extends to the right edge · title fits
          on a single row. The button is slightly smaller (32 px)
          to fit the bottom band cleanly. */}
      <button
        type="button"
        onClick={props.onOpenPlaylist}
        aria-label="Open playlist"
        style={{
          position: "absolute",
          right: 8,
          bottom: 6,
          height: 30,
          padding: "0 12px",
          borderRadius: 999,
          border: "1px solid rgba(255, 255, 255, 0.5)",
          background: "rgba(2, 9, 20, 0.78)",
          color: "#FFFFFF",
          fontSize: 11,
          fontWeight: 800,
          fontFamily: "inherit",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          zIndex: 1,
        }}
      >
        <svg
          viewBox="0 0 24 24"
          width={12}
          height={12}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          style={{
            filter: "drop-shadow(0 0 3px rgba(255, 255, 255, 0.75))",
          }}
        >
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <circle cx="4" cy="6" r="1" fill="currentColor" />
          <circle cx="4" cy="12" r="1" fill="currentColor" />
          <circle cx="4" cy="18" r="1" fill="currentColor" />
        </svg>
        Playlist
      </button>
      <style>{nextCardKeyframes}</style>
    </div>
  );
}

const nextCardKeyframes = `
  @keyframes nex-music-next-card-in {
    0%   { transform: translateY(-8px); opacity: 0; }
    100% { transform: translateY(0); opacity: 1; }
  }
`;

function formatPlaysCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  if (n < 1_000_000) return `${Math.floor(n / 1000)}k`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}

// Owner-authorised 2026-10-29 · "we never show anything after the
// user adds the track name — remove (Live …)". Trailing "(Live …)"
// segments (any case, any content inside the parens) are stripped
// at render time. Underlying data remains untouched.
function stripTrailingLiveSuffix(title: string): string {
  return title.replace(/\s*\(\s*live[^)]*\)\s*$/i, "").trim();
}

// Owner-authorised 2026-10-29 · keyframes needed from first render
// (the header vinyl spins constantly, not only during the final 30 s).
// Mounted inside the always-rendered PreviewClient return.
const alwaysMountedKeyframes = `
  @keyframes nex-music-page-vinyl-spin {
    0%   { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  @keyframes nex-music-live-heartbeat {
    0%   { transform: scale(1); }
    30%  { transform: scale(1.12); }
    60%  { transform: scale(1); }
    100% { transform: scale(1); }
  }
`;

// Owner-authorised 2026-10-29 · live-video header parity on the
// preview-page top chrome. Hydration-safe · country label resolves
// client-side via Intl.DisplayNames; date formats client-side via
// Intl.DateTimeFormat.
function PreviewHeaderLiveCountryBlock(props: {
  readonly countryCode: string | null;
  readonly broadcasterAvatarUrl: string | null;
  readonly broadcasterName: string;
  readonly broadcasterNexHandle: string | null;
  readonly isPlaying: boolean;
  readonly broadcasterPresence: "online" | "busy" | "offline" | null;
}): React.JSX.Element {
  const [countryLabel, setCountryLabel] = React.useState<string>("");
  React.useEffect(() => {
    if (!props.countryCode) {
      setCountryLabel("");
      return;
    }
    try {
      const names = new Intl.DisplayNames(undefined, { type: "region" });
      const resolved = names.of(props.countryCode);
      setCountryLabel(
        resolved && resolved !== props.countryCode ? resolved : "",
      );
    } catch {
      setCountryLabel("");
    }
  }, [props.countryCode]);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        minWidth: 0,
        flex: 1,
        color: INK,
        textShadow: "0 1px 3px rgba(0,0,0,0.55)",
      }}
    >
      {/* Owner-authorised 2026-10-29 · page-header live-signal
          icon on music surfaces is the rotating vinyl disk ·
          enlarged to 44 px for visual presence as the primary
          "this is a music live surface" marker. Spins continuously
          while on the page (not tied to playback state). */}
      {/* Owner-authorised 2026-10-29 · header avatar replaces the
          vinyl icon. The broadcaster photo rotates while the music
          is playing (continuous 4s spin) and stops when playback is
          paused. The RIM carries presence state per the sealed
          `_contact-row.tsx:60-67, 147-160` convention · green=online
          + heartbeat · orange=busy + heartbeat · dark-red=offline
          static · null=neutral white. Falls back to an initial-
          letter puck when the avatar URL is missing. */}
      {(() => {
        const presenceColor =
          props.broadcasterPresence === "online"
            ? "#16D66B"
            : props.broadcasterPresence === "busy"
              ? "#FF7200"
              : props.broadcasterPresence === "offline"
                ? "#A60000"
                : null;
        const rimAnimates =
          props.broadcasterPresence === "online" ||
          props.broadcasterPresence === "busy";
        const borderStyle = presenceColor
          ? `2px solid ${presenceColor}`
          : "1.5px solid rgba(255, 255, 255, 0.6)";
        return (
          <span
            style={{
              position: "relative",
              width: 42,
              height: 42,
              flexShrink: 0,
              alignSelf: "center",
              display: "block",
            }}
          >
            {props.broadcasterAvatarUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={props.broadcasterAvatarUrl}
                alt=""
                aria-hidden
                style={{
                  width: 42,
                  height: 42,
                  objectFit: "cover",
                  borderRadius: "50%",
                  border: borderStyle,
                  filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.65))",
                  animation: props.isPlaying
                    ? "nex-music-page-vinyl-spin 4s linear infinite"
                    : "none",
                  willChange: props.isPlaying ? "transform" : "auto",
                  display: "block",
                }}
              />
            ) : (
              <span
                aria-hidden
                style={{
                  display: "grid",
                  placeItems: "center",
                  width: 42,
                  height: 42,
                  borderRadius: "50%",
                  background: "rgba(10, 27, 51, 0.65)",
                  border: borderStyle,
                  color: INK,
                  fontSize: 15,
                  fontWeight: 800,
                  animation: props.isPlaying
                    ? "nex-music-page-vinyl-spin 4s linear infinite"
                    : "none",
                  willChange: props.isPlaying ? "transform" : "auto",
                }}
              >
                {props.broadcasterName.slice(0, 1).toUpperCase()}
              </span>
            )}
            {presenceColor && rimAnimates && (
              <span
                aria-label={`${props.broadcasterPresence}`}
                style={{
                  position: "absolute",
                  inset: -3,
                  borderRadius: "50%",
                  border: `2px solid ${presenceColor}`,
                  animation:
                    "nex-music-header-heartbeat 1200ms cubic-bezier(0.4,0,0.2,1) infinite",
                  pointerEvents: "none",
                }}
              />
            )}
          </span>
        );
      })()}
      {/* Owner-authorised 2026-10-29 · header text cluster · THREE
          rows:
            line 1 · broadcaster full name (ONE row · no ellipsis)
            line 2 · NEX-ID
            line 3 · Live {country}
          Broadcasted date lives OVER the track cover inside the
          overlay, not here. */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          flex: 1,
          gap: 1,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 800,
            lineHeight: 1.2,
            whiteSpace: "nowrap",
          }}
        >
          {props.broadcasterName}
        </span>
        {/* Owner directive 2026-11-02 · Nex-ID line removed from the
         *  upload-music preview header chrome. The handle remains on
         *  the profile page only. */}
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#D9E6F5",
            lineHeight: 1.2,
            whiteSpace: "nowrap",
          }}
        >
          Live {countryLabel || props.countryCode || "NEX"}
        </span>
      </div>
      <style>{`
        @keyframes nex-music-header-heartbeat {
          0% { transform: scale(1); opacity: 0.9; }
          75% { transform: scale(1.35); opacity: 0; }
          100% { transform: scale(1.35); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// Owner-authorised 2026-10-30 (M-5) · translates server-action error
// codes to short, honest user-visible strings. Keeps the single
// `idempotency-rejected` opaque per R5-1 (no cross-account oracle).
function humanisePublishError(code: string, message: string): string {
  switch (code) {
    case "not-signed-in":
      return "Sign in to publish.";
    case "not-authorized":
      return "You don't own this track.";
    case "track-not-found":
      return "This track was not found.";
    case "track-removed":
      return "This track was removed — can't publish.";
    case "rights-invalid":
      return "This track isn't marked publishable.";
    case "eligibility-race":
      return "The track changed during publishing. Try again.";
    case "eligibility-invalid-state":
      return "This track isn't in a publishable state.";
    case "idempotency-rejected":
      return "Couldn't publish — please generate a new request and retry.";
    case "rights-ack-required":
      return "Please accept the publishing terms before going live.";
    case "dev-impersonation-publish-forbidden":
      return "Publishing is disabled while running as a dev persona.";
    case "rate-limited":
      return message || "Please wait a moment and try again.";
    case "internal-error":
      return "Something went wrong. Please try again.";
    default:
      return message || "Couldn't publish — please try again.";
  }
}

/**
 * World-class sibling preloader (Tier 2 · owner-authorised 2026-10-30).
 *
 * Warms the browser cache for the previous + next tracks' cover and
 * background images, and prefetches the Next.js route payloads for
 * their preview URLs. Each hint is a tiny no-op if the browser
 * doesn't support it, which keeps the component safe to mount on
 * every modern + legacy mobile browser.
 *
 * Respects data-saver mode and the 2G effectiveType — if the user is
 * on a constrained network we skip all preloads to avoid burning
 * their plan. The decision is made once at mount; we don't re-check
 * on every network event because the component unmounts on route
 * change.
 */
function SiblingPreloader(props: {
  readonly router: ReturnType<typeof useRouter>;
  readonly prevTrackId: string | null;
  readonly nextTrackId: string | null;
  readonly prevCoverUrl: string | null;
  readonly prevBackgroundUrl: string | null;
  readonly nextCoverUrl: string | null;
  readonly nextBackgroundUrl: string | null;
}): React.JSX.Element | null {
  React.useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }
    // Honour the Save-Data header + 2G classification. On
    // constrained networks the user explicitly opted out of
    // speculative work.
    type NetworkInformationLike = {
      saveData?: boolean;
      effectiveType?: string;
    };
    const navWithConn = navigator as Navigator & {
      connection?: NetworkInformationLike;
    };
    const conn = navWithConn.connection;
    if (conn) {
      if (conn.saveData === true) return;
      if (conn.effectiveType === "2g" || conn.effectiveType === "slow-2g") {
        return;
      }
    }

    const linkEls: HTMLLinkElement[] = [];
    const injectPreload = (url: string, as: "image"): void => {
      const el = document.createElement("link");
      el.rel = "preload";
      el.as = as;
      el.href = url;
      // `fetchPriority` is a hint; browsers that don't support it
      // ignore the attribute cleanly.
      try {
        (el as HTMLLinkElement & { fetchPriority?: string }).fetchPriority =
          "low";
      } catch {
        /* ignore */
      }
      document.head.appendChild(el);
      linkEls.push(el);
    };

    if (props.prevCoverUrl) injectPreload(props.prevCoverUrl, "image");
    if (props.prevBackgroundUrl) injectPreload(props.prevBackgroundUrl, "image");
    if (props.nextCoverUrl) injectPreload(props.nextCoverUrl, "image");
    if (props.nextBackgroundUrl) injectPreload(props.nextBackgroundUrl, "image");

    // Prefetch the Next.js route payloads so the client bundle and
    // RSC payload for prev/next are already warm by the time the
    // user taps. router.prefetch is safe to call for non-existent
    // trackIds (returns silently) but we gate anyway.
    const basePath = "/nex-native/create/upload-music/preview/";
    if (props.nextTrackId) {
      try {
        props.router.prefetch(`${basePath}${encodeURIComponent(props.nextTrackId)}`);
      } catch {
        /* ignore */
      }
    }
    if (props.prevTrackId) {
      try {
        props.router.prefetch(`${basePath}${encodeURIComponent(props.prevTrackId)}`);
      } catch {
        /* ignore */
      }
    }

    return () => {
      for (const el of linkEls) {
        try {
          el.parentNode?.removeChild(el);
        } catch {
          /* ignore */
        }
      }
    };
  }, [
    props.router,
    props.prevTrackId,
    props.nextTrackId,
    props.prevCoverUrl,
    props.prevBackgroundUrl,
    props.nextCoverUrl,
    props.nextBackgroundUrl,
  ]);
  return null;
}

// -----------------------------------------------------------------------------
// MusicLiveCelebration · owner directive 2026-10-30
// -----------------------------------------------------------------------------
// Shown over the music preview page for ~2 seconds after a successful
// Live-publish, before the parent auto-navigates to the user's just-
// published slide inside the single NEX feed. Center stack is a party-
// popper icon + "Music Live" caption; a confetti layer rains coloured
// pieces down the viewport in parallel. Everything is self-contained
// (inline SVG + inline keyframes) so this component works without any
// global CSS edits.

const CELEBRATION_COLORS: readonly string[] = [
  "#4FC3FF", // NEX cyan
  "#FFD93D", // amber
  "#FF7AA2", // pink
  "#73F2A6", // mint
  "#FF9B4A", // orange
  "#C58AFF", // lavender
];

interface ConfettiPieceSpec {
  readonly leftPct: number;
  readonly color: string;
  readonly delayMs: number;
  readonly durationMs: number;
  readonly rotateDeg: number;
  readonly widthPx: number;
  readonly heightPx: number;
}

function buildConfettiPieces(count: number): readonly ConfettiPieceSpec[] {
  // Deterministic pseudo-random so SSR + hydration don't drift. Uses a
  // small linear-congruential sequence seeded on `count` so a given
  // call always produces the same array shape.
  const pieces: ConfettiPieceSpec[] = [];
  let seed = count * 97 + 13;
  const rand = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };
  for (let i = 0; i < count; i++) {
    pieces.push({
      leftPct: Math.round(rand() * 100),
      color: CELEBRATION_COLORS[i % CELEBRATION_COLORS.length]!,
      delayMs: Math.round(rand() * 1200),
      durationMs: 1800 + Math.round(rand() * 1400),
      rotateDeg: Math.round(rand() * 360),
      widthPx: 6 + Math.round(rand() * 6),
      heightPx: 10 + Math.round(rand() * 8),
    });
  }
  return pieces;
}

function MusicLiveCelebration(): React.JSX.Element {
  const pieces = React.useMemo(() => buildConfettiPieces(48), []);
  return (
    <div
      data-nex-music-live-celebration
      role="status"
      aria-live="polite"
      aria-label="Music Live"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 50,
        pointerEvents: "none",
        background: "rgba(2, 9, 20, 0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <style>{`
        @keyframes nex-confetti-fall {
          0%   { transform: translateY(-12vh) rotate(0deg); opacity: 0; }
          8%   { opacity: 1; }
          100% { transform: translateY(112vh) rotate(540deg); opacity: 1; }
        }
        @keyframes nex-celebration-pop {
          0%   { transform: scale(0.6); opacity: 0; }
          40%  { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      {/* Falling confetti layer */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
        }}
      >
        {pieces.map((p, i) => (
          <span
            key={i}
            style={{
              position: "absolute",
              top: 0,
              left: `${p.leftPct}%`,
              width: p.widthPx,
              height: p.heightPx,
              background: p.color,
              borderRadius: 2,
              transform: `rotate(${p.rotateDeg}deg)`,
              animationName: "nex-confetti-fall",
              animationDuration: `${p.durationMs}ms`,
              animationDelay: `${p.delayMs}ms`,
              animationTimingFunction: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
              animationIterationCount: "infinite",
              boxShadow: `0 0 4px ${p.color}`,
            }}
          />
        ))}
      </div>

      {/* Center stack · icon + label */}
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
          animation: "nex-celebration-pop 420ms cubic-bezier(0.34, 1.56, 0.64, 1) both",
        }}
      >
        <svg
          width={120}
          height={120}
          viewBox="0 0 120 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
          style={{
            filter: "drop-shadow(0 10px 30px rgba(79, 195, 255, 0.55))",
          }}
        >
          {/* Party popper cone */}
          <path
            d="M22 100 L42 50 L92 92 Z"
            fill="#4FC3FF"
            stroke="#F0F6FF"
            strokeWidth={3}
            strokeLinejoin="round"
          />
          <path
            d="M42 50 L52 60 L62 55 L72 68 L82 65 L92 92"
            stroke="#031018"
            strokeWidth={2.5}
            strokeLinecap="round"
            fill="none"
            opacity={0.55}
          />
          {/* Burst dots */}
          <circle cx={78} cy={34} r={5} fill="#FFD93D" />
          <circle cx={94} cy={48} r={4} fill="#FF7AA2" />
          <circle cx={64} cy={22} r={4} fill="#73F2A6" />
          <circle cx={100} cy={28} r={5} fill="#FF9B4A" />
          <circle cx={54} cy={34} r={3} fill="#C58AFF" />
          <circle cx={86} cy={16} r={3} fill="#4FC3FF" />
          {/* Burst rays */}
          <path d="M60 20 L62 10" stroke="#FFD93D" strokeWidth={3} strokeLinecap="round" />
          <path d="M78 14 L82 6"  stroke="#FF7AA2" strokeWidth={3} strokeLinecap="round" />
          <path d="M98 20 L105 14" stroke="#73F2A6" strokeWidth={3} strokeLinecap="round" />
          <path d="M108 40 L116 42" stroke="#FF9B4A" strokeWidth={3} strokeLinecap="round" />
        </svg>
        <div
          style={{
            fontSize: 24,
            fontWeight: 900,
            letterSpacing: "0.02em",
            color: "#F0F6FF",
            textShadow: "0 2px 12px rgba(0,0,0,0.6)",
          }}
        >
          Music Live
        </div>
      </div>
    </div>
  );
}
