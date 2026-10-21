"use client";

// src/app/nex-native/chat-themes-library/marketplace-prototype/_header-client.tsx
//
// NEX Themes Marketplace · PROTOTYPE header (sealed design preserved).
// Owner-authorised 2026-10-21.
// -----------------------------------------------------------------------------
// Renders the owner-approved marketplace header:
//   · NEX eyebrow
//   · NEX THEMES title
//   · "Personalise your chat. Make it yours." subtitle
//   · Menu button (opens a drawer with 4 items)
//   · Search bar (visual · wires to local filter state)
//   · Filter pills (New / Free / Premium)
//
// Scope boundaries:
//   · Filter + search are LOCAL ONLY in the prototype · they tag the
//     marketplace surface with a `data-nex-marketplace-prototype-filter`
//     attribute so the catalog can read them later; actual filtering
//     is deferred to the Shop + Intro doctrine seal.
//   · Menu items route to:
//       New           → /nex-native/chat-themes-library/marketplace-prototype?filter=new
//       Free Themes   → /nex-native/chat-themes-library/marketplace-prototype?filter=free
//       Premium Themes → /nex-native/chat-themes-library/marketplace-prototype?filter=premium
//       Back to Welcome → /nex-native/welcome
//     These are URL params only · no server-side filter logic yet.

import * as React from "react";
import Link from "next/link";
import { NexPingBadge } from "@/lib/nex-native/nex-ping-badge-client";

const NEX = {
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMute: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  bg: "#020914",
};

export type MarketplaceFilter = "new" | "free" | "premium";

function CartIcon(): React.JSX.Element {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx={9} cy={21} r={1.5} />
      <circle cx={18} cy={21} r={1.5} />
      <path d="M2.5 3h2l2.6 12.3a2 2 0 0 0 2 1.7h7.9a2 2 0 0 0 2-1.6L21 7H6" />
    </svg>
  );
}

const FILTERS: ReadonlyArray<{
  readonly id: MarketplaceFilter;
  readonly label: string;
}> = [
  { id: "new", label: "New" },
  { id: "free", label: "Free" },
  { id: "premium", label: "Premium" },
];

const MENU_ITEMS: ReadonlyArray<{
  readonly label: string;
  readonly hint: string;
  readonly href: string;
}> = [
  {
    label: "New",
    hint: "The latest themes · freshest arrivals",
    href: "/nex-native/chat-themes-library/marketplace-prototype?filter=new",
  },
  {
    label: "Free Themes",
    hint: "The 2 free-forever themes",
    href: "/nex-native/chat-themes-library/marketplace-prototype?filter=free",
  },
  {
    label: "Premium Themes",
    hint: "The paid catalogue",
    href: "/nex-native/chat-themes-library/marketplace-prototype?filter=premium",
  },
  {
    label: "Back to Welcome",
    hint: "Return to the NEX welcome surface",
    href: "/nex-native/welcome",
  },
];

export function MarketplaceHeaderClient({
  activeFilter,
  onFilterChange,
  searchQuery,
  onSearchChange,
  cartCount,
  onCartClick,
}: {
  readonly activeFilter: MarketplaceFilter;
  readonly onFilterChange: (f: MarketplaceFilter) => void;
  readonly searchQuery: string;
  readonly onSearchChange: (q: string) => void;
  readonly cartCount: number;
  readonly onCartClick: () => void;
}): React.JSX.Element {
  const [menuOpen, setMenuOpen] = React.useState(false);

  // Esc closes menu
  React.useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [menuOpen]);

  return (
    <>
      <header
        data-nex-marketplace-prototype-header
        style={{
          padding:
            "calc(env(safe-area-inset-top, 0px) + 14px) 14px 10px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          background:
            "linear-gradient(180deg, rgba(0, 175, 255, 0.1), transparent)",
          flexShrink: 0,
        }}
      >
        {/* Row 1 · back + title + menu */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
          }}
        >
          {/* Owner directive 2026-10-21 · back arrow retired · the
              sealed NEX ping badge takes its place on the left, giving
              the header its brand mark with the animated ping ring. */}
          <div style={{ flexShrink: 0 }}>
            <NexPingBadge
              size={44}
              accent={NEX.cyan}
              dataTestId="marketplace-prototype-nex"
            />
          </div>
          <div style={{ flex: 1, minWidth: 0, paddingTop: 10 }}>
            <h1
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 900,
                color: NEX.text,
                letterSpacing: "-0.015em",
                lineHeight: 1.05,
              }}
            >
              NEX THEMES
            </h1>
            <div
              style={{
                marginTop: 3,
                fontSize: 11,
                color: NEX.textDim,
                lineHeight: 1.35,
              }}
            >
              Make It Yours
            </div>
          </div>
          {/* Right-side icon cluster · cart + menu · owner directive
              2026-10-21. Cart has a count badge when items are
              present; stays visually balanced with the 3-dots menu
              to its right. */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              onClick={onCartClick}
              aria-label={`Cart · ${cartCount} item${cartCount === 1 ? "" : "s"}`}
              data-nex-marketplace-prototype-cart-header-trigger
              style={{
                position: "relative",
                width: 36,
                height: 36,
                padding: 0,
                background: "transparent",
                color: NEX.text,
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <CartIcon />
              {cartCount > 0 && (
                <span
                  data-nex-marketplace-prototype-cart-badge
                  style={{
                    position: "absolute",
                    top: 2,
                    right: 2,
                    minWidth: 16,
                    height: 16,
                    padding: "0 4px",
                    borderRadius: 999,
                    background: "#DC2626",
                    color: "#FFFFFF",
                    fontSize: 10,
                    fontWeight: 900,
                    lineHeight: "16px",
                    textAlign: "center",
                    boxShadow:
                      "0 0 0 2px #020914, 0 0 8px -2px rgba(220, 38, 38, 0.7)",
                  }}
                >
                  {cartCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              aria-expanded={menuOpen}
              data-nex-marketplace-prototype-menu-trigger
              style={{
                width: 36,
                height: 36,
                padding: 0,
                background: "transparent",
                color: NEX.text,
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <svg width={22} height={22} viewBox="0 0 24 24" aria-hidden>
                <circle cx={12} cy={5} r={1.6} fill="currentColor" />
                <circle cx={12} cy={12} r={1.6} fill="currentColor" />
                <circle cx={12} cy={19} r={1.6} fill="currentColor" />
              </svg>
            </button>
          </div>
        </div>

        {/* Row 2 · search bar */}
        <div
          data-nex-marketplace-prototype-search
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
            style={{ flexShrink: 0 }}
          >
            <circle cx={11} cy={11} r={7} />
            <line x1={21} y1={21} x2={16.65} y2={16.65} />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search themes, styles, categories..."
            aria-label="Search themes"
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
          {searchQuery.length > 0 && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              aria-label="Clear search"
              style={{
                width: 24,
                height: 24,
                padding: 0,
                background: "transparent",
                color: NEX.textMute,
                border: "none",
                fontSize: 16,
                lineHeight: 1,
                cursor: "pointer",
                fontFamily: "inherit",
                flexShrink: 0,
              }}
            >
              ×
            </button>
          )}
        </div>

        {/* Row 3 · filter pills */}
        <div
          data-nex-marketplace-prototype-filter-pills
          role="tablist"
          style={{
            display: "flex",
            gap: 6,
          }}
        >
          {FILTERS.map((f) => {
            const active = f.id === activeFilter;
            return (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onFilterChange(f.id)}
                data-nex-marketplace-prototype-filter-pill={f.id}
                data-nex-marketplace-prototype-filter-pill-active={active ? "true" : "false"}
                style={{
                  flex: 1,
                  minHeight: 34,
                  padding: "0 12px",
                  borderRadius: 999,
                  background: active ? NEX.cyan : "transparent",
                  color: active ? "#0a0608" : NEX.text,
                  border: `1px solid ${active ? NEX.cyan : NEX.cyanSoft}`,
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: 0.3,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  WebkitTapHighlightColor: "transparent",
                  transition: "background 150ms ease, color 150ms ease",
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Sub-eyebrow · reinforces context */}
        <div
          style={{
            fontSize: 9,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: NEX.textMute,
            fontWeight: 700,
          }}
        >
          NEX Themes · Marketplace
        </div>
      </header>

      {/* ─── Side drawer menu ─── */}
      {menuOpen && (
        <>
          <div
            onClick={() => setMenuOpen(false)}
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0, 0, 0, 0.55)",
              zIndex: 700,
              cursor: "pointer",
            }}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Marketplace menu"
            data-nex-marketplace-prototype-menu
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
              {MENU_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  data-nex-marketplace-prototype-menu-item={item.label}
                  style={{
                    padding: "12px 12px",
                    borderRadius: 10,
                    textDecoration: "none",
                    color: NEX.text,
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                  }}
                >
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      letterSpacing: "-0.005em",
                    }}
                  >
                    {item.label}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: NEX.textMute,
                      lineHeight: 1.35,
                    }}
                  >
                    {item.hint}
                  </span>
                </Link>
              ))}
            </nav>
          </aside>
        </>
      )}
    </>
  );
}
