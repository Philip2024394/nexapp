// src/app/nex-native/settings/storage/page.tsx
//
// NEX Shop capacity + upgrade surface · owner-authorised 2026-11-08
// (round 29 · fixed round 29c).
// -----------------------------------------------------------------------------
// Always shows the capacity upgrade packs. Personalised usage card
// is conditional:
//
//   · Signed-out · pack catalog + "Sign in to upgrade" CTA. No
//     usage card.
//   · Signed-in, no shop · pack catalog + "Open shop to track usage"
//     link. No usage card.
//   · Signed-in, shop present · usage card + pack catalog. Usage
//     numbers come from metering-service (fail-soft when migration
//     308 isn't applied to the target DB).
//
// Upgrade CTAs are DISABLED until Stripe wiring is authorised. The
// "Payment setup pending" chip explains the state honestly.
//
// Phone-frame rule honoured · renders inside the sealed
// .nex-native-stage > .nex-native-frame layout from the nex-native
// route segment.

import type * as React from "react";
import Link from "next/link";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { listBusinessesByOwner } from "@/lib/nex-native/business-service";
import {
  STORAGE_PACKS,
  BANDWIDTH_PACKS,
  getActivePackPrice,
  formatPrice,
  type SupportedRegion,
} from "@/lib/nex-native/commercial/regional-pricing";
import { SHOP_ENTITLEMENT } from "@/lib/nex-native/commercial/shop-entitlements";
import {
  readShopUsage,
  computeUsageProgress,
  type UsageProgressDisplay,
} from "@/lib/nex-native/shop/metering-service";
import { NexPageHeader } from "../../_page-header";
import { StandaloneShopLimitPopup } from "../../_shop-limit-popup";

// Owner directive 2026-11-08 (round 29d) · users don't understand
// "bandwidth" · everything is presented as "storage". Internally we
// still sell storage + bandwidth separately (sealed cost-protection
// decision) · the UI pairs them into bundled "storage" plans where
// buying +N GB of storage ALSO adds the matching delivery capacity
// to serve the new content. Prices below sum the two underlying
// packs so the single number the user sees is the full cost.
interface StoragePlan {
  readonly key: "small" | "medium" | "large";
  readonly label: string;
  readonly storagePackIndex: 0 | 1 | 2;
  readonly bandwidthPackIndex: 0 | 1 | 2;
}

const STORAGE_PLANS: ReadonlyArray<StoragePlan> = [
  { key: "small", label: "+5 GB storage", storagePackIndex: 0, bandwidthPackIndex: 0 },
  { key: "medium", label: "+10 GB storage", storagePackIndex: 1, bandwidthPackIndex: 1 },
  { key: "large", label: "+25 GB storage", storagePackIndex: 2, bandwidthPackIndex: 2 },
];

function bundledPrice(
  region: SupportedRegion,
  storageIndex: 0 | 1 | 2,
  bandwidthIndex: 0 | 1 | 2,
): { label: string; minor: number } | null {
  const storageRow = getActivePackPrice(STORAGE_PACKS[storageIndex], region);
  const bandwidthRow = getActivePackPrice(
    BANDWIDTH_PACKS[bandwidthIndex],
    region,
  );
  if (!storageRow || !bandwidthRow) return null;
  const minor = storageRow.amountMinor + bandwidthRow.amountMinor;
  // Build a RegionalPrice-shaped object for formatPrice so the
  // display matches other currency amounts on the page.
  const virtualRow = {
    region,
    currency: storageRow.currency,
    amountMinor: minor,
    active: true as const,
  };
  return { label: formatPrice(virtualRow), minor };
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX_BG = "var(--nex-world-drawer-bg, #020914)";
const EMERALD = "var(--nex-world-primary, #123D2B)";
const GOLD = "var(--nex-world-secondary, #C6A15B)";
const CREAM = "var(--nex-world-cream, #FAF8F4)";
const INK = "#F2F5F8";
const INK_DIM = "#B5C3D6";
const INK_MUTED = "#7D9BC0";
const SURFACE = "rgba(5, 15, 28, 0.72)";
const BORDER = "rgba(198, 161, 91, 0.25)";
const BORDER_HI = "rgba(198, 161, 91, 0.55)";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

// Launch markets · region resolver (see regional-pricing.ts header)
// is deferred. Default to IE (Ireland) for now · OWNER DECISION to
// wire the resolver before Ireland public launch.
const DEFAULT_REGION: SupportedRegion = "IE";

type ViewerState =
  | { kind: "signed_out" }
  | { kind: "signed_in_no_shop" }
  | { kind: "signed_in_with_shop"; progress: UsageProgressDisplay };

// Next.js 16 passes searchParams as a Promise · owner-authorised
// server-component signature matches the rest of the nex-native tree.
export default async function NexStoragePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const params = (await searchParams) ?? {};
  // Demo trigger · ?preview=limit renders the limit-reached popup so
  // the owner can see the overlay without hitting a real limit. Not
  // wired to production flow yet · see _shop-limit-popup.tsx header.
  const previewLimit = params["preview"] === "limit";

  // Fail-soft auth read · never redirect · packs must be visible to
  // every viewer (signed-out visitors browsing via a shared link).
  // Dev-impersonation flows through this resolver so NEX_DEV_IMPERSONATE_HANDLE
  // (e.g. nex-99901) appears as the signed-in viewer during testing.
  const session = await resolveSessionWithDevOverride().catch(() => null);

  let viewerState: ViewerState = { kind: "signed_out" };
  if (session) {
    const businesses = await listBusinessesByOwner(session.account.id).catch(
      () => [],
    );
    const primary = businesses[0] ?? null;
    if (!primary) {
      viewerState = { kind: "signed_in_no_shop" };
    } else {
      const usageRead = await readShopUsage(primary.id);
      const progress = computeUsageProgress(
        usageRead.usage,
        SHOP_ENTITLEMENT.storage.mediaBytes,
        SHOP_ENTITLEMENT.storage.monthlyBandwidthBytes,
        usageRead.ok,
      );
      viewerState = { kind: "signed_in_with_shop", progress };
    }
  }

  return (
    <>
      <style>{`html, body { background: ${NEX_BG}; }`}</style>
      <main
        data-nex-storage
        style={{
          position: "absolute",
          inset: 0,
          background: NEX_BG,
          color: INK,
          fontFamily: SANS,
          display: "flex",
          flexDirection: "column",
          overflow: "auto",
          padding:
            "calc(env(safe-area-inset-top, 0px) + 18px) 20px calc(env(safe-area-inset-bottom, 0px) + 24px)",
          boxSizing: "border-box",
          gap: 16,
        }}
      >
        {/* Owner directive 2026-11-08 (round 29e) · shared NexPageHeader
            with the sealed right-side drawer button + search glyph.
            Signed-in viewers reach every NEX destination through the
            three-dot drawer · no need for a bespoke back button. */}
        <NexPageHeader dataScope="settings-storage" />

        <header
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: GOLD,
            }}
          >
            Storage upgrades
          </span>
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 900,
              color: CREAM,
              letterSpacing: "-0.015em",
              lineHeight: 1.15,
            }}
          >
            Buy more storage
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: INK_DIM,
              lineHeight: 1.5,
            }}
          >
            NEX Shop includes 1 GB storage. Add more as your business
            grows — pay only for what you need.
          </p>
        </header>

        {/* Viewer-state info card · only shown when the viewer
            isn't a signed-in shop owner (who sees the Free plan
            scale bar directly inside the packs section instead). */}
        {viewerState.kind === "signed_in_no_shop" ? (
          <InfoCard
            variant="info"
            title="Start your 7-day free trial"
            body="Open a NEX Shop with 7 days free. Then €4.99 / month unless you cancel. Pack prices below apply once your Shop is live."
            ctaLabel="Start free 7-day trial →"
            ctaHref="/nex-native/manage/shop/setup"
          />
        ) : viewerState.kind === "signed_out" ? (
          <InfoCard
            variant="info"
            title="Sign in to upgrade"
            body="Anyone can see the pack prices below. To buy storage you'll need to sign in to your NEX account first."
            ctaLabel="Sign in →"
            ctaHref="/nex-native/sign-in?return=/nex-native/settings/storage"
          />
        ) : null}

        <StoragePlansSection
          region={DEFAULT_REGION}
          viewerKind={viewerState.kind}
          progress={
            viewerState.kind === "signed_in_with_shop"
              ? viewerState.progress
              : null
          }
        />

        <footer
          style={{
            paddingTop: 10,
            fontSize: 10.5,
            color: INK_MUTED,
            lineHeight: 1.5,
            textAlign: "center",
          }}
        >
          Storage upgrades are monthly subscriptions · cancel anytime.
          Each upgrade adds space to your shop plus the delivery
          capacity needed to serve it. Nothing is deleted without
          warning.
        </footer>

        {/* Demo trigger · ?preview=limit renders the limit-reached
            popup so the owner can review the overlay without
            exceeding a real cap. */}
        {previewLimit ? (
          <StandaloneShopLimitPopup
            kind="storage"
            usageLabel="1.0 GB of 1.0 GB"
          />
        ) : null}
      </main>
    </>
  );
}

function InfoCard({
  variant,
  title,
  body,
  ctaLabel,
  ctaHref,
}: {
  variant: "info" | "warning";
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
}): React.JSX.Element {
  return (
    <section
      style={{
        padding: "14px 16px 16px",
        background: variant === "warning" ? "rgba(166, 0, 0, 0.12)" : SURFACE,
        border: `1px solid ${variant === "warning" ? "rgba(255,120,60,0.45)" : BORDER}`,
        borderRadius: 14,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 900,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: GOLD,
        }}
      >
        {title}
      </div>
      <p
        style={{
          margin: "6px 0 10px",
          fontSize: 12,
          color: INK_DIM,
          lineHeight: 1.5,
        }}
      >
        {body}
      </p>
      <Link
        href={ctaHref}
        style={{
          display: "inline-flex",
          padding: "8px 14px",
          fontSize: 11,
          fontWeight: 900,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "#1A120A",
          background: GOLD,
          textDecoration: "none",
          borderRadius: 999,
        }}
      >
        {ctaLabel}
      </Link>
    </section>
  );
}

function StoragePlansSection({
  region,
  viewerKind,
  progress,
}: {
  region: SupportedRegion;
  viewerKind: ViewerState["kind"];
  progress: UsageProgressDisplay | null;
}): React.JSX.Element {
  // Base plan usage · only meaningful for signed_in_with_shop. For
  // other viewers the base bar shows an empty state since no account
  // is tied to the usage number.
  const baseUsedBytes = progress?.honestData ? progress.storageUsedBytes : 0;
  const baseTotalBytes = SHOP_ENTITLEMENT.storage.mediaBytes;
  const basePct =
    baseTotalBytes === 0
      ? 0
      : Math.min(100, (baseUsedBytes / baseTotalBytes) * 100);
  const baseHonest = progress?.honestData ?? false;

  return (
    <section
      style={{
        padding: "14px 16px 16px",
        background: SURFACE,
        border: `1px solid ${BORDER}`,
        borderRadius: 14,
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: 14,
          fontWeight: 900,
          color: CREAM,
          letterSpacing: "-0.005em",
        }}
      >
        Storage
      </h2>
      <p
        style={{
          margin: "4px 0 10px",
          fontSize: 11,
          color: INK_DIM,
          lineHeight: 1.5,
        }}
      >
        Your free 1 GB fills up first. Upgrade a plan below to add
        more space · priced per month · cancel anytime.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 8,
        }}
      >
        {/* Free plan card — base 1 GB included with Shop */}
        <FreePlanCard
          usedBytes={baseUsedBytes}
          totalBytes={baseTotalBytes}
          pct={basePct}
          honest={baseHonest}
          viewerKind={viewerKind}
        />
        {/* Paid upgrade plans — bars render empty until purchased */}
        {STORAGE_PLANS.map((plan) => (
          <StoragePlanCard
            key={plan.key}
            plan={plan}
            region={region}
            viewerKind={viewerKind}
          />
        ))}
      </div>
      {region === "ID" ? (
        <div style={{ fontSize: 10, color: INK_MUTED, marginTop: 6 }}>
          Indonesia storage upgrade prices pending pilot data.
        </div>
      ) : null}
    </section>
  );
}

function FreePlanCard({
  usedBytes,
  totalBytes,
  pct,
  honest,
  viewerKind,
}: {
  usedBytes: number;
  totalBytes: number;
  pct: number;
  honest: boolean;
  viewerKind: ViewerState["kind"];
}): React.JSX.Element {
  const showLiveUsage = viewerKind === "signed_in_with_shop";
  const usedLabel = showLiveUsage && honest ? formatBytes(usedBytes, "GB") : null;
  const totalLabel = formatBytes(totalBytes, "GB");
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        padding: "12px 14px",
        background: "rgba(2,9,20,0.5)",
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        gap: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 900, color: CREAM }}>
            Free · 1 GB
          </span>
          <span style={{ fontSize: 11, color: GOLD, fontWeight: 800 }}>
            Included with NEX Shop
          </span>
        </div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: INK_MUTED,
          }}
        >
          Active
        </span>
      </div>
      <StorageBar
        pct={showLiveUsage ? pct : 0}
        label={
          showLiveUsage
            ? `${usedLabel ?? "—"} / ${totalLabel}`
            : `0 / ${totalLabel}`
        }
      />
    </div>
  );
}

function StoragePlanCard({
  plan,
  region,
  viewerKind,
}: {
  plan: StoragePlan;
  region: SupportedRegion;
  viewerKind: ViewerState["kind"];
}): React.JSX.Element {
  const price = bundledPrice(
    region,
    plan.storagePackIndex,
    plan.bandwidthPackIndex,
  );
  const priceLabel = price ? `${price.label} / month` : "Price coming soon";
  // Owner directive 2026-11-08 (round 29d) · button always reads
  // "Upgrade" · viewer-state copy handled by InfoCard above. Still
  // disabled until Stripe wires; tooltip explains the current block.
  let buttonTitle = "Payment setup pending";
  if (viewerKind === "signed_out") {
    buttonTitle = "Sign in to upgrade";
  } else if (viewerKind === "signed_in_no_shop") {
    buttonTitle = "Open your shop first";
  }
  // Pack bars are empty until purchased · when wired, this card's
  // bar will show how much of the bought pack has been consumed.
  const packTotalBytes = STORAGE_PACKS[plan.storagePackIndex].bytes;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        padding: "12px 14px",
        background: "rgba(2,9,20,0.5)",
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        gap: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 900, color: CREAM }}>
            {plan.label}
          </span>
          <span style={{ fontSize: 11, color: GOLD, fontWeight: 800 }}>
            {priceLabel}
          </span>
        </div>
        <button
          type="button"
          disabled
          aria-disabled
          title={buttonTitle}
          style={{
            padding: "8px 14px",
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: INK_MUTED,
            background: "transparent",
            border: `1px solid ${BORDER}`,
            borderRadius: 999,
            cursor: "not-allowed",
            opacity: 0.6,
          }}
        >
          Upgrade
        </button>
      </div>
      <StorageBar
        pct={0}
        label={`0 / ${formatBytes(packTotalBytes, "GB")}`}
      />
    </div>
  );
}

function StorageBar({
  pct,
  label,
}: {
  pct: number;
  label: string;
}): React.JSX.Element {
  const safePct = Math.max(0, Math.min(100, pct));
  return (
    <div>
      <div
        style={{
          position: "relative",
          height: 6,
          borderRadius: 999,
          background: "rgba(2,9,20,0.75)",
          border: `1px solid ${BORDER}`,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${safePct}%`,
            height: "100%",
            background: safePct >= 90 ? "#E67A3C" : GOLD,
            transition: "width 160ms ease-out",
          }}
        />
      </div>
      <div
        style={{
          fontSize: 10,
          color: INK_MUTED,
          marginTop: 4,
          textAlign: "right",
        }}
      >
        {label}
      </div>
    </div>
  );
}

function formatBytes(bytes: number, unitLabel: string): string {
  if (!Number.isFinite(bytes) || bytes < 0) return `0 ${unitLabel}`;
  const GB = 1_000_000_000;
  const MB = 1_000_000;
  if (bytes >= GB) {
    const gb = bytes / GB;
    return `${gb >= 10 ? gb.toFixed(0) : gb.toFixed(1)} ${unitLabel}`;
  }
  const mb = bytes / MB;
  return `${mb >= 10 ? mb.toFixed(0) : mb.toFixed(1)} MB`;
}
