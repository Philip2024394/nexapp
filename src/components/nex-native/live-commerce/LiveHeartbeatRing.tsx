// src/components/nex-native/live-commerce/LiveHeartbeatRing.tsx
//
// Phase 2 · G2 · §5.2 · Profile Live heartbeat ring.
// -----------------------------------------------------------------------------
// Owner-authorised 2026-10-24 per saved plan §5.2.
//
// Presentational component. Pure props → JSX. Takes a boolean `isLive`
// (resolved server-side via `isBroadcasterLive(accountId)` from the
// live-session-service) and a `children` slot that renders the
// broadcaster's profile image. When isLive === true, overlays an
// animated gradient ring + "LIVE" pill around the image.
//
// Doctrine (§5.4 "One Live system, connected surfaces")
// -----------------------------------------------------------------------------
//   · This component is a visual representation of state · NEVER the
//     source of truth. The DB (nex_live_session · status='open') is
//     authoritative. The server resolves isLive, this component
//     renders it.
//   · The animation does NOT poll · the parent decides the data cadence
//     (server-render frequency, Realtime subscription, etc.).
//   · Component accepts an optional `onTapHref` so tapping the live
//     avatar can navigate to the broadcaster's active Live surface.
//     Absent → ring is non-interactive (presentation only).
//
// Accessibility
// -----------------------------------------------------------------------------
//   · `role="img"` on the ring wrapper is overloaded by the inner
//     avatar's own semantics; we keep the aria-label only when isLive
//     is true, so screen readers announce the live state.
//   · Animation respects `prefers-reduced-motion` via a media query in
//     the keyframe style block.

import * as React from "react";
import Link from "next/link";
import { useLiveClockTick } from "@/lib/nex-native/live-broadcast/use-live-clock-tick";

export interface LiveHeartbeatRingProps {
  readonly isLive: boolean;
  readonly ariaLabel?: string;
  /** Optional link to the active Live surface when `isLive`. */
  readonly onTapHref?: string | null;
  readonly size?: number;
  readonly children: React.ReactNode;
  /** Plan v4 · AC-3/AC-5. Server-computed relative TTL (ms). When
   *  supplied + isLive, the ring + "Live" pill decay client-side and
   *  the component falls back to the plain-avatar branch at expiry
   *  (AC-6 · hide chrome, keep children). When undefined, the ring
   *  renders indefinitely for the legacy call path. */
  readonly liveExpiresInMs?: number;
}

export function LiveHeartbeatRing(
  props: LiveHeartbeatRingProps,
): React.JSX.Element {
  // Hook must be called unconditionally.
  const expired = useLiveClockTick(
    props.liveExpiresInMs ?? Number.POSITIVE_INFINITY,
  );
  const size = props.size ?? 64;
  const ringPadding = Math.max(3, Math.round(size * 0.06));
  const liveLabel = props.ariaLabel ?? "Live now";

  const showLiveChrome =
    props.isLive &&
    (props.liveExpiresInMs === undefined || !expired);

  if (!showLiveChrome) {
    return (
      <span
        data-nex-live-heartbeat="off"
        style={{
          display: "inline-block",
          width: size,
          height: size,
        }}
      >
        {props.children}
      </span>
    );
  }

  const inner = (
    <span
      data-nex-live-heartbeat="on"
      aria-label={liveLabel}
      role="img"
      style={{
        position: "relative",
        display: "inline-block",
        width: size,
        height: size,
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          padding: ringPadding,
          background:
            "conic-gradient(from 0deg, #FF3355 0deg, #FF7200 120deg, #00AFFF 240deg, #FF3355 360deg)",
          animation: "nexLiveHeartbeatRotate 2800ms linear infinite",
          WebkitMask:
            "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          mask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
        }}
      />
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: "50%",
          bottom: -2,
          transform: "translateX(-50%)",
          padding: "1px 6px",
          borderRadius: 999,
          background: "#FF3355",
          color: "#FFFFFF",
          fontSize: Math.max(9, Math.round(size * 0.14)),
          fontWeight: 900,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          lineHeight: 1,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.4)",
        }}
      >
        Live
      </span>
      <style>{`
        @keyframes nexLiveHeartbeatRotate {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-nex-live-heartbeat="on"] > *:first-child {
            animation: none !important;
          }
        }
      `}</style>
      <span
        style={{
          position: "absolute",
          inset: ringPadding + 1,
          borderRadius: "50%",
          overflow: "hidden",
          display: "block",
        }}
      >
        {props.children}
      </span>
    </span>
  );

  if (props.onTapHref) {
    return (
      <Link
        href={props.onTapHref}
        aria-label={liveLabel}
        style={{ display: "inline-block", textDecoration: "none" }}
        data-nex-live-heartbeat-link
      >
        {inner}
      </Link>
    );
  }
  return inner;
}
