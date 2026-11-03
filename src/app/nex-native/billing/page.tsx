// src/app/nex-native/billing/page.tsx
//
// NEX Billing · customer-facing billing + subscriptions surface.
// ---------------------------------------------------------------------------
// Owner-authorised 2026-11-02 (MASTER BUILD · LOCAL DRAFT · NOT LINKED
// from navigation yet). Separate from the sealed /settings/tier themes
// surface + the sealed /packages marketing surface.
//
// Server component · session-authenticated · fail-closed graceful UI
// when the billing backend is not yet available (migrations unapplied,
// DATABASE_URL missing, etc.). Shows:
//   · Current Shop subscription + access state + usage summary
//   · Current Vault subscription + access state + usage summary
//   · Package benefits + "Change plan" button
//   · Cancellation controls (opens future server action)
//   · Billing history link (not yet built · placeholder)

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import {
  createProductionBillingStore,
  SupabaseBillingStore,
} from "@/lib/nex-native/billing/supabase-store";
import { accessLevel } from "@/lib/nex-native/billing/entitlement";
import {
  computeCancellationTimeline,
} from "@/lib/nex-native/billing/cancellation";
import type {
  AccountEntitlementView,
  AccessLevel,
  NexProduct,
} from "@/lib/nex-native/billing/types";
import { NexPageHeader } from "../_page-header";
import { CustomerBillingControls } from "./_customer-controls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "var(--nex-world-background-base, #020914)",
  panel: "#03101D",
  panelSoft: "rgba(6, 15, 28, 0.72)",
  border: "rgba(139, 169, 209, 0.14)",
  borderStrong: "rgba(0, 175, 255, 0.35)",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
  cyan: "#00AFFF",
  orange: "#FF7800",
  green: "#22E37A",
  amber: "#FFB700",
  red: "#D33A3A",
};

interface ProductCardData {
  readonly product: NexProduct;
  readonly label: string;
  readonly priceCopy: string;
  readonly view: AccountEntitlementView | null;
  readonly access: AccessLevel;
  readonly timeline: {
    readonly fullAccessUntil: Date | null;
    readonly graceUntil: Date | null;
  };
}

async function loadView(
  store: SupabaseBillingStore,
  accountId: string,
  product: NexProduct,
): Promise<AccountEntitlementView | null> {
  try {
    return await store.readProductView(accountId, product);
  } catch {
    // Any read failure (missing columns, missing table, missing
    // migration) returns null · caller shows "coming soon" chrome.
    return null;
  }
}

export default async function NexBillingPage(): Promise<React.ReactNode> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/billing");
  }

  // Attempt to load views. Fail-closed · if the store can't be built
  // (DATABASE_URL missing or wrong project ref) we show the Coming Soon
  // surface instead of throwing.
  let store: SupabaseBillingStore | null = null;
  try {
    store = createProductionBillingStore();
  } catch {
    store = null;
  }

  let shopCard: ProductCardData | null = null;
  let vaultCard: ProductCardData | null = null;
  const now = new Date();

  if (store) {
    try {
      const [shopView, vaultView] = await Promise.all([
        loadView(store, session.account.id, "shop"),
        loadView(store, session.account.id, "vault"),
      ]);
      shopCard = {
        product: "shop",
        label: "NEX Shop",
        priceCopy: shopView?.snapshot.tier === "unlimited"
          ? "€29.99 / month · Unlimited"
          : shopView?.snapshot.tier === "standard"
            ? "€19.99 / month · Standard"
            : "€19.99 / month",
        view: shopView,
        access: shopView ? accessLevel(shopView, now) : "none",
        timeline: computeCancellationTimeline({
          periodEnd: shopView?.snapshot.periodEnd ?? null,
          pastDueAt: shopView?.snapshot.pastDueAt ?? null,
        }),
      };
      vaultCard = {
        product: "vault",
        label: "NEX Vault",
        priceCopy: vaultView?.snapshot.tier === "5gb"
          ? "€9.99 / month · 5 GB"
          : vaultView?.snapshot.tier === "25gb"
            ? "€19.99 / month · 25 GB"
            : vaultView?.snapshot.tier === "50gb"
              ? "€29.99 / month · 50 GB"
              : vaultView?.snapshot.tier === "100gb"
                ? "€49.99 / month · 100 GB"
                : "€9.99 / month",
        view: vaultView,
        access: vaultView ? accessLevel(vaultView, now) : "none",
        timeline: computeCancellationTimeline({
          periodEnd: vaultView?.snapshot.periodEnd ?? null,
          pastDueAt: vaultView?.snapshot.pastDueAt ?? null,
        }),
      };
    } finally {
      await store.end();
    }
  }

  // If store never built OR both views are null, show the "coming soon" shell
  const backendReady = store !== null && (shopCard !== null || vaultCard !== null);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: NEX.bg,
        color: NEX.text,
        padding: "0 0 72px",
        fontFamily:
          "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <NexPageHeader dataScope="billing" />
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "16px 20px" }}>
        {!backendReady ? (
          <ComingSoonBanner />
        ) : (
          <>
            {shopCard ? <ProductCard data={shopCard} /> : null}
            {vaultCard ? <ProductCard data={vaultCard} /> : null}
            <FooterLinks />
          </>
        )}
      </div>
    </div>
  );
}

function ComingSoonBanner(): React.ReactNode {
  return (
    <section
      style={{
        marginTop: 16,
        padding: 24,
        borderRadius: 16,
        background: NEX.panel,
        border: `1px solid ${NEX.border}`,
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: 20,
          fontWeight: 700,
          color: NEX.text,
        }}
      >
        NEX Billing · coming soon
      </h2>
      <p style={{ marginTop: 12, color: NEX.textDim, lineHeight: 1.5 }}>
        We&apos;re finishing the subscription controls for NEX Shop and NEX
        Vault. Your current access is unaffected. When billing opens here,
        you&apos;ll be able to upgrade, cancel, see your usage and view
        invoices without leaving NEX.
      </p>
    </section>
  );
}

function ProductCard({ data }: { data: ProductCardData }): React.ReactNode {
  const { view, access, timeline, label, priceCopy } = data;
  const hasSubscription = view?.snapshot.tier !== null && view !== null;
  const statusLabel = (() => {
    if (access === "full") return { text: "Active", color: NEX.green };
    if (access === "read-only")
      return { text: "Read-only grace", color: NEX.amber };
    return { text: "No access", color: NEX.red };
  })();

  return (
    <section
      style={{
        marginTop: 16,
        padding: 20,
        borderRadius: 16,
        background: NEX.panel,
        border: `1px solid ${NEX.border}`,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 700,
              color: NEX.text,
            }}
          >
            {label}
          </h2>
          <p style={{ margin: "6px 0 0", color: NEX.textDim, fontSize: 14 }}>
            {priceCopy}
          </p>
        </div>
        <span
          style={{
            padding: "6px 12px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 700,
            color: statusLabel.color,
            border: `1px solid ${statusLabel.color}`,
            background: "rgba(0,0,0,0.3)",
            whiteSpace: "nowrap",
          }}
        >
          {statusLabel.text}
        </span>
      </header>

      {!hasSubscription ? (
        <p style={{ marginTop: 16, color: NEX.textDim, lineHeight: 1.5 }}>
          You don&apos;t have an active {label} subscription.{" "}
          <span style={{ color: NEX.cyan }}>Start one</span> to unlock the full
          set of features.
        </p>
      ) : (
        <>
          <dl
            style={{
              marginTop: 16,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            <Fact label="Current tier" value={view!.snapshot.tier ?? "—"} />
            <Fact label="Status (Stripe)" value={view!.snapshot.status ?? "—"} />
            <Fact
              label="Renews / ends"
              value={
                timeline.fullAccessUntil
                  ? timeline.fullAccessUntil.toISOString().slice(0, 10)
                  : "—"
              }
            />
            {access === "read-only" && timeline.graceUntil ? (
              <Fact
                label="Read-only grace ends"
                value={timeline.graceUntil.toISOString().slice(0, 10)}
              />
            ) : null}
          </dl>

          <CustomerBillingControls
            product={data.product}
            currentTier={view!.snapshot.tier}
            hasSubscription={hasSubscription}
          />
        </>
      )}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }): React.ReactNode {
  return (
    <div>
      <dt
        style={{
          margin: 0,
          color: NEX.textMute,
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: 0.4,
        }}
      >
        {label}
      </dt>
      <dd style={{ margin: "4px 0 0", color: NEX.text, fontSize: 15 }}>
        {value}
      </dd>
    </div>
  );
}

function FooterLinks(): React.ReactNode {
  return (
    <section
      style={{
        marginTop: 24,
        padding: 20,
        borderRadius: 16,
        background: NEX.panelSoft,
        border: `1px solid ${NEX.border}`,
      }}
    >
      <h3 style={{ margin: 0, color: NEX.text, fontSize: 16 }}>
        Billing history
      </h3>
      <p style={{ margin: "8px 0 0", color: NEX.textDim, fontSize: 14 }}>
        Invoices and payment history view arrives with the next build gate.
        Please contact support if you need an invoice sooner.
      </p>
    </section>
  );
}

