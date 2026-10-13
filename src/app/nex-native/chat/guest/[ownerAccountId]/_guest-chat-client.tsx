"use client";

// src/app/nex-native/chat/guest/[ownerAccountId]/_guest-chat-client.tsx
//
// Minimal guest chat surface. Dark NEX industrial palette, orange
// accents matching the Hammerex theme the visitor arrived from. One
// scrolling message list, one composer, one dismissible sign-up
// banner at natural moments (owner reply or guest 2nd message), one
// "waiting for business" status line.
//
// Does NOT render any admin, friend, Vault, reaction, sticker or
// shop-setup chrome. Those are authenticated-only surfaces at
// /nex-native/chat/peer/[accountId].

import * as React from "react";
import { useRouter } from "next/navigation";
import { sendGuestMessageAction } from "./_actions";

interface ClientMessage {
  id: string;
  senderAccountId: string;
  sentAt: string | Date;
  isFromGuest: boolean;
  body: string;
  encrypted: boolean;
}

interface Props {
  guestAccountId: string;
  ownerAccountId: string;
  ownerDisplayName: string;
  businessDisplayName: string | null;
  businessSlug: string | null;
  conversationId: string;
  initialMessages: ClientMessage[];
  isBorn: boolean;
}

const NEX = {
  bg: "#020914",
  panel: "#050f1e",
  panelSoft: "rgba(6,15,28,0.72)",
  border: "rgba(139,169,209,0.14)",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
  orange: "#FF7800",
  orangeSoft: "rgba(255,120,0,0.65)",
  orangeFaint: "rgba(255,120,0,0.14)",
  cyan: "#00AFFF",
  green: "#16D66B",
};

const SERIF =
  "'Cormorant Garamond', 'EB Garamond', 'Playfair Display', Georgia, serif";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export function GuestChatClient(props: Props): React.JSX.Element {
  const {
    ownerAccountId,
    ownerDisplayName,
    businessDisplayName,
    businessSlug,
    initialMessages,
    isBorn,
  } = props;
  const router = useRouter();
  const businessLabel = businessDisplayName ?? ownerDisplayName;

  const [messages, setMessages] = React.useState<ClientMessage[]>(initialMessages);
  const [composerText, setComposerText] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [sendError, setSendError] = React.useState<string | null>(null);
  const [showSignUpPrompt, setShowSignUpPrompt] = React.useState(false);
  const [signUpPromptDismissed, setSignUpPromptDismissed] = React.useState(false);

  const guestMessageCount = messages.filter((m) => m.isFromGuest).length;
  const ownerMessageCount = messages.filter((m) => !m.isFromGuest).length;
  const anyOwnerReply = ownerMessageCount > 0;

  // Sign-up prompt triggers:
  //   · Owner has replied (highest trust moment)
  //   · Guest has sent 2+ messages (investment signal)
  //   · Fallback dismissible banner after 90s dwell
  // NEVER a hard interrupt popup.
  React.useEffect(() => {
    if (signUpPromptDismissed) return;
    if (anyOwnerReply || guestMessageCount >= 2) {
      setShowSignUpPrompt(true);
    }
  }, [anyOwnerReply, guestMessageCount, signUpPromptDismissed]);

  React.useEffect(() => {
    if (signUpPromptDismissed) return;
    const t = setTimeout(() => setShowSignUpPrompt(true), 90_000);
    return () => clearTimeout(t);
  }, [signUpPromptDismissed]);

  const listRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = composerText.trim();
    if (!text || sending) return;
    setSending(true);
    setSendError(null);
    const result = await sendGuestMessageAction(ownerAccountId, text);
    setSending(false);
    if (!result.ok) {
      setSendError(
        result.reason === "unauthenticated"
          ? "Your guest session expired. Please return to the shop."
          : result.reason === "too_long"
            ? "Message is too long (max 2000 characters)."
            : result.reason === "empty"
              ? "Please type a message."
              : "Could not send. Please try again.",
      );
      return;
    }
    // Optimistically append; a proper realtime sub comes later.
    setMessages((prev) => [
      ...prev,
      {
        id: result.message_id ?? Math.random().toString(36),
        senderAccountId: props.guestAccountId,
        sentAt: new Date().toISOString(),
        isFromGuest: true,
        body: text,
        encrypted: false,
      },
    ]);
    setComposerText("");
    router.refresh();
  }

  const signUpHref = `/nex-native/sign-up?next=${encodeURIComponent(`/nex-native/chat/guest/${ownerAccountId}`)}`;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        fontFamily: SANS,
      }}
    >
      {/* ─── Header ─────────────────────────────────────────── */}
      <header
        style={{
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          borderBottom: `1px solid ${NEX.border}`,
          background: NEX.panel,
        }}
      >
        {businessSlug ? (
          <a
            href={`/nex-native/${businessSlug}?commerce=1`}
            style={{
              color: NEX.textDim,
              textDecoration: "none",
              fontSize: 20,
              lineHeight: 1,
              padding: "4px 8px",
            }}
            aria-label="Back to shop"
          >
            ←
          </a>
        ) : null}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: SERIF,
              fontSize: 20,
              fontWeight: 500,
              color: NEX.text,
              lineHeight: 1.2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {businessLabel}
          </div>
          <div
            style={{
              fontSize: 12,
              color: NEX.textMute,
              marginTop: 2,
            }}
          >
            Guest chat · unsaved
          </div>
        </div>
      </header>

      {/* ─── "You're born" banner (sealed §9 ack contract) ──── */}
      {isBorn && (
        <div
          style={{
            margin: "12px 16px 0",
            padding: "10px 14px",
            borderRadius: 10,
            background: NEX.orangeFaint,
            border: `1px solid ${NEX.orangeSoft}`,
            fontSize: 13,
            color: NEX.text,
          }}
          data-nex-guest-born
        >
          Your message has been delivered to {businessLabel}. Keep this tab
          open to see their reply, or sign up to save the chat.
        </div>
      )}

      {/* ─── Message list ───────────────────────────────────── */}
      <div
        ref={listRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
        data-nex-guest-message-list
      >
        {messages.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              color: NEX.textMute,
              fontSize: 14,
              padding: "40px 20px",
            }}
          >
            No messages yet.
          </div>
        ) : (
          messages.map((m) => (
            <GuestMessageBubble key={m.id} message={m} />
          ))
        )}

        {/* Waiting-for-reply status line · only shows when no owner reply yet */}
        {!anyOwnerReply && guestMessageCount > 0 && (
          <div
            style={{
              textAlign: "center",
              color: NEX.textMute,
              fontSize: 12,
              padding: "8px 16px",
              fontStyle: "italic",
            }}
            data-nex-guest-waiting
          >
            Waiting for {businessLabel} to reply…
          </div>
        )}
      </div>

      {/* ─── Sign-up prompt (dismissible, event-triggered) ──── */}
      {showSignUpPrompt && !signUpPromptDismissed && (
        <div
          style={{
            margin: "0 16px 8px",
            padding: "12px 14px",
            borderRadius: 12,
            background: NEX.panel,
            border: `1px solid ${NEX.orangeSoft}`,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
          data-nex-guest-signup-prompt
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: NEX.text }}>
              Save this chat to your NEX account
            </div>
            <div
              style={{ fontSize: 12, color: NEX.textDim, marginTop: 2 }}
            >
              Keep the conversation with {businessLabel} on any device.
            </div>
          </div>
          <a
            href={signUpHref}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              background: NEX.orange,
              color: "#1A1300",
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
            data-nex-guest-signup-cta
          >
            Sign up
          </a>
          <button
            type="button"
            onClick={() => setSignUpPromptDismissed(true)}
            style={{
              background: "transparent",
              border: "none",
              color: NEX.textMute,
              fontSize: 20,
              cursor: "pointer",
              padding: "4px 8px",
            }}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* ─── Composer ───────────────────────────────────────── */}
      <form
        onSubmit={handleSend}
        style={{
          padding: "10px 12px 14px",
          borderTop: `1px solid ${NEX.border}`,
          background: NEX.panel,
          display: "flex",
          gap: 8,
          alignItems: "flex-end",
        }}
        data-nex-guest-composer
      >
        <textarea
          value={composerText}
          onChange={(e) => setComposerText(e.target.value)}
          placeholder={`Message ${businessLabel}…`}
          rows={1}
          maxLength={2000}
          style={{
            flex: 1,
            resize: "none",
            padding: "10px 12px",
            borderRadius: 20,
            background: NEX.panelSoft,
            border: `1px solid ${NEX.orangeSoft}`,
            color: NEX.text,
            fontFamily: SANS,
            fontSize: 15,
            outline: "none",
            minHeight: 40,
            maxHeight: 120,
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSend(e as unknown as React.FormEvent);
            }
          }}
        />
        <button
          type="submit"
          disabled={sending || composerText.trim().length === 0}
          style={{
            padding: "10px 16px",
            borderRadius: 20,
            background:
              sending || composerText.trim().length === 0
                ? NEX.panelSoft
                : NEX.orange,
            color:
              sending || composerText.trim().length === 0
                ? NEX.textMute
                : "#1A1300",
            border: "none",
            fontSize: 14,
            fontWeight: 600,
            cursor:
              sending || composerText.trim().length === 0
                ? "default"
                : "pointer",
          }}
        >
          {sending ? "…" : "Send"}
        </button>
      </form>

      {sendError && (
        <div
          style={{
            padding: "4px 16px 10px",
            fontSize: 12,
            color: "#F59E0B",
            background: NEX.panel,
          }}
          data-nex-guest-send-error
        >
          {sendError}
        </div>
      )}
    </div>
  );
}

function GuestMessageBubble({
  message,
}: {
  message: ClientMessage;
}): React.JSX.Element {
  const align = message.isFromGuest ? "flex-end" : "flex-start";
  const bg = message.isFromGuest ? NEX.orangeFaint : NEX.panel;
  const rim = message.isFromGuest ? NEX.orangeSoft : NEX.border;
  const bodyColor = message.encrypted ? NEX.textDim : NEX.text;
  const italic = message.encrypted;
  return (
    <div style={{ display: "flex", justifyContent: align }}>
      <div
        style={{
          maxWidth: "78%",
          padding: "8px 12px",
          borderRadius: 14,
          background: bg,
          border: `1px solid ${rim}`,
          color: bodyColor,
          fontSize: 15,
          lineHeight: 1.4,
          fontStyle: italic ? "italic" : "normal",
          wordBreak: "break-word",
        }}
        data-nex-guest-bubble
        data-encrypted={message.encrypted ? "true" : "false"}
      >
        {message.body}
      </div>
    </div>
  );
}
