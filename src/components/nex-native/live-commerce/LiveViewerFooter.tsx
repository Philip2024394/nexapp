// src/components/nex-native/live-commerce/LiveViewerFooter.tsx
//
// NEX Live · viewer footer · Like / View Shop / Share / Text input.
// -----------------------------------------------------------------------------
// Phase 2 · Live interaction UI build 2026-10-24.
//
// Layout (sealed per owner directive):
//   [❤ Like]  [prominent View Shop]  [⤴ Share]
//   [────────────── NexTextarea ──────────────]
//
// The text input uses NexTextarea · the sealed NEX keypad primitive.
// NO second keyboard is invented.
//
// Share is EVIDENCE-GATED per the sealed feature contract §3.3 · a
// share-event is reported to the parent ONLY when:
//   · `navigator.share` resolves successfully, OR
//   · "Copy link" tap succeeds, OR
//   · "Chat send" tap succeeds (parent handles the chat routing)
//
// If the OS share sheet is cancelled or clipboard write fails, the
// parent receives nothing · no card entitlement is generated.

"use client";

import * as React from "react";
import { NexTextarea } from "@/lib/nex-native/nex-keyboard/nex-textarea";
import { LIVE_COMMENT_MAX_LENGTH } from "@/lib/nex-native/live-broadcast/live-comments-channel";
import type { VideoShareEvidence } from "./VideoShareSheet";
import { hasAcceptedLiveWelcome } from "@/lib/nex-native/live-broadcast/live-welcome-acceptance";

const LIVE_WELCOME_PATH = "/nex-native/live-commerce/welcome";

export type ShareEvidence =
  | "native-share"
  | "copy-link"
  | "chat-send"
  | VideoShareEvidence;

/** Owner spec 2026-10-24 · reply context in-composer. Lightweight ·
 *  what the viewer SEES in the "Replying to …" bar. Submitting the
 *  comment attaches these fields to the Realtime payload. */
export interface LiveReplyContext {
  readonly replyToAuthorAccountId: string;
  readonly replyToAuthorDisplayName: string;
  readonly replyToTextPreview: string;
}

export interface LiveViewerFooterProps {
  readonly viewShopHref: string;
  /** Owner directive 2026-10-24 · the big CTA label is context-aware.
   *  - "View Shop" when the video has an active owner/business and the
   *    `viewShopHref` points at the shop surface (default).
   *  - "View Market" when there is no owner shop · href points at the
   *    Search Directory (optionally category-filtered). The uploaded-
   *    video viewer resolves this via `resolveMarketCta`. */
  readonly viewTargetLabel?: string;
  /** Short aria-label describing the destination for screen readers.
   *  Defaults to "Open this seller's shop" when omitted. */
  readonly viewTargetAriaLabel?: string;
  /** Market vs shop · controls the `data-nex-live-footer-view-target-kind`
   *  attribute for test selectors. Defaults to `"shop"`. */
  readonly viewTargetKind?: "shop" | "market";
  readonly shareUrl: string;
  readonly shareTitle: string;
  readonly onLike: () => void;
  readonly onComment: (text: string, replyContext?: LiveReplyContext) => void;
  /** Fires when the viewer taps the Share action · the PARENT owns
   *  the share-sheet state so the sheet can overlay the WHOLE
   *  viewer (not just the footer). The parent should mount
   *  `<VideoShareSheet …/>` and route its evidence callback into
   *  `onShareEvidence`.
   *
   *  Optional for backwards-compatibility with the Live viewer
   *  surface at `/live-commerce/[sessionId]` which has not yet been
   *  upgraded to own the share sheet. When omitted, Share falls
   *  back to `navigator.share` + a minimal copy-link path. The
   *  owner spec says the 3-option sheet is canonical · the Live
   *  viewer should migrate to pass `onShareRequested` in a follow-up. */
  readonly onShareRequested?: () => void;
  readonly onShareEvidence: (evidence: ShareEvidence) => void;
  readonly isLiked?: boolean;
  readonly disabled?: boolean;
  /** Owner spec 2026-10-24 · guest-locked composer. When true the
   *  composer renders a lock chip inviting sign-in · tap routes to
   *  `signInHref ?? "/sign-in?returnTo={current}"`. The composer
   *  textarea + send button are OMITTED (not just disabled) so no
   *  client-side state can send a comment. */
  readonly isGuest?: boolean;
  /** Where to send the viewer when they tap the locked composer.
   *  Defaults to `/sign-in?returnTo={window.location.pathname}`. */
  readonly signInHref?: string;
  /** Owner spec 2026-10-24 · reply mode. When provided the composer
   *  shows a "Replying to {name}" chip above the textarea with a ✕
   *  to cancel. On send the context is passed through onComment. */
  readonly replyContext?: LiveReplyContext | null;
  readonly onReplyCancel?: () => void;
  /** Optional Go Live affordance · when provided, a 4th action
   *  button routes the viewer to the broadcaster surface so they
   *  can start their own stream from inside the viewer. Default
   *  `/nex-native/live-commerce/go-live`. Pass empty string to
   *  hide the button entirely. */
  readonly goLiveHref?: string;
  /** Owner directive 2026-10-24 · account-aware Live gate. When
   *  `true` the Live anchor navigates directly to the broadcaster
   *  surface (treat as shop owner / NEX Business). When `false` or
   *  omitted the tap opens the welcome gate modal first with the
   *  usage rules + "Let's Roll" CTA. Default is `false` (safer:
   *  show the gate to everyone until the parent has an authoritative
   *  signal). */
  readonly isShopOwner?: boolean;
  /** Owner directive 2026-10-25 · composer-header author identity.
   *  When `authorDisplayName` is provided the composer placeholder
   *  rotates every 2 seconds between the author name and the gray
   *  "Type Message…" prompt (empty-state only · a typing user sees
   *  only their own draft).
   *  When `authorAvatarUrl` is provided (or when a display name is
   *  provided without a URL · falls back to initials) a 24×24
   *  avatar renders inside the textarea on the left · when
   *  `authorIsLive` is true a small red ping dot sits on the
   *  avatar's top-right. */
  readonly authorAvatarUrl?: string | null;
  readonly authorDisplayName?: string | null;
  readonly authorIsLive?: boolean;
}

const BAR_BG = "rgba(2, 9, 20, 0.78)";
const BORDER = "rgba(255, 255, 255, 0.12)";
const TEXT = "#F2F5F8";
const DIM = "#8BA9D1";
const RED = "#FF3355";
const CYAN = "#00AFFF";

export function LiveViewerFooter(
  props: LiveViewerFooterProps,
): React.JSX.Element {
  const [draft, setDraft] = React.useState("");
  const [likePulse, setLikePulse] = React.useState(0);

  // Owner directive 2026-10-25 · composer placeholder rotates every
  // 2 seconds between the author name and "Type Message…" when an
  // author display name is provided. The rotation only drives the
  // placeholder attribute · as soon as the viewer types a character
  // the native placeholder is hidden, so the user never sees the
  // rotation interfere with their own draft.
  const [rotateToName, setRotateToName] = React.useState(true);
  React.useEffect(() => {
    if (!props.authorDisplayName) return;
    const id = window.setInterval(() => {
      setRotateToName((v) => !v);
    }, 2000);
    return () => {
      window.clearInterval(id);
    };
  }, [props.authorDisplayName]);
  const hasAuthorIdentity =
    typeof props.authorDisplayName === "string" &&
    props.authorDisplayName.length > 0;
  const avatarInitial = hasAuthorIdentity
    ? (props.authorDisplayName as string).trim().charAt(0).toUpperCase()
    : "·";
  const dynamicComposerPlaceholder: string = (() => {
    if (props.replyContext)
      return `Reply to ${props.replyContext.replyToAuthorDisplayName}…`;
    if (!hasAuthorIdentity) return "Say something…";
    return rotateToName
      ? (props.authorDisplayName as string)
      : "Type Message…";
  })();
  const goLiveHref = props.goLiveHref ?? "/nex-native/live-commerce/go-live";
  const showGoLive = goLiveHref !== "";
  const isShopOwner = props.isShopOwner === true;

  // Owner directive 2026-10-24 · account-aware Live gate.
  //   · Shop owners (isShopOwner === true) skip the gate · click
  //     flows straight through the anchor to the broadcaster.
  //   · NEX-chat users on their first tap are redirected to the
  //     welcome PAGE (/nex-native/live-commerce/welcome) · owner
  //     directive "welcome nex live - move to page - not container".
  //     Once accepted, the device-local flag lets them pass through.
  //   · The modifier-click + middle-click bypass is preserved so
  //     developers / power users can still open the broadcaster
  //     directly in a new tab.
  const handleGoLiveClick = React.useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (isShopOwner) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (e.button !== 0) return;
      if (hasAcceptedLiveWelcome()) return;
      e.preventDefault();
      const target = `${LIVE_WELCOME_PATH}?returnTo=${encodeURIComponent(goLiveHref)}`;
      if (typeof window !== "undefined") {
        window.location.assign(target);
      }
    },
    [isShopOwner, goLiveHref],
  );

  const handleSend = React.useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed.length === 0 || props.disabled || props.isGuest) return;
    // Owner spec 2026-10-24 · reply context goes through on send.
    props.onComment(trimmed, props.replyContext ?? undefined);
    setDraft("");
    // Clear reply mode after a successful send (parent owns the
    // state · we signal via onReplyCancel to keep a single source
    // of truth).
    if (props.replyContext && props.onReplyCancel) {
      props.onReplyCancel();
    }
  }, [draft, props]);

  // Owner directive 2026-10-24 (refined) · cinematic Like animation.
  //   Phase A · one BIG heart originates from the Like button, rises
  //            slowly up to the header area with gentle side-to-side
  //            wobble.
  //   Phase A' · along the rise, smaller trail hearts drop out of
  //              the big heart's trail (3 drops, staggered).
  //   Phase B · at the top of the rise, the big heart EXPLODES and
  //            12 small hearts shower downward FULL-SCREEN from the
  //            header area down past the footer, with random drift
  //            and rotation.
  // All hearts self-clean after their own animation window.
  //
  // The LEFT_LIKE_PCT constant is tuned to sit over the Like button
  // which is the first cell in a 4-column grid (gridTemplateColumns:
  // "1fr 1fr 1.5fr 1fr") with 6px gap and 12px side padding of the
  // footer container. On a 412px (Pixel 7) viewport that's ~55px
  // from the left edge → ~13% of viewer width.
  const LEFT_LIKE_PCT = 15;
  const [bigHearts, setBigHearts] = React.useState<
    ReadonlyArray<{ readonly id: number; readonly leftPct: number }>
  >([]);
  type Shard = {
    readonly id: number;
    readonly leftPct: number;
    readonly startBottom: number;
    readonly dx: number;
    readonly dy: number;
    readonly rot: number;
    readonly delay: number;
    readonly size: number;
    readonly duration: number;
  };
  const [shardHearts, setShardHearts] = React.useState<ReadonlyArray<Shard>>([]);
  const heartIdRef = React.useRef(0);

  const spawnShard = React.useCallback(
    (shard: Omit<Shard, "id">) => {
      const id = ++heartIdRef.current;
      const full: Shard = { ...shard, id };
      setShardHearts((prev) => {
        const next = [...prev, full];
        return next.length > 48 ? next.slice(-48) : next;
      });
      setTimeout(() => {
        setShardHearts((prev) => prev.filter((s) => s.id !== id));
      }, shard.duration + shard.delay + 100);
    },
    [],
  );

  const spawnFloatingHeart = React.useCallback(() => {
    // Phase A · big heart rising from the Like button with wobble.
    //   Duration 1800 ms · slower than before (owner "more slowly").
    //   Lifetime includes a brief tail for the explode fade.
    const bigId = ++heartIdRef.current;
    setBigHearts((prev) => {
      const next = [...prev, { id: bigId, leftPct: LEFT_LIKE_PCT }];
      return next.length > 4 ? next.slice(-4) : next;
    });
    setTimeout(() => {
      setBigHearts((prev) => prev.filter((h) => h.id !== bigId));
    }, 2000);

    // Phase A' · trail hearts dropping out of the big heart during
    // the rise. The big heart's approximate bottom-coord at each
    // trail timing is derived from the nexLiveHeartBigRise keyframe
    // vertical offsets (see <style> block below).
    const trailStops: readonly { readonly at: number; readonly bottom: number }[] = [
      { at: 420,  bottom: 180 },  // ~22% of rise · just above footer
      { at: 840,  bottom: 320 },  // ~44% of rise · mid-viewer
      { at: 1260, bottom: 480 },  // ~65% of rise · upper mid
    ];
    trailStops.forEach((stop) => {
      setTimeout(() => {
        spawnShard({
          leftPct: LEFT_LIKE_PCT + (Math.random() - 0.5) * 8,
          startBottom: stop.bottom,
          dx: (Math.random() - 0.5) * 60,
          dy: 160 + Math.random() * 80,
          rot: (Math.random() - 0.5) * 60,
          delay: 0,
          size: 14 + Math.random() * 6,
          duration: 1100 + Math.random() * 200,
        });
      }, stop.at);
    });

    // Phase B · at the explode moment (~1600 ms), 12 small hearts
    // shower from the header area down past the footer. Fall
    // distance ~620 px covers the full viewer height.
    setTimeout(() => {
      Array.from({ length: 12 }).forEach(() => {
        spawnShard({
          leftPct: 40 + (Math.random() - 0.5) * 28,
          startBottom: 720,
          dx: (Math.random() - 0.5) * 240,
          dy: 540 + Math.random() * 90,
          rot: (Math.random() - 0.5) * 160,
          delay: Math.random() * 220,
          size: 16 + Math.random() * 10,
          duration: 1800 + Math.random() * 400,
        });
      });
    }, 1600);
  }, [spawnShard]);

  // Owner spec 2026-10-24 · the 3-option share sheet is owned by
  // the PARENT so it can overlay the entire viewer surface. When
  // the parent hasn't opted in (older Live viewer surface), we fall
  // back to the OS native share · worst case `navigator.share` is
  // unavailable and the tap is a no-op (honest · no fake share).
  const openShareSheet = React.useCallback(() => {
    if (props.disabled) return;
    if (props.onShareRequested) {
      props.onShareRequested();
      return;
    }
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function"
    ) {
      void navigator
        .share({ title: props.shareTitle, url: props.shareUrl })
        .then(() => props.onShareEvidence("native-share"))
        .catch(() => {
          /* user cancelled · no evidence */
        });
    }
  }, [props]);

  return (
    <div
      data-nex-live-viewer-footer
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        // Owner directive 2026-10-25 · composer must fit screen width.
        // The container keeps vertical safe-area + breathing padding
        // but drops horizontal padding so the inner composer stretches
        // edge-to-edge. The action-buttons grid re-adds its own
        // horizontal inset below so Like/Live/Market/Share don't
        // touch the screen edges.
        padding: "10px 0 calc(env(safe-area-inset-bottom, 0px) + 10px)",
        // Owner directive 2026-10-24 · "remove the container from
        // footer background". Transparent · the action buttons stand
        // alone over the video. textShadow preserved on individual
        // button labels so the icon + text stay legible.
        background: "transparent",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        zIndex: 2,
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Row 1 · action buttons · 4-column grid when Go Live is on.
          Owner directive 2026-10-24 · "fix the footer text input
          field and like button and go live button and share button". */}
      <style>{`
        @keyframes nexLikePulse {
          0% { transform: scale(1); }
          40% { transform: scale(1.28); }
          100% { transform: scale(1); }
        }
        [data-nex-live-footer-like]:active,
        [data-nex-live-footer-share]:active,
        [data-nex-live-footer-go-live]:active,
        [data-nex-live-footer-view-shop]:active {
          transform: scale(0.94);
        }
        [data-nex-live-footer-like],
        [data-nex-live-footer-share],
        [data-nex-live-footer-go-live],
        [data-nex-live-footer-view-shop] {
          transition: transform 120ms ease-out, background 160ms ease-out;
        }
      `}</style>
      <div
        data-nex-live-viewer-footer-actions
        style={{
          display: "grid",
          // Owner directive 2026-10-25 · the Like button moves to the
          // composer, so this row carries only Live / Market / Share
          // (3-col) or Market / Share (2-col when goLive is hidden).
          gridTemplateColumns: showGoLive ? "1fr 1.6fr 1fr" : "2fr 1fr",
          gap: 6,
          alignItems: "stretch",
          padding: "0 12px",
        }}
      >
        {showGoLive && (
          <a
            href={goLiveHref}
            data-nex-live-footer-go-live
            data-nex-live-footer-go-live-gated={isShopOwner ? "false" : "true"}
            aria-label="Start your own Live broadcast"
            onClick={handleGoLiveClick}
            style={{
              background: "linear-gradient(135deg, #FF3355 0%, #FF7200 100%)",
              color: "#FFFFFF",
              fontSize: 11,
              fontWeight: 800,
              borderRadius: 12,
              padding: "6px 6px",
              textAlign: "center",
              textDecoration: "none",
              boxShadow: "0 6px 14px -6px rgba(255, 51, 85, 0.5)",
              letterSpacing: "0.04em",
              display: "inline-flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              minHeight: 48,
            }}
          >
            <span aria-hidden style={{ fontSize: 16 }}>●</span>
            <span>Live</span>
          </a>
        )}

        <a
          href={props.viewShopHref}
          data-nex-live-footer-view-shop
          data-nex-live-footer-view-target-kind={props.viewTargetKind ?? "shop"}
          aria-label={props.viewTargetAriaLabel ?? "Open this seller's shop"}
          style={{
            background: `linear-gradient(135deg, ${CYAN} 0%, #0074ff 100%)`,
            color: "#FFFFFF",
            fontSize: 11,
            fontWeight: 800,
            borderRadius: 12,
            padding: "6px 6px",
            textAlign: "center",
            textDecoration: "none",
            boxShadow: "0 8px 18px -6px rgba(0, 175, 255, 0.5)",
            letterSpacing: "0.04em",
            display: "inline-flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            minHeight: 48,
          }}
        >
          {/* Owner directive 2026-10-24 · "add market icon". Simple
              storefront SVG · 16px · white monochrome · same visual
              weight as the Live-dot and the Share arrow. */}
          <svg
            aria-hidden
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Storefront roof awning */}
            <path d="M3 7 L4 4 h16 L21 7" />
            {/* Awning base */}
            <path d="M3 7 h18" />
            {/* Shop body walls + floor */}
            <path d="M4 7 v13 h16 v-13" />
            {/* Door */}
            <path d="M10 20 v-6 h4 v6" />
          </svg>
          <span>{props.viewTargetLabel ?? "Shop"}</span>
        </a>

        <button
          type="button"
          onClick={openShareSheet}
          disabled={props.disabled}
          data-nex-live-footer-share
          aria-label="Share this live stream"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: `1px solid ${BORDER}`,
            color: TEXT,
            fontSize: 15,
            fontWeight: 700,
            borderRadius: 12,
            padding: "10px 6px",
            cursor: props.disabled ? "not-allowed" : "pointer",
            display: "inline-flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            minHeight: 48,
          }}
        >
          <span aria-hidden style={{ fontSize: 18 }}>⤴</span>
          <span style={{ fontSize: 11, fontWeight: 700 }}>Share</span>
        </button>
      </div>

      {/* Owner directive 2026-10-24 (refined) · cinematic Like
          animation · slower rise from the Like button with side-to-
          side wobble + trail-hearts falling off during the ascent +
          full-screen shower on explode at the header. All animation
          properties are LONG-HAND to avoid the React shorthand /
          non-shorthand mix warning. */}
      <style>{`
        /* Phase A · big rising heart · 1800 ms slow rise with wobble.
           -620px final offset lands at the header area on Pixel 7
           (viewer 915 px tall · footer ~130 px · heart start bottom:
           110). The horizontal wobble is a 10-step keyframe for a
           smooth sinusoid-like sway. */
        @keyframes nexLiveHeartBigRise {
          0%   { opacity: 0; transform: translate(-50%, 0)        scale(0.6)  rotate(-2deg); }
          6%   { opacity: 1; transform: translate(-50%, -16px)    scale(1.05) rotate(0deg); }
          15%  { opacity: 1; transform: translate(calc(-50% + 10px), -80px)   scale(1.1) rotate(2deg); }
          25%  { opacity: 1; transform: translate(calc(-50% - 12px), -160px)  scale(1.12) rotate(-3deg); }
          35%  { opacity: 1; transform: translate(calc(-50% + 10px), -240px)  scale(1.14) rotate(2deg); }
          45%  { opacity: 1; transform: translate(calc(-50% - 10px), -320px)  scale(1.18) rotate(-2deg); }
          55%  { opacity: 1; transform: translate(calc(-50% + 8px),  -400px)  scale(1.24) rotate(2deg); }
          65%  { opacity: 1; transform: translate(calc(-50% - 6px),  -480px)  scale(1.32) rotate(-1deg); filter: drop-shadow(0 0 14px rgba(255, 65, 100, 0.65)); }
          75%  { opacity: 1; transform: translate(-50%,              -560px)  scale(1.5)  rotate(0deg);  filter: drop-shadow(0 0 22px rgba(255, 90, 125, 0.85)); }
          85%  { opacity: 1; transform: translate(-50%,              -620px)  scale(2.6)  rotate(0deg);  filter: drop-shadow(0 0 36px rgba(255, 120, 150, 0.95)); }
          100% { opacity: 0; transform: translate(-50%,              -620px)  scale(0.4)  rotate(0deg);  filter: drop-shadow(0 0 0 transparent); }
        }
        /* Phase A' + Phase B · a single shower keyframe parametrised
           by CSS vars. Trail hearts (shorter dy) and explode shower
           (long dy) share this definition. */
        @keyframes nexLiveHeartShower {
          0%   { opacity: 0; transform: translate(-50%, 0)                                                     scale(0.9) rotate(0deg); }
          10%  { opacity: 1; transform: translate(calc(-50% + var(--nex-h-dx) * 0.18), calc(var(--nex-h-dy) * 0.06)) scale(1) rotate(calc(var(--nex-h-rot) * 0.3)); }
          100% { opacity: 0; transform: translate(calc(-50% + var(--nex-h-dx) * 1),    var(--nex-h-dy))        scale(0.55) rotate(var(--nex-h-rot)); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-nex-live-footer-heart-big],
          [data-nex-live-footer-heart-shard] {
            animation-name: none !important;
            opacity: 0 !important;
          }
        }
      `}</style>
      {/* Phase A · big rising heart(s) with wobble */}
      {bigHearts.map((h) => (
        <span
          key={`big-${h.id}`}
          aria-hidden
          data-nex-live-footer-heart-big
          style={{
            position: "absolute",
            left: `${h.leftPct}%`,
            bottom: 110,
            fontSize: 34,
            color: RED,
            pointerEvents: "none",
            animationName: "nexLiveHeartBigRise",
            animationDuration: "1800ms",
            animationTimingFunction: "cubic-bezier(0.22, 0.65, 0.33, 1)",
            animationFillMode: "forwards",
            animationIterationCount: 1,
            zIndex: 4,
          }}
        >
          ❤
        </span>
      ))}
      {/* Phase A' trail hearts + Phase B shower hearts · unified shard list */}
      {shardHearts.map((h) => (
        <span
          key={`shard-${h.id}`}
          aria-hidden
          data-nex-live-footer-heart-shard
          style={
            {
              position: "absolute",
              left: `${h.leftPct}%`,
              bottom: h.startBottom,
              fontSize: h.size,
              color: RED,
              pointerEvents: "none",
              animationName: "nexLiveHeartShower",
              animationDuration: `${h.duration}ms`,
              animationTimingFunction: "ease-in",
              animationDelay: `${h.delay}ms`,
              animationFillMode: "forwards",
              animationIterationCount: 1,
              zIndex: 3,
              "--nex-h-dx": `${h.dx}px`,
              "--nex-h-dy": `${h.dy}px`,
              "--nex-h-rot": `${h.rot}deg`,
            } as React.CSSProperties
          }
        >
          ❤
        </span>
      ))}

      {/* Owner spec 2026-10-24 · "Replying to [name]" chip above the
          composer when the parent set a reply context. Dismiss cancels
          without sending. */}
      {!props.isGuest && props.replyContext && (
        <div
          data-nex-live-footer-reply-chip
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(0, 175, 255, 0.14)",
            border: "1px solid rgba(0, 175, 255, 0.42)",
            borderRadius: 10,
            padding: "6px 8px",
            fontSize: 12,
            color: TEXT,
          }}
        >
          <span aria-hidden style={{ fontSize: 12 }}>↪</span>
          <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
            <div style={{ fontWeight: 800, fontSize: 11 }}>
              Replying to {props.replyContext.replyToAuthorDisplayName}
            </div>
            <div
              style={{
                fontSize: 11,
                color: DIM,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {props.replyContext.replyToTextPreview}
            </div>
          </div>
          <button
            type="button"
            onClick={() => props.onReplyCancel?.()}
            aria-label="Cancel reply"
            data-nex-live-footer-reply-cancel
            style={{
              background: "transparent",
              border: "none",
              color: DIM,
              fontSize: 16,
              lineHeight: 1,
              padding: 4,
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Row 2 · composer · guest-lock OR NEX-keypad composer */}
      {props.isGuest ? (
        <GuestLockedComposer
          href={
            props.signInHref ??
            (typeof window !== "undefined"
              ? `/nex-native/sign-in?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`
              : "/nex-native/sign-in")
          }
        />
      ) : (
        <div
          data-nex-live-viewer-footer-composer
          style={{
            // Owner directive 2026-10-24 · "send button square inside
            // the field text". Composer becomes a position-relative
            // wrapper so the Send button can anchor at the right
            // edge of the text field instead of sitting beside it.
            position: "relative",
            display: "block",
            // Owner directive 2026-10-25 (revised) · give the composer
            // slim horizontal breathing room so it doesn't butt against
            // the screen edges on narrow phones (320–360 px). The row
            // still reads as "fit the width" because the inset is
            // minimal and the field is noticeably wider than the
            // 3-button actions row above.
            margin: "0 8px",
            // Owner directive 2026-10-24 (keypad audit) · "turn off
            // that text is selecting blue". Suppress the native blue
            // selection highlight + the tap-flash on iOS/Android for
            // the whole composer wrapper. Typing still works because
            // the keypad populates `draft` programmatically · the
            // user never selects text in the textarea itself.
            userSelect: "none",
            WebkitUserSelect: "none",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <style>{`
            [data-nex-live-viewer-footer-composer] ::selection {
              background: transparent;
              color: inherit;
            }
            [data-nex-live-viewer-footer-composer] ::-moz-selection {
              background: transparent;
              color: inherit;
            }
            @keyframes nex-live-footer-author-ping {
              0%   { transform: scale(1);   opacity: 0.95; }
              70%  { transform: scale(2.1); opacity: 0;    }
              100% { transform: scale(2.1); opacity: 0;    }
            }
            @keyframes nex-live-footer-author-dot {
              0%, 100% { opacity: 1;    }
              50%      { opacity: 0.55; }
            }
            /* Owner directive 2026-10-25 · subtle "alive" idle beat
               on the inline Like heart · small scale-up every 1.3 s
               so the heart looks alive while idle. Respects
               prefers-reduced-motion. */
            @keyframes nex-live-footer-like-idle {
              0%, 100% { transform: translateY(0)      scale(1); }
              40%      { transform: translateY(-1.2px) scale(1.08); }
              70%      { transform: translateY(0)      scale(0.98); }
            }
            @media (prefers-reduced-motion: reduce) {
              [data-nex-live-footer-like-inline-icon] {
                animation: none !important;
              }
            }
          `}</style>
          {hasAuthorIdentity && (
            /* Owner directive 2026-10-25 (revised) · author identity
               bubble inside the composer. SQUARE shape (slightly
               rounded corners) · sized to fit the textarea height
               with a little space top + bottom. Red ping anchors to
               the top-right corner when the author is live. */
            <div
              data-nex-live-footer-author
              data-nex-live-footer-author-live={
                props.authorIsLive === true ? "true" : "false"
              }
              aria-hidden
              style={{
                position: "absolute",
                left: 3,
                top: "50%",
                transform: "translateY(-50%)",
                // Owner directive 2026-10-25 · enlarge the author
                // bubble a little · 26 → 30 so it fills the composer's
                // minHeight cleanly. The borderRadius bumps 5 → 6 to
                // keep the gentle rounded-square silhouette at the new
                // size, and the initial-letter grows 12 → 14 to
                // match.
                width: 30,
                height: 30,
                borderRadius: 6,
                background: "linear-gradient(135deg, #152646 0%, #1E3A6E 100%)",
                color: "#FFFFFF",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                fontWeight: 800,
                letterSpacing: "0.02em",
                border: "1px solid rgba(255,255,255,0.14)",
                boxShadow: "0 0 0 1px rgba(2,9,20,0.6)",
                overflow: "visible",
                zIndex: 1,
                pointerEvents: "none",
              }}
            >
              {props.authorAvatarUrl ? (
                <img
                  src={props.authorAvatarUrl}
                  alt=""
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    borderRadius: 4,
                  }}
                />
              ) : (
                <span>{avatarInitial}</span>
              )}
              {props.authorIsLive === true && (
                <>
                  {/* Static red dot */}
                  <span
                    data-nex-live-footer-author-dot
                    style={{
                      position: "absolute",
                      right: -1,
                      top: -1,
                      width: 7,
                      height: 7,
                      borderRadius: 999,
                      background: RED,
                      boxShadow:
                        "0 0 0 1.5px rgba(2, 9, 20, 0.9), 0 0 6px rgba(255,51,85,0.75)",
                      animation:
                        "nex-live-footer-author-dot 1.2s ease-in-out infinite",
                    }}
                  />
                  {/* Expanding ping ring */}
                  <span
                    data-nex-live-footer-author-ping
                    style={{
                      position: "absolute",
                      right: -1,
                      top: -1,
                      width: 7,
                      height: 7,
                      borderRadius: 999,
                      background: "transparent",
                      border: `1.5px solid ${RED}`,
                      transformOrigin: "center",
                      animation:
                        "nex-live-footer-author-ping 1.6s ease-out infinite",
                    }}
                  />
                </>
              )}
            </div>
          )}
          <NexTextarea
            value={draft}
            onChange={setDraft}
            placeholder={dynamicComposerPlaceholder}
            maxLength={LIVE_COMMENT_MAX_LENGTH}
            data-nex-live-footer-text-input
            data-nex-live-footer-placeholder-rotation={
              hasAuthorIdentity ? (rotateToName ? "name" : "prompt") : "static"
            }
            disabled={props.disabled}
            // Owner directive 2026-10-24 (sealed app-wide rule) ·
            // "any field that required text is active nex kepad".
            // Force the NEX keypad on every viewport · no OS fallback.
            forceKeypadActive={true}
            // Owner directive 2026-10-24 (keypad audit) · the Live
            // composer uses CHAT mode so the keypad's ▶ / ↵ fire the
            // real `handleSend` + close the keypad instead of inserting
            // `\n`. The external paper-plane Send button below still
            // works as a secondary affordance once the keypad is
            // dismissed.
            keypadMode="chat"
            onSend={handleSend}
            style={{
              width: "100%",
              minHeight: 30,
              maxHeight: 64,
              resize: "none",
              background: "rgba(255,255,255,0.08)",
              border: `1px solid ${BORDER}`,
              color: TEXT,
              borderRadius: 10,
              // Owner directive 2026-10-25 (revised) · leave room on
              // the LEFT for the 30px square author bubble + 3px inset
              // + 6px gap = 39px, and leave room on the RIGHT for
              // BOTH the inline Like heart (28px @ right:36) AND the
              // inline Send (28px @ right:4) + 6px gap = 74px.
              padding: hasAuthorIdentity
                ? "6px 74px 6px 42px"
                : "6px 74px 6px 10px",
              fontSize: 13,
              lineHeight: 1.3,
              outline: "none",
              fontFamily: "inherit",
            }}
          />
          {/* Owner directive 2026-10-25 · the Like heart lives inside
              the composer on the right side (previously in the actions
              row above). Idle state: a subtle "alive" pulse. On tap:
              fires the existing spawnFloatingHeart flow (big heart
              rises → shower). The heart sits to the LEFT of the Send
              button; both are absolute inside the composer wrapper. */}
          <button
            type="button"
            onClick={() => {
              props.onLike();
              setLikePulse((p) => p + 1);
              spawnFloatingHeart();
            }}
            disabled={props.disabled}
            data-nex-live-footer-like
            data-nex-live-footer-like-inline="true"
            aria-pressed={props.isLiked ? "true" : "false"}
            aria-label={props.isLiked ? "Unlike this live stream" : "Like this live stream"}
            style={{
              position: "absolute",
              right: 36,
              top: "50%",
              transform: "translateY(-50%)",
              width: 28,
              height: 28,
              background: "transparent",
              color: props.isLiked ? RED : "#FFFFFF",
              fontSize: 18,
              fontWeight: 900,
              borderRadius: 999,
              padding: 0,
              border: "none",
              cursor: props.disabled ? "not-allowed" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
              filter:
                "drop-shadow(0 1px 2px rgba(0,0,0,0.5)) drop-shadow(0 0 4px rgba(0,0,0,0.3))",
            }}
          >
            <span
              key={likePulse}
              data-nex-live-footer-like-inline-icon
              aria-hidden
              style={{
                display: "inline-block",
                // Owner directive 2026-10-25 · chain the idle "alive"
                // beat with the one-shot pulse on tap. The pulse key
                // changes per tap so the animation restarts.
                animation:
                  likePulse > 0
                    ? "nexLikePulse 320ms ease-out, nex-live-footer-like-idle 1.3s ease-in-out 320ms infinite"
                    : "nex-live-footer-like-idle 1.3s ease-in-out infinite",
                transformOrigin: "center",
              }}
            >
              {props.isLiked ? "❤" : "♡"}
            </span>
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={props.disabled || draft.trim().length === 0}
            data-nex-live-footer-send
            aria-label="Send comment"
            style={{
              position: "absolute",
              right: 4,
              top: "50%",
              transform: "translateY(-50%)",
              width: 28,
              height: 28,
              background: draft.trim().length > 0 ? CYAN : "rgba(255,255,255,0.08)",
              color: draft.trim().length > 0 ? "#FFFFFF" : DIM,
              fontSize: 14,
              fontWeight: 900,
              borderRadius: 6,
              padding: 0,
              border: "none",
              cursor:
                props.disabled || draft.trim().length === 0
                  ? "not-allowed"
                  : "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Paper-plane send glyph · square footprint, inline icon */}
            <svg
              aria-hidden
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 20 L21 12 L4 4 L6 12 Z" />
            </svg>
          </button>
        </div>
      )}

      {/* Share bottom-sheet is owned by the viewer parent · it
          overlays the WHOLE viewer surface, not just the footer. */}
    </div>
  );
}

/** Owner spec 2026-10-24 · guest-locked composer. The textarea is
 *  OMITTED (not just disabled) so client-side state manipulation
 *  cannot fake a signed-in send. Tapping routes to the existing
 *  NEX sign-in flow with returnTo preserved. */
function GuestLockedComposer({
  href,
}: {
  readonly href: string;
}): React.JSX.Element {
  return (
    <a
      data-nex-live-footer-guest-lock
      href={href}
      aria-label="Sign in to join the conversation"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        background: "rgba(255,255,255,0.06)",
        border: `1px solid ${BORDER}`,
        borderRadius: 14,
        color: TEXT,
        fontSize: 14,
        fontWeight: 700,
        textDecoration: "none",
        minHeight: 48,
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <span
        aria-hidden
        data-nex-live-footer-guest-lock-icon
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 24,
          height: 24,
          borderRadius: 6,
          background: "rgba(255,255,255,0.08)",
          fontSize: 14,
        }}
      >
        🔒
      </span>
      <span style={{ flex: 1, color: DIM, fontWeight: 600 }}>
        Sign in to join the conversation
      </span>
      <span
        style={{
          fontSize: 12,
          color: CYAN,
          fontWeight: 800,
          letterSpacing: "0.04em",
        }}
      >
        SIGN IN
      </span>
    </a>
  );
}
