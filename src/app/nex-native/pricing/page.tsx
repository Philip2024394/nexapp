// src/app/nex-native/pricing/page.tsx
//
// NEX pricing page · simplified one-price-at-a-time layout · owner-sealed
// 2026-11-09 revision 2.
//
// Owner directive: "I would show one package, one price, with the
// visitor's country determining the currency automatically. Keep the
// pricing page extremely simple. The country selector should be a small
// secondary control beneath the price, not a prominent pricing table.
// Never let IP detection alone determine a legally binding billing
// price."
//
// Flow:
//   1. Server resolves the detected country from request IP headers
//      (Vercel · Cloudflare · fallback to IE/Europe).
//   2. Server renders ONE price for ONE country.
//   3. Client hydrates, reads the saved preference from localStorage if
//      any, and lets the user override via a small Change-country
//      dropdown. Selection is persisted.
//   4. Legal billing price is set at checkout · the detected display is
//      a suggestion only.

import * as React from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { CountryPricingClient } from "./_country-pricing-client";
import {
  countryToPricingKey,
  resolveSpec,
  type PricingCountry,
} from "./_pricing-data";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { UnifiedDrawer } from "@/components/nex-native/drawer/UnifiedDrawer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

const PALETTE = {
  // Owner directive 2026-11-09 · pricing page background is emerald
  // green (sealed world-primary). Replaces the earlier dark navy.
  bg: "#123D2B",
  cardBg: "rgba(10, 28, 20, 0.72)",
  cardBorder: "rgba(198, 161, 91, 0.35)",
  text: "#F2F5F8",
  textMuted: "#B5C3D6",
  textDim: "#7D9BC0",
  accent: "#C6A15B",
};

const CHAT_BLURB =
  "Private messaging, groups, contacts and notifications. No Shop membership required.";

// -----------------------------------------------------------------------------
// Country detection · suggestion only · never binding
// -----------------------------------------------------------------------------

function detectCountryFromHeaders(
  h: Awaited<ReturnType<typeof headers>>,
): PricingCountry {
  // Common edge-provider headers for client IP country.
  const vercel = h.get("x-vercel-ip-country");
  const cloudflare = h.get("cf-ipcountry");
  const raw = (vercel ?? cloudflare ?? "").toUpperCase();

  // Direct mappings for the four launch markets.
  if (raw === "GB" || raw === "UK") return "GB";
  if (raw === "US") return "US";
  if (raw === "ID") return "ID";

  // European member states → bucket into our 'IE' / Europe label. We
  // only use IE as the EUR representative because Europe-wide pricing
  // is handled under the EUR line.
  const europeIsos = new Set([
    "IE","FR","DE","ES","IT","PT","NL","BE","LU","AT","FI","GR","CY","MT",
    "SK","SI","EE","LV","LT","HR","BG","RO","HU","PL","CZ","DK","SE",
  ]);
  if (europeIsos.has(raw)) return "IE";

  // Unknown or missing → default to Europe / EUR as the baseline.
  return "IE";
}

// -----------------------------------------------------------------------------
// Page
// -----------------------------------------------------------------------------

export default async function NexPricingPage(): Promise<React.JSX.Element> {
  const h = await headers();
  const detectedCountry = detectCountryFromHeaders(h);

  // Owner directive 2026-11-09 revision 3 · if the visitor is signed in,
  // prefer their account country over the raw IP detection on first
  // paint. Account country is `nex_account.last_known_country_iso` ·
  // user-override via localStorage on the client still wins. Fail-open:
  // any read error falls through to the IP-derived default.
  // Resolve session once · used for both account-country lookup AND the
  // side-drawer trigger in the header. Null for guest viewers.
  const session = await resolveNexAppSessionFromContext().catch(() => null);

  let accountCountry: PricingCountry | null = null;
  if (session) {
    try {
      const { data: acc } = await nexSupabaseAdmin
        .from("nex_account")
        .select("last_known_country_iso")
        .eq("id", session.account.id)
        .maybeSingle();
      const iso = (acc as { last_known_country_iso: string | null } | null)
        ?.last_known_country_iso;
      if (iso && typeof iso === "string" && iso.trim().length > 0) {
        accountCountry = countryToPricingKey(iso);
      }
    } catch {
      /* silent · pricing is public · we never block the page on this */
    }
  }

  const initialCountry: PricingCountry = accountCountry ?? detectedCountry;
  const initialSpec = resolveSpec(initialCountry);

  // Owner directive 2026-11-09 · side drawer in the pricing header.
  // ControlDrawerSession is forwarded verbatim where possible · guest
  // visitors pass null and UnifiedDrawer renders the sealed guest-mode
  // drawer.
  const drawerSession = session
    ? ({
        accountId: session.account.id,
        displayName: (session.account as { display_name?: string | null }).display_name ?? null,
        handle: (session.account as { handle?: string | null }).handle ?? null,
        avatarUrl: (session.account as { avatar_url?: string | null }).avatar_url ?? null,
      } as unknown as import("@/components/nex-native/control-drawer/control-drawer-client").ControlDrawerSession)
    : null;

  return (
    <>
      <style>{`
        html, body { background: ${PALETTE.bg}; }
      `}</style>
      <main
        data-nex-pricing-page
        data-nex-pricing-detected-country={detectedCountry}
        style={{
          minHeight: "100dvh",
          background: PALETTE.bg,
          color: PALETTE.text,
          fontFamily: SANS,
          padding: "calc(env(safe-area-inset-top, 0px) + 20px) 18px 48px",
        }}
      >
        <div
          style={{
            maxWidth: 420,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          <PricingHeader drawerSession={drawerSession} />
          <Hero />
          {/* Owner directive 2026-11-09 · ChatFreeCard removed from the
              pricing page · the "NEX Chat is free" content is now only
              implied by the hero + the Chat-foundation card lives on
              elsewhere in the app. */}
          <CountryPricingClient
            initialCountry={initialCountry}
            detectedCountry={detectedCountry}
            accountCountry={accountCountry}
          />
          {/* Owner directive 2026-11-09 · IncludedCards (Vault + Chat
              Themes landscape rows) and the country/billing FooterNote
              have been retired. Replaced with a single trust-statement
              line below. */}
          <TrustNote />
        </div>
      </main>
    </>
  );
}

// -----------------------------------------------------------------------------
// Sections
// -----------------------------------------------------------------------------

function PricingHeader({
  drawerSession,
}: {
  readonly drawerSession: import("@/components/nex-native/control-drawer/control-drawer-client").ControlDrawerSession | null;
}): React.JSX.Element {
  return (
    <nav
      data-nex-pricing-header
      style={{
        // Owner directive 2026-11-09 · drawer button stays in the
        // header while the page scrolls · sticky to the top of the
        // scrollable parent (the page body) with a tinted blur so
        // text underneath stays readable.
        position: "sticky",
        top: 0,
        zIndex: 20,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        padding: "8px 0",
        background: `${PALETTE.bg}ee`,
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        marginLeft: -6,
        marginRight: -6,
        paddingLeft: 6,
        paddingRight: 6,
      }}
    >
      <Link
        href="/nex-native/vault"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "4px 10px",
          fontSize: 11,
          fontWeight: 700,
          color: PALETTE.accent,
          textDecoration: "none",
          border: `1px solid ${PALETTE.cardBorder}`,
          borderRadius: 999,
        }}
      >
        ← Back
      </Link>
      {/* Gold-circle side drawer button · mirrors the vault landing
          header pattern. Forced-dark glyph for legibility over the
          gold fill. */}
      <PricingDrawerChip drawerSession={drawerSession} />
    </nav>
  );
}

function PricingDrawerChip({
  drawerSession,
}: {
  readonly drawerSession: import("@/components/nex-native/control-drawer/control-drawer-client").ControlDrawerSession | null;
}): React.JSX.Element {
  return (
    <>
      <style>{`
        [data-nex-pricing-drawer-chip] button,
        [data-nex-pricing-drawer-chip] svg {
          color: #061710 !important;
          stroke: #061710 !important;
        }
        [data-nex-pricing-drawer-chip] svg * {
          stroke: #061710 !important;
        }
      `}</style>
      <span
        data-nex-pricing-drawer-chip
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: "#C6A15B",
          border: "1.5px solid #8B6A32",
          boxShadow:
            "0 6px 14px rgba(0, 0, 0, 0.55), 0 0 0 2px rgba(0, 0, 0, 0.2)",
        }}
      >
        <UnifiedDrawer session={drawerSession} />
      </span>
    </>
  );
}

function Hero(): React.JSX.Element {
  return (
    <section style={{ textAlign: "center", padding: "6px 4px 10px" }}>
      <h1
        style={{
          margin: 0,
          fontSize: 26,
          fontWeight: 900,
          letterSpacing: "-0.02em",
          lineHeight: 1.15,
          color: PALETTE.text,
        }}
      >
        One Shop package. Grow as you go.
      </h1>
      <p
        style={{
          margin: "12px auto 0",
          maxWidth: 360,
          fontSize: 14,
          lineHeight: 1.55,
          color: PALETTE.textMuted,
        }}
      >
        One subscription. The same features wherever you are.
      </p>
    </section>
  );
}

function ChatFreeCard(): React.JSX.Element {
  return (
    <section
      data-nex-pricing-chat-card
      style={{
        padding: 20,
        borderRadius: 16,
        background: PALETTE.cardBg,
        border: `1.5px solid ${PALETTE.cardBorder}`,
      }}
    >
      <PillLabel>Free forever</PillLabel>
      <h2
        style={{
          margin: "10px 0 6px",
          fontSize: 22,
          fontWeight: 900,
          color: PALETTE.text,
          letterSpacing: "-0.01em",
        }}
      >
        NEX Chat
      </h2>
      <div
        style={{
          marginTop: 2,
          fontSize: 18,
          fontWeight: 800,
          color: PALETTE.accent,
        }}
      >
        Free
      </div>
      <p
        style={{
          margin: "10px 0 0",
          fontSize: 13,
          lineHeight: 1.55,
          color: PALETTE.textMuted,
        }}
      >
        {CHAT_BLURB}
      </p>
    </section>
  );
}

function TrustNote(): React.JSX.Element {
  return (
    <p
      data-nex-pricing-trust-note
      style={{
        margin: "4px 0 0",
        padding: "0 4px",
        fontSize: 11,
        lineHeight: 1.6,
        color: PALETTE.textDim,
        textAlign: "center",
      }}
    >
      NEX never charges seller fees · we never send emails asking or
      demanding payment for any service or upgrade.
    </p>
  );
}

// -----------------------------------------------------------------------------
// Legacy components below · retained on disk because they may be revived
// elsewhere · currently unmounted per owner directive 2026-11-09.
// -----------------------------------------------------------------------------

function IncludedCards(): React.JSX.Element {
  // Owner directive 2026-11-09 · landscape layout · each card is a full-
  // width horizontal strip (glyph · title + blurb · chevron CTA) rather
  // than the previous 2-up portrait grid.
  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <IncludedCard
        glyph="🔐"
        title="Vault"
        blurb="Private encrypted storage. Included with your Shop package."
        cta="Open Vault →"
        href="/nex-native/vault"
      />
      <IncludedCard
        glyph="🎨"
        title="Chat Themes"
        blurb="One-time theme purchases · included with Shop · browse free previews."
        cta="Browse themes →"
        href="/nex-native/chat-themes-library"
      />
    </section>
  );
}

function IncludedCard({
  glyph,
  title,
  blurb,
  cta,
  href,
}: {
  readonly glyph: string;
  readonly title: string;
  readonly blurb: string;
  readonly cta: string;
  readonly href: string;
}): React.JSX.Element {
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        padding: "8px 12px",
        borderRadius: 12,
        background: PALETTE.cardBg,
        border: `1px solid ${PALETTE.cardBorder}`,
        textDecoration: "none",
        color: PALETTE.text,
      }}
    >
      <span
        aria-hidden
        style={{
          fontSize: 20,
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        {glyph}
      </span>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 1,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 800,
            color: PALETTE.text,
            lineHeight: 1.2,
          }}
        >
          {title}
        </span>
        <span
          style={{
            fontSize: 10,
            lineHeight: 1.3,
            color: PALETTE.textMuted,
          }}
        >
          {blurb}
        </span>
      </span>
      <span
        style={{
          flexShrink: 0,
          fontSize: 10,
          fontWeight: 800,
          color: PALETTE.accent,
          letterSpacing: "0.02em",
          whiteSpace: "nowrap",
        }}
      >
        {cta}
      </span>
    </Link>
  );
}

function FooterNote({ detectedLabel }: { readonly detectedLabel: string }): React.JSX.Element {
  return (
    <p
      data-nex-pricing-footer-note
      style={{
        margin: "4px 0 0",
        padding: "0 4px",
        fontSize: 11,
        lineHeight: 1.6,
        color: PALETTE.textDim,
        textAlign: "center",
      }}
    >
      Country suggested from your connection ({detectedLabel}). The
      legally binding billing price is set at checkout by your billing
      country and your payment provider. NEX never handles buyer-seller
      payments for Shop orders.
    </p>
  );
}

function PillLabel({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: 999,
        background: "rgba(198, 161, 91, 0.14)",
        border: `1px solid ${PALETTE.cardBorder}`,
        color: PALETTE.accent,
        fontSize: 10,
        fontWeight: 900,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </span>
  );
}
