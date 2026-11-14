"use client";

// src/app/nex-native/_cover/primitives.tsx
//
// Cover primitive library · Founder-sealed 2026-09-30.
// -------------------------------------------------------------------
// Every primitive reads CSS custom properties exposed by
// <CoverThemeSkin>. No primitive hardcodes palette values, wallpaper,
// or bubble geometry — they all inherit the theme's visual DNA.
//
// Primitives (this file):
//   · CoverIdentityBadge  · portrait + ping ring + charm + name
//   · CoverChatCTA        · primary action button (accent-filled)
//   · CoverSecondaryCTA   · secondary button (accent-outlined)
//   · CoverSectionHeading · section header with accent underline
//   · CoverProductCard    · one product tile (inherits bubbleStyle)
//   · CoverProductGrid    · N-column responsive grid of cards
//   · CoverIdentityRail   · discovery rail (social + handle + location)
//   · CoverStickyBar      · bottom-fixed conversion bar
//
// Layouts (Café, Restaurant, etc.) COMPOSE these · they do not build
// their own visual primitives. That's the doctrine that keeps a
// Pink Dream × Café cover unmistakably Pink Dream.

import * as React from "react";
import Link from "next/link";
import { SocialBrandIcon } from "@/components/nex-native/social/brand-icon";

// ─── Charm glyph registry ────────────────────────────────────────────
// One SVG per theme "family." Themes without a bespoke charm get a
// generic diamond so the identity badge is never empty.

function CharmGlyph({
  themeId,
  size = 22,
}: {
  themeId: string;
  size?: number;
}): React.JSX.Element {
  const stroke = "var(--nex-accent)";
  const fill = "var(--nex-accent-faint)";
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    "aria-hidden": true as const,
    style: { display: "block" },
  };

  // Match by family so 20+ themes don't all need a bespoke SVG.
  if (
    themeId === "pink-dream" ||
    themeId === "twilight-rose" ||
    themeId === "rose-garden" ||
    themeId === "coral-reef"
  ) {
    // Heart
    return (
      <svg {...props}>
        <path
          d="M12 20.5s-7-4.35-9.3-9.05C1.3 8.6 2.8 5.5 5.8 5.5c1.7 0 3.1 0.9 4.2 2.3C11.1 6.4 12.5 5.5 14.2 5.5c3 0 4.5 3.1 3.1 5.95C19 16.15 12 20.5 12 20.5z"
          stroke={stroke}
          strokeWidth="1.6"
          strokeLinejoin="round"
          fill={fill}
        />
      </svg>
    );
  }
  if (themeId === "theme-1" || themeId === "arctic-fjord" || themeId === "aurora-ridge" || themeId === "ice-crystal") {
    // Camera
    return (
      <svg {...props}>
        <path
          d="M4 9h3l1.5-2h7L17 9h3v10H4z"
          stroke={stroke}
          strokeWidth="1.6"
          strokeLinejoin="round"
          fill={fill}
        />
        <circle cx="12" cy="14" r="3.2" stroke={stroke} strokeWidth="1.6" fill="none" />
      </svg>
    );
  }
  if (themeId === "cyber-grid") {
    // </>
    return (
      <svg {...props}>
        <path d="M9 8l-4 4 4 4M15 8l4 4-4 4M13.5 6l-3 12" stroke={stroke} strokeWidth="1.7" strokeLinecap="round" fill="none" />
      </svg>
    );
  }
  if (themeId === "cafe" || themeId === "sahara-gold" || themeId === "copper-dusk" || themeId === "desert-ember") {
    // Coffee cup
    return (
      <svg {...props}>
        <path d="M5 10h11v6a3 3 0 01-3 3H8a3 3 0 01-3-3z" stroke={stroke} strokeWidth="1.6" strokeLinejoin="round" fill={fill} />
        <path d="M16 12h2.5a1.5 1.5 0 010 3H16" stroke={stroke} strokeWidth="1.6" strokeLinejoin="round" fill="none" />
        <path d="M8 7c0-1 1-1 1-2M12 7c0-1 1-1 1-2" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" fill="none" />
      </svg>
    );
  }
  if (themeId === "forest-whisper" || themeId === "jade-meridian" || themeId === "emerald-city" || themeId === "ocean-depth") {
    // Leaf
    return (
      <svg {...props}>
        <path
          d="M5 19c0-7 4-13 14-14-1 10-7 14-14 14zm0 0c2-3 5-5 9-6"
          stroke={stroke}
          strokeWidth="1.6"
          strokeLinejoin="round"
          strokeLinecap="round"
          fill={fill}
        />
      </svg>
    );
  }
  if (themeId === "cosmic-purple" || themeId === "deep-space") {
    // Star
    return (
      <svg {...props}>
        <path
          d="M12 3l2.4 5.9L20 10l-4.6 3.6L17 20l-5-3.4L7 20l1.6-6.4L4 10l5.6-1.1z"
          stroke={stroke}
          strokeWidth="1.5"
          strokeLinejoin="round"
          fill={fill}
        />
      </svg>
    );
  }
  if (themeId === "neon-tokyo" || themeId === "volcanic" || themeId === "sunset-peak") {
    // Bolt
    return (
      <svg {...props}>
        <path
          d="M13 3L4 14h6l-1 7 9-11h-6z"
          stroke={stroke}
          strokeWidth="1.6"
          strokeLinejoin="round"
          fill={fill}
        />
      </svg>
    );
  }
  // Generic diamond fallback so identity is never charmless.
  return (
    <svg {...props}>
      <path
        d="M12 3l9 9-9 9-9-9z"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill={fill}
      />
    </svg>
  );
}

// ─── Identity badge ──────────────────────────────────────────────────

export interface CoverIdentityBadgeProps {
  portraitUrl: string | null;
  name: string;
  subtitle: string;
  themeId: string;
  presenceOnline?: boolean;
  size?: "hero" | "compact";
  /** Founder direction 2026-09-30 · ISO 3166-1 alpha-2 country code
   *  ("ID", "GB", "US"). Renders a small round flag badge in the
   *  bottom-right of the portrait circle where the theme charm used
   *  to sit. Optional · falls back to nothing when absent. */
  countryCode?: string | null;
  /** Owner directive 2026-11-06 · "this should be under business
   *  name 1 row · Dublin, Ireland and same on front shop page".
   *  Location city/region (e.g. "Dublin, Ireland") rendered as a
   *  single compact line directly under the business name with a
   *  small pin glyph. Optional · when null the row is skipped. */
  location?: string | null;
}

/**
 * Convert an ISO 3166-1 alpha-2 country code to its flag emoji using
 * Unicode regional indicator symbols. Returns null for invalid codes.
 */
function countryCodeToFlagEmoji(code: string | null | undefined): string | null {
  if (!code) return null;
  const trimmed = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(trimmed)) return null;
  const A = 0x1f1e6;
  const base = "A".charCodeAt(0);
  return (
    String.fromCodePoint(A + (trimmed.charCodeAt(0) - base)) +
    String.fromCodePoint(A + (trimmed.charCodeAt(1) - base))
  );
}

export function CoverIdentityBadge(
  props: CoverIdentityBadgeProps,
): React.JSX.Element {
  // Owner directive 2026-11-12 (second pass) · portrait grown 20%
  // from 48 → 58. Still smaller than the sealed 80 reference but
  // noticeably bigger than the chat-header 48 so the shop identity
  // reads as the anchor on the template.
  const isHero = false;
  void props.size;
  const portraitSize = 58;
  return (
    <>
      <style>{`
        @keyframes nex-cover-ping {
          0%   { transform: scale(1);    opacity: 0.55; }
          80%  { transform: scale(1.7);  opacity: 0; }
          100% { transform: scale(1.7);  opacity: 0; }
        }
        [data-nex-cover-ping] {
          position: absolute;
          inset: -4px;
          border-radius: 50%;
          border: 2px solid #22C55E;
          animation: nex-cover-ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
          pointer-events: none;
        }
        [data-nex-cover-ping-2] { animation-delay: 1s; }
      `}</style>
      <div
        data-nex-cover-rise
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            position: "relative",
            width: portraitSize,
            height: portraitSize,
            flexShrink: 0,
          }}
        >
          {/* Owner directive 2026-11-12 · shop portrait ALWAYS wears a
              green rim + green ping · supersedes the presence-gated
              model. Shop identity on NEX reads as "live and reachable"
              as a brand standard, not as a conditional presence cue. */}
          <span aria-hidden data-nex-cover-ping />
          <span aria-hidden data-nex-cover-ping data-nex-cover-ping-2 />
          <div
            aria-hidden
            style={{
              position: "relative",
              width: portraitSize,
              height: portraitSize,
              borderRadius: "50%",
              backgroundImage: props.portraitUrl
                ? `url(${props.portraitUrl})`
                : `linear-gradient(135deg, var(--nex-accent-soft) 0%, var(--nex-panel) 100%)`,
              backgroundSize: "cover",
              backgroundPosition: "center 30%",
              // Owner directive 2026-11-12 · rim locked to NEX presence
              // green (#16D66B) across all themes · was theme accent.
              border: "2px solid #16D66B",
              boxShadow:
                "0 6px 22px rgba(0,0,0,0.45), 0 0 18px rgba(22, 214, 107, 0.45)",
              display: "grid",
              placeItems: "center",
              color: "var(--nex-text)",
              fontFamily: "var(--nex-font-display)",
              fontWeight: 700,
              fontSize: 30,
            }}
          >
            {!props.portraitUrl && initials(props.name)}
          </div>
          {/* Founder direction 2026-09-30 · the theme charm circle used
              to sit here. Replaced by a small round country-flag badge
              showing which country the seller/restaurant is from. Falls
              back to nothing when countryCode is absent (older mock
              rows). Kept the same bottom-right anchor and shadow so the
              silhouette of the portrait unit is preserved. */}
          {(() => {
            const flag = countryCodeToFlagEmoji(props.countryCode);
            if (!flag) return null;
            // Founder direction 2026-09-30 (revised) · flag circle
            // reduced 20% (36 -> 29) so it sits as a subtler accent
            // rather than a competing badge. Unified across every
            // template via the shared CoverIdentityBadge.
            const badgeSize = 29;
            return (
              <div
                aria-label={`Country ${props.countryCode}`}
                title={props.countryCode ?? undefined}
                style={{
                  position: "absolute",
                  bottom: -4,
                  right: -4,
                  width: badgeSize,
                  height: badgeSize,
                  borderRadius: "50%",
                  background: "var(--nex-panel, #050f1e)",
                  border: "2px solid var(--nex-accent)",
                  display: "grid",
                  placeItems: "center",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.55)",
                  overflow: "hidden",
                  fontSize: 19,
                  lineHeight: 1,
                }}
              >
                {flag}
              </div>
            );
          })()}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontFamily: "var(--nex-font-display)",
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: "-0.015em",
              lineHeight: 1.15,
              textShadow: "0 2px 8px rgba(0,0,0,0.55)",
              // Founder direction 2026-09-30 (revised) · fit the whole
              // business name. One line ideally · wraps to a SECOND
              // line for extra-long names · never a third (clamped
              // with an ellipsis after two lines).
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              wordBreak: "break-word",
            }}
          >
            {props.name}
          </div>
          {/* Owner directive 2026-11-06 · location single-row under
              business name · pin glyph + city/country · same shape
              as the About Us overlay header so the two surfaces
              feel continuous. Rendered BEFORE the subtitle so the
              location anchors the identity even on taglines-empty
              mocks. */}
          {props.location && (
            <div
              style={{
                marginTop: 2,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                color: "var(--nex-text-dim)",
                letterSpacing: "0.02em",
                lineHeight: 1.3,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                textShadow: "0 1px 4px rgba(0,0,0,0.65)",
              }}
            >
              <span
                aria-hidden
                style={{
                  color: "var(--nex-accent)",
                  fontSize: 12,
                  lineHeight: 1,
                }}
              >
                📍
              </span>
              {props.location}
            </div>
          )}
          <div
            style={{
              marginTop: 2,
              fontSize: 11,
              color: "var(--nex-text-dim)",
              letterSpacing: "0.02em",
              lineHeight: 1.35,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              textShadow: "0 1px 4px rgba(0,0,0,0.65)",
            }}
          >
            {props.subtitle}
          </div>
          {props.presenceOnline && (
            <div
              style={{
                marginTop: 4,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 10,
                fontWeight: 700,
                // Founder direction 2026-09-30 · online marker uses
                // the universal green (WhatsApp / iMessage convention)
                // rather than the theme accent · reads instantly as
                // "online" across every theme. Renders on both hero
                // and compact sizes.
                color: "#22C55E",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#22C55E",
                  boxShadow: "0 0 10px rgba(34,197,94,0.55)",
                }}
              />
              online now
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const a = parts[0]?.[0] ?? "";
  const b = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (a + b).toUpperCase();
}

// ─── CTAs ────────────────────────────────────────────────────────────

export function CoverChatCTA({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <>
      <style>{`
        [data-nex-cover-chat-cta] {
          position: relative;
          transition: transform 220ms ease, box-shadow 220ms ease;
        }
        [data-nex-cover-chat-cta]:hover,
        [data-nex-cover-chat-cta]:focus-visible {
          transform: translateY(-1px);
          box-shadow: 0 14px 36px rgba(0,0,0,0.55), 0 0 22px var(--nex-accent-glow);
        }
        [data-nex-cover-chat-cta]:active {
          transform: translateY(1px);
        }
      `}</style>
      <Link
        href={href}
        data-nex-cover-chat-cta
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: "14px 24px",
          borderRadius: 999,
          background: "var(--nex-accent)",
          color: "#fff",
          fontFamily: "var(--nex-font-display)",
          fontSize: 15,
          fontWeight: 700,
          letterSpacing: "0.01em",
          textDecoration: "none",
          border: "1px solid var(--nex-accent)",
          boxShadow:
            "0 10px 26px rgba(0,0,0,0.45), 0 0 18px var(--nex-accent-glow)",
        }}
      >
        {children}
      </Link>
    </>
  );
}

export function CoverSecondaryCTA({
  href,
  children,
  onClick,
}: {
  href?: string;
  children: React.ReactNode;
  onClick?: () => void;
}): React.JSX.Element {
  const styleObj: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "10px 16px",
    borderRadius: 999,
    background: "transparent",
    color: "var(--nex-text)",
    fontFamily: "var(--nex-font-body)",
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: "0.02em",
    textDecoration: "none",
    border: "1px solid var(--nex-accent-soft)",
    cursor: "pointer",
  };
  if (href) {
    return (
      <Link href={href} style={styleObj}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} style={styleObj}>
      {children}
    </button>
  );
}

// ─── Section heading ─────────────────────────────────────────────────

export function CoverSectionHeading({
  eyebrow,
  title,
  rightSlot,
}: {
  eyebrow?: string;
  title: string;
  /** Founder direction 2026-09-30 · optional right-aligned node
   *  rendered on the same row as the title (e.g. product count badge,
   *  status chip). Callers that don't provide it get the same layout
   *  as before. */
  rightSlot?: React.ReactNode;
}): React.JSX.Element {
  return (
    <div style={{ marginBottom: 14 }}>
      {eyebrow && (
        /* Owner directive 2026-11-06 · eyebrow upsized to 14 + 900
           weight so "Services" reads as a bold section marker, not
           a whispered caption. */
        <div
          style={{
            fontSize: 14,
            fontWeight: 900,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--nex-accent)",
            marginBottom: 6,
          }}
        >
          {eyebrow}
        </div>
      )}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        {/* Founder direction 2026-09-30 · remove the small accent-coloured
            dash that used to sit before the title. Title now stands alone
            for a cleaner heading. */}
        <h2
          /* Owner directive 2026-11-06 · section-heading title shrunk
             from 20 → 12 · the heading sits alongside the (smaller)
             products beneath it and used to over-emphasise the
             shipping-scope label. */
          style={{
            margin: 0,
            fontFamily: "var(--nex-font-display)",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            textShadow: "0 1px 4px rgba(0,0,0,0.55)",
            minWidth: 0,
          }}
        >
          {title}
        </h2>
        {rightSlot && (
          <div style={{ flex: "0 0 auto" }}>{rightSlot}</div>
        )}
      </div>
    </div>
  );
}

// ─── Product card + grid ─────────────────────────────────────────────

export interface CoverProduct {
  id: string;
  slug: string | null;
  name: string;
  price_pence: number;
  currency: string;
  image_url: string | null;
  stock_status: string | null;
  section_id?: string | null;
  /** Short 2-line description shown on the CoverProductCard between
   *  name and price. Clamped visually to 2 lines. Optional · card
   *  hides the row when absent. */
  description?: string | null;
}

// ─── Category Tabs (sealed 2026-09-30) ────────────────────────────────
// Per-shop grouping displayed above the product/menu grid AND above the
// peer-chat shop slider. Same primitive · same UX · zero drift.
// One-word cap 3 rule enforced at form/service layer NOT here.

export interface CoverSection {
  id: string;
  name: string;
  sort_order?: number;
}

/**
 * ALL_TAB_ID is the sentinel used for the always-first "All" tab.
 * When active, filters are cleared and every card renders (including
 * uncategorised items with section_id === null).
 */
export const ALL_TAB_ID = "__all__";

export function CoverCategoryTabs({
  sections,
  activeId,
  onSelect,
  maxDisplay = 3,
}: {
  sections: CoverSection[];
  activeId: string;
  onSelect: (id: string) => void;
  maxDisplay?: number;
}): React.JSX.Element | null {
  // Founder ruling: 0-1 sections hide the picker entirely.
  if (sections.length <= 1) return null;

  const ordered = [...sections].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );
  const visible = ordered.slice(0, maxDisplay);

  /* Owner directive 2026-11-06 · "change these to drop down slider
     Category 1 / Category 2 / Category 3". The horizontal underline-
     tabs pattern is gone · a native-styled <select> now carries the
     same semantics: empty value = unfiltered (All), picking a
     category id filters the grid. Matches the dropdown shape used
     on /manage/shop/backgrounds for consistency. Keeping the
     component name + prop shape so every layout keeps compiling. */

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        marginBottom: 14,
      }}
    >
      <select
        aria-label="Filter by category"
        value={activeId}
        onChange={(e) => onSelect(e.currentTarget.value)}
        data-nex-cover-category-select
        style={{
          appearance: "none",
          WebkitAppearance: "none",
          MozAppearance: "none",
          width: "100%",
          padding: "10px 36px 10px 14px",
          background: "rgba(5, 15, 28, 0.72)",
          color: "var(--nex-text)",
          border: "1px solid var(--nex-accent-soft, rgba(198,161,91,0.55))",
          borderRadius: 10,
          fontFamily: "var(--nex-font-body)",
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: "0.02em",
          cursor: "pointer",
          textTransform: "capitalize",
        }}
      >
        <option value="">All categories · {ordered.length}</option>
        {visible.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <span
        aria-hidden
        style={{
          position: "absolute",
          right: 14,
          pointerEvents: "none",
          color: "var(--nex-accent)",
          fontSize: 10,
          fontWeight: 900,
        }}
      >
        ▼
      </span>
    </div>
  );
}

export function CoverProductCard({
  product,
  peerAccountId,
  eyebrow,
  variant = "grid",
}: {
  product: CoverProduct;
  peerAccountId: string;
  eyebrow?: string | null;
  /** Founder direction 2026-09-30 · "grid" (default) renders the
   *  square-image tile stacked above the meta column. "landscape"
   *  renders the image on the LEFT (fixed square) and the meta column
   *  on the RIGHT · used by Template 11 (Product Seller · Landscape).
   *  "round" renders the image as a circle with a small magnifier
   *  button on the rim and the product name centred below · used by
   *  Template 14 (Personal Brand · Round Products). */
  variant?: "grid" | "landscape" | "round";
}): React.JSX.Element {
  const soldOut = product.stock_status === "sold_out";
  const priceLabel = formatMoney(product.currency, product.price_pence);
  // Owner directive 2026-11-14 · pending_product share-to-chat flow
  // retired. Tapping a product card opens the plain peer-chat with no
  // product chip pre-attached. The 2026-10-22 slice-5 chip pipeline
  // (pending_product → server-fetched snapshot → composer chip →
  // shareProductToContactAction) is no longer wired from this entry.
  const chatHref = `/nex-native/chat/peer/${peerAccountId}`;
  const isLandscape = variant === "landscape";
  const isRound = variant === "round";
  if (isRound) {
    return (
      <>
        <style>{`
          [data-nex-cover-product-round] {
            transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1);
          }
          [data-nex-cover-product-round]:hover,
          [data-nex-cover-product-round]:focus-visible {
            transform: translateY(-3px);
          }
          [data-nex-cover-product-round]:hover [data-nex-cover-round-image],
          [data-nex-cover-product-round]:focus-visible [data-nex-cover-round-image] {
            box-shadow:
              0 12px 28px rgba(0,0,0,0.55),
              0 0 20px var(--nex-accent-glow);
          }
        `}</style>
        <Link
          href={chatHref}
          data-nex-cover-product-round
          style={{
            display: "grid",
            gap: 8,
            justifyItems: "center",
            padding: "4px 2px",
            textDecoration: "none",
            color: "var(--nex-text)",
            opacity: soldOut ? 0.7 : 1,
          }}
        >
          {/* Founder direction 2026-09-30 (revised) · outer rim-anchor
              wrapper is position:relative WITHOUT overflow:hidden so
              the magnifier button can protrude past the circle rim.
              Circle image sits absolutely inset:0 inside it, keeping
              its own overflow:hidden for the placeholder cross clip. */}
          <div
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: "1 / 1",
            }}
          >
            <div
              data-nex-cover-round-image
              aria-hidden={!!product.image_url}
              role={product.image_url ? undefined : "img"}
              aria-label={product.image_url ? undefined : "Image placeholder"}
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                border: "1px solid var(--nex-accent-soft)",
                boxShadow: "0 6px 18px rgba(0,0,0,0.4)",
                overflow: "hidden",
                backgroundImage: product.image_url
                  ? `url(${product.image_url})`
                  : undefined,
                // Founder direction 2026-09-30 · SOLID navy fill for
                // the round placeholder · matches the Images tab tile
                // treatment · no accent gradient bleed.
                background: product.image_url ? undefined : "#0a1120",
                backgroundSize: "cover",
                backgroundPosition: "center",
                display: !product.image_url ? "grid" : undefined,
                placeItems: !product.image_url ? "center" : undefined,
                transition: "box-shadow 260ms cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            >
              {!product.image_url && (
                <>
                  <svg
                    aria-hidden
                    width="100%"
                    height="100%"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    style={{
                      position: "absolute",
                      inset: 0,
                      opacity: 0.22,
                      color: "var(--nex-accent, #FF3F9F)",
                    }}
                  >
                    <line
                      x1="0"
                      y1="0"
                      x2="100"
                      y2="100"
                      stroke="currentColor"
                      strokeWidth="0.6"
                      vectorEffect="non-scaling-stroke"
                    />
                    <line
                      x1="100"
                      y1="0"
                      x2="0"
                      y2="100"
                      stroke="currentColor"
                      strokeWidth="0.6"
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                  <span
                    style={{
                      position: "relative",
                      fontSize: 8,
                      fontWeight: 800,
                      letterSpacing: "0.14em",
                      color: "var(--nex-text-dim)",
                      textAlign: "center",
                      padding: "1px 5px",
                      background: "#03101D",
                      borderRadius: 4,
                    }}
                  >
                    IMAGE HERE
                  </span>
                </>
              )}
              {soldOut && (
                <span
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: 0,
                    right: 0,
                    transform: "translateY(-50%)",
                    padding: "3px 0",
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "#fff",
                    background: "rgba(180,40,40,0.9)",
                    textAlign: "center",
                  }}
                >
                  Sold out
                </span>
              )}
            </div>
            {/* Founder direction 2026-09-30 (revised) · magnifier button
                centred ON the rim at 45° · 50% inside the circle, 50%
                outside · positioned at 85%/85% of the container so the
                button's centre lands exactly on the circle boundary
                (rim at 45° = ~85.4% from top-left for a 100% circle).
                Whole card is still the <Link>; this is the visible
                affordance. */}
            <span
              aria-hidden
              style={{
                position: "absolute",
                left: "85%",
                top: "85%",
                transform: "translate(-50%, -50%)",
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "var(--nex-accent)",
                color: "#03101D",
                display: "grid",
                placeItems: "center",
                boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                border: "2px solid var(--nex-panel, #0a1120)",
                zIndex: 2,
              }}
            >
              <svg
                width={16}
                height={16}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.5" y2="16.5" />
              </svg>
            </span>
          </div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              lineHeight: 1.25,
              letterSpacing: "-0.005em",
              textAlign: "center",
              minWidth: 0,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              wordBreak: "break-word",
              maxWidth: "100%",
            }}
          >
            {product.name}
          </div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: "var(--nex-accent)",
              letterSpacing: "0.01em",
              fontVariantNumeric: "tabular-nums",
              textAlign: "center",
            }}
          >
            {priceLabel}
          </div>
        </Link>
      </>
    );
  }
  return (
    <>
      <style>{`
        [data-nex-cover-product-card] {
          transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1),
                      box-shadow 260ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        [data-nex-cover-product-card]:hover,
        [data-nex-cover-product-card]:focus-visible {
          transform: translateY(-3px);
          box-shadow: 0 18px 40px rgba(0,0,0,0.55), 0 0 18px var(--nex-accent-glow);
        }
      `}</style>
      <Link
        href={chatHref}
        data-nex-cover-product-card
        style={{
          display: isLandscape ? "flex" : "block",
          flexDirection: isLandscape ? "row" : undefined,
          alignItems: isLandscape ? "stretch" : undefined,
          position: "relative",
          borderRadius: "var(--nex-card-radius)",
          border: "var(--nex-card-border)",
          background: "var(--nex-card-bg)",
          backdropFilter: "blur(14px) saturate(1.1)",
          WebkitBackdropFilter: "blur(14px) saturate(1.1)",
          overflow: "hidden",
          textDecoration: "none",
          color: "var(--nex-text)",
          boxShadow: "0 8px 22px rgba(0,0,0,0.4)",
          opacity: soldOut ? 0.7 : 1,
        }}
      >
        <div
          aria-hidden={!!product.image_url}
          role={product.image_url ? undefined : "img"}
          aria-label={product.image_url ? undefined : "Image placeholder"}
          style={{
            aspectRatio: "1 / 1",
            width: isLandscape ? 112 : "100%",
            flex: isLandscape ? "0 0 112px" : undefined,
            height: isLandscape ? 112 : undefined,
            backgroundImage: product.image_url
              ? `url(${product.image_url})`
              : undefined,
            background: product.image_url
              ? undefined
              : `linear-gradient(135deg, var(--nex-accent-faint), var(--nex-panel))`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            position: "relative",
            // Grid mode · image bottom corners rounded so meta stack
            // sits under a curve. Landscape mode · right side rounded
            // so meta column sits AGAINST the curve on its left edge.
            borderBottomLeftRadius: isLandscape ? 0 : 12,
            borderBottomRightRadius: isLandscape ? 12 : 12,
            borderTopRightRadius: isLandscape ? 12 : 0,
            overflow: "hidden",
            display: !product.image_url ? "grid" : undefined,
            placeItems: !product.image_url ? "center" : undefined,
          }}
        >
          {/* Founder direction 2026-09-30 · when the seller hasn't
              uploaded an image, the card renders the same IMAGE HERE
              placeholder pattern used in the Personal Brand Images
              tab. Diagonal cross-through + translucent "IMAGE HERE"
              caption so the tile reads as an empty slot rather than
              a filled but blank card. */}
          {!product.image_url && (
            <>
              <svg
                aria-hidden
                width="100%"
                height="100%"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                style={{
                  position: "absolute",
                  inset: 0,
                  opacity: 0.22,
                  color: "var(--nex-accent, #FF3F9F)",
                }}
              >
                <line
                  x1="0"
                  y1="0"
                  x2="100"
                  y2="100"
                  stroke="currentColor"
                  strokeWidth="0.6"
                  vectorEffect="non-scaling-stroke"
                />
                <line
                  x1="100"
                  y1="0"
                  x2="0"
                  y2="100"
                  stroke="currentColor"
                  strokeWidth="0.6"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
              <span
                style={{
                  position: "relative",
                  fontSize: isLandscape ? 8 : 10,
                  fontWeight: 800,
                  letterSpacing: "0.16em",
                  color: "var(--nex-text-dim)",
                  textAlign: "center",
                  padding: isLandscape ? "1px 4px" : "2px 6px",
                  background: "#03101D",
                  borderRadius: 4,
                }}
              >
                IMAGE HERE
              </span>
            </>
          )}
          {eyebrow && (
            <span
              style={{
                position: "absolute",
                top: 8,
                left: 8,
                padding: "2px 8px",
                borderRadius: 3,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#fff",
                background: "var(--nex-accent)",
                boxShadow: "0 4px 10px rgba(0,0,0,0.4)",
              }}
            >
              {eyebrow}
            </span>
          )}
          {soldOut && (
            <span
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                padding: "2px 8px",
                borderRadius: 3,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#fff",
                background: "rgba(180,40,40,0.85)",
              }}
            >
              Sold out
            </span>
          )}
          {/* Owner directive 2026-11-06 · "small view product button
              move to the image lower right side · this allows price
              1 row". The magnifier now sits as an overlay on the
              image, freeing the meta stack below so the price gets
              its own row and no longer shares with the icon. */}
          <span
            aria-hidden
            data-nex-cover-view-product
            style={{
              position: "absolute",
              bottom: 8,
              right: 8,
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "var(--nex-accent)",
              color: "#03101D",
              display: "grid",
              placeItems: "center",
              boxShadow: "0 4px 10px rgba(0,0,0,0.35)",
            }}
          >
            <svg
              width={15}
              height={15}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.5" y2="16.5" />
            </svg>
          </span>
        </div>
        {/* Founder direction 2026-09-30 (revised) · card meta stack ·
              name → 2-line description → price + round magnifier.
            The magnifier signals tap-to-open without a text pill
            hogging horizontal space (previous "VIEW" pill overflowed
            on narrow cards with long prices). Whole card is still the
            <Link>; the magnifier is the visible affordance. */}
        <div
          style={{
            padding: isLandscape ? "10px 12px" : "10px 12px 12px",
            display: "grid",
            gap: 6,
            minWidth: 0,
            flex: isLandscape ? "1 1 auto" : undefined,
            alignContent: isLandscape ? "center" : undefined,
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              lineHeight: 1.25,
              letterSpacing: "-0.005em",
              minWidth: 0,
              display: "-webkit-box",
              WebkitLineClamp: 1,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              wordBreak: "break-word",
            }}
          >
            {product.name}
          </div>
          {product.description && product.description.trim().length > 0 && (
            <div
              style={{
                fontSize: 11,
                lineHeight: 1.35,
                color: "var(--nex-text-dim)",
                minWidth: 0,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                wordBreak: "break-word",
              }}
            >
              {product.description}
            </div>
          )}
          {/* Owner directive 2026-11-06 · magnifier moved to the
              image (bottom-right overlay) · price now owns its own
              full row · no flex-wrapper needed · long prices wrap
              naturally without fighting for space with an icon. */}
          <div
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: "var(--nex-accent)",
              letterSpacing: "0.01em",
              lineHeight: 1.25,
              marginTop: 2,
              wordBreak: "break-word",
              overflowWrap: "anywhere",
            }}
          >
            {priceLabel}
          </div>
        </div>
      </Link>
    </>
  );
}

export function CoverProductGrid({
  products,
  peerAccountId,
  columns = 2,
  activeSectionId = ALL_TAB_ID,
  variant = "grid",
}: {
  products: CoverProduct[];
  peerAccountId: string;
  columns?: 1 | 2 | 3;
  /**
   * When ALL_TAB_ID (default) all products render including uncategorised
   * (section_id === null). Any other value filters to strict match.
   */
  activeSectionId?: string;
  /** Founder direction 2026-09-30 · "landscape" forces a single-column
   *  list and asks each card to render horizontally · used by
   *  Template 11 Product Seller · Landscape. "round" forces 3 columns
   *  and asks each card to render as a circle · used by Template 14
   *  Personal Brand · Round Products. */
  variant?: "grid" | "landscape" | "round";
}): React.JSX.Element {
  const visible =
    activeSectionId === ALL_TAB_ID
      ? products
      : products.filter((p) => p.section_id === activeSectionId);
  const effectiveColumns =
    variant === "landscape" ? 1 : variant === "round" ? 3 : columns;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${effectiveColumns}, minmax(0, 1fr))`,
        gap: 12,
      }}
    >
      {visible.map((p) => (
        <CoverProductCard
          key={p.id}
          product={p}
          peerAccountId={peerAccountId}
          variant={variant}
        />
      ))}
    </div>
  );
}

// ─── Identity rail ───────────────────────────────────────────────────

export interface CoverSocialLinks {
  instagram?: string;
  tiktok?: string;
  facebook?: string;
  // Owner directive 2026-11-12 · X + YouTube added so the sealed
  // 5-platform brand-icon sprite can render everywhere. The DB
  // (nex_account_profile, nex_business) already stores these handles
  // (migrations 026/027 + 339) · they were never wired into the cover
  // render until now.
  x?: string;
  youtube?: string;
  whatsapp?: string;
  website?: string;
  other?: { label: string; url: string }[];
}

export function CoverIdentityRail({
  handle,
  location,
  social,
  themeId,
}: {
  handle: string | null;
  location: string | null;
  social: CoverSocialLinks | null;
  themeId: string;
}): React.JSX.Element {
  // Owner directive 2026-11-12 · shop templates render ONLY the 5
  // branded platforms (Instagram, TikTok, X, YouTube, Facebook) via
  // the owner-provided sprite. WhatsApp + Website rows are removed
  // per owner feedback: "we dont have on shop templates - website url
  // or whats app". Other-link (uncommon custom links) also drops.
  // Backend columns stay intact · this is a render cut, not a data
  // cut · they can be re-shown later if needed.
  const icons = social
    ? [
        social.instagram && { kind: "brand" as const, key: "ig", platform: "instagram" as const, label: "Instagram", url: `https://instagram.com/${strip(social.instagram)}` },
        social.tiktok    && { kind: "brand" as const, key: "tt", platform: "tiktok"    as const, label: "TikTok",    url: `https://tiktok.com/@${strip(social.tiktok).replace(/^@/, "")}` },
        social.x         && { kind: "brand" as const, key: "x",  platform: "x"         as const, label: "X",         url: `https://x.com/${strip(social.x).replace(/^@/, "")}` },
        social.youtube   && { kind: "brand" as const, key: "yt", platform: "youtube"   as const, label: "YouTube",   url: `https://youtube.com/@${strip(social.youtube).replace(/^@/, "")}` },
        social.facebook  && { kind: "brand" as const, key: "fb", platform: "facebook"  as const, label: "Facebook",  url: `https://facebook.com/${strip(social.facebook)}` },
      ].filter(Boolean)
    : [];
  return (
    <div
      data-nex-cover-rise
      style={{
        display: "grid",
        gap: 10,
        padding: "20px 4px 4px",
        // Founder direction 2026-09-30 · dashed top border removed ·
        // identity rail now flows straight up into the pagination row
        // above without a divider line.
      }}
    >
      {/* Owner-sealed 2026-11-13 · handle line retired from the footer
          · the shop identity header already carries the shop name ·
          @handle in the footer was duplicating the burger-menu
          "@handbags-direct" line. `handle` prop kept for API stability
          so every call-site can stay unchanged. */}
      {false && handle ? <span /> : null}
      {icons.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 8,
            // Owner directive 2026-11-09 · Social Links on 1 row only.
            // `minWidth: 0` is the key fix · without it the grid child
            // expands past its column (default `min-width: auto`) and
            // icons on the right end up clipped. With `minWidth: 0` the
            // row respects the parent column width and `overflowX: auto`
            // takes over · scrolling horizontally when needed.
            minWidth: 0,
            flexWrap: "nowrap",
            overflowX: "auto",
            overflowY: "hidden",
            scrollbarWidth: "none",
            paddingRight: 4,
          }}
        >
          {icons.map((it) => {
            if (!it) return null;
            // Owner directive 2026-11-12 · only the 5 branded
            // platforms render here · the sprite image is the icon,
            // so the link is a bare wrapper with no gold pill.
            return (
              <a
                key={it.key}
                href={it.url}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={it.label}
                title={it.label}
                style={{
                  flexShrink: 0,
                  display: "inline-flex",
                  textDecoration: "none",
                  lineHeight: 0,
                }}
              >
                <SocialBrandIcon platform={it.platform} size={30} />
              </a>
            );
          })}
        </div>
      )}
      {/* Owner-sealed 2026-11-13 · footer location line (📍 city)
          retired · address now lives only in the burger menu's Visit
          Us slider · `location` prop kept for API stability. */}
      {false && location ? <span /> : null}
      <div
        style={{
          marginTop: 4,
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--nex-text-dim)",
        }}
      >
        <CharmGlyph themeId={themeId} size={12} />
        Powered by NEX
      </div>
    </div>
  );
}

function strip(v: string): string {
  return v.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
}

// ─── Sticky action bar (conversion only) ─────────────────────────────

export function CoverStickyBar({
  chatHref,
  menuHref,
  cartHref,
  chatLabel = "Chat",
  menuLabel = "Menu",
  cartLabel = "Cart",
}: {
  chatHref: string;
  menuHref?: string | null;
  cartHref?: string;
  chatLabel?: string;
  menuLabel?: string;
  cartLabel?: string;
}): React.JSX.Element {
  return (
    <div
      data-nex-cover-sticky-bar
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 30,
        padding: "10px 16px calc(env(safe-area-inset-bottom, 0) + 12px)",
        background:
          "linear-gradient(0deg, rgba(3,8,20,0.94) 0%, rgba(3,8,20,0.82) 60%, rgba(3,8,20,0.4) 100%)",
        backdropFilter: "blur(16px) saturate(1.1)",
        WebkitBackdropFilter: "blur(16px) saturate(1.1)",
        borderTop: "1px solid var(--nex-accent-soft)",
      }}
    >
      <div
        style={{
          maxWidth: 720,
          margin: "0 auto",
          display: "flex",
          gap: 8,
        }}
      >
        <StickyBtn href={chatHref} primary>
          💬 <span style={{ marginLeft: 6 }}>{chatLabel}</span>
        </StickyBtn>
        {menuHref && (
          <StickyBtn href={menuHref}>
            🍽 <span style={{ marginLeft: 6 }}>{menuLabel}</span>
          </StickyBtn>
        )}
        {cartHref && (
          <StickyBtn href={cartHref}>
            🛒 <span style={{ marginLeft: 6 }}>{cartLabel}</span>
          </StickyBtn>
        )}
      </div>
    </div>
  );
}

function StickyBtn({
  href,
  primary,
  children,
}: {
  href: string;
  primary?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Link
      href={href}
      style={{
        flex: 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "12px 16px",
        borderRadius: 12,
        fontFamily: "var(--nex-font-display)",
        fontSize: 14,
        fontWeight: 700,
        letterSpacing: "0.01em",
        textDecoration: "none",
        color: primary ? "#fff" : "var(--nex-text)",
        background: primary
          ? "var(--nex-accent)"
          : "var(--nex-accent-faint)",
        border: primary
          ? "1px solid var(--nex-accent)"
          : "1px solid var(--nex-accent-soft)",
        boxShadow: primary
          ? "0 10px 24px rgba(0,0,0,0.45), 0 0 18px var(--nex-accent-glow)"
          : "0 6px 16px rgba(0,0,0,0.4)",
      }}
    >
      {children}
    </Link>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

function formatMoney(currency: string, minor: number): string {
  const c = currency.toUpperCase();
  if (c === "IDR") {
    return `Rp ${Math.round(minor / 100).toLocaleString("id-ID")}`;
  }
  const sym = c === "GBP" ? "£" : c === "USD" ? "$" : c === "EUR" ? "€" : `${c} `;
  return `${sym}${(minor / 100).toFixed(2)}`;
}

// ─── Compact icon glyphs (theme-tinted) ──────────────────────────────

function IconInstagram(): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="4" width="16" height="16" rx="4.5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="3.6" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="17" cy="7" r="0.9" fill="currentColor" />
    </svg>
  );
}
function IconTikTok(): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M14.5 4v9.2a3 3 0 11-3-3V13a1.7 1.7 0 100 3.4A1.7 1.7 0 0013.2 14V4h1.3c.2 1.7 1.4 3 3 3.2" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
    </svg>
  );
}
function IconFacebook(): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M14 8h2V5h-2a3 3 0 00-3 3v2H9v3h2v7h3v-7h2l1-3h-3V8a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round" />
    </svg>
  );
}
function IconWhatsApp(): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 20l1.5-4A7 7 0 1112 19a7 7 0 01-3.5-.9L4 20zM9 9.5c0-.4.4-.5.7-.5s.5 0 .7.5.7 1.5.7 1.7-.2.4-.5.5c-.3.2-.4.3-.2.6.4.7 1.3 1.6 2 2 .3.1.5 0 .6-.2.2-.3.4-.5.7-.5.5 0 1.4.7 1.7.9.2.2.2.4.1.5-.3.6-1 1.1-1.7 1.1-1.4 0-3.4-1.5-4.4-3.4-.4-.6-.4-1.3-.4-1.7z" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round" />
    </svg>
  );
}
function IconGlobe(): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 12h16M12 4c2.5 2.5 3.5 5 3.5 8s-1 5.5-3.5 8M12 4C9.5 6.5 8.5 9 8.5 12s1 5.5 3.5 8" stroke="currentColor" strokeWidth="1.3" fill="none" />
    </svg>
  );
}
function IconLink(): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M10 14a3 3 0 000-4l-1-1a3 3 0 10-4 4l1 1M14 10a3 3 0 000 4l1 1a3 3 0 104-4l-1-1" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}
