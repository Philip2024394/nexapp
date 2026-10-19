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

export interface ComposerPendingEmoji {
  slug: string;
  imageUrl: string;
  label: string;
}
export interface ComposerPendingSticker {
  slug: string;
  imageUrl: string;
  label: string;
  aspectRatio: number;
}
export interface ComposerPendingAttachment {
  id: string;
  name: string;
  mime: string;
  sizeBytes: number;
  /** For images · an object URL for inline preview thumbnail. Non-
   *  image types pass null and a generic file-type glyph renders. */
  previewUrl: string | null;
}

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
  /** Owner directive 2026-10-18 · "all chat themes must have their
   *  own keypad in theme color". When true, the input is flipped to
   *  `readOnly inputMode="none"` so iOS / Android / desktop keyboards
   *  never open · tapping the input fires `onFocusInput` which the
   *  shell uses to open the JokerKeypad. */
  suppressNativeKeyboard?: boolean;
  /** Fires when the input receives focus · drives keypad open on
   *  surfaces that pass `suppressNativeKeyboard`. */
  onFocusInput?: () => void;
  /** Owner directive 2026-10-19 · staged image emoji preview inside
   *  the composer pill (mirrors the sealed pendingEmoji pattern from
   *  _universal-composer-footer.tsx). When set, a small square chip
   *  renders left of the text input with the asset image and a ×
   *  close button that fires `onClearPendingEmoji`. Send flushes
   *  text + emoji together via `onSend`. */
  pendingEmoji?: ComposerPendingEmoji | null;
  onClearPendingEmoji?: () => void;
  /** Same model for staged stickers · chip renders slightly larger
   *  because stickers are a "sent asset" not a text annotation.
   *  Send flushes sticker (as its own bubble) + optional caption. */
  pendingSticker?: ComposerPendingSticker | null;
  onClearPendingSticker?: () => void;
  /** Owner directive 2026-10-19 · attachments staged by the lower-
   *  right 3-dot menu's Camera + File-Attachment buttons · each
   *  chip renders a preview (image thumbnail or file-type glyph) +
   *  a × remove button inside the composer pill, LEFT of the text
   *  input. Send flushes attachments as their own bubbles ahead of
   *  the text + optional pending emoji/sticker. */
  pendingAttachments?: readonly ComposerPendingAttachment[];
  onRemoveAttachment?: (id: string) => void;
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
  suppressNativeKeyboard,
  onFocusInput,
  pendingEmoji,
  onClearPendingEmoji,
  pendingSticker,
  onClearPendingSticker,
  pendingAttachments,
  onRemoveAttachment,
}: StandardComposerProps): React.JSX.Element {
  const t = engine.composerTreatment();
  const c = engine.colours;
  const [focused, setFocused] = React.useState(false);
  const textColor = t.inputStyle.color as string | undefined;
  // Owner directive 2026-10-18 · "armed" state drives the solid-with-
  // glow-beat send button · fires once the user has typed, dropped
  // an emoji, or placed a sticker (anything that lands non-whitespace
  // in the input value). 2026-10-19 · staged emoji / sticker /
  // attachment also arm the send so the user can post a picked asset
  // without typing.
  const armed =
    !disabled &&
    (value.trim().length > 0 ||
      !!pendingEmoji ||
      !!pendingSticker ||
      (pendingAttachments?.length ?? 0) > 0);

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
      {/* Owner directive 2026-10-19 · camera + file-attach icons
          retired from the composer input footer · they now live in
          the lower-right 3-dot menu (FloatingCallActions). This keeps
          the composer pill as a focused text + emoji surface and
          moves the "add media" actions under one roof. */}
      {/* Owner directive 2026-10-19 · pending attachment chips ·
          one per file staged from the 3-dot menu's Camera or File
          Attachment buttons. Image attachments render a 36×36
          thumbnail · other file types render a monochrome glyph +
          truncated file name. Each chip has a × remove control. */}
      {pendingAttachments && pendingAttachments.length > 0 && (
        <div
          data-nex-se-composer-pending-attachments
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            flexShrink: 0,
            flexWrap: "nowrap",
            overflowX: "auto",
            maxWidth: 180,
          }}
        >
          {pendingAttachments.map((a) => (
            <span
              key={a.id}
              data-nex-se-composer-pending-attachment={a.id}
              data-nex-se-composer-pending-attachment-mime={a.mime}
              style={{
                position: "relative",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                flexShrink: 0,
                padding: 2,
                borderRadius: 10,
                background: `${c.primary}22`,
                border: `1px solid ${c.primary}66`,
              }}
            >
              {a.previewUrl ? (
                <img
                  src={a.previewUrl}
                  alt={a.name}
                  style={{
                    width: 36,
                    height: 36,
                    objectFit: "cover",
                    display: "block",
                    borderRadius: 6,
                  }}
                />
              ) : (
                <span
                  aria-hidden
                  style={{
                    width: 36,
                    height: 36,
                    display: "grid",
                    placeItems: "center",
                    background: "rgba(0,0,0,0.35)",
                    borderRadius: 6,
                    color: textColor,
                    fontSize: 10,
                    fontWeight: 800,
                    textTransform: "uppercase",
                  }}
                >
                  {(a.name.split(".").pop() ?? "file").slice(0, 4)}
                </span>
              )}
              {onRemoveAttachment && (
                <button
                  type="button"
                  aria-label={`Remove ${a.name}`}
                  onClick={() => onRemoveAttachment(a.id)}
                  style={{
                    position: "absolute",
                    top: -6,
                    right: -6,
                    width: 18,
                    height: 18,
                    borderRadius: 999,
                    border: "1.5px solid #0B0F1A",
                    background: "#FF3B30",
                    color: "#FFFFFF",
                    cursor: "pointer",
                    padding: 0,
                    fontSize: 11,
                    fontWeight: 800,
                    lineHeight: 1,
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                    zIndex: 1,
                  }}
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      {/* Owner directive 2026-10-19 · pending-emoji preview chip ·
          mirrors the sealed pattern from _universal-composer-footer.
          Image renders at 32×32 on a translucent accent swatch with
          an inline × button to clear. */}
      {pendingEmoji && (
        <span
          data-nex-se-composer-pending-emoji
          data-nex-se-composer-pending-emoji-slug={pendingEmoji.slug}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            flexShrink: 0,
            padding: 2,
            borderRadius: 10,
            background: `${c.primary}22`,
            border: `1px solid ${c.primary}66`,
          }}
        >
          <img
            src={pendingEmoji.imageUrl}
            alt={pendingEmoji.label || pendingEmoji.slug}
            style={{
              width: 32,
              height: 32,
              objectFit: "contain",
              display: "block",
            }}
          />
          {onClearPendingEmoji && (
            <button
              type="button"
              aria-label="Remove staged emoji"
              onClick={onClearPendingEmoji}
              style={{
                width: 18,
                height: 18,
                borderRadius: 999,
                border: "none",
                background: "rgba(0,0,0,0.35)",
                color: textColor,
                cursor: "pointer",
                padding: 0,
                fontSize: 11,
                lineHeight: 1,
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              ×
            </button>
          )}
        </span>
      )}
      {/* Owner directive 2026-10-19 · pending-sticker preview chip ·
          rendered NAKED (no container border / no background fill)
          because the sticker tiles ship with their own decorative
          chrome (flames · "COOL" chips · chalkboard frames drawn to
          the edge of each cell). A chip rim would visually cut
          through that art. The × remove button overlays the image's
          top-right corner so the user can still unstage without a
          surrounding frame. */}
      {pendingSticker && (
        <span
          data-nex-se-composer-pending-sticker
          data-nex-se-composer-pending-sticker-slug={pendingSticker.slug}
          style={{
            position: "relative",
            display: "inline-flex",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <img
            src={pendingSticker.imageUrl}
            alt={pendingSticker.label || pendingSticker.slug}
            style={{
              height: 40,
              width: Math.round(40 * pendingSticker.aspectRatio),
              objectFit: "contain",
              display: "block",
            }}
          />
          {onClearPendingSticker && (
            <button
              type="button"
              aria-label="Remove staged sticker"
              onClick={onClearPendingSticker}
              style={{
                position: "absolute",
                top: -4,
                right: -4,
                width: 18,
                height: 18,
                borderRadius: 999,
                border: "1.5px solid #0B0F1A",
                background: "#FF3B30",
                color: "#FFFFFF",
                cursor: "pointer",
                padding: 0,
                fontSize: 11,
                fontWeight: 800,
                lineHeight: 1,
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
                zIndex: 1,
              }}
            >
              ×
            </button>
          )}
        </span>
      )}
      <input
        type="text"
        data-nex-se-composer-input
        value={value}
        disabled={disabled}
        /* Owner directive 2026-10-18 · when the shell wires the
           themed keypad it passes suppressNativeKeyboard · the input
           then runs read-only with inputMode="none" so iOS / Android /
           desktop keyboards never open · tapping the field fires
           onFocusInput which opens the JokerKeypad in theme colour. */
        readOnly={suppressNativeKeyboard || undefined}
        inputMode={suppressNativeKeyboard ? "none" : undefined}
        onChange={(e) => {
          if (suppressNativeKeyboard) return;
          onChange(e.target.value);
        }}
        onFocus={() => {
          setFocused(true);
          if (suppressNativeKeyboard) onFocusInput?.();
        }}
        onMouseDown={(e) => {
          if (!suppressNativeKeyboard) return;
          e.preventDefault();
          onFocusInput?.();
        }}
        onTouchStart={() => {
          if (suppressNativeKeyboard) onFocusInput?.();
        }}
        onClick={() => {
          if (suppressNativeKeyboard) onFocusInput?.();
        }}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (!disabled && armed) {
              onSend();
            }
          }
        }}
        placeholder={placeholder ?? "Say something…"}
        style={{
          ...t.inputStyle,
          paddingLeft: 6,
          paddingRight: 6,
          cursor: suppressNativeKeyboard ? "text" : undefined,
        }}
      />
      {/* Owner directive 2026-10-18 (refined) · send lives INSIDE the
          pill on the right · ALWAYS solid theme colour · when the
          input holds content (emoji / sticker / text) the button
          pulses with a slight glow beat so the user feels the
          "ready-to-send" state. Replaces the external
          ComposerSendButton that used to float right of the pill. */}
      <style>{`
        @keyframes nex-se-send-beat {
          0%, 100% {
            box-shadow: 0 0 0 0 ${c.primary}00;
          }
          50% {
            box-shadow: 0 0 0 6px ${c.primary}33, 0 0 14px 2px ${c.primary}66;
          }
        }
      `}</style>
      <button
        type="button"
        aria-label="Send message"
        data-nex-se-composer-send-inline
        data-nex-se-send-armed={armed ? "true" : "false"}
        disabled={disabled || !armed}
        onClick={() => {
          if (!disabled && armed) onSend();
        }}
        style={{
          flexShrink: 0,
          width: 32,
          height: 32,
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          border: "none",
          cursor: disabled || !armed ? "default" : "pointer",
          /* Solid theme colour regardless of armed state · the
             visual signal of "ready to send" is now the pulse,
             not a dimmed fill. */
          background: c.primary,
          color: textColor,
          /* Slight glow beat when input has content · 1600ms loop
             matches the sealed composer focus-animation cadence. */
          animation: armed
            ? "nex-se-send-beat 1600ms ease-in-out infinite"
            : undefined,
          transition: "box-shadow 180ms ease",
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

/* CameraIcon + ClipIcon retired 2026-10-19 · the camera + file-
   attach actions moved from the composer input footer to the lower-
   right 3-dot menu (FloatingCallActions in _standard-experience.tsx).
   Their SVG glyph source lives there now · see CameraCaptureIcon +
   FileAttachIcon. */
