"use client";

// src/components/nex-native/music/MusicActionsStack.tsx
//
// Owner-authorised 2026-10-29 · a floating 4-icon action stack that
// sits over the music player on the Live/preview surface:
//   · Like   · wired to toggleMusicTrackLikeAction, persisted,
//              triggers the heart-rain burst for the liker
//   · Save   · UI shell · client-only state until a nex_music_track_save
//              table is authorised. Count renders as 0 until the backing
//              aggregate exists.
//   · Share  · wired to recordMusicTrackShareAction, persisted count
//   · Follow · UI shell · client-only state until an account-follow
//              table is authorised. No numeric count displayed.
//
// Heart-rain animation (per owner directive):
//   phase 1 · tap · heart turns dark red + scale pulse
//   phase 2 · big heart flies up to the header anchor
//   phase 3 · at apex, big heart explodes into 7 smaller hearts
//   phase 4 · small hearts fall down the page with random drift
//   phase 5 · each falling heart emits tiny trailing hearts upward
//
// Only the user who tapped like sees the burst. The animation lives
// in the DOM via position:fixed children of a transient batch; each
// batch self-unmounts after its animation completes.

import * as React from "react";
import { createPortal } from "react-dom";
import type { NexMusicTrackRow } from "@/lib/nex-native/music/types";
import {
  followAction,
  unfollowAction,
} from "@/lib/nex-native/follow/follow-actions";
import type { NexFollowErrorCode } from "@/lib/nex-native/follow/types";

const RED_DARK = "#8B0000";
// Owner-authorised 2026-10-29 · burst red tuned darker (previous
// `#FF3355` read as pink). Rich crimson · still visible against the
// dark music backdrop + dim overlay thanks to the drop-shadow glow.
const RED_BRIGHT = "#C8102E";
const INK = "#F0F6FF";
const INK_DIM = "rgba(240, 246, 255, 0.72)";
// Owner-authorised 2026-10-29 · all icons default to solid pure
// white · state transitions (liked, saved, followed) overlay their
// own colour on top. No button chrome.
const SOLID_WHITE = "#FFFFFF";

export interface MusicActionsStackProps {
  readonly track: NexMusicTrackRow;
  readonly initiallyLiked: boolean;
  readonly likeCount: number;
  readonly shareCount: number;
  readonly onLikeToggle: () => Promise<{ liked: boolean; likeCount: number } | null>;
  readonly onShare: () => Promise<{ shareCount: number } | null>;
  /** Optional callback. Save state currently client-only · no backend. */
  readonly onSave?: () => void;
  /** Optional callback. Follow state currently client-only · no backend. */
  readonly onFollow?: () => void;
  /** Owner-authorised 2026-10-30 · Stage 1 Follow wiring. When
   *  `followeeId` is provided the stack calls the real server
   *  actions (followAction / unfollowAction) on the person-plus
   *  icon · optimistic UI with rollback on error. When omitted, the
   *  legacy session-only toggle is used (session-only state carries
   *  no backend). `initialFollowed` seeds the first render so the
   *  follow icon matches server truth. */
  readonly followeeId?: string | null;
  readonly initialFollowed?: boolean;
  /** Owner-authorised 2026-10-30 · Stage 2 Follow surface · initial
   *  follower count for the person-plus icon's CountLabel. Server-
   *  resolved via `readFollowCounts(ownerAccountId)` on SSR, then
   *  optimistically incremented/decremented on follow/unfollow with
   *  the sealed GREATEST(x-1, 0) floor to match trigger behaviour.
   *  Omitted → no CountLabel renders (legacy call sites unaffected). */
  readonly initialFollowerCount?: number;
  /** Owner-authorised 2026-10-30 · Stage 2 feedback hook · fires
   *  when the server rejects a follow/unfollow (rate-limit · blocked
   *  · internal-error · etc.). Parity with FollowButton.onReject.
   *  Omit to accept the sealed silent-rollback default. */
  readonly onFollowReject?: (reason: NexFollowErrorCode, message: string) => void;
  /** Owner-authorised 2026-10-30 · message icon · when provided the
   *  stack renders a 5th button between Share and Follow. Tapping
   *  opens the caller-mounted MessagePanel (same sealed connection-
   *  invitation flow the Live viewer uses). Omit on surfaces where
   *  "message yourself" would be nonsensical (e.g. the preview page
   *  which is always the owner's self-view). */
  readonly onMessage?: () => void;
  /** Owner-authorised 2026-10-30 · when `true` the stack renders
   *  ONLY the Share icon (Like/Save/Follow are suppressed as semantic
   *  no-ops on the owner's own post). The inbox 💬 trigger is
   *  mounted separately by the caller above this stack. Default
   *  `false` keeps the full non-owner rail. */
  readonly isOwnerView?: boolean;
  /** Owner-authorised 2026-10-30 · when provided (owner-view only)
   *  the stack renders a pencil Edit icon above Share. Tapping it
   *  fires this handler · the caller is responsible for routing to
   *  the sealed edit surface (`/nex-native/create/upload-music/
   *  preview/<trackId>?edit=1`). Omit on non-owner surfaces. */
  readonly onEdit?: () => void;
}

export function MusicActionsStack(
  props: MusicActionsStackProps,
): React.JSX.Element {
  const [liked, setLiked] = React.useState(props.initiallyLiked);
  const [likeCount, setLikeCount] = React.useState(props.likeCount);
  const [shareCount, setShareCount] = React.useState(props.shareCount);
  // Owner-authorised 2026-10-29 · save + follow carry no backend yet;
  // these states are session-only and do NOT persist across reloads.
  const [saved, setSaved] = React.useState(false);
  const [followed, setFollowed] = React.useState(props.initialFollowed === true);
  const [followerCount, setFollowerCount] = React.useState<number | null>(
    typeof props.initialFollowerCount === "number"
      ? props.initialFollowerCount
      : null,
  );
  // Burst batches · each like tap pushes a new entry; the burst
  // component self-unmounts via setTimeout after its animation ends.
  const [bursts, setBursts] = React.useState<readonly number[]>([]);
  const nextBurstIdRef = React.useRef(0);

  const heartBtnRef = React.useRef<HTMLButtonElement | null>(null);

  const handleLike = async () => {
    const prevLiked = liked;
    // Optimistic toggle + burst only when going UNLIKED → LIKED.
    if (!prevLiked) {
      setLiked(true);
      setLikeCount((c) => c + 1);
      // Owner-authorised 2026-10-29 · recapture origin at the moment
      // of the tap so the burst emerges from the cover's current
      // position (handles scroll / layout shifts since last render).
      captureBurstOrigin();
      spawnBurst();
    } else {
      setLiked(false);
      setLikeCount((c) => Math.max(0, c - 1));
    }
    try {
      const res = await props.onLikeToggle();
      if (res) {
        setLiked(res.liked);
        setLikeCount(res.likeCount);
      }
    } catch {
      // Roll back on failure.
      setLiked(prevLiked);
      setLikeCount(props.likeCount);
    }
  };

  const handleShare = async () => {
    setShareCount((c) => c + 1);
    try {
      const res = await props.onShare();
      if (res) setShareCount(res.shareCount);
    } catch {
      setShareCount(props.shareCount);
    }
  };

  const handleSave = () => {
    setSaved((s) => !s);
    props.onSave?.();
  };
  const handleFollow = async () => {
    const prev = followed;
    const next = !prev;
    const prevCount = followerCount;
    // Optimistic flip · consistent with handleLike pattern above.
    setFollowed(next);
    if (typeof prevCount === "number") {
      // GREATEST(x-1, 0) floor matches the sealed delete-trigger
      // semantics in migration 238 · never render a negative count.
      setFollowerCount(next ? prevCount + 1 : Math.max(0, prevCount - 1));
    }
    props.onFollow?.();

    // Owner-authorised 2026-10-30 · Stage 1 Follow wiring. When
    // `followeeId` is provided, fire the real server action and
    // reconcile · otherwise this remains the legacy session-only
    // toggle for call sites that haven't opted in yet.
    if (!props.followeeId) return;
    try {
      const result = next
        ? await followAction({
            followeeId: props.followeeId,
            source: "music",
          })
        : await unfollowAction({ followeeId: props.followeeId });
      if (!result.ok) {
        // Roll back on server rejection (rate-limit · blocked · etc.)
        setFollowed(prev);
        if (typeof prevCount === "number") setFollowerCount(prevCount);
        props.onFollowReject?.(result.code, result.message);
      }
    } catch (e) {
      setFollowed(prev);
      if (typeof prevCount === "number") setFollowerCount(prevCount);
      const msg = e instanceof Error ? e.message : String(e);
      props.onFollowReject?.("internal", msg);
    }
  };

  const spawnBurst = React.useCallback(() => {
    const id = ++nextBurstIdRef.current;
    setBursts((b) => [...b, id]);
    // Batch lifetime: 3400ms covers big-heart fly (1300ms) +
    // explosion at apex + falling-small-hearts (up to 1800ms) +
    // trailing mini-hearts (per owner directive 2026-10-29 to slow
    // the lift). Keep ~200ms slack past the longest tail.
    window.setTimeout(() => {
      setBursts((b) => b.filter((x) => x !== id));
    }, 3400);
  }, []);

  // Owner-authorised 2026-10-29 · burst origin now emerges from
  // BEHIND the track cover (if the overlay cover frame is on-page)
  // · heart rises from the cover upward to the header, then
  // explodes into small hearts falling down. Falls back to the
  // heart button's own centre when no cover is present (e.g.
  // compact surfaces that reuse MusicActionsStack elsewhere).
  const burstOriginRef = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const captureBurstOrigin = React.useCallback(() => {
    const cover =
      typeof document !== "undefined"
        ? document.querySelector<HTMLElement>("[data-nex-music-cover-frame]")
        : null;
    const rect = cover
      ? cover.getBoundingClientRect()
      : heartBtnRef.current?.getBoundingClientRect() ?? null;
    if (!rect) return;
    burstOriginRef.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  }, []);
  React.useLayoutEffect(() => {
    captureBurstOrigin();
  });

  return (
    <>
      <div
        data-nex-music-actions-stack
        role="toolbar"
        aria-label="Music actions"
        style={{
          position: "absolute",
          right: 10,
          // Owner-authorised 2026-10-29 · tightened to TikTok-style
          // spacing · vertical position shifted up another 50 px so
          // the column clears the overlay / Edit · Live floating
          // pair and sits further up the screen.
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 270px)",
          zIndex: 24,
          display: "flex",
          flexDirection: "column",
          gap: 6,
          alignItems: "center",
          pointerEvents: "auto",
        }}
      >
        {!props.isOwnerView && (
          <>
            <IconButton
              ref={heartBtnRef}
              ariaLabel={liked ? "Unlike this track" : "Like this track"}
              onClick={handleLike}
              active={liked}
              pulse={liked}
            >
              <HeartIcon filled color={liked ? RED_DARK : SOLID_WHITE} />
            </IconButton>
            <CountLabel value={likeCount} />

            <IconButton
              ariaLabel={saved ? "Remove from saved" : "Save this track"}
              onClick={handleSave}
              active={saved}
            >
              <BookmarkIcon filled color={saved ? "#FFD700" : SOLID_WHITE} />
            </IconButton>
            <CountLabel value={0} dim />
          </>
        )}

        {props.isOwnerView && props.onEdit && (
          <IconButton
            ariaLabel="Edit this track"
            onClick={props.onEdit}
            active={false}
          >
            <EditIcon color={SOLID_WHITE} />
          </IconButton>
        )}

        <IconButton
          ariaLabel="Share this track"
          onClick={handleShare}
          active={false}
        >
          <ShareIcon color={SOLID_WHITE} />
        </IconButton>
        <CountLabel value={shareCount} />

        {props.onMessage && !props.isOwnerView && (
          <IconButton
            ariaLabel={`Message ${props.track.artist ?? "the creator"}`}
            onClick={props.onMessage}
            active={false}
          >
            <MessageIcon color={SOLID_WHITE} />
          </IconButton>
        )}

        {!props.isOwnerView && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <IconButton
              ariaLabel={followed ? "Unfollow" : "Follow"}
              onClick={handleFollow}
              active={followed}
            >
              <PersonPlusIcon filled color={followed ? "#4FC3FF" : SOLID_WHITE} />
            </IconButton>
            {typeof followerCount === "number" && (
              <CountLabel value={followerCount} />
            )}
          </div>
        )}
      </div>

      {bursts.map((id) => (
        <HeartRainBurst
          key={id}
          originX={burstOriginRef.current.x}
          originY={burstOriginRef.current.y}
        />
      ))}

      <style>{keyframeCSS}</style>
    </>
  );
}

// -----------------------------------------------------------------
// Heart-rain animation · a single-use burst · unmounts via parent
// setTimeout after ~2.8s.
// -----------------------------------------------------------------

function HeartRainBurst(props: {
  readonly originX: number;
  readonly originY: number;
}): React.JSX.Element | null {
  // Target header anchor · top centre-right of the viewport.
  const headerAnchor = React.useMemo(() => {
    if (typeof window === "undefined") return { x: 100, y: 60 };
    return { x: window.innerWidth * 0.5, y: 56 };
  }, []);

  // Owner-authorised 2026-10-29 · portal the burst to <body> so no
  // transformed/filtered ancestor can trap the `position: fixed`
  // children in a local stacking context (common gotcha when z-index
  // 2000 still renders behind the page backdrop). Rendering outside
  // the normal tree makes the hearts siblings of <main>, guaranteed
  // on top. SSR-safe via mounted gate.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // 7 small hearts spawn at header anchor and fall with randomised
  // drift + rotation. MUST be declared BEFORE the mounted gate so
  // the hook order is stable across renders (React enforces hooks
  // must always run in the same order on every render).
  const smallHearts = React.useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => ({
        dx: (Math.random() - 0.5) * 320, // −160..+160 px drift
        rot: (Math.random() - 0.5) * 360,
        // Owner-authorised 2026-10-29 · fly slowed 800ms → 1300ms ·
        // explosion delay shifts in step so the small hearts still
        // spawn at the moment the big heart reaches the apex.
        delay: 1320 + Math.random() * 120, // start after apex
        duration: 1400 + Math.random() * 400,
        size: 20 + Math.random() * 10,
        tinyDelay: 1500 + Math.random() * 200,
        id: i,
      })),
    [],
  );

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div
      aria-hidden
      data-nex-music-heart-burst
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 2147483000,
      }}
    >
      {/* Phase 2 · big heart flies from origin to header anchor.
          Owner-authorised 2026-10-29 · bright red + stronger glow so
          the burst reads over the dark music backdrop (previous
          `RED_DARK` #8B0000 nearly merged into the dim overlay). */}
      <div
        style={{
          position: "fixed",
          left: props.originX - 24,
          top: props.originY - 24,
          width: 48,
          height: 48,
          color: RED_BRIGHT,
          // CSS custom props drive the fly animation
          ["--fly-dx" as string]: `${headerAnchor.x - props.originX}px`,
          ["--fly-dy" as string]: `${headerAnchor.y - props.originY}px`,
          // Owner-authorised 2026-10-29 · fly slowed 800ms → 1300ms
          // so the lift from cover to header is more deliberate ·
          // apex-fade starts just before the fly completes (1260ms)
          // so there's no visual stall between the big heart's
          // arrival and the small hearts' spawn.
          animation:
            "nex-heart-fly 1300ms cubic-bezier(.22,.65,.4,1) forwards, nex-heart-apex-fade 180ms ease-out 1260ms forwards",
          willChange: "transform, opacity",
          filter: `drop-shadow(0 0 14px ${RED_BRIGHT}) drop-shadow(0 0 4px rgba(255,255,255,0.6))`,
        }}
      >
        <HeartIcon filled size={48} color={RED_BRIGHT} />
      </div>

      {/* Phase 3+4+5 · small hearts fall + tiny trailing hearts.
          Owner-authorised 2026-10-29 · bright red for the falling
          hearts matches the big heart's palette and stays visible
          over the dark backdrop. */}
      {smallHearts.map((h) => (
        <div
          key={h.id}
          style={{
            position: "fixed",
            left: headerAnchor.x - h.size / 2,
            top: headerAnchor.y - h.size / 2,
            width: h.size,
            height: h.size,
            color: RED_BRIGHT,
            opacity: 0,
            ["--rain-dx" as string]: `${h.dx}px`,
            ["--rain-dy" as string]: `${window.innerHeight - headerAnchor.y - 60}px`,
            ["--rain-rot" as string]: `${h.rot}deg`,
            animation: `nex-heart-rain ${h.duration}ms cubic-bezier(.4,.0,.6,1) ${h.delay}ms forwards`,
            willChange: "transform, opacity",
            filter: `drop-shadow(0 0 8px ${RED_BRIGHT})`,
          }}
        >
          <HeartIcon filled size={h.size} color={RED_BRIGHT} />
          {/* Tiny trailing hearts drifting upward from the falling one */}
          <span
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 10,
              height: 10,
              color: RED_BRIGHT,
              opacity: 0,
              animation: `nex-heart-tiny 900ms ease-out ${h.tinyDelay}ms forwards`,
              willChange: "transform, opacity",
            }}
          >
            <HeartIcon filled size={10} color={RED_BRIGHT} />
          </span>
          <span
            style={{
              position: "absolute",
              left: "40%",
              top: "60%",
              width: 8,
              height: 8,
              color: RED_BRIGHT,
              opacity: 0,
              animation: `nex-heart-tiny 1000ms ease-out ${h.tinyDelay + 180}ms forwards`,
              willChange: "transform, opacity",
            }}
          >
            <HeartIcon filled size={8} color={RED_BRIGHT} />
          </span>
        </div>
      ))}
    </div>,
    document.body,
  );
}

// -----------------------------------------------------------------
// Primitives · icons, buttons, count label
// -----------------------------------------------------------------

const IconButton = React.forwardRef(function IconButton(
  props: {
    readonly ariaLabel: string;
    readonly onClick: () => void;
    readonly active: boolean;
    readonly pulse?: boolean;
    readonly children: React.ReactNode;
  },
  ref: React.Ref<HTMLButtonElement>,
) {
  // Owner-authorised 2026-10-29 · chrome stripped · icons sit over
  // the backdrop with a drop-shadow for legibility. Tap area kept
  // at 40×40 for accessibility.
  return (
    <button
      ref={ref}
      type="button"
      aria-label={props.ariaLabel}
      aria-pressed={props.active}
      onClick={props.onClick}
      style={{
        width: 40,
        height: 40,
        borderRadius: 0,
        border: "none",
        background: "transparent",
        color: SOLID_WHITE,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        padding: 0,
        fontFamily: "inherit",
        boxShadow: "none",
        filter: "drop-shadow(0 1px 3px rgba(0, 0, 0, 0.75))",
        animation: props.pulse ? "nex-heart-btn-pulse 420ms ease-out" : "none",
      }}
    >
      {props.children}
    </button>
  );
});

function CountLabel(props: {
  readonly value: number;
  readonly dim?: boolean;
}): React.JSX.Element {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 800,
        color: props.dim ? INK_DIM : INK,
        textShadow: "0 1px 2px rgba(0,0,0,0.6)",
        letterSpacing: "0.04em",
        marginTop: -8,
      }}
    >
      {formatCount(props.value)}
    </span>
  );
}

function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  if (n < 1_000_000) return Math.floor(n / 1000) + "k";
  return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
}

function HeartIcon(props: {
  readonly filled?: boolean;
  readonly color?: string;
  readonly size?: number;
}): React.JSX.Element {
  // Owner-authorised 2026-10-30 · higher-fidelity heart glyph.
  // Replaces the previous simplified three-arc path with a true
  // double-lobed curve that reads as a heart at any size + any
  // stroke width. Material-standard shape.
  const s = props.size ?? 20;
  const color = props.color ?? "currentColor";
  return (
    <svg
      viewBox="0 0 24 24"
      width={s}
      height={s}
      fill={props.filled ? color : "none"}
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41 0.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  );
}

function BookmarkIcon(props: {
  readonly filled?: boolean;
  readonly color?: string;
}): React.JSX.Element {
  const color = props.color ?? "currentColor";
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} fill={props.filled ? color : "none"} stroke={color} strokeWidth={2} strokeLinejoin="round">
      <path d="M6 3h12v18l-6-4-6 4V3z" />
    </svg>
  );
}

function ShareIcon(props: {
  readonly color?: string;
}): React.JSX.Element {
  // Owner-authorised 2026-10-30 · replaced the previous arrow-up-
  // from-box glyph (which read ambiguously as "download/upload")
  // with the standard three-nodes-connected share-network glyph.
  // Three circles + two connecting edges = unambiguous "share to
  // another person / platform."
  const color = props.color ?? "currentColor";
  return (
    <svg
      viewBox="0 0 24 24"
      width={20}
      height={20}
      fill="none"
      stroke={color}
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function PersonPlusIcon(props: {
  readonly filled?: boolean;
  readonly color?: string;
}): React.JSX.Element {
  const color = props.color ?? "currentColor";
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} fill={props.filled ? color : "none"} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </svg>
  );
}

function EditIcon(props: {
  readonly color?: string;
}): React.JSX.Element {
  // Owner-authorised 2026-10-30 · pencil glyph · same visual weight
  // as the other right-rail icons (20 × 20 · 2 stroke · no fill).
  // Opens the sealed track-edit surface (preview?edit=1).
  const color = props.color ?? "currentColor";
  return (
    <svg
      viewBox="0 0 24 24"
      width={20}
      height={20}
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

function MessageIcon(props: {
  readonly color?: string;
}): React.JSX.Element {
  // Owner-authorised 2026-10-30 · chat-bubble glyph · same visual
  // weight as the other right-rail icons (20 × 20 · 1.9 stroke · no
  // fill). Opens the sealed connection-invitation panel.
  const color = props.color ?? "currentColor";
  return (
    <svg
      viewBox="0 0 24 24"
      width={20}
      height={20}
      fill="none"
      stroke={color}
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

// -----------------------------------------------------------------
// Keyframes · scoped by prefix so no global CSS collision.
// -----------------------------------------------------------------

const keyframeCSS = `
  @keyframes nex-heart-btn-pulse {
    0%   { transform: scale(1); }
    40%  { transform: scale(1.22); }
    100% { transform: scale(1); }
  }
  @keyframes nex-heart-fly {
    0% {
      transform: translate(0, 0) scale(1);
      opacity: 1;
    }
    85% {
      transform: translate(var(--fly-dx), var(--fly-dy)) scale(1.6);
      opacity: 1;
    }
    100% {
      transform: translate(var(--fly-dx), var(--fly-dy)) scale(2.4);
      opacity: 1;
    }
  }
  @keyframes nex-heart-apex-fade {
    0%   { opacity: 1; }
    100% { opacity: 0; }
  }
  @keyframes nex-heart-rain {
    0% {
      transform: translate(0, 0) rotate(0deg);
      opacity: 0;
    }
    10% { opacity: 1; }
    80% { opacity: 1; }
    100% {
      transform: translate(var(--rain-dx), var(--rain-dy)) rotate(var(--rain-rot));
      opacity: 0;
    }
  }
  @keyframes nex-heart-tiny {
    0% {
      transform: translate(-50%, -50%) scale(0.6);
      opacity: 0;
    }
    20% { opacity: 1; }
    100% {
      transform: translate(-50%, calc(-50% - 80px)) scale(1);
      opacity: 0;
    }
  }
`;
