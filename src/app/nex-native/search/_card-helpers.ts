// src/app/nex-native/search/_card-helpers.ts
//
// Pure helpers for NEX Discover shop cards. Importable from server
// + client. No DB, no network.
//
//   · isOpenNow            · parse nex_business.hours vs a given Date
//   · categoryGradient     · per-category hero gradient for the cover
//                            fallback (when no logo / product image)
//   · categoryTypeLabel    · "Restaurant" / "Service" / "Shop" / etc.

import type { NexWeeklyHours } from "@/lib/nex-native/types";

export type OpenStatus =
  | { readonly state: "open"; readonly closesAt: string }
  | { readonly state: "closed"; readonly opensNext: string | null }
  | { readonly state: "unknown" };

const DAY_KEYS: readonly (keyof NexWeeklyHours)[] = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
];

const DAY_LABELS: Record<keyof NexWeeklyHours, string> = {
  sun: "Sun",
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
};

/** Resolve open/closed status against a weekly-hours jsonb value.
 *  Hour shape: `{ mon: { open: "08:00", close: "17:00" } | null, ... }`.
 *  `now` is passed in for testability. Returns `{state:"unknown"}`
 *  when the hours field is missing / malformed. */
export function isOpenNow(
  hours: NexWeeklyHours | null | undefined,
  now: Date = new Date(),
): OpenStatus {
  if (!hours || typeof hours !== "object") return { state: "unknown" };
  const dayIndex = now.getDay(); // 0 = Sun
  const todayKey = DAY_KEYS[dayIndex];
  const today = hours[todayKey];
  const minutesNow = now.getHours() * 60 + now.getMinutes();

  if (today && typeof today === "object") {
    const openMins = parseHHMM(today.open);
    const closeMins = parseHHMM(today.close);
    if (openMins !== null && closeMins !== null && closeMins > openMins) {
      if (minutesNow >= openMins && minutesNow < closeMins) {
        return { state: "open", closesAt: today.close };
      }
    }
  }
  // Not open now · look ahead up to 7 days for the next opening.
  for (let i = 0; i < 7; i++) {
    const idx = (dayIndex + i) % 7;
    const key = DAY_KEYS[idx];
    const slot = hours[key];
    if (slot && typeof slot === "object") {
      const openMins = parseHHMM(slot.open);
      if (openMins === null) continue;
      if (i === 0 && minutesNow < openMins) {
        return { state: "closed", opensNext: `today at ${slot.open}` };
      }
      if (i > 0) {
        return {
          state: "closed",
          opensNext:
            i === 1 ? `tomorrow at ${slot.open}` : `${DAY_LABELS[key]} at ${slot.open}`,
        };
      }
    }
  }
  return { state: "closed", opensNext: null };
}

function parseHHMM(s: string | null | undefined): number | null {
  if (typeof s !== "string") return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(h) || h < 0 || h > 24) return null;
  if (!Number.isFinite(mm) || mm < 0 || mm > 59) return null;
  return h * 60 + mm;
}

// ── Category → cover fallback ──────────────────────────────────────

interface CategoryTheme {
  readonly hue: number;
  readonly emoji: string;
  readonly kind: "Restaurant" | "Café" | "Bakery" | "Service" | "Shop" | "Hotel" | "Villa";
}

const CATEGORY_THEMES: Record<string, CategoryTheme> = {
  restaurant: { hue: 18, emoji: "🍽", kind: "Restaurant" },
  cafe: { hue: 30, emoji: "☕", kind: "Café" },
  bakery: { hue: 42, emoji: "🥐", kind: "Bakery" },
  "ice-cream": { hue: 320, emoji: "🍦", kind: "Café" },
  "dessert-shop": { hue: 340, emoji: "🧁", kind: "Café" },
  "drinks-shop": { hue: 200, emoji: "🥤", kind: "Café" },
  "juice-bar": { hue: 90, emoji: "🧃", kind: "Café" },
  salon: { hue: 290, emoji: "💇", kind: "Service" },
  beauty: { hue: 310, emoji: "💅", kind: "Service" },
  fitness: { hue: 150, emoji: "💪", kind: "Service" },
  consultant: { hue: 210, emoji: "💼", kind: "Service" },
  agency: { hue: 230, emoji: "🏢", kind: "Service" },
  tradesperson: { hue: 220, emoji: "🔧", kind: "Service" },
  construction: { hue: 25, emoji: "🏗", kind: "Service" },
  "staircase-company": { hue: 25, emoji: "🏗", kind: "Service" },
  ecommerce: { hue: 260, emoji: "🛍", kind: "Shop" },
  "product-brand": { hue: 270, emoji: "🏷", kind: "Shop" },
  "local-service": { hue: 180, emoji: "🧰", kind: "Service" },
  portfolio: { hue: 240, emoji: "🎨", kind: "Service" },
  community: { hue: 200, emoji: "🫂", kind: "Service" },
  event: { hue: 340, emoji: "🎉", kind: "Service" },
  creator: { hue: 300, emoji: "🎥", kind: "Service" },
  "professional-service": { hue: 215, emoji: "⚖️", kind: "Service" },
  accommodation: { hue: 190, emoji: "🏨", kind: "Hotel" },
};

const DEFAULT_THEME: CategoryTheme = { hue: 210, emoji: "🏷", kind: "Shop" };

export function categoryTheme(category: string | null): CategoryTheme {
  if (!category) return DEFAULT_THEME;
  return CATEGORY_THEMES[category] ?? DEFAULT_THEME;
}

/** CSS linear-gradient for the cover-photo fallback. */
export function categoryGradient(category: string | null): string {
  const t = categoryTheme(category);
  return `linear-gradient(135deg, hsl(${t.hue}, 68%, 42%) 0%, hsl(${(t.hue + 30) % 360}, 55%, 24%) 100%)`;
}

export function categoryKindLabel(category: string | null): string {
  return categoryTheme(category).kind;
}

export function categoryEmoji(category: string | null): string {
  return categoryTheme(category).emoji;
}
