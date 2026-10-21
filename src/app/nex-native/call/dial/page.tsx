// src/app/nex-native/call/dial/page.tsx
//
// NEX · Call · Dial pad surface.
// Owner-authorised 2026-10-21 (iteration 40).
// -----------------------------------------------------------------------------
// Minimal dial-pad entry point reached from the free-chat Call Center
// drawer. Guest-safe · no DB connections · no actual outbound dialling
// wired (the dial action is a visual placeholder today).
//
// Scope boundaries:
//   · No sealed-primitive change (no Chat Master Layout touches).
//   · No new peer-message types.
//   · No DB reads / writes.
//   · Phase A1 release hold unaffected.
//
// Future work would wire the Dial button to the existing call-engine
// surfaces (currently exposed via `/nex-native/call/preview` and
// `/nex-native/call/voice-preview`). For now the UI exists so the
// Call Center row doesn't dead-end on a 404.

import type * as React from "react";
import Link from "next/link";
import { DialPadClient } from "./_dial-pad-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "#020914",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMute: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  green: "#16D66B",
};

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export default function DialPadPage(): React.ReactElement {
  return (
    <>
      <style>{`html, body { background: ${NEX.bg} !important; }`}</style>
      <main
        data-nex-call-dial-root
        style={{
          position: "absolute",
          inset: 0,
          background: NEX.bg,
          color: NEX.text,
          fontFamily: SANS,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <header
          style={{
            padding:
              "calc(env(safe-area-inset-top, 0px) + 14px) 14px 12px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            borderBottom: `1px solid rgba(0, 175, 255, 0.14)`,
          }}
        >
          <Link
            href="/nex-native/free-chat"
            aria-label="Back"
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
              NEX
            </div>
            <h1
              style={{
                margin: "2px 0 0",
                fontSize: 18,
                fontWeight: 800,
                color: NEX.text,
                letterSpacing: "-0.01em",
              }}
            >
              Dial pad
            </h1>
          </div>
        </header>

        <DialPadClient />
      </main>
    </>
  );
}
