// src/app/nex-native/contacts/_card-variants/card-v2.tsx
//
// CARD V2 · "Emerald Elevated" — material depth
// -----------------------------------------------------------------------
// Design intent: Google Material / Instagram-card feel. Soft white card
// floating on cream page bg with pronounced emerald-tinted shadow.
// Rounded 16px corners. Larger avatar (56px). Name/profession clean
// hierarchy. Verified + shop badges on their own badge row.

import type * as React from "react";
import Link from "next/link";
import type { ContactRowDisplay } from "../_contacts-list";
import { AvatarWithRim, VerifiedPill, MapPinIcon, presenceLabel } from "./_shared";

interface Props {
  readonly row: ContactRowDisplay;
  readonly accentHex: string;
}

export function CardV2({ row, accentHex }: Props): React.JSX.Element {
  const lastOnline = presenceLabel(row);
  const hasShop = row.hasShop === true;
  return (
    <Link
      href={row.chatHref}
      aria-label={`Open chat with ${row.displayName}`}
      data-nex-card-variant="v2"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 16px",
        minHeight: 88,
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        background: "var(--nex-world-surface, #FFFFFF)",
        border: "1px solid transparent",
        borderRadius: 16,
        boxShadow: "0 8px 24px rgba(18, 61, 43, 0.10), 0 2px 6px rgba(18, 61, 43, 0.06)",
        textDecoration: "none",
        color: "var(--nex-world-text-primary, #102013)",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <AvatarWithRim row={row} size={56} accentHex={accentHex} />
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
              fontSize: 17,
              fontWeight: 800,
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
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {row.city ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
                fontSize: 11,
                fontWeight: 600,
                color: "var(--nex-world-text-secondary, #3F5742)",
                whiteSpace: "nowrap",
              }}
            >
              <MapPinIcon size={10} />
              {row.city}
            </span>
          ) : null}
          {hasShop ? (
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                padding: "2px 8px",
                borderRadius: 999,
                background: "var(--nex-world-primary, #1B5138)",
                color: "var(--nex-world-primary-ink, #AFC5B5)",
                whiteSpace: "nowrap",
              }}
            >
              🛒 Shop
            </span>
          ) : null}
          {lastOnline ? (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--nex-world-text-muted, #7A8C7E)",
                whiteSpace: "nowrap",
              }}
            >
              {lastOnline}
            </span>
          ) : null}
        </div>
      </div>
      {row.unreadCount && row.unreadCount > 0 ? (
        <span
          aria-label={`${row.unreadCount} unread`}
          style={{
            minWidth: 22,
            height: 22,
            padding: "0 7px",
            borderRadius: 999,
            background: "#B30000",
            color: "#FFF",
            fontSize: 11,
            fontWeight: 900,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            boxShadow: "0 2px 6px rgba(179,0,0,0.4)",
          }}
        >
          {row.unreadCount > 99 ? "99+" : row.unreadCount}
        </span>
      ) : (
        <span
          aria-hidden
          style={{
            color: accentHex,
            fontSize: 22,
            fontWeight: 700,
            flexShrink: 0,
            lineHeight: 1,
          }}
        >
          ❯
        </span>
      )}
    </Link>
  );
}
