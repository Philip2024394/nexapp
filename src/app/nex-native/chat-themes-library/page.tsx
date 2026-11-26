// src/app/nex-native/chat-themes-library/page.tsx
//
// NEX Chat Themes · three-category hub.
// Owner-sealed 2026-11-26 (L-011). Supersedes the 2026-11-11 redirect
// to /all. Design direction is locked:
//
//   · three tall cards (Plain · Small · Full Image) stacked
//     vertically on mobile, equally weighted,
//   · each card opens its own dedicated background library using the
//     existing full-image library layout and interaction pattern,
//   · theme preview, selection, persistence and reset are preserved
//     because every category library renders the shared
//     FullLibraryClient under the hood,
//   · the bubble-colour page is reached separately from Settings and
//     is intentionally not touched by this surface.
//
// This file is a Server Component with inline styles so it matches
// the visual family of the rest of the chat-themes-library tree
// (dark emerald/navy backdrop, orange accent, gold border). No
// hero animation, no marketing copy — just the three decision cards.

import Link from "next/link";
import type * as React from "react";
import {
  CHAT_CATEGORY_KINDS,
  CHAT_CATEGORY_LABEL,
  CHAT_CATEGORY_HINT,
  type ChatCategoryKind,
} from "./_category-classifier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX_BG = "var(--nex-world-drawer-bg, #020914)";
const NEX_INK = "#F2F5F8";
const NEX_INK_DIM = "#B5C3D6";
const NEX_ACCENT = "#FF7200";
const NEX_GOLD = "#C6A15B";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

function routeFor(kind: ChatCategoryKind): string {
  switch (kind) {
    case "plain":
      return "/nex-native/chat-themes-library/plain";
    case "small":
      return "/nex-native/chat-themes-library/small";
    case "full-image":
      return "/nex-native/chat-themes-library/full-image";
  }
}

export default function ChatThemesLibraryHubPage(): React.ReactElement {
  return (
    <>
      <style>{`html, body { background: ${NEX_BG}; }`}</style>
      <main
        data-nex-chat-themes-hub
        style={{
          position: "absolute",
          inset: 0,
          background: NEX_BG,
          color: NEX_INK,
          fontFamily: SANS,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          padding:
            "calc(env(safe-area-inset-top, 0px) + 14px) 20px calc(env(safe-area-inset-bottom, 0px) + 14px)",
          boxSizing: "border-box",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 12,
            flexShrink: 0,
          }}
        >
          <Link
            href="/nex-native/chat"
            aria-label="Back to chat"
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "#000000",
              color: "#FFFFFF",
              display: "grid",
              placeItems: "center",
              textDecoration: "none",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.45)",
            }}
          >
            <svg
              width={14}
              height={14}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M19 12H5" />
              <path d="M12 19l-7-7 7-7" />
            </svg>
          </Link>
          <div style={{ flex: 1 }} />
        </header>

        <section
          style={{
            flex: "0 0 auto",
            paddingBottom: 14,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 11,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: NEX_GOLD,
              fontWeight: 800,
            }}
          >
            NEX Chat Themes
          </p>
          <h1
            style={{
              margin: "6px 0 0",
              fontSize: 24,
              fontWeight: 700,
              color: NEX_ACCENT,
              textShadow: "0 2px 10px rgba(0, 0, 0, 0.6)",
            }}
          >
            Choose a background style
          </h1>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: 13,
              color: NEX_INK_DIM,
              lineHeight: 1.45,
            }}
          >
            Three libraries, one picker. Pick a style to open its library.
          </p>
        </section>

        <ul
          data-nex-chat-themes-hub-grid
          style={{
            margin: 0,
            padding: 0,
            listStyle: "none",
            flex: 1,
            display: "grid",
            gridTemplateRows: "repeat(3, minmax(0, 1fr))",
            gap: 14,
            minHeight: 0,
          }}
        >
          {CHAT_CATEGORY_KINDS.map((kind) => (
            <li key={kind} style={{ minHeight: 0 }}>
              <Link
                href={routeFor(kind)}
                data-nex-chat-themes-hub-card={kind}
                aria-label={`Open ${CHAT_CATEGORY_LABEL[kind]} library`}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  gap: 6,
                  width: "100%",
                  height: "100%",
                  borderRadius: 16,
                  padding: "18px 18px",
                  background:
                    "linear-gradient(135deg, rgba(198, 161, 91, 0.14) 0%, rgba(2, 9, 20, 0.6) 100%)",
                  border: `1px solid ${NEX_GOLD}`,
                  color: NEX_INK,
                  textDecoration: "none",
                  boxShadow: "0 6px 20px rgba(0, 0, 0, 0.45)",
                  boxSizing: "border-box",
                  overflow: "hidden",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                    color: NEX_GOLD,
                    fontWeight: 800,
                  }}
                >
                  Open library
                </span>
                <span
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: NEX_ACCENT,
                    lineHeight: 1.1,
                  }}
                >
                  {CHAT_CATEGORY_LABEL[kind]}
                </span>
                <span
                  style={{
                    fontSize: 13,
                    color: NEX_INK_DIM,
                    lineHeight: 1.45,
                  }}
                >
                  {CHAT_CATEGORY_HINT[kind]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
