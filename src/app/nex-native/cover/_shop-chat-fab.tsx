"use client";

// src/app/nex-native/cover/_shop-chat-fab.tsx
//
// Shop cover · floating "Chat with us" FAB bottom-right.
// Owner-sealed 2026-11-13 · shop-to-customer contact experience.
// -----------------------------------------------------------------------------
// Supersedes the 2026-11-06 Phase-A composer-drawer flow (draft + signup
// popup + email-only placeholder). The new contract is:
//
//   · Tap FAB
//     · Signed in     → router.push(/nex-native/chat/peer/<ownerAccountId>)
//                       (peer chat page renders the shop intro as a pseudo-
//                        bubble when the conversation is empty)
//     · Signed out    → Registration popup:
//                       "Chat with <Shop Name>
//                        Create your free NEX account to message this shop
//                        and receive replies directly in NEX Chat."
//                       [ Create Free Account ]  [ Sign In ]
//                       Both buttons carry ?next=/nex-native/<slug>?open-chat=1
//                       so the return flow auto-opens the chat after sign-in.
//
// Chat architecture (2026-11-09 device-only E2E seal):
//   · No server-side message storage · the intro bubble is a client-side
//     pseudo-message read from nex_business.shop_intro_message · never
//     written to nex_peer_message.
//   · Visitor replies flow through the sealed E2E peer-message encryption
//     path · no body content touches the server.
//
// Scope:
//   · FAB button · same visual vocabulary (56×56 circle, accent fill,
//     gold ring, chat glyph) as the Phase-A version.
//   · Registration popup · portalled modal, Esc to dismiss.
//   · No draft stash · no composer · no email-only fallback · all three
//     were Phase-A placeholders never wired to real actions.

import * as React from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

interface Props {
  /** Business owner's UUID · drives the peer-chat destination.
   *  /nex-native/chat/peer/<ownerAccountId>. When null the FAB renders
   *  in a visual-only state (owner preview mode) and tapping does
   *  nothing. */
  readonly ownerAccountId?: string | null;
  /** Shop display name · used in the registration popup header. */
  readonly shopName?: string | null;
  /** Shop slug · the visitor's RETURN URL after sign-up / sign-in.
   *  /nex-native/<slug>?open-chat=1 so the shop page auto-opens the
   *  chat once auth completes. When null the popup still renders but
   *  the return-to-shop param is omitted. */
  readonly shopSlug?: string | null;
  /** Server-resolved signed-in state. True = tap goes straight to
   *  peer chat. False = tap shows the registration popup. Default
   *  false so anonymous viewers always see the popup. */
  readonly isSignedIn?: boolean;
  /** Owner directive 2026-11-06 · "floating chat button must also
   *  change with theme color". The FAB sits outside CoverThemeSkin
   *  so --nex-accent doesn't inherit · callers thread the tint in
   *  explicitly. Defaults to the world-palette gold when omitted. */
  readonly accentHex?: string | null;
}

const GOLD = "var(--nex-world-secondary, #C6A15B)";
const CREAM = "#FAF8F4";
const INK = "#0A1526";
const INK_MUTED = "#4B5468";
const POPUP_BG = "rgba(10, 21, 38, 0.72)";
const CARD_BG = "#FFFFFF";

export function ShopChatFab({
  ownerAccountId,
  shopName,
  shopSlug,
  isSignedIn = false,
  accentHex,
}: Props): React.JSX.Element {
  const router = useRouter();
  const accent =
    accentHex && /^#[0-9A-Fa-f]{6}$/.test(accentHex) ? accentHex : "#C6A15B";
  const [showPopup, setShowPopup] = React.useState(false);

  // Esc closes the popup.
  React.useEffect(() => {
    if (!showPopup) return;
    const handler = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setShowPopup(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showPopup]);

  function onTap(): void {
    if (!ownerAccountId) return;
    if (isSignedIn) {
      router.push(`/nex-native/chat/peer/${ownerAccountId}`);
      return;
    }
    setShowPopup(true);
  }

  const shopLabel = shopName?.trim() || "this shop";
  const returnPath = shopSlug
    ? `/nex-native/${shopSlug}?open-chat=1`
    : "/nex-native/contacts";
  const signUpHref = `/nex-native/sign-up?next=${encodeURIComponent(returnPath)}`;
  const signInHref = `/nex-native/sign-in?next=${encodeURIComponent(returnPath)}`;

  return (
    <>
      <button
        type="button"
        aria-label={`Chat with ${shopLabel}`}
        onClick={onTap}
        data-nex-shop-chat-fab
        style={{
          position: "fixed",
          right: 14,
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 18px)",
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: accent,
          border: `2px solid ${GOLD}`,
          color: CREAM,
          display: "grid",
          placeItems: "center",
          cursor: ownerAccountId ? "pointer" : "default",
          zIndex: 60,
          boxShadow: "0 6px 18px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(0,0,0,0.08)",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <svg
          width={26}
          height={26}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>

      {showPopup ? (
        <RegistrationPopup
          shopName={shopLabel}
          signUpHref={signUpHref}
          signInHref={signInHref}
          accentHex={accent}
          onClose={() => setShowPopup(false)}
        />
      ) : null}
    </>
  );
}

// ─── Registration popup ────────────────────────────────────────────────

function RegistrationPopup({
  shopName,
  signUpHref,
  signInHref,
  accentHex,
  onClose,
}: {
  readonly shopName: string;
  readonly signUpHref: string;
  readonly signInHref: string;
  readonly accentHex: string;
  readonly onClose: () => void;
}): React.JSX.Element | null {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="nex-shop-chat-popup-title"
      data-nex-shop-chat-popup
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        display: "grid",
        placeItems: "center",
        padding: 20,
        background: POPUP_BG,
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 360,
          background: CARD_BG,
          borderRadius: 18,
          padding: "24px 20px 20px",
          color: INK,
          boxShadow: "0 24px 56px rgba(0, 0, 0, 0.45)",
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "transparent",
            border: "none",
            fontSize: 20,
            lineHeight: 1,
            cursor: "pointer",
            color: INK_MUTED,
          }}
        >
          ×
        </button>

        <h2
          id="nex-shop-chat-popup-title"
          style={{
            margin: "0 0 10px",
            fontSize: 18,
            fontWeight: 800,
            letterSpacing: "0.005em",
            color: INK,
            textAlign: "center",
          }}
        >
          Chat with {shopName}
        </h2>
        <p
          style={{
            margin: "0 0 20px",
            fontSize: 13,
            lineHeight: 1.5,
            color: INK_MUTED,
            textAlign: "center",
          }}
        >
          Create your free NEX account to message this shop and receive
          replies directly in NEX Chat.
        </p>

        <Link
          href={signUpHref}
          data-nex-shop-chat-popup-signup
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "14px 16px",
            borderRadius: 14,
            background: accentHex,
            color: CREAM,
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            textDecoration: "none",
            boxShadow: `0 4px 12px ${accentHex}40`,
            marginBottom: 10,
          }}
        >
          Create Free Account
        </Link>

        <Link
          href={signInHref}
          data-nex-shop-chat-popup-signin
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "12px 16px",
            borderRadius: 14,
            background: "transparent",
            color: INK,
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.02em",
            textDecoration: "none",
            border: `1px solid ${INK_MUTED}44`,
          }}
        >
          Sign In
        </Link>
      </div>
    </div>,
    document.body,
  );
}
