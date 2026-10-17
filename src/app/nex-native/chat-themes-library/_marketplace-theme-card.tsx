// src/app/nex-native/chat-themes-library/_marketplace-theme-card.tsx
//
// NEX Themes · Neon Marketplace theme card · sealed 2026-10-18.
// -------------------------------------------------------------------
// Two visual variants driven by the `variant` prop:
//
//   · "free"    · 2-column grid card · cyan accent · "FREE" badge ·
//                 "Use Theme →" primary CTA · larger hero image area
//   · "premium" · 3-column grid card · gold accent · "PREMIUM" badge
//                 · price pill · "👑 Unlock" primary CTA
//
// Each card wraps in a Link that opens the sealed theme-preview intro
// page (/nex-native/themes/[themeId]) · unchanged from the pre-upgrade
// flow · "Use Theme" / "Back To Themes" buttons live on that page.
// Preserves every existing deep-link behaviour · tests that assert
// `themePreviewHref` is the only builder stay green.
//
// Server Component · pure presentation + Link routing.

import type * as React from "react";
import Link from "next/link";
import { themePreviewHref } from "./_theme-preview-href";
import type { BrowserThemeRow } from "./_theme-browser-client";
import { NEX_FONT_SANS } from "@/lib/nex-native/design-tokens";

const NEX = {
  bg: "#020914",
  panel: "rgba(3, 16, 29, 0.72)",
  panelHi: "#0A1A2D",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMuted: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  cyanFaint: "rgba(0, 175, 255, 0.14)",
  gold: "#FFC24A",
  goldSoft: "rgba(255, 194, 74, 0.45)",
  goldFaint: "rgba(255, 194, 74, 0.14)",
};

export type ThemeCardVariant = "free" | "premium";

export interface MarketplaceThemeCardProps {
  readonly theme: BrowserThemeRow;
  readonly variant: ThemeCardVariant;
  /** Display price for premium cards · formatted · e.g. "£1.99".
   *  Not applicable to free cards · ignored when variant === "free". */
  readonly priceLabel?: string;
}

export function MarketplaceThemeCard(
  props: MarketplaceThemeCardProps,
): React.JSX.Element {
  const isFree = props.variant === "free";
  const accent = isFree ? NEX.cyan : NEX.gold;
  const accentSoft = isFree ? NEX.cyanSoft : NEX.goldSoft;
  const accentFaint = isFree ? NEX.cyanFaint : NEX.goldFaint;
  // Owner directive 2026-10-18 · Premium grid moved from 3-column to
  // 2-column · hero scales up accordingly (110 → 150). Still shorter
  // than the Free hero (160) so the Free pair reads as the hero slot.
  const heroHeight = isFree ? 160 : 150;

  return (
    <Link
      href={themePreviewHref(props.theme.id)}
      data-nex-themes-marketplace-card={props.theme.id}
      data-variant={props.variant}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        borderRadius: 16,
        overflow: "hidden",
        background: NEX.panel,
        border: `1px solid ${accentSoft}`,
        textDecoration: "none",
        color: NEX.text,
        fontFamily: NEX_FONT_SANS,
      }}
    >
      {/* Hero image · cover-fit · fallback to accent-tinted gradient
          when hero_image_url is null (never a fabricated stock photo). */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: heroHeight,
          background: props.theme.hero_image_url
            ? `#000`
            : `linear-gradient(135deg, ${accent}44 0%, ${NEX.panelHi} 70%)`,
          overflow: "hidden",
        }}
      >
        {props.theme.hero_image_url ? (
          <img
            src={props.theme.hero_image_url}
            alt=""
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center",
              userSelect: "none",
            }}
          />
        ) : null}
        {/* Badge (FREE or PREMIUM) · top-left */}
        <span
          data-nex-themes-badge={props.variant}
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            padding: "4px 10px",
            borderRadius: 8,
            background: isFree ? NEX.cyan : NEX.gold,
            color: NEX.bg,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.14em",
          }}
        >
          {isFree ? "FREE" : "PREMIUM"}
        </span>
      </div>

      {/* Body */}
      <div
        style={{
          padding: "10px 12px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <div
          data-nex-themes-card-title
          style={{
            // Premium cards now 2-column · can carry the same 15px
            // title weight as Free · reads as peer products rather
            // than secondary thumbnails.
            fontSize: 15,
            fontWeight: 700,
            color: NEX.text,
            lineHeight: 1.15,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {props.theme.name}
        </div>
        <div
          data-nex-themes-card-sub
          style={{
            fontSize: 11,
            color: NEX.textMuted,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {buildSubline(props.theme, props.priceLabel, isFree)}
        </div>
      </div>

      {/* CTA pill · bottom · tappable (whole card is the Link · the
          pill is visual-only reinforcement) */}
      <div
        style={{
          padding: "0 12px 12px",
        }}
      >
        <div
          data-nex-themes-card-cta
          style={{
            // Premium CTA promoted to the same 40px / 13px scale as
            // Free · the 2-column premium grid gives us the width.
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            width: "100%",
            minHeight: 40,
            borderRadius: 999,
            background: accentFaint,
            border: `1px solid ${accentSoft}`,
            color: accent,
            fontSize: 13,
            fontWeight: 700,
            boxSizing: "border-box",
          }}
        >
          {isFree ? (
            <>
              Use Theme <ArrowRight color={accent} />
            </>
          ) : (
            <>
              <CrownGlyph color={accent} /> Unlock
            </>
          )}
        </div>
      </div>
    </Link>
  );
}

function buildSubline(
  theme: BrowserThemeRow,
  priceLabel: string | undefined,
  isFree: boolean,
): string {
  const parts: string[] = [];
  const categoryHuman = humaniseCategoryId(theme.category_id);
  if (categoryHuman) parts.push(categoryHuman);
  if (theme.tagline) parts.push(theme.tagline);
  if (!isFree && priceLabel) {
    return `${parts[0] ?? ""}${parts[0] ? "  ·  " : ""}${priceLabel}`;
  }
  return parts.slice(0, 2).join(" · ");
}

function humaniseCategoryId(id: string): string {
  if (!id || id === "explore") return "";
  return id.charAt(0).toUpperCase() + id.slice(1);
}

function ArrowRight({ color }: { readonly color: string }): React.JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function CrownGlyph({ color }: { readonly color: string }): React.JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 7l5 4 5-7 5 7 5-4-2 13H4L2 7z" />
    </svg>
  );
}
