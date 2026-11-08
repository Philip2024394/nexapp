// src/app/nex-native/hq/security-audit/retention/page.tsx
//
// NEX Security Audit · HQ retention policy management.
// Owner-authorised 2026-11-08.

import { notFound } from "next/navigation";
import Link from "next/link";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { requireHqAdmin } from "@/lib/nex-native/hq-authorization";
import { fetchRetentionPolicies } from "./_reader";
import {
  deleteRetentionPolicyAction,
  upsertRetentionPolicyAction,
} from "./_actions";

export const dynamic = "force-dynamic";

const INK = "#F2F5F8";
const INK_DIM = "#B5C3D6";
const INK_MUTED = "#7D9BC0";
const ACCENT = "#00AFFF";
const ACCENT_FAIL = "#FF5B5B";
const ACCENT_OK = "#4ADE80";
const BORDER = "rgba(0,175,255,0.14)";
const CARD_BG = "#07152A";

interface Params {
  readonly error?: string;
  readonly ok?: string;
  readonly prefix?: string;
  readonly detail?: string;
}

export default async function HqRetentionPage({
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
  const rows = await fetchRetentionPolicies();

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
          HQ · Security audit · Retention
        </div>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 900,
            margin: "6px 0 14px",
            letterSpacing: "0.01em",
          }}
        >
          RETENTION POLICIES
        </h1>
        <nav style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <Link
            href="/nex-native/hq/security-audit"
            style={{
              fontSize: 12,
              fontWeight: 700,
              padding: "8px 14px",
              borderRadius: 8,
              border: `1px solid ${BORDER}`,
              color: INK_DIM,
              textDecoration: "none",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            ← Back to audit log
          </Link>
        </nav>
      </header>

      {sp.error && <Banner tone="fail">{formatError(sp.error, sp.prefix, sp.detail)}</Banner>}
      {sp.ok && <Banner tone="ok">{formatOk(sp.ok, sp.prefix)}</Banner>}

      <section
        aria-label="Retention policy doctrine"
        style={{
          padding: "16px 18px",
          borderRadius: 14,
          border: `1px solid ${BORDER}`,
          background: CARD_BG,
          color: INK_DIM,
          fontSize: 13,
          lineHeight: 1.6,
          marginBottom: 20,
        }}
      >
        <p style={{ margin: "0 0 8px" }}>
          No automatic retention periods exist. Policies below are explicitly
          authorised by an HQ admin and attributed to that admin&apos;s
          account id. An empty table means every event is retained forever.
        </p>
        <p style={{ margin: "0", color: INK_MUTED, fontSize: 12.5 }}>
          <strong style={{ color: INK_DIM }}>Note ·</strong> deleting a row
          here removes the POLICY only. It does NOT delete any audit log
          rows. Actual pruning runs under a separate owner-authorised cron.
        </p>
      </section>

      <section
        aria-label="Add retention policy"
        style={{
          marginBottom: 24,
          padding: "18px 20px",
          borderRadius: 14,
          border: `1px solid ${BORDER}`,
          background: CARD_BG,
        }}
      >
        <h2 style={{ fontSize: 14, fontWeight: 800, margin: "0 0 10px", color: INK }}>
          Add / update a policy
        </h2>
        <p style={{ margin: "0 0 14px", fontSize: 12, color: INK_MUTED, lineHeight: 1.5 }}>
          Event prefix follows the catalog shape <code style={{ color: INK_DIM }}>namespace.action</code>
          {" or "}<code style={{ color: INK_DIM }}>namespace.action.outcome</code> (e.g.
          {" "}<code style={{ color: INK_DIM }}>security.password_change</code>). Retain days must
          be a positive integer up to 36500 (≈100 years). Saving overwrites
          any existing policy for the same prefix.
        </p>
        <form
          action={upsertRetentionPolicyAction}
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr auto",
            gap: 10,
            alignItems: "end",
          }}
        >
          <label style={{ display: "grid", gap: 4 }}>
            <span style={labelStyle}>Event prefix</span>
            <input
              type="text"
              name="event_prefix"
              required
              pattern="^[a-z][a-z0-9_]{2,63}(\.[a-z][a-z0-9_]{2,63})?$"
              placeholder="e.g. security.password_change"
              aria-describedby="event_prefix_hint"
              style={inputStyle}
            />
            <span id="event_prefix_hint" style={hintStyle}>
              lowercase · dots between segments · each segment 3-64 chars
            </span>
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={labelStyle}>Retain days</span>
            <input
              type="number"
              name="retain_days"
              min={1}
              max={36500}
              required
              placeholder="30"
              aria-describedby="retain_days_hint"
              style={inputStyle}
            />
            <span id="retain_days_hint" style={hintStyle}>1 to 36500</span>
          </label>
          <button type="submit" style={primaryBtnStyle}>
            SAVE
          </button>
        </form>
      </section>

      <h2 style={{ fontSize: 14, fontWeight: 800, margin: "0 0 10px", color: INK_DIM, textTransform: "uppercase", letterSpacing: "0.1em" }}>
        Current policies ({rows.length})
      </h2>
      {rows.length === 0 ? (
        <div style={{ color: INK_MUTED, fontSize: 14, padding: 24 }}>
          No retention policies configured. All events retained forever.
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${BORDER}`, color: INK_MUTED }}>
              <Th>Event prefix</Th>
              <Th>Retain days</Th>
              <Th>Authorised by</Th>
              <Th>Authorised at</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.event_prefix} style={{ borderBottom: `1px solid ${BORDER}` }}>
                <Td>{r.event_prefix}</Td>
                <Td>{r.retain_days}</Td>
                <Td style={{ fontFamily: "monospace", fontSize: 11 }}>{r.authorised_by}</Td>
                <Td>{r.authorised_at.slice(0, 19).replace("T", " ")}</Td>
                <Td>
                  <form action={deleteRetentionPolicyAction}>
                    <input type="hidden" name="event_prefix" value={r.event_prefix} />
                    <button type="submit" style={deleteBtnStyle}>Remove</button>
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

const labelStyle: React.CSSProperties = {
  fontSize: 10.5,
  color: INK_MUTED,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
};

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 6,
  border: `1px solid ${BORDER}`,
  background: "#061021",
  color: INK,
  fontSize: 13,
  fontFamily: "monospace",
};

const hintStyle: React.CSSProperties = {
  fontSize: 10.5,
  color: INK_MUTED,
  letterSpacing: "0.04em",
  marginTop: 2,
};

const primaryBtnStyle: React.CSSProperties = {
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
};

const deleteBtnStyle: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 6,
  border: `1px solid ${ACCENT_FAIL}`,
  background: "rgba(255,91,91,0.06)",
  color: ACCENT_FAIL,
  fontSize: 11,
  fontWeight: 700,
  cursor: "pointer",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
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

function Banner({
  tone,
  children,
}: {
  readonly tone: "ok" | "fail";
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const color = tone === "ok" ? ACCENT_OK : ACCENT_FAIL;
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 10,
        border: `1px solid ${color}`,
        background: tone === "ok" ? "rgba(74,222,128,0.06)" : "rgba(255,91,91,0.06)",
        color,
        fontSize: 13,
        marginBottom: 14,
      }}
    >
      {children}
    </div>
  );
}

function formatError(code: string, prefix?: string, detail?: string): string {
  const safePrefix = prefix ?? "";
  if (code === "unauthenticated") return "You must be signed in.";
  if (code === "forbidden") return "Not authorised · HQ admin required.";
  if (code === "invalid_prefix") return `Invalid event prefix shape: ${safePrefix}`;
  if (code === "invalid_days") return "retain_days must be 1 to 36500.";
  if (code === "function_not_available") {
    return "Migration 297 not yet applied · retention admin functions unavailable.";
  }
  if (code === "upsert_failed") return `Upsert failed: ${detail ?? "unknown"}`;
  if (code === "delete_failed") return `Delete failed: ${detail ?? "unknown"}`;
  return `Error: ${code}`;
}

function formatOk(code: string, prefix?: string): string {
  if (code === "upserted") return `Policy saved for ${prefix}.`;
  if (code === "deleted") return `Policy removed for ${prefix}.`;
  if (code === "no_row") return `No policy existed for ${prefix}.`;
  return `OK · ${code}`;
}
