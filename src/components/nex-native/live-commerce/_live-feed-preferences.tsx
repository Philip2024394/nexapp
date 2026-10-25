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
const AMBER = "#FFC107";

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

/** Default · every category ALLOWED. Opt-out model. First-time users
 *  see everything · they turn OFF the categories they don't want. */
function defaultToggleMap(): FeedCategoryToggleMap {
  const m: Partial<FeedCategoryToggleMap> = {};
  for (const c of FEED_CATEGORY_META) m[c.id] = true;
  return m as FeedCategoryToggleMap;
}

/** Read + validate localStorage · falls back to defaults on any
 *  corruption / missing / old-schema state. Pure function · safe to
 *  call during a React effect. */
function readStoredToggles(): FeedCategoryToggleMap {
  if (typeof window === "undefined") return defaultToggleMap();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultToggleMap();
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return defaultToggleMap();
    const defaults = defaultToggleMap();
    const result: FeedCategoryToggleMap = { ...defaults };
    for (const c of FEED_CATEGORY_META) {
      const v = (parsed as Record<string, unknown>)[c.id];
      if (typeof v === "boolean") result[c.id] = v;
    }
    return result;
  } catch {
    return defaultToggleMap();
  }
}

function writeStoredToggles(next: FeedCategoryToggleMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* localStorage disabled / quota exceeded · silently ignore */
  }
}

/** Public hook. Returns the current toggle map + a setter that
 *  immediately persists to localStorage. Hydration-safe: the initial
 *  render uses defaults, then a useEffect reads actual storage. */
export function useLiveFeedPreferences(): {
  readonly toggles: FeedCategoryToggleMap;
  readonly setToggle: (id: FeedCategoryId, allowed: boolean) => void;
  readonly resetAll: () => void;
} {
  const [toggles, setToggles] = React.useState<FeedCategoryToggleMap>(defaultToggleMap);
  React.useEffect(() => {
    setToggles(readStoredToggles());
  }, []);
  const setToggle = React.useCallback((id: FeedCategoryId, allowed: boolean) => {
    setToggles((prev) => {
      const next = { ...prev, [id]: allowed };
      writeStoredToggles(next);
      return next;
    });
  }, []);
  const resetAll = React.useCallback(() => {
    const d = defaultToggleMap();
    writeStoredToggles(d);
    setToggles(d);
  }, []);
  return { toggles, setToggle, resetAll };
}

/* ---------------------------------------------------------------
 * UI · section that mounts inside the 3-dot container, below the
 * primary action pills.
 * --------------------------------------------------------------- */

export function LiveFeedPreferencesSection(): React.JSX.Element {
  const { toggles, setToggle } = useLiveFeedPreferences();
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
      }}
    >
      <header style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <h3
          data-nex-live-feed-prefs-title
          style={{
            margin: 0,
            fontSize: 12,
            fontWeight: 800,
            color: TEXT,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          Live Feed Preferences
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: 11,
            color: DIM,
            lineHeight: 1.3,
          }}
        >
          Hide categories you don&rsquo;t want to see.
        </p>
      </header>
      {/* Owner directive 2026-10-25 · "I would not promise that every
          toggle immediately filters every video until Claude verifies
          that the current NEX feed actually supports category-based
          selection. The interface and the underlying behaviour must
          agree." · DRAFT banner states the honest limit. */}
      <div
        data-nex-live-feed-prefs-draft-banner
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 6,
          padding: "6px 8px",
          borderRadius: 8,
          background: "rgba(255, 193, 7, 0.14)",
          border: `1px solid ${AMBER}`,
          color: AMBER,
          fontSize: 10,
          fontWeight: 700,
          lineHeight: 1.3,
          letterSpacing: "0.02em",
        }}
      >
        <span aria-hidden style={{ fontSize: 11 }}>⚡</span>
        <span>
          Draft · toggles are saved on this device. The feed will honour
          them once the ranking lands.
        </span>
      </div>
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
      {/* Final honest note on AI · the sealed no-claim doctrine. */}
      <p
        data-nex-live-feed-prefs-ai-note
        style={{
          margin: 0,
          padding: "4px 2px 0",
          fontSize: 10,
          color: DIM,
          lineHeight: 1.3,
        }}
      >
        AI label stays visible on labelled videos regardless of this filter.
        NEX never claims an unlabelled video is human-made.
      </p>
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
