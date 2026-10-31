"use client";

// src/app/nex-native/chat-themes-library/marketplace-prototype/search/_search-client.tsx
//
// Owner directive 2026-10-22 · reads the sealed brand mocks + the
// prototype editor's localStorage overrides and surfaces every menu
// item as a card in a searchable grid. Prototype demo of the
// end-state NEX search directory flow (menu-item-level cards).

import * as React from "react";
import Link from "next/link";
import { CRISPY_CHICKEN_MOCK } from "@/app/nex-native/cover/mock-data";
import { MARKETPLACE_CATALOG } from "../_catalog";
import { MenuItemSheet } from "../_menu-item-sheet";

const NEX = {
  bg: "var(--nex-world-background-base, #020914)",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMute: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.3)",
  red: "#DC2626",
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

// A unified search card shape · one row per menu item flattened
// out of every brand mock + localStorage editor override.
interface SearchCard {
  readonly cardId: string; // `${brandId}:${productId}`
  readonly brandId: string;
  readonly brandName: string;
  readonly brandAccent: string;
  readonly brandLocation: string | null;
  readonly brandWallpaper: string | null;
  readonly productId: string;
  readonly name: string;
  readonly price_pence: number;
  readonly description: string | null;
  readonly sectionName: string | null;
  readonly imageDataUrl: string | null;
  readonly stockStatus: "in_stock" | "low_stock" | "sold_out";
  readonly isSpicy: boolean;
}

// Owner directive 2026-10-22 · "every menu item with image appears
// as 1 card" · we include items with EITHER a sealed image_url OR
// an editor-uploaded image · fallback to themed-initials tile when
// neither exists so the surface stays functional in prototype mode.
function loadSearchCards(): SearchCard[] {
  const cards: SearchCard[] = [];

  // 1 · sealed Crispy Chicken mock baseline
  const crispyEntry = MARKETPLACE_CATALOG.find(
    (e) => e.themeId === "crispy-chicken",
  );
  if (crispyEntry) {
    for (const product of CRISPY_CHICKEN_MOCK.products) {
      const section = CRISPY_CHICKEN_MOCK.sections.find(
        (s) => s.id === product.section_id,
      );
      cards.push({
        cardId: `crispy-chicken:${product.id}`,
        brandId: "crispy-chicken",
        brandName: CRISPY_CHICKEN_MOCK.businessName,
        brandAccent:
          crispyEntry.ownerAccentHex ?? crispyEntry.accentHex,
        brandLocation: crispyEntry.location ?? null,
        brandWallpaper: crispyEntry.wallpaperUrl,
        productId: product.id,
        name: product.name,
        price_pence: product.price_pence,
        description: product.description ?? null,
        sectionName: section?.name ?? null,
        imageDataUrl: null,
        stockStatus:
          product.stock_status === "low_stock" ||
          product.stock_status === "sold_out"
            ? product.stock_status
            : "in_stock",
        isSpicy: /spicy|hot|sriracha|nashville/i.test(
          `${product.name} ${product.description ?? ""}`,
        ),
      });
    }
  }

  // 2 · localStorage editor overrides (per brand)
  if (typeof window === "undefined") return cards;
  for (const entry of MARKETPLACE_CATALOG) {
    try {
      const raw = window.localStorage.getItem(
        `nex-mp-editor-${entry.themeId}`,
      );
      if (!raw) continue;
      const parsed = JSON.parse(raw) as {
        businessName?: string;
        sections?: Array<{ id: string; name: string }>;
        products?: Array<{
          id: string;
          sectionId: string;
          name: string;
          price: string;
          description: string;
          stockStatus: "in_stock" | "low_stock" | "sold_out";
          images: string[];
        }>;
      };
      if (!parsed.products) continue;

      // For brands that already had sealed-mock cards (Crispy
      // Chicken), overlay the editor data onto those cards by
      // cardId. For other brands, create fresh cards.
      for (const p of parsed.products) {
        const existingIdx = cards.findIndex(
          (c) => c.cardId === `${entry.themeId}:${p.id}`,
        );
        const sectionName =
          parsed.sections?.find((s) => s.id === p.sectionId)?.name ??
          null;
        const next: SearchCard = {
          cardId: `${entry.themeId}:${p.id}`,
          brandId: entry.themeId,
          brandName: parsed.businessName ?? entry.displayName,
          brandAccent:
            entry.ownerAccentHex ?? entry.accentHex,
          brandLocation: entry.location ?? null,
          brandWallpaper: entry.wallpaperUrl,
          productId: p.id,
          name: p.name,
          price_pence: Math.round(Number(p.price || "0") * 100),
          description: p.description || null,
          sectionName,
          imageDataUrl: p.images && p.images.length > 0 ? p.images[0] : null,
          stockStatus: p.stockStatus,
          isSpicy: /spicy|hot|sriracha|nashville/i.test(
            `${p.name} ${p.description ?? ""}`,
          ),
        };
        if (existingIdx >= 0) cards[existingIdx] = next;
        else cards.push(next);
      }
    } catch {
      // malformed editor data · skip silently
    }
  }
  return cards;
}

export function SearchClient(): React.JSX.Element {
  const [query, setQuery] = React.useState("");
  const [cards, setCards] = React.useState<SearchCard[]>([]);
  const [tapped, setTapped] = React.useState<SearchCard | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [menuOpen, setMenuOpen] = React.useState(false);

  // Hydrate cards on mount + reload when localStorage changes.
  React.useEffect(() => {
    setCards(loadSearchCards());
    const handler = () => setCards(loadSearchCards());
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [refreshKey]);

  // Esc closes the side drawer.
  React.useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [menuOpen]);

  const q = query.trim().toLowerCase();
  const visible = q
    ? cards.filter((card) =>
        [
          card.name,
          card.description ?? "",
          card.sectionName ?? "",
          card.brandName,
          card.brandLocation ?? "",
        ]
          .join(" · ")
          .toLowerCase()
          .includes(q),
      )
    : cards;

  return (
    <>
      {/* ─── Header ─── */}
      <header
        data-nex-marketplace-prototype-search-header
        style={{
          padding:
            "calc(env(safe-area-inset-top, 0px) + 14px) 14px 10px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          flexShrink: 0,
          borderBottom: `1px solid ${NEX.cyanSoft}`,
          background:
            "linear-gradient(180deg, rgba(0, 175, 255, 0.1), transparent)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Link
            href="/nex-native/chat-themes-library"
            aria-label="Back"
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "transparent",
              color: NEX.text,
              border: `1px solid ${NEX.cyanSoft}`,
              fontSize: 20,
              lineHeight: 1,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            ←
          </Link>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 9,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: NEX.cyan,
                fontWeight: 800,
                lineHeight: 1,
              }}
            >
              NEX Search · menu-item cards
            </div>
            <h1
              style={{
                margin: "3px 0 0",
                fontSize: 20,
                fontWeight: 900,
                letterSpacing: "-0.015em",
                lineHeight: 1.05,
              }}
            >
              Find a dish, drink, or brand
            </h1>
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            data-nex-marketplace-prototype-search-menu-trigger
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "transparent",
              color: NEX.text,
              border: `1px solid ${NEX.cyanSoft}`,
              padding: 0,
              cursor: "pointer",
              fontFamily: "inherit",
              flexShrink: 0,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <svg
              width={22}
              height={22}
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden
            >
              <circle cx={12} cy={5.5} r={1.6} />
              <circle cx={12} cy={12} r={1.6} />
              <circle cx={12} cy={18.5} r={1.6} />
            </svg>
          </button>
        </div>

        {/* Search input */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "0 12px",
            background: "rgba(2, 9, 20, 0.7)",
            border: `1px solid ${NEX.cyanSoft}`,
            borderRadius: 999,
          }}
        >
          <svg
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke={NEX.textMute}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <circle cx={11} cy={11} r={7} />
            <line x1={21} y1={21} x2={16.65} y2={16.65} />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Burgers · Pink Dream · spicy · New York..."
            aria-label="Search menu items"
            data-nex-marketplace-prototype-search-input
            autoComplete="off"
            style={{
              flex: 1,
              minWidth: 0,
              padding: "10px 0",
              background: "transparent",
              color: NEX.text,
              fontSize: 13,
              border: "none",
              outline: "none",
              fontFamily: "inherit",
            }}
          />
          {query.length > 0 && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear"
              style={{
                width: 24,
                height: 24,
                padding: 0,
                background: "transparent",
                color: NEX.textMute,
                border: "none",
                fontSize: 16,
                cursor: "pointer",
                fontFamily: "inherit",
                flexShrink: 0,
              }}
            >
              ×
            </button>
          )}
        </div>

        {/* Honest banner */}
        <div
          style={{
            fontSize: 10,
            lineHeight: 1.5,
            color: NEX.textMute,
            padding: "4px 2px 0",
          }}
        >
          Prototype preview · reads this browser&apos;s localStorage
          editor data + sealed brand mocks · {cards.length} card
          {cards.length === 1 ? "" : "s"} indexed · nothing is
          published to the real NEX Directory.
        </div>
      </header>

      {/* ─── Grid ─── */}
      <div
        data-nex-marketplace-prototype-search-grid
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "12px 12px 40px",
        }}
      >
        {visible.length === 0 ? (
          <div
            style={{
              padding: 24,
              color: NEX.textDim,
              fontSize: 13,
              lineHeight: 1.5,
              textAlign: "center",
            }}
          >
            {q
              ? `No cards match "${query}".`
              : "No menu items in the index yet. Run the Crispy Chicken editor and upload a few photos."}
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 10,
            }}
          >
            {visible.map((card) => (
              <SearchCard
                key={card.cardId}
                card={card}
                onClick={() => setTapped(card)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Item sheet · reuses the Theme-preview menu-item bottom
          sheet so the search surface + chat drawer open the same
          detail viewer. */}
      {tapped && (
        <MenuItemSheet
          brand={tapped.brandId}
          productId={tapped.productId}
          accent={tapped.brandAccent}
          wallpaperUrl={tapped.brandWallpaper}
          onClose={() => setTapped(null)}
          onAdd={(_productId, _qty) => {
            setTapped(null);
          }}
        />
      )}

      {/* Owner directive 2026-10-22 · side drawer · opens from the
          3-dots button in the header · lists quick actions for the
          search surface. Dismiss via backdrop tap, Close button, or
          Esc. */}
      {menuOpen && (
        <>
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0, 0, 0, 0.55)",
              border: "none",
              padding: 0,
              margin: 0,
              cursor: "pointer",
              zIndex: 700,
            }}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Search menu"
            data-nex-marketplace-prototype-search-menu
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              width: "min(300px, 85%)",
              background: NEX.bg,
              borderLeft: `1px solid ${NEX.cyanSoft}`,
              zIndex: 701,
              display: "flex",
              flexDirection: "column",
              boxShadow: "-10px 0 32px rgba(0, 0, 0, 0.6)",
              overflow: "hidden",
            }}
          >
            <header
              style={{
                padding:
                  "calc(env(safe-area-inset-top, 0px) + 14px) 14px 10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: `1px solid ${NEX.cyanSoft}`,
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 800,
                  color: NEX.text,
                  letterSpacing: 0.3,
                }}
              >
                Menu
              </h2>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
                style={{
                  padding: "4px 10px",
                  background: NEX.cyan,
                  color: "#0a0608",
                  border: `1px solid ${NEX.cyan}`,
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: 0.4,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Close
              </button>
            </header>
            <nav
              style={{
                flex: 1,
                padding: "12px 8px",
                display: "flex",
                flexDirection: "column",
                gap: 2,
                overflowY: "auto",
              }}
            >
              <DrawerItem
                label="Refresh search index"
                hint="Re-read your localStorage editor data"
                onClick={() => {
                  setRefreshKey((k) => k + 1);
                  setMenuOpen(false);
                }}
              />
              <DrawerItem
                label="Clear search"
                hint="Reset the search field"
                onClick={() => {
                  setQuery("");
                  setMenuOpen(false);
                }}
                disabled={query.length === 0}
              />
              <DrawerItem
                label="Open Crispy Chicken · My Shop"
                hint="Add · edit · turn off · delete products"
                href="/nex-native/chat-themes-library/marketplace-prototype/my-shop/crispy-chicken"
              />
              <DrawerItem
                label="Back to marketplace"
                hint="Browse themes · intros · shops"
                href="/nex-native/chat-themes-library"
              />
              <DrawerItem
                label="Back to NEX welcome"
                hint="Return to the NEX welcome surface"
                href="/nex-native/welcome"
              />
            </nav>
            <footer
              style={{
                padding:
                  "10px 14px calc(env(safe-area-inset-bottom, 0px) + 10px)",
                borderTop: `1px solid rgba(255, 255, 255, 0.06)`,
                fontSize: 10,
                color: NEX.textMute,
                lineHeight: 1.5,
              }}
            >
              Prototype only · search reads this browser only ·
              nothing is published.
            </footer>
          </aside>
        </>
      )}
    </>
  );
}

// ─── Drawer menu item ───────────────────────────────────────────

function DrawerItem({
  label,
  hint,
  onClick,
  href,
  disabled,
}: {
  readonly label: string;
  readonly hint: string;
  readonly onClick?: () => void;
  readonly href?: string;
  readonly disabled?: boolean;
}): React.JSX.Element {
  const inner = (
    <>
      <span
        style={{
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: "-0.005em",
          color: disabled ? NEX.textMute : NEX.text,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 11,
          color: NEX.textMute,
          lineHeight: 1.35,
        }}
      >
        {hint}
      </span>
    </>
  );
  const sharedStyle: React.CSSProperties = {
    padding: "12px 12px",
    borderRadius: 10,
    background: "transparent",
    color: NEX.text,
    display: "flex",
    flexDirection: "column",
    gap: 2,
    textDecoration: "none",
    border: "none",
    fontFamily: "inherit",
    textAlign: "left",
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.55 : 1,
    WebkitTapHighlightColor: "transparent",
    width: "100%",
  };
  if (href) {
    return (
      <Link href={href} style={sharedStyle}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={sharedStyle}>
      {inner}
    </button>
  );
}

// ─── Single result card ──────────────────────────────────────────

function SearchCard({
  card,
  onClick,
}: {
  readonly card: SearchCard;
  readonly onClick: () => void;
}): React.JSX.Element {
  const soldOut = card.stockStatus === "sold_out";
  const lowStock = card.stockStatus === "low_stock";
  const initials = card.name
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
      data-nex-marketplace-prototype-search-card={card.cardId}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: 8,
        borderRadius: 14,
        background: "rgba(5, 15, 28, 0.72)",
        border: `1px solid ${hexWithAlpha(card.brandAccent, 0.3)}`,
        cursor: soldOut ? "default" : "pointer",
        opacity: soldOut ? 0.55 : 1,
        fontFamily: "inherit",
        textAlign: "left",
        boxShadow: `0 6px 14px -6px rgba(0, 0, 0, 0.5)`,
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <div
        aria-hidden
        style={{
          width: "100%",
          aspectRatio: "1 / 1",
          borderRadius: 10,
          background: card.imageDataUrl
            ? `url("${card.imageDataUrl}") center / cover no-repeat`
            : `linear-gradient(135deg, ${hexWithAlpha(card.brandAccent, 0.42)}, ${hexWithAlpha(card.brandAccent, 0.14)}), ${NEX.bg}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {!card.imageDataUrl && (
          <span
            style={{
              color: hexWithAlpha(card.brandAccent, 0.95),
              fontSize: 26,
              fontWeight: 900,
              letterSpacing: "-0.02em",
              textShadow: "0 2px 8px rgba(0, 0, 0, 0.5)",
              fontFamily: "'Georgia', 'Times New Roman', serif",
            }}
          >
            {initials}
          </span>
        )}
        {card.isSpicy && (
          <span
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
            }}
          >
            🌶️ Spicy
          </span>
        )}
        {lowStock && (
          <span
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
            }}
          >
            Low
          </span>
        )}
        {soldOut && (
          <span
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
        {card.name}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 6,
          marginTop: "auto",
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 900,
            color: card.brandAccent,
            lineHeight: 1,
          }}
        >
          {formatIdr(card.price_pence)}
        </div>
      </div>

      {/* Brand + location row · lets the buyer see WHO is selling
          this item, which is the whole point of a cross-brand
          search surface. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          fontSize: 10,
          color: NEX.textMute,
          lineHeight: 1.3,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: card.brandAccent,
            flexShrink: 0,
            boxShadow: `0 0 6px -1px ${hexWithAlpha(card.brandAccent, 0.8)}`,
          }}
        />
        <span style={{ color: NEX.textDim, fontWeight: 700 }}>
          {card.brandName}
        </span>
        {card.brandLocation && (
          <>
            <span style={{ opacity: 0.5 }}>·</span>
            <span>{card.brandLocation}</span>
          </>
        )}
      </div>
    </button>
  );
}
