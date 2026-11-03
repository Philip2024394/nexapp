// src/app/nex-native/contacts/prototype-a/page.tsx
//
// PROTOTYPE A · Hero-first layout
// -----------------------------------------------------------------------
// Concept: Full-width Emerald hero band sets the Ireland brand identity
// immediately. Gold rim seals the bottom of the hero. Search field
// embedded inside the hero reads as "this is the entry point". Filter
// pills become a sticky secondary row below the hero so they ride with
// the scroll. Invite Friends sits as a full-width card above the rows.
//
// Hard constraints preserved:
//   · Sealed `_contact-row.tsx` mounted AS-IS · only the `accentHex`
//     prop changes (Irish Gold).
//   · Font stack: default system (no new font declaration).
//   · NEX ping-badge: not re-used here (hero carries the identity).
//   · Mobile-first text sizes.
//   · Every colour routes through `var(--nex-world-*, #<fallback>)` so
//     Worldwide/Indonesia keep byte-identical rendering if this layout
//     ever ships beyond Ireland.

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

export default function PrototypeAPage() {
  return (
    <main
      data-nex-contacts-prototype="a"
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
      {/* ========== EMERALD HERO BAND ========== */}
      <header
        style={{
          background: "var(--nex-world-drawer-bg, #123D2B)",
          color: "var(--nex-world-primary-ink, #AFC5B5)",
          padding:
            "calc(env(safe-area-inset-top, 0) + 24px) 20px 28px",
          borderBottom: "2px solid var(--nex-world-secondary, #C6A15B)",
          position: "relative",
        }}
      >
        {/* top row: glyph + title + add icon */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 8,
          }}
        >
          <span style={{ fontSize: 24, lineHeight: 1 }} aria-hidden>
            ☘️
          </span>
          <h1
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 800,
              letterSpacing: "0.03em",
              color: "var(--nex-world-primary-ink, #AFC5B5)",
              flex: 1,
            }}
          >
            NEX CONTACTS
          </h1>
          <button
            type="button"
            aria-label="Add contact"
            style={heroIconButton}
          >
            +
          </button>
        </div>
        <p
          style={{
            margin: "0 0 18px",
            fontSize: 12,
            opacity: 0.78,
          }}
        >
          Premium Irish experience · {PROTOTYPE_MOCK_ROWS.length} contacts
        </p>

        {/* embedded search */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 14px",
            background: "rgba(255,255,255,0.08)",
            border: "1px solid var(--nex-world-secondary, #C6A15B)",
            borderRadius: 999,
          }}
        >
          <span style={{ fontSize: 14 }} aria-hidden>
            🔍
          </span>
          <input
            type="search"
            placeholder="Search contacts..."
            aria-label="Search contacts"
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--nex-world-primary-ink, #AFC5B5)",
              fontSize: 14,
              minWidth: 0,
            }}
          />
        </div>
      </header>

      {/* ========== STICKY FILTER PILLS ========== */}
      <nav
        aria-label="Contact filters"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          display: "flex",
          gap: 6,
          padding: "12px 14px",
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
            style={prototypePillStyle(i === 1 /* "Friends" active */)}
          >
            {label}
          </button>
        ))}
      </nav>

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
          gap: 14,
        }}
      >
        {/* Invite Friends banner */}
        <div
          style={{
            background: "var(--nex-world-surface, #FFFFFF)",
            border: "1px solid var(--nex-world-secondary, #C6A15B)",
            borderRadius: 12,
            padding: 14,
            display: "flex",
            alignItems: "center",
            gap: 12,
            boxShadow: "0 2px 8px rgba(18, 61, 43, 0.06)",
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 10,
              background: "var(--nex-world-primary, #1B5138)",
              display: "grid",
              placeItems: "center",
              fontSize: 24,
              color: "var(--nex-world-primary-ink, #AFC5B5)",
            }}
            aria-hidden
          >
            ✉
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "var(--nex-world-text-primary, #102013)",
              }}
            >
              Invite Friends
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--nex-world-text-secondary, #3F5742)",
              }}
            >
              Share your NEX profile
            </div>
          </div>
          <button type="button" style={ctaButton}>
            Share
          </button>
        </div>

        {/* Section label */}
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--nex-world-text-secondary, #3F5742)",
            padding: "0 4px",
          }}
        >
          Friends · {PROTOTYPE_MOCK_ROWS.length}
        </div>

        {/* Sealed contact rows · Irish Gold accent */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {PROTOTYPE_MOCK_ROWS.map((row) => (
            <ContactRow
              key={row.id}
              row={row}
              accentHex={PROTOTYPE_IRISH_GOLD}
            />
          ))}
        </div>
      </div>

      <PrototypeNav current="a" />
    </main>
  );
}

const heroIconButton: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: "50%",
  background: "var(--nex-world-secondary, #C6A15B)",
  color: "var(--nex-world-drawer-bg, #123D2B)",
  border: "none",
  fontSize: 22,
  fontWeight: 900,
  lineHeight: 1,
  cursor: "pointer",
  display: "grid",
  placeItems: "center",
};

const ctaButton: React.CSSProperties = {
  padding: "8px 16px",
  background: "var(--nex-world-primary, #1B5138)",
  color: "var(--nex-world-primary-ink, #AFC5B5)",
  border: "none",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  flexShrink: 0,
};
