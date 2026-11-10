// src/app/nex-native/settings/payments/page.tsx
//
// NEX Payment providers · connection page. Owner directive 2026-11-04
// · Phase U Option A. Serves BOTH creators (receiving fan support) and
// shop owners (receiving shop sales). One connection powers both uses.
//
// Phase U: all Connect buttons route to /coming-soon?feature=payment-
// connect-stripe|paypal under the HOLD. When Phase 1B is authorised
// (requires §G.1 + §G.8 resolution), the hrefs flip to real server
// actions that create Stripe Connect Express onboarding links or PayPal
// Commerce Platform referrals. The UI does not change at that point.

import Link from "next/link";
import { NexPageHeader } from "../../_page-header";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { getAccountById } from "@/lib/nex-native/account-service";
import { listBusinessesByOwner } from "@/lib/nex-native/business-service";
import { readLocalConnectStatus } from "@/lib/nex-native/billing/stripe-connect-service";
import { StripeConnectClient } from "./_stripe-connect-client";
import { getActiveQrAsset } from "@/lib/nex-native/merchant-qr/qr-asset-service";
import { mintForSellerPreview } from "@/lib/nex-native/merchant-qr/signed-url-service";
import { getSellerActiveMethods } from "@/lib/nex-native/payments/method-resolver-service";
import { QrUploadClient } from "./_qr-upload-client";
import { PaymentSettingsClient } from "./_payment-settings-client";
import { SaveSettingsButton } from "./_save-settings-button";

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
  borderSoft: "rgba(198, 161, 91, 0.35)",
};

export default async function PaymentsSettingsPage() {
  const session = await resolveSessionWithDevOverride();
  const account = session ? await getAccountById(session.account.id) : null;
  const nexHandle = account?.nex_handle ?? null;

  // Round 31a · load the seller's primary business + current Stripe
  // Connect status (fail-soft when migration 311 not applied or
  // no business exists yet).
  const businesses = session
    ? await listBusinessesByOwner(session.account.id).catch(() => [])
    : [];
  const primaryBusiness = businesses[0] ?? null;
  const connectStatus = primaryBusiness
    ? await readLocalConnectStatus(primaryBusiness.id)
    : {
        accountId: null,
        chargesEnabled: false,
        payoutsEnabled: false,
        country: null,
        requirementsCurrentlyDue: [] as string[],
        onboardedAt: null,
        lastWebhookAt: null,
      };

  // P5 · fetch current active QR + mint a short-lived signed URL
  // for the seller to see it in their settings. Fail-soft: table
  // / bucket may not exist yet (pre-migration).
  const activeQr = primaryBusiness
    ? await getActiveQrAsset(primaryBusiness.id).catch(() => null)
    : null;
  let activeQrPreviewUrl: string | null = null;
  if (activeQr) {
    const signed = await mintForSellerPreview(activeQr.storage_path).catch(() => null);
    if (signed && signed.ok) activeQrPreviewUrl = signed.url;
  }

  // Activation summary · owner-sealed 2026-11-10 · shows the seller
  // exactly what buyers will see at checkout. Fail-soft if no business.
  const methods = primaryBusiness
    ? await getSellerActiveMethods(primaryBusiness.id).catch(() => null)
    : null;
  const activationLabels: string[] = [];
  if (methods?.stripe) activationLabels.push("Stripe");
  if (methods?.paypal) activationLabels.push("PayPal");
  if (methods?.qr_manual) activationLabels.push("QR Code");
  if (methods?.qris_dynamic) activationLabels.push("QRIS");
  const noneActive = methods !== null && !methods.any_configured;

  return (
    <main
      data-nex-payments-settings
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
          dataScope="payments-settings"
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

        <header style={{ margin: "28px 0 20px" }}>
          <h1
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 800,
              letterSpacing: "-0.01em",
            }}
          >
            Payment providers
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
            Choose where your shop sales payments go. Select one or both.
            NEX never holds your funds.
          </p>

          {/* Activation summary · owner-sealed 2026-11-10 · what the
              buyer actually sees at checkout based on current config. */}
          {methods ? (
            <div
              data-nex-activation-summary
              style={{
                marginTop: 14,
                padding: "10px 14px",
                borderRadius: 10,
                background: noneActive
                  ? "rgba(255, 175, 64, 0.1)"
                  : "rgba(22, 214, 107, 0.08)",
                border: `1px solid ${noneActive ? "#FFAF40" : "#16D66B"}55`,
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 900,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: noneActive ? "#FFAF40" : "#16D66B",
                }}
              >
                Currently accepting
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: IRELAND.textPrimary,
                }}
              >
                {noneActive
                  ? "Nothing yet — buyers will arrange payment in chat"
                  : activationLabels.join(" · ")}
              </div>
              {noneActive ? (
                <div style={{ fontSize: 11, color: IRELAND.textMuted, marginTop: 2, lineHeight: 1.45 }}>
                  Connect Stripe or PayPal, or upload a QR code, to give
                  buyers a direct checkout. NEX never touches your funds
                  either way.
                </div>
              ) : null}
            </div>
          ) : null}
        </header>

        {/* Stripe · round 31a · real Connect flow replaces the Phase-U
            coming-soon placeholder. The ProviderCard renders only the
            static copy now; the interactive status + button lives in
            StripeConnectClient below so the server-side status flows
            through without a page reload loop. */}
        <section
          data-provider="stripe"
          style={{
            margin: "20px 0 0",
            padding: "18px 18px 20px",
            borderRadius: 14,
            background: IRELAND.panel,
            border: `1px solid ${IRELAND.borderSoft}`,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <h2
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 900,
                color: IRELAND.textPrimary,
                letterSpacing: "-0.005em",
              }}
            >
              Stripe
            </h2>
            <ul style={{ margin: "4px 0 0 16px", padding: 0, fontSize: 12, color: IRELAND.primaryInk, lineHeight: 1.5 }}>
              <li>Cards · Apple Pay · Google Pay</li>
              <li>Competitive fees · direct payouts</li>
              <li>Supports shop sales</li>
            </ul>
          </div>
          <StripeConnectClient
            initialStatus={connectStatus}
            gold={IRELAND.secondary}
            inkDim={IRELAND.textMuted}
            inkPrimary={IRELAND.textPrimary}
            red="#A60000"
          />
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 11,
              color: IRELAND.textMuted,
              lineHeight: 1.5,
            }}
          >
            NEX takes 0% commission on sales. Stripe pays directly to your
            account. Payment provider fees and account issues are handled
            by Stripe.
          </p>
        </section>

        {/* PayPal */}
        <ProviderCard
          name="PayPal"
          statusLabel="Not connected"
          statusConnected={false}
          bullets={[
            "PayPal balance · cards · credit",
            "Trusted by international buyers and supporters",
            "Supports shop sales",
          ]}
          signupLine="Create a PayPal Business account or sign in to an existing one."
          ctaLabel="Connect PayPal"
          href="/nex-native/coming-soon?feature=payment-connect-paypal"
          dataProvider="paypal"
        />

        {/* QR Code · owner directive 2026-11-10 · upload your own
            payment QR for countries where Stripe/PayPal aren't the
            buyer's preferred method (QRIS in Indonesia · GCash in
            the Philippines · etc). Buyer-side shows the QR + the
            seller's written instructions at checkout. Owner manually
            marks the order paid once funds land · NEX never
            auto-confirms a QR payment. */}
        <QrUploadClient
          activeQrPreviewUrl={activeQrPreviewUrl}
          activeQrWidth={activeQr?.width_px ?? null}
          activeQrHeight={activeQr?.height_px ?? null}
        />

        {/* Payment settings · preferred method + per-method toggles ·
            interactive client-side state; persistence ships with
            Phase B (nex.payment_provider_config). */}
        <PaymentSettingsClient />

        <section
          style={{
            margin: "28px 0 0",
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
            How payments work
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
              color: IRELAND.primaryInk,
              lineHeight: 1.5,
            }}
          >
            <li>• NEX takes 0% commission on your sales.</li>
            <li>• Stripe and PayPal provider fees may apply.</li>
            <li>• Payments go directly to YOUR account, never through NEX.</li>
            <li>• NEX does not independently verify or automatically confirm individual payments.</li>
          </ul>
        </section>

        <div style={{ margin: "24px 0 0" }}>
          <SaveSettingsButton />
        </div>
      </div>
    </main>
  );
}

// ─── QR Upload card · owner-directive 2026-11-10 ────────────────────
//
// UI stub for uploading a payment QR + metadata. Does NOT actually
// upload a file yet · needs a storage bucket + an upload action wired
// (Phase B). Input fields are visible + accept text; the Save button
// is disabled with a "Coming soon · upload storage not wired" title.

function QrUploadCard(): React.ReactElement {
  return (
    <section
      data-nex-provider-card="qr-code"
      style={{
        margin: "0 0 14px",
        padding: "18px 20px",
        borderRadius: 16,
        background: IRELAND.panel,
        border: `1px solid ${IRELAND.borderSoft}`,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 2,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 800,
            color: IRELAND.textPrimary,
            letterSpacing: "-0.01em",
          }}
        >
          QR Code Payments
        </h2>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: 11,
            fontWeight: 700,
            color: IRELAND.textMuted,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          <span
            aria-hidden
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: IRELAND.borderSoft,
            }}
          />
          Not uploaded
        </div>
      </div>

      <ul
        style={{
          margin: 0,
          padding: 0,
          listStyle: "none",
          display: "flex",
          flexDirection: "column",
          gap: 4,
          fontSize: 13,
          color: IRELAND.primaryInk,
          lineHeight: 1.5,
        }}
      >
        <li>• Upload QRIS (Indonesia), GCash, PromptPay or other local QR</li>
        <li>• Buyer sees your QR + instructions at checkout</li>
        <li>• You confirm the order paid once funds arrive · NEX does not auto-confirm</li>
      </ul>

      {/* Metadata fields · all accept text today; persistence ships
          with the payment-provider-config table (Phase B). */}
      <div style={{ display: "grid", gap: 10 }}>
        <QrField label="Provider name" placeholder="QRIS · GCash · PromptPay · Other" />
        <QrField label="Country" placeholder="e.g. ID · PH · TH" />
        <QrField label="Currency" placeholder="e.g. IDR · PHP · THB" />
        <QrField
          label="Instructions for buyer"
          placeholder="Scan the QR in your banking app · include order # in note"
          multiline
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 12px",
            borderRadius: 10,
            border: `1px dashed ${IRELAND.borderSoft}`,
            background: "rgba(0,0,0,0.25)",
            color: IRELAND.textMuted,
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          <span aria-hidden style={{ fontSize: 22 }}>📷</span>
          <span>Drop a QR image here · or tap to choose a file (storage not wired yet)</span>
        </div>
      </div>

      <button
        type="button"
        disabled
        title="Upload storage not wired yet · Phase B · pending migration + bucket authorisation"
        data-nex-provider-cta="qr-save"
        style={{
          display: "block",
          padding: "12px 18px",
          borderRadius: 999,
          background: "rgba(198, 161, 91, 0.3)",
          color: "#061710",
          border: "none",
          fontSize: 13,
          fontWeight: 800,
          letterSpacing: "0.02em",
          textTransform: "uppercase",
          cursor: "not-allowed",
          opacity: 0.6,
        }}
      >
        Save QR payment method
      </button>
    </section>
  );
}

function QrField({
  label,
  placeholder,
  multiline,
}: {
  readonly label: string;
  readonly placeholder: string;
  readonly multiline?: boolean;
}): React.ReactElement {
  const common: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    background: "rgba(0,0,0,0.3)",
    border: `1px solid ${IRELAND.borderSoft}`,
    color: IRELAND.textPrimary,
    fontSize: 13,
    fontFamily: "inherit",
    boxSizing: "border-box",
    outline: "none",
  };
  return (
    <label style={{ display: "block" }}>
      <span
        style={{
          display: "block",
          marginBottom: 4,
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: IRELAND.secondary,
        }}
      >
        {label}
      </span>
      {multiline ? (
        <textarea rows={2} placeholder={placeholder} style={{ ...common, resize: "vertical" }} />
      ) : (
        <input type="text" placeholder={placeholder} style={common} />
      )}
    </label>
  );
}

// ─── Payment Settings · owner-directive 2026-11-10 ─────────────────
//
// UI-only. Preferred method radio + per-method enable toggles. Will
// persist to nex.payment_provider_config once Phase B migration ships.

function PaymentSettingsCard(): React.ReactElement {
  const row: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 10,
    background: "rgba(0,0,0,0.2)",
    border: `1px solid ${IRELAND.borderSoft}`,
  };
  return (
    <section
      data-nex-payment-settings
      style={{
        margin: "0 0 14px",
        padding: "18px 20px",
        borderRadius: 16,
        background: IRELAND.panel,
        border: `1px solid ${IRELAND.borderSoft}`,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: 16,
          fontWeight: 800,
          color: IRELAND.textPrimary,
          letterSpacing: "-0.01em",
        }}
      >
        Payment settings
      </h2>
      <p
        style={{
          margin: 0,
          fontSize: 12,
          color: IRELAND.textMuted,
          lineHeight: 1.5,
        }}
      >
        Choose your preferred checkout method and enable or disable
        individual payment options.
      </p>

      <div style={{ display: "grid", gap: 8 }}>
        <div style={row}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: IRELAND.textPrimary }}>
              Preferred at checkout
            </div>
            <div style={{ fontSize: 11, color: IRELAND.textMuted, marginTop: 2 }}>
              Shown first to buyers at checkout.
            </div>
          </div>
          <select
            disabled
            title="Setting will persist once Phase B ships"
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              background: "rgba(0,0,0,0.5)",
              border: `1px solid ${IRELAND.borderSoft}`,
              color: IRELAND.textPrimary,
              fontFamily: "inherit",
              fontSize: 12,
              opacity: 0.7,
            }}
          >
            <option>Stripe</option>
            <option>PayPal</option>
            <option>QR Code</option>
          </select>
        </div>

        <h3
          style={{
            margin: "6px 0 2px",
            fontSize: 11,
            fontWeight: 800,
            color: IRELAND.secondary,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          Buyer checkout options
        </h3>

        {(["Stripe", "PayPal", "QR Code"] as const).map((name) => (
          <div key={name} style={row}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: IRELAND.textPrimary }}>
                {name}
              </div>
              <div style={{ fontSize: 11, color: IRELAND.textMuted, marginTop: 2 }}>
                Enable / Disable
              </div>
            </div>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <input
                type="checkbox"
                disabled
                defaultChecked={name === "Stripe"}
                title="Toggle will persist once Phase B ships"
                style={{ transform: "scale(1.2)", opacity: 0.7, cursor: "not-allowed" }}
              />
              <span style={{ fontSize: 11, color: IRELAND.textMuted }}>on/off</span>
            </label>
          </div>
        ))}
      </div>

      <p
        style={{
          margin: "4px 0 0",
          fontSize: 10.5,
          color: IRELAND.textMuted,
          fontStyle: "italic",
          lineHeight: 1.5,
        }}
      >
        Phase B pending: nex.payment_provider_config table and storage
        bucket require separate owner authorisation.
      </p>
    </section>
  );
}

// ─── ProviderCard · reused for Stripe + PayPal ─────────────────────
function ProviderCard(props: {
  readonly name: string;
  readonly statusLabel: string;
  readonly statusConnected: boolean;
  readonly bullets: readonly string[];
  readonly signupLine: string;
  readonly ctaLabel: string;
  readonly href: string;
  readonly dataProvider: string;
}): React.ReactElement {
  const statusDot = props.statusConnected ? "#16D66B" : IRELAND.borderSoft;
  return (
    <section
      data-nex-provider-card={props.dataProvider}
      style={{
        margin: "0 0 14px",
        padding: "18px 20px",
        borderRadius: 16,
        background: IRELAND.panel,
        border: `1px solid ${IRELAND.borderSoft}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <h2
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 800,
            color: IRELAND.textPrimary,
            letterSpacing: "-0.01em",
          }}
        >
          {props.name}
        </h2>
        <div
          aria-label={`${props.name} status · ${props.statusLabel}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: 11,
            fontWeight: 700,
            color: props.statusConnected ? IRELAND.textPrimary : IRELAND.textMuted,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          <span aria-hidden style={{ width: 10, height: 10, borderRadius: "50%", background: statusDot }} />
          {props.statusLabel}
        </div>
      </div>

      <ul
        style={{
          margin: "0 0 14px",
          padding: 0,
          listStyle: "none",
          display: "flex",
          flexDirection: "column",
          gap: 4,
          fontSize: 13,
          color: IRELAND.primaryInk,
          lineHeight: 1.5,
        }}
      >
        {props.bullets.map((b) => (
          <li key={b}>• {b}</li>
        ))}
      </ul>

      <p
        style={{
          margin: "0 0 14px",
          fontSize: 11,
          color: IRELAND.textMuted,
          lineHeight: 1.5,
        }}
      >
        {props.signupLine}
      </p>

      <Link
        href={props.href}
        data-nex-provider-cta={props.dataProvider}
        style={{
          display: "block",
          padding: "12px 18px",
          borderRadius: 999,
          background: IRELAND.secondary,
          color: IRELAND.drawerBg,
          textDecoration: "none",
          textAlign: "center",
          fontSize: 13,
          fontWeight: 800,
          letterSpacing: "0.02em",
          textTransform: "uppercase",
          boxShadow: `0 4px 14px ${IRELAND.secondary}22`,
        }}
      >
        {props.ctaLabel} →
      </Link>
    </section>
  );
}
