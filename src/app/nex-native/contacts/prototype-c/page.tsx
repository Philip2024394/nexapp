// src/app/nex-native/contacts/prototype-c/page.tsx
//
// PROTOTYPE C · Card-grid layout
// -----------------------------------------------------------------------
// Concept: Filter options reorganise as a 2×3 tile grid where each tile
// shows the category name + count. Invite Friends becomes a tile too.
// The grid becomes the "landing" above the rows · reads less like a
// chat contacts list and more like a Shortcuts / Discover screen.
// Rows render below the grid when the user picks a category · for the
// prototype we show the Friends tile as pre-selected and render the
// Friends rows below.
//
// Hard constraints preserved:
//   · Sealed `_contact-row.tsx` mounted AS-IS · only `accentHex` prop
//     carries Irish Gold.
//   · Font stack: system default.
//   · Mobile-first text sizes.
//   · All colours route through world tokens with hex fallbacks so
//     Worldwide/Indonesia stay byte-identical.

import type * as React from "react";
import { ContactRow } from "../_contact-row";
import {
  IRELAND_PROTOTYPE_VARS,
  PROTOTYPE_IRISH_GOLD,
  PROTOTYPE_MOCK_ROWS,
  PrototypeNav,
} from "../_prototype-shared";

export const dynamic = "force-dynamic";

interface Tile {
  readonly id: string;
  readonly label: string;
  readonly count: string;
  readonly icon: string;
  readonly active: boolean;
  readonly disabled?: boolean;
}

// Owner directive 2026-11-03 · "we dont need button all" · "All" tile
// retired. "Connect NEX ID" tile added so the 2×3 grid stays balanced
// and the owner's "missing connect to nex user id" affordance is
// surfaced on the primary surface.
const TILES: readonly Tile[] = [
  { id: "friends", label: "Friends", count: `${PROTOTYPE_MOCK_ROWS.length} friends`, icon: "☘", active: true },
  { id: "business", label: "Business", count: "86 shops", icon: "🛒", active: false },
  { id: "socials", label: "Socials", count: "Coming soon", icon: "👥", active: false, disabled: true },
  { id: "groups", label: "Groups", count: "12 groups", icon: "⬡", active: false },
  { id: "connect", label: "Connect", count: "Enter NEX ID", icon: "@", active: false },
  { id: "invite", label: "Invite", count: "Share NEX", icon: "✉", active: false },
];

export default function PrototypeCPage() {
  return (
    <main
      data-nex-contacts-prototype="c"
      style={{
        ...IRELAND_PROTOTYPE_VARS,
        // Owner directive 2026-11-03 · "page background color style
        // design was same as music library page" · override the
        // IRELAND_PROTOTYPE_VARS Emerald with Cream `#FAF8F4` (same
        // value as the sealed Ireland world backgroundBase and the
        // music library's `--nex-world-background-base` resolution).
        "--nex-world-background-base": "#FAF8F4",
        color: "var(--nex-world-text-primary, #102013)",
        fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
      } as React.CSSProperties}
    >
      {/* Owner directive 2026-11-03 · "run full page layout" · prototype-c
          now opts in to the sealed phone-frame wrapper
          (.nex-native-stage > .nex-native-frame · nex-native.css lines
          152-249) so (a) mobile viewports inherit frame's overflow-x:
          hidden safeguard, (b) desktop viewports get the proper phone-
          shaped container with the body backdrop visible around it. */}
      {/* Owner directive 2026-11-03 · cards switch to Forest green
          (`--nex-world-primary`) · distinct from the Emerald page bg
          · Gold rim preserved via the sealed accentHex prop (we no
          longer override border-color) · text colours lift to Orange
          (name) and Sage (secondary) for contrast. Nav footer stays
          Gold so the A·B·C selector reads unambiguously. */}
      <style>{`
        [data-nex-contacts-prototype="c"] [data-nex-contacts-row] {
          background: var(--nex-world-primary, #1B5138) !important;
        }
        [data-nex-contacts-prototype="c"] [data-nex-contacts-row-name] {
          color: #F5A623 !important;
        }
        [data-nex-contacts-prototype="c"] [data-nex-contacts-row-profession],
        [data-nex-contacts-prototype="c"] [data-nex-contacts-row-location],
        [data-nex-contacts-prototype="c"] [data-nex-contacts-row-last-online] {
          color: var(--nex-world-primary-ink, #AFC5B5) !important;
          opacity: 0.9;
        }
        [data-nex-contacts-prototype="c"] nav[aria-label="Prototype navigation"] a {
          background: var(--nex-world-secondary, #C6A15B) !important;
          color: var(--nex-world-drawer-bg, #123D2B) !important;
          border-color: var(--nex-world-drawer-bg, #123D2B) !important;
        }
      `}</style>

      <div className="nex-native-stage">
        <div
          className="nex-native-frame"
          style={{
            display: "flex",
            flexDirection: "column",
            overflowX: "hidden",
          }}
        >

      {/* ========== SIMPLE HEADER STRIP ========== */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding:
            "calc(env(safe-area-inset-top, 0) + 16px) 16px 14px",
          background: "var(--nex-world-drawer-bg, #123D2B)",
          color: "var(--nex-world-primary-ink, #AFC5B5)",
          borderBottom: "1px solid var(--nex-world-secondary, #C6A15B)",
        }}
      >
        <span style={{ fontSize: 20, lineHeight: 1 }} aria-hidden>
          ☘️
        </span>
        <h1
          style={{
            margin: 0,
            fontSize: 17,
            fontWeight: 800,
            letterSpacing: "0.03em",
            flex: 1,
          }}
        >
          NEX CONTACTS
        </h1>
        <button type="button" aria-label="Search" style={headerIconBtn}>
          🔍
        </button>
        <button type="button" aria-label="Add contact" style={headerIconBtn}>
          +
        </button>
      </header>

      {/* ========== CONTENT COLUMN ========== */}
      <div
        style={{
          flex: 1,
          maxWidth: 480,
          width: "100%",
          margin: "0 auto",
          padding: "16px 14px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {/* 2×3 tile grid · minmax(0, 1fr) lets cells shrink below content
            width on narrow viewports instead of pushing the grid wider. */}
        <section
          aria-label="Contact categories"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 10,
            width: "100%",
          }}
        >
          {TILES.map((tile) => (
            <button
              key={tile.id}
              type="button"
              aria-pressed={tile.active}
              disabled={tile.disabled}
              style={tileStyle(tile.active, tile.disabled === true)}
            >
              <span
                aria-hidden
                style={{
                  fontSize: 24,
                  lineHeight: 1,
                  marginBottom: 6,
                  // Owner directive 2026-11-03 · tile icons use dark
                  // Emerald on the Gold tile for contrast.
                  color: "var(--nex-world-drawer-bg, #123D2B)",
                }}
              >
                {tile.icon}
              </span>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  letterSpacing: "0.02em",
                  marginBottom: 2,
                }}
              >
                {tile.label}
              </span>
              <span
                style={{
                  fontSize: 11,
                  opacity: tile.disabled ? 0.6 : 0.78,
                  fontWeight: 500,
                }}
              >
                {tile.count}
              </span>
            </button>
          ))}
        </section>

        {/* Section label for selected tile */}
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--nex-world-text-secondary, #3F5742)",
            padding: "0 4px",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--nex-world-secondary, #C6A15B)",
            }}
            aria-hidden
          />
          Friends · {PROTOTYPE_MOCK_ROWS.length}
        </div>

        {/* Sealed contact rows · owner directive 2026-11-03 · "contact
            card on left side only reduce width 25px to right" scoped
            to this C card grid only · 25px padding-right on this
            container pulls each row's right edge in by 25px while
            keeping the left flush with the content column. Does NOT
            touch the sealed shared `_contact-row.tsx` → other surfaces
            unaffected. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            paddingRight: 25,
          }}
        >
          {PROTOTYPE_MOCK_ROWS.map((row) => (
            <ContactRow
              key={row.id}
              row={row}
              accentHex={PROTOTYPE_IRISH_GOLD}
            />
          ))}
        </div>
      </div>

      <PrototypeNav current="c" />

        </div>
      </div>
    </main>
  );
}

const headerIconBtn: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: "50%",
  background: "var(--nex-world-secondary, #C6A15B)",
  color: "var(--nex-world-drawer-bg, #123D2B)",
  border: "none",
  fontSize: 14,
  fontWeight: 900,
  lineHeight: 1,
  cursor: "pointer",
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
};

function tileStyle(active: boolean, disabled: boolean): React.CSSProperties {
  return {
    boxSizing: "border-box",
    width: "100%",
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "flex-end",
    padding: "16px 14px",
    minHeight: 110,
    textAlign: "left",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.65 : 1,
    // Owner directive 2026-11-03 · "apply this button color [Irish Gold
    // from the music side drawer] to all buttons and cards on C · Card-
    // grid". Every tile reads Gold now; active state is signalled via
    // a thicker Emerald rim + stronger shadow rather than a hue swap.
    background: "var(--nex-world-secondary, #C6A15B)",
    color: "var(--nex-world-drawer-bg, #123D2B)",
    border: active
      ? `2.5px solid var(--nex-world-drawer-bg, #123D2B)`
      : `1.5px solid var(--nex-world-drawer-bg, #123D2B)`,
    borderRadius: 14,
    boxShadow: active
      ? "0 6px 18px rgba(10, 31, 21, 0.35)"
      : "0 2px 6px rgba(10, 31, 21, 0.12)",
    overflow: "hidden",
    fontWeight: active ? 800 : 600,
  };
}
