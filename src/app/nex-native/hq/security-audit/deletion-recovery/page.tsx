// src/app/nex-native/hq/security-audit/deletion-recovery/page.tsx
//
// NEX Security Audit · HQ account-deletion recovery.
// Owner-authorised 2026-11-08.

import { notFound } from "next/navigation";
import Link from "next/link";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { requireHqAdmin } from "@/lib/nex-native/hq-authorization";
import { fetchHalfStateAccounts } from "@/lib/nex-native/account-deletion-recovery-service";
import { retryAccountDeletionAction } from "./_actions";

export const dynamic = "force-dynamic";

const INK = "#F2F5F8";
const INK_DIM = "#B5C3D6";
const INK_MUTED = "#7D9BC0";
const ACCENT = "#00AFFF";
const ACCENT_WARN = "#F7B500";
const ACCENT_FAIL = "#FF5B5B";
const ACCENT_OK = "#4ADE80";
const BORDER = "rgba(0,175,255,0.14)";
const CARD_BG = "#07152A";

interface Params {
  readonly ok?: string;
  readonly error?: string;
  readonly id?: string;
  readonly detail?: string;
}

export default async function HqDeletionRecoveryPage({
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
  const rows = await fetchHalfStateAccounts();

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
          HQ · Security audit · Deletion recovery
        </div>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 900,
            margin: "6px 0 14px",
            letterSpacing: "0.01em",
          }}
        >
          DELETION RECOVERY
        </h1>
        <nav style={{ display: "flex", gap: 10 }}>
          <Link
            href="/nex-native/hq/security-audit"
            style={tabStyle(false)}
          >
            ← Back to audit log
          </Link>
          <Link
            href="/nex-native/hq/security-audit/retention"
            style={tabStyle(false)}
          >
            Retention
          </Link>
        </nav>
      </header>

      {sp.ok && (
        <Banner tone="ok">{formatOk(sp.ok, sp.id)}</Banner>
      )}
      {sp.error && (
        <Banner tone="fail">{formatError(sp.error, sp.id, sp.detail)}</Banner>
      )}

      <section
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
        <strong style={{ color: ACCENT_WARN }}>Half-state accounts.</strong>{" "}
        These are accounts whose soft-deletion succeeded but whose
        Supabase Auth row was NOT deleted (a transient error during the
        original workflow). Retry runs <code style={{ color: INK_DIM }}>auth.admin.deleteUser</code>{" "}
        + nulls <code style={{ color: INK_DIM }}>supabase_user_id</code> via the sealed
        {" "}<code style={{ color: INK_DIM }}>nex_account_finalize_deletion</code> function. Identity
        data is NEVER restored. Pseudonymisation from migration 294
        (if applied) is NOT reversed.
      </section>

      <h2 style={sectionHeading}>
        Half-state accounts ({rows.length})
      </h2>
      {rows.length === 0 ? (
        <div
          style={{
            color: INK_MUTED,
            fontSize: 14,
            padding: 32,
            textAlign: "center",
            border: `1px dashed ${BORDER}`,
            borderRadius: 14,
          }}
        >
          No half-state accounts. All soft-deleted accounts have had
          their Auth rows cleaned up.
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${BORDER}`, color: INK_MUTED }}>
              <Th>Account id</Th>
              <Th>Deleted at</Th>
              <Th>Reason</Th>
              <Th>Retry</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.account_id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                <Td>
                  <code style={{ fontSize: 11, color: INK_DIM }}>{r.account_id}</code>
                </Td>
                <Td>
                  {r.deleted_at.slice(0, 19).replace("T", " ")}
                </Td>
                <Td style={{ fontSize: 12, color: INK_MUTED }}>{r.deletion_reason ?? "—"}</Td>
                <Td>
                  <form action={retryAccountDeletionAction}>
                    <input type="hidden" name="target_account_id" value={r.account_id} />
                    <button type="submit" style={retryBtnStyle}>
                      Retry auth delete
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

const retryBtnStyle: React.CSSProperties = {
  padding: "7px 12px",
  borderRadius: 6,
  border: `1px solid ${ACCENT_WARN}`,
  background: "rgba(247,181,0,0.08)",
  color: ACCENT_WARN,
  fontSize: 11.5,
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

function formatOk(code: string, id?: string): string {
  if (code === "recovered") return `Recovered account ${id ?? "?"} · Auth row deleted + supabase_user_id cleared.`;
  if (code === "already_complete") return `Account ${id ?? "?"} was already fully reconciled · no action taken.`;
  return `OK · ${code}`;
}

function formatError(code: string, id?: string, detail?: string): string {
  if (code === "unauthenticated") return "Your HQ session has expired · please sign in again.";
  if (code === "forbidden") return "Not authorised · HQ admin required.";
  if (code === "invalid_id") return "Invalid account id.";
  if (code === "target_not_found") return `Account ${id ?? "?"} not found.`;
  if (code === "target_not_soft_deleted") return `Account ${id ?? "?"} is not soft-deleted · nothing to recover.`;
  if (code === "audit_unavailable") return "Audit table unavailable · recovery refused (fail-loud contract).";
  if (code === "audit_completion_failed") return `Account ${id ?? "?"} was recovered but the completion audit row did not persist · the reconciler cron will surface the orphan.`;
  if (code === "auth_delete_failed") return `Auth deletion failed for ${id ?? "?"}: ${detail ?? "unknown"}`;
  if (code === "finalize_failed") return `Finalize step failed for ${id ?? "?"}: ${detail ?? "unknown"}`;
  return `Error: ${code}${detail ? " · " + detail : ""}`;
}
