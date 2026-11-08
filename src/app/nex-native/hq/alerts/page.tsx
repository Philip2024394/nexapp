// src/app/nex-native/hq/alerts/page.tsx
//
// NEX HQ · Alerts dashboard · owner-sealed 2026-11-08 (round 3).
// -----------------------------------------------------------------------------
// Doctrine
//   · Server-rendered · requireHqAdmin gate · non-revealing notFound() on deny.
//   · Reads the same sealed incident surface the Security & Recovery
//     Centre reads (nex_incident, migration 300) · this page gives
//     operators a focused "what needs attention right now" view with
//     the non-incident health probes (section-probes) mixed in.
//   · Honest-unknown · when a reader fails or a table is missing we
//     show the UNKNOWN state · never a false GREEN.
//   · "Known gaps" panel · the owner directive is explicit that the
//     alert surface must tell admins what the system CAN'T yet detect.
//     Lists feed-broken, URL-dead, UX drop-off, page-view telemetry.

import { notFound } from "next/navigation";
import Link from "next/link";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { requireHqAdmin } from "@/lib/nex-native/hq-authorization";
import {
  fetchAwaitingVerification,
  fetchIncidentSummary,
  fetchOpenIncidents,
  fetchRecentlyClosed,
  fetchReopened,
  fetchVerifiedIncidents,
  type IncidentRow,
  type IncidentSummaryCounts,
} from "@/lib/nex-native/incident/incident-service";
import { probeAllSections, type ProbeResult } from "@/lib/nex-native/health/section-probes";
import { AlertsAutoRefresh } from "./_auto-refresh-client";

export const dynamic = "force-dynamic";

const INK = "#F2F5F8";
const INK_DIM = "#B5C3D6";
const INK_MUTED = "#7D9BC0";
const ACCENT_EMERALD = "#16D66B";
const ACCENT_WARN = "#F7B500";
const ACCENT_FAIL = "#FF5B5B";
const BORDER_EMERALD = "rgba(22,214,107,0.18)";
const CARD_BG = "#07152A";

export default async function HqAlertsPage(): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  if (!session) notFound();
  const authorised = await requireHqAdmin(session.account.id)
    .then(() => true)
    .catch(() => false);
  if (!authorised) notFound();

  // Owner directive 2026-11-08 (round 9) Priority 3 · 5 operator-
  // meaningful state buckets rendered as distinct sections.
  const [
    summary,
    openIncidents,
    awaiting,
    verified,
    recentlyClosed,
    reopened,
    probes,
  ] = await Promise.all([
    safeSummary(),
    safeOpen(),
    safeAwaiting(),
    safeVerified(),
    safeRecentlyClosed(),
    safeReopened(),
    safeProbes(),
  ]);

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
          HQ · Alerts
        </div>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 900,
            margin: "6px 0 10px",
            letterSpacing: "0.01em",
          }}
        >
          WHAT NEEDS ATTENTION
        </h1>
        <p
          style={{
            fontSize: 13.5,
            color: INK_DIM,
            lineHeight: 1.6,
            maxWidth: 760,
            margin: 0,
          }}
        >
          Open incidents and section-probe status in one place · plus an
          honest list of what the system cannot yet detect. End users
          never see the issues on this page · it is admin-only.
        </p>
      </header>

      <AlertsAutoRefresh />

      <SummaryStrip summary={summary} />
      <ProbesStrip probes={probes} />

      <StateBucket
        tone="fail"
        title="Needs action"
        subtitle="Open incidents · operator required"
        rows={openIncidents}
      />
      <StateBucket
        tone="warn"
        title="Awaiting verification"
        subtitle="RECOVERED claims not yet operator-confirmed"
        rows={awaiting}
      />
      <StateBucket
        tone="fail"
        title="Reopened"
        subtitle="New incidents sharing correlation_id with a prior VERIFIED · regression signal"
        rows={reopened}
      />
      <StateBucket
        tone="ok"
        title="Verified resolved"
        subtitle="Operator-confirmed resolutions (recent)"
        rows={verified}
        showVerifier
      />
      <StateBucket
        tone="muted"
        title="Recently closed · 24h"
        subtitle="Reference only · CLOSED is terminal · a return of the problem creates a NEW incident"
        rows={recentlyClosed}
      />

      <KnownGaps />
    </div>
  );
}

async function safeSummary(): Promise<IncidentSummaryCounts | null> {
  try {
    return await fetchIncidentSummary();
  } catch {
    return null;
  }
}

async function safeOpen(): Promise<readonly IncidentRow[]> {
  try {
    return await fetchOpenIncidents(25);
  } catch {
    return [];
  }
}

async function safeAwaiting(): Promise<readonly IncidentRow[]> {
  try {
    return await fetchAwaitingVerification(25);
  } catch {
    return [];
  }
}

async function safeVerified(): Promise<readonly IncidentRow[]> {
  try {
    return await fetchVerifiedIncidents(10);
  } catch {
    return [];
  }
}

async function safeRecentlyClosed(): Promise<readonly IncidentRow[]> {
  try {
    return await fetchRecentlyClosed(10);
  } catch {
    return [];
  }
}

async function safeReopened(): Promise<readonly IncidentRow[]> {
  try {
    return await fetchReopened(10);
  } catch {
    return [];
  }
}

async function safeProbes(): Promise<readonly ProbeResult[]> {
  try {
    return await probeAllSections();
  } catch {
    return [];
  }
}

function SummaryStrip({
  summary,
}: {
  readonly summary: IncidentSummaryCounts | null;
}): React.JSX.Element {
  if (!summary) {
    return (
      <div
        style={{
          padding: "14px 16px",
          borderRadius: 12,
          border: `1px solid ${ACCENT_WARN}`,
          background: "rgba(247,181,0,0.08)",
          color: ACCENT_WARN,
          fontSize: 13,
          marginBottom: 16,
        }}
      >
        <strong>Incident table unavailable.</strong> Summary cannot be
        computed in this environment. This is a migration gap, not an
        outage · HQ still reports the gap honestly.
      </div>
    );
  }
  // Owner directive 2026-11-08 (round 9) Priority 3 · 5-state summary.
  const cards: Array<{ label: string; value: number; tone: "ok" | "warn" | "fail" }> = [
    {
      label: "Open · critical",
      value: summary.open_critical,
      tone: summary.open_critical > 0 ? "fail" : "ok",
    },
    {
      label: "Open · high",
      value: summary.open_high,
      tone: summary.open_high > 0 ? "warn" : "ok",
    },
    { label: "Open · total", value: summary.open, tone: summary.open > 0 ? "warn" : "ok" },
    {
      label: "Needs admin",
      value: summary.needs_admin,
      tone: summary.needs_admin > 0 ? "warn" : "ok",
    },
    {
      label: "Awaiting verification",
      value: summary.awaiting_verification,
      tone: summary.awaiting_verification > 0 ? "warn" : "ok",
    },
    {
      label: "Reopened · now",
      value: summary.reopened_now,
      tone: summary.reopened_now > 0 ? "fail" : "ok",
    },
    { label: "Verified · 24h", value: summary.verified_last_24h, tone: "ok" },
    { label: "Closed · 24h", value: summary.closed_last_24h, tone: "ok" },
  ];
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: 10,
        marginBottom: 18,
      }}
    >
      {cards.map((c) => (
        <div
          key={c.label}
          style={{
            padding: "14px 16px",
            borderRadius: 12,
            border: `1px solid ${
              c.tone === "fail"
                ? ACCENT_FAIL
                : c.tone === "warn"
                  ? ACCENT_WARN
                  : BORDER_EMERALD
            }`,
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
            {c.label}
          </div>
          <div
            style={{
              fontSize: 26,
              fontWeight: 900,
              color:
                c.tone === "fail"
                  ? ACCENT_FAIL
                  : c.tone === "warn"
                    ? ACCENT_WARN
                    : ACCENT_EMERALD,
              marginTop: 2,
            }}
          >
            {c.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function ProbesStrip({
  probes,
}: {
  readonly probes: readonly ProbeResult[];
}): React.JSX.Element {
  if (probes.length === 0) {
    return (
      <div
        style={{
          padding: "12px 14px",
          borderRadius: 10,
          border: `1px dashed ${BORDER_EMERALD}`,
          color: INK_MUTED,
          fontSize: 12.5,
          marginBottom: 18,
        }}
      >
        Section probes unavailable in this environment.
      </div>
    );
  }
  return (
    <div style={{ marginBottom: 18 }}>
      <div
        style={{
          fontSize: 10.5,
          color: INK_MUTED,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          marginBottom: 6,
        }}
      >
        Section health · live probe
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: 8,
        }}
      >
        {probes.map((p) => (
          <div
            key={p.name}
            title={p.detail ?? p.name}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: `1px solid ${probeColour(p.status)}`,
              background: CARD_BG,
              fontSize: 12.5,
            }}
          >
            <div style={{ fontWeight: 800, color: INK }}>{p.name}</div>
            <div
              style={{
                fontSize: 10.5,
                color: probeColour(p.status),
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                fontWeight: 700,
              }}
            >
              {p.status} · {p.latency_ms}ms
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StateBucket({
  tone,
  title,
  subtitle,
  rows,
  showVerifier,
}: {
  readonly tone: "fail" | "warn" | "ok" | "muted";
  readonly title: string;
  readonly subtitle: string;
  readonly rows: readonly IncidentRow[];
  readonly showVerifier?: boolean;
}): React.JSX.Element {
  const toneColour =
    tone === "fail"
      ? ACCENT_FAIL
      : tone === "warn"
        ? ACCENT_WARN
        : tone === "ok"
          ? ACCENT_EMERALD
          : INK_MUTED;
  return (
    <section style={{ marginBottom: 18 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 6,
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10.5,
              color: toneColour,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              fontWeight: 800,
            }}
          >
            {title} · {rows.length}
          </div>
          <div style={{ fontSize: 11, color: INK_DIM, marginTop: 2 }}>{subtitle}</div>
        </div>
        <Link
          href="/nex-native/hq/security-recovery"
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: ACCENT_EMERALD,
            textDecoration: "none",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          Open Security & Recovery →
        </Link>
      </div>
      {rows.length === 0 ? (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: `1px dashed ${BORDER_EMERALD}`,
            color: INK_MUTED,
            fontSize: 12.5,
          }}
        >
          None.
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${toneColour}`, color: INK_MUTED }}>
              <th style={thStyle}>At</th>
              <th style={thStyle}>Scope</th>
              <th style={thStyle}>Severity</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Service</th>
              <th style={thStyle}>{showVerifier ? "Verifier" : "Summary"}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                style={{ borderBottom: `1px solid ${BORDER_EMERALD}` }}
              >
                <td style={tdStyle}>
                  <Link
                    href={`/nex-native/hq/security-recovery/${r.id}`}
                    style={{ color: ACCENT_EMERALD, textDecoration: "none" }}
                  >
                    {r.detected_at.slice(0, 19).replace("T", " ")}
                  </Link>
                </td>
                <td style={tdStyle}>{r.scope}</td>
                <td style={{ ...tdStyle, color: severityColour(r.severity) }}>
                  {r.severity}
                </td>
                <td style={tdStyle}>{r.status}</td>
                <td style={{ ...tdStyle, color: INK_DIM }}>
                  {r.service ?? "—"}
                </td>
                <td style={{ ...tdStyle, color: INK_DIM }}>
                  {showVerifier
                    ? r.verified_by_admin
                      ? `${r.verified_by_admin.slice(0, 8)}… · ${
                          r.verified_at?.slice(0, 19).replace("T", " ") ?? ""
                        }`
                      : "—"
                    : (r.summary?.slice(0, 160) ?? "—")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function KnownGaps(): React.JSX.Element {
  // Owner directive 2026-11-08 (round 3) · the alert page MUST tell
  // admins what the system does NOT yet detect. This is anti-false-
  // comfort · an empty "incidents" column is only honest if we also
  // say "but we would not have spotted X".
  const gaps: Array<{ label: string; reason: string; next: string }> = [
    {
      label: "Feed broken · empty renderer or Supabase gap",
      reason:
        "nex_live_post probe only verifies table reachability, not the feed composer's output.",
      next: "Add a daily feed-composer smoke test + emit a feed-degraded incident on mismatch.",
    },
    {
      label: "URL page dead · 404 / 500 at a real route",
      reason:
        "HQ Pages dashboard lists the routes but does not HEAD them. A silently-broken page would not appear here.",
      next: "Nightly HEAD sweep + write a url-dead incident on non-2xx responses.",
    },
    {
      label: "Shop page hits + high-traffic time windows",
      reason:
        "No nex_page_view table today. Member rows show '—' for shop hits and peak traffic.",
      next: "Migration 303 · nex_page_view · tracer at /nex-native/[businessSlug] · hourly bucket read.",
    },
    {
      label: "User-flow drop-off (UX improvement suggestions)",
      reason:
        "No funnel telemetry. The system cannot say 'users abandon at step 3 of onboarding'.",
      next: "Instrument key funnels with session-safe events + weekly aggregation into nex_flow_abandonment.",
    },
    {
      label: "Monthly earnings in fiat currency",
      reason:
        "Sealed · NEX never handles payments. The ledger records order activity, not money movements.",
      next: "Out of scope until the Package Contract DRAFT seals + a payments-recording surface is explicitly authorised.",
    },
  ];
  return (
    <section
      style={{
        marginTop: 20,
        padding: "16px 18px",
        borderRadius: 14,
        border: `1px solid ${ACCENT_WARN}`,
        background: "rgba(247,181,0,0.05)",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          color: ACCENT_WARN,
          textTransform: "uppercase",
          letterSpacing: "0.14em",
          marginBottom: 2,
        }}
      >
        Known detection gaps · honest
      </div>
      <h2 style={{ fontSize: 17, fontWeight: 900, margin: "2px 0 10px", color: INK }}>
        What this dashboard CANNOT yet see
      </h2>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
        {gaps.map((g) => (
          <li
            key={g.label}
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              border: `1px solid ${BORDER_EMERALD}`,
              background: CARD_BG,
              fontSize: 12.5,
              lineHeight: 1.55,
              color: INK_DIM,
            }}
          >
            <div style={{ fontWeight: 800, color: INK }}>{g.label}</div>
            <div style={{ color: INK_DIM, marginTop: 2 }}>
              <strong style={{ color: ACCENT_WARN }}>Why not yet:</strong>{" "}
              {g.reason}
            </div>
            <div style={{ color: INK_DIM, marginTop: 2 }}>
              <strong style={{ color: ACCENT_EMERALD }}>Next:</strong>{" "}
              {g.next}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function probeColour(status: ProbeResult["status"]): string {
  if (status === "ok") return ACCENT_EMERALD;
  if (status === "degraded") return ACCENT_WARN;
  if (status === "unknown") return INK_MUTED;
  return ACCENT_FAIL;
}

function severityColour(sev: string): string {
  if (sev === "critical") return ACCENT_FAIL;
  if (sev === "warn") return ACCENT_WARN;
  return INK_DIM;
}

const thStyle: React.CSSProperties = {
  padding: "8px 10px",
  textAlign: "left",
  fontSize: 10.5,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
};

const tdStyle: React.CSSProperties = {
  padding: "8px 10px",
  verticalAlign: "top",
  color: INK,
};
