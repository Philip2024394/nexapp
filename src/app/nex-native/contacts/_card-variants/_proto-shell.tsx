// src/app/nex-native/contacts/_card-variants/_proto-shell.tsx
//
// Shared prototype-c chrome for the 5 card-variant prototypes.
// -----------------------------------------------------------------------
// Mounts: Emerald header · 2×3 tile grid (All removed, Connect NEX ID
// added) · section label · list of cards (variant-specific renderer) ·
// variant-nav footer. The caller passes a `renderCard` function that
// receives one row + the Ireland Gold accent and returns the card JSX.

import type * as React from "react";
import type { ContactRowDisplay } from "../_contacts-list";
import {
  IRELAND_PROTOTYPE_VARS,
  PROTOTYPE_IRISH_GOLD,
  PROTOTYPE_MOCK_ROWS,
} from "../_prototype-shared";
import { HeartbeatKeyframeStyle } from "./_shared";

interface Tile {
  readonly id: string;
  readonly label: string;
  readonly count: string;
  readonly icon: string;
  readonly active: boolean;
  readonly disabled?: boolean;
}

/** Prototype-c tiles · owner-directive 2026-11-03 · "All" removed,
 *  "Connect NEX ID" added so the grid still reads as 2×3. */
const SHARED_TILES: readonly Tile[] = [
  { id: "friends", label: "Friends", count: `${PROTOTYPE_MOCK_ROWS.length} friends`, icon: "☘", active: true },
  { id: "business", label: "Business", count: "86 shops", icon: "🛒", active: false },
  { id: "socials", label: "Socials", count: "Coming soon", icon: "👥", active: false, disabled: true },
  { id: "groups", label: "Groups", count: "12 groups", icon: "⬡", active: false },
  { id: "connect", label: "Connect", count: "Enter NEX ID", icon: "@", active: false },
  { id: "invite", label: "Invite", count: "Share NEX", icon: "✉", active: false },
];

type VariantId =
  | "v1" | "v2" | "v3" | "v4" | "v5"
  | "g1" | "g2" | "g3" | "g4" | "g5";

interface ShellProps {
  readonly variant: VariantId;
  readonly variantLabel: string;
  readonly variantDescription: string;
  readonly renderCard: (
    row: ContactRowDisplay,
    index: number,
    total: number,
  ) => React.JSX.Element;
}

export function CardVariantShell({
  variant,
  variantLabel,
  variantDescription,
  renderCard,
}: ShellProps): React.JSX.Element {
  // Owner directive 2026-11-03 · "where is the desktop background image
  // gone" · prototype now opts in to the sealed phone-frame wrapper
  // (.nex-native-stage > .nex-native-frame · see nex-native.css lines
  // 152-249) so on desktop ≥500px the body-level backdrop painted by
  // the world engine (`--nex-world-desktop-backdrop` · Ireland studio
  // PNG on Ireland deployment) is visible AROUND a centered 360×780
  // phone-shaped frame. On <500px the frame collapses to full-bleed
  // and the layout looks identical to the previous bare-main version.
  return (
    <main
      data-nex-card-variant-prototype={variant}
      style={{
        ...IRELAND_PROTOTYPE_VARS,
        color: "var(--nex-world-text-primary, #102013)",
        fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
      }}
    >
      <HeartbeatKeyframeStyle />

      <div className="nex-native-stage">
        <div
          className="nex-native-frame"
          style={{
            display: "flex",
            flexDirection: "column",
            overflowX: "hidden",
          }}
        >

      {/* HEADER */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "calc(env(safe-area-inset-top, 0) + 16px) 16px 14px",
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

      {/* CONTENT COLUMN */}
      <div
        style={{
          flex: 1,
          maxWidth: 480,
          width: "100%",
          margin: "0 auto",
          padding: "14px 14px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          boxSizing: "border-box",
          minWidth: 0,
        }}
      >
        {/* Variant label */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            padding: "0 2px",
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--nex-world-secondary, #C6A15B)",
            }}
          >
            {variantLabel}
          </span>
          {/* Owner directive 2026-11-03 · page bg is now Emerald · the
              variant description text uses Sage ink for contrast on
              dark green instead of the muted-secondary which would be
              invisible. */}
          <span
            style={{
              fontSize: 12,
              color: "var(--nex-world-primary-ink, #AFC5B5)",
              opacity: 0.85,
            }}
          >
            {variantDescription}
          </span>
        </div>

        {/* 2×3 tile grid */}
        <section
          aria-label="Contact categories"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 10,
            width: "100%",
          }}
        >
          {SHARED_TILES.map((tile) => (
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
                  fontSize: tile.id === "connect" ? 22 : 24,
                  lineHeight: 1,
                  marginBottom: 6,
                  color: tile.active
                    ? "var(--nex-world-primary-ink, #AFC5B5)"
                    : "var(--nex-world-secondary, #C6A15B)",
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

        {/* Section label · Sage ink for contrast on Emerald bg */}
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--nex-world-primary-ink, #AFC5B5)",
            opacity: 0.9,
            padding: "0 4px",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            aria-hidden
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--nex-world-secondary, #C6A15B)",
            }}
          />
          Friends · {PROTOTYPE_MOCK_ROWS.length}
        </div>

        {/* Card stack · variant-specific renderer */}
        <div style={{ display: "flex", flexDirection: "column", gap: variant === "v4" || variant === "g4" ? 8 : 10 }}>
          {PROTOTYPE_MOCK_ROWS.map((row, i) =>
            renderCard(row, i, PROTOTYPE_MOCK_ROWS.length),
          )}
        </div>
      </div>

      {/* Variant nav footer · 5 card variants */}
      <CardVariantNav current={variant} />

        </div>
      </div>
    </main>
  );
}

export function CardVariantNav({
  current,
}: {
  readonly current: VariantId;
}): React.JSX.Element {
  const isGreen = current.startsWith("g");
  const items: Array<{ id: VariantId; label: string }> = isGreen
    ? [
        { id: "g1", label: "G1 · Flat" },
        { id: "g2", label: "G2 · Floating" },
        { id: "g3", label: "G3 · Executive" },
        { id: "g4", label: "G4 · Dense" },
        { id: "g5", label: "G5 · Luxury" },
      ]
    : [
        { id: "v1", label: "V1 · Flat" },
        { id: "v2", label: "V2 · Elevated" },
        { id: "v3", label: "V3 · Irish" },
        { id: "v4", label: "V4 · Dense" },
        { id: "v5", label: "V5 · Hero" },
      ];
  return (
    <nav
      aria-label="Card variant navigation"
      style={{
        position: "sticky",
        bottom: 0,
        display: "flex",
        gap: 4,
        padding: "8px 8px calc(env(safe-area-inset-bottom, 0) + 8px)",
        background: "var(--nex-world-surface, #FFFFFF)",
        borderTop: "1px solid var(--nex-world-secondary, #C6A15B)",
        boxShadow: "0 -4px 12px rgba(0,0,0,0.08)",
        zIndex: 20,
      }}
    >
      {items.map((item) => {
        const active = current === item.id;
        return (
          <a
            key={item.id}
            href={`/nex-native/contacts/card-${item.id}`}
            style={{
              flex: 1,
              padding: "9px 4px",
              textAlign: "center",
              fontSize: 10,
              fontWeight: active ? 800 : 600,
              letterSpacing: "0.02em",
              background: active
                ? "var(--nex-world-primary, #1B5138)"
                : "var(--nex-world-surface, #FFFFFF)",
              color: active
                ? "var(--nex-world-primary-ink, #AFC5B5)"
                : "var(--nex-world-text-primary, #102013)",
              border: `1px solid var(--nex-world-secondary, #C6A15B)`,
              borderRadius: 6,
              textDecoration: "none",
            }}
          >
            {item.label}
          </a>
        );
      })}
    </nav>
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
    background: active
      ? "var(--nex-world-primary, #1B5138)"
      : "var(--nex-world-surface, #FFFFFF)",
    color: active
      ? "var(--nex-world-primary-ink, #AFC5B5)"
      : "var(--nex-world-text-primary, #102013)",
    border: `1.5px solid var(--nex-world-secondary, #C6A15B)`,
    borderRadius: 14,
    boxShadow: active
      ? "0 4px 14px rgba(18, 61, 43, 0.18)"
      : "0 2px 6px rgba(18, 61, 43, 0.06)",
    overflow: "hidden",
  };
}
