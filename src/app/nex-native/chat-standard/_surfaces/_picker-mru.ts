// src/app/nex-native/chat-standard/_surfaces/_picker-mru.ts
//
// Unified picker · recently-used store · owner-authorised 2026-10-19.
// -----------------------------------------------------------------------------
// Per-category (emoji · sticker · giphy · file) MRU keyed in
// localStorage so the picker surfaces the user's most-recent picks at
// the top of each list across every chat theme. Preview-honest storage
// (per-browser, no DB) · fits the pattern we've used all session. A
// future owner-authorised migration can swap this adapter for a
// `nex_account.recent_picks` column without touching the picker UI.
//
// Capacity: 20 recent entries per category · older entries auto-evict.

export type PickerCategory = "emoji" | "sticker" | "giphy" | "file";

const MAX_RECENT_PER_CATEGORY = 20;
const STORAGE_KEY_PREFIX = "nex:picker-mru:";

/** Opaque identifier the picker uses to compare and reorder entries.
 *  Must be stable across sessions · we use:
 *    emoji   · raw Unicode glyph OR ":<slug>:" for image emojis
 *    sticker · ":<slug>:" (same shape as image emoji reactions)
 *    giphy   · the GIF id returned by Giphy's API
 *    file    · the file name + size (SHA would be better but adds a
 *              crypto step for every pick · for preview the pair is
 *              distinct enough) */
export type PickerIdentity = string;

function storageKey(category: PickerCategory): string {
  return `${STORAGE_KEY_PREFIX}${category}`;
}

/** Read the ordered list of recent identities for a category.
 *  Returns [] when:
 *    · we're SSR (no window),
 *    · no entries have been stored yet,
 *    · the stored blob is malformed. */
export function readRecent(category: PickerCategory): PickerIdentity[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(category));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

/** Push an identity to the front of the recent list · de-dupe · cap at
 *  MAX_RECENT_PER_CATEGORY. Safe to call rapidly · a crash in storage
 *  (quota · private mode · etc.) is swallowed so the pick itself
 *  never breaks. */
export function pushRecent(
  category: PickerCategory,
  identity: PickerIdentity,
): void {
  if (typeof window === "undefined") return;
  try {
    const current = readRecent(category);
    const filtered = current.filter((v) => v !== identity);
    const next = [identity, ...filtered].slice(
      0,
      MAX_RECENT_PER_CATEGORY,
    );
    window.localStorage.setItem(
      storageKey(category),
      JSON.stringify(next),
    );
  } catch {
    /* ignore · storage failure must not block a pick */
  }
}

/** Remove a single identity from recents · used when the underlying
 *  item is deleted or the user explicitly clears a chip. */
export function removeRecent(
  category: PickerCategory,
  identity: PickerIdentity,
): void {
  if (typeof window === "undefined") return;
  try {
    const current = readRecent(category);
    const next = current.filter((v) => v !== identity);
    window.localStorage.setItem(
      storageKey(category),
      JSON.stringify(next),
    );
  } catch {
    /* ignore */
  }
}

/** Clear every recent for a single category · exposed for a future
 *  "clear recents" admin option. Not wired to a UI control today. */
export function clearRecent(category: PickerCategory): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey(category));
  } catch {
    /* ignore */
  }
}
