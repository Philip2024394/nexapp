// src/app/nex-native/welcome/_welcome-shell.tsx
//
// Shared layout for the two signup-flow celebration pages:
//   · /welcome/account-active ("skip the shop" path)
//   · /welcome/shop-active    ("activated a shop" path)
//
// Owner directive 2026-11-12 · confetti burst on mount, large
// headline, short subtitle, orange "Enter NEX" CTA that routes into
// /free-chat. Rendered inside the sealed nex-native-frame so colour
// palette matches the Ireland product.

import type * as React from "react";
import Link from "next/link";
import { ConfettiBurst } from "./_confetti-burst";
import { MarkSeenPinger } from "./_mark-seen-pinger";

const IRELAND = {
  drawerBg: "var(--nex-world-drawer-bg, #123D2B)",
  textPrimary: "#F2F5F8",
  textMuted: "rgba(175, 197, 181, 0.72)",
};

interface Props {
  readonly headline: string;
  readonly subtitle: string;
  // NEX-024 · L-008 (2026-11-26) · optional Route Handler URL that the
  // client pings on mount to write the one-time-gate cookie. Account-
  // active passes "/api/nex-native/welcome/mark-seen" · shop-active
  // passes nothing (no gate semantics for that variant today).
  readonly markSeenEndpoint?: string;
}

export function WelcomeShell({
  headline,
  subtitle,
  markSeenEndpoint,
}: Props): React.JSX.Element {
  return (
    <>
      <ConfettiBurst />
      {markSeenEndpoint ? <MarkSeenPinger endpoint={markSeenEndpoint} /> : null}
      <main
        data-nex-welcome
        style={{
          height: "100%",
          maxHeight: "100dvh",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          background: IRELAND.drawerBg,
          color: IRELAND.textPrimary,
          padding:
            "calc(env(safe-area-inset-top,0) + 24px) 20px calc(env(safe-area-inset-bottom,0) + 32px)",
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
          textAlign: "center",
        }}
      >
        <div
          aria-hidden
          style={{
            width: 88,
            height: 88,
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 35% 30%, #FFE08A 0%, #D4A33A 65%, #8A5E14 100%)",
            boxShadow:
              "0 10px 32px rgba(255, 184, 80, 0.5), 0 0 48px rgba(255, 224, 138, 0.35)",
            display: "grid",
            placeItems: "center",
            fontSize: 44,
            lineHeight: 1,
            color: "#1A120A",
            fontWeight: 900,
          }}
        >
          ✓
        </div>

        <h1
          style={{
            margin: 0,
            fontSize: 26,
            fontWeight: 800,
            letterSpacing: "-0.01em",
            lineHeight: 1.2,
            maxWidth: 360,
          }}
        >
          {headline}
        </h1>

        <p
          style={{
            margin: 0,
            fontSize: 14,
            color: IRELAND.textMuted,
            lineHeight: 1.55,
            maxWidth: 320,
          }}
        >
          {subtitle}
        </p>

        <Link
          href="/nex-native/free-chat"
          style={{
            marginTop: 8,
            padding: "15px 28px",
            borderRadius: 999,
            background: "#FF7200",
            color: "#FFFFFF",
            textDecoration: "none",
            fontSize: 14,
            fontWeight: 900,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            boxShadow:
              "0 4px 14px rgba(255, 114, 0, 0.45), 0 0 20px rgba(255, 114, 0, 0.25)",
          }}
        >
          Enter NEX →
        </Link>
      </main>
    </>
  );
}
