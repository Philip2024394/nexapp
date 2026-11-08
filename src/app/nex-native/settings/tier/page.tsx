// src/app/nex-native/settings/tier/page.tsx
//
// NEX Package & billing · slim surface · owner-authorised 2026-11-08
// (round 29c). SUPERSEDES the sealed 2026-09-29 Bridge 56 seven-tier
// Indonesia page.
// -----------------------------------------------------------------------------
// Context: the new commercial model (single Shop package at €4.99 /
// £4.99 / $4.99 / Rp 89,000 + separate storage + bandwidth packs)
// replaces the seven-tier Ringan/Plus/Bisnis/Try/Buy/Custom ladder.
// This page is reached from /settings and from /contacts "Package &
// billing" — those links are preserved. Full pricing details live
// at /nex-native/pricing · capacity management at
// /nex-native/settings/storage.
//
// Deliberately preserved from the old page:
//   · Auth gate + account lookup (so the current-plan indicator is
//     honest · not a "coming soon" placeholder).
//   · Three TrustBlocks (How to cancel · No hidden fees · How refunds
//     work) in sealed verbatim copy. These are regression anchors
//     for the honesty-copy tests at
//     __tests__/_cancel-copy-honesty.test.ts.
//   · NexPageHeader + dataScope="settings-tier" (unchanged).
//
// Deliberately removed:
//   · The three-tier `SubscriptionSection` grid (Ringan/Plus/Bisnis).
//   · The `startThemesTrialAction` trigger (action retained in
//     _actions.ts for any other caller, but no longer bound here · a
//     Shop subscription now bundles Chat Themes, so a separate themes
//     trial is semantically redundant for new buyers).
//   · The seven `TierOffer[]` data (Try / Buy / Ringan / Plus /
//     Bisnis / Custom).
//   · Indonesia-specific payment-chat routing (GoPay / DANA /
//     ShopeePay / QRIS / bank transfer). Future payment UX lives
//     with Stripe wiring on /pricing + /settings/storage.
//   · Monthly/Yearly toggle (annual billing is not sealed under the
//     new model).

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { effectiveTier } from "@/lib/nex-native/account-service";
import { ShopCheckoutButton } from "../../_shop-checkout-button";
import { ShopCancelButton } from "../../_shop-cancel-button";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { NexPageHeader } from "../../_page-header";
import type { NexAccountRow } from "@/lib/nex-native/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "var(--nex-world-background-base, #020914)",
  panel: "rgba(5, 15, 28, 0.72)",
  border: "rgba(198, 161, 91, 0.25)",
  borderHi: "rgba(198, 161, 91, 0.55)",
  emerald: "var(--nex-world-primary, #123D2B)",
  gold: "var(--nex-world-secondary, #C6A15B)",
  cream: "var(--nex-world-cream, #FAF8F4)",
  ink: "#F2F5F8",
  inkDim: "#B5C3D6",
  inkMuted: "#7D9BC0",
};
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export default async function TierPage() {
  // Dev-impersonation flows through this resolver so
  // NEX_DEV_IMPERSONATE_HANDLE (e.g. nex-99901) appears as the
  // signed-in viewer during testing, matching the storage page.
  const session = await resolveSessionWithDevOverride();
  if (!session) redirect("/nex-native/sign-in?next=/nex-native/settings/tier");

  const row = await nexSupabaseAdmin
    .from("nex_account")
    .select(
      "tier, bisnis_expires_at, display_name, nex_handle, subscription_plan, themes_trial_used_at",
    )
    .eq("id", session.account.id)
    .maybeSingle();
  if (row.error || !row.data) redirect("/nex-native/home");
  const account = row.data as Pick<
    NexAccountRow,
    | "tier"
    | "bisnis_expires_at"
    | "display_name"
    | "nex_handle"
    | "subscription_plan"
    | "themes_trial_used_at"
  >;
  const effective = effectiveTier(account);
  const isPaid = effective === "bisnis" || effective === "pro";
  const expiresLabel =
    isPaid && account.bisnis_expires_at
      ? new Date(account.bisnis_expires_at).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : null;

  return (
    <div style={{ minHeight: "100dvh", background: NEX.bg, color: NEX.ink }}>
      <NexPageHeader dataScope="settings-tier" />
      <main
        style={{
          maxWidth: 560,
          margin: "0 auto",
          padding: "clamp(16px, 4vw, 28px) 20px 80px",
          fontFamily: SANS,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {/* Header */}
        <header style={{ marginBottom: 2 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: NEX.gold,
            }}
          >
            Package & billing
          </span>
          <h1
            style={{
              margin: "4px 0 4px",
              fontSize: 22,
              fontWeight: 900,
              color: NEX.cream,
              letterSpacing: "-0.015em",
              lineHeight: 1.2,
            }}
          >
            Your NEX plan
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: NEX.inkDim,
              lineHeight: 1.5,
            }}
          >
            Chat is free forever. Shop is one global package at €4.99 /
            £4.99 / $4.99 / Rp 89,000 per month — same features
            everywhere.
          </p>
        </header>

        <CurrentPlanCard
          effective={effective}
          isPaid={isPaid}
          expiresLabel={expiresLabel}
          displayName={account.display_name}
          subscriptionPlan={account.subscription_plan}
        />

        <ShopSnapshot />

        <CapacityLink />

        {/* Honesty TrustBlocks · preserved from 2026-10-20 P3-B +
            Service Refund Policy seals. Copy must stay verbatim to
            keep the cancel-copy-honesty tests green. */}
        <section
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            marginTop: 8,
          }}
        >
          <TrustBlock
            title="How to cancel"
            body="To cancel a Bisnis subscription, message NEX via the NEX1 support chat. Cancellation is processed manually by NEX while the self-service flow is being built. Gratis is free — nothing to cancel."
          />
          <TrustBlock
            title="No hidden fees"
            body="What you see is what you pay. NEX never charges card surcharges, processing fees, or auto-upgrade you to a higher tier."
          />
          <TrustBlock
            title="How refunds work"
            body="Bisnis payments cover ongoing access to the NEX service. NEX does not offer a voluntary money-back period. If NEX has not delivered the service as agreed, your consumer rights under applicable law still apply — message NEX1 support to raise the issue."
          />
        </section>

        <footer
          style={{
            marginTop: 8,
            paddingTop: 10,
            borderTop: `1px solid ${NEX.border}`,
            fontSize: 10.5,
            color: NEX.inkMuted,
            lineHeight: 1.5,
            textAlign: "center",
          }}
        >
          See the full package comparison at{" "}
          <Link
            href="/nex-native/pricing"
            style={{ color: NEX.gold, textDecoration: "none" }}
          >
            /nex-native/pricing
          </Link>{" "}
          · capacity upgrades at{" "}
          <Link
            href="/nex-native/settings/storage"
            style={{ color: NEX.gold, textDecoration: "none" }}
          >
            /nex-native/settings/storage
          </Link>
          .
        </footer>
      </main>
    </div>
  );
}

function CurrentPlanCard({
  effective,
  isPaid,
  expiresLabel,
  displayName,
  subscriptionPlan,
}: {
  effective: "gratis" | "bisnis" | "pro";
  isPaid: boolean;
  expiresLabel: string | null;
  displayName: string | null;
  subscriptionPlan: string | null;
}) {
  const label = isPaid ? "NEX Shop" : "NEX Chat (free)";
  // Owner-sealed 2026-11-08 Option B · Gratis users entering the paid
  // Shop surface now see the explicit 7-day trial framing.
  const hint = isPaid
    ? expiresLabel
      ? `Active · renews ${expiresLabel}`
      : "Active subscription"
    : "Chat is free forever · start a 7-day free Shop trial to add products, themes and Vault.";
  return (
    <section
      style={{
        padding: "14px 16px 16px",
        background: isPaid
          ? `linear-gradient(135deg, ${NEX.emerald} 0%, rgba(5,15,28,0.94) 80%)`
          : NEX.panel,
        border: `1px solid ${isPaid ? NEX.gold : NEX.border}`,
        borderRadius: 14,
        boxShadow: isPaid ? "0 12px 32px rgba(0,0,0,0.45)" : "none",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 900,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: NEX.gold,
        }}
      >
        Current plan
      </div>
      <div
        style={{
          marginTop: 4,
          fontSize: 17,
          fontWeight: 900,
          color: NEX.cream,
          letterSpacing: "-0.01em",
        }}
      >
        {label}
      </div>
      {displayName ? (
        <div style={{ fontSize: 11, color: NEX.inkDim, marginTop: 2 }}>
          Signed in as {displayName}
          {subscriptionPlan ? ` · ${subscriptionPlan}` : ""}
        </div>
      ) : null}
      <p
        style={{
          margin: "8px 0 0",
          fontSize: 12,
          color: NEX.inkDim,
          lineHeight: 1.5,
        }}
      >
        {hint}
      </p>
      {!isPaid ? (
        <div style={{ marginTop: 10 }}>
          <ShopCheckoutButton />
        </div>
      ) : (
        <ShopCancelButton />
      )}
    </section>
  );
}

function ShopSnapshot() {
  return (
    <section
      style={{
        padding: "12px 14px 14px",
        background: NEX.panel,
        border: `1px solid ${NEX.border}`,
        borderRadius: 12,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 900,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: NEX.gold,
        }}
      >
        NEX Shop · one package
      </div>
      <div
        style={{
          marginTop: 3,
          fontSize: 13,
          fontWeight: 800,
          color: NEX.cream,
        }}
      >
        €4.99 / £4.99 / $4.99 / Rp 89,000 per month
      </div>
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: "6px 0 10px",
          display: "flex",
          flexDirection: "column",
          gap: 3,
        }}
      >
        {[
          "10 shop products · 3 shop videos",
          "1 GB storage · 30 GB monthly delivery",
          "Chat Themes included",
          "Vault included",
          "0% commission on sales",
        ].map((b) => (
          <li
            key={b}
            style={{
              fontSize: 11,
              color: NEX.ink,
              display: "flex",
              gap: 6,
              lineHeight: 1.4,
            }}
          >
            <span aria-hidden style={{ color: NEX.gold }}>·</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
      <Link
        href="/nex-native/pricing"
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: NEX.gold,
          textDecoration: "none",
        }}
      >
        See full details →
      </Link>
    </section>
  );
}

function CapacityLink() {
  return (
    <Link
      href="/nex-native/settings/storage"
      style={{
        display: "block",
        padding: "12px 14px",
        background: NEX.panel,
        border: `1px solid ${NEX.border}`,
        borderRadius: 12,
        color: NEX.ink,
        textDecoration: "none",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 900,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: NEX.gold,
        }}
      >
        Storage
      </div>
      <div
        style={{
          marginTop: 3,
          fontSize: 13,
          fontWeight: 800,
          color: NEX.cream,
        }}
      >
        See your usage · buy more storage →
      </div>
      <div style={{ fontSize: 11, color: NEX.inkDim, marginTop: 2 }}>
        +5 / +10 / +25 GB packs · recurring monthly · cancel anytime.
      </div>
    </Link>
  );
}

function TrustBlock({ title, body }: { title: string; body: string }) {
  return (
    <div
      style={{
        padding: "10px 12px",
        background: NEX.panel,
        border: `1px solid ${NEX.border}`,
        borderRadius: 10,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 900,
          color: NEX.gold,
          letterSpacing: "0.04em",
        }}
      >
        {title}
      </div>
      <p
        style={{
          margin: "4px 0 0",
          fontSize: 11.5,
          color: NEX.inkDim,
          lineHeight: 1.5,
        }}
      >
        {body}
      </p>
    </div>
  );
}
