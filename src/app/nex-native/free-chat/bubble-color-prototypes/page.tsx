// src/app/nex-native/free-chat/bubble-color-prototypes/page.tsx
//
// NEX · Free Chat · Owner-review page · bubble COLOUR prototypes.
// Owner-authorised 2026-11-02.
// -----------------------------------------------------------------------------
// 20 side-by-side variants of the chat-bubble COLOUR pairing (peer +
// owner/self). Built on top of the sealed iteration-47 bubble SHAPE +
// radius + glass design · ONLY the fill / rim / ink colours vary per
// card so the owner can pick a winning pair without touching the
// sealed geometry.
//
// Each card renders:
//   · A simulated Ireland-sunset backdrop (dark emerald so backdrop-
//     filter blur has something to pick up)
//   · A peer bubble (seed text · left-aligned)
//   · An owner/self bubble (same seed · right-aligned)
//   · Variant number · one-line description · exact hex/rgba values
//
// Not touched:
//   · The live free-chat page · no change until the owner picks a winner
//   · The sealed self-bubble iteration-47 charcoal-glass is variant V1
//     here as the baseline reference
//
// Palette reference · sealed Ireland world:
//   Emerald #123D2B · Forest #1B5138 · Gold #C6A15B · Sage #AFC5B5
//   Cream  #FAF8F4 · Dark Forest #0F2E20 · White #FFFFFF
//
// Scope: dev-only review page. Not linked from any production surface.

import type * as React from "react";
import Link from "next/link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── Sealed Ireland palette tokens (reference only · not consumed from vars
//     because this is a comparison surface · we want static values) ─────────
const EMERALD = "#123D2B";
const EMERALD_DEEP = "#0F2E20";
const FOREST = "#1B5138";
const GOLD = "#C6A15B";
const GOLD_DEEP = "#A68443";
const SAGE = "#AFC5B5";
const CREAM = "#FAF8F4";
const WHITE = "#FFFFFF";
const CHARCOAL = "rgba(55, 65, 81, 0.35)";
const CHARCOAL_RIM = "rgba(255, 255, 255, 0.65)";

// ─── Bubble layout constants (sealed · unchanged) ───────────────────────────
const BUBBLE_FONT_SIZE = 15;
const BUBBLE_LINE_HEIGHT = 1.3;
const BUBBLE_RADIUS = 18;
const BUBBLE_PADDING = "10px 14px";
const BUBBLE_BORDER_WIDTH = "1px";
const BLUR = "blur(10px) saturate(140%)";

// ─── Variant data ──────────────────────────────────────────────────────────

interface BubbleStyle {
  readonly background: string;
  readonly border: string;
  readonly color: string;
  readonly backdropFilter?: string;
  readonly boxShadow?: string;
}

interface Variant {
  readonly n: number;
  readonly label: string;
  readonly desc: string;
  readonly peer: BubbleStyle;
  readonly self: BubbleStyle;
  readonly peerSpec: string;
  readonly selfSpec: string;
}

const VARIANTS: readonly Variant[] = [
  // V1 · current baseline (iteration 47 · sealed self + Gold-tinted peer)
  {
    n: 1,
    label: "Current baseline",
    desc: "Sealed iteration-47 self (charcoal glass) + Gold glass peer. What ships today.",
    peer: {
      background: "rgba(198, 161, 91, 0.15)",
      border: `1px solid rgba(198, 161, 91, 0.35)`,
      backdropFilter: BLUR,
      color: WHITE,
    },
    self: {
      background: CHARCOAL,
      border: `1px solid ${CHARCOAL_RIM}`,
      backdropFilter: BLUR,
      color: WHITE,
    },
    peerSpec: "Gold 15% fill · Gold 35% rim",
    selfSpec: "Charcoal 35% fill · White 65% rim",
  },

  // V2 · Gold peer · Emerald self (role separation by hue)
  {
    n: 2,
    label: "Gold peer · Emerald self",
    desc: "Warm peer / deep emerald self · high hue separation, both legible on sunset.",
    peer: {
      background: "rgba(198, 161, 91, 0.18)",
      border: `1px solid rgba(198, 161, 91, 0.4)`,
      backdropFilter: BLUR,
      color: WHITE,
    },
    self: {
      background: "rgba(18, 61, 43, 0.65)",
      border: `1px solid rgba(198, 161, 91, 0.5)`,
      backdropFilter: BLUR,
      color: WHITE,
    },
    peerSpec: "Gold 18% fill · Gold 40% rim",
    selfSpec: "Emerald 65% fill · Gold 50% rim",
  },

  // V3 · Forest peer · Gold self (role reversed)
  {
    n: 3,
    label: "Forest peer · Gold self",
    desc: "Dark forest peer, warm Gold self · owner's bubble pops.",
    peer: {
      background: "rgba(27, 81, 56, 0.55)",
      border: `1px solid rgba(175, 197, 181, 0.5)`,
      backdropFilter: BLUR,
      color: WHITE,
    },
    self: {
      background: "rgba(198, 161, 91, 0.35)",
      border: `1px solid rgba(198, 161, 91, 0.75)`,
      backdropFilter: BLUR,
      color: WHITE,
    },
    peerSpec: "Forest 55% fill · Sage 50% rim",
    selfSpec: "Gold 35% fill · Gold 75% rim",
  },

  // V4 · Sage peer · Forest self (soft→dark)
  {
    n: 4,
    label: "Sage peer · Forest self",
    desc: "Soft sage peer, dark forest self · pastoral mood.",
    peer: {
      background: "rgba(175, 197, 181, 0.25)",
      border: `1px solid rgba(175, 197, 181, 0.6)`,
      backdropFilter: BLUR,
      color: WHITE,
    },
    self: {
      background: "rgba(27, 81, 56, 0.7)",
      border: `1px solid rgba(255, 255, 255, 0.4)`,
      backdropFilter: BLUR,
      color: WHITE,
    },
    peerSpec: "Sage 25% fill · Sage 60% rim",
    selfSpec: "Forest 70% fill · White 40% rim",
  },

  // V5 · Gold peer · Sage self (warm + soft)
  {
    n: 5,
    label: "Gold peer · Sage self",
    desc: "Warm Gold peer, soft Sage self · low-contrast friendly.",
    peer: {
      background: "rgba(198, 161, 91, 0.2)",
      border: `1px solid rgba(198, 161, 91, 0.5)`,
      backdropFilter: BLUR,
      color: WHITE,
    },
    self: {
      background: "rgba(175, 197, 181, 0.3)",
      border: `1px solid rgba(175, 197, 181, 0.7)`,
      backdropFilter: BLUR,
      color: WHITE,
    },
    peerSpec: "Gold 20% fill · Gold 50% rim",
    selfSpec: "Sage 30% fill · Sage 70% rim",
  },

  // V6 · Emerald peer · Gold self (dark peer, warm self)
  {
    n: 6,
    label: "Emerald peer · Gold self",
    desc: "Deep Emerald peer, warm Gold self · theatrical contrast.",
    peer: {
      background: "rgba(18, 61, 43, 0.6)",
      border: `1px solid rgba(198, 161, 91, 0.4)`,
      backdropFilter: BLUR,
      color: WHITE,
    },
    self: {
      background: "rgba(198, 161, 91, 0.3)",
      border: `1px solid rgba(198, 161, 91, 0.75)`,
      backdropFilter: BLUR,
      color: WHITE,
    },
    peerSpec: "Emerald 60% fill · Gold 40% rim",
    selfSpec: "Gold 30% fill · Gold 75% rim",
  },

  // V7 · Forest peer · Cream self (dark→light swap)
  {
    n: 7,
    label: "Forest peer · Cream self",
    desc: "Forest peer, Cream glass self · premium invitation card feel.",
    peer: {
      background: "rgba(27, 81, 56, 0.55)",
      border: `1px solid rgba(198, 161, 91, 0.45)`,
      backdropFilter: BLUR,
      color: WHITE,
    },
    self: {
      background: "rgba(250, 248, 244, 0.2)",
      border: `1px solid rgba(250, 248, 244, 0.7)`,
      backdropFilter: BLUR,
      color: WHITE,
    },
    peerSpec: "Forest 55% fill · Gold 45% rim",
    selfSpec: "Cream 20% fill · Cream 70% rim",
  },

  // V8 · Gold peer · Cream self (warm pair)
  {
    n: 8,
    label: "Gold peer · Cream self",
    desc: "Both warm · Gold peer + Cream self · soft Irish wedding vibe.",
    peer: {
      background: "rgba(198, 161, 91, 0.22)",
      border: `1px solid rgba(198, 161, 91, 0.55)`,
      backdropFilter: BLUR,
      color: WHITE,
    },
    self: {
      background: "rgba(250, 248, 244, 0.22)",
      border: `1px solid rgba(250, 248, 244, 0.75)`,
      backdropFilter: BLUR,
      color: WHITE,
    },
    peerSpec: "Gold 22% fill · Gold 55% rim",
    selfSpec: "Cream 22% fill · Cream 75% rim",
  },

  // V9 · Deep Emerald peer · White glass self (strong duality)
  {
    n: 9,
    label: "Deep Emerald peer · White self",
    desc: "Nearly-black Emerald peer, bright White glass self · maximum legibility.",
    peer: {
      background: "rgba(15, 46, 32, 0.72)",
      border: `1px solid rgba(255, 255, 255, 0.3)`,
      backdropFilter: BLUR,
      color: WHITE,
    },
    self: {
      background: "rgba(255, 255, 255, 0.15)",
      border: `1px solid rgba(255, 255, 255, 0.75)`,
      backdropFilter: BLUR,
      color: WHITE,
    },
    peerSpec: "Dark Emerald 72% fill · White 30% rim",
    selfSpec: "White 15% fill · White 75% rim",
  },

  // V10 · Sage peer · Charcoal self (sealed self vs light peer)
  {
    n: 10,
    label: "Sage peer · Charcoal self (sealed)",
    desc: "Light Sage peer + sealed iteration-47 charcoal self · keeps the sealed self.",
    peer: {
      background: "rgba(175, 197, 181, 0.28)",
      border: `1px solid rgba(175, 197, 181, 0.65)`,
      backdropFilter: BLUR,
      color: WHITE,
    },
    self: {
      background: CHARCOAL,
      border: `1px solid ${CHARCOAL_RIM}`,
      backdropFilter: BLUR,
      color: WHITE,
    },
    peerSpec: "Sage 28% fill · Sage 65% rim",
    selfSpec: "Charcoal 35% fill · White 65% rim (sealed)",
  },

  // V11 · Gold peer · darker charcoal self (slight shift from baseline)
  {
    n: 11,
    label: "Gold peer · Deep charcoal self",
    desc: "Current baseline but self deeper · more visual weight on owner side.",
    peer: {
      background: "rgba(198, 161, 91, 0.15)",
      border: `1px solid rgba(198, 161, 91, 0.35)`,
      backdropFilter: BLUR,
      color: WHITE,
    },
    self: {
      background: "rgba(20, 28, 40, 0.5)",
      border: `1px solid rgba(255, 255, 255, 0.6)`,
      backdropFilter: BLUR,
      color: WHITE,
    },
    peerSpec: "Gold 15% fill · Gold 35% rim",
    selfSpec: "Dark charcoal 50% fill · White 60% rim",
  },

  // V12 · Dual Gold (same hue, different weights)
  {
    n: 12,
    label: "Dual Gold · weights",
    desc: "Both Gold · peer light fill, self strong fill · subtle role via weight.",
    peer: {
      background: "rgba(198, 161, 91, 0.12)",
      border: `1px solid rgba(198, 161, 91, 0.35)`,
      backdropFilter: BLUR,
      color: WHITE,
    },
    self: {
      background: "rgba(198, 161, 91, 0.35)",
      border: `1px solid rgba(198, 161, 91, 0.9)`,
      backdropFilter: BLUR,
      color: WHITE,
    },
    peerSpec: "Gold 12% fill · Gold 35% rim",
    selfSpec: "Gold 35% fill · Gold 90% rim",
  },

  // V13 · Emerald peer · Gold self with glow
  {
    n: 13,
    label: "Emerald peer · Gold self + glow",
    desc: "Dark peer, Gold self with a soft outer glow · premium read-receipt vibe.",
    peer: {
      background: "rgba(18, 61, 43, 0.6)",
      border: `1px solid rgba(175, 197, 181, 0.4)`,
      backdropFilter: BLUR,
      color: WHITE,
    },
    self: {
      background: "rgba(198, 161, 91, 0.3)",
      border: `1px solid rgba(198, 161, 91, 0.7)`,
      backdropFilter: BLUR,
      boxShadow: "0 0 16px rgba(198, 161, 91, 0.35)",
      color: WHITE,
    },
    peerSpec: "Emerald 60% fill · Sage 40% rim",
    selfSpec: "Gold 30% fill · Gold 70% rim · Gold glow 35%",
  },

  // V14 · White glass peer · Gold self (light-dominant peer)
  {
    n: 14,
    label: "White glass peer · Gold self",
    desc: "Bright peer, warm self · reads as a conversation with someone in a bright room.",
    peer: {
      background: "rgba(255, 255, 255, 0.14)",
      border: `1px solid rgba(255, 255, 255, 0.6)`,
      backdropFilter: BLUR,
      color: WHITE,
    },
    self: {
      background: "rgba(198, 161, 91, 0.32)",
      border: `1px solid rgba(198, 161, 91, 0.72)`,
      backdropFilter: BLUR,
      color: WHITE,
    },
    peerSpec: "White 14% fill · White 60% rim",
    selfSpec: "Gold 32% fill · Gold 72% rim",
  },

  // V15 · Sage peer · Gold self (soft + warm)
  {
    n: 15,
    label: "Sage peer · Gold self",
    desc: "Soft Sage peer, warm Gold self · harmonious Irish countryside palette.",
    peer: {
      background: "rgba(175, 197, 181, 0.3)",
      border: `1px solid rgba(175, 197, 181, 0.7)`,
      backdropFilter: BLUR,
      color: WHITE,
    },
    self: {
      background: "rgba(198, 161, 91, 0.3)",
      border: `1px solid rgba(198, 161, 91, 0.75)`,
      backdropFilter: BLUR,
      color: WHITE,
    },
    peerSpec: "Sage 30% fill · Sage 70% rim",
    selfSpec: "Gold 30% fill · Gold 75% rim",
  },

  // V16 · Forest peer · Sage self (dark-forest / sage inversion)
  {
    n: 16,
    label: "Forest peer · Sage self",
    desc: "Dark forest peer, light sage self · forest-canopy & morning mist.",
    peer: {
      background: "rgba(27, 81, 56, 0.6)",
      border: `1px solid rgba(175, 197, 181, 0.5)`,
      backdropFilter: BLUR,
      color: WHITE,
    },
    self: {
      background: "rgba(175, 197, 181, 0.3)",
      border: `1px solid rgba(175, 197, 181, 0.8)`,
      backdropFilter: BLUR,
      color: WHITE,
    },
    peerSpec: "Forest 60% fill · Sage 50% rim",
    selfSpec: "Sage 30% fill · Sage 80% rim",
  },

  // V17 · Gold peer · nearly-black self (owner anchored)
  {
    n: 17,
    label: "Gold peer · Nearly-black self",
    desc: "Warm peer, almost-opaque dark self · owner side anchors visually.",
    peer: {
      background: "rgba(198, 161, 91, 0.2)",
      border: `1px solid rgba(198, 161, 91, 0.5)`,
      backdropFilter: BLUR,
      color: WHITE,
    },
    self: {
      background: "rgba(15, 46, 32, 0.82)",
      border: `1px solid rgba(198, 161, 91, 0.6)`,
      backdropFilter: BLUR,
      color: WHITE,
    },
    peerSpec: "Gold 20% fill · Gold 50% rim",
    selfSpec: "Dark Emerald 82% fill · Gold 60% rim",
  },

  // V18 · Hollow outlines (transparent fills, only rims)
  {
    n: 18,
    label: "Hollow · outline only",
    desc: "Transparent fills · only coloured rims. Minimal · lets wallpaper shine.",
    peer: {
      background: "transparent",
      border: `1.5px solid rgba(198, 161, 91, 0.85)`,
      color: WHITE,
    },
    self: {
      background: "transparent",
      border: `1.5px solid rgba(255, 255, 255, 0.85)`,
      color: WHITE,
    },
    peerSpec: "No fill · Gold 85% rim (1.5px)",
    selfSpec: "No fill · White 85% rim (1.5px)",
  },

  // V19 · Dual Gold gradient fills (premium feel)
  {
    n: 19,
    label: "Dual Gold · gradients",
    desc: "Both Gold with vertical gradients · premium / luxurious feel.",
    peer: {
      background:
        "linear-gradient(135deg, rgba(198, 161, 91, 0.08) 0%, rgba(198, 161, 91, 0.22) 100%)",
      border: `1px solid rgba(198, 161, 91, 0.5)`,
      backdropFilter: BLUR,
      color: WHITE,
    },
    self: {
      background:
        "linear-gradient(135deg, rgba(198, 161, 91, 0.22) 0%, rgba(166, 132, 67, 0.45) 100%)",
      border: `1px solid rgba(198, 161, 91, 0.9)`,
      backdropFilter: BLUR,
      color: WHITE,
    },
    peerSpec: "Gold gradient 8→22% · Gold 50% rim",
    selfSpec: "Gold gradient 22→45% · Gold 90% rim",
  },

  // V20 · Minimal hairline (thinnest · most restrained)
  {
    n: 20,
    label: "Minimal · thin hairline",
    desc: "Thinnest 0.5px hairlines · barely-there bubbles · wallpaper is the hero.",
    peer: {
      background: "rgba(198, 161, 91, 0.06)",
      border: `0.5px solid rgba(198, 161, 91, 0.55)`,
      backdropFilter: BLUR,
      color: WHITE,
    },
    self: {
      background: "rgba(255, 255, 255, 0.05)",
      border: `0.5px solid rgba(255, 255, 255, 0.55)`,
      backdropFilter: BLUR,
      color: WHITE,
    },
    peerSpec: "Gold 6% fill · Gold 55% rim (0.5px)",
    selfSpec: "White 5% fill · White 55% rim (0.5px)",
  },
];

// ─── Chrome ────────────────────────────────────────────────────────────────

const PAGE_BG = "#020914";
const CARD_BG = "#061320";
const CARD_BORDER = "rgba(198, 161, 91, 0.14)";
const TEXT_PRIMARY = "#F2F5F8";
const TEXT_DIM = "#B5C3D6";
const TEXT_MUTE = "#7D9BC0";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

// Simulated Ireland sunset backdrop · dark emerald gradient so backdrop-
// filter blur in each bubble has something to pick up.
const WALLPAPER_BG =
  `radial-gradient(circle at 20% 30%, rgba(198, 161, 91, 0.15), transparent 55%),` +
  `radial-gradient(circle at 85% 70%, rgba(27, 81, 56, 0.35), transparent 60%),` +
  `linear-gradient(135deg, ${EMERALD_DEEP} 0%, ${EMERALD} 50%, #0A1F15 100%)`;

export default function BubbleColorPrototypesPage(): React.JSX.Element {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: PAGE_BG,
        color: TEXT_PRIMARY,
        padding: "32px 20px 72px",
        fontFamily: SANS,
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <header
          style={{
            paddingBottom: 20,
            marginBottom: 24,
            borderBottom: `1px solid ${CARD_BORDER}`,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 11,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: TEXT_MUTE,
            }}
          >
            NEX · Free Chat · bubble COLOUR prototypes
          </p>
          <h1 style={{ margin: "6px 0 0", fontSize: 26, fontWeight: 700 }}>
            Peer + Owner bubble pairings · Ireland palette
          </h1>
          <p style={{ margin: "10px 0 0", color: TEXT_DIM, fontSize: 14, lineHeight: 1.5 }}>
            20 colour pairings · each card shows the <strong>peer bubble (left)</strong> + the <strong>owner bubble (right)</strong> on a simulated Ireland sunset backdrop. Sealed bubble geometry (padding · radius · 1px border · frosted glass) is identical in every card · ONLY the fill / rim / ink colours change.
          </p>
          <p style={{ margin: "6px 0 0", color: TEXT_MUTE, fontSize: 12, lineHeight: 1.5 }}>
            Palette · <code>Emerald #123D2B</code> · <code>Forest #1B5138</code> · <code>Gold #C6A15B</code> · <code>Sage #AFC5B5</code> · <code>Cream #FAF8F4</code> · <code>Charcoal rgba(55,65,81,0.35)</code>. Dark-emerald wallpaper matches the live Ireland chat backdrop.
          </p>
          <p
            style={{
              margin: "16px 0 0",
              fontSize: 13,
              color: TEXT_MUTE,
            }}
          >
            <Link
              href="/nex-native/free-chat?preview=1&show-themes=1"
              style={{ color: GOLD, textDecoration: "none", marginRight: 20 }}
            >
              ← Back to live free-chat
            </Link>
            <Link
              href="/nex-native/free-chat/bubble-prototypes"
              style={{ color: GOLD, textDecoration: "none" }}
            >
              Self-bubble geometry prototypes →
            </Link>
          </p>
        </header>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
            gap: 20,
          }}
        >
          {VARIANTS.map((v) => (
            <BubblePairCard key={v.n} variant={v} />
          ))}
        </div>

        <footer style={{ marginTop: 32, fontSize: 12, color: TEXT_MUTE }}>
          Owner-authorised 2026-11-02 · bubble geometry sealed at iteration 47 ·
          this page is a colour-review tool · no live surface changed.
        </footer>
      </div>
    </div>
  );
}

function BubblePairCard({ variant: v }: { variant: Variant }): React.JSX.Element {
  return (
    <article
      style={{
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 16,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "14px 16px 8px",
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 700,
            color: TEXT_PRIMARY,
          }}
        >
          V{v.n} · {v.label}
        </h3>
      </div>
      <p
        style={{
          margin: "0 16px 10px",
          color: TEXT_DIM,
          fontSize: 12,
          lineHeight: 1.45,
        }}
      >
        {v.desc}
      </p>

      {/* Simulated wallpaper + bubble pair */}
      <div
        style={{
          background: WALLPAPER_BG,
          padding: "18px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {/* Peer bubble · left-aligned */}
        <div style={{ display: "flex", justifyContent: "flex-start" }}>
          <div
            style={{
              ...v.peer,
              padding: BUBBLE_PADDING,
              borderRadius: BUBBLE_RADIUS,
              borderBottomLeftRadius: 6,
              fontSize: BUBBLE_FONT_SIZE,
              lineHeight: BUBBLE_LINE_HEIGHT,
              maxWidth: "78%",
              WebkitBackdropFilter: v.peer.backdropFilter,
              fontFamily: SANS,
            }}
          >
            Hey, you around? Fancy a chat?
          </div>
        </div>
        {/* Owner bubble · right-aligned */}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <div
            style={{
              ...v.self,
              padding: BUBBLE_PADDING,
              borderRadius: BUBBLE_RADIUS,
              borderBottomRightRadius: 6,
              fontSize: BUBBLE_FONT_SIZE,
              lineHeight: BUBBLE_LINE_HEIGHT,
              maxWidth: "78%",
              WebkitBackdropFilter: v.self.backdropFilter,
              fontFamily: SANS,
            }}
          >
            Grand · I just got in. What&apos;s the plan?
          </div>
        </div>
      </div>

      {/* Spec readout */}
      <dl
        style={{
          margin: 0,
          padding: "12px 16px",
          borderTop: `1px solid ${CARD_BORDER}`,
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          rowGap: 6,
          columnGap: 10,
          fontSize: 11,
          fontFamily:
            "'JetBrains Mono', 'Fira Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        }}
      >
        <dt style={{ color: TEXT_MUTE }}>peer</dt>
        <dd style={{ margin: 0, color: TEXT_DIM, wordBreak: "break-word" }}>
          {v.peerSpec}
        </dd>
        <dt style={{ color: TEXT_MUTE }}>self</dt>
        <dd style={{ margin: 0, color: TEXT_DIM, wordBreak: "break-word" }}>
          {v.selfSpec}
        </dd>
      </dl>
    </article>
  );
}

// Silence unused-import linters for palette consts kept for owner review.
void FOREST;
void GOLD_DEEP;
void SAGE;
void CREAM;
void WHITE;
