// src/app/nex-native/directory/_landing-directory-view.tsx
//
// NEX Directory · landing-derived view · sealed 2026-10-16.
// --------------------------------------------------------------------
// Shared server component used by:
//   · src/app/nex-native/directory/page.tsx          · bare + ?category=
//   · src/app/nex-native/directory/[category]/page.tsx · path-based
//
// Underscore-prefixed filename keeps this file OUT of the Next.js
// route table (standard convention) while letting both page files
// import from the same source of truth.
//
// Layout (top → bottom):
//   · Full-page `directory-bg.png` background (cover · fixed via
//     background-attachment so it stays anchored while content scrolls)
//   · Header row: NEX wordmark + location (left) · BACK button (right)
//   · Search bar + Filter button
//   · 5-pill category grid (All / Products / Stays / Food / Services)
//     laid out as `repeat(5, 1fr)` so every pill fits on a 420px
//     mobile viewport without horizontal scrolling · owner directive
//     2026-10-16.
//   · 2-column ListingCard grid
//   · Prev / Next pagination
//
// Mock preview seeds (owner-authorised): the directory prepends 2
// "SAMPLE"-chipped mocks from `mock-seed-listings.ts`. Removing them
// is a 1-line flip of `SHOW_MOCK_SEEDS_ON_DIRECTORY` below.

import type * as React from "react";
import Link from "next/link";

import { ListingCard } from "@/components/nex-native/directory/listing-card";
// Owner directive 2026-10-18 · every card must display a location
// row · we need the sealed ISO lookup to convert the directory's
// active country code into a human label used as the fallback.
import { findIsoCountry } from "@/lib/nex-native/geo/iso-countries";
import {
  getLandingFeed,
  type ListingCardViewModel,
} from "@/lib/nex-native/directory/landing-feed-service";
import type { LandingCategorySlug } from "@/lib/nex-native/directory/landing-category-mapping";
import { getMockSeedListings } from "@/lib/nex-native/directory/mock-seed-listings";
import { FilterSheet } from "./_filter-sheet-client";
// Owner directive 2026-10-18 · directory results header no longer
// carries a "Back" button · it was redundant with the sealed 3-dots
// drawer. Left side gains a cart icon (quick route to /cart with a
// live badge count) and a home icon (routes back to /welcome so the
// viewer always has a one-tap exit). Right side becomes the shared
// ControlDrawer.
import {
  ControlDrawer,
  type ControlDrawerSession,
} from "@/components/nex-native/control-drawer/control-drawer-client";
// Owner directive 2026-10-18 · Slice 1 of the directory currency
// picker. Reads the viewer's preferred-currency cookie server-side
// and renders a chip beneath the category dropdown so the UI +
// persistence layer exist while the Frankfurter / ECB FX pipeline
// is still being authorised. Phase A behaviour: writing the cookie
// does NOT yet re-price cards · they stay in seller's currency.
import { readPreferredCurrency } from "@/lib/nex-native/directory/preferred-currency-cookie";
import { CurrencyPickerClient } from "./_currency-picker-client";
// Owner directive 2026-10-18 · Slice 2 · daily ECB-sourced FX
// rates (via Frankfurter) light up the `buyerLocalPrice` slot on
// each card when the viewer's picked currency differs from the
// seller's. Honest failure: FX unavailable → seller currency only.
import {
  convertAmountMinor,
  formatEstimate,
  getDailyFxSnapshot,
} from "@/lib/nex-native/directory/fx-rate-service";

// NEX palette · aligned with the shared theme.
const NEX = {
  bg: "#020914",
  text: "#F2F5F8",
  textDim: "#7D9BC0",
  cyan: "#00AFFF",
  cyanBright: "#00D4FF",
  panelBorder: "rgba(0,175,255,0.18)",
} as const;

const DIRECTORY_BG = "/nex-directory/directory-bg.png";
const CATEGORY_ICON_SHEET = "/nex-directory/icons/category-grid.png";

/** Owner-authorised preview mocks are prepended to the live feed on
 *  the directory surface only. Flip to `false` to drop them. */
const SHOW_MOCK_SEEDS_ON_DIRECTORY = true as const;

type LandingFeedOutcomeShape = Awaited<ReturnType<typeof getLandingFeed>>;

interface CategoryPillConfig {
  readonly slug: LandingCategorySlug | null; // null = All
  readonly label: string;
  readonly iconCol: 0 | 1 | 2 | 3;
  readonly iconRow: 0 | 1;
  readonly accent: string;
}

/** 5 pills · fit in a 420px mobile viewport via `repeat(5, 1fr)`. */
const CATEGORY_PILLS: ReadonlyArray<CategoryPillConfig> = [
  { slug: null,       label: "All",      iconCol: 0, iconRow: 0, accent: NEX.cyan },
  { slug: "products", label: "Products", iconCol: 0, iconRow: 0, accent: "#FF8A2A" },
  { slug: "stay",     label: "Stays",    iconCol: 2, iconRow: 0, accent: "#B566FF" },
  { slug: "food",     label: "Food",     iconCol: 3, iconRow: 0, accent: "#4DD17A" },
  { slug: "services", label: "Services", iconCol: 1, iconRow: 0, accent: NEX.cyan },
];

/** Build the clean path-based URL for a category (or the all-view). */
function hrefFor(slug: LandingCategorySlug | null): string {
  return slug ? `/nex-native/directory/${slug}` : "/nex-native/directory";
}

export async function LandingDirectoryView({
  seed,
  category,
  country,
  countryFilter,
  distanceKm,
  hasViewerLocation,
  page,
  pageSize,
  feed,
  drawerSession,
}: {
  readonly seed: string;
  readonly category: LandingCategorySlug | null;
  /** Resolved display country (default fallback applied) · used by
   *  the header "Bali, Indonesia" label. Separate from `countryFilter`
   *  which is the active FILTER value (null = no filter). */
  readonly country: string;
  /** Active country FILTER value from the URL · null when the
   *  "Any country" option is active. */
  readonly countryFilter: string | null;
  readonly distanceKm: number | null;
  readonly hasViewerLocation: boolean;
  readonly page: number;
  /** Row count per page · needed to compute whether a next page
   *  exists so the pagination can suppress the next-arrow (and
   *  itself) when the viewer is on the last / only page. */
  readonly pageSize: number;
  readonly feed: LandingFeedOutcomeShape;
  /** Owner directive 2026-10-18 · ControlDrawer session resolved
   *  server-side by the parent route. Null for guests · the drawer
   *  renders the sealed anon identity bar + locked rows. */
  readonly drawerSession: ControlDrawerSession | null;
}) {
  // Merge: mock seeds FIRST so the preview surface always has
  // content, then the real feed. Mock ids never collide with real
  // listing ids, so no slug-dedup is needed here.
  //
  // Owner directive 2026-10-16 · mocks appear on PAGE 1 ONLY · page
  // 2+ shows real listings only · prevents mock duplication across
  // pagination.
  const mocks: readonly ListingCardViewModel[] =
    SHOW_MOCK_SEEDS_ON_DIRECTORY && page === 1 ? getMockSeedListings() : [];
  const combined: readonly ListingCardViewModel[] = [
    ...mocks,
    ...feed.cards,
  ];

  // Owner directive 2026-10-18 · Slice 1 · viewer's preferred display
  // currency. Server-side cookie read · falls back to the sealed
  // IDR default when no cookie or when the stored value is no longer
  // in the NEX_CURRENCIES whitelist.
  const preferredCurrency = await readPreferredCurrency();

  // Owner directive 2026-10-18 · Slice 2 · for each listing that
  // carries a structured amount + currency, compute an "approx"
  // buyer-currency estimate using the sealed ECB-daily FX service.
  // Null outcomes (no snapshot, currency mismatch, bounds-check
  // failure) silently fall back to seller-currency-only display.
  // Honest invariant: never fabricate · if conversion fails, the
  // card simply doesn't show a buyer-currency line.
  const fxSnapshot = await getDailyFxSnapshot();
  const fxUpdatedAt = fxSnapshot?.date ?? "";
  const augmentedCombined: readonly ListingCardViewModel[] = await Promise.all(
    combined.map(async (card): Promise<ListingCardViewModel> => {
      if (
        card.priceAmountMinor === null ||
        card.priceCurrency === null ||
        card.priceCurrency === preferredCurrency.code
      ) {
        return card;
      }
      const convertedMinor = await convertAmountMinor(
        card.priceAmountMinor,
        card.priceCurrency,
        preferredCurrency.code,
      );
      if (convertedMinor === null) return card;
      const priceDisplay = formatEstimate(convertedMinor, preferredCurrency.code);
      if (priceDisplay === null) return card;
      return {
        ...card,
        buyerLocalPrice: {
          priceDisplay,
          countryIso: inferCountryIso(preferredCurrency.code),
          fxUpdatedAt,
        },
      };
    }),
  );

  return (
    <main
      data-nex-directory-page
      data-nex-directory-mode="landing-feed"
      data-nex-landing-category={category ?? ""}
      data-nex-landing-seed={seed}
      data-nex-landing-reduced={feed.reducedState ?? ""}
      data-nex-directory-result-count={combined.length}
      data-nex-directory-mock-count={mocks.length}
      style={pageStyle}
    >
      {/* Owner directive 2026-10-16 · bg image fills the FULL viewport
          (height + width) and scrolls WITH the page content. The
          layer is `position: absolute` (not fixed) · sized to exactly
          one viewport · scrolls off the top as the viewer moves down. */}
      <div style={pageBgLayerStyle} aria-hidden="true" />
      <div style={shellStyle}>
        <DirectoryHeaderBrand
          country={country}
          drawerSession={drawerSession}
        />
        <DirectorySearchBar
          seed={seed}
          category={category}
          countryFilter={countryFilter}
          distanceKm={distanceKm}
          hasViewerLocation={hasViewerLocation}
        />
        <DirectoryCategoryDropdown activeSlug={category} />
        {/* Owner directive 2026-10-18 · Slice 1 of the directory
            currency picker. Lives directly under the "All" category
            dropdown · writes a persistent cookie · does NOT yet
            re-price cards (buyer-currency estimates land in Slice 2
            when the Frankfurter / ECB FX pipeline is authorised). */}
        <div data-nex-directory-currency-row style={currencyRowStyle}>
          <CurrencyPickerClient currentCode={preferredCurrency.code} />
        </div>
        <DirectoryResultsGrid
          listings={augmentedCombined}
          feed={feed}
          directoryCountry={country}
        />
        {(() => {
          // Owner directive 2026-10-16 (second pass) · hide the
          // whole pagination when there is nothing to navigate.
          //   · hasPrev · the viewer is beyond page 1
          //   · hasNext · the current page is FULL (we got exactly
          //     pageSize real rows back), OR totalEligible is known
          //     and there are more rows past page*pageSize
          // When both are false the viewer is on the only page ·
          // showing arrows there would suggest more pages exist.
          if (combined.length === 0) return null;
          const hasPrev = page > 1;
          const totalKnown = feed.totalEligible !== null;
          const hasNext = totalKnown
            ? page * pageSize < (feed.totalEligible as number)
            : feed.cards.length >= pageSize;
          if (!hasPrev && !hasNext) return null;
          return (
            <LandingFeedPagination
              seed={seed}
              category={category}
              countryFilter={countryFilter}
              distanceKm={distanceKm}
              page={page}
              hasNext={hasNext}
            />
          );
        })()}
      </div>
    </main>
  );
}

// ─── Header · cart + home (left) · NEX + location + 3-dots (right) ──
//
// Owner directive 2026-10-18 · the previous Back button was removed
// (redundant with the drawer's Home row). New layout:
//
//   Left column:
//     Row 1 · [cart]  [home]  NEX           (icons left of wordmark)
//     Row 2 · 📍 Country ⌄                   (unchanged location row)
//   Right column:
//     [⋮] shared ControlDrawer (session-aware · locked rows for guests)
//
// Cart icon is the sealed HeaderCartIcon in "inline" variant · it
// reads the local cart count and routes to /nex-native/cart. Home
// icon routes to /nex-native/welcome (one-tap exit back to
// orientation).

function DirectoryHeaderBrand({
  country,
  drawerSession,
}: {
  readonly country: string;
  readonly drawerSession: ControlDrawerSession | null;
}) {
  const COUNTRY_LABELS: Readonly<Record<string, string>> = {
    ID: "Bali, Indonesia",
    GB: "United Kingdom",
    US: "United States",
    AU: "Australia",
    SG: "Singapore",
  };
  const label = COUNTRY_LABELS[country] ?? country;
  return (
    <header style={headerBrandStyle}>
      <div style={headerLeftColStyle}>
        <div style={headerWordmarkRowStyle}>
          <span style={headerWordmarkStyle}>NEX</span>
        </div>
        <div style={headerLocationRowStyle}>
          <PinGlyph />
          <span style={headerLocationLabelStyle}>{label}</span>
          <ChevronDownGlyph />
        </div>
      </div>
      {/* Owner directive 2026-10-18 (iteration) · cart + home moved
          from the left side to the right · owner directive
          2026-10-18 (iteration). CART ICON RETIRED from the
          directory header · the user reaches a business's cart
          from the owner's cover page where the sealed cart UI
          already lives. One cart surface, no duplication.
          Order: home · 3-dots. */}
      <div style={headerRightClusterStyle}>
        <Link
          href="/nex-native/welcome"
          aria-label="Back to NEX welcome"
          style={headerIconLinkStyle}
          data-nex-directory-home-link
        >
          <HomeGlyph />
        </Link>
        <ControlDrawer session={drawerSession} />
      </div>
    </header>
  );
}

function HomeGlyph() {
  // Simple house silhouette · matches the home glyph on
  // /nex-native/directory/landing (same shape, same stroke weight)
  // so the two directory surfaces feel like a pair.
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 11.5 12 4l9 7.5"
        stroke={NEX.text}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 10.5V20h14V10.5"
        stroke={NEX.text}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PinGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <path
        d="M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7z"
        stroke={NEX.cyan}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="9" r="2.4" stroke={NEX.cyan} strokeWidth="1.6" />
    </svg>
  );
}

function ChevronDownGlyph() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" aria-hidden="true" fill="none">
      <path
        d="M4 6l4 4 4-4"
        stroke={NEX.cyan}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// BackArrowGlyph removed 2026-10-18 · the Back button it belonged to
// was retired alongside this swap. The ControlDrawer handles
// backward navigation via its Home row.

// ─── Search bar · search input + Filter button ─────────────────────

function DirectorySearchBar({
  seed,
  category,
  countryFilter,
  distanceKm,
  hasViewerLocation,
}: {
  readonly seed: string;
  readonly category: LandingCategorySlug | null;
  readonly countryFilter: string | null;
  readonly distanceKm: number | null;
  readonly hasViewerLocation: boolean;
}) {
  return (
    <div style={searchRowStyle}>
      <form
        role="search"
        action="/nex-native/directory"
        method="get"
        style={searchFormStyle}
      >
        <span style={searchIconStyle} aria-hidden="true">
          <SearchGlyph />
        </span>
        <input
          type="search"
          name="q"
          placeholder="Search products, services, food, stays..."
          autoComplete="off"
          style={searchInputStyle}
          aria-label="Search listings"
        />
        <input type="hidden" name="s" value={seed} />
        {category ? (
          <input type="hidden" name="category" value={category} />
        ) : null}
      </form>
      {/* Owner directive 2026-10-16 · live FilterSheet client. The
          inert placeholder button was retired. */}
      <FilterSheet
        initialCategory={category}
        initialCountry={countryFilter}
        initialKm={distanceKm}
        hasViewerLocation={hasViewerLocation}
        basePath="/nex-native/directory"
        seed={seed}
      />
    </div>
  );
}

function SearchGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke={NEX.cyan} strokeWidth="2" />
      <path
        d="m20 20-3.5-3.5"
        stroke={NEX.cyan}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FilterGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <line x1="2" y1="4" x2="14" y2="4" stroke={NEX.cyan} strokeWidth="1.6" strokeLinecap="round" />
      <line x1="2" y1="8" x2="14" y2="8" stroke={NEX.cyan} strokeWidth="1.6" strokeLinecap="round" />
      <line x1="2" y1="12" x2="14" y2="12" stroke={NEX.cyan} strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="5" cy="4" r="1.6" fill={NEX.cyan} />
      <circle cx="11" cy="8" r="1.6" fill={NEX.cyan} />
      <circle cx="7" cy="12" r="1.6" fill={NEX.cyan} />
    </svg>
  );
}

// ─── Category dropdown · black panel · owner directive 2026-10-16 ──
//
// `<details>/<summary>` is a native HTML dropdown that works in a
// server component with ZERO JavaScript. The summary row shows the
// currently-selected category + a chevron that rotates when open.
// The expanded panel shows all 5 options on a solid black background,
// each with its icon + accent-coloured label.

function DirectoryCategoryDropdown({
  activeSlug,
}: {
  readonly activeSlug: LandingCategorySlug | null;
}) {
  const active =
    CATEGORY_PILLS.find((p) => {
      if (activeSlug === null) return p.slug === null;
      return p.slug === activeSlug;
    }) ?? CATEGORY_PILLS[0]!;
  return (
    <details style={dropdownRootStyle}>
      <summary
        style={dropdownSummaryStyle}
        aria-label={`Category: ${active.label}. Tap to change.`}
      >
        <span style={dropdownSummaryIconWrapStyle}>
          {active.slug === null ? (
            <AllGlyph />
          ) : (
            <span
              style={pillIconSpriteStyleFor(active.iconCol, active.iconRow, active.accent)}
              aria-hidden="true"
            />
          )}
        </span>
        <span
          style={{
            ...dropdownSummaryLabelStyle,
            color: active.slug === null ? NEX.text : active.accent,
          }}
        >
          {active.label}
        </span>
        <span style={dropdownChevronStyle} aria-hidden="true">
          ▾
        </span>
      </summary>
      <div style={dropdownMenuStyle} role="menu">
        {CATEGORY_PILLS.map((p) => {
          const isActive =
            (activeSlug === null && p.slug === null) ||
            (activeSlug !== null && p.slug === activeSlug);
          return (
            <Link
              key={p.slug ?? "__all__"}
              href={hrefFor(p.slug)}
              style={
                isActive ? dropdownOptionActiveStyle : dropdownOptionStyle
              }
              data-nex-directory-pill={p.slug ?? "all"}
              role="menuitem"
              aria-current={isActive ? "page" : undefined}
            >
              <span style={dropdownOptionIconWrapStyle}>
                {p.slug === null ? (
                  <AllGlyph />
                ) : (
                  <span
                    style={pillIconSpriteStyleFor(p.iconCol, p.iconRow, p.accent)}
                    aria-hidden="true"
                  />
                )}
              </span>
              <span
                style={{
                  ...dropdownOptionLabelStyle,
                  color: p.slug === null ? NEX.text : p.accent,
                }}
              >
                {p.label}
              </span>
              {isActive ? (
                <span style={dropdownOptionActiveMarkStyle} aria-hidden="true">
                  ✓
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </details>
  );
}

function AllGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true" fill="none">
      <rect x="2" y="2" width="5" height="5" rx="1" stroke={NEX.cyan} strokeWidth="1.6" />
      <rect x="9" y="2" width="5" height="5" rx="1" stroke={NEX.cyan} strokeWidth="1.6" />
      <rect x="2" y="9" width="5" height="5" rx="1" stroke={NEX.cyan} strokeWidth="1.6" />
      <rect x="9" y="9" width="5" height="5" rx="1" stroke={NEX.cyan} strokeWidth="1.6" />
    </svg>
  );
}

function pillIconSpriteStyleFor(
  col: 0 | 1 | 2 | 3,
  row: 0 | 1,
  accent: string,
): React.CSSProperties {
  return {
    width: 14,
    height: 14,
    backgroundImage: `url("${CATEGORY_ICON_SHEET}")`,
    backgroundSize: "400% 200%",
    backgroundPosition: `${(col * 100) / 3}% ${row * 100}%`,
    backgroundRepeat: "no-repeat",
    filter: `drop-shadow(0 0 3px ${accent}aa)`,
    flexShrink: 0,
  };
}

// ─── Results grid · 2-column ListingCard layout ────────────────────

function DirectoryResultsGrid({
  listings,
  feed,
  directoryCountry,
}: {
  readonly listings: readonly ListingCardViewModel[];
  readonly feed: LandingFeedOutcomeShape;
  /** Owner directive 2026-10-18 · every card must display a
   *  location row. When a listing has neither `city` nor
   *  `sellerCountryIso`, the card falls back to the directory's
   *  active country context (the same label shown in the header).
   *  Honest default · not fabricated · the directory IS filtered
   *  by this country, so attributing listings to it is accurate. */
  readonly directoryCountry: string;
}) {
  if (listings.length === 0) {
    if (feed.reducedState === "slug_unsupported") {
      return (
        <div style={emptyPanelStyle}>
          <p style={emptyPanelTitleStyle}>Not yet available on NEX.</p>
          <p style={emptyPanelBodyStyle}>
            This category is not yet connected to real listings. Try one of
            the other categories or browse everything.
          </p>
        </div>
      );
    }
    return (
      <div style={emptyPanelStyle}>
        <p style={emptyPanelTitleStyle}>No eligible listings yet.</p>
        <p style={emptyPanelBodyStyle}>
          Nothing matches this filter right now. New shops and places are
          added all the time.
        </p>
      </div>
    );
  }
  // Owner directive 2026-10-18 · resolve the directory's active
  // country into a human label ONCE per render · reused on every
  // card as the final location fallback when the listing's own
  // city + country are both null.
  const fallbackLocationLabel =
    findIsoCountry(directoryCountry)?.name ?? directoryCountry;
  // Owner directive 2026-10-18 · "we must make sure that we don't
  // show too many 'Chat for price' at once · buyers get annoyed".
  // Stable sort · priced cards (any of buyerLocalPrice OR priceNow
  // non-null) come FIRST within the current page. Unpriced cards
  // keep their relative order and fill the tail. This is a page-
  // local reorder · pagination still works · we're not hiding
  // anything, just making the first-impression real estate land
  // on cards that actually publish a number.
  const orderedListings = [...listings].sort((a, b) => {
    const aPriced =
      a.buyerLocalPrice !== null || a.priceNow !== null ? 0 : 1;
    const bPriced =
      b.buyerLocalPrice !== null || b.priceNow !== null ? 0 : 1;
    return aPriced - bPriced;
  });
  return (
    <div style={resultsGridStyle}>
      {orderedListings.map((card) => (
        <ListingCard
          key={card.id}
          listing={card}
          size={pickCardVariant(card.id)}
          fallbackLocationLabel={fallbackLocationLabel}
          fallbackCountryIso={directoryCountry}
        />
      ))}
    </div>
  );
}

/** Owner directive 2026-10-18 · stable hash of the listing id used
 *  to pick between "grid" and "grid-tall" variants for the Pinterest
 *  masonry rhythm. Pure · deterministic · fair · the same business
 *  always gets the same variant across every page load. ~1-in-3
 *  cards resolve to "grid-tall" via `(hash % 3 === 1)`. */
/** Owner directive 2026-10-18 · Slice 2 · the buyer-currency flag on
 *  each card wants a country code (ISO alpha-2) to render alongside
 *  the converted price. Currency → country is 1-to-1 for the 10
 *  sealed NEX currencies; this lookup is deliberately a static map
 *  so a tampered or unknown code resolves to the EU flag (safe
 *  fallback: EUR is Frankfurter's base currency). */
function inferCountryIso(currency: string): string {
  switch (currency) {
    case "IDR": return "ID";
    case "GBP": return "GB";
    case "USD": return "US";
    case "EUR": return "EU";
    case "SGD": return "SG";
    case "MYR": return "MY";
    case "THB": return "TH";
    case "PHP": return "PH";
    case "VND": return "VN";
    case "AUD": return "AU";
    default:    return "EU";
  }
}

function pickCardVariant(id: string): "grid" | "grid-tall" {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 3 === 1 ? "grid-tall" : "grid";
}

// Owner directive 2026-10-16 · the "Next →" button-only pattern was
// retired. The directory now shows numbered page links with ← back
// and → forward arrows at the boundaries. Current page is
// highlighted (non-clickable). Window size is 5 pages centred on
// the current page.
function LandingFeedPagination({
  seed,
  category,
  countryFilter,
  distanceKm,
  page,
  hasNext,
}: {
  readonly seed: string;
  readonly category: LandingCategorySlug | null;
  readonly countryFilter: string | null;
  readonly distanceKm: number | null;
  readonly page: number;
  /** When false, the right arrow renders as a disabled span rather
   *  than a Link · prevents navigating to an empty page past the
   *  last available row. */
  readonly hasNext: boolean;
}) {
  const prevPage = Math.max(1, page - 1);
  const nextPage = page + 1;
  const build = (p: number): string => {
    const base = hrefFor(category);
    const params = new URLSearchParams();
    params.set("s", seed);
    if (countryFilter) params.set("country", countryFilter);
    if (distanceKm !== null) params.set("km", String(distanceKm));
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  };

  // Owner directive 2026-10-16 (second-pass pagination design) ·
  // simplified to three elements: round left arrow · current page
  // count in the center · round right arrow. The page number in the
  // center increments as the viewer taps the right arrow and
  // decrements as the viewer taps the left arrow. No 5-page window,
  // no number pills · a single visual anchor.
  const atFirstPage = page <= 1;

  return (
    <nav
      aria-label="Pagination"
      style={paginationNavStyle}
      data-nex-directory-pagination
    >
      {!atFirstPage ? (
        <Link
          href={build(prevPage)}
          style={paginationRoundArrowStyle}
          aria-label="Previous page"
          data-nex-directory-prev
        >
          <ChevronLeftIcon />
        </Link>
      ) : (
        <span
          style={paginationRoundArrowDisabledStyle}
          aria-hidden="true"
          data-nex-directory-prev-disabled
        >
          <ChevronLeftIcon muted />
        </span>
      )}

      <span
        style={paginationCurrentStyle}
        aria-current="page"
        aria-label={`Page ${page}`}
        data-nex-directory-page-current
      >
        {page}
      </span>

      {hasNext ? (
        <Link
          href={build(nextPage)}
          style={paginationRoundArrowStyle}
          aria-label="Next page"
          data-nex-directory-next
        >
          <ChevronRightIcon />
        </Link>
      ) : (
        <span
          style={paginationRoundArrowDisabledStyle}
          aria-hidden="true"
          data-nex-directory-next-disabled
        >
          <ChevronRightIcon muted />
        </span>
      )}
    </nav>
  );
}

// Owner directive 2026-10-16 · proper SVG chevrons replace the plain
// Unicode text arrows (which render inconsistently and look like
// amateur ASCII art on some mobile fonts).
function ChevronLeftIcon({ muted = false }: { readonly muted?: boolean } = {}) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M10 3.5 5.5 8l4.5 4.5"
        stroke={muted ? NEX.textDim : NEX.cyan}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function ChevronRightIcon({ muted = false }: { readonly muted?: boolean } = {}) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6 3.5 10.5 8 6 12.5"
        stroke={muted ? NEX.textDim : NEX.cyan}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Styles ────────────────────────────────────────────────────────

// Owner directive 2026-10-16 · bg image fills FULL viewport height
// and width (no crop) and SCROLLS WITH the page content (the previous
// `background-attachment: fixed` version pinned the image to the
// viewport, which was wrong). Implementation: a dedicated
// position:absolute layer at the top of the main, sized to exactly
// one viewport (`width: 100%; height: 100svh`), with the image
// stretched edge-to-edge via `background-size: 100% 100%`. Scrolls
// off the top as the viewer moves down; the fallback navy takes over
// below.
const pageStyle: React.CSSProperties = {
  position: "relative",
  minHeight: "100dvh",
  width: "100%",
  margin: 0,
  padding: 0,
  color: NEX.text,
  display: "flex",
  flexDirection: "column",
  // Font-style audit · identical fontFamily chain to the landing page
  // so NEX text style is consistent across both surfaces.
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  backgroundColor: NEX.bg,
  overflowX: "hidden",
};

const pageBgLayerStyle: React.CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  width: "100%",
  height: "100svh",
  backgroundImage: `linear-gradient(180deg, rgba(2,9,20,0.35) 0%, rgba(2,9,20,0.55) 55%, rgba(2,9,20,0.82) 100%), url("${DIRECTORY_BG}")`,
  backgroundSize: "100% 100%, 100% 100%",
  backgroundRepeat: "no-repeat, no-repeat",
  backgroundPosition: "center, center",
  pointerEvents: "none",
  zIndex: 0,
};

const shellStyle: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  maxWidth: 420,
  margin: "0 auto",
  padding: "20px 16px 48px 16px",
  width: "100%",
  boxSizing: "border-box",
};

// Header
const headerBrandStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 10,
  marginBottom: 14,
};
const headerLeftColStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  flex: 1,
  minWidth: 0,
};
const headerWordmarkRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  // Owner directive 2026-10-18 (iteration) · cart + home relocated
  // to the right-side tool cluster. The wordmark row is now just
  // the "NEX" brand mark on its own.
};

// Owner directive 2026-10-18 (iteration) · right-side tool cluster
// containing cart · home · 3-dots. Flex-row, tight gap, aligned to
// the top of the header so the icons align with the NEX wordmark
// baseline (location row sits below on the left).
const headerRightClusterStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  gap: 6,
  flexShrink: 0,
};

// Owner directive 2026-10-18 · Slice 1 · currency picker row sits
// directly under the "All" category dropdown. Flush-left to match
// the search bar + category dropdown rhythm above.
const currencyRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  margin: "6px 0 10px",
};
const headerWordmarkStyle: React.CSSProperties = {
  color: NEX.cyanBright,
  fontSize: 40,
  fontWeight: 900,
  letterSpacing: 2,
  textShadow:
    "0 0 10px rgba(0,212,255,0.75), 0 0 24px rgba(0,175,255,0.45)",
  lineHeight: 1,
};
const headerLocationRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  marginTop: 4,
};
const headerLocationLabelStyle: React.CSSProperties = {
  color: NEX.cyan,
  fontSize: 12,
  fontWeight: 600,
};

// Owner directive 2026-10-18 · the back button + its label style
// retired. Replaced by the shared ControlDrawer on the right of the
// header and the cart + home icons on the left.
//
// Icon slot styles · 32×32 chrome-less containers so the inline
// HeaderCartIcon and the home Link read as a matched pair sitting
// to the left of the NEX wordmark. Deliberately no border or
// background so neither icon ships a persistent "container line"
// (same cleanup we applied to the welcome header's 3-dots).
const headerIconSlotStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 32,
  height: 32,
  color: NEX.text,
  WebkitTapHighlightColor: "transparent",
};
const headerIconLinkStyle: React.CSSProperties = {
  ...headerIconSlotStyle,
  textDecoration: "none",
  cursor: "pointer",
};

// Search bar
const searchRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginBottom: 14,
};
const searchFormStyle: React.CSSProperties = {
  flex: 1,
  // Owner directive 2026-10-16 · minWidth 0 lets the search input
  // shrink inside the flex row so the Filter button beside it never
  // overflows the mobile viewport. Without this, the browser-default
  // minimum width of <input> (~200px) pushes the Filter button off
  // screen on narrow devices.
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "0 14px",
  minHeight: 44,
  borderRadius: 999,
  background: "rgba(2,9,20,0.72)",
  border: "1.5px solid rgba(0,175,255,0.55)",
  boxShadow: "0 0 14px rgba(0,175,255,0.25), inset 0 0 10px rgba(0,175,255,0.08)",
};
const searchIconStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};
const searchInputStyle: React.CSSProperties = {
  flex: 1,
  // Prevent the browser-default input min-width from pushing the
  // Filter button off the viewport on narrow mobile.
  minWidth: 0,
  width: "100%",
  background: "transparent",
  border: "none",
  outline: "none",
  color: NEX.text,
  fontSize: 13,
  padding: "4px 0",
  fontFamily: "inherit",
};
const filterPillStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "0 16px",
  minHeight: 44,
  borderRadius: 999,
  background: "rgba(2,9,20,0.72)",
  color: NEX.cyan,
  border: "1.5px solid rgba(0,175,255,0.55)",
  boxShadow: "0 0 14px rgba(0,175,255,0.25)",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  flexShrink: 0,
  fontFamily: "inherit",
};

// Category dropdown · black panel · owner directive 2026-10-16
// (previous 5-pill row didn't fit cleanly on narrow viewports).
// Uses the native <details>/<summary> element · zero JS · works in
// a server component · one-tap toggle · accessible by default.
const dropdownRootStyle: React.CSSProperties = {
  position: "relative",
  marginBottom: 14,
  // Reset the default disclosure triangle on all browsers · we draw
  // our own chevron on the right of the summary.
};
const dropdownSummaryStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "0 14px",
  minHeight: 44,
  borderRadius: 14,
  background: "#000000",
  border: "1.5px solid rgba(0,175,255,0.55)",
  boxShadow: "0 0 14px rgba(0,175,255,0.25)",
  cursor: "pointer",
  listStyle: "none",
  // Suppress the default Safari / Chrome disclosure marker.
  WebkitAppearance: "none",
};
const dropdownSummaryIconWrapStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};
const dropdownSummaryLabelStyle: React.CSSProperties = {
  flex: 1,
  fontSize: 14,
  fontWeight: 700,
  letterSpacing: 0.3,
};
const dropdownChevronStyle: React.CSSProperties = {
  color: NEX.cyan,
  fontSize: 14,
  fontWeight: 700,
  flexShrink: 0,
};
// The expanded panel · solid black per owner directive.
const dropdownMenuStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  marginTop: 6,
  padding: 6,
  background: "#000000",
  border: "1.5px solid rgba(0,175,255,0.55)",
  borderRadius: 14,
  boxShadow: "0 8px 24px rgba(0,0,0,0.6), 0 0 14px rgba(0,175,255,0.25)",
};
const dropdownOptionBaseStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "0 12px",
  minHeight: 44,
  borderRadius: 10,
  textDecoration: "none",
  background: "transparent",
};
const dropdownOptionStyle: React.CSSProperties = { ...dropdownOptionBaseStyle };
const dropdownOptionActiveStyle: React.CSSProperties = {
  ...dropdownOptionBaseStyle,
  background: "rgba(0,175,255,0.14)",
  border: "1px solid rgba(0,175,255,0.5)",
};
const dropdownOptionIconWrapStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  width: 20,
  height: 20,
};
const dropdownOptionLabelStyle: React.CSSProperties = {
  flex: 1,
  fontSize: 14,
  fontWeight: 700,
  letterSpacing: 0.3,
};
const dropdownOptionActiveMarkStyle: React.CSSProperties = {
  color: NEX.cyan,
  fontSize: 14,
  fontWeight: 800,
  flexShrink: 0,
};

// Owner directive 2026-10-18 · Pinterest-style masonry POC.
// Switched from `display: grid; grid-template-columns: repeat(2, 1fr)`
// to CSS columns · in a CSS-columns container, cards flow top-to-
// bottom within each column at their natural height, which is what
// delivers the "one card longer than the next" masonry rhythm when
// combined with the new "grid-tall" variant on every 3rd card.
// `breakInside: avoid` on each card (see listing-card.tsx) prevents
// cards from splitting across column boundaries. Vertical gap
// between cards comes from `marginBottom: 12` on cardShellStyle so
// stacked cards within one column don't butt against each other.
const resultsGridStyle: React.CSSProperties = {
  columnCount: 2,
  columnGap: 12,
  columnFill: "balance",
  marginTop: 4,
};

const emptyPanelStyle: React.CSSProperties = {
  marginTop: 16,
  padding: "20px 18px",
  background: "rgba(10,21,38,0.82)",
  border: "1px solid rgba(0,175,255,0.18)",
  borderRadius: 14,
  display: "flex",
  flexDirection: "column",
  gap: 6,
};
const emptyPanelTitleStyle: React.CSSProperties = {
  margin: 0,
  color: NEX.text,
  fontSize: 14,
  fontWeight: 700,
};
const emptyPanelBodyStyle: React.CSSProperties = {
  margin: 0,
  color: NEX.textDim,
  fontSize: 12,
  lineHeight: 1.4,
};
// Three-element pagination row · owner directive 2026-10-16 (second
// pass) · round-arrow · page-count · round-arrow. No scrollbar
// safety-net needed · the row only ever has three elements.
const paginationNavStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "nowrap",
  alignItems: "center",
  justifyContent: "center",
  gap: 14,
  marginTop: 28,
  padding: "4px 2px",
};
// Round left/right arrow buttons flank the current-page count.
// 44 px circles · owner directive 2026-10-16 (second pass review) ·
// 44×44 is the recommended minimum comfortable mobile touch target
// (previously 40 px). Cyan rim · soft glow. The disabled variant
// renders on page 1 (left) + last page (right) to keep the layout
// symmetric and to visually signal "no further navigation".
const paginationRoundArrowStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 44,
  height: 44,
  borderRadius: "50%",
  background: "rgba(2,9,20,0.55)",
  border: "1px solid rgba(0,175,255,0.45)",
  boxShadow: "0 0 10px rgba(0,175,255,0.18)",
  textDecoration: "none",
  cursor: "pointer",
  flexShrink: 0,
};
const paginationRoundArrowDisabledStyle: React.CSSProperties = {
  ...paginationRoundArrowStyle,
  background: "rgba(2,9,20,0.3)",
  border: "1px solid rgba(125,155,192,0.18)",
  boxShadow: "none",
  cursor: "default",
};
// Current page count · the single visual anchor of the new three-
// element pagination (round-arrow · page-count · round-arrow). The
// number is deliberately larger than the arrows so the viewer's eye
// lands on the page they're currently on. Owner directive
// 2026-10-16 (second-pass pagination design).
const paginationCurrentStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 48,
  height: 40,
  padding: "0 14px",
  borderRadius: 999,
  background: "linear-gradient(180deg, #00D4FF 0%, #00AFFF 100%)",
  color: NEX.bg,
  border: `1px solid rgba(0,175,255,0.9)`,
  fontSize: 16,
  fontWeight: 800,
  letterSpacing: 0.3,
  boxShadow:
    "0 0 16px rgba(0,175,255,0.6), inset 0 1px 0 rgba(255,255,255,0.25)",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  fontVariantNumeric: "tabular-nums",
  flexShrink: 0,
};
