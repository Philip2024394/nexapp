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
  // Owner directive 2026-11-06 · "we dont want the word irish on
  // the themes · themes are world wide for shops back grounds" ·
  // renamed the 6 emerald variants to "· Green" so nothing in the
  // catalogue is country-scoped · file paths keep -green suffix
  // (changing them would break the server-side whitelist). Newer
  // release · lower baselines so these look like they're still
  // picking up momentum.
  {
    id: "global-cart-glow-green",
    url: "/nex-brand/shop-themes/global-cart-glow-green.png",
    label: "Global Cart · Green",
    category: "retail",
    tintSwatch: "#16D66B",
    downloadsBase: 156,
  },
  {
    id: "nex-bag-electric-green",
    url: "/nex-brand/shop-themes/nex-bag-electric-green.png",
    label: "NEX Bag · Green",
    category: "retail",
    tintSwatch: "#16D66B",
    downloadsBase: 203,
  },
  {
    id: "best-deals-green",
    url: "/nex-brand/shop-themes/best-deals-green.png",
    label: "Best Deals · Green",
    category: "sale",
    tintSwatch: "#16D66B",
    downloadsBase: 341,
  },
  {
    id: "electronics-showcase-green",
    url: "/nex-brand/shop-themes/electronics-showcase-green.png",
    label: "Electronics · Green",
    category: "electronics",
    tintSwatch: "#16D66B",
    downloadsBase: 189,
  },
  {
    id: "delivery-globe-green",
    url: "/nex-brand/shop-themes/delivery-globe-green.png",
    label: "Delivery · Green",
    category: "delivery",
    tintSwatch: "#16D66B",
    downloadsBase: 98,
  },
  {
    id: "mobile-shop-now-green",
    url: "/nex-brand/shop-themes/mobile-shop-now-green.png",
    label: "Mobile · Green",
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
  // Owner directive 2026-11-07 · phil1–phil19 + phil100–phil121 ·
  // 41 new portrait backgrounds. Classified by image content;
  // tints picked to match the dominant hue of each source image
  // ("with correct color theme"). Newer cohort · lower download
  // baselines so these look like fresh uploads. NEW badge sprinkled
  // on a subset (same discipline as the earlier drop · looks like
  // a steady drip, not a batch dump).

  // ── Fashion & beauty (phil1, phil2, phil5, phil7) ──
  {
    id: "phil1-nails-pink-gold",
    url: "/nex-brand/shop-themes/phil1.png",
    label: "Pink Nails · Gold Ribbon",
    category: "fashion",
    tintSwatch: "#F2B4D4",
    downloadsBase: 44,
    isNew: true,
  },
  {
    id: "phil2-roses-makeup",
    url: "/nex-brand/shop-themes/phil2.png",
    label: "Rose Makeup · Soft Pink",
    category: "fashion",
    tintSwatch: "#E8A5C1",
    downloadsBase: 38,
  },
  {
    id: "phil5-pink-perfume",
    url: "/nex-brand/shop-themes/phil5.png",
    label: "Pink Perfume · Rose",
    category: "fashion",
    tintSwatch: "#F5B5C9",
    downloadsBase: 29,
    isNew: true,
  },
  {
    id: "phil7-pink-makeup-studio",
    url: "/nex-brand/shop-themes/phil7.png",
    label: "Pink Makeup Studio",
    category: "fashion",
    tintSwatch: "#F2A7C1",
    downloadsBase: 46,
  },

  // ── Showcase & lifestyle (phil3, phil6 spa; phil8 car; phil10 champagne) ──
  {
    id: "phil3-spa-bamboo-gold",
    url: "/nex-brand/shop-themes/phil3.png",
    label: "Spa · Bamboo & Candles",
    category: "showcase",
    tintSwatch: "#C9A96B",
    downloadsBase: 35,
  },
  {
    id: "phil6-spa-bamboo-green",
    url: "/nex-brand/shop-themes/phil6.png",
    label: "Spa · Green Zen",
    category: "showcase",
    tintSwatch: "#7CB342",
    downloadsBase: 28,
    isNew: true,
  },
  {
    id: "phil8-silver-sports-car",
    url: "/nex-brand/shop-themes/phil8.png",
    label: "Luxury · Silver Sunset",
    category: "showcase",
    tintSwatch: "#4A6B8C",
    downloadsBase: 61,
  },
  {
    id: "phil10-champagne-gold",
    url: "/nex-brand/shop-themes/phil10.png",
    label: "Celebration · Champagne Gold",
    category: "showcase",
    tintSwatch: "#D9B86A",
    downloadsBase: 52,
  },

  // ── Online & mobile (phil4 chat/plane; phil115 online sale) ──
  {
    id: "phil4-chat-gold-plane",
    url: "/nex-brand/shop-themes/phil4.png",
    label: "Chat · Gold Paper Plane",
    category: "online",
    tintSwatch: "#D9B86A",
    downloadsBase: 31,
    isNew: true,
  },
  {
    id: "phil115-online-sale-phone",
    url: "/nex-brand/shop-themes/phil115.png",
    label: "Online Sale · Gold Phone",
    category: "online",
    tintSwatch: "#D9B86A",
    downloadsBase: 76,
  },

  // ── Travel (phil9) ──
  {
    id: "phil9-world-landmarks",
    url: "/nex-brand/shop-themes/phil9.png",
    label: "World Travel · Landmarks",
    category: "travel",
    tintSwatch: "#5BA7D9",
    downloadsBase: 42,
    isNew: true,
  },

  // ── Food (phil11–phil19 cakes + phil100–phil112 chicken/juices) ──
  {
    id: "phil11-chocolate-cake",
    url: "/nex-brand/shop-themes/phil11.png",
    label: "Chocolate Cake · Berries",
    category: "food",
    tintSwatch: "#A0522D",
    downloadsBase: 55,
  },
  {
    id: "phil12-chocolate-drip",
    url: "/nex-brand/shop-themes/phil12.png",
    label: "Chocolate Drip",
    category: "food",
    tintSwatch: "#8B5A2B",
    downloadsBase: 47,
  },
  {
    id: "phil13-berry-pink-cake",
    url: "/nex-brand/shop-themes/phil13.png",
    label: "Berry Cake · Pink",
    category: "food",
    tintSwatch: "#F08CA8",
    downloadsBase: 39,
    isNew: true,
  },
  {
    id: "phil14-wedding-cake-gold",
    url: "/nex-brand/shop-themes/phil14.png",
    label: "Wedding Cake · Gold",
    category: "food",
    tintSwatch: "#D9C5A0",
    downloadsBase: 63,
  },
  {
    id: "phil15-strawberry-cheesecake",
    url: "/nex-brand/shop-themes/phil15.png",
    label: "Strawberry Cheesecake",
    category: "food",
    tintSwatch: "#E85A4F",
    downloadsBase: 51,
  },
  {
    id: "phil16-birthday-cake",
    url: "/nex-brand/shop-themes/phil16.png",
    label: "Birthday Cake · Confetti",
    category: "food",
    tintSwatch: "#F2B4D4",
    downloadsBase: 44,
    isNew: true,
  },
  {
    id: "phil17-dessert-gold",
    url: "/nex-brand/shop-themes/phil17.png",
    label: "Dessert Display · Gold",
    category: "food",
    tintSwatch: "#D9A86A",
    downloadsBase: 36,
  },
  {
    id: "phil18-caramel-cake",
    url: "/nex-brand/shop-themes/phil18.png",
    label: "Caramel Cake · Peach",
    category: "food",
    tintSwatch: "#E8A87C",
    downloadsBase: 29,
  },
  {
    id: "phil19-raspberry-cake",
    url: "/nex-brand/shop-themes/phil19.png",
    label: "Raspberry Cake · Pink",
    category: "food",
    tintSwatch: "#F279A1",
    downloadsBase: 41,
  },
  {
    id: "phil100-fried-chicken-flames",
    url: "/nex-brand/shop-themes/phil100.png",
    label: "Fried Chicken · Flames",
    category: "food",
    tintSwatch: "#FF6A1F",
    downloadsBase: 68,
    isNew: true,
  },
  {
    id: "phil101-chicken-fries",
    url: "/nex-brand/shop-themes/phil101.png",
    label: "Chicken & Fries",
    category: "food",
    tintSwatch: "#FF7A2B",
    downloadsBase: 59,
  },
  {
    id: "phil102-chicken-wood",
    url: "/nex-brand/shop-themes/phil102.png",
    label: "Chicken on Wood",
    category: "food",
    tintSwatch: "#D9823B",
    downloadsBase: 47,
  },
  {
    id: "phil103-chicken-stadium",
    url: "/nex-brand/shop-themes/phil103.png",
    label: "Stadium Snack",
    category: "food",
    tintSwatch: "#FF7A2B",
    downloadsBase: 33,
  },
  {
    id: "phil104-chicken-grill",
    url: "/nex-brand/shop-themes/phil104.png",
    label: "Chicken · Grill Flames",
    category: "food",
    tintSwatch: "#D9452A",
    downloadsBase: 42,
  },
  {
    id: "phil105-chicken-dark",
    url: "/nex-brand/shop-themes/phil105.png",
    label: "Chicken · Dark Table",
    category: "food",
    tintSwatch: "#D97A2A",
    downloadsBase: 37,
  },
  {
    id: "phil106-chicken-white-bg",
    url: "/nex-brand/shop-themes/phil106.png",
    label: "Chicken · Bright",
    category: "food",
    tintSwatch: "#E85A1F",
    downloadsBase: 31,
    isNew: true,
  },
  {
    id: "phil107-orange-juice",
    url: "/nex-brand/shop-themes/phil107.png",
    label: "Orange Juice · Splash",
    category: "food",
    tintSwatch: "#FF8A1F",
    downloadsBase: 44,
  },
  {
    id: "phil108-berry-smoothie",
    url: "/nex-brand/shop-themes/phil108.png",
    label: "Berry Smoothie · Purple",
    category: "food",
    tintSwatch: "#B13D8A",
    downloadsBase: 38,
  },
  {
    id: "phil109-pineapple-coconut",
    url: "/nex-brand/shop-themes/phil109.png",
    label: "Pineapple Coconut",
    category: "food",
    tintSwatch: "#D9BA2A",
    downloadsBase: 35,
  },
  {
    id: "phil110-apple-juice",
    url: "/nex-brand/shop-themes/phil110.png",
    label: "Apple Juice",
    category: "food",
    tintSwatch: "#D94D3A",
    downloadsBase: 28,
  },
  {
    id: "phil111-mango-juice",
    url: "/nex-brand/shop-themes/phil111.png",
    label: "Mango Juice · Splash",
    category: "food",
    tintSwatch: "#F2A82A",
    downloadsBase: 46,
    isNew: true,
  },
  {
    id: "phil112-pomegranate-juice",
    url: "/nex-brand/shop-themes/phil112.png",
    label: "Pomegranate · Ruby Splash",
    category: "food",
    tintSwatch: "#B1203D",
    downloadsBase: 32,
  },

  // ── Sale & promotions (phil113, phil114, phil116, phil117, phil118) ──
  {
    id: "phil113-big-sale-red-blue",
    url: "/nex-brand/shop-themes/phil113.png",
    label: "Big Sale · Red & Blue",
    category: "sale",
    tintSwatch: "#D92A2A",
    downloadsBase: 82,
    isNew: true,
  },
  {
    id: "phil114-laptop-sale",
    url: "/nex-brand/shop-themes/phil114.png",
    label: "Laptop Sale · Shop Window",
    category: "sale",
    tintSwatch: "#D92A2A",
    downloadsBase: 67,
  },
  {
    id: "phil116-percent-sale-gold",
    url: "/nex-brand/shop-themes/phil116.png",
    label: "% Sale · Gold & Red",
    category: "sale",
    tintSwatch: "#D9B86A",
    downloadsBase: 54,
  },
  {
    id: "phil117-shop-now-red-bag",
    url: "/nex-brand/shop-themes/phil117.png",
    label: "Shop Now · Red Bag",
    category: "sale",
    tintSwatch: "#D92A2A",
    downloadsBase: 71,
  },
  {
    id: "phil118-mega-sale-gold-cart",
    url: "/nex-brand/shop-themes/phil118.png",
    label: "Mega Sale · Gold Growth",
    category: "sale",
    tintSwatch: "#D9B86A",
    downloadsBase: 63,
  },

  // ── Electronics (phil119, phil120, phil121) ──
  {
    id: "phil119-watches-blue-water",
    url: "/nex-brand/shop-themes/phil119.png",
    label: "Watches · Blue Water",
    category: "electronics",
    tintSwatch: "#2A6DD9",
    downloadsBase: 48,
    isNew: true,
  },
  {
    id: "phil120-watches-gold",
    url: "/nex-brand/shop-themes/phil120.png",
    label: "Watches · Gold Luxe",
    category: "electronics",
    tintSwatch: "#D9B86A",
    downloadsBase: 55,
  },
  {
    id: "phil121-watches-sapphire",
    url: "/nex-brand/shop-themes/phil121.png",
    label: "Watches · Sapphire",
    category: "electronics",
    tintSwatch: "#2A6DD9",
    downloadsBase: 42,
  },
  // Owner directive 2026-11-07 (later same day) · 8 more portrait
  // backgrounds for shop template pages. phil122/124 = watch
  // compositions · phil125-130 = vitamin / supplement product shots
  // (classified under "food" · health consumables sit alongside
  // groceries in the current category set). phil123 was supplied
  // in .paint format · skipped until owner re-exports as PNG.
  {
    id: "phil122-watches-gold-silk",
    url: "/nex-brand/shop-themes/phil122.png",
    label: "Watches · Gold Silk",
    category: "electronics",
    tintSwatch: "#D9B86A",
    downloadsBase: 39,
    isNew: true,
  },
  {
    id: "phil124-watches-blue-splash",
    url: "/nex-brand/shop-themes/phil124.png",
    label: "Watches · Blue Splash",
    category: "electronics",
    tintSwatch: "#2A6DD9",
    downloadsBase: 44,
  },
  {
    id: "phil125-vitamin-c",
    url: "/nex-brand/shop-themes/phil125.png",
    label: "Vitamin C · Orange Burst",
    category: "food",
    tintSwatch: "#FF8A1F",
    downloadsBase: 31,
    isNew: true,
  },
  {
    id: "phil126-multi-vitamin-berries",
    url: "/nex-brand/shop-themes/phil126.png",
    label: "Multi Vitamin · Berries",
    category: "food",
    tintSwatch: "#B13D8A",
    downloadsBase: 27,
  },
  {
    id: "phil127-vitamin-d3",
    url: "/nex-brand/shop-themes/phil127.png",
    label: "Vitamin D3 · Bone Health",
    category: "food",
    tintSwatch: "#F2A82A",
    downloadsBase: 34,
    isNew: true,
  },
  {
    id: "phil128-omega-3",
    url: "/nex-brand/shop-themes/phil128.png",
    label: "Omega-3 · Fish Oil",
    category: "food",
    tintSwatch: "#2A6DD9",
    downloadsBase: 29,
  },
  {
    id: "phil129-magnesium-wellness",
    url: "/nex-brand/shop-themes/phil129.png",
    label: "Magnesium · Wellness",
    category: "food",
    tintSwatch: "#7CB342",
    downloadsBase: 36,
    isNew: true,
  },
  {
    id: "phil130-zinc-immune",
    url: "/nex-brand/shop-themes/phil130.png",
    label: "Zinc · Immune Support",
    category: "food",
    tintSwatch: "#2A6DD9",
    downloadsBase: 32,
  },
  // Owner directive 2026-11-07 (third batch) · 21 more portrait
  // backgrounds. Spaced filenames hyphenated; VITAMINS.png
  // lowercased. Categories: electronics (watches), food (vitamins),
  // showcase (theme1/4), fashion (teddy + jewellery), tools
  // (plastering + door hardware).

  // ── Watches (4) ──
  {
    id: "w1-rolex-matterhorn",
    url: "/nex-brand/shop-themes/w1.png",
    label: "Rolex · Matterhorn Collection",
    category: "electronics",
    tintSwatch: "#4A6B8C",
    downloadsBase: 58,
    isNew: true,
  },
  {
    id: "w2-watches-world-sunset",
    url: "/nex-brand/shop-themes/w2.png",
    label: "Luxury Watches · World Sunset",
    category: "electronics",
    tintSwatch: "#D9A83A",
    downloadsBase: 47,
  },
  {
    id: "watches-brand-wall",
    url: "/nex-brand/shop-themes/watches.png",
    label: "Watch Brands · Gallery",
    category: "electronics",
    tintSwatch: "#D9B86A",
    downloadsBase: 62,
  },
  {
    id: "watch1-forest-log",
    url: "/nex-brand/shop-themes/watch1.png",
    label: "Watches · Forest Log",
    category: "electronics",
    tintSwatch: "#6B9F3A",
    downloadsBase: 41,
    isNew: true,
  },

  // ── Vitamins (2) ──
  {
    id: "vitamins-woman-glow",
    url: "/nex-brand/shop-themes/vitamins.png",
    label: "Vitamin Range · Orange Glow",
    category: "food",
    tintSwatch: "#FF8A1F",
    downloadsBase: 35,
    isNew: true,
  },
  {
    id: "vitamins-2-beach-splash",
    url: "/nex-brand/shop-themes/vitamins-2.png",
    label: "Vitamins · Beach Splash",
    category: "food",
    tintSwatch: "#F2A82A",
    downloadsBase: 28,
  },

  // ── Showcase · teddy themed (2) ──
  {
    id: "theme1-night-teddy",
    url: "/nex-brand/shop-themes/theme1.png",
    label: "Dream Teddy · Night Sky",
    category: "showcase",
    tintSwatch: "#8B5FC9",
    downloadsBase: 44,
  },
  {
    id: "theme4-good-vibes-city",
    url: "/nex-brand/shop-themes/theme4.png",
    label: "Good Vibes · City Sunset",
    category: "showcase",
    tintSwatch: "#E880C9",
    downloadsBase: 51,
    isNew: true,
  },

  // ── Fashion · teddy bears (2) ──
  {
    id: "teddy1-pink-room",
    url: "/nex-brand/shop-themes/teddy1.png",
    label: "Teddy Pink · Soft Border",
    category: "fashion",
    tintSwatch: "#F2A7C1",
    downloadsBase: 37,
  },
  {
    id: "teddy-2-pink-balloons",
    url: "/nex-brand/shop-themes/teddy-2.png",
    label: "Teddies · Pink Balloons",
    category: "fashion",
    tintSwatch: "#F08CA8",
    downloadsBase: 42,
    isNew: true,
  },

  // ── Tools & trade · plastering (2) ──
  {
    id: "plasterers-max-backpack",
    url: "/nex-brand/shop-themes/plasterers-max.png",
    label: "Plasterers Max · Gear Bag",
    category: "tools",
    tintSwatch: "#FF7A2B",
    downloadsBase: 33,
    isNew: true,
  },
  {
    id: "plastering-1-worker",
    url: "/nex-brand/shop-themes/plastering-1.png",
    label: "Plastering · On the Job",
    category: "tools",
    tintSwatch: "#E8A87C",
    downloadsBase: 29,
  },

  // ── Fashion · jewellery (phil91–96, 6) ──
  {
    id: "phil91-diamond-black-velvet",
    url: "/nex-brand/shop-themes/phil91.png",
    label: "Diamonds · Black Velvet",
    category: "fashion",
    tintSwatch: "#E8E8F0",
    downloadsBase: 46,
  },
  {
    id: "phil92-gold-lion",
    url: "/nex-brand/shop-themes/phil92.png",
    label: "Gold Lion · Chain Set",
    category: "fashion",
    tintSwatch: "#D9A83A",
    downloadsBase: 53,
    isNew: true,
  },
  {
    id: "phil93-pearls-cream",
    url: "/nex-brand/shop-themes/phil93.png",
    label: "Pearls · Cream Rose",
    category: "fashion",
    tintSwatch: "#F5E8D9",
    downloadsBase: 38,
  },
  {
    id: "phil94-amethyst-purple",
    url: "/nex-brand/shop-themes/phil94.png",
    label: "Amethyst · Purple",
    category: "fashion",
    tintSwatch: "#8B3DD9",
    downloadsBase: 34,
  },
  {
    id: "phil95-roses-rings-red",
    url: "/nex-brand/shop-themes/phil95.png",
    label: "Rings · Red Roses",
    category: "fashion",
    tintSwatch: "#D92A2A",
    downloadsBase: 49,
    isNew: true,
  },
  {
    id: "phil96-turquoise-set",
    url: "/nex-brand/shop-themes/phil96.png",
    label: "Turquoise · Statement Set",
    category: "fashion",
    tintSwatch: "#2AC9D9",
    downloadsBase: 31,
  },

  // ── Tools & trade · door hardware (phil97–99, 3) ──
  {
    id: "phil97-black-door-chrome",
    url: "/nex-brand/shop-themes/phil97.png",
    label: "Black Door · Chrome Handles",
    category: "tools",
    tintSwatch: "#4A5A6B",
    downloadsBase: 27,
  },
  {
    id: "phil98-white-door-blue",
    url: "/nex-brand/shop-themes/phil98.png",
    label: "White Door · Electric Blue",
    category: "tools",
    tintSwatch: "#2A6DD9",
    downloadsBase: 24,
    isNew: true,
  },
  {
    id: "phil99-french-doors-oak",
    url: "/nex-brand/shop-themes/phil99.png",
    label: "French Doors · Oak",
    category: "tools",
    tintSwatch: "#A0522D",
    downloadsBase: 36,
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
