// src/app/nex-native/creator/subscribe/page.tsx
//
// NEX Creator · plan picker. Owner directive 2026-11-04 · Phase U Option A.
//
// Two plan cards (€4.99/mo + €49/yr). Both "Start 7-day trial" buttons
// route to /coming-soon?feature=creator-subscribe under the HOLD. When
// §G.1 + §G.8 + §I decisions resolve and Phase 1A is authorised, the
// button href swaps for a server action that creates a Stripe Checkout
// session. The UI does not change at that point.

import Link from "next/link";
import { NexPageHeader } from "../../_page-header";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { getAccountById } from "@/lib/nex-native/account-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IRELAND = {
  drawerBg: "var(--nex-world-drawer-bg, #123D2B)",
  primary: "var(--nex-world-primary, #1B5138)",
  secondary: "var(--nex-world-secondary, #C6A15B)",
  primaryInk: "var(--nex-world-primary-ink, #AFC5B5)",
  textPrimary: "#F2F5F8",
  textMuted: "rgba(175, 197, 181, 0.72)",
  panel: "rgba(27, 81, 56, 0.55)",
  panelSoft: "rgba(27, 81, 56, 0.35)",
  borderSoft: "rgba(198, 161, 91, 0.35)",
  borderStrong: "rgba(198, 161, 91, 0.55)",
};

export default async function CreatorSubscribePage() {
  const session = await resolveSessionWithDevOverride();
  const account = session ? await getAccountById(session.account.id) : null;
  const nexHandle = account?.nex_handle ?? null;

  return (
    <main
      data-nex-creator-subscribe
      style={{
        minHeight: "100dvh",
        background: IRELAND.drawerBg,
        color: IRELAND.textPrimary,
        padding: "calc(env(safe-area-inset-top,0) + 16px) 20px 60px",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <NexPageHeader
          dataScope="creator-subscribe"
          hideSearch
          brandSlot={
            nexHandle ? (
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: IRELAND.secondary,
                  letterSpacing: "-0.01em",
                  fontVariantNumeric: "tabular-nums",
                }}
                aria-label={`Your NEX ID is ${nexHandle}`}
              >
                {nexHandle.charAt(0).toUpperCase() + nexHandle.slice(1)}
              </span>
            ) : null
          }
        />

        <div style={{ margin: "16px 0 8px" }}>
          <Link
            href="/nex-native/creator/join"
            style={{
              color: IRELAND.secondary,
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            ← Back to Creator
          </Link>
        </div>

        <header style={{ margin: "20px 0 24px" }}>
          <h1
            style={{
              margin: 0,
              fontSize: 26,
              fontWeight: 800,
              letterSpacing: "-0.01em",
            }}
          >
            Choose your plan
          </h1>
          <p
            style={{
              margin: "10px 0 0",
              fontSize: 14,
              color: IRELAND.primaryInk,
              lineHeight: 1.55,
              opacity: 0.95,
            }}
          >
            Monthly or annual. Both include the same features. Cancel any time.
          </p>
        </header>

        {/* Plan · Monthly (primary) */}
        <section
          data-nex-creator-plan="monthly"
          style={{
            margin: "0 0 14px",
            padding: "22px 22px",
            borderRadius: 16,
            background: IRELAND.panel,
            border: `2px solid ${IRELAND.borderStrong}`,
            boxShadow: `0 4px 14px ${IRELAND.secondary}22`,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 8,
              marginBottom: 6,
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: IRELAND.secondary,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              Monthly
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 38, fontWeight: 900, color: IRELAND.textPrimary, letterSpacing: "-0.02em" }}>
              €4.99
            </span>
            <span style={{ fontSize: 14, color: IRELAND.primaryInk, opacity: 0.85 }}>
              per month
            </span>
          </div>
          <ul
            style={{
              margin: "0 0 20px",
              padding: 0,
              listStyle: "none",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              fontSize: 13,
              color: IRELAND.textPrimary,
            }}
          >
            <li>7-day free trial</li>
            <li>Cancel anytime</li>
            <li>All Creator features included</li>
          </ul>
          <Link
            href="/nex-native/coming-soon?feature=creator-subscribe"
            data-nex-creator-plan-cta="monthly"
            style={{
              display: "block",
              padding: "14px 20px",
              borderRadius: 999,
              background: IRELAND.secondary,
              color: IRELAND.drawerBg,
              textDecoration: "none",
              textAlign: "center",
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: "0.02em",
              textTransform: "uppercase",
              boxShadow: `0 4px 14px ${IRELAND.secondary}33`,
            }}
          >
            Start 7-day trial →
          </Link>
        </section>

        {/* Plan · Annual (secondary) */}
        <section
          data-nex-creator-plan="annual"
          style={{
            margin: "0 0 20px",
            padding: "22px 22px",
            borderRadius: 16,
            background: IRELAND.panelSoft,
            border: `1px solid ${IRELAND.borderSoft}`,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 8,
              marginBottom: 6,
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: IRELAND.secondary,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              Annual
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: IRELAND.drawerBg,
                background: IRELAND.secondary,
                padding: "2px 8px",
                borderRadius: 999,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              Save 17%
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 38, fontWeight: 900, color: IRELAND.textPrimary, letterSpacing: "-0.02em" }}>
              €49
            </span>
            <span style={{ fontSize: 14, color: IRELAND.primaryInk, opacity: 0.85 }}>
              per year
            </span>
          </div>
          <ul
            style={{
              margin: "0 0 20px",
              padding: 0,
              listStyle: "none",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              fontSize: 13,
              color: IRELAND.textPrimary,
            }}
          >
            <li>7-day free trial</li>
            <li>Billed once annually · ~€4.08/month</li>
            <li>All Creator features included</li>
          </ul>
          <Link
            href="/nex-native/coming-soon?feature=creator-subscribe"
            data-nex-creator-plan-cta="annual"
            style={{
              display: "block",
              padding: "14px 20px",
              borderRadius: 999,
              background: "transparent",
              color: IRELAND.textPrimary,
              border: `1.5px solid ${IRELAND.borderSoft}`,
              textDecoration: "none",
              textAlign: "center",
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: "0.02em",
              textTransform: "uppercase",
            }}
          >
            Start 7-day trial →
          </Link>
        </section>

        <section
          style={{
            margin: "20px 0 0",
            padding: "14px 16px",
            borderRadius: 12,
            background: "rgba(255,255,255,0.03)",
          }}
        >
          <h3
            style={{
              margin: "0 0 10px",
              fontSize: 11,
              fontWeight: 800,
              color: IRELAND.secondary,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            Both plans include
          </h3>
          <ul
            style={{
              margin: 0,
              padding: 0,
              listStyle: "none",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              fontSize: 13,
              color: IRELAND.textPrimary,
            }}
          >
            <li>• Creator profile · badge · fan support</li>
            <li>• 0% NEX commission on earnings</li>
            <li>• Cancel any time</li>
          </ul>
        </section>

        <p
          style={{
            margin: "20px auto 0",
            maxWidth: 440,
            fontSize: 11,
            color: IRELAND.textMuted,
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          Pay with Stripe. NEX invoice from Ireland · VAT inclusive.
          Payment provider fees apply from Stripe directly.
        </p>
      </div>
    </main>
  );
}
