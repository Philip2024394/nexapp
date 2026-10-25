// src/components/nex-native/live-commerce/ShopLiveStrip.tsx
//
// Phase 2 · G2 · subtle "LIVE now · watch →" strip for shop pages.
// -----------------------------------------------------------------------------
// Pure presentational component · consumes a derived boolean +
// optional featured-product name and renders a tap target that
// opens the broadcast. When the broadcaster is NOT live the whole
// strip renders nothing (null).
//
// Design intent: non-intrusive. The shop page keeps its full
// editorial hero · this strip docks above or below it as a thin
// banner that does not fight for attention. Carries the §5.2
// heartbeat ring semantics inline (small animated dot + "LIVE"
// pill) so there is no visual-weight competition with full avatars.

import * as React from "react";
import Link from "next/link";
import { useLiveClockTick } from "@/lib/nex-native/live-broadcast/use-live-clock-tick";

export interface ShopLiveStripProps {
  readonly isLive: boolean;
  readonly watchHref: string | null;
  readonly broadcasterLabel: string;
  readonly featuredProductName?: string | null;
  /** Plan v4 · AC-3/AC-5. Server-computed relative TTL (ms). When
   *  supplied, the strip decays client-side and hides at expiry
   *  (AC-6). When undefined, strip renders indefinitely. */
  readonly liveExpiresInMs?: number;
}

export function ShopLiveStrip(
  props: ShopLiveStripProps,
): React.JSX.Element | null {
  // Hook must be called unconditionally.
  const expired = useLiveClockTick(
    props.liveExpiresInMs ?? Number.POSITIVE_INFINITY,
  );
  if (!props.isLive || !props.watchHref) return null;
  if (props.liveExpiresInMs !== undefined && expired) return null;
  return (
    <Link
      href={props.watchHref}
      data-nex-shop-live-strip
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        borderRadius: 999,
        background:
          "linear-gradient(90deg, rgba(255,51,85,0.14) 0%, rgba(255,114,0,0.14) 100%)",
        border: "1px solid rgba(255, 51, 85, 0.5)",
        color: "#F4F7FC",
        textDecoration: "none",
        boxShadow: "0 6px 16px -8px rgba(255, 51, 85, 0.42)",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <span
        aria-hidden
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "3px 8px 3px 6px",
          borderRadius: 999,
          background: "#FF3355",
          color: "#FFFFFF",
          fontSize: 10,
          fontWeight: 900,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          lineHeight: 1,
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "#FFFFFF",
            animation: "nexShopLiveStripDot 1400ms ease-in-out infinite",
            display: "inline-block",
          }}
        />
        Live
      </span>
      <style>{`
        @keyframes nexShopLiveStripDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.55; transform: scale(0.75); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-nex-shop-live-strip] span[aria-hidden] span:first-child {
            animation: none !important;
          }
        }
      `}</style>
      <span
        data-nex-shop-live-strip-label
        style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700 }}
      >
        {props.featuredProductName
          ? `Live now · demonstrating ${props.featuredProductName}`
          : `${props.broadcasterLabel} is live now`}
      </span>
      <span aria-hidden style={{ fontSize: 14, opacity: 0.85 }}>
        Watch →
      </span>
    </Link>
  );
}
