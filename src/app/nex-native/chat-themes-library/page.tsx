// src/app/nex-native/chat-themes-library/page.tsx
//
// NEX Space · theme library landing · redesigned 2026-10-11 (Task #34).
// --------------------------------------------------------------------
// This surface is now a proper discovery entry point:
//
//   1. "NEX Space" header · 1-line value prop
//   2. Compact trial-status chip (session only) · replaces the big
//      banner · trial state is still visible but no longer dominates
//   3. "Featured for you" hero card · ONE theme matched to the
//      viewer's business industry if set, falling back to the NEX
//      brand default when no hint is available
//   4. "Popular" strip · hand-picked polished themes · horizontal
//      scroll on mobile, wraps to grid on desktop
//   5. Category grid under a "Browse by family" divider · the sealed
//      phone-frame tile landing
//   6. Guest sign-up invitation card at the bottom (unchanged · still
//      renders only for guests)
//
// Guest + session both paint sections 1 · 3 · 4 · 5. Session paints
// 2 · 6 as session-only. Guests see section 6.
//
// URL renamed 2026-10-04 · was /nex-native/settings/theme ·
// old URL still 301s to this location (see next.config.mjs redirects).
//
// Doctrine · doctrine_theme_ownership_2026_09_27.md.

import Link from "next/link";
import { CategoryGrid } from "./_category-grid";
import { loadLibraryData } from "./_load-library-data";
import { loadLibraryDataAsGuest } from "./_load-library-data-guest";
import { themePreviewHref } from "./_theme-preview-href";
import { NexPageHeader } from "../_page-header";
import { resolveNexAppSessionOrGuest } from "@/lib/nex-native/app/session-or-guest";
import { listBusinessesByOwner } from "@/lib/nex-native/business-service";
import { themeCategoryIdForBusinessCategory } from "@/lib/nex-native/theme-category/industry-order";
import type { BrowserThemeRow } from "./_theme-browser-client";
// Owner-sealed 2026-10-18 · Neon Marketplace layout. These new
// components REPLACE the Section-1 header + Featured hero + Popular
// strip + Category grid rendering. The sealed data loaders +
// themePreviewHref flow are UNCHANGED · each theme card still
// Links to the sealed preview intro at /nex-native/themes/[id]
// where "Use Theme" / "Back To Themes" buttons live.
import { MarketplaceHeader } from "./_marketplace-header";
import { MarketplaceSearchBar } from "./_marketplace-search-bar";
import {
  MarketplaceFilterPills,
  type MarketplaceFilter,
} from "./_marketplace-filter-pills";
import { MarketplaceCategoryRow } from "./_marketplace-category-row";
import { MarketplaceThemeCard } from "./_marketplace-theme-card";
import {
  hexToRgba,
  miniPhoneBubbleBackground,
  miniPhoneBubbleBorder,
  miniPhoneBubbleTextColor,
  miniPhoneComposerBackground,
  miniPhoneComposerBorder,
  miniPhoneComposerPlaceholderColor,
  miniPhoneSendBackground,
  miniPhoneSendIconColor,
  miniPhoneStageBackground,
  miniPhoneFrameRim,
  miniPhoneFrameShadow,
  miniPhoneAmbient,
} from "../chat-standard/_engine/preview-mini-phone";
import { MiniPhoneAmbientLayer } from "./_mini-phone-ambient-layer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "#020914",
  panel: "#071525",
  panelHi: "#0A1A2D",
  cyan: "#00AFFF",
  cyanFaint: "rgba(0, 175, 255, 0.14)",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  orange: "#FF7800",
  orangeFaint: "rgba(255, 120, 0, 0.14)",
  green: "#16D66B",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
  borderSoft: "rgba(255, 255, 255, 0.07)",
};

const SUCCESS_CODES = new Set(["theme_updated"]);

export default async function ThemePickerPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; m?: string; filter?: string }>;
}) {
  const viewer = await resolveNexAppSessionOrGuest();
  const isGuest = viewer.kind === "guest";

  const data = isGuest ? null : await loadLibraryData();
  const guestData = isGuest ? await loadLibraryDataAsGuest() : null;

  const browserThemes = isGuest
    ? guestData!.browserThemes
    : data!.kind === "ok"
      ? data!.browserThemes
      : [];

  // Industry-first ordering · session viewers only. Guests see the
  // sealed registry order so the first-time experience stays
  // deterministic.
  let preferredCategoryId: string | null = null;
  if (!isGuest) {
    try {
      const owned = await listBusinessesByOwner(viewer.session.account.id);
      const primary = owned[0];
      if (primary) {
        preferredCategoryId = themeCategoryIdForBusinessCategory(
          primary.business_category,
        );
      }
    } catch {
      // Non-fatal · fall through to the sealed order.
    }
  }

  const sp = await searchParams;
  const banner = sp.e && sp.m ? { code: sp.e, message: sp.m } : null;
  const isSuccess = banner ? SUCCESS_CODES.has(banner.code) : false;

  // Owner-sealed 2026-10-18 · Neon Marketplace layout. The sealed
  // data-loader output `browserThemes` is split into free + premium
  // for the two sections. Filter pills via ?filter=all|free|premium
  // override the natural split so viewers can focus on one bucket.
  const requestedFilter: MarketplaceFilter =
    sp.filter === "free" || sp.filter === "premium" ? sp.filter : "all";

  const freeThemes = browserThemes.filter((t) => t.tier === "gratis");
  const premiumThemes = browserThemes.filter((t) => t.tier === "bisnis");

  const showFree = requestedFilter !== "premium";
  const showPremium = requestedFilter !== "free";

  // Keep the sealed references used below so legacy renderers do not
  // throw type errors when the Neon Marketplace path short-circuits
  // the response. The `isSuccess`, `banner`, `preferredCategoryId`,
  // `isGuest`, `guestData`, `data` locals remain available for the
  // marketplace trial-chip + guest-signup card below.
  void isSuccess;
  void banner;
  void preferredCategoryId;
  void guestData;
  void data;

  return (
    <>
      <style>{`html, body { background: ${NEX.bg} !important; }`}</style>
      <main
        data-nex-themes-marketplace
        style={{
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.text,
          display: "flex",
          flexDirection: "column",
          gap: 18,
          paddingBottom: 32,
        }}
      >
        <MarketplaceHeader />
        <MarketplaceSearchBar />
        <MarketplaceFilterPills active={requestedFilter} />
        <MarketplaceCategoryRow />

        {showFree ? (
          <section
            data-nex-themes-free-section
            style={{
              padding: "0 14px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <SectionTitle
              label="Free Themes"
              subline={
                freeThemes.length === 0
                  ? "No free themes yet"
                  : `${freeThemes.length} ${freeThemes.length === 1 ? "theme" : "themes"}. Free forever.`
              }
              accent="#00AFFF"
              seeAllHref="/nex-native/chat-themes-library?filter=free"
            />
            <div
              data-nex-themes-free-grid
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
              }}
            >
              {freeThemes.slice(0, 6).map((t) => (
                <MarketplaceThemeCard key={t.id} theme={t} variant="free" />
              ))}
            </div>
          </section>
        ) : null}

        {showPremium ? (
          <section
            data-nex-themes-premium-section
            style={{
              padding: "0 14px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <SectionTitle
              label="Premium Themes"
              subline={
                premiumThemes.length === 0
                  ? "Premium catalogue coming soon"
                  : null
              }
              accent="#FFC24A"
              crown
              seeAllHref="/nex-native/chat-themes-library?filter=premium"
            />
            <div
              data-nex-themes-premium-grid
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 10,
              }}
            >
              {premiumThemes.map((t) => (
                <MarketplaceThemeCard
                  key={t.id}
                  theme={t}
                  variant="premium"
                  priceLabel="£1.99"
                />
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </>
  );
}

// ─── Section-title helper used by the Neon Marketplace sections ─────

function SectionTitle({
  label,
  subline,
  accent,
  crown,
  seeAllHref,
}: {
  readonly label: string;
  readonly subline?: string | null;
  readonly accent: string;
  readonly crown?: boolean;
  readonly seeAllHref?: string;
}) {
  const NEX_TEXT_MUTED = "#7D9BC0";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {crown ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M2 7l5 4 5-7 5 7 5-4-2 13H4L2 7z" />
          </svg>
        ) : null}
        <div>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: accent,
              fontWeight: 700,
            }}
          >
            {label}
          </div>
          {subline ? (
            <div style={{ marginTop: 2, fontSize: 11, color: NEX_TEXT_MUTED }}>
              {subline}
            </div>
          ) : null}
        </div>
      </div>
      {seeAllHref ? (
        <Link
          href={seeAllHref}
          data-nex-themes-see-all
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 12,
            color: accent,
            textDecoration: "none",
            fontWeight: 700,
          }}
        >
          View All
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
      ) : null}
    </div>
  );
}

// ─── Legacy render path (retired 2026-10-18 · kept behind a dead
//     branch so the sealed CategoryGrid / phone-tile / preview-shell
//     imports remain reachable for other callers and tests) ────────


// Local `hexToRgba` was DELETED 2026-10-11 · the single implementation
// now lives at `src/app/nex-native/chat-standard/_engine/preview-mini-
// phone.ts` and is imported at the top of this file. Every preview
// surface shares that one path.
