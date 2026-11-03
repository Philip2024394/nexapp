// src/app/nex-native/dev/billing-stripe-sandbox/page.tsx
//
// NEX Billing · Stripe test-mode sandbox (dev-only).
// ---------------------------------------------------------------------------
// Owner-authorised 2026-11-02 (MASTER BUILD · LOCAL DRAFT · NOT WIRED to
// production). Accessible only in development · the page itself refuses
// to render when NODE_ENV === "production".
//
// Purpose · exercise the full checkout + webhook + reconciliation flow
// against Stripe test-mode once the owner has:
//   1 · created a Stripe test-mode account
//   2 · created test products + prices
//   3 · set STRIPE_SECRET_KEY (sk_test_…), STRIPE_WEBHOOK_SECRET (whsec_…),
//       STRIPE_PRICE_SHOP_STANDARD, STRIPE_PRICE_SHOP_UNLIMITED,
//       STRIPE_PRICE_VAULT_5GB, etc. in the local .env.local
//
// Shows:
//   · which env vars are set (name only · never values)
//   · which price-registry tiers resolved (identity-aware)
//   · a button to kick off a Shop Standard checkout (uses the real
//     checkout endpoint, which uses Stripe test-mode)
//   · a button to kick off a Vault 5GB checkout
//   · a note explaining what will happen next
//
// The ACTUAL flow uses the real checkout endpoint at
// /api/nex-native/billing/checkout · the sandbox page is just a thin
// trigger UI with env-var diagnostics.

import { notFound } from "next/navigation";
import { getPriceRegistry } from "@/lib/nex-native/billing/price-registry";
import { StripeSandboxActions } from "./_sandbox-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "#020914",
  panel: "#03101D",
  border: "rgba(139, 169, 209, 0.14)",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
  cyan: "#00AFFF",
  green: "#22E37A",
  amber: "#FFB700",
  red: "#D33A3A",
  mono:
    "'JetBrains Mono', 'Fira Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
};

export default function StripeSandboxPage(): React.ReactNode {
  // Dev-only · 404 in production so the page never ships to real users.
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  // Env-var presence check (names only · never values)
  const envVars = [
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "NEX_BILLING_CRON_SECRET",
    "STRIPE_PRICE_SHOP_STANDARD",
    "STRIPE_PRICE_SHOP_UNLIMITED",
    "STRIPE_PRICE_VAULT_5GB",
    "STRIPE_PRICE_VAULT_25GB",
    "STRIPE_PRICE_VAULT_50GB",
    "STRIPE_PRICE_VAULT_100GB",
    "STRIPE_PRICE_SHOP_STANDARD_IE",
    "STRIPE_PRICE_SHOP_UNLIMITED_IE",
    "STRIPE_PRICE_VAULT_5GB_IE",
    "DATABASE_URL",
  ].map((name) => ({
    name,
    set: typeof process.env[name] === "string" && process.env[name]!.length > 0,
  }));

  const registry = getPriceRegistry("hq");
  const configured = registry.configuredTiers();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: NEX.bg,
        color: NEX.text,
        padding: "24px 0",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "0 20px" }}>
        <header
          style={{
            paddingBottom: 16,
            marginBottom: 20,
            borderBottom: `1px solid ${NEX.border}`,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 11,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: NEX.textMute,
            }}
          >
            Dev · billing · Stripe test-mode sandbox
          </p>
          <h1 style={{ margin: "6px 0 0", fontSize: 24, fontWeight: 700 }}>
            Stripe Checkout sandbox
          </h1>
          <p style={{ margin: "8px 0 0", color: NEX.textDim, fontSize: 13 }}>
            Dev-only page. Returns 404 in production. Triggers the real
            /api/nex-native/billing/checkout endpoint using the configured
            Stripe test-mode credentials.
          </p>
        </header>

        <section
          style={{
            padding: 16,
            borderRadius: 12,
            background: NEX.panel,
            border: `1px solid ${NEX.border}`,
            marginBottom: 20,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 15 }}>Env var presence</h2>
          <p style={{ margin: "6px 0 10px", color: NEX.textMute, fontSize: 12 }}>
            Values are NEVER displayed · only whether a non-empty value is set.
          </p>
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {envVars.map((v) => (
              <li
                key={v.name}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "6px 0",
                  borderTop: `1px solid ${NEX.border}`,
                  fontFamily: NEX.mono,
                  fontSize: 12,
                }}
              >
                <span>{v.name}</span>
                <span style={{ color: v.set ? NEX.green : NEX.red }}>
                  {v.set ? "set" : "missing"}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section
          style={{
            padding: 16,
            borderRadius: 12,
            background: NEX.panel,
            border: `1px solid ${NEX.border}`,
            marginBottom: 20,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 15 }}>
            Resolved tiers · identity=hq (worldwide default)
          </h2>
          {configured.length === 0 ? (
            <p
              style={{
                margin: "10px 0 0",
                color: NEX.amber,
                fontSize: 13,
              }}
            >
              No tiers resolved. Configure{" "}
              <code>STRIPE_PRICE_SHOP_STANDARD</code> (etc.) in{" "}
              <code>.env.local</code> and reload.
            </p>
          ) : (
            <ul
              style={{
                margin: "10px 0 0",
                padding: 0,
                listStyle: "none",
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              {configured.map((t) => (
                <li
                  key={`${t.product}:${t.tier}`}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 999,
                    fontSize: 12,
                    color: NEX.cyan,
                    border: `1px solid ${NEX.cyan}`,
                    fontFamily: NEX.mono,
                  }}
                >
                  {t.product}·{t.tier}
                </li>
              ))}
            </ul>
          )}
        </section>

        <StripeSandboxActions />

        <section
          style={{
            marginTop: 20,
            padding: 16,
            borderRadius: 12,
            background: NEX.panel,
            border: `1px solid ${NEX.border}`,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 15 }}>What happens next</h2>
          <ol style={{ margin: "10px 0 0", color: NEX.textDim, fontSize: 13, lineHeight: 1.5 }}>
            <li>Clicking a Checkout button POSTs to <code>/api/nex-native/billing/checkout</code>.</li>
            <li>Server resolves your session account + the configured Stripe price ID.</li>
            <li>Server INSERTs a <code>nex_billing_checkout_session</code> row (pending).</li>
            <li>Server calls Stripe test-mode <code>checkout.sessions.create</code> with an idempotency key.</li>
            <li>You&apos;re redirected to the Stripe-hosted checkout page.</li>
            <li>Use the Stripe test card <strong>4242 4242 4242 4242</strong>, any future expiry, any CVC.</li>
            <li>On success, Stripe fires <code>checkout.session.completed</code> → <code>customer.subscription.created</code> → <code>invoice.payment_succeeded</code> at your webhook URL.</li>
            <li>The webhook endpoint verifies signature, delegates to the processor, flips <code>status=active</code>.</li>
            <li>Visit <code>/nex-native/billing</code> to see the resulting subscription state.</li>
          </ol>
        </section>
      </div>
    </div>
  );
}
