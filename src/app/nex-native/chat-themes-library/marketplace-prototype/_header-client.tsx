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
import { NexPingBadge } from "@/lib/nex-native/nex-ping-badge-client";
// Owner directive 2026-10-22 · marketplace header now mounts the
// sealed ControlDrawer in place of its own purpose-built filter
// drawer. The custom drawer's filter rows were redundant with the
// filter pills already visible in the header; My Shop + nav now
// live in the sealed drawer where every NEX surface accesses them.
import { ControlDrawer } from "@/components/nex-native/control-drawer/control-drawer-client";

const NEX = {
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMute: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  bg: "var(--nex-world-background-base, #020914)",
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

// Owner directive 2026-10-22 · custom MENU_ITEMS retired · the
// sealed ControlDrawer is the single source of truth for navigation
// (contacts · chats · chat themes · My Shop · settings · etc.).
// Filters remain available via the pill row at the bottom of the
// header (New / Free / Premium).

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
  // Owner directive 2026-10-22 · marketplace-prototype's own menu
  // state retired · the sealed ControlDrawer manages its own open
  // / close lifecycle.

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
            {/* Sealed ControlDrawer · renders its own 3-dot trigger
                + full right-side drawer. session={null} degrades to
                the anonymous sign-in prompt + locked rows, which is
                the correct state for a buyer browsing the
                marketplace prototype without an account. "My Shop"
                lives inside this drawer at the top of the Business
                group. */}
            <ControlDrawer session={null} />
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

      {/* Owner directive 2026-10-22 · marketplace's purpose-built
          filter/nav drawer was retired · navigation lives in the
          sealed ControlDrawer mounted inline in the header (above),
          and filter selection stays in the pill row (New / Free /
          Premium). Removed to keep a single drawer source of truth. */}
    </>
  );
}
