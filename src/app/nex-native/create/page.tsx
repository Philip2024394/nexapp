// src/app/nex-native/create/page.tsx
//
// Owner-sealed 2026-10-28 · Gate 7 Option 1 · ship Card A first.
// Owner directive 2026-10-28 (same day) · theme source corrected to
// BroadcasterLibrarySheet (Live Library) · NOT /manage/live.
//
// Design tokens traced to
// src/components/nex-native/live-commerce/BroadcasterLibrarySheet.tsx:
//   · Sheet panel (line 385-396): rgba(240,244,250,0.96) · radius 16 ·
//     border rgba(90,110,140,0.5) · shadow 0 20px 50px -16px rgba(0,20,60,0.5)
//   · Text constants (line 112-114): TEXT #102033 · DIM/MUTE #4A6080
//   · Tile button (line 1046-1068): linear-gradient(135deg,#152646,#1E3A6E) ·
//     radius 12 · colour #FFFFFF · fontSize 12.5 · fontWeight 800 ·
//     shadow 0 3px 10px -3px rgba(16,32,51,0.45) · disabled opacity 0.4
//
// Five cards:
//   A · Go Live               · functional · /nex-native/live-commerce/welcome
//   B · Upload Product Video  · Coming soon · no handler
//   C · Upload Entertainment Video · Coming soon · no handler
//   D · Upload Image          · Coming soon · no handler
//   E · Upload Music          · Coming soon · no handler
//
// Layout: 2-column grid at every width · 2+2+1 · Music centred on row 3.
//
// Scope sealed by founder (2026-10-28):
//   · Only Card A functional. B-E are Coming soon · no handler, no route.
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
// Owner directive 2026-10-28 · Go Live tile uses the sealed chat-free
// background colour (#020914 · src/app/nex-native/free-chat/page.tsx:63
// `NEX.bg`) so the primary action reads as a solid dark surface that
// stands apart from the lighter navy gradient on Coming-soon tiles.
const TILE_BG_GO_LIVE = "#020914";
const TILE_SHADOW = "0 3px 10px -3px rgba(16, 32, 51, 0.45)";
const CHIP_ENABLED_BG = "rgba(255, 51, 85, 0.18)";
const CHIP_ENABLED_FG = RED;
const CHIP_DISABLED_BG = "rgba(255, 255, 255, 0.1)";
const CHIP_DISABLED_FG = "#8BA9D1";

interface CreateCard {
  readonly id: "go-live" | "product-video" | "entertainment-video" | "image" | "music";
  readonly label: string;
  readonly blurb: string;
  readonly glyph: string;
  readonly href: string | null;
}

const CARDS: readonly CreateCard[] = [
  { id: "go-live",             label: "Go Live",            blurb: "Stream now",    glyph: "LIVE_DOT", href: "/nex-native/live-commerce/welcome" },
  { id: "product-video",       label: "Product Video",      blurb: "Add to shop",   glyph: "🛒", href: null },
  { id: "entertainment-video", label: "Entertainment Video", blurb: "Video post",   glyph: "🎥", href: null },
  { id: "image",               label: "Image",              blurb: "Photo post",    glyph: "🖼️", href: null },
  { id: "music",               label: "Music",              blurb: "Upload tracks", glyph: "🎵", href: "/nex-native/create/upload-music" },
] as const;

// Owner directive 2026-10-28 · "golive red dark dot with ping". Dark
// red solid dot with an outward-pulsing halo · reads as "live"
// without an emoji. Pure CSS keyframes · one global <style> block so
// multiple tiles would share the animation if we ever add more.
const LIVE_DOT_KEYFRAMES = `
@keyframes nexCreateLivePing {
  0%   { transform: scale(0.9); opacity: 0.75; }
  70%  { transform: scale(2.0); opacity: 0;    }
  100% { transform: scale(2.0); opacity: 0;    }
}
`;

function LiveDot(): React.JSX.Element {
  return (
    <span
      aria-hidden
      style={{
        position: "relative",
        display: "inline-block",
        width: 14,
        height: 14,
      }}
    >
      <span
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: "#B10E25",
          animation: "nexCreateLivePing 1.6s cubic-bezier(0, 0, 0.2, 1) infinite",
        }}
      />
      <span
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: "#8B0A1C",
          boxShadow:
            "0 0 0 1px rgba(255, 51, 85, 0.35), 0 0 8px rgba(255, 51, 85, 0.5)",
        }}
      />
    </span>
  );
}

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
      <style>{LIVE_DOT_KEYFRAMES}</style>
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
              Let&rsquo;s Go Live
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
              World Is Waiting
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
        background: card.id === "go-live" ? TILE_BG_GO_LIVE : TILE_BG,
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
        {card.glyph === "LIVE_DOT" ? <LiveDot /> : card.glyph}
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
