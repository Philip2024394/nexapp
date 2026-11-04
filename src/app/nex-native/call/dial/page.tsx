// src/app/nex-native/call/dial/page.tsx
//
// NEX Ireland · Dial pad surface · world-class rewrite.
// Owner-authorised 2026-11-04 later-same-day · retired the prior
// cyan/navy chrome in favour of the sealed Ireland world palette.
// -----------------------------------------------------------------------------
// Visual language (Ireland):
//   · Background  · desktop/tablet inherits the sealed Ireland studio
//                   PNG via the global --nex-world-desktop-backdrop
//                   rule in nex-native.css:156-187 · DO NOT override
//                   html/body background here (sealed 2026-10-26).
//   · Inner stage · deep emerald (--nex-world-drawer-bg · #123D2B)
//   · Headings    · cream (#F2F5F8)
//   · Primary ink · sage (--nex-world-primary-ink · #AFC5B5)
//   · Accent      · NEX gold (--nex-world-secondary · #C6A15B)
//   · Call button · NEX orange (--nex-kp-accent · #FF7200)
//
// Scope boundaries unchanged:
//   · Guest-safe · no DB · no outbound-call wiring.
//   · Dial button toasts honestly ("preview · no outbound call wired").
//   · Reached from the free-chat Call Center drawer, the attach panel,
//     and the /call-centre decision page (Keypad tile inside the free-
//     chat call surface also routes here).

import type * as React from "react";
import Link from "next/link";
import { DialPadClient } from "./_dial-pad-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IRELAND = {
  drawerBg: "var(--nex-world-drawer-bg, #123D2B)",
  secondary: "var(--nex-world-secondary, #C6A15B)",
  primaryInk: "var(--nex-world-primary-ink, #AFC5B5)",
  heatRim: "var(--nex-kp-accent, #FF7200)",
  heatRimFaint: "rgba(255, 114, 0, 0.14)",
  secondaryFaint: "rgba(198, 161, 91, 0.14)",
  text: "#F2F5F8",
  panelBorder: "rgba(198, 161, 91, 0.3)",
};

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export default function DialPadPage(): React.ReactElement {
  return (
    <>
      {/* Scroll-lock only · NEVER override html/body background ·
          the sealed Ireland desktop backdrop must flow through on
          viewports ≥500px (nex-native.css:156-187). */}
      <style>{`
        html, body {
          margin: 0;
          padding: 0;
          height: 100%;
          overflow: hidden;
          overscroll-behavior: none;
        }
      `}</style>

      <main
        data-nex-call-dial-root
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(900px 600px at 50% -10%, ${IRELAND.secondaryFaint}, transparent 55%),
            radial-gradient(800px 600px at 50% 110%, ${IRELAND.heatRimFaint}, transparent 55%),
            ${IRELAND.drawerBg}
          `,
          color: IRELAND.text,
          fontFamily: SANS,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <header
          data-nex-call-dial-header
          style={{
            padding:
              "calc(env(safe-area-inset-top, 0px) + 14px) 18px 10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <Link
            href="/nex-native/call-centre"
            aria-label="Back to Call Centre"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 10px",
              borderRadius: 999,
              background: "rgba(2, 9, 20, 0.35)",
              border: `1px solid ${IRELAND.panelBorder}`,
              color: IRELAND.secondary,
              fontSize: 12,
              fontWeight: 700,
              textDecoration: "none",
              lineHeight: 1,
            }}
          >
            <span aria-hidden>←</span>
            <span>Back</span>
          </Link>

          <div
            aria-hidden
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: IRELAND.secondary,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              opacity: 0.85,
            }}
          >
            Dial pad
          </div>

          <span
            aria-hidden
            style={{ fontSize: 22, lineHeight: 1, color: IRELAND.secondary, opacity: 0.9 }}
          >
            ☘
          </span>
        </header>

        <DialPadClient />
      </main>
    </>
  );
}
