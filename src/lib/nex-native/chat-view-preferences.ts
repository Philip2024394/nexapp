// src/lib/nex-native/chat-view-preferences.ts
//
// NEX Chat · viewer-side chat view preferences · CLIENT-SAFE module.
// -----------------------------------------------------------------------------
// Pure types + catalogues + CSS resolvers for the five viewer-side
// preferences introduced by migration 285. NO `"server-only"` guard,
// NO DB imports · safe to import from client components, test files
// and the service layer alike.
//
// The server-only writer/reader lives in chat-view-preferences-service.ts
// and consumes the types + resolvers exported here · the service file
// also re-exports them so existing server callers keep a single
// import site.
//
// Owner-sealed 2026-11-07.

// ─── Types ────────────────────────────────────────────────────────────

export type ChatFontFamily =
  | "default"
  | "system"
  | "serif"
  | "monospace"
  | "handwritten";

export type ChatFontSize = "small" | "medium" | "large";

export interface ChatViewPreferences {
  readonly screenshot_copy_protection_enabled: boolean;
  readonly chat_font_family: ChatFontFamily;
  readonly chat_font_size: ChatFontSize;
  readonly chat_bg_from_shop_cover: boolean;
  readonly shop_cover_from_chat_theme: boolean;
}

/** Sealed defaults · match migration 285 CHECK/DEFAULT. Applied when
 *  the columns are absent OR when a service-layer read error forces
 *  fail-safe. Changing these requires a sealed doctrine revision. */
export const DEFAULT_CHAT_VIEW_PREFS: ChatViewPreferences = {
  screenshot_copy_protection_enabled: false,
  chat_font_family: "default",
  chat_font_size: "medium",
  chat_bg_from_shop_cover: false,
  shop_cover_from_chat_theme: false,
};

// ─── UI preset catalogues ─────────────────────────────────────────────

export const CHAT_FONT_FAMILIES: ReadonlyArray<{
  readonly value: ChatFontFamily;
  readonly label: string;
  readonly cssStack: string;
  readonly description: string;
}> = [
  {
    value: "default",
    label: "Default · Inter",
    cssStack:
      "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    description: "NEX's house font · clean and readable at every size.",
  },
  {
    value: "system",
    label: "System",
    cssStack:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif",
    description: "Your device's native font · looks most like other apps.",
  },
  {
    value: "serif",
    label: "Serif",
    cssStack: "Georgia, 'Times New Roman', Times, serif",
    description: "Classic reading font · a little more formal.",
  },
  {
    value: "monospace",
    label: "Monospace",
    cssStack:
      "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
    description: "Fixed-width · good for code-like precision.",
  },
  {
    value: "handwritten",
    label: "Handwritten",
    cssStack: "'Comic Sans MS', 'Marker Felt', 'Bradley Hand', cursive",
    description: "Casual handwritten feel · for lighter conversations.",
  },
];

export const CHAT_FONT_SIZES: ReadonlyArray<{
  readonly value: ChatFontSize;
  readonly label: string;
  readonly cssSize: string;
  readonly description: string;
}> = [
  { value: "small",  label: "Small",  cssSize: "13px", description: "Tighter · more messages visible." },
  { value: "medium", label: "Medium", cssSize: "15px", description: "NEX default · balanced." },
  { value: "large",  label: "Large",  cssSize: "17px", description: "Easier to read at arm's length." },
];

// ─── Pure resolvers (no DB · no server dependency) ────────────────────

/** Resolve a stored font-family to the CSS stack string. Falls back
 *  to default when the stored value is unknown. */
export function resolveFontFamilyCss(value: ChatFontFamily): string {
  const match = CHAT_FONT_FAMILIES.find((f) => f.value === value);
  return (match ?? CHAT_FONT_FAMILIES[0]!).cssStack;
}

/** Resolve a stored font-size to its CSS pixel value. */
export function resolveFontSizeCss(value: ChatFontSize): string {
  const match = CHAT_FONT_SIZES.find((f) => f.value === value);
  return (match ?? CHAT_FONT_SIZES[1]!).cssSize;
}

// ─── Narrowing helpers (pure · may run on client) ─────────────────────

export function narrowFontFamily(raw: unknown): ChatFontFamily {
  if (
    raw === "default" ||
    raw === "system" ||
    raw === "serif" ||
    raw === "monospace" ||
    raw === "handwritten"
  ) {
    return raw;
  }
  return DEFAULT_CHAT_VIEW_PREFS.chat_font_family;
}

export function narrowFontSize(raw: unknown): ChatFontSize {
  if (raw === "small" || raw === "medium" || raw === "large") return raw;
  return DEFAULT_CHAT_VIEW_PREFS.chat_font_size;
}
