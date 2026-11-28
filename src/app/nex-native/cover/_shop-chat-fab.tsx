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
// Owner directive 2026-11-28 · Rev 3 guest-shop-enquiry pathway.
// Anon FAB tap now mounts the enquiry form popup (name/email/phone/
// country/message → POST /api/nex-native/shop-enquiry · email-as-body
// per design doc 2026-11-28 §4-§6). The shop page stays visible behind
// the shaded backdrop · the "background diverted shop chat page" the
// owner described. Visitors who prefer a NEX account still get the
// secondary CTA inside the enquiry popup ("Prefer your own NEX account?
// Create one") which routes into the sealed ShopChatRegistrationPopup
// sign-up chain.
import { GuestShopEnquiryPopup } from "@/components/nex-native/business-chat/GuestShopEnquiryPopup";

interface Props {
  /** Business owner's UUID · drives the peer-chat destination.
   *  /nex-native/chat/peer/<ownerAccountId>. When null the FAB renders
   *  in a visual-only state (owner preview mode) and tapping does
   *  nothing. */
  readonly ownerAccountId?: string | null;
  /** Business UUID · required to post the Rev 3 enquiry. When omitted
   *  (owner preview mode, legacy callers), the anon popup refuses to
   *  render and the FAB behaves as visual-only. */
  readonly shopBusinessId?: string | null;
  /** Shop display name · used in the enquiry popup header. */
  readonly shopName?: string | null;
  /** Shop slug · the visitor's RETURN URL after sign-up / sign-in from
   *  the "Create account" secondary CTA inside the enquiry popup. */
  readonly shopSlug?: string | null;
  /** Owner directive 2026-11-28 (eighth-pass) · the enquiry popup now
   *  renders a hero + logo + address identity block above the form so
   *  it reads as the shop's own home-page header. These flow in from
   *  the resolved `nex_business` row on the public shop page · both
   *  optional, both gracefully omitted when the shop hasn't uploaded a
   *  logo / set an address. */
  readonly shopLogoUrl?: string | null;
  readonly shopAddress?: string | null;
  /** Server-resolved signed-in state. True = tap goes straight to
   *  peer chat. False = tap shows the enquiry popup. */
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
  shopBusinessId,
  shopName,
  shopSlug,
  shopLogoUrl,
  shopAddress,
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
    // Owner directive 2026-11-28 · anon tap opens the Rev 3 enquiry
    // popup over the shop page (shaded backdrop = the "diverted
    // shop chat page" visible behind). Signed-in viewers continue
    // straight into the business-chat conversation as before.
    if (!shopSlug) return;
    if (isSignedIn) {
      router.push(`/nex-native/${shopSlug}?open-chat=1`);
      return;
    }
    // Owner-preview / legacy callers without a business id fall back
    // to the FAB's visual-only mode · never mount a popup we can't
    // POST from.
    if (!shopBusinessId) return;
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

      {showPopup && shopSlug && shopBusinessId ? (
        <GuestShopEnquiryPopup
          shopName={shopName ?? null}
          shopSlug={shopSlug}
          shopBusinessId={shopBusinessId}
          accent={accent}
          shopLogoUrl={shopLogoUrl ?? null}
          shopAddress={shopAddress ?? null}
          onDismiss={() => setShowPopup(false)}
        />
      ) : null}
    </>
  );
}


// Owner directive 2026-11-28 · FAB anon branch now mounts
// GuestShopEnquiryPopup (Rev 3 email-as-body pathway). The older
// ShopChatRegistrationPopup remains the Product Detail Sheet's
// "More Details" gate and the anon chat preview composer-send
// gate · both are untouched. The enquiry popup carries a secondary
// CTA that links into that same sign-up flow for visitors who prefer
// a NEX account to a one-off email.
