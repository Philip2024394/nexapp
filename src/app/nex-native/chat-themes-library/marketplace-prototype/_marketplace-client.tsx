"use client";

// src/app/nex-native/chat-themes-library/marketplace-prototype/_marketplace-client.tsx
//
// NEX Themes Marketplace · PROTOTYPE client shell.
// Owner-authorised 2026-10-21.
// -----------------------------------------------------------------------------
// Owns:
//   · the cart state (client-only · persists to localStorage so a
//     reload doesn't wipe the demo cart)
//   · the three preview sheets (Theme / Intro / Shop) · mounted here
//     so the sheet state can be lifted out of individual cards
//   · the cart drawer trigger + drawer itself
//
// Does NOT:
//   · write to any DB
//   · commit prices
//   · touch the sealed theme engine, StandardIntroOverlay, or the
//     cover-themes-library edit surface
//   · claim a purchase succeeded
//
// The checkout button opens the honest "coming soon" state in
// `_cart-drawer.tsx`.

import * as React from "react";
import { MARKETPLACE_CATALOG, type MarketplaceCatalogEntry } from "./_catalog";
import { ThemeCard } from "./_theme-card";
import {
  ThemePreviewSheet,
  IntroPreviewSheet,
  ShopPreviewSheet,
} from "./_preview-sheets";
import { CartDrawer } from "./_cart-drawer";
import {
  MarketplaceHeaderClient,
  type MarketplaceFilter,
} from "./_header-client";
import {
  cartKey,
  type CartItem,
  type ProductType,
} from "./_types";

type PreviewTarget =
  | { kind: "theme"; entry: MarketplaceCatalogEntry }
  | { kind: "intro"; entry: MarketplaceCatalogEntry }
  | { kind: "shop"; entry: MarketplaceCatalogEntry }
  | null;

const CART_STORAGE_KEY = "nex-marketplace-prototype-cart";
const MAX_CART_ITEMS = 24;

export function MarketplacePrototypeClient(): React.JSX.Element {
  const [cart, setCart] = React.useState<ReadonlyArray<CartItem>>([]);
  const [cartOpen, setCartOpen] = React.useState(false);
  const [preview, setPreview] = React.useState<PreviewTarget>(null);
  // Owner directive 2026-10-21 · header filter + search state lives
  // here so the header + grid stay in sync. The filter is applied
  // visually only in the prototype · catalog is not actually filtered
  // because no "free vs premium" distinction exists on the sealed
  // theme packages today.
  const [filter, setFilter] = React.useState<MarketplaceFilter>("new");
  const [searchQuery, setSearchQuery] = React.useState("");

  // Hydrate cart from localStorage on mount (prototype persistence
  // only · nothing in Supabase).
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(CART_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      const valid = parsed.filter(
        (x): x is CartItem =>
          typeof x === "object" &&
          x !== null &&
          typeof (x as CartItem).themeId === "string" &&
          typeof (x as CartItem).themeDisplayName === "string" &&
          ((x as CartItem).productType === "theme" ||
            (x as CartItem).productType === "intro" ||
            (x as CartItem).productType === "shop"),
      );
      setCart(valid.slice(0, MAX_CART_ITEMS));
    } catch {
      // Silent · corrupt storage is treated as empty cart.
    }
  }, []);

  // Persist on every change.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // Silent · storage denied == session-only cart.
    }
  }, [cart]);

  const inCartKeys = React.useMemo(
    () => new Set(cart.map((item) => cartKey(item))),
    [cart],
  );

  const addToCart = React.useCallback(
    (entry: MarketplaceCatalogEntry, productType: ProductType, shopLayoutId: string | null = null) => {
      const key = cartKey({ themeId: entry.themeId, productType, shopLayoutId });
      if (inCartKeys.has(key)) return; // dedupe · no accidental double-adds
      setCart((prev) =>
        prev.length >= MAX_CART_ITEMS
          ? prev
          : [
              ...prev,
              {
                themeId: entry.themeId,
                themeDisplayName: entry.displayName,
                productType,
                shopLayoutId,
                addedAt: Date.now(),
              },
            ],
      );
    },
    [inCartKeys],
  );

  const removeFromCart = React.useCallback((key: string) => {
    setCart((prev) => prev.filter((item) => cartKey(item) !== key));
  }, []);

  const clearCart = React.useCallback(() => setCart([]), []);

  // Simple client-side search · case-insensitive substring on display
  // name + subtitle. Zero server work · the prototype's catalog is
  // small enough for this to be instantaneous.
  const q = searchQuery.trim().toLowerCase();
  const visibleCatalog = q.length === 0
    ? MARKETPLACE_CATALOG
    : MARKETPLACE_CATALOG.filter((entry) =>
        `${entry.displayName} ${entry.subtitle}`.toLowerCase().includes(q),
      );

  return (
    <>
      <MarketplaceHeaderClient
        activeFilter={filter}
        onFilterChange={setFilter}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        cartCount={cart.length}
        onCartClick={() => setCartOpen(true)}
      />

      {/* ─── Scrollable catalog ─── */}
      <div
        data-nex-marketplace-prototype-grid
        data-nex-marketplace-prototype-filter={filter}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "12px 12px 100px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {visibleCatalog.length === 0 && (
          <div
            style={{
              padding: "40px 20px",
              textAlign: "center",
              color: "#7D9BC0",
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            No themes match &ldquo;{searchQuery}&rdquo;.
            <br />
            Try a different search.
          </div>
        )}
        {visibleCatalog.map((entry) => (
          <ThemeCard
            key={entry.themeId}
            entry={entry}
            inCartKeys={inCartKeys}
            onPreviewTheme={() => setPreview({ kind: "theme", entry })}
            onPreviewIntro={() => setPreview({ kind: "intro", entry })}
            onPreviewShop={() => setPreview({ kind: "shop", entry })}
          />
        ))}

        <footer
          style={{
            marginTop: 20,
            padding: "16px 10px 40px",
            textAlign: "center",
            color: "#5A7A9B",
            fontSize: 10,
            lineHeight: 1.5,
            letterSpacing: 0.2,
          }}
        >
          Prototype · NEX Themes Marketplace · 2026-10-21
          <br />
          Prices gated until approved · payment provider not wired ·
          sealed theme engine untouched
        </footer>
      </div>

      {/* Owner directive 2026-10-21 · the floating orange cart FAB was
          retired · the cart trigger now lives in the header icon
          cluster (next to the ⋮ menu) to match owner directive. */}

      {/* ─── Preview sheets ─── */}
      {preview?.kind === "theme" && (
        <ThemePreviewSheet
          entry={preview.entry}
          alreadyInCart={inCartKeys.has(
            cartKey({ themeId: preview.entry.themeId, productType: "theme" }),
          )}
          cartCount={cart.length}
          onCartClick={() => {
            setPreview(null);
            setCartOpen(true);
          }}
          onAddToCart={() => {
            addToCart(preview.entry, "theme");
            setPreview(null);
          }}
          onClose={() => setPreview(null)}
        />
      )}
      {preview?.kind === "intro" && (
        <IntroPreviewSheet
          entry={preview.entry}
          alreadyInCart={inCartKeys.has(
            cartKey({ themeId: preview.entry.themeId, productType: "intro" }),
          )}
          cartCount={cart.length}
          onCartClick={() => {
            setPreview(null);
            setCartOpen(true);
          }}
          onAddToCart={() => {
            addToCart(preview.entry, "intro");
            setPreview(null);
          }}
          onClose={() => setPreview(null)}
        />
      )}
      {preview?.kind === "shop" && (
        <ShopPreviewSheet
          entry={preview.entry}
          inCartKeys={inCartKeys}
          cartCount={cart.length}
          onCartClick={() => {
            setPreview(null);
            setCartOpen(true);
          }}
          onAddToCart={(layoutId) => {
            addToCart(preview.entry, "shop", layoutId);
          }}
          onClose={() => setPreview(null)}
        />
      )}

      {/* ─── Cart drawer ─── */}
      {cartOpen && (
        <CartDrawer
          cart={cart}
          onRemove={removeFromCart}
          onClear={clearCart}
          onClose={() => setCartOpen(false)}
        />
      )}
    </>
  );
}
