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

interface GuestProduct {
  id: string;
  name: string;
  pricePence: number;
  currency: string;
  imageUrl: string | null;
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
  products: GuestProduct[];
}

function formatPriceIDR(pence: number, currency: string): string {
  // price_pence is historically "smallest-unit"; for IDR we treat it
  // as whole rupiah already (no sub-unit). Fall through to en-US for
  // other currencies in a sane way.
  if (currency.toUpperCase() === "IDR") {
    return `Rp ${pence.toLocaleString("en-US")}`;
  }
  return `${currency} ${(pence / 100).toFixed(2)}`;
}

const GREEN = "#16D66B";
const AMBER = "#F59E0B";
const CYAN_DEEP = "#063B67";
const CYAN = "#00AFFF";
const NEX_PINK = "#FF3F9F";

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
  const [shopOpen, setShopOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);

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

  function attachProductToComposer(product: GuestProduct) {
    const line = `I'm interested in: ${product.name}`;
    setComposerText((prev) => (prev.trim().length > 0 ? `${prev}\n\n${line}` : line));
    setShopOpen(false);
    // Focus the composer so the user can edit before sending.
    setTimeout(() => textareaRef.current?.focus(), 10);
  }

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
        height: "100dvh",
        color: "var(--nex-text, #F4F7FC)",
        fontFamily: "var(--nex-font-body, Inter, system-ui, sans-serif)",
        position: "relative",
        zIndex: 1,
        // Explicit full-viewport wallpaper so it visibly covers the
        // entire screen regardless of CoverThemeSkin's 0.35-opacity
        // layer. Dark gradient scrim keeps text readable.
        backgroundColor: "#020914",
        backgroundImage: theme.wallpaperUrl
          ? `linear-gradient(180deg, rgba(2,9,20,0.35) 0%, rgba(2,9,20,0.65) 100%), url(${theme.wallpaperUrl})`
          : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed",
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
            {/* Ping ring · scales out from the avatar on a 1800ms cycle,
                signalling "this is a live chat surface" · same spirit
                as the sealed PortraitBloomShell presence heartbeat. */}
            <style>{`
              @keyframes nex-guest-presence-ping {
                0% { transform: scale(1); opacity: 0.9; }
                75% { transform: scale(1.5); opacity: 0; }
                100% { transform: scale(1.5); opacity: 0; }
              }
            `}</style>
            <div
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                border: `2px solid ${GREEN}`,
                pointerEvents: "none",
                animation:
                  "nex-guest-presence-ping 1800ms cubic-bezier(0.4, 0, 0.2, 1) infinite",
                willChange: "transform, opacity",
              }}
            />
            {/* Avatar container · solid green rim · same green as the
                sealed online-presence border on authenticated chat. */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                overflow: "hidden",
                border: `2px solid ${GREEN}`,
                boxShadow: `0 0 0 3px ${GREEN}22, 0 4px 14px rgba(0,0,0,0.6)`,
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

          {/* Name stack · hard-capped maxWidth so the name block can
              NEVER overflow under the absolutely-positioned R1 cluster.
              150px reserved on the right (44px buttons × 2 + gap + 12px
              right offset = ~108px, so 150px is a safe margin). Each
              word on its own line via word-spacing hack. */}
          <div
            style={{
              minWidth: 0,
              flex: 1,
              paddingRight: 150,
              maxWidth: "calc(100% - 56px - 12px)",
              overflow: "hidden",
            }}
          >
            <div
              data-nex-guest-business-name
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "var(--nex-text, #F4F7FC)",
                lineHeight: 1.1,
                // One-word-per-line wrap for multi-word names; single-
                // word names (e.g. "Hammerexproducts") stay on one line.
                wordSpacing: "100vw",
                wordBreak: "normal",
                overflowWrap: "normal",
              }}
            >
              {businessLabel}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--nex-text-dim, rgba(244,247,252,0.72))",
                marginTop: 4,
                display: "flex",
                alignItems: "center",
                gap: 6,
                whiteSpace: "nowrap",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: GREEN,
                  boxShadow: `0 0 6px ${GREEN}aa`,
                  flexShrink: 0,
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
          <HeaderCircleButton
            onClick={() => setShopOpen(true)}
            ariaLabel={`Browse ${businessLabel} products`}
            title="Shop"
            glow
            accentHex={theme.accentHex}
          >
            <ShopIcon />
          </HeaderCircleButton>
          <HeaderCircleButton
            onClick={() => setSettingsOpen(true)}
            ariaLabel="Settings"
            title="Settings"
            accentHex={theme.accentHex}
          >
            <SettingsIcon />
          </HeaderCircleButton>
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

      {/* ─── PRODUCT BOTTOM SHEET ──────────────────────────── */}
      {shopOpen && (
        <ProductSheet
          products={props.products}
          businessLabel={businessLabel}
          businessSlug={businessSlug}
          accentHex={theme.accentHex}
          wallpaperUrl={theme.wallpaperUrl}
          onClose={() => setShopOpen(false)}
          onPick={attachProductToComposer}
        />
      )}

      {/* ─── SETTINGS MODAL (sign-up gate with NEX framing) ─── */}
      {settingsOpen && (
        <SettingsSignupModal
          businessLabel={businessLabel}
          accentHex={theme.accentHex}
          signUpHref={signUpHref}
          onClose={() => setSettingsOpen(false)}
        />
      )}
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

function HeaderCircleButton({
  onClick,
  ariaLabel,
  title,
  glow,
  accentHex,
  children,
}: {
  onClick: () => void;
  ariaLabel: string;
  title: string;
  glow?: boolean;
  accentHex: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <>
      {glow && (
        <style>{`
          @keyframes nex-guest-shop-pulse {
            0%, 100% {
              filter:
                drop-shadow(0 2px 6px rgba(0,0,0,0.65))
                drop-shadow(0 0 4px ${accentHex}aa);
            }
            50% {
              filter:
                drop-shadow(0 2px 6px rgba(0,0,0,0.65))
                drop-shadow(0 0 14px ${accentHex}dd);
            }
          }
        `}</style>
      )}
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        title={title}
        style={{
          width: 44,
          height: 44,
          display: "grid",
          placeItems: "center",
          color: "var(--nex-text, #F4F7FC)",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: 0,
          filter: glow
            ? undefined
            : "drop-shadow(0 2px 6px rgba(0,0,0,0.65))",
          animation: glow
            ? "nex-guest-shop-pulse 2200ms ease-in-out infinite"
            : undefined,
          transition: "transform 120ms ease, opacity 120ms ease",
        }}
      >
        {children}
      </button>
    </>
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

function SettingsIcon(): React.JSX.Element {
  // Standard gear/settings glyph.
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
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}

function MagnifierIcon(): React.JSX.Element {
  // Matches the sealed round-product-variant magnifier rim affordance
  // from cover primitives · 20px standard search icon.
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16" y2="16" />
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

/* ───────────────── Product bottom-sheet ───────────────────────── */

function ProductSheet({
  products,
  businessLabel,
  businessSlug,
  accentHex,
  wallpaperUrl,
  onClose,
  onPick,
}: {
  products: GuestProduct[];
  businessLabel: string;
  businessSlug: string | null;
  accentHex: string;
  wallpaperUrl: string | null;
  onClose: () => void;
  onPick: (p: GuestProduct) => void;
}): React.JSX.Element {
  // Lock scroll behind the sheet.
  React.useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        role="presentation"
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          zIndex: 50,
        }}
      />
      {/* Sheet · wallpaper layer behind a dark scrim so the theme
          wallpaper reads as the shop background. ONE NEX IDENTITY ·
          same image the cover + chat use, no separate shop-bg asset. */}
      <div
        role="dialog"
        aria-modal
        aria-label={`${businessLabel} products`}
        data-nex-guest-shop-sheet
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: "72vh",
          backgroundColor: "rgba(2,9,20,0.82)",
          backgroundImage: wallpaperUrl
            ? `linear-gradient(180deg, rgba(2,9,20,0.72) 0%, rgba(2,9,20,0.88) 100%), url(${wallpaperUrl})`
            : undefined,
          backgroundSize: wallpaperUrl ? "cover" : undefined,
          backgroundPosition: wallpaperUrl ? "center" : undefined,
          backgroundRepeat: wallpaperUrl ? "no-repeat" : undefined,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderTop: `1px solid ${accentHex}66`,
          boxShadow: "0 -20px 60px rgba(0,0,0,0.5)",
          zIndex: 51,
          display: "flex",
          flexDirection: "column",
          color: "var(--nex-text, #F4F7FC)",
          paddingBottom: "env(safe-area-inset-bottom, 0)",
        }}
      >
        {/* Grab handle */}
        <div
          style={{
            width: 44,
            height: 4,
            borderRadius: 2,
            background: "rgba(244,247,252,0.3)",
            margin: "10px auto 6px",
          }}
          aria-hidden
        />
        <div
          style={{
            padding: "4px 20px 10px",
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              {businessLabel} shop
            </div>
            <div
              style={{
                fontSize: 12,
                color: "rgba(244,247,252,0.6)",
                marginTop: 2,
              }}
            >
              Tap a product to attach it to your message
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "transparent",
              border: "none",
              color: "rgba(244,247,252,0.5)",
              fontSize: 24,
              cursor: "pointer",
              padding: "4px 8px",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
        <div
          style={{
            overflowY: "auto",
            padding: "10px 12px 18px",
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 10,
          }}
        >
          {products.length === 0 ? (
            <div
              style={{
                gridColumn: "1 / -1",
                textAlign: "center",
                padding: "40px 20px",
                color: "rgba(244,247,252,0.5)",
                fontSize: 14,
              }}
            >
              No products listed yet.
            </div>
          ) : (
            products.map((p) => {
              const detailHref = businessSlug
                ? `/nex-native/${businessSlug}/${p.id}?commerce=1`
                : null;
              return (
                <div
                  key={p.id}
                  style={{
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    padding: 8,
                    borderRadius: 12,
                    background: "rgba(2,9,20,0.5)",
                    backdropFilter: "blur(6px)",
                    WebkitBackdropFilter: "blur(6px)",
                    border: `1px solid ${accentHex}44`,
                    color: "var(--nex-text, #F4F7FC)",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onPick(p)}
                    aria-label={`Ask about ${p.name}`}
                    style={{
                      position: "relative",
                      width: "100%",
                      aspectRatio: "1 / 1",
                      borderRadius: 8,
                      overflow: "hidden",
                      background: p.imageUrl
                        ? `#0a1120 url(${p.imageUrl}) center/cover no-repeat`
                        : "linear-gradient(135deg, #0A1930 0%, #061423 100%)",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      color: "rgba(244,247,252,0.4)",
                      fontSize: 11,
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    {!p.imageUrl && "No image"}
                    {detailHref && (
                      <a
                        href={detailHref}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Inspect ${p.name}`}
                        title="Inspect product"
                        style={{
                          position: "absolute",
                          right: 8,
                          bottom: 8,
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          background: "rgba(2,9,20,0.75)",
                          border: `1.5px solid ${accentHex}`,
                          color: accentHex,
                          display: "grid",
                          placeItems: "center",
                          backdropFilter: "blur(6px)",
                          WebkitBackdropFilter: "blur(6px)",
                          boxShadow: `0 4px 12px rgba(0,0,0,0.4), 0 0 10px ${accentHex}44`,
                          textDecoration: "none",
                          transition: "transform 140ms ease",
                        }}
                      >
                        <MagnifierIcon />
                      </a>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => onPick(p)}
                    style={{
                      background: "transparent",
                      border: "none",
                      padding: 0,
                      color: "inherit",
                      cursor: "pointer",
                      textAlign: "left",
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        lineHeight: 1.3,
                        minHeight: "2.6em",
                      }}
                    >
                      {p.name}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: accentHex,
                        fontWeight: 600,
                      }}
                    >
                      {formatPriceIDR(p.pricePence, p.currency)}
                    </div>
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}

/* ───────────────── Settings · signup gate modal ──────────────── */

function SettingsSignupModal({
  businessLabel,
  accentHex,
  signUpHref,
  onClose,
}: {
  businessLabel: string;
  accentHex: string;
  signUpHref: string;
  onClose: () => void;
}): React.JSX.Element {
  React.useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  return (
    <>
      <div
        onClick={onClose}
        role="presentation"
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          zIndex: 60,
        }}
      />
      <div
        role="dialog"
        aria-modal
        aria-labelledby="nex-guest-settings-title"
        data-nex-guest-settings-modal
        style={{
          position: "fixed",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(92vw, 420px)",
          padding: 24,
          borderRadius: 18,
          background: "rgba(4,20,36,0.96)",
          border: `1px solid ${accentHex}88`,
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
          zIndex: 61,
          color: "var(--nex-text, #F4F7FC)",
          textAlign: "center",
        }}
      >
        {/* Settings icon badge · echoes the header gear so the user
            understands which button opened this modal. */}
        <div
          style={{
            width: 56,
            height: 56,
            margin: "0 auto 14px",
            borderRadius: "50%",
            background: `${accentHex}22`,
            border: `1px solid ${accentHex}aa`,
            display: "grid",
            placeItems: "center",
            color: accentHex,
          }}
          aria-hidden
        >
          <SettingsIcon />
        </div>

        <h2
          id="nex-guest-settings-title"
          style={{
            margin: "0 0 8px",
            fontSize: 18,
            fontWeight: 700,
            lineHeight: 1.3,
          }}
        >
          Settings need a chat window
        </h2>
        <p
          style={{
            margin: "0 0 18px",
            fontSize: 14,
            color: "rgba(244,247,252,0.8)",
            lineHeight: 1.5,
          }}
        >
          Create your free chat window to control notifications, saved
          chats and media attachments.
        </p>

        <div
          style={{
            display: "flex",
            gap: 10,
            justifyContent: "center",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              background: "rgba(255,255,255,0.06)",
              color: "rgba(244,247,252,0.9)",
              border: "1px solid rgba(255,255,255,0.1)",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
              minWidth: 100,
            }}
          >
            Not now
          </button>
          <a
            href={signUpHref}
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              background: accentHex,
              color: "#1A1300",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              minWidth: 140,
              justifyContent: "center",
            }}
          >
            Create window
          </a>
        </div>
      </div>
    </>
  );
}
