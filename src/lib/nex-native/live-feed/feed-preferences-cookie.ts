// src/lib/nex-native/live-feed/feed-preferences-cookie.ts
//
// Owner-authorised 2026-10-27 (D-C · integration slice 1) · bridges
// the client-side localStorage preferences in
// `_live-feed-preferences.tsx` into a server-readable cookie so the
// Live-feed server component can honour the viewer's category
// toggles without changing the UI contract.
//
// Scope and non-goals
// -----------------------------------------------------------------------------
//   · Reuses the sealed FEED_CATEGORY_META + FeedCategoryId contracts
//     from `_live-feed-preferences.tsx`. Does NOT invent a new
//     category vocabulary.
//   · Reuses the sealed allow/hide-not-boost semantics · a disabled
//     toggle means a category of posts is HIDDEN from the viewer's
//     feed. Never promoted. Never ranked.
//   · The cookie is a mirror of the device-local localStorage · it
//     is not the source of truth. If the cookie is missing,
//     malformed, or out of sync, the server-side filter falls back
//     to "all allowed" (opt-OUT default · matches the component).
//   · NO cross-device sync · NO new column · NO new table. The
//     cookie survives across pages and refreshes on the same browser
//     device, which matches the owner's "defer cross-device sync"
//     decision for this slice.
//   · Preserves the AI-disclosure principle · hiding the AI category
//     removes AI-generated videos from the FEED emission. It does
//     NOT strip the sealed (AI) label from AI videos that remain
//     visible through other surfaces (direct link, broadcaster
//     library, etc.).
//
// Cookie shape
// -----------------------------------------------------------------------------
//   name    · nex-feed-prefs
//   path    · /
//   SameSite· Lax
//   expiry  · ~1 year rolling (client re-writes on each state change)
//   value   · URL-encoded JSON of `{ toggles, overlayPref }` matching
//             the v2 shape in `_live-feed-preferences.tsx`.
//
// Why URL-encoded JSON · the cookie is small (15 booleans + 1 enum)
// so a compact bitmask is unnecessary. Human-readable JSON makes the
// parse honest and the shape identical to what the component already
// writes to localStorage · zero translation surface.

import type {
  FeedCategoryId,
  FeedCategoryToggleMap,
  LiveFeedPreferencesState,
  OverlayPreference,
} from "@/components/nex-native/live-commerce/_live-feed-preferences";
import { FEED_CATEGORY_META } from "@/components/nex-native/live-commerce/_live-feed-preferences";

/** The exact name clients + server share. Changing this value is a
 *  BREAKING CHANGE · existing cookies silently stop working on both
 *  sides. Any rename requires a backward-compatible reader. */
export const FEED_PREFS_COOKIE_NAME = "nex-feed-prefs";

/** Default · every category ALLOWED (opt-OUT). Mirrors the sealed
 *  component default · a first-time user sees everything, then turns
 *  OFF what they do not want. */
export function defaultFeedPrefs(): LiveFeedPreferencesState {
  const toggles: Partial<FeedCategoryToggleMap> = {};
  for (const c of FEED_CATEGORY_META) toggles[c.id] = true;
  return {
    toggles: toggles as FeedCategoryToggleMap,
    overlayPref: "all",
  };
}

/** Serialise prefs to the exact cookie value the server reads. The
 *  value is URL-encoded JSON so cookie-parsing libraries and raw
 *  `document.cookie` writes agree on the shape. */
export function serializeFeedPrefs(state: LiveFeedPreferencesState): string {
  const payload = {
    toggles: state.toggles,
    overlayPref: state.overlayPref,
  };
  return encodeURIComponent(JSON.stringify(payload));
}

/** Parse a cookie value into prefs. Honest · any malformed input
 *  falls back to `defaultFeedPrefs()` so an attacker cannot override
 *  defaults by sending garbage, and a real user with no cookie just
 *  sees the full feed. Never throws. */
export function parseFeedPrefs(
  raw: string | null | undefined,
): LiveFeedPreferencesState {
  if (!raw || typeof raw !== "string" || raw.length === 0) {
    return defaultFeedPrefs();
  }
  try {
    const decoded = decodeURIComponent(raw);
    const parsed = JSON.parse(decoded) as unknown;
    if (!parsed || typeof parsed !== "object") return defaultFeedPrefs();
    const defaults = defaultFeedPrefs();
    const incomingToggles = (parsed as Record<string, unknown>).toggles;
    const incomingOverlay = (parsed as Record<string, unknown>).overlayPref;
    const merged: FeedCategoryToggleMap = { ...defaults.toggles };
    if (incomingToggles && typeof incomingToggles === "object") {
      for (const c of FEED_CATEGORY_META) {
        const v = (incomingToggles as Record<string, unknown>)[c.id];
        if (typeof v === "boolean") merged[c.id] = v;
      }
    }
    const overlay: OverlayPreference =
      incomingOverlay === "reduce" || incomingOverlay === "hide"
        ? incomingOverlay
        : "all";
    return { toggles: merged, overlayPref: overlay };
  } catch {
    return defaultFeedPrefs();
  }
}

/** Convenience · returns the full set of category ids the viewer has
 *  turned OFF. Useful for filter predicates that only care about the
 *  negative set. */
export function hiddenCategoryIdsFrom(
  state: LiveFeedPreferencesState,
): ReadonlySet<FeedCategoryId> {
  const out = new Set<FeedCategoryId>();
  for (const c of FEED_CATEGORY_META) {
    if (state.toggles[c.id] === false) out.add(c.id);
  }
  return out;
}
