// src/app/nex-native/hq/shops/[businessSlug]/page.tsx
//
// NEX HQ · Per-shop command surface. Built 2026-11-28 per owner
// directive "build the complete flow page in hq as command askded
// sandbox tested".
//
// Capabilities (all six owner-requested items)
//   1. Receive inbox view · metadata only per the sealed 2026-11-09
//      device-only E2E architecture (bodies are ciphertext · HQ cannot
//      read plaintext without breaking the seal). Shows who messaged
//      and when.
//   2. Reply · founder-initiated outbound chat lands in recipient's
//      chat window via the sealed migration-301 "Nex" direct-channel
//      pipeline (sendHqMessage).
//   3. Hourly traffic sparkline · chart of click-throughs to the shop.
//   4. Country dropdown · per-country click count breakdown.
//   5. Top-viewed product · ranked list of products by view count.
//   6. Contacts picker + email · founder selects a contact · composer
//      POSTs to /api/nex-native/hq/shop-message · the server fires
//      BOTH the chat bubble (step 2) AND a courtesy email notification
//      with a deep-link to open the recipient's NEX chat window.
//
// Doctrine
//   · HQ authorisation gate · resolveSessionWithDevOverride +
//     requireHqAdmin · deny → notFound() (match the existing HQ
//     surface convention; do not advertise HQ paths).
//   · Service-role reads bypass RLS · we HQ-gate first.
//   · No chat body is ever read or displayed · the sealed E2E
//     architecture is not relaxed.
//   · Sandbox-safe · if nex_page_view is pre-migration-303, the
//     analytics helpers return empty results and the UI shows a
//     well-labelled empty state rather than failing.

import { notFound } from "next/navigation";
import Link from "next/link";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { requireHqAdmin } from "@/lib/nex-native/hq-authorization";
import { getBusinessBySlug } from "@/lib/nex-native/business-service";
import {
  fetchBusinessHourlyBuckets,
  fetchBusinessPageViewSummary,
} from "@/lib/nex-native/analytics/page-view-service";
import {
  fetchTopViewedProducts,
  fetchShopContactsMetadata,
  fetchShopMessageInboxMeta,
} from "@/lib/nex-native/hq-shop/shop-page-queries";
import {
  ShopFounderComposer,
  CountryBreakdown,
  TrafficSparkline,
  type ShopContactChoice,
  type CountryCount,
  type HourlyPoint,
} from "./_shop-hq-client";

export const dynamic = "force-dynamic";

const INK = "#F2F5F8";
const INK_DIM = "#B5C3D6";
const INK_MUTED = "#7D9BC0";
const ACCENT = "#00AFFF";
const BORDER = "rgba(0,175,255,0.14)";
const CARD_BG = "#07152A";

interface Params {
  readonly businessSlug: string;
}

export default async function HqShopPage({
  params,
}: {
  readonly params: Promise<Params>;
}): Promise<React.JSX.Element> {
  // 1. Auth + HQ gate
  const session = await resolveSessionWithDevOverride();
  if (!session) notFound();
  const authorised = await requireHqAdmin(session.account.id)
    .then(() => true)
    .catch(() => false);
  if (!authorised) notFound();

  // 2. Shop resolver
  const { businessSlug } = await params;
  if (!businessSlug || businessSlug.length > 128) notFound();
  const shop = await getBusinessBySlug(businessSlug);
  if (!shop) notFound();

  // 3. Parallel reads · analytics + contacts + inbox metadata + top
  //    products. Each helper is tolerant of missing tables / RLS by
  //    returning an empty result instead of throwing.
  const [hourly, summary, topProducts, contacts, inbox] = await Promise.all([
    fetchBusinessHourlyBuckets(shop.id, { hours: 24 }),
    fetchBusinessPageViewSummary(shop.id, { days: 30 }),
    fetchTopViewedProducts(shop.id, { days: 30, limit: 10 }),
    fetchShopContactsMetadata(shop.owner_account_id, { limit: 100 }),
    fetchShopMessageInboxMeta(shop.id, { limit: 50 }),
  ]);

  const hourlyPoints: readonly HourlyPoint[] = hourly.map((b) => ({
    hourIso: b.hourIso,
    views: b.views,
  }));

  const countryCounts: readonly CountryCount[] = summary
    ? (["ireland", "indonesia", "worldwide", "global"] as const).map((k) => ({
        country: k,
        views: summary.byCountry[k] ?? 0,
      }))
    : [];

  const contactChoices: readonly ShopContactChoice[] = contacts.map((c) => ({
    accountId: c.accountId,
    displayName: c.displayName,
    nexHandle: c.nexHandle,
    lastMessageAt: c.lastMessageAt,
  }));

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", color: INK }}>
      <header style={{ marginBottom: 18 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: INK_MUTED,
            textTransform: "uppercase",
            letterSpacing: "0.18em",
          }}
        >
          HQ · Shops · per-shop command surface
        </div>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 900,
            margin: "6px 0 10px",
            letterSpacing: "0.01em",
          }}
          data-nex-hq-shop-title
        >
          {shop.display_name ?? shop.slug}
        </h1>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link
            href="/nex-native/hq"
            style={backLinkStyle}
          >
            ← HQ
          </Link>
          <Link
            href={`/nex-native/shop/${encodeURIComponent(shop.slug)}`}
            target="_blank"
            rel="noreferrer"
            style={backLinkStyle}
            data-nex-hq-shop-open-storefront
          >
            Open storefront ↗
          </Link>
        </div>
      </header>

      {/* Summary strip */}
      <section
        aria-label="Shop summary"
        style={{
          padding: "14px 16px",
          marginBottom: 16,
          borderRadius: 12,
          border: `1px solid ${BORDER}`,
          background: CARD_BG,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 10,
          fontSize: 13,
        }}
      >
        <Field label="Slug" value={shop.slug} mono />
        <Field label="Business id" value={shop.id} mono />
        <Field
          label="Owner account id"
          value={shop.owner_account_id}
          mono
        />
        <Field
          label="30-day views"
          value={summary ? String(summary.totalViews) : "—"}
        />
        <Field
          label="Unique viewers (30d)"
          value={summary ? String(summary.uniqueViewerHashes) : "—"}
        />
        <Field
          label="Contacts"
          value={String(contactChoices.length)}
        />
      </section>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 14,
        }}
      >
        {/* Panel 1 · Traffic sparkline + country dropdown */}
        <Panel
          title="Traffic · last 24 hours"
          subtitle="Click-throughs to the shop URL"
          dataAttr="data-nex-hq-shop-panel-traffic"
        >
          <TrafficSparkline buckets={hourlyPoints} />
          <div style={{ marginTop: 14 }}>
            <CountryBreakdown counts={countryCounts} />
          </div>
          {!summary && (
            <div
              style={{
                marginTop: 10,
                fontSize: 11.5,
                color: INK_MUTED,
                lineHeight: 1.5,
              }}
            >
              Note · nex_page_view table not available in this
              environment (pre-migration-303). Traffic numbers will
              appear once the migration is applied.
            </div>
          )}
        </Panel>

        {/* Panel 2 · Top-viewed products */}
        <Panel
          title="Top products · last 30 days"
          subtitle="Ranked by view count"
          dataAttr="data-nex-hq-shop-panel-top-products"
        >
          {topProducts.length === 0 ? (
            <EmptyState>
              No product views recorded in the last 30 days.
            </EmptyState>
          ) : (
            <ol
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "grid",
                gap: 6,
              }}
            >
              {topProducts.map((p, i) => (
                <li
                  key={p.productId}
                  data-nex-hq-shop-top-product-row
                  style={{
                    padding: "8px 10px",
                    borderRadius: 7,
                    border: `1px solid ${BORDER}`,
                    background: "transparent",
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    fontSize: 12.5,
                  }}
                >
                  <span
                    style={{
                      minWidth: 22,
                      color: INK_MUTED,
                      fontWeight: 800,
                    }}
                  >
                    {i + 1}.
                  </span>
                  <span style={{ flex: 1, color: INK }}>
                    {p.productName ?? p.productId.slice(0, 8)}
                  </span>
                  <span style={{ color: ACCENT, fontWeight: 700 }}>
                    {p.views}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        {/* Panel 3 · Inbox metadata */}
        <Panel
          title="Shop inbox · recent messages"
          subtitle="Metadata only · bodies are end-to-end encrypted"
          dataAttr="data-nex-hq-shop-panel-inbox"
        >
          <div
            role="note"
            style={{
              padding: "8px 10px",
              marginBottom: 10,
              borderRadius: 7,
              border: `1px solid ${INK_MUTED}`,
              background: "rgba(125,155,192,0.06)",
              fontSize: 11.5,
              color: INK_DIM,
              lineHeight: 1.5,
            }}
            data-nex-hq-shop-inbox-e2e-notice
          >
            Device-only end-to-end encryption is in force. HQ shows
            who messaged and when · never the message content.
          </div>
          {inbox.length === 0 ? (
            <EmptyState>No recent messages for this shop.</EmptyState>
          ) : (
            <ol
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "grid",
                gap: 6,
              }}
            >
              {inbox.map((m, i) => (
                <li
                  key={`${m.conversationId}-${i}`}
                  data-nex-hq-shop-inbox-row
                  style={{
                    padding: "8px 10px",
                    borderRadius: 7,
                    border: `1px solid ${BORDER}`,
                    display: "grid",
                    gap: 2,
                    fontSize: 12.5,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    <span style={{ color: INK, fontWeight: 700 }}>
                      {m.senderDisplayName ?? m.senderAccountId.slice(0, 8)}
                    </span>
                    <span style={{ color: INK_MUTED, fontSize: 11 }}>
                      {m.createdAt.slice(0, 16).replace("T", " ")}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 10.5,
                      color: m.encrypted ? "#16D66B" : "#F7B500",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                    }}
                  >
                    {m.encrypted ? "ENCRYPTED" : "LEGACY (plaintext frozen)"}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        {/* Panel 4 · Founder composer */}
        <Panel
          title="Founder → contact"
          subtitle="Sends a Nex chat bubble + courtesy email with chat deep-link"
          dataAttr="data-nex-hq-shop-panel-composer"
        >
          <ShopFounderComposer
            contacts={contactChoices}
            shopSlug={shop.slug}
          />
          <div
            style={{
              marginTop: 10,
              fontSize: 11.5,
              color: INK_MUTED,
              lineHeight: 1.5,
            }}
          >
            The chat bubble lands in the contact&apos;s NEX chat as
            from <strong style={{ color: INK }}>Nex</strong>. The
            email includes a link that opens their chat window.
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ─── Small UI atoms ─────────────────────────────────────────────────

function Panel({
  title,
  subtitle,
  dataAttr,
  children,
}: {
  readonly title: string;
  readonly subtitle?: string;
  readonly dataAttr?: string;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const attrs: Record<string, string> = {};
  if (dataAttr) attrs[dataAttr] = "";
  return (
    <section
      {...attrs}
      style={{
        padding: "14px 16px",
        borderRadius: 12,
        border: `1px solid ${BORDER}`,
        background: CARD_BG,
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          color: INK_MUTED,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
        }}
      >
        {title}
      </div>
      {subtitle && (
        <div
          style={{
            fontSize: 11.5,
            color: INK_DIM,
            margin: "2px 0 10px",
            lineHeight: 1.4,
          }}
        >
          {subtitle}
        </div>
      )}
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  readonly label: string;
  readonly value: string;
  readonly mono?: boolean;
}): React.JSX.Element {
  return (
    <div>
      <div
        style={{
          fontSize: 10.5,
          color: INK_MUTED,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 13,
          color: INK,
          fontFamily: mono ? "monospace" : "inherit",
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function EmptyState({
  children,
}: {
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div
      style={{
        padding: 18,
        textAlign: "center",
        fontSize: 12.5,
        color: INK_MUTED,
        border: `1px dashed ${BORDER}`,
        borderRadius: 10,
      }}
    >
      {children}
    </div>
  );
}

const backLinkStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  padding: "8px 14px",
  borderRadius: 8,
  border: `1px solid ${BORDER}`,
  color: INK_DIM,
  textDecoration: "none",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
};
