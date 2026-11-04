// src/app/nex-native/coming-soon/page.tsx
//
// Honest placeholder for every Phase U affordance that will light up when
// §G.1 (legal entity + VAT) resolves and §G.8 (Stripe written confirmations)
// come back from Stripe. Owner directive 2026-11-04 · Phase U Option A.
//
// The page is read-only · no forms · no payment calls · no DB writes. It
// explains to the user WHAT is pending and WHY, in plain English, and shows
// a live ○/✓ status list. When a milestone resolves, flipping the booleans
// here updates every /coming-soon landing simultaneously.

import { NexPageHeader } from "../_page-header";
import { BackLink } from "../_back-link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  readonly searchParams: Promise<{ feature?: string }>;
}

const IRELAND = {
  drawerBg: "var(--nex-world-drawer-bg, #123D2B)",
  primary: "var(--nex-world-primary, #1B5138)",
  secondary: "var(--nex-world-secondary, #C6A15B)",
  primaryInk: "var(--nex-world-primary-ink, #AFC5B5)",
  textPrimary: "#F2F5F8",
  textMuted: "rgba(175, 197, 181, 0.72)",
  panel: "rgba(27, 81, 56, 0.55)",
  borderSoft: "rgba(198, 161, 91, 0.35)",
  success: "#16D66B",
};

// Owner-updated when a milestone resolves. Phase U ships with all pending.
const STATUS_ITEMS: ReadonlyArray<{ label: string; done: boolean }> = [
  { label: "Architecture specification complete", done: true },
  { label: "Stripe Connect design confirmed", done: true },
  { label: "Refund + dispute invariants sealed", done: true },
  { label: "Irish legal entity + VAT · in progress", done: false },
  { label: "Stripe written confirmations · pending", done: false },
];

const FEATURE_COPY: Record<string, { title: string; body: string }> = {
  "creator-subscribe": {
    title: "Creator membership",
    body: "€4.99 monthly / €49 annual creator membership opens as soon as NEX's Ireland legal + VAT setup finalises and Stripe confirms the platform's operating terms.",
  },
  "payment-connect-stripe": {
    title: "Connect with Stripe",
    body: "Signing up or signing in with Stripe opens when NEX's Ireland legal + VAT setup finalises. Stripe Connect Express handles the sign-up or sign-in flow when it goes live.",
  },
  "payment-connect-paypal": {
    title: "Connect with PayPal",
    body: "PayPal Commerce Platform integration opens shortly after Stripe goes live. You'll be able to sign in with your existing PayPal Business account or create one.",
  },
  "shop-checkout": {
    title: "Buyer checkout",
    body: "Shop checkout opens when NEX's Ireland legal + Stripe setup finalises. Buyers will be able to pay by card or PayPal direct to the shop owner's account.",
  },
};

export default async function ComingSoonPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const key = sp.feature ?? "";
  const copy = FEATURE_COPY[key] ?? {
    title: "Coming soon",
    body: "This step opens when NEX's Ireland legal + Stripe setup finalises. Nothing to do right now.",
  };

  return (
    <main
      data-nex-coming-soon
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
        <NexPageHeader dataScope="coming-soon" />

        <header style={{ textAlign: "center", margin: "48px 0 20px" }}>
          <div
            aria-hidden
            style={{
              fontSize: 64,
              lineHeight: 1,
              color: IRELAND.secondary,
              marginBottom: 20,
              filter: `drop-shadow(0 6px 20px ${IRELAND.secondary}33)`,
            }}
          >
            ☘
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: "-0.01em",
            }}
          >
            {copy.title}
          </h1>
          <p
            style={{
              margin: "14px auto 0",
              maxWidth: 440,
              fontSize: 15,
              color: IRELAND.primaryInk,
              lineHeight: 1.55,
              opacity: 0.95,
            }}
          >
            {copy.body}
          </p>
          <p
            style={{
              margin: "8px auto 0",
              maxWidth: 440,
              fontSize: 13,
              color: IRELAND.textMuted,
            }}
          >
            Nothing to do right now.
          </p>
        </header>

        <section
          aria-label="Setup progress"
          style={{
            margin: "28px 0 0",
            padding: "16px 18px",
            borderRadius: 14,
            background: IRELAND.panel,
            border: `1px solid ${IRELAND.borderSoft}`,
          }}
        >
          <h2
            style={{
              margin: "0 0 12px",
              fontSize: 11,
              fontWeight: 800,
              color: IRELAND.secondary,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            What's happening in the background
          </h2>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
            {STATUS_ITEMS.map((it) => (
              <li
                key={it.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: 13,
                  color: it.done ? IRELAND.textPrimary : IRELAND.textMuted,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    flexShrink: 0,
                    display: "grid",
                    placeItems: "center",
                    background: it.done ? IRELAND.success : "transparent",
                    border: it.done ? "none" : `1.5px solid ${IRELAND.borderSoft}`,
                    color: IRELAND.drawerBg,
                    fontWeight: 900,
                    fontSize: 11,
                  }}
                >
                  {it.done ? "✓" : ""}
                </span>
                <span>{it.label}</span>
              </li>
            ))}
          </ul>
        </section>

        <div style={{ margin: "32px 0 0", textAlign: "center" }}>
          <BackLink
            fallbackHref="/nex-native/creator"
            style={{
              color: IRELAND.secondary,
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            ← Back
          </BackLink>
        </div>
      </div>
    </main>
  );
}
