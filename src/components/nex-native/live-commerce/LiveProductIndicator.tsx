// src/components/nex-native/live-commerce/LiveProductIndicator.tsx
//
// Phase 2 · G2 · §5.3 · Product-level Live indicator.
// -----------------------------------------------------------------------------
// Owner-authorised 2026-10-24 per saved plan §5.3.
//
// Shows a small "LIVE" chip on a product card ONLY when that product
// is currently featured in an open live session (as resolved server-
// side by `isProductFeaturedLiveNow(productId)` from the live-session-
// service). Never marks every product live just because the seller is
// broadcasting · only the ACTUAL featured product gets the indicator.
//
// Tapping the chip (when enabled) deep-links to the active broadcast
// so a viewer can jump directly from the shop to the live demonstration
// of that product. The deep-link target format is
// `/nex-native/live-commerce/<sessionId>?product=<productId>` and is
// composed by the caller · this component is purely presentational.

import * as React from "react";
import Link from "next/link";
import { useLiveClockTick } from "@/lib/nex-native/live-broadcast/use-live-clock-tick";

export interface LiveProductIndicatorProps {
  readonly isFeaturedLive: boolean;
  /** When provided + isFeaturedLive, chip is a Link to the active
   *  broadcast with the product id as a query param so the viewer
   *  surface opens with the correct pin highlighted. */
  readonly watchHref?: string | null;
  readonly label?: string;
  /** Plan v4 · AC-3/AC-5. Server-computed relative TTL (ms) from
   *  `LivenessVerdict.liveExpiresInMs`. When supplied, the chip
   *  decays client-side via the shared `useLiveClockTick` hook and
   *  hides itself at expiry · AC-6. When undefined, the chip renders
   *  indefinitely (legacy callers; new call-sites should always
   *  pass this). */
  readonly liveExpiresInMs?: number;
}

export function LiveProductIndicator(
  props: LiveProductIndicatorProps,
): React.JSX.Element | null {
  // Hook must be called unconditionally · passing POSITIVE_INFINITY
  // for the legacy no-TTL path keeps the chip visible without
  // allocating a timer (the hook short-circuits on non-finite TTL).
  const expired = useLiveClockTick(
    props.liveExpiresInMs ?? Number.POSITIVE_INFINITY,
  );
  if (!props.isFeaturedLive) return null;
  if (props.liveExpiresInMs !== undefined && expired) return null;
  const chip = (
    <span
      data-nex-live-product-indicator
      aria-label={props.label ?? "Being demonstrated live now · tap to watch"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 8px 3px 6px",
        borderRadius: 999,
        background: "#FF3355",
        color: "#FFFFFF",
        fontSize: 10,
        fontWeight: 900,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        lineHeight: 1,
        boxShadow: "0 2px 10px rgba(255, 51, 85, 0.45)",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "#FFFFFF",
          animation: "nexLiveProductDot 1400ms ease-in-out infinite",
          display: "inline-block",
        }}
      />
      <style>{`
        @keyframes nexLiveProductDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.55; transform: scale(0.78); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-nex-live-product-indicator] > span[aria-hidden] {
            animation: none !important;
          }
        }
      `}</style>
      Live
    </span>
  );
  if (props.watchHref) {
    return (
      <Link
        href={props.watchHref}
        data-nex-live-product-indicator-link
        style={{ textDecoration: "none" }}
      >
        {chip}
      </Link>
    );
  }
  return chip;
}
