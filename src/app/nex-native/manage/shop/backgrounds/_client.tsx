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
  { id: "fashion", label: "Fashion & beauty", emoji: "👗" },
  { id: "tools", label: "Tools & trade", emoji: "🛠" },
  { id: "sports", label: "Sports & outdoors", emoji: "🏀" },
  { id: "food", label: "Food & grocery", emoji: "🥬" },
  { id: "travel", label: "Travel & experiences", emoji: "✈️" },
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
  /** Seed baseline for the "N downloads" stat · drifts up on
   *  randomised 3h / 16h / 24h intervals in useFakeDownloads. */
  readonly downloadsBase: number;
  /** Owner directive 2026-11-06 · "NEW" badge shown on SOME tiles ·
   *  only a subset of recent uploads carry this flag (same look as
   *  the chat themes library · looks natural, not every new one). */
  readonly isNew?: boolean;
}

// Fake-but-natural download counter · same contract as the one on
// the themes picker · stores per-key count + next bump time in
// localStorage · randomised intervals [3h · 16h · 24h] + random
// increments [1..5] so each preset's tally drifts up at a human-
// looking pace. Replace with a server-backed count once the
// nex_business.shop_cover_image_url GROUP BY lands.
function useFakeDownloads(key: string, base: number): number {
  const [count, setCount] = React.useState(base);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const storageKey = `nex-shop-dl:${key}`;
    const INTERVAL_HOURS = [3, 16, 24] as const;
    const now = Date.now();
    try {
      const raw = window.localStorage.getItem(storageKey);
      const parsed = raw
        ? (JSON.parse(raw) as { count?: number; nextAt?: number })
        : null;
      const currentCount = parsed?.count ?? base;
      const nextAt = parsed?.nextAt ?? 0;
      if (now >= nextAt) {
        const inc = Math.floor(Math.random() * 5) + 1;
        const intervalH =
          INTERVAL_HOURS[Math.floor(Math.random() * INTERVAL_HOURS.length)]!;
        const newCount = currentCount + inc;
        const newNextAt = now + intervalH * 60 * 60 * 1000;
        window.localStorage.setItem(
          storageKey,
          JSON.stringify({ count: newCount, nextAt: newNextAt }),
        );
        setCount(newCount);
      } else {
        setCount(currentCount);
      }
    } catch {
      setCount(base);
    }
  }, [key, base]);
  return count;
}

const PRESETS: ReadonlyArray<ShopBackgroundPreset> = [
  {
    id: "dynamic-nex-shopping-showcase",
    url: "/nex-brand/shop-themes/dynamic-nex-shopping-showcase.png",
    label: "NEX Shopping Showcase",
    category: "showcase",
    tintSwatch: "#C6A15B",
    downloadsBase: 1240,
  },
  {
    id: "global-cart-glow",
    url: "/nex-brand/shop-themes/global-cart-glow.png",
    label: "Global Cart · Orange Glow",
    category: "retail",
    tintSwatch: "#FF7A2B",
    downloadsBase: 487,
  },
  {
    id: "nex-bag-electric",
    url: "/nex-brand/shop-themes/nex-bag-electric.png",
    label: "NEX Bag · Electric",
    category: "retail",
    tintSwatch: "#2A6DD9",
    downloadsBase: 623,
  },
  {
    id: "sale-best-deals",
    url: "/nex-brand/shop-themes/sale-best-deals.png",
    label: "Sale · Best Deals",
    category: "sale",
    tintSwatch: "#FF6600",
    downloadsBase: 892,
  },
  {
    id: "electronics-showcase",
    url: "/nex-brand/shop-themes/electronics-showcase.png",
    label: "Electronics Showcase",
    category: "electronics",
    tintSwatch: "#1E4A8C",
    downloadsBase: 745,
  },
  {
    id: "delivery-globe",
    url: "/nex-brand/shop-themes/delivery-globe.png",
    label: "Delivery · Global Reach",
    category: "delivery",
    tintSwatch: "#FF7A2B",
    downloadsBase: 312,
  },
  {
    id: "mobile-shop-now",
    url: "/nex-brand/shop-themes/mobile-shop-now.png",
    label: "Mobile · Shop Now",
    category: "online",
    tintSwatch: "#FF6B2B",
    downloadsBase: 1055,
  },
  // Irish-green pack · same 6 compositions in emerald/neon-green
  // tones · paired with a vivid Irish green tint so the theme
  // colour tracks the image (owner-authorised 2026-11-06).
  // Newer release · lower baselines to look like they're still
  // picking up momentum.
  {
    id: "global-cart-glow-green",
    url: "/nex-brand/shop-themes/global-cart-glow-green.png",
    label: "Global Cart · Irish Green",
    category: "retail",
    tintSwatch: "#16D66B",
    downloadsBase: 156,
  },
  {
    id: "nex-bag-electric-green",
    url: "/nex-brand/shop-themes/nex-bag-electric-green.png",
    label: "NEX Bag · Irish Green",
    category: "retail",
    tintSwatch: "#16D66B",
    downloadsBase: 203,
  },
  {
    id: "best-deals-green",
    url: "/nex-brand/shop-themes/best-deals-green.png",
    label: "Best Deals · Irish Green",
    category: "sale",
    tintSwatch: "#16D66B",
    downloadsBase: 341,
  },
  {
    id: "electronics-showcase-green",
    url: "/nex-brand/shop-themes/electronics-showcase-green.png",
    label: "Electronics · Irish Green",
    category: "electronics",
    tintSwatch: "#16D66B",
    downloadsBase: 189,
  },
  {
    id: "delivery-globe-green",
    url: "/nex-brand/shop-themes/delivery-globe-green.png",
    label: "Delivery · Irish Green",
    category: "delivery",
    tintSwatch: "#16D66B",
    downloadsBase: 98,
  },
  {
    id: "mobile-shop-now-green",
    url: "/nex-brand/shop-themes/mobile-shop-now-green.png",
    label: "Mobile · Irish Green",
    category: "online",
    tintSwatch: "#16D66B",
    downloadsBase: 267,
    isNew: true,
  },
  // Owner directive 2026-11-06 · six new category-specific
  // backgrounds introducing fashion, tools, sports, food, and
  // travel surfaces plus a second electronics option. NEW badge
  // assigned to a random subset (fashion · sports · travel) so
  // the catalogue reads as a steady drip of fresh uploads, not a
  // batch drop (owner-authorised "not all will show new").
  {
    id: "electronics-blue-glow",
    url: "/nex-brand/shop-themes/electronics-blue-glow.png",
    label: "Electronics · Blue Glow",
    category: "electronics",
    tintSwatch: "#1E6DD9",
    downloadsBase: 72,
  },
  {
    id: "fashion-beauty-purple",
    url: "/nex-brand/shop-themes/fashion-beauty-purple.png",
    label: "Fashion · Purple Night",
    category: "fashion",
    tintSwatch: "#C62AD9",
    downloadsBase: 58,
    isNew: true,
  },
  {
    id: "tools-trade-green",
    url: "/nex-brand/shop-themes/tools-trade-green.png",
    label: "Tools & Trade · Jade",
    category: "tools",
    tintSwatch: "#16D66B",
    downloadsBase: 41,
  },
  {
    id: "sports-outdoors-orange",
    url: "/nex-brand/shop-themes/sports-outdoors-orange.png",
    label: "Sports & Outdoors · Ember",
    category: "sports",
    tintSwatch: "#FF7A2B",
    downloadsBase: 66,
    isNew: true,
  },
  {
    id: "food-grocery-red",
    url: "/nex-brand/shop-themes/food-grocery-red.png",
    label: "Food & Grocery · Ruby",
    category: "food",
    tintSwatch: "#D82A2A",
    downloadsBase: 33,
  },
  {
    id: "travel-luggage-gold",
    url: "/nex-brand/shop-themes/travel-luggage-gold.png",
    label: "Travel · Amber Trail",
    category: "travel",
    tintSwatch: "#F2B23A",
    downloadsBase: 51,
    isNew: true,
  },
];

// Owner directive 2026-11-06 · "libary must have previous and
// back after 20 themes displaying". Hard cap of 20 tiles per
// page · when the filtered catalogue exceeds 20 the prev/next
// arrows + "N / Total" count appear below the grid.
const PRESETS_PER_PAGE = 20;

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
  const [page, setPage] = React.useState(0);
  const [status, setStatus] = React.useState<
    | { kind: "idle" }
    | { kind: "applying"; id: string }
    | { kind: "ok"; id: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  // Reset to page 0 when the category filter changes so the owner
  // always lands on the first page of the newly filtered set.
  React.useEffect(() => {
    setPage(0);
  }, [selectedCategory]);

  const filtered = React.useMemo(
    () =>
      selectedCategory === "all"
        ? PRESETS
        : PRESETS.filter((p) => p.category === selectedCategory),
    [selectedCategory],
  );
  const totalPages = Math.max(
    1,
    Math.ceil(filtered.length / PRESETS_PER_PAGE),
  );
  const pageSafe = Math.min(page, totalPages - 1);
  const visible = React.useMemo(
    () =>
      filtered.slice(
        pageSafe * PRESETS_PER_PAGE,
        pageSafe * PRESETS_PER_PAGE + PRESETS_PER_PAGE,
      ),
    [filtered, pageSafe],
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
        {visible.map((preset) => (
          <PresetTile
            key={preset.id}
            preset={preset}
            isCurrent={currentImageUrl === preset.url}
            isApplying={
              status.kind === "applying" && status.id === preset.id
            }
            isApplied={status.kind === "ok" && status.id === preset.id}
            disabled={pending || !businessId}
            businessId={businessId}
            onPick={onPick}
          />
        ))}

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

      {/* Owner directive 2026-11-06 · "libary must have previous
          and back after 20 themes displaying". Pagination row
          mirrors the sealed CoverCatalog shape: prev arrow · N/Total
          count pill · next arrow · auto-hides when the filtered
          catalogue fits in one page. */}
      {totalPages > 1 ? (
        <nav
          aria-label="Background pages"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            padding: "4px 0 2px",
          }}
        >
          <PageArrow
            direction="prev"
            disabled={pageSafe === 0}
            onClick={() => setPage(pageSafe - 1)}
          />
          <span
            aria-live="polite"
            style={{
              display: "inline-flex",
              alignItems: "baseline",
              gap: 6,
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: INK,
              background: "rgba(0,0,0,0.35)",
              borderRadius: 999,
              border: `1px solid ${BORDER_HI}`,
            }}
          >
            <span style={{ color: GOLD, fontSize: 14 }}>{pageSafe + 1}</span>
            <span style={{ opacity: 0.6 }}>/</span>
            <span>{totalPages}</span>
          </span>
          <PageArrow
            direction="next"
            disabled={pageSafe === totalPages - 1}
            onClick={() => setPage(pageSafe + 1)}
          />
        </nav>
      ) : null}

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

// ─── Preset tile ────────────────────────────────────────────────────────
// Extracted so useFakeDownloads can run per-preset without violating
// the rules-of-hooks loop constraint.
function PresetTile({
  preset,
  isCurrent,
  isApplying,
  isApplied,
  disabled,
  businessId,
  onPick,
}: {
  preset: ShopBackgroundPreset;
  isCurrent: boolean;
  isApplying: boolean;
  isApplied: boolean;
  disabled: boolean;
  businessId: string | null;
  onPick: (preset: ShopBackgroundPreset) => void;
}): React.JSX.Element {
  const downloads = useFakeDownloads(
    `bg:${preset.id}`,
    preset.downloadsBase,
  );
  return (
    <button
      type="button"
      onClick={() => onPick(preset)}
      disabled={disabled}
      data-nex-shop-bg-preset-tile={preset.id}
      aria-current={isCurrent ? "true" : undefined}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 0,
        padding: 0,
        background: SURFACE,
        border: `2px solid ${isCurrent || isApplied ? GOLD : BORDER}`,
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
        /* Owner directive 2026-11-06 · tiles must fit the
           image at full height AND full width · source
           images are portrait 9:16-ish · tile aspect matches
           + background-size:100% 100% guarantees the whole
           image paints edge-to-edge with no crop. */
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "9 / 16",
          backgroundImage: `url(${preset.url})`,
          backgroundSize: "100% 100%",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
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
        ) : preset.isNew ? (
          /* Owner directive 2026-11-06 · NEW badge on a subset of
             recent uploads so the catalogue looks like a drip of
             fresh themes, not a batch drop. */
          <span style={{ ...pillStyle, background: GOLD, color: "#1A120A" }}>
            New
          </span>
        ) : null}
      </div>
      <div
        style={{
          padding: "8px 10px 10px",
          display: "flex",
          flexDirection: "column",
          gap: 3,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 800 }}>{preset.label}</div>
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
        {/* Owner directive 2026-11-06 · per-preset download count
            with inbox glyph · drifts up on random 3h/16h/24h
            intervals so each tile feels alive. */}
        <div
          data-nex-shop-bg-downloads={preset.id}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 10.5,
            fontWeight: 700,
            color: INK_DIM,
            marginTop: 2,
          }}
        >
          <span aria-hidden style={{ fontSize: 12 }}>📥</span>
          <span
            style={{
              color: GOLD,
              fontWeight: 900,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {downloads.toLocaleString()}
          </span>
        </div>
      </div>
    </button>
  );
}

// ─── Pagination arrow ────────────────────────────────────────────────
function PageArrow({
  direction,
  disabled,
  onClick,
}: {
  direction: "prev" | "next";
  disabled: boolean;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-label={direction === "prev" ? "Previous page" : "Next page"}
      onClick={onClick}
      disabled={disabled}
      style={{
        appearance: "none",
        width: 34,
        height: 34,
        borderRadius: "50%",
        border: `1px solid ${BORDER_HI}`,
        background: "rgba(0,0,0,0.35)",
        color: GOLD,
        fontSize: 18,
        fontWeight: 900,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.35 : 1,
        display: "grid",
        placeItems: "center",
        transition: "opacity 140ms ease",
      }}
    >
      {direction === "prev" ? "‹" : "›"}
    </button>
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
