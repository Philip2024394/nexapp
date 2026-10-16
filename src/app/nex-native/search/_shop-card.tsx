// src/app/nex-native/search/_shop-card.tsx
//
// NEX Discover shop card · redesigned 2026-10-13 to match the
// founder-supplied `new card.png` reference exactly.
// -----------------------------------------------------------
// Minimal layout:
//
//   ┌─────────────────────────────────────┐
//   │       16:9 cover image              │
//   │  ┌───────────┐                      │
//   │  │ priya.nex │ ← handle tag         │
//   │  └───────────┘                      │
//   ├─────────────────────────────────────┤
//   │  💬ᵒ Priya's Mumbai Cafe             │
//   │     Café · Bandra West, Mumbai       │
//   │  Family recipes, freshly brewed…    │
//   │  ┌───────────┐ ┌──────────────────┐ │
//   │  │ View menu │ │ Chat with owner  │ │
//   │  └───────────┘ └──────────────────┘ │
//   └─────────────────────────────────────┘
//
// EVERYTHING previously overlaid on the cover (rating chip / open-now
// badge / distance pill / price pill / currency hint / promo bubbles
// / Safe Trade shield / profile avatar / spice indicator) is NOT
// rendered here. Those component files still exist for future reuse
// but are no longer imported from the card. See git log for the
// older richer card if we need to bring any of it back.

import Link from "next/link";
import type { CSSProperties } from "react";
import type { NexBusinessRow } from "@/lib/nex-native/types";
import { categoryGradient, categoryEmoji, categoryKindLabel } from "./_card-helpers";
import { SafeTradeBadge } from "./_safe-trade-badge";
import { resolveSafeTradeStatus } from "@/lib/nex-native/safe-trade-status";
import { DiscountPill } from "./_discount-pill";
import type { DiscoverCardContext } from "@/lib/nex-native/discover-card-context";

const NEX = {
  cardBg: "#0A1120",             // very dark navy · the card's own background
  cardBorder: "rgba(255,255,255,0.08)",
  text: "#F2F5F8",
  textMuted: "#8BA9D1",
  textDim: "#B5C3D6",
  orange: "#FF7200",
  cyan: "#00AFFF",
  handleBg: "rgba(10,17,32,0.78)", // bottom-left handle tag
  handleBorder: "rgba(255,255,255,0.14)",
};

export type ShopCardPresence = "online" | "away" | "offline" | "unknown";

interface ShopCardProps {
  readonly row: NexBusinessRow;
  readonly distanceKm: number | null; // unused in this design · kept for signature stability
  readonly cardCtx: DiscoverCardContext | null;
  readonly presence?: ShopCardPresence;
  readonly viewerCountryIso?: string | null;
}

export function ShopCard({ row, cardCtx }: ShopCardProps): React.JSX.Element {
  const niceKind = categoryKindLabel(row.business_category);
  const emoji = categoryEmoji(row.business_category);
  const gradient = categoryGradient(row.business_category);
  const city = row.city ?? row.address ?? null;
  const description =
    row.description && row.description.trim().length > 0
      ? row.description
      : row.status_message ?? null;

  const hasChattableOwner =
    typeof row.owner_account_id === "string" && row.owner_account_id.length > 0;
  const ownerChatHref = hasChattableOwner
    ? `/nex-native/chat/peer/${row.owner_account_id}`
    : null;
  const shopHref = `/nex-native/${row.slug}`;

  // Handle tag · only for claimed shops with a human-readable slug.
  // Directory canonical rows use UUID slugs which would read as noise.
  const nexHandle =
    hasChattableOwner && isHumanSlug(row.slug) ? `${row.slug}.nex` : null;

  return (
    <article
      style={{
        background: NEX.cardBg,
        border: `1px solid ${NEX.cardBorder}`,
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: "0 6px 24px rgba(0,0,0,0.35)",
      }}
    >
      {/* ─── Cover · just the image, no overlays ─── */}
      <div
        style={{
          position: "relative",
          aspectRatio: "16 / 9",
          background: gradient,
          overflow: "hidden",
        }}
      >
        {row.logo_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={row.logo_url}
            alt=""
            loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              fontSize: 54,
              opacity: 0.65,
            }}
          >
            {emoji}
          </div>
        )}

        {/* Single-slot discount pill · top-right of cover · shows
            the primary active promo (position=1 preferred, else first
            live). Honest-null when the business has no active promo. */}
        <DiscountPill
          promos={cardCtx?.promos ?? []}
          businessName={row.display_name}
        />

        {/* Handle tag · dark pill, bottom-left */}
        {nexHandle ? (
          <span
            data-nex-shop-card-handle
            style={{
              position: "absolute",
              left: 10,
              bottom: 10,
              padding: "4px 10px",
              borderRadius: 999,
              background: NEX.handleBg,
              border: `1px solid ${NEX.handleBorder}`,
              color: NEX.text,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.01em",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
              whiteSpace: "nowrap",
            }}
          >
            {nexHandle}
          </span>
        ) : null}
      </div>

      {/* ─── Body ─── */}
      <div style={{ padding: "14px 14px 14px" }}>
        {/* Title row · Safe Trade shield (identity + sheet opener)
            on the left of the business name. The shield's corner dot
            colour encodes the Safe Trade / Safe Meal / Safe Stay
            state (New / Verified / Flagged / Suspended / Unclaimed). */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <SafeTradeBadge
            businessName={row.display_name}
            snapshot={resolveSafeTradeStatus(row)}
          />
          <h3
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 700,
              color: NEX.text,
              letterSpacing: "-0.01em",
              lineHeight: 1.25,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
              minWidth: 0,
            }}
          >
            {row.display_name}
          </h3>
        </div>

        {/* Subtitle · category · city · aligned under the title text,
            padded past the Safe Trade shield (32px) + gap (10px). */}
        <div
          style={{
            marginTop: 4,
            paddingLeft: 42,
            fontSize: 12,
            color: NEX.textMuted,
            lineHeight: 1.4,
          }}
        >
          {niceKind}
          {city ? ` · ${city}` : ""}
        </div>

        {/* Description · 2 lines max */}
        {description ? (
          <p
            style={{
              margin: "10px 0 0",
              fontSize: 12.5,
              color: NEX.textDim,
              lineHeight: 1.5,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {description}
          </p>
        ) : null}

        {/* CTA row · equal-width split · identical height */}
        <div
          style={{
            marginTop: 14,
            display: "flex",
            gap: 10,
          }}
        >
          <Link href={shopHref} style={viewMenuBtn}>
            View menu
          </Link>
          {ownerChatHref ? (
            <Link href={ownerChatHref} style={chatBtn}>
              Chat with owner
            </Link>
          ) : (
            <span style={unclaimedBadge} aria-label="Unclaimed listing">
              Directory listing
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

// ─── Button styles · identical height · equal width via flex ────────

const CTA_HEIGHT = 40;

const viewMenuBtn: CSSProperties = {
  flex: "1 1 0",
  height: CTA_HEIGHT,
  padding: "0 14px",
  borderRadius: 10,
  border: `1px solid rgba(0,175,255,0.4)`,
  background: "transparent",
  color: NEX.cyan,
  fontSize: 13,
  fontWeight: 700,
  textDecoration: "none",
  letterSpacing: "0.01em",
  textAlign: "center",
  boxSizing: "border-box",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  lineHeight: 1,
};

const chatBtn: CSSProperties = {
  flex: "1 1 0",
  height: CTA_HEIGHT,
  padding: "0 14px",
  borderRadius: 10,
  border: "1px solid transparent",
  background: NEX.orange,
  color: "#FFFFFF",
  fontSize: 13,
  fontWeight: 700,
  textDecoration: "none",
  letterSpacing: "0.01em",
  textAlign: "center",
  boxShadow: `0 4px 10px rgba(255,114,0,0.4)`,
  boxSizing: "border-box",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  lineHeight: 1,
};

const unclaimedBadge: CSSProperties = {
  flex: "1 1 0",
  height: CTA_HEIGHT,
  padding: "0 12px",
  borderRadius: 10,
  border: "1px dashed rgba(255,255,255,0.14)",
  background: "transparent",
  color: "#6B82A5",
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.03em",
  textTransform: "uppercase",
  textAlign: "center",
  boxSizing: "border-box",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  lineHeight: 1,
};

// ─── Helpers ────────────────────────────────────────────────────────

/** True when a slug looks human-friendly (letters, hyphens, 3-40 chars)
 *  as opposed to a UUID. Directory canonical rows carry UUID slugs
 *  which should NOT be rendered as `uuid.nex` tags on the cover. */
function isHumanSlug(slug: string | null | undefined): boolean {
  if (typeof slug !== "string") return false;
  if (slug.length < 3 || slug.length > 40) return false;
  // UUIDs contain hyphens at specific positions (8-4-4-4-12). Reject
  // anything that looks like one.
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug))
    return false;
  // Allow lowercase letters, digits, hyphens, dots, underscores.
  return /^[a-z0-9][a-z0-9._-]*$/i.test(slug);
}
