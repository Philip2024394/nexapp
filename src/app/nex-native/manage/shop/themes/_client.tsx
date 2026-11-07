"use client";

// src/app/nex-native/manage/shop/themes/_client.tsx
//
// Shop Themes picker · three-axis layout.
// Owner-authorised 2026-11-06 · dual-axis rework 2026-11-07.
// -----------------------------------------------------------------------------
// Owner directive 2026-11-07 · "i am confused how the user will know
// the difference that they can select shop template and also back
// ground theme image · help". Resolution: two labelled control
// surfaces around one live preview.
//
//   SHOP TEMPLATE          ← labelled · horizontal strip of 11 thumbs
//     [ phone frame ]      ← live preview · updates on every pick
//     ◀ Template N / 11 ▶  ← arrows + counter under the phone
//   BACKGROUND             ← labelled · horizontal strip of bg thumbs
//     [ Activate Shop ]    ← saves template + bg + tint in one click
//
// Backend writes unchanged · applyShopLayoutAction + applyShopTintAction
// + applyShopPresetBackgroundAction. The full ~200-preset library
// stays at /manage/shop/backgrounds via the "See all" link.

import * as React from "react";
import Link from "next/link";
import {
  applyShopLayoutAction,
  applyShopPresetBackgroundAction,
  applyShopTintAction,
} from "./_actions";
import type { CoverLayoutId } from "@/app/nex-native/cover/layout-ids";

const GOLD = "var(--nex-world-secondary, #C6A15B)";
const EMERALD = "var(--nex-world-primary, #123D2B)";
const FOREST = "var(--nex-world-forest, #1B5138)";
const CREAM = "var(--nex-world-cream, #FAF8F4)";
const INK = "#F2F5F8";
const INK_DIM = "#B5C3D6";
const INK_MUTED = "#7D9BC0";
const BORDER = "rgba(198, 161, 91, 0.25)";
const BORDER_HI = "rgba(198, 161, 91, 0.55)";

// ─── Featured background presets ───────────────────────────────────
// Curated set that appears as a horizontal strip beneath the phone
// frame · the full ~200-preset library stays at
// /manage/shop/backgrounds. URLs match PRESET_BACKGROUND_META in
// _actions.ts so applyShopPresetBackgroundAction accepts them.
interface FeaturedBg {
  readonly url: string;
  readonly label: string;
  readonly tintHex: string;
}

const FEATURED_BACKGROUNDS: ReadonlyArray<FeaturedBg> = [
  { url: "/nex-brand/shop-themes/dynamic-nex-shopping-showcase.png", label: "Showcase",           tintHex: "#C6A15B" },
  { url: "/nex-brand/shop-themes/global-cart-glow.png",              label: "Cart glow",          tintHex: "#FF7A2B" },
  { url: "/nex-brand/shop-themes/nex-bag-electric.png",              label: "Electric",           tintHex: "#2A6DD9" },
  { url: "/nex-brand/shop-themes/sale-best-deals.png",               label: "Sale",               tintHex: "#FF6600" },
  { url: "/nex-brand/shop-themes/electronics-showcase.png",          label: "Electronics",        tintHex: "#1E4A8C" },
  { url: "/nex-brand/shop-themes/delivery-globe.png",                label: "Delivery",           tintHex: "#FF7A2B" },
  { url: "/nex-brand/shop-themes/mobile-shop-now.png",               label: "Mobile shop",        tintHex: "#FF6B2B" },
  { url: "/nex-brand/shop-themes/global-cart-glow-green.png",        label: "Cart · green",       tintHex: "#16D66B" },
  { url: "/nex-brand/shop-themes/fashion-beauty-purple.png",         label: "Fashion",            tintHex: "#C62AD9" },
  { url: "/nex-brand/shop-themes/tools-trade-green.png",             label: "Tools",              tintHex: "#16D66B" },
  { url: "/nex-brand/shop-themes/sports-outdoors-orange.png",        label: "Sports",             tintHex: "#FF7A2B" },
  { url: "/nex-brand/shop-themes/food-grocery-red.png",              label: "Food",               tintHex: "#D82A2A" },
  { url: "/nex-brand/shop-themes/travel-luggage-gold.png",           label: "Travel",             tintHex: "#F2B23A" },
  { url: "/nex-brand/shop-themes/phil1.png",                         label: "Soft pink",          tintHex: "#F2B4D4" },
  { url: "/nex-brand/shop-themes/phil6.png",                         label: "Fresh green",        tintHex: "#7CB342" },
  { url: "/nex-brand/shop-themes/phil8.png",                         label: "Deep blue",          tintHex: "#4A6B8C" },
  { url: "/nex-brand/shop-themes/phil11.png",                        label: "Warm brown",         tintHex: "#A0522D" },
  { url: "/nex-brand/shop-themes/phil100.png",                       label: "Vivid orange",       tintHex: "#FF6A1F" },
  { url: "/nex-brand/shop-themes/phil119.png",                       label: "Royal blue",         tintHex: "#2A6DD9" },
  { url: "/nex-brand/shop-themes/watches.png",                       label: "Watches",            tintHex: "#D9B86A" },
  { url: "/nex-brand/shop-themes/vitamins.png",                      label: "Vitamins",           tintHex: "#FF8A1F" },
  { url: "/nex-brand/shop-themes/theme1.png",                        label: "Violet",             tintHex: "#8B5FC9" },
  { url: "/nex-brand/shop-themes/tt3.png",                           label: "Night blue",         tintHex: "#1F3A6B" },
  { url: "/nex-brand/shop-themes/bb1.png",                           label: "Travel orange",      tintHex: "#FF7A2B" },
];

interface Props {
  readonly businessId: string | null;
  readonly businessName: string | null;
  readonly currentLayoutId: CoverLayoutId;
  readonly currentTintHex: string | null;
  readonly currentImageUrl: string | null;
  readonly layoutIds: readonly CoverLayoutId[];
  readonly layoutLabels: Readonly<Record<CoverLayoutId, string>>;
}

export function ShopThemesClient({
  businessId,
  businessName,
  currentLayoutId,
  currentTintHex,
  currentImageUrl,
  layoutIds,
  layoutLabels,
}: Props): React.JSX.Element {
  const [selectedLayout, setSelectedLayout] =
    React.useState<CoverLayoutId>(currentLayoutId);
  const [imageUrl, setImageUrl] = React.useState<string | null>(currentImageUrl);
  const [tintHex, setTintHex] = React.useState<string>(
    currentTintHex ?? "#123D2B",
  );
  const [status, setStatus] = React.useState<
    | { kind: "idle" }
    | { kind: "applying" }
    | { kind: "ok"; message: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });
  const [pending, startTransition] = React.useTransition();

  // No business row yet → soft empty state.
  if (!businessId) {
    return <EmptyShopState />;
  }

  const layoutIndex = Math.max(
    0,
    layoutIds.findIndex((id) => id === selectedLayout),
  );
  const totalLayouts = layoutIds.length;
  const prevLayout = () =>
    setSelectedLayout(layoutIds[layoutIndex === 0 ? totalLayouts - 1 : layoutIndex - 1]!);
  const nextLayout = () =>
    setSelectedLayout(layoutIds[layoutIndex === totalLayouts - 1 ? 0 : layoutIndex + 1]!);

  // Keyboard arrow navigation (page-level).
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prevLayout();
      else if (e.key === "ArrowRight") nextLayout();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [layoutIndex, layoutIds]); // eslint-disable-line react-hooks/exhaustive-deps

  function pickBackground(bg: FeaturedBg) {
    setImageUrl(bg.url);
    setTintHex(bg.tintHex);
  }

  function onApplyAll() {
    if (!businessId) return;
    setStatus({ kind: "applying" });
    startTransition(async () => {
      const results = await Promise.all([
        applyShopLayoutAction(businessId, selectedLayout),
        applyShopTintAction(businessId, tintHex),
        imageUrl
          ? applyShopPresetBackgroundAction(businessId, imageUrl)
          : Promise.resolve({ ok: true } as const),
      ]);
      const bad = results.find((r) => !r.ok);
      if (bad && "error" in bad) {
        setStatus({ kind: "error", message: bad.error });
        return;
      }
      setStatus({
        kind: "ok",
        message: "Applied · your shop renders with the new theme.",
      });
    });
  }

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        minHeight: 0,
        overflow: "auto",
      }}
    >
      {/* ── Header ───────────────────────────────────────────── */}
      <header
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          paddingBottom: 6,
          borderBottom: `1px solid ${BORDER}`,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 900,
            color: GOLD,
            letterSpacing: "-0.01em",
          }}
        >
          Shop Themes
        </h1>
        <p style={{ margin: 0, fontSize: 11, color: INK_DIM, lineHeight: 1.4 }}>
          Pick a template for structure · pick a background for style.
          Preview updates live inside the phone.
        </p>
      </header>

      {/* Owner directive 2026-11-07 · the "Shop template" horizontal
          thumb strip was removed. Template navigation is via the
          arrow pills under the phone frame + the keyboard ← → keys ·
          the live preview IS the main surface. */}

      {/* ── PHONE FRAME LIVE PREVIEW ─────────────────────────────
          Owner directive 2026-11-07 · "make the window for view shop
          template longer and like phone shape". Container stays
          phone-shaped (9:19.5 sealed ratio) · width is capped to
          keep the frame narrow + tall · minHeight lifts the preview
          so short templates still render the full phone silhouette
          on short viewports. */}
      <section
        aria-label="Live preview"
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 300,
          aspectRatio: "9 / 19.5",
          minHeight: 500,
          margin: "0 auto",
          borderRadius: 32,
          background: "transparent",
          border: `1px solid ${BORDER_HI}`,
          overflow: "hidden",
          boxShadow: "0 20px 48px rgba(0,0,0,0.55)",
          boxSizing: "border-box",
        }}
      >
        <iframe
          key={`${selectedLayout}:${imageUrl ?? "none"}:${tintHex}`}
          src={`/nex-native/cover/preview/${selectedLayout}?embed=1${
            imageUrl ? `&bg=${encodeURIComponent(imageUrl)}` : ""
          }${
            /^#[0-9A-Fa-f]{6}$/.test(tintHex)
              ? `&tint=${encodeURIComponent(tintHex)}`
              : ""
          }`}
          title={`${layoutLabels[selectedLayout]} template preview`}
          loading="lazy"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            border: "none",
            background: "transparent",
          }}
        />
      </section>

      {/* ── Prev / count / next row under the phone ──────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
        }}
      >
        <ArrowPill direction="left" onClick={prevLayout} />
        <span
          data-nex-template-counter
          style={{
            fontSize: 12,
            fontWeight: 900,
            color: CREAM,
            letterSpacing: "0.04em",
            fontVariantNumeric: "tabular-nums",
            minWidth: 150,
            textAlign: "center",
          }}
        >
          Template {layoutIndex + 1} of {totalLayouts}
          <span
            style={{
              display: "block",
              fontSize: 10,
              fontWeight: 700,
              color: GOLD,
              marginTop: 2,
              letterSpacing: "0.02em",
            }}
          >
            {layoutLabels[selectedLayout]}
          </span>
        </span>
        <ArrowPill direction="right" onClick={nextLayout} />
      </div>

      {/* ── SECTION 3 · BACKGROUND ───────────────────────────── */}
      <section aria-label="Background" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <SectionLabel>Background</SectionLabel>
          <Link
            href="/nex-native/manage/shop/backgrounds"
            data-nex-bg-see-all
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: GOLD,
              textDecoration: "underline",
              letterSpacing: "0.04em",
            }}
          >
            See all →
          </Link>
        </div>
        <div
          data-nex-bg-strip
          style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
            paddingBottom: 6,
            paddingInline: 2,
            scrollSnapType: "x proximity",
          }}
        >
          {FEATURED_BACKGROUNDS.map((bg) => {
            const picked = bg.url === imageUrl;
            return (
              <button
                key={bg.url}
                type="button"
                onClick={() => pickBackground(bg)}
                data-nex-bg-thumb={bg.url}
                aria-pressed={picked}
                aria-label={bg.label}
                title={bg.label}
                style={{
                  position: "relative",
                  // Owner directive 2026-11-07 · "the back ground
                  // themes also phone shape and fit the image to
                  // shape height and width". Phone silhouette
                  // (9:19.5) · wider borderRadius matches the live-
                  // preview frame above · object-fit cover fills
                  // the full shape.
                  width: 62,
                  minWidth: 62,
                  aspectRatio: "9 / 19.5",
                  padding: 0,
                  background: "transparent",
                  border: `2px solid ${picked ? GOLD : BORDER}`,
                  borderRadius: 14,
                  overflow: "hidden",
                  cursor: "pointer",
                  scrollSnapAlign: "start",
                  flexShrink: 0,
                  boxShadow: picked
                    ? "0 0 0 3px rgba(198,161,91,0.22)"
                    : "none",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={bg.url}
                  alt={bg.label}
                  loading="lazy"
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
                {picked ? (
                  <span
                    aria-hidden
                    style={{
                      position: "absolute",
                      top: 4,
                      right: 4,
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: GOLD,
                      color: "#1A120A",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 11,
                      fontWeight: 900,
                      boxShadow: "0 2px 6px rgba(0,0,0,0.45)",
                    }}
                  >
                    ✓
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Activate Shop CTA ─────────────────────────────────── */}
      <section
        aria-label="Activate shop"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
          paddingTop: 2,
        }}
      >
        <button
          type="button"
          onClick={onApplyAll}
          disabled={pending || status.kind === "applying"}
          data-nex-shop-activate
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "12px 28px",
            fontSize: 13,
            fontWeight: 900,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#1A120A",
            background: GOLD,
            border: "none",
            borderRadius: 999,
            fontFamily: "inherit",
            cursor: pending || status.kind === "applying" ? "wait" : "pointer",
            boxShadow: "0 12px 26px rgba(198,161,91,0.25)",
          }}
        >
          {status.kind === "applying"
            ? "Activating…"
            : status.kind === "ok"
              ? "Shop active ✓"
              : status.kind === "error"
                ? "Retry"
                : "Activate Shop"}
        </button>
        {status.kind === "error" ? (
          <span style={{ fontSize: 11, color: "#FF6B6B" }}>
            {status.message}
          </span>
        ) : null}
        {status.kind === "ok" ? (
          <span style={{ fontSize: 11, color: INK_DIM }}>
            {status.message}
          </span>
        ) : null}
      </section>

      {businessName ? (
        <span
          style={{
            display: "block",
            textAlign: "center",
            fontSize: 10,
            color: INK_MUTED,
            paddingBottom: 4,
          }}
        >
          Saved on nex_business · editable from /manage/shop any time.
        </span>
      ) : null}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 900,
        color: GOLD,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </div>
  );
}

function ArrowPill({
  direction,
  onClick,
}: {
  direction: "left" | "right";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === "left" ? "Previous template" : "Next template"}
      style={{
        width: 44,
        height: 44,
        borderRadius: 999,
        background: "rgba(5, 15, 28, 0.9)",
        border: `1.5px solid ${BORDER_HI}`,
        color: GOLD,
        display: "grid",
        placeItems: "center",
        cursor: "pointer",
        fontSize: 20,
        fontWeight: 900,
        lineHeight: 1,
        fontFamily: "inherit",
        padding: 0,
      }}
    >
      {direction === "left" ? "◀" : "▶"}
    </button>
  );
}

function EmptyShopState(): React.JSX.Element {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: 24,
        textAlign: "center",
        color: INK,
      }}
    >
      <div style={{ fontSize: 40, lineHeight: 1 }} aria-hidden>
        🏪
      </div>
      <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
        Create your shop first
      </h1>
      <p style={{ margin: 0, fontSize: 13, color: INK_DIM, maxWidth: 320 }}>
        Shop themes let you customise the cover of your public shop page.
        Head to Manage · Shop to provision your business before picking a
        theme.
      </p>
      <a
        href="/nex-native/manage/shop"
        style={{
          padding: "10px 16px",
          background: `linear-gradient(135deg, ${EMERALD}, ${FOREST})`,
          color: CREAM,
          border: `1px solid ${GOLD}`,
          borderRadius: 10,
          fontSize: 13,
          fontWeight: 800,
          textDecoration: "none",
          letterSpacing: "0.04em",
        }}
      >
        Go to Manage Shop
      </a>
    </div>
  );
}
