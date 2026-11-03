// src/app/nex-native/contacts/prototype-b/page.tsx
//
// PROTOTYPE B · Compact layout
// -----------------------------------------------------------------------
// Concept: Everything above the contact rows is condensed into a tight
// top chrome. Header + search live on ONE row (glyph · search · plus).
// Filter pills in a slim scroll row immediately below. Invite Friends
// becomes a single-line strip (not a banner card). Target: maximum
// vertical space for the actual contact rows · see 5-6 rows above the
// fold on a mobile viewport.
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
  prototypePillStyle,
} from "../_prototype-shared";

export const dynamic = "force-dynamic";

const FILTER_LABELS: readonly string[] = ["All", "Friends", "Business", "Socials", "Groups"];

export default function PrototypeBPage() {
  return (
    <main
      data-nex-contacts-prototype="b"
      style={{
        ...IRELAND_PROTOTYPE_VARS,
        minHeight: "100dvh",
        background: "var(--nex-world-background-base, #FAF8F4)",
        color: "var(--nex-world-text-primary, #102013)",
        display: "flex",
        flexDirection: "column",
        fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
        overflowX: "hidden",
        maxWidth: "100vw",
      }}
    >
      {/* ========== TIGHT TOP ROW · glyph + inline search + icons ========== */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding:
            "calc(env(safe-area-inset-top, 0) + 10px) 12px 10px",
          background: "var(--nex-world-drawer-bg, #123D2B)",
          color: "var(--nex-world-primary-ink, #AFC5B5)",
          borderBottom: "1px solid var(--nex-world-secondary, #C6A15B)",
        }}
      >
        <span
          style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}
          aria-hidden
        >
          ☘️
        </span>
        {/* inline search · owns most of the row width */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 10px",
            background: "rgba(255,255,255,0.08)",
            border: "1px solid var(--nex-world-secondary, #C6A15B)",
            borderRadius: 999,
            minWidth: 0,
          }}
        >
          <span style={{ fontSize: 12 }} aria-hidden>
            🔍
          </span>
          <input
            type="search"
            placeholder="Search contacts"
            aria-label="Search contacts"
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--nex-world-primary-ink, #AFC5B5)",
              fontSize: 13,
              minWidth: 0,
            }}
          />
        </div>
        <button type="button" aria-label="Add contact" style={compactIconBtn}>
          +
        </button>
        <button type="button" aria-label="Settings" style={compactIconBtn}>
          ⋯
        </button>
      </header>

      {/* ========== SLIM FILTER PILLS ========== */}
      <nav
        aria-label="Contact filters"
        style={{
          position: "sticky",
          top: 54,
          zIndex: 9,
          display: "flex",
          gap: 6,
          padding: "8px 12px",
          background: "var(--nex-world-background-base, #FAF8F4)",
          borderBottom:
            "1px solid var(--nex-world-border, rgba(2,173,4,0.14))",
          overflowX: "auto",
        }}
      >
        {FILTER_LABELS.map((label, i) => (
          <button
            key={label}
            type="button"
            style={{
              ...prototypePillStyle(i === 1),
              padding: "6px 12px",
              fontSize: 12,
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* ========== INVITE FRIENDS · THIN STRIP ========== */}
      <div
        style={{
          margin: "10px 12px 0",
          padding: "10px 12px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "var(--nex-world-surface, #FFFFFF)",
          border: "1px solid var(--nex-world-secondary, #C6A15B)",
          borderRadius: 999,
          boxShadow: "0 1px 4px rgba(18, 61, 43, 0.05)",
        }}
      >
        <span
          aria-hidden
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "var(--nex-world-primary, #1B5138)",
            color: "var(--nex-world-primary-ink, #AFC5B5)",
            display: "grid",
            placeItems: "center",
            fontSize: 15,
          }}
        >
          ✉
        </span>
        <span
          style={{
            flex: 1,
            fontSize: 13,
            color: "var(--nex-world-text-primary, #102013)",
            fontWeight: 600,
          }}
        >
          Invite friends to NEX
        </span>
        <button type="button" style={compactCtaBtn}>
          Share
        </button>
      </div>

      {/* ========== CONTENT COLUMN · MAXIMISED FOR ROWS ========== */}
      <div
        style={{
          flex: 1,
          maxWidth: 480,
          width: "100%",
          margin: "0 auto",
          padding: "14px 12px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--nex-world-text-secondary, #3F5742)",
            padding: "0 4px",
            marginBottom: 2,
          }}
        >
          Friends · {PROTOTYPE_MOCK_ROWS.length}
        </div>

        {/* Sealed contact rows · tighter gap between them */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {PROTOTYPE_MOCK_ROWS.map((row) => (
            <ContactRow
              key={row.id}
              row={row}
              accentHex={PROTOTYPE_IRISH_GOLD}
            />
          ))}
        </div>
      </div>

      <PrototypeNav current="b" />
    </main>
  );
}

const compactIconBtn: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: "50%",
  background: "var(--nex-world-secondary, #C6A15B)",
  color: "var(--nex-world-drawer-bg, #123D2B)",
  border: "none",
  fontSize: 16,
  fontWeight: 900,
  lineHeight: 1,
  cursor: "pointer",
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
};

const compactCtaBtn: React.CSSProperties = {
  padding: "6px 12px",
  background: "var(--nex-world-primary, #1B5138)",
  color: "var(--nex-world-primary-ink, #AFC5B5)",
  border: "none",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 700,
  cursor: "pointer",
  flexShrink: 0,
};
