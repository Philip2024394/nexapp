// src/app/nex-native/contacts/_card-variants/card-v3.tsx
//
// CARD V3 · "Irish Business Card" — Emerald + gold vertical stripe
// -----------------------------------------------------------------------
// Design intent: Premium Irish business-card feel. Full emerald card bg.
// A 4px gold vertical stripe runs down the left edge as the "fold" of a
// business card. Avatar in the body, two text rows (name/verified +
// profession/city), chat affordance in a gold circle on the right.

import type * as React from "react";
import Link from "next/link";
import type { ContactRowDisplay } from "../_contacts-list";
import { AvatarWithRim, VerifiedPill, MapPinIcon } from "./_shared";

interface Props {
  readonly row: ContactRowDisplay;
  readonly accentHex: string;
}

export function CardV3({ row, accentHex }: Props): React.JSX.Element {
  return (
    <Link
      href={row.chatHref}
      aria-label={`Open chat with ${row.displayName}`}
      data-nex-card-variant="v3"
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px 12px 20px",
        minHeight: 76,
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        background: "var(--nex-world-drawer-bg, #123D2B)",
        borderRadius: 10,
        borderLeft: `4px solid ${accentHex}`,
        boxShadow: "0 4px 12px rgba(18, 61, 43, 0.25)",
        textDecoration: "none",
        color: "#F2F5F8",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <AvatarWithRim
        row={row}
        size={48}
        accentHex={accentHex}
        fallbackBg={`linear-gradient(135deg, ${accentHex}cc 0%, #0A1F15 100%)`}
      />
      <div
        style={{
          flex: 1,
          minWidth: 0,
          maxWidth: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontSize: 16,
              fontWeight: 800,
              lineHeight: 1.2,
              color: "#F5A623",
              letterSpacing: "0.01em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              minWidth: 0,
            }}
          >
            {row.displayName}
          </span>
          {row.isVerified ? <VerifiedPill /> : null}
          {row.hasShop === true ? (
            <span
              aria-label="Has shop"
              title="Has shop"
              style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}
            >
              🛒
            </span>
          ) : null}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            fontWeight: 500,
            lineHeight: 1.3,
            color: "var(--nex-world-primary-ink, #AFC5B5)",
            minWidth: 0,
          }}
        >
          {row.professionLine ? (
            <span
              style={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                minWidth: 0,
              }}
            >
              {row.professionLine}
            </span>
          ) : null}
          {row.professionLine && row.city ? (
            <span aria-hidden style={{ opacity: 0.5 }}>·</span>
          ) : null}
          {row.city ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              <MapPinIcon size={9} />
              {row.city}
            </span>
          ) : null}
        </div>
      </div>
      <span
        aria-hidden
        style={{
          flexShrink: 0,
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: accentHex,
          color: "var(--nex-world-drawer-bg, #123D2B)",
          display: "grid",
          placeItems: "center",
          fontSize: 16,
          fontWeight: 900,
          boxShadow: `0 2px 8px ${accentHex}55`,
        }}
      >
        ✦
      </span>
    </Link>
  );
}
