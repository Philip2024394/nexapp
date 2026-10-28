"use client";

// src/app/nex-native/create/_close-button.tsx
//
// Owner directive 2026-10-28 · "what would you like to create should
// have round button for close with x top right side."
//
// Small round × button that fires router.back() so the user returns to
// wherever they came from (Library Create tile → viewer, direct URL →
// previous page). Tiny client component so the parent page can stay a
// server component (metadata still SSR-rendered).

import * as React from "react";
import { useRouter } from "next/navigation";

export function CloseButton(): React.JSX.Element {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.back()}
      aria-label="Close"
      data-nex-create-close
      style={{
        position: "absolute",
        top: 10,
        right: 10,
        width: 36,
        height: 36,
        borderRadius: "50%",
        background: "linear-gradient(135deg, #152646 0%, #1E3A6E 100%)",
        border: "none",
        color: "#FFFFFF",
        fontSize: 18,
        fontWeight: 700,
        lineHeight: 1,
        cursor: "pointer",
        fontFamily: "inherit",
        boxShadow: "0 2px 6px -2px rgba(16, 32, 51, 0.4)",
        WebkitTapHighlightColor: "transparent",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2,
      }}
    >
      ×
    </button>
  );
}
