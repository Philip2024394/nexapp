"use client";

// src/app/nex-native/chat-standard/_surfaces/_composer.tsx
//
// Phase 2A.0 · Standard composer surface.
//
// Pure presentation. Reads engine.composerTreatment for everything
// visual. Caller supplies text state + onSend callback; the composer
// does not know whether `onSend` writes to live DB or local fixture.

import * as React from "react";
import type { ResolvedEngine } from "../_engine/theme-engine";

export interface StandardComposerProps {
  engine: ResolvedEngine;
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
  /** Inline emoji toggle inside the input · sealed R3 revision 2 */
  onEmojiToggle?: () => void;
  emojiToggleActive?: boolean;
  /** Inline camera button inside the input · sealed R3 revision 2 */
  onCameraTap?: () => void;
  /** Inline attach / file-upload button inside the input · sealed R3
   *  revision 2 */
  onAttachTap?: () => void;
}

// Sealed R3 revision 2 (2026-10-05) · composer is a single input pill
// with every secondary action inlined on the LEFT (emoji · divider ·
// camera · attach). Text input flex-fills to the right.
//
// Owner directive 2026-10-18 · send button also lives INSIDE the pill
// now (right-side trailing action · theme-tinted · 32×32). The outer
// ComposerSendButton is retired on previews. Plus (+) stays outside
// as a separate round button rendered by the Standard Experience shell.
export function StandardComposer({
  engine,
  value,
  onChange,
  onSend,
  disabled,
  placeholder,
  onEmojiToggle,
  emojiToggleActive,
  onCameraTap,
  onAttachTap,
}: StandardComposerProps): React.JSX.Element {
  const t = engine.composerTreatment();
  const c = engine.colours;
  const [focused, setFocused] = React.useState(false);
  const textColor = t.inputStyle.color as string | undefined;

  // Visual size of an inline icon · 20pt visual, 24pt padded box so
  // adjacent icons breathe. Mobile tap target is the full 44pt
  // composer-row height.
  const inlineIconStyle: React.CSSProperties = {
    width: 24,
    height: 24,
    borderRadius: 999,
    background: "transparent",
    border: "none",
    color: textColor,
    cursor: "pointer",
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
    padding: 0,
    fontSize: 16,
  };

  return (
    <div
      data-nex-se-composer
      style={{
        ...t.containerStyle,
        position: "relative",
        animation:
          focused && t.focusAnimation
            ? `${t.focusAnimation} 1600ms ease-in-out infinite`
            : undefined,
      }}
    >
      {onEmojiToggle && (
        <button
          type="button"
          aria-label={
            emojiToggleActive
              ? "Close emoji picker"
              : "Open emoji + sticker picker"
          }
          aria-pressed={emojiToggleActive}
          onClick={onEmojiToggle}
          data-nex-se-composer-emoji-toggle={
            emojiToggleActive ? "open" : "closed"
          }
          style={{
            ...inlineIconStyle,
            background: emojiToggleActive ? `${c.primary}aa` : "transparent",
          }}
        >
          {emojiToggleActive ? "×" : "😊"}
        </button>
      )}
      {(onCameraTap || onAttachTap) && (
        <span
          aria-hidden
          style={{
            width: 1,
            height: 20,
            background: `${c.highlight}44`,
            margin: "0 2px",
            flexShrink: 0,
          }}
        />
      )}
      {onCameraTap && (
        <button
          type="button"
          aria-label="Take photo"
          data-nex-se-composer-action="camera"
          onClick={onCameraTap}
          style={inlineIconStyle}
        >
          <CameraIcon />
        </button>
      )}
      {onAttachTap && (
        <button
          type="button"
          aria-label="Attach file"
          data-nex-se-composer-action="attach"
          onClick={onAttachTap}
          style={inlineIconStyle}
        >
          <ClipIcon />
        </button>
      )}
      <input
        type="text"
        data-nex-se-composer-input
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (!disabled && value.trim().length > 0) {
              onSend();
            }
          }
        }}
        placeholder={placeholder ?? "Say something…"}
        style={{
          ...t.inputStyle,
          paddingLeft: 6,
          paddingRight: 6,
        }}
      />
      {/* Owner directive 2026-10-18 · send lives INSIDE the pill on
          the right · 32×32 theme-tinted circle · arms when the input
          has non-empty trimmed content. Replaces the external
          ComposerSendButton that previously floated right of the
          pill. */}
      <button
        type="button"
        aria-label="Send message"
        data-nex-se-composer-send-inline
        disabled={disabled || value.trim().length === 0}
        onClick={() => {
          if (!disabled && value.trim().length > 0) onSend();
        }}
        style={{
          flexShrink: 0,
          width: 32,
          height: 32,
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          border: "none",
          cursor:
            disabled || value.trim().length === 0 ? "default" : "pointer",
          background:
            value.trim().length > 0 ? c.primary : `${c.primary}44`,
          color: textColor,
          opacity: value.trim().length > 0 ? 1 : 0.6,
          transition: "background 160ms ease, opacity 160ms ease",
        }}
      >
        <SendGlyph />
      </button>
    </div>
  );
}

function SendGlyph(): React.JSX.Element {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M3 11l16-7-7 16-2-7-7-2z" />
    </svg>
  );
}

function CameraIcon(): React.JSX.Element {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 8h3l2-2.5h8L18 8h3v12H3V8z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function ClipIcon(): React.JSX.Element {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21.5 11.5 12 21a5 5 0 0 1-7-7l9.5-9.5a3.5 3.5 0 0 1 5 5L10.5 18a2 2 0 0 1-3-3L16 7" />
    </svg>
  );
}
