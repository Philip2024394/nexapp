// src/app/nex-native/nex-1/page.tsx
//
// NEX 1 · support chat surface · owner-sealed 2026-11-10 revision 2.
//
// Three regions stacked vertically inside the phone frame:
//   · Header · static · NEX wordmark left + "Support · online" + red
//     close chip on the right (no Back button per owner directive).
//   · Messages · scrolls internally.
//   · Composer · static footer (keypad active).
//
// Viewport-locked via `height: 100dvh + overflow: hidden`. Dynamic-
// viewport-height means iOS Safari naturally shrinks the page when
// the keyboard pops, so the composer still sits above the keypad
// without needing the body to scroll.

import type * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { Nex1ChatClient } from "./_client";
import { Nex1HeaderSubtitle } from "./_header-subtitle";

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
  danger: "#8B0000",
  dangerBorder: "#6B0E0E",
};

export default function Nex1SupportPage(): React.JSX.Element {
  return (
    <>
      <style>{`
        .nex-native-frame {
          background: ${PALETTE.bg} !important;
          overflow: hidden !important;
        }
      `}</style>
      <div
        data-nex-1-page
        style={{
          // Owner directive 2026-11-10 revision 3 · `position:absolute
          // inset:0` fills the containing phone frame exactly (624px
          // on desktop) instead of `100dvh` which referred to the
          // real viewport (e.g. 800px) and pushed the composer footer
          // beyond the frame's clip. Same pattern cart page uses.
          position: "absolute",
          inset: 0,
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
            gap: 10,
          }}
        >
          {/* Owner directive 2026-11-10 · Back button retired. Header
              now has NEX wordmark left · "Support · online" subtitle ·
              red Close chip right. */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Image
              src="/nex-native/nex-1-logo.png"
              alt="NEX"
              width={72}
              height={28}
              priority
              style={{ height: 28, width: "auto", objectFit: "contain" }}
            />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <Nex1HeaderSubtitle />
            </div>
          </div>
          <Link
            href="/nex-native/free-chat"
            aria-label="Close NEX Support"
            data-nex-1-close
            style={{
              flexShrink: 0,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: PALETTE.danger,
              border: `1px solid ${PALETTE.dangerBorder}`,
              color: "#FFFFFF",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 900,
              lineHeight: 1,
              boxShadow: "0 2px 6px rgba(0,0,0,0.45)",
            }}
          >
            ×
          </Link>
        </header>

        <Nex1ChatClient />
      </div>
    </>
  );
}
