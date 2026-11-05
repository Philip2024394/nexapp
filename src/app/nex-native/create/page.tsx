// src/app/nex-native/create/page.tsx
//
// Owner-sealed 2026-10-28 · Gate 7 Option 1 · ship Card A first.
//
// Phase 1c Batch 4 · 2026-11-06 · Go-Live card removed with the
// Live Commerce surface deletion (scope reduction · owner Q7). The
// design tokens retained here are sourced from the sealed panel
// palette (owner-authored); they do not carry a Live-specific
// semantic anymore.
//
// Design tokens (owner-sealed · now panel-generic):
//   · Sheet panel: rgba(240,244,250,0.96) · radius 16 ·
//     border rgba(90,110,140,0.5) · shadow 0 20px 50px -16px rgba(0,20,60,0.5)
//   · Text constants: TEXT #102033 · DIM/MUTE #4A6080
//   · Tile button: linear-gradient(135deg,#152646,#1E3A6E) ·
//     radius 12 · colour #FFFFFF · fontSize 12.5 · fontWeight 800 ·
//     shadow 0 3px 10px -3px rgba(16,32,51,0.45) · disabled opacity 0.4
//
// Cards (Music retired 2026-11-06 · Phase 1c Batch 3 · Go-Live
// retired 2026-11-06 · Phase 1c Batch 4):
//   A · Product                    · functional · /nex-native/create/product
//   B · Upload Product Video       · Coming soon · no handler
//   C · Upload Entertainment Video · Coming soon · no handler
//   D · Upload Image               · Coming soon · no handler
//
// Layout: single-column stack.
//
// Scope sealed by founder (2026-10-28, 2026-11-06):
//   · Only the Product card is functional. The others are Coming
//     soon · no handler, no route.
//   · No category picker on this page. No new publishing flows.
//   · No DB changes. No migrations.

import Link from "next/link";
import { CloseButton } from "./_close-button";
// Owner-sealed 2026-10-28 · desktop troubleshoot. NexNativeShell wraps
// its children in NexHudFrame which escapes the layout's .nex-native-
// frame clamp on desktop, pushing content outside the phone frame
// (black screen). The layout.tsx (src/app/nex-native/layout.tsx:156)
// already wraps every /nex-native/* route in .nex-native-stage >
// .nex-native-frame, so a plain <main> renders inside the sealed
// phone-frame column automatically. Prototype pages like
// /shop-prototypes-v2 and /free-chat/card-prototypes do the same.

export const metadata = {
  title: "Create · NEX",
  description: "Choose what you'd like to create on NEX.",
};

const TEXT = "#102033";
const DIM = "#4A6080";
const GOLD = "#FFC24B";
const RED = "#FF3355";
const PANEL_BG = "rgba(240, 244, 250, 0.96)";
const PANEL_BORDER = "rgba(90, 110, 140, 0.5)";
const PANEL_SHADOW = "0 20px 50px -16px rgba(0, 20, 60, 0.5)";
const TILE_BG = "linear-gradient(135deg, #152646 0%, #1E3A6E 100%)";
// Phase 1c Batch 4 · 2026-11-06 · Go-Live tile background retired
// with the Go-Live card.
const TILE_SHADOW = "0 3px 10px -3px rgba(16, 32, 51, 0.45)";
const CHIP_ENABLED_BG = "rgba(255, 51, 85, 0.18)";
const CHIP_ENABLED_FG = RED;
const CHIP_DISABLED_BG = "rgba(255, 255, 255, 0.1)";
const CHIP_DISABLED_FG = "#8BA9D1";

interface CreateCard {
  readonly id: "product" | "product-video" | "entertainment-video" | "image";
  readonly label: string;
  readonly blurb: string;
  readonly glyph: string;
  readonly href: string | null;
}

// Owner-authorised 2026-10-30 · Product card added per Phase 1 of the
// sealed Product System Implementation Contract (§K owner-resolved).
// Routes to the shared Create Product flow with business picker →
// category picker → shared form.
// 2026-11-06 · Phase 1c Batch 3 · Music card removed (scope-reduction
// phase-1a §3.3).
// 2026-11-06 · Phase 1c Batch 4 · Go-Live card removed (scope-
// reduction phase-1a §1.1 · owner Q7 resolved).
const CARDS: readonly CreateCard[] = [
  { id: "product",             label: "Product",            blurb: "Create & sell", glyph: "🛍️", href: "/nex-native/create/product" },
  { id: "product-video",       label: "Product Video",      blurb: "Add to shop",   glyph: "🛒", href: null },
  { id: "entertainment-video", label: "Entertainment Video", blurb: "Video post",   glyph: "🎥", href: null },
  { id: "image",               label: "Image",              blurb: "Photo post",    glyph: "🖼️", href: null },
] as const;

// Phase 1c Batch 4 · 2026-11-06 · LiveDot + LIVE_DOT_KEYFRAMES
// removed with the Go-Live card deletion (scope reduction).

export default function CreatePage(): React.JSX.Element {
  return (
    <main
      data-nex-create-page
      style={{
        padding: "16px",
        minHeight: "100%",
        width: "100%",
        boxSizing: "border-box",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
    >
        <div
          data-nex-create-panel
          style={{
            position: "relative",
            width: "100%",
            maxWidth: "100%",
            boxSizing: "border-box",
            margin: "0 auto",
            padding: "20px 16px",
            borderRadius: 16,
            background: PANEL_BG,
            border: `1.5px solid ${PANEL_BORDER}`,
            boxShadow: PANEL_SHADOW,
            color: TEXT,
            backdropFilter: "blur(10px) saturate(1.4)",
            WebkitBackdropFilter: "blur(10px) saturate(1.4)",
          }}
        >
          <CloseButton />
          <header style={{ marginBottom: 16 }}>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 900,
                margin: 0,
                color: TEXT,
                letterSpacing: "-0.01em",
                lineHeight: 1.1,
              }}
            >
              Create on NEX
            </h1>
            <p
              style={{
                fontSize: 12.5,
                color: DIM,
                margin: "6px 0 0",
                lineHeight: 1.4,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>🎉</span>
              Choose what to create
            </p>
          </header>

          <ul
            data-nex-create-grid
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {CARDS.map((card) => (
              <li key={card.id} style={{ margin: 0, padding: 0 }}>
                <CreateCardTile card={card} />
              </li>
            ))}
          </ul>
        </div>
    </main>
  );
}

function CreateCardTile({
  card,
}: {
  readonly card: CreateCard;
}): React.JSX.Element {
  const comingSoon = card.href === null;
  const chipLabel = comingSoon ? "Coming soon" : "Open";

  const inner = (
    <div
      data-nex-create-card={card.id}
      data-nex-create-card-enabled={comingSoon ? "false" : "true"}
      aria-disabled={comingSoon ? "true" : undefined}
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        minHeight: 64,
        borderRadius: 12,
        background: TILE_BG,
        border: "none",
        color: "#FFFFFF",
        fontFamily: "inherit",
        boxShadow: TILE_SHADOW,
        cursor: comingSoon ? "not-allowed" : "pointer",
        opacity: comingSoon ? 0.4 : 1,
        WebkitTapHighlightColor: "transparent",
        textAlign: "left",
      }}
    >
      <span
        aria-hidden
        style={{
          fontSize: 24,
          lineHeight: 1,
          flexShrink: 0,
          width: 32,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {card.glyph}
      </span>
      <div style={{ flex: "1 1 auto", minWidth: 0 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 900,
            color: "#FFFFFF",
            lineHeight: 1.15,
            letterSpacing: "0.01em",
          }}
        >
          {card.label}
        </div>
        <div
          style={{
            marginTop: 2,
            fontSize: 11,
            fontWeight: 500,
            color: "rgba(255,255,255,0.7)",
            lineHeight: 1.3,
          }}
        >
          {card.blurb}
        </div>
      </div>
      <span
        style={{
          flexShrink: 0,
          fontSize: 9.5,
          fontWeight: 800,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          padding: "3px 7px",
          borderRadius: 999,
          background: comingSoon ? CHIP_DISABLED_BG : CHIP_ENABLED_BG,
          color: comingSoon ? CHIP_DISABLED_FG : CHIP_ENABLED_FG,
        }}
      >
        {chipLabel}
      </span>
    </div>
  );

  if (comingSoon) {
    // Disabled tile · no handler · no navigation.
    return inner;
  }

  return (
    <Link
      href={card.href as string}
      data-nex-create-card-link={card.id}
      style={{
        display: "block",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      {inner}
    </Link>
  );
}
