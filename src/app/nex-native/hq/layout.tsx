// src/app/nex-native/hq/layout.tsx
//
// NEX HQ parent layout · amended 2026-10-31 (round 4).
// --------------------------------------------------------------------
// Owner directive 2026-10-16 · HQ operational dashboards under
// /nex-native/hq/* opt out of the consumer desktop phone-frame.
//
// Owner directive 2026-10-31 (round 4 · HQ repair task):
//   · HQ must be a proper desktop control centre with a permanent
//     260px left navigation and a workspace on the right.
//   · HQ is desktop-only. Mobile shows a clear desktop-only message.
//   · The sidebar is mounted here (shared across every /hq/* route)
//     so the existing /hq/worlds and /hq/harvest pages keep working
//     and simply pick up the chrome.
//
// How this coexists with the sealed phone-frame:
//   The layout wraps its subtree in <div className="nex-admin-root">,
//   which the sealed `nex-native.css` already recognises as a marker
//   to lift the phone-frame clamp (lines 248-298 of nex-native.css).
//   The individual sub-page.tsx files may also apply the marker · it
//   is harmless and makes those pages work in isolation under tests.

import type * as React from "react";
import { HqNav } from "./_hq-nav";

const INK = "#F2F5F8";
const INK_DIM = "#B5C3D6";
const BG = "var(--nex-world-background-base, #020914)";
// Owner directive 2026-11-08 (round 2) · emerald HQ backdrop. The
// right-side workspace gets a layered radial-gradient tint that keeps
// the base dark but reads as HQ territory (emerald #16D66B glow in
// the top-left, falling off to the base BG). Sidebar is already tinted
// emerald in _hq-nav.tsx · this lifts the main content to match.
const WORKSPACE_BG =
  "radial-gradient(1200px 700px at 0% 0%, rgba(22,214,107,0.10), rgba(22,214,107,0) 55%), " +
  "radial-gradient(900px 600px at 100% 100%, rgba(22,214,107,0.05), rgba(22,214,107,0) 60%), " +
  "var(--nex-world-background-base, #040E09)";

export default function HqLayout({
  children,
}: {
  readonly children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="nex-admin-root">
      {/* Desktop-only visibility gate · ≥ 900px renders the full
          chrome, < 900px renders the plain desktop-only message. */}
      <style>{`
        .nex-hq-shell-desktop { display: none; }
        .nex-hq-shell-mobile  { display: flex; }
        @media (min-width: 900px) {
          .nex-hq-shell-desktop { display: flex; }
          .nex-hq-shell-mobile  { display: none; }
        }
      `}</style>

      {/* MOBILE · < 900px */}
      <main
        className="nex-hq-shell-mobile"
        style={{
          minHeight: "100dvh",
          background: BG,
          color: INK,
          padding: 28,
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          textAlign: "center",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div style={{ fontSize: 42, lineHeight: 1 }} aria-hidden>
          🖥️
        </div>
        {/* Mobile fallback uses h2 · the page-level h1 lives in the
            actual landing page (page.tsx) which is only rendered
            above 900px. Two h1 per page is an a11y smell · fixed
            2026-10-31 (round 5 real-browser test). */}
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>
          NEX HQ is desktop-only
        </h2>
        <p
          style={{
            fontSize: 13.5,
            color: INK_DIM,
            lineHeight: 1.55,
            maxWidth: 360,
            margin: 0,
          }}
        >
          Open this URL on a desktop or tablet-wide browser (900 px or
          wider) to manage worlds, countries, and platform settings.
          Normal NEX users don&rsquo;t need HQ — it&rsquo;s for platform
          administrators only.
        </p>
      </main>

      {/* DESKTOP · ≥ 900px · permanent sidebar + workspace */}
      <div
        className="nex-hq-shell-desktop"
        style={{
          minHeight: "100dvh",
          background: BG,
          color: INK,
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <HqNav />
        <main
          style={{
            flex: 1,
            minWidth: 0,
            padding: "28px 32px",
            overflow: "auto",
            background: WORKSPACE_BG,
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
