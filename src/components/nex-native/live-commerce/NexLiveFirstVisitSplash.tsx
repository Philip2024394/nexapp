"use client";

// src/components/nex-native/live-commerce/NexLiveFirstVisitSplash.tsx
//
// Owner directive 2026-10-27 (revised · "yes agreed tap or auto
// after 3 seconds") · the splash now shows on EVERY tap into NEX
// Live · it's a branded doorway, not a one-time welcome. Dismisses
// on tap OR auto-advances after 3 s so distracted users never get
// stuck. The session-sticky gate is retired · if the caller only
// wants it on first visit, THEY wrap the mount, not us.
//
// Design:
//   · Full-bleed `/nex-live-welcome.png` background (sealed artwork).
//   · Dark scrim 0.42 so the overlay copy stays legible without
//     smothering the artwork.
//   · Scroll locked on html / body / `.nex-native-frame` while the
//     splash is mounted · the "Tap anywhere to enter" affordance
//     stayed hidden on short mobile frames because the frame kept
//     its own `overflow-y: auto`. Lock restores on unmount.
//   · Centered column:
//       - Pre-live indicator (red dot + 3 concentric pings · same
//         `nexPreLive*` family the Enter-broadcast-room idle screen
//         uses · brand continuity).
//       - "NEX LIVE" wordmark (20 px / 900).
//       - 5 stacked overlapping persona avatar chips (navy gradient
//         with white initials · each 32 × 32 · overlap −12 px).
//       - "Join the NEX Network" micro-text under the stack.
//       - "Tap anywhere to enter" affordance at the bottom edge.
//   · Auto-dismisses after `visibleMs` (default 3000 ms) OR on tap.
//   · Honours `prefers-reduced-motion` (no pings, instant dismiss).
//
// Pure UI · the caller owns navigation. `onDismiss` fires once · the
// caller decides where the user lands next (viewer feed, Hendra
// persona, etc).

import * as React from "react";
// Owner directive 2026-10-28 · "remove the nex profile and text
// should be Starting Live" · the sealed NexPingBadge primitive
// (circular NEX wordmark + cyan ring + pulsing halo) is retired
// from the splash. The splash is now a transitional "Starting
// Live" screen that fires AFTER the owner taps "Enter broadcast
// room" · it's a status beacon, not a brand doorway.

/* Owner directive 2026-10-27 · "add the profile images from mock to
 * the circles and when new users members join we can rotate them".
 * The sealed `nex-mock-personas` Supabase bucket holds one PNG per
 * persona at `{handle}.png`. Public URL pattern:
 *     {NEXT_PUBLIC_NEX_SUPABASE_URL}/storage/v1/object/public/
 *       nex-mock-personas/{handle}.png
 * This pool is the current "network of people" shown on the splash
 * · we pick 5 at random per visit so the stack feels alive even
 * without the "new user joined" Realtime channel wired yet. The
 * rotation hook (`onRosterRefresh`) is reserved for later · when
 * the owner authorises the join-event stream it fires here and
 * swaps a chip for the newcomer.
 */
const PERSONA_POOL: ReadonlyArray<{
  readonly handle: string;
  readonly initial: string;
  readonly label: string;
}> = [
  { handle: "hendra",  initial: "H", label: "Hendra Gunawan" },
  { handle: "siti",    initial: "S", label: "Siti Rahayu" },
  { handle: "bayu",    initial: "B", label: "Bayu Santoso" },
  { handle: "melati",  initial: "M", label: "Melati Kusuma" },
  { handle: "agus",    initial: "A", label: "Agus Wijaya" },
  { handle: "rizky",   initial: "R", label: "Rizky Pratama" },
  { handle: "nurul",   initial: "N", label: "Nurul Hidayah" },
  { handle: "sari",    initial: "S", label: "Sari Permata" },
  { handle: "dimas",   initial: "D", label: "Dimas Nugroho" },
  { handle: "putri",   initial: "P", label: "Putri Maharani" },
  { handle: "yudi",    initial: "Y", label: "Yudi Hartono" },
  { handle: "fatimah", initial: "F", label: "Fatimah Zahra" },
];

const SUPABASE_PUBLIC_URL = process.env.NEXT_PUBLIC_NEX_SUPABASE_URL ?? "";
const AVATAR_BUCKET = "nex-mock-personas";

/** Resolve the public avatar URL for a seeded persona handle. Returns
 *  `null` when the env var is missing (dev-no-infra · the fallback
 *  gradient chip paints the handle's initial instead). */
function avatarUrlForHandle(handle: string): string | null {
  if (!SUPABASE_PUBLIC_URL) return null;
  return `${SUPABASE_PUBLIC_URL}/storage/v1/object/public/${AVATAR_BUCKET}/${handle}.png`;
}

/** Pick N random personas from the pool · pure, deterministic given a
 *  seed. The default seed uses the Fisher-Yates shuffle with
 *  Math.random so each mount sees a different subset. */
function pickRandomPersonas(n: number): ReadonlyArray<(typeof PERSONA_POOL)[number]> {
  const copy = [...PERSONA_POOL];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy.slice(0, Math.min(n, copy.length));
}

export interface NexLiveFirstVisitSplashProps {
  /** Fires after the splash auto-dismisses or the user taps. */
  readonly onDismiss: () => void;
  /** Milliseconds the splash stays visible before auto-dismissing.
   *  Defaults to 3000 ms per owner directive 2026-10-27 · "tap or
   *  auto after 3 seconds". Covers the sealed R5c neighbour-preload
   *  warm-up window and gives distracted users enough runway. */
  readonly visibleMs?: number;
  /** Historical no-op · retained for backwards compat with the
   *  preview route. The splash shows on every mount now (no
   *  session-sticky gate), so `forceShow` has no effect. Leaving
   *  the field means existing call sites still typecheck. */
  readonly forceShow?: boolean;
}

export function NexLiveFirstVisitSplash(
  props: NexLiveFirstVisitSplashProps,
): React.JSX.Element | null {
  const visibleMs = props.visibleMs ?? 3000;
  const [open, setOpen] = React.useState<boolean>(true);

  // Owner directive 2026-10-27 · reshuffle the persona roster on every
  // mount so repeat taps into Live see a different "network of
  // people". SSR-safe: the first render uses a deterministic slice
  // (pool.slice(0, 5)) so the server HTML matches the client's
  // first paint · an effect then swaps in a shuffled subset after
  // hydration · no hydration-mismatch warning.
  const [roster, setRoster] = React.useState<
    ReadonlyArray<(typeof PERSONA_POOL)[number]>
  >(() => PERSONA_POOL.slice(0, 5));
  React.useEffect(() => {
    setRoster(pickRandomPersonas(5));
  }, []);

  const dismiss = React.useCallback(() => {
    setOpen(false);
    props.onDismiss();
  }, [props]);

  React.useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(dismiss, visibleMs);
    return () => window.clearTimeout(t);
  }, [open, visibleMs, dismiss]);

  // Owner troubleshoot 2026-10-27 · "tap anywhere text is hidden
  // with scrolling we must make sure screen no scrolling" · the
  // sealed `.nex-native-frame` has `overflow-y: auto` which pushed
  // the "Tap anywhere to enter" affordance off-screen on short
  // mobile viewports. Lock html / body / frame scroll while the
  // splash is mounted · restore on unmount so the following live
  // feed can scroll normally.
  React.useEffect(() => {
    if (!open) return;
    if (typeof document === "undefined") return undefined;
    const html = document.documentElement;
    const body = document.body;
    const frame = document.querySelector<HTMLElement>(".nex-native-frame");
    const prev = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyOverscroll: body.style.overscrollBehavior,
      bodyTouchAction: body.style.touchAction,
      frameOverflow: frame?.style.overflowY ?? "",
    };
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    body.style.touchAction = "none";
    if (frame) frame.style.overflowY = "hidden";
    return () => {
      html.style.overflow = prev.htmlOverflow;
      body.style.overflow = prev.bodyOverflow;
      body.style.overscrollBehavior = prev.bodyOverscroll;
      body.style.touchAction = prev.bodyTouchAction;
      if (frame) frame.style.overflowY = prev.frameOverflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label="Welcome to NEX Live"
      data-nex-live-first-visit-splash
      onClick={dismiss}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 200,
        boxSizing: "border-box",
        background:
          'rgba(2, 9, 20, 0.42) url("/nex-live-welcome.png") 0 0 / 100% 100% no-repeat',
        backgroundBlendMode: "normal",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        cursor: "pointer",
        animation: "nexLiveFirstVisitFadeIn 220ms ease-out",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {/* Owner directive 2026-10-28 · "text should be Starting Live"
          · the wordmark is now the sole focal point. 36 px / 900 ·
          "Starting Live" is longer than the retired "LIVE" so the
          size drops a notch to stay on one line at 360 px frame
          width. Letter-spacing tightened for mixed-case flow. */}
      <div
        data-nex-live-first-visit-wordmark
        style={{
          fontSize: 36,
          fontWeight: 900,
          color: "#FFFFFF",
          letterSpacing: "0.04em",
          textAlign: "center",
          textShadow: "0 2px 14px rgba(0,0,0,0.75), 0 1px 3px rgba(0,0,0,0.6)",
          marginBottom: 24,
          lineHeight: 1.1,
        }}
      >
        Starting Live
      </div>

      {/* Stacked persona chips · 5 overlapping avatars. Owner
          directive 2026-10-27 · the chips now paint real persona
          avatars from the sealed `nex-mock-personas` Supabase
          bucket · gradient-initial fallback for dev-no-infra and
          for images that fail to load. The roster is reshuffled on
          every mount (every tap into Live) so repeat visits feel
          alive. When the "new user joined" Realtime channel is
          wired, the hook belongs here · it'll replace one chip
          with the newcomer. */}
      <div
        data-nex-live-first-visit-stack
        aria-hidden
        style={{
          display: "inline-flex",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        {roster.map((p, i) => (
          <PersonaChip
            key={`${p.handle}-${i}`}
            persona={p}
            offsetIndex={i}
            stackSize={roster.length}
          />
        ))}
      </div>

      {/* Owner directive 2026-10-28 · the "Tap anywhere to enter"
          affordance is retired · the splash is now a transitional
          "Starting Live" indicator (auto-dismisses after visibleMs
          ms, taps still dismiss early) · there is no doorway copy. */}

      <style>{`
        @keyframes nexLiveFirstVisitFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes nexLiveFirstVisitDot {
          0%, 100% { opacity: 1;    transform: scale(1);   }
          50%      { opacity: 0.6;  transform: scale(0.85); }
        }
        @keyframes nexLiveFirstVisitPing {
          0%   { transform: scale(0.4); opacity: 0.95; }
          80%  { transform: scale(1.5); opacity: 0;    }
          100% { transform: scale(1.5); opacity: 0;    }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-nex-live-first-visit-splash] { animation: none !important; }
          [data-nex-live-first-visit-indicator] * { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

/** Owner directive 2026-10-27 · persona chip paints the mock
 *  avatar from the sealed Supabase bucket when a URL is resolvable,
 *  falls back to the sealed navy-gradient + initial when it isn't
 *  (dev-no-infra, broken image, or missing env var). Each chip
 *  overlaps the previous by −12 px via `marginLeft` on all but the
 *  first chip. z-index decays left-to-right so the leftmost chip
 *  reads as the "front" of the stack. */
function PersonaChip(props: {
  readonly persona: (typeof PERSONA_POOL)[number];
  readonly offsetIndex: number;
  readonly stackSize: number;
}): React.JSX.Element {
  const url = React.useMemo(
    () => avatarUrlForHandle(props.persona.handle),
    [props.persona.handle],
  );
  const [showFallback, setShowFallback] = React.useState<boolean>(!url);

  return (
    <span
      title={props.persona.label}
      data-nex-live-first-visit-chip={props.persona.handle}
      style={{
        width: 36,
        height: 36,
        borderRadius: 999,
        background: "linear-gradient(135deg, #152646 0%, #1E3A6E 100%)",
        color: "#FFFFFF",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 13,
        fontWeight: 800,
        marginLeft: props.offsetIndex === 0 ? 0 : -12,
        border: "2px solid rgba(255, 255, 255, 0.9)",
        boxShadow: "0 2px 6px rgba(0,0,0,0.55)",
        position: "relative",
        zIndex: props.stackSize - props.offsetIndex,
        overflow: "hidden",
      }}
    >
      {!showFallback && url ? (
        /* Owner troubleshoot 2026-10-27 · "the images you cropped
            are white on top and bottom · can you scan these and
            remove the white so they expand to cover the round
            circle" · the sealed `nex-mock-personas` PNGs carry
            ~10-15 % white padding on the top and bottom edges from
            the original source-grid crop. Can't re-crop + re-upload
            the bucket from here, so we zoom the <img> up inside the
            chip (overflow-hidden on the parent clips what pushes
            past). `scale(1.4)` + `translateY(-2%)` nudges the face
            toward the top of the circle and crops the white bars
            cleanly on both edges. */
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={url}
          alt=""
          onError={() => setShowFallback(true)}
          draggable={false}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
            pointerEvents: "none",
            transform: "scale(1.4) translateY(-2%)",
            transformOrigin: "center 48%",
          }}
        />
      ) : (
        <span aria-hidden>{props.persona.initial}</span>
      )}
    </span>
  );
}
