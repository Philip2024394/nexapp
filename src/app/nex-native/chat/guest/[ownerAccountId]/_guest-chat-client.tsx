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
import { ChatIdentityHeader } from "@/lib/nex-native/chat-chrome/chat-identity-header";
import { ChatComposerPill } from "@/lib/nex-native/chat-chrome/chat-composer-pill";
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
  const signUpHref = `/nex-native/create-account?next=${encodeURIComponent(`/nex-native/chat/guest/${ownerAccountId}`)}`;

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
        backgroundColor: "var(--nex-world-background-base, #020914)",
        backgroundImage: theme.wallpaperUrl
          ? `linear-gradient(180deg, rgba(2,9,20,0.35) 0%, rgba(2,9,20,0.65) 100%), url(${theme.wallpaperUrl})`
          : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed",
      }}
    >
      {/* ─── HEADER · sealed ChatIdentityHeader primitive ──────────
          Single source of truth · identical shape across authenticated
          peer chat, guest chat, and theme viewers. See
          src/lib/nex-native/chat-chrome/chat-identity-header.tsx. */}
      <header
        style={{
          position: "relative",
          flexShrink: 0,
          padding:
            "calc(env(safe-area-inset-top, 0) + 14px) 12px 14px 20px",
          textShadow: "0 2px 20px rgba(0,0,0,0.75)",
        }}
      >
        <ChatIdentityHeader
          avatarUrl={businessLogoUrl}
          displayName={businessLabel}
          subtitle="Chatting as guest"
          presenceKind="online"
          rightReserveWidth={0}
        />
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

      {/* ─── TIKTOK-STYLE RIGHT-EDGE DOCK ──────────────────────
          Vertical column of 48px round action buttons · pinned to the
          right edge, vertically positioned above the composer. Each
          button has a text-shadow filter so it stays legible against
          any wallpaper. Replaces the header R1 cluster · founder
          direction 2026-10-14. */}
      <div
        data-nex-guest-right-dock
        aria-label="Chat actions"
        style={{
          position: "fixed",
          right: 10,
          bottom: "calc(env(safe-area-inset-bottom, 0) + 110px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
          zIndex: 20,
          pointerEvents: "none",
        }}
      >
        <DockButton
          onClick={() => setShopOpen(true)}
          ariaLabel={`Browse ${businessLabel} products`}
          label="Shop"
          glow
          accentHex={theme.accentHex}
        >
          <ShopIcon />
        </DockButton>
        <DockButton
          onClick={() => setSettingsOpen(true)}
          ariaLabel="Settings"
          label="Settings"
          accentHex={theme.accentHex}
        >
          <SettingsIcon />
        </DockButton>
        <DockLink
          href="/nex-native/cart"
          ariaLabel="Cart"
          label="Cart"
          accentHex={theme.accentHex}
        >
          <CartIcon />
        </DockLink>
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
              To receive reply from {businessLabel} you will require to
              create your free account.
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

      {/* ─── COMPOSER · sealed ChatComposerPill primitive ──────────
          Byte-identical to the Joker/PortraitBloomShell PeerComposer
          pill shape, driven by sendGuestMessageAction. */}
      <div
        style={{
          padding: "0 12px calc(env(safe-area-inset-bottom, 0) + 12px)",
          flexShrink: 0,
        }}
        data-nex-guest-composer
      >
        <ChatComposerPill
          value={composerText}
          onChange={setComposerText}
          onSend={() =>
            void handleSend({
              preventDefault: () => undefined,
            } as React.FormEvent)
          }
          placeholder={`Message ${businessLabel}…`}
          accentHex={theme.accentHex}
          composerBg={theme.composerRimHex ? undefined : undefined}
          sending={sending}
          maxLength={2000}
          textareaRef={textareaRef}
          errorText={sendError ?? undefined}
        />
      </div>

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

/* ───────────────── Right-edge dock button primitives ─────────── */
// TikTok-style naked floating glyphs · no circular chrome · each icon
// sits on a transparent hit target with a drop-shadow filter so it
// stays legible against any wallpaper. 40px hit target holds a 32px
// glyph with a 11px label beneath · pointerEvents:none on the
// container is overridden here with auto so taps register.

const DOCK_HIT_SIZE = 40;
const DOCK_LABEL_FONT = 11;

function DockButton({
  onClick,
  ariaLabel,
  label,
  glow,
  accentHex,
  children,
}: {
  onClick: () => void;
  ariaLabel: string;
  label: string;
  glow?: boolean;
  accentHex: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <DockShell glow={glow} accentHex={accentHex} label={label}>
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        style={DOCK_PRESSABLE_STYLE(accentHex)}
      >
        {children}
      </button>
    </DockShell>
  );
}

function DockLink({
  href,
  ariaLabel,
  label,
  accentHex,
  children,
}: {
  href: string;
  ariaLabel: string;
  label: string;
  accentHex: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <DockShell accentHex={accentHex} label={label}>
      <Link href={href} aria-label={ariaLabel} style={DOCK_PRESSABLE_STYLE(accentHex)}>
        {children}
      </Link>
    </DockShell>
  );
}

function DockShell({
  glow,
  accentHex,
  label,
  children,
}: {
  glow?: boolean;
  accentHex: string;
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <>
      {glow && (
        <style>{`
          @keyframes nex-guest-dock-shop-pulse {
            0%, 100% {
              filter:
                drop-shadow(0 2px 4px rgba(0,0,0,0.8))
                drop-shadow(0 0 4px ${accentHex}80);
            }
            50% {
              filter:
                drop-shadow(0 2px 4px rgba(0,0,0,0.8))
                drop-shadow(0 0 12px ${accentHex}dd);
            }
          }
          [data-nex-guest-dock-shop] [data-nex-guest-dock-glyph] {
            animation: nex-guest-dock-shop-pulse 2200ms ease-in-out infinite;
          }
        `}</style>
      )}
      <div
        data-nex-guest-dock-item
        data-nex-guest-dock-shop={glow ? "true" : undefined}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
          pointerEvents: "auto",
        }}
      >
        <div
          data-nex-guest-dock-glyph
          style={{
            width: DOCK_HIT_SIZE,
            height: DOCK_HIT_SIZE,
            display: "grid",
            placeItems: "center",
            color: "#FFFFFF",
            filter: glow
              ? undefined
              : "drop-shadow(0 2px 4px rgba(0,0,0,0.8))",
          }}
        >
          {children}
        </div>
        <div
          style={{
            fontSize: DOCK_LABEL_FONT,
            fontWeight: 600,
            color: "#FFFFFF",
            textShadow: "0 2px 6px rgba(0,0,0,0.9)",
            letterSpacing: "0.02em",
          }}
        >
          {label}
        </div>
      </div>
    </>
  );
}

function DOCK_PRESSABLE_STYLE(accentHex: string): React.CSSProperties {
  return {
    width: "100%",
    height: "100%",
    display: "grid",
    placeItems: "center",
    color: "var(--nex-text, #F4F7FC)",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: 0,
    textDecoration: "none",
    // Hover/focus affordance is subtle · the accent-rim already
    // signals interactivity. accentHex kept here for future states.
    outlineColor: accentHex,
  };
}

/* ───────────────── SVG icons (match sealed cluster) ────────────── */

function ShopIcon(): React.JSX.Element {
  // Shop-bag · same silhouette the sealed R1 cluster uses when the
  // peer owns a non-venue business.
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="32"
      height="32"
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

function CartIcon(): React.JSX.Element {
  // Shopping-cart glyph · matches the sealed R1 cart icon shape.
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  );
}

function SettingsIcon(): React.JSX.Element {
  // Standard gear/settings glyph.
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="32"
      height="32"
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
              // Owner directive 2026-11-10 · guest-chat product sheet
              // × now a solid NEX Orange puck with a white glyph ·
              // matches the shop-drawer × + How-It-Works close.
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "#FF7200",
              border: "1px solid #FF7200",
              color: "#FFFFFF",
              fontSize: 18,
              fontWeight: 800,
              cursor: "pointer",
              padding: 0,
              lineHeight: 1,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 8px rgba(255, 114, 0, 0.35)",
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
