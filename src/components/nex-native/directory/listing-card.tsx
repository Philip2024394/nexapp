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
// Owner directive 2026-10-18 · category footer retired · replaced
// by Safe Trade footer that opens a lightweight info sheet.
import { SafeTradeFooterClient } from "./_safe-trade-footer-client";
// Owner-authorised 2026-10-30 (Product Upload World-Class brief) ·
// market-visibility pill. Rendered only when the view model carries a
// non-null marketScope · card is byte-identical to the previous render
// for every business + legacy-product + watch listing.
import { MarketBadge } from "./_market-badge";
// Owner directive 2026-10-18 · location row fallback uses the
// sealed ISO country lookup so cards don't invent their own
// country-code → name mapping.
import { findIsoCountry } from "@/lib/nex-native/geo/iso-countries";
import type { ListingCardViewModel } from "@/lib/nex-native/directory/landing-feed-service";
import { CountryFlag } from "@/components/nex-native/directory/country-flag";
// Phase 1c Batch 4 · 2026-11-06 · LiveProductIndicator removed with
// the Live Commerce surface deletion (scope reduction).

const CATEGORY_ICON_SHEET = "/nex-directory/icons/category-grid.png";

// Owner directive 2026-10-18 · "grid-tall" is a Pinterest-style
// variant that bumps the image slot (and therefore the card's
// minHeight) so a feed of mixed grid + grid-tall cards reads as
// masonry without any changes to card content. See the parent at
// _landing-directory-view.tsx for the rhythm (every 3rd card).
export type ListingCardSize = "compact" | "grid" | "grid-tall";

export interface ListingCardProps {
  readonly listing: ListingCardViewModel;
  readonly size?: ListingCardSize;
  // Phase 1c Batch 4 · 2026-11-06 · `liveState` prop removed with
  // the Live Commerce surface deletion (scope reduction). The card
  // no longer renders a LIVE chip.
  /** Owner directive 2026-10-18 · final location-row fallback. When
   *  a listing has neither `city` nor `sellerCountryIso`, the card
   *  uses THIS label instead of hiding the location row. Honest
   *  default · the directory is already filtered to this country,
   *  so attributing an unmarked listing to it is accurate for the
   *  current viewing context. Parent (DirectoryResultsGrid) resolves
   *  it from the sealed country ISO lookup once per render. */
  readonly fallbackLocationLabel?: string;
  /** Owner directive 2026-10-18 · the round seller-country flag
   *  chip (image top-left) must appear on EVERY card. When the
   *  listing itself doesn't declare a country, fall back to the
   *  directory's active country ISO · same honest attribution
   *  rationale as `fallbackLocationLabel`. */
  readonly fallbackCountryIso?: string;
}

export function ListingCard({
  listing,
  size = "compact",
  fallbackLocationLabel,
  fallbackCountryIso,
}: ListingCardProps) {
  const isGrid = size === "grid" || size === "grid-tall";
  const isTall = size === "grid-tall";
  const isMockSeed = listing.source === "mock_seed";
  // Owner directive 2026-10-18 · compact "world-class" heights so
  // cards are scannable and masonry stays elegant. ~15-20% shorter
  // than the pre-2026-10-18 numbers while preserving the two-line
  // business + offering headline.
  const containerStyle: CSSProperties = {
    ...cardShellStyle,
    minHeight: isTall ? 300 : isGrid ? 220 : 220,
    ...(isMockSeed ? mockShellOverrideStyle : null),
  };
  // Image heights · tall is distinctly taller for masonry rhythm,
  // standard grid is lean, compact non-grid rows keep original.
  const imageHeight = isTall ? 190 : isGrid ? 130 : 120;

  // Owner directive 2026-10-18 (iteration) · ONE name in the muted
  // uppercase treatment (the "Premium Audio Co." style the owner
  // liked), used for the product / service / room name directly.
  // The white bold headline was removed · no two-line split.
  //
  //   NOISE-CANCELLING PRO       ← muted uppercase · 10px · 0.6 ls
  //   Rp 950,000                 ← price underneath
  //
  // `featuredOffering` overrides `title` when set (so a business
  // row can showcase a specific product); otherwise `title` is used.
  // Both tapping the card AND tapping the magnify circle route to
  // the owner's cover page via the enclosing <Link>.
  const nameText =
    typeof listing.featuredOffering === "string" &&
    listing.featuredOffering.length > 0
      ? listing.featuredOffering
      : listing.title;

  const inner = (
    <>
      {/* ── Image slot · source chip · round magnify "view" button
           bottom-right. The circle is visual chrome · the whole
           card is one tap target (enclosing <Link>). Mocks skip
           the button because they aren't tappable. ── */}
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
        {/* Owner directive 2026-10-18 (iteration) · SAMPLE chip
            retired. The top-left of the image now carries a round
            seller-country flag chip · communicates provenance
            without the mock-only visual. Rendered on every card
            (mocks + real listings alike). When `sellerCountryIso`
            is null, no chip renders (honest · no fabricated flag). */}
        <SellerCountryFlagChip
          iso={listing.sellerCountryIso ?? fallbackCountryIso ?? null}
        />
        {/* Phase 1c Batch 4 · 2026-11-06 · ListingCardLiveChip removed
            with Live Commerce surface deletion. */}
        <ViewDetailsCircle />
      </div>

      {/* ── Body · name + location (3D pin + main area) + price ──
           Owner directive 2026-10-18. Location is trimmed to the
           primary area (first segment before "," or "/") so
           "Seminyak, Bali" renders as "Seminyak" and "Yogyakarta /
           Bantul" renders as "Yogyakarta". Falls back to country
           when city is null. Row omits itself when both are null.
           Price collapses to ONE line · prefers the viewer's picked
           currency estimate when present, otherwise the seller's
           authoritative price. ── */}
      <div style={cardBodyStyle}>
        <span style={cardNameStyle}>{nameText}</span>
        {(() => {
          const rawCity = listing.city;
          const country =
            !rawCity && listing.sellerCountryIso
              ? findIsoCountry(listing.sellerCountryIso)?.name ?? null
              : null;
          // Owner directive 2026-10-18 · EVERY card must display a
          // location row. Fallback priority:
          //   1. listing.city
          //   2. listing.sellerCountryIso → country name
          //   3. fallbackLocationLabel from the directory's active
          //      country context (honest · the directory is
          //      filtered to this country, so an unmarked listing
          //      is accurately attributed to it for the current
          //      view).
          // If even the fallback is absent, we omit the row rather
          // than render an empty pin.
          const rawLocation = rawCity ?? country ?? fallbackLocationLabel ?? null;
          if (!rawLocation) return null;
          const locationText = mainLocationArea(rawLocation);
          return (
            <span style={cardLocationStyle} data-nex-listing-location>
              <span style={cardLocationPinStyle} aria-hidden>
                <PinGlyph3D />
              </span>
              <span style={cardLocationTextStyle}>{locationText}</span>
            </span>
          );
        })()}
        {(() => {
          // Owner directive 2026-10-18 · EVERY card must show a
          // single-row price slot under the location. Rendering
          // priority:
          //
          //   1. Buyer-currency estimate (`buyerLocalPrice`) when
          //      the viewer picked a non-seller currency and the
          //      FX pipeline resolved. "~" prefix carries honesty.
          //   2. Seller's authoritative pre-formatted price
          //      (`priceNow`) when no FX conversion applies.
          //   3. Honest placeholder "Ask seller" when neither is
          //      available (Phase A production rows today). The
          //      slot never shows a fabricated price · the
          //      placeholder is a chat-first affordance that
          //      matches NEX's model (talk to the seller to agree
          //      on price).
          const buyer = listing.buyerLocalPrice;
          if (buyer !== null) {
            return (
              <div style={priceRowStyle} data-nex-listing-price-row>
                <BuyerPriceLine
                  iso={buyer.countryIso}
                  price={buyer.priceDisplay}
                />
              </div>
            );
          }
          if (listing.priceNow !== null) {
            return (
              <div style={priceRowStyle} data-nex-listing-price-row>
                <SellerPriceLine
                  iso={listing.sellerCountryIso}
                  price={listing.priceNow}
                />
              </div>
            );
          }
          return (
            <div
              style={priceRowStyle}
              data-nex-listing-price-row
              data-nex-listing-price-state="ask-seller"
            >
              <AskSellerLine iso={listing.sellerCountryIso} />
            </div>
          );
        })()}
        {/* Owner-authorised 2026-10-30 (Product Upload World-Class
             brief) · market scope pill. Only renders for product-
             sourced rows that declared a scope on the canonical
             nex_product record. Null (every business + legacy
             product + watch listing + live post) → component
             returns null, card is byte-identical to the pre-brief
             render. Never inferred from country/currency/location. */}
        <MarketBadge scope={listing.marketScope} />
      </div>

      {/* ── Footer · Safe Trade · replaces the retired category row.
           Owner directive 2026-10-18. The button captures its own
           clicks so a tap opens the info sheet without triggering
           the enclosing <Link>'s navigation. Mock cards still
           render the footer · the info is generic + the "View
           business" CTA inside points at the mock's href (which is
           /nex-native/directory as a safe no-op). ── */}
      <SafeTradeFooterClient businessHref={listing.href} />
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
        aria-label={`${listing.title} — preview, not clickable`}
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

// Owner directive 2026-10-18 (iteration) · country flag retired
// from the left of the price · the round seller-country flag chip
// now lives on the image (top-left) as a single provenance signal.
// The `iso` props stay on these components for backward-compat ·
// they're deliberately unused today so a future design pass can
// re-introduce the inline flag without a prop-shape change.
function SellerPriceLine({
  price,
}: {
  readonly iso: string | null;
  readonly price: string;
}) {
  return (
    <div style={priceLineStyle}>
      <span style={priceNowStyle}>{price}</span>
    </div>
  );
}

function BuyerPriceLine({
  price,
}: {
  readonly iso: string;
  readonly price: string;
}) {
  return (
    <div style={priceLineBuyerStyle}>
      <span style={priceBuyerStyle}>{price}</span>
    </div>
  );
}

// Owner directive 2026-10-18 (iteration) · copy change from "Ask
// seller" to "Chat for price". Rationale: "ask" reads as
// supplication · "chat for price" gives the buyer agency and
// matches NEX's chat-first model (THEY start a conversation,
// they don't beg). Same honest-no-fabrication principle · still
// no numeric price is invented when the seller hasn't published
// one.
function AskSellerLine(_props: { readonly iso: string | null }) {
  return (
    <div style={priceLineStyle} data-nex-listing-ask-seller>
      <span style={askSellerTextStyle}>Chat for price</span>
    </div>
  );
}

// ─── Footer · divider + category icon + colored label + chevron ─────

// CategoryFooter removed 2026-10-18 · owner directive · replaced
// by SafeTradeFooterClient which lives at
// src/components/nex-native/directory/_safe-trade-footer-client.tsx.
// The sealed `categoryLabel` / `categoryIconCol` / `categoryIconRow`
// / `categoryAccent` fields stay on the ViewModel for other
// consumers (e.g. filter UIs upstream).

// ─── Honest no-image monogram ───────────────────────────────────────

function NoImageMonogram({ title }: { readonly title: string }) {
  const letter = (title.trim()[0] ?? "·").toUpperCase();
  return (
    <div style={noImageWrapStyle} aria-hidden="true">
      <span style={noImageLetterStyle}>{letter}</span>
    </div>
  );
}

// ─── View-details circle · owner directive 2026-10-18 ──────────────
//
// Round magnifying-glass "view" button that sits in the bottom-right
// corner of the image slot. The circle is purely visual chrome · the
// whole card is one tap target (the enclosing <Link>), so this
// element doesn't need its own click handler. It signals "peek
// inside" without taking vertical space in the body. Mocks don't
// render this (they're non-interactive by design).
/** Owner directive 2026-10-18 · trim a location string to the main
 *  area · take everything before the first "," or "/" and trim
 *  whitespace. "Seminyak, Bali" → "Seminyak" · "Yogyakarta/Bantul"
 *  → "Yogyakarta" · "Jakarta" → "Jakarta". A string with no
 *  separators is returned unchanged. */
function mainLocationArea(raw: string): string {
  const trimmed = raw.trim();
  const idx = trimmed.search(/[,/]/);
  return idx === -1 ? trimmed : trimmed.slice(0, idx).trim();
}

/** Owner directive 2026-10-18 (iteration) · 3D-styled DARK RED
 *  location pin · the Google-Maps-adjacent map-pin colour the owner
 *  authorised for the directory card's location row. Visual
 *  language mirrors the sealed LockedSettingsIcon
 *  (`src/components/nex-native/account-gate/LockedSettingsIcon.tsx`):
 *  gradient body for depth · offset shadow silhouette · thin inner
 *  highlight. 14px to sit comfortably next to the muted 11px
 *  location text without overpowering it.
 *
 *  Dark-red palette:
 *    #E85D4C top (lighter sheen)
 *    #C0392B mid (brand dark red)
 *    #7A1F15 bottom (deepest shadow in body)
 *    #FFC9C0 highlight sheen */
function PinGlyph3D() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id="nex-dir-pin-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E85D4C" />
          <stop offset="55%" stopColor="#C0392B" />
          <stop offset="100%" stopColor="#7A1F15" />
        </linearGradient>
        <linearGradient id="nex-dir-pin-highlight" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFC9C0" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#FFC9C0" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Depth shadow · darker silhouette offset 1px for 3D rise */}
      <path
        d="M12 3a7 7 0 0 1 7 7c0 5-7 12-7 12S5 15 5 10a7 7 0 0 1 7-7z"
        fill="rgba(0,0,0,0.55)"
      />
      {/* Pin body · gradient fill */}
      <path
        d="M12 2a7 7 0 0 1 7 7c0 5-7 12-7 12S5 14 5 9a7 7 0 0 1 7-7z"
        fill="url(#nex-dir-pin-body)"
        stroke="rgba(0,0,0,0.5)"
        strokeWidth="0.5"
      />
      {/* Top sheen · narrower highlight band for 3D glint */}
      <path
        d="M12 2.6a6.4 6.4 0 0 1 6.4 6.4c0 1.6-.8 3.4-2 5.2-1.3-2-3.1-3-4.4-3s-3.1 1-4.4 3c-1.2-1.8-2-3.6-2-5.2A6.4 6.4 0 0 1 12 2.6z"
        fill="url(#nex-dir-pin-highlight)"
      />
      {/* Lens · dark circle inset reads as the pin's spot · dark
          red rim ties it to the body gradient instead of looking
          like the old cyan glyph. */}
      <circle cx="12" cy="9" r="2.1" fill="rgba(2,9,20,0.9)" />
      <circle
        cx="12"
        cy="9"
        r="2.1"
        stroke="rgba(122,31,21,0.75)"
        strokeWidth="0.6"
        fill="none"
      />
    </svg>
  );
}

function ViewDetailsCircle() {
  return (
    <span
      aria-hidden="true"
      data-nex-listing-view-circle
      style={viewDetailsCircleStyle}
    >
      {/* Owner directive 2026-10-18 (iteration) · dark NEX orange
          ink stroke so the glyph holds contrast against the solid
          orange fill. Stroke weight bumped to 2.4 so the magnify
          icon reads cleanly at 16px on the orange background. */}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <circle
          cx="11"
          cy="11"
          r="7"
          stroke={COLOR_ORANGE_INK}
          strokeWidth="2.4"
        />
        <path
          d="m20 20-3.5-3.5"
          stroke={COLOR_ORANGE_INK}
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

// ─── Seller country flag chip · image top-left · owner directive
//      2026-10-18 (iteration) · replaces the retired SAMPLE badge
//      and the retired inline flag on the price row. One
//      provenance signal, one slot. ──────────────────────────────

function SellerCountryFlagChip({ iso }: { readonly iso: string | null }) {
  if (!iso) return null;
  return (
    <span
      aria-hidden="true"
      data-nex-listing-seller-flag
      style={sellerCountryFlagChipStyle}
    >
      <CountryFlag isoAlpha2={iso} size={28} />
    </span>
  );
}

// SourceBadge retired 2026-10-18 · the SAMPLE chip is gone and the
// owner/directory chips were already removed on 2026-10-16. All
// provenance now flows through the new SellerCountryFlagChip above.

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
  // Owner directive 2026-10-18 · when the parent is a CSS-columns
  // container (Pinterest-style masonry), cards must not split across
  // column boundaries. Harmless on grid/flex parents · simply
  // ignored. Also adds a small bottom margin so cards don't butt
  // against the next card in the same column.
  // 2026-10-28 · removed stale `WebkitColumnBreakInside` (vendor
  // prefix for Safari ≤ 10, no longer in csstype). Modern Safari
  // supports `breakInside` since v10 (2017).
  breakInside: "avoid",
  marginBottom: 12,
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

// Owner directive 2026-10-18 (iteration) · 36px solid-ORANGE circle
// at the bottom-right of the image. The dark NEX orange ink
// (#1A1300) stroke on the magnifying glass holds contrast against
// the orange fill at any size · no backdrop blur needed on a solid
// fill. Shadow is orange-tinted so the button reads as a NEX brand
// affordance rather than a translucent chrome element.
const viewDetailsCircleStyle: CSSProperties = {
  position: "absolute",
  right: 10,
  bottom: 10,
  width: 36,
  height: 36,
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: COLOR_ORANGE,
  border: "none",
  color: COLOR_ORANGE_INK,
  boxShadow:
    "0 4px 14px rgba(255,114,0,0.45), 0 0 0 1px rgba(255,114,0,0.35)",
};

// SAMPLE badge style retired 2026-10-18 along with the SourceBadge
// component · see above for the current provenance affordance
// (SellerCountryFlagChip).

// Owner directive 2026-10-18 (iteration) · round seller-country
// flag chip anchored to the top-left of the card image. 28px flag
// sits inside a translucent dark backing + soft drop-shadow so the
// flag reads cleanly over bright or dark photos. The CountryFlag
// primitive already renders as a circle · the wrapper just adds
// position + shadow context.
const sellerCountryFlagChipStyle: CSSProperties = {
  position: "absolute",
  top: 8,
  left: 8,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 28,
  height: 28,
  borderRadius: 999,
  overflow: "hidden",
  boxShadow:
    "0 4px 12px rgba(0,0,0,0.55), 0 0 0 1.5px rgba(255,255,255,0.14)",
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

// Owner directive 2026-10-18 (iteration) · the card's ONE name uses
// the muted uppercase treatment (the "Premium Audio Co." style the
// owner liked). Allows up to 2 lines for long product/service/room
// names before truncating with an ellipsis. No white headline above
// or below.
const cardNameStyle: CSSProperties = {
  color: COLOR_MUTED,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  lineHeight: 1.25,
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

// Owner directive 2026-10-18 (iteration) · location row is now a
// flex row carrying a 3D pin icon followed by the trimmed main
// area text. Same muted tone as the name but regular (not
// uppercase) so the two lines are visually distinct. Single-line
// with ellipsis for long city names.
const cardLocationStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  color: COLOR_MUTED,
  fontSize: 11,
  fontWeight: 500,
  lineHeight: 1.3,
  minWidth: 0,
  opacity: 0.9,
};
const cardLocationPinStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 14,
  height: 14,
  flexShrink: 0,
};
const cardLocationTextStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
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
// Owner directive 2026-10-18 · muted "Ask seller" placeholder text ·
// occupies the same slot as the price so every card renders a
// single-row price area under the location. Weight + size match the
// seller price for visual rhythm; muted colour signals that the
// numeric value isn't published yet · the seller takes it in chat.
const askSellerTextStyle: CSSProperties = {
  color: COLOR_MUTED,
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: 0.2,
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

// Phase 1c Batch 4 · 2026-11-06 · ListingCardLiveChip removed with
// the Live Commerce surface deletion (scope reduction).
