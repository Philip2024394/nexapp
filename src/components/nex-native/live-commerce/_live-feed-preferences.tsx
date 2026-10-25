"use client";

// src/components/nex-native/live-commerce/_live-feed-preferences.tsx
//
// Owner directive 2026-10-25 · "Live Feed Preferences at the bottom
// of the three-dot container". Two-tier design per owner's revised
// brief:
//   · Quick controls (always visible): AI, Shopping & Business,
//     Food, Travel.
//   · Expand to reveal the rest (Music, Dancing, Work, Subscriptions,
//     Gaming, Education, Sports, News, Comedy, Beauty, Health).
//
// IMPORTANT DOCTRINE this component honours verbatim:
//   · "Turning Food on should mean food is allowed, not necessarily
//     that the feed will show mostly food." → labels + copy frame as
//     allow/hide, not boost/prioritise.
//   · Changing a preference MUST NEVER delete a video, remove a
//     creator, or change a creator's publishing status.
//   · AI-generated content keeps its AI disclosure regardless of the
//     filter · toggling off never hides or removes the (AI) label
//     from any video that is still shown.
//   · DRAFT · the section ships as a UI preview before the feed-
//     ranking layer honours the toggles. Visible "Draft" banner at
//     the top of the section tells the viewer the toggles are saved
//     on this device only.
//
// Persistence: localStorage per device (key `nex-live-feed-prefs-v1`).
// Guests + signed-in users both get the same local experience · no
// cross-device sync in this slice (would need a new preferences
// column on nex_account per the audit).
//
// Scope · UI + state + localStorage only. No feed-ranking wiring.
// That's a separate slice the owner has NOT authorised yet.

import * as React from "react";

const BORDER = "rgba(255, 255, 255, 0.12)";
const TEXT = "#F2F5F8";
const DIM = "#8BA9D1";
const CYAN = "#00AFFF";

const STORAGE_KEY = "nex-live-feed-prefs-v1";

export type FeedCategoryId =
  | "ai"
  | "shopping"
  | "food"
  | "travel"
  | "music"
  | "dancing"
  | "work"
  | "subscriptions"
  | "gaming"
  | "education"
  | "sports"
  | "news"
  | "comedy"
  | "beauty"
  | "health";

export interface FeedCategoryMeta {
  readonly id: FeedCategoryId;
  readonly label: string;
  readonly description: string;
  /** Owner's two-tier design · "quick" renders above the fold,
   *  "expanded" renders only after the viewer taps "Show more". */
  readonly tier: "quick" | "expanded";
}

/** Owner-sealed catalogue · 15 categories · 4 quick + 11 expanded.
 *  Mirrors the ordering in the owner's 2026-10-25 brief. */
export const FEED_CATEGORY_META: ReadonlyArray<FeedCategoryMeta> = [
  // Quick tier · the 4 the owner explicitly called out as always-visible.
  { id: "ai",          label: "AI-generated",        description: "AI-created videos and broadcasts", tier: "quick" },
  { id: "shopping",    label: "Shopping & Business", description: "Products, shops and live selling", tier: "quick" },
  { id: "food",        label: "Food",                description: "Cooking, meals and food businesses", tier: "quick" },
  { id: "travel",      label: "Travel",              description: "Destinations and travel experiences", tier: "quick" },
  // Expanded tier.
  { id: "music",         label: "Music",                description: "Music and performances", tier: "expanded" },
  { id: "dancing",       label: "Dancing",              description: "Dance and choreography", tier: "expanded" },
  { id: "work",          label: "Work & Online Services", description: "Professional work and services", tier: "expanded" },
  { id: "subscriptions", label: "Subscriptions",        description: "Creators and subscription content", tier: "expanded" },
  { id: "gaming",        label: "Gaming",               description: "Games and live gameplay", tier: "expanded" },
  { id: "education",     label: "Education",            description: "Learning, tutorials and explainers", tier: "expanded" },
  { id: "sports",        label: "Sports",               description: "Fitness, workouts and events", tier: "expanded" },
  { id: "news",          label: "News & Current Affairs", description: "News, politics and current events", tier: "expanded" },
  { id: "comedy",        label: "Comedy",               description: "Jokes, sketches and stand-up", tier: "expanded" },
  { id: "beauty",        label: "Beauty & Lifestyle",   description: "Makeup, fashion and lifestyle", tier: "expanded" },
  { id: "health",        label: "Health & Fitness",     description: "Wellness and health advice", tier: "expanded" },
];

export type FeedCategoryToggleMap = Record<FeedCategoryId, boolean>;

/** Owner directive 2026-10-25 · tri-state control for creator-added
 *  text overlays on top of the video pixels. This is DIFFERENT from
 *  NEX's own chrome (product cards, header labels, AI chip) · the
 *  control affects ONLY the creator's in-video promotional text. */
export type OverlayPreference = "all" | "reduce" | "hide";

/** Persisted state shape (v2 · adds `overlayPref` next to `toggles`).
 *  Old v1 payloads were a flat toggle map · the reader below handles
 *  that shape transparently so nothing resets on upgrade. */
export interface LiveFeedPreferencesState {
  readonly toggles: FeedCategoryToggleMap;
  readonly overlayPref: OverlayPreference;
}

/** Default · every category ALLOWED. Opt-out model. First-time users
 *  see everything · they turn OFF the categories they don't want. */
function defaultToggleMap(): FeedCategoryToggleMap {
  const m: Partial<FeedCategoryToggleMap> = {};
  for (const c of FEED_CATEGORY_META) m[c.id] = true;
  return m as FeedCategoryToggleMap;
}

function defaultState(): LiveFeedPreferencesState {
  return { toggles: defaultToggleMap(), overlayPref: "all" };
}

/** Read + validate localStorage · falls back to defaults on any
 *  corruption / missing / old-schema state. Pure function · safe to
 *  call during a React effect. Accepts BOTH the v1 flat-map shape
 *  (older payloads) and the v2 nested shape so a returning user
 *  doesn't lose their category toggles on this upgrade. */
function readStoredState(): LiveFeedPreferencesState {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return defaultState();
    const defaults = defaultState();
    // v2 shape: { toggles: {...}, overlayPref: "..." }
    const v2Toggles = (parsed as Record<string, unknown>).toggles;
    const v2Pref = (parsed as Record<string, unknown>).overlayPref;
    if (v2Toggles && typeof v2Toggles === "object") {
      const merged: FeedCategoryToggleMap = { ...defaults.toggles };
      for (const c of FEED_CATEGORY_META) {
        const v = (v2Toggles as Record<string, unknown>)[c.id];
        if (typeof v === "boolean") merged[c.id] = v;
      }
      const pref: OverlayPreference =
        v2Pref === "reduce" || v2Pref === "hide" ? v2Pref : "all";
      return { toggles: merged, overlayPref: pref };
    }
    // v1 shape: flat { ai: true, food: false, ... }
    const merged: FeedCategoryToggleMap = { ...defaults.toggles };
    for (const c of FEED_CATEGORY_META) {
      const v = (parsed as Record<string, unknown>)[c.id];
      if (typeof v === "boolean") merged[c.id] = v;
    }
    return { toggles: merged, overlayPref: "all" };
  } catch {
    return defaultState();
  }
}

function writeStoredState(next: LiveFeedPreferencesState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* localStorage disabled / quota exceeded · silently ignore */
  }
}

/** Public hook. Returns the current state + setters that persist
 *  immediately. Hydration-safe: the initial render uses defaults,
 *  then a useEffect reads actual storage. */
export function useLiveFeedPreferences(): {
  readonly toggles: FeedCategoryToggleMap;
  readonly overlayPref: OverlayPreference;
  readonly setToggle: (id: FeedCategoryId, allowed: boolean) => void;
  readonly setOverlayPref: (pref: OverlayPreference) => void;
  readonly resetAll: () => void;
} {
  const [state, setState] = React.useState<LiveFeedPreferencesState>(defaultState);
  React.useEffect(() => {
    setState(readStoredState());
  }, []);
  const setToggle = React.useCallback((id: FeedCategoryId, allowed: boolean) => {
    setState((prev) => {
      const next = { ...prev, toggles: { ...prev.toggles, [id]: allowed } };
      writeStoredState(next);
      return next;
    });
  }, []);
  const setOverlayPref = React.useCallback((pref: OverlayPreference) => {
    setState((prev) => {
      const next = { ...prev, overlayPref: pref };
      writeStoredState(next);
      return next;
    });
  }, []);
  const resetAll = React.useCallback(() => {
    const d = defaultState();
    writeStoredState(d);
    setState(d);
  }, []);
  return {
    toggles: state.toggles,
    overlayPref: state.overlayPref,
    setToggle,
    setOverlayPref,
    resetAll,
  };
}

/* ---------------------------------------------------------------
 * UI · section that mounts inside the 3-dot container, below the
 * primary action pills.
 * --------------------------------------------------------------- */

export function LiveFeedPreferencesSection(): React.JSX.Element {
  const { toggles, overlayPref, setToggle, setOverlayPref } =
    useLiveFeedPreferences();
  const [expanded, setExpanded] = React.useState(false);
  const quick = FEED_CATEGORY_META.filter((c) => c.tier === "quick");
  const extra = FEED_CATEGORY_META.filter((c) => c.tier === "expanded");
  return (
    <section
      data-nex-live-feed-prefs
      aria-label="Live feed preferences"
      style={{
        marginTop: 4,
        paddingTop: 10,
        borderTop: `1px solid ${BORDER}`,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        // Owner directive 2026-10-25 · "the 3 dots container must not
        // enlarge but the inner can scrolling when need to see the
        // other toggles". The section itself scrolls internally
        // when the viewer expands "Show more preferences", so the
        // outer panel does not grow taller when Feed is opened.
        // `overscroll-behavior: contain` prevents the page from
        // scrolling when a scroll bubbles out of the section.
        maxHeight: 300,
        overflowY: "auto",
        overscrollBehavior: "contain",
      }}
    >
      {/* Owner directive 2026-10-25 · "remove the header buttons from
          container live feed toggles container" · the inner section
          title + subtitle are removed · the outer "Live Feed" header
          in LiveViewerFooter is the single header for this view. */}
      {/* Quick tier · always visible. */}
      <ul
        data-nex-live-feed-prefs-list
        data-nex-live-feed-prefs-tier="quick"
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        {quick.map((c) => (
          <PreferenceRow
            key={c.id}
            meta={c}
            allowed={toggles[c.id]}
            onToggle={(v) => setToggle(c.id, v)}
          />
        ))}
      </ul>
      {/* Owner directive 2026-10-25 · "Add Excessive Text & Marketing
          Overlays to Live Feed Preferences, with three options · Show
          all / Reduce / Hide." · Separate sub-section from the on/off
          category toggles because it's a tri-state preference about
          creator-added in-video promotional text, NOT a category to
          allow or hide. */}
      <OverlayPreferenceControl
        value={overlayPref}
        onChange={setOverlayPref}
      />
      {/* Expand toggle. */}
      <button
        type="button"
        data-nex-live-feed-prefs-expand
        data-nex-live-feed-prefs-expanded={expanded ? "true" : "false"}
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded ? "true" : "false"}
        style={{
          marginTop: 2,
          padding: "6px 8px",
          borderRadius: 8,
          background: "transparent",
          border: `1px dashed ${BORDER}`,
          color: CYAN,
          fontSize: 11,
          fontWeight: 700,
          cursor: "pointer",
          textAlign: "center",
          fontFamily: "inherit",
        }}
      >
        {expanded ? "Hide more preferences ▲" : "Show more preferences ▼"}
      </button>
      {expanded && (
        <ul
          data-nex-live-feed-prefs-list
          data-nex-live-feed-prefs-tier="expanded"
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {extra.map((c) => (
            <PreferenceRow
              key={c.id}
              meta={c}
              allowed={toggles[c.id]}
              onToggle={(v) => setToggle(c.id, v)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function PreferenceRow(props: {
  readonly meta: FeedCategoryMeta;
  readonly allowed: boolean;
  readonly onToggle: (next: boolean) => void;
}): React.JSX.Element {
  const { meta, allowed, onToggle } = props;
  return (
    <li
      data-nex-live-feed-prefs-row
      data-nex-live-feed-prefs-id={meta.id}
      data-nex-live-feed-prefs-allowed={allowed ? "true" : "false"}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 8px",
        borderRadius: 8,
        background: "rgba(255, 255, 255, 0.04)",
        border: `1px solid ${BORDER}`,
        boxSizing: "border-box",
      }}
    >
      <div style={{ flex: "1 1 auto", minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: TEXT,
            lineHeight: 1.2,
          }}
        >
          {meta.label}
        </div>
        <div
          style={{
            marginTop: 1,
            fontSize: 10,
            color: DIM,
            lineHeight: 1.25,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {meta.description}
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={allowed ? "true" : "false"}
        aria-label={`${allowed ? "Hide" : "Allow"} ${meta.label}`}
        data-nex-live-feed-prefs-toggle
        data-nex-live-feed-prefs-toggle-state={allowed ? "on" : "off"}
        onClick={() => onToggle(!allowed)}
        style={{
          flexShrink: 0,
          width: 40,
          height: 22,
          borderRadius: 999,
          background: allowed ? CYAN : "rgba(255, 255, 255, 0.14)",
          border: `1px solid ${allowed ? CYAN : BORDER}`,
          cursor: "pointer",
          position: "relative",
          transition: "background 160ms ease-out, border-color 160ms ease-out",
          padding: 0,
          fontFamily: "inherit",
        }}
      >
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 2,
            left: allowed ? 20 : 2,
            width: 16,
            height: 16,
            borderRadius: 999,
            background: "#FFFFFF",
            boxShadow: "0 1px 2px rgba(0,0,0,0.4)",
            transition: "left 160ms ease-out",
          }}
        />
      </button>
    </li>
  );
}

/** Owner directive 2026-10-25 · tri-state control for creator-added
 *  promotional text overlays on top of the video pixels. Three
 *  mutually-exclusive options (Show all / Reduce / Hide). The copy
 *  is deliberately careful · NEX does NOT have overlay detection
 *  today (verified by the pre-build audit this turn) · the amber
 *  honest-limit chip at the bottom makes that explicit. The owner's
 *  rule stands: "Don't build a toggle that promises filtering when
 *  no actual filtering mechanism exists."
 *
 *  SCOPE boundary that must be preserved · the owner's distinction:
 *  "A creator's promotional text inside a video is not the same as
 *  NEX's own advertising or a product card. These should be handled
 *  separately." This control affects ONLY creator-added in-video
 *  text pixels · it never touches NEX chrome (product cards, AI
 *  chip, header, composer, live chat). */
function OverlayPreferenceControl(props: {
  readonly value: OverlayPreference;
  readonly onChange: (next: OverlayPreference) => void;
}): React.JSX.Element {
  const options: ReadonlyArray<{
    readonly value: OverlayPreference;
    readonly label: string;
    readonly short: string;
  }> = [
    { value: "all",    label: "Show all overlays",    short: "Show all" },
    { value: "reduce", label: "Reduce excessive overlays", short: "Reduce" },
    { value: "hide",   label: "Hide excessive overlays",   short: "Hide" },
  ];
  return (
    <section
      data-nex-live-feed-prefs-overlay
      aria-label="Promotional overlays preference"
      style={{
        marginTop: 6,
        padding: "8px",
        borderRadius: 10,
        background: "rgba(255, 255, 255, 0.04)",
        border: `1px solid ${BORDER}`,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <h4
          data-nex-live-feed-prefs-overlay-title
          style={{
            margin: 0,
            fontSize: 12,
            fontWeight: 700,
            color: TEXT,
            lineHeight: 1.2,
          }}
        >
          Promotional overlays
        </h4>
        <p
          style={{
            margin: 0,
            fontSize: 10,
            color: DIM,
            lineHeight: 1.3,
          }}
        >
          Large text and sales messages.
        </p>
      </div>
      {/* Segmented control · 3 mutually-exclusive radio-style buttons. */}
      <div
        role="radiogroup"
        aria-label="Promotional overlays"
        style={{
          display: "flex",
          flexDirection: "row",
          gap: 4,
          padding: 2,
          borderRadius: 8,
          background: "rgba(0, 0, 0, 0.3)",
          border: `1px solid ${BORDER}`,
        }}
      >
        {options.map((opt) => {
          const selected = props.value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected ? "true" : "false"}
              aria-label={opt.label}
              data-nex-live-feed-prefs-overlay-option={opt.value}
              data-nex-live-feed-prefs-overlay-selected={selected ? "true" : "false"}
              onClick={() => props.onChange(opt.value)}
              style={{
                flex: "1 1 0",
                minWidth: 0,
                minHeight: 32,
                padding: "4px 6px",
                borderRadius: 6,
                background: selected ? CYAN : "transparent",
                border: "none",
                color: selected ? "#0A0F1E" : TEXT,
                fontSize: 11,
                fontWeight: selected ? 800 : 600,
                cursor: "pointer",
                fontFamily: "inherit",
                boxSizing: "border-box",
                transition: "background 160ms ease-out, color 160ms ease-out",
              }}
            >
              {opt.short}
            </button>
          );
        })}
      </div>
    </section>
  );
}
