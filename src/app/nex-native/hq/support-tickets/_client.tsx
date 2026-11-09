"use client";

// src/app/nex-native/hq/support-tickets/_client.tsx
//
// NEX HQ Support Tickets · client · owner-sealed 2026-11-10.
//
// Two-pane layout:
//   · Left · ticket list (scrollable) · click to select
//   · Right · detail · message log + reply composer + mute toggle
//
// Admin actions are POSTed through the sealed server actions · no
// direct DB access from the browser.

import * as React from "react";
import {
  adminGetTicketAction,
  adminListTicketsAction,
  adminPostReplyAction,
  adminSetMutedAction,
  type AdminTicketDetail,
} from "@/lib/nex-native/support/actions";
import type {
  SupportMessage,
  SupportTicket,
} from "@/lib/nex-native/support/ticket-service";

const PALETTE = {
  cardBg: "rgba(10, 28, 20, 0.72)",
  cardBorder: "rgba(198, 161, 91, 0.35)",
  cardBorderStrong: "rgba(198, 161, 91, 0.6)",
  text: "#F2F5F8",
  textMuted: "#B5C3D6",
  textDim: "#7D9BC0",
  accent: "#C6A15B",
  accentDark: "#8B6A32",
  rowBg: "rgba(0,0,0,0.3)",
  rowActive: "rgba(198, 161, 91, 0.18)",
  user: "#C6A15B",
  admin: "#3C8CFF",
  auto: "#7D9BC0",
  danger: "#8B0000",
  success: "#16D66B",
};

function formatRelTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const diffMs = Date.now() - d.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  } catch {
    return "";
  }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function HqSupportTicketsClient({
  initialTickets,
}: {
  readonly initialTickets: ReadonlyArray<SupportTicket>;
}): React.ReactElement {
  const [tickets, setTickets] = React.useState<ReadonlyArray<SupportTicket>>(initialTickets);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<AdminTicketDetail | null>(null);
  const [reply, setReply] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Refresh the ticket list every 20s.
  React.useEffect(() => {
    const t = window.setInterval(async () => {
      if (document.hidden) return;
      const res = await adminListTicketsAction();
      if (res.ok) setTickets(res.value);
    }, 20_000);
    return () => window.clearInterval(t);
  }, []);

  const openTicket = React.useCallback(async (ticketId: string) => {
    setSelectedId(ticketId);
    setDetail(null);
    setError(null);
    const res = await adminGetTicketAction({ ticketId });
    if (res.ok) setDetail(res.value);
    else setError(reasonLabel(res.reason));
  }, []);

  const onReply = React.useCallback(async () => {
    if (!selectedId) return;
    const body = reply.trim();
    if (body.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await adminPostReplyAction({ ticketId: selectedId, body });
      if (res.ok) {
        setDetail(res.value);
        setReply("");
        // Patch the row in the list with the new updatedAt.
        setTickets((prev) =>
          prev.map((t) => (t.ticketId === selectedId ? res.value.ticket : t)),
        );
      } else {
        setError(reasonLabel(res.reason));
      }
    } finally {
      setBusy(false);
    }
  }, [selectedId, reply, busy]);

  const onToggleMute = React.useCallback(async () => {
    if (!selectedId || !detail) return;
    setBusy(true);
    setError(null);
    try {
      const res = await adminSetMutedAction({
        ticketId: selectedId,
        muted: !detail.ticket.muted,
      });
      if (res.ok) {
        setDetail((prev) => (prev ? { ...prev, ticket: res.value } : prev));
        setTickets((prev) =>
          prev.map((t) => (t.ticketId === selectedId ? res.value : t)),
        );
      } else {
        setError(reasonLabel(res.reason));
      }
    } finally {
      setBusy(false);
    }
  }, [selectedId, detail]);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "280px 1fr",
        gap: 14,
        minHeight: 480,
      }}
    >
      {/* Left · ticket list */}
      <aside
        data-nex-hq-tickets-list
        style={{
          background: PALETTE.cardBg,
          border: `1.5px solid ${PALETTE.cardBorder}`,
          borderRadius: 14,
          padding: 10,
          display: "flex",
          flexDirection: "column",
          gap: 6,
          overflowY: "auto",
          maxHeight: "72vh",
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: PALETTE.accent,
            padding: "4px 6px",
          }}
        >
          Queue ({tickets.length})
        </div>
        {tickets.length === 0 ? (
          <div
            style={{
              padding: 16,
              fontSize: 12,
              color: PALETTE.textDim,
              textAlign: "center",
            }}
          >
            No tickets yet.
          </div>
        ) : null}
        {tickets.map((t) => {
          const isActive = t.ticketId === selectedId;
          return (
            <button
              key={t.ticketId}
              type="button"
              onClick={() => openTicket(t.ticketId)}
              data-nex-hq-ticket-row={t.ticketNumber}
              style={{
                textAlign: "left",
                padding: "10px 12px",
                borderRadius: 10,
                background: isActive ? PALETTE.rowActive : PALETTE.rowBg,
                border: isActive
                  ? `1px solid ${PALETTE.accent}`
                  : `1px solid transparent`,
                color: PALETTE.text,
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                gap: 4,
                fontFamily: "inherit",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 6,
                  alignItems: "baseline",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 900,
                    letterSpacing: 0.3,
                    color: PALETTE.accent,
                    fontFamily:
                      "ui-monospace, 'SF Mono', Consolas, 'Liberation Mono', monospace",
                  }}
                >
                  {t.ticketNumber}
                </span>
                <span style={{ fontSize: 10, color: PALETTE.textDim }}>
                  {formatRelTime(t.updatedAt)}
                </span>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <StatusChip status={t.status} />
                {t.muted ? (
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 900,
                      letterSpacing: 0.3,
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: PALETTE.danger,
                      color: "#FFF",
                      textTransform: "uppercase",
                    }}
                  >
                    Muted
                  </span>
                ) : null}
                {t.requesterCountryIso ? (
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: 0.4,
                      color: PALETTE.textDim,
                      textTransform: "uppercase",
                    }}
                  >
                    {t.requesterCountryIso}
                  </span>
                ) : null}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: PALETTE.textDim,
                  fontFamily:
                    "ui-monospace, 'SF Mono', Consolas, 'Liberation Mono', monospace",
                }}
              >
                {t.requesterAccountId.slice(0, 8)}…
              </div>
            </button>
          );
        })}
      </aside>

      {/* Right · detail */}
      <section
        data-nex-hq-ticket-detail
        style={{
          background: PALETTE.cardBg,
          border: `1.5px solid ${PALETTE.cardBorder}`,
          borderRadius: 14,
          padding: 14,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          minHeight: 480,
        }}
      >
        {!selectedId ? (
          <div
            style={{
              flex: 1,
              display: "grid",
              placeItems: "center",
              color: PALETTE.textDim,
              fontSize: 13,
            }}
          >
            Select a ticket on the left to view the conversation.
          </div>
        ) : !detail ? (
          <div
            style={{
              flex: 1,
              display: "grid",
              placeItems: "center",
              color: PALETTE.textDim,
              fontSize: 13,
            }}
          >
            Loading ticket…
          </div>
        ) : (
          <TicketDetail
            detail={detail}
            reply={reply}
            onReplyChange={setReply}
            onReply={onReply}
            onToggleMute={onToggleMute}
            busy={busy}
          />
        )}
        {error ? (
          <div
            role="alert"
            style={{
              padding: 10,
              borderRadius: 8,
              background: "rgba(139,0,0,0.3)",
              border: `1px solid ${PALETTE.danger}`,
              color: "#FFB199",
              fontSize: 12,
            }}
          >
            {error}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function TicketDetail({
  detail,
  reply,
  onReplyChange,
  onReply,
  onToggleMute,
  busy,
}: {
  readonly detail: AdminTicketDetail;
  readonly reply: string;
  readonly onReplyChange: (v: string) => void;
  readonly onReply: () => void;
  readonly onToggleMute: () => void;
  readonly busy: boolean;
}): React.ReactElement {
  const chatLink = `/nex-native/nex-1`;
  return (
    <>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 10,
          paddingBottom: 10,
          borderBottom: `1px solid ${PALETTE.cardBorder}`,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 900,
              letterSpacing: 0.3,
              color: PALETTE.accent,
              fontFamily:
                "ui-monospace, 'SF Mono', Consolas, 'Liberation Mono', monospace",
            }}
          >
            {detail.ticket.ticketNumber}
          </div>
          <div
            style={{
              fontSize: 11,
              color: PALETTE.textDim,
              fontFamily:
                "ui-monospace, 'SF Mono', Consolas, 'Liberation Mono', monospace",
              marginTop: 2,
            }}
          >
            user {detail.ticket.requesterAccountId}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
            <StatusChip status={detail.ticket.status} />
            {detail.ticket.requesterCountryIso ? (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: "rgba(0,0,0,0.3)",
                  color: PALETTE.textMuted,
                  textTransform: "uppercase",
                }}
              >
                {detail.ticket.requesterCountryIso}
              </span>
            ) : null}
            <a
              href={chatLink}
              style={{
                fontSize: 10,
                fontWeight: 800,
                padding: "2px 8px",
                borderRadius: 999,
                background: "rgba(0,0,0,0.3)",
                color: PALETTE.accent,
                textDecoration: "none",
                border: `1px solid ${PALETTE.cardBorder}`,
                textTransform: "uppercase",
              }}
            >
              Open chat ↗
            </a>
          </div>
        </div>
        <button
          type="button"
          onClick={onToggleMute}
          disabled={busy}
          data-nex-hq-ticket-mute-toggle
          style={{
            padding: "6px 12px",
            borderRadius: 999,
            background: detail.ticket.muted ? PALETTE.danger : "transparent",
            border: `1.5px solid ${detail.ticket.muted ? PALETTE.danger : PALETTE.cardBorderStrong}`,
            color: detail.ticket.muted ? "#FFF" : PALETTE.accent,
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: 0.3,
            cursor: busy ? "not-allowed" : "pointer",
            textTransform: "uppercase",
          }}
        >
          {detail.ticket.muted ? "Unmute" : "Mute"}
        </button>
      </header>

      <div
        data-nex-hq-ticket-log
        style={{
          flex: 1,
          overflowY: "auto",
          maxHeight: "48vh",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: "4px 2px",
        }}
      >
        {detail.messages.length === 0 ? (
          <div
            style={{
              padding: 10,
              color: PALETTE.textDim,
              fontSize: 12,
              textAlign: "center",
            }}
          >
            No messages yet.
          </div>
        ) : (
          detail.messages.map((m) => <LogRow key={m.messageId} msg={m} />)
        )}
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          borderTop: `1px solid ${PALETTE.cardBorder}`,
          paddingTop: 10,
        }}
      >
        <textarea
          value={reply}
          onChange={(e) => onReplyChange(e.target.value)}
          placeholder={
            detail.ticket.muted
              ? "Ticket is muted — unmute to reply"
              : "Type your reply…"
          }
          disabled={busy || detail.ticket.muted}
          rows={2}
          maxLength={4000}
          data-nex-hq-ticket-reply-input
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 10,
            background: "rgba(0,0,0,0.3)",
            border: `1px solid ${PALETTE.cardBorder}`,
            color: PALETTE.text,
            fontFamily: "inherit",
            fontSize: 13,
            resize: "vertical",
            outline: "none",
          }}
        />
        <button
          type="button"
          onClick={onReply}
          disabled={busy || reply.trim().length === 0 || detail.ticket.muted}
          data-nex-hq-ticket-reply-send
          style={{
            flexShrink: 0,
            padding: "0 16px",
            minHeight: 40,
            borderRadius: 999,
            background:
              reply.trim().length > 0 && !detail.ticket.muted
                ? PALETTE.accent
                : "rgba(198, 161, 91, 0.3)",
            color: "#061710",
            border: "none",
            fontSize: 12,
            fontWeight: 900,
            letterSpacing: 0.4,
            cursor:
              reply.trim().length > 0 && !detail.ticket.muted && !busy
                ? "pointer"
                : "not-allowed",
          }}
        >
          Reply
        </button>
      </div>
    </>
  );
}

function LogRow({ msg }: { readonly msg: SupportMessage }): React.ReactElement {
  const align: React.CSSProperties =
    msg.senderKind === "admin"
      ? { alignSelf: "flex-end", background: "rgba(60, 140, 255, 0.12)", borderColor: "rgba(60,140,255,0.4)" }
      : msg.senderKind === "auto"
        ? { alignSelf: "flex-start", background: "rgba(125, 155, 192, 0.1)", borderColor: "rgba(125,155,192,0.35)" }
        : { alignSelf: "flex-start", background: "rgba(198, 161, 91, 0.12)", borderColor: "rgba(198,161,91,0.45)" };
  const labelColor =
    msg.senderKind === "admin"
      ? PALETTE.admin
      : msg.senderKind === "auto"
        ? PALETTE.auto
        : PALETTE.user;
  return (
    <div
      style={{
        maxWidth: "80%",
        padding: "8px 12px",
        borderRadius: 10,
        border: `1px solid ${PALETTE.cardBorder}`,
        color: PALETTE.text,
        fontSize: 12.5,
        lineHeight: 1.5,
        position: "relative",
        ...align,
      }}
    >
      <div
        style={{
          fontSize: 9,
          fontWeight: 900,
          letterSpacing: 0.4,
          textTransform: "uppercase",
          color: labelColor,
          marginBottom: 2,
        }}
      >
        {msg.senderKind === "admin"
          ? "Admin"
          : msg.senderKind === "auto"
            ? "Auto reply"
            : "User"}
        {" · "}
        <span style={{ color: PALETTE.textDim }}>{formatTime(msg.sentAt)}</span>
      </div>
      <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {msg.body}
      </div>
    </div>
  );
}

function StatusChip({ status }: { readonly status: string }): React.ReactElement {
  const color =
    status === "awaiting_admin"
      ? "#FFAF40"
      : status === "awaiting_user"
        ? "#3C8CFF"
        : status === "resolved"
          ? "#16D66B"
          : status === "closed"
            ? "#7D9BC0"
            : "#C6A15B";
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 900,
        padding: "2px 8px",
        borderRadius: 999,
        background: "rgba(0,0,0,0.3)",
        color,
        border: `1px solid ${color}55`,
        textTransform: "uppercase",
        letterSpacing: 0.3,
      }}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

function reasonLabel(reason: string): string {
  switch (reason) {
    case "not_authenticated":
      return "Sign in required.";
    case "not_admin":
      return "Admin access required.";
    case "not_found":
      return "Ticket not found.";
    case "invalid_input":
      return "Please enter a reply (up to 4000 characters).";
    case "db_unavailable":
      return "Database unavailable. Please try again shortly.";
    default:
      return "Could not complete the action.";
  }
}
