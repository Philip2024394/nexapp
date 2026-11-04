"use client";

// src/components/nex-native/chat-chrome/chat-9001-pill.tsx
//
// NEX Chat 9001 bespoke composer pill · stand-alone reusable component.
// Owner directive 2026-11-04 later-same-day · "update all other
// contact cards with new chat window interface with 99901 footer
// and header".
// -----------------------------------------------------------------------------
// This file reproduces the exact bespoke pill JSX used by Chat 9001
// (/nex-native/free-chat) so every NEX chat surface can mount the
// same visual pill. Chat 9001's inline pill at
// src/app/nex-native/free-chat/_composer-client.tsx is the reference
// · this is a verbatim port into a reusable component.
//
// Shape (owner directive 2026-11-05):
//   [ pill( + button · input · orange send ) ]
//
// The outside-left `+` button and the emoji glyph are retired · the `+`
// moves INTO the pill's left slot where the emoji used to live, so the
// pill consolidates into a single visual unit. `onEmoji` is removed
// from the prop surface · theme-emoji entry lives behind the `+` sheet.
//
// Purely presentational · no state owned. Callers pass value/onChange/
// onSend/accentHex/onPlusAction/placeholder/etc.

import * as React from "react";
// Owner directive 2026-11-05 · sealed doctrine
// `feedback_nex_keypad_universal_text_rule.md` · EVERY text input in
// NEX must use the sealed NEX keypad with `forceKeypadActive={true}`.
// Replaces the previous bare <input> which was falling through to the
// OS keyboard on mobile.
import { NexInput } from "@/lib/nex-native/nex-keyboard/nex-input";

export interface Chat9001PillProps {
  readonly value: string;
  readonly onChange: (next: string) => void;
  readonly onSend: () => void;
  readonly placeholder?: string;
  readonly accentHex?: string;
  readonly armed?: boolean;
  readonly disabled?: boolean;
  readonly maxLength?: number;
  readonly onPlusAction?: () => void;
  readonly plusOpen?: boolean;
  readonly textareaDataAttr?: string;
}

const TEXT = "#F2F5F8";
const BORDER_FALLBACK = "rgba(0,175,255,0.42)";

export function Chat9001Pill({
  value,
  onChange,
  onSend,
  placeholder = "Say something…",
  accentHex,
  armed,
  disabled,
  maxLength = 4000,
  onPlusAction,
  plusOpen = false,
  textareaDataAttr,
}: Chat9001PillProps): React.JSX.Element {
  const accent = accentHex ?? "#00AFFF";
  const canSend = (armed ?? value.trim().length > 0) && !disabled;

  const dataAttrs: Record<string, string> = {};
  if (textareaDataAttr) dataAttrs[textareaDataAttr] = "true";

  return (
    <div
      data-nex-free-chat-composer
      style={{
        padding: "10px 12px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexShrink: 0,
        position: "relative",
      }}
    >
      <div
        data-nex-free-chat-composer-pill
        style={{
          position: "relative",
          flex: 1,
          minWidth: 0,
        }}
      >
        {/* Owner directive 2026-11-05 · the `+` button now lives INSIDE
            the pill where the emoji previously sat · consolidates
            composer chrome into one visual unit · rotates 45° when the
            attach sheet is open to echo the open/close affordance. */}
        {onPlusAction ? (
          <button
            type="button"
            onClick={onPlusAction}
            aria-label={plusOpen ? "Close attachments" : "Open attachments"}
            aria-expanded={plusOpen}
            data-nex-free-chat-composer-attach
            style={{
              position: "absolute",
              left: 4,
              top: "50%",
              transform: plusOpen
                ? "translateY(-50%) rotate(45deg)"
                : "translateY(-50%) rotate(0deg)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "rgba(2,9,20,0.6)",
              border: `1px solid ${accent}6B`,
              color: accent,
              fontSize: 20,
              fontWeight: 300,
              cursor: "pointer",
              padding: 0,
              lineHeight: 1,
              fontFamily: "inherit",
              transition: "transform 180ms ease, background 180ms ease",
            }}
          >
            +
          </button>
        ) : null}
        <NexInput
          value={value}
          onChange={onChange}
          onEnter={() => {
            if (canSend) onSend();
          }}
          accentColor={accent}
          forceKeypadActive={true}
          maxLength={maxLength}
          placeholder={placeholder}
          aria-label="Message"
          data-nex-free-chat-composer-input
          {...dataAttrs}
          style={{
            width: "100%",
            padding: "10px 50px 10px 48px",
            background: "rgba(2,9,20,0.6)",
            color: TEXT,
            fontSize: 14,
            border: `1px solid ${accent}6B`,
            borderRadius: 999,
            outline: "none",
            fontFamily: "inherit",
            cursor: "text",
            boxSizing: "border-box",
          }}
        />
        <button
          type="button"
          onClick={() => {
            if (canSend) onSend();
          }}
          aria-label="Send message"
          aria-disabled={!canSend}
          data-nex-free-chat-composer-send
          data-nex-free-chat-composer-send-active={canSend ? "true" : "false"}
          style={{
            position: "absolute",
            right: 4,
            top: "50%",
            transform: "translateY(-50%)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 30,
            height: 30,
            borderRadius: "50%",
            background: "#FF7200",
            color: "#1A0808",
            border: "none",
            cursor: canSend ? "pointer" : "default",
            opacity: 1,
            boxShadow: canSend
              ? `0 0 0 2px ${accent}55, 0 6px 18px -6px ${accent}, 0 2px 6px -2px #FF7200`
              : "0 2px 6px -2px #FF7200",
            transition: "box-shadow 180ms ease",
            padding: 0,
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden
          >
            <path d="M3 20l19-8L3 4v6l14 2-14 2v6z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
