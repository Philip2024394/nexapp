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
  // Owner directive 2026-11-07 (fourth batch) · 65 more tiles.

  // ── Cakes + desserts · food ──
  { id: "phil21-berry-cheesecake-lilac", url: "/nex-brand/shop-themes/phil21.png", label: "Berry Cheesecake · Lilac", category: "food", tintSwatch: "#B88CD9", downloadsBase: 38 },
  { id: "phil22-blueberry-cake-mint", url: "/nex-brand/shop-themes/phil22.png", label: "Blueberry Cake · Mint", category: "food", tintSwatch: "#7BC4C4", downloadsBase: 35, isNew: true },
  { id: "phil23-choc-strawberry-pink", url: "/nex-brand/shop-themes/phil23.png", label: "Chocolate Strawberry · Pink", category: "food", tintSwatch: "#F08CA8", downloadsBase: 42 },

  // ── Abstract silk + plain backdrops · showcase ──
  { id: "phil24-cream-silk", url: "/nex-brand/shop-themes/phil24.png", label: "Cream Silk", category: "showcase", tintSwatch: "#E8D5A8", downloadsBase: 27 },
  { id: "phil25-pink-silk", url: "/nex-brand/shop-themes/phil25.png", label: "Pink Silk", category: "showcase", tintSwatch: "#F08CB8", downloadsBase: 29 },
  { id: "phil26-copper-silk", url: "/nex-brand/shop-themes/phil26.png", label: "Copper Silk", category: "showcase", tintSwatch: "#A86A3A", downloadsBase: 24 },
  { id: "phil27-purple-silk", url: "/nex-brand/shop-themes/phil27.png", label: "Purple Silk", category: "showcase", tintSwatch: "#8B5FC9", downloadsBase: 26 },
  { id: "phil28-teal-silk", url: "/nex-brand/shop-themes/phil28.png", label: "Teal Silk", category: "showcase", tintSwatch: "#4FD1C5", downloadsBase: 31, isNew: true },
  { id: "phil29-coral-silk", url: "/nex-brand/shop-themes/phil29.png", label: "Coral Silk", category: "showcase", tintSwatch: "#F08C7B", downloadsBase: 25 },
  { id: "phil30-cream-flat", url: "/nex-brand/shop-themes/phil30.png", label: "Cream · Plain", category: "showcase", tintSwatch: "#F5E8D9", downloadsBase: 22 },
  { id: "phil31-pink-flat", url: "/nex-brand/shop-themes/phil31.png", label: "Pink · Plain", category: "showcase", tintSwatch: "#F2A7C1", downloadsBase: 28 },
  { id: "phil32-brown-flat", url: "/nex-brand/shop-themes/phil32.png", label: "Brown · Plain", category: "showcase", tintSwatch: "#6B3A1F", downloadsBase: 19 },
  { id: "phil33-lilac-flat", url: "/nex-brand/shop-themes/phil33.png", label: "Lilac · Plain", category: "showcase", tintSwatch: "#C090F0", downloadsBase: 23 },
  { id: "phil34-mint-flat", url: "/nex-brand/shop-themes/phil34.png", label: "Mint · Plain", category: "showcase", tintSwatch: "#90F0D0", downloadsBase: 21 },
  { id: "phil35-coral-flat", url: "/nex-brand/shop-themes/phil35.png", label: "Coral · Plain", category: "showcase", tintSwatch: "#F0807B", downloadsBase: 24 },
  { id: "phil36-navy-flat", url: "/nex-brand/shop-themes/phil36.png", label: "Navy · Plain", category: "showcase", tintSwatch: "#1F3A6B", downloadsBase: 20 },
  { id: "phil37-teal-flat", url: "/nex-brand/shop-themes/phil37.png", label: "Teal · Plain", category: "showcase", tintSwatch: "#0FA8A8", downloadsBase: 22 },
  { id: "phil38-orange-flat", url: "/nex-brand/shop-themes/phil38.png", label: "Orange · Plain", category: "showcase", tintSwatch: "#F08C1F", downloadsBase: 25 },
  { id: "phil39-grey-flat", url: "/nex-brand/shop-themes/phil39.png", label: "Grey · Plain", category: "showcase", tintSwatch: "#BFBFBF", downloadsBase: 17 },
  { id: "phil40-red-flat", url: "/nex-brand/shop-themes/phil40.png", label: "Red · Plain", category: "showcase", tintSwatch: "#C0001F", downloadsBase: 28 },
  { id: "phil41-dark-green-flat", url: "/nex-brand/shop-themes/phil41.png", label: "Dark Green · Plain", category: "showcase", tintSwatch: "#0F5F2B", downloadsBase: 21 },
  { id: "phil42-cream-light", url: "/nex-brand/shop-themes/phil42.png", label: "Soft Cream", category: "showcase", tintSwatch: "#F5E8C5", downloadsBase: 18 },
  { id: "phil43-light-grey", url: "/nex-brand/shop-themes/phil43.png", label: "Light Grey", category: "showcase", tintSwatch: "#D5D5D5", downloadsBase: 16 },
  { id: "phil44-ivory", url: "/nex-brand/shop-themes/phil44.png", label: "Ivory", category: "showcase", tintSwatch: "#F5EFE0", downloadsBase: 19 },
  { id: "phil45-pale-blue", url: "/nex-brand/shop-themes/phil45.png", label: "Pale Blue", category: "showcase", tintSwatch: "#B5D5F0", downloadsBase: 20 },
  { id: "phil46-pale-lilac", url: "/nex-brand/shop-themes/phil46.png", label: "Pale Lilac", category: "showcase", tintSwatch: "#E0C5F5", downloadsBase: 22 },
  { id: "phil47-soft-pink", url: "/nex-brand/shop-themes/phil47.png", label: "Soft Pink", category: "showcase", tintSwatch: "#F5B5D0", downloadsBase: 23 },

  // ── Cruise + travel ──
  { id: "phil48-cruise-beach", url: "/nex-brand/shop-themes/phil48.png", label: "Cruise · Beach Cream", category: "travel", tintSwatch: "#E8D5A8", downloadsBase: 34 },
  { id: "phil49-cruise-globe", url: "/nex-brand/shop-themes/phil49.png", label: "Cruise · Globe", category: "travel", tintSwatch: "#7A9BC4", downloadsBase: 31 },
  { id: "phil50-cruise-tropic", url: "/nex-brand/shop-themes/phil50.png", label: "Cruise · Tropical", category: "travel", tintSwatch: "#F5E8C5", downloadsBase: 37, isNew: true },
  { id: "phil51-cruise-pink", url: "/nex-brand/shop-themes/phil51.png", label: "Cruise · Pink Sunset", category: "travel", tintSwatch: "#F08CA8", downloadsBase: 39 },
  { id: "phil52-cruise-glacier", url: "/nex-brand/shop-themes/phil52.png", label: "Cruise · Glacier", category: "travel", tintSwatch: "#5BA7D9", downloadsBase: 28 },
  { id: "phil53-cruise-paris", url: "/nex-brand/shop-themes/phil53.png", label: "Cruise · Paris Twilight", category: "travel", tintSwatch: "#9B6DD9", downloadsBase: 45, isNew: true },

  // ── Mains · food ──
  { id: "phil54-burger-orange", url: "/nex-brand/shop-themes/phil54.png", label: "Burger · Orange", category: "food", tintSwatch: "#FF7A2B", downloadsBase: 57 },
  { id: "phil55-pizza-cream", url: "/nex-brand/shop-themes/phil55.png", label: "Pizza · Cream", category: "food", tintSwatch: "#E8A82A", downloadsBase: 51 },
  { id: "phil61-pizza-dark", url: "/nex-brand/shop-themes/phil61.png", label: "Pizza · Dark Slate", category: "food", tintSwatch: "#D9452A", downloadsBase: 43 },
  { id: "phil62-burger-bright", url: "/nex-brand/shop-themes/phil62.png", label: "Burger · Bright Orange", category: "food", tintSwatch: "#FF7A2B", downloadsBase: 46 },
  { id: "phil63-spaghetti-cream", url: "/nex-brand/shop-themes/phil63.png", label: "Spaghetti · Cream", category: "food", tintSwatch: "#D9823B", downloadsBase: 40, isNew: true },
  { id: "phil64-salmon-blue", url: "/nex-brand/shop-themes/phil64.png", label: "Salmon · Blue Splash", category: "food", tintSwatch: "#2A6DD9", downloadsBase: 44 },
  { id: "phil65-choc-berry-pink", url: "/nex-brand/shop-themes/phil65.png", label: "Chocolate Berry · Pink", category: "food", tintSwatch: "#E85AA8", downloadsBase: 38 },
  { id: "phil66-steak-red", url: "/nex-brand/shop-themes/phil66.png", label: "Steak · Red", category: "food", tintSwatch: "#B1203D", downloadsBase: 49 },
  { id: "phil67-noodles-asian", url: "/nex-brand/shop-themes/phil67.png", label: "Asian Noodles", category: "food", tintSwatch: "#D97A2A", downloadsBase: 42 },
  { id: "phil68-kebab-red", url: "/nex-brand/shop-themes/phil68.png", label: "Kebab · Red Grill", category: "food", tintSwatch: "#D9452A", downloadsBase: 36 },
  { id: "phil69-fried-rice-yellow", url: "/nex-brand/shop-themes/phil69.png", label: "Fried Rice · Yellow", category: "food", tintSwatch: "#D9BA2A", downloadsBase: 33, isNew: true },
  { id: "phil70-asian-wok-green", url: "/nex-brand/shop-themes/phil70.png", label: "Asian Wok · Green", category: "food", tintSwatch: "#1F6F2B", downloadsBase: 39 },
  { id: "phil71-dumplings-blue", url: "/nex-brand/shop-themes/phil71.png", label: "Dumplings · Blue", category: "food", tintSwatch: "#2A6DD9", downloadsBase: 34 },
  { id: "phil72-sushi-wood", url: "/nex-brand/shop-themes/phil72.png", label: "Sushi · Dark Wood", category: "food", tintSwatch: "#8B5A2B", downloadsBase: 41 },
  { id: "phil73-bread-yellow", url: "/nex-brand/shop-themes/phil73.png", label: "Bread · Golden", category: "food", tintSwatch: "#E8A82A", downloadsBase: 30 },
  { id: "phil74-donuts-brown", url: "/nex-brand/shop-themes/phil74.png", label: "Donuts · Brown", category: "food", tintSwatch: "#A0522D", downloadsBase: 44 },
  { id: "phil75-strawberry-cake", url: "/nex-brand/shop-themes/phil75.png", label: "Strawberry Cake · Pink", category: "food", tintSwatch: "#F08CA8", downloadsBase: 37 },
  { id: "phil76-bread-wheat-green", url: "/nex-brand/shop-themes/phil76.png", label: "Rustic Bread · Wheat", category: "food", tintSwatch: "#1F6F2B", downloadsBase: 28 },
  { id: "phil77-scones-blue", url: "/nex-brand/shop-themes/phil77.png", label: "Scones · Blue", category: "food", tintSwatch: "#2A6DD9", downloadsBase: 32 },
  { id: "phil78-croissants-orange", url: "/nex-brand/shop-themes/phil78.png", label: "Croissants · Golden", category: "food", tintSwatch: "#F0A82A", downloadsBase: 40 },

  // ── Kebab + shawarma · emerald glow (owner directive 2026-11-08) ──
  // Five portrait feast shots with vivid emerald-green ambient glow.
  // Server-side tint matches the dominant hue so the applied theme
  // colour tracks the background.
  { id: "kebab-smoky-green", url: "/nex-brand/shop-themes/kebab-smoky-green.png", label: "Kebab · Smoky Green", category: "food", tintSwatch: "#16D66B", downloadsBase: 0, isNew: true },
  { id: "kebab-cascading", url: "/nex-brand/shop-themes/kebab-cascading.png", label: "Kebab · Cascading Feast", category: "food", tintSwatch: "#16D66B", downloadsBase: 0, isNew: true },
  { id: "kebab-emerald-glow", url: "/nex-brand/shop-themes/kebab-emerald-glow.png", label: "Kebab · Emerald Glow", category: "food", tintSwatch: "#16D66B", downloadsBase: 0, isNew: true },
  { id: "shawarma-cinematic-emerald", url: "/nex-brand/shop-themes/shawarma-cinematic-emerald.png", label: "Shawarma · Cinematic Emerald", category: "food", tintSwatch: "#16D66B", downloadsBase: 0, isNew: true },
  { id: "kebab-green-kitchen", url: "/nex-brand/shop-themes/kebab-green-kitchen.png", label: "Kebab · Green Kitchen", category: "food", tintSwatch: "#16D66B", downloadsBase: 0, isNew: true },

  // ── Fashion · Women's · 23 tiles (owner directive 2026-11-08 round 10) ──
  // Source files from the owner's Pictures folder (fashion 1-11, 18-29).
  // tintSwatch cycles soft-pink / mauve / emerald / neutral so the
  // applied theme accent varies per tile · owner can override per-shop
  // via the sealed themes picker.
  { id: "fashion-womens-01", url: "/nex-brand/shop-themes/fashion-womens-01.png", label: "Fashion · Women's · 01", category: "fashion", tintSwatch: "#F08CB8", downloadsBase: 0, isNew: true },
  { id: "fashion-womens-02", url: "/nex-brand/shop-themes/fashion-womens-02.png", label: "Fashion · Women's · 02", category: "fashion", tintSwatch: "#D9C5A0", downloadsBase: 0, isNew: true },
  { id: "fashion-womens-03", url: "/nex-brand/shop-themes/fashion-womens-03.png", label: "Fashion · Women's · 03", category: "fashion", tintSwatch: "#8B3DD9", downloadsBase: 0, isNew: true },
  { id: "fashion-womens-04", url: "/nex-brand/shop-themes/fashion-womens-04.png", label: "Fashion · Women's · 04", category: "fashion", tintSwatch: "#C0001F", downloadsBase: 0, isNew: true },
  { id: "fashion-womens-05", url: "/nex-brand/shop-themes/fashion-womens-05.png", label: "Fashion · Women's · 05", category: "fashion", tintSwatch: "#0F5F2B", downloadsBase: 0, isNew: true },
  { id: "fashion-womens-06", url: "/nex-brand/shop-themes/fashion-womens-06.png", label: "Fashion · Women's · 06", category: "fashion", tintSwatch: "#F08CB8", downloadsBase: 0, isNew: true },
  { id: "fashion-womens-07", url: "/nex-brand/shop-themes/fashion-womens-07.png", label: "Fashion · Women's · 07", category: "fashion", tintSwatch: "#D9A83A", downloadsBase: 0, isNew: true },
  { id: "fashion-womens-08", url: "/nex-brand/shop-themes/fashion-womens-08.png", label: "Fashion · Women's · 08", category: "fashion", tintSwatch: "#1F3A6B", downloadsBase: 0, isNew: true },
  { id: "fashion-womens-09", url: "/nex-brand/shop-themes/fashion-womens-09.png", label: "Fashion · Women's · 09", category: "fashion", tintSwatch: "#9B6DD9", downloadsBase: 0, isNew: true },
  { id: "fashion-womens-10", url: "/nex-brand/shop-themes/fashion-womens-10.png", label: "Fashion · Women's · 10", category: "fashion", tintSwatch: "#F0A82A", downloadsBase: 0, isNew: true },
  { id: "fashion-womens-11", url: "/nex-brand/shop-themes/fashion-womens-11.png", label: "Fashion · Women's · 11", category: "fashion", tintSwatch: "#F08CB8", downloadsBase: 0, isNew: true },
  { id: "fashion-womens-18", url: "/nex-brand/shop-themes/fashion-womens-18.png", label: "Fashion · Women's · 12", category: "fashion", tintSwatch: "#2A6DD9", downloadsBase: 0, isNew: true },
  { id: "fashion-womens-19", url: "/nex-brand/shop-themes/fashion-womens-19.png", label: "Fashion · Women's · 13", category: "fashion", tintSwatch: "#0F5F2B", downloadsBase: 0, isNew: true },
  { id: "fashion-womens-20", url: "/nex-brand/shop-themes/fashion-womens-20.png", label: "Fashion · Women's · 14", category: "fashion", tintSwatch: "#D9C5A0", downloadsBase: 0, isNew: true },
  { id: "fashion-womens-21", url: "/nex-brand/shop-themes/fashion-womens-21.png", label: "Fashion · Women's · 15", category: "fashion", tintSwatch: "#8B3DD9", downloadsBase: 0, isNew: true },
  { id: "fashion-womens-22", url: "/nex-brand/shop-themes/fashion-womens-22.png", label: "Fashion · Women's · 16", category: "fashion", tintSwatch: "#C0001F", downloadsBase: 0, isNew: true },
  { id: "fashion-womens-23", url: "/nex-brand/shop-themes/fashion-womens-23.png", label: "Fashion · Women's · 17", category: "fashion", tintSwatch: "#F08CB8", downloadsBase: 0, isNew: true },
  { id: "fashion-womens-24", url: "/nex-brand/shop-themes/fashion-womens-24.png", label: "Fashion · Women's · 18", category: "fashion", tintSwatch: "#D9A83A", downloadsBase: 0, isNew: true },
  { id: "fashion-womens-25", url: "/nex-brand/shop-themes/fashion-womens-25.png", label: "Fashion · Women's · 19", category: "fashion", tintSwatch: "#1F3A6B", downloadsBase: 0, isNew: true },
  { id: "fashion-womens-26", url: "/nex-brand/shop-themes/fashion-womens-26.png", label: "Fashion · Women's · 20", category: "fashion", tintSwatch: "#9B6DD9", downloadsBase: 0, isNew: true },
  { id: "fashion-womens-27", url: "/nex-brand/shop-themes/fashion-womens-27.png", label: "Fashion · Women's · 21", category: "fashion", tintSwatch: "#F0A82A", downloadsBase: 0, isNew: true },
  { id: "fashion-womens-28", url: "/nex-brand/shop-themes/fashion-womens-28.png", label: "Fashion · Women's · 22", category: "fashion", tintSwatch: "#F08CB8", downloadsBase: 0, isNew: true },
  { id: "fashion-womens-29", url: "/nex-brand/shop-themes/fashion-womens-29.png", label: "Fashion · Women's · 23", category: "fashion", tintSwatch: "#0F5F2B", downloadsBase: 0, isNew: true },

  // ── Fashion · Men's · 6 tiles (owner directive 2026-11-08 round 10) ──
  // Source files fashion 12-17 · navy/charcoal/warm-brown palette.
  { id: "fashion-mens-12", url: "/nex-brand/shop-themes/fashion-mens-12.png", label: "Fashion · Men's · 01", category: "fashion", tintSwatch: "#1F3A6B", downloadsBase: 0, isNew: true },
  { id: "fashion-mens-13", url: "/nex-brand/shop-themes/fashion-mens-13.png", label: "Fashion · Men's · 02", category: "fashion", tintSwatch: "#2E3B52", downloadsBase: 0, isNew: true },
  { id: "fashion-mens-14", url: "/nex-brand/shop-themes/fashion-mens-14.png", label: "Fashion · Men's · 03", category: "fashion", tintSwatch: "#8B5A2B", downloadsBase: 0, isNew: true },
  { id: "fashion-mens-15", url: "/nex-brand/shop-themes/fashion-mens-15.png", label: "Fashion · Men's · 04", category: "fashion", tintSwatch: "#6B7F3A", downloadsBase: 0, isNew: true },
  { id: "fashion-mens-16", url: "/nex-brand/shop-themes/fashion-mens-16.png", label: "Fashion · Men's · 05", category: "fashion", tintSwatch: "#1F3A6B", downloadsBase: 0, isNew: true },
  { id: "fashion-mens-17", url: "/nex-brand/shop-themes/fashion-mens-17.png", label: "Fashion · Men's · 06", category: "fashion", tintSwatch: "#A0522D", downloadsBase: 0, isNew: true },

  // ── Freight · 6 tiles (owner directive 2026-11-08 round 10) ──
  // Source files fashion 30-35 · industrial / logistics palette.
  // Category 'delivery' matches the existing "Delivery & logistics"
  // filter · same filter chip surfaces these next to the delivery-
  // globe + logistics presets. If owner later wants a dedicated
  // Freight category chip, add it to CATEGORIES.
  { id: "freight-30", url: "/nex-brand/shop-themes/freight-30.png", label: "Freight · 01", category: "delivery", tintSwatch: "#4A6B7F", downloadsBase: 0, isNew: true },
  { id: "freight-31", url: "/nex-brand/shop-themes/freight-31.png", label: "Freight · 02", category: "delivery", tintSwatch: "#2E3B52", downloadsBase: 0, isNew: true },
  { id: "freight-32", url: "/nex-brand/shop-themes/freight-32.png", label: "Freight · 03", category: "delivery", tintSwatch: "#F0931F", downloadsBase: 0, isNew: true },
  { id: "freight-33", url: "/nex-brand/shop-themes/freight-33.png", label: "Freight · 04", category: "delivery", tintSwatch: "#8B939F", downloadsBase: 0, isNew: true },
  { id: "freight-34", url: "/nex-brand/shop-themes/freight-34.png", label: "Freight · 05", category: "delivery", tintSwatch: "#1F3A6B", downloadsBase: 0, isNew: true },
  { id: "freight-35", url: "/nex-brand/shop-themes/freight-35.png", label: "Freight · 06", category: "delivery", tintSwatch: "#4A6B7F", downloadsBase: 0, isNew: true },

  // ── Tool Hire · 6 tiles (owner directive 2026-11-08 round 11) ──
  // Source fashion 36-41 · industrial yellow/orange + utility grey.
  { id: "tool-hire-36", url: "/nex-brand/shop-themes/tool-hire-36.png", label: "Tool Hire · 01", category: "tools", tintSwatch: "#F0B82A", downloadsBase: 0, isNew: true },
  { id: "tool-hire-37", url: "/nex-brand/shop-themes/tool-hire-37.png", label: "Tool Hire · 02", category: "tools", tintSwatch: "#F0931F", downloadsBase: 0, isNew: true },
  { id: "tool-hire-38", url: "/nex-brand/shop-themes/tool-hire-38.png", label: "Tool Hire · 03", category: "tools", tintSwatch: "#8B939F", downloadsBase: 0, isNew: true },
  { id: "tool-hire-39", url: "/nex-brand/shop-themes/tool-hire-39.png", label: "Tool Hire · 04", category: "tools", tintSwatch: "#F0B82A", downloadsBase: 0, isNew: true },
  { id: "tool-hire-40", url: "/nex-brand/shop-themes/tool-hire-40.png", label: "Tool Hire · 05", category: "tools", tintSwatch: "#2E3B52", downloadsBase: 0, isNew: true },
  { id: "tool-hire-41", url: "/nex-brand/shop-themes/tool-hire-41.png", label: "Tool Hire · 06", category: "tools", tintSwatch: "#A0522D", downloadsBase: 0, isNew: true },

  // ── Wine · 6 tiles (owner directive 2026-11-08 round 11) ──
  // Source fashion 42-47 · wine · deep reds + warm amber + burgundy.
  // Category 'food' matches the existing "Food & grocery" chip since
  // NEX has no dedicated beverages category.
  { id: "wine-42", url: "/nex-brand/shop-themes/wine-42.png", label: "Wine · 01", category: "food", tintSwatch: "#8B0A1F", downloadsBase: 0, isNew: true },
  { id: "wine-43", url: "/nex-brand/shop-themes/wine-43.png", label: "Wine · 02", category: "food", tintSwatch: "#6B2D4A", downloadsBase: 0, isNew: true },
  { id: "wine-44", url: "/nex-brand/shop-themes/wine-44.png", label: "Wine · 03", category: "food", tintSwatch: "#C0001F", downloadsBase: 0, isNew: true },
  { id: "wine-45", url: "/nex-brand/shop-themes/wine-45.png", label: "Wine · 04", category: "food", tintSwatch: "#D9A83A", downloadsBase: 0, isNew: true },
  { id: "wine-46", url: "/nex-brand/shop-themes/wine-46.png", label: "Wine · 05", category: "food", tintSwatch: "#4A1A2B", downloadsBase: 0, isNew: true },
  { id: "wine-47", url: "/nex-brand/shop-themes/wine-47.png", label: "Wine · 06", category: "food", tintSwatch: "#8B0A1F", downloadsBase: 0, isNew: true },

  // ── Mobile phones · 4 tiles (owner directive 2026-11-08 round 11) ──
  // Source fashion 48-51 · electronics · chrome + slate + electric.
  { id: "mobile-phones-48", url: "/nex-brand/shop-themes/mobile-phones-48.png", label: "Mobile Phones · 01", category: "electronics", tintSwatch: "#2E3B52", downloadsBase: 0, isNew: true },
  { id: "mobile-phones-49", url: "/nex-brand/shop-themes/mobile-phones-49.png", label: "Mobile Phones · 02", category: "electronics", tintSwatch: "#8B939F", downloadsBase: 0, isNew: true },
  { id: "mobile-phones-50", url: "/nex-brand/shop-themes/mobile-phones-50.png", label: "Mobile Phones · 03", category: "electronics", tintSwatch: "#2A6DD9", downloadsBase: 0, isNew: true },
  { id: "mobile-phones-51", url: "/nex-brand/shop-themes/mobile-phones-51.png", label: "Mobile Phones · 04", category: "electronics", tintSwatch: "#1F3A6B", downloadsBase: 0, isNew: true },

  // ── Property sales · 6 tiles (owner directive 2026-11-08 round 11) ──
  // Source fashion 52-57 · property · cream/warm-wood/sunset palette.
  // Category 'showcase' matches the existing lifestyle filter.
  { id: "property-52", url: "/nex-brand/shop-themes/property-52.png", label: "Property Sales · 01", category: "showcase", tintSwatch: "#D9C5A0", downloadsBase: 0, isNew: true },
  { id: "property-53", url: "/nex-brand/shop-themes/property-53.png", label: "Property Sales · 02", category: "showcase", tintSwatch: "#8B5A2B", downloadsBase: 0, isNew: true },
  { id: "property-54", url: "/nex-brand/shop-themes/property-54.png", label: "Property Sales · 03", category: "showcase", tintSwatch: "#F0A82A", downloadsBase: 0, isNew: true },
  { id: "property-55", url: "/nex-brand/shop-themes/property-55.png", label: "Property Sales · 04", category: "showcase", tintSwatch: "#1F3A6B", downloadsBase: 0, isNew: true },
  { id: "property-56", url: "/nex-brand/shop-themes/property-56.png", label: "Property Sales · 05", category: "showcase", tintSwatch: "#6B7F3A", downloadsBase: 0, isNew: true },
  { id: "property-57", url: "/nex-brand/shop-themes/property-57.png", label: "Property Sales · 06", category: "showcase", tintSwatch: "#D9C5A0", downloadsBase: 0, isNew: true },

  // ── Building company · 6 tiles (owner directive 2026-11-08 round 11) ──
  // Source fashion 58-63 · construction · high-vis orange/hard-hat yellow.
  { id: "building-company-58", url: "/nex-brand/shop-themes/building-company-58.png", label: "Building Company · 01", category: "tools", tintSwatch: "#F0931F", downloadsBase: 0, isNew: true },
  { id: "building-company-59", url: "/nex-brand/shop-themes/building-company-59.png", label: "Building Company · 02", category: "tools", tintSwatch: "#F0B82A", downloadsBase: 0, isNew: true },
  { id: "building-company-60", url: "/nex-brand/shop-themes/building-company-60.png", label: "Building Company · 03", category: "tools", tintSwatch: "#A0522D", downloadsBase: 0, isNew: true },
  { id: "building-company-61", url: "/nex-brand/shop-themes/building-company-61.png", label: "Building Company · 04", category: "tools", tintSwatch: "#8B939F", downloadsBase: 0, isNew: true },
  { id: "building-company-62", url: "/nex-brand/shop-themes/building-company-62.png", label: "Building Company · 05", category: "tools", tintSwatch: "#F0931F", downloadsBase: 0, isNew: true },
  { id: "building-company-63", url: "/nex-brand/shop-themes/building-company-63.png", label: "Building Company · 06", category: "tools", tintSwatch: "#2E3B52", downloadsBase: 0, isNew: true },

  // ── Villa sales · 6 tiles (owner directive 2026-11-08 round 11) ──
  // Source fashion 64-69 · villa · mediterranean warm-stone palette.
  { id: "villa-64", url: "/nex-brand/shop-themes/villa-64.png", label: "Villa Sales · 01", category: "showcase", tintSwatch: "#D9C5A0", downloadsBase: 0, isNew: true },
  { id: "villa-65", url: "/nex-brand/shop-themes/villa-65.png", label: "Villa Sales · 02", category: "showcase", tintSwatch: "#5BA7D9", downloadsBase: 0, isNew: true },
  { id: "villa-66", url: "/nex-brand/shop-themes/villa-66.png", label: "Villa Sales · 03", category: "showcase", tintSwatch: "#0F5F2B", downloadsBase: 0, isNew: true },
  { id: "villa-67", url: "/nex-brand/shop-themes/villa-67.png", label: "Villa Sales · 04", category: "showcase", tintSwatch: "#F0A82A", downloadsBase: 0, isNew: true },
  { id: "villa-68", url: "/nex-brand/shop-themes/villa-68.png", label: "Villa Sales · 05", category: "showcase", tintSwatch: "#8B5A2B", downloadsBase: 0, isNew: true },
  { id: "villa-69", url: "/nex-brand/shop-themes/villa-69.png", label: "Villa Sales · 06", category: "showcase", tintSwatch: "#D9C5A0", downloadsBase: 0, isNew: true },

  // ── Timber frame · 1 tile (owner directive 2026-11-08 round 11) ──
  // Source fashion 70 · timber · warm wood.
  { id: "timber-frame-70", url: "/nex-brand/shop-themes/timber-frame-70.png", label: "Timber Frame · 01", category: "tools", tintSwatch: "#8B5A2B", downloadsBase: 0, isNew: true },

  // ── Building supplies · 10 tiles (owner directive 2026-11-08 round 11) ──
  // Source fashion 71-80 · building supplies · utility palette.
  { id: "building-supplies-71", url: "/nex-brand/shop-themes/building-supplies-71.png", label: "Building Supplies · 01", category: "tools", tintSwatch: "#8B939F", downloadsBase: 0, isNew: true },
  { id: "building-supplies-72", url: "/nex-brand/shop-themes/building-supplies-72.png", label: "Building Supplies · 02", category: "tools", tintSwatch: "#A0522D", downloadsBase: 0, isNew: true },
  { id: "building-supplies-73", url: "/nex-brand/shop-themes/building-supplies-73.png", label: "Building Supplies · 03", category: "tools", tintSwatch: "#F0B82A", downloadsBase: 0, isNew: true },
  { id: "building-supplies-74", url: "/nex-brand/shop-themes/building-supplies-74.png", label: "Building Supplies · 04", category: "tools", tintSwatch: "#2E3B52", downloadsBase: 0, isNew: true },
  { id: "building-supplies-75", url: "/nex-brand/shop-themes/building-supplies-75.png", label: "Building Supplies · 05", category: "tools", tintSwatch: "#F0931F", downloadsBase: 0, isNew: true },
  { id: "building-supplies-76", url: "/nex-brand/shop-themes/building-supplies-76.png", label: "Building Supplies · 06", category: "tools", tintSwatch: "#6B7F3A", downloadsBase: 0, isNew: true },
  { id: "building-supplies-77", url: "/nex-brand/shop-themes/building-supplies-77.png", label: "Building Supplies · 07", category: "tools", tintSwatch: "#8B5A2B", downloadsBase: 0, isNew: true },
  { id: "building-supplies-78", url: "/nex-brand/shop-themes/building-supplies-78.png", label: "Building Supplies · 08", category: "tools", tintSwatch: "#C0001F", downloadsBase: 0, isNew: true },
  { id: "building-supplies-79", url: "/nex-brand/shop-themes/building-supplies-79.png", label: "Building Supplies · 09", category: "tools", tintSwatch: "#8B939F", downloadsBase: 0, isNew: true },
  { id: "building-supplies-80", url: "/nex-brand/shop-themes/building-supplies-80.png", label: "Building Supplies · 10", category: "tools", tintSwatch: "#F0B82A", downloadsBase: 0, isNew: true },

  // ── Tools & trade ──
  { id: "phil79-power-drills-yellow", url: "/nex-brand/shop-themes/phil79.png", label: "Power Drills · Yellow", category: "tools", tintSwatch: "#F0B82A", downloadsBase: 38 },
  { id: "phil80-wrenches-blue", url: "/nex-brand/shop-themes/phil80.png", label: "Wrenches · Blue", category: "tools", tintSwatch: "#2A6DD9", downloadsBase: 33 },
  { id: "phil81-hammer-saw-wood", url: "/nex-brand/shop-themes/phil81.png", label: "Carpentry · Wood Bench", category: "tools", tintSwatch: "#A0522D", downloadsBase: 29, isNew: true },
  { id: "phil82-wrenches-red-metal", url: "/nex-brand/shop-themes/phil82.png", label: "Wrenches · Red Metal", category: "tools", tintSwatch: "#B1203D", downloadsBase: 31 },
  { id: "phil83-hard-hat-orange", url: "/nex-brand/shop-themes/phil83.png", label: "Hard Hat · Orange", category: "tools", tintSwatch: "#F0931F", downloadsBase: 36 },
  { id: "phil84-garden-tools", url: "/nex-brand/shop-themes/phil84.png", label: "Garden Tools · Green", category: "tools", tintSwatch: "#1F7F3F", downloadsBase: 27 },

  // ── Baby + kids clothing · fashion ──
  { id: "phil85-baby-blue-teddy", url: "/nex-brand/shop-themes/phil85.png", label: "Baby Blue · Teddy", category: "fashion", tintSwatch: "#5BA7D9", downloadsBase: 42 },
  { id: "phil86-baby-pink-bunny", url: "/nex-brand/shop-themes/phil86.png", label: "Baby Pink · Bunny", category: "fashion", tintSwatch: "#F08CB8", downloadsBase: 48, isNew: true },
  { id: "phil87-baby-cream-teddy", url: "/nex-brand/shop-themes/phil87.png", label: "Baby Cream · Teddy", category: "fashion", tintSwatch: "#D9C5A0", downloadsBase: 34 },
  { id: "phil88-baby-green-dino", url: "/nex-brand/shop-themes/phil88.png", label: "Baby Green · Dino", category: "fashion", tintSwatch: "#5FC97B", downloadsBase: 39 },
  { id: "phil89-baby-yellow-giraffe", url: "/nex-brand/shop-themes/phil89.png", label: "Baby Yellow · Giraffe", category: "fashion", tintSwatch: "#F0C82A", downloadsBase: 36 },
  { id: "phil90-baby-lilac-sheep", url: "/nex-brand/shop-themes/phil90.png", label: "Baby Lilac · Sheep", category: "fashion", tintSwatch: "#9B6DD9", downloadsBase: 41, isNew: true },

  // Owner directive 2026-11-07 (fifth batch) · 25 tt* tiles.
  // Interior/lighting (tt1-tt6 · showcase) + luxury handbags
  // (tt9-tt27 · fashion). tt7/tt8 gap preserved.

  // ── Interior · lighting · showcase (6) ──
  { id: "tt1-blue-chair-lamp", url: "/nex-brand/shop-themes/tt1.png", label: "Blue Armchair · Pendant", category: "showcase", tintSwatch: "#2E3B52", downloadsBase: 29, isNew: true },
  { id: "tt2-gold-rings-sofa", url: "/nex-brand/shop-themes/tt2.png", label: "Gold Rings · Cream Sofa", category: "showcase", tintSwatch: "#D9C5A0", downloadsBase: 34 },
  { id: "tt3-navy-bulb-bed", url: "/nex-brand/shop-themes/tt3.png", label: "Navy Bedroom · Edison Bulb", category: "showcase", tintSwatch: "#1F3A6B", downloadsBase: 26 },
  { id: "tt4-brown-leather-chair", url: "/nex-brand/shop-themes/tt4.png", label: "Brown Leather · Warm Light", category: "showcase", tintSwatch: "#8B5A2B", downloadsBase: 31, isNew: true },
  { id: "tt5-olive-wood-sideboard", url: "/nex-brand/shop-themes/tt5.png", label: "Olive · Wood Sideboard", category: "showcase", tintSwatch: "#6B7F3A", downloadsBase: 24 },
  { id: "tt6-chrome-orchid", url: "/nex-brand/shop-themes/tt6.png", label: "Chrome · Orchid", category: "showcase", tintSwatch: "#8B939F", downloadsBase: 28 },

  // ── Luxury handbags · fashion (19) ──
  { id: "tt9-red-quilted-bag", url: "/nex-brand/shop-themes/tt9.png", label: "Red Quilted · Crimson", category: "fashion", tintSwatch: "#C0001F", downloadsBase: 52, isNew: true },
  { id: "tt10-navy-tote-silk", url: "/nex-brand/shop-themes/tt10.png", label: "Navy Tote · Silk", category: "fashion", tintSwatch: "#1F3A6B", downloadsBase: 44 },
  { id: "tt11-cream-tote-tan", url: "/nex-brand/shop-themes/tt11.png", label: "Cream Tote · Tan", category: "fashion", tintSwatch: "#D9C5A0", downloadsBase: 38 },
  { id: "tt12-emerald-bag-silk", url: "/nex-brand/shop-themes/tt12.png", label: "Emerald Bag · Silk", category: "fashion", tintSwatch: "#0F5F2B", downloadsBase: 41 },
  { id: "tt13-purple-bag-smoke", url: "/nex-brand/shop-themes/tt13.png", label: "Purple Bag · Smoke", category: "fashion", tintSwatch: "#8B3DD9", downloadsBase: 36 },
  { id: "tt14-tan-set-black-gold", url: "/nex-brand/shop-themes/tt14.png", label: "Tan Set · Black & Gold", category: "fashion", tintSwatch: "#C0821F", downloadsBase: 47, isNew: true },
  { id: "tt15-tan-set-navy-rays", url: "/nex-brand/shop-themes/tt15.png", label: "Tan Set · Navy Rays", category: "fashion", tintSwatch: "#1F3A6B", downloadsBase: 42 },
  { id: "tt16-tan-set-red-silk", url: "/nex-brand/shop-themes/tt16.png", label: "Tan Set · Red Silk", category: "fashion", tintSwatch: "#C0001F", downloadsBase: 49 },
  { id: "tt17-tan-set-cream-arch", url: "/nex-brand/shop-themes/tt17.png", label: "Tan Set · Cream Arch", category: "fashion", tintSwatch: "#D9C5A0", downloadsBase: 35 },
  { id: "tt18-tan-set-emerald", url: "/nex-brand/shop-themes/tt18.png", label: "Tan Set · Emerald Marble", category: "fashion", tintSwatch: "#0F5F2B", downloadsBase: 43 },
  { id: "tt19-tan-set-purple", url: "/nex-brand/shop-themes/tt19.png", label: "Tan Set · Purple Haze", category: "fashion", tintSwatch: "#8B3DD9", downloadsBase: 37 },
  { id: "tt20-falling-tan-cream", url: "/nex-brand/shop-themes/tt20.png", label: "Falling Bags · Cream", category: "fashion", tintSwatch: "#D9C5A0", downloadsBase: 46, isNew: true },
  { id: "tt21-falling-tan-pale", url: "/nex-brand/shop-themes/tt21.png", label: "Falling Bags · Pale", category: "fashion", tintSwatch: "#D9C5A0", downloadsBase: 39 },
  { id: "tt22-cream-gold-float", url: "/nex-brand/shop-themes/tt22.png", label: "Cream & Gold · Float", category: "fashion", tintSwatch: "#D9C5A0", downloadsBase: 44 },
  { id: "tt23-black-gold-ribbon", url: "/nex-brand/shop-themes/tt23.png", label: "Black Bags · Gold Ribbon", category: "fashion", tintSwatch: "#D9A83A", downloadsBase: 51, isNew: true },
  { id: "tt24-pink-float-silk", url: "/nex-brand/shop-themes/tt24.png", label: "Pink · Silk Float", category: "fashion", tintSwatch: "#F08CB8", downloadsBase: 48, isNew: true },
  { id: "tt25-navy-float-swirl", url: "/nex-brand/shop-themes/tt25.png", label: "Navy · Swirl Float", category: "fashion", tintSwatch: "#1F3A6B", downloadsBase: 40 },
  { id: "tt26-red-float-gold", url: "/nex-brand/shop-themes/tt26.png", label: "Red · Gold Float", category: "fashion", tintSwatch: "#C0001F", downloadsBase: 45 },
  { id: "tt27-emerald-float-silk", url: "/nex-brand/shop-themes/tt27.png", label: "Emerald · Silk Float", category: "fashion", tintSwatch: "#0F5F2B", downloadsBase: 42 },

  // Owner directive 2026-11-07 (sixth batch) · 15 bb* tiles.
  // Travel/outdoors backpacks + luggage (bb1-10) + shoes (bb11-15).

  // ── Travel · backpacks + luggage (10) ──
  { id: "bb1-orange-backpack-sunset", url: "/nex-brand/shop-themes/bb1.png", label: "Orange Backpack · Mountain Sunset", category: "travel", tintSwatch: "#FF7A2B", downloadsBase: 54, isNew: true },
  { id: "bb2-green-pack-forest", url: "/nex-brand/shop-themes/bb2.png", label: "Green Pack · Forest Lantern", category: "travel", tintSwatch: "#1F6F2B", downloadsBase: 42 },
  { id: "bb3-urban-pack-skyline", url: "/nex-brand/shop-themes/bb3.png", label: "Urban Pack · City Skyline", category: "travel", tintSwatch: "#2A6DD9", downloadsBase: 46 },
  { id: "bb4-blue-pack-snow", url: "/nex-brand/shop-themes/bb4.png", label: "Blue Pack · Snow Peak", category: "travel", tintSwatch: "#5BA7D9", downloadsBase: 39, isNew: true },
  { id: "bb5-tan-pack-desert", url: "/nex-brand/shop-themes/bb5.png", label: "Tan Pack · Desert Dunes", category: "travel", tintSwatch: "#D9A86A", downloadsBase: 37 },
  { id: "bb6-magenta-pack-twilight", url: "/nex-brand/shop-themes/bb6.png", label: "Magenta Pack · Twilight Hills", category: "travel", tintSwatch: "#8B3DD9", downloadsBase: 44 },
  { id: "bb7-beach-pack-palm-sunset", url: "/nex-brand/shop-themes/bb7.png", label: "Beach Pack · Palm Sunset", category: "travel", tintSwatch: "#F0A82A", downloadsBase: 51, isNew: true },
  { id: "bb8-lake-pack-reflection", url: "/nex-brand/shop-themes/bb8.png", label: "Lake Pack · Reflection", category: "travel", tintSwatch: "#2A6DD9", downloadsBase: 41 },
  { id: "bb9-red-pack-campfire-night", url: "/nex-brand/shop-themes/bb9.png", label: "Red Pack · Campfire Night", category: "travel", tintSwatch: "#D9452A", downloadsBase: 48 },
  { id: "bb10-roller-luggage-plane", url: "/nex-brand/shop-themes/bb10.png", label: "Roller Luggage · Airport Horizon", category: "travel", tintSwatch: "#4A6B8C", downloadsBase: 43 },

  // ── Fashion · shoes (5) ──
  { id: "bb11-dress-shoes-gold", url: "/nex-brand/shop-themes/bb11.png", label: "Leather Dress Shoes · Gold", category: "fashion", tintSwatch: "#C0821F", downloadsBase: 38, isNew: true },
  { id: "bb12-runners-neon-blue", url: "/nex-brand/shop-themes/bb12.png", label: "Runners · Neon Blue", category: "fashion", tintSwatch: "#2A6DD9", downloadsBase: 46 },
  { id: "bb13-hiking-boots-mountain", url: "/nex-brand/shop-themes/bb13.png", label: "Hiking Boots · Mountain", category: "fashion", tintSwatch: "#D9823B", downloadsBase: 35 },
  { id: "bb14-suede-loafers-brown", url: "/nex-brand/shop-themes/bb14.png", label: "Suede Loafers · Brown Wall", category: "fashion", tintSwatch: "#8B5A2B", downloadsBase: 32 },
  { id: "bb15-sneakers-city-night", url: "/nex-brand/shop-themes/bb15.png", label: "Sneakers · City Night", category: "fashion", tintSwatch: "#D92A2A", downloadsBase: 49, isNew: true },
];

// Owner directive 2026-11-06 · "libary must have previous and
// back after 20 themes displaying". Hard cap of 20 tiles per
// page · when the filtered catalogue exceeds 20 the prev/next
// arrows + "N / Total" count appear below the grid.
const PRESETS_PER_PAGE = 20;

interface Props {
  readonly businessId: string | null;
  readonly currentImageUrl: string | null;
  // Owner directive 2026-11-12 (fifth pass) · the preview overlay
  // renders the user's previously chosen template with the candidate
  // background behind it. Both come from nex_business via the server
  // page. tintHex is optional · when null the template's own accent
  // paints through.
  readonly currentLayoutId: string;
  readonly currentTintHex: string | null;
}

export function ShopBackgroundsClient({
  businessId,
  currentImageUrl,
  currentLayoutId,
  currentTintHex,
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

  // Owner directive 2026-11-12 · tile tap no longer applies the
  // background directly · it opens a container-view preview that
  // paints the chosen image full-bleed inside the sealed phone
  // silhouette. The user confirms with "Use background" (which then
  // hits applyShopPresetBackgroundAction) or dismisses with the
  // top-right close button. Keeps the tile grid clean of accidental
  // taps and gives the user a proper "try before you apply" step.
  const [preview, setPreview] = React.useState<ShopBackgroundPreset | null>(
    null,
  );

  // Reset to page 0 when the category filter changes so the owner
  // always lands on the first page of the newly filtered set.
  React.useEffect(() => {
    setPage(0);
  }, [selectedCategory]);

  // Owner directive 2026-11-12 · "All" view (first visit default)
  // now paints a mixed deck of backgrounds across every category so
  // the owner sees variety immediately instead of a long run of one
  // category at the top. Shuffle is session-stable (memoised once per
  // mount) so pagination stays coherent while the user is browsing.
  // Fisher-Yates with a mulberry32 PRNG seeded from a per-mount
  // random so it looks different each visit but doesn't reshuffle
  // mid-browse.
  const shuffleSeed = React.useRef<number>(Math.floor(Math.random() * 0xffffffff));
  const shuffledAll = React.useMemo(() => {
    const out = [...PRESETS];
    // mulberry32 · tiny, fast, deterministic from the seed
    let s = shuffleSeed.current >>> 0;
    const rand = () => {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [out[i]!, out[j]!] = [out[j]!, out[i]!];
    }
    return out;
  }, []);

  const filtered = React.useMemo(
    () =>
      selectedCategory === "all"
        ? shuffledAll
        : PRESETS.filter((p) => p.category === selectedCategory),
    [selectedCategory, shuffledAll],
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

  // Owner directive 2026-11-12 · onPick is now a preview opener,
  // NOT an apply action. Previews ALWAYS open on tap · even when
  // businessId is null (first-visit / pre-business-row flows) so the
  // owner can always see the chosen background against their template.
  // The DB-write guard now lives in onConfirmPreview below.
  function onPick(preset: ShopBackgroundPreset) {
    setPreview(preset);
  }

  function onConfirmPreview() {
    const preset = preview;
    if (!preset || !businessId) return;
    setStatus({ kind: "applying", id: preset.id });
    startTransition(async () => {
      const result = await applyShopPresetBackgroundAction(
        businessId,
        preset.url,
      );
      if (result.ok) {
        setStatus({ kind: "ok", id: preset.id });
        // Owner directive 2026-11-12 (eleventh pass) · after "Use
        // Theme" success the owner lands on the sealed shop-setup
        // dispatcher (`/manage/shop/setup`), which 307s to the FIRST
        // INCOMPLETE step of the 8-step wizard (identity → location
        // → category → hours → story → policies → contact → finish).
        // Previously the flow dropped back to /manage/shop/themes,
        // which stranded new sellers before they'd entered their
        // shop name · logo · address · category · hours. The smart
        // dispatcher ensures each seller finishes the setup ladder
        // in order, with partial progress preserved across resumes.
        setTimeout(() => {
          router.push("/nex-native/manage/shop/setup");
        }, 650);
      } else {
        setStatus({ kind: "error", message: result.error });
        setPreview(null);
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
      {/* Owner directive 2026-11-12 (third pass) · hero text now reads
          as a small subtitle ("Choose Shop background") · the main
          "Shop Backgrounds" title has been promoted into the global
          NexPageHeader on page.tsx. This keeps the hero slot airy and
          doesn't double up on the title. */}
      <h2
        style={{
          margin: 0,
          fontSize: 13,
          fontWeight: 700,
          color: "#000000",
          letterSpacing: "0.01em",
          lineHeight: 1.3,
        }}
      >
        Choose Shop background
      </h2>

      {/* Owner directive 2026-11-12 · dropdown restyled to the
          chat-themes picker shape · orange label · pill trigger with
          dark surface + orange chevron · no per-option emoji. Native
          <select> kept so mobile keeps its OS-level overlay instead
          of a bespoke popover · visual parity is close without the
          added complexity of a custom panel. */}
      <section aria-label="Filter by category">
        <label
          htmlFor="nex-shop-bg-category"
          style={{
            display: "block",
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#FF7200",
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
              // Owner directive 2026-11-12 · dropdown pill now paints
              // NEX Orange (#FF7200) with white ink · supersedes the
              // dark-navy fill from 2026-11-12 first pass. Chevron
              // swaps to white to stay legible on the orange ground.
              appearance: "none",
              WebkitAppearance: "none",
              MozAppearance: "none",
              width: "100%",
              padding: "12px 42px 12px 18px",
              background: "#FF7200",
              color: "#FFFFFF",
              border: "1px solid #E66800",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 800,
              fontFamily: "inherit",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.35)",
            }}
          >
            {CATEGORIES.map((c) => {
              const count =
                c.id === "all"
                  ? PRESETS.length
                  : PRESETS.filter((p) => p.category === c.id).length;
              return (
                <option key={c.id} value={c.id}>
                  {c.label} · {count}
                </option>
              );
            })}
          </select>
          <span
            aria-hidden
            style={{
              position: "absolute",
              right: 16,
              pointerEvents: "none",
              // Owner directive 2026-11-12 · chevron paints white
              // to stay legible on the new orange pill ground.
              color: "#FFFFFF",
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
            // Owner directive 2026-11-12 · tiles stay tappable even
            // when businessId is null so the preview popup ALWAYS
            // opens · user needs to see the template + background
            // combination before anything else. `pending` still
            // disables every tile while a write is mid-flight.
            disabled={pending}
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
        powered by NEX
      </footer>

      {/* Owner directive 2026-11-12 (sixth pass) · preview overlay
          renders INSIDE the phone-frame (no portal) so it stays
          clipped to the sealed .nex-native-frame app surface and
          never extends beyond the phone silhouette. Previously
          portaled to document.body · owner reported the overlay
          was painting the full desktop viewport instead of staying
          inside the app screen. */}
      {preview ? (
        <ShopBackgroundPreview
          preset={preview}
          layoutId={currentLayoutId}
          tintHex={currentTintHex}
          applying={
            status.kind === "applying" && status.id === preview.id
          }
          onClose={() => setPreview(null)}
          onConfirm={onConfirmPreview}
        />
      ) : null}
    </div>
  );
}

// ─── Background preview container ───────────────────────────────────
// Owner directive 2026-11-12 (fifth pass) · the preview is no longer a
// static image swap · it paints the user's PREVIOUSLY SELECTED shop
// template (nex_business.cover_layout_id) with the candidate
// background behind it, so the owner sees the exact combined result
// before confirming. Same iframe + ?embed=1 mechanism as the themes
// picker. Close × dismisses without applying; "Use Theme" fires
// applyShopPresetBackgroundAction and redirects back to /manage/shop/
// themes. The owner can close and pick another tile · the overlay
// re-opens with the newly chosen background on the same saved
// template.

function ShopBackgroundPreview({
  preset,
  layoutId,
  tintHex,
  applying,
  onClose,
  onConfirm,
}: {
  preset: ShopBackgroundPreset;
  layoutId: string;
  tintHex: string | null;
  applying: boolean;
  onClose: () => void;
  onConfirm: () => void;
}): React.JSX.Element {
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Owner directive 2026-11-12 (tenth pass) · tint source corrected.
  // The preview MUST show the preset's own auto-match tint
  // (preset.tintSwatch) · that's what applyShopPresetBackgroundAction
  // actually writes to the DB via PRESET_BACKGROUND_META. Before this
  // fix the preview was threading `currentTintHex` (the user's PRIOR
  // saved tint) · so every popup painted the same stale colour
  // regardless of which background was chosen. The `tintHex` prop is
  // retained on the component for future "preserve current tint"
  // callers but isn't used in the preview URL today.
  const effectiveTintHex = preset.tintSwatch;
  // Keep tintHex referenced so TS doesn't drop it from the Props
  // surface · it still carries a valid signal for other UI (e.g.
  // the Shop Themes picker) that may want the user's prior tint.
  void tintHex;
  const previewSrc = React.useMemo(() => {
    const bgParam = `&bg=${encodeURIComponent(preset.url)}`;
    const tintParam = effectiveTintHex
      ? `&tint=${encodeURIComponent(effectiveTintHex)}`
      : "";
    return `/nex-native/cover/preview/${layoutId}?embed=1${bgParam}${tintParam}`;
  }, [layoutId, preset.url, effectiveTintHex]);

  return (
    <div
      data-nex-shop-bg-preview
      role="dialog"
      aria-modal="true"
      aria-label={`Preview template with ${preset.label}`}
      style={{
        // Owner directive 2026-11-12 (sixth pass) · overlay is now
        // absolute (not fixed) so it scopes to the parent `main`
        // (position:absolute inset:0 inside the sealed phone-frame).
        // That clips the popup to the app screen · no spill into the
        // desktop viewport outside the phone silhouette.
        position: "absolute",
        inset: 0,
        zIndex: 60,
        background: "#FAF8F4",
        display: "flex",
        flexDirection: "column",
        padding: "10px 12px",
        gap: 10,
        boxSizing: "border-box",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Owner directive 2026-11-12 (eighth pass) · page-level header
          sits ABOVE the phone-shaped preview · label on the left, an
          orange × close button on the right. Lives outside the iframe
          container so close is always reachable without competing
          with the template content inside. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          flexShrink: 0,
        }}
      >
        {/* Owner directive 2026-11-12 (ninth pass) · header text
            promoted to a two-line stack · bold "Back Ground Theme"
            label on top, the preset's full name (e.g. "Online Sale ·
            Gold Phone") underneath in a smaller, lighter weight. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            minWidth: 0,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 900,
              letterSpacing: "0.04em",
              color: "#1A120A",
              lineHeight: 1.1,
            }}
          >
            Back Ground Theme
          </div>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              letterSpacing: "0.02em",
              color: "#5A4A33",
              lineHeight: 1.2,
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {preset.label}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          data-nex-shop-bg-preview-close
          style={{
            flexShrink: 0,
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "#FF7200",
            color: "#FFFFFF",
            border: "none",
            fontSize: 22,
            fontWeight: 900,
            lineHeight: 1,
            cursor: "pointer",
            display: "grid",
            placeItems: "center",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.25)",
          }}
        >
          ×
        </button>
      </div>

      {/* Phone-shaped preview container · flex-1 · fills the middle
          between the header and the footer. No overlay controls
          inside · the iframe paints edge-to-edge. */}
      <div
        style={{
          position: "relative",
          flex: 1,
          minHeight: 0,
          width: "100%",
          maxWidth: 420,
          aspectRatio: "9 / 19.5",
          margin: "0 auto",
          borderRadius: 24,
          overflow: "hidden",
          background: "#020914",
          boxShadow:
            "0 16px 36px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(0, 0, 0, 0.08) inset",
        }}
      >
        <iframe
          src={previewSrc}
          title={`Template preview with ${preset.label}`}
          loading="eager"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            border: "none",
            background: "transparent",
          }}
        />
      </div>

      {/* Owner directive 2026-11-12 (eighth pass) · page-level footer
          · orange "Use Theme" pill centred. Only this button writes
          to the DB · close dismisses with no persistence. */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          flexShrink: 0,
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <button
          type="button"
          onClick={onConfirm}
          disabled={applying}
          data-nex-shop-bg-preview-use
          style={{
            padding: "12px 32px",
            fontSize: 13,
            fontWeight: 900,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#FFFFFF",
            background: applying
              ? "rgba(255, 114, 0, 0.7)"
              : "#FF7200",
            border: "1px solid #E66800",
            borderRadius: 999,
            cursor: applying ? "wait" : "pointer",
            fontFamily: "inherit",
            boxShadow: "0 6px 18px rgba(255, 114, 0, 0.35)",
          }}
        >
          {applying ? "Applying…" : "Use Theme"}
        </button>
      </div>
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
        // Owner directive 2026-11-12 · tiles match the sealed chat-
        // themes-library phone-silhouette card: transparent outer
        // (no SURFACE pad), active state uses the preset's tint
        // swatch as the border + glow colour (was gold for all).
        display: "flex",
        flexDirection: "column",
        gap: 0,
        padding: 0,
        background: "transparent",
        border: "none",
        // Owner directive 2026-11-12 · cursor stays pointer even
        // without a saved business row · tap always opens the
        // preview popup. The "Use Theme" confirm button is where
        // the businessId guard now lives.
        cursor: "pointer",
        color: INK,
        textAlign: "left",
        overflow: "visible",
        transition:
          "border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease",
      }}
    >
      <div
        aria-hidden
        /* Owner directive 2026-11-12 · phone-silhouette inner card ·
           matches chat-themes-library tile (9:18 aspect, 20px radius,
           dark NEX bg, cyan border by default / tint border + glow
           when current). Image paints full-bleed with cover. */
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "9 / 18",
          borderRadius: 20,
          overflow: "hidden",
          background: "#020914",
          border:
            isCurrent || isApplied
              ? `1px solid ${preset.tintSwatch}`
              : "1px solid rgba(0, 175, 255, 0.28)",
          boxShadow:
            isCurrent || isApplied
              ? `0 0 18px ${preset.tintSwatch}55`
              : "0 2px 10px rgba(0, 0, 0, 0.35)",
          backgroundImage: `url(${preset.url})`,
          backgroundSize: "cover",
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
          /* Owner directive 2026-11-12 · NEW badge repainted NEX
             yellow (#FFD600) · supersedes the 2026-11-06 gold fill.
             Dark-ink glyph keeps the label legible on the bright
             yellow pill. */
          <span style={{ ...pillStyle, background: "#FFD600", color: "#1A120A" }}>
            New
          </span>
        ) : null}

        {/* Owner directive 2026-11-12 · download count + 📥 glyph
            moved from the bottom row to an overlay on the image's
            bottom-left corner. Semi-transparent dark pill so it reads
            over any backdrop. Supersedes the 2026-11-06 under-image
            placement. */}
        <div
          data-nex-shop-bg-downloads={preset.id}
          style={{
            position: "absolute",
            bottom: 8,
            left: 8,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "3px 8px",
            borderRadius: 999,
            background: "rgba(0, 0, 0, 0.55)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            fontSize: 10.5,
            fontWeight: 700,
            color: "#FFFFFF",
          }}
        >
          <span aria-hidden style={{ fontSize: 11 }}>📥</span>
          <span
            style={{
              fontWeight: 900,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {/* Owner-sealed 2026-11-07 · pin locale to en-US · same
                hydration-mismatch fix as /manage/shop/themes _client. */}
            {downloads.toLocaleString("en-US")}
          </span>
        </div>
      </div>
      <div
        style={{
          padding: "8px 10px 10px",
          display: "flex",
          flexDirection: "column",
          gap: 3,
        }}
      >
        {/* Owner directive 2026-11-12 · tile caption · preset label
            paints black · category subtitle paints gray so the two
            lines read as a quiet two-tone footer below the image.
            Second pass: force single-line with ellipsis overflow so
            long names like "Celebration · Champagne Gold" don't wrap
            and wreck the row rhythm. */}
        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            color: "#000000",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={preset.label}
        >
          {preset.label}
        </div>
        <div
          style={{
            fontSize: 10,
            color: "#9A9A9A",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {CATEGORIES.find((c) => c.id === preset.category)?.label ??
            preset.category}
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
        // Owner directive 2026-11-12 · pagination arrows paint SOLID
        // BLACK with white glyphs · matches the sealed global "+"
        // drawer button + the themes-picker arrow pills. Supersedes
        // the translucent-navy + gold variant that was hard to read
        // on the Golden Holiday backdrop.
        appearance: "none",
        width: 40,
        height: 40,
        borderRadius: "50%",
        border: "none",
        background: "#000000",
        color: "#FFFFFF",
        fontSize: 22,
        fontWeight: 900,
        lineHeight: 1,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.35 : 1,
        display: "grid",
        placeItems: "center",
        transition: "opacity 140ms ease",
        boxShadow: "0 2px 8px rgba(0,0,0,0.45)",
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
