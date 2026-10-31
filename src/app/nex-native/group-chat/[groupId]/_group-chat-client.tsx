"use client";

// src/app/nex-native/group-chat/[groupId]/_group-chat-client.tsx
//
// Owner directive 2026-10-23 · Private Group chat renderer. Mock-
// complete surface backed by the client-side mock-private-groups
// store (localStorage). Uses the sealed chat chrome primitives
// (ChatIdentityHeader + ChatComposerPill) · identical UX pattern to
// the Community group chat but scoped per-group.
//
// Behaviour sealed in contract rev 3 §3.3 / §3.5:
//   · Non-members see "This group is private" instead of the feed.
//   · Members see every message + composer.
//   · Author-only hold-to-delete (5s · progress overlay · same as
//     the Community chat seal 2026-10-23).
//   · Messages persist via `persistGroupMessages()` ·
//     `PRIVATE_GROUP_MESSAGES_CHANGED_EVENT` keeps the feed in sync
//     with other same-window writers (none today, but future).

import * as React from "react";
import Link from "next/link";
import { ChatIdentityHeader } from "@/lib/nex-native/chat-chrome/chat-identity-header";
import { ChatComposerPill } from "@/lib/nex-native/chat-chrome/chat-composer-pill";
import {
  getGroupById,
  loadGroupMessages,
  persistGroupMessages,
  PRIVATE_GROUPS_CHANGED_EVENT,
  PRIVATE_GROUP_MESSAGES_CHANGED_EVENT,
  type MockGroupMessage,
  type MockPrivateGroup,
} from "../../contacts/_mock-private-groups";

const NEX = {
  bgNavy: "var(--nex-world-background-base, #020914)",
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

const DELETE_HOLD_MS = 5000;

interface PrivateGroupChatClientProps {
  readonly groupId: string;
  readonly viewerDisplayName: string;
  readonly viewerNexHandle: string;
}

export function PrivateGroupChatClient({
  groupId,
  viewerDisplayName,
  viewerNexHandle,
}: PrivateGroupChatClientProps): React.ReactElement {
  const [group, setGroup] = React.useState<MockPrivateGroup | null>(null);
  const [messages, setMessages] = React.useState<ReadonlyArray<MockGroupMessage>>([]);
  const [composerText, setComposerText] = React.useState("");
  const [ready, setReady] = React.useState(false);
  const feedRef = React.useRef<HTMLDivElement | null>(null);

  // Hydration-safe mount · hydrate group + messages from the store
  // after mount so SSR renders a neutral shell.
  React.useEffect(() => {
    const sync = () => {
      setGroup(getGroupById(groupId));
      setMessages(loadGroupMessages(groupId));
    };
    sync();
    setReady(true);
    const onMsgChange = (e: Event) => {
      // CustomEvent · detail is the groupId that changed.
      const ce = e as CustomEvent<string>;
      if (ce.detail === groupId) setMessages(loadGroupMessages(groupId));
    };
    const onGroupChange = () => setGroup(getGroupById(groupId));
    window.addEventListener(PRIVATE_GROUP_MESSAGES_CHANGED_EVENT, onMsgChange);
    window.addEventListener(PRIVATE_GROUPS_CHANGED_EVENT, onGroupChange);
    return () => {
      window.removeEventListener(PRIVATE_GROUP_MESSAGES_CHANGED_EVENT, onMsgChange);
      window.removeEventListener(PRIVATE_GROUPS_CHANGED_EVENT, onGroupChange);
    };
  }, [groupId]);

  // Scroll to bottom on new message.
  React.useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const viewerAccountId = viewerNexHandle;
  const isMember = React.useMemo(() => {
    if (!group) return false;
    return group.members.some((m) => m.accountId === viewerAccountId);
  }, [group, viewerAccountId]);

  const handleSend = React.useCallback(() => {
    const body = composerText.trim();
    if (body.length === 0 || !group || !isMember) return;
    const now = new Date();
    const next: MockGroupMessage = {
      id: `msg-${now.getTime()}`,
      groupId,
      authorAccountId: viewerAccountId,
      authorDisplayName: viewerDisplayName,
      authorAvatarUrl: null,
      body,
      attachmentImageUrl: null,
      createdAt: now.toISOString(),
      status: "active",
    };
    persistGroupMessages(groupId, [...messages, next]);
    setComposerText("");
  }, [composerText, group, groupId, isMember, messages, viewerAccountId, viewerDisplayName]);

  const handleDelete = React.useCallback(
    (id: string) => {
      persistGroupMessages(
        groupId,
        messages.filter((m) => m.id !== id),
      );
    },
    [groupId, messages],
  );

  if (!ready) {
    return <GroupChatSkeleton />;
  }

  if (!group) {
    return (
      <MissingGroupShell
        title="Group not found"
        body="This group doesn't exist on this device · it may have been created on another device, or the link is wrong."
      />
    );
  }

  if (!isMember) {
    return (
      <MissingGroupShell
        title="This group is private"
        body={`Only members of “${group.name}” can see posts here. Ask the group owner to invite you.`}
      />
    );
  }

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
      <header
        style={{
          padding: "calc(env(safe-area-inset-top, 0) + 10px) 14px 10px",
          borderBottom: `1px solid rgba(0, 175, 255, 0.18)`,
          background: NEX.bgNavy,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Link
          href="/nex-native/contacts?tab=groups"
          aria-label="Back to Contacts"
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            color: NEX.cyan,
            background: "transparent",
            border: `1px solid ${NEX.cyan}55`,
            flexShrink: 0,
            textDecoration: "none",
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <ChatIdentityHeader
            avatarUrl={group.avatarUrl}
            displayName={group.name}
            subtitle={`${group.members.length} member${group.members.length === 1 ? "" : "s"} · private group`}
            presenceKind="online"
            nameFontSize={22}
            maxNameLines={1}
          />
        </div>
      </header>

      <div
        ref={feedRef}
        data-nex-private-group-chat-feed={groupId}
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
        {messages.length === 0 ? (
          <div
            style={{
              marginTop: 24,
              padding: "14px 16px",
              borderRadius: 12,
              background: "rgba(0,175,255,0.08)",
              border: `1px dashed ${NEX.cyan}66`,
              color: NEX.textMute,
              fontSize: 13,
              lineHeight: 1.5,
              textAlign: "center",
            }}
          >
            No posts yet. Be the first to say hello in {group.name}.
          </div>
        ) : (
          messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              isSelf={m.authorAccountId === viewerAccountId}
              onDelete={() => handleDelete(m.id)}
            />
          ))
        )}
      </div>

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
          placeholder={`Post to ${group.name}…`}
          accentHex={NEX.cyan}
          maxLength={2000}
        />
      </div>
    </div>
  );
}

/* ─── Message bubble ─────────────────────────────────────────── */

function MessageBubble({
  message,
  isSelf,
  onDelete,
}: {
  readonly message: MockGroupMessage;
  readonly isSelf: boolean;
  readonly onDelete: () => void;
}): React.ReactElement {
  const [holdProgress, setHoldProgress] = React.useState(0);
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
              {initialsFromName(message.authorDisplayName)}
            </span>
          )}
        </div>
      ) : null}

      <div
        data-nex-private-group-chat-bubble={message.id}
        onPointerDown={startHold}
        onPointerUp={resetHold}
        onPointerLeave={resetHold}
        onPointerCancel={resetHold}
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
            {message.authorDisplayName}
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
        </div>

        {holding && isSelf ? (
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: -6,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 20,
                boxShadow: `0 0 0 2px rgba(179,0,0,${0.3 + holdProgress * 0.5}) inset`,
                background: `linear-gradient(90deg, rgba(179,0,0,${0.08 + holdProgress * 0.18}) 0%, rgba(179,0,0,${0.04 + holdProgress * 0.1}) 100%)`,
              }}
            />
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

/* ─── Empty states ──────────────────────────────────────────── */

function MissingGroupShell({
  title,
  body,
}: {
  readonly title: string;
  readonly body: string;
}): React.ReactElement {
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: NEX.bgNavy,
        color: NEX.text,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header
        style={{
          padding: "calc(env(safe-area-inset-top, 0) + 10px) 14px 10px",
          borderBottom: `1px solid rgba(0, 175, 255, 0.18)`,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Link
          href="/nex-native/contacts?tab=groups"
          aria-label="Back to Contacts"
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            color: NEX.cyan,
            background: "transparent",
            border: `1px solid ${NEX.cyan}55`,
            textDecoration: "none",
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <div
          style={{
            fontSize: 15,
            fontWeight: 800,
            color: NEX.text,
            letterSpacing: 0.2,
          }}
        >
          Private Group
        </div>
      </header>
      <div
        style={{
          flex: 1,
          display: "grid",
          placeItems: "center",
          padding: 24,
        }}
      >
        <div
          style={{
            maxWidth: 360,
            textAlign: "center",
            padding: 20,
            borderRadius: 16,
            background: NEX.bgPanel,
            border: `1px solid ${NEX.cyan}55`,
          }}
        >
          <div
            style={{
              fontSize: 17,
              fontWeight: 800,
              color: NEX.text,
              marginBottom: 8,
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 13,
              lineHeight: 1.5,
              color: NEX.textMute,
            }}
          >
            {body}
          </div>
        </div>
      </div>
    </div>
  );
}

function GroupChatSkeleton(): React.ReactElement {
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: NEX.bgNavy,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: NEX.textMute,
        fontSize: 13,
      }}
    >
      <div>Loading group…</div>
    </div>
  );
}

/* ─── Helpers ───────────────────────────────────────────────── */

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
