// src/app/nex-native/contacts/_card-variants/card-v1.tsx
//
// CARD V1 · "Clean Horizon" — flat & minimalist
// -----------------------------------------------------------------------
// Design intent: Signal / iMessage-clean. No chip-overlap tricks, no
// translateY. Avatar sits inline inside the card body. Thin gold rim
// around a white card. Name in orange, profession below in muted ink,
// chevron on the right. The simplest, most legible option.

import type * as React from "react";
import Link from "next/link";
import type { ContactRowDisplay } from "../_contacts-list";
import { AvatarWithRim, VerifiedPill, MapPinIcon } from "./_shared";

interface Props {
  readonly row: ContactRowDisplay;
  readonly accentHex: string;
}

export function CardV1({ row, accentHex }: Props): React.JSX.Element {
  const hasShop = row.hasShop === true;
  const hasLocation = Boolean(row.city);
  return (
    <Link
      href={row.chatHref}
      aria-label={`Open chat with ${row.displayName}`}
      data-nex-card-variant="v1"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        minHeight: hasLocation || hasShop ? 84 : 72,
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        background: "var(--nex-world-surface, #FFFFFF)",
        border: `1px solid ${accentHex}`,
        borderRadius: 10,
        textDecoration: "none",
        color: "var(--nex-world-text-primary, #102013)",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <AvatarWithRim row={row} size={48} accentHex={accentHex} />
      <div
        style={{
          flex: 1,
          minWidth: 0,
          maxWidth: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 2,
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
              fontWeight: 700,
              lineHeight: 1.2,
              color: "#F5A623",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              minWidth: 0,
            }}
          >
            {row.displayName}
          </span>
          {row.isVerified ? <VerifiedPill /> : null}
          {hasShop ? (
            <span
              aria-label="Has shop"
              title="Has shop"
              style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}
            >
              🛒
            </span>
          ) : null}
        </div>
        {row.professionLine ? (
          <span
            style={{
              fontSize: 12,
              fontWeight: 500,
              lineHeight: 1.3,
              color: "var(--nex-world-text-muted, #7A8C7E)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {row.professionLine}
          </span>
        ) : null}
        {hasLocation ? (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11,
              fontWeight: 600,
              lineHeight: 1.2,
              color: "var(--nex-world-text-secondary, #3F5742)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            <MapPinIcon size={10} />
            {row.city}
          </span>
        ) : null}
      </div>
      <span
        aria-hidden
        style={{
          color: accentHex,
          fontSize: 20,
          fontWeight: 700,
          flexShrink: 0,
          lineHeight: 1,
        }}
      >
        ❯
      </span>
    </Link>
  );
}
