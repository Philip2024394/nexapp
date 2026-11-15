// src/app/nex-native/subscription/return/page.tsx
//
// Stripe Checkout RETURN page · agreed-journey #13 (Seller
// Subscription) · owner-authorised engineering pass 2026-11-15.
//
// Purpose
// -----------------------------------------------------------------
// After the seller completes (or is redirected back from) a Stripe
// Checkout session for the single NEX Shop subscription, Stripe
// redirects the browser here with the Checkout Session id. This page
// must honestly represent one of three states — never fake success:
//
//   1. Entitlement already landed (webhook fired before redirect, or
//      webhook arrives while we're polling) → "Subscription active"
//      + CTA to /nex-native/manage.
//   2. Entitlement NOT yet landed (common in the first ~30s because
//      Stripe's webhook has to round-trip to the app) → honest
//      "we're confirming your payment with Stripe" copy + auto-poll
//      every 3s for up to 60s via the client component.
//   3. Still not landed after the polling window → honest "still
//      processing · we'll email you" copy + support CTA. No fake
//      success state ever (NEX honesty rule).
//
// Implementation
// -----------------------------------------------------------------
// This file is a Server Component that:
//   · requires an authenticated NEX session · redirects unauthenticated
//     visitors to /sign-in with next=<this page> so they return here
//     after signing back in (common when Stripe's hosted page kept
//     them long enough for the session cookie to rotate).
//   · reads the current nex_account.shop_tier server-side on every
//     request so the "active" state is derived from the database,
//     NEVER from a Stripe URL param (which could be forged).
//   · hands off polling to the client component below which calls
//     router.refresh() every 3s until either tier becomes 'paid' OR
//     the 60s window expires. The server read on refresh re-derives
//     state so the UI can't drift from truth.
//
// Deliberately NOT done here
// -----------------------------------------------------------------
//   · No Stripe API call from this page. Reading Stripe directly
//     would tempt a code path that bypasses the sealed webhook
//     entitlement writer. The webhook is the single source of truth
//     for "paid" state.
//   · No entitlement write. Only the sealed Stripe webhook may write
//     shop_tier.
//
// Security
// -----------------------------------------------------------------
//   · session_id in the URL is accepted purely as a transparency
//     breadcrumb (shown in support copy). It is NOT trusted for state.
//   · Because the page reads shop_tier via the service-role client
//     keyed on the AUTHENTICATED user, a forged session_id in the
//     URL cannot grant access to another account's tier.

import type * as React from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { resolveShopTier } from "@/lib/nex-native/billing/shop-tier-enforcement";
import { SubscriptionReturnPoller } from "./_poller-client";

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
  success: "#8FD694",
  warn: "#F2C94C",
};

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

// How long the client auto-poller stays active before surrendering to
// the "still processing" state. Owner directive 2026-11-15 · 60s cap.
const POLL_WINDOW_MS = 60_000;
const POLL_INTERVAL_MS = 3_000;

interface PageProps {
  searchParams: Promise<{ session_id?: string }>;
}

export default async function SubscriptionReturnPage(
  props: PageProps,
): Promise<React.JSX.Element> {
  const sp = await props.searchParams;
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    const next = encodeURIComponent(
      `/nex-native/subscription/return${sp.session_id ? `?session_id=${encodeURIComponent(sp.session_id)}` : ""}`,
    );
    redirect(`/nex-native/sign-in?next=${next}`);
  }

  // Re-read shop_tier from the admin client so we see the webhook's
  // write if it has landed. session.account would be stale by the
  // seconds it took Stripe to redirect back. We select only the
  // `shop_tier` column because it isn't surfaced on the typed
  // NexAccountRow interface · the column is managed by the sealed
  // billing stack and read via explicit queries.
  let dbTier: string | null = null;
  try {
    const { data } = await nexSupabaseAdmin
      .from("nex_account")
      .select("shop_tier")
      .eq("id", session.account.id)
      .maybeSingle();
    const row = (data ?? null) as { shop_tier: string | null } | null;
    dbTier = row?.shop_tier ?? null;
  } catch {
    // Fail closed · treat as pending. The poller continues and will
    // re-run this read on the next refresh.
    dbTier = null;
  }
  const effectiveTier = resolveShopTier(dbTier);
  const isActive = effectiveTier === "shop";

  const sessionId = typeof sp.session_id === "string" ? sp.session_id : null;
  const sessionIdShort = sessionId ? sessionId.slice(0, 20) + "…" : null;

  return (
    <main
      data-nex-subscription-return-root
      data-nex-subscription-state={isActive ? "active" : "pending"}
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
        {isActive ? <ActiveState /> : (
          <PendingState
            sessionIdShort={sessionIdShort}
          />
        )}
      </div>

      {/* Client poller · runs ONLY when state is pending. Server re-
          derives state on each refresh so the client can't confuse
          the UI into showing "active" without a DB write. */}
      {!isActive && (
        <SubscriptionReturnPoller
          intervalMs={POLL_INTERVAL_MS}
          windowMs={POLL_WINDOW_MS}
        />
      )}
    </main>
  );
}

function ActiveState(): React.JSX.Element {
  return (
    <>
      <h1
        data-nex-subscription-return-heading="active"
        style={{
          margin: 0,
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: "-0.01em",
          color: PALETTE.success,
        }}
      >
        Subscription active
      </h1>
      <p
        style={{
          margin: "10px 0 0",
          fontSize: 14,
          lineHeight: 1.5,
          color: PALETTE.textMuted,
        }}
      >
        Payment confirmed by Stripe. Your Shop is now on the paid plan
        · unlimited products, full gallery &amp; video uploads, and
        every Shop-tier feature is unlocked for your account.
      </p>

      <Link
        href="/nex-native/manage"
        data-nex-subscription-return-cta="manage"
        style={ctaPrimaryStyle}
      >
        Open your Shop
      </Link>

      <p
        style={{
          margin: "16px 0 0",
          fontSize: 12,
          color: PALETTE.textDim,
          lineHeight: 1.5,
        }}
      >
        Need to cancel or switch plans? You can do that any time from{" "}
        <Link
          href="/nex-native/settings/tier"
          style={{ color: PALETTE.accent, textDecoration: "none" }}
        >
          Settings → Subscription
        </Link>
        .
      </p>
    </>
  );
}

function PendingState({
  sessionIdShort,
}: {
  sessionIdShort: string | null;
}): React.JSX.Element {
  return (
    <>
      <h1
        data-nex-subscription-return-heading="pending"
        style={{
          margin: 0,
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: "-0.01em",
          color: PALETTE.warn,
        }}
      >
        Confirming your payment
      </h1>
      <p
        style={{
          margin: "10px 0 0",
          fontSize: 14,
          lineHeight: 1.5,
          color: PALETTE.textMuted,
        }}
      >
        We&apos;re confirming your payment with Stripe. This usually
        takes a few seconds · we&apos;ll update this page automatically
        the moment your Shop plan activates.
      </p>

      {/* 60s-window note · honest. After the window the poller stops
          and renders the longer-wait help text server-side on the
          next refresh (data-nex-subscription-return-poll="expired"
          attribute toggled below the fold by the client). */}
      <div
        data-nex-subscription-return-live-note
        style={{
          margin: "18px 0 0",
          padding: "12px 14px",
          borderRadius: 10,
          border: `1px dashed ${PALETTE.cardBorder}`,
          fontSize: 13,
          color: PALETTE.textMuted,
          lineHeight: 1.5,
        }}
      >
        <strong style={{ color: PALETTE.text }}>What happens next</strong>
        <br />
        · Stripe tells us the subscription is live (usually under 10
        seconds).
        <br />
        · We mark your Shop as paid and reveal the full feature set.
        <br />· You stay on this page the whole time · no action needed.
      </div>

      <div
        data-nex-subscription-return-poll="expired"
        hidden
        style={{
          margin: "18px 0 0",
          padding: "12px 14px",
          borderRadius: 10,
          border: `1px solid ${PALETTE.warn}`,
          background: "rgba(242,201,76,0.08)",
          fontSize: 13,
          color: PALETTE.text,
          lineHeight: 1.5,
        }}
      >
        <strong style={{ color: PALETTE.warn }}>Still processing</strong>
        <br />
        Stripe is taking longer than usual. You can safely close this
        page · we&apos;ll email you the moment your plan activates. If
        it still hasn&apos;t landed in a few minutes,{" "}
        <Link
          href="/nex-native/nex-1"
          style={{ color: PALETTE.accent }}
        >
          contact support
        </Link>{" "}
        and we&apos;ll chase it with Stripe directly.
      </div>

      {sessionIdShort ? (
        <p
          data-nex-subscription-return-session-id
          style={{
            margin: "14px 0 0",
            fontSize: 11,
            color: PALETTE.textDim,
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          }}
        >
          Reference: {sessionIdShort}
        </p>
      ) : null}

      <div style={{ marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link
          href="/nex-native/manage"
          data-nex-subscription-return-cta="manage"
          style={ctaSecondaryStyle}
        >
          Go to your Shop
        </Link>
        <Link
          href="/nex-native/nex-1"
          data-nex-subscription-return-cta="support"
          style={ctaGhostStyle}
        >
          Contact support
        </Link>
      </div>
    </>
  );
}

const ctaPrimaryStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  marginTop: 20,
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
};

const ctaSecondaryStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "10px 18px",
  borderRadius: 999,
  background: "rgba(198,161,91,0.14)",
  color: PALETTE.accent,
  fontSize: 13,
  fontWeight: 700,
  textDecoration: "none",
  border: `1px solid ${PALETTE.cardBorder}`,
};

const ctaGhostStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "10px 18px",
  borderRadius: 999,
  background: "transparent",
  color: PALETTE.textMuted,
  fontSize: 13,
  fontWeight: 700,
  textDecoration: "none",
  border: `1px solid ${PALETTE.cardBorder}`,
};
