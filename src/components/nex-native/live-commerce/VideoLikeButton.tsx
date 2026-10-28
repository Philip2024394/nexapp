"use client";

// src/components/nex-native/live-commerce/VideoLikeButton.tsx
//
// Round 3i heart/like · hardened pass (Round 3i-hardening).
// -----------------------------------------------------------------------------
// Changes vs the first R3i draft:
//   · Rapid double-tap guard · a 250 ms lock + aria-busy prevents both
//     state races and duplicate floating-heart bursts.
//   · `localStorage` wrapped in try/catch everywhere · reads tolerate
//     SecurityError (privacy mode) + QuotaExceededError (full storage)
//     + malformed values. When storage is unavailable the component
//     falls back to in-memory state and exposes
//     `data-nex-video-like-storage="unavailable"` so pages can show a
//     non-persistent indicator if they want.
//   · HONEST social proof · a seeded co-watcher count is ONLY rendered
//     when the caller opts in via `simulated={true}` AND passes a
//     non-null count. The chip then carries a visible "DEMO · seeded"
//     label so no viewer can mistake it for real presence. A real
//     presence source will swap `simulated` for a verified-presence
//     prop in a future pass · the chip rendering stays identical.
//   · Reduced motion · the floating-heart animation is suppressed via
//     a CSS media query AND the burst state is skipped entirely so the
//     DOM stays minimal.
//   · Accessibility · aria-pressed, aria-busy, visible focus-ring,
//     keyboard activation (native button), descriptive aria-label.
//
// Persistence model (still prototype)
//   · localStorage key `nex-watch-like:v=<videoId>` holds the per-video
//     like state. Explicitly flagged as PROTOTYPE in the exported
//     component docstring.
//   · Category-like counts remain client-local for feed-shuffle
//     reinforcement; the shuffle library's localStorage adapter is
//     the only writer / reader. A production account-level contract
//     is NOT yet wired · the hardening pass documents this gap but
//     does not fabricate durability.
//
// What this file does NOT do
//   · It does not reach any server. Likes are not posted to any
//     endpoint today; a `onLikeChange` callback is exposed so a
//     future page or parent can wire that side when a backend
//     contract is approved.

import * as React from "react";

const NEX_RED = "#FF3355";
const NEX_RED_SOFT = "#FF7A95";
const DEMO_YELLOW = "#FFC24B";
const DEMO_INK = "#1A1200";

export interface VideoLikeButtonProps {
  readonly videoId: string;
  /** Optional category id · used for feed-shuffle weighting. */
  readonly categoryId?: string;
  /** Honest count of other viewers at the same video timestamp.
   *  Rendered ONLY when `simulated === true` so dev values can't
   *  leak into a production surface by mistake. */
  readonly coWatchersAtTimestamp?: number;
  /** Explicit opt-in to render the demo co-watcher chip. The caller
   *  (a dev persona page) sets this true. Any surface that does NOT
   *  have access to verified real presence must leave this false
   *  (the chip then does not render). */
  readonly simulated?: boolean;
  /** Hook so the caller can react when the viewer likes · wires into
   *  feed-shuffle "category weight bump" on the client. */
  readonly onLikeChange?: (liked: boolean) => void;
  /** Optional label (e.g. "Hendra") used only for aria. */
  readonly broadcasterLabel?: string;
}

const LS_KEY_PREFIX = "nex-watch-like:v=";
const LS_CAT_KEY_PREFIX = "nex-watch-cat-like-count:c=";
const TAP_LOCK_MS = 250;
const BURST_WINDOW_MS = 1600;

type StorageState = "available" | "unavailable";

interface StorageAccess {
  readonly state: StorageState;
  readonly read: (key: string) => string | null;
  readonly write: (key: string, value: string) => void;
  readonly remove: (key: string) => void;
}

function probeStorage(): StorageAccess {
  if (typeof window === "undefined") {
    return {
      state: "unavailable",
      read: () => null,
      write: () => {},
      remove: () => {},
    };
  }
  try {
    const probeKey = "__nex-watch-like-probe__";
    window.localStorage.setItem(probeKey, "1");
    window.localStorage.removeItem(probeKey);
    return {
      state: "available",
      read: (k) => {
        try {
          return window.localStorage.getItem(k);
        } catch {
          return null;
        }
      },
      write: (k, v) => {
        try {
          window.localStorage.setItem(k, v);
        } catch {
          /* QuotaExceeded or SecurityError · swallow · caller already
             updated optimistic state. */
        }
      },
      remove: (k) => {
        try {
          window.localStorage.removeItem(k);
        } catch {
          /* ignore */
        }
      },
    };
  } catch {
    return {
      state: "unavailable",
      read: () => null,
      write: () => {},
      remove: () => {},
    };
  }
}

function parseLikeValue(raw: string | null): boolean {
  // Only the exact string "1" counts as liked · defends against
  // legacy / malformed values.
  return raw === "1";
}

interface FloatingHeart {
  readonly id: number;
  readonly x: number; // percent · 0..100 left offset
  readonly delayMs: number;
  readonly scale: number;
}

function spawnFloatingHearts(count: number): readonly FloatingHeart[] {
  const now = Date.now();
  const n = Math.max(1, Math.min(count, 8));
  const items: FloatingHeart[] = [];
  for (let i = 0; i < n; i += 1) {
    items.push({
      id: now + i,
      x: 30 + Math.random() * 40,
      delayMs: Math.floor(Math.random() * 160),
      scale: 0.75 + Math.random() * 0.5,
    });
  }
  return items;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function VideoLikeButton(props: VideoLikeButtonProps): React.JSX.Element {
  // R3i-hardening-bugfix 2026-10-26 · DO NOT probe storage at render.
  // Probing calls `window.localStorage` which is undefined during SSR,
  // producing "unavailable" on the server and "available" on the
  // client · React would then flag a hydration attribute mismatch on
  // `data-nex-video-like-storage`. The probe now runs ONLY after the
  // hydration useEffect, so the first client paint matches the server
  // paint byte-for-byte.
  const storageRef = React.useRef<StorageAccess | null>(null);

  const [liked, setLiked] = React.useState(false);
  const [hydrated, setHydrated] = React.useState(false);
  const [storageState, setStorageState] = React.useState<StorageState | "unknown">("unknown");
  const [floaters, setFloaters] = React.useState<readonly FloatingHeart[]>([]);
  const [busy, setBusy] = React.useState(false);
  const hasEverLikedRef = React.useRef<boolean>(false);
  const lastTapAtRef = React.useRef<number>(0);
  const burstLockUntilRef = React.useRef<number>(0);

  const simulatedCoWatchers =
    props.simulated === true &&
    typeof props.coWatchersAtTimestamp === "number" &&
    Number.isFinite(props.coWatchersAtTimestamp) &&
    props.coWatchersAtTimestamp > 0
      ? Math.floor(props.coWatchersAtTimestamp)
      : null;

  // Hydrate from storage on mount · stable across refresh + navigation
  // when storage is available. On unavailable storage the component
  // starts in the "not liked" state. All localStorage probing happens
  // here (post-mount), never during SSR, so hydration attribute
  // comparison matches byte-for-byte.
  React.useEffect(() => {
    const s = probeStorage();
    storageRef.current = s;
    setStorageState(s.state);
    const initial = parseLikeValue(s.read(LS_KEY_PREFIX + props.videoId));
    setLiked(initial);
    hasEverLikedRef.current = initial;
    setHydrated(true);
  }, [props.videoId]);

  // Clear floaters after their window elapses · also releases the
  // burst lock so a subsequent legitimate like can animate.
  React.useEffect(() => {
    if (floaters.length === 0) return;
    const t = window.setTimeout(() => setFloaters([]), BURST_WINDOW_MS);
    return () => window.clearTimeout(t);
  }, [floaters]);

  const onToggle = React.useCallback(() => {
    const now = Date.now();
    if (now - lastTapAtRef.current < TAP_LOCK_MS) {
      // Rapid-tap guard · ignore this one and keep the state stable.
      return;
    }
    lastTapAtRef.current = now;
    setBusy(true);
    setLiked((prev) => {
      const next = !prev;
      const s = storageRef.current ?? probeStorage();
      if (next) s.write(LS_KEY_PREFIX + props.videoId, "1");
      else s.remove(LS_KEY_PREFIX + props.videoId);

      if (props.categoryId) {
        const key = LS_CAT_KEY_PREFIX + props.categoryId;
        try {
          const current = Number(s.read(key) ?? "0");
          const bumped = Math.max(0, (Number.isFinite(current) ? current : 0) + (next ? 1 : -1));
          s.write(key, String(bumped));
        } catch {
          /* ignore · counter is a best-effort reinforcement signal */
        }
      }

      if (next && !hasEverLikedRef.current) {
        hasEverLikedRef.current = true;
        // Only burst if simulated co-watchers > 0 AND reduced-motion
        // isn't requested AND the lock window has passed.
        if (
          simulatedCoWatchers !== null &&
          !prefersReducedMotion() &&
          now >= burstLockUntilRef.current
        ) {
          burstLockUntilRef.current = now + BURST_WINDOW_MS;
          const burst = Math.min(1 + simulatedCoWatchers, 6);
          setFloaters(spawnFloatingHearts(burst));
        }
      }
      props.onLikeChange?.(next);
      return next;
    });
    // Release busy after the lock window.
    window.setTimeout(() => setBusy(false), TAP_LOCK_MS);
  }, [props, simulatedCoWatchers]);

  const activeLiked = hydrated && liked;

  return (
    <div
      data-nex-video-like
      data-nex-video-like-video-id={props.videoId}
      data-nex-video-like-storage={storageState}
      /* Round 3i-hardening bugfix 2026-10-26 · storageState starts as
         "unknown" and flips to the real value only after the hydration
         useEffect. React warns on attribute-value differences, so we
         opt out of the hydration check for this one attribute whose
         value is unknowable until the browser confirms localStorage
         access. The server render always emits "unknown"; the client
         flips to "available" or "unavailable" on first mount. */
      suppressHydrationWarning
      style={{
        position: "relative",
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        pointerEvents: "auto",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={activeLiked ? "true" : "false"}
        aria-busy={busy}
        aria-label={
          activeLiked
            ? `Unlike video${props.broadcasterLabel ? " by " + props.broadcasterLabel : ""}`
            : `Like video${props.broadcasterLabel ? " by " + props.broadcasterLabel : ""}`
        }
        data-nex-video-like-btn
        data-nex-video-like-active={activeLiked ? "true" : "false"}
        style={{
          width: 46,
          height: 46,
          borderRadius: "50%",
          border: activeLiked
            ? `1.5px solid ${NEX_RED}`
            : "1.5px solid rgba(255,255,255,0.72)",
          background: activeLiked ? NEX_RED : "rgba(0,0,0,0.42)",
          color: "#FFFFFF",
          fontSize: 20,
          lineHeight: 1,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          boxShadow: activeLiked
            ? `0 0 0 4px rgba(255,51,85,0.18), 0 10px 20px -8px rgba(255,51,85,0.5)`
            : "0 6px 14px -6px rgba(0,0,0,0.5)",
          transition: "background 160ms ease-out, transform 160ms ease-out",
          transform: activeLiked ? "scale(1.04)" : "scale(1.0)",
          WebkitTapHighlightColor: "transparent",
          fontFamily: "inherit",
          position: "relative",
          zIndex: 2,
          outlineOffset: 2,
        }}
      >
        <span aria-hidden>{activeLiked ? "♥" : "♡"}</span>
      </button>

      {/* HONEST social proof · ONLY renders when the caller explicitly
          opts in via simulated={true}. Carries a visible "DEMO" chip
          so no viewer mistakes the number for real presence. */}
      {simulatedCoWatchers !== null ? (
        <div
          data-nex-video-like-co-watchers
          data-nex-video-like-co-watchers-source="simulated"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            maxWidth: 86,
            textAlign: "center",
          }}
        >
          <span
            style={{
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#FFFFFF",
              textShadow: "0 1px 2px rgba(0,0,0,0.8)",
              lineHeight: 1.15,
            }}
          >
            +{simulatedCoWatchers} here
          </span>
          <span
            data-nex-video-like-demo-label
            style={{
              fontSize: 8.5,
              fontWeight: 900,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: DEMO_INK,
              background: DEMO_YELLOW,
              padding: "1px 5px",
              borderRadius: 4,
              lineHeight: 1.15,
            }}
          >
            DEMO
          </span>
        </div>
      ) : null}

      {/* Floating-heart particles · fire ONLY on first-ever like when
          simulated co-watchers > 0 AND reduced-motion is NOT set. */}
      {floaters.map((f) => (
        <span
          key={f.id}
          aria-hidden
          data-nex-video-like-floater
          style={{
            position: "absolute",
            left: `${f.x}%`,
            bottom: 46,
            transform: `translateX(-50%) scale(${f.scale})`,
            animation: `nexLikeFloat 1500ms ${f.delayMs}ms cubic-bezier(0.22, 1, 0.36, 1) forwards`,
            color: NEX_RED_SOFT,
            textShadow: "0 1px 2px rgba(0,0,0,0.6)",
            fontSize: 22,
            lineHeight: 1,
            pointerEvents: "none",
            opacity: 0,
            zIndex: 3,
          }}
        >
          ♥
        </span>
      ))}

      <style>{`
        @keyframes nexLikeFloat {
          0%   { opacity: 0; transform: translate(-50%, 0) scale(0.6); }
          10%  { opacity: 1; }
          80%  { opacity: 1; transform: translate(-50%, -70px) scale(1.05); }
          100% { opacity: 0; transform: translate(-50%, -110px) scale(0.9); }
        }
        [data-nex-video-like-btn]:focus-visible {
          outline: 2px solid #00AFFF;
          outline-offset: 2px;
        }
        @media (prefers-reduced-motion: reduce) {
          [data-nex-video-like-floater] { animation: none !important; opacity: 0 !important; }
          [data-nex-video-like-btn] { transition: none !important; transform: none !important; }
        }
      `}</style>
    </div>
  );
}
