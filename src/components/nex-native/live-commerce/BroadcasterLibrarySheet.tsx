"use client";

// src/components/nex-native/live-commerce/BroadcasterLibrarySheet.tsx
//
// Owner directive 2026-10-26 · "when hendra will press on his own
// profile image his library of posts … will show on the screen above
// example - 5 landscape cards with left side image or the video image
// with red play button on the center and on the right of the cards -
// is video header name and time and date of posting - how many views
// … and the bin icon on right". Scope decisions sealed:
//   · Access      · broadcaster-only (gated by caller · this component
//                    assumes mounting means authorised)
//   · Delete      · soft (visibility → 'removed') · 5-sec undo toast
//                    before any irreversible state is reached
//   · Scope       · ALL of broadcaster's uploaded videos newest-first
//                    (visibility != 'removed')
//   · Interactions · tap=play · hold 500ms=share-to-contact
//   · UI          · bottom sheet · live video keeps playing dimmed
//                    behind · drag down to dismiss (future · currently
//                    a backdrop + close button)
//
// Pure chrome · the Live video keeps playing behind. Owner's dev
// route passes dev-manifest videos as `videos`; real surface will
// pass the result of `listMyUploadedVideos(ownerAccountId)`.
//
// Not covered this slice (deferred):
//   · Pin to top     · world-class suggestion kept out of first cut
//   · Visibility     · hide-vs-delete toggle · deferred
//   · Metric poll    · pulling fresh counts every 30 s · deferred
//   · Drag-to-dismiss gesture · using a close button + backdrop tap
//
// The caller owns the undo-timeout + the real DB soft-delete call ·
// this component surfaces user intent via `onDelete(video)` and
// `onRestore(videoId)` callbacks. The pending-deletion toast is also
// caller-managed so one owner across the whole page coordinates
// state (keeps the sheet pure UI).

import * as React from "react";

export interface BroadcasterLibraryVideo {
  readonly id: string;
  readonly title: string;
  /** ISO · the broadcaster's post timestamp (created_at or
   *  published_at, caller decides which is more honest). */
  readonly postedAtIso: string;
  readonly posterUrl: string | null;
  /** Owner directive 2026-10-27 · "real video instead of image on
   *  the cards" · the thumbnail renders a muted autoplay <video>
   *  when this is present, falling back to the poster image when
   *  it's null (e.g. offline personas or still-processing uploads). */
  readonly videoUrl?: string | null;
  readonly durationSeconds: number | null;
  readonly viewCount: number;
  readonly likeCount: number;
  readonly shareCount: number;
}

export interface BroadcasterLibrarySheetProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly videos: readonly BroadcasterLibraryVideo[];
  /** User tapped a card · caller plays it (navigate to the viewer). */
  readonly onPlay: (video: BroadcasterLibraryVideo) => void;
  /** User long-pressed a card · caller opens the share-to-contact
   *  action sheet (reuse the sealed ContactPickerSheet). */
  readonly onShareToContact: (video: BroadcasterLibraryVideo) => void;
  /** User confirmed delete · caller writes the soft-delete AND
   *  surfaces the undo toast. The sheet does NOT manage the undo
   *  timeout itself to keep this component pure UI. */
  readonly onDelete: (video: BroadcasterLibraryVideo) => void;
  /** Owner directive 2026-10-27 · Creator Loop reshaped from 4
   *  small tiles into 3 bigger ones:
   *    · Go Live   → start a broadcast
   *    · Create    → Add-a-listing page (opens
   *                   /nex-native/manage/watches/new · Stage A
   *                   redesign 2026-10-28)
   *    · Studio    → Insights + Followers + Shop (opens
   *                   /nex-native/live-commerce/studio)
   *  All callbacks are caller-managed · the sheet surfaces user
   *  intent and leaves routing to the parent. */
  readonly onLive?: () => void;
  readonly onCreate?: () => void;
  readonly onStudio?: () => void;
  /** Owner directive 2026-10-27 (R9 · Live-eligibility contract) ·
   *  when the signed-in account is NOT a Shop member, the Go Live
   *  tile renders a 🔒 overlay + muted styling + routes to the
   *  packages page instead of starting a broadcast. The server
   *  shell gate (`/go-live/page.tsx`) is the authoritative check ·
   *  this prop is a VISUAL hint so the user sees the gate before
   *  they tap. Caller resolves eligibility via a server action and
   *  passes `true` for ineligible accounts. Default `false` keeps
   *  the pre-R9 behaviour for all existing call sites. */
  readonly liveLocked?: boolean;
  /** Caller-provided tap handler when the Go Live tile is locked.
   *  Typically routes to `/nex-native/packages?upsell=live` ·
   *  caller controls the destination so the sheet stays pure UI.
   *  Ignored when `liveLocked !== true`. */
  readonly onLiveLockedTap?: () => void;
  /** Owner directive 2026-10-26 · full-hide chrome mode · the top
   *  chrome bar inside the overlay renders the broadcaster's avatar
   *  + display name + close ✕. Parent passes the identity so the
   *  sheet is self-sufficient while the Live chrome is hidden. */
  readonly broadcasterAvatarUrl?: string | null;
  readonly broadcasterDisplayName?: string | null;
}

const RED = "#FF3355";
// Owner directive 2026-10-27 · "same theme color as this NEX palette
// object (lines 39–48)" · aligned to the LIGHT MessagePanel palette
// (near-white panel · dark navy text · muted navy secondary). Prior
// dark values (#F2F5F8 / #8BA9D1 / #526B89) are retired.
const TEXT = "#102033";
const DIM = "#4A6080";
const MUTE = "#4A6080";
// Owner directive 2026-10-26 (NEX neon blue · not dark) · cards
// + Record/Draft/Insights quartet tiles use the sealed NEX cyan
// (#00AFFF) · translucent frosted overlay + brighter cyan rim +
// soft cyan outer glow so the whole family reads as neon · NOT
// the muted navy-blue previous take.
const CARD_BG = "linear-gradient(135deg, rgba(0, 175, 255, 0.28) 0%, rgba(0, 140, 220, 0.14) 100%)";
const CARD_BORDER = "1px solid rgba(0, 200, 255, 0.65)";
const CARD_SHADOW = "0 0 12px -2px rgba(0, 175, 255, 0.45), 0 4px 14px -4px rgba(0, 20, 50, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.12)";
const CARD_BACKDROP_FILTER = "blur(18px) saturate(160%)";
// Owner directive 2026-10-27 · "remove the yellow on the side" ·
// the amber top-performer accent (BEST_BORDER / BEST_SHADOW /
// BEST_ACCENT) is retired. Constants deleted to keep this module
// honest about what's actually painted on screen.
// Owner directive 2026-10-26 (revised) · metrics color-split ·
// views stay neutral · likes a dark red · shares a dark green ·
// visibly distinct against the navy container background.
const METRIC_LIKES = "#C8324C";
const METRIC_SHARES = "#1F7A3D";

function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, "")}k`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
}

function formatDuration(seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatPostedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  // Short relative label.
  let relative = "";
  if (minutes < 60) relative = `${Math.max(1, minutes)}m ago`;
  else if (hours < 24) relative = `${hours}h ago`;
  else if (days < 7) relative = `${days}d ago`;
  else relative = `${Math.floor(days / 7)}w ago`;
  // Absolute date in the viewer's locale, short form.
  const absolute = new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: d.getUTCFullYear() === now.getUTCFullYear() ? undefined : "numeric",
  }).format(d);
  return `${relative} · ${absolute}`;
}

export function BroadcasterLibrarySheet({
  open,
  onClose,
  videos,
  onPlay,
  onShareToContact,
  onDelete,
  onLive,
  onCreate,
  onStudio,
  liveLocked,
  onLiveLockedTap,
  broadcasterAvatarUrl,
  broadcasterDisplayName,
}: BroadcasterLibrarySheetProps): React.JSX.Element | null {
  // Confirm-delete sheet state · we hold the pending candidate here
  // rather than firing straight to the caller so the owner directive
  // "confirm before destructive" is respected inside the component.
  const [confirmTarget, setConfirmTarget] = React.useState<BroadcasterLibraryVideo | null>(null);
  // Owner directive 2026-10-27 · the in-sheet Insights toggle is
  // retired · Insights moved to the Studio hub at /nex-native/live-
  // commerce/studio. Prior `insightsOpen` state deleted.

  // Hold-to-share detection · 500 ms press-and-hold threshold with
  // haptic feedback. Owner directive sealed: tap=play, hold=share.
  const holdTimerRef = React.useRef<number | null>(null);
  const didFireHoldRef = React.useRef<boolean>(false);
  // Owner directive 2026-10-26 (polish #6) · swipe-left on a card
  // reveals a bin button behind it (iOS Mail pattern) · reduces
  // accidental delete taps. Only one card can be revealed at a
  // time. Horizontal pointer movement > 10 px cancels the hold
  // timer and starts tracking a swipe.
  const [revealedBinId, setRevealedBinId] = React.useState<string | null>(null);
  const swipeStartRef = React.useRef<{ x: number; y: number } | null>(null);
  const didSwipeRef = React.useRef<boolean>(false);

  const beginHold = React.useCallback((video: BroadcasterLibraryVideo) => {
    didFireHoldRef.current = false;
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
    }
    holdTimerRef.current = window.setTimeout(() => {
      didFireHoldRef.current = true;
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try { navigator.vibrate(18); } catch { /* ignore */ }
      }
      onShareToContact(video);
    }, 500);
  }, [onShareToContact]);

  const endHold = React.useCallback(() => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  const handleCardClick = React.useCallback((video: BroadcasterLibraryVideo) => {
    if (didFireHoldRef.current) {
      // Hold already fired · suppress the tap-to-play action.
      didFireHoldRef.current = false;
      return;
    }
    onPlay(video);
  }, [onPlay]);

  // Close any hold timer on unmount.
  React.useEffect(() => () => endHold(), [endHold]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop · dims the Live video behind. Tap to dismiss.
          Pointer events stopped so the viewer's swipe tracker
          doesn't consume gestures on the backdrop. */}
      <div
        data-nex-broadcaster-library-backdrop
        onClick={onClose}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          // Owner directive 2026-10-27 · align the backdrop to the
          // MessagePanel scrim (rgba(2, 9, 20, 0.55)) so every NEX
          // overlay fades through the same deep-navy wash.
          background: "rgba(2, 9, 20, 0.55)",
          zIndex: 100,
          cursor: "pointer",
        }}
      />
      {/* Overlay · full-screen floating card deck · owner directive
          2026-10-26 "cards to displaying on screen as overlay". Not a
          bottom sheet · cards float as a vertically-centred stack with
          the Live video dimmed behind through the backdrop. */}
      <div
        data-nex-broadcaster-library-sheet
        role="dialog"
        aria-label="Your posts library"
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          zIndex: 101,
          color: TEXT,
          // Owner directive 2026-10-27 · "Live Library should be
          // exact same height and color theme as message center" ·
          // overlay now mirrors the Message Center wrapper:
          // `padding: 16` on all sides with the container child
          // filling via `flex: 1 1 auto`. Prior centred small-box
          // layout (`alignItems: center; justifyContent: center;
          // padding: 100px 12px 30px`) is retired.
          padding: 16,
          boxSizing: "border-box",
          pointerEvents: "none",
        }}
      >
        {/* Owner directive 2026-10-26 · scoped CSS for the list's
            blue scrollbar + the Live tile's pulsing dot ping. */}
        <style>{`
          [data-nex-broadcaster-library-list]::-webkit-scrollbar {
            width: 6px;
          }
          [data-nex-broadcaster-library-list]::-webkit-scrollbar-track {
            background: rgba(0, 175, 255, 0.08);
            border-radius: 3px;
          }
          [data-nex-broadcaster-library-list]::-webkit-scrollbar-thumb {
            background: linear-gradient(180deg, rgba(0, 175, 255, 0.9) 0%, rgba(0, 140, 220, 0.9) 100%);
            border-radius: 3px;
          }
          [data-nex-broadcaster-library-list]::-webkit-scrollbar-thumb:hover {
            background: linear-gradient(180deg, rgba(0, 200, 255, 1) 0%, rgba(0, 175, 255, 1) 100%);
          }
          [data-nex-broadcaster-library-list] {
            scrollbar-width: thin;
            scrollbar-color: rgba(0, 175, 255, 0.9) rgba(0, 175, 255, 0.08);
          }
          @keyframes nex-library-live-dot {
            0%, 100% { opacity: 1;    transform: scale(1); }
            50%      { opacity: 0.55; transform: scale(0.9); }
          }
          @keyframes nex-library-live-ping {
            0%   { transform: scale(1);   opacity: 0.9; }
            70%  { transform: scale(2.4); opacity: 0;   }
            100% { transform: scale(2.4); opacity: 0;   }
          }
          /* Polish #1 · press feedback · subtle cyan tint flash +
             brightness nudge on tap · doesn't fight the inline
             transform (used by swipe-reveal). */
          [data-nex-broadcaster-library-card]:active {
            background: rgba(0, 175, 255, 0.08) !important;
            filter: brightness(1.08);
          }
          /* Polish #2 · opening animation · 180 ms fade+rise with
             a 30 ms row stagger · cascades into view instead of
             snapping. */
          @keyframes nex-library-fade-in {
            from { opacity: 0; transform: translateY(8px); }
            to   { opacity: 1; transform: translateY(0);   }
          }
          [data-nex-broadcaster-library-sheet] {
            animation: nex-library-fade-in 180ms ease-out;
          }
          [data-nex-broadcaster-library-card-outer] {
            animation: nex-library-fade-in 220ms ease-out backwards;
          }
          [data-nex-broadcaster-library-card-outer]:nth-child(1) { animation-delay: 0ms;   }
          [data-nex-broadcaster-library-card-outer]:nth-child(2) { animation-delay: 30ms;  }
          [data-nex-broadcaster-library-card-outer]:nth-child(3) { animation-delay: 60ms;  }
          [data-nex-broadcaster-library-card-outer]:nth-child(4) { animation-delay: 90ms;  }
          [data-nex-broadcaster-library-card-outer]:nth-child(5) { animation-delay: 120ms; }
          [data-nex-broadcaster-library-card-outer]:nth-child(6) { animation-delay: 150ms; }
          [data-nex-broadcaster-library-card-outer]:nth-child(7) { animation-delay: 180ms; }
          [data-nex-broadcaster-library-card-outer]:nth-child(8) { animation-delay: 210ms; }
          @media (prefers-reduced-motion: reduce) {
            [data-nex-broadcaster-library-sheet],
            [data-nex-broadcaster-library-card-outer] {
              animation: none !important;
            }
          }
        `}</style>
        {/* Owner directive 2026-10-26 (revised) · "we need container
            for the cards inside same color as category buttons".
            Wrap the list in a navy-frosted panel using the exact
            same tokens as the category buttons (CategoryGridSheet
            :255-261) · cyan rim + inset cyan + outer cyan glow. */}
        <div
          data-nex-broadcaster-library-container
          style={{
            // Owner directive 2026-10-27 · "exact same height and
            // color theme as message center" · container fills the
            // padded overlay via `flex: 1 1 auto` with MC's padding
            // (`14px 14px 16px`) and radius (16). Prior fixed 240px
            // width + 12px padding + 14px radius are retired.
            // Owner troubleshoot 2026-10-27 · "live libary container
            // width on right is outside screen" · explicit `boxSizing:
            // border-box` so the 1.5 px rim + 14 px padding stay
            // inside the overlay's 100% width (default content-box
            // was adding them, pushing the right edge past the phone
            // frame).
            flex: "1 1 auto",
            width: "100%",
            minHeight: 0,
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            padding: "14px 14px 16px",
            borderRadius: 16,
            // Owner directive 2026-10-27 · "same theme color as this
            // NEX palette object" · align Live Library container to
            // the LIGHT MessagePanel panel: near-white frosted body ·
            // muted blue-grey hairline rim · blurred saturate backdrop
            // for the same glassy feel. Prior solid #020914 + cyan
            // rim are retired.
            background: "rgba(240, 244, 250, 0.96)",
            backdropFilter: "blur(14px) saturate(1.4)",
            WebkitBackdropFilter: "blur(14px) saturate(1.4)",
            border: "1.5px solid rgba(90, 110, 140, 0.5)",
            boxShadow: "0 20px 50px -16px rgba(0, 20, 60, 0.5)",
            pointerEvents: "auto",
          }}
        >
        {/* Owner directive 2026-10-27 · "header and size text" ·
            Live Library header mirrors the Message Center header:
            18px/900 title + 12.5px/600 "Posts (N)" subtitle + navy
            close ✕ (same navy chip used on MC). Prior 14px/800 title
            + bare cyan ✕ are retired. */}
        <div
          data-nex-broadcaster-library-header
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 10,
            marginBottom: 10,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <div
              style={{
                fontSize: 18,
                fontWeight: 900,
                color: TEXT,
                lineHeight: 1.1,
                letterSpacing: "-0.01em",
              }}
            >
              Live Library
            </div>
            <div
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                color: DIM,
                lineHeight: 1.2,
              }}
            >
              Posts ({videos.length})
            </div>
            {/* Owner directive 2026-10-27 · "add this under header
                smaller text - swipe Card left to delete" · teaches
                the sealed swipe-left-reveal-bin gesture (iOS Mail
                pattern · already wired via revealedBinId + swipe
                tracking in this file). Smaller mute-text so it reads
                as instructional rather than status. */}
            <div
              data-nex-broadcaster-library-swipe-hint
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                color: MUTE,
                lineHeight: 1.3,
                marginTop: 2,
                letterSpacing: "0.02em",
              }}
            >
              Swipe card left to delete
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close library"
            style={{
              flexShrink: 0,
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #152646 0%, #1E3A6E 100%)",
              border: "none",
              color: "#FFFFFF",
              fontSize: 16,
              lineHeight: 1,
              cursor: "pointer",
              fontFamily: "inherit",
              boxShadow: "0 2px 6px -2px rgba(16, 32, 51, 0.4)",
            }}
          >
            ×
          </button>
        </div>
        {/* Owner directive 2026-10-27 · "exact same height" as
            Message Center · list fills the remaining container space
            via flex instead of the earlier 360 px cap. 8 px gap
            between cards gives each row visual separation now that
            the dashed divider is retired. */}
        <div
          data-nex-broadcaster-library-list
          style={{
            flex: "1 1 auto",
            minHeight: 0,
            width: "100%",
            boxSizing: "border-box",
            overflowY: "auto",
            overflowX: "hidden",
            // Owner troubleshoot 2026-10-27 · "the gray card on the
            // right should have space from scrolling bar" · the 6 px
            // scrollbar now has 8 px of breathing room before the
            // card edges.
            paddingRight: 8,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            WebkitOverflowScrolling: "touch",
            scrollSnapType: "y mandatory",
            scrollPaddingTop: 0,
            scrollPaddingBottom: 0,
            pointerEvents: "auto",
          }}
        >
          {videos.length === 0 ? (
            <div
              style={{
                padding: "40px 20px",
                textAlign: "center",
                color: DIM,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Nothing posted yet.<br />
              <span style={{ color: MUTE, fontSize: 11 }}>Your first live post will show here.</span>
            </div>
          ) : (
            videos.map((v) => {
              // Owner directive 2026-10-27 · "remove the yellow on
              // the side" · the top-performer amber accent (⭐ + 3 px
              // amber left stripe) is retired · all cards render
              // identically. `bestId` + `isBest` + `BEST_ACCENT`
              // usage removed.
              const duration = formatDuration(v.durationSeconds);
              const isRevealed = revealedBinId === v.id;
              return (
                <div
                  key={v.id}
                  data-nex-broadcaster-library-card-outer
                  data-nex-broadcaster-library-card-id={v.id}
                  data-nex-broadcaster-library-card-revealed={isRevealed ? "true" : "false"}
                  style={{
                    // Owner directive 2026-10-27 · cards get the
                    // Message Center treatment: subtle navy-tinted
                    // bg + 10 px radius · no rim · dashed row
                    // divider retired. Height sized to the trimmed
                    // thumbnail: 72 px row fits the 76 × 43 chip
                    // with symmetric vertical breathing per owner's
                    // "reduce the height of the cards".
                    position: "relative",
                    overflow: "hidden",
                    height: 72,
                    minHeight: 72,
                    maxHeight: 72,
                    boxSizing: "border-box",
                    background: "rgba(16, 32, 51, 0.04)",
                    borderRadius: 10,
                    scrollSnapAlign: "start",
                    scrollSnapStop: "always",
                    flexShrink: 0,
                    WebkitTapHighlightColor: "transparent",
                    userSelect: "none",
                  }}
                >
                  {/* Owner directive 2026-10-26 (polish #6) · bin
                      layer behind the card content · revealed only
                      when card is swiped left. iOS Mail pattern. */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmTarget(v);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    aria-label={`Delete ${v.title}`}
                    data-nex-broadcaster-library-card-swipe-bin
                    style={{
                      position: "absolute",
                      right: 0,
                      top: 0,
                      bottom: 0,
                      width: 72,
                      background:
                        "linear-gradient(135deg, rgba(180,30,30,0.95) 0%, rgba(130,10,10,0.95) 100%)",
                      border: "none",
                      color: "#FFFFFF",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 2,
                      cursor: "pointer",
                      zIndex: 1,
                      fontSize: 10,
                      fontWeight: 800,
                      // Owner directive 2026-10-26 · the frosted-cyan
                      // card is translucent · the dark-red bin behind
                      // bleeds through if always visible. Hide the
                      // bin until the card is actually swipe-revealed.
                      opacity: isRevealed ? 1 : 0,
                      pointerEvents: isRevealed ? "auto" : "none",
                      transition: "opacity 160ms ease-out",
                    }}
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 6 h18" />
                      <path d="M8 6 V4 h8 V6" />
                      <path d="M5 6 l1 14 h12 l1 -14" />
                    </svg>
                    Delete
                  </button>
                  {/* Content layer · translates left when revealed */}
                  <div
                  data-nex-broadcaster-library-card
                  onClick={() => {
                    if (isRevealed) {
                      // Collapse the bin, don't play
                      setRevealedBinId(null);
                      return;
                    }
                    handleCardClick(v);
                  }}
                  onPointerDown={(e) => {
                    swipeStartRef.current = { x: e.clientX, y: e.clientY };
                    didSwipeRef.current = false;
                    beginHold(v);
                  }}
                  onPointerMove={(e) => {
                    if (!swipeStartRef.current) return;
                    const dx = e.clientX - swipeStartRef.current.x;
                    const dy = e.clientY - swipeStartRef.current.y;
                    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
                      endHold();
                      if (Math.abs(dx) > Math.abs(dy)) didSwipeRef.current = true;
                    }
                  }}
                  onPointerUp={(e) => {
                    endHold();
                    if (!swipeStartRef.current) return;
                    const dx = e.clientX - swipeStartRef.current.x;
                    const absX = Math.abs(dx);
                    swipeStartRef.current = null;
                    if (didSwipeRef.current && absX > 40) {
                      if (dx < 0) setRevealedBinId(v.id);
                      else setRevealedBinId(null);
                      didSwipeRef.current = false;
                    }
                  }}
                  onPointerLeave={endHold}
                  onPointerCancel={endHold}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onPlay(v);
                    }
                  }}
                  style={{
                    position: "relative",
                    zIndex: 2,
                    // Owner troubleshoot 2026-10-27 · "text on right
                    // is not on the gray card" · explicit `width:
                    // 100%` + `boxSizing: border-box` so the flex
                    // row stays inside the row-outer (prior default
                    // auto width was letting content push the layer
                    // past the card edge on narrow phone frames).
                    width: "100%",
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    padding: "6px 10px",
                    height: "100%",
                    background: "transparent",
                    cursor: "pointer",
                    transform: isRevealed ? "translateX(-72px)" : "translateX(0)",
                    transition: "transform 180ms ease-out",
                    boxSizing: "border-box",
                  }}
                >
                  {/* Owner directive 2026-10-27 · thumbnail now
                      renders a muted autoplay <video> when the row
                      carries `videoUrl` · falls back to the poster
                      <img> when it's absent. Width tuned to the
                      88 px row: 76 × 42.75 at 16:9 leaves the meta
                      column enough room for name + date + metrics
                      to stay inside the card edge. */}
                  <div
                    style={{
                      position: "relative",
                      flexShrink: 0,
                      width: 76,
                      aspectRatio: "16 / 9",
                      borderRadius: 8,
                      overflow: "hidden",
                      background: "#0A0F1E",
                    }}
                  >
                    {v.videoUrl ? (
                      <video
                        src={v.videoUrl}
                        poster={v.posterUrl ?? undefined}
                        muted
                        loop
                        playsInline
                        autoPlay
                        preload="metadata"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: "block",
                          pointerEvents: "none",
                        }}
                      />
                    ) : v.posterUrl ? (
                      <img
                        src={v.posterUrl}
                        alt=""
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                    ) : null}
                    <div
                      style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        // Owner directive 2026-10-27 · "reduce the
                        // play button" · 34 → 24 rounded-square chip
                        // (6 px radius) · dark red · scales down for
                        // the trimmed 72 px row + 76 px thumbnail.
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        background: "#A62424",
                        border: "1px solid rgba(255, 70, 70, 0.7)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.5), 0 0 6px rgba(166,36,36,0.5)",
                      }}
                    >
                      {/* Owner directive 2026-10-27 · "change the
                          play icon to white color and enlarge the
                          icon little only" · fill reverted to white
                          (reads cleaner on the dark-red chip) and
                          glyph nudged 14 → 16. */}
                      <svg
                        aria-hidden
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="#FFFFFF"
                      >
                        <path d="M8 5 L19 12 L8 19 Z" />
                      </svg>
                    </div>
                    {duration && (
                      <div
                        style={{
                          position: "absolute",
                          bottom: 2,
                          right: 2,
                          padding: "0 4px",
                          background: "rgba(0,0,0,0.72)",
                          color: TEXT,
                          fontSize: 9,
                          fontWeight: 700,
                          borderRadius: 3,
                          letterSpacing: "0.02em",
                        }}
                      >
                        {duration}
                      </div>
                    )}
                  </div>
                  {/* Meta column · title (top) + date (mid) + metrics (bottom) */}
                  <div
                    style={{
                      flex: "1 1 auto",
                      minWidth: 0,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      gap: 2,
                    }}
                  >
                    <div
                      style={{
                        // Owner directive 2026-10-27 · taller rows ·
                        // room for a slightly bigger title. The ⭐
                        // amber "best-performing" prefix is retired
                        // per "remove the yellow on the side".
                        fontSize: 12.5,
                        fontWeight: 800,
                        color: TEXT,
                        lineHeight: 1.2,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {v.title.split(" · ")[0]}
                    </div>
                    {(() => {
                      const ageMs = Date.now() - new Date(v.postedAtIso).getTime();
                      const isFresh = ageMs >= 0 && ageMs < 24 * 60 * 60 * 1000;
                      return (
                        <div
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            color: MUTE,
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                          }}
                        >
                          {isFresh && (
                            <span
                              aria-label="Posted within 24 hours"
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: 999,
                                background: "#16D66B",
                                boxShadow: "0 0 4px rgba(22,214,107,0.7)",
                                flexShrink: 0,
                              }}
                            />
                          )}
                          <span>{formatPostedAt(v.postedAtIso)}</span>
                        </div>
                      );
                    })()}
                    <div
                      data-nex-broadcaster-library-card-metrics
                      style={{
                        display: "flex",
                        flexDirection: "row",
                        // Owner troubleshoot 2026-10-27 · narrower
                        // meta column after thumbnail trim · tighter
                        // metric gap (10 → 8) + `flexWrap: nowrap`
                        // + `overflow: hidden` keeps the three
                        // metric chips inside the card edge.
                        gap: 8,
                        flexWrap: "nowrap",
                        overflow: "hidden",
                        fontSize: 10,
                        fontWeight: 700,
                        color: DIM,
                      }}
                    >
                      {/* Polish #3 · SVG metric icons replace emoji ·
                          crisp pixel-perfect rendering across OSes,
                          color inherits from span so the dim/rose/
                          teal split renders cleanly. */}
                      {/* Owner directive 2026-10-26 · "views on the
                          card and icon blue color" · cyan accent on
                          the views metric (icon + count both inherit). */}
                      <span style={{ color: "#00AFFF", display: "inline-flex", alignItems: "center", gap: 3 }}>
                        <svg aria-hidden width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12 s4 -7 11 -7 s11 7 11 7 s-4 7 -11 7 s-11 -7 -11 -7 z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        {formatCount(v.viewCount)}
                      </span>
                      <span style={{ color: METRIC_LIKES, display: "inline-flex", alignItems: "center", gap: 3 }}>
                        <svg aria-hidden width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 21 s-7 -4.5 -9.5 -9.5 c-1.5 -3 0 -6.5 3.5 -7 c2 -0.3 4 0.8 5 2.5 c1 -1.7 3 -2.8 5 -2.5 c3.5 0.5 5 4 3.5 7 c-2.5 5 -9.5 9.5 -9.5 9.5 z" />
                        </svg>
                        {formatCount(v.likeCount)}
                      </span>
                      <span style={{ color: METRIC_SHARES, display: "inline-flex", alignItems: "center", gap: 3 }}>
                        <svg aria-hidden width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M7 17 L17 7" />
                          <path d="M8 7 h9 v9" />
                        </svg>
                        {formatCount(v.shareCount)}
                      </span>
                    </div>
                  </div>
                  </div>
                  {/* /content-layer */}
                </div>
              );
            })
          )}
        </div>
        {/* Owner directive 2026-10-26 (connect) · Hendra chrome
            folded INSIDE the main container as its bottom section ·
            one connected visual unit · dashed divider from the list
            above, no own background (inherits container #020914). */}
        <div
          data-nex-broadcaster-library-top-chrome
          style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: "1px dashed rgba(16, 32, 51, 0.14)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            boxSizing: "border-box",
          }}
        >
          {/* Row 1 · identity + close */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            {broadcasterAvatarUrl && (
              <div
                style={{
                  position: "relative",
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  overflow: "hidden",
                  flexShrink: 0,
                  // Owner directive 2026-10-27 · avatar fallback uses
                  // the sealed MessagePanel navy gradient (visible
                  // when the image fails or is pending).
                  background: "linear-gradient(135deg, #152646 0%, #1E3A6E 100%)",
                }}
              >
                <img
                  src={broadcasterAvatarUrl}
                  alt=""
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
                {/* Owner directive 2026-10-26 · "reduce back to the
                    dot on header name" · restore the small green
                    presence dot on the broadcaster avatar. */}
                <span
                  aria-label="Online"
                  style={{
                    position: "absolute",
                    right: -1,
                    top: -1,
                    width: 7,
                    height: 7,
                    borderRadius: 999,
                    background: "#16D66B",
                    boxShadow:
                      "0 0 0 1.5px rgba(2,9,20,0.9), 0 0 6px rgba(22,214,107,0.7)",
                  }}
                />
              </div>
            )}
            <div
              style={{
                flex: "1 1 auto",
                minWidth: 0,
                fontSize: 14,
                fontWeight: 800,
                color: TEXT,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {broadcasterDisplayName ?? "Your Posts"}
            </div>
            {/* Owner directive 2026-10-26 · "remove the x and add
                the live count 8 in same position" · the top header
                still shows "Live Library · Live N" so this echo
                stays consistent while reclaiming the ✕ slot. */}
            <div
              style={{
                flexShrink: 0,
                fontSize: 11,
                fontWeight: 800,
                color: "#00AFFF",
                letterSpacing: "0.03em",
                padding: 4,
              }}
            >
              Live {videos.length}
            </div>
          </div>
          {/* Owner directive 2026-10-27 · "make the buttons more
              bigger less" + "ok add [Go Live / Create / Studio]" ·
              retired the 4-tile set (Live/Record/Draft/Insights) in
              favour of 3 bigger tiles that each route to a real
              surface:
                · Go Live  → /nex-native/live-commerce/welcome
                · Create   → /nex-native/manage/watches/new
                             (Stage A redesign 2026-10-28: category
                             picker + colour variants + spec sheet)
                · Studio   → /nex-native/live-commerce/studio
                             (Insights · Followers · Shop hub)
              Grid went 4-col/6 gap → 3-col/8 gap, padding 6px/2px
              → 12px/4px, label 10 → 12.5, glyph 14 → 20 so each
              tile reads as a primary action. Live keeps its pulsing
              red dot inside the navy chip. */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 8,
            }}
          >
            {([
              // Owner directive 2026-10-27 (R9) · when liveLocked is
              // true the Go Live tile is NOT disabled (users can still
              // tap through to the upsell) · the tap is redirected to
              // `onLiveLockedTap` so the caller can route to packages.
              // The lock glyph below communicates the state visually.
              {
                key: "live",
                label: "Go Live",
                onClick: liveLocked ? onLiveLockedTap : onLive,
                disabled: liveLocked ? !onLiveLockedTap : !onLive,
              },
              { key: "create", label: "Create",  onClick: onCreate, disabled: !onCreate },
              { key: "studio", label: "Studio",  onClick: onStudio, disabled: !onStudio },
            ] as const).map((b) => (
              <button
                key={b.key}
                type="button"
                onClick={b.onClick}
                aria-label={b.label}
                disabled={b.disabled}
                data-nex-broadcaster-library-footer-btn={b.key}
                data-nex-broadcaster-library-go-live-locked={
                  b.key === "live" && liveLocked ? "true" : undefined
                }
                style={{
                  display: "inline-flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  padding: "12px 4px",
                  borderRadius: 12,
                  background: "linear-gradient(135deg, #152646 0%, #1E3A6E 100%)",
                  border: "none",
                  color: "#FFFFFF",
                  fontSize: 12.5,
                  fontWeight: 800,
                  letterSpacing: "0.02em",
                  cursor: b.disabled ? "not-allowed" : "pointer",
                  opacity: b.disabled
                    ? 0.4
                    : b.key === "live" && liveLocked
                      ? 0.72
                      : 1,
                  boxShadow: "0 3px 10px -3px rgba(16, 32, 51, 0.45)",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                {b.key === "live" && liveLocked && (
                  // Owner directive 2026-10-27 (R9) · lock glyph in
                  // place of the pulsing red dot when the account is
                  // ineligible. 🔒 is the sealed lock pattern already
                  // used on "Shop Products" when there is no shop
                  // (LiveViewerFooter) · reusing it keeps the surface
                  // familiar instead of inventing a new symbol.
                  <span
                    aria-hidden
                    style={{
                      display: "inline-block",
                      width: 14,
                      height: 14,
                      lineHeight: "14px",
                      fontSize: 13,
                      textAlign: "center",
                    }}
                  >
                    🔒
                  </span>
                )}
                {b.key === "live" && !liveLocked && (
                  <span
                    aria-hidden
                    style={{
                      position: "relative",
                      display: "inline-block",
                      width: 14,
                      height: 14,
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius: 999,
                        background: RED,
                        boxShadow: "0 0 8px rgba(255,51,85,0.95)",
                        animation: "nex-library-live-dot 1200ms ease-in-out infinite",
                      }}
                    />
                    <span
                      style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius: 999,
                        background: "transparent",
                        border: `1.5px solid ${RED}`,
                        transformOrigin: "center",
                        animation: "nex-library-live-ping 1600ms ease-out infinite",
                      }}
                    />
                  </span>
                )}
                {b.key === "create" && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7 V17" />
                    <path d="M7 12 H17" />
                  </svg>
                )}
                {b.key === "studio" && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 20 V10" />
                    <path d="M12 20 V4" />
                    <path d="M20 20 V14" />
                  </svg>
                )}
                <span>{b.label}</span>
              </button>
            ))}
          </div>
        </div>
        </div>

      </div>

      {/* Confirm sheet · overlays everything when a bin is tapped */}
      {confirmTarget && (
        <div
          data-nex-broadcaster-library-confirm-backdrop
          onClick={() => setConfirmTarget(null)}
          style={{
            position: "absolute",
            inset: 0,
            // Owner directive 2026-10-27 · MessagePanel scrim exact.
            background: "rgba(2, 9, 20, 0.55)",
            zIndex: 110,
          }}
        />
      )}
      {confirmTarget && (
        <div
          data-nex-broadcaster-library-confirm
          role="dialog"
          aria-label="Confirm delete"
          style={{
            position: "absolute",
            left: 20,
            right: 20,
            bottom: 24,
            // Owner directive 2026-10-27 · confirm sheet matches the
            // light MessagePanel panel (near-white frosted body ·
            // muted navy rim · deep-navy drop shadow).
            background: "rgba(240, 244, 250, 0.96)",
            backdropFilter: "blur(14px) saturate(1.4)",
            WebkitBackdropFilter: "blur(14px) saturate(1.4)",
            borderRadius: 16,
            border: "1.5px solid rgba(90, 110, 140, 0.5)",
            boxShadow: "0 -14px 40px -12px rgba(0, 20, 60, 0.5)",
            padding: 18,
            zIndex: 111,
            color: TEXT,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6 }}>
            Delete this post?
          </div>
          <div style={{ fontSize: 12, fontWeight: 500, color: DIM, lineHeight: 1.4, marginBottom: 14 }}>
            Views and likes stay with the record but the post comes off your feed.
            You have 5 seconds to undo.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => setConfirmTarget(null)}
              style={{
                flex: 1,
                padding: "10px 14px",
                // Owner directive 2026-10-27 · Cancel pill on the
                // light confirm sheet uses a muted navy tint (not
                // the old white 0.08 which disappears on near-white).
                background: "rgba(16, 32, 51, 0.08)",
                color: TEXT,
                border: "1px solid rgba(16, 32, 51, 0.14)",
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                const target = confirmTarget;
                setConfirmTarget(null);
                onDelete(target);
              }}
              data-nex-broadcaster-library-confirm-delete
              style={{
                flex: 1,
                padding: "10px 14px",
                background: RED,
                color: "#FFFFFF",
                border: "none",
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </>
  );
}
