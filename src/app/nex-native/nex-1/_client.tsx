"use client";

// src/app/nex-native/nex-1/_client.tsx
//
// NEX 1 support-chat client · owner-sealed 2026-11-10 revision 5.
//
// This revision wires the chat to the server-backed ticket service
// (migration 315). Messages persist in nex.support_message · admin
// replies arrive via a 15-second poll. First-message auto-reply is
// written server-side by postUserMessageAction when a new ticket is
// created. Swipe-to-delete is now a local-view affordance only (does
// not DELETE server rows) · the user cannot recall an already-sent
// support message once it's in HQ.

import * as React from "react";
import Image from "next/image";
import {
  loadMyTicketAction,
  postUserMessageAction,
  type LoadMyTicketResult,
} from "@/lib/nex-native/support/actions";
import type { SupportMessage } from "@/lib/nex-native/support/ticket-service";

const PALETTE = {
  agentBubbleBg: "rgba(10, 28, 20, 0.9)",
  agentBubbleBorder: "rgba(198, 161, 91, 0.45)",
  userBubbleBg: "#C6A15B",
  userBubbleBorder: "#8B6A32",
  userBubbleText: "#061710",
  text: "#F2F5F8",
  textMuted: "#B5C3D6",
  accent: "#C6A15B",
  composerBg: "rgba(0,0,0,0.4)",
  composerBorder: "rgba(198, 161, 91, 0.35)",
  danger: "#8B0000",
};

const WELCOME_TITLE = "Welcome to NEX Support";
const WELCOME_BODY: ReadonlyArray<string> = [
  "We're here to help with any questions or issues you may have while using the NEX app.",
  "Please note: NEX Support can assist with app-related matters but cannot resolve payment-provider issues. For payment processing, declined transactions, refunds or billing enquiries, please contact your payment provider directly.",
];

const BUBBLE_MAX_WIDTH = "78%";
const SWIPE_HIDE_THRESHOLD_PX = 80;
const ADMIN_POLL_INTERVAL_MS = 15_000;
const TICKET_NUMBER_STORAGE_KEY = "nex-1-ticket-number";

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function Nex1ChatClient(): React.ReactElement {
  const [state, setState] = React.useState<LoadMyTicketResult | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  // Locally-hidden messages (swipe-to-hide client gesture · server row
  // is NOT deleted).
  const [hiddenIds, setHiddenIds] = React.useState<Set<string>>(() => new Set());
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Initial load + auto-focus composer.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await loadMyTicketAction();
      if (cancelled) return;
      if (res.ok) {
        setState(res.value);
        if (res.value.ticket) {
          try {
            window.localStorage.setItem(
              TICKET_NUMBER_STORAGE_KEY,
              res.value.ticket.ticketNumber,
            );
          } catch {
            /* silent */
          }
        }
      } else if (res.reason === "not_authenticated") {
        setError("Sign in to open a support ticket.");
      } else {
        setError("Could not load support. Please try again.");
      }
      setLoading(false);
    })();
    const t = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, []);

  // Poll for admin replies every 15s while the chat is mounted.
  React.useEffect(() => {
    const interval = window.setInterval(async () => {
      if (document.hidden) return;
      const res = await loadMyTicketAction();
      if (res.ok) {
        setState(res.value);
        if (res.value.ticket) {
          try {
            window.localStorage.setItem(
              TICKET_NUMBER_STORAGE_KEY,
              res.value.ticket.ticketNumber,
            );
          } catch {
            /* silent */
          }
        }
      }
    }, ADMIN_POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, []);

  // Auto-scroll to newest message on new content.
  React.useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [state?.messages.length]);

  const onSubmit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const text = draft.trim();
      if (text.length === 0 || busy) return;
      setBusy(true);
      setError(null);
      try {
        const res = await postUserMessageAction({ body: text });
        if (res.ok) {
          setState(res.value);
          if (res.value.ticket) {
            try {
              window.localStorage.setItem(
                TICKET_NUMBER_STORAGE_KEY,
                res.value.ticket.ticketNumber,
              );
            } catch {
              /* silent */
            }
          }
          setDraft("");
        } else {
          setError(reasonLabel(res.reason));
        }
      } finally {
        setBusy(false);
      }
    },
    [draft, busy],
  );

  const visibleMessages = React.useMemo<ReadonlyArray<SupportMessage>>(
    () => (state?.messages ?? []).filter((m) => !hiddenIds.has(m.messageId)),
    [state, hiddenIds],
  );

  const canSend = draft.trim().length > 0 && !busy;

  return (
    <>
      <main
        ref={scrollRef}
        data-nex-1-messages
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          padding: "16px 14px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <WelcomeBubble title={WELCOME_TITLE} paragraphs={WELCOME_BODY} />
        {loading ? (
          <div
            style={{
              fontSize: 11,
              color: PALETTE.textMuted,
              textAlign: "center",
              padding: "8px 0",
            }}
          >
            Loading your ticket…
          </div>
        ) : null}
        {visibleMessages.map((m) => {
          if (m.senderKind === "user") {
            return (
              <UserBubble
                key={m.messageId}
                body={m.body}
                sentAt={m.sentAt}
                onHide={() =>
                  setHiddenIds((prev) => {
                    const next = new Set(prev);
                    next.add(m.messageId);
                    return next;
                  })
                }
              />
            );
          }
          if (m.senderKind === "admin") {
            return (
              <AdminBubble key={m.messageId} body={m.body} sentAt={m.sentAt} />
            );
          }
          return (
            <AutoReplyBubble key={m.messageId} body={m.body} sentAt={m.sentAt} />
          );
        })}
        {error ? (
          <div
            role="alert"
            style={{
              fontSize: 11.5,
              color: "#FFB199",
              background: "rgba(139,0,0,0.3)",
              border: `1px solid ${PALETTE.danger}`,
              padding: "8px 10px",
              borderRadius: 8,
              alignSelf: "center",
            }}
          >
            {error}
          </div>
        ) : null}
      </main>

      <form
        data-nex-1-composer
        onSubmit={onSubmit}
        style={{
          flexShrink: 0,
          padding:
            "10px 12px calc(env(safe-area-inset-bottom, 0px) + 10px)",
          borderTop: `1px solid ${PALETTE.composerBorder}`,
          display: "flex",
          gap: 8,
          alignItems: "center",
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onClick={() => inputRef.current?.focus()}
          placeholder="Type a message…"
          aria-label="Message NEX Support"
          maxLength={2000}
          inputMode="text"
          enterKeyHint="send"
          autoComplete="off"
          autoCorrect="on"
          spellCheck
          data-nex-1-input
          style={{
            flex: 1,
            minWidth: 0,
            padding: "10px 14px",
            borderRadius: 999,
            background: PALETTE.composerBg,
            border: `1px solid ${PALETTE.composerBorder}`,
            color: PALETTE.text,
            fontSize: 16,
            fontFamily: "inherit",
            outline: "none",
            WebkitUserSelect: "text",
            userSelect: "text",
            touchAction: "manipulation",
          }}
        />
        <button
          type="submit"
          disabled={!canSend}
          data-nex-1-send
          aria-label="Send message"
          style={{
            flexShrink: 0,
            minWidth: 56,
            padding: "10px 14px",
            borderRadius: 999,
            background: canSend ? PALETTE.accent : "rgba(198, 161, 91, 0.3)",
            color: "#061710",
            border: "none",
            fontSize: 12,
            fontWeight: 900,
            letterSpacing: 0.4,
            cursor: canSend ? "pointer" : "not-allowed",
            opacity: canSend ? 1 : 0.6,
          }}
        >
          {busy ? "…" : "Send"}
        </button>
      </form>
    </>
  );
}

function reasonLabel(reason: string): string {
  switch (reason) {
    case "not_authenticated":
      return "Sign in to send a support message.";
    case "muted":
      return "This ticket has been muted by NEX Support.";
    case "closed":
      return "This ticket is closed. Start a new session to continue.";
    case "invalid_input":
      return "Please enter a message (up to 4000 characters).";
    case "db_unavailable":
      return "Support is unavailable right now. Please try again shortly.";
    default:
      return "Could not send message. Please try again.";
  }
}

// -----------------------------------------------------------------------------
// Bubble primitives
// -----------------------------------------------------------------------------

function AgentBubble({
  children,
  sentAt,
  dataAttr,
  label,
}: {
  readonly children: React.ReactNode;
  readonly sentAt?: string;
  readonly dataAttr: string;
  readonly label?: string;
}): React.ReactElement {
  return (
    <div
      style={{
        position: "relative",
        maxWidth: BUBBLE_MAX_WIDTH,
        marginRight: "auto",
        paddingTop: 12,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 0,
          left: 10,
          zIndex: 2,
          background: "rgba(6, 23, 16, 0.85)",
          padding: "3px 8px",
          borderRadius: 999,
          border: "1px solid rgba(198, 161, 91, 0.35)",
          display: "inline-flex",
          alignItems: "center",
        }}
      >
        <Image
          src="/nex-native/nex-1-logo.png"
          alt="NEX Support"
          width={46}
          height={16}
          priority
          style={{
            height: 16,
            width: "auto",
            objectFit: "contain",
            display: "block",
          }}
        />
      </span>
      <div
        data-nex-1-bubble={dataAttr}
        style={{
          position: "relative",
          padding: "14px 14px 20px",
          borderRadius: "14px 14px 14px 4px",
          background: PALETTE.agentBubbleBg,
          border: `1px solid ${PALETTE.agentBubbleBorder}`,
          color: PALETTE.text,
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        }}
      >
        {label ? (
          <div
            style={{
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: PALETTE.accent,
              marginBottom: 4,
            }}
          >
            {label}
          </div>
        ) : null}
        {children}
        {sentAt ? <BubbleTimestamp iso={sentAt} tone="light" /> : null}
      </div>
    </div>
  );
}

function BubbleTimestamp({
  iso,
  tone,
}: {
  readonly iso: string;
  readonly tone: "light" | "dark";
}): React.ReactElement {
  return (
    <span
      data-nex-1-bubble-time
      style={{
        position: "absolute",
        right: 10,
        bottom: 4,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: 0.3,
        color:
          tone === "light"
            ? "rgba(181, 195, 214, 0.75)"
            : "rgba(6, 23, 16, 0.65)",
        fontFamily:
          "ui-monospace, 'SF Mono', Consolas, 'Liberation Mono', monospace",
      }}
    >
      {formatTime(iso)}
    </span>
  );
}

function WelcomeBubble({
  title,
  paragraphs,
}: {
  readonly title: string;
  readonly paragraphs: ReadonlyArray<string>;
}): React.ReactElement {
  return (
    <AgentBubble dataAttr="welcome" label="NEX Support">
      <h2
        style={{
          margin: "0 0 8px",
          fontSize: 14,
          fontWeight: 800,
          color: PALETTE.text,
          letterSpacing: "-0.005em",
        }}
      >
        {title}
      </h2>
      {paragraphs.map((p, i) => (
        <p
          key={i}
          style={{
            margin: i === 0 ? 0 : "8px 0 0",
            fontSize: 12.5,
            lineHeight: 1.55,
            color: PALETTE.text,
          }}
        >
          {p}
        </p>
      ))}
    </AgentBubble>
  );
}

function AutoReplyBubble({
  body,
  sentAt,
}: {
  readonly body: string;
  readonly sentAt: string;
}): React.ReactElement {
  return (
    <AgentBubble
      sentAt={sentAt}
      dataAttr="auto-reply"
      label="NEX Support · auto reply"
    >
      <div style={{ fontSize: 12.5, lineHeight: 1.55 }}>{body}</div>
    </AgentBubble>
  );
}

function AdminBubble({
  body,
  sentAt,
}: {
  readonly body: string;
  readonly sentAt: string;
}): React.ReactElement {
  return (
    <AgentBubble sentAt={sentAt} dataAttr="admin" label="NEX Support">
      <div style={{ fontSize: 13, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
        {body}
      </div>
    </AgentBubble>
  );
}

function UserBubble({
  body,
  sentAt,
  onHide,
}: {
  readonly body: string;
  readonly sentAt: string;
  readonly onHide: () => void;
}): React.ReactElement {
  const [dx, setDx] = React.useState(0);
  const startX = React.useRef<number | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    startX.current = e.clientX;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (startX.current === null) return;
    const next = Math.min(0, e.clientX - startX.current);
    setDx(next);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dx;
    startX.current = null;
    try {
      (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
    } catch {
      /* no-op */
    }
    if (d <= -SWIPE_HIDE_THRESHOLD_PX) {
      onHide();
    } else {
      setDx(0);
    }
  };

  return (
    <div
      style={{
        position: "relative",
        maxWidth: BUBBLE_MAX_WIDTH,
        marginLeft: "auto",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "14px 14px 4px 14px",
          background: PALETTE.danger,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          paddingRight: 14,
          color: "#FFF",
          fontSize: 11,
          fontWeight: 900,
          letterSpacing: 0.4,
          opacity: dx < 0 ? 1 : 0,
          transition: dx === 0 ? "opacity 200ms ease" : "none",
        }}
      >
        Hide
      </div>
      <div
        data-nex-1-bubble="user"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setDx(0)}
        style={{
          position: "relative",
          padding: "10px 14px 20px",
          borderRadius: "14px 14px 4px 14px",
          background: PALETTE.userBubbleBg,
          border: `1px solid ${PALETTE.userBubbleBorder}`,
          color: PALETTE.userBubbleText,
          fontSize: 13,
          lineHeight: 1.55,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          transform: `translateX(${dx}px)`,
          transition: dx === 0 ? "transform 200ms ease" : "none",
          touchAction: "pan-y",
          cursor: "grab",
          userSelect: "none",
        }}
      >
        {body}
        <BubbleTimestamp iso={sentAt} tone="dark" />
      </div>
    </div>
  );
}
