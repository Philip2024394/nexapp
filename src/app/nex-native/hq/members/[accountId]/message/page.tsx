// src/app/nex-native/hq/members/[accountId]/message/page.tsx
//
// NEX HQ · "Nex" direct-message surface · lets an HQ admin send a
// message to any NEX member via the sealed migration-301 pipeline.
// Owner-sealed 2026-11-08.

import { notFound } from "next/navigation";
import Link from "next/link";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { requireHqAdmin } from "@/lib/nex-native/hq-authorization";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { fetchHqChannelMessages } from "@/lib/nex-native/hq-direct-channel/hq-direct-service";
import {
  hasActiveShopGrant,
  listActiveThemeGrants,
  listGrantHistory,
} from "@/lib/nex-native/admin-grant/admin-grant-service";
import { HqMessageComposer } from "./_composer-client";
import {
  grantShopMonthsAction,
  grantFreeThemeAction,
} from "../_grant-actions";

export const dynamic = "force-dynamic";

const INK = "#F2F5F8";
const INK_DIM = "#B5C3D6";
const INK_MUTED = "#7D9BC0";
const ACCENT = "#00AFFF";
const ACCENT_OK = "#4ADE80";
const BORDER = "rgba(0,175,255,0.14)";
const CARD_BG = "#07152A";

const UUID_SHAPE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Params {
  readonly accountId: string;
}

interface Search {
  readonly grant_ok?: string;
  readonly grant_error?: string;
}

export default async function HqMemberMessagePage({
  params,
  searchParams,
}: {
  readonly params: Promise<Params>;
  readonly searchParams?: Promise<Search>;
}): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  if (!session) notFound();
  const authorised = await requireHqAdmin(session.account.id)
    .then(() => true)
    .catch(() => false);
  if (!authorised) notFound();

  const { accountId } = await params;
  if (!UUID_SHAPE.test(accountId)) notFound();

  // Look up the target member (service-role · bypasses RLS · HQ-gated)
  const target = await nexSupabaseAdmin
    .from("nex_account")
    .select("id, display_name, nex_handle, created_at, deleted_at, tier")
    .eq("id", accountId)
    .maybeSingle();
  if (target.error || !target.data) notFound();
  const row = target.data as {
    id: string;
    display_name: string | null;
    nex_handle: string | null;
    created_at: string;
    deleted_at: string | null;
    tier: string | null;
  };

  let messages: readonly Awaited<ReturnType<typeof fetchHqChannelMessages>>[number][] = [];
  let historyError: string | null = null;
  try {
    messages = await fetchHqChannelMessages(accountId, 50);
  } catch (e) {
    historyError = e instanceof Error ? e.message : String(e);
  }

  const [shopActive, themeGrants, grantHistory] = await Promise.all([
    hasActiveShopGrant(accountId),
    listActiveThemeGrants(accountId),
    listGrantHistory(accountId, 25),
  ]);

  const sp = (await searchParams) ?? {};

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", color: INK }}>
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
          HQ · Members · Nex direct message
        </div>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 900,
            margin: "6px 0 10px",
            letterSpacing: "0.01em",
          }}
        >
          Message {row.display_name ?? "member"}
        </h1>
        <nav style={{ display: "flex", gap: 10 }}>
          <Link
            href="/nex-native/hq/members"
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
            ← Members
          </Link>
        </nav>
      </header>

      <section
        aria-label="Member summary"
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
        <Field label="Display name" value={row.display_name ?? "—"} />
        <Field label="NEX handle" value={row.nex_handle ?? "—"} />
        <Field label="Account id" value={row.id} mono />
        <Field
          label="Joined"
          value={row.created_at.slice(0, 10)}
        />
        <Field
          label="Tier"
          value={row.tier && row.tier !== "gratis" ? "membership" : "free"}
        />
        <Field
          label="Status"
          value={row.deleted_at ? "DELETED" : "ACTIVE"}
          tone={row.deleted_at ? "warn" : "ok"}
        />
      </section>

      {row.deleted_at && (
        <div
          role="status"
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            border: "1px solid #F7B500",
            background: "rgba(247,181,0,0.08)",
            color: "#F7B500",
            fontSize: 13,
            marginBottom: 14,
          }}
        >
          This account is soft-deleted. Sending a Nex message to a deleted
          account is intentionally refused by the direct-channel endpoint
          (the member can no longer sign in). You can still view the
          historical thread below for reference.
        </div>
      )}

      <section style={{ marginBottom: 16 }}>
        <h2
          style={{
            fontSize: 12,
            color: INK_MUTED,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            margin: "0 0 10px",
          }}
        >
          Recent Nex thread ({messages.length})
        </h2>
        {historyError && (
          <div style={{ color: "#FF5B5B", fontSize: 12, marginBottom: 8 }}>
            Could not load thread · {historyError.slice(0, 160)}
          </div>
        )}
        {messages.length === 0 ? (
          <div
            style={{
              color: INK_MUTED,
              fontSize: 13,
              padding: 18,
              textAlign: "center",
              border: `1px dashed ${BORDER}`,
              borderRadius: 12,
            }}
          >
            No prior Nex messages to this member.
          </div>
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
            {messages.map((m) => (
              <li
                key={m.id}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: `1px solid ${BORDER}`,
                  background: CARD_BG,
                  fontSize: 13,
                }}
              >
                <div
                  style={{
                    fontSize: 10.5,
                    color: INK_MUTED,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    marginBottom: 4,
                  }}
                >
                  {new Date(m.sent_at).toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "Z")}
                </div>
                <div style={{ color: INK, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {m.body}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <HqMessageComposer targetAccountId={row.id} disabled={!!row.deleted_at} />

      <GrantPanel
        accountId={row.id}
        disabled={!!row.deleted_at}
        shopActive={shopActive}
        themeGrants={themeGrants}
        history={grantHistory}
        ok={sp.grant_ok ?? null}
        error={sp.grant_error ?? null}
      />
    </div>
  );
}

const ACCENT_EMERALD = "#16D66B";
const ACCENT_WARN = "#F7B500";
const ACCENT_FAIL = "#FF5B5B";
const BORDER_EMERALD = "rgba(22,214,107,0.18)";

function GrantPanel({
  accountId,
  disabled,
  shopActive,
  themeGrants,
  history,
  ok,
  error,
}: {
  readonly accountId: string;
  readonly disabled: boolean;
  readonly shopActive: boolean;
  readonly themeGrants: readonly string[];
  readonly history: readonly Awaited<ReturnType<typeof listGrantHistory>>[number][];
  readonly ok: string | null;
  readonly error: string | null;
}): React.JSX.Element {
  return (
    <section
      aria-label="Admin grant panel"
      style={{
        marginTop: 24,
        padding: "16px 18px",
        borderRadius: 14,
        border: `1px solid ${BORDER_EMERALD}`,
        background: "rgba(22,214,107,0.04)",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          color: INK_MUTED,
          textTransform: "uppercase",
          letterSpacing: "0.14em",
          marginBottom: 2,
        }}
      >
        HQ · Admin grants
      </div>
      <h2
        style={{
          fontSize: 17,
          fontWeight: 900,
          margin: "2px 0 6px",
          color: ACCENT_EMERALD,
        }}
      >
        Activate shop or unlock free theme
      </h2>
      <p style={{ fontSize: 12.5, color: INK_DIM, lineHeight: 1.55, margin: "0 0 14px" }}>
        Use these controls when a member has paid you directly or has a
        payment issue. Each grant sends the member an automatic chat
        bubble from Nex with a link to the right page.
      </p>

      {ok && <GrantBanner tone="ok">{formatGrantOk(ok)}</GrantBanner>}
      {error && (
        <GrantBanner tone="fail">{formatGrantError(error)}</GrantBanner>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 16,
          marginBottom: 14,
        }}
      >
        {/* Shop grant */}
        <form
          action={grantShopMonthsAction}
          style={{
            padding: "14px 14px",
            borderRadius: 10,
            border: `1px solid ${BORDER_EMERALD}`,
            background: CARD_BG,
            display: "grid",
            gap: 8,
          }}
        >
          <input type="hidden" name="account_id" value={accountId} />
          <div
            style={{
              fontSize: 10.5,
              color: INK_MUTED,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
            }}
          >
            Shop · activate paid membership
          </div>
          <div style={{ fontSize: 13, color: INK, fontWeight: 700 }}>
            Status ·{" "}
            <span style={{ color: shopActive ? ACCENT_EMERALD : INK_DIM }}>
              {shopActive ? "ACTIVE GRANT ON FILE" : "no active admin grant"}
            </span>
          </div>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 11, color: INK_MUTED }}>Months</span>
            <select
              name="months"
              defaultValue="1"
              disabled={disabled}
              style={{
                padding: "8px 10px",
                borderRadius: 6,
                border: `1px solid ${BORDER_EMERALD}`,
                background: "#061021",
                color: INK,
                fontSize: 13,
              }}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                <option key={m} value={m}>
                  {m} {m === 1 ? "month" : "months"}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 11, color: INK_MUTED }}>
              Note (optional)
            </span>
            <input
              type="text"
              name="note"
              maxLength={400}
              disabled={disabled}
              placeholder="e.g. Paid via bank transfer 2026-11-08"
              style={{
                padding: "8px 10px",
                borderRadius: 6,
                border: `1px solid ${BORDER_EMERALD}`,
                background: "#061021",
                color: INK,
                fontSize: 13,
                fontFamily: "monospace",
              }}
            />
          </label>
          <button
            type="submit"
            disabled={disabled}
            style={{
              marginTop: 4,
              padding: "9px 14px",
              borderRadius: 7,
              border: `1px solid ${ACCENT_EMERALD}`,
              background: "rgba(22,214,107,0.12)",
              color: ACCENT_EMERALD,
              fontSize: 12,
              fontWeight: 800,
              cursor: disabled ? "not-allowed" : "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            Activate shop
          </button>
        </form>

        {/* Theme unlock */}
        <form
          action={grantFreeThemeAction}
          style={{
            padding: "14px 14px",
            borderRadius: 10,
            border: `1px solid ${BORDER_EMERALD}`,
            background: CARD_BG,
            display: "grid",
            gap: 8,
          }}
        >
          <input type="hidden" name="account_id" value={accountId} />
          <div
            style={{
              fontSize: 10.5,
              color: INK_MUTED,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
            }}
          >
            Chat themes · unlock 1 free theme
          </div>
          <div style={{ fontSize: 13, color: INK, fontWeight: 700 }}>
            Themes unlocked · {themeGrants.length}
          </div>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 11, color: INK_MUTED }}>
              Theme id · slug
            </span>
            <input
              type="text"
              name="theme_id"
              maxLength={128}
              pattern="[a-zA-Z0-9_-]+"
              required
              disabled={disabled}
              placeholder="e.g. emerald-cinematic"
              style={{
                padding: "8px 10px",
                borderRadius: 6,
                border: `1px solid ${BORDER_EMERALD}`,
                background: "#061021",
                color: INK,
                fontSize: 13,
                fontFamily: "monospace",
              }}
            />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 11, color: INK_MUTED }}>
              Note (optional)
            </span>
            <input
              type="text"
              name="note"
              maxLength={400}
              disabled={disabled}
              placeholder="e.g. Comp · support thread 2026-11-08"
              style={{
                padding: "8px 10px",
                borderRadius: 6,
                border: `1px solid ${BORDER_EMERALD}`,
                background: "#061021",
                color: INK,
                fontSize: 13,
                fontFamily: "monospace",
              }}
            />
          </label>
          <button
            type="submit"
            disabled={disabled}
            style={{
              marginTop: 4,
              padding: "9px 14px",
              borderRadius: 7,
              border: `1px solid ${ACCENT_EMERALD}`,
              background: "rgba(22,214,107,0.12)",
              color: ACCENT_EMERALD,
              fontSize: 12,
              fontWeight: 800,
              cursor: disabled ? "not-allowed" : "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            Unlock theme
          </button>
        </form>
      </div>

      <GrantHistory rows={history} />
    </section>
  );
}

function GrantHistory({
  rows,
}: {
  readonly rows: readonly Awaited<ReturnType<typeof listGrantHistory>>[number][];
}): React.JSX.Element {
  if (rows.length === 0) {
    return (
      <div
        style={{
          fontSize: 12.5,
          color: INK_MUTED,
          padding: 10,
          textAlign: "center",
          border: `1px dashed ${BORDER_EMERALD}`,
          borderRadius: 8,
        }}
      >
        No prior admin grants for this member.
      </div>
    );
  }
  return (
    <div>
      <div
        style={{
          fontSize: 10.5,
          color: INK_MUTED,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          marginBottom: 6,
        }}
      >
        Grant history
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 4 }}>
        {rows.map((r) => {
          const expired =
            r.kind === "shop" && r.expires_at
              ? new Date(r.expires_at).getTime() < Date.now()
              : false;
          const state = r.revoked_at
            ? "revoked"
            : expired
              ? "expired"
              : "active";
          const colour =
            state === "active"
              ? ACCENT_EMERALD
              : state === "revoked"
                ? ACCENT_FAIL
                : ACCENT_WARN;
          return (
            <li
              key={r.id}
              style={{
                padding: "8px 10px",
                borderRadius: 7,
                border: `1px solid ${BORDER_EMERALD}`,
                background: "transparent",
                display: "flex",
                gap: 10,
                fontSize: 12,
                color: INK_DIM,
                alignItems: "center",
              }}
            >
              <span
                style={{
                  color: colour,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  fontSize: 10,
                  minWidth: 56,
                }}
              >
                {state}
              </span>
              <span style={{ color: INK, fontWeight: 700, minWidth: 48 }}>
                {r.kind}
              </span>
              <span style={{ flex: 1 }}>
                {r.kind === "shop"
                  ? `${r.shop_months} month${r.shop_months === 1 ? "" : "s"} · until ${r.expires_at?.slice(0, 10) ?? "?"}`
                  : `${r.theme_id ?? "theme"}`}
                {r.note ? ` · ${r.note.slice(0, 80)}` : ""}
              </span>
              <span style={{ color: INK_MUTED, fontSize: 11 }}>
                {r.granted_at.slice(0, 10)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function GrantBanner({
  tone,
  children,
}: {
  readonly tone: "ok" | "fail";
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const col = tone === "ok" ? ACCENT_EMERALD : ACCENT_FAIL;
  return (
    <div
      role="status"
      style={{
        padding: "10px 12px",
        marginBottom: 12,
        borderRadius: 8,
        border: `1px solid ${col}`,
        background:
          tone === "ok" ? "rgba(22,214,107,0.07)" : "rgba(255,91,91,0.06)",
        color: col,
        fontSize: 12.5,
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  );
}

function formatGrantOk(code: string): string {
  if (code.startsWith("shop_")) {
    const n = code.slice(5);
    return `Shop membership activated for ${n} month${n === "1" ? "" : "s"}. Chat bubble sent.`;
  }
  if (code === "theme") return "Free chat theme unlocked. Chat bubble sent.";
  return `Grant recorded · ${code}`;
}

function formatGrantError(code: string): string {
  if (code === "table_not_available") {
    return "Migration 302 not applied in this environment · grants disabled until the admin-grant table exists (sandbox-only today).";
  }
  if (code === "forbidden") return "Not authorised · HQ admin required.";
  if (code === "invalid_months") return "Months must be an integer 1..12.";
  if (code === "invalid_theme_id") return "Theme id must be a short slug (a-z, 0-9, _, -).";
  if (code === "invalid_account") return "Invalid target account.";
  if (code === "write_failed") return "The grant could not be written to the database.";
  if (code === "member_not_found") {
    return "Grant recorded but the chat bubble could not be delivered (member may be deleted). The entitlement still applies.";
  }
  return `Grant error · ${code}`;
}

function Field({
  label,
  value,
  mono,
  tone,
}: {
  readonly label: string;
  readonly value: string;
  readonly mono?: boolean;
  readonly tone?: "ok" | "warn";
}): React.JSX.Element {
  const col = tone === "ok" ? ACCENT_OK : tone === "warn" ? "#F7B500" : INK;
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
          color: col,
          fontFamily: mono ? "monospace" : "inherit",
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
}
