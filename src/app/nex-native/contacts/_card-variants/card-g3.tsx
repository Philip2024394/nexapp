// src/app/nex-native/contacts/_card-variants/card-g3.tsx
//
// CARD G3 · "Emerald Executive"
// -----------------------------------------------------------------------
// Design intent: executive Emerald card with a gold DOUBLE-rim — outer
// 1px gold border AND an inner 1px gold accent 3px inside. Reads as a
// framed exec portrait. Name bold orange · profession + city on the
// second line · gold circle action affordance on the right. 80px tall.

import type * as React from "react";
import Link from "next/link";
import type { ContactRowDisplay } from "../_contacts-list";
import { AvatarWithRim, VerifiedPill, MapPinIcon } from "./_shared";

interface Props {
  readonly row: ContactRowDisplay;
  readonly accentHex: string;
}

export function CardG3({ row, accentHex }: Props): React.JSX.Element {
  return (
    <Link
      href={row.chatHref}
      aria-label={`Open chat with ${row.displayName}`}
      data-nex-card-variant="g3"
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "14px 14px",
        minHeight: 80,
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        background: "var(--nex-world-drawer-bg, #123D2B)",
        border: `1px solid ${accentHex}`,
        borderRadius: 12,
        boxShadow: `inset 0 0 0 1px rgba(10,31,21,0.9), inset 0 0 0 2px ${accentHex}aa, 0 6px 16px rgba(10, 31, 21, 0.3)`,
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
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
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
          boxShadow: `0 2px 10px ${accentHex}55, inset 0 1px 0 rgba(255,255,255,0.3)`,
        }}
      >
        ✦
      </span>
    </Link>
  );
}
