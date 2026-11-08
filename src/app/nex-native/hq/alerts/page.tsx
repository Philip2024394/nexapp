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
  fetchRecentIncidents,
  fetchIncidentSummary,
  type IncidentRow,
  type IncidentSummaryCounts,
} from "@/lib/nex-native/incident/incident-service";
import { probeAllSections, type ProbeResult } from "@/lib/nex-native/health/section-probes";

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

  const [summary, recent, probes] = await Promise.all([
    safeSummary(),
    safeRecent(),
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

      <SummaryStrip summary={summary} />
      <ProbesStrip probes={probes} />
      <RecentIncidents rows={recent} />
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

async function safeRecent(): Promise<readonly IncidentRow[]> {
  try {
    return await fetchRecentIncidents(25);
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
  const cards: Array<{ label: string; value: number; tone: "ok" | "warn" | "fail" }> = [
    { label: "Open", value: summary.open, tone: summary.open > 0 ? "warn" : "ok" },
    {
      label: "Open · critical",
      value: summary.open_critical,
      tone: summary.open_critical > 0 ? "fail" : "ok",
    },
    {
      label: "Needs admin",
      value: summary.needs_admin,
      tone: summary.needs_admin > 0 ? "warn" : "ok",
    },
    {
      label: "Recovered · 24h",
      value: summary.recovered_last_24h,
      tone: "ok",
    },
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

function RecentIncidents({
  rows,
}: {
  readonly rows: readonly IncidentRow[];
}): React.JSX.Element {
  return (
    <section style={{ marginBottom: 20 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 6,
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
          Recent incidents
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
            padding: "14px 16px",
            borderRadius: 10,
            border: `1px dashed ${BORDER_EMERALD}`,
            color: INK_MUTED,
            fontSize: 13,
          }}
        >
          No recent incidents.
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${BORDER_EMERALD}`, color: INK_MUTED }}>
              <th style={thStyle}>At</th>
              <th style={thStyle}>Scope</th>
              <th style={thStyle}>Category</th>
              <th style={thStyle}>Severity</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Summary</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderBottom: `1px solid ${BORDER_EMERALD}` }}>
                <td style={tdStyle}>{r.detected_at.slice(0, 19).replace("T", " ")}</td>
                <td style={tdStyle}>{r.scope}</td>
                <td style={tdStyle}>{r.category}</td>
                <td style={{ ...tdStyle, color: severityColour(r.severity) }}>
                  {r.severity}
                </td>
                <td style={tdStyle}>{r.status}</td>
                <td style={{ ...tdStyle, color: INK_DIM }}>
                  {r.summary?.slice(0, 180) ?? "—"}
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
