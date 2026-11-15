// src/app/nex-native/subscription/cancel/page.tsx
//
// Stripe Checkout CANCEL page · agreed-journey #13 bail-out state.
// Owner-authorised engineering pass 2026-11-15.
//
// Purpose
// -----------------------------------------------------------------
// When a seller clicks "Back" / closes the Stripe Checkout tab,
// Stripe redirects to the configured cancel_url. This page
// acknowledges the cancellation honestly (no charge, no entitlement
// change) and offers two clear ways back:
//
//   · Try again · back to /pricing where the Subscribe button lives.
//   · Keep browsing · back to /manage (or /home if no shop yet).
//
// Nothing is written on this page. This is pure UI — the Stripe
// Checkout Session is already void when the browser arrives here.

import type * as React from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PALETTE = {
  bg: "#123D2B",
  cardBg: "rgba(10, 28, 20, 0.72)",
  cardBorder: "rgba(198, 161, 91, 0.35)",
  text: "#F2F5F8",
  textMuted: "#B5C3D6",
  textDim: "#7D9BC0",
  accent: "#C6A15B",
};

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export default async function SubscriptionCancelPage(): Promise<React.JSX.Element> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect(
      "/nex-native/sign-in?next=" +
        encodeURIComponent("/nex-native/subscription/cancel"),
    );
  }

  return (
    <main
      data-nex-subscription-cancel-root
      style={{
        minHeight: "100dvh",
        background: PALETTE.bg,
        color: PALETTE.text,
        fontFamily: SANS,
        padding:
          "calc(env(safe-area-inset-top, 0px) + 32px) 20px calc(env(safe-area-inset-bottom, 0px) + 32px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: PALETTE.cardBg,
          border: `1px solid ${PALETTE.cardBorder}`,
          borderRadius: 18,
          padding: "28px 24px",
          boxShadow:
            "0 24px 60px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255,255,255,0.03) inset",
        }}
      >
        <h1
          data-nex-subscription-cancel-heading
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: "-0.01em",
            color: PALETTE.text,
          }}
        >
          Checkout cancelled
        </h1>
        <p
          style={{
            margin: "10px 0 0",
            fontSize: 14,
            lineHeight: 1.5,
            color: PALETTE.textMuted,
          }}
        >
          No charge was made and nothing has changed on your account.
          You can come back to this any time &mdash; your Shop stays
          on the free Entry tier until a payment confirms.
        </p>

        <div
          style={{
            margin: "20px 0 0",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <Link
            href="/nex-native/pricing"
            data-nex-subscription-cancel-cta="try-again"
            style={ctaPrimaryStyle}
          >
            Try subscribing again
          </Link>
          <Link
            href="/nex-native/manage"
            data-nex-subscription-cancel-cta="manage"
            style={ctaGhostStyle}
          >
            Back to your Shop
          </Link>
        </div>

        <p
          style={{
            margin: "18px 0 0",
            fontSize: 12,
            color: PALETTE.textDim,
            lineHeight: 1.5,
          }}
        >
          Questions about pricing or features?{" "}
          <Link
            href="/nex-native/nex-1"
            style={{ color: PALETTE.accent, textDecoration: "none" }}
          >
            Contact support
          </Link>
          .
        </p>
      </div>
    </main>
  );
}

const ctaPrimaryStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  minHeight: 48,
  borderRadius: 999,
  background: "linear-gradient(180deg, #00AFFF 0%, #0374B3 100%)",
  color: "#001A2E",
  fontSize: 15,
  fontWeight: 800,
  textDecoration: "none",
  boxShadow:
    "0 12px 32px -6px rgba(0,175,255,0.55), 0 1px 0 rgba(255,255,255,0.3) inset",
} as const;

const ctaGhostStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  minHeight: 48,
  borderRadius: 999,
  background: "transparent",
  color: PALETTE.textMuted,
  fontSize: 14,
  fontWeight: 700,
  textDecoration: "none",
  border: `1px solid ${PALETTE.cardBorder}`,
} as const;
