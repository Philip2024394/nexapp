// src/app/nex-native/not-found.tsx
//
// NEX nex-native · dark-theme 404 fallback.
// -----------------------------------------------------------------
// Owner-authorised 2026-11-16 (Stream C · B5 gap-closure).
//
// Scope
// -----------------------------------------------------------------
// This file is the Next.js `not-found.tsx` convention: it renders
// whenever a server component under /nex-native/* calls `notFound()`
// AND the segment tree does not provide a more-specific not-found.
// Prior to this pass the root app not-found rendered in the default
// off-brand style — a light "404 - This page could not be found."
// against the sealed dark `.nex-native-stage` frame — which read as
// a crash state.
//
// What this does NOT break
// -----------------------------------------------------------------
//   · The /[businessSlug] catch-all stays intact · requests like
//     `/nex-native/this-does-not-exist` STILL route to
//     [businessSlug]/page.tsx, which decides on its own whether to
//     render a public shop page or call notFound(). This file is for
//     TRULY-unmatched paths like `/nex-native/x/y/z` where no
//     segment matches.
//   · Valid shop-slug 404s (slug route matched, no shop exists)
//     surface here because [businessSlug]/page.tsx calls notFound().
//   · NexNativeShell is NOT re-wrapped · the surrounding
//     src/app/nex-native/layout.tsx already applies the sealed
//     `.nex-native-stage > .nex-native-frame` shell (sealed
//     2026-11-06 phone-frame rule). Wrapping here would double-apply
//     the world stylesheet.
//
// CTA target
// -----------------------------------------------------------------
// `/nex-native/home` is a sealed permanentRedirect to
// `/nex-native/contacts` (see home/page.tsx header note). Linking to
// /home therefore keeps the CTA honest: a signed-in user lands on
// Contacts; a signed-out user falls through to the splash chain
// which reaches /free-chat?show-themes=1. That matches the owner's
// "back to NEX" intent without this file having to duplicate the
// session-routing logic.

import Link from "next/link";
import type * as React from "react";

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

const PALETTE = {
  bg: "var(--nex-world-drawer-bg, #123D2B)",
  text: "#F2F5F8",
  textMuted: "#B5C3D6",
  accent: "var(--nex-world-secondary, #C6A15B)",
  cream: "var(--nex-world-cream, #FAF8F4)",
  cardBorder: "rgba(198, 161, 91, 0.35)",
};

export default function NexNativeNotFound(): React.JSX.Element {
  return (
    <>
      <style>{`html, body { background: ${PALETTE.bg}; }`}</style>
      <main
        data-nex-native-not-found
        aria-labelledby="nex-native-not-found-heading"
        style={{
          minHeight: "100dvh",
          background: PALETTE.bg,
          color: PALETTE.text,
          fontFamily: SANS,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "calc(env(safe-area-inset-top, 0px) + 32px) 20px 48px",
        }}
      >
        <div
          style={{
            maxWidth: 420,
            width: "100%",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            gap: 14,
            alignItems: "center",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              fontSize: 48,
              fontWeight: 800,
              letterSpacing: "0.08em",
              color: PALETTE.accent,
              lineHeight: 1,
            }}
          >
            404
          </span>
          <h1
            id="nex-native-not-found-heading"
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 700,
              color: PALETTE.cream,
            }}
          >
            Not found
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 13.5,
              lineHeight: 1.55,
              color: PALETTE.textMuted,
            }}
          >
            The page you tried to reach doesn&apos;t exist on NEX. It may have
            moved, or the link you followed is out of date.
          </p>
          <Link
            href="/nex-native/home"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              marginTop: 6,
              borderRadius: 999,
              background: PALETTE.accent,
              color: "#0A1C14",
              padding: "10px 20px",
              fontSize: 13,
              fontWeight: 700,
              textDecoration: "none",
              minHeight: 44,
              minWidth: 160,
            }}
          >
            ← Back to NEX
          </Link>
        </div>
      </main>
    </>
  );
}
