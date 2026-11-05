// src/app/nex-native/settings/shop-payments/page.tsx
//
// Seller shop-payment-provider settings · Phase V · P4 · 2026-11-05.
// -----------------------------------------------------------------
// Where a seller sees the payment gateways they can connect to
// accept buyer payments for their shop · DIRECT to the seller's own
// merchant account, never through NEX.
//
// Sealed rules enforced here:
//   · NEX never takes commissions (0% fee · copy explicit)
//   · NEX never handles customer-to-seller payments (seller owns the
//     merchant relationship · provider-hosted checkout · copy explicit)
//   · NEX membership billing is SEPARATE (copy explicit)
//   · Apple Pay / Google Pay are presented as wallet METHODS inside
//     eligible providers (Stripe/PayPal) · NOT as independent gateways
//   · Honest status copy per sealed entitlement-contract-first rule
//     2026-11-05 · no "Connect" button is presented for a gateway
//     whose live integration is not yet wired · "Beta · join waitlist"
//     is the current state for every provider
//
// Deployment identity drives the per-country provider availability
// map · Ireland shows Stripe + PayPal · Indonesia shows Stripe (if
// available in-country) + Midtrans + Xendit + PayPal · HQ shows
// everything for internal review.

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import { resolveAppIdentity } from "@/lib/nex-native/app/resolve-app-identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "var(--nex-world-background-base, #020914)",
  panel: "#050f1e",
  panelSoft: "rgba(6, 15, 28, 0.72)",
  border: "rgba(139, 169, 209, 0.14)",
  borderStrong: "rgba(139, 169, 209, 0.24)",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0,175,255,0.5)",
  amber: "#F59E0B",
  amberSoft: "rgba(245, 158, 11, 0.5)",
  green: "#16D66B",
  red: "#FF3355",
};

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

type ProviderStatus = "beta-waitlist" | "connected" | "coming-soon";

interface PaymentProvider {
  readonly id: string;
  readonly name: string;
  readonly summary: string;
  readonly methodsIncluded: readonly string[];
  readonly countries: readonly ("IE" | "ID" | "all")[];
  // Phase V · P4 · all providers currently in beta-waitlist · no live
  // Connect flow is wired yet on this branch · honest copy only.
  readonly status: ProviderStatus;
  readonly feeNote: string;
  readonly providerHost: string;
}

const PROVIDERS: readonly PaymentProvider[] = [
  {
    id: "stripe",
    name: "Stripe",
    summary:
      "Hosted checkout · the buyer pays your Stripe account directly · you keep the merchant relationship with Stripe · NEX is not in the money path.",
    methodsIncluded: [
      "Card (Visa · Mastercard · Amex)",
      "Apple Pay",
      "Google Pay",
      "SEPA Direct Debit (Ireland)",
    ],
    countries: ["IE", "ID"],
    status: "beta-waitlist",
    feeNote:
      "Stripe sets its own processing fee · NEX adds 0% commission.",
    providerHost: "stripe.com",
  },
  {
    id: "paypal",
    name: "PayPal",
    summary:
      "Hosted checkout via PayPal Commerce · the buyer pays your PayPal business account directly · you keep the merchant relationship with PayPal · NEX is not in the money path.",
    methodsIncluded: [
      "PayPal balance / linked card",
      "Pay in 3 (where available)",
    ],
    countries: ["IE", "ID"],
    status: "beta-waitlist",
    feeNote: "PayPal sets its own processing fee · NEX adds 0% commission.",
    providerHost: "paypal.com",
  },
  {
    id: "xendit",
    name: "Xendit",
    summary:
      "Regional provider for Indonesia · hosted checkout supports local banks, OVO, DANA, QRIS · funds settle to your Xendit account · you keep the merchant relationship · NEX is not in the money path.",
    methodsIncluded: [
      "Bank transfer (BCA · BRI · Mandiri · BNI · etc.)",
      "E-wallets (OVO · DANA · ShopeePay · LinkAja)",
      "QRIS",
    ],
    countries: ["ID"],
    status: "beta-waitlist",
    feeNote: "Xendit sets its own processing fee · NEX adds 0% commission.",
    providerHost: "xendit.co",
  },
  {
    id: "midtrans",
    name: "Midtrans",
    summary:
      "Regional provider for Indonesia · hosted checkout (Snap) supports local rails · funds settle to your Midtrans merchant account · you keep the merchant relationship · NEX is not in the money path.",
    methodsIncluded: [
      "Bank transfer / VA",
      "E-wallets (GoPay · OVO · DANA · ShopeePay)",
      "QRIS",
      "Credit card",
    ],
    countries: ["ID"],
    status: "beta-waitlist",
    feeNote:
      "Midtrans sets its own processing fee · NEX adds 0% commission.",
    providerHost: "midtrans.com",
  },
];

export default async function ShopPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; m?: string }>;
}): Promise<React.JSX.Element> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const sp = await searchParams;
  const banner = sp.e && sp.m ? { code: sp.e, message: sp.m } : null;

  const businesses = await businessService.listBusinessesByOwner(
    session.account.id,
  );
  const business = businesses[0] ?? null;

  const identity = resolveAppIdentity();
  const country = identity.country; // "IE" | "ID" | null (hq)

  const relevantProviders = PROVIDERS.filter((p) => {
    if (identity.identity === "hq") return true;
    if (!country) return false;
    return p.countries.includes(country) || p.countries.includes("all");
  });

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        fontFamily: SANS,
      }}
    >
      <header
        style={{
          padding: "calc(env(safe-area-inset-top, 0) + 14px) 16px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${NEX.border}`,
        }}
      >
        <Link
          href="/nex-native/settings"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: NEX.textDim,
            textDecoration: "none",
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.04em",
          }}
        >
          ← Settings
        </Link>
        {business && (
          <Link
            href="/nex-native/manage/shop"
            style={{
              fontSize: 11,
              color: NEX.cyan,
              textDecoration: "none",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fontWeight: 700,
            }}
          >
            Shop settings ↗
          </Link>
        )}
      </header>

      <main
        style={{
          maxWidth: 640,
          margin: "0 auto",
          padding: "24px 20px 48px",
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: NEX.cyan,
            fontWeight: 700,
            marginBottom: 6,
          }}
        >
          Payments
        </div>
        <h1
          style={{
            margin: 0,
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            marginBottom: 12,
          }}
        >
          Shop payment providers
        </h1>

        {banner && <Banner code={banner.code} message={banner.message} />}

        {/* --- Honest promise panel ----------------------------------- */}
        <section
          style={{
            padding: "16px 18px",
            borderRadius: 14,
            background: "rgba(22, 214, 107, 0.06)",
            border: `1px solid rgba(22, 214, 107, 0.26)`,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: NEX.green,
              fontWeight: 700,
              marginBottom: 8,
            }}
          >
            How NEX handles shop payments
          </div>
          <ul
            style={{
              margin: 0,
              padding: 0,
              listStyle: "none",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              fontSize: 13,
              lineHeight: 1.55,
              color: NEX.text,
            }}
          >
            <li>✓ Buyers pay <strong>you</strong> directly through your provider · NEX is not in the money path.</li>
            <li>✓ You keep the merchant relationship with the provider you connect.</li>
            <li>✓ NEX adds <strong>0% commission</strong> on any shop sale · ever.</li>
            <li>✓ Apple Pay and Google Pay appear automatically on providers that support them (Stripe · PayPal) · they're not separate gateways to connect.</li>
            <li>✓ NEX only bills you for your own NEX membership · kept completely separate from shop sales.</li>
          </ul>
        </section>

        {/* --- Deployment context chip ------------------------------- */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 10px",
            borderRadius: 999,
            background: NEX.panelSoft,
            border: `1px solid ${NEX.border}`,
            fontSize: 11,
            color: NEX.textDim,
            marginBottom: 20,
          }}
        >
          <span style={{ color: NEX.cyan, fontWeight: 700 }}>
            {identity.displayName}
          </span>
          <span>·</span>
          <span>
            {country
              ? `Providers available for ${country === "IE" ? "Ireland" : "Indonesia"}`
              : "All providers (HQ review)"}
          </span>
        </div>

        {/* --- Provider list ----------------------------------------- */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {relevantProviders.map((p) => (
            <ProviderCard key={p.id} provider={p} />
          ))}
        </div>

        {/* --- Honest status note ------------------------------------ */}
        <section
          style={{
            marginTop: 24,
            padding: "14px 16px",
            borderRadius: 12,
            background: "rgba(245, 158, 11, 0.05)",
            border: `1px solid ${NEX.amberSoft}`,
          }}
        >
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: NEX.amber,
              fontWeight: 700,
              marginBottom: 6,
            }}
          >
            Current status · honest
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              lineHeight: 1.55,
              color: NEX.text,
            }}
          >
            Shop payment acceptance is in <strong>beta onboarding</strong>.
            Provider connections (Stripe Connect Express · PayPal Partner
            Referrals · Xendit · Midtrans) are being wired. No shop can
            accept live buyer payments through NEX yet. When your
            provider is ready, we'll email you.{" "}
            <Link
              href="/nex-native/support?topic=shop_payments"
              style={{ color: NEX.cyan, fontWeight: 700 }}
            >
              Contact support
            </Link>{" "}
            to join the beta waitlist.
          </p>
        </section>

        {/* --- Shop readiness summary -------------------------------- */}
        {business && (
          <section
            style={{
              marginTop: 20,
              padding: "14px 16px",
              borderRadius: 12,
              background: NEX.panelSoft,
              border: `1px solid ${NEX.border}`,
            }}
          >
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: NEX.textDim,
                fontWeight: 700,
                marginBottom: 8,
              }}
            >
              This shop · {business.display_name}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                fontSize: 13,
                color: NEX.text,
              }}
            >
              <span>Checkout ready to accept payments</span>
              <span
                style={{
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: "rgba(255, 51, 85, 0.12)",
                  border: `1px solid ${NEX.red}`,
                  color: NEX.red,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                No · no provider connected
              </span>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function ProviderCard({
  provider,
}: {
  readonly provider: PaymentProvider;
}): React.JSX.Element {
  return (
    <article
      style={{
        padding: "16px 18px",
        borderRadius: 14,
        background: NEX.panel,
        border: `1px solid ${NEX.border}`,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: "-0.005em",
          }}
        >
          {provider.name}
        </h2>
        <StatusChip status={provider.status} />
      </header>
      <p
        style={{
          margin: 0,
          fontSize: 13,
          lineHeight: 1.55,
          color: NEX.textDim,
        }}
      >
        {provider.summary}
      </p>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          marginTop: 4,
        }}
      >
        {provider.methodsIncluded.map((m) => (
          <span
            key={m}
            style={{
              padding: "4px 10px",
              borderRadius: 999,
              background: "rgba(0,0,0,0.35)",
              border: `1px solid ${NEX.border}`,
              fontSize: 11,
              color: NEX.textDim,
            }}
          >
            {m}
          </span>
        ))}
      </div>
      <div
        style={{
          marginTop: 2,
          fontSize: 11,
          color: NEX.textMute,
          lineHeight: 1.5,
        }}
      >
        {provider.feeNote} · Managed at {provider.providerHost}.
      </div>
      <div style={{ marginTop: 6 }}>
        <Link
          href={`/nex-native/support?topic=shop_payments&provider=${provider.id}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 14px",
            borderRadius: 10,
            background: "rgba(0,175,255,0.12)",
            border: `1px solid ${NEX.cyanSoft}`,
            color: NEX.text,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            textDecoration: "none",
          }}
        >
          Join {provider.name} beta waitlist →
        </Link>
      </div>
    </article>
  );
}

function StatusChip({
  status,
}: {
  readonly status: ProviderStatus;
}): React.JSX.Element {
  const label =
    status === "connected"
      ? "Connected"
      : status === "beta-waitlist"
        ? "Beta · not connected"
        : "Coming soon";
  const bg =
    status === "connected"
      ? "rgba(22, 214, 107, 0.12)"
      : status === "beta-waitlist"
        ? "rgba(245, 158, 11, 0.12)"
        : "rgba(139, 169, 209, 0.12)";
  const border =
    status === "connected"
      ? NEX.green
      : status === "beta-waitlist"
        ? NEX.amber
        : NEX.textDim;
  const color = border;
  return (
    <span
      style={{
        padding: "4px 10px",
        borderRadius: 999,
        background: bg,
        border: `1px solid ${color}`,
        color,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
      }}
    >
      {label}
    </span>
  );
}

function Banner({
  code,
  message,
}: {
  readonly code: string;
  readonly message: string;
}): React.JSX.Element {
  const isOk = code.endsWith("_ok");
  return (
    <div
      role="status"
      style={{
        padding: "10px 12px",
        borderRadius: 10,
        background: isOk
          ? "rgba(22, 214, 107, 0.12)"
          : "rgba(255, 51, 85, 0.12)",
        border: `1px solid ${isOk ? NEX.green : NEX.red}`,
        color: isOk ? NEX.green : NEX.red,
        fontSize: 13,
        marginBottom: 16,
      }}
    >
      {message}
    </div>
  );
}
