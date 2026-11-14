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
import { useRouter } from "next/navigation";
// Stage 7 · item 5 · 2026-11-14 · shared polished Stage-4 popup.
// Anon tap now mounts this instead of routing to the anon preview
// page (one hop less · same "your own private NEX" honesty copy).
import { ShopChatRegistrationPopup } from "@/components/nex-native/business-chat/ShopChatRegistrationPopup";

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
    // Stage 7 · item 5 · 2026-11-14 · anon tap now opens the sealed
    // polished Stage-4 modal IN-SHOP · same honesty copy as the
    // Product Detail Sheet's More-Details popup. The older anon
    // preview page at `/<slug>/chat` stays available but is no
    // longer the first stop · it is still used as the return path
    // via the `?next=` chain when the modal's Create / Sign-in
    // buttons complete. Signed-in flow unchanged.
    if (!shopSlug) return;
    if (isSignedIn) {
      router.push(`/nex-native/${shopSlug}?open-chat=1`);
      return;
    }
    setShowPopup(true);
  }

  const shopLabel = shopName?.trim() || "this shop";

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

      {showPopup && shopSlug ? (
        <ShopChatRegistrationPopup
          shopName={shopName ?? null}
          shopSlug={shopSlug}
          productId={null}
          accent={accent}
          onDismiss={() => setShowPopup(false)}
        />
      ) : null}
    </>
  );
}


// Stage 7 · item 5 · 2026-11-14 · inline RegistrationPopup removed.
// The polished Stage-4 modal now lives at
// `@/components/nex-native/business-chat/ShopChatRegistrationPopup`
// and is reused by the Product Detail Sheet, this FAB, and the anon
// chat preview · one shape, one copy, one `?next=` chain.
