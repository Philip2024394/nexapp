// src/app/nex-native/manage/wholesale/page.tsx
//
// NEX Wholesale catalogue · owner management page.
// Authored 2026-11-18 during wholesale catalogue scaffold (Phase W).
//
// Scope · §1 of the master build prompt
//   · A clearly labelled "Wholesale" destination routed from the
//     right-side navigation drawer's Shop/Online Shop owner section
//     (see control-drawer-client.tsx · key "wholesale").
//   · OWNER management page. NOT the buyer catalogue.
//   · Intro copy explaining the trade-only view and approval model.
//   · Catalogue-link area (shareable + preview).
//   · Product-readiness list (which of the owner's live products are
//     wholesale-publishable right now).
//   · Buyer-approval panels are BLOCKED on migration 350 (the
//     nex_wholesale_buyer_approval table is still PROPOSAL-only · not
//     applied). The panels render honest BLOCKED copy today.
//
// Access
//   · No session → sign-in with next= preserved.
//   · Session but no owned business → "start a shop" placeholder (same
//     pattern as /manage/orders).
//   · Owner of ≥1 business → primary business is the first row from
//     `listBusinessesByOwner`. Multi-shop selection is not part of this
//     phase; §1 of the prompt assumes "the seller's catalogue".
//
// Public URL referenced here (/<slug>/wholesale) is scaffolded by a
// sibling route; this page only *links* to it. Access gating on the
// public route is enforced server-side there.
//
// Doctrine
//   · DB-wired rule (2026-11-12) · product readiness is computed from
//     the real `nex_product.spec.__wholesale` jsonb via
//     `listProductsByBusiness` + `isWholesalePublishable`. No stubs.
//   · Engineering ceiling = VERIFIED, never LIVE-VERIFIED from code
//     (five-state readiness, 2026-11-08).
//   · Migration 350 remains PROPOSAL per authorisation envelope.

import type * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { listBusinessesByOwner } from "@/lib/nex-native/business-service";
import { listProductsByBusiness } from "@/lib/nex-native/product-service";
import type { NexProductRow } from "@/lib/nex-native/types";
import {
  isWholesalePublishable,
  readTiersFromSpec,
} from "@/lib/nex-native/catalogue/wholesale-tiers";
import { WholesaleManageClient } from "./_client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

const PALETTE = {
  bg: "var(--nex-world-drawer-bg, #123D2B)",
  text: "#F2F5F8",
  textMuted: "#B5C3D6",
  textDim: "#7D9BC0",
  accent: "var(--nex-world-secondary, #C6A15B)",
  cardBg: "rgba(10, 28, 20, 0.72)",
  cardBorder: "rgba(198, 161, 91, 0.35)",
  warnBorder: "rgba(220, 160, 90, 0.55)",
  warnBg: "rgba(120, 70, 20, 0.30)",
};

// Product-readiness row that the client component consumes.
export interface WholesaleProductReadiness {
  readonly id: string;
  readonly name: string;
  readonly status: NexProductRow["status"];
  readonly wholesaleOffered: boolean;
  readonly tierCount: number;
  readonly publishable: boolean;
  readonly editHref: string;
}

function readinessFromProduct(p: NexProductRow): WholesaleProductReadiness {
  const spec = (p.spec ?? null) as unknown;
  let offered = false;
  if (spec && typeof spec === "object") {
    const w = (spec as Record<string, unknown>).__wholesale;
    if (w && typeof w === "object") {
      offered = (w as Record<string, unknown>).offered === true;
    }
  }
  const tiers =
    spec && typeof spec === "object"
      ? readTiersFromSpec((spec as Record<string, unknown>).__wholesale)
      : [];
  const publishable =
    offered &&
    isWholesalePublishable(
      spec && typeof spec === "object"
        ? (spec as Record<string, unknown>).__wholesale
        : null,
    );
  return {
    id: p.id,
    name: p.name,
    status: p.status,
    wholesaleOffered: offered,
    tierCount: tiers.length,
    publishable,
    editHref: `/nex-native/manage/product/${p.id}/edit`,
  };
}

export default async function ManageWholesalePage(): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/manage/wholesale");
  }
  const businesses = await listBusinessesByOwner(session.account.id).catch(
    () => [],
  );
  const primary = businesses[0] ?? null;

  let readiness: WholesaleProductReadiness[] = [];
  if (primary) {
    try {
      const products = await listProductsByBusiness(primary.id);
      readiness = products.map(readinessFromProduct);
    } catch {
      readiness = [];
    }
  }

  const publishableCount = readiness.filter((r) => r.publishable).length;
  const offeredIncompleteCount = readiness.filter(
    (r) => r.wholesaleOffered && !r.publishable,
  ).length;
  const notOfferedCount = readiness.filter((r) => !r.wholesaleOffered).length;

  // Public catalogue URL (same-origin path, consumer builds absolute URL
  // in the client via window.location.origin).
  const catalogueSlug = primary?.slug ?? null;
  const cataloguePath = catalogueSlug
    ? `/nex-native/${catalogueSlug}/wholesale`
    : null;

  return (
    <>
      <style>{`html, body { background: ${PALETTE.bg}; }`}</style>
      <main
        data-nex-manage-wholesale
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
            maxWidth: 560,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <nav style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Link
              href="/nex-native/free-chat"
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
          </nav>

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
              Merchant
            </span>
            <h1
              style={{
                margin: "10px 0 4px",
                fontSize: 26,
                fontWeight: 900,
                letterSpacing: "-0.015em",
              }}
            >
              Wholesale
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: PALETTE.textMuted,
                lineHeight: 1.55,
              }}
            >
              Open a trade-only view of your existing catalogue, with
              quantity-based pricing that only approved buyers can see.
              The same products stay in your normal shop at their retail
              price. Wholesale is a separate view of the same records ·
              not a second catalogue.
            </p>
          </header>

          {!primary ? (
            <section
              style={{
                padding: 22,
                borderRadius: 14,
                background: PALETTE.cardBg,
                border: `1.5px solid ${PALETTE.cardBorder}`,
              }}
            >
              <h2
                style={{ margin: "0 0 10px", fontSize: 16, fontWeight: 800 }}
              >
                No shop found for your account
              </h2>
              <p
                style={{
                  margin: "0 0 12px",
                  fontSize: 13,
                  lineHeight: 1.55,
                  color: PALETTE.textMuted,
                }}
              >
                Create your shop first. Wholesale pricing is added
                per-product once you have at least one live listing.
              </p>
              <Link
                href="/nex-native/manage/shop/start"
                style={{
                  display: "inline-block",
                  padding: "10px 18px",
                  borderRadius: 999,
                  background: PALETTE.accent,
                  color: "#061710",
                  textDecoration: "none",
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: "0.02em",
                }}
              >
                Start your NEX Shop →
              </Link>
            </section>
          ) : (
            <WholesaleManageClient
              businessId={primary.id}
              businessDisplayName={primary.display_name}
              cataloguePath={cataloguePath}
              readiness={readiness}
              counts={{
                publishable: publishableCount,
                offeredIncomplete: offeredIncompleteCount,
                notOffered: notOfferedCount,
                total: readiness.length,
              }}
            />
          )}

          {/* Buyer approval panel · BLOCKED on migration 350. Rendered
             even without a primary business so the honest state is
             always visible from this route. */}
          <section
            aria-label="Buyer access"
            style={{
              padding: 18,
              borderRadius: 14,
              background: PALETTE.warnBg,
              border: `1.5px solid ${PALETTE.warnBorder}`,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: "rgba(198, 161, 91, 0.18)",
                  border: `1px solid ${PALETTE.warnBorder}`,
                  color: PALETTE.accent,
                  fontSize: 10,
                  fontWeight: 900,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                }}
              >
                Blocked
              </span>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>
                Buyer access · approvals
              </h2>
            </div>
            <p
              style={{
                margin: "0 0 6px",
                fontSize: 12.5,
                lineHeight: 1.55,
                color: PALETTE.textMuted,
              }}
            >
              Seller-scoped buyer approval is designed but not yet
              applied to the database. The table{" "}
              <code style={{ fontFamily: "ui-monospace, monospace" }}>
                nex_wholesale_buyer_approval
              </code>{" "}
              exists only as migration 350 PROPOSAL and has not been
              authorised for apply.
            </p>
            <p
              style={{
                margin: 0,
                fontSize: 12.5,
                lineHeight: 1.55,
                color: PALETTE.textMuted,
              }}
            >
              Once the migration is applied in sandbox, this panel will
              show pending requests, approved buyers, and a revoke
              control. Until then, the public wholesale link treats all
              viewers as unapproved and prompts them to request access ·
              but no requests are stored yet.
            </p>
          </section>
        </div>
      </main>
    </>
  );
}
