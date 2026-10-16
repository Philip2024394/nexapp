"use client";

// src/app/nex-native/directory/_filter-sheet-client.tsx
//
// NEX Directory · Filter bottom sheet · owner directive 2026-10-16.
// --------------------------------------------------------------------
// Three LIVE filters wired to existing data:
//   · Category          · reuses the sealed landing-category-mapping
//                         slugs (same vocabulary as the dropdown
//                         + landing tiles · one source of truth).
//   · Country           · seller-located-in · canonical rows carry
//                         ISO alpha-2. Short list for Phase A ·
//                         "Any country" clears the filter.
//   · Within N km       · distance from viewer. Options 5 / 10 / 25
//                         / 50 / 100 km + "Any distance". Disabled
//                         when the viewer has no saved location ·
//                         honest message instead of a silent gate.
//
// Four HONEST "coming soon" sections · owner directive · must appear
// as disabled with a plain English explanation that seller data isn't
// yet collected. Never behave as functional filters.
//   · Free shipping · seller-declared · Phase 1.5
//   · Wholesale / MOQ · per-product · Phase 1.5
//   · Returns accepted · per-product · Phase 1.5
//   · Delivery time · per-destination · Phase 1.5
//
// Interaction:
//   · Taps the Filter pill → sheet overlay opens
//   · Backdrop click OR × button closes
//   · Reset clears all three filters (navigates to base route)
//   · Apply navigates to the URL with the chosen params; sheet closes
//
// Owner compliance:
//   · Country means "seller located in" · NEVER labelled "ships to"
//   · Distance filter never asks for location consent itself ·
//     reuses existing viewer location via useUserLocationContext
//   · No fabricated discount/shipping/stock data

import * as React from "react";
import { useRouter } from "next/navigation";
import type { LandingCategorySlug } from "@/lib/nex-native/directory/landing-category-mapping";
import { CountryFlag } from "@/components/nex-native/directory/country-flag";

export interface FilterSheetProps {
  readonly initialCategory: LandingCategorySlug | null;
  readonly initialCountry: string | null;
  readonly initialKm: number | null;
  readonly hasViewerLocation: boolean;
  readonly basePath: string; // "/nex-native/directory" or "/nex-native/directory/<slug>"
  readonly seed: string;
}

// Category slugs the sheet surfaces · matches the dropdown + landing
// tiles. Keep in sync with CATEGORY_PILLS in _landing-directory-view.
const CATEGORY_OPTIONS: ReadonlyArray<{
  readonly slug: LandingCategorySlug | null;
  readonly label: string;
}> = [
  { slug: null, label: "All categories" },
  { slug: "products", label: "Products" },
  { slug: "stay", label: "Stays" },
  { slug: "food", label: "Food" },
  { slug: "services", label: "Services" },
];

// Short country list for Phase A · hardcoded ISO alpha-2 codes. A
// future Phase 1.5 can swap this for a dynamic list from
// listCountryCounts. "Any country" clears the filter.
const COUNTRY_OPTIONS: ReadonlyArray<{
  readonly iso: string | null;
  readonly label: string;
}> = [
  { iso: null, label: "Any country" },
  { iso: "ID", label: "Indonesia" },
  { iso: "GB", label: "United Kingdom" },
  { iso: "US", label: "United States" },
  { iso: "AU", label: "Australia" },
  { iso: "SG", label: "Singapore" },
  { iso: "MY", label: "Malaysia" },
  { iso: "TH", label: "Thailand" },
  { iso: "JP", label: "Japan" },
];

// Distance options · km · owner-approved 2026-10-16.
const KM_OPTIONS: ReadonlyArray<{ readonly km: number | null; readonly label: string }> = [
  { km: null, label: "Any distance" },
  { km: 5, label: "5 km" },
  { km: 10, label: "10 km" },
  { km: 25, label: "25 km" },
  { km: 50, label: "50 km" },
  { km: 100, label: "100 km" },
];

export function FilterSheet({
  initialCategory,
  initialCountry,
  initialKm,
  hasViewerLocation,
  basePath,
  seed,
}: FilterSheetProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [category, setCategory] = React.useState<LandingCategorySlug | null>(
    initialCategory,
  );
  const [country, setCountry] = React.useState<string | null>(initialCountry);
  const [km, setKm] = React.useState<number | null>(initialKm);

  const close = React.useCallback(() => setOpen(false), []);

  const apply = React.useCallback(() => {
    // Build the destination URL. Category routes through the sealed
    // category-slug path; other filters go on query params.
    const basePathForCategory = category
      ? `/nex-native/directory/${category}`
      : "/nex-native/directory";
    const params = new URLSearchParams();
    if (seed) params.set("s", seed);
    if (country) params.set("country", country);
    if (km !== null) params.set("km", String(km));
    const qs = params.toString();
    const href = qs ? `${basePathForCategory}?${qs}` : basePathForCategory;
    router.push(href);
    setOpen(false);
  }, [category, country, km, router, seed]);

  const reset = React.useCallback(() => {
    setCategory(null);
    setCountry(null);
    setKm(null);
  }, []);

  // Close on Escape · universal UX expectation.
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  // Reset the local filter state to match the current URL when the
  // sheet closes · stops stale selections leaking into the next open.
  React.useEffect(() => {
    if (!open) {
      setCategory(initialCategory);
      setCountry(initialCountry);
      setKm(initialKm);
    }
  }, [open, initialCategory, initialCountry, initialKm]);

  // Suppress void usage warning · basePath is reserved for a future
  // deeper-route scope (e.g., /directory/{category}/{subcategory}).
  void basePath;

  return (
    <>
      <button
        type="button"
        style={filterPillStyle}
        onClick={() => setOpen(true)}
        aria-label="Open filters"
        title="Open filters"
        data-nex-filter-trigger
      >
        <FilterGlyph />
      </button>

      {open ? (
        <>
          <div
            style={backdropStyle}
            onClick={close}
            aria-hidden="true"
            data-nex-filter-backdrop
          />
          <div
            style={sheetStyle}
            role="dialog"
            aria-label="Directory filters"
            aria-modal="true"
            data-nex-filter-sheet
          >
            <div style={sheetHeaderStyle}>
              <h2 style={sheetTitleStyle}>Filters</h2>
              <button
                type="button"
                style={closeButtonStyle}
                onClick={close}
                aria-label="Close filters"
              >
                ×
              </button>
            </div>

            {/* ── Category ── */}
            <section style={sectionStyle}>
              <h3 style={sectionTitleStyle}>Category</h3>
              <div style={radioGridStyle}>
                {CATEGORY_OPTIONS.map((o) => {
                  const active =
                    (category === null && o.slug === null) ||
                    category === o.slug;
                  return (
                    <button
                      key={o.slug ?? "__all__"}
                      type="button"
                      style={active ? optionActiveStyle : optionStyle}
                      onClick={() => setCategory(o.slug)}
                      aria-pressed={active}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* ── Country (seller located in) · dropdown with flags ── */}
            <section style={sectionStyle}>
              <h3 style={sectionTitleStyle}>Country</h3>
              <p style={sectionHintStyle}>Where the seller is located.</p>
              <CountryDropdown value={country} onChange={setCountry} />
            </section>

            {/* ── Within N km ── */}
            <section style={sectionStyle}>
              <h3 style={sectionTitleStyle}>Distance from me</h3>
              {hasViewerLocation ? (
                <div style={radioGridStyle}>
                  {KM_OPTIONS.map((o) => {
                    const active =
                      (km === null && o.km === null) || km === o.km;
                    return (
                      <button
                        key={o.km ?? "__any__"}
                        type="button"
                        style={active ? optionActiveStyle : optionStyle}
                        onClick={() => setKm(o.km)}
                        aria-pressed={active}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p style={sectionHintStyle}>
                  Grant location access on the directory page to enable
                  the distance filter.
                </p>
              )}
            </section>

            {/* ── Honest "Coming soon" rows · owner directive ── */}
            <ComingSoonSection
              title="Exports to"
              reason="Seller-declared export destinations not yet collected. When wired, buyers will filter sellers who ship to a chosen country."
            />
            <ComingSoonSection
              title="Free shipping"
              reason="Seller shipping policies not yet collected."
            />
            <ComingSoonSection
              title="Wholesale / minimum order"
              reason="Per-product wholesale fields not yet collected."
            />
            <ComingSoonSection
              title="Returns accepted"
              reason="Per-product returns policy not yet collected."
            />
            <ComingSoonSection
              title="Delivery time"
              reason="Per-destination delivery estimates not yet collected."
            />

            {/* ── Actions ── */}
            <div style={actionsRowStyle}>
              <button
                type="button"
                style={resetButtonStyle}
                onClick={reset}
                data-nex-filter-reset
              >
                Reset
              </button>
              <button
                type="button"
                style={applyButtonStyle}
                onClick={apply}
                data-nex-filter-apply
              >
                Apply
              </button>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}

function ComingSoonSection({
  title,
  reason,
}: {
  readonly title: string;
  readonly reason: string;
}) {
  return (
    <section style={{ ...sectionStyle, opacity: 0.52 }}>
      <div style={comingSoonHeaderStyle}>
        <h3 style={sectionTitleStyle}>{title}</h3>
        <span style={comingSoonChipStyle}>Coming soon</span>
      </div>
      <p style={sectionHintStyle}>{reason}</p>
    </section>
  );
}

// Native-feeling dropdown with a small circular country flag beside
// each option. Uses the same `<details>/<summary>` pattern as the
// directory category dropdown · zero JS listeners for open/close ·
// closes automatically when any option is selected (onClick fires
// before the parent's native toggle). Owner directive 2026-10-16.
function CountryDropdown({
  value,
  onChange,
}: {
  readonly value: string | null;
  readonly onChange: (iso: string | null) => void;
}) {
  const active =
    COUNTRY_OPTIONS.find((o) => o.iso === value) ?? COUNTRY_OPTIONS[0]!;
  const detailsRef = React.useRef<HTMLDetailsElement | null>(null);
  const pick = React.useCallback(
    (iso: string | null) => {
      onChange(iso);
      // Collapse the dropdown programmatically after selection.
      if (detailsRef.current) detailsRef.current.open = false;
    },
    [onChange],
  );
  return (
    <details ref={detailsRef} style={countryDropdownRootStyle}>
      <summary style={countryDropdownSummaryStyle} aria-label="Choose seller country">
        <span style={countryDropdownLeftStyle}>
          {active.iso ? (
            <CountryFlag isoAlpha2={active.iso} size={20} />
          ) : (
            <AnyCountryGlyph />
          )}
          <span style={countryDropdownLabelStyle}>{active.label}</span>
        </span>
        <ChevronDown />
      </summary>
      <div style={countryDropdownMenuStyle} role="listbox">
        {COUNTRY_OPTIONS.map((o) => {
          const isActive = o.iso === value;
          return (
            <button
              key={o.iso ?? "__any__"}
              type="button"
              style={isActive ? countryOptionActiveStyle : countryOptionStyle}
              onClick={() => pick(o.iso)}
              role="option"
              aria-selected={isActive}
            >
              <span style={countryOptionLeftStyle}>
                {o.iso ? (
                  <CountryFlag isoAlpha2={o.iso} size={20} />
                ) : (
                  <AnyCountryGlyph />
                )}
                <span style={countryOptionLabelStyle}>{o.label}</span>
              </span>
              {isActive ? (
                <span style={countryOptionCheckStyle} aria-hidden="true">
                  ✓
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </details>
  );
}

function AnyCountryGlyph() {
  // Small circular globe · stands in for "Any country" so the dropdown
  // still shows a glyph in the first slot. ISO-text fallback would say
  // "null" which is confusing · a globe is honest + universal.
  return (
    <span style={anyCountryGlyphStyle} aria-hidden="true">
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6" stroke={CYAN} strokeWidth="1.6" />
        <ellipse cx="8" cy="8" rx="3" ry="6" stroke={CYAN} strokeWidth="1.4" />
        <line x1="2" y1="8" x2="14" y2="8" stroke={CYAN} strokeWidth="1.2" />
      </svg>
    </span>
  );
}

function ChevronDown() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M4 6l4 4 4-4"
        stroke={CYAN}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FilterGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <line x1="2" y1="4" x2="14" y2="4" stroke={CYAN} strokeWidth="1.6" strokeLinecap="round" />
      <line x1="2" y1="8" x2="14" y2="8" stroke={CYAN} strokeWidth="1.6" strokeLinecap="round" />
      <line x1="2" y1="12" x2="14" y2="12" stroke={CYAN} strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="5" cy="4" r="1.6" fill={CYAN} />
      <circle cx="11" cy="8" r="1.6" fill={CYAN} />
      <circle cx="7" cy="12" r="1.6" fill={CYAN} />
    </svg>
  );
}

// ─── Styles ────────────────────────────────────────────────────────

const CYAN = "#00AFFF";
const TEXT = "#F2F5F8";
const MUTED = "#7D9BC0";
const BG = "#020914";
const PANEL_BORDER = "rgba(0,175,255,0.55)";

// Owner directive 2026-10-16 · Filter button must fit beside the
// search input inside the mobile viewport. Icon-only · square 44x44 ·
// no "Filter" text taking horizontal space · aria-label handles the
// semantic name. Also pins flex-shrink:0 so the search input shrinks
// first, never the button.
const filterPillStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 44,
  height: 44,
  borderRadius: 999,
  background: "rgba(2,9,20,0.72)",
  color: CYAN,
  border: `1.5px solid ${PANEL_BORDER}`,
  boxShadow: "0 0 14px rgba(0,175,255,0.25)",
  cursor: "pointer",
  flexShrink: 0,
  padding: 0,
};

// Owner directive 2026-10-16 · the backdrop + sheet both switch from
// `position: fixed` → `position: absolute` so they anchor to the
// `.nex-native-frame` ancestor (which is `position: relative` per
// nex-native.css). On mobile the frame IS viewport-sized, so
// absolute positioning is visually identical to fixed. On desktop
// the frame is 420x909 centred · the sheet now stays INSIDE the
// phone frame instead of escaping to the full desktop viewport.
const backdropStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "rgba(0,0,0,0.6)",
  zIndex: 50,
  cursor: "pointer",
};

// Owner directive 2026-10-16 · the filter slider must match the
// mobile shell width (420px max) centred on screen, not stretch
// across a full desktop viewport. On narrow mobile viewports the
// sheet fills edge-to-edge via `width: 100%`; above 420px it
// recentres and caps at the shell width.
const sheetStyle: React.CSSProperties = {
  // Absolute within the `.nex-native-frame` (position: relative) so
  // the sheet stays inside the phone frame on desktop · identical to
  // viewport-fixed on mobile (frame = viewport). Owner directive
  // 2026-10-16.
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
  width: "100%",
  maxHeight: "92%",
  overflowY: "auto",
  background: BG,
  borderTopLeftRadius: 20,
  borderTopRightRadius: 20,
  borderTop: `1.5px solid ${PANEL_BORDER}`,
  boxShadow: "0 -8px 40px rgba(0,0,0,0.65)",
  padding: "16px 16px 24px 16px",
  zIndex: 51,
  color: TEXT,
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  boxSizing: "border-box",
};

const sheetHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 10,
};
const sheetTitleStyle: React.CSSProperties = {
  margin: 0,
  color: TEXT,
  fontSize: 18,
  fontWeight: 800,
  letterSpacing: 0.2,
};
const closeButtonStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: CYAN,
  fontSize: 28,
  cursor: "pointer",
  padding: "4px 10px",
  lineHeight: 1,
};

const sectionStyle: React.CSSProperties = {
  marginBottom: 14,
  paddingBottom: 10,
  borderBottom: "1px solid rgba(0,175,255,0.14)",
};
const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  color: TEXT,
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: 0.3,
};
const sectionHintStyle: React.CSSProperties = {
  margin: "4px 0 8px 0",
  color: MUTED,
  fontSize: 11,
  lineHeight: 1.4,
};

const radioGridStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  marginTop: 8,
};
const optionStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "8px 12px",
  minHeight: 34,
  borderRadius: 999,
  background: "rgba(2,9,20,0.7)",
  color: TEXT,
  border: "1.5px solid rgba(0,175,255,0.35)",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
};
const optionActiveStyle: React.CSSProperties = {
  ...optionStyle,
  background: "rgba(0,175,255,0.22)",
  border: "1.5px solid rgba(0,175,255,0.95)",
  boxShadow: "0 0 10px rgba(0,175,255,0.4)",
  color: TEXT,
};

const comingSoonHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
};
const comingSoonChipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "2px 8px",
  borderRadius: 999,
  background: "rgba(125,155,192,0.14)",
  color: MUTED,
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: 0.4,
  textTransform: "uppercase",
};

const actionsRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  marginTop: 10,
  paddingTop: 10,
};
const resetButtonStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 48,
  borderRadius: 999,
  background: "transparent",
  color: CYAN,
  border: `1.5px solid ${PANEL_BORDER}`,
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
};
const applyButtonStyle: React.CSSProperties = {
  flex: 2,
  minHeight: 48,
  borderRadius: 999,
  background: CYAN,
  color: BG,
  border: `1.5px solid ${CYAN}`,
  fontSize: 14,
  fontWeight: 800,
  cursor: "pointer",
  boxShadow: "0 6px 20px rgba(0,175,255,0.45)",
  fontFamily: "inherit",
};

// ─── Country dropdown ────────────────────────────────────────────

const countryDropdownRootStyle: React.CSSProperties = {
  position: "relative",
  marginTop: 8,
};
const countryDropdownSummaryStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  padding: "0 14px",
  minHeight: 44,
  borderRadius: 12,
  background: "rgba(2,9,20,0.72)",
  color: TEXT,
  border: `1.5px solid rgba(0,175,255,0.4)`,
  cursor: "pointer",
  listStyle: "none",
  WebkitAppearance: "none",
};
const countryDropdownLeftStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  minWidth: 0,
};
const countryDropdownLabelStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: TEXT,
  letterSpacing: 0.2,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};
const countryDropdownMenuStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  marginTop: 6,
  padding: 6,
  maxHeight: 320,
  overflowY: "auto",
  background: "#000000",
  border: `1.5px solid rgba(0,175,255,0.55)`,
  borderRadius: 12,
  boxShadow: "0 10px 28px rgba(0,0,0,0.6), 0 0 14px rgba(0,175,255,0.2)",
};
const countryOptionBaseStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  padding: "0 12px",
  minHeight: 44,
  borderRadius: 8,
  background: "transparent",
  color: TEXT,
  border: "1px solid transparent",
  cursor: "pointer",
  textAlign: "left",
  fontFamily: "inherit",
  width: "100%",
};
const countryOptionStyle: React.CSSProperties = { ...countryOptionBaseStyle };
const countryOptionActiveStyle: React.CSSProperties = {
  ...countryOptionBaseStyle,
  background: "rgba(0,175,255,0.14)",
  border: "1px solid rgba(0,175,255,0.5)",
};
const countryOptionLeftStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  minWidth: 0,
};
const countryOptionLabelStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: TEXT,
  letterSpacing: 0.2,
};
const countryOptionCheckStyle: React.CSSProperties = {
  color: CYAN,
  fontSize: 14,
  fontWeight: 800,
  flexShrink: 0,
};
const anyCountryGlyphStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 20,
  height: 20,
  borderRadius: "50%",
  backgroundColor: "#1A1300",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  flexShrink: 0,
};
