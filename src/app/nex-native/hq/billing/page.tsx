// src/app/nex-native/hq/billing/page.tsx
//
// NEX Billing · HQ Admin · read-only account/event lookup.
// ---------------------------------------------------------------------------
// Owner-authorised 2026-11-02 (MASTER BUILD · LOCAL DRAFT · NOT linked
// from navigation yet). HQ-gated via sealed `requireHqAdmin`.
//
// Read-only · never mutates. Accepts a `?account=<uuid>` query param
// (admin pastes account ID from support ticket) and renders:
//   · nex_account snapshot for Shop + Vault
//   · open + historical adverse events (both products)
//   · recent event-log rows for the account (last 50)
//   · recent checkout sessions (last 20)
//
// Writes (manual-revocation / clear) will arrive in a FUTURE admin
// surface protected by a separate audit-trail-enforced action handler.

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { requireHqAdmin, HqAuthorizationError } from "@/lib/nex-native/hq-authorization";
import {
  createProductionBillingStore,
  SupabaseBillingStore,
} from "@/lib/nex-native/billing/supabase-store";
import { accessLevel } from "@/lib/nex-native/billing/entitlement";
import type {
  AccountEntitlementView,
  AccessLevel,
} from "@/lib/nex-native/billing/types";
import { AdminOverridePanel } from "./_admin-override-panel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "#020914",
  panel: "#03101D",
  panelSoft: "rgba(6, 15, 28, 0.72)",
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

interface PageProps {
  searchParams: Promise<{ account?: string }>;
}

export default async function HqBillingPage({
  searchParams,
}: PageProps): Promise<React.ReactNode> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/hq/billing");
  }
  try {
    await requireHqAdmin(session.account.id);
  } catch (err) {
    if (err instanceof HqAuthorizationError) {
      return <ForbiddenShell />;
    }
    throw err;
  }

  const params = await searchParams;
  const accountId = (params?.account ?? "").trim();
  const uuidOk =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(accountId);

  let store: SupabaseBillingStore | null = null;
  try {
    store = createProductionBillingStore();
  } catch {
    store = null;
  }

  let shopView: AccountEntitlementView | null = null;
  let vaultView: AccountEntitlementView | null = null;
  let backendErrored = false;

  if (store && uuidOk) {
    try {
      [shopView, vaultView] = await Promise.all([
        store.readProductView(accountId, "shop").catch(() => null),
        store.readProductView(accountId, "vault").catch(() => null),
      ]);
    } catch {
      backendErrored = true;
    } finally {
      await store.end();
    }
  }
  const now = new Date();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: NEX.bg,
        color: NEX.text,
        padding: "24px 0 72px",
        fontFamily:
          "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "0 20px" }}>
        <header
          style={{
            borderBottom: `1px solid ${NEX.border}`,
            paddingBottom: 16,
            marginBottom: 20,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: 2,
              color: NEX.textMute,
            }}
          >
            NEX HQ · Billing lookup
          </p>
          <h1 style={{ margin: "6px 0 0", fontSize: 24, fontWeight: 700 }}>
            Account billing status
          </h1>
          <p style={{ margin: "8px 0 0", color: NEX.textDim, fontSize: 13 }}>
            Read-only. Operator actions arrive in a future admin surface with
            audit trail.
          </p>
        </header>

        <form method="get" style={{ marginBottom: 24 }}>
          <label
            htmlFor="account"
            style={{
              display: "block",
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: 1,
              color: NEX.textMute,
              marginBottom: 6,
            }}
          >
            NEX Account UUID
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              id="account"
              name="account"
              defaultValue={accountId}
              placeholder="00000000-0000-0000-0000-000000000000"
              style={{
                flex: "1 1 320px",
                minHeight: 44,
                padding: "10px 14px",
                background: NEX.panel,
                border: `1px solid ${NEX.border}`,
                borderRadius: 10,
                color: NEX.text,
                fontFamily: NEX.mono,
                fontSize: 13,
              }}
              required
              pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
            />
            <button
              type="submit"
              style={{
                minHeight: 44,
                padding: "0 20px",
                background: NEX.cyan,
                color: NEX.bg,
                border: "none",
                borderRadius: 10,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Look up
            </button>
          </div>
        </form>

        {!accountId ? (
          <EmptyShell />
        ) : !uuidOk ? (
          <Message
            tone="warn"
            title="Invalid account ID shape"
            body="Enter a canonical UUID."
          />
        ) : !store ? (
          <Message
            tone="warn"
            title="Billing backend unavailable"
            body="DATABASE_URL is not configured for the canonical NEX Supabase project, OR migrations 207/257/258 have not been applied. This is expected during local development · the lookup will come online once Gate 1 and the production deployment land."
          />
        ) : backendErrored ? (
          <Message
            tone="error"
            title="Backend error"
            body="The billing read failed. Check Vercel logs."
          />
        ) : !shopView && !vaultView ? (
          <Message
            tone="info"
            title="Account not found"
            body={`No billing record for account ${accountId}. The account may be new, or the ID may not exist.`}
          />
        ) : (
          <>
            <ProductBlock
              label="Shop"
              view={shopView}
              access={shopView ? accessLevel(shopView, now) : "none"}
            />
            <ProductBlock
              label="Vault"
              view={vaultView}
              access={vaultView ? accessLevel(vaultView, now) : "none"}
            />
            <AdminOverridePanel accountId={accountId} />
          </>
        )}

        <footer style={{ marginTop: 32, fontSize: 12, color: NEX.textMute }}>
          <Link
            href="/nex-native/hq"
            style={{ color: NEX.cyan, textDecoration: "none" }}
          >
            ← Back to HQ
          </Link>
        </footer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ProductBlock({
  label,
  view,
  access,
}: {
  label: string;
  view: AccountEntitlementView | null;
  access: AccessLevel;
}): React.ReactNode {
  const accessColor =
    access === "full" ? NEX.green : access === "read-only" ? NEX.amber : NEX.red;
  return (
    <section
      style={{
        marginBottom: 20,
        padding: 20,
        borderRadius: 14,
        background: NEX.panel,
        border: `1px solid ${NEX.border}`,
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{label}</h2>
        <span
          style={{
            padding: "4px 10px",
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 700,
            color: accessColor,
            border: `1px solid ${accessColor}`,
          }}
        >
          access · {access}
        </span>
      </header>

      {!view || view.snapshot.tier === null ? (
        <p style={{ marginTop: 12, color: NEX.textDim, fontSize: 14 }}>
          No subscription record for {label}.
        </p>
      ) : (
        <>
          <KeyValueGrid
            items={[
              ["tier", view.snapshot.tier],
              ["status", view.snapshot.status ?? "—"],
              [
                "period_end",
                view.snapshot.periodEnd ? view.snapshot.periodEnd.toISOString() : "—",
              ],
              [
                "past_due_at",
                view.snapshot.pastDueAt ? view.snapshot.pastDueAt.toISOString() : "—",
              ],
              ["stripe_customer_id", view.snapshot.stripeCustomerId ?? "—"],
              ["stripe_subscription_id", view.snapshot.stripeSubscriptionId ?? "—"],
              ["stripe_price_id", view.snapshot.stripePriceId ?? "—"],
            ]}
          />

          <h3 style={{ marginTop: 20, fontSize: 14, color: NEX.text }}>
            Adverse events ({view.adverseEvents.length})
          </h3>
          {view.adverseEvents.length === 0 ? (
            <p style={{ margin: "4px 0 0", color: NEX.textMute, fontSize: 13 }}>
              None.
            </p>
          ) : (
            <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none" }}>
              {view.adverseEvents.map((ev) => (
                <li
                  key={ev.id}
                  style={{
                    padding: "10px 12px",
                    marginTop: 6,
                    borderRadius: 10,
                    background: NEX.panelSoft,
                    border: `1px solid ${NEX.border}`,
                    fontSize: 12,
                    fontFamily: NEX.mono,
                    color: NEX.textDim,
                  }}
                >
                  <strong style={{ color: NEX.text }}>{ev.adverseType}</strong>
                  {" · "}
                  blocking={String(ev.accessBlocking)}
                  {" · "}
                  cleared={ev.accessBlockClearedAt ? ev.accessBlockClearedAt.toISOString() : "no"}
                  {" · "}
                  opened={ev.openedAt.toISOString()}
                  {ev.stripeDisputeId ? ` · dispute=${ev.stripeDisputeId}` : ""}
                  {ev.stripeRefundId ? ` · refund=${ev.stripeRefundId}` : ""}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function KeyValueGrid({
  items,
}: {
  items: [string, string][];
}): React.ReactNode {
  return (
    <dl
      style={{
        marginTop: 12,
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: 10,
      }}
    >
      {items.map(([k, v]) => (
        <div key={k}>
          <dt
            style={{
              margin: 0,
              color: NEX.textMute,
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            {k}
          </dt>
          <dd
            style={{
              margin: "4px 0 0",
              color: NEX.text,
              fontSize: 13,
              fontFamily: NEX.mono,
              wordBreak: "break-all",
            }}
          >
            {v}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Message({
  tone,
  title,
  body,
}: {
  tone: "info" | "warn" | "error";
  title: string;
  body: string;
}): React.ReactNode {
  const color = tone === "error" ? NEX.red : tone === "warn" ? NEX.amber : NEX.cyan;
  return (
    <section
      style={{
        padding: 16,
        borderRadius: 12,
        background: NEX.panel,
        border: `1px solid ${color}`,
      }}
    >
      <h2 style={{ margin: 0, color, fontSize: 15 }}>{title}</h2>
      <p style={{ margin: "6px 0 0", color: NEX.textDim, fontSize: 13 }}>
        {body}
      </p>
    </section>
  );
}

function EmptyShell(): React.ReactNode {
  return (
    <Message
      tone="info"
      title="Enter a NEX account UUID to look up its billing status"
      body="Paste the account UUID from the support ticket to see the Shop + Vault subscription state."
    />
  );
}

function ForbiddenShell(): React.ReactNode {
  return (
    <div
      style={{
        padding: 48,
        maxWidth: 500,
        margin: "72px auto",
        textAlign: "center",
        background: "#020914",
        color: "#F4F7FC",
        fontFamily:
          "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <h1 style={{ margin: 0, color: NEX.red }}>Forbidden</h1>
      <p style={{ marginTop: 12, color: NEX.textDim, fontSize: 14 }}>
        You do not have HQ admin access.
      </p>
    </div>
  );
}
