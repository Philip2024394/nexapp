// src/lib/nex-native/profile/interests-registry.ts
//
// NEX Ireland · interests pick-list for the profile edit page.
// Owner-authorised 2026-11-04.
// --------------------------------------------------------
// Mix of Irish-culture + universal interests so the picker works for
// Irish residents + Irish diaspora + non-Irish friends who join.
//
// 24 options · pick-2 enforced by migration 273 CHECK constraint
// (nex_account_profile_interests_max).
//
// Ordering · Irish-first then universal · subject to owner reorder.
// Values are stable id-slugs (not display labels) so a future rename
// doesn't invalidate stored data.

export interface NexInterest {
  readonly id: string;
  readonly label: string;
  readonly emoji: string;
}

export const NEX_INTERESTS: readonly NexInterest[] = [
  { id: "gaa",             label: "GAA",              emoji: "🏐" },
  { id: "hurling",         label: "Hurling",          emoji: "🪃" },
  { id: "rugby",           label: "Rugby",            emoji: "🏉" },
  { id: "football",        label: "Football",         emoji: "⚽" },
  { id: "trad-music",      label: "Trad music",       emoji: "🎻" },
  { id: "pub-life",        label: "Pub life",         emoji: "🍺" },
  { id: "hiking",          label: "Hiking",           emoji: "🥾" },
  { id: "sea-swimming",    label: "Sea swimming",     emoji: "🌊" },
  { id: "fishing",         label: "Fishing",          emoji: "🎣" },
  { id: "gardening",       label: "Gardening",        emoji: "🌱" },
  { id: "cooking",         label: "Cooking",          emoji: "🍳" },
  { id: "reading",         label: "Reading",          emoji: "📚" },
  { id: "music",           label: "Music",            emoji: "🎵" },
  { id: "film",            label: "Film",             emoji: "🎬" },
  { id: "art",             label: "Art",              emoji: "🎨" },
  { id: "photography",     label: "Photography",      emoji: "📷" },
  { id: "travel",          label: "Travel",           emoji: "✈️" },
  { id: "fitness",         label: "Fitness",          emoji: "💪" },
  { id: "dancing",         label: "Dancing",          emoji: "💃" },
  { id: "gaming",          label: "Gaming",           emoji: "🎮" },
  { id: "technology",      label: "Technology",       emoji: "💻" },
  { id: "fashion",         label: "Fashion",          emoji: "👗" },
  { id: "writing",         label: "Writing",          emoji: "✍️" },
  { id: "volunteering",    label: "Volunteering",     emoji: "🤝" },
];

const INTEREST_IDS = new Set(NEX_INTERESTS.map((i) => i.id));

export function isKnownInterestId(id: string): boolean {
  return INTEREST_IDS.has(id);
}

export function labelForInterestId(id: string): string {
  return NEX_INTERESTS.find((i) => i.id === id)?.label ?? id;
}
