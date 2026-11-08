// src/app/nex-native/hq/members/[accountId]/traffic/page.tsx
//
// NEX HQ · per-member traffic chart. Owner-authorised 2026-11-08
// (round 5).
// -----------------------------------------------------------------------------
// Doctrine
//   · Server-rendered · requireHqAdmin gate · non-revealing notFound() on deny.
//   · Reads the sealed nex_page_view table (migration 303). 24h
//     hourly buckets by default. Views + unique-viewer-hashes +
//     signed-in-viewers are SEPARATE columns · we never collapse
//     them into a single "visitors" number.
//   · If the member has no business yet · explicit empty state.
//   · If migration 303 is missing · friendly notice (no raw errors).

import { notFound } from "next/navigation";
import Link from "next/link";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { requireHqAdmin } from "@/lib/nex-native/hq-authorization";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import {
  fetchBusinessHourlyBuckets,
  fetchBusinessPageViewSummary,
  type HourlyBucket,
  type PageViewSummary,
} from "@/lib/nex-native/analytics/page-view-service";

export const dynamic = "force-dynamic";

const INK = "#F2F5F8";
const INK_DIM = "#B5C3D6";
const INK_MUTED = "#7D9BC0";
const ACCENT_EMERALD = "#16D66B";
const ACCENT_WARN = "#F7B500";
const BORDER_EMERALD = "rgba(22,214,107,0.18)";
const CARD_BG = "#07152A";

const UUID_SHAPE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Params {
  readonly accountId: string;
}

export default async function HqMemberTrafficPage({
  params,
}: {
  readonly params: Promise<Params>;
}): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  if (!session) notFound();
  const authorised = await requireHqAdmin(session.account.id)
    .then(() => true)
    .catch(() => false);
  if (!authorised) notFound();

  const { accountId } = await params;
  if (!UUID_SHAPE.test(accountId)) notFound();

  // Target member · display name + slug of primary business.
  const target = await nexSupabaseAdmin
    .from("nex_account")
    .select("id, display_name, nex_handle")
    .eq("id", accountId)
    .maybeSingle();
  if (target.error || !target.data) notFound();
  const row = target.data as {
    id: string;
    display_name: string | null;
    nex_handle: string | null;
  };

  // Pick the primary (most recently created) business for this owner.
  const bizQuery = await nexSupabaseAdmin
    .from("nex_business")
    .select("id, slug, created_at, name, deleted_at")
    .eq("owner_account_id", accountId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const biz = bizQuery.data as
    | { id: string; slug: string | null; created_at: string; name: string | null }
    | null;

  let buckets: readonly HourlyBucket[] = [];
  let summary: PageViewSummary | null = null;
  let tableUnavailable = false;
  if (biz) {
    const [b, s] = await Promise.all([
      fetchBusinessHourlyBuckets(biz.id, { hours: 24 }),
      fetchBusinessPageViewSummary(biz.id, { days: 30 }),
    ]);
    buckets = b;
    summary = s;
    // Heuristic · if BOTH readers return empty / null AND the member
    // has a business, the table is likely unavailable. The service
    // already silently degrades · this UI flag just helps the HQ
    // admin diagnose vs assume "no traffic".
    if (buckets.length === 0 && summary == null) {
      tableUnavailable = true;
    }
  }

  const maxBucketViews = buckets.reduce((m, b) => Math.max(m, b.views), 0);

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", color: INK }}>
      <header style={{ marginBottom: 20 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: INK_MUTED,
            textTransform: "uppercase",
            letterSpacing: "0.18em",
          }}
        >
          HQ · Members · Traffic
        </div>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 900,
            margin: "6px 0 10px",
            letterSpacing: "0.01em",
          }}
        >
          Traffic · {row.display_name ?? row.nex_handle ?? "member"}
        </h1>
        <nav style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link
            href="/nex-native/hq/members"
            style={navLinkStyle}
          >
            ← Members
          </Link>
          <Link
            href={`/nex-native/hq/members/${accountId}/message`}
            style={navLinkStyle}
          >
            Open message / grant
          </Link>
          {biz?.slug ? (
            <Link
              href={`/nex-native/${biz.slug}`}
              target="_blank"
              rel="noreferrer"
              style={{ ...navLinkStyle, color: ACCENT_EMERALD, borderColor: ACCENT_EMERALD }}
            >
              /nex-native/{biz.slug} ↗
            </Link>
          ) : null}
        </nav>
      </header>

      {!biz ? (
        <EmptyStateCard>
          This member has not published a business yet · traffic
          analytics requires a live shop URL.
        </EmptyStateCard>
      ) : tableUnavailable ? (
        <TableUnavailableNotice />
      ) : (
        <>
          <SummaryStrip summary={summary} />
          <HourlyChart buckets={buckets} maxViews={maxBucketViews} />
          <HonestLabelsLegend />
          <ByCountryStrip summary={summary} />
        </>
      )}
    </div>
  );
}

const navLinkStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  padding: "8px 14px",
  borderRadius: 8,
  border: `1px solid ${BORDER_EMERALD}`,
  color: INK_DIM,
  textDecoration: "none",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
};

function SummaryStrip({
  summary,
}: {
  readonly summary: PageViewSummary | null;
}): React.JSX.Element {
  if (!summary) {
    return (
      <div
        style={{
          padding: "12px 14px",
          marginBottom: 14,
          borderRadius: 10,
          border: `1px dashed ${BORDER_EMERALD}`,
          color: INK_MUTED,
          fontSize: 13,
        }}
      >
        No traffic recorded for this shop in the last 30 days.
      </div>
    );
  }
  const items: Array<{ label: string; value: number | string }> = [
    { label: "Total views · 30d", value: summary.totalViews },
    { label: "Unique viewer hashes · 30d", value: summary.uniqueViewerHashes },
    { label: "Signed-in viewers · 30d", value: summary.signedInViewers },
    {
      label: "Peak hour",
      value:
        summary.peakHourIso != null
          ? summary.peakHourIso.replace("T", " ").replace(":00:00.000Z", "Z")
          : "—",
    },
  ];
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
        gap: 10,
        marginBottom: 18,
      }}
    >
      {items.map((it) => (
        <div
          key={it.label}
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            border: `1px solid ${BORDER_EMERALD}`,
            background: CARD_BG,
          }}
        >
          <div
            style={{
              fontSize: 10.5,
              color: INK_MUTED,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            {it.label}
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 900,
              color: ACCENT_EMERALD,
              marginTop: 2,
            }}
          >
            {typeof it.value === "number" ? it.value.toLocaleString() : it.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function HourlyChart({
  buckets,
  maxViews,
}: {
  readonly buckets: readonly HourlyBucket[];
  readonly maxViews: number;
}): React.JSX.Element {
  // Simple server-rendered bar chart · no client JS needed. Owner
  // directive: distinguish views from unique-viewer-hashes · we draw
  // two overlaid bars per hour (views in emerald, unique in amber).
  return (
    <section
      aria-label="Hourly traffic · last 24h"
      style={{
        padding: "14px 16px",
        borderRadius: 12,
        border: `1px solid ${BORDER_EMERALD}`,
        background: CARD_BG,
        marginBottom: 18,
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          color: INK_MUTED,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          marginBottom: 10,
        }}
      >
        Hourly · last 24 hours (UTC)
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${buckets.length}, minmax(0, 1fr))`,
          gap: 4,
          height: 140,
          alignItems: "end",
        }}
      >
        {buckets.map((b) => {
          const viewsHeight =
            maxViews > 0 ? Math.max(2, (b.views / maxViews) * 100) : 2;
          const uniqueHeight =
            maxViews > 0
              ? Math.max(0, (b.uniqueViewerHashes / maxViews) * 100)
              : 0;
          const hourLabel = b.hourIso.slice(11, 13);
          return (
            <div
              key={b.hourIso}
              title={`${b.hourIso} · views=${b.views} · unique=${b.uniqueViewerHashes} · signed-in=${b.signedInViewers}`}
              style={{
                position: "relative",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                alignItems: "stretch",
              }}
            >
              <div
                style={{
                  height: `${viewsHeight}%`,
                  background: "rgba(22,214,107,0.6)",
                  borderTop: `2px solid ${ACCENT_EMERALD}`,
                  borderRadius: "3px 3px 0 0",
                }}
              />
              {uniqueHeight > 0 ? (
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: `${uniqueHeight}%`,
                    background: "rgba(247,181,0,0.25)",
                    borderTop: `1px solid ${ACCENT_WARN}`,
                  }}
                />
              ) : null}
              <div
                style={{
                  position: "absolute",
                  bottom: -16,
                  left: 0,
                  right: 0,
                  textAlign: "center",
                  fontSize: 9,
                  color: INK_MUTED,
                }}
              >
                {hourLabel}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 22, fontSize: 11, color: INK_DIM, display: "flex", gap: 14, flexWrap: "wrap" }}>
        <LegendDot colour={ACCENT_EMERALD} label="Views (every real request)" />
        <LegendDot colour={ACCENT_WARN} label="Unique viewer hashes (SHA-256 of anon cookie)" />
      </div>
    </section>
  );
}

function LegendDot({
  colour,
  label,
}: {
  readonly colour: string;
  readonly label: string;
}): React.JSX.Element {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span
        aria-hidden
        style={{
          width: 10,
          height: 10,
          borderRadius: 2,
          background: colour,
          display: "inline-block",
        }}
      />
      <span>{label}</span>
    </span>
  );
}

function ByCountryStrip({
  summary,
}: {
  readonly summary: PageViewSummary | null;
}): React.JSX.Element | null {
  if (!summary) return null;
  const total = summary.totalViews;
  const entries = (Object.entries(summary.byCountry) as Array<
    [string, number]
  >).filter(([, n]) => n > 0);
  if (entries.length === 0) return null;
  return (
    <section
      aria-label="By country"
      style={{
        padding: "14px 16px",
        borderRadius: 12,
        border: `1px solid ${BORDER_EMERALD}`,
        background: CARD_BG,
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          color: INK_MUTED,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          marginBottom: 8,
        }}
      >
        Country breakdown · last 30 days
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
        {entries.map(([country, n]) => {
          const pct = total > 0 ? (n / total) * 100 : 0;
          return (
            <li key={country} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5 }}>
              <span style={{ width: 90, color: INK, fontWeight: 700 }}>{country}</span>
              <div style={{ flex: 1, height: 10, borderRadius: 4, background: "rgba(22,214,107,0.08)", overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: ACCENT_EMERALD }} />
              </div>
              <span style={{ width: 80, textAlign: "right", color: INK_DIM }}>
                {n.toLocaleString()} ({pct.toFixed(1)}%)
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function HonestLabelsLegend(): React.JSX.Element {
  // Owner directive · never label views as unique visitors. This
  // legend states the semantics plainly on the page.
  return (
    <div
      style={{
        padding: "10px 14px",
        marginBottom: 18,
        borderRadius: 10,
        border: `1px solid ${BORDER_EMERALD}`,
        background: "rgba(22,214,107,0.04)",
        color: INK_DIM,
        fontSize: 11.5,
        lineHeight: 1.55,
      }}
    >
      <strong style={{ color: ACCENT_EMERALD }}>Counting rules:</strong>{" "}
      Bots are excluded at write time. Owner-self-views are excluded.
      Repeat views from the same anonymous cookie within 60 seconds
      count once. <em>Unique viewer hashes</em> is COUNT(DISTINCT) of
      the SHA-256-hashed first-party cookie · it is NOT "unique
      visitors" (we do not fingerprint, we do not store IPs). A user
      clearing their cookies, or using a different device, will count
      as a new viewer. Signed-in viewers come from
      <code> viewer_account_id</code> where known.
    </div>
  );
}

function TableUnavailableNotice(): React.JSX.Element {
  return (
    <div
      style={{
        padding: "14px 16px",
        borderRadius: 12,
        border: `1px solid ${ACCENT_WARN}`,
        background: "rgba(247,181,0,0.08)",
        color: ACCENT_WARN,
        fontSize: 13,
      }}
    >
      <strong>Traffic analytics not deployed in this environment.</strong>
      <br />
      <span style={{ color: INK_DIM }}>
        Migration 303 (<code>nex_page_view</code>) is sandbox-only
        today. Production remains sealed until the owner authorises
        application.
      </span>
    </div>
  );
}

function EmptyStateCard({
  children,
}: {
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div
      style={{
        padding: 24,
        textAlign: "center",
        borderRadius: 12,
        border: `1px dashed ${BORDER_EMERALD}`,
        color: INK_DIM,
        fontSize: 13.5,
        lineHeight: 1.6,
      }}
    >
      {children}
    </div>
  );
}
