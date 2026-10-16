"use client";

// src/lib/nex-native/chat-chrome/chat-composer-pill.tsx
//
// Shared chat-composer pill primitive · the one place the "Joker look"
// (sealed PeerComposer aurora pill, 2026-09-27) is defined. Every chat
// surface that wants the canonical composer renders this component.
//
// Visual spec baked in:
//   · Row  · [ + | <prefix> | textarea | <suffix> | emoji | send ]
//   · Container · 44px minHeight, 14px radius, translucent navy bg,
//                 blur+saturate backdrop, theme-accent rim, soft glow
//   · Textarea · fontSize 16, lineHeight 1.35, 22-112px auto-grow
//   · Send button · 36px round, accent gradient, armed-state logic
//
// What the primitive OWNS:
//   container styles, + button, textarea, emoji button, send button,
//   accent rim + glow, maxLength, Enter-to-send keyboard.
//
// What the primitive LEAVES to callers (via slots):
//   paperclip attach, pending emoji chips, reply-to header,
//   attachment preview, server-action form wrapping, encryption.
//   These wrap the primitive instead of living inside it.

import * as React from "react";

const NEX_CYAN = "#009FEF";
const NEX_TEXT = "#F4F7FC";
const NEX_TEXT_MUTE = "#526B89";

export interface ChatComposerPillProps {
  /** Textarea value · controlled. */
  value: string;
  /** Textarea onChange · receives raw string. */
  onChange: (next: string) => void;
  /** Fired when Enter is pressed (without shift) OR the send button is
   *  tapped. Caller decides what sending means (encrypt, upload, POST…). */
  onSend: () => void | Promise<void>;
  /** Placeholder shown when the textarea is empty. */
  placeholder: string;

  /** Theme accent (hex) · paints send button, emoji dot, composer rim.
   *  Defaults to NEX cyan when omitted. */
  accentHex?: string;
  /** Override composer background. Defaults to translucent navy. */
  composerBg?: string;
  /** Optional custom send button image URL · when provided, renders the
   *  image inside the send button instead of the default paper-plane. */
  sendButtonImageUrl?: string | null;

  /** Send-in-flight flag · disables send button, dims cursor. */
  sending?: boolean;
  /** Blocks sending even when text is non-empty. */
  disabled?: boolean;
  /** Override the default "text is non-empty" check for the send button's
   *  armed state. Use when the caller allows sending with empty text
   *  (e.g. attachment-only or pending-emoji-only submissions in
   *  PeerComposer). Defaults to `value.trim().length > 0`. */
  armed?: boolean;
  /** Textarea maxLength · default 4000. */
  maxLength?: number;

  /** Fires when the pill's + button is tapped. Omit to hide +. */
  onPlusAction?: () => void;
  /** Fires when the emoji button is tapped. Omit to hide emoji button. */
  onEmoji?: () => void;

  /** Rendered inside the pill between + and the textarea. Use for the
   *  paperclip attachment button + any pending-emoji chip row. */
  prefixSlot?: React.ReactNode;
  /** Rendered inside the pill between the textarea and the emoji/send
   *  buttons. Use for inline per-message switches. */
  suffixSlot?: React.ReactNode;
  /** Rendered ABOVE the pill. Use for the reply-to banner + attachment
   *  preview thumbnails. */
  headerSlot?: React.ReactNode;
  /** Error text rendered below the pill. */
  errorText?: string;

  /** Attach a ref to the inner textarea (focus mgmt, selection, etc.). */
  textareaRef?: React.Ref<HTMLTextAreaElement>;
  /** Attach a ref to the inner send button · used by atmospheric FX
   *  (e.g. Joker bats burst) that need the send-button viewport pos. */
  sendButtonRef?: React.Ref<HTMLButtonElement>;
  /** Data attribute for test / integration hooks (e.g. typing clients). */
  textareaDataAttr?: string;
  /** When true, the native OS keyboard is suppressed via `readOnly` +
   *  `inputMode="none"` and tapping the textarea fires onFocusTextarea
   *  instead. Used by themes that supply their own custom keypad
   *  (e.g. Joker). Sealed 2026-10-12. */
  suppressNativeKeyboard?: boolean;
  /** Fires when the textarea gains focus · typically used alongside
   *  suppressNativeKeyboard to open a custom keypad. */
  onFocusTextarea?: () => void;
}

export function ChatComposerPill(
  props: ChatComposerPillProps,
): React.JSX.Element {
  const accent = props.accentHex ?? NEX_CYAN;
  const maxLength = props.maxLength ?? 4000;
  const bg = props.composerBg ?? "rgba(12,32,58,0.62)";
  const rim = toRgba(accent, 0.85);
  const glow = toRgba(accent, 0.18);

  const defaultArmed = props.value.trim().length > 0;
  const armed = props.armed ?? defaultArmed;
  const canSend = armed && !props.sending && !props.disabled;

  const internalRef = React.useRef<HTMLTextAreaElement | null>(null);
  const setRef = (el: HTMLTextAreaElement | null) => {
    internalRef.current = el;
    if (!props.textareaRef) return;
    if (typeof props.textareaRef === "function") props.textareaRef(el);
    else
      (props.textareaRef as React.MutableRefObject<HTMLTextAreaElement | null>).current =
        el;
  };

  // Auto-grow the textarea with the content, bounded by max-height.
  React.useEffect(() => {
    const el = internalRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.min(el.scrollHeight, 112) + "px";
  }, [props.value]);

  const extraAttrs: Record<string, string> = {};
  if (props.textareaDataAttr) extraAttrs[props.textareaDataAttr] = "";

  return (
    <div data-nex-chat-composer-pill>
      {props.headerSlot}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          minHeight: 44,
          padding: "4px 6px",
          borderRadius: 14,
          background: bg,
          backdropFilter: "blur(24px) saturate(1.2)",
          WebkitBackdropFilter: "blur(24px) saturate(1.2)",
          border: `1px solid ${rim}`,
          boxShadow: `0 0 14px ${glow}, 0 6px 20px rgba(0,0,0,0.45)`,
        }}
      >
        {props.onPlusAction && (
          <PlusButton onClick={props.onPlusAction} accent={accent} />
        )}
        {props.prefixSlot}

        <textarea
          ref={setRef}
          maxLength={maxLength}
          placeholder={props.placeholder}
          rows={1}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (canSend) void props.onSend();
            }
          }}
          onFocus={() => {
            if (props.suppressNativeKeyboard) props.onFocusTextarea?.();
          }}
          onMouseDown={(e) => {
            if (!props.suppressNativeKeyboard) return;
            e.preventDefault();
            props.onFocusTextarea?.();
          }}
          onTouchStart={() => {
            if (props.suppressNativeKeyboard) props.onFocusTextarea?.();
          }}
          disabled={props.disabled}
          readOnly={props.suppressNativeKeyboard}
          inputMode={props.suppressNativeKeyboard ? "none" : undefined}
          {...extraAttrs}
          style={{
            flex: 1,
            width: "100%",
            minHeight: 22,
            maxHeight: 112,
            padding: "0 6px",
            background: "transparent",
            color: NEX_TEXT,
            border: "none",
            outline: "none",
            fontSize: 16,
            lineHeight: 1.35,
            fontFamily: "inherit",
            resize: "none",
            overflow: "auto",
            cursor: props.suppressNativeKeyboard ? "text" : undefined,
          }}
        />

        {props.suffixSlot}
        {props.onEmoji && <EmojiButton onClick={props.onEmoji} accent={accent} />}
        <SendButton
          ref={props.sendButtonRef}
          onClick={() => void props.onSend()}
          armed={canSend}
          sending={!!props.sending}
          accent={accent}
          imageUrl={props.sendButtonImageUrl ?? null}
        />
      </div>

      {props.errorText && (
        <div
          data-nex-chat-composer-error
          style={{
            marginTop: 6,
            padding: "0 12px",
            fontSize: 12,
            color: "#F59E0B",
            textAlign: "center",
          }}
        >
          {props.errorText}
        </div>
      )}
    </div>
  );
}

/* ──────────────── Inner buttons · match sealed PeerComposer ─────── */

function PlusButton({
  onClick,
  accent,
}: {
  onClick: () => void;
  accent: string;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="More actions"
      title="More actions"
      style={{
        width: 32,
        height: 32,
        borderRadius: "50%",
        background: "rgba(255,255,255,0.06)",
        border: `1px solid ${toRgba(accent, 0.4)}`,
        color: NEX_TEXT,
        fontSize: 20,
        lineHeight: 1,
        cursor: "pointer",
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
        padding: 0,
      }}
    >
      +
    </button>
  );
}

function EmojiButton({
  onClick,
  accent,
}: {
  onClick: () => void;
  accent: string;
}): React.JSX.Element {
  const glow = toRgba(accent, 0.55);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open emoji picker"
      title="Emoji"
      style={{
        width: 32,
        height: 32,
        borderRadius: "50%",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
        padding: 0,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: accent,
          boxShadow: `0 0 10px ${glow}`,
        }}
      />
    </button>
  );
}

const SendButton = React.forwardRef<
  HTMLButtonElement,
  {
    onClick: () => void;
    armed: boolean;
    sending: boolean;
    accent: string;
    imageUrl: string | null;
  }
>(function SendButton(
  { onClick, armed, sending, accent, imageUrl },
  ref,
): React.JSX.Element {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={!armed}
      aria-label="Send"
      title="Send"
      style={{
        width: 36,
        height: 36,
        borderRadius: "50%",
        background: armed
          ? `linear-gradient(135deg, ${accent}, ${toRgba(accent, 0.75)})`
          : "rgba(255,255,255,0.08)",
        color: armed ? "#0B0F1A" : NEX_TEXT_MUTE,
        border: "none",
        cursor: armed ? "pointer" : "default",
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
        padding: 0,
        marginLeft: 4,
        boxShadow: armed
          ? `0 6px 18px ${toRgba(accent, 0.4)}`
          : "none",
        transition: "background 180ms ease, box-shadow 180ms ease",
      }}
    >
      {sending ? (
        <span style={{ fontSize: 16, fontWeight: 700 }}>…</span>
      ) : imageUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={imageUrl}
          alt="Send"
          width={22}
          height={22}
          style={{ width: 22, height: 22, objectFit: "contain" }}
        />
      ) : (
        <SendGlyph />
      )}
    </button>
  );
});

function SendGlyph(): React.JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

/* ──────────────── Helpers ──────────────────────────────────────── */

function toRgba(hex: string, alpha: number): string {
  const clean = hex.replace(/^#/, "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return `rgba(0,159,239,${alpha})`;
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  return `rgba(${r},${g},${b},${alpha})`;
}
