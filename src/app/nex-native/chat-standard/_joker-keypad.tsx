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
  getBuiltInEmoji,
  getBuiltInStickers,
  type BuiltInThemeEmoji,
  type BuiltInThemeSticker,
} from "@/lib/nex-native/theme-asset-fallback";

const JOKER_GREEN = "#8FFF6E";
const JOKER_GREEN_DIM = "rgba(143,255,110,0.22)";
const JOKER_GREEN_GLOW = "rgba(143,255,110,0.55)";
const DEEP_1 = "#030308";
const DEEP_2 = "#0A0F1A";
const KEY_TEXT = "#F4F7FC";
const KEY_BG_IDLE = "rgba(255,255,255,0.06)";
const KEY_BG_PRESSED = "rgba(143,255,110,0.25)";
const KEY_BORDER = "rgba(143,255,110,0.18)";
const BACKSPACE_RED = "rgba(255,80,80,0.14)";
const BACKSPACE_RED_BORDER = "rgba(255,80,80,0.35)";

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
type Plane = "letters" | "numbers" | "symbols" | "emoji" | "sticker";

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
}: JokerKeypadProps): React.JSX.Element | null {
  const [shift, setShift] = React.useState<ShiftState>("upper"); // first letter capitalised
  const [plane, setPlane] = React.useState<Plane>("letters");
  const [pressed, setPressed] = React.useState<string | null>(null);

  // Inline drawer sources · built-in catalog · Joker ships 23 emoji
  // + 9 stickers that match the theme's visual DNA. The service
  // falls back to [] for themes without a built-in catalog · the
  // drawer renders an honest empty state in that case.
  const inlineEmoji = themeId ? getBuiltInEmoji(themeId) : null;
  const inlineStickers = themeId ? getBuiltInStickers(themeId) : null;

  // Is the current plane a text plane (letters/numbers/symbols) or
  // one of the inline drawers? Used to swap the key-rows area for
  // the drawer grid without duplicating the top preview strip or
  // the mode-switch tabs.
  const isDrawerPlane = plane === "emoji" || plane === "sticker";

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

  const pressKey = (char: string) => {
    const emit = shift === "lower" ? char : char.toUpperCase();
    onChange(value + emit);
    // One-shot shift drops back to lower after a single letter.
    if (shift === "upper") setShift("lower");
    flashPressed(char);
  };

  const pressBackspace = () => {
    if (value.length === 0) return;
    // Trim one grapheme-ish unit · Array.from handles surrogate pairs
    // so emoji don't break into two deletes.
    const graphemes = Array.from(value);
    graphemes.pop();
    onChange(graphemes.join(""));
    flashPressed("⌫");
  };

  const pressSpace = () => {
    onChange(value + " ");
    flashPressed("␣");
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
          0%   { box-shadow: 0 0 0 0 ${JOKER_GREEN_GLOW}, 0 2px 0 0 ${JOKER_GREEN_DIM}; }
          100% { box-shadow: 0 0 12px 4px transparent, 0 2px 0 0 ${JOKER_GREEN_DIM}; }
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
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 221,
          padding:
            "10px 6px calc(env(safe-area-inset-bottom, 0px) + 10px)",
          background:
            `linear-gradient(180deg, ${DEEP_1} 0%, ${DEEP_2} 100%)`,
          borderTop: `1px solid ${JOKER_GREEN_DIM}`,
          boxShadow:
            `0 -8px 32px rgba(0,0,0,0.6), 0 -1px 0 ${JOKER_GREEN_DIM}`,
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
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${KEY_BORDER}`,
              color: KEY_TEXT,
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

          {/* Live preview · fills the available width · truncates
              with an ellipsis if the user types past the strip.
              A trailing caret ▍ shows where the next character
              will land · blinks at 1Hz so the strip reads as a
              real text field, not a static label. */}
          <div
            data-nex-joker-keypad-preview
            style={{
              flex: 1,
              minWidth: 0,
              height: 32,
              display: "flex",
              alignItems: "center",
              padding: "0 10px",
              borderRadius: 10,
              background: "rgba(0,0,0,0.45)",
              border: `1px solid ${JOKER_GREEN_DIM}`,
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.03), 0 0 0 1px rgba(0,0,0,0.4)`,
              fontFamily: "inherit",
              fontSize: 13,
              color: value.length === 0 ? "rgba(244,247,252,0.35)" : KEY_TEXT,
              letterSpacing: 0,
              overflow: "hidden",
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
            }}
          >
            {value.length === 0 ? (
              <span>Say something…</span>
            ) : (
              <>
                {/* `direction: rtl` scrolls the view to the end so
                    the caret stays visible as the user types past
                    the strip width · we flip the content back to
                    `ltr` on the inner span so the text itself
                    reads left-to-right. */}
                <span
                  style={{
                    direction: "rtl",
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                    display: "inline-block",
                    maxWidth: "100%",
                  }}
                >
                  <span style={{ direction: "ltr", unicodeBidi: "bidi-override" }}>
                    {value}
                  </span>
                </span>
                <span
                  aria-hidden
                  style={{
                    display: "inline-block",
                    width: 2,
                    height: 14,
                    marginLeft: 2,
                    background: JOKER_GREEN,
                    boxShadow: `0 0 6px ${JOKER_GREEN_GLOW}`,
                    animation: "nex-joker-caret-blink 1s steps(2) infinite",
                  }}
                />
              </>
            )}
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
              background: value.length === 0 ? "rgba(143,255,110,0.18)" : JOKER_GREEN,
              color: value.length === 0 ? "rgba(1,4,1,0.55)" : "#010401",
              border: `1px solid ${JOKER_GREEN}`,
              cursor: value.length === 0 ? "default" : "pointer",
              fontWeight: 800,
              fontSize: 14,
              boxShadow: value.length === 0 ? "none" : `0 0 12px ${JOKER_GREEN_GLOW}`,
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
          <InlineStickerGrid items={inlineStickers} />
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
        background: active ? JOKER_GREEN : "rgba(255,255,255,0.04)",
        border: `1px solid ${active ? JOKER_GREEN : KEY_BORDER}`,
        borderRadius: 10,
        boxShadow: active
          ? `0 0 10px ${JOKER_GREEN_GLOW}`
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
            appearance: "none",
            background: KEY_BG_IDLE,
            border: `1px solid ${KEY_BORDER}`,
            borderRadius: 10,
            padding: 6,
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
}: {
  items: readonly BuiltInThemeSticker[] | null;
}): React.JSX.Element {
  if (!items || items.length === 0) {
    return <InlineDrawerEmpty text="No stickers available for this theme." />;
  }
  return (
    <div
      data-nex-joker-keypad-inline-stickers
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: 8,
        maxHeight: 220,
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
          style={{
            appearance: "none",
            background: KEY_BG_IDLE,
            border: `1px solid ${KEY_BORDER}`,
            borderRadius: 12,
            padding: 4,
            cursor: "default",
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
}: {
  glyph: React.ReactNode;
  onPress: () => void;
  flash?: boolean;
  intent?: "letter" | "enter" | "backspace" | "modifier" | "space";
  active?: boolean;
  locked?: boolean;
  widthFactor?: number;
}): React.JSX.Element {
  const isEnter = intent === "enter";
  const isBackspace = intent === "backspace";
  const isModifier = intent === "modifier";

  const baseBg = isEnter
    ? JOKER_GREEN
    : isBackspace
      ? BACKSPACE_RED
      : isModifier
        ? (active ? JOKER_GREEN_DIM : KEY_BG_IDLE)
        : KEY_BG_IDLE;
  const flashBg = isEnter ? JOKER_GREEN : KEY_BG_PRESSED;
  const borderColor = isEnter
    ? JOKER_GREEN
    : isBackspace
      ? BACKSPACE_RED_BORDER
      : locked
        ? JOKER_GREEN
        : active
          ? JOKER_GREEN_DIM
          : KEY_BORDER;
  const textColor = isEnter
    ? "#010401"
    : locked
      ? JOKER_GREEN
      : KEY_TEXT;

  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault(); // keep composer input focused · no blur
      }}
      onTouchStart={(e) => {
        // Prevent iOS from firing a 300ms synthetic click AFTER the
        // touchstart press · we commit the key on touchstart so the
        // keypad feels instant.
        e.preventDefault();
        onPress();
      }}
      onClick={(e) => {
        // Pointer / mouse path only · touch already handled above.
        if (e.detail === 0) return; // keyboard-triggered · ignore
        // Touch synthesises a click after touchstart on some engines ·
        // the `pressed` flash state briefly ignores double emission
        // thanks to the 140ms flashPressed timer. If the keypad is
        // tapped twice intentionally within 140ms the user still gets
        // both characters; the flash just doesn't double-render.
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
          ? `0 0 14px ${JOKER_GREEN_GLOW}, inset 0 -2px 0 ${JOKER_GREEN_DIM}`
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
