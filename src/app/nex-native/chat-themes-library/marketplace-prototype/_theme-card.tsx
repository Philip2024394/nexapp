"use client";

// src/app/nex-native/chat-themes-library/marketplace-prototype/_theme-card.tsx
//
// Single theme card · full-height wallpaper fills the card · title +
// price chip overlaid at the top · three round buttons overlaid at
// the bottom. Owner-authorised 2026-10-21 (prototype iteration).

import * as React from "react";
import type { MarketplaceCatalogEntry } from "./_catalog";
import { cartKey } from "./_types";

const NEX = {
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMute: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  cardBorder: "rgba(0, 175, 255, 0.22)",
};

const CARD_HEIGHT = 460;

export function ThemeCard({
  entry,
  inCartKeys,
  onPreviewTheme,
  onPreviewIntro,
  onPreviewShop,
}: {
  readonly entry: MarketplaceCatalogEntry;
  readonly inCartKeys: ReadonlySet<string>;
  readonly onPreviewTheme: () => void;
  readonly onPreviewIntro: () => void;
  readonly onPreviewShop: () => void;
}): React.JSX.Element {
  const themeInCart = inCartKeys.has(
    cartKey({ themeId: entry.themeId, productType: "theme" }),
  );
  const introInCart = inCartKeys.has(
    cartKey({ themeId: entry.themeId, productType: "intro" }),
  );
  const shopInCart = Array.from(inCartKeys).some((k) =>
    k.startsWith(`${entry.themeId}::shop::`),
  );

  return (
    <article
      data-nex-marketplace-prototype-card
      data-nex-marketplace-prototype-card-theme-id={entry.themeId}
      style={{
        // Owner directive 2026-10-21 · clean-edge pass · the 1px cyan
        // border on the article left a thin ring around every image.
        // Dropped the border entirely · the shadow carries all the
        // visual lift. The image now goes flush to the rounded corner
        // with no outline artefact.
        flexShrink: 0,
        position: "relative",
        width: "100%",
        height: CARD_HEIGHT,
        borderRadius: 18,
        overflow: "hidden",
        border: "none",
        boxShadow: "0 16px 40px -16px rgba(0, 0, 0, 0.75)",
        // The theme wallpaper fills the card edge-to-edge · dark navy
        // underlay matches the sealed app palette as a fallback while
        // the asset is loading.
        background: `url("${entry.wallpaperUrl}") center / cover no-repeat, #0A1526`,
      }}
    >
      {/* ─── Top overlay · title + subtitle + price chip ─── */}
      <div
        data-nex-marketplace-prototype-card-top-overlay
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          padding: "16px 18px 36px",
          background:
            "linear-gradient(180deg, rgba(2, 9, 20, 0.72) 0%, rgba(2, 9, 20, 0.4) 60%, transparent 100%)",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 10,
          pointerEvents: "none",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 900,
              color: "#FFFFFF",
              letterSpacing: "-0.012em",
              lineHeight: 1.1,
              textShadow: "0 2px 12px rgba(0, 0, 0, 0.75)",
            }}
          >
            {entry.displayName}
          </h3>
          <div
            style={{
              marginTop: 4,
              fontSize: 11,
              color: "rgba(255, 255, 255, 0.82)",
              letterSpacing: 0.2,
              textShadow: "0 1px 6px rgba(0, 0, 0, 0.6)",
              whiteSpace: "nowrap",
              overflow: "hidden",
            }}
          >
            {entry.subtitle}
          </div>
        </div>
        <span
          data-nex-marketplace-prototype-card-price-chip
          style={{
            // Owner directive 2026-10-21 · badge now sits as a top-
            // right rectangle with small rounded corners (6px) ·
            // reads as a price tag · not a pill.
            flexShrink: 0,
            padding: "4px 9px",
            background: "rgba(2, 9, 20, 0.78)",
            border: `1px solid ${NEX.cyanSoft}`,
            borderRadius: 6,
            color: NEX.cyan,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 0.5,
            textTransform: "uppercase",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
          }}
        >
          Price TBD
        </span>
      </div>

      {/* ─── Bottom overlay · three round buttons ─── */}
      <div
        data-nex-marketplace-prototype-card-actions
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "48px 14px 18px",
          background:
            "linear-gradient(180deg, transparent 0%, rgba(2, 9, 20, 0.55) 40%, rgba(2, 9, 20, 0.95) 100%)",
          display: "flex",
          justifyContent: "space-around",
          alignItems: "center",
          gap: 8,
        }}
      >
        <RoundButton
          label="Theme"
          glyph={<ChatBubbleIcon />}
          onPress={onPreviewTheme}
          inCart={themeInCart}
          dataKey="theme"
          accent={NEX.cyan}
        />
        <RoundButton
          label="Intro"
          glyph={<PlayIcon />}
          onPress={onPreviewIntro}
          inCart={introInCart}
          dataKey="intro"
          accent="#FF7200"
          disabled={!entry.hasVideoIntro}
          tooltip={entry.hasVideoIntro ? undefined : "Scripted-only intro · no video asset"}
        />
        <RoundButton
          label="Shop"
          glyph={<ShopIcon />}
          onPress={onPreviewShop}
          inCart={shopInCart}
          dataKey="shop"
          accent="#16D66B"
        />
      </div>
    </article>
  );
}

// ─── Round button ────────────────────────────────────────────────

function RoundButton({
  label,
  glyph,
  onPress,
  inCart,
  dataKey,
  accent,
  disabled,
  tooltip,
}: {
  readonly label: string;
  readonly glyph: React.ReactNode;
  readonly onPress: () => void;
  readonly inCart: boolean;
  readonly dataKey: string;
  readonly accent: string;
  readonly disabled?: boolean;
  readonly tooltip?: string;
}): React.JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        flex: 1,
        minWidth: 0,
      }}
    >
      <button
        type="button"
        onClick={onPress}
        disabled={disabled}
        aria-label={`Preview ${label}`}
        title={tooltip}
        data-nex-marketplace-prototype-round-btn={dataKey}
        data-nex-marketplace-prototype-round-btn-in-cart={inCart ? "true" : "false"}
        data-nex-marketplace-prototype-round-btn-disabled={disabled ? "true" : "false"}
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: disabled
            ? "rgba(2, 9, 20, 0.75)"
            : inCart
            ? `${accent}22`
            : "rgba(2, 9, 20, 0.85)",
          color: disabled ? NEX.textMute : accent,
          border: `2px solid ${
            disabled
              ? "rgba(0, 175, 255, 0.14)"
              : inCart
              ? accent
              : `${accent}66`
          }`,
          cursor: disabled ? "not-allowed" : "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          boxShadow: disabled
            ? "none"
            : inCart
            ? `0 0 18px -4px ${accent}, 0 6px 14px -6px rgba(0,0,0,0.6)`
            : `0 6px 16px -6px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04) inset`,
          transition: "background 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        {inCart ? <CheckIcon /> : glyph}
      </button>
      <span
        style={{
          fontSize: 11,
          fontWeight: 800,
          color: disabled ? NEX.textMute : "#FFFFFF",
          letterSpacing: 0.3,
          textShadow: "0 1px 4px rgba(0, 0, 0, 0.75)",
        }}
      >
        {inCart ? "In Cart" : label}
      </span>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────

function ChatBubbleIcon(): React.JSX.Element {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-5 4V6a2 2 0 0 1 2-2z" />
    </svg>
  );
}
function PlayIcon(): React.JSX.Element {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <polygon points="6,4 20,12 6,20" />
    </svg>
  );
}
function ShopIcon(): React.JSX.Element {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M3 7l1-3h16l1 3v2a2 2 0 0 1-4 0 2 2 0 0 1-4 0 2 2 0 0 1-4 0 2 2 0 0 1-4 0A2 2 0 0 1 3 9V7z" />
      <path d="M4 10v10h7v-6h2v6h7V10" />
    </svg>
  );
}
function CheckIcon(): React.JSX.Element {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
