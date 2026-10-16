// src/components/nex-native/directory/listing-card.tsx
//
// NEX Directory · shared `ListingCard` primitive · Phase A ·
// updated 2026-10-16 to the owner-approved card-design template
// (`card design.png`).
// --------------------------------------------------------------------
// ONE card component consumed by:
//
//   · The landing page's Featured Deals row
//     (`src/app/nex-native/directory/landing/page.tsx`)
//   · The directory results page
//     (`src/app/nex-native/directory/page.tsx`)
//
// Visual layout (top → bottom):
//
//   ┌────────────────────────┐
//   │  [image]      [-NN%]   │  ← discount badge · top-right of image
//   │                        │     (rendered only when `discountLabel`
//   │                        │     is non-null · never fabricated)
//   ├────────────────────────┤
//   │  Title                 │
//   │  Subtitle              │  ← description (optional)
//   │                        │
//   │  $59.99  $̶9̶9̶.̶9̶9̶       │  ← price row (rendered only when
//   │                        │     `priceNow` is non-null)
//   │ ─────────────────────  │  ← cyan hairline divider
//   │  🛒 Products       ›   │  ← per-category icon + colored label
//   └────────────────────────┘     + chevron
//
// Owner rules this component enforces, 2026-10-16:
//
//   1. REQUIRED fields on the view model: title + href + source + id
//      + category visuals (accent, iconCol, iconRow, label). The
//      divider and bottom-row icon render for EVERY card.
//
//   2. OPTIONAL fields: imageUrl · description · city · priceNow ·
//      priceWas · discountLabel. Each gates its own slot · null →
//      slot omitted. Never injects a placeholder price / discount.
//
//   3. Fabrication guard · the price + discount markup lives in the
//      source but is reachable ONLY through a non-null view-model
//      field. A listing with no pricing data in the DB has `priceNow
//      = null` from the adapter · the price row does not render.
//      The structural test suite verifies there is NO hardcoded $NN
//      or -NN% literal in the source.
//
//   4. Shared category visuals · colour + sprite coordinates come
//      from `landing-category-mapping.ts` so the card footer and the
//      landing-page tile for the same category stay colour-identical.
//
//   5. Source badge · the small "Owner" / "Directory" chip in the
//      image's top-left corner reports honest provenance.

import type { CSSProperties } from "react";
import Link from "next/link";
import type { ListingCardViewModel } from "@/lib/nex-native/directory/landing-feed-service";
import { CountryFlag } from "@/components/nex-native/directory/country-flag";

const CATEGORY_ICON_SHEET = "/nex-directory/icons/category-grid.png";

export type ListingCardSize = "compact" | "grid";

export interface ListingCardProps {
  readonly listing: ListingCardViewModel;
  readonly size?: ListingCardSize;
}

export function ListingCard({
  listing,
  size = "compact",
}: ListingCardProps) {
  const isGrid = size === "grid";
  const isMockSeed = listing.source === "mock_seed";
  const containerStyle: CSSProperties = {
    ...cardShellStyle,
    minHeight: isGrid ? 260 : 220,
    // Mock cards use default (non-interactive) cursor + reduced opacity
    // so a visitor doesn't try to tap through to a non-existent detail
    // page. Owner-approved repair pass 2026-10-16 · the previous
    // behaviour routed mocks to /directory which looked broken.
    ...(isMockSeed ? mockShellOverrideStyle : null),
  };
  const imageHeight = isGrid ? 150 : 120;

  const inner = (
    <>
      {/* ── Image slot · with source chip only ·
           owner directive 2026-10-16 · the orange discount badge was
           dropped from this card flow (do not imply a discount
           without genuine supporting data). ── */}
      <div style={{ ...cardImageWrapStyle, height: imageHeight }}>
        {listing.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.imageUrl}
            alt=""
            loading="lazy"
            style={cardImageStyle}
          />
        ) : (
          <NoImageMonogram title={listing.title} />
        )}
        <SourceBadge source={listing.source} />
      </div>

      {/* ── Body · title + optional middle content + anchored price ─
           Owner directive 2026-10-16 · the price row sits at a
           consistent position across every card regardless of
           description/city length. Title stays top · middle grows ·
           price pinned to bottom. ── */}
      <div style={cardBodyStyle}>
        <h3 style={cardTitleStyle}>{listing.title}</h3>
        <div style={cardBodyMiddleStyle}>
          {listing.description ? (
            <p style={cardDescStyle}>{listing.description}</p>
          ) : null}
          {listing.city ? <p style={cardCityStyle}>{listing.city}</p> : null}
        </div>
        {listing.priceNow ? (
          <div style={priceRowStyle} data-nex-listing-price-row>
            <SellerPriceLine
              iso={listing.sellerCountryIso}
              price={listing.priceNow}
            />
            {/* ── Buyer-currency slot · ALWAYS null in Phase A ──
                Owner directive · do not populate until a verified FX
                source + freshness policy is approved. The slot stays
                in the JSX so Phase 1.5 can light it up with no
                reshape. ── */}
            {listing.buyerLocalPrice ? (
              <BuyerPriceLine
                iso={listing.buyerLocalPrice.countryIso}
                price={listing.buyerLocalPrice.priceDisplay}
              />
            ) : null}
          </div>
        ) : null}
      </div>

      {/* ── Footer · hairline divider + colored category row ── */}
      <CategoryFooter listing={listing} />
    </>
  );

  // Owner-approved repair pass 2026-10-16 · mock seed cards render as
  // a non-interactive `<article>` instead of a `<Link>`. The SAMPLE
  // badge + reduced opacity + "not-allowed" cursor make it visually
  // obvious that these preview cards cannot be opened. Keeps the real
  // listing navigation (`nex_business` / `canonical`) completely
  // unchanged · they stay `<Link>` as before.
  if (isMockSeed) {
    return (
      <article
        style={containerStyle}
        data-nex-listing-card={listing.source}
        data-nex-listing-id={listing.id}
        aria-label={`${listing.title} — SAMPLE preview, not clickable`}
        aria-disabled="true"
      >
        {inner}
      </article>
    );
  }

  return (
    <Link
      href={listing.href}
      style={containerStyle}
      data-nex-listing-card={listing.source}
      data-nex-listing-id={listing.id}
      aria-label={`${listing.title} — open listing`}
    >
      {inner}
    </Link>
  );
}

// ─── Price lines · seller (authoritative) + optional buyer FX ──────

function SellerPriceLine({
  iso,
  price,
}: {
  readonly iso: string | null;
  readonly price: string;
}) {
  return (
    <div style={priceLineStyle}>
      {iso ? <CountryFlag isoAlpha2={iso} size={18} /> : null}
      <span style={priceNowStyle}>{price}</span>
    </div>
  );
}

function BuyerPriceLine({
  iso,
  price,
}: {
  readonly iso: string;
  readonly price: string;
}) {
  return (
    <div style={priceLineBuyerStyle}>
      <CountryFlag isoAlpha2={iso} size={16} />
      <span style={priceBuyerStyle}>{price}</span>
    </div>
  );
}

// ─── Footer · divider + category icon + colored label + chevron ─────

function CategoryFooter({
  listing,
}: {
  readonly listing: ListingCardViewModel;
}) {
  const iconStyle: CSSProperties = {
    width: 18,
    height: 18,
    backgroundImage: `url("${CATEGORY_ICON_SHEET}")`,
    backgroundSize: "400% 200%",
    backgroundPosition: `${(listing.categoryIconCol * 100) / 3}% ${
      listing.categoryIconRow * 100
    }%`,
    backgroundRepeat: "no-repeat",
    filter: `drop-shadow(0 0 4px ${listing.categoryAccent}88)`,
    flexShrink: 0,
  };
  const labelStyle: CSSProperties = {
    ...categoryLabelStyle,
    color: listing.categoryAccent,
    textShadow: `0 0 6px ${listing.categoryAccent}55`,
  };
  return (
    <div style={categoryFooterStyle}>
      <span style={iconStyle} aria-hidden="true" />
      <span style={labelStyle}>{listing.categoryLabel}</span>
      <span style={chevronStyle} aria-hidden="true">
        ›
      </span>
    </div>
  );
}

// ─── Honest no-image monogram ───────────────────────────────────────

function NoImageMonogram({ title }: { readonly title: string }) {
  const letter = (title.trim()[0] ?? "·").toUpperCase();
  return (
    <div style={noImageWrapStyle} aria-hidden="true">
      <span style={noImageLetterStyle}>{letter}</span>
    </div>
  );
}

// ─── Source chip · "Owner" vs "Directory" ──────────────────────────

function SourceBadge({
  source,
}: {
  readonly source: ListingCardViewModel["source"];
}) {
  // Owner directive 2026-10-16 · the Owner / Directory chips were
  // removed · every listing belongs to someone (the owner/directory
  // distinction was redundant to visitors). The ONLY chip that still
  // renders is the SAMPLE badge on owner-authorised mock preview
  // cards · a visitor must never confuse a mock with a real listing.
  if (source === "mock_seed") {
    return (
      <span style={mockSampleBadgeStyle} aria-hidden="true">
        SAMPLE
      </span>
    );
  }
  return null;
}

// ─── Styles ─────────────────────────────────────────────────────────

const COLOR_PANEL_BG = "rgba(10,21,38,0.82)";
const COLOR_PANEL_BORDER = "rgba(0,175,255,0.18)";
const COLOR_TEXT = "#F2F5F8";
const COLOR_MUTED = "#7D9BC0";
const COLOR_CYAN = "#00AFFF";
const COLOR_BG = "#061021";
const COLOR_ORANGE = "#FF7200";
const COLOR_ORANGE_INK = "#1A1300";
const COLOR_PRICE_WAS = "#526B89";

const cardShellStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  background: COLOR_PANEL_BG,
  border: `1px solid ${COLOR_PANEL_BORDER}`,
  borderRadius: 14,
  overflow: "hidden",
  color: COLOR_TEXT,
  textDecoration: "none",
};

// Owner-approved repair pass 2026-10-16 · overrides applied to mock
// seed cards so they visually read as "preview, not clickable".
const mockShellOverrideStyle: CSSProperties = {
  cursor: "not-allowed",
  // 0.85 opacity signals "preview" without hiding the content · the
  // SAMPLE chip and aria-label do the rest of the work.
  opacity: 0.85,
  // Soften the border so mocks sit a half-tone behind real listings.
  border: `1px dashed ${COLOR_PANEL_BORDER}`,
};

const cardImageWrapStyle: CSSProperties = {
  position: "relative",
  width: "100%",
  background:
    "linear-gradient(135deg, rgba(10,21,38,0.9) 0%, rgba(2,9,20,0.9) 100%)",
};

const cardImageStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block",
};

const noImageWrapStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background:
    "linear-gradient(135deg, rgba(0,175,255,0.08) 0%, rgba(2,9,20,0.95) 100%)",
};
const noImageLetterStyle: CSSProperties = {
  color: COLOR_CYAN,
  fontSize: 42,
  fontWeight: 800,
  letterSpacing: 1,
  opacity: 0.75,
  textShadow: "0 0 14px rgba(0,175,255,0.4)",
};

// Discount pill style retained · unused in the card today (owner
// directive 2026-10-16 · no fabricated discount display) · left in
// place for a future verified-discount surface. Dead-code tolerated
// deliberately to keep the slot available without a reshape.
const _discountBadgeStyle: CSSProperties = {
  position: "absolute",
  top: 8,
  right: 8,
  background: COLOR_ORANGE,
  color: COLOR_ORANGE_INK,
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 0.3,
  padding: "3px 8px",
  borderRadius: 999,
  boxShadow: "0 2px 8px rgba(255,114,0,0.5)",
};
void _discountBadgeStyle;

// Visually distinct SAMPLE chip for mock preview cards · orange on
// dark · owner-authorised 2026-10-16.
const mockSampleBadgeStyle: CSSProperties = {
  position: "absolute",
  top: 8,
  left: 8,
  background: COLOR_ORANGE,
  color: COLOR_ORANGE_INK,
  border: `1px solid ${COLOR_ORANGE}`,
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: 0.6,
  padding: "3px 8px",
  borderRadius: 999,
  textTransform: "uppercase",
  boxShadow: "0 2px 8px rgba(255,114,0,0.55)",
};

const cardBodyStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  padding: "10px 12px 10px 12px",
  flex: 1,
  // Owner directive 2026-10-16 · price-row anchor. Title stays at the
  // top · the middle slot (description/city) grows via `flex: 1` ·
  // the price row stays pinned to the bottom. Same visual position
  // across every card regardless of description length.
  justifyContent: "flex-start",
};

// Middle slot · grows to fill the space between title and price row.
// Owner directive 2026-10-16 · ensures the price-row anchor is
// consistent even when description + city are both absent.
const cardBodyMiddleStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  flex: 1,
  minHeight: 0,
};

const cardTitleStyle: CSSProperties = {
  margin: 0,
  color: COLOR_TEXT,
  fontSize: 13,
  fontWeight: 700,
  lineHeight: 1.25,
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

const cardDescStyle: CSSProperties = {
  margin: 0,
  color: COLOR_MUTED,
  fontSize: 11,
  lineHeight: 1.35,
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

const cardCityStyle: CSSProperties = {
  margin: 0,
  color: COLOR_MUTED,
  fontSize: 10,
  letterSpacing: 0.3,
};

// Price row · conditional · rendered only when `priceNow` is non-null.
// Owner directive 2026-10-16 · column layout so the seller line + the
// (future) buyer-currency line stack cleanly · each line carries its
// own country flag + price.
const priceRowStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  marginTop: 6,
};
const priceLineStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
};
const priceLineBuyerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  opacity: 0.78,
};
const priceNowStyle: CSSProperties = {
  color: COLOR_CYAN,
  fontSize: 16,
  fontWeight: 800,
  textShadow: "0 0 10px rgba(0,175,255,0.35)",
};
// Buyer-line price style · smaller · tagged with the leading `~` by
// the caller to signal "approximately" when Phase 1.5 wires FX.
const priceBuyerStyle: CSSProperties = {
  color: COLOR_MUTED,
  fontSize: 12,
  fontWeight: 700,
};
// Legacy was-price style retained for a future verified-discount
// surface. Unused in the card today · dead-code tolerated.
const _priceWasStyle: CSSProperties = {
  color: COLOR_PRICE_WAS,
  fontSize: 11,
  textDecoration: "line-through",
};
void _priceWasStyle;

// Footer · divider line + icon + colored label + chevron.
// Rendered on EVERY card (not conditional).
const categoryFooterStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 12px 12px 12px",
  borderTop: `1px solid ${COLOR_PANEL_BORDER}`,
};
const categoryLabelStyle: CSSProperties = {
  flex: 1,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.3,
};
const chevronStyle: CSSProperties = {
  color: COLOR_MUTED,
  fontSize: 18,
  lineHeight: 1,
  fontWeight: 600,
};

// Dark-ink constant retained for callers who want to style a surrounding
// grid cell to match. Non-rendering · exported but not required.
export const LISTING_CARD_INK = COLOR_BG;
