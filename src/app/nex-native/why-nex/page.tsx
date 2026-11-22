// src/app/nex-native/why-nex/page.tsx
//
// Why NEX? · public, mobile-first, accessible, indexable page.
// Owner directive 2026-11-23 · explain what NEX actually does, label
// LIVE / BETA / PLANNED honestly, link to switch-cost calculator,
// link to export options. No "first / only / best" claims. No
// claims unsupported by verifiable code behaviour.
//
// Design pattern mirrors /nex-native/pricing · emerald background,
// gold accent, Inter sans, maxWidth 420 for mobile, sticky drawer
// header.
//
// Owner directive 2026-11-23 confirmation:
//   · Shop pricing is MONTHLY (verified against _pricing-data.ts).
//   · Storage upgrade amounts are NOT shipped in code · when absent
//     we render "Contact owner" rather than invent numbers.
//   · Ciphertext-at-rest nuance (7-day purge post-delivery) is the
//     honest form of the device-only claim.

import * as React from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { resolveSpec, countryToPricingKey, type PricingCountry } from "../pricing/_pricing-data";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { UnifiedDrawer } from "@/components/nex-native/drawer/UnifiedDrawer";

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
  live: "#5ED38B",
  beta: "#F4B942",
  planned: "#9AA7BA",
};

// -----------------------------------------------------------------------------
// Honesty-labelled advantage list
// -----------------------------------------------------------------------------
// Each item carries:
//   · status · LIVE / BETA / PLANNED (owner directive 2026-11-23)
//   · title
//   · body · one or two short paragraphs
//   · caveat · what this item does NOT claim (critical for the directive)

type AdvantageStatus = "LIVE" | "BETA" | "PLANNED";

interface Advantage {
  readonly status: AdvantageStatus;
  readonly title: string;
  readonly body: string;
  readonly caveat: string;
}

const ADVANTAGES: readonly Advantage[] = [
  {
    status: "LIVE",
    title: "Merchant-direct payments",
    body:
      "When a buyer pays, the money moves directly from them to your Stripe or PayPal account. NEX never holds buyer-seller funds for Shop orders.",
    caveat:
      "Payment processors (Stripe, PayPal, your bank) still charge their own fees and may hold funds under their own rules. These are not NEX fees.",
  },
  {
    status: "LIVE",
    title: "Flat monthly shop subscription · 0% NEX commission",
    body:
      "Your Shop subscription is a fixed monthly amount in your local currency. NEX does not take a per-sale commission.",
    caveat:
      "Payment-provider processing fees and chargeback holds are separate. See the switch calculator to compare your actual costs.",
  },
  {
    status: "BETA",
    title: "Device-only encrypted chat",
    body:
      "Private conversations are encrypted on your device. NEX never stores the plaintext of your messages. Encrypted ciphertext is briefly retained on our servers so your messages reach you when you come back online, then purged within a week of delivery.",
    caveat:
      "Device-only storage is not the same as outage immunity. If you lose your device without a recovery key, encrypted history on that device is unrecoverable by NEX by design.",
  },
  {
    status: "BETA",
    title: "Export your products, shop details, and reachable contacts",
    body:
      "A downloadable archive of your Shop data in CSV + JSON formats, with a manifest and integrity checksums. Useful for backups, accounting, and migration.",
    caveat:
      "Chat message bodies are not exportable from the server — NEX does not hold plaintext of your chats. Contact exports do not transfer marketing consent. Export rights for contacts depend on your local privacy law.",
  },
  {
    status: "PLANNED",
    title: "Realistic migration from Shopee, Lazada, WhatsApp Business and others",
    body:
      "A supported-field importer for product CSV/JSON files you can download from those platforms today. Preview, validate, deduplicate before you apply.",
    caveat:
      "No platform lets you export your followers or private chats as portable contacts. We will never promise all customers, chats or followers can transfer. See the portability map for what each platform actually supports.",
  },
  {
    status: "PLANNED",
    title: "Human-reviewed account appeals",
    body:
      "A dedicated appeal channel reachable even while your account is restricted, with an auditable reviewer workflow and a published acknowledgement window.",
    caveat:
      "A response SLA will only be published once NEX staffing and service hours are confirmed. Acknowledgement is not a decision. Appeals do not guarantee reinstatement.",
  },
  {
    status: "PLANNED",
    title: "Backup messenger · offline send queue",
    body:
      "A device-local encrypted outbox that queues outgoing messages while your network is down and delivers them when you reconnect, without changing NEX's no-plaintext-on-server architecture.",
    caveat:
      "A local queue waits for connectivity, it does not deliver without connectivity. P2P fallback, where feasible, is being assessed and will remain disabled until it can be independently verified.",
  },
] as const;

// -----------------------------------------------------------------------------
// Country detection (suggestion only)
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// Page
// -----------------------------------------------------------------------------

export const metadata = {
  title: "Why NEX? · integrated chat + shop",
  description:
    "What NEX actually does: merchant-direct payments, flat monthly subscription, device-only encrypted chat, and honest data portability. Labels each capability LIVE, BETA or PLANNED.",
};

export default async function WhyNexPage(): Promise<React.JSX.Element> {
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
      <style>{`
        html, body { background: ${PALETTE.bg}; }
        [data-nex-why-chip-link]:focus-visible {
          outline: 2px solid ${PALETTE.accent};
          outline-offset: 2px;
          border-radius: 6px;
        }
      `}</style>
      <main
        data-nex-why-page
        data-nex-why-detected-country={detectedCountry}
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
          <WhyHeader drawerSession={drawerSession} />
          <Hero spec={spec} />
          <AdvantagesList />
          <CallsToAction />
          <HonestLimits />
        </div>
      </main>
    </>
  );
}

// -----------------------------------------------------------------------------
// Components
// -----------------------------------------------------------------------------

function WhyHeader({
  drawerSession,
}: {
  readonly drawerSession:
    | import("@/components/nex-native/control-drawer/control-drawer-client").ControlDrawerSession
    | null;
}): React.JSX.Element {
  return (
    <nav
      data-nex-why-header
      aria-label="Why NEX header"
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
        href="/nex-native"
        data-nex-why-chip-link
        aria-label="Back to NEX home"
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
      <span
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
    </nav>
  );
}

function Hero({
  spec,
}: {
  readonly spec: { label: string; price: string };
}): React.JSX.Element {
  return (
    <section style={{ textAlign: "center", padding: "6px 4px 10px" }}>
      <h1
        style={{
          margin: 0,
          fontSize: 28,
          fontWeight: 900,
          letterSpacing: "-0.02em",
          lineHeight: 1.12,
          color: PALETTE.text,
        }}
      >
        Chat and shop together.
        <br />
        <span style={{ color: PALETTE.accent }}>Keep your money.</span>
      </h1>
      <p
        style={{
          margin: "14px auto 0",
          maxWidth: 360,
          fontSize: 14,
          lineHeight: 1.55,
          color: PALETTE.textMuted,
        }}
      >
        NEX is one subscription for your Shop ({spec.price} in {spec.label}).
        Zero NEX commission on your sales. Everything below is labelled LIVE,
        BETA or PLANNED so you know exactly what works today.
      </p>
    </section>
  );
}

function StatusBadge({ status }: { readonly status: AdvantageStatus }): React.JSX.Element {
  const colour =
    status === "LIVE"
      ? PALETTE.live
      : status === "BETA"
        ? PALETTE.beta
        : PALETTE.planned;
  const label =
    status === "LIVE" ? "Live" : status === "BETA" ? "Beta" : "Planned";
  return (
    <span
      aria-label={`${label} capability`}
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 999,
        background: `${colour}22`,
        color: colour,
        border: `1px solid ${colour}66`,
        fontSize: 10,
        fontWeight: 900,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
      }}
    >
      {label}
    </span>
  );
}

function AdvantageCard({ item }: { readonly item: Advantage }): React.JSX.Element {
  return (
    <article
      data-nex-why-advantage
      data-nex-why-status={item.status}
      style={{
        padding: 16,
        borderRadius: 14,
        background: PALETTE.cardBg,
        border: `1px solid ${PALETTE.cardBorder}`,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <StatusBadge status={item.status} />
      <h2
        style={{
          margin: 0,
          fontSize: 18,
          fontWeight: 900,
          color: PALETTE.text,
          lineHeight: 1.25,
          letterSpacing: "-0.01em",
        }}
      >
        {item.title}
      </h2>
      <p
        style={{
          margin: 0,
          fontSize: 13,
          lineHeight: 1.55,
          color: PALETTE.textMuted,
        }}
      >
        {item.body}
      </p>
      <p
        style={{
          margin: 0,
          padding: "8px 10px",
          borderLeft: `2px solid ${PALETTE.accent}`,
          fontSize: 11,
          lineHeight: 1.5,
          color: PALETTE.textDim,
          background: "rgba(0,0,0,0.18)",
          borderRadius: 4,
        }}
      >
        <strong style={{ color: PALETTE.text }}>What this does not claim: </strong>
        {item.caveat}
      </p>
    </article>
  );
}

function AdvantagesList(): React.JSX.Element {
  return (
    <section
      aria-label="What NEX offers"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {ADVANTAGES.map((item) => (
        <AdvantageCard key={item.title} item={item} />
      ))}
    </section>
  );
}

function CtaButton({
  href,
  label,
  primary,
}: {
  readonly href: string;
  readonly label: string;
  readonly primary?: boolean;
}): React.JSX.Element {
  return (
    <Link
      href={href}
      data-nex-why-cta
      data-nex-why-cta-primary={primary ? "1" : "0"}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "12px 16px",
        borderRadius: 12,
        textDecoration: "none",
        textAlign: "center",
        fontWeight: 800,
        fontSize: 14,
        letterSpacing: "0.01em",
        color: primary ? "#061710" : PALETTE.accent,
        background: primary ? PALETTE.accent : "transparent",
        border: `1.5px solid ${PALETTE.accent}`,
      }}
    >
      {label}
    </Link>
  );
}

function CallsToAction(): React.JSX.Element {
  return (
    <section
      aria-label="What to do next"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        marginTop: 6,
      }}
    >
      <CtaButton href="/nex-native/manage/shop/setup" label="Create a Shop" primary />
      <CtaButton href="/nex-native/switch" label="Calculate your savings" />
      <CtaButton href="/nex-native/pricing" label="See pricing in your country" />
    </section>
  );
}

function HonestLimits(): React.JSX.Element {
  return (
    <section
      aria-label="Honest limits"
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
      <p style={{ margin: 0 }}>
        <strong style={{ color: PALETTE.text }}>Honest limits</strong>
        {" · "}
        A NEX shop URL is on nexapp.app, not your own domain. Device-only
        encryption prevents server-side reading of your messages; it is not
        an outage-immunity promise. An export of your buyer contacts is a
        snapshot, not guaranteed ongoing access to those customers. Listing
        on NEX does not create traffic by itself.
      </p>
    </section>
  );
}
