// src/app/nex-native/contacts/_nex1-welcome-banner.tsx
//
// NEX · S4 · minimal NEX1 welcome banner for /nex-native/contacts.
// Owner-authorised 2026-10-18 · D3 Option C with the dismissal
// safeguard.
// -----------------------------------------------------------------------------
// Doctrinal boundaries this module respects:
//
//   · NO synthetic contacts row · the banner is a <section> above the
//     sealed contacts list, not a fake row inside the list. The
//     sealed D9 "friend/business only" contacts doctrine is
//     preserved verbatim.
//
//   · NO redirect to /nex-native/home · the banner links to the real
//     NEX1 conversation at `NEX_OFFICIAL_CHAT_HREF` which uses the
//     sealed peer-chat route · no onboarding redirects, no synthetic
//     landing.
//
//   · NO deletion / hiding of the underlying NEX1 conversation ·
//     dismissal sets the `nex_welcome_banner_dismissed` cookie and
//     nothing else. The sealed `nex_peer_conversation` /
//     `nex_peer_message` rows are untouched. The user can still
//     open NEX1 from the chat routes or any future surface.
//
//   · NO Vault / trial / Shop-slider wiring · S4 is scoped to the
//     banner itself.
//
// Visibility rules (all AND-ed):
//
//   1 · The sealed first-contact predicate (`shouldShowFirstContact`)
//       returns true · i.e., the viewer has:
//         (a) zero non-NEX1 peer conversations, AND
//         (b) either no NEX1 conversation yet, OR their NEX1
//             conversation's last message is still from NEX1
//             (user has NOT replied).
//   2 · The viewer has NOT dismissed the banner (cookie absent or
//       expired).
//
// Hide-after-reply is handled by rule 1 · the predicate flips the
// moment the user replies, so no explicit "if replied, drop" needed
// here. The dismissal cookie is a UX override on top of (1).

import "server-only";

import type * as React from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import {
  NEX_OFFICIAL_CHAT_HREF,
  NEX_OFFICIAL_DISPLAY_NAME,
} from "@/lib/nex-native/nex-official";
import type { NexUuid } from "@/lib/nex-native/types";
// Sealed resolver · reused verbatim from the sealed home-page
// first-contact panel · no fork, no local reimplementation. Exposed
// as a sealed primitive per the file-header contract at
// src/app/nex-native/home/_first-contact-panel.tsx (lines 15-18).
import { resolveFirstContactSignals } from "../home/_first-contact-panel";
import {
  NEX1_BANNER_DISMISSED_COOKIE,
  shouldShowNex1WelcomeBanner,
} from "./_banner-visibility";
import { dismissNex1WelcomeBannerAction } from "./_dismiss-nex1-banner-action";

// Re-export the sealed constant for callers that still import it
// from the banner module (e.g. the dismiss action).
export { NEX1_BANNER_DISMISSED_COOKIE } from "./_banner-visibility";

/** Palette · reused from the sealed first-contact panel so the banner
 *  reads as a sibling design surface, not a divergent treatment. */
const NEX = {
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  cyan: "#00AFFF",
  cyanFaint: "rgba(0, 175, 255, 0.14)",
  cyanSoft: "rgba(0, 175, 255, 0.42)",
  orange: "#FF7200",
  panelSoft: "rgba(6, 15, 28, 0.72)",
  borderSoft: "rgba(255, 255, 255, 0.07)",
};

export interface Nex1WelcomeBannerProps {
  /** Viewer's NEX account id · passed in from the contacts page. */
  readonly accountId: NexUuid;
  /** Viewer's first name for the greeting · falls back to "there"
   *  when absent (never fabricates). */
  readonly firstName: string | null;
}

export async function Nex1WelcomeBanner(
  props: Nex1WelcomeBannerProps,
): Promise<React.JSX.Element | null> {
  // Resolve the sealed signals using sealed services only · fail
  // closed if either read errors out.
  const signals = await resolveFirstContactSignals(props.accountId);

  // Dismissal cookie · presence of ANY value counts as dismissed.
  // httpOnly means only our server action can set it.
  const jar = await cookies();
  const dismissed = jar.get(NEX1_BANNER_DISMISSED_COOKIE)?.value === "1";

  if (!shouldShowNex1WelcomeBanner(signals, dismissed)) {
    return null;
  }

  const greetName =
    props.firstName && props.firstName.trim().length > 0
      ? props.firstName.trim()
      : "there";

  return (
    <section
      data-nex-contacts-nex1-welcome-banner
      aria-label={`${NEX_OFFICIAL_DISPLAY_NAME} welcome message`}
      style={{
        position: "relative",
        margin: "0 16px 12px",
        padding: "14px 14px 12px",
        borderRadius: 14,
        background: NEX.panelSoft,
        border: `1px solid ${NEX.cyanSoft}`,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: NEX.cyan,
            }}
          >
            {NEX_OFFICIAL_DISPLAY_NAME} · Welcome
          </div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: NEX.text,
              letterSpacing: "-0.005em",
            }}
          >
            Hi {greetName} · NEX has sent you a hello message
          </div>
        </div>
        <form
          action={dismissNex1WelcomeBannerAction}
          style={{ margin: 0, padding: 0 }}
        >
          <button
            type="submit"
            data-nex-contacts-nex1-welcome-dismiss
            aria-label="Dismiss NEX welcome banner"
            style={{
              padding: "4px 10px",
              borderRadius: 999,
              border: `1px solid ${NEX.borderSoft}`,
              background: "transparent",
              color: NEX.textDim,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Dismiss
          </button>
        </form>
      </div>
      <div
        style={{
          fontSize: 12,
          color: NEX.textDim,
          lineHeight: 1.5,
        }}
      >
        Open it any time · dismissing this banner won&apos;t delete
        the conversation.
      </div>
      <Link
        href={NEX_OFFICIAL_CHAT_HREF}
        data-nex-contacts-nex1-welcome-open
        data-nex-contacts-nex1-welcome-href={NEX_OFFICIAL_CHAT_HREF}
        style={{
          alignSelf: "flex-start",
          padding: "7px 14px",
          borderRadius: 999,
          background: NEX.orange,
          color: "#0B0F1A",
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          textDecoration: "none",
        }}
      >
        Open chat with NEX →
      </Link>
    </section>
  );
}
