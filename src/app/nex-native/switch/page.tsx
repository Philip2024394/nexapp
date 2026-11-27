// src/app/nex-native/switch/page.tsx
//
// Switch cost calculator · public page · owner directive 2026-11-23.
//
// Design principles enforced by code:
//   · Accept manual rates. Any preset is user-selectable, each
//     preset row carries a dated-source citation and a "last
//     verified" date · never baked in as universal truth.
//   · Honour the owner's "22.5% / 17.4% are unverified examples" rule.
//   · Zero-volume input shows "no sales → nothing to compare".
//   · Negative savings honestly surface as "NEX costs more at this
//     volume" rather than hidden.
//   · Single currency per calculation · no silent FX conversion.
//   · Monthly inputs projected to annual ARE labelled "projected",
//     never presented as actual 12-month history.
//
// Page is a server-rendered shell; the interactive form is a client
// component to keep math reactive without a server round-trip.

import * as React from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { resolveSpec, countryToPricingKey, type PricingCountry } from "../pricing/_pricing-data";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { UnifiedDrawer } from "@/components/nex-native/drawer/UnifiedDrawer";
import { SwitchCalculatorClient } from "./_switch-calculator-client";
import { extractNumericAmount } from "./_calc-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

const PALETTE = {
  bg: "#123D2B",
  cardBg: "rgba(10, 28, 20, 0.72)",
  cardBorder: "rgba(198, 161, 91, 0.35)",
  text: "#F2F5F8",
  textMuted: "#B5C3D6",
  textDim: "#7D9BC0",
  accent: "#C6A15B",
};

function detectCountryFromHeaders(
  h: Awaited<ReturnType<typeof headers>>,
): PricingCountry {
  const vercel = h.get("x-vercel-ip-country");
  const cloudflare = h.get("cf-ipcountry");
  const raw = (vercel ?? cloudflare ?? "").toUpperCase();
  if (raw === "GB" || raw === "UK") return "GB";
  if (raw === "US") return "US";
  if (raw === "ID") return "ID";
  return countryToPricingKey(raw);
}

export const metadata = {
  title: "Switch to NEX · savings calculator",
  description:
    "Compare your current platform costs with a NEX Shop subscription. Enter your actual numbers; preset rates are dated examples, not universal truth.",
};

export default async function SwitchPage(): Promise<React.JSX.Element> {
  const h = await headers();
  const detectedCountry = detectCountryFromHeaders(h);
  const spec = resolveSpec(detectedCountry);
  const session = await resolveNexAppSessionFromContext().catch(() => null);

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
      <style>{`html, body { background: ${PALETTE.bg}; }`}</style>
      <main
        data-nex-switch-page
        data-nex-switch-detected-country={detectedCountry}
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
            maxWidth: 460,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <SwitchHeader drawerSession={drawerSession} />
          <Hero />
          <SwitchCalculatorClient
            initialCurrency={spec.currency}
            initialNexMonthlyAmount={extractNumericAmount(spec.priceShort)}
            countryLabel={spec.label}
          />
          <WhatThisDoesNotReplace />
        </div>
      </main>
    </>
  );
}

// -----------------------------------------------------------------------------
// Static sections
// -----------------------------------------------------------------------------

function SwitchHeader({
  drawerSession,
}: {
  readonly drawerSession:
    | import("@/components/nex-native/control-drawer/control-drawer-client").ControlDrawerSession
    | null;
}): React.JSX.Element {
  return (
    <nav
      aria-label="Switch calculator header"
      style={{
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
        href="/nex-native/why-nex"
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
        ← Why NEX?
      </Link>
      {/* Owner directive 2026-11-27 · GLOBAL side-drawer button size
          = 36×36 across every nexapp header (was 44×44 locally). */}
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: "#C6A15B",
          border: "1.5px solid #8B6A32",
          boxShadow:
            "0 6px 14px rgba(0, 0, 0, 0.55), 0 0 0 2px rgba(0, 0, 0, 0.2)",
        }}
      >
        <UnifiedDrawer session={drawerSession} />
      </span>
    </nav>
  );
}

function Hero(): React.JSX.Element {
  return (
    <section style={{ textAlign: "center", padding: "4px 4px 8px" }}>
      <h1
        style={{
          margin: 0,
          fontSize: 24,
          fontWeight: 900,
          letterSpacing: "-0.02em",
          lineHeight: 1.15,
          color: PALETTE.text,
        }}
      >
        Compare your real costs
      </h1>
      <p
        style={{
          margin: "10px auto 0",
          maxWidth: 380,
          fontSize: 13,
          lineHeight: 1.55,
          color: PALETTE.textMuted,
        }}
      >
        Enter your numbers below. Preset rates are dated examples, not
        universal truth — your actual contract wins every time. This
        comparison covers platform charges only; processor fees,
        promotion, logistics, and buyer-protection costs vary and are not
        auto-replaced by a NEX subscription.
      </p>
    </section>
  );
}

function WhatThisDoesNotReplace(): React.JSX.Element {
  return (
    <section
      aria-label="What a NEX subscription does not replace"
      style={{
        marginTop: 10,
        padding: 14,
        borderRadius: 12,
        background: "rgba(0,0,0,0.25)",
        border: `1px dashed ${PALETTE.cardBorder}`,
        color: PALETTE.textDim,
        fontSize: 11,
        lineHeight: 1.6,
      }}
    >
      <p style={{ margin: 0, marginBottom: 6 }}>
        <strong style={{ color: PALETTE.text }}>What this does not replace:</strong>
      </p>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        <li>Marketplace discovery and paid promotion run by Shopee, Lazada, TikTok Shop, etc.</li>
        <li>Fulfilment, warehousing, and courier integration offered by marketplace logistics arms.</li>
        <li>Buyer-protection and escrow schemes operated by those platforms.</li>
        <li>Payment-provider processing fees (Stripe, PayPal, local banks) — these are not NEX charges.</li>
      </ul>
    </section>
  );
}
