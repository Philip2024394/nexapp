"use client";

// src/app/nex-native/nex-1/_client.tsx
//
// NEX 1 support-chat client · owner-sealed 2026-11-10 revision 4.
//
// This revision adds:
//   · NEX brand logo sits OVER the top-left corner of each agent bubble
//     (badge / tab position, not beside).
//   · Consistent bubble widths · both user + agent cap at 78% so neither
//     stretches full-width or reads lopsided against the other.
//   · Send time rendered at the lower-right corner of every bubble.
//   · Swipe-to-delete · each bubble becomes draggable on touch; drag
//     left > 80px deletes the message from local state. (Welcome +
//     auto-reply are permanent · they cannot be swiped away.)

import * as React from "react";
import Image from "next/image";

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

interface UserMessage {
  readonly id: string;
  readonly body: string;
  readonly sentAt: string;
  readonly from: "user" | "agent-auto";
}

const AUTO_REPLY =
  "Thanks for reaching out. Please describe your question or issue in detail. A NEX team member will reply soon — current response time is within 16 hours.";

const BUBBLE_MAX_WIDTH = "78%";
const SWIPE_DELETE_THRESHOLD_PX = 80;

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function Nex1ChatClient(): React.ReactElement {
  const [draft, setDraft] = React.useState("");
  const [messages, setMessages] = React.useState<UserMessage[]>([]);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Owner directive 2026-11-09 revision 3 · "keypad not working" fix.
  // Pop the OS keypad on mount by focusing the composer input right
  // after hydration. Short delay beats mobile Safari focus blockers.
  React.useEffect(() => {
    const t = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(t);
  }, []);

  // Auto-scroll to the newest message when the list grows.
  React.useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  const onSubmit = React.useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (text.length === 0) return;
    const nextMsg: UserMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      body: text.slice(0, 2000),
      sentAt: new Date().toISOString(),
      from: "user",
    };

    // Owner directive 2026-11-10 · fire the auto-reply once · after
    // the user's very first message. Short delay so it reads like a
    // response rather than a pre-written statement. Guard rail: we
    // key off "no prior user message" rather than a boolean flag so
    // the auto-reply doesn't double-fire across HMR or re-renders.
    const isFirstUserMessage = !hasAnyUserMessage(messages);
    setMessages((prev) => [...prev, nextMsg]);
    setDraft("");

    if (isFirstUserMessage) {
      window.setTimeout(() => {
        const autoMsg: UserMessage = {
          id: `auto-${Date.now()}`,
          body: AUTO_REPLY,
          sentAt: new Date().toISOString(),
          from: "agent-auto",
        };
        setMessages((prev) => [...prev, autoMsg]);
      }, 650);
    }
  }, [draft, messages]);

  const canSend = draft.trim().length > 0;

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
        {messages.map((m) =>
          m.from === "user" ? (
            <UserBubble
              key={m.id}
              body={m.body}
              sentAt={m.sentAt}
              onDelete={() =>
                setMessages((prev) => prev.filter((x) => x.id !== m.id))
              }
            />
          ) : (
            <AutoReplyBubble key={m.id} body={m.body} sentAt={m.sentAt} />
          ),
        )}
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
          // Owner directive 2026-11-09 revision 3 · mobile-friendly
          // keypad hints so iOS / Android pop the full keyboard with
          // a Send enter key, instead of the previous bare type=text
          // that some browsers interpret inconsistently.
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
          Send
        </button>
      </form>
    </>
  );
}

// -----------------------------------------------------------------------------
// Bubble primitives · logo-over-corner + width cap + timestamp + swipe
// -----------------------------------------------------------------------------

function AgentBubble({
  children,
  sentAt,
  dataAttr,
}: {
  readonly children: React.ReactNode;
  readonly sentAt?: string;
  readonly dataAttr: string;
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
      {/* Logo sits OVER the top-left corner of the bubble per owner
          directive 2026-11-10. Elevated with a dark backdrop so the
          silver + orange wordmark stays legible on light bubble fills. */}
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
    <AgentBubble dataAttr="welcome">
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: PALETTE.accent,
          marginBottom: 8,
        }}
      >
        NEX Support
      </div>
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

function hasAnyUserMessage(messages: ReadonlyArray<UserMessage>): boolean {
  for (const m of messages) {
    if (m.from === "user") return true;
  }
  return false;
}

function AutoReplyBubble({
  body,
  sentAt,
}: {
  readonly body: string;
  readonly sentAt: string;
}): React.ReactElement {
  return (
    <AgentBubble sentAt={sentAt} dataAttr="auto-reply">
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
        NEX Support · auto reply
      </div>
      <div style={{ fontSize: 12.5, lineHeight: 1.55 }}>{body}</div>
    </AgentBubble>
  );
}

// Swipe-to-delete user bubble · pointer events track horizontal drag;
// release past -80px triggers onDelete. Reverts to zero on short drags.
function UserBubble({
  body,
  sentAt,
  onDelete,
}: {
  readonly body: string;
  readonly sentAt: string;
  readonly onDelete: () => void;
}): React.ReactElement {
  const [dx, setDx] = React.useState(0);
  const startX = React.useRef<number | null>(null);
  const pointerId = React.useRef<number | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    startX.current = e.clientX;
    pointerId.current = e.pointerId;
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
    pointerId.current = null;
    try {
      (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
    } catch {
      /* no-op */
    }
    if (d <= -SWIPE_DELETE_THRESHOLD_PX) {
      onDelete();
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
      {/* Red delete track revealed as the bubble slides left. */}
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
        Delete
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
