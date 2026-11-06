"use client";

// src/app/nex-native/manage/shop/backgrounds/_client.tsx
//
// NEX Shop Backgrounds library · interactive grid.
// Owner-authorised 2026-11-06.
// -----------------------------------------------------------------------------
// Mirrors the /chat-themes-library visual language (emerald + gold
// palette · phone-framed · hero header + grid of preset tiles + inline
// apply). Each tile shows a 4:5 portrait background with a category
// chip + tint-swatch pill + name label.
//
// Interactions:
//   · Category dropdown · filters the grid to one category · "All
//     categories" shows every preset.
//   · Tap a tile · calls applyShopPresetBackgroundAction (sealed
//     server · writes nex_business.shop_cover_image_url AND applies
//     the preset's paired tint hex so the theme colour matches).
//   · After apply · redirects to /manage/shop/themes so the owner
//     sees the new background + tint painted on every template.
//
// Owner directive 2026-11-06 · the theme color is set to suit the
// background image · the pairing lives on the server (actions.ts
// PRESET_BACKGROUND_META) so clients can't drift.

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { applyShopPresetBackgroundAction } from "../themes/_actions";

const EMERALD = "var(--nex-world-primary, #123D2B)";
const GOLD = "var(--nex-world-secondary, #C6A15B)";
const CREAM = "#FAF8F4";
const INK = "#F2F5F8";
const INK_DIM = "#B5C3D6";
const INK_MUTED = "#7D9BC0";
const SURFACE = "rgba(5, 15, 28, 0.72)";
const SURFACE_HI = "rgba(5, 15, 28, 0.92)";
const BORDER = "rgba(198, 161, 91, 0.25)";
const BORDER_HI = "rgba(198, 161, 91, 0.55)";

// ─── Catalogue ──────────────────────────────────────────────────────────
// Each preset carries:
//   · id         · stable key
//   · url        · must match a server-side whitelist entry in
//                  PRESET_BACKGROUND_META (actions.ts) · the server
//                  rejects unknown URLs.
//   · label      · owner-facing name
//   · category   · one of CATEGORIES.id · filters the grid
//   · tintSwatch · hex string for the small circular swatch chip ·
//                  mirrors the server-side tint that gets applied.

interface ShopBackgroundCategory {
  readonly id: string;
  readonly label: string;
  readonly emoji: string;
}

const CATEGORIES: ReadonlyArray<ShopBackgroundCategory> = [
  { id: "all", label: "All categories", emoji: "🖼️" },
  { id: "retail", label: "Retail & general shop", emoji: "🛍" },
  { id: "online", label: "Online & mobile shop", emoji: "📱" },
  { id: "electronics", label: "Electronics & tech", emoji: "🎧" },
  { id: "sale", label: "Sale & promotions", emoji: "🏷" },
  { id: "delivery", label: "Delivery & logistics", emoji: "🚚" },
  { id: "showcase", label: "Showcase & lifestyle", emoji: "✨" },
];

interface ShopBackgroundPreset {
  readonly id: string;
  readonly url: string;
  readonly label: string;
  readonly category: ShopBackgroundCategory["id"];
  readonly tintSwatch: string;
}

const PRESETS: ReadonlyArray<ShopBackgroundPreset> = [
  {
    id: "dynamic-nex-shopping-showcase",
    url: "/nex-brand/shop-themes/dynamic-nex-shopping-showcase.png",
    label: "NEX Shopping Showcase",
    category: "showcase",
    tintSwatch: "#C6A15B",
  },
  {
    id: "global-cart-glow",
    url: "/nex-brand/shop-themes/global-cart-glow.png",
    label: "Global Cart · Orange Glow",
    category: "retail",
    tintSwatch: "#FF7A2B",
  },
  {
    id: "nex-bag-electric",
    url: "/nex-brand/shop-themes/nex-bag-electric.png",
    label: "NEX Bag · Electric",
    category: "retail",
    tintSwatch: "#2A6DD9",
  },
  {
    id: "sale-best-deals",
    url: "/nex-brand/shop-themes/sale-best-deals.png",
    label: "Sale · Best Deals",
    category: "sale",
    tintSwatch: "#FF6600",
  },
  {
    id: "electronics-showcase",
    url: "/nex-brand/shop-themes/electronics-showcase.png",
    label: "Electronics Showcase",
    category: "electronics",
    tintSwatch: "#1E4A8C",
  },
  {
    id: "delivery-globe",
    url: "/nex-brand/shop-themes/delivery-globe.png",
    label: "Delivery · Global Reach",
    category: "delivery",
    tintSwatch: "#FF7A2B",
  },
  {
    id: "mobile-shop-now",
    url: "/nex-brand/shop-themes/mobile-shop-now.png",
    label: "Mobile · Shop Now",
    category: "online",
    tintSwatch: "#FF6B2B",
  },
];

interface Props {
  readonly businessId: string | null;
  readonly currentImageUrl: string | null;
}

export function ShopBackgroundsClient({
  businessId,
  currentImageUrl,
}: Props): React.JSX.Element {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [selectedCategory, setSelectedCategory] =
    React.useState<ShopBackgroundCategory["id"]>("all");
  const [status, setStatus] = React.useState<
    | { kind: "idle" }
    | { kind: "applying"; id: string }
    | { kind: "ok"; id: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const visible = React.useMemo(
    () =>
      selectedCategory === "all"
        ? PRESETS
        : PRESETS.filter((p) => p.category === selectedCategory),
    [selectedCategory],
  );

  function onPick(preset: ShopBackgroundPreset) {
    if (!businessId) return;
    setStatus({ kind: "applying", id: preset.id });
    startTransition(async () => {
      const result = await applyShopPresetBackgroundAction(
        businessId,
        preset.url,
      );
      if (result.ok) {
        setStatus({ kind: "ok", id: preset.id });
        setTimeout(() => {
          router.push("/nex-native/manage/shop/themes");
        }, 650);
      } else {
        setStatus({ kind: "error", message: result.error });
      }
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
      {/* Back · header */}
      <nav style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Link
          href="/nex-native/manage/shop/themes"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 8px",
            fontSize: 11,
            fontWeight: 700,
            color: GOLD,
            textDecoration: "none",
            border: `1px solid ${BORDER}`,
            borderRadius: 6,
          }}
        >
          ← Shop Themes
        </Link>
      </nav>
      <header
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          paddingBottom: 8,
          borderBottom: `1px solid ${BORDER}`,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 900,
            color: GOLD,
            letterSpacing: "-0.01em",
          }}
        >
          Shop Backgrounds
        </h1>
        <p style={{ margin: 0, fontSize: 12, color: INK_DIM, lineHeight: 1.45 }}>
          Choose a background · tap once to apply · theme colour matches
          the image automatically.
        </p>
      </header>

      {/* Category dropdown · world-standard native select on mobile,
          styled consistent with the gold rim so it reads as part of
          the surface. All presets are scanned/assigned a category on
          upload (future uploads will auto-classify · for now the
          catalogue above carries explicit categories). */}
      <section aria-label="Filter by category">
        <label
          htmlFor="nex-shop-bg-category"
          style={{
            display: "block",
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: GOLD,
            marginBottom: 6,
          }}
        >
          Category
        </label>
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
          }}
        >
          <select
            id="nex-shop-bg-category"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.currentTarget.value)}
            data-nex-shop-bg-category-select
            style={{
              appearance: "none",
              WebkitAppearance: "none",
              MozAppearance: "none",
              width: "100%",
              padding: "10px 36px 10px 14px",
              background: SURFACE_HI,
              color: INK,
              border: `1px solid ${BORDER_HI}`,
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            {CATEGORIES.map((c) => {
              const count =
                c.id === "all"
                  ? PRESETS.length
                  : PRESETS.filter((p) => p.category === c.id).length;
              return (
                <option key={c.id} value={c.id}>
                  {c.emoji}  {c.label} · {count}
                </option>
              );
            })}
          </select>
          <span
            aria-hidden
            style={{
              position: "absolute",
              right: 14,
              pointerEvents: "none",
              color: GOLD,
              fontSize: 10,
              fontWeight: 900,
            }}
          >
            ▼
          </span>
        </div>
      </section>

      {/* Grid · 2 tiles per row · mirrors the chat-themes-library
          marketplace grid shape (owner directive 2026-11-06 ·
          "Shop Backgrounds same page ui design 2 each row like
          chat themes ui page design"). */}
      <section
        aria-label="Shop background presets"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 10,
        }}
      >
        {visible.map((preset) => {
          const isCurrent = currentImageUrl === preset.url;
          const isApplying =
            status.kind === "applying" && status.id === preset.id;
          const isApplied = status.kind === "ok" && status.id === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onPick(preset)}
              disabled={pending || !businessId}
              data-nex-shop-bg-preset-tile={preset.id}
              aria-current={isCurrent ? "true" : undefined}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 0,
                padding: 0,
                background: SURFACE,
                border: `2px solid ${
                  isCurrent || isApplied ? GOLD : BORDER
                }`,
                borderRadius: 14,
                cursor: businessId ? "pointer" : "not-allowed",
                color: INK,
                textAlign: "left",
                overflow: "hidden",
                boxShadow:
                  isCurrent || isApplied
                    ? "0 0 0 3px rgba(198, 161, 91, 0.18)"
                    : "none",
                transition:
                  "border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease",
              }}
            >
              <div
                aria-hidden
                style={{
                  position: "relative",
                  width: "100%",
                  aspectRatio: "4 / 5",
                  background: `url(${preset.url}) center/cover`,
                }}
              >
                {/* Tint swatch · small circle top-left showing the
                    matching theme colour that gets applied along
                    with the background. */}
                <span
                  aria-hidden
                  title={`Applies tint ${preset.tintSwatch}`}
                  style={{
                    position: "absolute",
                    top: 8,
                    left: 8,
                    width: 18,
                    height: 18,
                    borderRadius: 999,
                    background: preset.tintSwatch,
                    border: "2px solid rgba(255,255,255,0.85)",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.45)",
                  }}
                />
                {isCurrent ? (
                  <span style={pillStyle}>Current</span>
                ) : isApplied ? (
                  <span style={{ ...pillStyle, background: EMERALD }}>
                    Applied
                  </span>
                ) : isApplying ? (
                  <span style={{ ...pillStyle, background: EMERALD }}>
                    Applying…
                  </span>
                ) : null}
              </div>
              <div
                style={{
                  padding: "8px 10px 10px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 800 }}>
                  {preset.label}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: INK_DIM,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                  }}
                >
                  {CATEGORIES.find((c) => c.id === preset.category)?.label ??
                    preset.category}
                </div>
              </div>
            </button>
          );
        })}

        {visible.length === 0 ? (
          <div
            style={{
              gridColumn: "1 / -1",
              padding: 14,
              fontSize: 12,
              color: INK_MUTED,
              background: SURFACE,
              border: `1px dashed ${BORDER}`,
              borderRadius: 10,
              textAlign: "center",
            }}
          >
            No backgrounds in this category yet · more land every seasonal drop.
          </div>
        ) : null}

        {!businessId ? (
          <div
            style={{
              gridColumn: "1 / -1",
              padding: 14,
              fontSize: 12,
              color: INK_MUTED,
              background: SURFACE,
              border: `1px dashed ${BORDER}`,
              borderRadius: 10,
            }}
          >
            You don&rsquo;t have a shop yet — set one up in{" "}
            <Link
              href="/nex-native/manage/shop"
              style={{ color: GOLD, textDecoration: "underline" }}
            >
              Manage · Shop
            </Link>{" "}
            before picking a background.
          </div>
        ) : null}

        {status.kind === "error" ? (
          <div
            style={{
              gridColumn: "1 / -1",
              padding: 10,
              fontSize: 12,
              color: "#D82A2A",
              background: "rgba(216, 42, 42, 0.08)",
              border: "1px solid rgba(216, 42, 42, 0.35)",
              borderRadius: 10,
            }}
          >
            {status.message}
          </div>
        ) : null}
      </section>

      <footer
        style={{
          marginTop: "auto",
          paddingTop: 10,
          borderTop: `1px solid ${BORDER}`,
          fontSize: 11,
          color: INK_MUTED,
          textAlign: "center",
          lineHeight: 1.5,
        }}
      >
        Theme colour auto-matches each background · pick again any time
        from <Link href="/nex-native/manage/shop/themes" style={{ color: GOLD }}>Shop Themes</Link>.
      </footer>
    </div>
  );
}

const pillStyle: React.CSSProperties = {
  position: "absolute",
  top: 8,
  right: 8,
  padding: "3px 10px",
  background: "rgba(0,0,0,0.6)",
  color: CREAM,
  fontSize: 9.5,
  fontWeight: 800,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  borderRadius: 999,
  border: "1px solid rgba(198,161,91,0.6)",
  backdropFilter: "blur(6px)",
};
