// src/app/nex-native/community/lost-found/[id]/page.tsx
//
// Lost & Found card detail. Shows:
//   · Primary photo (if uploaded)
//   · Lost/Found + subject chips, approximate area, status
//   · Author-only append-update form (with mark-resolved checkbox)
//   · Non-author "Message about this card" + Confirm + Report
//
// Phase 2A: contact mode is sealed to nex_chat · the "Message" button
// opens the existing peer-chat deep-link to the author's handle.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { getLostFoundCardById } from "@/lib/nex-native/community/lost-found-service";
import {
  NEX_COMMUNITY_LOST_FOUND_SUBJECT_LABEL,
  NEX_COMMUNITY_PHOTO_BUCKET,
  NEX_COMMUNITY_REPORT_REASONS,
} from "@/lib/nex-native/community/types";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { NexPageHeader } from "../../../_page-header";
import { NEX } from "../../_palette";
import {
  appendLostFoundUpdateAction,
  confirmLostFoundAction,
  reportLostFoundAction,
} from "../_actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ e?: string; m?: string }>;
}

export default async function LostFoundDetailPage({ params, searchParams }: PageProps) {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const { id } = await params;
  const sp = await searchParams;
  const entry = await getLostFoundCardById(id);
  if (!entry) notFound();

  // Load author's NEX handle for the "Message about this card" button.
  const { data: authorRow } = await nexSupabaseAdmin
    .from("nex_account")
    .select("nex_handle, display_name")
    .eq("id", entry.card.author_account_id)
    .maybeSingle();
  const authorHandle = (authorRow as { nex_handle?: string | null } | null)?.nex_handle ?? null;
  const authorName =
    (authorRow as { display_name?: string | null } | null)?.display_name ?? "the author";

  // Load updates (card_update table, same pattern as safety notice updates).
  const { data: updateRows } = await nexSupabaseAdmin
    .from("nex_community_card_update")
    .select("*")
    .eq("card_id", id)
    .order("created_at", { ascending: false })
    .limit(50);
  const updates = (updateRows as Array<{
    id: string;
    created_at: string;
    update_text: string;
    status_change: string | null;
  }>) ?? [];

  const isAuthor = entry.card.author_account_id === session.account.id;
  const primaryPhoto = entry.photos[0] ?? null;
  const supabaseUrl =
    process.env.NEX_SUPABASE_URL ?? process.env.NEXT_PUBLIC_NEX_SUPABASE_URL ?? "";
  const photoUrl = primaryPhoto
    ? `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${NEX_COMMUNITY_PHOTO_BUCKET}/${primaryPhoto.storage_path}`
    : null;
  const banner =
    sp.m === "confirmed"
      ? { tone: "ok" as const, msg: "Thanks — your confirmation was recorded." }
      : sp.m === "reported"
        ? { tone: "ok" as const, msg: "Thanks — a moderator will review." }
        : sp.e === "own_card"
          ? { tone: "err" as const, msg: "You can't confirm your own card." }
          : sp.e === "rate_limited"
            ? { tone: "err" as const, msg: "You're doing that too often — slow down." }
            : sp.e
              ? { tone: "err" as const, msg: "Something went wrong." }
              : null;

  const createdLabel = new Date(entry.card.created_at).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const typeColor =
    entry.detail.lost_or_found === "lost" ? NEX.accent : NEX.cyan;
  const statusColor =
    entry.card.status === "active"
      ? typeColor
      : entry.card.status === "resolved"
        ? NEX.cyan
        : NEX.textMuted;

  return (
    <>
      <style>{`html,body{background:${NEX.bg} !important;}`}</style>
      <main
        style={{
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.textPrimary,
          padding: "calc(env(safe-area-inset-top,0) + 16px) 20px 48px",
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <NexPageHeader dataScope="lost-found-detail" />

          <nav style={{ margin: "20px 0 10px" }}>
            <Link
              href="/nex-native/community/lost-found"
              style={{ color: NEX.textMuted, textDecoration: "none", fontSize: 12.5 }}
            >
              ← Back to Lost & Found
            </Link>
          </nav>

          {banner && (
            <div
              role="status"
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                marginBottom: 14,
                background: banner.tone === "ok" ? NEX.cyanFaint : "rgba(255,77,94,0.1)",
                border: `1px solid ${banner.tone === "ok" ? NEX.cyan : NEX.danger}44`,
                color: banner.tone === "ok" ? NEX.cyan : NEX.danger,
                fontSize: 13,
              }}
            >
              {banner.msg}
            </div>
          )}

          <article
            style={{
              padding: "18px 20px",
              borderRadius: 16,
              background: NEX.panel,
              border: `1px solid ${NEX.borderSoft}`,
            }}
          >
            {photoUrl && (
              <img
                src={photoUrl}
                alt=""
                style={{
                  width: "100%",
                  height: "auto",
                  maxHeight: 360,
                  borderRadius: 12,
                  objectFit: "cover",
                  marginBottom: 14,
                  border: `1px solid ${NEX.borderSoft}`,
                }}
              />
            )}
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <span
                style={{
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: `${typeColor}22`,
                  color: typeColor,
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                }}
              >
                {entry.detail.lost_or_found}
              </span>
              <span
                style={{
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: `${statusColor}22`,
                  color: statusColor,
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                }}
              >
                {entry.card.status}
              </span>
              <span style={{ fontSize: 12, color: NEX.textMuted }}>
                {NEX_COMMUNITY_LOST_FOUND_SUBJECT_LABEL[entry.detail.subject_kind]}
              </span>
              <span style={{ fontSize: 12, color: NEX.textMuted, marginLeft: "auto" }}>
                {createdLabel}
              </span>
            </div>
            <h1 style={{ margin: "10px 0 6px", fontSize: 20, fontWeight: 700 }}>
              {entry.card.title}
            </h1>
            {entry.detail.approximate_area_text && (
              <div style={{ fontSize: 13, color: NEX.cyan, marginBottom: 6 }}>
                {entry.detail.approximate_area_text}
              </div>
            )}
            {entry.card.body && (
              <p style={{ margin: "8px 0 0", fontSize: 14.5, color: NEX.textSecondary, lineHeight: 1.55 }}>
                {entry.card.body}
              </p>
            )}
            <div style={{ marginTop: 14, fontSize: 12, color: NEX.textMuted }}>
              {entry.confirmations_count}{" "}
              {entry.confirmations_count === 1 ? "neighbour has" : "neighbours have"}{" "}
              confirmed · author: {authorName}
            </div>
          </article>

          {/* Message about this card · reuses existing peer-chat deep-link */}
          {!isAuthor && entry.card.status !== "removed" && (
            <section style={{ marginTop: 20 }}>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 10,
                  padding: "14px 16px",
                  borderRadius: 14,
                  background: NEX.panel,
                  border: `1px solid ${NEX.borderSoft}`,
                }}
              >
                {authorHandle ? (
                  <Link
                    href={`/chat/peer/${entry.card.author_account_id}`}
                    style={{
                      padding: "10px 18px",
                      borderRadius: 999,
                      background: NEX.accent,
                      color: "#0a0608",
                      textDecoration: "none",
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    Message about this card
                  </Link>
                ) : (
                  <span style={{ color: NEX.textMuted, fontSize: 13 }}>
                    Direct message not available for this author.
                  </span>
                )}
                {entry.card.status === "active" && (
                  <form action={confirmLostFoundAction}>
                    <input type="hidden" name="card_id" value={entry.card.id} />
                    <button
                      type="submit"
                      style={{
                        padding: "10px 18px",
                        borderRadius: 999,
                        background: NEX.cyanFaint,
                        color: NEX.cyan,
                        border: `1px solid ${NEX.cyan}44`,
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {entry.detail.lost_or_found === "lost"
                        ? "I may have seen this"
                        : "I think this is mine"}
                    </button>
                  </form>
                )}
              </div>
            </section>
          )}

          {/* Author's append-update form */}
          {isAuthor && entry.card.status !== "removed" && (
            <section style={{ marginTop: 20 }}>
              <form
                action={appendLostFoundUpdateAction}
                style={{
                  padding: "14px 16px",
                  borderRadius: 14,
                  background: NEX.panel,
                  border: `1px solid ${NEX.borderSoft}`,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <input type="hidden" name="card_id" value={entry.card.id} />
                <label style={{ fontSize: 11, letterSpacing: "0.14em", color: NEX.textMuted, fontWeight: 700, textTransform: "uppercase" }}>
                  Post an update
                </label>
                <textarea
                  name="update_text"
                  required
                  maxLength={1000}
                  rows={3}
                  placeholder="What's new? e.g. 'Found!' or 'Still looking as of today'."
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    background: NEX.panelSolid,
                    border: `1px solid ${NEX.borderSoft}`,
                    color: NEX.textPrimary,
                    fontSize: 14,
                    fontFamily: "inherit",
                    outline: "none",
                    resize: "vertical",
                  }}
                />
                {entry.card.status === "active" && (
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: NEX.textSecondary }}>
                    <input type="checkbox" name="mark_resolved" style={{ accentColor: NEX.cyan }} />
                    Mark this card as resolved
                  </label>
                )}
                <button
                  type="submit"
                  style={{
                    alignSelf: "flex-start",
                    padding: "10px 18px",
                    borderRadius: 999,
                    background: NEX.accent,
                    color: "#0a0608",
                    fontSize: 13,
                    fontWeight: 700,
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Post update
                </button>
              </form>
            </section>
          )}

          {/* Update history */}
          {updates.length > 0 && (
            <section style={{ marginTop: 24 }}>
              <div style={{ fontSize: 11, letterSpacing: "0.14em", color: NEX.textMuted, fontWeight: 700, textTransform: "uppercase", marginBottom: 10 }}>
                Updates
              </div>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                {updates.map((u) => (
                  <li
                    key={u.id}
                    style={{
                      padding: "12px 14px",
                      borderRadius: 12,
                      background: NEX.panel,
                      border: `1px solid ${NEX.borderSoft}`,
                    }}
                  >
                    <div style={{ fontSize: 11.5, color: NEX.textMuted }}>
                      {new Date(u.created_at).toLocaleString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {u.status_change && (
                        <span style={{ marginLeft: 8, color: NEX.cyan, fontWeight: 700 }}>
                          · status → {u.status_change}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 14, color: NEX.textPrimary, marginTop: 4 }}>
                      {u.update_text}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Report form · non-author */}
          {!isAuthor && entry.card.status !== "removed" && (
            <details
              style={{
                marginTop: 24,
                padding: "12px 14px",
                borderRadius: 12,
                background: NEX.panel,
                border: `1px solid ${NEX.borderSoft}`,
              }}
            >
              <summary style={{ cursor: "pointer", fontSize: 13, color: NEX.textMuted }}>
                Report this card
              </summary>
              <form
                action={reportLostFoundAction}
                style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}
              >
                <input type="hidden" name="card_id" value={entry.card.id} />
                <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
                  <span style={{ color: NEX.textMuted, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700 }}>
                    Reason
                  </span>
                  <select
                    name="reason"
                    required
                    defaultValue="spam"
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      background: NEX.panelSolid,
                      border: `1px solid ${NEX.borderSoft}`,
                      color: NEX.textPrimary,
                      fontSize: 13,
                      fontFamily: "inherit",
                    }}
                  >
                    {NEX_COMMUNITY_REPORT_REASONS.map((r) => (
                      <option key={r} value={r}>
                        {r.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
                  <span style={{ color: NEX.textMuted, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700 }}>
                    Note (optional)
                  </span>
                  <textarea
                    name="note"
                    rows={2}
                    maxLength={500}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      background: NEX.panelSolid,
                      border: `1px solid ${NEX.borderSoft}`,
                      color: NEX.textPrimary,
                      fontSize: 13,
                      fontFamily: "inherit",
                      resize: "vertical",
                    }}
                  />
                </label>
                <button
                  type="submit"
                  style={{
                    alignSelf: "flex-start",
                    padding: "9px 16px",
                    borderRadius: 999,
                    background: NEX.danger,
                    color: "#fff",
                    fontSize: 12.5,
                    fontWeight: 700,
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Submit report
                </button>
              </form>
            </details>
          )}
        </div>
      </main>
    </>
  );
}
