"use client";

// src/app/nex-native/profile/[handle]/_profile-close-button.tsx
//
// Owner directive 2026-11-01: "when user selects the profile image of
// the person and their profile page opens the bottom footer center
// should have close button that will return user back to page before
// they selected the user profile image to view their profile".
//
// Fixed-position close button anchored at the bottom-centre of the
// profile viewport. Tap routes to `router.back()` so the viewer
// returns to whatever page launched the profile (feed slide, chat,
// contacts, etc.). The sealed `--nex-world-secondary` world token
// drives the pill colour so Ireland deployment serves Irish gold and
// Worldwide / Indonesia / future worlds keep their accent via the
// sealed CSS cascade. No prop · no state · pure client component.

import * as React from "react";
import { useRouter } from "next/navigation";

export function ProfileCloseButton(): React.JSX.Element {
  const router = useRouter();
  const onClose = React.useCallback((): void => {
    try {
      router.back();
    } catch {
      /* back nav may fail on direct-link visits · fallback to home */
      router.push("/nex-native");
    }
  }, [router]);

  return (
    <div
      data-nex-profile-close-mount
      aria-hidden={false}
      style={{
        position: "fixed",
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 60,
        pointerEvents: "auto",
      }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close profile · return to previous page"
        data-nex-profile-close-button
        style={{
          minWidth: 112,
          height: 42,
          padding: "0 22px",
          borderRadius: 999,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          background: "var(--nex-world-secondary, #00AFFF)",
          color: "#0A1526",
          border: "1px solid rgba(255, 255, 255, 0.22)",
          boxShadow:
            "0 2px 10px rgba(0, 0, 0, 0.4), 0 0 14px rgba(198, 161, 91, 0.35)",
          cursor: "pointer",
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 14,
          fontWeight: 900,
          letterSpacing: 0.3,
          lineHeight: 1,
        }}
      >
        <span aria-hidden style={{ fontSize: 15, lineHeight: 1 }}>
          ✕
        </span>
        Close
      </button>
    </div>
  );
}
