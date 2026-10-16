// src/app/nex-native/search/_promo-bubbles.tsx
//
// Promo bubble stack · right edge of the cover image.
// ----------------------------------------------------
// Up to 3 small round circles stacked vertically on the right side of
// the cover. Each one represents an active promo for the business
// (migration 159 · nex_business_promo). Tap a circle to open a
// centre modal with the full promo banner, description, and an
// expiry countdown.
//
// Honest-null:
//   · promos array empty → component renders nothing (no stack, no
//     slot reserved on the cover · the price pill area stays clean)
//   · promo image_url null → circle shows the title's first letter
//     over a per-promo backgroundHex (or NEX cyan fallback)
//
// Positioning:
//   · First circle at top: 56 (clear of the price pill at top: 10)
//   · 4px gap between circles
//   · Right-aligned to the cover edge with 10px gutter

"use client";

import { useState } from "react";
import type { DiscoverCardPromo } from "@/lib/nex-native/discover-card-context";

const NEX = {
  bg: "#020914",
  panel: "#07152A",
  panelHi: "#0E2140",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMuted: "#8BA9D1",
  orange: "#FF7200",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0,175,255,0.45)",
  border: "rgba(255,255,255,0.1)",
};

// Bumped up 2026-10-13 per founder · "larger" circles. Still a
// touch-friendly 52px (iOS HIG min is 44pt) with 8px gap for clear
// tap-zone separation.
//
// STACK_TOP lowered to 16 2026-10-13 ("move circles up little") so
// the top circle starts near the top edge of the cover instead of
// sitting under the price-pill zone. Fitness math: STACK_TOP (16) +
// 3×CIRCLE_SIZE (52) + 2×CIRCLE_GAP (8) = 188. On a standard iPhone
// 390px shell the cover is ~220px tall → fits with 32px breathing
// room. Overlap with the price pill column is accepted · the promo
// stack has zIndex:2 so it renders above cleanly.
const CIRCLE_SIZE = 52;
const CIRCLE_GAP = 8;
const STACK_TOP = 16;

export function PromoBubbleStack({
  promos,
  businessName,
}: {
  readonly promos: readonly DiscoverCardPromo[];
  readonly businessName: string;
}): React.JSX.Element | null {
  const [openId, setOpenId] = useState<string | null>(null);
  const activePromos = promos.slice(0, 3);
  if (activePromos.length === 0) return null;
  const openPromo = activePromos.find((p) => p.id === openId) ?? null;
  return (
    <>
      <div
        style={{
          position: "absolute",
          top: STACK_TOP,
          right: 10,
          display: "flex",
          flexDirection: "column",
          gap: CIRCLE_GAP,
          zIndex: 2,
        }}
      >
        {activePromos.map((promo) => {
          return (
            <button
              key={promo.id}
              type="button"
              onClick={() => setOpenId(promo.id)}
              aria-label={`Promo · ${promo.title}`}
              title={promo.title}
              data-nex-promo-bubble
              style={{
                width: CIRCLE_SIZE,
                height: CIRCLE_SIZE,
                borderRadius: "50%",
                // Frosted glass · semi-transparent dark fill +
                // backdrop-blur so the cover image softly diffuses
                // through the circle. The % stays legible without
                // fighting the cover art. 2px white rim keeps the
                // shape visible on any background.
                border: `2px solid rgba(255,255,255,0.9)`,
                background: "rgba(2,9,20,0.35)",
                backdropFilter: "blur(10px) saturate(1.4)",
                WebkitBackdropFilter: "blur(10px) saturate(1.4)",
                padding: 0,
                cursor: "pointer",
                overflow: "hidden",
                position: "relative",
                boxShadow:
                  "0 4px 10px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.25) inset",
                // Subtle "life" breathe · staggered per slot so the
                // stack doesn't pulse in lockstep. Keyframe defined
                // once at the page-level style block in page.tsx.
                animation: "nex-promo-pulse 1.6s ease-in-out infinite",
                animationDelay: `${(promo.position - 1) * 0.4}s`,
                willChange: "transform",
              }}
            >
              {promo.imageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={promo.imageUrl}
                  alt=""
                  loading="lazy"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              ) : (
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "grid",
                    placeItems: "center",
                    color: "#FFFFFF",
                    fontSize: 20,
                    fontWeight: 800,
                    letterSpacing: "0.02em",
                    textShadow: "0 1px 2px rgba(0,0,0,0.4)",
                  }}
                >
                  {promo.title.slice(0, 1).toUpperCase()}
                </span>
              )}
              {/* Discount sticker removed · the N% now reads as the
                  primary visual inside the circle itself (sealed
                  2026-10-13 per founder: "percent in center"). */}
            </button>
          );
        })}
      </div>

      {openPromo ? (
        <PromoSheet
          promo={openPromo}
          businessName={businessName}
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </>
  );
}

function PromoSheet({
  promo,
  businessName,
  onClose,
}: {
  readonly promo: DiscoverCardPromo;
  readonly businessName: string;
  readonly onClose: () => void;
}): React.JSX.Element {
  const bg = promo.backgroundHex ?? NEX.orange;
  const countdown = formatExpiryCountdown(promo.expiresAt);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="nex-promo-sheet-title"
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
          maxWidth: 440,
          background: NEX.panel,
          borderRadius: 20,
          border: `1px solid ${bg}`,
          color: NEX.text,
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
          maxHeight: "85dvh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Banner · hero image or coloured block */}
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
                opacity: 0.7,
                textShadow: "0 2px 10px rgba(0,0,0,0.3)",
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
            id="nex-promo-sheet-title"
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
