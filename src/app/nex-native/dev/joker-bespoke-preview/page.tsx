// src/app/nex-native/dev/joker-bespoke-preview/page.tsx
//
// NEX Theme Production · Phase A3.1 · Joker bespoke dev preview.
// --------------------------------------------------------------------------
// Owner-authorised 2026-10-19.
//
// Purpose:
//   Exercise Joker's REAL bespoke rendering path (ThemeViewerClient +
//   JokerMotionOverlay + JokerController) in a dev-only isolated preview
//   WITHOUT:
//     · modifying LIVE_WORLD_PACKAGES
//     · writing to the nex_chat_theme DB table
//     · altering any sealed Joker file (_joker-*, _viewer.tsx, etc.)
//
// How it works:
//   The sealed `/nex-native/themes/[id]/page.tsx` route resolves theme
//   assets via `chatThemeService.loadById(id)` which hits the DB. That
//   DB call is why the Phase A3 Playwright spec got a 404 for Joker.
//
//   This dev-only route takes the EXACT same ThemeViewerClient the
//   sealed route uses and feeds it a hardcoded Joker-shaped prop
//   bundle derived read-only from the sealed _joker-keypad.tsx
//   palette constants + known Joker asset paths. The bespoke rendering
//   path (joker-motion overlay, keypad, acid-green accents) runs
//   through its ACTUAL implementation.
//
// Honesty invariants:
//   · Dev-gated. Returns 404 in production unless `NEX_DEV_ROUTES=1`.
//   · Zero writes to any DB · zero mutations to LIVE_WORLD_PACKAGES.
//   · Reads NO Joker file for its runtime behaviour · ThemeViewerClient
//     is imported from its sealed location and does the real work.
//   · The hardcoded Joker props are derived from the SEALED
//     _joker-keypad.tsx values. If those sealed values drift (which
//     they should not without owner authorisation), this preview also
//     drifts · which is correct behaviour.

import { notFound } from "next/navigation";
import * as React from "react";
import ThemeViewerClient from "../../themes/[id]/_viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Hardcoded Joker props · derived from read-only inspection of
// src/app/nex-native/chat-standard/_joker-keypad.tsx (acid-green
// accent #8FFF6E + navy-black base) + the sealed Joker asset
// locations under /public/nex-themes/.
//
// A3.2 correction · sentAts MUST be ISO date strings (not display
// strings like "04:45"). The ThemeViewerClient passes these to
// code that constructs `new Date(s)` and formats via toLocale* /
// date-fns formatters · plain "04:45" parses as NaN which produced
// the "NAN UNDEFINED" header + "Invalid Date" bubble labels in the
// Phase A3.1 screenshots.
//
// Format mirrors the live route's own construction at
// `src/app/nex-native/themes/[id]/page.tsx:179-188` · fresh ISO
// strings at ~1-9 minutes before dev-request time. We fix the base
// so SSR + hydration see the same strings (same lock the live route
// applies via Bridge 97g).
const JOKER_FIXTURE_BASE_MS = Date.UTC(2026, 9, 19, 12, 0, 0); // Oct 19 2026 12:00 UTC · fixed for SSR/hydration parity
const minuteAgoIso = (minutes: number) =>
  new Date(JOKER_FIXTURE_BASE_MS - minutes * 60_000).toISOString();

const JOKER_FIXTURE_PROPS = {
  themeId: "joker",
  themeName: "Joker",
  subtitle: "Bespoke rendering path",
  accent: "#8FFF6E",
  bubbleRim: "#8FFF6E",
  composerRim: "#8FFF6E",
  wallpaperUrl: null,
  wallpaperConfig: null,
  layoutStyle: "portrait-bloom" as const,
  sentAts: {
    m1: minuteAgoIso(9),
    m2: minuteAgoIso(8),
    m3: minuteAgoIso(6),
    m4: minuteAgoIso(4),
    m5: minuteAgoIso(1),
    readEarly: minuteAgoIso(7),
    readMid: minuteAgoIso(5),
    readLate: minuteAgoIso(3),
  },
  isVenueMode: false,
  showShopSetupChooser: false,
  themeEmojis: [] as { slug: string; imageUrl: string; label: string }[],
};

export default async function JokerBespokePreviewPage(): Promise<React.JSX.Element> {
  const isDev = process.env.NODE_ENV !== "production";
  const prodOverride = process.env.NEX_DEV_ROUTES === "1";
  if (!isDev && !prodOverride) notFound();

  return (
    <>
      <style>{`
        html, body { background: #020914 !important; color: #F4F7FC; margin: 0; }
        body { font-family: Inter, system-ui, sans-serif; }
      `}</style>
      <meta name="robots" content="noindex, nofollow" />
      <main
        data-nex-joker-bespoke-preview-root
        style={{
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "20px 12px 40px",
          gap: 16,
        }}
      >
        <div style={{ maxWidth: 560, width: "100%" }}>
          <h1 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700 }}>
            Joker · bespoke renderer dev preview
          </h1>
          <p style={{ margin: 0, fontSize: 12, color: "#8BA9D1", lineHeight: 1.6 }}>
            Dev-only · exercises the real ThemeViewerClient + JokerMotionOverlay
            path with hardcoded fixtures. Zero DB writes. Zero LIVE_WORLD_PACKAGES
            mutation. Zero sealed-Joker-file changes.
          </p>
        </div>
        <div
          data-nex-joker-preview-stage
          style={{
            width: 390,
            height: 790,
            maxHeight: "calc(100dvh - 120px)",
            borderRadius: 32,
            overflow: "hidden",
            border: "1px solid rgba(143,255,110,0.35)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
          }}
        >
          {/* @ts-expect-error · ThemeViewerClient is a client component
              with a complex prop interface · the fixture-prop bundle is
              intentionally minimal and the component is expected to
              handle missing-asset defaults gracefully. */}
          <ThemeViewerClient {...JOKER_FIXTURE_PROPS} />
        </div>
      </main>
    </>
  );
}
