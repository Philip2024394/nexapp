// src/app/nex-native/hq/security-recovery/[incidentId]/page.tsx
//
// NEX Security & Recovery Centre · HQ incident drill-down.
// Owner-authorised 2026-11-08.
// -----------------------------------------------------------------------------
// Server component · HQ-admin gated · non-revealing deny via notFound().
// Reads the incident row + its event history, renders an operator-facing
// detail view with the legal-transition action panel.

import { notFound } from "next/navigation";
import Link from "next/link";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { requireHqAdmin } from "@/lib/nex-native/hq-authorization";
import {
  fetchIncidentEvents,
  isLegalTransition,
  type IncidentEventRow,
  type IncidentStatus,
} from "@/lib/nex-native/incident/incident-service";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import {
  acknowledgeIncidentAction,
  assignIncidentAction,
  escalateIncidentAction,
  saveResolutionNotesAction,
  transitionIncidentAction,
} from "./_actions";

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
const INPUT_BG = "#061021";

interface IncidentDetailRow {
  readonly id: string;
  readonly correlation_id: string | null;
  readonly category: string;
  readonly severity: string;
  readonly scope: string;
  readonly country: string;
  readonly status: IncidentStatus;
  readonly users_affected_count: number;
  readonly admin_action_required: boolean;
  readonly summary: string | null;
  readonly recovery_action_taken: string | null;
  readonly detected_at: string;
  readonly resolved_at: string | null;
  readonly updated_at: string;
  readonly acknowledged_by: string | null;
  readonly acknowledged_at: string | null;
  readonly assigned_to: string | null;
  readonly resolution_notes: string | null;
}

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALL_STATUSES: readonly IncidentStatus[] = [
  "DETECTED",
  "INVESTIGATING",
  "PROTECTING",
  "RECOVERING",
  "RECOVERED",
  "MONITORING",
  "NEEDS_ADMIN",
  "CLOSED",
];

async function fetchIncident(
  incidentId: string,
): Promise<IncidentDetailRow | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_incident")
    .select(
      "id, correlation_id, category, severity, scope, country, status, users_affected_count, admin_action_required, summary, recovery_action_taken, detected_at, resolved_at, updated_at, acknowledged_by, acknowledged_at, assigned_to, resolution_notes",
    )
    .eq("id", incidentId)
    .maybeSingle();
  if (error || !data) return null;
  return data as IncidentDetailRow;
}

interface Params {
  readonly incidentId: string;
}
interface QueryParams {
  readonly ok?: string;
  readonly error?: string;
  readonly detail?: string;
  readonly from?: string;
  readonly to?: string;
}

export default async function HqIncidentDrilldownPage({
  params,
  searchParams,
}: {
  readonly params: Promise<Params>;
  readonly searchParams: Promise<QueryParams>;
}): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  if (!session) notFound();
  const authorised = await requireHqAdmin(session.account.id)
    .then(() => true)
    .catch(() => false);
  if (!authorised) notFound();

  const { incidentId } = await params;
  const sp = await searchParams;

  if (!UUID_SHAPE.test(incidentId)) notFound();

  const incident = await fetchIncident(incidentId);
  if (!incident) notFound();

  const events = await fetchIncidentEvents(incidentId);

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
          HQ · Security &amp; recovery · Incident drill-down
        </div>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 900,
            margin: "6px 0 14px",
            letterSpacing: "0.01em",
            fontFamily: "monospace",
          }}
        >
          {incident.id}
        </h1>
        <nav style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <Link href="/nex-native/hq/security-recovery" style={tabStyle(false)}>
            ← Recovery centre
          </Link>
          <Link href="/nex-native/hq" style={tabStyle(false)}>
            HQ Home
          </Link>
        </nav>
        <Banner sp={sp} />
      </header>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: 18,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            padding: "16px 18px",
            borderRadius: 12,
            border: `1px solid ${BORDER}`,
            background: CARD_BG,
          }}
        >
          <div style={labelStyle}>Status</div>
          <div style={{ marginTop: 6, marginBottom: 14, display: "flex", gap: 10, alignItems: "center" }}>
            <StatusBadge status={incident.status} />
            <SeverityBadge severity={incident.severity} />
            {incident.admin_action_required ? (
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  color: ACCENT_FAIL,
                  textTransform: "uppercase",
                  padding: "3px 8px",
                  borderRadius: 999,
                  border: `1px solid ${ACCENT_FAIL}`,
                  background: `${ACCENT_FAIL}1a`,
                }}
              >
                Admin action required
              </span>
            ) : null}
          </div>

          <DataGrid
            rows={[
              { k: "Category", v: incident.category },
              { k: "Scope", v: incident.scope },
              { k: "Country", v: incident.country },
              {
                k: "Correlation",
                v: incident.correlation_id ?? "—",
                mono: Boolean(incident.correlation_id),
              },
              { k: "Users affected", v: String(incident.users_affected_count) },
            ]}
          />

          <div style={{ marginTop: 16 }}>
            <div style={labelStyle}>Summary (redacted)</div>
            <div
              style={{
                marginTop: 6,
                fontSize: 13,
                lineHeight: 1.6,
                color: INK,
                whiteSpace: "pre-wrap",
              }}
            >
              {incident.summary ?? "—"}
            </div>
          </div>

          {incident.recovery_action_taken ? (
            <div style={{ marginTop: 14 }}>
              <div style={labelStyle}>Last recovery action</div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: INK_DIM,
                  whiteSpace: "pre-wrap",
                }}
              >
                {incident.recovery_action_taken}
              </div>
            </div>
          ) : null}

          {incident.resolution_notes ? (
            <div style={{ marginTop: 14 }}>
              <div style={labelStyle}>Resolution notes</div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: INK,
                  whiteSpace: "pre-wrap",
                }}
              >
                {incident.resolution_notes}
              </div>
            </div>
          ) : null}
        </div>

        <div
          style={{
            padding: "16px 18px",
            borderRadius: 12,
            border: `1px solid ${BORDER}`,
            background: CARD_BG,
          }}
        >
          <div style={labelStyle}>Timeline</div>
          <ul
            style={{
              listStyle: "none",
              margin: "10px 0 0",
              padding: 0,
              display: "grid",
              gap: 8,
            }}
          >
            <TimelineRow label="Detected" value={formatUtc(incident.detected_at)} />
            <TimelineRow
              label="Acknowledged"
              value={incident.acknowledged_at ? formatUtc(incident.acknowledged_at) : "—"}
            />
            <TimelineRow
              label="Resolved"
              value={incident.resolved_at ? formatUtc(incident.resolved_at) : "—"}
            />
            <TimelineRow label="Updated" value={formatUtc(incident.updated_at)} />
          </ul>

          <div style={{ marginTop: 16 }}>
            <div style={labelStyle}>Operators</div>
            <ul
              style={{
                listStyle: "none",
                margin: "10px 0 0",
                padding: 0,
                display: "grid",
                gap: 8,
              }}
            >
              <TimelineRow
                label="Assigned to"
                value={shortHash(incident.assigned_to) ?? "—"}
                mono
              />
              <TimelineRow
                label="Acknowledged by"
                value={shortHash(incident.acknowledged_by) ?? "—"}
                mono
              />
            </ul>
          </div>
        </div>
      </section>

      <OperatorActions incident={incident} />

      <h2 style={sectionHeading}>Event history ({events.length})</h2>
      {events.length === 0 ? (
        <div
          style={{
            color: INK_MUTED,
            fontSize: 13,
            padding: 24,
            textAlign: "center",
            border: `1px dashed ${BORDER}`,
            borderRadius: 12,
          }}
        >
          No events recorded yet.
        </div>
      ) : (
        <EventTable rows={events} />
      )}
    </div>
  );
}

// ─── Operator action panel ──────────────────────────────────────────

function OperatorActions({
  incident,
}: {
  readonly incident: IncidentDetailRow;
}): React.JSX.Element {
  const alreadyAcknowledged = incident.acknowledged_at != null;
  const transitionsFromHere = ALL_STATUSES.filter((s) =>
    isLegalTransition(incident.status, s),
  );

  return (
    <section
      aria-label="Operator actions"
      style={{
        padding: "16px 18px",
        borderRadius: 12,
        border: `1px solid ${BORDER}`,
        background: CARD_BG,
        marginBottom: 24,
      }}
    >
      <div style={labelStyle}>Operator actions</div>

      <div
        style={{
          marginTop: 12,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 14,
        }}
      >
        {/* Acknowledge */}
        <form action={acknowledgeIncidentAction}>
          <input type="hidden" name="incident_id" value={incident.id} />
          <div style={formGroupStyle}>
            <div style={formTitleStyle}>Acknowledge</div>
            <div style={formHelpStyle}>
              {alreadyAcknowledged
                ? `Acknowledged ${formatUtc(incident.acknowledged_at ?? "")}`
                : "Record that an operator is aware of this incident."}
            </div>
            <button
              type="submit"
              disabled={alreadyAcknowledged}
              style={buttonStyle(alreadyAcknowledged ? "muted" : "primary")}
            >
              {alreadyAcknowledged ? "Already acknowledged" : "Acknowledge"}
            </button>
          </div>
        </form>

        {/* Transition */}
        <form action={transitionIncidentAction}>
          <input type="hidden" name="incident_id" value={incident.id} />
          <input type="hidden" name="from_status" value={incident.status} />
          <div style={formGroupStyle}>
            <div style={formTitleStyle}>Transition status</div>
            <div style={formHelpStyle}>
              Current: <strong>{incident.status}</strong>
            </div>
            {transitionsFromHere.length === 0 ? (
              <div style={{ ...formHelpStyle, color: INK_MUTED }}>
                Terminal state · no legal transitions.
              </div>
            ) : (
              <>
                <select
                  name="to_status"
                  defaultValue={transitionsFromHere[0]}
                  style={selectStyle}
                >
                  {transitionsFromHere.map((s) => (
                    <option key={s} value={s}>
                      → {s}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  name="note"
                  placeholder="Optional note (redacted)"
                  maxLength={300}
                  style={inputStyle}
                />
                <button type="submit" style={buttonStyle("primary")}>
                  Transition
                </button>
              </>
            )}
          </div>
        </form>

        {/* Assign */}
        <form action={assignIncidentAction}>
          <input type="hidden" name="incident_id" value={incident.id} />
          <div style={formGroupStyle}>
            <div style={formTitleStyle}>Assign to</div>
            <div style={formHelpStyle}>
              {incident.assigned_to
                ? `Current: ${shortHash(incident.assigned_to)}`
                : "Unassigned"}
            </div>
            <input
              type="text"
              name="assigned_to_id"
              placeholder="UUID (blank to unassign)"
              defaultValue={incident.assigned_to ?? ""}
              style={{ ...inputStyle, fontFamily: "monospace" }}
            />
            <button type="submit" style={buttonStyle("secondary")}>
              Save assignment
            </button>
          </div>
        </form>

        {/* Escalate */}
        {incident.status !== "NEEDS_ADMIN" &&
        isLegalTransition(incident.status, "NEEDS_ADMIN") ? (
          <form action={escalateIncidentAction}>
            <input type="hidden" name="incident_id" value={incident.id} />
            <div style={formGroupStyle}>
              <div style={formTitleStyle}>Escalate to NEEDS_ADMIN</div>
              <div style={formHelpStyle}>
                Moves status to NEEDS_ADMIN and sets admin_action_required.
              </div>
              <input
                type="text"
                name="reason"
                placeholder="Reason (short · redacted)"
                maxLength={300}
                style={inputStyle}
              />
              <button type="submit" style={buttonStyle("danger")}>
                Escalate
              </button>
            </div>
          </form>
        ) : null}

        {/* Resolution notes */}
        <form action={saveResolutionNotesAction} style={{ gridColumn: "1 / -1" }}>
          <input type="hidden" name="incident_id" value={incident.id} />
          <div style={formGroupStyle}>
            <div style={formTitleStyle}>Resolution notes</div>
            <div style={formHelpStyle}>
              Redacted before persisting · 400-char cap applied.
            </div>
            <textarea
              name="resolution_notes"
              rows={4}
              defaultValue={incident.resolution_notes ?? ""}
              placeholder="What finally fixed it · what was ruled out · follow-ups."
              style={{ ...inputStyle, resize: "vertical", minHeight: 80, fontFamily: "inherit" }}
            />
            <button type="submit" style={buttonStyle("primary")}>
              Save resolution notes
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

// ─── Event history table ─────────────────────────────────────────────

function EventTable({ rows }: { readonly rows: readonly IncidentEventRow[] }): React.JSX.Element {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead>
        <tr style={{ borderBottom: `1px solid ${BORDER}`, color: INK_MUTED }}>
          <Th>When</Th>
          <Th>Kind</Th>
          <Th>Actor</Th>
          <Th>From → To</Th>
          <Th>Note (redacted)</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((e) => (
          <tr key={e.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
            <Td style={{ fontFamily: "monospace", fontSize: 12, color: INK_DIM }}>
              {formatUtc(e.at)}
            </Td>
            <Td style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: INK_DIM }}>
              {e.kind}
            </Td>
            <Td style={{ fontFamily: "monospace", fontSize: 11, color: INK_MUTED }}>
              {shortHash(e.actor_account_id) ?? "—"}
            </Td>
            <Td style={{ fontSize: 12, color: INK }}>
              {e.from_status || e.to_status ? (
                <>
                  <span style={{ color: INK_MUTED }}>{e.from_status ?? "∅"}</span>
                  <span style={{ color: INK_MUTED, margin: "0 6px" }}>→</span>
                  <span style={{ color: INK }}>{e.to_status ?? "∅"}</span>
                </>
              ) : (
                "—"
              )}
            </Td>
            <Td style={{ fontSize: 12, color: INK_DIM, maxWidth: 400 }}>
              {e.note ?? "—"}
            </Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Visual helpers ──────────────────────────────────────────────────

function Banner({ sp }: { readonly sp: QueryParams }): React.JSX.Element | null {
  if (sp.ok) {
    return (
      <div
        role="status"
        style={{
          padding: "10px 14px",
          borderRadius: 10,
          border: `1px solid ${ACCENT_OK}`,
          background: `${ACCENT_OK}14`,
          color: ACCENT_OK,
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        OK · {sp.ok}
        {sp.to ? ` → ${sp.to}` : ""}
      </div>
    );
  }
  if (sp.error) {
    return (
      <div
        role="alert"
        style={{
          padding: "10px 14px",
          borderRadius: 10,
          border: `1px solid ${ACCENT_FAIL}`,
          background: `${ACCENT_FAIL}14`,
          color: ACCENT_FAIL,
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        Error · {sp.error}
        {sp.from && sp.to ? ` (${sp.from} → ${sp.to})` : ""}
        {sp.detail ? ` · ${sp.detail}` : ""}
      </div>
    );
  }
  return null;
}

function DataGrid({
  rows,
}: {
  readonly rows: readonly { k: string; v: string; mono?: boolean }[];
}): React.JSX.Element {
  return (
    <dl
      style={{
        margin: 0,
        display: "grid",
        gridTemplateColumns: "140px 1fr",
        rowGap: 6,
        columnGap: 14,
        fontSize: 13,
      }}
    >
      {rows.map((r) => (
        <div key={r.k} style={{ display: "contents" }}>
          <dt style={{ color: INK_MUTED, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em" }}>
            {r.k}
          </dt>
          <dd
            style={{
              margin: 0,
              color: INK,
              fontFamily: r.mono ? "monospace" : undefined,
              fontSize: r.mono ? 12 : 13,
            }}
          >
            {r.v}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function TimelineRow({
  label,
  value,
  mono,
}: {
  readonly label: string;
  readonly value: string;
  readonly mono?: boolean;
}): React.JSX.Element {
  return (
    <li
      style={{
        display: "flex",
        justifyContent: "space-between",
        fontSize: 12,
        color: INK_DIM,
      }}
    >
      <span style={{ textTransform: "uppercase", letterSpacing: "0.08em", color: INK_MUTED }}>
        {label}
      </span>
      <span style={{ color: INK, fontFamily: mono ? "monospace" : "monospace", fontSize: 11 }}>
        {value}
      </span>
    </li>
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
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.08em",
        color: col,
        padding: "4px 10px",
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
        fontSize: 11,
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

function buttonStyle(tone: "primary" | "secondary" | "danger" | "muted"): React.CSSProperties {
  const col =
    tone === "primary"
      ? ACCENT
      : tone === "danger"
        ? ACCENT_FAIL
        : tone === "muted"
          ? INK_MUTED
          : INK_DIM;
  return {
    padding: "8px 16px",
    borderRadius: 7,
    border: `1px solid ${col}`,
    background: tone === "muted" ? "transparent" : `${col}1a`,
    color: col,
    fontSize: 11.5,
    fontWeight: 700,
    cursor: tone === "muted" ? "not-allowed" : "pointer",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginTop: 8,
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

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: INK_MUTED,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  fontWeight: 700,
};

const formGroupStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  padding: 14,
  borderRadius: 10,
  background: INPUT_BG,
  border: `1px solid ${BORDER}`,
};

const formTitleStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: INK,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
};

const formHelpStyle: React.CSSProperties = {
  fontSize: 11.5,
  color: INK_MUTED,
  lineHeight: 1.5,
};

const inputStyle: React.CSSProperties = {
  padding: "7px 10px",
  borderRadius: 5,
  border: `1px solid ${BORDER}`,
  background: "#040B1B",
  color: INK,
  fontSize: 12.5,
  marginTop: 2,
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  fontFamily: "monospace",
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
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "Z");
}

function shortHash(uuid: string | null): string | null {
  if (!uuid) return null;
  if (uuid.length < 12) return uuid;
  return `${uuid.slice(0, 8)}…${uuid.slice(-4)}`;
}
