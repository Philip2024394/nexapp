"use client";

// src/app/nex-native/settings/profile/edit/_unlock-creator-banner.tsx
//
// Inline "Unlock Creator tools" card on the profile edit page.
// Owner directive 2026-11-04 · Phase U Option A.
//
// Non-blocking promotional card that routes to /creator/join when tapped.
// Dismissable per session via sessionStorage so it doesn't nag within
// the same visit. Returns null if already dismissed.

import { useEffect, useState } from "react";
import Link from "next/link";

const GOLD = "#C6A15B";
const EMERALD = "#123D2B";
const SAGE = "#AFC5B5";
const TEXT_PRIMARY = "#F2F5F8";
const BORDER_SOFT = "rgba(198, 161, 91, 0.35)";
const PANEL = "rgba(27, 81, 56, 0.55)";

const STORAGE_KEY = "nex-unlock-creator-banner-dismissed";

export function UnlockCreatorBanner(): React.ReactElement | null {
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const v = typeof window !== "undefined" ? sessionStorage.getItem(STORAGE_KEY) : null;
      setDismissed(v === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  if (dismissed === null || dismissed === true) return null;

  function onDismiss() {
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* non-fatal · just skips persistence */
    }
    setDismissed(true);
  }

  return (
    <section
      data-nex-unlock-creator-banner
      style={{
        margin: "6px 0",
        padding: "14px 16px",
        borderRadius: 14,
        background: PANEL,
        border: `2px solid ${BORDER_SOFT}`,
        boxShadow: `0 4px 14px ${GOLD}22`,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
        <span
          aria-hidden
          style={{
            fontSize: 22,
            lineHeight: 1,
            color: GOLD,
            flexShrink: 0,
          }}
        >
          ☘
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: TEXT_PRIMARY }}>
            Unlock Creator tools
          </span>
          <span style={{ fontSize: 12, color: SAGE, opacity: 0.9, lineHeight: 1.45 }}>
            Turn your presence into income · €4.99/month · 0% NEX fee
          </span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Link
          href="/nex-native/creator/join"
          style={{
            padding: "9px 14px",
            borderRadius: 999,
            background: GOLD,
            color: EMERALD,
            textDecoration: "none",
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          Learn more →
        </Link>
        <button
          type="button"
          onClick={onDismiss}
          style={{
            padding: "9px 14px",
            borderRadius: 999,
            background: "transparent",
            color: SAGE,
            border: "none",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.02em",
            cursor: "pointer",
          }}
        >
          Dismiss
        </button>
      </div>
    </section>
  );
}
