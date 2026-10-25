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
  /** Owner directive 2026-10-26 · Creator Loop quartet above
   *  composer · 4 square tiles (same silhouette as the sealed Like
   *  heart). Live = start a broadcast (red). Record = shoot a new
   *  post (cyan). Draft = resume an unpublished post (cyan).
   *  Insights = toggle the metrics strip (cyan). All callbacks are
   *  caller-managed · the sheet surfaces user intent and leaves
   *  routing to the parent. */
  readonly onLive?: () => void;
  readonly onRecord?: () => void;
  readonly onDraft?: () => void;
  /** Owner directive 2026-10-26 · full-hide chrome mode · the top
   *  chrome bar inside the overlay renders the broadcaster's avatar
   *  + display name + close ✕. Parent passes the identity so the
   *  sheet is self-sufficient while the Live chrome is hidden. */
  readonly broadcasterAvatarUrl?: string | null;
  readonly broadcasterDisplayName?: string | null;
}

const RED = "#FF3355";
const TEXT = "#F2F5F8";
const DIM = "#8BA9D1";
const MUTE = "#526B89";
// Owner directive 2026-10-26 (NEX neon blue · not dark) · cards
// + Record/Draft/Insights quartet tiles use the sealed NEX cyan
// (#00AFFF) · translucent frosted overlay + brighter cyan rim +
// soft cyan outer glow so the whole family reads as neon · NOT
// the muted navy-blue previous take.
const CARD_BG = "linear-gradient(135deg, rgba(0, 175, 255, 0.28) 0%, rgba(0, 140, 220, 0.14) 100%)";
const CARD_BORDER = "1px solid rgba(0, 200, 255, 0.65)";
const CARD_SHADOW = "0 0 12px -2px rgba(0, 175, 255, 0.45), 0 4px 14px -4px rgba(0, 20, 50, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.12)";
const CARD_BACKDROP_FILTER = "blur(18px) saturate(160%)";
// Owner directive 2026-10-26 (polish batch · elevate top performer)
// · the single card with the highest viewCount gets an amber rim
// + ⭐ before its title. Signals at-a-glance which post is
// winning without reading a single number.
const BEST_BORDER = "1px solid rgba(255, 180, 80, 0.6)";
const BEST_SHADOW = "0 4px 14px -4px rgba(90, 60, 10, 0.6), inset 0 1px 0 rgba(255, 220, 140, 0.08), 0 0 12px -6px rgba(255, 180, 80, 0.5)";
const BEST_ACCENT = "#FFB450";
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
  onRecord,
  onDraft,
  broadcasterAvatarUrl,
  broadcasterDisplayName,
}: BroadcasterLibrarySheetProps): React.JSX.Element | null {
  // Confirm-delete sheet state · we hold the pending candidate here
  // rather than firing straight to the caller so the owner directive
  // "confirm before destructive" is respected inside the component.
  const [confirmTarget, setConfirmTarget] = React.useState<BroadcasterLibraryVideo | null>(null);
  // Insights-strip toggle · owner directive 2026-10-26 "world class
  // for NEX" · aggregate metrics computed from `videos` so the user
  // sees totals + best performer without any backend call.
  const [insightsOpen, setInsightsOpen] = React.useState(false);

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
          // Owner directive 2026-10-26 (undo blur) · "i want the
          // buttons and cards same screen as footer". Backdrop stays
          // in place to catch tap-to-close, but no dim and no blur ·
          // the Live video + footer stay fully visible behind the
          // floating cards and quartet.
          background: "transparent",
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
          // Owner directive 2026-10-26 · "fix the container center
          // in width of the screen" · align the container as a
          // centred column (was stretch · which made the container's
          // width = full overlay minus padding and the margin:auto
          // on the container was a no-op).
          alignItems: "center",
          // Owner directive 2026-10-26 · "5 cards displaying at time
          // maybe 6" · centre the card stack vertically in the
          // viewport (otherwise an 8-item list would stretch top to
          // bottom and all 8 would be visible with no scroll). The
          // list below caps itself to ~400 px so 5-6 compact cards
          // are visible and the rest scroll into view.
          justifyContent: "center",
          zIndex: 101,
          color: TEXT,
          // Owner directive 2026-10-26 (−20 more) · top padding
          // 120 (was 140). Container sits closer to header area.
          padding: "120px 12px 30px",
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
            maxWidth: 320,
            width: "100%",
            marginLeft: "auto",
            marginRight: "auto",
            padding: 12,
            borderRadius: 14,
            // Owner directive 2026-10-26 · "background color on the
            // container is the same color as chat page back ground"
            // · solid #020914 (matches `conversations/[conversationId]
            // /page.tsx:145`). Hairline cyan rim preserved for the
            // slight NEX family identity.
            background: "#020914",
            border: "1px solid rgba(0, 175, 255, 0.25)",
            pointerEvents: "auto",
          }}
        >
        {/* Owner directive 2026-10-26 · container header · "Live
            Library" on left, "Live N" on right where N is the live
            post count. */}
        <div
          data-nex-broadcaster-library-header
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 8,
            padding: "2px 4px 10px",
            borderBottom: "1px solid rgba(0, 175, 255, 0.2)",
            marginBottom: 8,
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: TEXT,
              letterSpacing: "0.02em",
            }}
          >
            Live Library
          </div>
          {/* Owner directive 2026-10-26 · "remove the live 8 from
              top header right and add x button blue" · the count
              now lives in the bottom Hendra chrome · top-right slot
              becomes the explicit close ✕. */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close library"
            style={{
              background: "transparent",
              border: "none",
              color: "#00AFFF",
              fontSize: 20,
              fontWeight: 400,
              lineHeight: 1,
              padding: 4,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>
        {/* Owner directive 2026-10-26 (−1 row) · 5 rows visible ·
            72 × 5 = 360 px list height. */}
        <div
          data-nex-broadcaster-library-list
          style={{
            height: 360,
            maxHeight: 360,
            width: "100%",
            overflowY: "auto",
            overflowX: "hidden",
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: 0,
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
            (() => {
              // Owner directive 2026-10-26 (polish batch) · compute
              // the top-performing video id ONCE for the whole map ·
              // only elevate when there's more than one post to
              // avoid "every card is best" when the library has 1.
              const bestId: string | null = videos.length > 1
                ? videos.reduce(
                    (b, v) => (v.viewCount > b.viewCount ? v : b),
                  ).id
                : null;
              return videos.map((v) => {
              const isBest = bestId !== null && v.id === bestId;
              const duration = formatDuration(v.durationSeconds);
              const isRevealed = revealedBinId === v.id;
              return (
                <div
                  key={v.id}
                  data-nex-broadcaster-library-card-outer
                  data-nex-broadcaster-library-card-id={v.id}
                  data-nex-broadcaster-library-card-revealed={isRevealed ? "true" : "false"}
                  style={{
                    // Owner directive 2026-10-26 (revised) · row
                    // uses the card LAYOUT (thumbnail + meta) but
                    // NO card chrome. Dotted gray separator between
                    // rows · 72 px tall fits the 16:9 thumbnail.
                    position: "relative",
                    overflow: "hidden",
                    height: 72,
                    minHeight: 72,
                    maxHeight: 72,
                    boxSizing: "border-box",
                    borderBottom: "1px dashed rgba(255, 255, 255, 0.14)",
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
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    padding: "4px 8px",
                    height: "100%",
                    // No card chrome · flat on the container · top-
                    // performer row carries a subtle amber left stripe.
                    background: "transparent",
                    borderLeft: isBest
                      ? `3px solid ${BEST_ACCENT}`
                      : "3px solid transparent",
                    cursor: "pointer",
                    transform: isRevealed ? "translateX(-72px)" : "translateX(0)",
                    transition: "transform 180ms ease-out",
                    boxSizing: "border-box",
                  }}
                >
                  {/* Thumbnail · 16:9 · white glass ▶ overlay · duration chip */}
                  <div
                    style={{
                      position: "relative",
                      flexShrink: 0,
                      width: 72,
                      aspectRatio: "16 / 9",
                      borderRadius: 6,
                      overflow: "hidden",
                      background: "#0A0F1E",
                    }}
                  >
                    {v.posterUrl ? (
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
                        width: 20,
                        height: 20,
                        borderRadius: 999,
                        // Owner directive 2026-10-26 · play button
                        // dark red (was white glass).
                        background: "#A62424",
                        border: "1px solid rgba(255, 70, 70, 0.6)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.45), 0 0 8px rgba(166,36,36,0.5)",
                      }}
                    >
                      <svg
                        aria-hidden
                        width="8"
                        height="8"
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
                        fontSize: 12,
                        fontWeight: 700,
                        color: TEXT,
                        lineHeight: 1.2,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {isBest && (
                        <span
                          aria-label="Best-performing post"
                          style={{
                            color: BEST_ACCENT,
                            marginRight: 4,
                            fontSize: 10,
                            verticalAlign: "middle",
                          }}
                        >
                          ★
                        </span>
                      )}
                      {v.title}
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
                        gap: 10,
                        fontSize: 10,
                        fontWeight: 700,
                        color: DIM,
                      }}
                    >
                      {/* Polish #3 · SVG metric icons replace emoji ·
                          crisp pixel-perfect rendering across OSes,
                          color inherits from span so the dim/rose/
                          teal split renders cleanly. */}
                      <span style={{ color: DIM, display: "inline-flex", alignItems: "center", gap: 3 }}>
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
            });
            })()
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
            borderTop: "1px dashed rgba(255, 255, 255, 0.14)",
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
                  background: "#0A0F1E",
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
          {/* Row 2 · Live / Record / Draft / Insights · blue rim */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr 1fr",
              gap: 6,
            }}
          >
            {([
              { key: "live",     label: "Live",     onClick: onLive,     disabled: !onLive, red: true },
              { key: "record",   label: "Record",   onClick: onRecord,   disabled: !onRecord, red: false },
              { key: "draft",    label: "Draft",    onClick: onDraft,    disabled: !onDraft, red: false },
              { key: "insights", label: "Insights", onClick: () => setInsightsOpen((v) => !v), disabled: false, red: false },
            ] as const).map((b) => (
              <button
                key={b.key}
                type="button"
                onClick={b.onClick}
                aria-label={b.label}
                disabled={b.disabled}
                data-nex-broadcaster-library-footer-btn={b.key}
                style={{
                  display: "inline-flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2,
                  padding: "6px 2px",
                  borderRadius: 10,
                  // Owner directive 2026-10-26 · Live tile dark
                  // red + pulsing dot ping (was lighter red tint).
                  background: b.red
                    ? "linear-gradient(135deg, rgba(140, 15, 20, 0.95) 0%, rgba(90, 5, 10, 0.95) 100%)"
                    : "rgba(255,255,255,0.06)",
                  border: b.red
                    ? "1px solid rgba(200, 40, 50, 0.7)"
                    : "1px solid rgba(0, 175, 255, 0.6)",
                  color: TEXT,
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.02em",
                  cursor: b.disabled ? "not-allowed" : "pointer",
                  opacity: b.disabled ? 0.4 : 1,
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                {b.key === "live" && (
                  <span
                    aria-hidden
                    style={{
                      position: "relative",
                      display: "inline-block",
                      width: 8,
                      height: 8,
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius: 999,
                        background: RED,
                        boxShadow: "0 0 6px rgba(255,51,85,0.95)",
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
                {b.key === "record" && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="4" fill="currentColor" />
                    <circle cx="12" cy="12" r="9" />
                  </svg>
                )}
                {b.key === "draft" && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 3 h9 l4 4 v14 H6 Z" />
                    <path d="M15 3 v4 h4" />
                    <path d="M9 13 h6" />
                    <path d="M9 17 h4" />
                  </svg>
                )}
                {b.key === "insights" && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
            background: "rgba(2,9,20,0.75)",
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
            background: "#0A0F1E",
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 -14px 40px -12px rgba(0,0,0,0.65)",
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
                background: "rgba(255,255,255,0.08)",
                color: TEXT,
                border: "none",
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
