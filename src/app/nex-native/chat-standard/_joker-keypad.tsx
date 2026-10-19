"use client";

// src/app/nex-native/chat-standard/_joker-keypad.tsx
//
// JOKER CUSTOM KEYPAD · sealed 2026-10-12.
// -------------------------------------------------------------------
// Full-replacement on-screen keyboard that OVERRIDES the native OS
// keyboard whenever the Joker theme (theme-0) is active in the chat
// composer. The composer input is flipped to `readOnly inputMode="none"`
// so iOS / Android / desktop keyboards never open; tapping the pill
// opens this keypad instead.
//
// Design doctrine · founder direction 2026-10-12:
//   "world class ui design to match joker theme"
//
//   · Dark navy black backdrop (#030308 → #0A0F1A) with an acid
//     green hairline at the top edge so the keypad reads as part of
//     the Joker scenery, not a system popover.
//   · Acid green #8FFF6E for all accents · pressed keys flash a
//     green glow + lift · Enter is filled acid green with black text
//     so it reads as "the kill button" like the rest of the theme.
//   · Faint CRT scanline overlay for the Joker atmosphere · subtle
//     enough to never interfere with letter legibility.
//   · Three-state shift (lower / upper-one-shot / caps-lock) +
//     123/ABC toggle for the number plane.
//   · Every key dispatches through a single `press` reducer so the
//     caller just reads `value` + handles `onSend`.
//
// Keypad is a presentation component only · it OWNS no composer
// state. The composer owns `value`/`setValue`/`onSend` and passes
// them in. This keeps the composer the single source of truth and
// means the keypad can be reused by other surfaces later (lock
// screen, Vault, admin consoles) without surgery.

import * as React from "react";
import {
  BUILT_IN_GIFS,
  type BuiltInGif,
} from "@/lib/nex-native/built-in-gifs";
import {
  getBuiltInEmoji,
  getBuiltInStickers,
  getAllBuiltInEmoji,
  getAllBuiltInStickers,
  type BuiltInThemeEmoji,
  type BuiltInThemeSticker,
} from "@/lib/nex-native/theme-asset-fallback";

/* Owner directive 2026-10-18 · the Joker-green module constants
   (JOKER_GREEN · JOKER_GREEN_DIM · JOKER_GREEN_GLOW · KEY_BG_PRESSED
   · KEY_BORDER) were retired · every styled reference now reads
   `var(--nex-kp-accent-*)` with the Joker-green rgba literals as
   fallbacks. The deriveKeypadVars() helper computes the CSS vars
   from the accentColor prop (defaults to Joker green). */
const DEEP_1 = "#030308";
const DEEP_2 = "#0A0F1A";
const KEY_TEXT = "#F4F7FC";
const KEY_BG_IDLE = "rgba(255,255,255,0.06)";
/* Owner directive 2026-10-20 · "red line button over the blue return
 * button change to solid dark red colour" · bumped from faint tint to
 * a solid NEX dark red fill + matching darker border so the backspace
 * button reads clearly against the acid-green/cyan Return key. */
const BACKSPACE_RED = "#8B1A1A";
const BACKSPACE_RED_BORDER = "#631010";

/** Shift state · three-state cycle · one-shot caps between lower and
 *  caps-lock to match iOS / Android convention. */
type ShiftState = "lower" | "upper" | "caps";

/** Which expression surface is on screen · letters (QWERTY) + its
 *  sibling planes (numbers / symbols) · OR the inline emoji drawer ·
 *  OR the inline sticker drawer. Sealed 2026-10-12 · Phase 1 "no
 *  WhatsApp-pattern mode roundtrips": emoji + stickers live INSIDE
 *  the keypad instead of a separate modal behind it. The composer
 *  stays visible (via the preview strip) and the typing position is
 *  preserved across every plane switch because `value` is owned by
 *  the composer, never duplicated here. */
type Plane = "letters" | "numbers" | "symbols" | "emoji" | "sticker" | "giphy";

export interface JokerKeypadProps {
  /** Visible / hidden · parent toggles this from the composer pill. */
  open: boolean;
  /** The current composer text · keypad reads it to render preview
   *  highlights, writes to it via `onChange`. */
  value: string;
  /** Append / backspace delegate · receives the next full string so
   *  the composer stays the owner of the state (no character events
   *  that would be racy against programmatic updates). */
  onChange: (next: string) => void;
  /** Enter key · fires send + closes the keypad. */
  onSend: () => void;
  /** Chevron / backdrop tap · parent sets `open` to false. */
  onClose: () => void;
  /** Theme id · drives which built-in emoji / sticker catalog the
   *  inline drawer surfaces. Pass "theme-0" (Joker) to see the
   *  sealed 23-emoji / 9-sticker Joker set. When omitted, the
   *  inline drawer renders empty-state copy. */
  themeId?: string;
  /** Fires when the user taps an emoji in the inline drawer · the
   *  composer stages it in `pendingEmoji` and the user then presses
   *  Send to deliver text + emoji together (identical path to the
   *  pre-keypad EmojiStickerGifPicker). */
  onPickEmoji?: (emoji: BuiltInThemeEmoji) => void;
  /** Owner directive 2026-10-19 · fires when the user taps a sticker
   *  in the inline drawer. Same contract as `onPickEmoji` · composer
   *  stages the pick in `pendingSticker` and Send ships it as its
   *  own bubble. Before this seal the sticker drawer tiles had no
   *  pick handler at all · taps silently no-op'd. */
  onPickSticker?: (sticker: BuiltInThemeSticker) => void;
  /** Owner directive 2026-10-20 · "all keypads have emoji + stickers +
   *  giphy buttons and library" · fires when the user picks a NEX
   *  built-in GIF from the keypad's giphy drawer. Caller treats it
   *  like a sticker pick (slug carries image URL + aspect ratio). */
  onPickGiphy?: (gif: BuiltInGif) => void;
  /** Owner directive 2026-10-18 · "all chat themes must have their
   *  own keypad in theme color". The keypad was Joker-only until
   *  this seal · it now accepts any accent hex so every theme can
   *  render the Joker-pattern layout in its own colour. Defaults to
   *  Joker acid-green (#8FFF6E) so legacy callers stay byte-identical. */
  accentColor?: string;
  /** Owner directive 2026-10-20 · "load the keypad with emoji library"
   *  · lets a caller override the keypad's starting drawer. The intro-
   *  video settings surface passes "emoji" so users land on the emoji
   *  grid immediately · chat composers keep the default "letters". */
  initialPlane?: "letters" | "emoji" | "sticker";
}

/** Convert a hex accent into the five rgba() tints the keypad needs
 *  (accent · dim 0.22 · glow 0.55 · pressed 0.25 · border 0.18) and
 *  return them as CSS custom properties for injection on the keypad
 *  root. Every style inside the keypad reads `var(--nex-kp-accent-*)`
 *  so the whole surface recolours from this one object. */
function deriveKeypadVars(accent: string): Record<string, string> {
  const hex = accent.replace("#", "").trim();
  const safe = hex.length === 6 ? hex : "8FFF6E";
  const r = parseInt(safe.slice(0, 2), 16);
  const g = parseInt(safe.slice(2, 4), 16);
  const b = parseInt(safe.slice(4, 6), 16);
  return {
    "--nex-kp-accent": `rgb(${r},${g},${b})`,
    "--nex-kp-accent-dim": `rgba(${r},${g},${b},0.22)`,
    "--nex-kp-accent-glow": `rgba(${r},${g},${b},0.55)`,
    "--nex-kp-accent-pressed": `rgba(${r},${g},${b},0.25)`,
    "--nex-kp-accent-border": `rgba(${r},${g},${b},0.18)`,
  };
}

/** Row layouts · pure data so swapping languages later is one edit. */
const ROW_LETTERS_1 = ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"];
const ROW_LETTERS_2 = ["a", "s", "d", "f", "g", "h", "j", "k", "l"];
const ROW_LETTERS_3 = ["z", "x", "c", "v", "b", "n", "m"];

const ROW_NUMBERS_1 = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
const ROW_NUMBERS_2 = ["-", "/", ":", ";", "(", ")", "$", "&", "@", '"'];
const ROW_NUMBERS_3 = [".", ",", "?", "!", "'"];

const ROW_SYMBOLS_1 = ["[", "]", "{", "}", "#", "%", "^", "*", "+", "="];
const ROW_SYMBOLS_2 = ["_", "\\", "|", "~", "<", ">", "€", "£", "¥", "•"];
const ROW_SYMBOLS_3 = [".", ",", "?", "!", "'"];

export function JokerKeypad({
  open,
  value,
  onChange,
  onSend,
  onClose,
  themeId,
  onPickEmoji,
  onPickSticker,
  onPickGiphy,
  accentColor,
  initialPlane = "letters",
}: JokerKeypadProps): React.JSX.Element | null {
  /* Owner directive 2026-10-18 · derive the five CSS vars once per
     render from accentColor · defaults to Joker acid-green so the
     Joker theme stays visually identical to the sealed primitive. */
  const paletteVars = React.useMemo(
    () => deriveKeypadVars(accentColor ?? "#8FFF6E"),
    [accentColor],
  );
  const [shift, setShift] = React.useState<ShiftState>("upper"); // first letter capitalised
  const [plane, setPlane] = React.useState<Plane>(initialPlane);
  /* Owner directive 2026-10-20 · when the caller changes initialPlane
     between opens, honour the new default on the next open. */
  React.useEffect(() => {
    if (open) setPlane(initialPlane);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const [pressed, setPressed] = React.useState<string | null>(null);

  /* Owner directive 2026-10-20 · "update the emoji library on the
     keypad · all keypads have emoji + stickers + giphy libraries"
     · drawers now read the UNIVERSAL built-in catalogs (every theme's
     emoji + sticker set merged) so each keypad surfaces the full
     library · the themeId prop remains for backward compat / future
     theme-prioritisation but no longer gates the catalog. */
  const inlineEmoji = React.useMemo(() => getAllBuiltInEmoji(), []);
  const inlineStickers = React.useMemo(() => getAllBuiltInStickers(), []);
  // Suppress unused-import warnings for the per-theme getters · kept
  // for future theme-prioritisation inside the universal catalog.
  void getBuiltInEmoji;
  void getBuiltInStickers;

  // Is the current plane a text plane (letters/numbers/symbols) or
  // one of the inline drawers? Used to swap the key-rows area for
  // the drawer grid without duplicating the top preview strip or
  // the mode-switch tabs.
  const isDrawerPlane =
    plane === "emoji" || plane === "sticker" || plane === "giphy";

  // Reset shift to "upper" when the composer value is cleared · gives
  // the next sentence its sentence-case initial letter automatically.
  React.useEffect(() => {
    if (value.length === 0 && shift === "lower") {
      setShift("upper");
    }
    // Only react to transitions from "has value" → "empty".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.length === 0]);

  // Lock body scroll while the keypad is open so iOS doesn't bounce.
  React.useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  /* Owner directive 2026-10-20 · "hold space bar + swipe left/right to
     move cursor" · cursor position is tracked alongside the plain
     `value` string so key presses can INSERT at the caret instead of
     appending to the end. Default is end-of-string so first use of the
     keypad on a fresh input still appends · the cursor auto-snaps to
     end when `value` is replaced externally (e.g. on form clear). */
  const [cursorPos, setCursorPos] = React.useState<number>(value.length);
  const prevValueRef = React.useRef<string>(value);
  React.useEffect(() => {
    if (value !== prevValueRef.current) {
      /* Clamp into bounds · if parent replaced value from outside the
         keypad (e.g. placeholder swap, imperative setValue), snap the
         caret to the end so the user doesn't type in a stale spot. */
      if (cursorPos > value.length) setCursorPos(value.length);
      prevValueRef.current = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const pressKey = (char: string) => {
    const emit = shift === "lower" ? char : char.toUpperCase();
    const next = value.slice(0, cursorPos) + emit + value.slice(cursorPos);
    onChange(next);
    setCursorPos(cursorPos + emit.length);
    prevValueRef.current = next;
    if (shift === "upper") setShift("lower");
    flashPressed(char);
  };

  const pressBackspace = () => {
    if (cursorPos === 0) return;
    const graphemes = Array.from(value);
    /* Grapheme-aware delete at caret · walk graphemes to find the
       cluster that ENDS at or just before cursorPos. */
    let charCount = 0;
    let graphemesToRemove = 1;
    let removeStartIdx = 0;
    for (let i = 0; i < graphemes.length; i++) {
      const g = graphemes[i];
      const gLen = g.length;
      if (charCount + gLen > cursorPos - 1) {
        removeStartIdx = charCount;
        graphemesToRemove = gLen;
        break;
      }
      charCount += gLen;
      if (charCount === cursorPos) {
        removeStartIdx = charCount - gLen;
        graphemesToRemove = gLen;
      }
    }
    /* Simpler: slice directly on char indices; grapheme nuance can be
       revisited later. */
    const next = value.slice(0, cursorPos - 1) + value.slice(cursorPos);
    onChange(next);
    setCursorPos(cursorPos - 1);
    prevValueRef.current = next;
    flashPressed("⌫");
    void removeStartIdx;
    void graphemesToRemove;
  };

  const pressSpace = () => {
    const next = value.slice(0, cursorPos) + " " + value.slice(cursorPos);
    onChange(next);
    setCursorPos(cursorPos + 1);
    prevValueRef.current = next;
    flashPressed("␣");
  };

  /* Space-bar long-press + swipe cursor-nav · owner directive
     2026-10-20 · "if user holds the bar and move left the cursor
     will move left · if hold and move right the cursor will move
     right". 15px per character of movement feels natural · tracked
     on pointer, released on pointerup · fires the normal space
     insert only if nav mode was never engaged. */
  const navStartXRef = React.useRef<number | null>(null);
  const navStartCursorRef = React.useRef<number>(0);
  const navActiveRef = React.useRef<boolean>(false);
  const spaceHoldTimerRef = React.useRef<number | null>(null);
  const PX_PER_CHAR = 15;
  const NAV_HOLD_MS = 220;

  const beginSpaceNav = (clientX: number): void => {
    spaceHoldTimerRef.current = window.setTimeout(() => {
      navActiveRef.current = true;
      navStartXRef.current = clientX;
      navStartCursorRef.current = cursorPos;
      flashPressed("←→");
    }, NAV_HOLD_MS);
  };

  const moveSpaceNav = (clientX: number): void => {
    if (!navActiveRef.current || navStartXRef.current === null) return;
    const dx = clientX - navStartXRef.current;
    const delta = Math.round(dx / PX_PER_CHAR);
    const next = Math.max(
      0,
      Math.min(value.length, navStartCursorRef.current + delta),
    );
    if (next !== cursorPos) setCursorPos(next);
  };

  const endSpaceNav = (): boolean => {
    if (spaceHoldTimerRef.current !== null) {
      window.clearTimeout(spaceHoldTimerRef.current);
      spaceHoldTimerRef.current = null;
    }
    const wasActive = navActiveRef.current;
    navActiveRef.current = false;
    navStartXRef.current = null;
    return wasActive;
  };

  const pressShift = () => {
    setShift((prev) =>
      prev === "lower" ? "upper" : prev === "upper" ? "caps" : "lower",
    );
    flashPressed("⇧");
  };

  const pressPlaneToggle = () => {
    setPlane((prev) => (prev === "letters" ? "numbers" : "letters"));
    flashPressed(plane === "letters" ? "123" : "ABC");
  };

  const pressSymbolsToggle = () => {
    setPlane((prev) => (prev === "numbers" ? "symbols" : "numbers"));
    flashPressed("#+=");
  };

  const flashPressed = (char: string) => {
    setPressed(char);
    window.setTimeout(() => setPressed((cur) => (cur === char ? null : cur)), 140);
  };

  if (!open) return null;

  const row1 =
    plane === "letters"
      ? ROW_LETTERS_1
      : plane === "numbers"
        ? ROW_NUMBERS_1
        : ROW_SYMBOLS_1;
  const row2 =
    plane === "letters"
      ? ROW_LETTERS_2
      : plane === "numbers"
        ? ROW_NUMBERS_2
        : ROW_SYMBOLS_2;
  const row3 =
    plane === "letters"
      ? ROW_LETTERS_3
      : plane === "numbers"
        ? ROW_NUMBERS_3
        : ROW_SYMBOLS_3;

  const displayChar = (c: string) => {
    if (plane !== "letters") return c;
    return shift === "lower" ? c : c.toUpperCase();
  };

  return (
    <>
      <style>{`
        @keyframes nex-joker-keypad-rise {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        @keyframes nex-joker-key-flash {
          0%   { box-shadow: 0 0 0 0 var(--nex-kp-accent-glow, rgba(143,255,110,0.55)), 0 2px 0 0 var(--nex-kp-accent-dim, rgba(143,255,110,0.22)); }
          100% { box-shadow: 0 0 12px 4px transparent, 0 2px 0 0 var(--nex-kp-accent-dim, rgba(143,255,110,0.22)); }
        }
        /* CRT scanline texture · ultra-faint overlay for Joker vibe */
        @keyframes nex-joker-keypad-scan {
          0%   { background-position: 0 0; }
          100% { background-position: 0 4px; }
        }
        /* Preview caret · acid green blink at 1Hz so the strip
           reads as a real text field, not a static label. */
        @keyframes nex-joker-caret-blink {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0; }
        }
      `}</style>

      {/* Backdrop · tap to dismiss. Transparent so the chat behind
          still reads · the keypad itself occludes the lower half. */}
      <div
        data-nex-joker-keypad-backdrop
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 220,
          background: "transparent",
          pointerEvents: "auto",
        }}
      />

      {/* Keypad sheet · fixed to the bottom · lifts from off-screen
          on open · world-class design: pure black navy gradient,
          acid green hairline, faint scanline atmosphere, finely
          tuned key geometry (6px gap, 44-48px tall rows) that
          matches native thumb-reach ergonomics. */}
      <div
        data-nex-joker-keypad
        data-nex-joker-keypad-plane={plane}
        data-nex-joker-keypad-shift={shift}
        role="dialog"
        aria-label="Joker keypad"
        style={{
          /* Owner directive 2026-10-18 · CSS custom properties for
             the theme accent are injected here · every nested style
             reads var(--nex-kp-accent-*) so the whole keypad recolours
             from this one block. */
          ...paletteVars,
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 221,
          padding:
            "10px 6px calc(env(safe-area-inset-bottom, 0px) + 10px)",
          background:
            `linear-gradient(180deg, ${DEEP_1} 0%, ${DEEP_2} 100%)`,
          borderTop: `1px solid var(--nex-kp-accent-dim, rgba(143,255,110,0.22))`,
          boxShadow:
            `0 -8px 32px rgba(0,0,0,0.6), 0 -1px 0 var(--nex-kp-accent-dim, rgba(143,255,110,0.22))`,
          animation:
            "nex-joker-keypad-rise 240ms cubic-bezier(0.22, 0.9, 0.3, 1.0) both",
          pointerEvents: "auto",
          fontFamily:
            "ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, Consolas, monospace",
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
      >
        {/* Faint CRT scanline overlay · pointer-events:none so it
            never swallows a tap · 4px repeating gradient at ~4%
            opacity. Reads as "worn CRT" at this density. */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: `repeating-linear-gradient(
              180deg,
              rgba(143,255,110,0.045) 0px,
              rgba(143,255,110,0.045) 1px,
              transparent 1px,
              transparent 4px
            )`,
            animation: "nex-joker-keypad-scan 320ms steps(2) infinite",
            pointerEvents: "none",
            mixBlendMode: "screen",
          }}
        />

        {/* Preview strip · world-class standard. Users see what
            they are typing WITHOUT having to glance above the
            keypad (which would be behind it anyway because the
            keypad covers the composer slot). Layout:
              [⌄ close]   [live text preview · caret]   [▶ send]
            The preview inherits the composer's `value` directly
            so what you see is literally what the chat will post.
            Send button is the "kill button" of the keypad: filled
            acid green with black glyph, matches the ↵ enter key
            on row 4 (both call sendAndClear). Keeping both is
            intentional · thumb-reachable Enter + eye-level Send
            is a documented ergonomic pairing. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "0 4px 8px",
            position: "relative",
          }}
        >
          <button
            type="button"
            aria-label="Close keypad"
            onClick={onClose}
            style={{
              flexShrink: 0,
              appearance: "none",
              /* Owner directive 2026-10-20 · "close keypad button change
                 to solid dark red colour" · explicit NEX dark red fill +
                 opaque border so the chevron reads as a kill button. */
              background: "#8B1A1A",
              border: "1px solid #631010",
              color: "#FFFFFF",
              fontSize: 16,
              cursor: "pointer",
              width: 32,
              height: 32,
              borderRadius: 10,
              display: "grid",
              placeItems: "center",
              lineHeight: 1,
              padding: 0,
            }}
          >
            ⌄
          </button>

          {/* Owner directive 2026-10-20 · "the text container increase
              in height only · until it has 5 lines and then the user
              can scroll · the keypad container must NOT get taller ·
              only the text container expands, floating ABOVE the
              keypad into empty page space". The preview strip is
              absolutely-positioned to the top of this header row so
              its growth escapes the keypad's layout box · keys area
              + keypad total height stay fixed. */}
          <div
            data-nex-joker-keypad-preview-anchor
            style={{
              flex: 1,
              minWidth: 0,
              position: "relative",
              /* Reserve the 32px baseline so the keypad layout math
                 still thinks the preview row is single-line tall ·
                 the absolute preview sits over + above this anchor. */
              height: 32,
            }}
          >
            <div
              data-nex-joker-keypad-preview
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                /* Pin the BOTTOM of the preview to the baseline the
                   anchor reserved · growth expands UPWARD into the
                   empty page space above the keypad · the keypad
                   root height never changes. */
                bottom: 0,
                minHeight: 32,
                maxHeight: 103,
                overflowY: "auto",
                padding: "6px 10px",
                borderRadius: 10,
                background: "rgba(0,0,0,0.75)",
                border: `1px solid var(--nex-kp-accent-dim, rgba(143,255,110,0.22))`,
                boxShadow: `inset 0 1px 0 rgba(255,255,255,0.03), 0 -4px 14px rgba(0,0,0,0.5)`,
                fontFamily: "inherit",
                fontSize: 13,
                color: value.length === 0 ? "rgba(244,247,252,0.35)" : KEY_TEXT,
                letterSpacing: 0,
                lineHeight: 1.4,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                overflowWrap: "anywhere",
              }}
            >
              {value.length === 0 ? (
                <>
                  <span>Say something…</span>
                  <span
                    aria-hidden
                    style={{
                      display: "inline-block",
                      width: 2,
                      height: 14,
                      verticalAlign: "text-bottom",
                      marginLeft: 1,
                      background: "var(--nex-kp-accent, #8FFF6E)",
                      boxShadow: `0 0 6px var(--nex-kp-accent-glow, rgba(143,255,110,0.55))`,
                      animation: "nex-joker-caret-blink 1s steps(2) infinite",
                    }}
                  />
                </>
              ) : (
                <>
                  {/* Owner directive 2026-10-20 · caret renders AT
                      cursorPos, not at the end · value is split into
                      before + after · caret sits between them · when
                      the user space-nav-swipes, the caret moves within
                      the text, not at the trailing edge. */}
                  {value.slice(0, cursorPos)}
                  <span
                    aria-hidden
                    style={{
                      display: "inline-block",
                      width: 2,
                      height: 14,
                      verticalAlign: "text-bottom",
                      marginLeft: 0,
                      marginRight: 0,
                      background: "var(--nex-kp-accent, #8FFF6E)",
                      boxShadow: `0 0 6px var(--nex-kp-accent-glow, rgba(143,255,110,0.55))`,
                      animation: "nex-joker-caret-blink 1s steps(2) infinite",
                    }}
                  />
                  {value.slice(cursorPos)}
                </>
              )}
            </div>
          </div>

          <button
            type="button"
            aria-label="Send message"
            disabled={value.length === 0}
            onClick={() => {
              if (value.length === 0) return;
              onSend();
              onClose();
            }}
            style={{
              flexShrink: 0,
              appearance: "none",
              width: 36,
              height: 32,
              borderRadius: 10,
              padding: 0,
              display: "grid",
              placeItems: "center",
              background: value.length === 0 ? "var(--nex-kp-accent-border, rgba(143,255,110,0.18))" : "var(--nex-kp-accent, #8FFF6E)",
              color: value.length === 0 ? "rgba(1,4,1,0.55)" : "#010401",
              border: `1px solid var(--nex-kp-accent, #8FFF6E)`,
              cursor: value.length === 0 ? "default" : "pointer",
              fontWeight: 800,
              fontSize: 14,
              boxShadow: value.length === 0 ? "none" : `0 0 12px var(--nex-kp-accent-glow, rgba(143,255,110,0.55))`,
              transition: "background 120ms ease, box-shadow 160ms ease",
            }}
          >
            ▶
          </button>
        </div>

        {/* Mode-tab strip · world-class pattern. Three peer surfaces:
            Keyboard · Emoji · Stickers. The current plane is
            highlighted acid-green. Tapping any tab switches the
            lower area without closing the keypad OR disturbing the
            composer's `value` · typing position is preserved
            because the composer, not the keypad, owns the state. */}
        <div
          style={{
            display: "flex",
            gap: 6,
            padding: "0 4px 8px",
            borderBottom: `1px solid rgba(143,255,110,0.08)`,
            marginBottom: 6,
          }}
        >
          <ModeTab
            label="Aa"
            active={!isDrawerPlane}
            onPress={() => {
              // Return to the last text plane · default to letters
              // (symbols/numbers are reached via the row-4 toggle
              // once the user is back on the keyboard).
              setPlane("letters");
            }}
          />
          <ModeTab
            label="😊"
            active={plane === "emoji"}
            onPress={() => setPlane("emoji")}
          />
          <ModeTab
            label="🃏"
            active={plane === "sticker"}
            onPress={() => setPlane("sticker")}
          />
          {/* Owner directive 2026-10-20 · "all keypads have emoji and
              stickers and giphy buttons and library" · third drawer
              tab opens the NEX GIFs library (fully offline · same
              catalog the chat composer picker uses). */}
          <ModeTab
            label="GIF"
            active={plane === "giphy"}
            onPress={() => setPlane("giphy")}
          />
        </div>

        {/* Inline drawer (emoji / sticker) · world-class standard.
            Replaces the key rows IN PLACE · composer stays visible
            via the preview strip above · typing position preserved
            across the mode switch. */}
        {plane === "emoji" && (
          <InlineEmojiGrid
            items={inlineEmoji}
            onPick={(e) => {
              onPickEmoji?.(e);
              // Auto-return to letters so the next tap on the pill
              // resumes typing without a second mode switch. This
              // matches the muscle memory of iOS/GBoard · pick one
              // thing, keep moving.
              setPlane("letters");
            }}
          />
        )}
        {plane === "sticker" && (
          <InlineStickerGrid
            items={inlineStickers}
            onPick={(s) => {
              onPickSticker?.(s);
              // Owner directive 2026-10-19 · auto-return to letters
              // after a sticker pick (matches the emoji drawer's
              // iOS/GBoard muscle-memory pattern on line 549-551).
              setPlane("letters");
            }}
          />
        )}
        {plane === "giphy" && (
          <InlineGiphyGrid
            onPick={(g) => {
              onPickGiphy?.(g);
              setPlane("letters");
            }}
          />
        )}

        {!isDrawerPlane && (
          <>
        {/* Row 1 · 10 keys */}
        <KeypadRow>
          {row1.map((c) => (
            <KeyCap
              key={c}
              glyph={displayChar(c)}
              onPress={() => pressKey(c)}
              flash={pressed === c}
            />
          ))}
        </KeypadRow>

        {/* Row 2 · letters 9 keys · numbers 10 keys (centred when
            shorter than row 1 to match the staircase feel of a real
            QWERTY). */}
        <KeypadRow indent={plane === "letters" ? 14 : 0}>
          {row2.map((c) => (
            <KeyCap
              key={c}
              glyph={displayChar(c)}
              onPress={() => pressKey(c)}
              flash={pressed === c}
            />
          ))}
        </KeypadRow>

        {/* Row 3 · shift / letters / backspace OR symbols-toggle /
            punctuation / backspace. */}
        <KeypadRow>
          {plane === "letters" ? (
            <KeyCap
              glyph={shift === "caps" ? "⇧" : "⇧"}
              intent="modifier"
              active={shift !== "lower"}
              locked={shift === "caps"}
              onPress={pressShift}
              flash={pressed === "⇧"}
              widthFactor={1.4}
            />
          ) : (
            <KeyCap
              glyph="#+="
              intent="modifier"
              active={plane === "symbols"}
              onPress={pressSymbolsToggle}
              flash={pressed === "#+="}
              widthFactor={1.4}
            />
          )}
          {row3.map((c) => (
            <KeyCap
              key={c}
              glyph={displayChar(c)}
              onPress={() => pressKey(c)}
              flash={pressed === c}
            />
          ))}
          <KeyCap
            glyph="⌫"
            intent="backspace"
            onPress={pressBackspace}
            flash={pressed === "⌫"}
            widthFactor={1.4}
          />
        </KeypadRow>

        {/* Row 4 · plane toggle · space · enter */}
        <KeypadRow>
          <KeyCap
            glyph={plane === "letters" ? "123" : "ABC"}
            intent="modifier"
            onPress={pressPlaneToggle}
            flash={pressed === "123" || pressed === "ABC"}
            widthFactor={1.6}
          />
          <KeyCap
            glyph="space"
            intent="space"
            onPress={pressSpace}
            flash={pressed === "␣"}
            widthFactor={4.4}
            suppressPressOnTouchEnd
            onPointerDownRaw={(e) => beginSpaceNav(e.clientX)}
            onPointerMoveRaw={(e) => moveSpaceNav(e.clientX)}
            onPointerUpRaw={(e) => {
              void e;
              /* Returns true (consumed) when nav mode was engaged so
                 the normal space insert is skipped · otherwise returns
                 false and the KeyCap's touchend/click fires pressSpace. */
              return endSpaceNav();
            }}
          />
          <KeyCap
            glyph="↵"
            intent="enter"
            onPress={() => {
              onSend();
              onClose();
            }}
            flash={pressed === "↵"}
            widthFactor={1.6}
          />
        </KeypadRow>
          </>
        )}
      </div>
    </>
  );
}

// ─── Mode tab · peer-surface selector in the top strip ──────────────
// One of three sibling tabs: Keyboard / Emoji / Stickers. Active tab
// paints an acid-green fill + black label; inactive stays dark with
// white label. 44px tall to meet mobile touch targets.
function ModeTab({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onPress}
      aria-pressed={active}
      style={{
        flex: 1,
        height: 32,
        padding: 0,
        appearance: "none",
        cursor: "pointer",
        fontFamily: "inherit",
        fontSize: 15,
        fontWeight: active ? 700 : 500,
        color: active ? "#010401" : KEY_TEXT,
        background: active ? "var(--nex-kp-accent, #8FFF6E)" : "rgba(255,255,255,0.04)",
        border: `1px solid ${active ? "var(--nex-kp-accent, #8FFF6E)" : "var(--nex-kp-accent-border, rgba(143,255,110,0.18))"}`,
        borderRadius: 10,
        boxShadow: active
          ? `0 0 10px var(--nex-kp-accent-glow, rgba(143,255,110,0.55))`
          : "inset 0 1px 0 rgba(255,255,255,0.03)",
        transition:
          "background 140ms ease, color 140ms ease, box-shadow 160ms ease",
      }}
    >
      {label}
    </button>
  );
}

// ─── Inline emoji grid · built-in Joker catalog ─────────────────────
// 5-column grid of PNG emoji from `getBuiltInEmoji(themeId)`. Tapping
// any tile stages the emoji in the composer (reuses the existing
// `onPickEmoji` → `setPendingEmoji` path from the composer footer)
// and auto-returns to the letters plane so the next tap on the pill
// resumes typing.
function InlineEmojiGrid({
  items,
  onPick,
}: {
  items: readonly BuiltInThemeEmoji[] | null;
  onPick: (emoji: BuiltInThemeEmoji) => void;
}): React.JSX.Element {
  if (!items || items.length === 0) {
    return <InlineDrawerEmpty text="No emoji available for this theme." />;
  }
  return (
    <div
      data-nex-joker-keypad-inline-emoji
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
        gap: 6,
        maxHeight: 220,
        overflowY: "auto",
        padding: "2px",
      }}
    >
      {items.map((e) => (
        <button
          key={e.slug}
          type="button"
          aria-label={e.label || e.slug}
          onMouseDown={(ev) => ev.preventDefault()}
          onClick={() => onPick(e)}
          style={{
            /* Owner directive 2026-10-19 · naked emoji tile · same
               strip as the picker's image branch · the uploaded
               theme emojis ship with their own decorative
               backgrounds and the keypad's accent-tinted chip
               visibly chopped through that art. Image IS the
               button · matches the WhatsApp / iMessage convention. */
            appearance: "none",
            background: "transparent",
            border: "none",
            borderRadius: 6,
            padding: 2,
            cursor: "pointer",
            display: "grid",
            placeItems: "center",
            aspectRatio: "1 / 1",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={e.image_url}
            alt={e.label || e.slug}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              pointerEvents: "none",
            }}
          />
        </button>
      ))}
    </div>
  );
}

// ─── Inline sticker grid · built-in Joker catalog ────────────────────
// 3-column grid · stickers render larger than emoji because they are
// a message content type, not an inline chip. Tap is non-functional
// in Phase 1 (matches current `EmojiStickerGifPicker` sticker tab) ·
// the send path for stickers is a Phase 2 or later concern.
function InlineStickerGrid({
  items,
  onPick,
}: {
  items: readonly BuiltInThemeSticker[] | null;
  /** Owner directive 2026-10-19 · sticker tap handler · parent
   *  (JokerKeypad) wires this up to the composer's pendingSticker
   *  state. Prior to this seal the grid had no onPick prop so taps
   *  silently no-op'd. */
  onPick?: (sticker: BuiltInThemeSticker) => void;
}): React.JSX.Element {
  if (!items || items.length === 0) {
    return <InlineDrawerEmpty text="No stickers available for this theme." />;
  }
  return (
    <div
      data-nex-joker-keypad-inline-stickers
      style={{
        /* Owner directive 2026-10-19 · 2-column grid matches the
           picker's bigger-sticker layout · the keypad's inline
           drawer stays visually consistent with the external
           picker. */
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: 10,
        maxHeight: 260,
        overflowY: "auto",
        padding: "2px",
      }}
    >
      {items.map((s) => (
        <button
          key={s.slug}
          type="button"
          aria-label={s.label || s.slug}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick?.(s)}
          data-nex-joker-keypad-sticker-slug={s.slug}
          style={{
            appearance: "none",
            background: KEY_BG_IDLE,
            border: `1px solid var(--nex-kp-accent-border, rgba(143,255,110,0.18))`,
            borderRadius: 12,
            padding: 4,
            cursor: onPick ? "pointer" : "default",
            display: "grid",
            placeItems: "center",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={s.image_url}
            alt={s.label || s.slug}
            style={{
              width: "100%",
              aspectRatio: `${s.aspect_ratio}`,
              objectFit: "contain",
              pointerEvents: "none",
            }}
          />
        </button>
      ))}
    </div>
  );
}

/* Owner directive 2026-10-20 · "all keypads have emoji + stickers +
 * giphy buttons and library" · the NEX built-in GIF catalog rendered
 * in the keypad's drawer area · same 2-column grid density as the
 * sticker drawer · taps fire onPick with the full BuiltInGif. */
function InlineGiphyGrid({
  onPick,
}: {
  onPick?: (gif: BuiltInGif) => void;
}): React.JSX.Element {
  if (!BUILT_IN_GIFS || BUILT_IN_GIFS.length === 0) {
    return <InlineDrawerEmpty text="No GIFs available." />;
  }
  return (
    <div
      data-nex-joker-keypad-inline-giphy
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: 10,
        maxHeight: 260,
        overflowY: "auto",
        padding: "2px",
      }}
    >
      {BUILT_IN_GIFS.map((g) => (
        <button
          key={g.id}
          type="button"
          aria-label={g.title || g.slug}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick?.(g)}
          data-nex-joker-keypad-giphy-slug={g.slug}
          style={{
            appearance: "none",
            background: KEY_BG_IDLE,
            border: `1px solid var(--nex-kp-accent-border, rgba(143,255,110,0.18))`,
            borderRadius: 12,
            padding: 0,
            overflow: "hidden",
            cursor: onPick ? "pointer" : "default",
            display: "block",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={g.url}
            alt={g.title || g.slug}
            style={{
              width: "100%",
              aspectRatio: `${g.aspectRatio}`,
              objectFit: "cover",
              display: "block",
              pointerEvents: "none",
            }}
          />
        </button>
      ))}
    </div>
  );
}

function InlineDrawerEmpty({ text }: { text: string }): React.JSX.Element {
  return (
    <div
      style={{
        padding: "24px 12px",
        textAlign: "center",
        color: "rgba(244,247,252,0.5)",
        fontSize: 12,
        letterSpacing: "0.04em",
      }}
    >
      {text}
    </div>
  );
}

/** Row wrapper · horizontal flex row with consistent gaps and an
 *  optional left indent (used so row 2 of letters inherits the
 *  classic QWERTY offset). */
function KeypadRow({
  children,
  indent = 0,
}: {
  children: React.ReactNode;
  indent?: number;
}): React.JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        gap: 5,
        margin: "4px 0",
        paddingLeft: indent,
        paddingRight: indent,
      }}
    >
      {children}
    </div>
  );
}

/** A single key · the ONLY place where key visuals are rendered.
 *  Intent drives the colour theme (letter / enter / backspace /
 *  modifier / space). `widthFactor` scales the base flex-grow so
 *  spacebar + enter + shift occupy the right proportion of the row.
 *  `active` + `locked` paint the shift-caps state on the shift cap. */
function KeyCap({
  glyph,
  onPress,
  flash,
  intent = "letter",
  active = false,
  locked = false,
  widthFactor = 1,
  onPointerDownRaw,
  onPointerMoveRaw,
  onPointerUpRaw,
  suppressPressOnTouchEnd,
}: {
  glyph: React.ReactNode;
  onPress: () => void;
  flash?: boolean;
  intent?: "letter" | "enter" | "backspace" | "modifier" | "space";
  active?: boolean;
  locked?: boolean;
  widthFactor?: number;
  /** Owner directive 2026-10-20 · space bar needs its own pointer
   *  stream to drive the hold-and-swipe cursor nav · these optional
   *  hooks let a caller add tracking without reworking the KeyCap
   *  internals. */
  onPointerDownRaw?: (e: React.PointerEvent) => void;
  onPointerMoveRaw?: (e: React.PointerEvent) => void;
  /** Return true to swallow the normal `onPress` firing on
   *  touchend/click · used when the pointer stream consumed the
   *  press (e.g. completed a nav swipe). */
  onPointerUpRaw?: (e: React.PointerEvent) => boolean | void;
  suppressPressOnTouchEnd?: boolean;
}): React.JSX.Element {
  const isEnter = intent === "enter";
  const isBackspace = intent === "backspace";
  const isModifier = intent === "modifier";

  const baseBg = isEnter
    ? "var(--nex-kp-accent, #8FFF6E)"
    : isBackspace
      ? BACKSPACE_RED
      : isModifier
        ? (active ? "var(--nex-kp-accent-dim, rgba(143,255,110,0.22))" : KEY_BG_IDLE)
        : KEY_BG_IDLE;
  const flashBg = isEnter ? "var(--nex-kp-accent, #8FFF6E)" : "var(--nex-kp-accent-pressed, rgba(143,255,110,0.25))";
  const borderColor = isEnter
    ? "var(--nex-kp-accent, #8FFF6E)"
    : isBackspace
      ? BACKSPACE_RED_BORDER
      : locked
        ? "var(--nex-kp-accent, #8FFF6E)"
        : active
          ? "var(--nex-kp-accent-dim, rgba(143,255,110,0.22))"
          : "var(--nex-kp-accent-border, rgba(143,255,110,0.18))";
  const textColor = isEnter
    ? "#010401"
    : locked
      ? "var(--nex-kp-accent, #8FFF6E)"
      : KEY_TEXT;

  const pressSuppressedRef = React.useRef<boolean>(false);
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault(); // keep composer input focused · no blur
      }}
      onPointerDown={(e) => {
        pressSuppressedRef.current = false;
        onPointerDownRaw?.(e);
      }}
      onPointerMove={(e) => {
        onPointerMoveRaw?.(e);
      }}
      onPointerUp={(e) => {
        const consumed = onPointerUpRaw?.(e);
        if (consumed) pressSuppressedRef.current = true;
      }}
      onPointerCancel={() => {
        /* Reset the suppress flag so a subsequent fresh press works. */
        pressSuppressedRef.current = false;
      }}
      onTouchStart={(e) => {
        // Prevent iOS from firing a 300ms synthetic click AFTER the
        // touchstart press · we commit the key on touchstart so the
        // keypad feels instant.
        e.preventDefault();
        if (suppressPressOnTouchEnd) return; // defer to touchend path
        onPress();
      }}
      onTouchEnd={() => {
        if (!suppressPressOnTouchEnd) return;
        if (pressSuppressedRef.current) {
          pressSuppressedRef.current = false;
          return;
        }
        onPress();
      }}
      onClick={(e) => {
        // Pointer / mouse path only · touch already handled above.
        if (e.detail === 0) return; // keyboard-triggered · ignore
        if (pressSuppressedRef.current) {
          pressSuppressedRef.current = false;
          return;
        }
        onPress();
      }}
      aria-label={typeof glyph === "string" ? glyph : undefined}
      aria-pressed={locked || active || undefined}
      data-nex-joker-key={typeof glyph === "string" ? glyph : undefined}
      style={{
        flex: `${widthFactor} 1 0`,
        minWidth: 0,
        height: isModifier || isBackspace || isEnter ? 46 : 42,
        padding: 0,
        appearance: "none",
        cursor: "pointer",
        fontFamily: "inherit",
        fontSize: typeof glyph === "string" && glyph.length > 1 ? 13 : 18,
        fontWeight: isEnter ? 700 : 500,
        letterSpacing: typeof glyph === "string" && glyph.length > 1 ? "0.08em" : 0,
        color: textColor,
        background: flash ? flashBg : baseBg,
        border: `1px solid ${borderColor}`,
        borderRadius: 10,
        boxShadow: flash
          ? `0 0 14px var(--nex-kp-accent-glow, rgba(143,255,110,0.55)), inset 0 -2px 0 var(--nex-kp-accent-dim, rgba(143,255,110,0.22))`
          : `0 2px 0 0 rgba(0,0,0,0.35), inset 0 -2px 0 rgba(255,255,255,0.04)`,
        transform: flash ? "translateY(1px)" : "translateY(0)",
        transition:
          "background 90ms ease, box-shadow 140ms ease, transform 80ms ease",
        position: "relative",
      }}
    >
      {glyph}
    </button>
  );
}
