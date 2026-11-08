// src/app/nex-native/hq/security-recovery/page.tsx
//
// NEX Security & Recovery Centre · HQ dashboard.
// Owner-sealed 2026-11-08.
// -----------------------------------------------------------------------------
// Reads live incidents from nex_incident (migration 300) + summary
// counts. Non-revealing deny (notFound) for non-HQ. If the incident
// table does not yet exist in this environment, the readers return
// zero-rows + we show UNKNOWN badges rather than fabricating HEALTHY.

import { notFound } from "next/navigation";
import Link from "next/link";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { requireHqAdmin } from "@/lib/nex-native/hq-authorization";
import {
  fetchIncidentSummary,
  fetchRecentIncidents,
  type IncidentRow,
  type IncidentSummaryCounts,
} from "@/lib/nex-native/incident/incident-service";

export const dynamic = "force-dynamic";

const INK = "#F2F5F8";
const INK_DIM = "#B5C3D6";
const INK_MUTED = "#7D9BC0";
const ACCENT = "#00AFFF";
const ACCENT_OK = "#4ADE80";
const ACCENT_WARN = "#F7B500";
const ACCENT_FAIL = "#FF5B5B";
const BORDER = "rgba(0,175,255,0.14)";
const CARD_BG = "#07152A";

interface Params {
  readonly scope?: string;
  readonly country?: string;
  readonly status?: string;
}

export default async function HqSecurityRecoveryPage({
  searchParams,
}: {
  readonly searchParams: Promise<Params>;
}): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  if (!session) notFound();
  const authorised = await requireHqAdmin(session.account.id)
    .then(() => true)
    .catch(() => false);
  if (!authorised) notFound();

  const sp = await searchParams;
  const [summary, recent] = await Promise.all([
    fetchIncidentSummary(),
    fetchRecentIncidents(100),
  ]);

  const filtered = recent.filter((r) => {
    if (sp.scope && r.scope !== sp.scope) return false;
    if (sp.country && r.country !== sp.country) return false;
    if (sp.status && r.status !== sp.status) return false;
    return true;
  });

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
          HQ · Security &amp; recovery centre
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 900, margin: "6px 0 14px", letterSpacing: "0.01em" }}>
          NEX SECURITY &amp; RECOVERY
        </h1>
        <nav style={{ display: "flex", gap: 10 }}>
          <Link href="/nex-native/hq" style={tabStyle(false)}>← HQ Home</Link>
          <Link href="/nex-native/hq/security-audit" style={tabStyle(false)}>Security audit</Link>
          <Link href="/nex-native/hq/security-recovery" style={tabStyle(true)}>Recovery centre</Link>
        </nav>
      </header>

      <SummaryGrid summary={summary} />

      <section
        aria-label="Country + scope breakdown"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 18,
          marginBottom: 24,
        }}
      >
        <HealthCard
          title="Country health"
          entries={Object.entries(summary.by_country).map(([k, v]) => ({
            label: k,
            count: v,
          }))}
        />
        <HealthCard
          title="Section health"
          entries={Object.entries(summary.by_scope).map(([k, v]) => ({
            label: k,
            count: v,
          }))}
          fallback="Nothing open"
        />
      </section>

      <h2 style={sectionHeading}>Recent incidents ({filtered.length})</h2>
      <FilterBar sp={sp} />
      {filtered.length === 0 ? (
        <div
          style={{
            color: INK_MUTED,
            fontSize: 14,
            padding: 32,
            textAlign: "center",
            border: `1px dashed ${BORDER}`,
            borderRadius: 14,
            lineHeight: 1.6,
          }}
        >
          <div style={{ fontSize: 16, color: INK_DIM, marginBottom: 6 }}>
            No matching incidents.
          </div>
          <div style={{ fontSize: 12 }}>
            {recent.length === 0
              ? "Either NEX has nothing to report OR the nex_incident table is not yet present in this environment (migration 300)."
              : "Try broadening the filters above."}
          </div>
        </div>
      ) : (
        <IncidentTable rows={filtered} />
      )}
    </div>
  );
}

function SummaryGrid({ summary }: { readonly summary: IncidentSummaryCounts }): React.JSX.Element {
  return (
    <section
      aria-label="Incident summary counts"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 14,
        marginBottom: 24,
      }}
    >
      <StatCard label="Open" value={summary.open} tone={summary.open === 0 ? "ok" : "warn"} />
      <StatCard
        label="Open critical"
        value={summary.open_critical}
        tone={summary.open_critical === 0 ? "ok" : "fail"}
      />
      <StatCard
        label="Needs admin"
        value={summary.needs_admin}
        tone={summary.needs_admin === 0 ? "ok" : "fail"}
      />
      <StatCard
        label="Recovered 24h"
        value={summary.recovered_last_24h}
        tone="ok"
      />
    </section>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  readonly label: string;
  readonly value: number;
  readonly tone: "ok" | "warn" | "fail";
}): React.JSX.Element {
  const col = tone === "ok" ? ACCENT_OK : tone === "warn" ? ACCENT_WARN : ACCENT_FAIL;
  return (
    <div
      style={{
        padding: "16px 18px",
        borderRadius: 12,
        border: `1px solid ${BORDER}`,
        background: CARD_BG,
      }}
    >
      <div style={{ fontSize: 11, color: INK_MUTED, textTransform: "uppercase", letterSpacing: "0.12em" }}>
        {label}
      </div>
      <div style={{ fontSize: 30, fontWeight: 900, color: col, marginTop: 6 }}>{value}</div>
    </div>
  );
}

function HealthCard({
  title,
  entries,
  fallback,
}: {
  readonly title: string;
  readonly entries: readonly { label: string; count: number }[];
  readonly fallback?: string;
}): React.JSX.Element {
  const shown = entries.filter((e) => e.count > 0);
  return (
    <div
      style={{
        padding: "16px 18px",
        borderRadius: 12,
        border: `1px solid ${BORDER}`,
        background: CARD_BG,
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: INK_MUTED,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      {shown.length === 0 ? (
        <div style={{ color: INK_MUTED, fontSize: 13 }}>
          {fallback ?? "All clear"}
        </div>
      ) : (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "grid",
            gap: 6,
          }}
        >
          {shown.map((e) => (
            <li
              key={e.label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 13,
                color: INK_DIM,
              }}
            >
              <span style={{ textTransform: "uppercase", letterSpacing: "0.1em", fontSize: 11 }}>
                {e.label}
              </span>
              <span style={{ fontWeight: 800, color: INK }}>{e.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterBar({ sp }: { readonly sp: Params }): React.JSX.Element {
  return (
    <form
      method="get"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: 8,
        marginBottom: 14,
        padding: "12px 14px",
        borderRadius: 10,
        border: `1px solid ${BORDER}`,
        background: CARD_BG,
      }}
    >
      <Field name="scope" label="Scope" value={sp.scope} />
      <Field name="country" label="Country" value={sp.country} />
      <Field name="status" label="Status" value={sp.status} />
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
        <button
          type="submit"
          style={{
            padding: "8px 16px",
            borderRadius: 7,
            border: `1px solid ${ACCENT}`,
            background: "rgba(0,175,255,0.12)",
            color: ACCENT,
            fontSize: 11.5,
            fontWeight: 700,
            cursor: "pointer",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Apply
        </button>
        <Link
          href="/nex-native/hq/security-recovery"
          style={{
            padding: "8px 12px",
            borderRadius: 7,
            border: `1px solid ${BORDER}`,
            background: "transparent",
            color: INK_DIM,
            fontSize: 11.5,
            fontWeight: 700,
            textDecoration: "none",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Clear
        </Link>
      </div>
    </form>
  );
}

function Field({
  name,
  label,
  value,
}: {
  readonly name: string;
  readonly label: string;
  readonly value?: string;
}): React.JSX.Element {
  return (
    <label style={{ display: "grid", gap: 3 }}>
      <span
        style={{
          fontSize: 10.5,
          color: INK_MUTED,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
        }}
      >
        {label}
      </span>
      <input
        type="text"
        name={name}
        defaultValue={value ?? ""}
        style={{
          padding: "7px 10px",
          borderRadius: 5,
          border: `1px solid ${BORDER}`,
          background: "#061021",
          color: INK,
          fontSize: 12.5,
          fontFamily: "monospace",
        }}
      />
    </label>
  );
}

function IncidentTable({ rows }: { readonly rows: readonly IncidentRow[] }): React.JSX.Element {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead>
        <tr style={{ borderBottom: `1px solid ${BORDER}`, color: INK_MUTED }}>
          <Th>Detected</Th>
          <Th>Country</Th>
          <Th>Scope</Th>
          <Th>Category</Th>
          <Th>Severity</Th>
          <Th>Status</Th>
          <Th>Summary</Th>
          <Th>Users</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
            <Td>{formatUtc(r.detected_at)}</Td>
            <Td style={{ textTransform: "uppercase", fontSize: 11, letterSpacing: "0.08em", color: INK_MUTED }}>
              {r.country}
            </Td>
            <Td style={{ textTransform: "uppercase", fontSize: 11, letterSpacing: "0.08em", color: INK_DIM }}>
              {r.scope}
            </Td>
            <Td style={{ fontSize: 12, color: INK_DIM }}>{r.category}</Td>
            <Td>
              <SeverityBadge severity={r.severity} />
            </Td>
            <Td>
              <StatusBadge status={r.status} />
            </Td>
            <Td style={{ fontSize: 12, color: INK, maxWidth: 400 }}>
              {r.summary ?? "—"}
              {r.recovery_action_taken ? (
                <div style={{ fontSize: 11, color: INK_MUTED, marginTop: 4 }}>
                  → {r.recovery_action_taken}
                </div>
              ) : null}
            </Td>
            <Td style={{ textAlign: "right", fontSize: 13 }}>{r.users_affected_count}</Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function StatusBadge({ status }: { readonly status: string }): React.JSX.Element {
  const col =
    status === "RECOVERED" || status === "CLOSED"
      ? ACCENT_OK
      : status === "NEEDS_ADMIN"
        ? ACCENT_FAIL
        : status === "MONITORING"
          ? ACCENT
          : ACCENT_WARN;
  return (
    <span
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: "0.08em",
        color: col,
        padding: "3px 8px",
        borderRadius: 999,
        border: `1px solid ${col}`,
        background: `${col}1a`,
        textTransform: "uppercase",
      }}
    >
      {status}
    </span>
  );
}

function SeverityBadge({ severity }: { readonly severity: string }): React.JSX.Element {
  const col =
    severity === "critical" ? ACCENT_FAIL : severity === "warn" ? ACCENT_WARN : INK_DIM;
  return (
    <span
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: "0.08em",
        color: col,
        textTransform: "uppercase",
      }}
    >
      {severity}
    </span>
  );
}

function tabStyle(active: boolean): React.CSSProperties {
  return {
    fontSize: 12,
    fontWeight: 700,
    padding: "8px 14px",
    borderRadius: 8,
    border: `1px solid ${active ? ACCENT : BORDER}`,
    color: active ? ACCENT : INK_DIM,
    background: active ? "rgba(0,175,255,0.08)" : "transparent",
    textDecoration: "none",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
  };
}

const sectionHeading: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  margin: "0 0 10px",
  color: INK_DIM,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
};

function Th({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
  return (
    <th
      style={{
        padding: "10px 12px",
        textAlign: "left",
        fontSize: 11,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.1em",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  style,
}: {
  readonly children: React.ReactNode;
  readonly style?: React.CSSProperties;
}): React.JSX.Element {
  return (
    <td style={{ padding: "10px 12px", verticalAlign: "top", color: INK, ...(style ?? {}) }}>
      {children}
    </td>
  );
}

function formatUtc(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "Z");
}
