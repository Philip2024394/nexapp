"use client";

// src/lib/nex-native/nex-keyboard/nex-textarea.tsx
//
// Owner-authorised 2026-10-24 · Phase 0.3 · shared wrapper around
// <textarea> that mounts the sealed JokerKeypad in `multiline` mode
// instead of the OS virtual keyboard on supported mobile viewports.
//
// Behaviour parallels NexInput · the only differences:
//   · Renders <textarea> instead of <input>
//   · JokerKeypad opens with `mode="multiline"` so Enter inserts
//     `\n` at the cursor rather than closing the keypad
//   · The caller supplies their own Send / Done affordance OUTSIDE
//     the keypad (the keypad's X close button still dismisses the
//     keypad on demand)
//
// Everything else (lazy-mount, SSR-safe activation decision, OS
// keyboard suppression chain, data-nex-keypad="true" sentinel) is
// identical to NexInput. See that file's header for the sealed
// design doctrine.

import * as React from "react";
import { JokerKeypad } from "@/app/nex-native/chat-standard/_joker-keypad";
import { isNexKeypadSupported } from "./is-nex-keypad-supported";

/* Phase 0 corrective patch C 2026-10-24 · isomorphic layout effect ·
   see nex-input.tsx for the sealed rationale. */
const useIsomorphicLayoutEffect: typeof React.useLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

type NativeTextareaProps = Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "onChange" | "onKeyDown"
>;

export interface NexTextareaProps extends NativeTextareaProps {
  readonly value: string;
  readonly onChange: (next: string) => void;
  /** Theme accent for the JokerKeypad recolour. Defaults to NEX
   *  cyan `#00AFFF`. */
  readonly accentColor?: string;
  /** Restrict the keypad planes available. See NexInput. */
  readonly planes?: ReadonlyArray<"letters" | "numbers" | "symbols" | "emoji" | "sticker" | "giphy">;
  readonly initialPlane?: "letters" | "emoji" | "sticker";
  /** Testing / sandbox override · see NexInput. */
  readonly forceKeypadActive?: boolean;
  /** Owner-authorised 2026-10-24 · which JokerKeypad behaviour the
   *  textarea should mount with. Default `"multiline"` preserves the
   *  historical Phase 0.3 behaviour byte-equivalent for every existing
   *  caller · Enter + ▶ insert `\n` at the cursor.
   *
   *  Pass `"chat"` for live-feed-style posting (NEX Live viewer
   *  footer, chat composer, etc.): Enter + ▶ fire `onSend` and close
   *  the keypad. Without this flag, the keypad's visible send glyph
   *  posts nothing — see the Live keypad audit 2026-10-24. */
  readonly keypadMode?: "chat" | "multiline";
  /** Owner-authorised 2026-10-24 · invoked by the keypad's ▶ / ↵
   *  when `keypadMode === "chat"`. Receives no arguments · the caller
   *  reads its own `value` state to perform the post. No-op by
   *  default so multiline callers keep working with no change. */
  readonly onSend?: () => void;
}

export function NexTextarea({
  value,
  onChange,
  accentColor,
  planes,
  initialPlane,
  forceKeypadActive,
  keypadMode,
  onSend,
  maxLength,
  ...nativeProps
}: NexTextareaProps): React.JSX.Element {
  const resolvedMode: "chat" | "multiline" = keypadMode ?? "multiline";
  /* Phase 0 corrective patch C 2026-10-24 · hydration-safe activation ·
     see nex-input.tsx for the sealed rationale. Initial state matches
     the SSR default (false); the real decision commits in
     useIsomorphicLayoutEffect BEFORE first paint on the client. */
  const [keypadActive, setKeypadActive] = React.useState<boolean>(() => {
    if (typeof forceKeypadActive === "boolean") return forceKeypadActive;
    return false;
  });
  useIsomorphicLayoutEffect(() => {
    if (typeof forceKeypadActive === "boolean") {
      setKeypadActive(forceKeypadActive);
      return;
    }
    setKeypadActive(isNexKeypadSupported());
  }, [forceKeypadActive]);

  const [keypadOpen, setKeypadOpen] = React.useState(false);
  const [keypadEverOpened, setKeypadEverOpened] = React.useState(false);

  const openKeypad = (): void => {
    if (!keypadActive) return;
    setKeypadEverOpened(true);
    setKeypadOpen(true);
  };
  const closeKeypad = (): void => setKeypadOpen(false);

  // Owner directive 2026-10-25 · ROOT-CAUSE FIX for the recurring
  // mobile text-field overflow. Default to `box-sizing: border-box`
  // so a caller's `style={{ width: "100%", padding: "6px 40px 6px 45px" }}`
  // keeps the OUTER box at 100% of its parent instead of adding
  // padding + border on top of the content width (content-box is the
  // native textarea default). Caller's own `style.boxSizing` still
  // wins because the caller's style is spread AFTER this default.
  // This single change fixes every NexTextarea call-site at once.
  const mergedStyle: React.CSSProperties = {
    boxSizing: "border-box",
    ...(nativeProps.style ?? {}),
  };
  return (
    <>
      <textarea
        {...nativeProps}
        style={mergedStyle}
        data-nex-keypad={keypadActive ? "true" : "false"}
        value={value}
        maxLength={maxLength}
        inputMode={keypadActive ? "none" : nativeProps.inputMode}
        readOnly={keypadActive || nativeProps.readOnly}
        onChange={(e) => {
          if (keypadActive) return;
          onChange(e.target.value);
        }}
        onFocus={(e) => {
          if (keypadActive) openKeypad();
          nativeProps.onFocus?.(e);
        }}
        onMouseDown={(e) => {
          if (keypadActive) {
            e.preventDefault();
            openKeypad();
          }
          nativeProps.onMouseDown?.(e);
        }}
        onTouchStart={(e) => {
          if (keypadActive) openKeypad();
          nativeProps.onTouchStart?.(e);
        }}
        onClick={(e) => {
          if (keypadActive) openKeypad();
          nativeProps.onClick?.(e);
        }}
      />
      {keypadActive && keypadEverOpened ? (
        <JokerKeypad
          open={keypadOpen}
          value={value}
          onChange={(next) => {
            if (maxLength !== undefined && next.length > maxLength) {
              onChange(next.slice(0, maxLength));
              return;
            }
            onChange(next);
          }}
          onSend={() => {
            // Owner-authorised 2026-10-24 · routes the keypad's ▶ / ↵
            // to the caller's `onSend` in chat mode so the comment
            // actually posts. Multiline mode never calls onSend
            // (handleEnterKey inserts \n instead) · the fallback stays
            // honest no-op there.
            onSend?.();
          }}
          onClose={closeKeypad}
          mode={resolvedMode}
          planes={planes}
          initialPlane={initialPlane}
          accentColor={accentColor ?? "#00AFFF"}
          maxLength={maxLength}
        />
      ) : null}
    </>
  );
}
