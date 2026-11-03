// src/app/nex-native/chat-themes-library/all/page.tsx
//
// NEX Chat Themes · FULL LIBRARY ROUTE.
// Owner-authorised 2026-11-02.
// -----------------------------------------------------------------------------
// Paginated 2-per-row grid of every library theme. Reached via the
// "View full library" / "View Library" CTA on the entry page.

import type * as React from "react";
import { FullLibraryClient } from "../_full-library-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Owner directive 2026-11-03 · same fix as entry route · route through
// --nex-world-drawer-bg (Emerald on Ireland · navy fallback elsewhere).
const NEX_BG = "var(--nex-world-drawer-bg, #020914)";
const NEX_TEXT = "#F2F5F8";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export default function FullLibraryPage(): React.ReactElement {
  return (
    <>
      {/* Owner directive 2026-11-03 · no !important so the ≥500px
          country-backdrop rule in nex-native.css paints the Ireland
          desktop studio behind the phone frame on desktop + tablet. */}
      <style>{`html, body { background: ${NEX_BG}; }`}</style>
      <main
        data-nex-chat-themes-library-full
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
        <FullLibraryClient />
      </main>
    </>
  );
}
