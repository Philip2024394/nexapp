"use client";

// src/app/nex-native/chat-themes-library/marketplace-prototype/_menu-drawer.tsx
//
// Owner directive 2026-10-22 · menu drawer · when a buyer in the chat
// theme preview taps the right-dock Shop/Menu button, this drawer
// rises from the bottom with the business name, category toggles,
// and a grid of menu-item cards. Tapping a card opens the sealed
// MenuItemSheet (same qty picker · themed Add to Cart · wallpaper
// backdrop) so the end-to-end buyer flow matches what the Shop
// preview already demonstrates.
//
// Scope · PROTOTYPE ONLY. Reads sealed `CRISPY_CHICKEN_MOCK`
// directly (no DB · no network · no persistence). Other brands fall
// back to a "menu coming soon for this brand" state so the dock
// still works but doesn't lie about what's there.

import * as React from "react";
import { CRISPY_CHICKEN_MOCK } from "@/app/nex-native/cover/mock-data";
import { MenuItemSheet } from "./_menu-item-sheet";
import { formatDispatchLabel, type DispatchKind } from "./_types";

const NEX = {
  bg: "#020914",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMute: "#7D9BC0",
  cyan: "#00AFFF",
};

function hexWithAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function formatIdr(cents: number): string {
  const rupiah = Math.round(cents / 100);
  return `Rp ${rupiah.toLocaleString("id-ID")}`;
}

export interface MenuDrawerProps {
  readonly brand: string;
  readonly accent: string;
  readonly wallpaperUrl?: string | null;
  /** Owner directive 2026-10-22 · fired when the buyer taps Add to
   *  Cart inside the MenuItemSheet · parent (ThemePreviewSheet)
   *  increments the right-dock Cart badge and shows a toast. */
  readonly onItemAdd?: (productId: string, qty: number) => void;
  /** Owner directive 2026-10-22 · Ask-Seller slice 1 · fired when
   *  the buyer taps "Ask Seller" inside the MenuItemSheet. Parent
   *  surfaces a toast in prototype · will route to the owner's chat
   *  via shareProductToContactAction in production. Optional · when
   *  omitted, the Ask Seller button hides and only Add to Cart shows. */
  readonly onItemAskSeller?: (productId: string) => void;
  readonly onClose: () => void;
}

export function MenuDrawer({
  brand,
  accent,
  wallpaperUrl,
  onItemAdd,
  onItemAskSeller,
  onClose,
}: MenuDrawerProps): React.JSX.Element {
  // Brand mock lookup · only Crispy Chicken is wired today. When
  // other brands come online with their own CRISPY-shaped mocks,
  // this becomes a `BRAND_MOCKS[brand]` lookup.
  const brandMock =
    brand === "crispy-chicken" ? CRISPY_CHICKEN_MOCK : null;

  const [activeSectionId, setActiveSectionId] = React.useState<string | null>(
    brandMock?.sections[0]?.id ?? null,
  );
  const [tappedProductId, setTappedProductId] = React.useState<string | null>(
    null,
  );

  // Esc dismiss.
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (tappedProductId) {
          setTappedProductId(null);
          return;
        }
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, tappedProductId]);

  const visibleItems = React.useMemo(() => {
    if (!brandMock) return [];
    return brandMock.products.filter(
      (p) => p.section_id === activeSectionId,
    );
  }, [brandMock, activeSectionId]);

  // Owner directive 2026-10-22 · dispatch overlay · read the My Shop
  // editor's localStorage so cards show "Ready in 15 min" labels when
  // the owner has set them. Prototype parity · the drawer never writes
  // · fail-soft to an empty map when storage is missing or unparseable.
  const dispatchByProductId = useDispatchOverlay(brand);

  // Owner directive 2026-10-22 · pagination · 6 cards per page ·
  // prev / next controls + page counter live in the drawer footer.
  const ITEMS_PER_PAGE = 6;
  const [page, setPage] = React.useState(0);
  const totalPages = Math.max(
    1,
    Math.ceil(visibleItems.length / ITEMS_PER_PAGE),
  );
  // Reset to page 0 whenever the active section changes so the user
  // never lands on a page that no longer exists.
  React.useEffect(() => {
    setPage(0);
  }, [activeSectionId]);
  // Clamp if the item list shrinks (e.g. seller removes items).
  React.useEffect(() => {
    if (page > totalPages - 1) setPage(totalPages - 1);
  }, [page, totalPages]);
  const pagedItems = visibleItems.slice(
    page * ITEMS_PER_PAGE,
    (page + 1) * ITEMS_PER_PAGE,
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={
        brandMock
          ? `${brandMock.businessName} · menu`
          : "Menu drawer"
      }
      data-nex-marketplace-prototype-menu-drawer
      data-nex-marketplace-prototype-menu-drawer-brand={brand}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 650,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
    >
      {/* Backdrop · tap to dismiss */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close menu"
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(2, 9, 20, 0.68)",
          backdropFilter: "blur(6px) saturate(140%)",
          WebkitBackdropFilter: "blur(6px) saturate(140%)",
          border: "none",
          cursor: "pointer",
          padding: 0,
          margin: 0,
        }}
      />

      {/* Panel */}
      <section
        data-nex-marketplace-prototype-menu-drawer-panel
        style={{
          position: "relative",
          height: "88%",
          minHeight: 420,
          background: wallpaperUrl
            ? `
              linear-gradient(180deg, rgba(5, 13, 24, 0.78) 0%, rgba(5, 13, 24, 0.88) 50%, rgba(5, 13, 24, 0.96) 100%),
              url("${wallpaperUrl}") center / cover no-repeat,
              #07131F
            `
            : "#07131F",
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          border: `1px solid ${hexWithAlpha(accent, 0.5)}`,
          borderBottom: "none",
          boxShadow: `0 -16px 48px -12px rgba(0, 0, 0, 0.8), 0 0 24px -8px ${hexWithAlpha(accent, 0.55)}`,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Drag handle · owner directive 2026-10-22 · tappable to
            close the drawer · accent-tinted bar also doubles as the
            primary dismiss affordance (× close button retired). */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          data-nex-marketplace-prototype-menu-drawer-handle
          style={{
            display: "flex",
            justifyContent: "center",
            paddingTop: 10,
            paddingBottom: 6,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontFamily: "inherit",
            width: "100%",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <span
            aria-hidden
            style={{
              width: 56,
              height: 5,
              borderRadius: 3,
              background: accent,
              boxShadow: `0 2px 8px -2px ${hexWithAlpha(accent, 0.7)}`,
              transition: "transform 180ms ease, opacity 180ms ease",
            }}
          />
        </button>

        {/* Sticky header · business name only · × close retired per
            owner directive 2026-10-22 · dismiss affordances are the
            red handle above AND backdrop tap. · Delivers indicator
            + delivery/pickup estimate chips under the name per the
            same directive · demo copy for Crispy Chicken only. */}
        <style>{`
          @keyframes nex-mp-menu-drawer-heartbeat {
            0%   { transform: scale(1);    opacity: 0.9; }
            12%  { transform: scale(1.22); opacity: 1;   }
            24%  { transform: scale(1);    opacity: 0.9; }
            36%  { transform: scale(1.14); opacity: 1;   }
            60%  { transform: scale(1);    opacity: 0.9; }
            100% { transform: scale(1);    opacity: 0.9; }
          }
        `}</style>
        <header
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            padding: "0 14px 4px",
            background: "transparent",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: accent,
              fontWeight: 800,
              lineHeight: 1,
            }}
          >
            Menu
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              minWidth: 0,
            }}
          >
            {/* Left column · business name (with ACTIVE badge inline
                when the brand delivers) + closing-time text */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: 18,
                  fontWeight: 900,
                  color: NEX.text,
                  letterSpacing: "-0.015em",
                  lineHeight: 1.1,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  textShadow: "0 1px 4px rgba(0, 0, 0, 0.6)",
                }}
              >
                {brandMock?.businessName ?? "Coming soon"}
              </h2>
              {brandMock && (
                <div
                  data-nex-marketplace-prototype-menu-drawer-closing
                  style={{
                    marginTop: 3,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 0.3,
                    color: "rgba(255, 255, 255, 0.78)",
                    textShadow: "0 1px 3px rgba(0, 0, 0, 0.55)",
                  }}
                >
                  <svg
                    width={11}
                    height={11}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <circle cx={12} cy={12} r={9} />
                    <polyline points="12 7 12 12 15 14" />
                  </svg>
                  Closing 2:40 min
                </div>
              )}
            </div>
            {/* Right column · scooter button heart-beats · "Active"
                label stacks underneath (visible only when the brand
                delivers). Owner directive 2026-10-22 · dark green
                treatment for the scooter chip + Active label so
                "service live" reads universally regardless of brand
                accent (green is the universal "go / live" colour,
                independent of each theme's red/pink/gold accent). */}
            {/* Owner directive 2026-10-22 · ACTIVE text labels both
                removed · the heart-beating scooter image carries the
                "delivers now" signal on its own. Scooter PNG renders
                bare, no chip, no text underneath. Shifted up with
                `marginTop: -10` so it aligns with the eyebrow row
                rather than the business-name baseline. */}
            {brandMock &&
              (brandMock.shippingScope === "local_delivery" ||
                brandMock.shippingScope === "local_and_export") && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src="/nex-native/red-food-delivery-scooter.png"
                  alt="Delivers now"
                  title="Delivers now"
                  aria-label="Delivers now"
                  data-nex-marketplace-prototype-menu-drawer-delivers
                  style={{
                    width: 52,
                    height: 52,
                    marginTop: -10,
                    objectFit: "contain",
                    display: "block",
                    flexShrink: 0,
                    animation:
                      "nex-mp-menu-drawer-heartbeat 1200ms ease-in-out infinite",
                    filter:
                      "drop-shadow(0 4px 8px rgba(0, 0, 0, 0.5))",
                  }}
                />
              )}
          </div>
        </header>

        {!brandMock ? (
          /* Honest "menu coming soon" state for brands without a
             sealed mock yet. */
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
              color: NEX.textDim,
              fontSize: 13,
              lineHeight: 1.5,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 10 }}>🍴</div>
            <div
              style={{
                fontSize: 15,
                color: NEX.text,
                fontWeight: 700,
                marginBottom: 6,
              }}
            >
              Menu coming soon
            </div>
            <div style={{ maxWidth: 260 }}>
              The seller hasn&apos;t published their menu for this
              brand yet. Once they do, you&apos;ll see it here.
            </div>
          </div>
        ) : (
          <>
            {/* Category toggles · horizontal scrollable row ·
                tightened top/bottom padding so the badges sit higher
                under the header. */}
            <nav
              data-nex-marketplace-prototype-menu-drawer-sections
              style={{
                display: "flex",
                gap: 8,
                padding: "4px 14px 8px",
                overflowX: "auto",
                borderBottom: `1px solid rgba(255, 255, 255, 0.06)`,
                flexShrink: 0,
              }}
            >
              {brandMock.sections.map((section) => {
                const active = section.id === activeSectionId;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setActiveSectionId(section.id)}
                    aria-pressed={active}
                    data-nex-marketplace-prototype-menu-drawer-section={section.id}
                    data-nex-marketplace-prototype-menu-drawer-section-active={active ? "true" : "false"}
                    style={{
                      flexShrink: 0,
                      padding: "7px 14px",
                      borderRadius: 999,
                      background: active
                        ? accent
                        : "rgba(255, 255, 255, 0.05)",
                      color: active ? "#FFFFFF" : NEX.textDim,
                      border: active
                        ? "1px solid rgba(255, 255, 255, 0.14)"
                        : "1px solid rgba(255, 255, 255, 0.08)",
                      fontSize: 12,
                      fontWeight: 800,
                      letterSpacing: 0.2,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      WebkitTapHighlightColor: "transparent",
                      textShadow: active
                        ? "0 1px 3px rgba(0, 0, 0, 0.55)"
                        : "none",
                      boxShadow: active
                        ? `0 4px 12px -4px ${hexWithAlpha(accent, 0.7)}`
                        : "none",
                      transition: "background 150ms ease, color 150ms ease",
                    }}
                  >
                    {section.name}
                  </button>
                );
              })}
            </nav>

            {/* Items grid · 2 columns · scrollable */}
            <div
              data-nex-marketplace-prototype-menu-drawer-grid
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
                padding: "12px 14px 20px",
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 10,
                alignContent: "start",
              }}
            >
              {pagedItems.map((product) => (
                <MenuCard
                  key={product.id}
                  product={product}
                  accent={accent}
                  dispatchLabel={
                    formatDispatchLabel(
                      dispatchByProductId.get(product.id)?.kind ?? null,
                      dispatchByProductId.get(product.id)?.value ?? null,
                    )
                  }
                  onClick={() => setTappedProductId(product.id)}
                />
              ))}
            </div>
          </>
        )}

        {/* Owner directive 2026-10-22 · footer container · prev /
            next pagination controls with page counter. 6 cards per
            page · dismiss affordances live on the red bar at the
            top + backdrop tap (Close button retired). Only renders
            when a brand mock is present AND there's more than one
            page's worth of items. */}
        {brandMock && totalPages > 1 && (
          <footer
            data-nex-marketplace-prototype-menu-drawer-footer
            style={{
              padding: "10px 14px calc(env(safe-area-inset-bottom, 0px) + 12px)",
              borderTop: `1px solid rgba(255, 255, 255, 0.08)`,
              background: "rgba(2, 9, 20, 0.5)",
              backdropFilter: "blur(8px) saturate(140%)",
              WebkitBackdropFilter: "blur(8px) saturate(140%)",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            }}
          >
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              aria-label="Previous page"
              data-nex-marketplace-prototype-menu-drawer-prev
              style={{
                width: 38,
                height: 38,
                padding: 0,
                borderRadius: "50%",
                background: accent,
                color: "#FFFFFF",
                border: "1px solid rgba(255, 255, 255, 0.22)",
                fontSize: 20,
                fontWeight: 900,
                lineHeight: 1,
                cursor: page === 0 ? "default" : "pointer",
                fontFamily: "inherit",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                WebkitTapHighlightColor: "transparent",
                opacity: page === 0 ? 0.45 : 1,
                boxShadow:
                  page === 0
                    ? "none"
                    : `0 4px 12px -4px ${hexWithAlpha(accent, 0.75)}, 0 0 10px -2px ${hexWithAlpha(accent, 0.5)}`,
              }}
            >
              ‹
            </button>
            <div
              data-nex-marketplace-prototype-menu-drawer-counter
              style={{
                display: "inline-flex",
                alignItems: "baseline",
                gap: 4,
                padding: "0 12px",
                minWidth: 56,
                justifyContent: "center",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 900,
                  color: accent,
                  letterSpacing: "-0.005em",
                  lineHeight: 1,
                }}
              >
                {String(page + 1).padStart(2, "0")}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "rgba(255, 255, 255, 0.42)",
                  lineHeight: 1,
                }}
              >
                /
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "rgba(255, 255, 255, 0.72)",
                  lineHeight: 1,
                }}
              >
                {String(totalPages).padStart(2, "0")}
              </span>
            </div>
            <button
              type="button"
              onClick={() =>
                setPage((p) => Math.min(totalPages - 1, p + 1))
              }
              disabled={page === totalPages - 1}
              aria-label="Next page"
              data-nex-marketplace-prototype-menu-drawer-next
              style={{
                width: 38,
                height: 38,
                padding: 0,
                borderRadius: "50%",
                background: accent,
                color: "#FFFFFF",
                border: "1px solid rgba(255, 255, 255, 0.22)",
                fontSize: 20,
                fontWeight: 900,
                lineHeight: 1,
                cursor:
                  page === totalPages - 1 ? "default" : "pointer",
                fontFamily: "inherit",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                WebkitTapHighlightColor: "transparent",
                opacity: page === totalPages - 1 ? 0.45 : 1,
                boxShadow:
                  page === totalPages - 1
                    ? "none"
                    : `0 4px 12px -4px ${hexWithAlpha(accent, 0.75)}, 0 0 10px -2px ${hexWithAlpha(accent, 0.5)}`,
              }}
            >
              ›
            </button>
          </footer>
        )}
      </section>

      {/* Menu-item bottom sheet mounts on top of the drawer when a
          card is tapped. Owns its own backdrop + close + Add to Cart. */}
      {tappedProductId && (
        <MenuItemSheet
          brand={brand}
          productId={tappedProductId}
          accent={accent}
          wallpaperUrl={wallpaperUrl}
          onClose={() => setTappedProductId(null)}
          onAdd={(productId, qty) => {
            onItemAdd?.(productId, qty);
            setTappedProductId(null);
          }}
          onAskSeller={
            onItemAskSeller
              ? (productId) => {
                  onItemAskSeller(productId);
                  setTappedProductId(null);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

// ─── Single menu-item card ───────────────────────────────────────

// Owner directive 2026-10-22 · dispatch overlay hook · reads the My
// Shop editor's localStorage once on mount + whenever focus returns
// to the drawer. Returns a Map<productId, {kind, value}> that the
// drawer uses to paint "Ready in 15 min" chips on each card.
function useDispatchOverlay(
  brand: string,
): Map<string, { kind: DispatchKind | null; value: number | null }> {
  const [overlay, setOverlay] = React.useState<
    Map<string, { kind: DispatchKind | null; value: number | null }>
  >(() => new Map());
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const read = () => {
      try {
        const raw = window.localStorage.getItem(`nex-mp-editor-${brand}`);
        if (!raw) {
          setOverlay(new Map());
          return;
        }
        const parsed = JSON.parse(raw) as {
          products?: Array<{
            id?: string;
            dispatchKind?: string | null;
            dispatchValue?: number | null;
          }>;
        };
        const next = new Map<
          string,
          { kind: DispatchKind | null; value: number | null }
        >();
        for (const p of parsed.products ?? []) {
          if (typeof p?.id !== "string") continue;
          const kind =
            p.dispatchKind === "minutes" || p.dispatchKind === "days"
              ? (p.dispatchKind as DispatchKind)
              : null;
          const value =
            typeof p.dispatchValue === "number" && p.dispatchValue > 0
              ? p.dispatchValue
              : null;
          next.set(p.id, { kind, value });
        }
        setOverlay(next);
      } catch {
        setOverlay(new Map());
      }
    };
    read();
    // Re-read when the user navigates back from the editor.
    const onFocus = () => read();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [brand]);
  return overlay;
}

function MenuCard({
  product,
  accent,
  dispatchLabel,
  onClick,
}: {
  readonly product: typeof CRISPY_CHICKEN_MOCK.products[number];
  readonly accent: string;
  readonly dispatchLabel: string | null;
  readonly onClick: () => void;
}): React.JSX.Element {
  const soldOut = product.stock_status === "sold_out";
  const lowStock = product.stock_status === "low_stock";
  const isSpicy = /spicy|hot|sriracha|nashville/i.test(
    `${product.name} ${product.description ?? ""}`,
  );
  const initials = product.name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("");

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={soldOut}
      aria-label={`${product.name} · ${(product.price_pence / 100).toFixed(0)}`}
      data-nex-marketplace-prototype-menu-drawer-card={product.id}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: 8,
        borderRadius: 14,
        background: "rgba(2, 9, 20, 0.5)",
        border: `1px solid ${hexWithAlpha(accent, 0.3)}`,
        cursor: soldOut ? "default" : "pointer",
        opacity: soldOut ? 0.55 : 1,
        fontFamily: "inherit",
        textAlign: "left",
        WebkitTapHighlightColor: "transparent",
        boxShadow: `0 6px 14px -6px rgba(0, 0, 0, 0.5)`,
        transition: "transform 150ms ease, box-shadow 150ms ease",
      }}
    >
      {/* Placeholder hero · initials tile · the real editor uploads
          per-item photos; this is the fallback. */}
      <div
        aria-hidden
        style={{
          width: "100%",
          aspectRatio: "1 / 1",
          borderRadius: 10,
          background: `linear-gradient(135deg, ${hexWithAlpha(accent, 0.45)}, ${hexWithAlpha(accent, 0.12)}), rgba(2, 9, 20, 0.6)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: hexWithAlpha(accent, 0.95),
          fontSize: 24,
          fontWeight: 900,
          letterSpacing: "-0.02em",
          lineHeight: 1,
          textShadow: "0 2px 8px rgba(0, 0, 0, 0.5)",
          fontFamily: "'Georgia', 'Times New Roman', serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {initials}
        {isSpicy && (
          <span
            aria-hidden
            style={{
              position: "absolute",
              top: 6,
              left: 6,
              padding: "2px 7px",
              borderRadius: 999,
              background: "#000000",
              border: "1px solid rgba(255, 255, 255, 0.14)",
              color: "#FFFFFF",
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: 0.3,
              textTransform: "uppercase",
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              fontFamily: "inherit",
            }}
          >
            🌶️ Spicy
          </span>
        )}
        {lowStock && (
          <span
            aria-hidden
            style={{
              position: "absolute",
              top: 6,
              right: 6,
              padding: "2px 6px",
              borderRadius: 999,
              background: "rgba(255, 180, 0, 0.26)",
              border: "1px solid rgba(255, 180, 0, 0.5)",
              color: "#FFC14D",
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: 0.3,
              textTransform: "uppercase",
              fontFamily: "inherit",
            }}
          >
            Low
          </span>
        )}
        {soldOut && (
          <span
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(2, 9, 20, 0.55)",
              color: "#FF8080",
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: 0.4,
              textTransform: "uppercase",
            }}
          >
            Sold out
          </span>
        )}
      </div>

      <div
        style={{
          fontSize: 12,
          fontWeight: 800,
          color: NEX.text,
          letterSpacing: "-0.005em",
          lineHeight: 1.25,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {product.name}
      </div>
      {/* Owner directive 2026-10-22 · dispatch chip · "Ready in 15 min"
          or "Dispatch 2 days" · hidden when the owner hasn't set a
          dispatch time for this item. Honest-null · no placeholder. */}
      {dispatchLabel && !soldOut && (
        <div
          data-nex-marketplace-prototype-menu-drawer-card-dispatch
          style={{
            display: "inline-flex",
            alignSelf: "flex-start",
            alignItems: "center",
            gap: 4,
            padding: "3px 7px",
            borderRadius: 8,
            background: hexWithAlpha(accent, 0.14),
            border: `1px solid ${hexWithAlpha(accent, 0.35)}`,
            color: accent,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 0.3,
            lineHeight: 1,
          }}
        >
          <span aria-hidden>⏱</span>
          <span>{dispatchLabel}</span>
        </div>
      )}
      {/* Owner directive 2026-10-22 · price row · price on the left,
          round themed magnifier chip on the right (visual-only · the
          parent card owns the tap). Signals "tap to view" without
          introducing a nested interactive. Chip hides on sold-out
          items since there's nothing to view.
          `marginTop: auto` pins the row to the bottom of every card
          so prices line up across the grid regardless of how many
          lines the item name wraps across. */}
      <div
        style={{
          marginTop: "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 900,
            color: accent,
            letterSpacing: "-0.005em",
            lineHeight: 1,
          }}
        >
          {formatIdr(product.price_pence)}
        </div>
        {!soldOut && (
          <span
            aria-hidden
            data-nex-marketplace-prototype-menu-drawer-card-view
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: accent,
              color: "#FFFFFF",
              border: "1px solid rgba(255, 255, 255, 0.22)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              boxShadow: `0 4px 10px -4px ${hexWithAlpha(accent, 0.75)}, 0 0 8px -2px ${hexWithAlpha(accent, 0.5)}`,
            }}
          >
            <svg
              width={14}
              height={14}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <circle cx={11} cy={11} r={7} />
              <line x1={21} y1={21} x2={16.65} y2={16.65} />
            </svg>
          </span>
        )}
      </div>
    </button>
  );
}
