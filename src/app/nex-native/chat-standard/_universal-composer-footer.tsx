"use client";

// src/app/nex-native/chat-standard/_universal-composer-footer.tsx
//
// UNIVERSAL COMPOSER FOOTER OVERLAY · sealed 2026-10-05 R3 revision 2.
//
// Drops the sealed Prototype 5 composer layout onto any legacy theme
// as a fixed overlay without touching that theme's shell. The overlay
// sits on top of whatever native composer exists at the bottom of the
// legacy page · its solid background covers the native composer so
// visually there is only one composer, the new one.
//
// Layout matches R3 revision 2 (sealed via the Standard Experience):
//
//   [😊 │ 📷 📎 Say something…]  [▶ round send]  [+ round plus]
//    INSIDE INPUT PILL             OUTSIDE RIGHT
//
// Also owns the + menu dialog (Contacts · Product · Animation ·
// Settings) so the + button on the right of the composer triggers the
// same menu the Standard Experience shows.
//
// Universal Theme Controls Rule · sealed 2026-10-06 · the composer
// footer consumes `resolveControlsTreatment()` so its pill + send +
// plus buttons use the SAME solid themed surface as the Standard
// Experience shell's native composer. Pill is NO LONGER transparent
// (sealed 2026-10-05's R3 revision 2 "outlined border only" is
// EXPLICITLY SUPERSEDED).

import * as React from "react";
import { resolveControlsTreatment } from "./_engine/control-resolver";
import {
  getBuiltInEmoji,
  getBuiltInStickers,
  type BuiltInThemeEmoji,
  type BuiltInThemeSticker,
} from "@/lib/nex-native/theme-asset-fallback";
import { JokerKeypad } from "./_joker-keypad";
import { ChatComposerPill } from "@/lib/nex-native/chat-chrome/chat-composer-pill";
import { useVirtualKeyboardInset } from "@/lib/nex-native/use-virtual-keyboard-inset";

/** Joker-theme id · the only theme that overrides the native OS
 *  keyboard with the custom `JokerKeypad`. Centralised here so adding
 *  a second themed keypad later is a one-line change. */
const JOKER_KEYPAD_THEME_ID = "theme-0";

const NEX_CYAN = "#00AFFF";
const NEX_SECONDARY = "#4FC3DC";
const NEX_DEEP = "#020914";
const NEX_HIGHLIGHT = "#F4F7FC";

export interface UniversalComposerFooterProps {
  accent?: string;
  deep?: string;
  /** Theme highlight · drives icon colour inside controls (auto-
   *  contrasts for primary-filled send button). Defaults to NEX
   *  highlight. */
  highlight?: string;
  /** Theme secondary · echoed to the resolver for consistency. */
  secondary?: string;
  /** Optional send glyph · defaults to a paper-plane arrow. Themes may
   *  pass their signature glyph (🫧 for ocean · ☕ for coffee etc.) */
  sendGlyph?: React.ReactNode;
  /** The current theme id · used by the + menu's Animation action so
   *  it routes to this theme's motion page. */
  themeId?: string;
  /** Sealed 2026-10-11 · when supplied, the composer's Send button
   *  calls this with the current body + staged emoji instead of
   *  silently clearing. Lets the parent surface append the message
   *  to its live chat state (e.g. `_viewer.tsx` setMessages). When
   *  omitted the overlay behaves as before · locally clears, no
   *  posting. */
  onSendMessage?: (payload: {
    body: string;
    emoji: BuiltInThemeEmoji | null;
  }) => void;
}

export function UniversalComposerFooter({
  accent = NEX_CYAN,
  deep = NEX_DEEP,
  highlight = NEX_HIGHLIGHT,
  secondary = NEX_SECONDARY,
  sendGlyph,
  themeId,
  onSendMessage,
}: UniversalComposerFooterProps): React.JSX.Element {
  const [value, setValue] = React.useState("");
  const [emojiActive, setEmojiActive] = React.useState(false);
  const [plusOpen, setPlusOpen] = React.useState(false);
  // Owner directive 2026-10-18 · "all chat themes must have their
  // own keypad in theme color". The Joker-pattern keypad now opens
  // on EVERY viewer-path theme · each surface recolours via the
  // accentColor prop (Joker green for theme-0 · theme accent for
  // all others). The native OS keyboard is suppressed on all these
  // surfaces via `readOnly inputMode="none"` on the input (see
  // ChatComposerPill).
  const useJokerKeypad = true;
  void JOKER_KEYPAD_THEME_ID; // retained for the Joker emoji/sticker catalogue lookup only
  const [keypadOpen, setKeypadOpen] = React.useState(false);
  // Sealed 2026-10-11 · the picker tap now STAGES the picked emoji
  // in the composer alongside any text the user types · they can
  // delete it via a red X · they press Send when ready and the
  // chat gets emoji + text together. Null when nothing picked.
  const [pendingEmoji, setPendingEmoji] =
    React.useState<BuiltInThemeEmoji | null>(null);
  // Send is enabled when there is EITHER text OR a staged emoji.
  const hasText = value.trim().length > 0;
  const canSend = hasText || !!pendingEmoji;
  const controls = resolveControlsTreatment({
    primary: accent,
    secondary,
    highlight,
    deep,
  });
  // Sealed 2026-10-11 · ref on the Send button so send-triggered
  // animations (e.g. the Bats variant bursting bats OUT of the Send
  // button) can read the button's viewport position at the moment
  // of send without any prop drilling.
  const sendButtonRef = React.useRef<HTMLButtonElement | null>(null);
  // 2026-10-15 · B.1a · iOS virtual-keyboard lift. This footer is
  // `position: fixed; bottom: 0`, which pins it to the LAYOUT
  // viewport bottom. On iOS Safari the layout viewport does not
  // shrink when the keyboard opens, so the composer sits under the
  // keyboard. The hook returns the pixel height of the on-screen
  // keyboard (0 when none / no visualViewport support) and we lift
  // the fixed container by that amount via translateY. Progressive
  // enhancement · when visualViewport is unavailable the inset is
  // always 0 and behaviour matches today.
  const keyboardInset = useVirtualKeyboardInset();
  const sendAndClear = () => {
    if (!canSend) return;
    // Dispatch a global burst event with the send button's viewport
    // centre point · atmospheric motion overlays (currently the Bats
    // variant) listen for this on `window` and spawn particles from
    // that exact pixel so bats appear to fly out of the button. Fire
    // BEFORE onSendMessage so the burst starts simultaneous with the
    // optimistic bubble insert · no visible lag.
    if (typeof window !== "undefined" && sendButtonRef.current) {
      const r = sendButtonRef.current.getBoundingClientRect();
      window.dispatchEvent(
        new CustomEvent("nex-chat-send-burst", {
          detail: {
            x: r.left + r.width / 2,
            y: r.top + r.height / 2,
          },
        }),
      );
    }
    if (onSendMessage) {
      onSendMessage({ body: value.trim(), emoji: pendingEmoji });
    }
    setValue("");
    setPendingEmoji(null);
  };

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            [data-nex-peer-composer] { display: none !important; }
            button[aria-label="Theme animations"] { display: none !important; }
          `,
        }}
      />
      {/* Universal footer bar · master layout rule 2026-10-14 ·
          delegates the pill shape (bg, buttons, textarea, send) to the
          sealed ChatComposerPill primitive so every theme viewer, cover
          prototype, and Standard Experience surface renders the exact
          same composer as the Joker master. The outer SendButton +
          PlusButton that used to float outside the pill have been
          dropped · the primitive owns Send and + inside the pill. */}
      <div
        data-nex-universal-composer-footer
        data-nex-keyboard-inset={keyboardInset}
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 55,
          padding: "10px 10px calc(env(safe-area-inset-bottom, 0) + 10px)",
          pointerEvents: "none",
          // B.1a · iOS keyboard lift. 0 when no keyboard is open or
          // when `visualViewport` is unavailable, so desktop + older
          // browsers get the exact pre-fix behaviour. On iOS Safari
          // the composer lifts above the keyboard. willChange hints
          // the compositor to pre-promote the layer so the lift
          // doesn't repaint every frame.
          transform: keyboardInset > 0
            ? `translateY(-${keyboardInset}px)`
            : undefined,
          willChange: keyboardInset > 0 ? "transform" : undefined,
          transition: "transform 180ms ease-out",
        }}
      >
        <div style={{ pointerEvents: "auto" }}>
          <ChatComposerPill
            value={value}
            onChange={setValue}
            onSend={sendAndClear}
            placeholder={pendingEmoji ? "Add a message…" : "Say something…"}
            accentHex={accent ?? NEX_CYAN}
            armed={canSend}
            maxLength={4000}
            onPlusAction={() => setPlusOpen((v) => !v)}
            onEmoji={() => setEmojiActive((v) => !v)}
            suppressNativeKeyboard={useJokerKeypad}
            onFocusTextarea={() => setKeypadOpen(true)}
            sendButtonRef={sendButtonRef}
            prefixSlot={
              pendingEmoji ? (
                <PendingEmojiChip
                  emoji={pendingEmoji}
                  highlight={highlight ?? NEX_HIGHLIGHT}
                  onClear={() => setPendingEmoji(null)}
                />
              ) : null
            }
          />
        </div>
      </div>

      <PlusMenu
        accent={accent}
        deep={deep}
        highlight={highlight}
        open={plusOpen}
        onClose={() => setPlusOpen(false)}
        themeId={themeId}
      />

      {/* Sealed 2026-10-11 · the emoji button in the composer pill
          used to flip `emojiActive` state and render nothing · tap
          did nothing visible. This picker is the missing center-
          screen container · 3 tabs (Emoji · Stickers · GIF) ·
          Emoji + Stickers pull from the sealed Joker built-in
          catalog (23 emoji + 9 stickers · `theme-asset-fallback.ts`)
          when theme-id is "theme-0" · GIF tab is a placeholder
          until the GIF catalog ships. */}
      <EmojiStickerGifPicker
        open={emojiActive}
        onClose={() => setEmojiActive(false)}
        themeId={themeId}
        accent={accent}
        deep={deep}
        highlight={highlight}
        onPickEmoji={(e) => {
          // Stage the emoji in the composer · DO NOT send yet · the
          // user may add text, then press Send to deliver both.
          setPendingEmoji(e);
          setEmojiActive(false);
        }}
      />

      {/* Joker custom keypad · mounted whenever the Joker theme is
          active · controls its own open/close state through
          `keypadOpen`. See `_joker-keypad.tsx` for the visual
          specification. Phase 1 2026-10-12 · wires `themeId` +
          `onPickEmoji` so the inline emoji drawer surfaces the
          sealed Joker catalog and tapping an emoji stages it in
          `pendingEmoji` (identical path to the pre-keypad
          `EmojiStickerGifPicker`). */}
      {useJokerKeypad && (
        <JokerKeypad
          open={keypadOpen}
          value={value}
          onChange={setValue}
          onSend={sendAndClear}
          onClose={() => setKeypadOpen(false)}
          themeId={themeId}
          onPickEmoji={(e) => setPendingEmoji(e)}
          /* Owner directive 2026-10-18 · pass the active theme's
             primary colour so the keypad recolours · Joker still
             falls back to its sealed acid green via the component's
             default when accent is omitted. */
          accentColor={accent}
        />
      )}
    </>
  );
}

type ResolvedControls = ReturnType<typeof resolveControlsTreatment>;

// ─── Pending-emoji chip · renders inside ChatComposerPill's prefix slot
//     when the user has staged a theme-emoji picked from the picker.

function PendingEmojiChip({
  emoji,
  highlight,
  onClear,
}: {
  emoji: BuiltInThemeEmoji;
  highlight: string;
  onClear: () => void;
}): React.JSX.Element {
  return (
    <span
      data-nex-composer-pending-emoji={emoji.slug}
      style={{
        position: "relative",
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 32,
        height: 32,
        borderRadius: 10,
        background: `${highlight}10`,
        border: `1px solid ${highlight}22`,
        marginLeft: 4,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={emoji.image_url}
        alt={emoji.label || emoji.slug}
        style={{
          width: 24,
          height: 24,
          objectFit: "contain",
          pointerEvents: "none",
        }}
      />
      <button
        type="button"
        aria-label="Remove emoji"
        onClick={onClear}
        style={{
          position: "absolute",
          top: -4,
          right: -4,
          width: 16,
          height: 16,
          borderRadius: 999,
          background: "#FF3B30",
          color: "#FFFFFF",
          border: "1.5px solid #0B0F1A",
          fontSize: 10,
          fontWeight: 800,
          lineHeight: 1,
          cursor: "pointer",
          padding: 0,
          display: "grid",
          placeItems: "center",
          fontFamily: "inherit",
          boxShadow: "0 2px 4px rgba(255,59,48,0.45)",
        }}
      >
        ×
      </button>
    </span>
  );
}

// ─── Composer input pill (LEGACY · unused after 2026-10-14 master
//     layout seal · ChatComposerPill is now the renderer) ──────────

function ComposerPill({
  controls,
  value,
  onChange,
  onSend,
  emojiActive,
  onToggleEmoji,
  pendingEmoji,
  onClearPendingEmoji,
  suppressNativeKeyboard = false,
  onOpenCustomKeypad,
}: {
  controls: ResolvedControls;
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  emojiActive: boolean;
  onToggleEmoji: () => void;
  pendingEmoji: BuiltInThemeEmoji | null;
  onClearPendingEmoji: () => void;
  /** When true, the native OS keyboard is suppressed via
   *  `readOnly inputMode="none"` and tapping the input opens the
   *  theme's custom keypad via `onOpenCustomKeypad`. Sealed
   *  2026-10-12 for the Joker keypad override. */
  suppressNativeKeyboard?: boolean;
  onOpenCustomKeypad?: () => void;
}): React.JSX.Element {
  const { primary, highlight } = controls.colors;
  const inlineIconStyle: React.CSSProperties = {
    width: 24,
    height: 24,
    borderRadius: 999,
    background: "transparent",
    border: "none",
    color: highlight,
    cursor: "pointer",
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
    padding: 0,
    fontSize: 16,
  };
  return (
    <div style={controls.composerContainer}>
      <button
        type="button"
        aria-label={emojiActive ? "Close picker" : "Open emoji picker"}
        aria-pressed={emojiActive}
        onClick={onToggleEmoji}
        style={{
          ...inlineIconStyle,
          background: emojiActive ? primary : "transparent",
        }}
      >
        {emojiActive ? "×" : "😊"}
      </button>
      <span
        aria-hidden
        style={{
          width: 1,
          height: 20,
          background: `${highlight}44`,
          margin: "0 2px",
          flexShrink: 0,
        }}
      />
      <button
        type="button"
        aria-label="Take photo"
        style={inlineIconStyle}
      >
        <CameraIcon />
      </button>
      <button
        type="button"
        aria-label="Attach file"
        style={inlineIconStyle}
      >
        <ClipIcon />
      </button>
      {/* Pending emoji chip · sealed 2026-10-11 · when the user
          picks an emoji from the picker panel it stages HERE in
          the pill (not sent) alongside any text they type · the
          red circle removes it · Send delivers emoji + text
          together. */}
      {pendingEmoji && (
        <span
          data-nex-composer-pending-emoji={pendingEmoji.slug}
          style={{
            position: "relative",
            flexShrink: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            borderRadius: 10,
            background: `${highlight}10`,
            border: `1px solid ${highlight}22`,
            marginLeft: 4,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={pendingEmoji.image_url}
            alt={pendingEmoji.label || pendingEmoji.slug}
            style={{
              width: 24,
              height: 24,
              objectFit: "contain",
              pointerEvents: "none",
            }}
          />
          <button
            type="button"
            aria-label="Remove emoji"
            onClick={onClearPendingEmoji}
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              width: 16,
              height: 16,
              borderRadius: 999,
              background: "#FF3B30",
              color: "#FFFFFF",
              border: "1.5px solid #0B0F1A",
              fontSize: 10,
              fontWeight: 800,
              lineHeight: 1,
              cursor: "pointer",
              padding: 0,
              display: "grid",
              placeItems: "center",
              fontFamily: "inherit",
              boxShadow: "0 2px 4px rgba(255,59,48,0.45)",
            }}
          >
            ×
          </button>
        </span>
      )}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
          }
        }}
        placeholder={
          pendingEmoji ? "Add a message…" : "Say something…"
        }
        // Sealed 2026-10-12 · Joker override · `readOnly` makes iOS
        // and Android skip the native keyboard, `inputMode="none"`
        // tells mobile browsers no on-screen keyboard is wanted at
        // all. Tapping the input then triggers the parent-owned
        // `onOpenCustomKeypad`. We keep `type="text"` + the
        // controlled value so cursor rendering, selection, and
        // accessibility (screen reader name/role) all behave
        // identically to a regular input.
        readOnly={suppressNativeKeyboard}
        inputMode={suppressNativeKeyboard ? "none" : undefined}
        onFocus={() => {
          if (suppressNativeKeyboard) onOpenCustomKeypad?.();
        }}
        onMouseDown={(e) => {
          if (!suppressNativeKeyboard) return;
          // Keep the tap from stealing selection focus if the
          // keypad is already open · we want a second tap on the
          // pill to be a no-op, not a flicker.
          e.preventDefault();
          onOpenCustomKeypad?.();
        }}
        onTouchStart={() => {
          if (suppressNativeKeyboard) onOpenCustomKeypad?.();
        }}
        style={{
          flex: 1,
          minWidth: 0,
          background: "transparent",
          border: "none",
          outline: "none",
          color: highlight,
          fontSize: 13,
          fontFamily: "inherit",
          paddingLeft: 6,
          cursor: suppressNativeKeyboard ? "text" : undefined,
        }}
      />
    </div>
  );
}

// ─── Send button ────────────────────────────────────────────────────

const SendButton = React.forwardRef<
  HTMLButtonElement,
  {
    controls: ResolvedControls;
    disabled: boolean;
    onClick: () => void;
    glyph?: React.ReactNode;
  }
>(function SendButton({ controls, disabled, onClick, glyph }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label="Send"
      disabled={disabled}
      onClick={onClick}
      style={{ ...controls.sendButton(disabled), pointerEvents: "auto" }}
    >
      {glyph ?? <SendIcon />}
    </button>
  );
});

// ─── Plus button ────────────────────────────────────────────────────

function PlusButton({
  controls,
  open,
  onToggle,
}: {
  controls: ResolvedControls;
  open: boolean;
  onToggle: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-label={open ? "Close menu" : "Add to this chat"}
      aria-pressed={open}
      onClick={onToggle}
      style={{
        ...(open ? controls.plusButtonActive : controls.plusButton),
        pointerEvents: "auto",
      }}
    >
      <PlusIcon />
    </button>
  );
}

// ─── Plus menu (same four sealed actions) ───────────────────────────

function PlusMenu({
  accent,
  deep,
  highlight,
  open,
  onClose,
  themeId,
}: {
  accent: string;
  deep: string;
  highlight: string;
  open: boolean;
  onClose: () => void;
  themeId?: string;
}): React.JSX.Element {
  const option: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    padding: "10px 4px",
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    borderRadius: 14,
    border: `1px solid ${accent}66`,
    background: `${accent}1a`,
    color: highlight,
    cursor: "pointer",
    textAlign: "center",
    fontFamily: "inherit",
    fontSize: 11,
    fontWeight: 600,
    lineHeight: 1.1,
    overflow: "hidden",
  };
  const iconCircle: React.CSSProperties = {
    width: 36,
    height: 36,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    background: `linear-gradient(135deg, ${accent}, ${accent}aa)`,
    color: highlight,
    boxShadow: `0 2px 6px ${accent}55`,
    flex: "none",
  };
  return (
    <div
      aria-hidden={!open}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 70,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: open ? "auto" : "none",
        opacity: open ? 1 : 0,
        transition: "opacity 200ms ease-out",
      }}
    >
      <div
        aria-hidden
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
          backdropFilter: "blur(4px)",
        }}
      />
      <div
        role="dialog"
        style={{
          position: "relative",
          padding: 18,
          borderRadius: 22,
          background: `linear-gradient(180deg, ${deep}e6, ${deep}f5)`,
          border: `1px solid ${accent}99`,
          boxShadow: `0 20px 50px rgba(0,0,0,0.55), 0 0 0 1px ${accent}22`,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          width: "min(360px, 92vw)",
          boxSizing: "border-box",
          transform: `scale(${open ? 1 : 0.9})`,
          transition: "transform 240ms cubic-bezier(0.2, 0.9, 0.3, 1.1)",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: highlight, textAlign: "center" }}>
          Add to this chat
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, justifyItems: "center" }}>
          <a href="/nex-native/friends" aria-label="Contacts" style={{ ...option, textDecoration: "none" }}>
            <span aria-hidden style={iconCircle}><ContactsIcon /></span>
            <span>Contacts</span>
          </a>
          <a href="/nex-native/manage/products" aria-label="Product" style={{ ...option, textDecoration: "none" }}>
            <span aria-hidden style={iconCircle}><ProductIcon /></span>
            <span>Product</span>
          </a>
          <a
            href={themeId ? `/nex-native/themes/${themeId}/motion` : "/nex-native/themes/motion"}
            aria-label="Animation"
            style={{ ...option, textDecoration: "none" }}
          >
            <span aria-hidden style={iconCircle}><AnimationIcon /></span>
            <span>Animation</span>
          </a>
          <a href="/nex-native/settings" aria-label="Settings" style={{ ...option, textDecoration: "none" }}>
            <span aria-hidden style={iconCircle}><SettingsIcon /></span>
            <span>Settings</span>
          </a>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            alignSelf: "center",
            padding: "6px 14px",
            borderRadius: 999,
            border: `1px solid ${highlight}33`,
            background: "transparent",
            color: highlight,
            fontSize: 11,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Icons ──────────────────────────────────────────────────────────

function CameraIcon(): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 8h3l2-2.5h8L18 8h3v12H3V8z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}
function ClipIcon(): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21.5 11.5 12 21a5 5 0 0 1-7-7l9.5-9.5a3.5 3.5 0 0 1 5 5L10.5 18a2 2 0 0 1-3-3L16 7" />
    </svg>
  );
}
function SendIcon(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M3 11.5 21 3l-7 18-2-8-9-1.5z" />
    </svg>
  );
}
function PlusIcon(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function ContactsIcon(): React.JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="7" r="2.5" />
      <path d="M15 14c3 0 6 1.5 6 5" />
    </svg>
  );
}
function ProductIcon(): React.JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 7.5 12 3l9 4.5v9L12 21 3 16.5v-9z" />
      <path d="M3 7.5 12 12l9-4.5" />
      <path d="M12 12v9" />
    </svg>
  );
}
function AnimationIcon(): React.JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 2 l1.6 4.4 L18 8l-4.4 1.6L12 14l-1.6-4.4L6 8l4.4-1.6z" />
      <path d="M18 15l0.8 2.2L21 18l-2.2 0.8L18 21l-0.8-2.2L15 18l2.2-0.8z" />
      <path d="M6 15l0.6 1.8L8 17.4l-1.4 0.6L6 19.8l-0.6-1.8L4 17.4l1.4-0.6z" />
    </svg>
  );
}
function SettingsIcon(): React.JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .4 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.4 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .4-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.4-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.4H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.4l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.4 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
    </svg>
  );
}

// ─── Emoji / Sticker / GIF picker ──────────────────────────────────
//
// Centred modal panel that opens when the composer's emoji button is
// tapped. Three tabs:
//   · Emoji   · reads `getBuiltInEmoji(themeId)` from the sealed
//               fallback catalog · 23 Joker faces on theme-0 · empty
//               state for themes without a built-in set
//   · Stickers · reads `getBuiltInStickers(themeId)` · 9 Joker
//                scenes on theme-0
//   · GIF     · placeholder · no catalog shipped yet · shows a
//               "coming soon" state so the surface exists for when
//               the GIF library lands

type PickerTab = "emoji" | "sticker" | "gif";

function EmojiStickerGifPicker({
  open,
  onClose,
  themeId,
  accent,
  deep,
  highlight,
  onPickEmoji,
}: {
  open: boolean;
  onClose: () => void;
  themeId?: string;
  accent: string;
  deep: string;
  highlight: string;
  /** Fired when the user taps an emoji tile · parent stages it in
   *  the composer input alongside any typed text. */
  onPickEmoji: (emoji: BuiltInThemeEmoji) => void;
}): React.JSX.Element | null {
  const [tab, setTab] = React.useState<PickerTab>("emoji");
  if (!open) return null;
  const emoji = themeId ? getBuiltInEmoji(themeId) : null;
  const stickers = themeId ? getBuiltInStickers(themeId) : null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Insert emoji, sticker or GIF"
      data-nex-emoji-sticker-gif-picker={open ? "open" : "closed"}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 75,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        pointerEvents: "auto",
      }}
    >
      <div
        aria-hidden
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
        }}
      />
      <div
        style={{
          position: "relative",
          width: "min(360px, 92vw)",
          maxHeight: "70vh",
          display: "flex",
          flexDirection: "column",
          borderRadius: 20,
          background: `linear-gradient(180deg, ${deep}f0, ${deep}fa)`,
          border: `1px solid ${accent}88`,
          boxShadow: `0 24px 56px rgba(0,0,0,0.55), 0 0 0 1px ${accent}22`,
          color: highlight,
          overflow: "hidden",
        }}
      >
        <PickerTabs tab={tab} onChange={setTab} accent={accent} highlight={highlight} />
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: "12px 14px 14px",
          }}
        >
          {tab === "emoji" && (
            <PickerEmojiGrid
              items={emoji}
              highlight={highlight}
              onPick={onPickEmoji}
            />
          )}
          {tab === "sticker" && <PickerStickerGrid items={stickers} highlight={highlight} />}
          {tab === "gif" && <PickerGifEmpty accent={accent} highlight={highlight} />}
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            alignSelf: "center",
            margin: "6px 0 10px",
            padding: "6px 16px",
            borderRadius: 999,
            background: "transparent",
            border: `1px solid ${highlight}33`,
            color: highlight,
            fontSize: 11,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

function PickerTabs({
  tab,
  onChange,
  accent,
  highlight,
}: {
  tab: PickerTab;
  onChange: (t: PickerTab) => void;
  accent: string;
  highlight: string;
}): React.JSX.Element {
  const tabs: readonly { id: PickerTab; label: string }[] = [
    { id: "emoji", label: "Emoji" },
    { id: "sticker", label: "Stickers" },
    { id: "gif", label: "GIF" },
  ];
  return (
    <div
      role="tablist"
      aria-label="Picker tabs"
      style={{
        display: "flex",
        padding: "6px 10px 0",
        gap: 6,
        borderBottom: `1px solid ${accent}33`,
      }}
    >
      {tabs.map((t) => {
        const active = tab === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            style={{
              appearance: "none",
              background: "transparent",
              border: "none",
              padding: "10px 14px 12px",
              fontFamily: "inherit",
              fontSize: 12,
              fontWeight: active ? 700 : 500,
              letterSpacing: "0.02em",
              color: active ? accent : `${highlight}99`,
              borderBottom: active ? `2px solid ${accent}` : "none",
              cursor: "pointer",
              textTransform: "capitalize",
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function PickerEmojiGrid({
  items,
  highlight,
  onPick,
}: {
  items: readonly BuiltInThemeEmoji[] | null;
  highlight: string;
  onPick: (emoji: BuiltInThemeEmoji) => void;
}): React.JSX.Element {
  if (!items || items.length === 0) {
    return <PickerEmptyState text="No emoji for this theme yet." highlight={highlight} />;
  }
  // Sealed 2026-10-11 · 5 columns (was 6) so each tile is larger
  // and easier to pick. Panel body is already overflowY:auto so
  // the user scrolls down to reach rows beyond the viewport.
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
        gap: 10,
      }}
    >
      {items.map((e) => (
        <button
          key={e.slug}
          type="button"
          aria-label={e.label || e.slug}
          onClick={() => onPick(e)}
          style={{
            appearance: "none",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            padding: 4,
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
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        </button>
      ))}
    </div>
  );
}

function PickerStickerGrid({
  items,
  highlight,
}: {
  items: readonly BuiltInThemeSticker[] | null;
  highlight: string;
}): React.JSX.Element {
  if (!items || items.length === 0) {
    return <PickerEmptyState text="No stickers for this theme yet." highlight={highlight} />;
  }
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: 10,
      }}
    >
      {items.map((s) => (
        <button
          key={s.slug}
          type="button"
          aria-label={s.label || s.slug}
          style={{
            appearance: "none",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            padding: 4,
            cursor: "pointer",
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
            }}
          />
        </button>
      ))}
    </div>
  );
}

function PickerGifEmpty({
  accent,
  highlight,
}: {
  accent: string;
  highlight: string;
}): React.JSX.Element {
  return (
    <div
      style={{
        padding: "32px 20px",
        textAlign: "center",
        color: `${highlight}aa`,
        fontSize: 12,
        lineHeight: 1.6,
      }}
    >
      <div style={{ fontSize: 36, marginBottom: 10, color: accent }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M7 10v4M7 12h2M12 10v4M15 10v4h2" />
        </svg>
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: highlight, marginBottom: 4 }}>
        GIF library coming soon
      </div>
      <div>
        Theme-specific animated clips will land here · same picker,
        new tab · you'll see them when the catalog ships.
      </div>
    </div>
  );
}

function PickerEmptyState({
  text,
  highlight,
}: {
  text: string;
  highlight: string;
}): React.JSX.Element {
  return (
    <div
      style={{
        padding: "32px 20px",
        textAlign: "center",
        color: `${highlight}99`,
        fontSize: 12,
        lineHeight: 1.5,
      }}
    >
      {text}
    </div>
  );
}
