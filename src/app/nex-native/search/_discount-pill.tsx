// src/app/nex-native/search/_discount-pill.tsx
//
// Single-slot top-right discount pill.
// ------------------------------------
// Replaces the 3-stacked promo circles with ONE small pill overlaid
// at the top-right of the cover image. Shows the discount percent
// (e.g. `20% OFF` or `-20%`) and tap-opens a modal with the full
// promo details + expiry countdown.
//
// Honest-null:
//   · no active promo on position=1 → component renders nothing
//   · promo expired (expiresAt ≤ now) → not rendered (the server
//     filter should already have dropped it, this is a client-side
//     safety net)
//   · title doesn't contain a percent → fall back to the title text
//     itself (e.g. "Buy 1 Get 1" shown verbatim)

"use client";

import { useState } from "react";
import type { DiscoverCardPromo } from "@/lib/nex-native/discover-card-context";

const NEX = {
  bg: "#0A1120",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textSoft: "#6B82A5",
  orange: "#FF7200",
  border: "rgba(255,255,255,0.1)",
  borderSoft: "rgba(255,255,255,0.06)",
};

export function DiscountPill({
  promos,
  businessName,
}: {
  readonly promos: readonly DiscoverCardPromo[];
  readonly businessName: string;
}): React.JSX.Element | null {
  const [open, setOpen] = useState<boolean>(false);
  const primary = pickPrimary(promos);
  if (!primary) return null;

  const percent = extractDiscount(primary.title);
  const label = percent ? `${percent} OFF` : primary.title.slice(0, 24);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Promo · ${primary.title}`}
        title={primary.title}
        data-nex-discount-pill
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          padding: "5px 10px",
          borderRadius: 999,
          // Sealed 2026-10-13 · the discount pill is always NEX
          // orange · no white rim · promo.backgroundHex still accents
          // the sheet when the pill is tapped so the owner's picked
          // colour isn't ignored, just not shown on the card chrome.
          background: NEX.orange,
          color: "#FFFFFF",
          border: "none",
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.02em",
          cursor: "pointer",
          boxShadow: "0 4px 10px rgba(255,114,0,0.45)",
          whiteSpace: "nowrap",
          zIndex: 2,
          lineHeight: 1,
        }}
      >
        {label}
      </button>

      {open ? (
        <DiscountSheet
          promo={primary}
          businessName={businessName}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

/** Prefer position=1 (the daily / primary slot); fall back to any
 *  non-expired promo so a business with only slot 2 or 3 populated
 *  still surfaces something. */
function pickPrimary(
  promos: readonly DiscoverCardPromo[],
): DiscoverCardPromo | null {
  if (promos.length === 0) return null;
  const now = Date.now();
  const live = promos.filter((p) => {
    const t = new Date(p.expiresAt).getTime();
    return Number.isFinite(t) && t > now;
  });
  if (live.length === 0) return null;
  return live.find((p) => p.position === 1) ?? live[0];
}

function extractDiscount(title: string): string | null {
  const m = /(\d{1,2}%)/.exec(title);
  return m ? m[1] : null;
}

function DiscountSheet({
  promo,
  businessName,
  onClose,
}: {
  readonly promo: DiscoverCardPromo;
  readonly businessName: string;
  readonly onClose: () => void;
}): React.JSX.Element {
  const bg = promo.backgroundHex ?? "#E11D48";
  const countdown = formatExpiryCountdown(promo.expiresAt);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="nex-discount-sheet-title"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 160,
        background: "rgba(2,9,20,0.78)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 420,
          background: NEX.bg,
          borderRadius: 20,
          border: `1px solid ${bg}66`,
          color: NEX.text,
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
          maxHeight: "85dvh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            position: "relative",
            aspectRatio: "16 / 9",
            background: bg,
            overflow: "hidden",
          }}
        >
          {promo.imageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={promo.imageUrl}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          ) : (
            <div
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                display: "grid",
                placeItems: "center",
                color: "#FFFFFF",
                fontSize: 48,
                fontWeight: 800,
                opacity: 0.75,
              }}
            >
              {promo.title.slice(0, 1).toUpperCase()}
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              width: 32,
              height: 32,
              borderRadius: 999,
              border: `1px solid rgba(255,255,255,0.3)`,
              background: "rgba(0,0,0,0.4)",
              color: "#FFFFFF",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: "18px 20px 20px" }}>
          <div
            style={{
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.14em",
              color: bg,
              fontWeight: 700,
            }}
          >
            Promo from {businessName}
          </div>
          <h2
            id="nex-discount-sheet-title"
            style={{
              margin: "4px 0 0",
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: "-0.015em",
              color: NEX.text,
              lineHeight: 1.25,
            }}
          >
            {promo.title}
          </h2>
          {promo.description ? (
            <p
              style={{
                margin: "10px 0 0",
                fontSize: 13,
                color: NEX.textDim,
                lineHeight: 1.6,
              }}
            >
              {promo.description}
            </p>
          ) : null}
          <div
            style={{
              marginTop: 14,
              padding: "8px 12px",
              background: `${bg}22`,
              border: `1px solid ${bg}66`,
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 700,
              color: NEX.text,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            ⏱ {countdown}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatExpiryCountdown(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "Expiry unknown";
  const diffMs = then - now;
  if (diffMs <= 0) return "Expired";
  const days = Math.floor(diffMs / 86_400_000);
  const hours = Math.floor((diffMs % 86_400_000) / 3_600_000);
  if (days >= 2) return `Ends in ${days} days`;
  if (days === 1) return hours > 0 ? `Ends in 1 day, ${hours}h` : "Ends in 1 day";
  if (hours >= 1) return `Ends in ${hours}h`;
  const minutes = Math.floor(diffMs / 60_000);
  return `Ends in ${Math.max(1, minutes)} min`;
}
