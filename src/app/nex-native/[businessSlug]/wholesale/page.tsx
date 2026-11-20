// src/app/nex-native/[businessSlug]/wholesale/page.tsx
//
// NEX Wholesale catalogue · PUBLIC BUYER route. Authored 2026-11-18
// during wholesale catalogue scaffold (Phase W).
//
// Scope · §4 and §5 of the master build prompt
//   · Dedicated route behind seller-scoped approval.
//   · Uses the shop's branding (display name + handle).
//   · Access matrix enforced server-side at every boundary:
//       anon         → redirect to /nex-native/sign-in?next=<this>
//       signed non-owner, no approval row → request-access page
//       signed non-owner, approved        → full wholesale catalogue
//       signed non-owner, revoked         → access denied
//       signed owner (same business)      → preview of the buyer view
//   · noindex meta so search engines never ingest a wholesale page.
//
// Phase W state (migration 350 PROPOSAL, not applied)
//   · `nex_wholesale_buyer_approval` does NOT exist in sandbox or prod
//     yet. The real resolver (`resolveWholesaleApproval`) issues a
//     SELECT and detects Postgres '42P01' (undefined_table), returning
//     { kind: "db_unavailable", reason: "migration_not_applied" }.
//   · That outcome maps to the UI's "unapproved" branch, which renders
//     RequestAccessShell. The owner short-circuit still renders the
//     preview, so owner-internal use is READY while buyer evidence
//     remains BLOCKED pending the migration · exactly the split W19
//     described. DB-wired rule (2026-11-12) · no silent promote.
//   · When the migration is applied, no code change is required here
//     · the SELECT begins returning real rows and the discriminated
//     union collapses naturally.
//
// Important · product-record doctrine (§3)
//   · This route reads the SAME `nex_product` records as the retail
//     shop. We filter + project wholesale fields from
//     `spec.__wholesale`. We do NOT create or duplicate product rows.
//   · Retail price is NEVER shown on this page (prompt §4: "The
//     buyer catalogue does not compete with the retail price").

import type * as React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { getBusinessBySlug } from "@/lib/nex-native/business-service";
import { listProductsByBusiness } from "@/lib/nex-native/product-service";
import { resolveWholesaleApproval } from "@/lib/nex-native/wholesale/approval-service";
import {
  isWholesalePublishable,
  readTiersFromSpec,
  type WholesaleTierT,
} from "@/lib/nex-native/catalogue/wholesale-tiers";
// W15 (2026-11-18) · interactive buyer card.
import { WholesaleBuyerCard } from "@/components/nex-native/catalogue/wholesale-buyer-card";
// W-UI (2026-11-18 · follow-up) · wired access-request form that posts
// to `requestWholesaleAccessAction` and renders the real server outcome
// including `migration_not_applied` as a soft-blocked panel.
import { WholesaleRequestForm } from "@/components/nex-native/catalogue/wholesale-request-form";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Keep every wholesale catalogue URL out of public indexes.
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

const PALETTE = {
  bg: "#0B1A13",
  text: "#F2F5F8",
  textMuted: "#B5C3D6",
  textDim: "#7D9BC0",
  accent: "#C6A15B",
  cardBg: "rgba(10, 28, 20, 0.72)",
  cardBorder: "rgba(198, 161, 91, 0.35)",
};

// ─── Approval state shape ────────────────────────────────────────────────────
//
// The three UI branches the renderer must cover. The richer
// `WholesaleAccessDecision` union exposed by `approval-service.ts`
// (owner/approved/pending/revoked/unapproved/unauthenticated/db_unavailable)
// collapses into these three here. Every non-owner / non-approved
// outcome — including `db_unavailable { reason: "migration_not_applied" }`
// — intentionally renders as "unapproved" so the honest fail-closed
// RequestAccessShell shows. DB-wired rule (2026-11-12) requires we never
// silently promote to "approved".
type ApprovalState = "owner" | "approved" | "unapproved";

export default async function BuyerWholesalePage(props: {
  params: Promise<{ businessSlug: string }>;
}): Promise<React.JSX.Element> {
  const { businessSlug } = await props.params;

  const business = await getBusinessBySlug(businessSlug).catch(() => null);
  if (!business) {
    return <NotFoundShell slug={businessSlug} />;
  }

  const session = await resolveSessionWithDevOverride();
  if (!session) {
    // Prompt §5 · anon viewers go to sign-in, preserving next=.
    const next = encodeURIComponent(`/nex-native/${businessSlug}/wholesale`);
    redirect(`/nex-native/sign-in?next=${next}`);
  }

  // W21 (2026-11-18) · wire to the real pure-service resolver. On 42P01
  // (migration 350 not yet applied) it returns `db_unavailable` which
  // maps to "unapproved" below · honest BLOCKED render, no silent promote.
  const decision = await resolveWholesaleApproval({
    viewerAccountId: session.account.id,
    businessId: business.id,
    businessOwnerAccountId: business.owner_account_id,
  });
  const state: ApprovalState =
    decision.kind === "owner"
      ? "owner"
      : decision.kind === "approved"
        ? "approved"
        : "unapproved";

  if (state === "unapproved") {
    return (
      <RequestAccessShell
        businessId={business.id}
        businessSlug={businessSlug}
        businessDisplayName={business.display_name}
      />
    );
  }

  // state === "owner" OR "approved" · render the buyer catalogue.
  const products = await listProductsByBusiness(business.id, "live").catch(
    () => [],
  );

  type Row = {
    readonly id: string;
    readonly name: string;
    readonly image_url: string | null;
    readonly tiers: readonly WholesaleTierT[];
    // W15 · retain raw wholesale jsonb so the interactive card can read
    // spec-level dispatch range + branding/custom-spec capability flags
    // without a second server call.
    readonly rawWholesale: unknown;
    readonly currency: string;
  };

  const rows: Row[] = [];
  for (const p of products) {
    const spec = (p.spec ?? null) as unknown;
    const wholesale =
      spec && typeof spec === "object"
        ? (spec as Record<string, unknown>).__wholesale
        : null;
    if (!isWholesalePublishable(wholesale)) continue;
    const tiers = readTiersFromSpec(wholesale);
    rows.push({
      id: p.id,
      name: p.name,
      image_url: p.image_url ?? null,
      tiers,
      rawWholesale: wholesale,
      currency: p.currency,
    });
  }

  return (
    <>
      <style>{`html, body { background: ${PALETTE.bg}; }`}</style>
      <main
        data-nex-buyer-wholesale
        data-preview={state === "owner" ? "true" : undefined}
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
            maxWidth: 820,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          {state === "owner" ? <PreviewBanner /> : null}

          <header>
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
              Trade
            </span>
            <h1
              style={{
                margin: "10px 0 2px",
                fontSize: 28,
                fontWeight: 900,
                letterSpacing: "-0.015em",
              }}
            >
              {business.display_name} · Wholesale
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: PALETTE.textMuted }}>
              Quantity-based pricing for approved trade buyers. Contact
              the seller to place an order.
            </p>
          </header>

          {/* W15 · master-prompt §3 · freight is NEVER bundled into
             the goods price; make this the first thing the buyer reads. */}
          <aside
            data-nex-wholesale-freight-notice
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              background: "rgba(120, 70, 20, 0.30)",
              border: "1.5px solid rgba(220, 160, 90, 0.55)",
              color: PALETTE.text,
              fontSize: 12.5,
              lineHeight: 1.55,
            }}
          >
            <strong style={{ fontWeight: 800 }}>
              Freight excluded — quote required.
            </strong>{" "}
            Prices below are for goods only. Shipping cost, method and
            transit time are quoted separately by the seller once the
            order is agreed. You will be asked to accept the freight
            quote before any payment is taken.
          </aside>

          {rows.length === 0 ? (
            <EmptyCatalogue />
          ) : (
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: 14,
              }}
            >
              {/* W15 · interactive card · editable qty + applicable tier
                 highlight + live line total + explicit freight copy + per-tier
                 dispatch (production time only). */}
              {rows.map((r) => (
                <WholesaleBuyerCard key={r.id} row={r} />
              ))}
            </ul>
          )}
        </div>
      </main>
    </>
  );
}

// ─── Sub-views ─────────────────────────────────────────────────────────────

function PreviewBanner(): React.JSX.Element {
  return (
    <div
      role="status"
      style={{
        padding: "10px 14px",
        borderRadius: 10,
        background: "rgba(90, 120, 200, 0.18)",
        border: "1px solid rgba(130, 160, 220, 0.45)",
        color: PALETTE.text,
        fontSize: 12.5,
        lineHeight: 1.5,
      }}
    >
      <strong style={{ fontWeight: 800 }}>Preview mode.</strong> You are
      seeing the exact buyer view of your wholesale catalogue because
      you own this shop. Approved buyers see the same layout; nothing
      is hidden for you.
    </div>
  );
}

function EmptyCatalogue(): React.JSX.Element {
  return (
    <section
      style={{
        padding: 22,
        borderRadius: 14,
        background: PALETTE.cardBg,
        border: `1.5px solid ${PALETTE.cardBorder}`,
      }}
    >
      <h2 style={{ margin: "0 0 10px", fontSize: 16, fontWeight: 800 }}>
        No wholesale products listed yet
      </h2>
      <p
        style={{
          margin: 0,
          fontSize: 13,
          lineHeight: 1.55,
          color: PALETTE.textMuted,
        }}
      >
        This shop hasn't published any wholesale-ready products. Check
        back later, or get in touch directly if you're after a bulk
        order.
      </p>
    </section>
  );
}

function ProductCard(props: { row: {
  readonly id: string;
  readonly name: string;
  readonly image_url: string | null;
  readonly tiers: readonly WholesaleTierT[];
} }): React.JSX.Element {
  const { row } = props;
  const sorted = [...row.tiers].sort((a, b) => a.min_qty - b.min_qty);
  const moq = sorted[0]?.min_qty ?? null;

  return (
    <li
      style={{
        padding: 0,
        borderRadius: 14,
        background: PALETTE.cardBg,
        border: `1.5px solid ${PALETTE.cardBorder}`,
        overflow: "hidden",
        display: "grid",
        // Prompt §4 · desktop = image LEFT, details right. Phone =
        // image above details.
        gridTemplateColumns: "1fr",
      }}
    >
      <style>{`
        @media (min-width: 640px) {
          [data-nex-wholesale-card="${row.id}"] {
            grid-template-columns: 220px 1fr;
          }
        }
      `}</style>
      <div data-nex-wholesale-card={row.id} style={{ display: "contents" }}>
        <div
          style={{
            aspectRatio: "1 / 1",
            background: "#0A1611",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {row.image_url ? (
            // Prompt §4 · real thumbnails only, never placeholders.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={row.image_url}
              alt={row.name}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          ) : (
            <span
              style={{
                color: PALETTE.textDim,
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              No image
            </span>
          )}
        </div>
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <h3
            style={{
              margin: 0,
              fontSize: 17,
              fontWeight: 800,
              letterSpacing: "-0.01em",
            }}
          >
            {row.name}
          </h3>
          {moq !== null ? (
            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: PALETTE.textDim,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              MOQ · {moq} pcs
            </p>
          ) : null}
          <table
            aria-label="Quantity tiers"
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13,
            }}
          >
            <thead>
              <tr style={{ color: PALETTE.textMuted, textAlign: "left" }}>
                <th style={{ padding: "6px 0", fontWeight: 700 }}>From qty</th>
                <th style={{ padding: "6px 0", fontWeight: 700 }}>Per piece</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => (
                <tr key={t.min_qty} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <td style={{ padding: "6px 0", fontVariantNumeric: "tabular-nums" }}>
                    {t.min_qty}+
                  </td>
                  <td
                    style={{
                      padding: "6px 0",
                      fontVariantNumeric: "tabular-nums",
                      fontWeight: 700,
                    }}
                  >
                    {formatPence(t.price_per_piece_pence)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </li>
  );
}

function formatPence(p: number): string {
  // Catalogue-level currency is on the product row; this rendering
  // omits it until the public currency resolver is wired in Phase W+1.
  // Keep output honest: raw pounds/pence shape with no currency sign
  // rather than a wrong sign.
  const major = Math.floor(p / 100);
  const minor = (p % 100).toString().padStart(2, "0");
  return `${major}.${minor}`;
}

// ─── Error/empty shells ─────────────────────────────────────────────────────

function NotFoundShell(props: { slug: string }): React.JSX.Element {
  return (
    <>
      <style>{`html, body { background: ${PALETTE.bg}; }`}</style>
      <main
        style={{
          minHeight: "100dvh",
          background: PALETTE.bg,
          color: PALETTE.text,
          fontFamily: SANS,
          padding: "40px 18px",
        }}
      >
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <h1 style={{ margin: "0 0 10px", fontSize: 24, fontWeight: 900 }}>
            Shop not found
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: PALETTE.textMuted }}>
            We couldn't find a shop at <code>{props.slug}</code>.
          </p>
        </div>
      </main>
    </>
  );
}

function RequestAccessShell(props: {
  businessId: string;
  businessSlug: string;
  businessDisplayName: string;
}): React.JSX.Element {
  return (
    <>
      <style>{`html, body { background: ${PALETTE.bg}; }`}</style>
      <main
        data-nex-buyer-wholesale-request
        style={{
          minHeight: "100dvh",
          background: PALETTE.bg,
          color: PALETTE.text,
          fontFamily: SANS,
          padding: "calc(env(safe-area-inset-top, 0px) + 40px) 18px 40px",
        }}
      >
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
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
            Trade access
          </span>
          <h1
            style={{
              margin: "10px 0 8px",
              fontSize: 24,
              fontWeight: 900,
              letterSpacing: "-0.015em",
            }}
          >
            {props.businessDisplayName}'s wholesale catalogue is for
            approved buyers
          </h1>
          <p
            style={{
              margin: "0 0 14px",
              fontSize: 13.5,
              lineHeight: 1.55,
              color: PALETTE.textMuted,
            }}
          >
            To see trade prices and quantity tiers, request access. The
            seller reviews each request personally · approval by one
            seller does not grant access to any other seller's
            catalogue.
          </p>

          {/* W-UI (2026-11-18) · form now posts to
             `requestWholesaleAccessAction`. When migration 350 isn't
             applied the server returns `migration_not_applied` and the
             form renders a soft-blocked panel ("Wholesale ordering not
             enabled yet"). When the migration IS applied the form
             records the request and shows "Access requested". UI is
             wired, not disconnected. */}
          <WholesaleRequestForm
            businessId={props.businessId}
            businessSlug={props.businessSlug}
            businessDisplayName={props.businessDisplayName}
          />
        </div>
      </main>
    </>
  );
}
