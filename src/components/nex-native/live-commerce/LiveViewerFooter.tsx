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
import { LiveFeedPreferencesSection } from "./_live-feed-preferences";

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
  /** Owner directive 2026-10-25 · when provided, the 3-dot slide-out's
   *  Message pill delegates to this callback instead of showing the
   *  development-only alert. The parent is expected to mount a
   *  `<MessagePanel>` and toggle its `open` state in response. */
  readonly onMessagePressed?: () => void;
  /** Owner directive 2026-10-25 · optional 0..100 playback progress
   *  for RECORDED videos. When a number is passed, a scrub bar
   *  renders below the composer row · the white fill represents
   *  REMAINING time (starts full, shrinks away as the video plays)
   *  with a draggable white dot at the current playback head. Omit
   *  for live sessions · a progress bar has no meaning for an
   *  open-ended live stream. */
  readonly videoProgressPercent?: number;
  /** Owner directive 2026-10-25 · scrub callback · fires with the
   *  target percent (0..100) when the viewer drags the white dot.
   *  Parent is expected to seek the underlying video element to
   *  `(percent / 100) * duration` and then update
   *  `videoProgressPercent` from the next `timeupdate` event. */
  readonly onSeek?: (percent: number) => void;
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
  /** Owner directive 2026-10-25 · "the container will also have
   *  button if seller has shop and this button will be called
   *  products". When true the broadcaster-only "Products" pill
   *  renders as a full-width second row inside the 3-dot panel,
   *  the picker overlay + featured-product footer-card slot both
   *  become available. When false/undefined the panel keeps its
   *  4-pill shape and no Products machinery renders. The parent
   *  page is responsible for the broadcaster-identity decision
   *  (dev-mode preview uses the `?preview=broadcaster` query
   *  flag · real-mode wiring is a follow-up slice). */
  readonly isBroadcaster?: boolean;
  /** Owner directive 2026-10-25 · catalog of broadcaster-owned
   *  products shown in the picker overlay. Supplying 0 or
   *  omitting the prop renders an honest empty-state message.
   *  5 is the owner-specified initial scroll depth · more are
   *  reachable by vertical scroll. */
  readonly broadcasterProducts?: ReadonlyArray<FooterFeaturedProduct>;
  /** Owner directive 2026-10-25 · counts rendered under the
   *  Like / Share / Save tiles. Omitting a prop hides the count
   *  entirely. A count of 0 is HIDDEN for viewers (`isBroadcaster`
   *  false/undefined) and SHOWN for broadcasters so they can
   *  track their own metrics starting from zero. Numbers > 999
   *  render as `1.2k` · > 999_999 as `1.3M`. */
  readonly likeCount?: number;
  readonly shareCount?: number;
  readonly saveCount?: number;
}

/** Format a count for display under Like / Share / Save tiles.
 *  Returns `null` when the count should be HIDDEN (zero + not a
 *  broadcaster). Returns the numeric string otherwise with
 *  k / M suffixes for large values. */
function formatCount(n: number | undefined, isBroadcaster: boolean): string | null {
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  const v = Math.max(0, Math.floor(n));
  if (v === 0 && !isBroadcaster) return null;
  if (v < 1000) return String(v);
  if (v < 1_000_000) {
    const k = v / 1000;
    return `${k < 10 ? k.toFixed(1).replace(/\.0$/, "") : Math.floor(k)}k`;
  }
  const m = v / 1_000_000;
  return `${m < 10 ? m.toFixed(1).replace(/\.0$/, "") : Math.floor(m)}M`;
}

/** Owner directive 2026-10-25 · landscape product card featured
 *  in the viewer footer. Image left + name/price right. The card
 *  replaces the main action row (Like/Market/Share) when a
 *  product is picked · the 5-second glow fires on fresh pick ·
 *  press-hold-2s prompts the broadcaster to return it to the
 *  shop. */
export interface FooterFeaturedProduct {
  readonly id: string;
  readonly name: string;
  readonly priceLabel: string;
  readonly imageUrl?: string | null;
  /** Optional short note the broadcaster might type next to the
   *  featured product (not editable in this slice). */
  readonly subtitle?: string | null;
}

const BAR_BG = "rgba(2, 9, 20, 0.78)";
const BORDER = "rgba(255, 255, 255, 0.12)";
const TEXT = "#F2F5F8";
const DIM = "#8BA9D1";
const RED = "#FF3355";
const CYAN = "#00AFFF";

/** Owner directive 2026-10-25 · pill button used inside the 3-dot
 *  slide-out panel. Renders either a `<button>` (default) or an
 *  `<a>` (when `as="a" + href` is passed). Each pill shows a 16-px
 *  white line-art icon on top of a short label underneath. All pills
 *  are the same visual weight so Share/Save/Live/Message read as
 *  siblings. */
interface ExtraActionPillProps {
  readonly label: string;
  readonly icon: React.ReactNode;
  readonly onClick?: () => void;
  readonly href?: string;
  readonly as?: "button" | "a";
  /** Owner directive 2026-10-25 · when true the pill expands to
   *  fill the row (full-width Products button). Default behaviour
   *  is `flex: 1 1 0` sibling-equal · `full` keeps that but also
   *  removes the min-width floor so the pill reads as a bar. */
  readonly full?: boolean;
  /** Owner directive 2026-10-25 · formatted count rendered beneath
   *  the pill label (used by Save in the 3-dot panel). `null` or
   *  omitted hides the count. The caller is responsible for
   *  broadcaster-aware zero handling via `formatCount`. */
  readonly count?: string | null;
  readonly [dataAttr: `data-${string}`]: string | undefined;
}

/** Owner directive 2026-10-25 (revised) · recorded-video scrub bar.
 *  White fill shrinks from full (percent=0) to empty (percent=100)
 *  so the viewer sees how much video is LEFT. A small white dot
 *  sits at the current playback head; dragging it fires `onSeek`
 *  (if provided) with the new percent so the parent can set
 *  `video.currentTime` and the next timeupdate updates `percent`.
 *
 *  Pointer-driven · uses setPointerCapture so the drag follows the
 *  finger/mouse even if it leaves the bar. During a scrub the
 *  component uses a local override so the parent's streaming
 *  percent updates don't fight the drag position. */
function VideoScrubBar(props: {
  readonly percent: number;
  readonly onSeek?: (percent: number) => void;
}): React.JSX.Element {
  const trackRef = React.useRef<HTMLDivElement | null>(null);
  const [scrubbing, setScrubbing] = React.useState<number | null>(null);
  // Ref mirrors state so the pointermove handler (whose closure is
  // captured at mount) sees the live scrubbing flag · a bare state
  // check would see the stale initial null between pointerdown and
  // the next commit.
  const scrubbingRef = React.useRef(false);

  const current = scrubbing ?? props.percent;
  const clamp = (n: number) => Math.max(0, Math.min(100, n));

  const emitAt = (clientX: number): void => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return;
    const pct = clamp(((clientX - rect.left) / rect.width) * 100);
    setScrubbing(pct);
    props.onSeek?.(pct);
  };

  const onPointerDown = (ev: React.PointerEvent<HTMLDivElement>) => {
    if (!props.onSeek) return;
    try {
      ev.currentTarget.setPointerCapture(ev.pointerId);
    } catch {}
    scrubbingRef.current = true;
    emitAt(ev.clientX);
  };
  const onPointerMove = (ev: React.PointerEvent<HTMLDivElement>) => {
    if (!scrubbingRef.current) return;
    emitAt(ev.clientX);
  };
  const onPointerUp = (ev: React.PointerEvent<HTMLDivElement>) => {
    if (!scrubbingRef.current) return;
    try {
      ev.currentTarget.releasePointerCapture(ev.pointerId);
    } catch {}
    scrubbingRef.current = false;
    setScrubbing(null);
  };

  return (
    <div
      data-nex-live-footer-video-progress
      data-nex-live-footer-video-progress-value={Math.round(current)}
      data-nex-live-footer-video-progress-scrubbing={
        scrubbing !== null ? "true" : "false"
      }
      role="slider"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(current)}
      aria-label="Video playback position · drag to seek"
      style={{
        // Owner directive 2026-10-25 · 30 px side insets so the bar
        // never touches the screen edges on narrow phones. Container
        // is 12 px tall so the 10 px thumb has room without the
        // layout jumping.
        position: "relative",
        height: 12,
        margin: "4px 30px 0",
        touchAction: "none",
        cursor: props.onSeek ? "pointer" : "default",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* Track · translucent navy so the white fill reads */}
      <div
        ref={trackRef}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "50%",
          transform: "translateY(-50%)",
          height: 3,
          background: "rgba(255, 255, 255, 0.18)",
          borderRadius: 999,
          pointerEvents: "none",
        }}
      />
      {/* Fill · WHITE · from current% to 100% · shrinks over time */}
      <div
        style={{
          position: "absolute",
          left: `${current}%`,
          right: 0,
          top: "50%",
          transform: "translateY(-50%)",
          height: 3,
          background: "#FFFFFF",
          borderRadius: 999,
          transition: scrubbing === null ? "left 160ms linear" : "none",
          pointerEvents: "none",
        }}
      />
      {/* Thumb · small white ball at the current playback head */}
      <div
        data-nex-live-footer-video-progress-thumb
        style={{
          position: "absolute",
          left: `${current}%`,
          top: "50%",
          width: 10,
          height: 10,
          transform: "translate(-50%, -50%)",
          borderRadius: 999,
          background: "#FFFFFF",
          boxShadow:
            "0 0 0 2px rgba(2, 9, 20, 0.65), 0 1px 3px rgba(0, 0, 0, 0.55)",
          transition: scrubbing === null ? "left 160ms linear" : "none",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

function ExtraActionPill(
  props: ExtraActionPillProps,
): React.JSX.Element {
  const style: React.CSSProperties = {
    background: "rgba(255,255,255,0.09)",
    border: `1px solid ${BORDER}`,
    color: TEXT,
    // Owner directive 2026-10-25 · "4 buttons each row" · the row
    // uses flex and each pill takes an equal share. `minWidth: 0`
    // lets pills shrink on 320 px. `full` keeps the equal share
    // (there's only one sibling) but widens the min-height to
    // read as a bar.
    flex: "1 1 0",
    minWidth: 0,
    minHeight: props.full ? 48 : 44,
    borderRadius: 10,
    padding: props.full ? "6px 10px" : "4px 8px",
    cursor: "pointer",
    display: "inline-flex",
    flexDirection: props.full ? "row" : "column",
    alignItems: "center",
    justifyContent: "center",
    gap: props.full ? 10 : 2,
    textDecoration: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
  };
  const content = (
    <>
      <span aria-hidden style={{ display: "inline-flex" }}>
        {props.icon}
      </span>
      <span
        style={{
          fontSize: props.full ? 13 : 10,
          fontWeight: props.full ? 800 : 700,
          lineHeight: 1.1,
          letterSpacing: props.full ? "0.02em" : "normal",
        }}
      >
        {props.label}
      </span>
      {props.count ? (
        <span
          data-nex-live-footer-extra-pill-count
          style={{
            fontSize: 9,
            fontWeight: 700,
            lineHeight: 1,
            color: "rgba(255,255,255,0.75)",
            marginTop: 1,
          }}
        >
          {props.count}
        </span>
      ) : null}
    </>
  );
  // Dispose of custom aria-less wiring: pull known props out and spread the rest.
  const { label, icon, as, href, onClick, full, count, ...rest } = props;
  void label;
  void icon;
  void full;
  void count;
  if (as === "a" && typeof href === "string") {
    return (
      <a
        href={href}
        onClick={onClick}
        aria-label={props.label}
        style={style}
        {...rest}
      >
        {content}
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={props.label}
      style={style}
      {...rest}
    >
      {content}
    </button>
  );
}

export function LiveViewerFooter(
  props: LiveViewerFooterProps,
): React.JSX.Element {
  const [draft, setDraft] = React.useState("");
  const [likePulse, setLikePulse] = React.useState(0);
  // Owner directive 2026-10-25 · 3-dot ⋮ at the right end of the
  // actions row toggles a horizontal slide-out carrying Share · Save
  // · Live · Message. UI chrome only in this slice; the per-action
  // handlers below are honest stubs pending backend authorisation.
  const [extraActionsOpen, setExtraActionsOpen] = React.useState(false);
  // Owner directive 2026-10-25 · "feed is the button that flips
  // container to show the toggle feed controls". The 3-dot panel
  // flips between two sub-views:
  //   · "buttons" · the default · Share / Save / Live / Message +
  //     Feed + (broadcaster-only) Products pills.
  //   · "feed"    · Live Feed Preferences fills the panel.
  // Opening the panel always starts in "buttons". Closing resets to
  // "buttons" so the next open is predictable.
  const [panelView, setPanelView] = React.useState<"buttons" | "feed">(
    "buttons",
  );
  React.useEffect(() => {
    if (!extraActionsOpen) setPanelView("buttons");
  }, [extraActionsOpen]);
  // Owner directive 2026-10-25 · Products picker + featured card
  // state. The picker opens from the panel's "Products" pill
  // (broadcaster-only). Selecting a card closes the picker and
  // pins the card in the footer slot where the main action row
  // normally sits (sealed design decision: replace, don't stack).
  const [productPickerOpen, setProductPickerOpen] = React.useState(false);
  const [featuredProduct, setFeaturedProduct] =
    React.useState<FooterFeaturedProduct | null>(null);
  // Owner directive 2026-10-25 · "when they select a card it will
  // glowing for 5 seconds until owner pick again". `glowKey`
  // bumps on every fresh pick · the CSS animation re-triggers
  // because the key changes · the glow auto-resolves after 5s.
  const [glowKey, setGlowKey] = React.useState(0);
  React.useEffect(() => {
    if (!featuredProduct) return;
    // 5-second visible glow · subsequent pick-overrides bump
    // glowKey → animation restarts. We do NOT clear the card at
    // 5 s; only the glow stops.
    const id = window.setTimeout(() => {
      // noop · the CSS animation ends naturally after 5s.
    }, 5000);
    return () => window.clearTimeout(id);
  }, [featuredProduct, glowKey]);
  // Press-hold-2s remove confirm · the broadcaster long-presses
  // the featured card for 2 s → a confirm sheet asks whether to
  // return the card to the shop. Release before 2 s cancels.
  const [removeConfirmOpen, setRemoveConfirmOpen] = React.useState(false);
  // Owner directive 2026-10-25 · "any tap outside that container will
  // close it". The toggle button + panel each hold a ref so the
  // document-level pointerdown listener below can discriminate
  // "inside" from "outside" without a visual scrim. We don't absorb
  // the outside tap — the user may be intending to pause/resume the
  // underlying video with the same gesture.
  const extraActionsToggleRef = React.useRef<HTMLButtonElement | null>(null);
  const extraActionsPanelRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (!extraActionsOpen) return;
    // Owner directive 2026-10-25 · "when on toggle page user must
    // select the 3 dots again to close". The outside-tap close is
    // SUPPRESSED while on the Feed sub-view · screen scrolls / tiny
    // body taps never dismiss the preferences list. Only the ⋮
    // toggle button closes the panel. The sibling toggle itself
    // remains the one-tap close affordance.
    if (panelView === "feed") return;
    const handler = (ev: PointerEvent) => {
      const target = ev.target as Node | null;
      if (!target) return;
      const panel = extraActionsPanelRef.current;
      const toggle = extraActionsToggleRef.current;
      if (panel && panel.contains(target)) return;
      if (toggle && toggle.contains(target)) return;
      setExtraActionsOpen(false);
    };
    document.addEventListener("pointerdown", handler, true);
    return () => {
      document.removeEventListener("pointerdown", handler, true);
    };
  }, [extraActionsOpen, panelView]);

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
        // Owner directive 2026-10-25 · "the feed post from users
        // must sit behind container open". The 3-dot panel inside
        // this footer has zIndex 20, but that's SCOPED inside this
        // footer root's own stacking context. VideoCommentsOverlay
        // ran at the same root zIndex (2) and was later in DOM, so
        // comments painted over the panel. Raise the footer root
        // to 25 so it decisively beats the overlay in the shared
        // root context · scoped zIndex: 20 on the panel stays
        // intact, and the composer / action row still render
        // above the overlay as well (consistent with "footer sits
        // above live chat").
        zIndex: 25,
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
      {/* Owner directive 2026-10-25 · "when they select a card it
          will open in the footer area card position" · the featured
          product card REPLACES the main action row (Like/Market/
          Share) while active. The 3-dot container still mounts
          because the broadcaster must still reach Products to
          swap cards. */}
      {featuredProduct ? (
        <FooterFeaturedCard
          product={featuredProduct}
          glowKey={glowKey}
          onLongPressRemove={() => setRemoveConfirmOpen(true)}
        />
      ) : (
      <div
        data-nex-live-viewer-footer-actions
        style={{
          // Owner directive 2026-10-25 · 3-dot ⋮ sits at the far right
          // of the actions row and slides out Share · Save · Live ·
          // Message to its LEFT when tapped. We keep the row as a flex
          // container so the slide-out can be an absolute child that
          // overlays the actions when open.
          position: "relative",
          display: "grid",
          // Owner directive 2026-10-25 (revised again) · Like heart
          // moved OUT of the action row back to the composer-row right
          // side (bigger · with count beneath). Action row returns to
          // its original shape:
          //   with goLive: Live  Market  Share  ⋮
          //   no goLive:         Market  Share  ⋮
          gridTemplateColumns: showGoLive
            ? "1fr 1.6fr 1fr auto"
            : "2fr 1fr auto",
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
          {formatCount(props.shareCount, props.isBroadcaster === true) !== null && (
            <span
              data-nex-live-footer-share-count
              style={{ fontSize: 10, fontWeight: 700, color: DIM, lineHeight: 1.1 }}
            >
              {formatCount(props.shareCount, props.isBroadcaster === true)}
            </span>
          )}
        </button>

        {/* Owner directive 2026-10-25 · 3-dot vertical menu to the
            RIGHT of Share. Tapping toggles a horizontal slide-out
            carrying four extra actions (Share · Save · Live ·
            Message) that emerges leftward from the ⋮ position.
            Chrome-only in this slice · the per-action handlers are
            honest stubs pending backend authorisation. */}
        <button
          type="button"
          ref={extraActionsToggleRef}
          data-nex-live-footer-more
          data-nex-live-footer-more-open={extraActionsOpen ? "true" : "false"}
          aria-label={extraActionsOpen ? "Close extra actions" : "Open extra actions"}
          aria-expanded={extraActionsOpen ? "true" : "false"}
          onClick={() => setExtraActionsOpen((v) => !v)}
          style={{
            // Owner directive 2026-10-25 (revised) · 3-dot moves to
            // the right screen edge · background chip removed · icon
            // doubled from 18 → 32. The button sits in a wider
            // auto-sized column with a negative right margin that
            // reclaims 6 px of the row's padding so the dots sit
            // visually closer to the viewport edge.
            background: "transparent",
            border: "none",
            color: TEXT,
            width: 44,
            minHeight: 48,
            borderRadius: 999,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            marginRight: -6,
            fontSize: 20,
            lineHeight: 1,
            opacity: extraActionsOpen ? 0.85 : 1,
            transition: "opacity 160ms ease-out, transform 180ms ease-out",
            transform: extraActionsOpen ? "rotate(90deg)" : "rotate(0deg)",
            filter:
              "drop-shadow(0 1px 2px rgba(0,0,0,0.55)) drop-shadow(0 0 3px rgba(0,0,0,0.35))",
          }}
        >
          <svg
            aria-hidden
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="5" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="12" cy="19" r="1.5" />
          </svg>
        </button>

        {/* Owner directive 2026-10-25 · slide-out extra-actions panel.
            Absolutely positioned over the actions row, right-anchored
            at the ⋮ button (right: 56px inside the padded row). When
            open, it slides in from the right (translateX 0 → right)
            and reveals the four pill buttons. When closed, it slides
            out to the right and `pointer-events: none` so the
            underlying Live/Market/Share remain tappable. */}
        <div
          ref={extraActionsPanelRef}
          data-nex-live-footer-extra-actions
          data-nex-live-footer-extra-actions-open={extraActionsOpen ? "true" : "false"}
          aria-hidden={!extraActionsOpen}
          style={{
            // Owner directive 2026-10-25 · "the 3 dots container
            // must start just above the 3 dots and center to the
            // page width with 4 buttons each row". The panel now
            // anchors to the TOP of the actions row (bottom: 100%)
            // and spans the row's full width (left: 8 right: 8 to
            // echo the row's 8 px inset). It grows upward with the
            // button grid height. Palette = CategoryGridSheet tile.
            position: "absolute",
            bottom: "100%",
            left: 8,
            right: 8,
            marginBottom: 8,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            padding: "10px",
            // Owner directive 2026-10-25 (reinforced) · "comments
            // cards are running on the 3 dots container". Panel now
            // uses FULLY opaque navy (alpha 1.0) so chat bubbles can
            // never show through. Panel zIndex 20 still beats the
            // VideoCommentsOverlay (zIndex 2). Backdrop blur is kept
            // but has no visible effect at full opacity · it stays as
            // a safety net if a child ever becomes translucent.
            background: extraActionsOpen
              ? "linear-gradient(135deg, rgb(21, 38, 70) 0%, rgb(10, 15, 30) 100%)"
              : "transparent",
            backdropFilter: extraActionsOpen ? "blur(18px) saturate(140%)" : undefined,
            WebkitBackdropFilter: extraActionsOpen ? "blur(18px) saturate(140%)" : undefined,
            border: extraActionsOpen ? "2px solid rgba(0, 175, 255, 0.9)" : "none",
            boxShadow: extraActionsOpen
              ? "inset 0 0 0 1px rgba(0, 175, 255, 0.5), 0 0 14px -4px rgba(0, 175, 255, 0.6), 0 4px 10px -6px rgba(0, 20, 50, 0.45)"
              : "none",
            borderRadius: 16,
            transformOrigin: "bottom center",
            transition:
              "transform 240ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease-out",
            transform: extraActionsOpen
              ? "scaleY(1) translateY(0)"
              : "scaleY(0.6) translateY(10px)",
            opacity: extraActionsOpen ? 1 : 0,
            pointerEvents: extraActionsOpen ? "auto" : "none",
            zIndex: 20,
            // Owner directive 2026-10-25 (revised) · "the 3 dots
            // container must not enlarge but the inner can scrolling
            // when need to see the other toggles". The panel itself
            // no longer scrolls · it sizes to its content (buttons +
            // optional Feed section). The preferences section inside
            // caps its own height and scrolls internally, so opening
            // the Feed accordion does not make the container visually
            // taller than its baseline.
            // Owner directive 2026-10-25 · "control the container that
            // I can select text from any place without all text being
            // selected". Explicitly ENABLE native text selection on
            // the panel so viewers can copy a toggle label or an
            // explainer line normally; the browser handles word/
            // range selection on its own. Interactive controls still
            // get their native hit-target behaviour. Overrides any
            // inherited `user-select: none` from the composer side.
            userSelect: "text",
            WebkitUserSelect: "text",
          }}
        >
          {/* Owner directive 2026-10-25 (revised) · "why is the text
              feed covering all buttons" · buttons must stay visible
              when Feed opens. The container is now an accordion: the
              5 primary pills (+ broadcaster Products row) always
              render; the Feed pill toggles whether the Live Feed
              Preferences section is appended BELOW the buttons. The
              outside-tap close remains suppressed while the Feed
              section is expanded · only the ⋮ toggle closes. */}
          <>
          <div
            data-nex-live-footer-extra-actions-row
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "stretch",
              gap: 6,
            }}
          >
          {/* Share · reuses the existing Share pipeline when wired.
              Honest stub for now · alerts the viewer the share-sheet
              with social destinations is pending authorisation. */}
          <ExtraActionPill
            label="Share"
            data-nex-live-footer-extra-share="true"
            onClick={() => {
              setExtraActionsOpen(false);
              openShareSheet();
            }}
            icon={
              <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
              </svg>
            }
          />
          {/* Save · honest stub · the owner must define the Save
              target (bookmark · collection · server record) before
              this does anything persistent. */}
          <ExtraActionPill
            label="Save"
            data-nex-live-footer-extra-save="true"
            count={formatCount(props.saveCount, props.isBroadcaster === true)}
            onClick={() => {
              setExtraActionsOpen(false);
              if (typeof window !== "undefined") {
                window.alert(
                  "Save · UI only · owner must define Save behaviour (bookmark / collection / server record) before wiring.",
                );
              }
            }}
            icon={
              <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            }
          />
          {/* Live · owner directive 2026-10-25 "the live button
              activates the same page we designed for live that they
              accept". Routes to the welcome/guidelines surface. */}
          <ExtraActionPill
            label="Live"
            data-nex-live-footer-extra-live="true"
            as="a"
            href="/nex-native/live-commerce/welcome"
            onClick={() => setExtraActionsOpen(false)}
            icon={
              <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3.4" fill="currentColor" />
                <circle cx="12" cy="12" r="7" />
                <circle cx="12" cy="12" r="10.5" />
              </svg>
            }
          />
          {/* Message · owner directive 2026-10-25 (Phase B) · opens
              the MessagePanel which reuses the EXISTING
              `createFriendRequestAction` from the Contacts page.
              Delegation via `onMessagePressed` prop · the parent
              viewer mounts the panel. When the parent does not pass
              the prop (e.g. the recorded-video viewer with no public
              broadcaster handle) the pill falls back to an honest
              development-only alert. */}
          <ExtraActionPill
            label="Message"
            data-nex-live-footer-extra-message="true"
            onClick={() => {
              setExtraActionsOpen(false);
              if (props.onMessagePressed) {
                props.onMessagePressed();
                return;
              }
              if (typeof window !== "undefined") {
                window.alert(
                  "Message · this viewer surface does not yet wire the Message panel · the parent must pass onMessagePressed.",
                );
              }
            }}
            icon={
              <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 5h16v10H8l-4 4z" />
              </svg>
            }
          />
          {/* Feed · owner directive 2026-10-25 · flips the container
              to show the Live Feed Preferences toggles. Does NOT
              close the panel · the outside-tap close is also disabled
              while on the Feed sub-view so screen movement never
              dismisses the toggles. The ⋮ toggle button is the ONLY
              way to close while on Feed. */}
          <ExtraActionPill
            label="Feed"
            data-nex-live-footer-extra-feed="true"
            onClick={() =>
              setPanelView((v) => (v === "feed" ? "buttons" : "feed"))
            }
            icon={
              <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="7" x2="21" y2="7" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="17" x2="21" y2="17" />
                <circle cx="6" cy="7" r="1.1" fill="currentColor" />
                <circle cx="6" cy="12" r="1.1" fill="currentColor" />
                <circle cx="6" cy="17" r="1.1" fill="currentColor" />
              </svg>
            }
          />
          </div>
          {/* Owner directive 2026-10-25 · "the container will also
              have button if seller has shop and this button will be
              called products". Broadcaster-only second row · full-
              width Products pill with the standard 4-pill palette
              but stretched edge-to-edge so it reads as the primary
              broadcaster action. */}
          {props.isBroadcaster && (
            <div
              data-nex-live-footer-extra-actions-row
              data-nex-live-footer-extra-actions-row-broadcaster="true"
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "stretch",
                gap: 6,
              }}
            >
              <ExtraActionPill
                label="Products"
                data-nex-live-footer-extra-products="true"
                full
                onClick={() => {
                  setExtraActionsOpen(false);
                  setProductPickerOpen(true);
                }}
                icon={
                  <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 7h18l-1.5 11a2 2 0 0 1-2 1.75H6.5a2 2 0 0 1-2-1.75L3 7z" />
                    <path d="M8 7V5a4 4 0 0 1 8 0v2" />
                  </svg>
                }
              />
            </div>
          )}
          </>
          {/* Owner directive 2026-10-25 (revised) · "remove the back
              and to close from container · header · Live Feed". When
              the Feed pill is pressed the preferences section appends
              below the buttons · the header is a plain "Live Feed"
              title. No Back button · no close hint. The ⋮ toggle
              still closes everything; tapping Feed again collapses the
              preferences without closing the panel. */}
          {panelView === "feed" && (
            <div
              data-nex-live-footer-extra-feed-view
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                marginTop: 2,
              }}
            >
              <div
                data-nex-live-footer-extra-feed-view-header
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: TEXT,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  padding: "4px 2px 0",
                }}
              >
                Live Feed
              </div>
              <LiveFeedPreferencesSection />
            </div>
          )}
        </div>
      </div>
      )}
      {/* Owner directive 2026-10-25 · product-picker overlay ·
          mounted only when the broadcaster taps "Products" in the
          3-dot panel. Opens a card list below the viewer header,
          scrollable, tap-outside closes without picking. */}
      {props.isBroadcaster && productPickerOpen && (
        <ProductPickerOverlay
          products={props.broadcasterProducts ?? []}
          onClose={() => setProductPickerOpen(false)}
          onPick={(p) => {
            setFeaturedProduct(p);
            setGlowKey((k) => k + 1);
            setProductPickerOpen(false);
          }}
        />
      )}
      {/* Owner directive 2026-10-25 · remove-confirm sheet ·
          "pop up window will ask owner do they want to return
          card back to shop". Fires from the FooterFeaturedCard's
          2-second press-hold. */}
      {removeConfirmOpen && featuredProduct && (
        <RemoveFeaturedConfirm
          product={featuredProduct}
          onCancel={() => setRemoveConfirmOpen(false)}
          onConfirm={() => {
            setFeaturedProduct(null);
            setRemoveConfirmOpen(false);
          }}
        />
      )}

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
          data-nex-live-viewer-footer-composer-row
          style={{
            // Owner directive 2026-10-25 (revised) · Row 2 is a flex
            // container so the Like heart can sit OUTSIDE the composer
            // text field on its right side (owner "heart icon must be
            // outside the text field container on the right side").
            // The composer itself still fits the screen width with a
            // small inset · the heart takes a fixed width to its right.
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            margin: "0 8px",
          }}
        >
        <div
          data-nex-live-viewer-footer-composer
          style={{
            // Owner directive 2026-10-24 · "send button square inside
            // the field text". Composer becomes a position-relative
            // wrapper so the Send button can anchor at the right
            // edge of the text field instead of sitting beside it.
            position: "relative",
            // Owner directive 2026-10-25 (revised) · the composer is
            // the FLEX ITEM that stretches to fill the remaining width
            // · the heart (sibling after this div) is a fixed 40 px
            // button + 6 px gap. `min-width: 0` is critical · without
            // it the textarea's intrinsic width wins and the row
            // overflows the viewport on narrow phones (the overflow
            // bug the owner reported this slice).
            flex: "1 1 auto",
            minWidth: 0,
            display: "block",
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
                // Owner directive 2026-10-25 (revised again) · the
                // author bubble enlarges by +3 px · 30 → 33 so it
                // reads as more prominent beside the enlarged inline
                // initial. borderRadius 6 → 7 keeps the gentle
                // rounded-square silhouette and fontSize 14 → 15
                // matches the bigger box.
                width: 33,
                height: 33,
                borderRadius: 7,
                background: "linear-gradient(135deg, #152646 0%, #1E3A6E 100%)",
                color: "#FFFFFF",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 15,
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
              // Owner directive 2026-10-25 (revised again) · leave
              // room on the LEFT for the enlarged 33 px author bubble
              // + 3 px inset + 6 px gap = 42, rounded to 45. The
              // RIGHT side only needs room for the inline Send button
              // (28 + 4 + a 6 gap = 38, rounded to 40) because the
              // Like heart moved OUTSIDE the composer on 2026-10-25.
              padding: hasAuthorIdentity
                ? "6px 40px 6px 45px"
                : "6px 40px 6px 10px",
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
              rises → shower). Owner directive 2026-10-25 (revised
              again) · the heart moved OUTSIDE the composer wrapper
              and now sits as a flex sibling in the composer row ·
              see the <button data-nex-live-footer-like …> block
              rendered AFTER the composer </div>. */}
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
        {/* Owner directive 2026-10-25 (revised again) · "move heart
            back to the footer right side · enlarge 1x the heart".
            Flex sibling of the composer wrapper · occupies a fixed
            column on the composer row's right edge · bigger button
            (48×48) + bigger glyph (34 px) + count label beneath.
            The spawnFloatingHeart cinematic cascade still fires from
            here · idle beat animation preserved. Count follows the
            same broadcaster-aware hide-at-zero rule as before. */}
        <div
          data-nex-live-footer-like-column
          style={{
            flex: "0 0 auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
          }}
        >
          <button
            type="button"
            onClick={() => {
              // Owner directive 2026-10-25 · "user can only like a
              // video one time". Already-liked taps are a no-op · no
              // floating-heart cascade, no counter wobble, no second
              // onLike callback. The parent viewer's handleLike is
              // also one-way (prev ? prev : true) · belt-and-braces.
              if (props.isLiked) return;
              props.onLike();
              setLikePulse((p) => p + 1);
              spawnFloatingHeart();
            }}
            disabled={props.disabled}
            data-nex-live-footer-like
            data-nex-live-footer-like-inline="true"
            data-nex-live-footer-like-locked={props.isLiked ? "true" : "false"}
            aria-pressed={props.isLiked ? "true" : "false"}
            aria-disabled={props.isLiked ? "true" : "false"}
            aria-label={props.isLiked ? "You liked this live stream" : "Like this live stream"}
            style={{
              width: 48,
              height: 48,
              background: "transparent",
              color: props.isLiked ? RED : "#FFFFFF",
              fontSize: 34,
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
              fontFamily: "inherit",
            }}
          >
            <span
              key={likePulse}
              data-nex-live-footer-like-inline-icon
              aria-hidden
              style={{
                display: "inline-block",
                transformOrigin: "center",
                animation:
                  likePulse > 0
                    ? "nexLikePulse 320ms ease-out, nex-live-footer-like-idle 1.3s ease-in-out 320ms infinite"
                    : "nex-live-footer-like-idle 1.3s ease-in-out infinite",
              }}
            >
              {props.isLiked ? "❤" : "♡"}
            </span>
          </button>
          {(() => {
            // Owner directive 2026-10-25 · "when pressed it will
            // increase by 1". Optimistic local +1 while isLiked ·
            // the server-provided baseline stays in props.likeCount
            // and the viewer-side flag drives the single-shot bump.
            const baseline = typeof props.likeCount === "number" ? props.likeCount : 0;
            const displayed = baseline + (props.isLiked ? 1 : 0);
            const label = formatCount(displayed, props.isBroadcaster === true);
            if (label === null) return null;
            return (
              <span
                data-nex-live-footer-like-count
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: TEXT,
                  lineHeight: 1.1,
                  textShadow: "0 1px 2px rgba(0,0,0,0.55)",
                }}
              >
                {label}
              </span>
            );
          })()}
        </div>
        </div>
      )}

      {/* Owner directive 2026-10-25 (revised) · scrub bar under
          the composer. White fill = REMAINING time (starts full,
          shrinks away as the video plays). White dot at the current
          playback head · drag it left/right to seek back/forward.
          Only renders for recorded videos (parent passes
          `videoProgressPercent` 0..100). Live streams omit the prop
          and get no bar. */}
      {typeof props.videoProgressPercent === "number" && (
        <VideoScrubBar
          percent={Math.max(0, Math.min(100, props.videoProgressPercent))}
          onSeek={props.onSeek}
        />
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

/* ------------------------------------------------------------------
 * Owner directive 2026-10-25 · footer landscape product-card slot
 * + product-picker overlay + remove-confirm sheet.
 * ------------------------------------------------------------------
 * `FooterFeaturedCard` renders the LANDSCAPE card that replaces the
 * main action row when the broadcaster picks a product. Image left
 * (square · rounded corners · inset from card rim), name/price on
 * the right. Fires `onLongPressRemove` after a 2-second continuous
 * press · release before 2 s cancels.
 * ------------------------------------------------------------------ */
function FooterFeaturedCard(props: {
  readonly product: FooterFeaturedProduct;
  readonly glowKey: number;
  readonly onLongPressRemove: () => void;
}): React.JSX.Element {
  const timerRef = React.useRef<number | null>(null);
  const [pressing, setPressing] = React.useState(false);
  const startPress = (): void => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    setPressing(true);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      setPressing(false);
      props.onLongPressRemove();
    }, 2000);
  };
  const cancelPress = (): void => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setPressing(false);
  };
  React.useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);
  return (
    <div
      data-nex-live-footer-featured-card
      data-nex-live-footer-featured-card-product-id={props.product.id}
      data-nex-live-footer-featured-card-pressing={pressing ? "true" : "false"}
      key={`featured-${props.glowKey}`}
      onPointerDown={startPress}
      onPointerUp={cancelPress}
      onPointerCancel={cancelPress}
      onPointerLeave={cancelPress}
      style={{
        margin: "0 12px",
        minHeight: 60,
        borderRadius: 14,
        background: "rgba(2, 9, 20, 0.78)",
        border: `1px solid ${BORDER}`,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        padding: 6,
        position: "relative",
        touchAction: "manipulation",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTapHighlightColor: "transparent",
        // 5-second glow · keyed to glowKey so a fresh pick re-triggers.
        animation: "nex-live-featured-glow 5000ms ease-out 1",
      }}
    >
      <style>{`
        @keyframes nex-live-featured-glow {
          0%   { box-shadow: 0 0 0 0 rgba(0, 175, 255, 0.0), 0 0 0 0 rgba(0, 175, 255, 0.0); border-color: ${BORDER}; }
          8%   { box-shadow: 0 0 18px 2px rgba(0, 175, 255, 0.75), 0 0 32px 4px rgba(0, 175, 255, 0.35); border-color: rgba(0, 175, 255, 0.9); }
          100% { box-shadow: 0 0 0 0 rgba(0, 175, 255, 0.0), 0 0 0 0 rgba(0, 175, 255, 0.0); border-color: ${BORDER}; }
        }
        /* Press-hold progress ring · a thin cyan border that grows
           over 2 s so the broadcaster sees the remove timer. */
        [data-nex-live-footer-featured-card-pressing="true"] {
          outline: 2px solid rgba(255, 51, 85, 0.75) !important;
          outline-offset: -1px;
        }
        @media (prefers-reduced-motion: reduce) {
          [data-nex-live-footer-featured-card] { animation: none !important; }
        }
      `}</style>
      <div
        data-nex-live-footer-featured-image
        style={{
          width: 48,
          height: 48,
          borderRadius: 10,
          flexShrink: 0,
          overflow: "hidden",
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.08)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: DIM,
          fontSize: 10,
          fontWeight: 700,
        }}
      >
        {props.product.imageUrl ? (
          <img
            src={props.product.imageUrl}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <span aria-hidden>IMG</span>
        )}
      </div>
      <div style={{ flex: "1 1 auto", minWidth: 0 }}>
        <div
          data-nex-live-footer-featured-name
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: TEXT,
            lineHeight: 1.2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {props.product.name}
        </div>
        <div
          data-nex-live-footer-featured-price
          style={{
            marginTop: 2,
            fontSize: 12,
            fontWeight: 600,
            color: CYAN,
            lineHeight: 1.2,
          }}
        >
          {props.product.priceLabel}
        </div>
      </div>
    </div>
  );
}

/** Owner directive 2026-10-25 · product-picker overlay. Opens when
 *  the broadcaster taps the Products pill. Fills the viewer area
 *  from under the header down to just above the footer with a
 *  vertical scroll list of product cards. Tap outside the panel
 *  (on the scrim) closes without picking. */
function ProductPickerOverlay(props: {
  readonly products: ReadonlyArray<FooterFeaturedProduct>;
  readonly onClose: () => void;
  readonly onPick: (p: FooterFeaturedProduct) => void;
}): React.JSX.Element {
  return (
    <>
      <button
        type="button"
        aria-label="Close product picker"
        data-nex-live-footer-product-picker-scrim
        onClick={props.onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.55)",
          border: "none",
          padding: 0,
          cursor: "pointer",
          zIndex: 20,
        }}
      />
      <div
        data-nex-live-footer-product-picker
        role="dialog"
        aria-label="Choose a product for Live"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          top: 80,
          bottom: 160,
          left: 16,
          right: 16,
          zIndex: 21,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: 12,
          borderRadius: 16,
          background: "rgba(14, 21, 38, 0.95)",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 8px 24px -8px rgba(0,0,0,0.6)",
          fontFamily: "inherit",
          boxSizing: "border-box",
        }}
      >
        <div
          data-nex-live-footer-product-picker-title
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: TEXT,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            textAlign: "center",
            marginBottom: 2,
          }}
        >
          Products
        </div>
        {props.products.length === 0 ? (
          <div
            data-nex-live-footer-product-picker-empty
            style={{
              flex: "1 1 auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: DIM,
              fontSize: 13,
              textAlign: "center",
              padding: "0 10px",
            }}
          >
            No products available yet.
          </div>
        ) : (
          <div
            data-nex-live-footer-product-picker-list
            style={{
              flex: "1 1 auto",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              paddingRight: 2,
            }}
          >
            {props.products.map((p) => (
              <button
                type="button"
                key={p.id}
                data-nex-live-footer-product-picker-card
                data-nex-live-footer-product-picker-card-id={p.id}
                onClick={() => props.onPick(p)}
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  padding: 8,
                  minHeight: 72,
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: TEXT,
                  textAlign: "left",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
              >
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 10,
                    flexShrink: 0,
                    overflow: "hidden",
                    background: "rgba(255,255,255,0.06)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: DIM,
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                >
                  {p.imageUrl ? (
                    <img
                      src={p.imageUrl}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <span aria-hidden>IMG</span>
                  )}
                </div>
                <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: TEXT,
                      lineHeight: 1.2,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {p.name}
                  </div>
                  <div
                    style={{
                      marginTop: 2,
                      fontSize: 12,
                      fontWeight: 600,
                      color: CYAN,
                      lineHeight: 1.2,
                    }}
                  >
                    {p.priceLabel}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/** Owner directive 2026-10-25 · "pop up window will ask owner do
 *  they want to return card back to shop". Simple confirm sheet
 *  with Cancel + Return buttons. Tap scrim = cancel. */
function RemoveFeaturedConfirm(props: {
  readonly product: FooterFeaturedProduct;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}): React.JSX.Element {
  return (
    <>
      <button
        type="button"
        aria-label="Keep product in Live"
        data-nex-live-footer-remove-scrim
        onClick={props.onCancel}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.55)",
          border: "none",
          padding: 0,
          cursor: "pointer",
          zIndex: 30,
        }}
      />
      <div
        role="dialog"
        aria-label="Return product to shop?"
        data-nex-live-footer-remove-confirm
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 31,
          width: "min(320px, calc(100vw - 32px))",
          padding: 16,
          borderRadius: 14,
          background: "rgba(14, 21, 38, 0.98)",
          border: "1px solid rgba(255,255,255,0.14)",
          boxShadow: "0 12px 32px -10px rgba(0,0,0,0.75)",
          fontFamily: "inherit",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            fontSize: 15,
            fontWeight: 800,
            color: TEXT,
            marginBottom: 6,
            textAlign: "center",
          }}
        >
          Return to shop?
        </div>
        <div
          style={{
            fontSize: 13,
            color: DIM,
            marginBottom: 14,
            textAlign: "center",
            lineHeight: 1.3,
          }}
        >
          Remove &ldquo;{props.product.name}&rdquo; from your Live.
          The product stays in your shop.
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            gap: 8,
          }}
        >
          <button
            type="button"
            data-nex-live-footer-remove-cancel
            onClick={props.onCancel}
            style={{
              flex: "1 1 0",
              minHeight: 44,
              borderRadius: 10,
              background: "rgba(255,255,255,0.08)",
              border: `1px solid ${BORDER}`,
              color: TEXT,
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              fontFamily: "inherit",
              boxSizing: "border-box",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            data-nex-live-footer-remove-confirm-ok
            onClick={props.onConfirm}
            style={{
              flex: "1 1 0",
              minHeight: 44,
              borderRadius: 10,
              background: RED,
              border: `1px solid ${RED}`,
              color: "#FFFFFF",
              fontWeight: 800,
              fontSize: 14,
              cursor: "pointer",
              fontFamily: "inherit",
              boxSizing: "border-box",
            }}
          >
            Return
          </button>
        </div>
      </div>
    </>
  );
}
