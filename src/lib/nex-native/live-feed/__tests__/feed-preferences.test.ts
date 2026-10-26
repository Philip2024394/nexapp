// src/lib/nex-native/live-feed/__tests__/feed-preferences.test.ts
//
// D-C integration slice 1 · 2026-10-27 · tests the pure helpers
// that bridge the sealed `_live-feed-preferences.tsx` controls into
// the Live-feed server-side filter.
//
// Honest-limit documentation lives in `feed-preferences-filter.ts`
// itself · these tests exercise ONLY what the predicate currently
// honours (the AI toggle). The other 14 categories are
// presentational by design in this slice.

import { describe, it, expect } from "vitest";
import {
  defaultFeedPrefs,
  parseFeedPrefs,
  serializeFeedPrefs,
  hiddenCategoryIdsFrom,
} from "../feed-preferences-cookie";
import {
  CATEGORIES_HONOURED_BY_FILTER,
  filterUploadedVideosByCategoryPrefs,
  isUploadedVideoVisibleUnderCategoryPrefs,
  type UploadedVideoForPrefsFilter,
} from "../feed-preferences-filter";

describe("feed-preferences-cookie", () => {
  it("defaults to all categories allowed and overlayPref=all", () => {
    const d = defaultFeedPrefs();
    expect(d.overlayPref).toBe("all");
    // Sample three of the 15 to confirm the shape.
    expect(d.toggles.ai).toBe(true);
    expect(d.toggles.food).toBe(true);
    expect(d.toggles.news).toBe(true);
  });

  it("round-trips through serialize + parse", () => {
    const original = defaultFeedPrefs();
    const next = {
      ...original,
      toggles: { ...original.toggles, ai: false },
      overlayPref: "reduce" as const,
    };
    const serialised = serializeFeedPrefs(next);
    const parsed = parseFeedPrefs(serialised);
    expect(parsed.toggles.ai).toBe(false);
    expect(parsed.toggles.food).toBe(true);
    expect(parsed.overlayPref).toBe("reduce");
  });

  it("falls back to defaults on empty / null / undefined input", () => {
    expect(parseFeedPrefs(null)).toEqual(defaultFeedPrefs());
    expect(parseFeedPrefs(undefined)).toEqual(defaultFeedPrefs());
    expect(parseFeedPrefs("")).toEqual(defaultFeedPrefs());
  });

  it("falls back to defaults on malformed / tampered cookie values", () => {
    expect(parseFeedPrefs("not-json")).toEqual(defaultFeedPrefs());
    expect(parseFeedPrefs(encodeURIComponent("null"))).toEqual(
      defaultFeedPrefs(),
    );
    expect(parseFeedPrefs(encodeURIComponent("[]"))).toEqual(
      defaultFeedPrefs(),
    );
    // Partial payload merges with defaults rather than throwing.
    const partial = encodeURIComponent(JSON.stringify({ toggles: { ai: false } }));
    const parsed = parseFeedPrefs(partial);
    expect(parsed.toggles.ai).toBe(false);
    expect(parsed.toggles.food).toBe(true);
    expect(parsed.overlayPref).toBe("all");
  });

  it("hiddenCategoryIdsFrom returns only the ids with toggle=false", () => {
    const prefs = defaultFeedPrefs();
    const next = {
      ...prefs,
      toggles: { ...prefs.toggles, ai: false, food: false },
    };
    const hidden = hiddenCategoryIdsFrom(next);
    expect(hidden.has("ai")).toBe(true);
    expect(hidden.has("food")).toBe(true);
    expect(hidden.has("travel")).toBe(false);
    expect(hidden.size).toBe(2);
  });
});

describe("feed-preferences-filter", () => {
  const prefsAllAllowed = defaultFeedPrefs();
  const prefsAiHidden = {
    ...prefsAllAllowed,
    toggles: { ...prefsAllAllowed.toggles, ai: false },
  };

  it("passes through a non-AI video regardless of AI toggle", () => {
    const v: UploadedVideoForPrefsFilter = { id: "a", is_ai_generated: false };
    expect(isUploadedVideoVisibleUnderCategoryPrefs(v, prefsAllAllowed)).toBe(true);
    expect(isUploadedVideoVisibleUnderCategoryPrefs(v, prefsAiHidden)).toBe(true);
  });

  it("hides an AI video when the AI toggle is off", () => {
    const v: UploadedVideoForPrefsFilter = { id: "b", is_ai_generated: true };
    expect(isUploadedVideoVisibleUnderCategoryPrefs(v, prefsAllAllowed)).toBe(true);
    expect(isUploadedVideoVisibleUnderCategoryPrefs(v, prefsAiHidden)).toBe(false);
  });

  it("treats a video with absent is_ai_generated as not-AI (pre-migration rows)", () => {
    const v: UploadedVideoForPrefsFilter = { id: "c" };
    expect(isUploadedVideoVisibleUnderCategoryPrefs(v, prefsAiHidden)).toBe(true);
  });

  it("filterUploadedVideosByCategoryPrefs removes only the AI videos when AI is hidden", () => {
    const videos: readonly UploadedVideoForPrefsFilter[] = [
      { id: "a", is_ai_generated: false },
      { id: "b", is_ai_generated: true },
      { id: "c" },
      { id: "d", is_ai_generated: true },
    ];
    const kept = filterUploadedVideosByCategoryPrefs(videos, prefsAiHidden);
    expect(kept.map((v) => v.id)).toEqual(["a", "c"]);
  });

  it("only honours the AI category today · all other categories pass through", () => {
    const videos: readonly UploadedVideoForPrefsFilter[] = [
      { id: "a", is_ai_generated: false },
      { id: "b", is_ai_generated: true },
    ];
    // Turn OFF every category · AI stays filtered, nothing else gets filtered.
    const prefsAllHidden = {
      ...prefsAllAllowed,
      toggles: Object.fromEntries(
        Object.keys(prefsAllAllowed.toggles).map((k) => [k, false]),
      ) as typeof prefsAllAllowed.toggles,
    };
    const kept = filterUploadedVideosByCategoryPrefs(videos, prefsAllHidden);
    expect(kept.map((v) => v.id)).toEqual(["a"]);
    expect(CATEGORIES_HONOURED_BY_FILTER.has("ai")).toBe(true);
    expect(CATEGORIES_HONOURED_BY_FILTER.size).toBe(1);
  });
});
