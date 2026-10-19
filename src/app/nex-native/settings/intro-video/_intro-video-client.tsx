"use client";

// src/app/nex-native/settings/intro-video/_intro-video-client.tsx
//
// NEX · My Intro Video client · owner-authorised 2026-10-19.
// -----------------------------------------------------------------------------
// Preview-honest UI for the sealed intro-video settings described in
// the sibling page.tsx. Everything the user does here renders live via
// local state + object URLs · the production upload path lands in a
// separate owner-authorised commit.

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NEX_FONT_SANS } from "@/lib/nex-native/design-tokens";
/* Owner directive 2026-10-19 · "the emoji panel must be same emoji
   panel as chat theme emoji" · mount the sealed cross-theme picker
   so the settings surface uses byte-identical UI to the chat
   composer. NEX_BUBBLES_PACKAGE is the sealed brand default · gives
   the picker a stable engine without needing a per-theme context. */
import { StandardEmojiStickerPicker } from "@/app/nex-native/chat-standard/_surfaces/_emoji-sticker-picker";
import { createEngine } from "@/app/nex-native/chat-standard/_engine/theme-engine";
import { NEX_BUBBLES_PACKAGE } from "@/app/nex-native/chat-standard/packages/nex-bubbles.package";
import {
  ControlDrawer,
  type ControlDrawerSession,
} from "@/components/nex-native/control-drawer/control-drawer-client";
import { NexPingBadge } from "@/lib/nex-native/nex-ping-badge-client";
import { JokerKeypad } from "@/app/nex-native/chat-standard/_joker-keypad";
import type {
  IntroSettings,
  IntroTitleAlign,
  IntroTitleFont,
  IntroTitlePosition as IntroTitlePositionDB,
  IntroTitleSize,
  TitleSegment,
} from "@/lib/nex-native/intro-settings-service";
import {
  clearIntroVideoAction,
  clearWallpaperAction,
  resetIntroToThemeDefaultsAction,
  updateIntroSettingsAction,
  uploadIntroVideoAction,
  uploadWallpaperAction,
} from "./_actions";
import {
  INTRO_OVERLAY_FONTS,
  INTRO_OVERLAY_FONTS_HREF,
  INTRO_OVERLAY_SIZES,
  fontById,
  sizeById,
  type IntroOverlayFontId,
  type IntroOverlaySizeId,
} from "./_overlay-fonts";

export type IntroTitlePosition = "hero" | "center" | "footer";

const NEX = {
  bg: "#020914",
  panel: "rgba(2, 9, 20, 0.72)",
  panelBorder: "rgba(0, 175, 255, 0.28)",
  textPrimary: "#F2F5F8",
  textSecondary: "#B5C3D6",
  textMute: "#7D9BC0",
  cyan: "#00AFFF",
  cyanDim: "rgba(0, 175, 255, 0.14)",
  orange: "#FF7200",
  green: "#16D66B",
  red: "#FF3B30",
};

const MAX_SECONDS = 8;
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

/* Wallpaper upload rules · owner-authorised 2026-10-19 · "image must
 * be screen app size to accept and we state the size and file type we
 * accept for sure error free upload". Portrait 9:16 only · min
 * 720×1280 (720p) · target 1125×2436 (iPhone 14 Pro) · 5 MB cap · PNG
 * / JPG / WebP mime set (same as the sealed nex-avatar bucket). */
const WALLPAPER_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const WALLPAPER_MIN_WIDTH = 720;
const WALLPAPER_MIN_HEIGHT = 1280;
const WALLPAPER_MIME_ALLOWED: Record<string, string> = {
  "image/png": "PNG",
  "image/jpeg": "JPG",
  "image/webp": "WebP",
};
const WALLPAPER_RATIO_TARGET = 9 / 16;
const WALLPAPER_RATIO_TOLERANCE = 0.08; // ±8 % off perfect 9:16

/* TITLE_EMOJI_SET retired 2026-10-19 · owner directive · "the emoji
 * panel must be same emoji panel as chat theme emoji" · the inline
 * 24-glyph grid was replaced by a mount of the sealed
 * StandardEmojiStickerPicker so the settings page uses the same
 * 4-tab UI as the chat composer. */

interface Props {
  readonly displayName: string;
  readonly nexHandle: string;
  /** Owner directive 2026-10-19 · header gains the viewer's avatar on
   *  the left. Null when the account has no profile photo yet · the
   *  avatar falls back to a NEX monogram chip. */
  readonly viewerAvatarUrl?: string | null;
  /** Session for the ControlDrawer trigger (3-dot menu on the right).
   *  Resolved server-side in page.tsx to the same shape every other
   *  sealed drawer surface uses. */
  readonly drawerSession: ControlDrawerSession;
  /** Owner directive 2026-10-19 · the preview area shows the current
   *  active theme's packaged intro video when the user hasn't uploaded
   *  their own · null when the theme has no intro (DB-driven themes
   *  without a packaged clip). */
  readonly activeThemeIntroUrl?: string | null;
  /** Theme display name · used in the empty-preview caption so the
   *  user knows which theme's intro they're looking at. */
  readonly activeThemeName?: string | null;
  /** Owner directive 2026-10-19 · the Chat Screen Background preview
   *  defaults to the active theme's packaged wallpaper when the user
   *  hasn't uploaded a custom one · null when the theme ships without
   *  a wallpaper (fully-painted bubbles with no bg image). */
  readonly activeThemeWallpaperUrl?: string | null;
  /** Owner directive 2026-10-20 · server-hydrated saved intro
   *  settings · the client initialises every stateful control from
   *  this so a returning user sees their last-saved state. */
  readonly savedIntro: IntroSettings;
}

interface StagedIntro {
  readonly file: File;
  readonly previewUrl: string;
  readonly durationSec: number;
  readonly width: number;
  readonly height: number;
  readonly isPortrait: boolean;
}

interface StagedWallpaper {
  readonly file: File;
  readonly previewUrl: string;
  readonly width: number;
  readonly height: number;
  readonly mimeLabel: string;
}

/** Resolve image metadata locally via a hidden <img> element · no
 *  server round-trip. Rejects when the file isn't decodable (corrupted
 *  / unsupported). */
function probeImage(
  file: File,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image failed to decode"));
    };
    img.src = url;
  });
}

/** Owner directive 2026-10-20 · "ship segments" · per-selection text
 *  styling via a parallel per-character attribute array · one slot
 *  per character in titleText · colour/size are optional per char
 *  (fall back to the global titleColor/titleSizeId). */
export interface CharAttr {
  color?: string;
  size?: IntroOverlaySizeId;
}

/** Rebuild a per-char attr array when the text changes · tries to
 *  preserve attrs by matching longest common prefix + suffix. When
 *  the user types new characters in the middle, the inserted chars
 *  inherit the previous char's attrs. */
function reflowAttrs(
  oldText: string,
  oldAttrs: CharAttr[],
  newText: string,
): CharAttr[] {
  if (oldText === newText) return oldAttrs;
  if (newText.length === 0) return [];
  if (oldAttrs.length === 0 || oldText.length === 0) {
    return newText.split("").map(() => ({}));
  }
  // Common prefix
  let p = 0;
  const minLen = Math.min(oldText.length, newText.length);
  while (p < minLen && oldText[p] === newText[p]) p++;
  // Common suffix (bounded so suffix doesn't overlap with prefix)
  let s = 0;
  while (
    s < oldText.length - p &&
    s < newText.length - p &&
    oldText[oldText.length - 1 - s] === newText[newText.length - 1 - s]
  ) {
    s++;
  }
  const prefix = oldAttrs.slice(0, p);
  const suffix = oldAttrs.slice(oldAttrs.length - s);
  const insertedCount = newText.length - prefix.length - suffix.length;
  const inheritFrom =
    prefix.length > 0
      ? prefix[prefix.length - 1]
      : suffix.length > 0
        ? suffix[0]
        : {};
  const inserted: CharAttr[] = Array.from({ length: Math.max(0, insertedCount) }, () => ({
    ...inheritFrom,
  }));
  return [...prefix, ...inserted, ...suffix];
}

/** Compress a per-char attr array to the serialised segment form the
 *  DB stores · groups consecutive chars with identical attrs. Returns
 *  null when every char has empty attrs (defer to global colour/size). */
function attrsToSegments(
  text: string,
  attrs: CharAttr[],
): TitleSegment[] | null {
  if (text.length === 0) return null;
  const safeAttrs =
    attrs.length === text.length ? attrs : text.split("").map(() => ({} as CharAttr));
  const anyStyled = safeAttrs.some((a) => a.color || a.size);
  if (!anyStyled) return null;
  const out: TitleSegment[] = [];
  let runStart = 0;
  const sameAttr = (a: CharAttr, b: CharAttr): boolean =>
    a.color === b.color && a.size === b.size;
  for (let i = 1; i <= text.length; i++) {
    if (i === text.length || !sameAttr(safeAttrs[i], safeAttrs[runStart])) {
      const seg: TitleSegment = { text: text.slice(runStart, i) };
      if (safeAttrs[runStart].color) seg.color = safeAttrs[runStart].color;
      if (safeAttrs[runStart].size) seg.size = safeAttrs[runStart].size;
      out.push(seg);
      runStart = i;
    }
  }
  return out;
}

/** Rehydrate a per-char attr array from a saved segments payload ·
 *  called on page load when savedIntro.title_segments is non-null. */
export function segmentsToAttrs(
  segments: TitleSegment[] | null,
  text: string,
): CharAttr[] {
  if (!segments || segments.length === 0) {
    return text.split("").map(() => ({}));
  }
  const concat = segments.map((s) => s.text).join("");
  if (concat !== text) {
    return text.split("").map(() => ({}));
  }
  const out: CharAttr[] = [];
  for (const seg of segments) {
    for (let i = 0; i < seg.text.length; i++) {
      const a: CharAttr = {};
      if (seg.color) a.color = seg.color;
      if (seg.size) a.size = seg.size;
      out.push(a);
    }
  }
  return out;
}

/** Resolve video metadata locally via a hidden <video> element · no
 *  server round-trip. Rejects when the file isn't playable in the
 *  browser (unsupported codec, corrupted). */
function probeVideo(file: File): Promise<{
  durationSec: number;
  width: number;
  height: number;
}> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.src = url;
    v.onloadedmetadata = () => {
      const result = {
        durationSec: v.duration,
        width: v.videoWidth,
        height: v.videoHeight,
      };
      URL.revokeObjectURL(url);
      resolve(result);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This video can't be read · try a different file."));
    };
  });
}

export function IntroVideoSettingsClient({
  displayName,
  nexHandle,
  viewerAvatarUrl,
  drawerSession,
  activeThemeIntroUrl,
  activeThemeName,
  activeThemeWallpaperUrl,
  savedIntro,
}: Props): React.JSX.Element {
  // Owner directive 2026-10-20 · the "View Live Now" footer button
  // auto-saves then routes to /nex-native/settings/intro-video/live
  // for a full-screen dry-run of the visitor-landing experience.
  const router = useRouter();
  const [introEnabled, setIntroEnabled] = React.useState<boolean>(
    savedIntro.enabled,
  );
  const [staged, setStaged] = React.useState<StagedIntro | null>(null);
  /* Owner directive 2026-10-20 · server-persisted intro video URL ·
     resolves on page load from Supabase · null when the user hasn't
     uploaded one yet (preview falls back to activeThemeIntroUrl). */
  const [savedIntroVideoUrl, setSavedIntroVideoUrl] = React.useState<
    string | null
  >(savedIntro.video_url);
  const [savedWallpaperUrl, setSavedWallpaperUrl] = React.useState<
    string | null
  >(savedIntro.wallpaper_url);
  const [uploadingVideo, setUploadingVideo] = React.useState(false);
  const [uploadingWallpaper, setUploadingWallpaper] = React.useState(false);
  /* Title text defaults to the sample "Welcome · <name>" via the
     isPlaceholder flag below · stays empty until the sample has been
     either kept (user hits Save) or replaced (user types). */
  const [titleText, setTitleText] = React.useState<string>(
    savedIntro.title_text ?? "",
  );
  const [titlePosition, setTitlePosition] =
    React.useState<IntroTitlePosition>(
      (savedIntro.title_position as IntroTitlePosition | null) ?? "hero",
    );
  /* Owner directive 2026-10-19 · "font style as option / text size as
     option / brainstorm world-class" · Phase 1 ships font + size
     chip rows. Phase 2 (color, highlight pill, alignment) deferred. */
  const [titleFontId, setTitleFontId] = React.useState<IntroOverlayFontId>(
    (savedIntro.title_font as IntroOverlayFontId | null) ?? "classic",
  );
  const [titleSizeId, setTitleSizeId] = React.useState<IntroOverlaySizeId>(
    (savedIntro.title_size as IntroOverlaySizeId | null) ?? "m",
  );
  /* Owner directive 2026-10-20 · "ship all · deeper creative controls" ·
     colour (8 presets · default white) · alignment (L/C/R) · background
     highlight pill · all drive the TitleOverlay in real time + persist
     with the save payload. */
  const [titleColor, setTitleColor] = React.useState<string>(
    savedIntro.title_color ?? "#FFFFFF",
  );
  const [titleAlign, setTitleAlign] = React.useState<
    "left" | "center" | "right"
  >((savedIntro.title_align as IntroTitleAlign | null) ?? "center");
  const [titleHighlight, setTitleHighlight] = React.useState<boolean>(
    savedIntro.title_highlight,
  );
  /* Owner directive 2026-10-20 · "ship segments" · per-character
     attribute array that tracks per-selection colour + size on top of
     the plain titleText string. Serialises to title_segments JSONB on
     Save · hydrates from savedIntro.title_segments on page load. */
  const [titleAttrs, setTitleAttrs] = React.useState<CharAttr[]>(() =>
    segmentsToAttrs(savedIntro.title_segments, savedIntro.title_text ?? ""),
  );
  /* Tracks the current textarea selection so Colour / Size dropdowns
     can apply to that range. Updated on select / click / key events. */
  const [titleSelection, setTitleSelection] = React.useState<{
    start: number;
    end: number;
  }>({ start: 0, end: 0 });

  /* Apply a colour (or size) to the current textarea selection · if
     the selection is empty, the pick becomes the GLOBAL default
     (sets titleColor / titleSizeId · attrs cleared across the whole
     text so the global colour wins). */
  const applyColorToSelection = React.useCallback(
    (hex: string) => {
      const { start, end } = titleSelection;
      if (end > start) {
        setTitleAttrs((prev) => {
          const next = prev.length === titleText.length
            ? [...prev]
            : titleText.split("").map(() => ({} as CharAttr));
          for (let i = start; i < end; i++) {
            next[i] = { ...next[i], color: hex };
          }
          return next;
        });
      } else {
        setTitleColor(hex);
        setTitleAttrs((prev) => prev.map((a) => ({ ...a, color: undefined })));
      }
    },
    [titleSelection, titleText],
  );

  const applySizeToSelection = React.useCallback(
    (size: IntroOverlaySizeId) => {
      const { start, end } = titleSelection;
      if (end > start) {
        setTitleAttrs((prev) => {
          const next = prev.length === titleText.length
            ? [...prev]
            : titleText.split("").map(() => ({} as CharAttr));
          for (let i = start; i < end; i++) {
            next[i] = { ...next[i], size };
          }
          return next;
        });
      } else {
        setTitleSizeId(size);
        setTitleAttrs((prev) => prev.map((a) => ({ ...a, size: undefined })));
      }
    },
    [titleSelection, titleText],
  );
  /* Owner directive 2026-10-20 · "open time in footer center · if the
     user put text in footer then opening time could go to header
     center · balance" · sample opening-hours toggle so the user can
     feel the dynamic position swap. Real business accounts will
     resolve this from their shop profile when the schema connects.
     Gated to Bisnis accounts only · personal accounts don't have
     opening hours · the toggle UI + preview rendering are suppressed
     entirely for non-Bisnis viewers (sealed 2026-10-20). */
  const isBisnis = drawerSession.isBisnis;
  const [showOpeningHours, setShowOpeningHours] = React.useState<boolean>(isBisnis);
  /* Owner directive 2026-10-20 · "add toggle for reset to original ·
     user may think their theme will look better and then see that our
     theme chat background and intro was better" · non-destructive
     compare toggle · ON swaps the preview back to the sealed theme
     intro + wallpaper + default typography · the user's customisations
     stay in React state so flipping OFF restores them · Save in ON
     mode commits the reset (clears custom intro + wallpaper). */
  const [useThemeOriginal, setUseThemeOriginal] = React.useState<boolean>(false);
  const SAMPLE_OPENING_HOURS = "Open · Mon–Sat · 10am–10pm";
  /* Owner directive 2026-10-20 · opening hours ALWAYS sit at the
     footer regardless of where the user's title is · if the title is
     also at footer the hours pill sits below it (bottom:10 vs
     bottom:40) so both read cleanly on one line. Only renders when
     the user has set opening hours on their shop profile · for now
     controlled by the sample toggle. */
  const openingHoursPosition: IntroTitlePosition = "footer";
  /* Owner directive 2026-10-20 · sample text format "<theme> - Create
     The Wow" so the preview tile reads as a punchy hero line on first
     load · falls back to the display name when no live-world theme is
     active. Cleared on first focus. */
  const defaultTitleText = React.useMemo(
    () => `${activeThemeName ?? displayName}\nFree Delivery`,
    [activeThemeName, displayName],
  );
  /* If savedIntro has title_text, the user committed something · don't
     treat the sample as placeholder. */
  const [isPlaceholder, setIsPlaceholder] = React.useState<boolean>(
    !savedIntro.title_text,
  );
  /* Owner directive 2026-10-19 · "upload their own chat wallpaper to
     match · image must be screen app size · we state the size and
     file type". Staged wallpaper is validated client-side first and
     uploaded on Save via the sealed storage pipeline (not yet wired
     to Supabase · lives in sessionStorage like the intro video). */
  const [stagedWallpaper, setStagedWallpaper] =
    React.useState<StagedWallpaper | null>(null);
  const [wallpaperError, setWallpaperError] = React.useState<string | null>(
    null,
  );
  const wallpaperInputRef = React.useRef<HTMLInputElement | null>(null);

  /* Owner directive 2026-10-19 · lazy-load the overlay font set via a
     single Google Fonts <link> on client mount · idempotent · the
     settings page is the only surface paying the download cost. */
  React.useEffect(() => {
    const id = "nex-intro-video-overlay-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = INTRO_OVERLAY_FONTS_HREF;
    document.head.appendChild(link);
  }, []);
  const [error, setError] = React.useState<string | null>(null);
  const [savedAt, setSavedAt] = React.useState<number | null>(null);

  const recordInputRef = React.useRef<HTMLInputElement | null>(null);
  const uploadInputRef = React.useRef<HTMLInputElement | null>(null);
  const titleTextareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const [emojiPickerOpen, setEmojiPickerOpen] = React.useState(false);
  /* Owner directive 2026-10-20 · "joker keypad with emoji + stickers +
     giphy is the source of truth · we can still scroll to find". The
     intro-video title textarea now opens JokerKeypad on tap instead
     of the native OS keyboard · the keypad's inline emoji/sticker/GIF
     drawers replace the dedicated EMOJI CENTER popup. */
  const [keypadOpen, setKeypadOpen] = React.useState(false);
  /* Owner directive 2026-10-20 · "when the user is typing in the
     keypad for the text on the overlay intro we move down the page
     so user can see what they are typing in the preview". A ref on
     the preview wrapper + scrollIntoView on keypad-open gets the
     preview tile visible ABOVE the keypad instead of hidden behind it. */
  const introPreviewRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (!keypadOpen) return;
    const el = introPreviewRef.current;
    if (!el) return;
    /* Small delay so the keypad has started its slide-up animation
       before we measure · scroll positions the preview near the top
       of the visible area so the keypad's drawer below doesn't eat
       its chrome. */
    const t = window.setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
    return () => window.clearTimeout(t);
  }, [keypadOpen]);
  /* One-shot engine on NEX_BUBBLES_PACKAGE drives the keypad's accent
     colour (brand cyan) · same engine the EMOJI CENTER popup used. */
  /* Owner directive 2026-10-19 · same picker as the chat composer ·
     one-shot engine on NEX_BUBBLES_PACKAGE so the picker chrome
     reads with the sealed NEX brand accent on this surface (settings
     page has no active theme context of its own). */
  const brandEngine = React.useMemo(
    () => createEngine(NEX_BUBBLES_PACKAGE),
    [],
  );

  /* Owner directive 2026-10-19 · insert the picked emoji at the
     textarea's current cursor position so the user can mix emoji
     into any part of the title. Falls back to append when the
     textarea hasn't been focused yet. Respects the 140-char overall
     cap + 3-line cap already enforced by the textarea's onChange. */
  const insertEmojiIntoTitle = React.useCallback((glyph: string) => {
    setTitleText((prev) => {
      const el = titleTextareaRef.current;
      let next: string;
      if (el && typeof el.selectionStart === "number") {
        const start = el.selectionStart;
        const end = el.selectionEnd ?? start;
        next = prev.slice(0, start) + glyph + prev.slice(end);
        /* Push caret past the inserted glyph on the next tick (after
           React commits the new value). */
        window.setTimeout(() => {
          if (!titleTextareaRef.current) return;
          const pos = start + glyph.length;
          titleTextareaRef.current.focus();
          titleTextareaRef.current.setSelectionRange(pos, pos);
        }, 0);
      } else {
        next = prev + glyph;
      }
      /* Re-run the same caps the textarea onChange enforces so the
         insert path can't bypass them. */
      const capped = next.split("\n").slice(0, 3).join("\n");
      return capped.slice(0, 140);
    });
  }, []);

  const clearStaged = React.useCallback(() => {
    if (staged?.previewUrl) URL.revokeObjectURL(staged.previewUrl);
    setStaged(null);
  }, [staged]);

  /* Owner directive 2026-10-19 · "when the user has set their video
     and its live - button will appear in this container for reset
     intro which will reset back to original intro with the chat
     theme". Tracks whether a saved intro exists so the Reset button
     shows / hides correctly. Preview-honest · reads from the same
     sessionStorage key the Save button writes. Production path will
     replace this check with `account.intro_video_url !== null`
     resolved server-side. */
  /* Owner directive 2026-10-20 · "ship actions" · hasLiveIntro now
     resolves from server-hydrated savedIntro.video_url · updated on
     each successful save/upload/clear via the action responses. */
  const [hasLiveIntro, setHasLiveIntro] = React.useState<boolean>(
    savedIntro.video_url !== null,
  );

  const resetToThemeIntro = React.useCallback(async () => {
    /* Server-side clear · the UI stops staged state locally + the DB
       drops the pointer columns · the preview falls back to the active
       theme's packaged intro via activeThemeIntroUrl. */
    clearStaged();
    setTitleText("");
    setTitlePosition("hero");
    setIntroEnabled(true);
    setError(null);
    setSavedAt(null);
    try {
      const r = await resetIntroToThemeDefaultsAction();
      if (r.ok && r.data) {
        setSavedIntroVideoUrl(r.data.video_url);
        setSavedWallpaperUrl(r.data.wallpaper_url);
      }
    } catch {
      /* ignore · best-effort reset */
    }
    setHasLiveIntro(false);
  }, [clearStaged]);

  React.useEffect(() => {
    return () => {
      if (staged?.previewUrl) URL.revokeObjectURL(staged.previewUrl);
    };
    // Only cleanup on unmount; replacement is handled by clearStaged.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileChange = React.useCallback(
    async (ev: React.ChangeEvent<HTMLInputElement>) => {
      setError(null);
      const file = ev.target.files?.[0];
      ev.target.value = "";
      if (!file) return;

      // Client-side gates · the server action re-validates all of
      // these before accepting the upload.
      if (!file.type.startsWith("video/")) {
        setError("Please select a video file.");
        return;
      }
      if (file.size > MAX_BYTES) {
        setError(
          `Video is too large · max ${Math.round(MAX_BYTES / 1024 / 1024)}MB.`,
        );
        return;
      }
      let metadata;
      try {
        metadata = await probeVideo(file);
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Could not read this video.",
        );
        return;
      }
      if (metadata.durationSec > MAX_SECONDS + 0.25) {
        setError(
          `Video is ${metadata.durationSec.toFixed(1)}s · max ${MAX_SECONDS} seconds · trim and try again.`,
        );
        return;
      }
      const isPortrait = metadata.height >= metadata.width;
      if (!isPortrait) {
        setError(
          "Please re-record in portrait (vertical) · landscape videos don't fit the chat frame.",
        );
        return;
      }
      // All gates pass · stage locally then upload to the server.
      clearStaged();
      const previewUrl = URL.createObjectURL(file);
      setStaged({
        file,
        previewUrl,
        durationSec: metadata.durationSec,
        width: metadata.width,
        height: metadata.height,
        isPortrait,
      });
      /* Owner directive 2026-10-20 · "ship actions" · upload to the
         sealed nex-user-intros bucket + persist URL on nex_account.
         The staged previewUrl stays until the server returns the
         canonical public URL so the user sees instant feedback. */
      setUploadingVideo(true);
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("durationMs", String(Math.round(metadata.durationSec * 1000)));
        const r = await uploadIntroVideoAction(fd);
        if (!r.ok || !r.data) {
          setError(r.error || "Video upload failed");
          return;
        }
        setSavedIntroVideoUrl(r.data.video_url);
        setHasLiveIntro(r.data.video_url !== null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Video upload failed");
      } finally {
        setUploadingVideo(false);
      }
    },
    [clearStaged],
  );

  const clearStagedWallpaper = React.useCallback(async () => {
    if (stagedWallpaper?.previewUrl)
      URL.revokeObjectURL(stagedWallpaper.previewUrl);
    setStagedWallpaper(null);
    setWallpaperError(null);
    /* Owner directive 2026-10-20 · when a saved wallpaper exists on
       the server, also clear it so the preview reverts to the theme
       default on the next page load. */
    if (savedWallpaperUrl) {
      try {
        const r = await clearWallpaperAction();
        if (r.ok) setSavedWallpaperUrl(null);
      } catch {
        /* best-effort · the staged clear already succeeded locally */
      }
    }
  }, [stagedWallpaper, savedWallpaperUrl]);

  const handleWallpaperChange = React.useCallback(
    async (ev: React.ChangeEvent<HTMLInputElement>) => {
      const file = ev.target.files?.[0];
      ev.target.value = ""; // allow re-selecting same file
      if (!file) return;
      setWallpaperError(null);
      /* 1 · mime check · must be in the allow-list */
      const mimeLabel = WALLPAPER_MIME_ALLOWED[file.type];
      if (!mimeLabel) {
        setWallpaperError(
          `${file.type || "Unknown"} isn't accepted · use PNG, JPG, or WebP.`,
        );
        return;
      }
      /* 2 · size check · max 5 MB */
      if (file.size > WALLPAPER_MAX_BYTES) {
        setWallpaperError(
          `${(file.size / 1024 / 1024).toFixed(2)} MB is over the 5 MB limit · compress and retry.`,
        );
        return;
      }
      /* 3 · dimension + ratio check · must be portrait 9:16 ±8 %, min 720×1280 */
      let dims: { width: number; height: number };
      try {
        dims = await probeImage(file);
      } catch {
        setWallpaperError("Image failed to decode · try a different file.");
        return;
      }
      if (dims.width < WALLPAPER_MIN_WIDTH || dims.height < WALLPAPER_MIN_HEIGHT) {
        setWallpaperError(
          `${dims.width}×${dims.height} is too small · minimum ${WALLPAPER_MIN_WIDTH}×${WALLPAPER_MIN_HEIGHT}.`,
        );
        return;
      }
      const ratio = dims.width / dims.height;
      if (
        Math.abs(ratio - WALLPAPER_RATIO_TARGET) >
        WALLPAPER_RATIO_TOLERANCE
      ) {
        setWallpaperError(
          `${dims.width}×${dims.height} isn't 9:16 portrait · use the full phone-screen size (e.g. 1125×2436).`,
        );
        return;
      }
      /* All client checks passed · stage locally for instant preview,
         then upload to the server. */
      clearStagedWallpaper();
      const previewUrl = URL.createObjectURL(file);
      setStagedWallpaper({
        file,
        previewUrl,
        width: dims.width,
        height: dims.height,
        mimeLabel,
      });
      /* Owner directive 2026-10-20 · "ship actions" · upload to the
         nex-user-wallpapers bucket + persist URL on nex_account.
         The staged previewUrl stays until the server returns the
         canonical public URL. */
      setUploadingWallpaper(true);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const r = await uploadWallpaperAction(fd);
        if (!r.ok || !r.data) {
          setWallpaperError(r.error || "Wallpaper upload failed");
          return;
        }
        setSavedWallpaperUrl(r.data.wallpaper_url);
      } catch (e) {
        setWallpaperError(
          e instanceof Error ? e.message : "Wallpaper upload failed",
        );
      } finally {
        setUploadingWallpaper(false);
      }
    },
    [clearStagedWallpaper],
  );

  const canSave =
    !!staged ||
    !!stagedWallpaper ||
    titleText.trim().length > 0 ||
    !introEnabled;

  const handleSave = React.useCallback(async (): Promise<boolean> => {
    /* Owner directive 2026-10-20 · "ship actions" · writes land in
       nex_account via the sealed updateIntroSettingsAction · if the
       "Use theme original" toggle is ON, the full reset action is
       called instead (clears video/wallpaper pointers + all typography
       columns in one DB round-trip).
       Returns `true` when the save (or reset) committed successfully,
       `false` on any error path · the View Live Now auto-save flow
       uses this signal to gate the subsequent navigation so a user
       isn't flung into the live preview with half-saved state. */
    setError(null);
    try {
      if (useThemeOriginal) {
        const r = await resetIntroToThemeDefaultsAction();
        if (!r.ok || !r.data) {
          setError(r.error || "Reset failed");
          return false;
        }
        clearStaged();
        clearStagedWallpaper();
        setTitleText("");
        setIsPlaceholder(true);
        setTitlePosition("hero");
        setTitleFontId("classic");
        setTitleSizeId("m");
        setTitleColor("#FFFFFF");
        setTitleAlign("center");
        setTitleHighlight(false);
        setHasLiveIntro(false);
        setUseThemeOriginal(false);
        setSavedIntroVideoUrl(null);
        setSavedWallpaperUrl(null);
        setSavedAt(Date.now());
        return true;
      }
      const effectiveTitle =
        (isPlaceholder && !titleText.trim()
          ? defaultTitleText
          : titleText.trim()) || "";
      const fd = new FormData();
      fd.append("enabled", String(introEnabled));
      fd.append("title_text", effectiveTitle);
      /* Owner directive 2026-10-20 · "ship segments" · serialise the
         per-char attrs array to the compressed segments form the DB
         stores · attrsToSegments returns null when every char uses
         the global colour+size (saves bytes · the DB column goes
         NULL and the renderer falls back to the global). */
      const segs = attrsToSegments(effectiveTitle, titleAttrs);
      fd.append("title_segments", JSON.stringify(segs ?? []));
      fd.append("title_position", titlePosition);
      fd.append("title_font", titleFontId);
      fd.append("title_size", titleSizeId);
      fd.append("title_color", titleColor);
      fd.append("title_align", titleAlign);
      fd.append("title_highlight", String(titleHighlight));
      const r = await updateIntroSettingsAction(fd);
      if (!r.ok) {
        setError(r.error || "Save failed");
        return false;
      }
      setSavedAt(Date.now());
      if (r.data?.video_url) setHasLiveIntro(true);
      return true;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save · try again.",
      );
      return false;
    }
  }, [
    introEnabled,
    titleText,
    titlePosition,
    titleFontId,
    titleSizeId,
    titleColor,
    titleAlign,
    titleHighlight,
    isPlaceholder,
    defaultTitleText,
    useThemeOriginal,
    clearStaged,
    clearStagedWallpaper,
  ]);

  // Owner directive 2026-10-20 · "View Live Now" footer action ·
  // ALWAYS invokes handleSave (not gated on canSave) · reason: the
  // user may have uploaded a video (which auto-saves video_url) +
  // left the title field as placeholder · canSave reads false in
  // that state because titleText.trim().length === 0, but we still
  // need to persist the title. handleSave resolves the empty-title
  // case to `defaultTitleText` (display name / theme name) via its
  // internal `effectiveTitle` logic so /live reads back a non-empty
  // title_text and the TitleOverlay renders. If save fails the error
  // banner above the footer tells the user and navigation is aborted.
  const handleViewLiveNow = React.useCallback(async () => {
    const ok = await handleSave();
    if (!ok) return;
    router.push("/nex-native/settings/intro-video/live");
  }, [handleSave, router]);

  return (
    <main
      data-nex-settings-intro-video
      style={{
        minHeight: "100dvh",
        /* Owner directive 2026-10-19 · "same background image as the
           chat theme library page" · pinned-top neon-earth-bg scrolls
           once (one viewport tall) then the rest sits on clean navy ·
           matches the sealed Contacts + chat-themes-library pattern. */
        position: "relative",
        background: NEX.bg,
        color: NEX.textPrimary,
        fontFamily: NEX_FONT_SANS,
        padding:
          "calc(env(safe-area-inset-top, 0) + 14px) 16px calc(env(safe-area-inset-bottom, 0) + 24px)",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      {/* Pinned starry hero · aria-hidden · behind every other control */}
      { /* eslint-disable-next-line @next/next/no-img-element */ }
      <img
        src="/nex-native/contacts/neon-earth-bg.png"
        alt=""
        aria-hidden
        data-nex-intro-video-bg-image
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100dvh",
          objectFit: "cover",
          objectPosition: "top center",
          zIndex: 0,
          pointerEvents: "none",
          userSelect: "none",
        }}
      />
      {/* Soft navy scrim for legibility · lets the stars peek through */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "100dvh",
          background:
            "linear-gradient(180deg, rgba(2,9,20,0.35) 0%, rgba(2,9,20,0.78) 60%, rgba(2,9,20,0.92) 100%)",
          zIndex: 0,
          pointerEvents: "none",
        }}
      />
      {/* Content wrapper lifted above the backdrop */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
      {/* Owner directive 2026-10-19 · header matches the sealed
          welcome-page identity row · NexPingBadge (56px cyan with
          pulsing halo) on the left · "Intro Chat" wordmark at 26/900
          with subtitle at 12/500 textSecondary · ControlDrawer trigger
          on the right. Same sizing + colour tokens the welcome page
          uses so the two surfaces read as one brand voice. */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 4,
        }}
        data-nex-settings-intro-video-header
      >
        <NexPingBadge size={56} accent={NEX.cyan} dataTestId="intro-video-nex" />
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 2,
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              position: "relative",
              zIndex: 3,
            }}
          >
            <span
              style={{
                fontSize: 26,
                fontWeight: 900,
                letterSpacing: "-0.01em",
                color: NEX.textPrimary,
                lineHeight: 1,
                textShadow: "0 2px 10px rgba(0,0,0,0.6)",
              }}
            >
              Intro Chat
            </span>
            <div style={{ display: "inline-flex", marginLeft: "auto" }}>
              <ControlDrawer session={drawerSession} />
            </div>
          </div>
          <span
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: NEX.textSecondary,
              lineHeight: 1.2,
              textShadow: "0 1px 3px rgba(0,0,0,0.55)",
            }}
          >
            First impressions always last
          </span>
        </div>
      </header>

      {/* ─── Section 1 · Add a Custom Video · owner directive
          2026-10-19 · "Intro on should be part of the intro container
          header" · the sealed "Chat Intro" standalone section merged
          into this panel's headerExtra slot so the On/Off toggle lives
          beside the title. */}
      <Section
        title="Edit Intro"
        headerExtra={
          <IntroToggle enabled={introEnabled} onChange={setIntroEnabled} />
        }
      >
        {/* Preview wrapper · ref anchors the keypad-open scroll · the
            scroll-margin-top keeps the preview comfortably below the
            page header when scrollIntoView fires. */}
        <div
          ref={introPreviewRef}
          data-nex-intro-video-preview-anchor
          style={{ scrollMarginTop: 20 }}
        >
        <IntroPreview
          videoUrl={
            useThemeOriginal
              ? activeThemeIntroUrl ?? null
              : staged?.previewUrl ?? savedIntroVideoUrl ?? activeThemeIntroUrl ?? null
          }
          titleText={
            useThemeOriginal
              ? defaultTitleText
              : isPlaceholder && !titleText
                ? defaultTitleText
                : titleText
          }
          titleAttrs={useThemeOriginal ? [] : titleAttrs}
          titlePosition={useThemeOriginal ? "hero" : titlePosition}
          titleFontId={useThemeOriginal ? "classic" : titleFontId}
          titleSizeId={useThemeOriginal ? "m" : titleSizeId}
          titleColor={useThemeOriginal ? "#FFFFFF" : titleColor}
          titleAlign={useThemeOriginal ? "center" : titleAlign}
          titleHighlight={useThemeOriginal ? false : titleHighlight}
          openingHours={isBisnis && showOpeningHours ? SAMPLE_OPENING_HOURS : null}
          openingHoursPosition={openingHoursPosition}
          enabled={introEnabled}
        />
        </div>

        {/* Owner directive 2026-10-20 · "add toggle for reset theme to
            original · user may think their theme will look better and
            then see that our theme chat background and intro was
            better" · non-destructive compare toggle · ON swaps the
            preview back to the sealed theme intro + wallpaper +
            default typography · the user's customisations stay in
            React state so flipping OFF restores them · pressing Save
            in ON mode commits the reset. */}
        <div
          data-nex-intro-video-use-theme-original
          style={{
            marginTop: 10,
            padding: "10px 12px",
            borderRadius: 10,
            border: `1px solid ${
              useThemeOriginal ? NEX.cyan : NEX.panelBorder
            }`,
            background: useThemeOriginal
              ? `${NEX.cyan}18`
              : "rgba(255,255,255,0.03)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: useThemeOriginal ? NEX.cyan : NEX.textPrimary,
              }}
            >
              Use theme original
            </span>
            <span
              style={{
                fontSize: 10,
                color: NEX.textMute,
                lineHeight: 1.4,
              }}
            >
              Reset Back To Original Theme
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={useThemeOriginal}
            onClick={() => setUseThemeOriginal((v) => !v)}
            data-nex-intro-video-use-theme-original-toggle={useThemeOriginal ? "true" : "false"}
            style={{
              width: 36,
              height: 20,
              borderRadius: 999,
              border: "none",
              background: useThemeOriginal
                ? NEX.cyan
                : "rgba(255,255,255,0.2)",
              position: "relative",
              cursor: "pointer",
              padding: 0,
              flexShrink: 0,
            }}
          >
            <span
              aria-hidden
              style={{
                position: "absolute",
                top: 2,
                left: useThemeOriginal ? 18 : 2,
                width: 16,
                height: 16,
                borderRadius: 999,
                background: "#FFFFFF",
                transition: "left 180ms ease",
                boxShadow: "0 1px 3px rgba(0,0,0,0.5)",
              }}
            />
          </button>
        </div>

        {/* Owner directive 2026-10-19 · Reset Intro button · appears
            only when the user has a live custom intro saved · tapping
            clears everything and the preview reverts to the active
            theme's packaged intro. */}
        {hasLiveIntro && (
          <button
            type="button"
            onClick={resetToThemeIntro}
            data-nex-intro-video-reset
            style={{
              marginBottom: 10,
              padding: "10px 14px",
              borderRadius: 10,
              border: `1px solid ${NEX.panelBorder}`,
              background: "rgba(255,59,48,0.14)",
              color: "#FFB4B0",
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: "0.04em",
              cursor: "pointer",
              fontFamily: NEX_FONT_SANS,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              width: "100%",
            }}
          >
            <span aria-hidden style={{ fontSize: 14 }}>↺</span>
            Reset intro · use theme intro again
          </button>
        )}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            ref={recordInputRef}
            type="file"
            accept="video/*"
            capture="user"
            hidden
            onChange={handleFileChange}
            data-nex-intro-video-record-input
          />
          <input
            ref={uploadInputRef}
            type="file"
            accept="video/*"
            hidden
            onChange={handleFileChange}
            data-nex-intro-video-upload-input
          />
          <button
            type="button"
            onClick={() => recordInputRef.current?.click()}
            data-nex-intro-video-choose
            style={{
              flex: 1,
              minWidth: 140,
              padding: "12px 16px",
              borderRadius: 999,
              border: `1.5px solid ${NEX.cyan}`,
              background: "transparent",
              color: NEX.cyan,
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: "0.04em",
              cursor: "pointer",
              fontFamily: NEX_FONT_SANS,
            }}
          >
            Choose
          </button>
          <button
            type="button"
            onClick={() => uploadInputRef.current?.click()}
            data-nex-intro-video-upload
            style={{
              flex: 1,
              minWidth: 140,
              padding: "12px 16px",
              borderRadius: 999,
              border: "none",
              background: NEX.cyan,
              color: "#021424",
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: "0.04em",
              cursor: "pointer",
              fontFamily: NEX_FONT_SANS,
              boxShadow: `0 6px 14px -6px ${NEX.cyan}aa, 0 0 18px rgba(0,175,255,0.3)`,
            }}
          >
            Upload
          </button>
        </div>
        {staged && (
          <div
            style={{
              marginTop: 10,
              padding: "8px 12px",
              borderRadius: 10,
              background: NEX.cyanDim,
              border: `1px solid ${NEX.panelBorder}`,
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 12,
            }}
          >
            <span style={{ flex: 1, color: NEX.textPrimary }}>
              Staged · {staged.width}×{staged.height} ·{" "}
              {staged.durationSec.toFixed(1)}s ·{" "}
              {(staged.file.size / 1024 / 1024).toFixed(2)}MB
            </span>
            <button
              type="button"
              onClick={clearStaged}
              style={{
                padding: "4px 10px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.2)",
                background: "transparent",
                color: NEX.textSecondary,
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: NEX_FONT_SANS,
              }}
            >
              Retake
            </button>
          </div>
        )}
        {error && (
          <div
            role="alert"
            style={{
              marginTop: 10,
              padding: "8px 12px",
              borderRadius: 10,
              background: "rgba(255,59,48,0.14)",
              border: "1px solid rgba(255,59,48,0.42)",
              color: "#FFB4B0",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {error}
          </div>
        )}
      </Section>

      {/* ─── Section 4 · Title overlay ─────────────────────────────── */}
      <Section
        title="Title overlay"
        description="Keep your contacts up to date · share a promo, flag a new menu item, or just drop a warm welcome."
      >
        {/* Owner directive 2026-10-19 · textarea instead of input so:
            · spacebar / arrow keys behave natively (always did on
              input too but owner called it out)
            · Enter / Return starts a new line
            · max 3 lines enforced on change (strip 4th+ line) */}
        <div style={{ position: "relative" }}>
          {/* Owner directive 2026-10-20 · "joker keypad is the source
              of truth" · tapping the textarea OPENS JokerKeypad in
              place of the OS keyboard · readOnly + inputMode="none"
              keep iOS/Android keyboards away · users can still long-
              press to SELECT text so the per-selection colour + size
              workflow stays intact. */}
          <textarea
            ref={titleTextareaRef}
            value={titleText}
            placeholder={isPlaceholder ? defaultTitleText : "e.g. Welcome to\nHammerex Pizza"}
            readOnly
            inputMode="none"
            onFocus={() => {
              setIsPlaceholder(false);
              setKeypadOpen(true);
            }}
            onClick={(e) => {
              const el = e.currentTarget;
              setTitleSelection({
                start: el.selectionStart ?? 0,
                end: el.selectionEnd ?? 0,
              });
              setKeypadOpen(true);
            }}
            onSelect={(e) => {
              const el = e.currentTarget;
              setTitleSelection({
                start: el.selectionStart ?? 0,
                end: el.selectionEnd ?? 0,
              });
            }}
            onKeyUp={(e) => {
              const el = e.currentTarget;
              setTitleSelection({
                start: el.selectionStart ?? 0,
                end: el.selectionEnd ?? 0,
              });
            }}
            rows={3}
            data-nex-intro-video-title-input
            style={{
              width: "100%",
              padding: "12px 44px 12px 14px",
              borderRadius: 10,
              background: "rgba(255,255,255,0.06)",
              border: `1px solid ${NEX.panelBorder}`,
              color: NEX.textPrimary,
              fontSize: 14,
              fontWeight: 700,
              fontFamily: NEX_FONT_SANS,
              outline: "none",
              boxSizing: "border-box",
              resize: "none",
              lineHeight: 1.3,
              minHeight: 72,
              cursor: "text",
            }}
          />
          {/* Owner directive 2026-10-20 · the sealed JokerKeypad has
              its own emoji drawer tab · the standalone 😊 button is
              gone · users tap the textarea to open the keypad and
              reach emoji / stickers / GIFs from inside it. */}
          {/* Owner directive 2026-10-19 · character counter badge
              bottom-right of the textarea (mirrors the mockup's
              "140/180" chip). 140 is the hard cap enforced on change. */}
          <div
            data-nex-intro-video-char-count
            aria-live="polite"
            style={{
              position: "absolute",
              right: 10,
              bottom: 8,
              padding: "2px 8px",
              borderRadius: 999,
              background: "rgba(0,0,0,0.55)",
              border: `1px solid ${NEX.panelBorder}`,
              color: NEX.textSecondary,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.04em",
              pointerEvents: "none",
            }}
          >
            {titleText.length}/140
          </div>
        </div>

        {/* Owner directive 2026-10-19 · "font slider need dark
            background · can't see the font styles · list all styles" ·
            custom dropdown with each option rendered in its real
            typeface on a dark panel. Native <select> can't style
            option backgrounds / per-option font-family cross-browser,
            so this pair of popovers replaces them. */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            marginTop: 10,
          }}
        >
          <FontDropdown
            value={titleFontId}
            onChange={setTitleFontId}
          />
          <SizeDropdown
            value={titleSizeId}
            onChange={applySizeToSelection}
          />
        </div>

        {/* Owner directive 2026-10-20 · "deeper creative controls" ·
            colour palette · 8 preset swatches (white, black, cyan,
            orange, pink, green, red, gold) · click to apply · active
            swatch gets a cyan rim. */}
        <div style={{ marginTop: 10 }}>
          <span
            style={{
              fontSize: 10,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: NEX.textMute,
              fontWeight: 800,
              display: "block",
              marginBottom: 6,
            }}
          >
            Colour{titleSelection.end > titleSelection.start
              ? ` · applies to selection (${titleSelection.end - titleSelection.start} chars)`
              : " · applies to all"}
          </span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              "#FFFFFF",
              "#000000",
              "#00AFFF",
              "#FF7200",
              "#FF4FA0",
              "#16D66B",
              "#FF3B30",
              "#FFD700",
            ].map((hex) => {
              const active = titleColor.toLowerCase() === hex.toLowerCase();
              return (
                <button
                  key={hex}
                  type="button"
                  aria-label={`Text color ${hex}`}
                  aria-pressed={active}
                  /* Owner directive 2026-10-20 · preventDefault on
                     mousedown stops the swatch from stealing focus
                     from the textarea · the user's selection stays
                     intact so the colour applies to it. Without this,
                     clicking the swatch collapses the selection and
                     the colour would hit the global instead. */
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyColorToSelection(hex)}
                  data-nex-intro-video-color-swatch={hex}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 999,
                    border: `2px solid ${active ? NEX.cyan : "rgba(255,255,255,0.15)"}`,
                    background: hex,
                    cursor: "pointer",
                    padding: 0,
                    boxShadow: active
                      ? `0 0 0 2px ${NEX.cyan}44, 0 2px 6px rgba(0,0,0,0.5)`
                      : "0 2px 4px rgba(0,0,0,0.4)",
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Alignment · L / C / R · single-row chip group */}
        <div style={{ marginTop: 10 }}>
          <span
            style={{
              fontSize: 10,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: NEX.textMute,
              fontWeight: 800,
              display: "block",
              marginBottom: 6,
            }}
          >
            Alignment
          </span>
          <div
            role="radiogroup"
            aria-label="Title alignment"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 6,
            }}
          >
            {(["left", "center", "right"] as const).map((a) => {
              const active = titleAlign === a;
              const glyph = a === "left" ? "◧" : a === "center" ? "☰" : "◨";
              return (
                <button
                  key={a}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setTitleAlign(a)}
                  data-nex-intro-video-align={a}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: `1.5px solid ${active ? NEX.cyan : NEX.panelBorder}`,
                    background: active
                      ? `${NEX.cyan}22`
                      : "rgba(255,255,255,0.03)",
                    color: active ? NEX.cyan : NEX.textPrimary,
                    cursor: "pointer",
                    fontSize: 16,
                    fontFamily: NEX_FONT_SANS,
                    textAlign: "center",
                  }}
                >
                  {glyph}
                </button>
              );
            })}
          </div>
        </div>

        {/* Background highlight toggle · dark pill behind each line
            for busy wallpapers. */}
        <div
          style={{
            marginTop: 10,
            padding: "10px 12px",
            borderRadius: 10,
            border: `1px solid ${NEX.panelBorder}`,
            background: "rgba(255,255,255,0.03)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: NEX.textPrimary }}>
              Background highlight
            </span>
            <span style={{ fontSize: 10, color: NEX.textMute, lineHeight: 1.4 }}>
              Dark pill behind text · boosts legibility on busy videos
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={titleHighlight}
            onClick={() => setTitleHighlight((v) => !v)}
            data-nex-intro-video-highlight={titleHighlight ? "true" : "false"}
            style={{
              width: 36,
              height: 20,
              borderRadius: 999,
              border: "none",
              background: titleHighlight ? NEX.cyan : "rgba(255,255,255,0.2)",
              position: "relative",
              cursor: "pointer",
              padding: 0,
              flexShrink: 0,
            }}
          >
            <span
              aria-hidden
              style={{
                position: "absolute",
                top: 2,
                left: titleHighlight ? 18 : 2,
                width: 16,
                height: 16,
                borderRadius: 999,
                background: "#FFFFFF",
                transition: "left 180ms ease",
                boxShadow: "0 1px 3px rgba(0,0,0,0.5)",
              }}
            />
          </button>
        </div>

        {/* Owner directive 2026-10-20 · opening hours is a Bisnis-only
            affordance · personal accounts don't have hours · the toggle
            + preview rendering are suppressed entirely for non-Bisnis
            viewers so a free user never sees a feature they can't use.
            Business accounts see the toggle + sample preview until the
            production shop-hours schema connects. */}
        {isBisnis && (
          <div
            style={{
              marginTop: 10,
              padding: "10px 12px",
              borderRadius: 10,
              border: `1px solid ${NEX.panelBorder}`,
              background: "rgba(255,255,255,0.03)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: NEX.textPrimary }}>
                Opening hours
              </span>
              <span style={{ fontSize: 10, color: NEX.textMute, lineHeight: 1.4 }}>
                Sample · auto-swaps to the opposite end of your title · businesses only when live
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={showOpeningHours}
              onClick={() => setShowOpeningHours((v) => !v)}
              data-nex-intro-video-opening-hours-toggle={showOpeningHours ? "true" : "false"}
              style={{
                width: 36,
                height: 20,
                borderRadius: 999,
                border: "none",
                background: showOpeningHours ? NEX.cyan : "rgba(255,255,255,0.2)",
                position: "relative",
                cursor: "pointer",
                padding: 0,
                flexShrink: 0,
              }}
            >
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  top: 2,
                  left: showOpeningHours ? 18 : 2,
                  width: 16,
                  height: 16,
                  borderRadius: 999,
                  background: "#FFFFFF",
                  transition: "left 180ms ease",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.5)",
                }}
              />
            </button>
          </div>
        )}

        {/* Owner directive 2026-10-20 · EMOJI CENTER popup retired ·
            JokerKeypad (mounted at the end of this component) owns
            emoji + sticker + GIF insertion from inside the typing
            surface itself. */}
        <div
          role="radiogroup"
          aria-label="Title position"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 8,
            marginTop: 10,
          }}
        >
          {(["hero", "center", "footer"] as const).map((pos) => (
            <PositionChoice
              key={pos}
              position={pos}
              active={titlePosition === pos}
              onSelect={() => setTitlePosition(pos)}
            />
          ))}
        </div>

      </Section>

      {/* ─── Section 4 · Upload Your Wallpaper ─────────────────────── */}
      {/* Owner directive 2026-10-19 · "do we need section that if user
          wants to upload their own intro that they can also change the
          back ground image for their chat to match · image must be
          screen app size to accept and we state the size and file
          type we accept for sure error free upload". */}
      <Section
        title="Chat Screen image"
        description="Match your intro with a custom chat image. The upload must be portrait phone-screen size."
      >
        {/* Owner directive 2026-10-20 · "red dark red on 1 row ·
            NEX validates before accepting." · dedicated single-line
            warning so the user reads the moderation promise before
            tapping Choose. Dark red (#8B1A1A) matches the sealed
            delete/warning accent used elsewhere in the app. */}
        <div
          data-nex-intro-video-wallpaper-validate-note
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.04em",
            color: "#8B1A1A",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          NEX validates before accepting.
        </div>
        <input
          ref={wallpaperInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={handleWallpaperChange}
          data-nex-intro-video-wallpaper-input
        />
        {/* Owner directive 2026-10-19 · vertical layout · preview on
            top (shows the original chat theme wallpaper by default,
            replaced by any staged upload), tiny requirements line
            just above the Choose button at the bottom of the panel. */}
        <div
          data-nex-intro-video-wallpaper-preview
          style={{
            width: "100%",
            maxWidth: 140,
            margin: "0 auto",
            aspectRatio: "9 / 16",
            borderRadius: 12,
            overflow: "hidden",
            background: "rgba(0,0,0,0.45)",
            border: `1px solid ${NEX.panelBorder}`,
            position: "relative",
          }}
        >
          {(() => {
            const previewSrc =
              stagedWallpaper?.previewUrl ?? savedWallpaperUrl ?? activeThemeWallpaperUrl;
            if (previewSrc) {
              return (
                <>
                  { /* eslint-disable-next-line @next/next/no-img-element */ }
                  <img
                    src={previewSrc}
                    alt=""
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                  <div
                    aria-hidden
                    style={{
                      position: "absolute",
                      inset: 0,
                      background:
                        "linear-gradient(180deg, rgba(0,0,0,0.0), rgba(0,0,0,0.55))",
                    }}
                  />
                </>
              );
            }
            return (
              <div
                style={{
                  display: "grid",
                  placeItems: "center",
                  width: "100%",
                  height: "100%",
                  color: NEX.textMute,
                  fontSize: 10,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  fontWeight: 800,
                  textAlign: "center",
                  padding: 8,
                }}
              >
                No background · theme uses solid colour
              </div>
            );
          })()}
        </div>

        {stagedWallpaper && (
          <div
            style={{
              fontSize: 11,
              color: NEX.textMute,
              fontWeight: 600,
              lineHeight: 1.4,
              textAlign: "center",
            }}
          >
            Staged · {stagedWallpaper.width}×{stagedWallpaper.height} ·{" "}
            {stagedWallpaper.mimeLabel} ·{" "}
            {(stagedWallpaper.file.size / 1024 / 1024).toFixed(2)} MB
          </div>
        )}

        {/* Owner directive 2026-10-19 · "move down the choose button to
            lower container and over add small text - size image and
            file type required" · one-line hint sits directly above
            the Choose button so the user reads the requirements
            immediately before tapping. */}
        <div
          data-nex-intro-video-wallpaper-requirements
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.04em",
            color: NEX.textMute,
            textAlign: "center",
            lineHeight: 1.5,
            marginTop: 4,
          }}
        >
          Portrait 9:16 · min {WALLPAPER_MIN_WIDTH}×{WALLPAPER_MIN_HEIGHT} · PNG · JPG · WebP · max 5 MB
        </div>

        <button
          type="button"
          onClick={() => wallpaperInputRef.current?.click()}
          data-nex-intro-video-wallpaper-choose
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: 999,
            border: "none",
            background: NEX.cyan,
            color: "#021424",
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: "0.04em",
            cursor: "pointer",
            fontFamily: NEX_FONT_SANS,
            boxShadow: `0 6px 14px -6px ${NEX.cyan}aa`,
          }}
        >
          {stagedWallpaper ? "Replace" : "Choose"}
        </button>

        {stagedWallpaper && (
          <button
            type="button"
            onClick={clearStagedWallpaper}
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              border: `1px solid ${NEX.panelBorder}`,
              background: "transparent",
              color: NEX.textSecondary,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: NEX_FONT_SANS,
              alignSelf: "center",
            }}
          >
            Remove · use theme default
          </button>
        )}

        {wallpaperError && (
          <div
            role="alert"
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              background: "rgba(255,59,48,0.14)",
              border: "1px solid rgba(255,59,48,0.42)",
              color: "#FFB4B0",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {wallpaperError}
          </div>
        )}
      </Section>

      {/* ─── Section 5 · Save ──────────────────────────────────────── */}
      <div
        style={{
          position: "sticky",
          bottom: 0,
          marginTop: 10,
          padding:
            "10px 0 calc(env(safe-area-inset-bottom, 0) + 10px)",
          background: `linear-gradient(180deg, transparent, ${NEX.bg} 30%)`,
          /* Owner directive 2026-10-19 · dropdown popovers must open
             IN FRONT of the Save bar · explicit low z-index here so
             the Font/Size menus (zIndex: 2000) always win. */
          zIndex: 1,
        }}
      >
        {/* Owner directive 2026-10-20 · footer is now TWO buttons · Save
            (primary cyan filled) + View Live Now (secondary cyan
            outlined) · both at borderRadius 12 ("small corner rounds"
            per the owner spec, replacing the earlier pill 999). The
            View Live Now button auto-saves pending edits then routes
            to the dedicated /live preview which plays the intro full-
            screen and lands on /profile/me. The View Live Now button
            is enabled as soon as there is EITHER a pending edit (so
            auto-save covers it) OR an already-saved intro to preview
            (so a user who just loaded the page can jump straight to
            their live view without a redundant save). */}
        <div
          data-nex-intro-video-footer-actions
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
          }}
        >
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            data-nex-intro-video-save
            style={{
              padding: "14px 16px",
              borderRadius: 12,
              border: "none",
              background: canSave ? NEX.cyan : "rgba(255,255,255,0.08)",
              color: canSave ? "#021424" : NEX.textMute,
              fontSize: 15,
              fontWeight: 800,
              letterSpacing: "0.04em",
              cursor: canSave ? "pointer" : "default",
              fontFamily: NEX_FONT_SANS,
              boxShadow: canSave
                ? "0 10px 24px -8px rgba(0,175,255,0.6), 0 0 24px rgba(0,175,255,0.3)"
                : "none",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <span aria-hidden style={{ fontSize: 16 }}>✓</span>
            Save Changes
          </button>
          <button
            type="button"
            onClick={handleViewLiveNow}
            disabled={!canSave && !hasLiveIntro}
            data-nex-intro-video-view-live
            style={{
              padding: "14px 16px",
              borderRadius: 12,
              background: "transparent",
              color:
                !canSave && !hasLiveIntro ? NEX.textMute : NEX.cyan,
              border: `1.5px solid ${
                !canSave && !hasLiveIntro
                  ? "rgba(255,255,255,0.12)"
                  : NEX.cyan
              }`,
              fontSize: 15,
              fontWeight: 800,
              letterSpacing: "0.04em",
              cursor:
                !canSave && !hasLiveIntro ? "default" : "pointer",
              fontFamily: NEX_FONT_SANS,
              boxShadow:
                !canSave && !hasLiveIntro
                  ? "none"
                  : "0 0 18px rgba(0,175,255,0.18)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <span aria-hidden style={{ fontSize: 14 }}>▶</span>
            View Live Now
          </button>
        </div>
        {savedAt && (
          <div
            style={{
              marginTop: 8,
              textAlign: "center",
              fontSize: 11,
              color: NEX.green,
              fontWeight: 700,
            }}
          >
            Saved · preview will apply next time you open a chat theme
          </div>
        )}
      </div>
      </div>

      {/* Owner directive 2026-10-20 · "joker keypad with emoji +
          stickers + giphy is the source of truth" · tapping the title
          textarea opens this keypad in place of the OS keyboard · the
          keypad's inline Emoji / Stickers / GIFS drawers deliver all
          content types the title field accepts. onPickEmoji inserts
          a unicode glyph · onPickSticker inserts a `:slug:` token
          (same emoji-image resolver renders it in the overlay). */}
      <JokerKeypad
        open={keypadOpen}
        /* Owner directive 2026-10-20 · "load the keypad with emoji
           library" · intro-video surface opens straight to the emoji
           drawer · users scroll inside to find the mood they want. */
        initialPlane="emoji"
        value={titleText}
        onChange={(next) => {
          /* Enforce the same 3-line + 140-char caps the textarea had.
             Reflow per-char attrs so per-selection colour + size
             survive edits. */
          const lines = next.split("\n");
          const capped = lines.slice(0, 3).join("\n").slice(0, 140);
          setTitleAttrs((prev) => reflowAttrs(titleText, prev, capped));
          setTitleText(capped);
          setIsPlaceholder(false);
        }}
        onSend={() => {
          /* "Send" on this surface = Save intro · same canSave branch
             as the explicit Save button. */
          setKeypadOpen(false);
          void handleSave();
        }}
        onClose={() => setKeypadOpen(false)}
        /* Brand accent · same NEX cyan the rest of the page uses. */
        accentColor={NEX.cyan}
        onPickEmoji={(e) => {
          /* Image emoji picks are inserted as `:slug:` tokens · the
             TitleOverlay's emojiUrlForSlug resolver paints the image. */
          insertEmojiIntoTitle(`:${e.slug}:`);
        }}
        onPickSticker={(s) => {
          /* Stickers aren't native to the title overlay · but inserting
             as a `:slug:` token still resolves to the sticker image via
             the fallback URL resolver, so the user still gets visual
             feedback in the preview. */
          insertEmojiIntoTitle(`:${s.slug}:`);
        }}
        onPickGiphy={(g) => {
          /* GIFs on the title overlay insert as `:slug:` tokens · same
             image-resolver fallback renders them. GIFs are animated so
             the preview tile shows the animation inline. */
          insertEmojiIntoTitle(`:${g.slug}:`);
        }}
      />
    </main>
  );
}

// ───────────────────── Section wrapper ─────────────────────────────

function Section({
  title,
  description,
  headerExtra,
  children,
}: {
  title: string;
  description?: string;
  /** Owner directive 2026-10-19 · optional slot aligned to the right
   *  of the section title · lets a caller inline a toggle / badge /
   *  control into the section header (e.g. the Intro On switch on the
   *  Add a Custom Video panel). */
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section
      style={{
        padding: 14,
        borderRadius: 16,
        /* Owner directive 2026-10-19 · match the "edit chat intro"
           mockup · translucent navy panel with a cyan rim + soft outer
           glow so each section reads as its own card over the pinned
           starry background. */
        background: "rgba(5, 18, 32, 0.72)",
        border: `1.5px solid rgba(0,175,255,0.55)`,
        boxShadow:
          "0 0 0 1px rgba(0,175,255,0.12), 0 0 18px rgba(0,175,255,0.18), inset 0 1px 0 rgba(255,255,255,0.04)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: NEX.cyan,
            }}
          >
            {title}
          </h2>
          {description && (
            <p
              style={{
                margin: "4px 0 0",
                fontSize: 12,
                color: NEX.textSecondary,
                lineHeight: 1.5,
              }}
            >
              {description}
            </p>
          )}
        </div>
        {headerExtra && (
          <div style={{ flexShrink: 0, alignSelf: "center" }}>
            {headerExtra}
          </div>
        )}
      </div>
      {children}
    </section>
  );
}

// ───────────────────── Enable toggle ────────────────────────────────

function RequirementChip({ label }: { label: string }): React.JSX.Element {
  return (
    <span
      style={{
        padding: "4px 8px",
        borderRadius: 999,
        background: `${NEX.cyan}15`,
        border: `1px solid ${NEX.cyan}55`,
        color: NEX.cyan,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

// ─────────────── Font / Size dropdowns ────────────────────────────
//
// Owner directive 2026-10-19 · the native <select> element can't
// render per-option background or font-family cross-browser, so these
// custom popovers replace them. Each font option paints in its own
// typeface over a dark panel · click outside closes · ESC closes.

function useOutsideClick(
  ref: React.RefObject<HTMLDivElement | null>,
  onOutside: () => void,
): void {
  React.useEffect(() => {
    const handler = (ev: MouseEvent): void => {
      if (!ref.current) return;
      if (ref.current.contains(ev.target as Node)) return;
      onOutside();
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [ref, onOutside]);
}

/* Owner directive 2026-10-19 · "sliders should show in front of the
 * lower container" · the parent Section uses `backdrop-filter` which
 * creates a new stacking context, trapping any z-index on children.
 * Fix: portal the popover to document.body, position it with
 * `fixed` coords computed from the trigger's getBoundingClientRect
 * so it floats above every sibling panel + the sticky Save bar. */

function usePortaledPopover(open: boolean): {
  mounted: boolean;
  portalTarget: HTMLElement | null;
  rect: DOMRect | null;
  setTriggerEl: (el: HTMLButtonElement | null) => void;
  popoverRef: React.RefObject<HTMLUListElement | null>;
} {
  const [mounted, setMounted] = React.useState(false);
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const popoverRef = React.useRef<HTMLUListElement | null>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const measure = (): void => {
      const el = triggerRef.current;
      if (!el) return;
      setRect(el.getBoundingClientRect());
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open]);

  const setTriggerEl = React.useCallback((el: HTMLButtonElement | null) => {
    triggerRef.current = el;
  }, []);

  return {
    mounted,
    portalTarget: mounted ? document.body : null,
    rect,
    setTriggerEl,
    popoverRef,
  };
}

function usePopoverOutsideClick(
  triggerFn: () => HTMLButtonElement | null,
  popoverRef: React.RefObject<HTMLUListElement | null>,
  open: boolean,
  onClose: () => void,
): void {
  React.useEffect(() => {
    if (!open) return;
    const handler = (ev: MouseEvent): void => {
      const target = ev.target as Node;
      const trigger = triggerFn();
      if (trigger && trigger.contains(target)) return;
      if (popoverRef.current && popoverRef.current.contains(target)) return;
      onClose();
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [triggerFn, popoverRef, open, onClose]);
}

function FontDropdown({
  value,
  onChange,
}: {
  value: IntroOverlayFontId;
  onChange: (next: IntroOverlayFontId) => void;
}): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const popover = usePortaledPopover(open);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const setBothRefs = React.useCallback(
    (el: HTMLButtonElement | null) => {
      triggerRef.current = el;
      popover.setTriggerEl(el);
    },
    [popover],
  );
  usePopoverOutsideClick(
    React.useCallback(() => triggerRef.current, []),
    popover.popoverRef,
    open,
    React.useCallback(() => setOpen(false), []),
  );
  const active = fontById(value);
  return (
    <div style={{ minWidth: 0 }}>
      <span
        style={{
          fontSize: 10,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: NEX.textMute,
          fontWeight: 800,
          display: "block",
          marginBottom: 4,
        }}
      >
        Font
      </span>
      <button
        ref={setBothRefs}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        /* preventDefault on mousedown keeps the textarea focus +
           selection intact so a size pick applies to the user's
           current selection rather than collapsing it. */
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
        data-nex-intro-video-font-select
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: 10,
          border: `1px solid ${NEX.panelBorder}`,
          background: "rgba(5,18,32,0.9)",
          color: NEX.textPrimary,
          fontSize: 14,
          fontWeight: 700,
          fontFamily: active.fontFamily,
          outline: "none",
          cursor: "pointer",
          textAlign: "left",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          ...active.previewStyle,
        }}
      >
        <span>{active.label}</span>
        <span aria-hidden style={{ fontSize: 10, color: NEX.textMute }}>▾</span>
      </button>
      {open && popover.portalTarget && popover.rect &&
        createPortal(
          <ul
            ref={popover.popoverRef}
            role="listbox"
            style={{
              position: "fixed",
              top: popover.rect.bottom + 4,
              left: popover.rect.left,
              width: popover.rect.width,
              zIndex: 9999,
              margin: 0,
              padding: 4,
              listStyle: "none",
              background: "rgba(2,9,20,0.98)",
              border: `1px solid ${NEX.cyan}66`,
              borderRadius: 10,
              boxShadow:
                "0 10px 28px -6px rgba(0,0,0,0.7), 0 0 24px rgba(0,175,255,0.25)",
            }}
          >
            {INTRO_OVERLAY_FONTS.map((f) => {
              const selected = f.id === value;
              return (
                <li key={f.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onChange(f.id);
                      setOpen(false);
                    }}
                    data-nex-intro-video-font-option={f.id}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: "none",
                      background: selected ? `${NEX.cyan}22` : "transparent",
                      color: selected ? NEX.cyan : NEX.textPrimary,
                      fontSize: 16,
                      fontFamily: f.fontFamily,
                      cursor: "pointer",
                      textAlign: "left",
                      ...f.previewStyle,
                    }}
                  >
                    {f.label}
                  </button>
                </li>
              );
            })}
          </ul>,
          popover.portalTarget,
        )}
    </div>
  );
}

function SizeDropdown({
  value,
  onChange,
}: {
  value: IntroOverlaySizeId;
  onChange: (next: IntroOverlaySizeId) => void;
}): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const popover = usePortaledPopover(open);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const setBothRefs = React.useCallback(
    (el: HTMLButtonElement | null) => {
      triggerRef.current = el;
      popover.setTriggerEl(el);
    },
    [popover],
  );
  usePopoverOutsideClick(
    React.useCallback(() => triggerRef.current, []),
    popover.popoverRef,
    open,
    React.useCallback(() => setOpen(false), []),
  );
  const active = sizeById(value);
  const prettyLabel = (id: IntroOverlaySizeId): string =>
    id === "s" ? "Small" : id === "m" ? "Medium" : id === "l" ? "Large" : "Extra Large";
  /* Owner directive 2026-10-20 · "can we add the text size on the right
     like 12.s" · show the actual pt size each preset renders at on the
     overlay. Hero position (24 pt base) is the reference the user sees
     most · derived values: Small 18 · Medium 24 · Large 32 · XL 42. */
  const HERO_BASE_PT = 24;
  const ptForSize = (id: IntroOverlaySizeId): number =>
    Math.round(HERO_BASE_PT * sizeById(id).multiplier);
  return (
    <div style={{ minWidth: 0 }}>
      <span
        style={{
          fontSize: 10,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: NEX.textMute,
          fontWeight: 800,
          display: "block",
          marginBottom: 4,
        }}
      >
        Size
      </span>
      <button
        ref={setBothRefs}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        /* preventDefault on mousedown keeps the textarea focus +
           selection intact so a size pick applies to the user's
           current selection rather than collapsing it. */
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
        data-nex-intro-video-size-select
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: 10,
          border: `1px solid ${NEX.panelBorder}`,
          background: "rgba(5,18,32,0.9)",
          color: NEX.textPrimary,
          fontSize: 13,
          fontWeight: 700,
          fontFamily: NEX_FONT_SANS,
          outline: "none",
          cursor: "pointer",
          textAlign: "left",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
          <span>{prettyLabel(active.id)}</span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: NEX.textMute,
              letterSpacing: "0.02em",
            }}
          >
            {ptForSize(active.id)}pt
          </span>
        </span>
        <span aria-hidden style={{ fontSize: 10, color: NEX.textMute }}>▾</span>
      </button>
      {open && popover.portalTarget && popover.rect &&
        createPortal(
          <ul
            ref={popover.popoverRef}
            role="listbox"
            style={{
              position: "fixed",
              top: popover.rect.bottom + 4,
              left: popover.rect.left,
              width: popover.rect.width,
              zIndex: 9999,
              margin: 0,
              padding: 4,
              listStyle: "none",
              background: "rgba(2,9,20,0.98)",
              border: `1px solid ${NEX.cyan}66`,
              borderRadius: 10,
              boxShadow:
                "0 10px 28px -6px rgba(0,0,0,0.7), 0 0 24px rgba(0,175,255,0.25)",
            }}
          >
            {INTRO_OVERLAY_SIZES.map((s) => {
              const selected = s.id === value;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onChange(s.id);
                      setOpen(false);
                    }}
                    data-nex-intro-video-size-option={s.id}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: "none",
                      background: selected ? `${NEX.cyan}22` : "transparent",
                      color: selected ? NEX.cyan : NEX.textPrimary,
                      fontSize: Math.round(13 * s.multiplier),
                      fontWeight: 900,
                      fontFamily: NEX_FONT_SANS,
                      cursor: "pointer",
                      textAlign: "left",
                      display: "flex",
                      alignItems: "baseline",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <span>{prettyLabel(s.id)}</span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: selected ? NEX.cyan : NEX.textMute,
                        letterSpacing: "0.02em",
                      }}
                    >
                      {ptForSize(s.id)}pt
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>,
          popover.portalTarget,
        )}
    </div>
  );
}

function IntroToggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (next: boolean) => void;
}): React.JSX.Element {
  /* Owner directive 2026-10-19 · "remove the container · just toggle
     and text" · the sealed chip chrome was retired · now a bare pill
     switch with "Intro on / Intro off" label beside it. */
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      data-nex-intro-video-enabled={enabled ? "true" : "false"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: 0,
        background: "transparent",
        border: "none",
        /* Owner directive 2026-10-20 · "intro off should be dark red"
           · label flips from default white to NEX dark red when the
           intro is off · the track swap below carries the same signal
           at a glance. */
        color: enabled ? NEX.textPrimary : "#8B1A1A",
        fontFamily: NEX_FONT_SANS,
        cursor: "pointer",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 36,
          height: 20,
          borderRadius: 999,
          background: enabled ? NEX.green : "#8B1A1A",
          position: "relative",
          transition: "background 180ms ease",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: enabled ? 18 : 2,
            width: 16,
            height: 16,
            borderRadius: 999,
            background: "#FFFFFF",
            transition: "left 180ms ease",
            boxShadow: "0 1px 3px rgba(0,0,0,0.5)",
          }}
        />
      </span>
      <span style={{ fontSize: 12, fontWeight: 700 }}>
        {enabled ? "Intro on" : "Intro off"}
      </span>
    </button>
  );
}

// ───────────────────── Preview panel ────────────────────────────────

function IntroPreview({
  videoUrl,
  titleText,
  titleAttrs,
  titlePosition,
  titleFontId,
  titleSizeId,
  titleColor,
  titleAlign,
  titleHighlight,
  openingHours,
  openingHoursPosition,
  enabled,
}: {
  videoUrl: string | null;
  titleText: string;
  titleAttrs: CharAttr[];
  titlePosition: IntroTitlePosition;
  titleFontId: IntroOverlayFontId;
  titleSizeId: IntroOverlaySizeId;
  titleColor: string;
  titleAlign: "left" | "center" | "right";
  titleHighlight: boolean;
  openingHours: string | null;
  openingHoursPosition: IntroTitlePosition;
  enabled: boolean;
}): React.JSX.Element {
  const text = titleText.trim();
  return (
    <div
      data-nex-intro-video-preview
      data-nex-intro-video-preview-position={titlePosition}
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "9 / 16",
        maxWidth: 260,
        margin: "0 auto",
        borderRadius: 18,
        overflow: "hidden",
        background: "#000",
        border: `1px solid ${NEX.panelBorder}`,
        boxShadow: "0 10px 24px -8px rgba(0,0,0,0.7)",
      }}
    >
      {videoUrl ? (
        <video
          src={videoUrl}
          autoPlay
          muted
          loop
          playsInline
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            background:
              "linear-gradient(135deg, rgba(0,175,255,0.18), rgba(2,9,20,0.95))",
            color: NEX.textMute,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            textAlign: "center",
            padding: 20,
          }}
        >
          No video yet
          <br />
          <span style={{ color: NEX.textSecondary, marginTop: 6 }}>
            Record or upload below
          </span>
        </div>
      )}
      {text && enabled && (
        <TitleOverlay
          text={text}
          attrs={titleAttrs}
          position={titlePosition}
          fontId={titleFontId}
          sizeId={titleSizeId}
          color={titleColor}
          align={titleAlign}
          highlight={titleHighlight}
        />
      )}
      {openingHours && enabled && (
        <OpeningHoursOverlay
          text={openingHours}
          position={openingHoursPosition}
        />
      )}
      {/* Owner directive 2026-10-19 · the theme-name chip previously
          rendered here as a position:absolute overlay was moved OUT
          of the tile · caller renders it as a caption above the
          preview so the video stage stays clean. */}
      {!enabled && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            color: NEX.textMute,
            display: "grid",
            placeItems: "center",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          Intro is off
        </div>
      )}
    </div>
  );
}

export function TitleOverlay({
  text,
  attrs,
  position,
  fontId,
  sizeId,
  color,
  align,
  highlight,
}: {
  text: string;
  attrs: CharAttr[];
  position: IntroTitlePosition;
  fontId: IntroOverlayFontId;
  sizeId: IntroOverlaySizeId;
  color: string;
  align: "left" | "center" | "right";
  highlight: boolean;
}): React.JSX.Element {
  const font = fontById(fontId);
  const sizeMul = sizeById(sizeId).multiplier;
  /* Owner directive 2026-10-19 · "title overlay must have space at
     left and right side that text does not run over" · bump the
     horizontal safe-margin from 12 → 24 so multi-line titles have
     breathing room from the preview tile's rounded corners.
     Fix 2026-10-19 · the `center` branch previously used `inset: 0`
     shorthand which React warned about re-renders because other
     branches set `left/right` as separate values. Expanded to four
     explicit edges so React can diff cleanly without removing a
     shorthand that collides with a longhand. */
  const base: React.CSSProperties = {
    position: "absolute",
    left: 24,
    right: 24,
    display: "flex",
    pointerEvents: "none",
  };
  /* Owner directive 2026-10-19 · explicit per-position edge spacing:
     · Hero   · 24 side margins (preserved)
     · Center · 5 side margins (owner spec · "min 5px each side")
     · Footer · 5 side margins (owner spec) + 40 up from bottom edge
       (owner spec · "footer text must be 40px up from footer edge") */
  const alignToJustify =
    align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center";
  const outerStyle: React.CSSProperties =
    position === "hero"
      ? { ...base, top: 28, bottom: "auto", alignItems: "flex-start", justifyContent: alignToJustify }
      : position === "footer"
        ? { ...base, top: "auto", bottom: 40, left: 5, right: 5, alignItems: "flex-end", justifyContent: alignToJustify }
        : { ...base, top: 0, bottom: 0, left: 5, right: 5, alignItems: "center", justifyContent: alignToJustify };
  /* Owner directive 2026-10-20 · "font size does not change if user
     moves from hero to center or footer · text size remains set until
     user selects another text size · same for font and colour". The
     earlier per-position base (hero 24 · center 20 · footer 15) made
     the font visibly shrink when the user swapped Position radios,
     which looked like a bug · now a single base pt means the user's
     Size pick is the ONLY thing that changes font size. */
  const BASE_PT = 24;
  const fontSize = Math.round(BASE_PT * sizeMul);
  const bgGrad =
    position === "hero"
      ? "linear-gradient(180deg, rgba(0,0,0,0.65) 0%, transparent 100%)"
      : position === "footer"
        ? "linear-gradient(0deg, rgba(0,0,0,0.65) 0%, transparent 100%)"
        : "radial-gradient(ellipse at center, rgba(0,0,0,0.55) 0%, transparent 70%)";
  return (
    <>
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: bgGrad,
          pointerEvents: "none",
        }}
      />
      <div style={outerStyle}>
        <h3
          data-nex-intro-video-title-overlay
          data-nex-intro-video-title-font={fontId}
          data-nex-intro-video-title-size={sizeId}
          data-nex-intro-video-title-color={color}
          data-nex-intro-video-title-align={align}
          data-nex-intro-video-title-highlight={highlight ? "true" : "false"}
          style={{
            margin: 0,
            fontSize,
            lineHeight: 1.2,
            color,
            textShadow: highlight ? "none" : "0 2px 10px rgba(0,0,0,0.65)",
            textAlign: align,
            maxWidth: "100%",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            overflowWrap: "anywhere",
            fontFamily: font.fontFamily,
            background: highlight ? "rgba(0,0,0,0.65)" : "transparent",
            padding: highlight ? "4px 10px" : 0,
            borderRadius: highlight ? 6 : 0,
            boxDecorationBreak: "clone" as const,
            WebkitBoxDecorationBreak: "clone" as const,
            ...font.previewStyle,
          }}
        >
          {renderTitleWithEmojiAndAttrs(
            text,
            attrs,
            fontSize,
            color,
            sizeId,
          )}
        </h3>
      </div>
    </>
  );
}

/* Owner directive 2026-10-20 · opening-hours overlay · lives at the
 * END OPPOSITE the user's title (hero/center → footer; footer → hero)
 * so the two bands never overlap. Rendered as a slim centred chip
 * (clock glyph + hours) with its own soft gradient scrim so it
 * reads cleanly over any video. */
export function OpeningHoursOverlay({
  text,
  position,
}: {
  text: string;
  position: IntroTitlePosition;
}): React.JSX.Element {
  const base: React.CSSProperties = {
    position: "absolute",
    left: 0,
    right: 0,
    display: "flex",
    justifyContent: "center",
    pointerEvents: "none",
  };
  const outer: React.CSSProperties =
    position === "hero"
      ? { ...base, top: 10, bottom: "auto", alignItems: "flex-start" }
      : { ...base, top: "auto", bottom: 10, alignItems: "flex-end" };
  const scrim: React.CSSProperties =
    position === "hero"
      ? {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 56,
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.65) 0%, transparent 100%)",
          pointerEvents: "none",
        }
      : {
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 56,
          background:
            "linear-gradient(0deg, rgba(0,0,0,0.65) 0%, transparent 100%)",
          pointerEvents: "none",
        };
  return (
    <>
      <div aria-hidden style={scrim} />
      <div style={outer}>
        <span
          data-nex-intro-video-opening-hours
          data-nex-intro-video-opening-hours-position={position}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 10px",
            borderRadius: 999,
            background: "rgba(0,0,0,0.55)",
            border: `1px solid rgba(0,175,255,0.45)`,
            color: "#FFFFFF",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.03em",
            whiteSpace: "nowrap",
            textShadow: "0 1px 4px rgba(0,0,0,0.6)",
            fontFamily: NEX_FONT_SANS,
          }}
        >
          <span aria-hidden style={{ fontSize: 12, lineHeight: 1 }}>⏱</span>
          {text}
        </span>
      </div>
    </>
  );
}

/* Owner directive 2026-10-19 · ":slug:" tokens inside the title text
 * must render as inline <img> tags using the food emoji directory ·
 * never as raw text. Each matched token (e.g. ":glossy3d-09:") maps
 * to /nex-themes/food/emoji/<slug>.png. Non-matched text segments
 * render as plain spans so punctuation, letters, and Unicode glyphs
 * continue to display verbatim. */
/** Owner directive 2026-10-20 · ":slug:" tokens MUST render as images,
 *  never as text · the img URL is derived from the slug prefix so
 *  joker-NN loads from /nex-themes/joker/emoji/ while every other
 *  slug loads from /nex-themes/food/emoji/. onError falls back to
 *  the opposite folder so a mis-prefixed slug still has one more
 *  chance before the browser surfaces alt text. */
/* Owner directive 2026-10-20 · GIFs on the keypad insert as :slug:
 * tokens too · resolve them to /nex-chat/gif/<slug>.gif · known slug
 * set is small (BUILT_IN_GIFS) so a prefix-free match works. */
const KNOWN_GIF_SLUGS = new Set<string>([
  "steve-harvey-cracks-me-up",
  "stoned-fox-no-way-wow",
  "megan-lara-wave",
  "emoji-expression",
  "gymshark-bodybuilding",
  "gymshark-gym-flex",
  "work-out-dog",
  "despicable-me-dj",
  "minions-cartoons",
  "minions-kiss",
  "kisses-feel",
  "peace-dont-talk-to-me",
  "fight-ufc",
  "sparring-paolo-costa-ufc",
  "dog-no",
  "suspicious",
  "suspicious-tyler-james-williams",
  "party-drink-bedlam-vodka",
  "holiday-cheers-absolut",
  "drinks-cocktails-absolut",
  "vodka-love",
  "misc-gif-1",
  "misc-gif-2",
  "whiskey-drinking-buzzfeed",
  "stephen-king-halloween",
  "night-out-drinking",
  "e-girls-dance-1",
  "e-girls-dance-2",
  "girl-asian-dance",
  "hungry-fun-zoo",
  "giraffe",
  "ice-cream-cats",
  "ice-cream-cat",
]);

function emojiUrlForSlug(slug: string): string {
  const l = slug.toLowerCase();
  if (KNOWN_GIF_SLUGS.has(l)) return `/nex-chat/gif/${slug}.gif`;
  if (l.startsWith("joker-")) return `/nex-themes/joker/emoji/${slug}.png`;
  // Food emoji + cakegirl + glossy3d + promo3d + chef + fast-food
  // all live under /nex-themes/food/emoji/.
  return `/nex-themes/food/emoji/${slug}.png`;
}

function emojiFallbackUrlForSlug(slug: string): string {
  const l = slug.toLowerCase();
  // Second-chance resolver: try the opposite theme folder.
  if (KNOWN_GIF_SLUGS.has(l)) return `/nex-themes/food/emoji/${slug}.png`;
  if (l.startsWith("joker-")) return `/nex-themes/food/emoji/${slug}.png`;
  return `/nex-themes/joker/emoji/${slug}.png`;
}

/** Owner directive 2026-10-20 · "ship segments" · same :slug: emoji
 *  interpolation as renderTitleWithEmoji below, BUT also walks the
 *  per-character attrs array so each contiguous run of same-coloured /
 *  same-sized chars renders in its own span with those overrides. The
 *  global `color` + `sizeId` provide the fallback for chars without
 *  explicit attrs. */
function renderTitleWithEmojiAndAttrs(
  text: string,
  attrs: CharAttr[],
  baseFontSize: number,
  globalColor: string,
  globalSizeId: IntroOverlaySizeId,
): React.JSX.Element[] {
  if (text.length === 0) return [];
  const parts: React.JSX.Element[] = [];
  const safeAttrs =
    attrs.length === text.length
      ? attrs
      : text.split("").map(() => ({} as CharAttr));
  let key = 0;
  // Pre-compute pt per sizeId so each span can override independently.
  const globalMul = sizeById(globalSizeId).multiplier;
  const sizeForAttr = (a: CharAttr): number => {
    if (!a.size) return baseFontSize;
    const mul = sizeById(a.size).multiplier;
    // baseFontSize already includes globalMul · divide it back out so
    // the per-char size multiplier replaces the global one, not stacks.
    return Math.round((baseFontSize / globalMul) * mul);
  };
  const colorForAttr = (a: CharAttr): string => a.color ?? globalColor;
  // Walk char-by-char, breaking on emoji tokens or attr change.
  let i = 0;
  while (i < text.length) {
    const emojiRe = /^:([a-z0-9][a-z0-9_-]*):/i;
    const slice = text.slice(i);
    const emojiMatch = emojiRe.exec(slice);
    if (emojiMatch && emojiMatch.index === 0) {
      // Emoji token · size derived from its FIRST char's attr
      const slug = emojiMatch[1];
      const a = safeAttrs[i] ?? {};
      const imgSize = Math.round(sizeForAttr(a) * 1.4);
      parts.push(
        <img
          key={`e-${key++}`}
          src={emojiUrlForSlug(slug)}
          alt=""
          onError={(ev) => {
            /* Primary dir missed · try the sibling theme folder once ·
               if that misses too the img just renders as a tiny blank
               square · we never show the slug as text. */
            const el = ev.currentTarget;
            const fb = emojiFallbackUrlForSlug(slug);
            if (!el.src.endsWith(fb)) {
              el.src = fb;
            } else {
              el.style.visibility = "hidden";
            }
          }}
          style={{
            width: imgSize,
            height: imgSize,
            objectFit: "contain",
            verticalAlign: "middle",
            display: "inline-block",
          }}
        />,
      );
      i += emojiMatch[0].length;
      continue;
    }
    // Plain-text run · group until attrs change OR an emoji starts.
    const runStart = i;
    const runAttr = safeAttrs[i] ?? {};
    while (i < text.length) {
      const nextSlice = text.slice(i);
      if (emojiRe.test(nextSlice)) break;
      const nextAttr = safeAttrs[i] ?? {};
      if (
        nextAttr.color !== runAttr.color ||
        nextAttr.size !== runAttr.size
      ) {
        break;
      }
      i++;
    }
    const runText = text.slice(runStart, i);
    if (runText.length > 0) {
      parts.push(
        <span
          key={`t-${key++}`}
          style={{
            color: colorForAttr(runAttr),
            fontSize: sizeForAttr(runAttr),
            lineHeight: "inherit",
          }}
        >
          {runText}
        </span>,
      );
    }
    if (i === runStart) i++; // defensive · never infinite-loop
  }
  return parts;
}

function renderTitleWithEmoji(
  text: string,
  fontSize: number,
): React.JSX.Element[] {
  const parts: React.JSX.Element[] = [];
  const re = /:([a-z0-9][a-z0-9_-]*):/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  const imgSize = Math.round(fontSize * 2);
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      parts.push(
        <span key={`t-${key++}`}>{text.slice(last, m.index)}</span>,
      );
    }
    const slug = m[1];
    parts.push(
      <img
        key={`e-${key++}`}
        src={emojiUrlForSlug(slug)}
        alt=""
        onError={(ev) => {
          const el = ev.currentTarget;
          const fb = emojiFallbackUrlForSlug(slug);
          if (!el.src.endsWith(fb)) el.src = fb;
          else el.style.visibility = "hidden";
        }}
        style={{
          width: imgSize,
          height: imgSize,
          objectFit: "contain",
          verticalAlign: "middle",
          display: "inline-block",
        }}
      />,
    );
    last = re.lastIndex;
  }
  if (last < text.length) {
    parts.push(<span key={`t-${key++}`}>{text.slice(last)}</span>);
  }
  return parts;
}

// ───────────────────── Position choice chip ─────────────────────────

function PositionChoice({
  position,
  active,
  onSelect,
}: {
  position: IntroTitlePosition;
  active: boolean;
  onSelect: () => void;
}): React.JSX.Element {
  const label =
    position === "hero" ? "Hero" : position === "center" ? "Center" : "Footer";
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onSelect}
      data-nex-intro-video-position={position}
      data-nex-intro-video-position-active={active ? "true" : "false"}
      style={{
        padding: "10px 8px",
        borderRadius: 10,
        border: `1px solid ${active ? NEX.cyan : "rgba(255,255,255,0.14)"}`,
        background: active ? NEX.cyanDim : "rgba(255,255,255,0.04)",
        color: active ? NEX.textPrimary : NEX.textSecondary,
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        cursor: "pointer",
        fontFamily: NEX_FONT_SANS,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
      }}
    >
      <PositionGlyph position={position} active={active} />
      {label}
    </button>
  );
}

function PositionGlyph({
  position,
  active,
}: {
  position: IntroTitlePosition;
  active: boolean;
}): React.JSX.Element {
  const color = active ? NEX.cyan : NEX.textMute;
  const barY =
    position === "hero" ? 6 : position === "center" ? 15 : 24;
  return (
    <svg
      width="24"
      height="34"
      viewBox="0 0 24 34"
      fill="none"
      aria-hidden
    >
      <rect
        x="2"
        y="2"
        width="20"
        height="30"
        rx="4"
        stroke={color}
        strokeWidth="1.5"
      />
      <rect
        x="5"
        y={barY}
        width="14"
        height="4"
        rx="1"
        fill={color}
      />
    </svg>
  );
}
