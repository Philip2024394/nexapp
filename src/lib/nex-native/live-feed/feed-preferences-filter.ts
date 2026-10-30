// src/lib/nex-native/live-feed/feed-preferences-filter.ts
//
// Owner-authorised 2026-10-27 (D-C · integration slice 1) · the
// pure predicate the Live-feed server component applies to the
// candidate pool so that a viewer's category toggles actually hide
// posts in the feed, not just change a stored setting.
//
// Scope · this slice
// -----------------------------------------------------------------------------
// Of the 15 categories in `FEED_CATEGORY_META`, only ONE has a
// reliable server-side classifier on the post row today:
//
//     "ai" ← `nex_uploaded_video.is_ai_generated` (boolean,
//            uploader-self-declared · migration 221).
//
// The other 14 categories (shopping, food, travel, music, dancing,
// work, subscriptions, gaming, education, sports, news, comedy,
// beauty, health) have NO column on either `nex_uploaded_video` or
// `nex_live_session` that classifies a post. A classifier contract
// does not exist. This predicate therefore honours the AI toggle
// end-to-end and passes everything else through unfiltered. That is
// the honest limit · it is documented in the Content Quality
// Constitution DRAFT 2026-10-27 §6.3 and §6.5.
//
// Live sessions · `nex_live_session` has no category/topic column.
// Live posts pass through unfiltered. Owner directive sealed in
// `_live-feed-preferences.tsx` is `allow/hide-not-boost` · we never
// penalise a creator because a viewer turned a category off; we
// only HIDE from that viewer's feed. For Live, there is no reliable
// hide signal in this slice.
//
// Non-goals
// -----------------------------------------------------------------------------
//   · Does NOT invent a tag → category mapping. That is a new
//     product contract and requires separate owner approval.
//   · Does NOT touch feed ranking, viewer caps, Vault, Shop
//     eligibility, pricing, or any sealed primitive.
//   · Does NOT strip the sealed `(AI)` chip from videos that remain
//     visible on non-feed surfaces · the chip is rendered by the
//     viewer header independently of this filter.

// Owner-authorised 2026-10-29 · imports moved to the plain shared
// module (see sibling cookie module for full rationale).
import type { FeedCategoryId } from "@/lib/nex-native/live-feed/feed-categories";
import type { LiveFeedPreferencesState } from "@/lib/nex-native/live-feed/feed-categories";

/** The minimal video shape this predicate needs. Keeps the predicate
 *  decoupled from the full `UploadedVideoRow` so tests can pass
 *  lightweight fixtures. */
export interface UploadedVideoForPrefsFilter {
  readonly id: string;
  readonly is_ai_generated?: boolean | undefined;
}

/** Return TRUE if the uploaded video should be emitted into the
 *  viewer's feed given the current preference state. FALSE means
 *  "hide for this viewer only". The predicate NEVER modifies the
 *  post, NEVER signals the creator, and NEVER feeds into ranking. */
export function isUploadedVideoVisibleUnderCategoryPrefs(
  video: UploadedVideoForPrefsFilter,
  prefs: LiveFeedPreferencesState,
): boolean {
  // AI category · the one classifier we can honour reliably today.
  // Default (migration 221) · absent `is_ai_generated` is read as
  // `undefined`, which this predicate treats as "not AI" so the
  // viewer still sees pre-migration rows.
  const isAi = video.is_ai_generated === true;
  const aiAllowed = prefs.toggles.ai !== false;
  if (isAi && !aiAllowed) return false;
  return true;
}

/** The set of category ids this predicate currently honours. Keep
 *  this list in sync with the predicate · callers that render UX
 *  copy about the honest limit read this to list exactly which
 *  toggles are "active" vs "presentational". */
export const CATEGORIES_HONOURED_BY_FILTER: ReadonlySet<FeedCategoryId> =
  new Set<FeedCategoryId>(["ai"]);

/** Convenience · apply the predicate across an array. Pure. */
export function filterUploadedVideosByCategoryPrefs<
  T extends UploadedVideoForPrefsFilter,
>(videos: readonly T[], prefs: LiveFeedPreferencesState): readonly T[] {
  return videos.filter((v) =>
    isUploadedVideoVisibleUnderCategoryPrefs(v, prefs),
  );
}
