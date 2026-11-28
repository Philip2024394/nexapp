"use client";

// src/app/nex-native/cover/_shop-filter-panel.tsx
//
// Owner directive 2026-11-28 (ninth pass) · shop cover filter panel.
// -----------------------------------------------------------------
// Mounts inside the sealed .nex-native-frame containing block via
// `position: fixed; inset: 0` (translateZ(0) on the phone-frame
// ancestor establishes the containing block so fixed descendants
// are clipped to the phone frame on desktop, full-viewport on
// <500px). Long + center layout per directive · world-class UI
// vocabulary (quiet dividers, round pill buttons, generous
// spacing).
//
// Filters:
//   · Price (range) — functional, derived from products[].price_pence
//   · Color         — functional, derived from products[].colors[]
//   · Material / Thread Color / Buckle Type — reserved attributes.
//     Values flow in once sellers tag their products via the
//     delta-F upload-form additions. Empty-state line explains
//     that so no fake options are invented.
//
// Shape:
//   · Scoped inside the frame (no portal, no body append).
//   · Backdrop tap + Esc + Close button dismiss.
//   · Apply commits · Clear resets.

import * as React from "react";
import type { CoverProduct } from "./primitives";

const INK = "#0A1526";
const INK_DIM = "#5F6773";
const INK_SOFT = "#8A939E";
const DIVIDER = "rgba(10,21,38,0.08)";
const ORANGE = "#FF7A00";
const ORANGE_DARK = "#E86A00";

/** The filter state the panel reads + writes. Public shape so the
 *  cover layout and CoverCatalog can share it. */
export interface ShopFilterState {
  readonly priceMin: number | null;
  readonly priceMax: number | null;
  readonly colors: readonly string[];
  readonly materials: readonly string[];
  readonly threadColors: readonly string[];
  readonly buckleTypes: readonly string[];
}

export const EMPTY_SHOP_FILTER_STATE: ShopFilterState = {
  priceMin: null,
  priceMax: null,
  colors: [],
  materials: [],
  threadColors: [],
  buckleTypes: [],
};

export function isShopFilterActive(f: ShopFilterState): boolean {
  return (
    f.priceMin !== null ||
    f.priceMax !== null ||
    f.colors.length > 0 ||
    f.materials.length > 0 ||
    f.threadColors.length > 0 ||
    f.buckleTypes.length > 0
  );
}

interface Props {
  readonly products: readonly CoverProduct[];
  readonly state: ShopFilterState;
  readonly onApply: (next: ShopFilterState) => void;
  readonly onDismiss: () => void;
}

export function ShopFilterPanel({
  products,
  state,
  onApply,
  onDismiss,
}: Props): React.JSX.Element {
  // Local draft state · "Apply" commits · "Clear" resets to empty.
  const [draft, setDraft] = React.useState<ShopFilterState>(state);

  // Reset local draft any time the panel re-mounts with a new upstream
  // state (e.g. the owner pressed Clear outside the panel).
  React.useEffect(() => setDraft(state), [state]);

  // Esc dismiss.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  // Price bounds from the actual product set — only shown when there
  // is real spread. Guards against a single-price shop painting a
  // meaningless range.
  const priceStats = React.useMemo(() => {
    const prices = products
      .map((p) => p.price_pence)
      .filter((n): n is number => typeof n === "number" && n > 0);
    if (prices.length === 0) {
      return null;
    }
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    if (min === max) {
      return null;
    }
    return { min, max, currency: products[0]?.currency ?? "GBP" };
  }, [products]);

  // Color swatches — accumulated unique set across the product array.
  const colorOptions = React.useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const p of products) {
      for (const c of p.colors ?? []) {
        if (typeof c !== "string") continue;
        const trimmed = c.trim();
        if (!trimmed || seen.has(trimmed.toLowerCase())) continue;
        seen.add(trimmed.toLowerCase());
        out.push(trimmed);
      }
    }
    return out;
  }, [products]);

  function toggleColor(c: string): void {
    setDraft((prev) => {
      const set = new Set(prev.colors);
      if (set.has(c)) set.delete(c);
      else set.add(c);
      return { ...prev, colors: Array.from(set) };
    });
  }

  function formatPrice(pence: number, currency: string): string {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currency || "GBP",
        maximumFractionDigits: 0,
      }).format(pence / 100);
    } catch {
      return `${(pence / 100).toFixed(0)}`;
    }
  }

  const activeCount =
    (draft.priceMin !== null ? 1 : 0) +
    (draft.priceMax !== null ? 1 : 0) +
    draft.colors.length +
    draft.materials.length +
    draft.threadColors.length +
    draft.buckleTypes.length;

  return (
    <div
      data-nex-shop-filter-panel
      role="dialog"
      aria-modal="true"
      aria-label="Filter products"
      onClick={onDismiss}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(10, 21, 38, 0.52)",
        zIndex: 70,
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        justifyContent: "center",
        padding: "24px 14px",
        boxSizing: "border-box",
      }}
    >
      {/* Owner directive 2026-11-28 (eleventh pass) · running light
          around the filter card's edge + layout rebuild so text no
          longer bleeds past the rounded corners. The outer wrapper
          paints a 2px animated conic-gradient ring; the inner white
          card sits on top, inset by 2px, with its own padding so
          content stays inside the rounded corners. */}
      <style>{`
        @keyframes nex-shop-filter-running-light {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div
        data-nex-shop-filter-card
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          borderRadius: 20,
          maxHeight: "100%",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          padding: 2,
          boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
          fontFamily: "Inter, system-ui, sans-serif",
          color: INK,
          overflow: "hidden",
          background: "#0A1526",
          boxSizing: "border-box",
        }}
      >
        <div
          aria-hidden
          data-nex-shop-filter-running-light
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: "200%",
            aspectRatio: "1 / 1",
            transform: "translate(-50%, -50%)",
            background:
              "conic-gradient(from 0deg, rgba(255,122,0,0) 0deg, rgba(255,122,0,0.95) 40deg, rgba(255,160,70,0.9) 60deg, rgba(255,122,0,0) 120deg, rgba(255,122,0,0) 220deg, rgba(255,122,0,0.85) 260deg, rgba(255,122,0,0) 320deg)",
            animation: "nex-shop-filter-running-light 3.6s linear infinite",
            pointerEvents: "none",
          }}
        />
        <div
          data-nex-shop-filter-card-inner
          style={{
            position: "relative",
            background: "#FFFFFF",
            borderRadius: 18,
            display: "flex",
            flexDirection: "column",
            flex: 1,
            minHeight: 0,
            overflow: "hidden",
            boxSizing: "border-box",
          }}
        >
        {/* Header · owner directive 2026-11-28 (eleventh pass) · title
            column gets minWidth:0 so it wraps instead of elbowing the
            close button; close button is flexShrink:0 to stay pinned
            at the right edge of the card. */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "16px 18px 12px",
            borderBottom: `1px solid ${DIVIDER}`,
            flexShrink: 0,
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              minWidth: 0,
              flex: 1,
            }}
          >
            <strong
              style={{
                fontSize: 16,
                fontWeight: 900,
                letterSpacing: "-0.01em",
              }}
            >
              Filters
            </strong>
            <span
              style={{
                fontSize: 12,
                color: INK_DIM,
                fontWeight: 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {activeCount === 0
                ? "No filters applied"
                : `${activeCount} filter${activeCount === 1 ? "" : "s"} active`}
            </span>
          </div>
          <button
            type="button"
            data-nex-shop-filter-close
            aria-label="Close filter panel"
            onClick={onDismiss}
            style={{
              width: 32,
              height: 32,
              flexShrink: 0,
              borderRadius: 999,
              background: "rgba(10,21,38,0.06)",
              color: INK,
              border: "none",
              fontSize: 18,
              fontWeight: 900,
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              lineHeight: 1,
            }}
          >
            <span aria-hidden>×</span>
          </button>
        </header>

        {/* Scrollable body · minHeight:0 lets the flex child shrink
            below its content height so overflowY:auto actually paints
            a scrollbar instead of letting content bleed under the
            footer. */}
        <div
          data-nex-shop-filter-sections
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            overflowX: "hidden",
            padding: "4px 18px 8px",
            boxSizing: "border-box",
          }}
        >
          {/* Price section */}
          <section
            data-nex-shop-filter-section="price"
            style={{ padding: "14px 0", borderBottom: `1px solid ${DIVIDER}` }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: "0.02em",
                textTransform: "uppercase",
                color: INK_DIM,
                marginBottom: 8,
              }}
            >
              Price
            </h3>
            {priceStats ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <label
                    style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 700, color: INK_SOFT }}>
                      Min
                    </span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      placeholder={formatPrice(priceStats.min, priceStats.currency)}
                      value={
                        draft.priceMin === null
                          ? ""
                          : String(Math.round(draft.priceMin / 100))
                      }
                      onChange={(e) => {
                        const raw = e.target.value.trim();
                        setDraft((prev) => ({
                          ...prev,
                          priceMin: raw === "" ? null : Math.max(0, Number(raw)) * 100,
                        }));
                      }}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: `1px solid ${DIVIDER}`,
                        fontSize: 14,
                        fontWeight: 700,
                        color: INK,
                        boxSizing: "border-box",
                      }}
                    />
                  </label>
                  <label
                    style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 700, color: INK_SOFT }}>
                      Max
                    </span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      placeholder={formatPrice(priceStats.max, priceStats.currency)}
                      value={
                        draft.priceMax === null
                          ? ""
                          : String(Math.round(draft.priceMax / 100))
                      }
                      onChange={(e) => {
                        const raw = e.target.value.trim();
                        setDraft((prev) => ({
                          ...prev,
                          priceMax: raw === "" ? null : Math.max(0, Number(raw)) * 100,
                        }));
                      }}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: `1px solid ${DIVIDER}`,
                        fontSize: 14,
                        fontWeight: 700,
                        color: INK,
                        boxSizing: "border-box",
                      }}
                    />
                  </label>
                </div>
                <span style={{ fontSize: 11, color: INK_SOFT, fontWeight: 600 }}>
                  Shop range · {formatPrice(priceStats.min, priceStats.currency)}
                  {" — "}
                  {formatPrice(priceStats.max, priceStats.currency)}
                </span>
              </div>
            ) : (
              <EmptySection message="Price range needs at least two differently-priced products." />
            )}
          </section>

          {/* Color section */}
          <section
            data-nex-shop-filter-section="color"
            style={{ padding: "14px 0", borderBottom: `1px solid ${DIVIDER}` }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: "0.02em",
                textTransform: "uppercase",
                color: INK_DIM,
                marginBottom: 8,
              }}
            >
              Color
            </h3>
            {colorOptions.length > 0 ? (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                {colorOptions.map((c) => {
                  const active = draft.colors.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      data-nex-shop-filter-color-swatch
                      aria-label={`Color · ${c}`}
                      aria-pressed={active}
                      onClick={() => toggleColor(c)}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 999,
                        background: c,
                        cursor: "pointer",
                        border: active
                          ? `3px solid ${ORANGE}`
                          : `1px solid ${DIVIDER}`,
                        padding: 0,
                        boxShadow: active ? "0 0 0 2px #fff inset" : "none",
                      }}
                    />
                  );
                })}
              </div>
            ) : (
              <EmptySection message="No colors tagged yet — appears here once sellers add color variants." />
            )}
          </section>

          {/* Material section (delta-F reserved) */}
          <AttributeSection
            label="Material"
            dataKey="material"
            emptyMessage="Appears here once sellers tag products with a material (leather, canvas, nylon, …)."
          />

          {/* Thread color section (delta-F reserved) */}
          <AttributeSection
            label="Thread color"
            dataKey="thread-color"
            emptyMessage="Appears here once sellers tag products with a thread color."
          />

          {/* Buckle type section (delta-F reserved) */}
          <AttributeSection
            label="Buckle type"
            dataKey="buckle-type"
            emptyMessage="Appears here once sellers tag products with a buckle type."
            last
          />
        </div>

        {/* Footer actions */}
        <footer
          style={{
            display: "flex",
            gap: 10,
            padding: "12px 18px 16px",
            borderTop: `1px solid ${DIVIDER}`,
            background: "#FFFFFF",
            flexShrink: 0,
            boxSizing: "border-box",
          }}
        >
          <button
            type="button"
            data-nex-shop-filter-clear
            onClick={() => {
              setDraft(EMPTY_SHOP_FILTER_STATE);
              onApply(EMPTY_SHOP_FILTER_STATE);
            }}
            style={{
              flex: "0 0 40%",
              padding: "12px 14px",
              borderRadius: 999,
              background: "#FFFFFF",
              color: INK,
              border: `1.5px solid ${DIVIDER}`,
              fontSize: 14,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Clear all
          </button>
          <button
            type="button"
            data-nex-shop-filter-apply
            onClick={() => {
              onApply(draft);
              onDismiss();
            }}
            style={{
              flex: "1 1 60%",
              padding: "12px 14px",
              borderRadius: 999,
              background: ORANGE,
              color: "#fff",
              border: `1.5px solid ${ORANGE_DARK}`,
              fontSize: 14,
              fontWeight: 900,
              cursor: "pointer",
              letterSpacing: "0.01em",
            }}
          >
            Apply filters
          </button>
        </footer>
        </div>
      </div>
    </div>
  );
}

function EmptySection({ message }: { message: string }): React.JSX.Element {
  return (
    <p
      style={{
        margin: 0,
        fontSize: 12,
        fontWeight: 600,
        color: INK_SOFT,
        lineHeight: 1.45,
      }}
    >
      {message}
    </p>
  );
}

function AttributeSection({
  label,
  dataKey,
  emptyMessage,
  last = false,
}: {
  label: string;
  dataKey: string;
  emptyMessage: string;
  last?: boolean;
}): React.JSX.Element {
  // Owner directive 2026-11-28 (ninth pass) · the three attribute
  // sections render the "world-class UI shell" straight away, with a
  // transparent empty-state line explaining that the options flow in
  // once the merchant upload form (delta F) exposes the matching
  // product-attribute fields. No fake options are ever invented.
  return (
    <section
      data-nex-shop-filter-section={dataKey}
      style={{
        padding: "14px 0",
        borderBottom: last ? "none" : `1px solid ${DIVIDER}`,
      }}
    >
      <h3
        style={{
          margin: 0,
          fontSize: 13,
          fontWeight: 800,
          letterSpacing: "0.02em",
          textTransform: "uppercase",
          color: INK_DIM,
          marginBottom: 8,
        }}
      >
        {label}
      </h3>
      <EmptySection message={emptyMessage} />
    </section>
  );
}
