"use client";

// src/app/nex-native/chat/peer/[accountId]/_translation-bubble-control.tsx
//
// Per-bubble React control rendered by ChatTranslationLayer.
// Owner-authorised 2026-11-17 · local verification only.
//
// Renders a tiny toggle icon in the top-right of the bubble. On click,
// uses the `useMessageTranslation` hook to fetch (once) and shows the
// translated text in the sibling slot. Toggling back hides the slot;
// the original body text is NEVER overwritten.
//
// Accessibility:
//   · `aria-pressed` reflects showing=translation vs original.
//   · `aria-label` swaps between "Show translation" / "Show original".
//   · Touch target ≥ 36×36. Keyboard focusable. Reduced-motion aware.
//
// This component does NOT animate flips, per directive ("avoid a 3D
// flip if it makes reading or accessibility worse"). We simply swap
// visibility of the translation slot.

import * as React from "react";
import { useMessageTranslation } from "@/lib/nex-native/translation/client/use-message-translation";

export interface BubbleTranslationControlProps {
  readonly accountId: string;
  readonly conversationId: string;
  readonly messageId: string;
  readonly contentVersion: string;
  readonly original: string;
  /** The DOM node holding the original plaintext · we DO NOT mutate it. */
  readonly bodyEl: HTMLElement;
  /** Sibling slot we render the translated text into · managed here. */
  readonly translationSlotEl: HTMLElement;
}

export function BubbleTranslationControl(
  props: BubbleTranslationControlProps,
): React.ReactElement | null {
  // The hook internally checks consent + per-conversation auto flag.
  // We do NOT pass `autoDisabled` here — doing so used `prefs` before
  // the hook returned it, which was a TDZ bug. Letting the hook own
  // the decision keeps a single source of truth.
  const { state, showing, toggle, manualTranslate, readingLang } =
    useMessageTranslation({
      accountId: props.accountId,
      conversationId: props.conversationId,
      messageId: props.messageId,
      contentVersion: props.contentVersion,
      original: props.original,
    });

  // Reflect translation into the sibling slot.
  React.useEffect(() => {
    const slot = props.translationSlotEl;
    if (!slot) return;
    if (state.kind === "ready" && showing === "translation") {
      slot.textContent = state.translation;
      slot.style.display = "block";
      slot.setAttribute("data-nex-msg-translation-label", "translated");
      slot.title = state.detectedSourceLanguage
        ? `Translated from ${state.detectedSourceLanguage}`
        : "Translated";
    } else {
      slot.style.display = "none";
    }
  }, [state, showing, props.translationSlotEl]);

  // Nothing to show if no reading language configured.
  if (!readingLang) return null;

  const isLoading = state.kind === "loading";
  const isReady = state.kind === "ready";
  const unavailableReason =
    state.kind === "unavailable" ? state.reason : null;

  const label =
    showing === "translation" && isReady
      ? "Show original"
      : isReady
        ? "Show translation"
        : isLoading
          ? "Translating…"
          : unavailableReason
            ? "Translate (unavailable)"
            : "Translate";

  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // If we are in an unavailable state and the user presses the
    // button, treat it as a manual deliberate retry.
    if (unavailableReason && !isReady) {
      void manualTranslate();
      return;
    }
    void toggle();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick(e as unknown as React.MouseEvent);
    }
  };

  const reducedMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <button
      type="button"
      onClick={onClick}
      onKeyDown={onKeyDown}
      aria-label={label}
      aria-pressed={showing === "translation" && isReady}
      data-nex-translation-toggle={props.messageId}
      style={{
        all: "unset",
        boxSizing: "border-box",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 36,
        height: 36,
        minWidth: 36,
        minHeight: 36,
        borderRadius: 999,
        background: isReady && showing === "translation" ? "rgba(78,107,30,0.14)" : "rgba(0,0,0,0.06)",
        color: isReady && showing === "translation" ? "#4E6B1E" : "#6E6756",
        cursor: "pointer",
        transition: reducedMotion ? "none" : "background 150ms ease",
        fontSize: 16,
        lineHeight: 1,
      }}
      title={label}
    >
      <span aria-hidden="true">{isLoading ? "…" : "🌐"}</span>
    </button>
  );
}

