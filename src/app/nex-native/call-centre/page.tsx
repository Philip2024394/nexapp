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

import { BackLink } from "../_back-link";
import { CallCentreClient } from "./_client";
// Owner directive 2026-11-04 later-same-day · grid-icon button in the
// Call Centre header · opens the same 6-tile Live-worlds overlay
// (Live World · Live Ireland · Live Music · Live Food · Live Stays ·
// Live Trades) that the free-chat and contacts headers already wire.
import { CallCentreGridTrigger } from "./_grid-trigger";

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
          background: "var(--nex-world-drawer-bg, #123D2B)",
          color: "#F2F5F8",
          padding:
            "calc(env(safe-area-inset-top,0) + 16px) 20px calc(env(safe-area-inset-bottom,0) + 20px)",
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
          {/* Header row · back link on the left · grid button on the
              right (same gold-circle grid-icon pattern the contacts
              and free-chat headers use). The grid button opens the
              sealed SearchOverlay with the 6 Live-world tiles. */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              margin: "0 0 4px",
            }}
          >
            <BackLink
              fallbackHref="/nex-native/contacts"
              style={{
                color: "var(--nex-world-secondary, #C6A15B)",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              ← Back
            </BackLink>
            <CallCentreGridTrigger />
          </div>

          <header style={{ margin: "14px 0 18px", textAlign: "center" }}>
            <div
              aria-hidden
              style={{
                fontSize: 48,
                lineHeight: 1,
                marginBottom: 8,
                color: "var(--nex-world-secondary, #C6A15B)",
                filter:
                  "drop-shadow(0 6px 20px var(--nex-world-secondary-glow, rgba(198,161,91,0.35)))",
              }}
            >
              ☘
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: "-0.01em",
              }}
            >
              Call Centre
            </h1>
            <p
              style={{
                margin: "6px auto 0",
                maxWidth: 380,
                fontSize: 13,
                color: "var(--nex-world-primary-ink, #AFC5B5)",
                lineHeight: 1.5,
                opacity: 0.92,
              }}
            >
              Pick how you want to connect.
            </p>
          </header>

          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <CallCentreClient />
          </div>

          <p
            style={{
              margin: "12px auto 0",
              maxWidth: 420,
              fontSize: 10,
              color: "rgba(175, 197, 181, 0.72)",
              textAlign: "center",
              lineHeight: 1.45,
            }}
          >
            Voice and video calls use your phone's camera and microphone.
            Up to 3 friends on the same call.
          </p>
        </div>
      </main>
    </>
  );
}
