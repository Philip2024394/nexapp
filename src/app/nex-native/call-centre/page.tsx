// src/app/nex-native/call-centre/page.tsx
//
// NEX Ireland · Call Centre decision page. Owner-authorised
// 2026-11-04 later-same-day.
// -----------------------------------------------------------------------------
// Entry point for the user's camera-icon tap · lands here with three
// choices in Ireland world palette:
//
//   · Voice call    → /nex-native/calls              (wired · picks contact)
//   · Video call    → /nex-native/calls              (wired · picks contact)
//   · Camera        → /nex-native/status/create      (wired · 24h status)
//
// No new engine · every route already exists and was tested before.
// This page is the human-friendly decision layer the owner asked for:
// "selects the camera icon button and diverts to page and decides if
// wants to call or video or camera like we had built before".
//
// Everything renders through sealed --nex-world-* CSS vars so the
// Ireland identity flips the palette automatically. Under HQ identity
// the fallbacks hold.

import { CallCentreClient } from "./_client";
// Owner directive 2026-11-21 (iter 8) · the side-menu button in the
// header is the GLOBAL side-menu button + drawer · sealed
// NexPageHeader, which internally renders the black "+" trigger via
// PageHeaderDrawerButtonClient and the shared ControlDrawer. This
// supersedes:
//   · the shamrock-badge header (iter 1)
//   · the grid-icon "Discover / What's live right now?" trigger
//     (removed · iter 7)
//   · the bespoke CallCentreSideDrawerTrigger (iter 5 · retired)
// The sealed header auto-resolves session identity via
// resolveSessionWithDevOverride so the drawer identity bar matches
// every other NEX Native surface.
import { NexPageHeader } from "../_page-header";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Owner directive 2026-11-04 later-same-day · the Call Centre page
// is a single-viewport decision surface · NO scroll · the sealed
// NexPageHeader (blue NEX ping badge) is intentionally NOT mounted
// here so the surface reads as a focused action chooser, not a NEX
// identity hub. BackLink is kept for the return path.

export default async function CallCentrePage(): Promise<React.JSX.Element> {
  return (
    <>
      {/* Lock html/body scroll at the document level · matches the
          Ireland Entry page pattern · prevents iOS Safari rubber-band
          from exposing the dark bg below the fixed content. */}
      <style>{`
        html, body {
          height: 100%;
          margin: 0;
          padding: 0;
          overflow: hidden;
          overscroll-behavior: none;
        }
      `}</style>

      <main
        data-nex-call-centre
        style={{
          position: "relative",
          width: "100%",
          height: "100dvh",
          overflow: "hidden",
          // Owner directive 2026-11-21 (iter 9) · the Call Centre page
          // background matches the sealed ControlDrawer panel colour
          // (--nex-world-drawer-bg) so the page and drawer read as one
          // continuous surface when the drawer slides in. Supersedes
          // the cream page from iter 2. Hero + footer ink flipped to
          // light; tiles remain light-gray so they float as cards.
          background: "var(--nex-world-drawer-bg, #0A1526)",
          color: "#F2F5F8",
          padding:
            "calc(env(safe-area-inset-top,0) + 12px) 16px calc(env(safe-area-inset-bottom,0) + 12px)",
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            maxWidth: 560,
            width: "100%",
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            flex: 1,
            minHeight: 0,
          }}
        >
          {/* Owner directive 2026-11-21 (iter 8) · the top-right
              header is the sealed global NexPageHeader · it renders
              the global "+" side-menu button + ControlDrawer. "← Back"
              text/arrow stays removed (iter 5). */}
          <NexPageHeader dataScope="call-centre" />

          <header style={{ margin: "8px 0 10px", textAlign: "center" }}>
            {/* Owner directive 2026-11-21 · replaced the shamrock ☘
                (Ireland world mark) with a phone-handset glyph in the
                sealed keypad accent (orange). The surface is now a
                focused call-choice decision page, not an Ireland
                identity hub. */}
            <div
              aria-hidden
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 54,
                height: 54,
                marginBottom: 6,
                borderRadius: "50%",
                background:
                  "linear-gradient(140deg, var(--nex-kp-accent, #FF7200), color-mix(in srgb, var(--nex-kp-accent, #FF7200) 65%, #000))",
                color: "#FFFFFF",
                boxShadow:
                  "0 6px 18px color-mix(in srgb, var(--nex-kp-accent, #FF7200) 40%, transparent)",
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M4.5 3.5a2 2 0 0 1 2-2h2.4a1 1 0 0 1 .97.76l1.18 4.72a1 1 0 0 1-.5 1.13l-1.9 1.03a13 13 0 0 0 5.72 5.72l1.03-1.9a1 1 0 0 1 1.13-.5l4.72 1.18a1 1 0 0 1 .76.97V18a2 2 0 0 1-2 2A17.5 17.5 0 0 1 4.5 3.5z"
                  fill="currentColor"
                />
              </svg>
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: 19,
                fontWeight: 800,
                letterSpacing: "-0.01em",
                lineHeight: 1.1,
              }}
            >
              Call Centre
            </h1>
            <p
              style={{
                margin: "4px auto 0",
                maxWidth: 380,
                fontSize: 12,
                color: "var(--nex-world-primary-ink, #AFC5B5)",
                lineHeight: 1.35,
                opacity: 0.92,
              }}
            >
              Pick how you want to connect.
            </p>
          </header>

          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <CallCentreClient />
          </div>

          {/* Owner directive 2026-11-21 (iter 6) · usage blurb returns
              to the footer area · copy updated from "3 friends" to
              "3 contacts" per the same directive. mt:auto pins it to
              the floor of the phone frame. */}
          <footer
            style={{
              marginTop: "auto",
              paddingTop: 8,
              borderTop: "1px solid rgba(242, 245, 248, 0.08)",
              textAlign: "center",
            }}
          >
            <p
              style={{
                margin: "0 auto",
                maxWidth: 420,
                fontSize: 10,
                color: "rgba(242, 245, 248, 0.68)",
                lineHeight: 1.4,
              }}
            >
              Voice and video calls use your phone's camera and microphone.
              Up to 3 contacts on the same call.
            </p>
          </footer>
        </div>
      </main>
    </>
  );
}
