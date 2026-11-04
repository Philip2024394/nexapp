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
// Shape (restored 2026-11-05 later-same-day iter 5 to match the sealed
// /free-chat inline reference pill):
//   [ + button outside pill | pill(emoji PNG · input · orange send) ]
//
// The outside-left `+` button and the 3D emoji glyph are reinstated.
// `onEmoji` prop restored so callers can open their emoji picker
// (theme-emoji picker or the universal keypad's emoji plane).
//
// Purely presentational · no state owned. Callers pass value/onChange/
// onSend/accentHex/onPlusAction/onEmoji/placeholder/etc.

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
  readonly onEmoji?: () => void;
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
  onEmoji,
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
      {/* Owner directive 2026-11-05 later-same-day iter 5 · `+` button
          restored OUTSIDE the pill on the left · solid black fill to
          match the lower 3-dot FAB and header buttons. */}
      {onPlusAction ? (
        <button
          type="button"
          onClick={onPlusAction}
          aria-label={plusOpen ? "Close attachments" : "Open attachments"}
          aria-expanded={plusOpen}
          data-nex-free-chat-composer-attach
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "#000000",
            border: "1px solid rgba(255, 255, 255, 0.14)",
            color: "#FFFFFF",
            fontSize: 20,
            fontWeight: 300,
            cursor: "pointer",
            flexShrink: 0,
            padding: 0,
            lineHeight: 1,
            fontFamily: "inherit",
            transition: "transform 180ms ease, background 180ms ease",
            transform: plusOpen ? "rotate(45deg)" : "rotate(0deg)",
          }}
        >
          +
        </button>
      ) : null}

      <div
        data-nex-free-chat-composer-pill
        style={{
          position: "relative",
          flex: 1,
          minWidth: 0,
        }}
      >
        {/* Owner directive 2026-11-05 later-same-day iter 5 · 3D emoji
            PNG restored inside the pill on the left · matches the
            sealed Chat 9001 inline composer shape exactly. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/nex-free-chat/composer-emoji.png"
          alt=""
          aria-hidden
          data-nex-free-chat-composer-emoji
          onClick={onEmoji}
          style={{
            position: "absolute",
            left: 6,
            top: "50%",
            transform: "translateY(-50%)",
            width: 32,
            height: 32,
            objectFit: "contain",
            userSelect: "none",
            cursor: onEmoji ? "pointer" : "default",
            pointerEvents: onEmoji ? "auto" : "none",
            zIndex: 1,
          }}
        />
        {/* Owner directive 2026-11-05 iter 19 · do NOT forward the
            cyan default `accent` as `accentColor` · that override was
            winning against Ireland's sealed WORLD_KEYPAD_ACCENT
            (#FF7200 orange) emitted by _world-stylesheet.tsx. Only
            forward when the caller passed an EXPLICIT accentHex. */}
        <NexInput
          value={value}
          onChange={onChange}
          onEnter={() => {
            if (canSend) onSend();
          }}
          {...(accentHex ? { accentColor: accentHex } : {})}
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
