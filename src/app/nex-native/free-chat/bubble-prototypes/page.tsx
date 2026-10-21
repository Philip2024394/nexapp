// src/app/nex-native/free-chat/bubble-prototypes/page.tsx
//
// NEX · Free Chat · Self-bubble glass prototypes.
// Owner-authorised 2026-10-21 (iteration 45).
// -----------------------------------------------------------------------------
// 20 side-by-side variants of the outgoing (self) chat bubble in
// frosted-white and frosted-gray glass styles. Each card shows:
//   · A single self-bubble with the same seed text ("Looks clean.")
//   · The variant number + a one-line description
//   · The time + green read-dot meta (unchanged from live surface)
//
// Peer bubble is NOT shown here · the user compares against the live
// peer bubble (cyan glass + cyan rim) which is already in their head.
//
// Live wallpaper is simulated with a subtle NEX navy gradient + faint
// radial so the backdrop-filter blur actually has something to pick up
// behind each bubble.
//
// Not touched:
//   · Live /nex-native/free-chat bubble styling (iteration 44 orange
//     glass stays until the user picks a winner).
//   · Peer bubble styling.
//   · Any sealed primitives.

import type * as React from "react";
import Link from "next/link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "#020914",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMute: "#7D9BC0",
  cyan: "#00AFFF",
  green: "#16D66B",
  orange: "#FF7200",
};
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

interface Variant {
  readonly n: number;
  readonly label: string;
  readonly desc: string;
  readonly style: React.CSSProperties;
  readonly textColor?: string;
}

const VARIANTS: readonly Variant[] = [
  // ─── Frosted white series (V1–V10) ────────────────────────────────
  {
    n: 1,
    label: "White 8% · hairline rim",
    desc: "Pure glass · subtle white 8% fill · 50% white 1px rim",
    style: {
      background: "rgba(255, 255, 255, 0.08)",
      border: "1px solid rgba(255, 255, 255, 0.5)",
      backdropFilter: "blur(10px) saturate(140%)",
      WebkitBackdropFilter: "blur(10px) saturate(140%)",
    },
  },
  {
    n: 2,
    label: "White 14% · medium rim",
    desc: "Light frost · 14% fill · 70% white 1px rim",
    style: {
      background: "rgba(255, 255, 255, 0.14)",
      border: "1px solid rgba(255, 255, 255, 0.7)",
      backdropFilter: "blur(10px) saturate(140%)",
      WebkitBackdropFilter: "blur(10px) saturate(140%)",
    },
  },
  {
    n: 3,
    label: "White 22% · bold rim",
    desc: "Heavier frost · 22% fill · 80% white 1.5px rim",
    style: {
      background: "rgba(255, 255, 255, 0.22)",
      border: "1.5px solid rgba(255, 255, 255, 0.8)",
      backdropFilter: "blur(10px) saturate(140%)",
      WebkitBackdropFilter: "blur(10px) saturate(140%)",
    },
  },
  {
    n: 4,
    label: "White 10% · double rim",
    desc: "Bright outer rim · soft inner glow",
    style: {
      background: "rgba(255, 255, 255, 0.1)",
      border: "1px solid rgba(255, 255, 255, 0.85)",
      boxShadow:
        "0 0 0 2px rgba(255, 255, 255, 0.08), 0 6px 14px -8px rgba(0,0,0,0.6)",
      backdropFilter: "blur(10px) saturate(140%)",
      WebkitBackdropFilter: "blur(10px) saturate(140%)",
    },
  },
  {
    n: 5,
    label: "White 12% · top highlight",
    desc: "Gradient top-highlight · solid white rim",
    style: {
      background:
        "linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.08) 100%)",
      border: "1px solid rgba(255, 255, 255, 0.6)",
      backdropFilter: "blur(10px) saturate(140%)",
      WebkitBackdropFilter: "blur(10px) saturate(140%)",
    },
  },
  {
    n: 6,
    label: "White 16% · no rim · heavy blur",
    desc: "Rimless · 20px heavy blur · deep drop shadow",
    style: {
      background: "rgba(255, 255, 255, 0.16)",
      border: "none",
      backdropFilter: "blur(20px) saturate(160%)",
      WebkitBackdropFilter: "blur(20px) saturate(160%)",
      boxShadow: "0 12px 24px -8px rgba(0,0,0,0.75)",
    },
  },
  {
    n: 7,
    label: "White 20% · inset depth",
    desc: "Thick 2px rim · inset dark bottom shadow for depth",
    style: {
      background: "rgba(255, 255, 255, 0.2)",
      border: "2px solid rgba(255, 255, 255, 0.85)",
      boxShadow:
        "inset 0 -4px 10px rgba(0,0,0,0.18), 0 6px 14px -8px rgba(0,0,0,0.6)",
      backdropFilter: "blur(10px) saturate(140%)",
      WebkitBackdropFilter: "blur(10px) saturate(140%)",
    },
  },
  {
    n: 8,
    label: "White 10% · shimmer rim",
    desc: "Static shimmer-gradient rim via boxShadow spread",
    style: {
      background: "rgba(255, 255, 255, 0.1)",
      border: "1px solid transparent",
      backgroundImage:
        "linear-gradient(rgba(2,9,20,0.6), rgba(2,9,20,0.6)), linear-gradient(135deg, rgba(255,255,255,0.95), rgba(255,255,255,0.3) 40%, rgba(255,255,255,0.95) 70%, rgba(255,255,255,0.3))",
      backgroundOrigin: "border-box",
      backgroundClip: "padding-box, border-box",
      backdropFilter: "blur(10px) saturate(140%)",
      WebkitBackdropFilter: "blur(10px) saturate(140%)",
    },
  },
  {
    n: 9,
    label: "White 14% · bottom-open rim",
    desc: "Rim on top + sides only · bottom edge rimless",
    style: {
      background: "rgba(255, 255, 255, 0.14)",
      borderTop: "1px solid rgba(255, 255, 255, 0.75)",
      borderLeft: "1px solid rgba(255, 255, 255, 0.75)",
      borderRight: "1px solid rgba(255, 255, 255, 0.75)",
      borderBottom: "none",
      backdropFilter: "blur(10px) saturate(140%)",
      WebkitBackdropFilter: "blur(10px) saturate(140%)",
    },
  },
  {
    n: 10,
    label: "White 6% · pure crystal",
    desc: "Barely-there fill · 90% white hairline rim",
    style: {
      background: "rgba(255, 255, 255, 0.06)",
      border: "0.5px solid rgba(255, 255, 255, 0.9)",
      backdropFilter: "blur(14px) saturate(150%)",
      WebkitBackdropFilter: "blur(14px) saturate(150%)",
    },
  },

  // ─── Frosted gray series (V11–V20) ────────────────────────────────
  {
    n: 11,
    label: "Gray 10% · gray rim",
    desc: "Neutral gray 10% fill · 60% gray 1px rim",
    style: {
      background: "rgba(180, 190, 200, 0.1)",
      border: "1px solid rgba(180, 190, 200, 0.6)",
      backdropFilter: "blur(10px) saturate(140%)",
      WebkitBackdropFilter: "blur(10px) saturate(140%)",
    },
  },
  {
    n: 12,
    label: "Gray 18% · bright rim",
    desc: "Mid gray · 80% light-gray 1.5px rim",
    style: {
      background: "rgba(180, 190, 200, 0.18)",
      border: "1.5px solid rgba(210, 220, 230, 0.8)",
      backdropFilter: "blur(10px) saturate(140%)",
      WebkitBackdropFilter: "blur(10px) saturate(140%)",
    },
  },
  {
    n: 13,
    label: "Slate · cool blue-gray",
    desc: "Slate 300 tint · cool rim",
    style: {
      background: "rgba(148, 163, 184, 0.14)",
      border: "1px solid rgba(203, 213, 225, 0.7)",
      backdropFilter: "blur(10px) saturate(140%)",
      WebkitBackdropFilter: "blur(10px) saturate(140%)",
    },
  },
  {
    n: 14,
    label: "Warm gray",
    desc: "Beige-gray tint · warm rim",
    style: {
      background: "rgba(214, 211, 209, 0.14)",
      border: "1px solid rgba(231, 229, 228, 0.7)",
      backdropFilter: "blur(10px) saturate(140%)",
      WebkitBackdropFilter: "blur(10px) saturate(140%)",
    },
  },
  {
    n: 15,
    label: "Charcoal · bright rim",
    desc: "Dark charcoal 35% fill · bright white rim",
    style: {
      background: "rgba(55, 65, 81, 0.35)",
      border: "1px solid rgba(255, 255, 255, 0.65)",
      backdropFilter: "blur(10px) saturate(140%)",
      WebkitBackdropFilter: "blur(10px) saturate(140%)",
    },
  },
  {
    n: 16,
    label: "Soft gray · inner highlight",
    desc: "Inset top white highlight · outer soft shadow",
    style: {
      background: "rgba(200, 210, 220, 0.12)",
      border: "1px solid rgba(200, 210, 220, 0.55)",
      boxShadow:
        "inset 0 1px 0 rgba(255,255,255,0.35), 0 8px 20px -10px rgba(0,0,0,0.6)",
      backdropFilter: "blur(10px) saturate(140%)",
      WebkitBackdropFilter: "blur(10px) saturate(140%)",
    },
  },
  {
    n: 17,
    label: "Gray gradient",
    desc: "Vertical gray gradient · darker top · lighter bottom",
    style: {
      background:
        "linear-gradient(180deg, rgba(140,150,165,0.25) 0%, rgba(200,210,220,0.1) 100%)",
      border: "1px solid rgba(200, 210, 220, 0.6)",
      backdropFilter: "blur(10px) saturate(140%)",
      WebkitBackdropFilter: "blur(10px) saturate(140%)",
    },
  },
  {
    n: 18,
    label: "Pearl gray · inner shadow",
    desc: "Pearl tint · subtle inset shadow + rim",
    style: {
      background: "rgba(220, 220, 230, 0.14)",
      border: "1px solid rgba(220, 220, 230, 0.65)",
      boxShadow:
        "inset 0 0 20px rgba(255,255,255,0.08), 0 6px 14px -8px rgba(0,0,0,0.6)",
      backdropFilter: "blur(10px) saturate(140%)",
      WebkitBackdropFilter: "blur(10px) saturate(140%)",
    },
  },
  {
    n: 19,
    label: "Smoke gray · outer glow",
    desc: "Smoky gray 20% · soft white outer glow halo",
    style: {
      background: "rgba(100, 115, 130, 0.2)",
      border: "1px solid rgba(220, 220, 220, 0.55)",
      boxShadow:
        "0 0 24px -6px rgba(255,255,255,0.15), 0 6px 14px -8px rgba(0,0,0,0.6)",
      backdropFilter: "blur(10px) saturate(140%)",
      WebkitBackdropFilter: "blur(10px) saturate(140%)",
    },
  },
  {
    n: 20,
    label: "Gray + cyan hairline",
    desc: "Neutral gray fill · hairline NEX cyan accent rim",
    style: {
      background: "rgba(180, 190, 200, 0.12)",
      border: "1px solid rgba(0, 175, 255, 0.55)",
      backdropFilter: "blur(10px) saturate(140%)",
      WebkitBackdropFilter: "blur(10px) saturate(140%)",
    },
  },
];

export default function BubblePrototypesPage(): React.ReactElement {
  return (
    <>
      <style>{`html, body { background: ${NEX.bg} !important; }`}</style>
      <main
        data-nex-free-chat-bubble-prototypes-root
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(900px 600px at 70% -10%, rgba(0, 175, 255, 0.1), transparent 60%),
            radial-gradient(700px 500px at 20% 30%, rgba(255, 114, 0, 0.08), transparent 60%),
            ${NEX.bg}
          `,
          color: NEX.text,
          fontFamily: SANS,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* ─── Header ─── */}
        <header
          style={{
            padding:
              "calc(env(safe-area-inset-top, 0px) + 14px) 14px 10px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            borderBottom: `1px solid rgba(0, 175, 255, 0.14)`,
          }}
        >
          <Link
            href="/nex-native/free-chat"
            aria-label="Back to free chat"
            style={{
              color: NEX.text,
              textDecoration: "none",
              fontSize: 20,
              lineHeight: 1,
            }}
          >
            ←
          </Link>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 9,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: NEX.cyan,
                fontWeight: 800,
              }}
            >
              NEX · PROTOTYPES
            </div>
            <h1
              style={{
                margin: "2px 0 0",
                fontSize: 16,
                fontWeight: 800,
                color: NEX.text,
                letterSpacing: "-0.01em",
              }}
            >
              Self-bubble glass styles · 20 variants
            </h1>
          </div>
        </header>

        {/* ─── Scroll body · 20 cards ─── */}
        <div
          data-nex-free-chat-bubble-prototypes-list
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: "12px 10px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <p
            style={{
              margin: "0 2px 4px",
              fontSize: 11,
              color: NEX.textMute,
              lineHeight: 1.4,
            }}
          >
            Peer bubbles (cyan glass + cyan rim) stay as-is. Pick a self
            variant below — reply with the number.
          </p>

          {VARIANTS.map((v) => (
            <VariantCard key={v.n} variant={v} />
          ))}
        </div>
      </main>
    </>
  );
}

function VariantCard({
  variant,
}: {
  variant: Variant;
}): React.ReactElement {
  return (
    <section
      data-nex-free-chat-bubble-prototype-card={`v${variant.n}`}
      style={{
        padding: "10px 12px 12px",
        background: "rgba(5, 15, 28, 0.55)",
        border: "1px solid rgba(0, 175, 255, 0.14)",
        borderRadius: 12,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {/* Variant label row */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 28,
            padding: "2px 6px",
            borderRadius: 6,
            background: NEX.cyan,
            color: "#0a0608",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 0.3,
          }}
        >
          V{variant.n}
        </span>
        <strong
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: NEX.text,
            letterSpacing: "-0.005em",
          }}
        >
          {variant.label}
        </strong>
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 11,
          color: NEX.textMute,
          lineHeight: 1.35,
        }}
      >
        {variant.desc}
      </p>

      {/* Bubble preview · right-aligned (self) ·
          sits over a mini wallpaper so backdrop-filter has something to blur. */}
      <div
        style={{
          padding: "12px 10px",
          borderRadius: 10,
          background: `
            radial-gradient(300px 160px at 85% 15%, rgba(0,175,255,0.12), transparent 70%),
            radial-gradient(260px 180px at 15% 85%, rgba(255,114,0,0.10), transparent 70%),
            linear-gradient(135deg, #06111F 0%, #0B1B30 100%)
          `,
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <article
          data-nex-free-chat-bubble-prototype={variant.n}
          style={{
            maxWidth: "80%",
            padding: "8px 14px 10px",
            borderRadius: 18,
            borderBottomRightRadius: 6,
            color: variant.textColor ?? NEX.text,
            fontSize: 14,
            lineHeight: 1.4,
            display: "flex",
            flexDirection: "column",
            gap: 2,
            ...variant.style,
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              alignSelf: "flex-end",
              fontSize: 10,
              color: "rgba(242, 245, 248, 0.72)",
              lineHeight: 1,
            }}
          >
            <span>15:04</span>
            <svg width={9} height={9} viewBox="0 0 9 9" aria-hidden>
              <circle cx={4.5} cy={4.5} r={4} fill={NEX.green} />
            </svg>
          </div>
          <div>Looks clean.</div>
        </article>
      </div>
    </section>
  );
}
