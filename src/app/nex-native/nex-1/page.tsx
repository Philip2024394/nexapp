// src/app/nex-native/nex-1/page.tsx
//
// NEX 1 · support chat surface · owner-sealed 2026-11-09.
//
// Users land here from the NEX 1 row in the side drawer. Chat-style
// interface with a welcome bubble from NEX Support on first load.
// Real two-way messaging transport is a follow-up build · the
// composer is visually present but Send is disabled until the
// support reply channel is wired. No fake success states.

import type * as React from "react";
import Link from "next/link";
import { Nex1ChatClient } from "./_client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

const PALETTE = {
  bg: "#061710",
  text: "#F2F5F8",
  textMuted: "#B5C3D6",
  accent: "#C6A15B",
  cardBorder: "rgba(198, 161, 91, 0.35)",
};

export default function Nex1SupportPage(): React.JSX.Element {
  return (
    <>
      <style>{`
        html, body { height: 100%; overflow: hidden; }
        .nex-native-frame {
          background: ${PALETTE.bg} !important;
          overflow: hidden !important;
        }
      `}</style>
      <div
        data-nex-1-page
        style={{
          height: "100%",
          overflow: "hidden",
          background: PALETTE.bg,
          color: PALETTE.text,
          fontFamily: SANS,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <header
          data-nex-1-header
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding:
              "calc(env(safe-area-inset-top, 0px) + 10px) 14px 10px",
            borderBottom: `1px solid ${PALETTE.cardBorder}`,
            background: PALETTE.bg,
          }}
        >
          <Link
            href="/nex-native/free-chat"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 10px",
              fontSize: 11,
              fontWeight: 700,
              color: PALETTE.accent,
              textDecoration: "none",
              border: `1px solid ${PALETTE.cardBorder}`,
              borderRadius: 999,
            }}
          >
            ← Back
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              aria-hidden
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: PALETTE.accent,
                color: "#061710",
                display: "grid",
                placeItems: "center",
                fontSize: 14,
                fontWeight: 900,
              }}
            >
              1
            </span>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: 0.2,
                  color: PALETTE.text,
                }}
              >
                NEX 1
              </span>
              <span
                style={{
                  fontSize: 10,
                  color: PALETTE.textMuted,
                  letterSpacing: 0.4,
                }}
              >
                Support · online
              </span>
            </div>
          </div>
          <span style={{ width: 54 }} aria-hidden />
        </header>

        <Nex1ChatClient />
      </div>
    </>
  );
}
