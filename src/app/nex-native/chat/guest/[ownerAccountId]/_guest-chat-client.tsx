"use client";

// src/app/nex-native/chat/guest/[ownerAccountId]/_guest-chat-client.tsx
//
// Guest chat surface. Wraps in CoverThemeSkin so the wallpaper +
// accent + motion exactly match whatever theme the business owner has
// set (ONE NEX IDENTITY doctrine). Uses the sealed Joker/standard
// chat header + aurora-pill composer design (Bridge 53 · founder-
// sealed 2026-09-27 / 2026-09-29) so every theme's guest chat reads
// the same shape.
//
// Visual tokens (match sealed PortraitBloomShell + HeaderRightCluster):
//   · 56px round profile avatar · left-aligned · presence ring
//   · Business name 26px bold · subtitle below · soft text-shadow
//   · 44px circle buttons · right-aligned fixed · Home + Sign-up
//   · Aurora-pill composer · 24px rounded · accent send button
//   · Glass bubbles · accent rim for guest · frosted navy for owner

import * as React from "react";
import Link from "next/link";
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
  businessLogoUrl: string | null;
  conversationId: string;
  initialMessages: ClientMessage[];
  isBorn: boolean;
  theme: ThemeInfo;
}

const GREEN = "#16D66B";
const AMBER = "#F59E0B";
const CYAN_DEEP = "#063B67";
const CYAN = "#00AFFF";

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || parts[0].length === 0) return "·";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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
    businessLogoUrl,
    initialMessages,
    isBorn,
    theme,
  } = props;
  const router = useRouter();
  const businessLabel = businessDisplayName ?? ownerDisplayName;
  const shopHref = businessSlug
    ? `/nex-native/${businessSlug}?commerce=1`
    : "/nex-native/home";
  const signUpHref = `/nex-native/sign-up?next=${encodeURIComponent(`/nex-native/chat/guest/${ownerAccountId}`)}`;

  const [messages, setMessages] = React.useState<ClientMessage[]>(initialMessages);
  const [composerText, setComposerText] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [sendError, setSendError] = React.useState<string | null>(null);
  const [showSignUpPrompt, setShowSignUpPrompt] = React.useState(false);
  const [signUpPromptDismissed, setSignUpPromptDismissed] =
    React.useState(false);

  const guestMessageCount = messages.filter((m) => m.isFromGuest).length;
  const anyOwnerReply = messages.some((m) => !m.isFromGuest);

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

  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const autoGrow = React.useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, []);
  React.useEffect(autoGrow, [composerText, autoGrow]);

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

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100dvh",
        color: "var(--nex-text, #F4F7FC)",
        fontFamily: "var(--nex-font-body, Inter, system-ui, sans-serif)",
        position: "relative",
        zIndex: 1,
      }}
    >
      {/* ─── HEADER · profile LEFT · 44px circle buttons RIGHT ─── */}
      <header
        style={{
          position: "relative",
          flexShrink: 0,
          padding:
            "calc(env(safe-area-inset-top, 0) + 14px) 62px 12px 20px",
          textShadow: "0 2px 20px rgba(0,0,0,0.75)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* 56px round profile · business logo or initials fallback */}
          <div
            aria-label={`${businessLabel} · chatting as guest`}
            title={businessLabel}
            style={{
              position: "relative",
              flexShrink: 0,
              width: 56,
              height: 56,
            }}
          >
            {/* Presence ring · guest doesn't know if owner is live, so
                we show a steady accent ring (not the heartbeat pulse)
                to indicate "ready to respond" without faking presence */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                inset: -2,
                borderRadius: "50%",
                border: `2px solid var(--nex-accent, ${theme.accentHex})`,
                boxShadow: `0 0 10px var(--nex-glow, ${theme.accentHex}66)`,
                pointerEvents: "none",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                overflow: "hidden",
                border: `2px solid ${GREEN}`,
                boxShadow:
                  "0 0 0 3px rgba(22,214,107,0.12), 0 4px 14px rgba(0,0,0,0.6)",
                backgroundImage: businessLogoUrl
                  ? `url(${businessLogoUrl})`
                  : `linear-gradient(135deg, ${CYAN_DEEP} 0%, #05101f 100%)`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              {!businessLogoUrl && (
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "grid",
                    placeItems: "center",
                    color: CYAN,
                    fontSize: 16,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    opacity: 0.9,
                  }}
                >
                  {initialsFromName(businessLabel)}
                </div>
              )}
            </div>
          </div>

          {/* Name stack · right-pad reserves space for the R1 cluster */}
          <div style={{ minWidth: 0, flex: 1, paddingRight: 150 }}>
            <div
              style={{
                fontSize: 26,
                fontWeight: 700,
                color: "var(--nex-text, #F4F7FC)",
                lineHeight: 1.1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {businessLabel}
            </div>
            <div
              style={{
                fontSize: 13,
                color: "var(--nex-text-dim, rgba(244,247,252,0.72))",
                marginTop: 2,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "var(--nex-accent, " + theme.accentHex + ")",
                  boxShadow: `0 0 6px var(--nex-glow, ${theme.accentHex}aa)`,
                }}
              />
              Chatting as guest
            </div>
          </div>
        </div>

        {/* R1 cluster · 44px circle buttons · absolutely positioned */}
        <div
          data-nex-guest-cluster
          style={{
            position: "absolute",
            top: "calc(env(safe-area-inset-top, 0) + 14px)",
            right: 12,
            display: "flex",
            alignItems: "center",
            gap: 4,
            zIndex: 6,
          }}
        >
          <HeaderCircleLink
            href={shopHref}
            ariaLabel="Back to shop"
            title="Shop"
          >
            <ShopIcon />
          </HeaderCircleLink>
          <HeaderCircleLink
            href={signUpHref}
            ariaLabel="Sign up to save this chat"
            title="Sign up"
          >
            <SaveIcon />
          </HeaderCircleLink>
        </div>
      </header>

      {/* ─── "Delivered" banner on first arrival ─────────────── */}
      {isBorn && (
        <div
          style={{
            margin: "4px 16px 0",
            padding: "10px 14px",
            borderRadius: 12,
            background: "rgba(2,9,20,0.6)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            border: `1px solid var(--nex-accent-soft, ${theme.accentHex}80)`,
            fontSize: 13,
            color: "var(--nex-text, #F4F7FC)",
          }}
          data-nex-guest-born
        >
          Your message was delivered to {businessLabel}. Keep this tab
          open to see their reply.
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
              color: "var(--nex-text-mute, rgba(244,247,252,0.5))",
              fontSize: 14,
              padding: "40px 20px",
            }}
          >
            Say hello to {businessLabel}
          </div>
        ) : (
          messages.map((m) => (
            <GuestMessageBubble key={m.id} message={m} />
          ))
        )}

        {!anyOwnerReply && guestMessageCount > 0 && (
          <div
            style={{
              textAlign: "center",
              color: "var(--nex-text-dim, rgba(244,247,252,0.72))",
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
            border: `1px solid var(--nex-accent-soft, ${theme.accentHex}80)`,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
          data-nex-guest-signup-prompt
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              Create Your Free Chat Window
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--nex-text-dim, rgba(244,247,252,0.72))",
                marginTop: 2,
              }}
            >
              {businessLabel} will need your chat window to reply — only
              takes 1 minute.
            </div>
          </div>
          <a
            href={signUpHref}
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              background: "var(--nex-accent, " + theme.accentHex + ")",
              color: "#1A1300",
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
            data-nex-guest-signup-cta
          >
            Create
          </a>
          <button
            type="button"
            onClick={() => setSignUpPromptDismissed(true)}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--nex-text-mute, rgba(244,247,252,0.5))",
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

      {/* ─── AURORA PILL COMPOSER ───────────────────────────── */}
      <form
        onSubmit={handleSend}
        style={{
          padding: "0 12px calc(env(safe-area-inset-bottom, 0) + 12px)",
          flexShrink: 0,
        }}
        data-nex-guest-composer
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 6px 6px 12px",
            borderRadius: 24,
            background: "rgba(4,20,36,0.90)",
            border: `1px solid var(--nex-composer-rim, ${theme.composerRimHex ?? theme.accentHex})`,
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
          }}
        >
          {/* + button · info trigger (disabled for guest · media attach
              is Phase C+ ·  shown for visual parity with authenticated
              composer) */}
          <button
            type="button"
            disabled
            title="Attach media available after you sign up"
            aria-label="Attach"
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.04)",
              border: "none",
              color: "var(--nex-text-mute, rgba(244,247,252,0.4))",
              fontSize: 20,
              lineHeight: 1,
              cursor: "not-allowed",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
          >
            +
          </button>

          <textarea
            ref={textareaRef}
            value={composerText}
            onChange={(e) => setComposerText(e.target.value)}
            placeholder={`Message ${businessLabel}…`}
            rows={1}
            maxLength={2000}
            style={{
              flex: 1,
              resize: "none",
              padding: "8px 4px",
              background: "transparent",
              border: "none",
              color: "var(--nex-text, #F4F7FC)",
              fontFamily:
                "var(--nex-font-body, Inter, system-ui, sans-serif)",
              fontSize: 15,
              outline: "none",
              minHeight: 24,
              maxHeight: 120,
              lineHeight: 1.4,
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
            aria-label="Send"
            title="Send"
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background:
                sending || composerText.trim().length === 0
                  ? "rgba(255,255,255,0.08)"
                  : "var(--nex-accent, " + theme.accentHex + ")",
              color:
                sending || composerText.trim().length === 0
                  ? "rgba(244,247,252,0.4)"
                  : "#1A1300",
              border: "none",
              cursor:
                sending || composerText.trim().length === 0
                  ? "default"
                  : "pointer",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
              boxShadow:
                sending || composerText.trim().length === 0
                  ? "none"
                  : `0 6px 18px var(--nex-glow, ${theme.accentHex}66)`,
              transition: "background 180ms ease, box-shadow 180ms ease",
            }}
          >
            {sending ? (
              <span style={{ fontSize: 18, fontWeight: 600 }}>…</span>
            ) : (
              <SendIcon />
            )}
          </button>
        </div>
        {sendError && (
          <div
            style={{
              marginTop: 6,
              padding: "6px 12px",
              fontSize: 12,
              color: AMBER,
              textAlign: "center",
            }}
            data-nex-guest-send-error
          >
            {sendError}
          </div>
        )}
      </form>
    </div>
  );
}

/* ───────────────── Message bubble ──────────────────────────────── */

function GuestMessageBubble({
  message,
}: {
  message: ClientMessage;
}): React.JSX.Element {
  const align = message.isFromGuest ? "flex-end" : "flex-start";
  const bg = message.isFromGuest
    ? "var(--nex-accent-faint, rgba(255,120,0,0.14))"
    : "rgba(2,9,20,0.68)";
  const rim = message.isFromGuest
    ? "var(--nex-bubble-rim, var(--nex-accent-soft, rgba(255,120,0,0.5)))"
    : "rgba(139,169,209,0.3)";
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
          boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
        }}
        data-nex-guest-bubble
        data-sender={message.isFromGuest ? "guest" : "owner"}
      >
        {message.body}
      </div>
    </div>
  );
}

/* ───────────────── Header circle button primitive ──────────────── */

function HeaderCircleLink({
  href,
  ariaLabel,
  title,
  children,
}: {
  href: string;
  ariaLabel: string;
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      title={title}
      style={{
        width: 44,
        height: 44,
        display: "grid",
        placeItems: "center",
        color: "var(--nex-text, #F4F7FC)",
        textDecoration: "none",
        filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.65))",
        transition: "transform 120ms ease, opacity 120ms ease",
      }}
    >
      {children}
    </Link>
  );
}

/* ───────────────── SVG icons (match sealed cluster) ────────────── */

function ShopIcon(): React.JSX.Element {
  // Shop-bag · same silhouette the sealed R1 cluster uses when the
  // peer owns a non-venue business.
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function SaveIcon(): React.JSX.Element {
  // Bookmark-plus · "save this chat" affordance.
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      <line x1="12" y1="7" x2="12" y2="13" />
      <line x1="9" y1="10" x2="15" y2="10" />
    </svg>
  );
}

function SendIcon(): React.JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}
