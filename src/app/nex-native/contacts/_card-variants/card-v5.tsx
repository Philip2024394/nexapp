// src/app/nex-native/contacts/_card-variants/card-v5.tsx
//
// CARD V5 · "Spacious Hero" — generous premium
// -----------------------------------------------------------------------
// Design intent: luxurious, hero-portrait feel. Full-width tall card.
// Large 64px avatar on the left. Multiple metadata rows (name + verified
// pill, profession, city with pin, shop badge). Forest-green CTA chat
// button on the right. Lots of breathing room.

import type * as React from "react";
import Link from "next/link";
import type { ContactRowDisplay } from "../_contacts-list";
import {
  AvatarWithRim,
  VerifiedPill,
  MapPinIcon,
  presenceLabel,
} from "./_shared";

interface Props {
  readonly row: ContactRowDisplay;
  readonly accentHex: string;
}

export function CardV5({ row, accentHex }: Props): React.JSX.Element {
  const lastOnline = presenceLabel(row);
  const hasShop = row.hasShop === true;
  return (
    <Link
      href={row.chatHref}
      aria-label={`Open chat with ${row.displayName}`}
      data-nex-card-variant="v5"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "16px 16px 16px 18px",
        minHeight: 108,
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        background: "var(--nex-world-surface, #FFFFFF)",
        border: `1px solid ${accentHex}`,
        borderRadius: 14,
        boxShadow:
          "0 12px 28px rgba(18, 61, 43, 0.14), 0 4px 10px rgba(18, 61, 43, 0.06)",
        textDecoration: "none",
        color: "var(--nex-world-text-primary, #102013)",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <AvatarWithRim row={row} size={64} accentHex={accentHex} />
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
              fontSize: 18,
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
        </div>
        {row.professionLine ? (
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              lineHeight: 1.3,
              color: "var(--nex-world-text-secondary, #3F5742)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {row.professionLine}
          </span>
        ) : null}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 11,
            fontWeight: 600,
            color: "var(--nex-world-text-muted, #7A8C7E)",
            minWidth: 0,
          }}
        >
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
              <MapPinIcon size={10} />
              {row.city}
            </span>
          ) : null}
          {hasShop ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
                padding: "2px 8px",
                borderRadius: 999,
                background: "var(--nex-world-primary, #1B5138)",
                color: "var(--nex-world-primary-ink, #AFC5B5)",
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                flexShrink: 0,
              }}
            >
              🛒 Shop
            </span>
          ) : null}
          {lastOnline ? (
            <span
              style={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                minWidth: 0,
              }}
            >
              {lastOnline}
            </span>
          ) : null}
        </div>
      </div>
      <span
        aria-hidden
        style={{
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          padding: "10px 16px",
          background: "var(--nex-world-primary, #1B5138)",
          color: "var(--nex-world-primary-ink, #AFC5B5)",
          borderRadius: 10,
          fontSize: 13,
          fontWeight: 800,
          letterSpacing: "0.02em",
          boxShadow: "0 4px 12px rgba(18, 61, 43, 0.2)",
        }}
      >
        Chat
      </span>
    </Link>
  );
}
