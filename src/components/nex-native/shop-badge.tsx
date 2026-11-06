// src/components/nex-native/shop-badge.tsx
//
// Shop badge presenter · renders the 🏪 pill next to a chat name
// across chat / contacts / search surfaces.
// Owner-authorised 2026-11-06.
// -----------------------------------------------------------------------------
// Presentational component · reads the resolved ShopBadgeInfo from the
// server and renders a small gold pill linking to the shop. Variant
// prop lets callers pick:
//   · "inline"   · tiny badge sitting beside the name (default)
//   · "pill"     · larger pill with the shop name legible (used on
//                  contacts cards + chat peer header)
//   · "icon"     · 🏪 only (last-resort compact layouts)

import * as React from "react";
import Link from "next/link";
import type { ShopBadgeInfo } from "@/lib/nex-native/shop-badge-service";

const GOLD = "var(--nex-world-secondary, #C6A15B)";

export interface ShopBadgeProps {
  readonly badge: ShopBadgeInfo | null | undefined;
  readonly variant?: "inline" | "pill" | "icon";
  /** Aria-label override · defaults to "Shop · <name>". */
  readonly accessibleLabel?: string;
}

export function ShopBadge({
  badge,
  variant = "inline",
  accessibleLabel,
}: ShopBadgeProps): React.JSX.Element | null {
  if (!badge) return null;
  const href = `/nex-native/${badge.slug}`;
  const label = accessibleLabel ?? `Shop · ${badge.displayName}`;

  if (variant === "icon") {
    return (
      <Link
        href={href}
        aria-label={label}
        title={label}
        data-nex-shop-badge="icon"
        style={{
          display: "inline-grid",
          placeItems: "center",
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: GOLD,
          color: "#1A120A",
          textDecoration: "none",
          fontSize: 11,
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        🏪
      </Link>
    );
  }

  if (variant === "pill") {
    return (
      <Link
        href={href}
        aria-label={label}
        title={label}
        data-nex-shop-badge="pill"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "3px 10px",
          borderRadius: 999,
          background: GOLD,
          color: "#1A120A",
          textDecoration: "none",
          fontSize: 10.5,
          fontWeight: 900,
          letterSpacing: "0.04em",
          flexShrink: 0,
          lineHeight: 1,
        }}
      >
        <span aria-hidden style={{ fontSize: 11 }}>🏪</span>
        <span
          style={{
            maxWidth: 140,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {badge.displayName}
        </span>
      </Link>
    );
  }

  // Default "inline" · emoji + accent text, no bg.
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      data-nex-shop-badge="inline"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        color: GOLD,
        textDecoration: "none",
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: "0.04em",
        flexShrink: 0,
        lineHeight: 1,
      }}
    >
      <span aria-hidden style={{ fontSize: 12 }}>🏪</span>
      <span
        style={{
          maxWidth: 120,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {badge.displayName}
      </span>
    </Link>
  );
}
