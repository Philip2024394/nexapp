"use client";

// src/app/nex-native/manage/shop/intro/_save-button.tsx
//
// Stage 10 · item 15b · 2026-11-14 · owner-authorised build.
// -----------------------------------------------------------------------------
// Tiny client submit-button that preserves the sealed intro-page
// inline styling but adds a `useFormStatus()` pending state so the
// owner sees "Saving…" instead of staring at an unresponsive button.
//
// Kept inline-styled (not swapped for the Tailwind SubmitButton)
// because the intro page is sealed to its own look · a global swap
// would ripple visual regressions.

import * as React from "react";
import { useFormStatus } from "react-dom";

export function IntroSaveButton({
  accent,
  label = "Save intro",
  pendingLabel = "Saving…",
}: {
  readonly accent: string;
  readonly label?: string;
  readonly pendingLabel?: string;
}): React.JSX.Element {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending ? "true" : undefined}
      data-nex-shop-intro-save
      data-nex-shop-intro-save-pending={pending ? "true" : "false"}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        padding: "14px 16px",
        borderRadius: 14,
        background: pending ? "rgba(255, 114, 0, 0.55)" : accent,
        color: "#FFFFFF",
        border: "none",
        fontSize: 13,
        fontWeight: 800,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        cursor: pending ? "wait" : "pointer",
        boxShadow: "0 2px 8px rgba(255, 114, 0, 0.25)",
        fontFamily: "inherit",
      }}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
