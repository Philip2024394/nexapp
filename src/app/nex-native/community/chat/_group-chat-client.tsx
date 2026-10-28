"use client";

// src/app/nex-native/community/chat/_group-chat-client.tsx
//
// Owner directive 2026-10-23 · group chat page using the sealed
// chat chrome primitives. Lets a NEX account holder read + post
// community messages like a chat room. Mock-only state · when the
// real community-service wiring lands, swap `MOCK_MESSAGES` for
// a server fetch + the handlers for server actions.
//
// Moderation UX (sealed via conversation 2026-10-23):
//
//   · AUTHOR DELETE · press-and-hold own message for 5 seconds ·
//     progress ring + numeric countdown + 30ms haptic per tick ·
//     release early cancels silently · 5s reached deletes without
//     tombstone (no "Author deleted this post" marker · post just
//     vanishes). Protects users from mistaken posts.
//
//   · FLAG · tap any OTHER member's message → action sheet with
//     Flag button. On flag:
//       1. Post removed from feed immediately · replaced with
//          "Message has been reported and currently being viewed
//          by NEX Team · [time]" visible to the whole group
//       2. Flagger receives a mock NEX chat prompt "please explain
//          in your own words why you flagged this post · your
//          identity remains private"
//       3. 1-hour window to submit explanation. Timeout → post
//          auto-reactivates. Submission → NEX reviews · can accept
//          (keep removed) or push live. Already-cleared posts
//          flagged again → permanently removed.
//
// For the mock, we show the "flag → replace bubble → explain
// prompt" transitions in-UI. The NEX-review step is simulated via
// a dev-only "simulate NEX accept" / "simulate NEX push live"
// button inside the replacement bubble so the owner can see the
// full state machine without needing a backend. Hidden in prod.

import * as React from "react";
import { ChatIdentityHeader } from "@/lib/nex-native/chat-chrome/chat-identity-header";
import { ChatComposerPill } from "@/lib/nex-native/chat-chrome/chat-composer-pill";

/* ─── Palette ─────────────────────────────────────────────────── */
const NEX = {
  bgNavy: "#020914",
  bgPanel: "rgba(2,9,20,0.92)",
  bubbleOther: "rgba(12, 32, 58, 0.72)",
  bubbleOtherRim: "rgba(0, 175, 255, 0.22)",
  bubbleSelf: "rgba(0, 175, 255, 0.16)",
  bubbleSelfRim: "rgba(0, 175, 255, 0.55)",
  text: "#F2F5F8",
  textMute: "#7D9BC0",
  cyan: "#00AFFF",
  unreadRed: "#B30000",
  acceptGreen: "#16D66B",
};

/* ─── Message shape + mock data ───────────────────────────────── */

type MessageStatus =
  | "active"
  | "flagged" // visible to everyone as the reported-bubble · in NEX review
  | "cleared-once" // reactivated by NEX · one strike remaining
  | "permanently-removed"; // reactivated + flagged again

interface GroupMessage {
  readonly id: string;
  readonly authorId: string; // "self" for the viewer
  readonly authorName: string;
  readonly authorAvatarUrl: string | null;
  readonly body: string;
  readonly attachmentImageUrl: string | null;
  readonly createdAt: string; // ISO
  readonly status: MessageStatus;
  readonly flaggedAt?: string;
}

const SELF_ID = "self";

function mockSeed(now: Date): ReadonlyArray<GroupMessage> {
  const h = (hoursAgo: number) =>
    new Date(now.getTime() - hoursAgo * 60 * 60 * 1000).toISOString();
  return [
    {
      id: "msg-1",
      authorId: "nex-91205",
      authorName: "Olivia Reyes",
      authorAvatarUrl: "https://i.pravatar.cc/96?u=nex-91205",
      body: "Water outage on Jl Malioboro from 10am to 2pm today · PDAM confirmed",
      attachmentImageUrl: null,
      createdAt: h(6),
      status: "active",
    },
    {
      id: "msg-2",
      authorId: "nex-40011",
      authorName: "Mike's Delivery",
      authorAvatarUrl: "https://i.pravatar.cc/96?u=nex-40011",
      body: "Lost brown labrador near Taman Pintar · answers to Max · reward if found",
      attachmentImageUrl: "https://picsum.photos/seed/max-dog/320/200",
      createdAt: h(4),
      status: "active",
    },
    {
      id: "msg-3",
      authorId: "nex-66524",
      authorName: "Priya Patel",
      authorAvatarUrl: "https://i.pravatar.cc/96?u=nex-66524",
      body: "Yoga pop-up tomorrow 6am at UGM lawn · bring your own mat · free",
      attachmentImageUrl: null,
      createdAt: h(3),
      status: "active",
    },
    {
      id: "msg-4",
      authorId: SELF_ID,
      authorName: "You",
      authorAvatarUrl: null,
      body: "Anyone recommend a good electrician for an old house wiring update?",
      attachmentImageUrl: null,
      createdAt: h(2),
      status: "active",
    },
    {
      id: "msg-5",
      authorId: "nex-77281",
      authorName: "Dr James Okafor",
      authorAvatarUrl: "https://i.pravatar.cc/96?u=nex-77281",
      body: "Clinic running a free flu-shot pop-up this Saturday 9-12 · walk-ins welcome",
      attachmentImageUrl: null,
      createdAt: h(1.5),
      status: "active",
    },
    {
      id: "msg-6",
      authorId: SELF_ID,
      authorName: "You",
      authorAvatarUrl: null,
      body: "Thanks everyone · planning the renovation this month",
      attachmentImageUrl: null,
      createdAt: h(1),
      status: "active",
    },
    {
      id: "msg-7",
      authorId: "nex-82901",
      authorName: "Elena Volkov",
      authorAvatarUrl: "https://i.pravatar.cc/96?u=nex-82901",
      body: "Weekend market open till 10pm this Saturday · live music from 7pm",
      attachmentImageUrl: "https://picsum.photos/seed/weekend-market/320/200",
      createdAt: h(0.5),
      status: "active",
    },
  ];
}

const DELETE_HOLD_MS = 5000;

/* ─── Component ───────────────────────────────────────────────── */

interface GroupChatClientProps {
  readonly viewerDisplayName: string;
  readonly viewerNexHandle: string;
}

export function GroupChatClient({
  viewerDisplayName,
  viewerNexHandle,
}: GroupChatClientProps): React.ReactElement {
  const [messages, setMessages] = React.useState<ReadonlyArray<GroupMessage>>([]);
  const [composerText, setComposerText] = React.useState("");
  const [flagOpenFor, setFlagOpenFor] = React.useState<string | null>(null);
  const [explainOpenFor, setExplainOpenFor] = React.useState<string | null>(null);
  const [explanationText, setExplanationText] = React.useState("");
  const [toast, setToast] = React.useState<string | null>(null);
  const feedRef = React.useRef<HTMLDivElement | null>(null);

  // Seed messages after mount (hydration-safe · timestamps use the
  // client's `new Date()`).
  React.useEffect(() => {
    setMessages(mockSeed(new Date()));
  }, []);

  // Scroll to bottom when messages append (new sends).
  React.useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  // Toast auto-dismiss.
  React.useEffect(() => {
    if (toast === null) return;
    const t = window.setTimeout(() => setToast(null), 1800);
    return () => window.clearTimeout(t);
  }, [toast]);

  const handleSend = React.useCallback(() => {
    const body = composerText.trim();
    if (body.length === 0) return;
    const now = new Date();
    const next: GroupMessage = {
      id: `msg-${now.getTime()}`,
      authorId: SELF_ID,
      authorName: viewerDisplayName,
      authorAvatarUrl: null,
      body,
      attachmentImageUrl: null,
      createdAt: now.toISOString(),
      status: "active",
    };
    setMessages((prev) => [...prev, next]);
    setComposerText("");
  }, [composerText, viewerDisplayName]);

  const handleDelete = React.useCallback((id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
    // No tombstone · post vanishes silently.
  }, []);

  const handleFlag = React.useCallback((id: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id
          ? { ...m, status: "flagged" as const, flaggedAt: new Date().toISOString() }
          : m,
      ),
    );
    setFlagOpenFor(null);
    setExplainOpenFor(id);
    setExplanationText("");
    setToast("Message flagged · explain why in the prompt");
  }, []);

  const handleSubmitExplanation = React.useCallback(
    (id: string) => {
      const txt = explanationText.trim();
      if (txt.length === 0) return;
      // Mock · NEX Team now has the complaint. The post stays
      // flagged until NEX decides. The dev-only review-sim buttons
      // (visible in NODE_ENV !== "production") drive the decision.
      setExplainOpenFor(null);
      setExplanationText("");
      setToast("Thank you · NEX Team is reviewing");
    },
    [explanationText],
  );

  const handleTimeoutExpire = React.useCallback((id: string) => {
    // Mock timeout · post auto-reactivates when the flagger doesn't
    // submit the explanation within 1 hour. Here we expose the
    // "simulate timeout" button in dev to see the state change
    // without waiting an hour.
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status: "active" as const } : m)),
    );
    setExplainOpenFor(null);
    setToast("Flag timed out · message reactivated");
  }, []);

  const simulateNexReview = React.useCallback(
    (id: string, decision: "accept" | "push-live") => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== id) return m;
          if (decision === "accept") {
            // NEX agrees · stays removed. We drop it entirely from
            // the feed (same as permanent-removed for the sender).
            return { ...m, status: "permanently-removed" as const };
          }
          // Push live · reactivated but marked "one strike".
          return { ...m, status: "cleared-once" as const };
        }),
      );
      setToast(
        decision === "accept"
          ? "NEX accepted the complaint · message removed"
          : "NEX pushed the message live · one strike remaining",
      );
    },
    [],
  );

  // Filter out permanently-removed messages from the visible feed.
  const visibleMessages = React.useMemo(
    () => messages.filter((m) => m.status !== "permanently-removed"),
    [messages],
  );

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        minHeight: "100dvh",
        background: NEX.bgNavy,
        color: NEX.text,
      }}
    >
      {/* ─── Sealed chat chrome · header ───────────────────── */}
      <header
        style={{
          padding: "calc(env(safe-area-inset-top, 0) + 10px) 14px 10px",
          borderBottom: `1px solid rgba(0, 175, 255, 0.18)`,
          background: NEX.bgNavy,
          flexShrink: 0,
        }}
      >
        <ChatIdentityHeader
          avatarUrl={null}
          displayName="NEX Yogyakarta Community"
          subtitle="1,248 members · auto-moderated by NEX"
          presenceKind="online"
          isOfficial
          nameFontSize={22}
          maxNameLines={1}
        />
      </header>

      {/* ─── Message feed ─────────────────────────────────── */}
      <div
        ref={feedRef}
        data-nex-community-group-chat-feed
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          padding: "16px 14px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {visibleMessages.map((m) => {
          const isSelf = m.authorId === SELF_ID;
          if (m.status === "flagged") {
            return (
              <FlaggedReplacementBubble
                key={m.id}
                message={m}
                onSimulateTimeout={() => handleTimeoutExpire(m.id)}
                onSimulateAccept={() => simulateNexReview(m.id, "accept")}
                onSimulatePushLive={() => simulateNexReview(m.id, "push-live")}
              />
            );
          }
          return (
            <MessageBubble
              key={m.id}
              message={m}
              isSelf={isSelf}
              onFlagRequest={() => setFlagOpenFor(m.id)}
              onDelete={() => handleDelete(m.id)}
            />
          );
        })}
      </div>

      {/* ─── Flag action sheet (tap-to-flag confirmation) ──── */}
      {flagOpenFor !== null ? (
        <ActionSheet
          title="Flag this message?"
          body="It will be removed from the group until NEX Team reviews. Your identity stays private."
          cancelLabel="Cancel"
          confirmLabel="Flag"
          confirmTone="danger"
          onCancel={() => setFlagOpenFor(null)}
          onConfirm={() => handleFlag(flagOpenFor)}
        />
      ) : null}

      {/* ─── Explain prompt (post-flag) ───────────────────── */}
      {explainOpenFor !== null ? (
        <ExplainPromptSheet
          nexHandle={viewerNexHandle}
          value={explanationText}
          onChange={setExplanationText}
          onSubmit={() => handleSubmitExplanation(explainOpenFor)}
          onCancel={() => setExplainOpenFor(null)}
        />
      ) : null}

      {/* ─── Toast ────────────────────────────────────────── */}
      {toast ? (
        <div
          role="status"
          style={{
            position: "fixed",
            left: 14,
            right: 14,
            bottom: 92,
            padding: "8px 12px",
            borderRadius: 10,
            background: "rgba(22,214,107,0.14)",
            border: `1px solid ${NEX.acceptGreen}66`,
            color: NEX.acceptGreen,
            fontSize: 12,
            fontWeight: 700,
            textAlign: "center",
            zIndex: 90,
          }}
        >
          {toast}
        </div>
      ) : null}

      {/* ─── Sealed chat chrome · composer ────────────────── */}
      <div
        style={{
          padding: "10px 14px calc(env(safe-area-inset-bottom, 0) + 10px)",
          borderTop: `1px solid rgba(0, 175, 255, 0.18)`,
          background: NEX.bgNavy,
          flexShrink: 0,
        }}
      >
        <ChatComposerPill
          value={composerText}
          onChange={setComposerText}
          onSend={handleSend}
          placeholder="Post to the community…"
          accentHex={NEX.cyan}
          maxLength={2000}
        />
      </div>
    </div>
  );
}

/* ─── Message bubble (active or cleared-once) ─────────────────── */

function MessageBubble({
  message,
  isSelf,
  onFlagRequest,
  onDelete,
}: {
  readonly message: GroupMessage;
  readonly isSelf: boolean;
  readonly onFlagRequest: () => void;
  readonly onDelete: () => void;
}): React.ReactElement {
  const [holdProgress, setHoldProgress] = React.useState(0); // 0..1
  const holdRafRef = React.useRef<number | null>(null);
  const holdStartRef = React.useRef<number | null>(null);
  const lastTickSecRef = React.useRef<number>(0);
  const [holding, setHolding] = React.useState(false);

  const resetHold = React.useCallback(() => {
    setHolding(false);
    setHoldProgress(0);
    holdStartRef.current = null;
    lastTickSecRef.current = 0;
    if (holdRafRef.current !== null) {
      cancelAnimationFrame(holdRafRef.current);
      holdRafRef.current = null;
    }
  }, []);

  const tick = React.useCallback(() => {
    if (holdStartRef.current === null) return;
    const elapsed = Date.now() - holdStartRef.current;
    const p = Math.min(1, elapsed / DELETE_HOLD_MS);
    setHoldProgress(p);
    const secondsIntoHold = Math.floor(elapsed / 1000);
    if (secondsIntoHold > lastTickSecRef.current) {
      lastTickSecRef.current = secondsIntoHold;
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate(30);
        } catch {
          /* ignore */
        }
      }
    }
    if (p >= 1) {
      resetHold();
      onDelete();
      return;
    }
    holdRafRef.current = requestAnimationFrame(tick);
  }, [onDelete, resetHold]);

  const startHold = React.useCallback(() => {
    if (!isSelf) return;
    holdStartRef.current = Date.now();
    lastTickSecRef.current = 0;
    setHolding(true);
    holdRafRef.current = requestAnimationFrame(tick);
  }, [isSelf, tick]);

  React.useEffect(() => {
    return () => {
      if (holdRafRef.current !== null) {
        cancelAnimationFrame(holdRafRef.current);
      }
    };
  }, []);

  const countdownSeconds = holding ? Math.max(0, Math.ceil(5 - holdProgress * 5)) : 0;
  const strikeOne = message.status === "cleared-once";

  const bubbleStyle: React.CSSProperties = {
    position: "relative",
    maxWidth: "78%",
    padding: "10px 14px",
    borderRadius: 16,
    background: isSelf ? NEX.bubbleSelf : NEX.bubbleOther,
    border: `1px solid ${isSelf ? NEX.bubbleSelfRim : NEX.bubbleOtherRim}`,
    color: NEX.text,
    fontSize: 14,
    lineHeight: 1.4,
    wordBreak: "break-word",
    cursor: isSelf ? "pointer" : "default",
    userSelect: "none",
    WebkitUserSelect: "none",
    boxShadow: holding ? `0 0 20px ${NEX.unreadRed}66` : undefined,
    transition: "box-shadow 180ms ease",
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: isSelf ? "row-reverse" : "row",
        alignItems: "flex-end",
        gap: 8,
      }}
    >
      {/* Avatar · only for other members · self messages omit avatar. */}
      {!isSelf ? (
        <div
          aria-hidden
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            overflow: "hidden",
            flexShrink: 0,
            border: `1.5px solid ${NEX.cyan}`,
            background: `linear-gradient(135deg, ${NEX.cyan}cc 0%, #180012 65%, #050F1E 100%)`,
            display: "grid",
            placeItems: "center",
          }}
        >
          {message.authorAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={message.authorAvatarUrl}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <span style={{ color: "#FFF", fontSize: 11, fontWeight: 900 }}>
              {initialsFromName(message.authorName)}
            </span>
          )}
        </div>
      ) : null}

      <div
        data-nex-community-group-chat-bubble={message.id}
        data-nex-community-group-chat-bubble-strike={strikeOne ? "one" : "none"}
        onPointerDown={startHold}
        onPointerUp={resetHold}
        onPointerLeave={resetHold}
        onPointerCancel={resetHold}
        onClick={() => {
          if (holding) return; // ignore clicks fired at hold-end
          if (!isSelf) onFlagRequest();
        }}
        style={bubbleStyle}
      >
        {!isSelf ? (
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: NEX.cyan,
              marginBottom: 4,
              letterSpacing: 0.2,
            }}
          >
            {message.authorName}
          </div>
        ) : null}
        <div>{message.body}</div>
        {message.attachmentImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={message.attachmentImageUrl}
            alt=""
            style={{
              marginTop: 8,
              width: "100%",
              borderRadius: 10,
              display: "block",
            }}
          />
        ) : null}
        <div
          style={{
            marginTop: 6,
            fontSize: 10,
            color: NEX.textMute,
            letterSpacing: 0.2,
          }}
        >
          {formatClockTime(message.createdAt)}
          {strikeOne ? (
            <span
              aria-label="One strike remaining"
              style={{ marginLeft: 8, color: NEX.unreadRed, fontWeight: 800 }}
            >
              · 1 strike remaining
            </span>
          ) : null}
        </div>

        {/* Hold-to-delete ring overlay · only renders during hold. */}
        {holding && isSelf ? (
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: -6,
              pointerEvents: "none",
            }}
          >
            <HoldRing progress={holdProgress} />
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "grid",
                placeItems: "center",
                color: NEX.unreadRed,
                fontSize: 24,
                fontWeight: 900,
                textShadow: "0 2px 6px rgba(0,0,0,0.8)",
              }}
            >
              {countdownSeconds}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ─── Hold ring · absolute-positioned SVG around the bubble ───── */

function HoldRing({ progress }: { readonly progress: number }): React.ReactElement {
  // Simple full-width/full-height stroked rectangle · the dasharray
  // trick is harder on arbitrary rectangles · so we approximate by
  // rendering a semi-opaque overlay whose width grows with progress.
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: 20,
        boxShadow: `0 0 0 2px rgba(179,0,0,${0.3 + progress * 0.5}) inset`,
        background: `linear-gradient(90deg, rgba(179,0,0,${0.08 + progress * 0.18}) 0%, rgba(179,0,0,${0.04 + progress * 0.1}) 100%)`,
        transition: "none",
      }}
    />
  );
}

/* ─── Flagged replacement bubble ──────────────────────────────── */

function FlaggedReplacementBubble({
  message,
  onSimulateTimeout,
  onSimulateAccept,
  onSimulatePushLive,
}: {
  readonly message: GroupMessage;
  readonly onSimulateTimeout: () => void;
  readonly onSimulateAccept: () => void;
  readonly onSimulatePushLive: () => void;
}): React.ReactElement {
  const flaggedAt = message.flaggedAt ?? message.createdAt;
  const devMode =
    typeof process !== "undefined" && process.env.NODE_ENV !== "production";
  return (
    <div
      data-nex-community-group-chat-flagged={message.id}
      style={{
        alignSelf: "center",
        maxWidth: "90%",
        padding: "10px 14px",
        borderRadius: 12,
        background: "rgba(179, 0, 0, 0.12)",
        border: `1px dashed ${NEX.unreadRed}99`,
        color: NEX.textMute,
        fontSize: 12,
        fontWeight: 600,
        textAlign: "center",
        letterSpacing: 0.2,
      }}
    >
      <div style={{ color: NEX.unreadRed, fontWeight: 800, marginBottom: 2 }}>
        Message has been reported
      </div>
      <div>
        Currently being viewed by NEX Team · {formatClockTime(flaggedAt)}
      </div>
      {devMode ? (
        <div
          style={{
            marginTop: 8,
            display: "flex",
            gap: 6,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <SimButton onClick={onSimulateTimeout}>Simulate timeout</SimButton>
          <SimButton onClick={onSimulateAccept}>NEX: accept flag</SimButton>
          <SimButton onClick={onSimulatePushLive}>NEX: push live</SimButton>
        </div>
      ) : null}
    </div>
  );
}

function SimButton({
  onClick,
  children,
}: {
  readonly onClick: () => void;
  readonly children: React.ReactNode;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "4px 8px",
        borderRadius: 6,
        background: "transparent",
        border: `1px solid ${NEX.textMute}66`,
        color: NEX.textMute,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 0.2,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

/* ─── Action sheet (flag confirmation) ────────────────────────── */

function ActionSheet({
  title,
  body,
  cancelLabel,
  confirmLabel,
  confirmTone,
  onCancel,
  onConfirm,
}: {
  readonly title: string;
  readonly body: string;
  readonly cancelLabel: string;
  readonly confirmLabel: string;
  readonly confirmTone: "danger" | "default";
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}): React.ReactElement {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 320,
          padding: "18px 18px 14px",
          borderRadius: 16,
          background: NEX.bgPanel,
          border: `1.5px solid ${NEX.cyan}`,
          boxShadow: `0 8px 32px rgba(0,0,0,0.6)`,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 800,
            color: NEX.text,
          }}
        >
          {title}
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: 12,
            lineHeight: 1.4,
            color: NEX.textMute,
          }}
        >
          {body}
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1,
              height: 40,
              padding: "0 10px",
              borderRadius: 10,
              background: "transparent",
              border: `1px solid ${NEX.textMute}`,
              color: NEX.text,
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: 0.4,
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              flex: 1,
              height: 40,
              padding: "0 10px",
              borderRadius: 10,
              background:
                confirmTone === "danger"
                  ? `linear-gradient(135deg, ${NEX.unreadRed}, ${NEX.unreadRed}cc)`
                  : `linear-gradient(135deg, ${NEX.cyan}, ${NEX.cyan}cc)`,
              border: `1px solid ${confirmTone === "danger" ? NEX.unreadRed : NEX.cyan}`,
              color: "#FFF",
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: 0.4,
              textTransform: "uppercase",
              cursor: "pointer",
              boxShadow: `0 2px 10px ${confirmTone === "danger" ? NEX.unreadRed : NEX.cyan}55`,
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Explain prompt sheet ────────────────────────────────────── */

function ExplainPromptSheet({
  nexHandle,
  value,
  onChange,
  onSubmit,
  onCancel,
}: {
  readonly nexHandle: string;
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly onSubmit: () => void;
  readonly onCancel: () => void;
}): React.ReactElement {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 360,
          padding: "18px 18px 14px",
          borderRadius: 16,
          background: NEX.bgPanel,
          border: `1.5px solid ${NEX.cyan}`,
          boxShadow: `0 8px 32px rgba(0,0,0,0.6)`,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            aria-hidden
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${NEX.cyan}cc, #050F1E)`,
              border: `1.5px solid ${NEX.cyan}`,
              display: "grid",
              placeItems: "center",
              color: "#FFF",
              fontSize: 13,
              fontWeight: 900,
            }}
          >
            N1
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: NEX.text }}>
              NEX Team
            </div>
            <div
              style={{
                fontSize: 10,
                color: NEX.textMute,
                letterSpacing: 0.2,
              }}
            >
              Private · {nexHandle}
            </div>
          </div>
        </div>
        <p
          style={{
            margin: 0,
            fontSize: 12,
            lineHeight: 1.5,
            color: NEX.text,
          }}
        >
          Please explain in your own words why you flagged this post. Your
          identity stays private. You have 1 hour · if you don't submit, the
          post will be reactivated.
        </p>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Why did you flag this?"
          rows={4}
          style={{
            width: "100%",
            resize: "vertical",
            padding: "10px 12px",
            borderRadius: 10,
            background: "rgba(2,9,20,0.60)",
            border: `1px solid ${NEX.cyan}55`,
            color: NEX.text,
            fontSize: 13,
            lineHeight: 1.4,
            outline: "none",
            fontFamily: "inherit",
          }}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1,
              height: 40,
              padding: "0 10px",
              borderRadius: 10,
              background: "transparent",
              border: `1px solid ${NEX.textMute}`,
              color: NEX.text,
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: 0.4,
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Later
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={value.trim().length === 0}
            style={{
              flex: 1,
              height: 40,
              padding: "0 10px",
              borderRadius: 10,
              background:
                value.trim().length === 0
                  ? "rgba(0,175,255,0.25)"
                  : `linear-gradient(135deg, ${NEX.cyan}, ${NEX.cyan}cc)`,
              border: `1px solid ${NEX.cyan}`,
              color: value.trim().length === 0 ? NEX.textMute : "#07140A",
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: 0.4,
              textTransform: "uppercase",
              cursor: value.trim().length === 0 ? "not-allowed" : "pointer",
              boxShadow: value.trim().length === 0
                ? "none"
                : `0 2px 10px ${NEX.cyan}55`,
            }}
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Helpers ─────────────────────────────────────────────────── */

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function formatClockTime(iso: string): string {
  try {
    const d = new Date(iso);
    const hh = d.getHours().toString().padStart(2, "0");
    const mm = d.getMinutes().toString().padStart(2, "0");
    return `${hh}:${mm}`;
  } catch {
    return "";
  }
}
