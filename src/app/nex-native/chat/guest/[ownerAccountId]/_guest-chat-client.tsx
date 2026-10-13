"use client";

// src/app/nex-native/chat/guest/[ownerAccountId]/_guest-chat-client.tsx
//
// Guest chat surface · wrapped in CoverThemeSkin so the wallpaper +
// accent + motion exactly match the cover the visitor arrived from
// (ONE NEX IDENTITY doctrine). Minimal feature set: message list,
// composer, waiting-for-reply status, dismissible sign-up prompt.
// No admin, Vault, friend, reaction, sticker, or shop-setup chrome.

import * as React from "react";
import { useRouter } from "next/navigation";
import { CoverThemeSkin } from "../../../cover/theme-skin";
import { sendGuestMessageAction } from "./_actions";

interface ClientMessage {
  id: string;
  senderAccountId: string;
  sentAt: string;
  isFromGuest: boolean;
  body: string;
  encrypted: boolean;
}

interface ThemeInfo {
  themeId: string;
  accentHex: string;
  bubbleRimHex: string | null;
  composerRimHex: string | null;
  wallpaperUrl: string | null;
  wallpaperConfig: unknown;
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
  theme: ThemeInfo;
}

export function GuestChatClient(props: Props): React.JSX.Element {
  return (
    <CoverThemeSkin
      accentHex={props.theme.accentHex}
      bubbleRimHex={props.theme.bubbleRimHex}
      composerRimHex={props.theme.composerRimHex}
      wallpaperUrl={props.theme.wallpaperUrl}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      wallpaperConfig={props.theme.wallpaperConfig as any}
      themeId={props.theme.themeId}
      // Guest view doesn't own a specific cover layout · pass through
      // "product" so the skin's downstream primitives (if any) resolve.
      // The guest view only consumes the CSS vars + wallpaper layer.
      layoutId="product"
    >
      <GuestChatInner {...props} />
    </CoverThemeSkin>
  );
}

function GuestChatInner(props: Props): React.JSX.Element {
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
  const [signUpPromptDismissed, setSignUpPromptDismissed] =
    React.useState(false);

  const guestMessageCount = messages.filter((m) => m.isFromGuest).length;
  const ownerMessageCount = messages.filter((m) => !m.isFromGuest).length;
  const anyOwnerReply = ownerMessageCount > 0;

  // Prompt triggers: owner reply, guest 2nd message, 90s dwell fallback.
  React.useEffect(() => {
    if (signUpPromptDismissed) return;
    if (anyOwnerReply || guestMessageCount >= 2) setShowSignUpPrompt(true);
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
          ? "Your session expired. Return to the shop to start again."
          : result.reason === "too_long"
            ? "Message is too long (max 2000 characters)."
            : result.reason === "empty"
              ? "Please type a message."
              : "Could not send. Please try again.",
      );
      return;
    }
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
        minHeight: "100dvh",
        color: "var(--nex-text)",
        fontFamily: "var(--nex-font-body, system-ui, sans-serif)",
        position: "relative",
        zIndex: 1,
      }}
    >
      {/* ─── Header ─────────────────────────────────────────── */}
      <header
        style={{
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          borderBottom: "1px solid var(--nex-card-border, rgba(255,255,255,0.08))",
          background: "var(--nex-panel, rgba(2,9,20,0.72))",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
      >
        {businessSlug ? (
          <a
            href={`/nex-native/${businessSlug}?commerce=1`}
            style={{
              color: "var(--nex-text-dim, #8BA9D1)",
              textDecoration: "none",
              fontSize: 22,
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
              fontFamily: "var(--nex-font-display, 'Cormorant Garamond', Georgia, serif)",
              fontSize: 20,
              fontWeight: 500,
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
              color: "var(--nex-text-dim, #8BA9D1)",
              marginTop: 2,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--nex-accent, #FF7800)",
                boxShadow: "0 0 6px var(--nex-glow, rgba(255,120,0,0.6))",
              }}
              aria-hidden
            />
            Chatting as guest
          </div>
        </div>
      </header>

      {/* ─── "Delivered" banner on first arrival ─────────────── */}
      {isBorn && (
        <div
          style={{
            margin: "12px 16px 0",
            padding: "10px 14px",
            borderRadius: 12,
            background: "rgba(0,0,0,0.42)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            border: "1px solid var(--nex-accent-soft, rgba(255,120,0,0.5))",
            fontSize: 13,
            color: "var(--nex-text)",
          }}
          data-nex-guest-born
        >
          Your message was delivered to {businessLabel}. Keep this tab open
          to see their reply.
        </div>
      )}

      {/* ─── Message list ───────────────────────────────────── */}
      <div
        ref={listRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 12px 10px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
        data-nex-guest-message-list
      >
        {messages.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              color: "var(--nex-text-mute, #526B89)",
              fontSize: 14,
              padding: "40px 20px",
            }}
          >
            Say hello to {businessLabel}
          </div>
        ) : (
          messages.map((m) => <GuestMessageBubble key={m.id} message={m} />)
        )}

        {!anyOwnerReply && guestMessageCount > 0 && (
          <div
            style={{
              textAlign: "center",
              color: "var(--nex-text-dim, #8BA9D1)",
              fontSize: 12,
              padding: "6px 16px 2px",
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
            margin: "0 12px 8px",
            padding: "12px 14px",
            borderRadius: 14,
            background: "rgba(2,9,20,0.72)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: "1px solid var(--nex-accent-soft, rgba(255,120,0,0.5))",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
          data-nex-guest-signup-prompt
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              Save this chat to your NEX account
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--nex-text-dim, #8BA9D1)",
                marginTop: 2,
              }}
            >
              Keep the conversation with {businessLabel} on any device.
            </div>
          </div>
          <a
            href={signUpHref}
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              background: "var(--nex-accent, #FF7800)",
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
              color: "var(--nex-text-mute, #526B89)",
              fontSize: 22,
              cursor: "pointer",
              padding: "4px 8px",
              lineHeight: 1,
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
          borderTop: "1px solid var(--nex-card-border, rgba(255,255,255,0.08))",
          background: "rgba(2,9,20,0.78)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
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
            padding: "10px 14px",
            borderRadius: 22,
            background: "rgba(6,15,28,0.6)",
            border: "1px solid var(--nex-accent-soft, rgba(255,120,0,0.5))",
            color: "var(--nex-text, #F4F7FC)",
            fontFamily: "var(--nex-font-body, system-ui, sans-serif)",
            fontSize: 15,
            outline: "none",
            minHeight: 42,
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
            padding: "10px 18px",
            borderRadius: 22,
            background:
              sending || composerText.trim().length === 0
                ? "rgba(6,15,28,0.6)"
                : "var(--nex-accent, #FF7800)",
            color:
              sending || composerText.trim().length === 0
                ? "var(--nex-text-mute, #526B89)"
                : "#1A1300",
            border: "none",
            fontSize: 14,
            fontWeight: 600,
            cursor:
              sending || composerText.trim().length === 0
                ? "default"
                : "pointer",
            minWidth: 68,
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
            background: "rgba(2,9,20,0.78)",
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
  // Guest's own bubbles get the accent-tinted fill, like outgoing
  // messages in sealed chat themes. Owner's bubbles sit on the frosted
  // panel so they read against the wallpaper.
  const bg = message.isFromGuest
    ? "var(--nex-accent-faint, rgba(255,120,0,0.14))"
    : "rgba(2,9,20,0.68)";
  const rim = message.isFromGuest
    ? "var(--nex-accent-soft, rgba(255,120,0,0.5))"
    : "var(--nex-card-border, rgba(255,255,255,0.08))";
  return (
    <div style={{ display: "flex", justifyContent: align }}>
      <div
        style={{
          maxWidth: "78%",
          padding: "9px 13px",
          borderRadius: 16,
          background: bg,
          border: `1px solid ${rim}`,
          color: "var(--nex-text, #F4F7FC)",
          fontSize: 15,
          lineHeight: 1.4,
          wordBreak: "break-word",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
        data-nex-guest-bubble
        data-sender={message.isFromGuest ? "guest" : "owner"}
      >
        {message.body}
      </div>
    </div>
  );
}
