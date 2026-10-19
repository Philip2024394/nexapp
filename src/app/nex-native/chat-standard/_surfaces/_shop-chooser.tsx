"use client";

// src/app/nex-native/chat-standard/_surfaces/_shop-chooser.tsx
//
// NEX Chat Theme Preview · Shop Sheet · 5-way category chooser.
// Owner-authorised 2026-10-19.
// -----------------------------------------------------------------------------
// Replaces the mock-products slider that previously filled the Shop
// sheet on every live-world theme preview (crispy-chicken + 18 other
// sealed packages).
//
// Reads the sealed `SHOP_CHOOSER_CATALOG` (src/app/nex-native/chat/
// _shop-chooser-catalog.ts) so the live-world preview shows exactly
// the same 5 categories (Products · Services · Food · Accommodation ·
// Affiliate) the DB-driven theme viewer path already surfaces via
// `_shop-grid-modal.tsx` with `showShopSetupChooser=true`. This is a
// convergence fix · the two preview paths now show the same chooser
// shape instead of drifting apart.
//
// Services + Accommodation are rendered with the sealed "Coming soon"
// chip and are NOT tappable (available=false in the catalogue · their
// backends do not yet exist). Products · Food · Affiliate route to
// their sealed destinations verbatim via <Link>.
//
// Visual language mirrors the StandardShopSlider's own card styling
// via the engine's `shopTreatment()` so the chooser reads as part of
// the live-world chrome, not a bolted-on panel.

import * as React from "react";
import Link from "next/link";
import type { ResolvedEngine } from "../_engine/theme-engine";
import {
  sellCards,
  earnCards,
  type ShopChooserCard,
} from "../../chat/_shop-chooser-catalog";

export interface StandardShopChooserProps {
  readonly engine: ResolvedEngine;
}

export function StandardShopChooser({
  engine,
}: StandardShopChooserProps): React.JSX.Element {
  const colours = engine.colours;
  return (
    <div
      data-nex-se-shop-chooser
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        padding: "4px 2px 12px",
        color: colours.highlight,
      }}
    >
      <ChooserSection
        label="Sell on NEX"
        accent={colours.primary}
        cards={sellCards()}
      />
      <ChooserSection
        label="Earn with NEX"
        accent={colours.primary}
        cards={earnCards()}
      />
    </div>
  );
}

function ChooserSection({
  label,
  accent,
  cards,
}: {
  label: string;
  accent: string;
  cards: readonly ShopChooserCard[];
}): React.JSX.Element {
  return (
    <div
      data-nex-se-shop-chooser-section
      data-nex-se-shop-chooser-section-label={label}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: accent,
          padding: "0 2px 8px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 8,
        }}
      >
        {cards.map((card) => (
          <ChooserCard key={card.id} card={card} accent={accent} />
        ))}
      </div>
    </div>
  );
}

function ChooserCard({
  card,
  accent,
}: {
  card: ShopChooserCard;
  accent: string;
}): React.JSX.Element {
  const baseStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 14px",
    borderRadius: 14,
    background: "rgba(255, 255, 255, 0.04)",
    border: `1px solid ${accent}55`,
    color: "inherit",
    textDecoration: "none",
    boxSizing: "border-box",
    width: "100%",
    opacity: card.available ? 1 : 0.75,
    cursor: card.available ? "pointer" : "not-allowed",
    boxShadow: card.available
      ? `0 6px 18px -10px ${accent}aa`
      : "none",
  };

  const content = (
    <>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 800,
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {card.label}
        </div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 500,
            lineHeight: 1.4,
            opacity: 0.75,
            marginTop: 2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {card.caption}
        </div>
      </div>
      {card.available ? (
        <span
          aria-hidden
          style={{
            fontSize: 18,
            fontWeight: 800,
            color: accent,
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          →
        </span>
      ) : (
        <span
          aria-label="Coming soon"
          style={{
            flexShrink: 0,
            padding: "4px 10px",
            borderRadius: 999,
            background: "rgba(255, 255, 255, 0.08)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "rgba(255, 255, 255, 0.72)",
          }}
        >
          Soon
        </span>
      )}
    </>
  );

  if (card.available && card.href) {
    return (
      <Link
        href={card.href}
        data-nex-se-shop-chooser-card={card.id}
        data-nex-se-shop-chooser-card-available="true"
        style={baseStyle}
      >
        {content}
      </Link>
    );
  }
  return (
    <div
      data-nex-se-shop-chooser-card={card.id}
      data-nex-se-shop-chooser-card-available="false"
      role="group"
      aria-disabled="true"
      style={baseStyle}
    >
      {content}
    </div>
  );
}
