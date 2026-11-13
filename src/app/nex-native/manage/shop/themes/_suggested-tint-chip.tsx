"use client";

// src/app/nex-native/manage/shop/themes/_suggested-tint-chip.tsx
//
// Owner directive 2026-11-12 · dynamic theme-accent suggestion.
// -----------------------------------------------------------------------
// When the shop owner has a background image, this chip extracts the
// image's dominant colour client-side and offers them "Apply as theme
// accent" — a one-tap path to make the theme colour match the image.
// Accepted hex writes through the sealed `applyShopTintAction` →
// `shop_cover_tint_hex` path so the DB-wired rule is honoured.
//
// Hidden when:
//   · No image URL (nothing to extract from)
//   · No businessId (shop not provisioned yet)
//   · Extraction failed / image tainted / no non-neutral pixels
//   · Suggested hex matches current tint already
//
// Re-runs extraction when the image URL changes.

import * as React from "react";
import { extractDominantColor } from "@/lib/nex-native/color-extraction/dominant-color";
import { applyShopTintAction } from "./_actions";

interface Props {
  readonly businessId: string | null;
  readonly imageUrl: string | null;
  readonly currentTintHex: string | null;
}

export function SuggestedTintChip({
  businessId,
  imageUrl,
  currentTintHex,
}: Props): React.ReactElement | null {
  const [suggested, setSuggested] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<
    { kind: "idle" } | { kind: "applying" } | { kind: "ok" } | { kind: "error"; message: string }
  >({ kind: "idle" });

  React.useEffect(() => {
    setStatus({ kind: "idle" });
    setSuggested(null);
    if (!imageUrl) return;
    let cancelled = false;
    void extractDominantColor(imageUrl).then((hex) => {
      if (cancelled) return;
      setSuggested(hex);
    });
    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  // Nothing to show
  if (!businessId || !imageUrl || !suggested) return null;
  // Already the active tint · don't nag
  if (currentTintHex && currentTintHex.toUpperCase() === suggested.toUpperCase()) return null;

  async function apply() {
    if (!businessId || !suggested) return;
    setStatus({ kind: "applying" });
    try {
      const res = await applyShopTintAction(businessId, suggested);
      if (!res.ok) {
        setStatus({ kind: "error", message: res.error });
        return;
      }
      setStatus({ kind: "ok" });
    } catch (e) {
      setStatus({ kind: "error", message: (e as Error).message });
    }
  }

  return (
    <section
      aria-label="Suggested theme colour from your background image"
      data-nex-suggested-tint
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 10px 8px 12px",
        borderRadius: 999,
        background: "rgba(0, 0, 0, 0.35)",
        border: "1px solid rgba(255, 255, 255, 0.18)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        color: "#F2F5F8",
        fontSize: 11.5,
        fontWeight: 600,
        letterSpacing: "0.02em",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: suggested,
          border: "1px solid rgba(255,255,255,0.4)",
          flexShrink: 0,
        }}
      />
      <span style={{ flex: 1, minWidth: 0 }}>
        {status.kind === "ok"
          ? "Theme updated ✓"
          : status.kind === "error"
            ? "Couldn't apply · try again"
            : "Theme colour from your background"}
      </span>
      {status.kind === "ok" ? null : (
        <button
          type="button"
          onClick={apply}
          disabled={status.kind === "applying"}
          style={{
            padding: "6px 12px",
            borderRadius: 999,
            background: suggested,
            color: pickInkOn(suggested),
            border: "none",
            fontSize: 10.5,
            fontWeight: 900,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            cursor: status.kind === "applying" ? "wait" : "pointer",
            opacity: status.kind === "applying" ? 0.7 : 1,
          }}
        >
          {status.kind === "applying" ? "Applying…" : "Apply"}
        </button>
      )}
    </section>
  );
}

/** Pick dark or light ink so the Apply label stays legible on the
 *  suggested swatch. Simple perceptual-luminance threshold. */
function pickInkOn(hex: string): string {
  const m = /^#([0-9A-F]{6})$/i.exec(hex);
  if (!m) return "#000000";
  const n = parseInt(m[1]!, 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const L = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return L > 0.6 ? "#1A120A" : "#FFFFFF";
}
