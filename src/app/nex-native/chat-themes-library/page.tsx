// src/app/nex-native/chat-themes-library/page.tsx
//
// NEX Chat Themes · PRIMARY ENTRY ROUTE.
// Owner-authorised 2026-11-02 (revision 4) · entry hero + carousel.
// -----------------------------------------------------------------------------
// Entry surface for the paid chat theme library. Renders a device-mock
// hero preview of the actively-selected theme + a horizontal carousel
// of highlighted themes + the "Join Library" subscription CTA +
// "View full library" that opens the paginated grid at /all.
//
// Scope:
//   · 5 FREE chat theme tiles on /nex-native/free-chat untouched.
//   · Prior prototype under `marketplace-prototype/` left on disk ·
//     not rendered from here · reversible via git.
//   · Zero DB writes · zero migrations.
//   · Buy / Join buttons open the shared placeholder sheet · no
//     Stripe calls fire from this surface today.

import type * as React from "react";
import { EntryClient } from "./_entry-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Owner directive 2026-11-03 · route through `--nex-world-drawer-bg`
// so Ireland paints its sealed Emerald #123D2B · Worldwide + Indonesia
// inherit navy via the fallback. Prior revision used
// `--nex-world-background-base` which isn't emitted anywhere, so every
// identity rendered as navy.
const NEX_BG = "var(--nex-world-drawer-bg, #020914)";
const NEX_TEXT = "#F2F5F8";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export default function ChatThemesLibraryPage(): React.ReactElement {
  return (
    <>
      {/* Owner directive 2026-11-03 · drop !important so the ≥500px
          country-backdrop rule in nex-native.css wins on desktop +
          tablet · the Ireland sunset studio paints behind the phone
          frame. On <500px the <main> below is position:absolute
          inset:0 and fills the viewport, so the body background is
          only visible during the brief initial-paint window. */}
      <style>{`html, body { background: ${NEX_BG}; }`}</style>
      <main
        data-nex-chat-themes-library
        style={{
          position: "absolute",
          inset: 0,
          background: NEX_BG,
          color: NEX_TEXT,
          fontFamily: SANS,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          padding:
            "calc(env(safe-area-inset-top, 0px) + 14px) 20px calc(env(safe-area-inset-bottom, 0px) + 14px)",
          boxSizing: "border-box",
        }}
      >
        <EntryClient />
      </main>
    </>
  );
}
