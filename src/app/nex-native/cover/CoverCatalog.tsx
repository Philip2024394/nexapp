"use client";

// src/app/nex-native/cover/CoverCatalog.tsx
//
// Category Tabs + Pagination · sealed 2026-09-30 · updated 2026-09-30.
// -----------------------------------------------------------------------------
// Drop-in replacement for <CoverProductGrid> that renders the shop's
// one-word category tabs above a filtered, paginated grid.
//
// Doctrine (see category_tabs_doctrine_2026_09_30.md):
//   · 0-1 sections  → tab bar hidden (tabs primitive returns null)
//   · 2-3 sections  → up to 3 tabs · NO "All" tab · FIRST tab is
//     highlighted on arrival (founder direction 2026-09-30) · tap
//     the highlighted tab to clear the filter (shows every product)
//   · Uncategorised (section_id === null) → visible when no tab active
//
// Pagination (founder direction 2026-09-30):
//   · pageSize defaults to 4 cards per page
//   · Controls beneath the grid: [← prev] [1] [2] [3] [next →]
//   · Auto-hidden when the filtered result fits on one page
//   · Changing the active tab resets to page 1

import * as React from "react";
import { useSearchParams } from "next/navigation";
import {
  ALL_TAB_ID,
  CoverCategoryTabs,
  CoverProductGrid,
  type CoverProduct,
  type CoverSection,
} from "./primitives";

export function CoverCatalog({
  sections,
  products,
  peerAccountId,
  columns = 2,
  pageSize,
  variant = "grid",
  brandStripUrl = null,
  textOnly = false,
  hideTabs = false,
  controlledActiveId,
  onActiveIdChange,
}: {
  sections: CoverSection[];
  products: CoverProduct[];
  peerAccountId: string;
  columns?: 1 | 2 | 3;
  /** Cards per page in the paginated grid. Default 4 for grid variant
   *  · 8 for landscape variant (owner directive 2026-11-28 · bumped
   *  from the original 6 so Template 11 / 15 landscape templates fit
   *  exactly 8 product cards per page) · 6 for round variant (founder
   *  direction 2026-09-30 · 3x2 · reads calmer than a 3x3 wall on a
   *  phone screen). */
  pageSize?: number;
  /** Founder direction 2026-09-30 · "landscape" forces single-column
   *  horizontal cards (Template 11) · "round" forces 3-column circle
   *  cards (Template 14). */
  variant?: "grid" | "landscape" | "round";
  /** Owner directive 2026-11-28 · vertical brand-strip image forwarded
   *  to each landscape card. Used by Template 15
   *  (product_hero_landscape). Null = no strip. */
  brandStripUrl?: string | null;
  /** Owner directive 2026-11-28 (second pass) · when true AND variant
   *  === "landscape", each card hides its brand strip + product image
   *  and paints a light-gray surface behind the text column. Template 15
   *  uses this to become a pure name/description/price row. */
  textOnly?: boolean;
  /** Owner directive 2026-11-28 (third pass) · when true, suppress the
   *  internal category select so the parent layout can render its own
   *  category control (e.g. Template 15's orange-on-black dropdown)
   *  and still drive the grid filter via controlledActiveId. */
  hideTabs?: boolean;
  /** Owner directive 2026-11-28 (third pass) · when present, the
   *  active section filter is driven by the parent. Pair with
   *  onActiveIdChange so tab + pagination state stay in sync. */
  controlledActiveId?: string;
  onActiveIdChange?: (id: string) => void;
}): React.JSX.Element {
  const effectivePageSize =
    pageSize ??
    (variant === "landscape" ? 8 : variant === "round" ? 6 : 4);
  // Founder direction 2026-09-30 · FIRST tab active on arrival · not
  // empty. Buyer lands filtered to the seller's first category, sees
  // its underline, taps it again (toggle) if they want to see all.
  const firstSectionId = React.useMemo(() => {
    if (sections.length === 0) return "";
    const ordered = [...sections].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
    );
    return ordered[0].id;
  }, [sections]);

  // Owner directive 2026-10-22 · Ask-Seller slice 4 · deep-link return
  // from a shared product message. When ?product=<id> is present on
  // the shop URL AND the product exists in this catalog, auto-select
  // the section tab + page so the buyer lands with that product in
  // view. Honest-null: unknown id falls through to the normal first-
  // tab default · no error. Buyer can still change tabs after arrival.
  const searchParams = useSearchParams();
  const highlightProductId = searchParams?.get("product") ?? null;

  const highlightProduct = React.useMemo(() => {
    if (!highlightProductId) return null;
    return products.find((p) => p.id === highlightProductId) ?? null;
  }, [highlightProductId, products]);

  // When a highlight product is found, start on its section tab.
  // Section id may be null (uncategorised) · falls back to firstSectionId
  // so the catalog never opens filter-less with uncategorised hidden.
  const initialActiveId = React.useMemo(() => {
    if (highlightProduct?.section_id) return highlightProduct.section_id;
    return firstSectionId;
  }, [highlightProduct, firstSectionId]);

  const [uncontrolledActiveId, setUncontrolledActiveId] =
    React.useState<string>(initialActiveId);
  // Owner directive 2026-11-28 (third pass) · when the parent passes
  // controlledActiveId, that value drives the filter and we forward
  // every change up via onActiveIdChange. Keeps internal state as a
  // fallback for untouched templates.
  const isControlled = typeof controlledActiveId === "string";
  const activeId = isControlled
    ? (controlledActiveId as string)
    : uncontrolledActiveId;
  const [page, setPage] = React.useState(0);

  // Reset to page 1 whenever the filter changes.
  React.useEffect(() => {
    setPage(0);
  }, [activeId]);

  const filtered = React.useMemo(() => {
    if (activeId === "" || activeId === ALL_TAB_ID) return products;
    return products.filter((p) => p.section_id === activeId);
  }, [activeId, products]);

  // Owner directive 2026-10-22 · Ask-Seller slice 4 · after the filter
  // resolves, advance the page to the one containing the highlighted
  // product so the buyer doesn't land on page 1 of a long catalog.
  // Guarded: only fires once per highlight id change · depends on the
  // filtered list stabilising first (hence running after filter memo).
  React.useEffect(() => {
    if (!highlightProductId) return;
    const idx = filtered.findIndex((p) => p.id === highlightProductId);
    if (idx < 0) return;
    const targetPage = Math.floor(idx / effectivePageSize);
    setPage(targetPage);
  }, [highlightProductId, filtered, effectivePageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / effectivePageSize));
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * effectivePageSize;
  const visible = filtered.slice(start, start + effectivePageSize);

  const handleTabSelect = React.useCallback(
    (nextId: string) => {
      // Toggle: tapping the highlighted tab clears the filter so the
      // buyer can see every product without needing an "All" tab.
      const resolved = activeId === nextId ? "" : nextId;
      if (isControlled) {
        onActiveIdChange?.(resolved);
      } else {
        setUncontrolledActiveId(resolved);
      }
    },
    [activeId, isControlled, onActiveIdChange],
  );

  return (
    <div>
      {!hideTabs && (
        <CoverCategoryTabs
          sections={sections}
          activeId={activeId}
          onSelect={handleTabSelect}
        />
      )}
      <CoverProductGrid
        products={visible}
        peerAccountId={peerAccountId}
        columns={columns}
        activeSectionId={ALL_TAB_ID}
        variant={variant}
        brandStripUrl={brandStripUrl}
        textOnly={textOnly}
      />
      {totalPages > 1 && (
        <Pagination
          page={safePage}
          totalPages={totalPages}
          onSelect={setPage}
        />
      )}
    </div>
  );
}

// ─── Pagination controls · themed via CSS vars ──────────────────────

function Pagination({
  page,
  totalPages,
  onSelect,
}: {
  page: number;
  totalPages: number;
  onSelect: (page: number) => void;
}) {
  const canPrev = page > 0;
  const canNext = page < totalPages - 1;

  /* Owner directive 2026-11-06 · "each template shop must have
     page previous and back and page count for template displaying".
     The numbered-pills row was dropped in favour of a compact
     "Page X of Y" readout between the arrows · same semantics,
     same tap targets, less pixel chrome on narrow shop surfaces. */

  return (
    <div
      role="navigation"
      aria-label="Product pages"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        marginTop: 18,
      }}
    >
      <PageArrow
        direction="prev"
        disabled={!canPrev}
        onClick={() => canPrev && onSelect(page - 1)}
      />
      <span
        aria-live="polite"
        style={{
          display: "inline-flex",
          alignItems: "baseline",
          gap: 6,
          padding: "6px 14px",
          fontFamily: "var(--nex-font-body, inherit)",
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--nex-text)",
          background: "rgba(0,0,0,0.35)",
          borderRadius: 999,
          border: "1px solid var(--nex-accent-soft, rgba(198,161,91,0.35))",
        }}
      >
        <span style={{ color: "var(--nex-accent)", fontSize: 14 }}>
          {page + 1}
        </span>
        <span style={{ opacity: 0.6 }}>/</span>
        <span>{totalPages}</span>
      </span>
      <PageArrow
        direction="next"
        disabled={!canNext}
        onClick={() => canNext && onSelect(page + 1)}
      />
    </div>
  );
}

function PageArrow({
  direction,
  disabled,
  onClick,
}: {
  direction: "prev" | "next";
  disabled: boolean;
  onClick: () => void;
}) {
  // Founder direction 2026-09-30 · arrow chevrons render in solid black
  // so they stand off the accent-tinted pagination row · matches the
  // higher-contrast affordance the founder wants for the prev/next
  // controls (numbered pills stay accent-coloured for the active state).
  return (
    <button
      type="button"
      aria-label={direction === "prev" ? "Previous page" : "Next page"}
      onClick={onClick}
      disabled={disabled}
      style={{
        appearance: "none",
        width: 34,
        height: 34,
        borderRadius: "50%",
        border: "none",
        // Founder direction 2026-09-30 · black-filled arrow button
        // with the theme accent painting the chevron itself. Under
        // Pink Dream that's pink arrows on a black circle · under
        // any other theme the arrow adopts that theme's accent (ONE
        // NEX IDENTITY doctrine · single visual language flows
        // through every cover surface).
        background: "#000000",
        color: "var(--nex-accent, #FF3F9F)",
        fontFamily: "var(--nex-font-body, inherit)",
        fontSize: 18,
        fontWeight: 800,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.35 : 1,
        display: "grid",
        placeItems: "center",
        transition: "opacity 140ms ease",
        boxShadow:
          "0 2px 6px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,0,0,0.6)",
      }}
    >
      {direction === "prev" ? "‹" : "›"}
    </button>
  );
}
