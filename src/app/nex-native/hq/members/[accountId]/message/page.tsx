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
import { HqMessageComposer } from "./_composer-client";

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

export default async function HqMemberMessagePage({
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
    </div>
  );
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
