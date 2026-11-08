// src/app/nex-native/hq/security-audit/page.tsx
//
// NEX Security Programme · Item 5 · HQ security-audit viewer.
// Owner-sealed 2026-11-08.
// -----------------------------------------------------------------------------
// Desktop HQ workspace (not phone-framed · HQ is sealed as a desktop
// surface per the CLAUDE.md fork hygiene + the existing hq/page.tsx
// pattern). Server-rendered · requireHqAdmin gate · non-revealing 404
// on deny.
//
// URL parameters (all optional):
//   · event         · event-prefix filter (e.g. "security.password_change")
//   · outcome       · attempted | denied | completed | failed
//   · actor         · UUID of the actor account
//   · since         · ISO-8601 timestamp (inclusive lower bound)
//   · until         · ISO-8601 timestamp (exclusive upper bound)
//   · cursor_at     · cursor occurred_at for pagination
//   · cursor_id     · cursor id for pagination
//   · view          · "log" (default) or "unresolved"

import { notFound } from "next/navigation";
import Link from "next/link";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { requireHqAdmin } from "@/lib/nex-native/hq-authorization";
import {
  fetchAuditPage,
  fetchUnresolvedPage,
  type AuditOutcomeFilter,
  type AuditPage,
  type AuditRow,
  type UnresolvedPage,
} from "./_reader";
import { manuallyResolveUnresolvedAction } from "./_unresolved-actions";

export const dynamic = "force-dynamic";

const INK = "#F2F5F8";
const INK_DIM = "#B5C3D6";
const INK_MUTED = "#7D9BC0";
const ACCENT = "#00AFFF";
const ACCENT_WARN = "#F7B500";
const ACCENT_FAIL = "#FF5B5B";
const BORDER = "rgba(0,175,255,0.14)";
const CARD_BG = "#07152A";

type OutcomeKind = AuditOutcomeFilter | null;

interface PageSearchParams {
  readonly event?: string;
  readonly outcome?: string;
  readonly actor?: string;
  readonly since?: string;
  readonly until?: string;
  readonly cursor_at?: string;
  readonly cursor_id?: string;
  readonly view?: string;
  readonly ok?: string;
  readonly error?: string;
  readonly id?: string;
  readonly detail?: string;
}

function parseOutcome(raw?: string): OutcomeKind {
  if (
    raw === "attempted" ||
    raw === "denied" ||
    raw === "completed" ||
    raw === "failed"
  ) {
    return raw;
  }
  return null;
}

function outcomeColour(outcome: string): string {
  if (outcome === "completed") return "#4ADE80";
  if (outcome === "failed") return ACCENT_FAIL;
  if (outcome === "denied") return ACCENT_WARN;
  if (outcome === "attempted") return ACCENT;
  return INK_DIM;
}

function formatUtc(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "Z");
}

function truncate(v: unknown, max: number): string {
  if (v == null) return "";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

export default async function HqSecurityAuditPage({
  searchParams,
}: {
  // Next 16 · searchParams is a Promise.
  readonly searchParams: Promise<PageSearchParams>;
}): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  if (!session) notFound();
  const authorised = await requireHqAdmin(session.account.id)
    .then(() => true)
    .catch(() => false);
  if (!authorised) notFound();

  const sp = await searchParams;
  const view = sp.view === "unresolved" ? "unresolved" : "log";

  if (view === "unresolved") {
    return <UnresolvedView sp={sp} />;
  }
  return <LogView sp={sp} />;
}

async function LogView({
  sp,
}: {
  readonly sp: PageSearchParams;
}): Promise<React.JSX.Element> {
  const eventPrefix = sp.event?.trim() || undefined;
  const outcome = parseOutcome(sp.outcome);
  const actor = sp.actor?.trim() || undefined;
  const since = sp.since?.trim() || undefined;
  const until = sp.until?.trim() || undefined;
  const cursor =
    sp.cursor_at && sp.cursor_id
      ? { occurredAt: sp.cursor_at, id: Number(sp.cursor_id) }
      : undefined;

  let page: AuditPage;
  let errorMessage: string | null = null;
  try {
    page = await fetchAuditPage({
      eventPrefix,
      outcome: outcome ?? undefined,
      actorAccountId: actor,
      since,
      until,
      cursor,
    });
  } catch (e) {
    page = { rows: [], nextCursor: null };
    errorMessage = e instanceof Error ? e.message : String(e);
  }

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", color: INK }}>
      <PageHeader active="log" />
      <FilterBar sp={sp} />
      {page.tableUnavailable && <TableUnavailableBanner />}
      {errorMessage && <ErrorBanner message={errorMessage} />}
      <AuditTable rows={page.rows} />
      <Pager
        page={page}
        baseQuery={{ eventPrefix, outcome, actor, since, until }}
      />
    </div>
  );
}

async function UnresolvedView({
  sp,
}: {
  readonly sp: PageSearchParams;
}): Promise<React.JSX.Element> {
  let page: UnresolvedPage;
  let errorMessage: string | null = null;
  try {
    page = await fetchUnresolvedPage();
  } catch (e) {
    page = { rows: [], nextCursor: null };
    errorMessage = e instanceof Error ? e.message : String(e);
  }

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", color: INK }}>
      <PageHeader active="unresolved" />
      {sp.ok && <ResolvedBanner tone="ok">{formatUnresolvedOk(sp.ok, sp.id)}</ResolvedBanner>}
      {sp.error && <ResolvedBanner tone="fail">{formatUnresolvedError(sp.error, sp.detail)}</ResolvedBanner>}
      {page.tableUnavailable && <TableUnavailableBanner />}
      {errorMessage && <ErrorBanner message={errorMessage} />}
      <section
        aria-label="Unresolved doctrine"
        style={{
          padding: "16px 18px",
          borderRadius: 14,
          border: `1px solid ${BORDER}`,
          background: CARD_BG,
          color: INK_DIM,
          fontSize: 13,
          lineHeight: 1.6,
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div>
            <strong style={{ color: ACCENT_WARN }}>Unresolved · needs review.</strong>{" "}
            These are attempted security events that never received a matching
            completed or failed audit row within the reconciliation window.
            Each one represents an action that MAY or MAY NOT have completed ·
            never treat an unresolved attempted as confirmed success.
          </div>
          <div style={{ fontSize: 11, color: INK_MUTED, textTransform: "uppercase", letterSpacing: "0.1em", whiteSpace: "nowrap" }}>
            {page.rows.length} on this page
            {page.nextCursor ? " · more available" : ""}
          </div>
        </div>
      </section>
      {page.rows.length === 0 ? (
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
            No unresolved attempted events.
          </div>
          <div style={{ fontSize: 12 }}>
            The reconciler cron runs every 10 minutes and surfaces orphans here.
          </div>
        </div>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 13,
          }}
        >
          <thead>
            <tr style={{ borderBottom: `1px solid ${BORDER}`, color: INK_MUTED }}>
              <Th>Reconciled at</Th>
              <Th>Event</Th>
              <Th>Actor</Th>
              <Th>Attempted at</Th>
              <Th>Resolve</Th>
            </tr>
          </thead>
          <tbody>
            {page.rows.map((r) => (
              <tr
                key={r.reconciliation_id}
                style={{ borderBottom: `1px solid ${BORDER}` }}
              >
                <Td>{formatUtc(r.decided_at)}</Td>
                <Td>{r.event}</Td>
                <Td>{r.actor_account_id ?? r.actor_identity ?? "—"}</Td>
                <Td>{formatUtc(r.occurred_at)}</Td>
                <Td>
                  <form
                    action={manuallyResolveUnresolvedAction}
                    style={{ display: "grid", gap: 6 }}
                  >
                    <input
                      type="hidden"
                      name="attempted_log_id"
                      value={String(r.attempted_log_id)}
                    />
                    <input
                      type="text"
                      name="notes"
                      required
                      maxLength={900}
                      placeholder="Reviewer notes · required"
                      style={{
                        padding: "6px 8px",
                        borderRadius: 4,
                        border: `1px solid ${BORDER}`,
                        background: "#061021",
                        color: INK,
                        fontSize: 12,
                        fontFamily: "monospace",
                      }}
                    />
                    <button
                      type="submit"
                      style={{
                        padding: "6px 10px",
                        borderRadius: 4,
                        border: `1px solid ${ACCENT}`,
                        background: "rgba(0,175,255,0.08)",
                        color: ACCENT,
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                      }}
                    >
                      Mark resolved
                    </button>
                  </form>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function PageHeader({
  active,
}: {
  readonly active: "log" | "unresolved";
}): React.JSX.Element {
  return (
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
        HQ · Security audit
      </div>
      <h1
        style={{
          fontSize: 28,
          fontWeight: 900,
          margin: "6px 0 14px",
          letterSpacing: "0.01em",
        }}
      >
        NEX SECURITY AUDIT
      </h1>
      <nav style={{ display: "flex", gap: 10 }}>
        <TabLink href="/nex-native/hq/security-audit" label="Log" active={active === "log"} />
        <TabLink
          href="/nex-native/hq/security-audit?view=unresolved"
          label="Unresolved"
          active={active === "unresolved"}
        />
        <TabLink
          href="/nex-native/hq/security-audit/retention"
          label="Retention"
          active={false}
        />
        <TabLink
          href="/nex-native/hq/security-audit/deletion-recovery"
          label="Recovery"
          active={false}
        />
      </nav>
    </header>
  );
}

function TabLink({
  href,
  label,
  active,
}: {
  readonly href: string;
  readonly label: string;
  readonly active: boolean;
}): React.JSX.Element {
  return (
    <Link
      href={href}
      style={{
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
      }}
    >
      {label}
    </Link>
  );
}

function FilterBar({
  sp,
}: {
  readonly sp: PageSearchParams;
}): React.JSX.Element {
  return (
    <form
      method="get"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 10,
        marginBottom: 18,
        padding: "14px 16px",
        borderRadius: 12,
        border: `1px solid ${BORDER}`,
        background: CARD_BG,
      }}
    >
      <Field label="Event prefix" name="event" defaultValue={sp.event} />
      <Field
        label="Outcome"
        name="outcome"
        defaultValue={sp.outcome}
        placeholder="attempted | denied | completed | failed"
      />
      <Field label="Actor UUID" name="actor" defaultValue={sp.actor} />
      <Field label="Since (ISO)" name="since" defaultValue={sp.since} />
      <Field label="Until (ISO)" name="until" defaultValue={sp.until} />
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
        <button
          type="submit"
          style={{
            padding: "9px 18px",
            borderRadius: 8,
            border: `1px solid ${ACCENT}`,
            background: "rgba(0,175,255,0.12)",
            color: ACCENT,
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Apply
        </button>
        <Link
          href="/nex-native/hq/security-audit"
          style={{
            padding: "9px 14px",
            borderRadius: 8,
            border: `1px solid ${BORDER}`,
            background: "transparent",
            color: INK_DIM,
            fontSize: 12,
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
  label,
  name,
  defaultValue,
  placeholder,
}: {
  readonly label: string;
  readonly name: string;
  readonly defaultValue?: string;
  readonly placeholder?: string;
}): React.JSX.Element {
  return (
    <label style={{ display: "grid", gap: 4 }}>
      <span style={{ fontSize: 10.5, color: INK_MUTED, textTransform: "uppercase", letterSpacing: "0.12em" }}>
        {label}
      </span>
      <input
        type="text"
        name={name}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder ?? ""}
        style={{
          padding: "8px 10px",
          borderRadius: 6,
          border: `1px solid ${BORDER}`,
          background: "#061021",
          color: INK,
          fontSize: 13,
          fontFamily: "monospace",
        }}
      />
    </label>
  );
}

function AuditTable({
  rows,
}: {
  readonly rows: readonly AuditRow[];
}): React.JSX.Element {
  if (rows.length === 0) {
    return (
      <div style={{ color: INK_MUTED, fontSize: 14, padding: 24 }}>
        No audit events match the current filter.
      </div>
    );
  }
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead>
        <tr style={{ borderBottom: `1px solid ${BORDER}`, color: INK_MUTED }}>
          <Th>Occurred</Th>
          <Th>Event</Th>
          <Th>Outcome</Th>
          <Th>Actor</Th>
          <Th>Target</Th>
          <Th>Metadata</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
            <Td>{formatUtc(r.occurred_at)}</Td>
            <Td>{r.event}</Td>
            <Td>
              <span
                style={{
                  color: outcomeColour(r.outcome),
                  fontWeight: 700,
                  textTransform: "uppercase",
                  fontSize: 11,
                  letterSpacing: "0.08em",
                }}
              >
                {r.outcome}
              </span>
            </Td>
            <Td>{r.actor_account_id ?? r.actor_identity ?? "—"}</Td>
            <Td>
              {r.target_type ? `${r.target_type}:${truncate(r.target_id ?? "", 24)}` : "—"}
            </Td>
            <Td>
              <code style={{ fontSize: 11, color: INK_DIM }}>
                {truncate(r.metadata, 120)}
              </code>
            </Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

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

function Td({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
  return (
    <td style={{ padding: "10px 12px", verticalAlign: "top", color: INK }}>
      {children}
    </td>
  );
}

function Pager({
  page,
  baseQuery,
}: {
  readonly page: AuditPage;
  readonly baseQuery: {
    eventPrefix?: string;
    outcome: OutcomeKind;
    actor?: string;
    since?: string;
    until?: string;
  };
}): React.JSX.Element | null {
  if (!page.nextCursor) return null;
  const params = new URLSearchParams();
  if (baseQuery.eventPrefix) params.set("event", baseQuery.eventPrefix);
  if (baseQuery.outcome) params.set("outcome", baseQuery.outcome);
  if (baseQuery.actor) params.set("actor", baseQuery.actor);
  if (baseQuery.since) params.set("since", baseQuery.since);
  if (baseQuery.until) params.set("until", baseQuery.until);
  params.set("cursor_at", page.nextCursor.occurredAt);
  params.set("cursor_id", String(page.nextCursor.id));
  return (
    <div style={{ marginTop: 18, textAlign: "right" }}>
      <Link
        href={`/nex-native/hq/security-audit?${params.toString()}`}
        style={{
          padding: "9px 18px",
          borderRadius: 8,
          border: `1px solid ${ACCENT}`,
          background: "rgba(0,175,255,0.08)",
          color: ACCENT,
          fontSize: 12,
          fontWeight: 700,
          textDecoration: "none",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}
      >
        Next 50
      </Link>
    </div>
  );
}

function ErrorBanner({ message }: { readonly message: string }): React.JSX.Element {
  return (
    <div
      style={{
        padding: "14px 16px",
        borderRadius: 12,
        border: `1px solid ${ACCENT_FAIL}`,
        background: "rgba(255,91,91,0.06)",
        color: ACCENT_FAIL,
        fontSize: 13,
        marginBottom: 16,
      }}
    >
      <strong>Reader error:</strong> {message}
    </div>
  );
}

// Owner directive 2026-11-08 (round 2) · friendly banner for the
// "schema cache" 42P01 shape that appears when migrations 290-301 are
// not yet applied to the current Supabase project (e.g. production
// ijvqdvsvwtwxzcqmoqit per CLAUDE.md §5). No raw Postgres error.
function TableUnavailableBanner(): React.JSX.Element {
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
        lineHeight: 1.55,
      }}
    >
      <strong>Audit log not deployed in this environment.</strong>
      <br />
      <span style={{ color: INK_DIM }}>
        Migrations 290–301 (Security Programme) apply the{" "}
        <code>nex_security_audit_log</code> table. They are only
        active in the sandbox project · production is sealed until
        owner authorisation. The viewer stays available but has no
        rows to show here.
      </span>
    </div>
  );
}

function ResolvedBanner({
  tone,
  children,
}: {
  readonly tone: "ok" | "fail";
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const color = tone === "ok" ? "#4ADE80" : ACCENT_FAIL;
  return (
    <div
      role="status"
      style={{
        padding: "12px 14px",
        marginBottom: 14,
        borderRadius: 10,
        border: `1px solid ${color}`,
        background: tone === "ok" ? "rgba(74,222,128,0.07)" : "rgba(255,91,91,0.06)",
        color,
        fontSize: 13,
      }}
    >
      {children}
    </div>
  );
}

function formatUnresolvedOk(code: string, id?: string): string {
  if (code === "resolved") return `Marked attempted log #${id ?? "?"} as manually resolved.`;
  if (code === "race") {
    return `Log #${id ?? "?"} was already resolved by another reviewer.`;
  }
  return `OK · ${code}`;
}

function formatUnresolvedError(code: string, detail?: string): string {
  if (code === "unauthenticated") return "Your HQ session has expired · please sign in again.";
  if (code === "forbidden") return "Not authorised · HQ admin required.";
  if (code === "notes_required") return "Reviewer notes are required for manual resolution.";
  if (code === "invalid_id") return "Invalid attempted log id.";
  if (code === "function_not_available") {
    return "Migration 297 not applied · manual resolve function unavailable in this environment.";
  }
  if (code === "resolve_failed") return `Resolve failed: ${detail ?? "unknown"}`;
  return `Error: ${code}`;
}
