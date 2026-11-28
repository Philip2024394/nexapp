// src/components/nex-native/shop-shared-header.tsx
//
// Owner directive 2026-11-28 (eleventh pass) ·
//   "same header as home page on our story page · also on Why
//    X-Rated Belts · header global".
//
// A compact, theme-neutral header strip that mirrors the identity
// band used on the public shop home page (`/nex-native/<slug>`).
// Lives as a shared component so every shop sub-page (our-story,
// future info pages) can mount the same silhouette without pulling
// in the full Cover theme stack.
//
// What it renders, in order:
//
//   · Back link → the shop home (`/nex-native/<slug>`)
//   · Portrait circle (logo_url or initials)
//   · Logo image · when `headerLogoUrl` is provided, renders in
//     place of the typed display name (same rule as the home page).
//     Otherwise the display name text is shown.
//   · Location line (city/country) under the logo/name.
//
// Styling is intentionally self-contained · inline hex colours ·
// no CSS var dependencies. This lets the component paint correctly
// on sub-pages that are NOT wrapped in CoverThemeSkin (e.g. the
// ivory-backgrounded `/our-story` surface).

import Link from "next/link";
import * as React from "react";

export interface ShopSharedHeaderProps {
  readonly shopSlug: string;
  readonly displayName: string;
  readonly portraitUrl?: string | null;
  readonly headerLogoUrl?: string | null;
  readonly location?: string | null;
  readonly backLabel?: string;
  /** When true, header renders on a LIGHT surface · dark ink text.
   *  When false (default) · header renders on a DARK surface · light text. */
  readonly onLight?: boolean;
}

export function ShopSharedHeader({
  shopSlug,
  displayName,
  portraitUrl,
  headerLogoUrl,
  location,
  backLabel = "Back to shop",
  onLight = false,
}: ShopSharedHeaderProps): React.JSX.Element {
  const ink = onLight ? "#0A1526" : "#F6F3EA";
  const inkDim = onLight ? "#4B5468" : "rgba(246,243,234,0.7)";
  const accent = "#F97316";
  const panel = onLight ? "#FFFFFF" : "#0C1626";
  const rule = onLight ? "rgba(10,21,38,0.12)" : "rgba(255,255,255,0.1)";
  const portraitSize = 58;
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  return (
    <header
      data-nex-shop-shared-header
      data-nex-shop-shared-header-slug={shopSlug}
      style={{
        background: panel,
        borderBottom: `1px solid ${rule}`,
        padding: "14px 18px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        position: "sticky",
        top: 0,
        zIndex: 10,
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Back strip */}
      <Link
        href={`/nex-native/${encodeURIComponent(shopSlug)}`}
        data-nex-shop-shared-header-back
        style={{
          color: accent,
          textDecoration: "none",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          alignSelf: "flex-start",
        }}
      >
        ← {backLabel}
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Portrait circle · logo_url or initials */}
        <div
          aria-hidden
          style={{
            position: "relative",
            width: portraitSize,
            height: portraitSize,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: portraitSize,
              height: portraitSize,
              borderRadius: "50%",
              backgroundImage: portraitUrl ? `url(${portraitUrl})` : undefined,
              background: portraitUrl
                ? undefined
                : "linear-gradient(135deg, rgba(249,115,22,0.3) 0%, rgba(10,21,38,0.9) 100%)",
              backgroundSize: "cover",
              backgroundPosition: "center 30%",
              border: `2px solid ${accent}`,
              display: "grid",
              placeItems: "center",
              color: ink,
              fontWeight: 700,
              fontSize: 22,
            }}
          >
            {!portraitUrl && initials}
          </div>
        </div>

        {/* Identity column · logo image or typed name, then location */}
        <div style={{ minWidth: 0, flex: 1 }}>
          {headerLogoUrl ? (
            <img
              src={headerLogoUrl}
              alt={displayName}
              style={{
                display: "block",
                maxWidth: 180,
                maxHeight: 44,
                width: "auto",
                height: "auto",
                objectFit: "contain",
              }}
            />
          ) : (
            <div
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: ink,
                letterSpacing: "-0.01em",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {displayName}
            </div>
          )}
          {location && (
            <div
              style={{
                marginTop: 4,
                fontSize: 12,
                color: inkDim,
                letterSpacing: "0.02em",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {location}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
