// src/app/nex-native/community/notices/[id]/page.tsx
//
// Notice detail: full body, update history, confirmations count,
// append-update form (author only), confirm button (non-author only),
// report form (non-author only).

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import {
  countConfirmations,
  getNoticeById,
  listUpdates,
} from "@/lib/nex-native/community/notice-service";
import {
  NEX_COMMUNITY_NOTICE_CATEGORY_LABEL,
  NEX_COMMUNITY_REPORT_REASONS,
} from "@/lib/nex-native/community/types";
import { NexPageHeader } from "../../../_page-header";
import {
  appendUpdateAction,
  confirmNoticeAction,
  reportNoticeAction,
} from "../../_actions";
import { NEX } from "../../_palette";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ e?: string; m?: string }>;
}

export default async function NoticeDetailPage({ params, searchParams }: PageProps) {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const { id } = await params;
  const sp = await searchParams;

  const notice = await getNoticeById(id);
  if (!notice) notFound();

  const [updates, confirmationsCount] = await Promise.all([
    listUpdates(id),
    countConfirmations(id),
  ]);

  const isAuthor = notice.author_account_id === session.account.id;

  const banner =
    sp.m === "confirmed"
      ? { tone: "ok" as const, msg: "You confirmed this notice." }
      : sp.m === "reported"
        ? { tone: "ok" as const, msg: "Thanks — a moderator will review." }
        : sp.e === "own_notice"
          ? { tone: "err" as const, msg: "You can't confirm your own notice." }
          : sp.e === "rate_limited"
            ? { tone: "err" as const, msg: "You're doing that too often — slow down." }
            : sp.e
              ? { tone: "err" as const, msg: "Something went wrong." }
              : null;

  const createdLabel = new Date(notice.created_at).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const statusColor =
    notice.status === "active"
      ? NEX.accent
      : notice.status === "resolved"
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
          <NexPageHeader dataScope="community-notice" />

          <nav style={{ margin: "20px 0 10px" }}>
            <Link
              href="/nex-native/community/feed"
              style={{ color: NEX.textMuted, textDecoration: "none", fontSize: 12.5 }}
            >
              ← Back to feed
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
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
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
                {notice.status}
              </span>
              <span style={{ fontSize: 12, color: NEX.textMuted }}>
                {NEX_COMMUNITY_NOTICE_CATEGORY_LABEL[notice.category]}
              </span>
              <span style={{ fontSize: 12, color: NEX.textMuted, marginLeft: "auto" }}>
                {createdLabel}
              </span>
            </div>
            <h1 style={{ margin: "10px 0 6px", fontSize: 20, fontWeight: 700 }}>
              {notice.title}
            </h1>
            {notice.affected_area_text && (
              <div style={{ fontSize: 13, color: NEX.cyan, marginBottom: 6 }}>
                {notice.affected_area_text}
              </div>
            )}
            {notice.body && (
              <p style={{ margin: "8px 0 0", fontSize: 14.5, color: NEX.textSecondary, lineHeight: 1.55 }}>
                {notice.body}
              </p>
            )}
            <div style={{ marginTop: 14, fontSize: 12, color: NEX.textMuted }}>
              {confirmationsCount} {confirmationsCount === 1 ? "person has" : "people have"}{" "}
              confirmed this notice
            </div>
          </article>

          {/* Author's "append update" form, OR non-author "confirm" button */}
          <section style={{ marginTop: 20 }}>
            {isAuthor && notice.status !== "removed" ? (
              <form
                action={appendUpdateAction}
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
                <input type="hidden" name="notice_id" value={notice.id} />
                <label style={{ fontSize: 11, letterSpacing: "0.14em", color: NEX.textMuted, fontWeight: 700, textTransform: "uppercase" }}>
                  Post an update
                </label>
                <textarea
                  name="update_text"
                  required
                  maxLength={1000}
                  rows={3}
                  placeholder="What's new?"
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
                {notice.status === "active" && (
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: NEX.textSecondary }}>
                    <input type="checkbox" name="mark_resolved" style={{ accentColor: NEX.cyan }} />
                    Mark this notice as resolved
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
            ) : (
              !isAuthor &&
              notice.status === "active" && (
                <form action={confirmNoticeAction}>
                  <input type="hidden" name="notice_id" value={notice.id} />
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
                    I'm affected too — confirm
                  </button>
                </form>
              )
            )}
          </section>

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

          {/* Report form — not for author */}
          {!isAuthor && notice.status !== "removed" && (
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
                Report this notice
              </summary>
              <form
                action={reportNoticeAction}
                style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}
              >
                <input type="hidden" name="notice_id" value={notice.id} />
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
                <p style={{ fontSize: 11, color: NEX.textMuted, lineHeight: 1.6 }}>
                  A moderator will review your report. If a notice is removed, the author can appeal.
                </p>
              </form>
            </details>
          )}
        </div>
      </main>
    </>
  );
}
